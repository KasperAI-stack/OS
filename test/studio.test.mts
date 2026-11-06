/* Send til Studio (M15). Et falsk Studio svarer i stedet for otto.heyotto.win, så intet
   rigtigt sendes. Svarer til "færdig når" i Studios guide (afsnit 3): en opgave sendes med én
   knap, status vises, og svaret lander på opgaven. Ingen løkke, når Studio er slukket. */

import { test } from "node:test";
import assert from "node:assert/strict";
import * as studio from "../server/studio.mts";
import { readData, saveData, studioCommenter } from "../server/api.mts";
import { d1Store } from "../worker/store.mts";
import { memoryD1 } from "./helpers.mts";

const ENV = (k: string) => ({ HEYOTTO_TOKEN: "hot_test" } as Record<string, string>)[k];
const NONE = () => undefined;
const T0 = new Date("2026-11-06T18:00:00Z");
const at = (min: number) => new Date(T0.getTime() + min * 60_000);

type Call = { method: string; url: string; auth: string; body: any };

// Et falsk Studio. mode styrer, hvad det gør: svare, være slukket eller være for langsomt.
function fakeStudio() {
  const calls: Call[] = [];
  const s = { mode: "ok" as "ok" | "offline" | "tunnel" | "slow" | "401", status: "working", lastReply: null as string | null, calls,
    fetch: async (url: string, init: RequestInit) => {
      calls.push({ method: init.method || "GET", url, auth: String((init.headers as any).Authorization), body: init.body ? JSON.parse(String(init.body)) : null });
      if (s.mode === "offline") throw new TypeError("fetch failed");
      if (s.mode === "slow") { const e = new Error("timeout"); e.name = "TimeoutError"; throw e; }
      if (s.mode === "tunnel") return new Response("<html>530</html>", { status: 530 });
      if (s.mode === "401") return Response.json({ error: "Ukendt token." }, { status: 401 });
      if (init.method === "POST") return Response.json({ id: "st-1" }, { status: 201 });
      if (url.endsWith("/health")) return Response.json({ ok: true });
      return Response.json({ status: s.status, lastReply: s.lastReply, pendingApprovals: s.status === "awaiting_approval" ? 1 : 0 });
    } };
  return s;
}

async function setup() {
  const store = d1Store(memoryD1());
  await saveData(store, "dig", (d) => {
    d.tasks.push({ id: "t1", project: d.projects[0].id, title: "Søg job hos Arla", status: "Ikke startet", owner: "", due: "", note: "", hours: 0, sprint: "", start: "2026-11", end: "2026-11" });
  });
  return { store, comment: studioCommenter(store) };
}

const input = { taskId: "t1", title: "Søg job hos Arla", text: "Skriv et udkast til en ansøgning. Tasks-id t1" };

test("uden HEYOTTO_TOKEN kan intet sendes, og der kaldes ikke ud", async () => {
  const { store } = await setup();
  const s = fakeStudio();
  await assert.rejects(studio.send(store, NONE, input, s.fetch, T0), /ikke forbundet/);
  assert.equal(s.calls.length, 0);
  assert.deepEqual(await studio.health(NONE, s.fetch), { configured: false, online: false, error: "", app: studio.STUDIO_APP });
});

test("send → Studio arbejder → venter på godkendelse → svaret lander som kommentar én gang", async () => {
  const { store, comment } = await setup();
  const s = fakeStudio();
  const r = await studio.send(store, ENV, input, s.fetch, T0);
  assert.equal(r.status, "working");
  assert.equal(r.studioId, "st-1");
  assert.deepEqual(s.calls[0], { method: "POST", url: "https://otto.heyotto.win/ext/tasks", auth: "Bearer hot_test", body: { text: input.text } });
  await assert.rejects(studio.send(store, ENV, input, s.fetch, T0), /allerede sendt/);

  await studio.tick(store, ENV, comment, s.fetch, at(0.1));      // for tidligt: Studio spørges ikke
  assert.equal(s.calls.length, 1);

  s.status = "awaiting_approval";
  await studio.tick(store, ENV, comment, s.fetch, at(1));
  assert.equal((await studio.read(store, "t1"))!.status, "awaiting_approval");
  assert.equal(s.calls[1].url, "https://otto.heyotto.win/ext/tasks/st-1");

  s.status = "idle"; s.lastReply = "Udkastet ligger i Studio. Kort version: …";
  const res = await studio.tick(store, ENV, comment, s.fetch, at(2));
  assert.deepEqual(res, { checked: 1, waiting: 0 });
  await studio.tick(store, ENV, comment, s.fetch, at(3));          // færdig: spørges ikke igen
  assert.equal(s.calls.length, 3);

  const t = (await readData(store)).tasks.find((x: any) => x.id === "t1");
  assert.equal(t.comments.length, 1);
  assert.equal(t.comments[0].by, "Studio");
  assert.equal(t.comments[0].text, "Udkastet ligger i Studio. Kort version: …");

  await studio.forget(store, "t1");
  assert.equal(await studio.read(store, "t1"), null);
});

