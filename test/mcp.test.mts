/* /mcp (M14) gennem Workeren med D1 i hukommelsen. Svarer til "færdig når" i M14:
   tools/list viser kun de tilladte værktøjer pr. scope, kald virker med token og afvises uden,
   og navnene er de samme, som HeyOtto Studio klassificerer på. */

import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { type WorkerEnv } from "../worker/index.mts";
import { memoryD1 } from "./helpers.mts";

const U = "http://127.0.0.1:8799";
const PASSWORD = "en-lang-test-adgangskode";

// Kontrakten med Studio (heyotto-studio M43). Ændres den, skal Studios config ændres samtidig.
const READ_TOOLS = ["list_tasks", "get_task", "list_projects", "list_routines", "get_forecast"];
const WRITE_TOOLS = ["create_task", "update_task", "add_comment"];

async function setup() {
  const e: WorkerEnv = {
    DB: memoryD1(),
    ASSETS: { fetch: async () => new Response("app") },
    AGENT_QUEUE: { send: async () => {} },
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
  await app("POST", "/api/login", { password: PASSWORD });
  const rw = (await app("POST", "/api/tokens", { name: "Studio", scopes: ["read", "write"] })).body.token as string;
  const ro = (await app("POST", "/api/tokens", { name: "Læser", scopes: ["read"] })).body.token as string;

  let n = 0;
  const raw = async (token: string | null, msg: unknown, opts: { method?: string; path?: string } = {}) => {
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
    if (token) headers.Authorization = "Bearer " + token;
    const method = opts.method || "POST";
    const res = await worker.fetch(new Request(U + (opts.path || "/mcp"), {
      method, headers, body: method === "POST" ? JSON.stringify(msg) : undefined
    }), e, ctx);
    const text = await res.text();
    return { status: res.status, type: res.headers.get("content-type") || "", body: text ? JSON.parse(text) : null };
  };
  const call = (token: string, method: string, params?: unknown) => raw(token, { jsonrpc: "2.0", id: ++n, method, params });
  const tool = async (token: string, name: string, args: unknown = {}) => {
    const r = await call(token, "tools/call", { name, arguments: args });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  };
  return { app, raw, call, tool, rw, ro };
}

test("mcp: 401 uden og med forkert token; tokenet kan stå i stien; GET giver 405", async () => {
  const { raw, rw } = await setup();
  const init = { jsonrpc: "2.0", id: 1, method: "ping" };
  assert.equal((await raw(null, init)).status, 401);
  assert.equal((await raw("tsk_" + "x".repeat(43), init)).status, 401);
  assert.equal((await raw(null, init, { path: "/mcp/tsk_" + "x".repeat(43) })).status, 401);
  const viaPath = await raw(null, init, { path: "/mcp/" + rw });
  assert.equal(viaPath.status, 200);
  assert.deepEqual(viaPath.body, { jsonrpc: "2.0", id: 1, result: {} });
  const get = await raw(rw, null, { method: "GET" });
  assert.equal(get.status, 405);
  assert.equal((await raw(rw, init, { path: "/mcp/noget-andet" })).status, 404);
});

test("mcp: initialize, notifikationer og ukendte metoder", async () => {
  const { raw, call, rw } = await setup();
  const init = await call(rw, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
  assert.equal(init.status, 200);
  assert.match(init.type, /application\/json/);
  assert.equal(init.body.result.protocolVersion, "2025-06-18");
  assert.equal(init.body.result.serverInfo.name, "heyotto-tasks");
  assert.deepEqual(init.body.result.capabilities, { tools: { listChanged: false } });
  // Ukendt version → serverens egen
  assert.equal((await call(rw, "initialize", { protocolVersion: "1999-01-01" })).body.result.protocolVersion, "2025-06-18");
  const note = await raw(rw, { jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(note.status, 202);
  assert.equal((await call(rw, "resources/list")).body.error.code, -32601);
  assert.equal((await raw(rw, [{ jsonrpc: "2.0", id: 1, method: "ping" }])).status, 400);
  assert.equal((await raw(rw, { id: 1, method: "ping" })).status, 400);
});

test("mcp: tools/list viser kun de værktøjer, tokenets scopes tillader", async () => {
  const { call, rw, ro } = await setup();
  const all = (await call(rw, "tools/list")).body.result.tools;
  assert.deepEqual(all.map((t: any) => t.name).sort(), [...READ_TOOLS, ...WRITE_TOOLS].sort());
  for (const t of all) {
    assert.equal(t.inputSchema.type, "object", t.name);
    assert.equal(t.annotations.readOnlyHint, READ_TOOLS.includes(t.name), t.name);
    assert.ok(t.description.length > 10, t.name);
  }
  const reading = (await call(ro, "tools/list")).body.result.tools.map((t: any) => t.name);
  assert.deepEqual(reading.sort(), [...READ_TOOLS].sort());
  // Et skrivende værktøj kan heller ikke kaldes med et læse-token
  const no = await call(ro, "tools/call", { name: "create_task", arguments: { title: "Må ikke" } });
  assert.equal(no.body.error.code, -32602);
  assert.match(no.body.error.message, /adgang/);
  assert.equal((await call(rw, "tools/call", { name: "delete_task", arguments: { id: "x" } })).body.error.code, -32602);
});

test("mcp: opret, ret, kommentér og læs; fejl er danske værktøjsresultater; Historik viser tokenets navn", async () => {
  const { app, tool, rw } = await setup();
  const made = await tool(rw, "create_task", { title: "Rapport fra Studio", due: "2026-11-20", remaining: 3 });
  assert.equal(made.result.isError, undefined, JSON.stringify(made));
  const t = made.result.structuredContent.task;
  assert.equal(t.projectName, "Uden projekt");
  assert.deepEqual(JSON.parse(made.result.content[0].text), made.result.structuredContent);

  const bad = await tool(rw, "update_task", { id: t.id, status: "Måske" });
  assert.equal(bad.result.isError, true);
  assert.match(bad.result.content[0].text, /status skal være en af/);
  assert.equal((await tool(rw, "update_task", { id: t.id, project: "andet" })).result.isError, true);
  assert.match((await tool(rw, "get_task", { id: "findes-ikke" })).result.content[0].text, /Ukendt task/);

  const upd = await tool(rw, "update_task", { id: t.id, status: "I gang", priority: "høj" });
  assert.equal(upd.result.structuredContent.task.status, "I gang");
  const com = await tool(rw, "add_comment", { id: t.id, text: "Lavet af en agent i Studio." });
  assert.equal(com.result.structuredContent.comment.by, "Studio");

  const one = await tool(rw, "get_task", { id: t.id });
  assert.equal(one.result.structuredContent.task.comments.length, 1);
  const list = await tool(rw, "list_tasks", { due_before: "2026-11-21" });
  assert.deepEqual(list.result.structuredContent.tasks.map((x: any) => x.id), [t.id]);
  assert.equal((await tool(rw, "list_tasks", { status: "Færdig" })).result.structuredContent.tasks.length, 0);
  assert.ok((await tool(rw, "list_projects")).result.structuredContent.projects.some((p: any) => p.name === "Uden projekt"));
  assert.deepEqual((await tool(rw, "list_routines")).result.structuredContent, { routines: [] });

  const hist = await app("GET", "/api/history");
  assert.deepEqual(hist.body.versions.map((v: any) => v.by), ["Studio", "Studio", "Studio"]);
});

test("mcp: get_forecast giver alarmer, tasks i risiko og ugerne", async () => {
  const { tool, rw } = await setup();
  await tool(rw, "create_task", { title: "Alt for stor opgave", due: "2026-01-02", remaining: 500 });
  const f = (await tool(rw, "get_forecast")).result.structuredContent;
  assert.match(f.today, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(f.weeks.length, 12);
  assert.ok(f.tasks.some((x: any) => x.title === "Alt for stor opgave" && x.status === "over"), JSON.stringify(f.tasks));
  assert.ok(Array.isArray(f.alerts));
});

test("mcp: tokenet står ikke i loggen, heller ikke når det står i stien", async () => {
  const logs: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { logs.push(a.join(" ")); };
  try {
    const { raw, call, rw } = await setup();
    await call(rw, "tools/list");
    await raw(null, { jsonrpc: "2.0", id: 1, method: "ping" }, { path: "/mcp/" + rw });
    const all = logs.join("\n");
    assert.equal(all.includes(rw), false);
    assert.ok(logs.some((l) => l.startsWith("mcp Studio POST /mcp 200")), all);
    assert.ok(logs.some((l) => l.startsWith("mcp Studio POST /mcp/tsk_*** 200")), all);
  } finally { console.log = orig; }
});
