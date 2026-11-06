/* /ext og API-tokens (M11) gennem Workeren med D1 i hukommelsen.
   Svarer til "færdig når" i Studios guide (M1): 401 uden, med forkert og med tilbagekaldt
   token, 403 ved forkert scope, 429 ved kald nr. 61, og tokenet står hverken i lageret,
   i loggen eller i Historik. */

import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { type WorkerEnv } from "../worker/index.mts";
import { memoryD1 } from "./helpers.mts";

const U = "http://127.0.0.1:8799";
const PASSWORD = "en-lang-test-adgangskode";

function setup() {
  const db = memoryD1();
  const hits = new Map<string, number>();
  const e: WorkerEnv = {
    DB: db,
    ASSETS: { fetch: async () => new Response("app") },
    AGENT_QUEUE: { send: async () => {} },
    EXT_LIMITER: { limit: async ({ key }) => { const n = (hits.get(key) || 0) + 1; hits.set(key, n); return { success: n <= 60 }; } },
    APP_URL: U,
    HEYOTTO_PASSWORD: PASSWORD
  };
  const ctx = { waitUntil() {} };
  let cookie = "";
  const app = async (method: string, path: string, body?: unknown) => {
    const res = await worker.fetch(new Request(U + path, {
      method, headers: { "Content-Type": "application/json", Origin: U, ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    }), e, ctx);
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: res.status, body: await res.json() as any };
  };
  const ext = async (token: string | null, method: string, path: string, body?: unknown, raw?: string) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    const res = await worker.fetch(new Request(U + path, {
      method, headers, body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body)
    }), e, ctx);
    return { status: res.status, body: await res.json() as any };
  };
  const dump = async () => JSON.stringify((await db.prepare("SELECT key, value, metadata FROM docs").bind().all()).results);
  return { app, ext, dump, db };
}

async function withTokens() {
  const s = setup();
  await s.app("POST", "/api/login", { password: PASSWORD });
  const rw = await s.app("POST", "/api/tokens", { name: "Studio", scopes: ["read", "write"] });
  const ro = await s.app("POST", "/api/tokens", { name: "Læser", scopes: ["read"] });
  assert.equal(rw.status, 200, JSON.stringify(rw.body));
  assert.match(rw.body.token, /^tsk_[A-Za-z0-9_-]{43}$/);
  return { ...s, rw: rw.body.token as string, ro: ro.body.token as string, rwId: rw.body.record.id as string };
}

test("tokens: kun du kan lave dem, og tokenet vises kun én gang", async () => {
  const s = setup();
  assert.equal((await s.app("POST", "/api/tokens", { name: "x", scopes: ["read"] })).status, 401);
  await s.app("POST", "/api/login", { password: PASSWORD });
  assert.equal((await s.app("POST", "/api/tokens", { name: "", scopes: ["read"] })).status, 400);
  assert.equal((await s.app("POST", "/api/tokens", { name: "x", scopes: ["admin"] })).status, 400);
  const made = await s.app("POST", "/api/tokens", { name: "Studio", scopes: ["read"] });
  const list = await s.app("GET", "/api/tokens");
  assert.equal(list.body.tokens.length, 1);
  assert.equal(list.body.tokens[0].name, "Studio");
  assert.equal(JSON.stringify(list.body).includes(made.body.token), false);
  assert.equal(JSON.stringify(list.body).includes("hash"), false);
});

test("401 uden, med forkert og med tilbagekaldt token", async () => {
  const { app, ext, rw, rwId } = await withTokens();
  assert.equal((await ext(null, "GET", "/ext/health")).status, 401);
  assert.equal((await ext("tsk_" + "x".repeat(43), "GET", "/ext/health")).status, 401);
  assert.equal((await ext("noget-andet", "GET", "/ext/health")).status, 401);
  const ok = await ext(rw, "GET", "/ext/health");
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body, { ok: true, token: "Studio", scopes: ["read", "write"] });
  assert.equal((await app("DELETE", "/api/tokens/" + rwId)).status, 200);
  assert.equal((await ext(rw, "GET", "/ext/health")).status, 401);
});