test("Studio slukket: prøv igen hvert 5. minut i en time, så 'ikke sendt' — ingen løkke", async () => {
  const { store, comment } = await setup();
  const s = fakeStudio();
  s.mode = "tunnel";                                               // Cloudflare 530: tunnelen er nede
  assert.equal((await studio.send(store, ENV, input, s.fetch, T0)).status, "offline");
  await studio.tick(store, ENV, comment, s.fetch, at(3));          // under 5 min: intet kald
  assert.equal(s.calls.length, 1);
  s.mode = "offline";
  await studio.tick(store, ENV, comment, s.fetch, at(5));
  assert.equal(s.calls.length, 2);
  assert.equal((await studio.read(store, "t1"))!.status, "offline");
  await studio.tick(store, ENV, comment, s.fetch, at(61));
  const r = (await studio.read(store, "t1"))!;
  assert.equal(r.status, "ikke sendt");
  assert.match(r.error, /i en time/);
  await studio.tick(store, ENV, comment, s.fetch, at(120));        // opgivet: ingen flere kald
  assert.equal(s.calls.length, 3);
  // Du kan sende igen, når pc'en er tændt
  s.mode = "ok";
  assert.equal((await studio.send(store, ENV, input, s.fetch, at(121))).status, "working");
});

test("Studio kommer tilbage inden for timen: opgaven sendes én gang", async () => {
  const { store, comment } = await setup();
  const s = fakeStudio();
  s.mode = "offline";
  await studio.send(store, ENV, input, s.fetch, T0);
  s.mode = "ok";
  await studio.tick(store, ENV, comment, s.fetch, at(10));
  const r = (await studio.read(store, "t1"))!;
  assert.equal(r.status, "working");
  assert.equal(s.calls.filter((c) => c.method === "POST").length, 2);   // ét mislykket, ét der kom frem
});

test("for langsomt svar: 'ukendt', og den sendes ikke igen af sig selv", async () => {
  const { store, comment } = await setup();
  const s = fakeStudio();
  s.mode = "slow";
  const r = await studio.send(store, ENV, input, s.fetch, T0);
  assert.equal(r.status, "ukendt");
  assert.match(r.error, /se efter i Studio/);
  await studio.tick(store, ENV, comment, s.fetch, at(30));
  assert.equal(s.calls.length, 1);
});

test("Studio afviser tokenet: fejlen står på dansk, og tokenet står ingen steder", async () => {
  const { store } = await setup();
  const s = fakeStudio();
  s.mode = "401";
  const r = await studio.send(store, ENV, input, s.fetch, T0);
  assert.equal(r.status, "fejl");
  assert.match(r.error, /HEYOTTO_TOKEN/);
  assert.equal(JSON.stringify(r).includes("hot_test"), false);
  const h = await studio.health(ENV, s.fetch);
  assert.equal(h.online, false);
});

test("tom eller for lang tekst afvises før noget sendes", async () => {
  const { store } = await setup();
  const s = fakeStudio();
  await assert.rejects(studio.send(store, ENV, { ...input, text: "  " }, s.fetch, T0), /Skriv/);
  await assert.rejects(studio.send(store, ENV, { ...input, text: "x".repeat(20_001) }, s.fetch, T0), /20000/);
  assert.equal(s.calls.length, 0);
});
