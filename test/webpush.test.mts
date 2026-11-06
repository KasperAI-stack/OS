/* Web Push: krypteringen dekrypteres af http_ece (den implementering, web-push bruger),
   og VAPID-signaturen verificeres med den offentlige nøgle. Nøgler lavet af web-push
   (dem, der allerede ligger i lageret) virker med den nye kode. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createECDH, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { b64url, encryptPayload, generateVapidKeys, unb64url, vapidAuthorization } from "../netlify/lib/webpush.mts";

const require = createRequire(import.meta.url);
const ece = require("http_ece");
const webpush = require("web-push");

test("beskeden kan dekrypteres af modtageren (aes128gcm)", async () => {
  const ua = createECDH("prime256v1");
  ua.generateKeys();
  const auth = randomBytes(16);
  const body = await encryptPayload('{"title":"Hej","body":"æøå"}', b64url(ua.getPublicKey()), b64url(auth));
  const plain = ece.decrypt(Buffer.from(body), { version: "aes128gcm", privateKey: ua, authSecret: auth });
  assert.equal(plain.toString("utf8"), '{"title":"Hej","body":"æøå"}');
});

async function verifyVapid(header: string, publicKey: string, endpoint: string) {
  const m = header.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
  assert.ok(m, "header-format");
  assert.equal(m[4], publicKey);
  const key = await crypto.subtle.importKey("raw", unb64url(publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, unb64url(m[3]), new TextEncoder().encode(m[1] + "." + m[2]));
  assert.ok(ok, "signaturen er gyldig");
  const claims = JSON.parse(new TextDecoder().decode(unb64url(m[2])));
  assert.equal(claims.aud, new URL(endpoint).origin);
  assert.equal(claims.sub, "https://tasks.example");
  assert.ok(claims.exp > Date.now() / 1000 && claims.exp <= Date.now() / 1000 + 24 * 3600);
}

test("VAPID med nye nøgler", async () => {
  const k = await generateVapidKeys();
  assert.equal(unb64url(k.publicKey).length, 65);
  assert.equal(unb64url(k.privateKey).length, 32);
  const endpoint = "https://fcm.googleapis.com/fcm/send/abc";
  await verifyVapid(await vapidAuthorization(endpoint, "https://tasks.example", k.publicKey, k.privateKey), k.publicKey, endpoint);
});

test("VAPID med nøgler lavet af web-push (dem, der ligger i lageret i dag)", async () => {
  const k = webpush.generateVAPIDKeys();
  const endpoint = "https://web.push.apple.com/xyz";
  await verifyVapid(await vapidAuthorization(endpoint, "https://tasks.example", k.publicKey, k.privateKey), k.publicKey, endpoint);
});