test("403 ved forkert scope, og ukendte stier giver 404 (ikke appen)", async () => {
  const { ext, ro } = await withTokens();
  assert.equal((await ext(ro, "GET", "/ext/tasks")).status, 200);
  const no = await ext(ro, "POST", "/ext/tasks", { title: "Må ikke" });
  assert.equal(no.status, 403);
  assert.match(no.body.error, /write/);
  assert.equal((await ext(ro, "GET", "/ext/findes-ikke")).status, 404);
  assert.equal((await ext(null, "GET", "/ext/findes-ikke")).status, 401);
});

test("429 ved kald nr. 61 i minuttet", async () => {
  const { ext, ro } = await withTokens();
  for (let i = 0; i < 60; i++) assert.equal((await ext(ro, "GET", "/ext/health")).status, 200, "kald " + (i + 1));
  assert.equal((await ext(ro, "GET", "/ext/health")).status, 429);
});

test("413 over 256 KB og 400 ved ugyldig JSON", async () => {
  const { ext, rw } = await withTokens();
  assert.equal((await ext(rw, "POST", "/ext/tasks", undefined, JSON.stringify({ title: "x", note: "a".repeat(300 * 1024) }))).status, 413);
  assert.equal((await ext(rw, "POST", "/ext/tasks", undefined, "{ikke json")).status, 400);
});

test("opret, ret, kommentér og læs en task; ændringer står i Historik med tokenets navn", async () => {
  const { app, ext, rw } = await withTokens();
  const made = await ext(rw, "POST", "/ext/tasks", { title: "Kampagnerapport for uge 45", due: "2026-11-13", remaining: 4 });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const t = made.body.task;
  assert.equal(t.projectName, "Uden projekt");
  assert.equal(t.status, "Ikke startet");
  assert.match(t.id, /^adhoc-kampagnerapport/);

  assert.equal((await ext(rw, "PATCH", "/ext/tasks/" + t.id, { status: "Måske" })).status, 400);
  assert.equal((await ext(rw, "PATCH", "/ext/tasks/" + t.id, { farve: "rød" })).status, 400);
  assert.equal((await ext(rw, "PATCH", "/ext/tasks/findes-ikke", { status: "I gang" })).status, 404);
  const patched = await ext(rw, "PATCH", "/ext/tasks/" + t.id, { status: "I gang", priority: "høj" });
  assert.equal(patched.body.task.status, "I gang");
  assert.equal(patched.body.task.priority, "høj");

  const c = await ext(rw, "POST", "/ext/tasks/" + t.id + "/comments", { text: "Rapporten ligger i Drive." });
  assert.equal(c.status, 201);
  assert.equal(c.body.comment.by, "Studio");

  const one = await ext(rw, "GET", "/ext/tasks/" + t.id);
  assert.equal(one.body.task.comments.length, 1);
  assert.equal((await ext(rw, "GET", "/ext/tasks?due_before=2026-11-14")).body.tasks.length, 1);
  assert.equal((await ext(rw, "GET", "/ext/tasks?status=Færdig")).body.tasks.length, 0);

  // Appen ser ændringen, og Historik viser tokenets navn
  const data = await app("GET", "/api/data");
  assert.equal(data.body.data.tasks.find((x: any) => x.id === t.id).status, "I gang");
  const hist = await app("GET", "/api/history");
  assert.deepEqual(hist.body.versions.map((v: any) => v.by), ["Studio", "Studio", "Studio"]);
});

test("projekter og rutiner kan læses", async () => {
  const { ext, ro } = await withTokens();
  const p = await ext(ro, "GET", "/ext/projects");
  assert.ok(p.body.projects.some((x: any) => x.name === "Uden projekt"));
  assert.deepEqual((await ext(ro, "GET", "/ext/routines")).body, { routines: [] });
});

