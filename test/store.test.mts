import { test } from "node:test";
import assert from "node:assert/strict";
import { d1Store, MAX_VALUE } from "../worker/store.mts";
import { memoryD1 } from "./helpers.mts";

test("D1-lageret: get, metadata, list, set og delete", async () => {
  const s = d1Store(memoryD1());
  assert.equal(await s.get("mangler"), null);
  assert.equal(await s.get("mangler", { type: "json" }), null);
  assert.equal(await s.getWithMetadata("mangler", { type: "json" }), null);
  assert.equal(await s.getMetadata("mangler"), null);

  await s.set("data", JSON.stringify({ a: 1 }), { metadata: { rev: "r1" } });
  assert.deepEqual(await s.get("data", { type: "json" }), { a: 1 });
  assert.equal(await s.get("data"), '{"a":1}');
  assert.deepEqual(await s.getWithMetadata("data", { type: "json" }), { data: { a: 1 }, metadata: { rev: "r1" } });
  assert.deepEqual(await s.getMetadata("data"), { metadata: { rev: "r1" } });

  // Overskriv uden metadata → metadata væk (som Blobs)
  await s.setJSON("data", { a: 2 });
  assert.deepEqual(await s.getWithMetadata("data", { type: "json" }), { data: { a: 2 }, metadata: {} });

  await s.setJSON("agent-runs/2", { n: 2 });
  await s.setJSON("agent-runs/1", { n: 1 });
  await s.setJSON("agent-runsX", { n: 0 });
  await s.setJSON("agent/settings", {});
  assert.deepEqual((await s.list({ prefix: "agent-runs/" })).blobs.map((b) => b.key), ["agent-runs/1", "agent-runs/2"]);
  assert.equal((await s.list()).blobs.length, 5);

  await s.delete("agent-runs/1");
  assert.equal(await s.get("agent-runs/1"), null);
  await s.delete("findes-ikke");
});

test("for store værdier afvises med en klar besked", async () => {
  const s = d1Store(memoryD1());
  await assert.rejects(s.set("data", "x".repeat(MAX_VALUE + 1)), /For meget data under „data“/);
});
