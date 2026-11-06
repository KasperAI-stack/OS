/* Workerens tre indgange med D1 i hukommelsen og en falsk kø: fetch, queue og scheduled. */

import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { CRON_EVERY_15, CRON_HOURLY, type WorkerEnv } from "../worker/index.mts";
import { d1Store } from "../worker/store.mts";
import { memoryD1 } from "./helpers.mts";

function env(extra: Record<string, unknown> = {}) {
  const sent: unknown[] = [];
  const assets: string[] = [];
  const e: WorkerEnv = {
    DB: memoryD1(),
    ASSETS: { fetch: async (req: Request) => { assets.push(new URL(req.url).pathname); return new Response("app"); } },
    AGENT_QUEUE: { send: async (body) => { sent.push(body); } },
    APP_URL: "https://tasks.example",
    HEYOTTO_PASSWORD: "en-lang-test-adgangskode",
    ...extra
  };
  return { e, sent, assets };
}
const ctx = { waitUntil() {} };

test("fetch: /api går til API'et, resten til de statiske filer", async () => {
  const { e, assets } = env();
  assert.equal((await worker.fetch(new Request("https://tasks.example/api/data"), e, ctx)).status, 401);
  assert.equal(await (await worker.fetch(new Request("https://tasks.example/"), e, ctx)).text(), "app");
  assert.deepEqual(assets, ["/"]);
});

test("queue: en kørsel, der ikke står i kø, springes over, og beskeden kvitteres", async () => {
  const { e } = env();
  await d1Store(e.DB).setJSON("agent-runs/2026-11-06T07-00-00-000Z-ab12", { id: "2026-11-06T07-00-00-000Z-ab12", kind: "ping", status: "færdig", steps: [] });
  let acked = 0;
  await worker.queue({ messages: [{ body: { runId: "2026-11-06T07-00-00-000Z-ab12" }, ack: () => { acked++; } }, { body: {}, ack: () => { acked++; } }] }, e);
  assert.equal(acked, 2);
});

test("scheduled: begge cron-udtryk kører uden fejl uden opsætning", async () => {
  const { e, sent } = env();
  const logs: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { logs.push(a.join(" ")); };
  try {
    await worker.scheduled({ cron: CRON_EVERY_15 }, e);
    await worker.scheduled({ cron: CRON_HOURLY }, e);
  } finally { console.log = orig; }
  assert.deepEqual(sent, []);
  assert.ok(logs.some((l) => l.startsWith("kalender — Google er ikke sat op")), logs.join("\n"));
  assert.ok(logs.some((l) => l.startsWith("otto —")), logs.join("\n"));
  assert.ok(logs.some((l) => l.startsWith("alarmer —")), logs.join("\n"));
});

test("scheduled: en kørsel, der har stået for længe i kø, sendes til køen igen", async () => {
  const { e, sent } = env();
  const id = "2026-11-06T07-00-00-000Z-cd34";
  await d1Store(e.DB).setJSON("agent-runs/" + id, { id, kind: "ping", status: "i kø", steps: [], updatedAt: "2026-11-01T07:00:00.000Z" });
  await worker.scheduled({ cron: CRON_EVERY_15 }, e);
  assert.deepEqual(sent, [{ runId: id }]);
});