test("tokenet står aldrig i lageret, i loggen eller i Historik", async () => {
  const logs: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { logs.push(a.join(" ")); };
  try {
    const { ext, rw, dump } = await withTokens();
    await ext(rw, "POST", "/ext/tasks", { title: "Hemmelig test" });
    await ext(rw, "GET", "/ext/" + rw);                       // tokenet i stien → renset i loggen
    const stored = await dump();
    assert.equal(stored.includes(rw), false, "lageret");
    assert.equal(logs.join("\n").includes(rw), false, "loggen");
    assert.ok(logs.some((l) => l.startsWith("ext Studio POST /ext/tasks 201")), logs.join("\n"));
    assert.ok(logs.some((l) => l.includes("/ext/tsk_***")), logs.join("\n"));
  } finally { console.log = orig; }
});

test("sprints: læs og opret; en task kan derefter lægges i sprinten", async () => {
  const { ext, rw, ro } = await withTokens();
  const proj = (await ext(ro, "GET", "/ext/projects")).body.projects[0].id;
  assert.equal((await ext(ro, "POST", "/ext/sprints", { project: proj, month: "2026-12" })).status, 403);
  assert.equal((await ext(rw, "POST", "/ext/sprints", { project: "findes-ikke", month: "2026-12" })).status, 400);
  assert.equal((await ext(rw, "POST", "/ext/sprints", { project: proj, month: "december" })).status, 400);
  const made = await ext(rw, "POST", "/ext/sprints", { project: proj, month: "2026-12", goal: "Julekampagnen" });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  assert.equal((await ext(rw, "POST", "/ext/sprints", { project: proj, month: "2026-12" })).status, 409);
  const list = await ext(ro, "GET", "/ext/sprints?project=" + proj);
  assert.ok(list.body.sprints.some((s: any) => s.month === "2026-12" && s.goal === "Julekampagnen"));
  const t = await ext(rw, "POST", "/ext/tasks", { title: "Juleannoncer", project: proj, sprint: "2026-12" });
  assert.equal(t.status, 201, JSON.stringify(t.body));
});

test("kalenderen kan læses (null uden forbundne konti)", async () => {
  const { ext, ro } = await withTokens();
  assert.deepEqual((await ext(ro, "GET", "/ext/calendar")).body, { snapshot: null });
});

test("jobs: Claude henter jobbet og melder tilbage; lukkede jobs kan ikke ændres", async () => {
  const { ext, rw, ro, db } = await withTokens();
  const id = "2026-11-06T18-00-00-000Z-ab12";
  const job = { id, taskId: "t1", task: { title: "Skriv nyhedsbrev" }, instruction: "", startedBy: "knap", status: "sendt",
                sessionUrl: "", result: "", error: "", createdAt: "2026-11-06T18:00:00.000Z", updatedAt: "2026-11-06T18:00:00.000Z" };
  await db.prepare("INSERT INTO docs (key, value, updated_at) VALUES (?, ?, ?)").bind("claude-jobs/" + id, JSON.stringify(job), job.updatedAt).run();

  assert.equal((await ext(ro, "GET", "/ext/jobs/" + id)).body.job.task.title, "Skriv nyhedsbrev");
  assert.equal((await ext(ro, "GET", "/ext/jobs/2026-11-06T18-00-00-000Z-ffff")).status, 404);
  assert.equal((await ext(ro, "PATCH", "/ext/jobs/" + id, { status: "i gang" })).status, 403);
  assert.equal((await ext(rw, "PATCH", "/ext/jobs/" + id, { status: "godkendt" })).status, 400, "Claude kan ikke godkende sig selv");
  assert.equal((await ext(rw, "PATCH", "/ext/jobs/" + id, { status: "til godkendelse" })).status, 400, "mangler result");
  assert.equal((await ext(rw, "PATCH", "/ext/jobs/" + id, { status: "i gang" })).body.job.status, "i gang");
  const done = await ext(rw, "PATCH", "/ext/jobs/" + id, { status: "til godkendelse", result: "Emne: Nyt fra os\n\nHej …" });
  assert.equal(done.body.job.status, "til godkendelse");
  assert.equal(done.body.job.result, "Emne: Nyt fra os\n\nHej …");

  await db.prepare("UPDATE docs SET value = ? WHERE key = ?").bind(JSON.stringify({ ...job, status: "kasseret" }), "claude-jobs/" + id).run();
  assert.equal((await ext(rw, "PATCH", "/ext/jobs/" + id, { status: "i gang" })).status, 410);
});
