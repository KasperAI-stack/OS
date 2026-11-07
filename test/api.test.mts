/* API'et gennem handle() med D1-lageret: præcis den vej, Workeren bruger. Ingen server,
   ingen Cloudflare, ingen Claude-kald (kørslen lægges kun i kø). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { handle } from "../server/api.mts";
import type { Platform } from "../server/platform.mts";
import { d1Store } from "../worker/store.mts";
import { memoryD1 } from "./helpers.mts";

const ORIGIN = "http://127.0.0.1:8799";
const PASSWORD = "en-lang-test-adgangskode";

function setup(vars: Record<string, string> = {}, user = "") {
  const started: string[] = [];
  const waits: Promise<unknown>[] = [];
  const p: Platform = {
    store: d1Store(memoryD1()),
    env: (k) => ({ HEYOTTO_PASSWORD: PASSWORD, ...vars } as Record<string, string>)[k],
    ip: "203.0.113.7",
    waitUntil: (x) => { waits.push(x); },
    startRun: async (id) => { started.push(id); return true; },
    user
  };
  let cookie = "";
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await handle(new Request(ORIGIN + path, {
      method,
      headers: { "Content-Type": "application/json", Origin: ORIGIN, ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body)
    }), p);
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: res.status, body: await res.json() as any };
  };
  return { p, call, started, waits };
}

test("uden adgangskode er alt lukket", async () => {
  const { call } = setup({ HEYOTTO_PASSWORD: "" });
  assert.equal((await call("GET", "/api/data")).status, 503);
});

test("login, gem, konflikt og historik", async () => {
  const { call } = setup();
  assert.equal((await call("GET", "/api/data")).status, 401);
  assert.equal((await call("POST", "/api/login", { password: "forkert" })).status, 401);
  assert.equal((await call("POST", "/api/login", { password: PASSWORD })).status, 200);

  const first = await call("GET", "/api/data");
  assert.equal(first.status, 200);
  assert.equal(first.body.rev, "");
  const data = first.body.data;
  data.tasks.push({ id: "t1", project: "adhoc", title: "Test" });

  const saved = await call("PUT", "/api/data", { rev: "", data });
  assert.equal(saved.status, 200);
  assert.ok(saved.body.rev);

  // Samme gamle rev igen → konflikt, intet gemt
  assert.equal((await call("PUT", "/api/data", { rev: "", data })).status, 409);

  const again = await call("GET", "/api/data");
  assert.equal(again.body.rev, saved.body.rev);
  assert.equal(again.body.data.tasks[0].title, "Test");

  const hist = await call("GET", "/api/history");
  assert.equal(hist.body.versions.length, 1);
  assert.equal(hist.body.versions[0].current, true);

  // Ændringer med cookie skal komme fra siden selv
  assert.equal((await call("PUT", "/api/data", { rev: saved.body.rev, data }, { Origin: "https://ond.example" })).status, 400);
});

test("appens gem inden for 10 minutter bliver til én version i Historik", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-07T09:00:00Z") });
  const { call } = setup();
  await call("POST", "/api/login", { password: PASSWORD });
  let { rev, data } = (await call("GET", "/api/data")).body;
  const put = async (title: string, continues = true) => {
    data.tasks = [{ id: "t1", project: "adhoc", title }];
    const r = await call("PUT", "/api/data", { rev, data, continues });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    rev = r.body.rev;
  };
  const versions = async () => (await call("GET", "/api/history")).body.versions;

  await put("a", false);
  t.mock.timers.tick(60_000);
  await put("b");
  t.mock.timers.tick(60_000);
  await put("c");
  let v = await versions();
  assert.equal(v.length, 1);
  assert.equal(v[0].saves, 3);
  assert.equal(v[0].current, true);
  assert.ok(v[0].since && v[0].since < v[0].id);   // striben begyndte ved det første gem

  // Den sammenlagte version kan gendannes og indeholder det seneste
  const first = v[0].id;
  t.mock.timers.tick(9 * 60_000);       // 11 min efter stribens start → ny version
  await put("d");
  v = await versions();
  assert.deepEqual(v.map((x: any) => x.saves), [1, 3]);
  assert.equal(v[1].id, first);

  // En gendannelse lægges aldrig sammen med noget — heller ikke det næste gem
  const back = await call("POST", "/api/history/" + first + "/restore", {});
  assert.equal(back.status, 200);
  assert.equal((await call("GET", "/api/data")).body.data.tasks[0].title, "c");
  rev = back.body.rev;
  t.mock.timers.tick(1000);
  await put("e");
  v = await versions();
  assert.equal(v.length, 4);
  assert.ok(v[1].restoredFrom);
  assert.equal(v[0].saves, 1);

  // Flettet med en anden enheds gem (continues mangler): den andens version består
  t.mock.timers.tick(1000);
  await put("fra telefonen", false);
  t.mock.timers.tick(1000);
  await put("flettet", false);
  v = await versions();
  assert.equal(v.length, 6);
  assert.deepEqual([v[0].saves, v[1].saves, v[2].saves], [1, 1, 1]);
});

test("for mange forkerte adgangskoder fra samme IP giver 429", async () => {
  const { call } = setup();
  for (let i = 0; i < 10; i++) await call("POST", "/api/login", { password: "forkert" });
  assert.equal((await call("POST", "/api/login", { password: PASSWORD })).status, 429);
});

test("en Otto-kørsel lægges i kø via platformens startRun", async () => {
  const { call, started } = setup({ ANTHROPIC_API_KEY: "sk-test" });
  await call("POST", "/api/login", { password: PASSWORD });
  const status = await call("GET", "/api/agent");
  assert.equal(status.body.configured, true);
  const r = await call("POST", "/api/agent/runs", { kind: "ping" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.started, true);
  assert.deepEqual(started, [r.body.run.id]);
  assert.equal((await call("GET", "/api/agent/runs/" + r.body.run.id)).body.run.status, "i kø");
});

test("push: VAPID-nøglen laves første gang og er stabil", async () => {
  const { call } = setup();
  await call("POST", "/api/login", { password: PASSWORD });
  const a = await call("GET", "/api/alerts");
  const b = await call("GET", "/api/alerts");
  assert.equal(a.status, 200);
  assert.match(a.body.push.publicKey, /^[A-Za-z0-9_-]{87}$/);
  assert.equal(a.body.push.publicKey, b.body.push.publicKey);
});

test("med Cloudflare Access: ingen adgangskode, ingen login, log ud via Access", async () => {
  const { call } = setup({ HEYOTTO_PASSWORD: "" }, "kasper@example.com");
  const d = await call("GET", "/api/data");
  assert.equal(d.status, 200);
  assert.equal((await call("PUT", "/api/data", { rev: "", data: d.body.data })).status, 200);
  const out = await call("POST", "/api/logout", {});
  assert.equal(out.body.accessLogout, "/cdn-cgi/access/logout");
});
