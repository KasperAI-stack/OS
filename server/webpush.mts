/* HeyOtto Tasks — Web Push uden biblioteker, kun Web Crypto og fetch.

   Virker ens i Node og på Cloudflare Workers (web-push-pakken bruger Nodes https og
   ECDH og kan ikke køre på Workers). To standarder:

     VAPID (RFC 8292)        hvem sender: et ES256-signeret JWT i Authorization-headeren
     aes128gcm (RFC 8291)    selve beskeden krypteres til enheden, så push-tjenesten
                             (Google, Apple, Mozilla) ikke kan læse den

   Nøgleformatet er det samme som web-push' (base64url: offentlig nøgle 65 bytes
   ukomprimeret, privat nøgle 32 bytes), så nøgler, der allerede ligger i lageret,
   virker uændret. */

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();

export function b64url(bytes: ArrayBuffer | Uint8Array) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function unb64url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
}

/* ---------- VAPID ---------- */

export async function generateVapidKeys() {
  const pair = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const pub = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
  const jwk = await subtle.exportKey("jwk", pair.privateKey);
  return { publicKey: b64url(pub), privateKey: String(jwk.d) };
}

function privateJwk(publicKey: string, privateKey: string): JsonWebKey {
  const pub = unb64url(publicKey);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("VAPID-nøglen har et ukendt format.");
  return { kty: "EC", crv: "P-256", d: privateKey, x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33, 65)), ext: true };
}

// Authorization-headeren: "vapid t=<JWT>, k=<offentlig nøgle>". Gælder 12 timer.
export async function vapidAuthorization(endpoint: string, subject: string, publicKey: string, privateKey: string, now = Date.now()) {
  const key = await subtle.importKey("jwk", privateJwk(publicKey, privateKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  // Web Crypto giver r||s (64 bytes), som er præcis det format, JWS ES256 bruger
  const sig = await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(header + "." + claims));
  return `vapid t=${header}.${claims}.${b64url(sig)}, k=${publicKey}`;
}

/* ---------- Kryptering af beskeden (aes128gcm) ---------- */

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const key = await subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
}

// Krypterer til én enhed. p256dh og auth kommer fra browserens abonnement.
export async function encryptPayload(payload: string, p256dh: string, auth: string, opts: { salt?: Uint8Array; keys?: CryptoKeyPair } = {}) {
  const uaPublic = unb64url(p256dh);
  const authSecret = unb64url(auth);
  const pair = opts.keys || await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPublic = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
  const uaKey = await subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: uaKey }, pair.privateKey, 256));

  const ikm = await hkdf(authSecret, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = opts.salt || globalThis.crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  // Én record: beskeden + 0x02 (sidste record), ingen udfyldning
  const plain = concat(enc.encode(payload), new Uint8Array([2]));
  const aes = await subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, plain));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

/* ---------- Send ---------- */

export class PushError extends Error {
  statusCode: number;
  body: string;
  constructor(statusCode: number, body: string) {
    super(`Push-tjenesten svarede ${statusCode}`);
    this.statusCode = statusCode;
    this.body = body;
  }
}

export type PushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function sendPush(sub: PushSubscription, payload: string, vapid: { subject: string; publicKey: string; privateKey: string },
                               opts: { ttl?: number; urgency?: "very-low" | "low" | "normal" | "high" } = {}) {
  const body = await encryptPayload(payload, sub.keys.p256dh, sub.keys.auth);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      TTL: String(opts.ttl ?? 6 * 3600),
      Urgency: opts.urgency || "normal",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      Authorization: await vapidAuthorization(sub.endpoint, vapid.subject, vapid.publicKey, vapid.privateKey)
    },
    body,
    signal: AbortSignal.timeout(15_000)
  });
  if (!res.ok) throw new PushError(res.status, (await res.text().catch(() => "")).slice(0, 300));
}
