/* Adgangsvagten og Access-JWT (M12). Svarer til "færdig når" i Studios guide (M2 + M4):
   403 uden JWT, med forkert aud, forkert iss, udløbet JWT og forkert signatur, fail closed
   uden opsætning, 403 for ukendte adresser og 404 for andet end /ext og /mcp på API-adressen. */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { gate, type GateConfig } from "../server/gate.mts";
import { resetAccessCache, verifyAccess } from "../server/access.mts";

const TEAM = "old-dust-74a9.cloudflareaccess.com";
const AUD = "test-aud-123";
const CFG: GateConfig = { uiHost: "tasks-ui.heyotto.win", apiHost: "tasks.heyotto.win", team: TEAM, aud: AUD };

const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = ""; for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function keypair(kid: string) {
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid };
  return { kid, priv: pair.privateKey, jwk };
}

async function sign(k: { kid: string; priv: CryptoKey }, claims: Record<string, unknown>, alg = "RS256") {
  const head = b64url(JSON.stringify({ alg, kid: k.kid, typ: "JWT" }));
  const body = b64url(JSON.stringify(claims));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", k.priv, new TextEncoder().encode(head + "." + body));
  return head + "." + body + "." + b64url(sig);
}

const good = () => ({ aud: [AUD], iss: "https://" + TEAM, exp: Math.floor(Date.now() / 1000) + 3600, email: "kasper@example.com" });

let key: Awaited<ReturnType<typeof keypair>>, other: Awaited<ReturnType<typeof keypair>>;
let fetches = 0;
const fetcher = async () => { fetches++; return { keys: [key.jwk] }; };

beforeEach(async () => {
  resetAccessCache();
  fetches = 0;
  key ||= await keypair("k1");
  other ||= await keypair("k1");      // samme kid, anden nøgle → forkert signatur
});

const req = (url: string, init: RequestInit & { jwt?: string } = {}) => {
  const headers = new Headers(init.headers);
  if (init.jwt) headers.set("cf-access-jwt-assertion", init.jwt);
  return new Request(url, { ...init, headers });
};

test("gyldigt Access-login slipper igennem og giver e-mailen videre", async () => {
  const r = await verifyAccess(await sign(key, good()), { team: TEAM, aud: AUD }, fetcher);
  assert.deepEqual(r, { ok: true, email: "kasper@example.com" });
  const g = await gate(req("https://tasks-ui.heyotto.win/", { jwt: await sign(key, good()) }), CFG, fetcher);
  assert.equal(g.stop, null);
  assert.equal(g.user, "kasper@example.com");
});

test("403 uden JWT, forkert aud, forkert iss, udløbet, forkert signatur og forkert algoritme", async () => {
  const cases: [string, string | undefined][] = [
    ["uden JWT", undefined],
    ["forkert aud", await sign(key, { ...good(), aud: ["en-anden"] })],
    ["forkert iss", await sign(key, { ...good(), iss: "https://ond.cloudflareaccess.com" })],
    ["udløbet", await sign(key, { ...good(), exp: Math.floor(Date.now() / 1000) - 10 })],
    ["forkert signatur", await sign(other, good())],
    ["HS256", await sign(key, good(), "HS256")],
    ["vrøvl", "abc.def.ghi"]
  ];
  for (const [name, jwt] of cases) {
    const res = (await gate(req("https://tasks-ui.heyotto.win/api/data", { jwt }), CFG, fetcher)).stop;
    assert.equal(res?.status, 403, name);
  }
});

test("fail closed: uden team eller AUD afvises alt på app-adressen", async () => {
  const jwt = await sign(key, good());
  assert.equal((await gate(req("https://tasks-ui.heyotto.win/", { jwt }), { ...CFG, aud: "" }, fetcher)).stop?.status, 403);
  assert.equal((await gate(req("https://tasks-ui.heyotto.win/", { jwt }), { ...CFG, team: "" }, fetcher)).stop?.status, 403);
});

test("ukendt kid: nøglerne hentes igen, men højst én gang i minuttet", async () => {
  const stranger = await keypair("k-ukendt");
  await verifyAccess(await sign(key, good()), { team: TEAM, aud: AUD }, fetcher);
  assert.equal(fetches, 1);
  for (let i = 0; i < 3; i++) assert.equal((await verifyAccess(await sign(stranger, good()), { team: TEAM, aud: AUD }, fetcher)).ok, false);
  assert.equal(fetches, 1);
});

test("API-adressen: kun /ext og /mcp; app-adressen sender API'et videre", async () => {
  assert.equal((await gate(req("https://tasks.heyotto.win/ext/health"), CFG, fetcher)).stop, null);
  assert.equal((await gate(req("https://tasks.heyotto.win/mcp"), CFG, fetcher)).stop, null);
  for (const p of ["/", "/api/data", "/index.html", "/sw.js", "/extra"]) {
    assert.equal((await gate(req("https://tasks.heyotto.win" + p), CFG, fetcher)).stop?.status, 404, p);
  }
  assert.equal((await gate(req("https://tasks-ui.heyotto.win/ext/health", { jwt: await sign(key, good()) }), CFG, fetcher)).stop?.status, 404);
});

test("ukendte adresser (fx workers.dev) giver 403; localhost er åben til udvikling", async () => {
  assert.equal((await gate(req("https://heyotto-tasks.heyotto-tasks.workers.dev/"), CFG, fetcher)).stop?.status, 403);
  assert.equal((await gate(req("https://ond.example/ext/health"), CFG, fetcher)).stop?.status, 403);
  assert.equal((await gate(req("http://127.0.0.1:8799/api/data"), CFG, fetcher)).stop, null);
});

test("ændringer i /api kræver X-Tasks: 1 og appens egen Origin", async () => {
  const jwt = await sign(key, good());
  const put = async (headers: Record<string, string>) => (await gate(req("https://tasks-ui.heyotto.win/api/data", { method: "PUT", jwt, headers }), CFG, fetcher)).stop;
  assert.equal((await put({ Origin: "https://tasks-ui.heyotto.win" }))?.status, 403, "uden X-Tasks");
  assert.equal((await put({ "X-Tasks": "1", Origin: "https://ond.example" }))?.status, 403, "fremmed Origin");
  assert.equal((await put({ "X-Tasks": "1" }))?.status, 403, "uden Origin");
  assert.equal(await put({ "X-Tasks": "1", Origin: "https://tasks-ui.heyotto.win" }), null);
  assert.equal((await gate(req("https://tasks-ui.heyotto.win/api/data", { jwt }), CFG, fetcher)).stop, null, "GET kræver ingen header");
});
