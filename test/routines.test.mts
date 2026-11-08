/* Rutiner forbundet med flows i Studio (M18). Et falsk Studio svarer, så intet rigtigt sendes.
   Svarer til Studios M49: "Kør i Studio" sender rutinens input og toggles, og list_routines giver
   Studio flowets id og rutinens datoer, så Studio kan starte flowet på de rigtige dage. */

import { test } from "node:test";
import assert from "node:assert/strict";
import * as studio from "../server/studio.mts";
import { saveData } from "../server/api.mts";
import { listRoutines } from "../server/ext.mts";
import { d1Store } from "../worker/store.mts";
import { memoryD1 } from "./helpers.mts";

const ENV = (k: string) => ({ HEYOTTO_TOKEN: "hot_test" } as Record<string, string>)[k];
const NONE = () => undefined;

const BF = {
  id: "bf", name: "Black Friday", every: "uge", weekday: 1, hours: 2, project: "", active: true, last: "",
  studio_flow_id: "black-friday",
  studio_inputs: { rabat: "20 %", periode: "uge 48", ugyldig: 5 },
  studio_toggles: { mail: false, visuals: true, forkert: "ja" }
};

async function setup() {
  const store = d1Store(memoryD1());
  await saveData(store, "dig", (d) => {
    d.rutiner = [{ ...BF, project: d.projects[0].id }, { id: "u", name: "Ugerapport", every: "uge", weekday: 5, hours: 1, active: false }];
  });
  return store;
}

function fakeStudio(status = 201) {
  const calls: Array<{ method: string; url: string; body: any }> = [];
  return {
    calls,
    fetch: async (url: string, init: RequestInit) => {
      calls.push({ method: init.method || "GET", url, body: init.body ? JSON.parse(String(init.body)) : null });
      if (url.endsWith("/flows")) {
        return Response.json([
          { id: "black-friday", name: "Black Friday", description: "Kampagne", inputs: ["rabat"],
            fields: [{ key: "rabat", label: "Rabat", required: true }], toggles: [{ key: "mail", label: "Mail", default: true }] },
          { id: "gammel", name: "Gammel", inputs: ["emne"] }
        ]);
      }
      if (status !== 201) return Response.json({ error: "nej" }, { status });
      return Response.json({ id: "chat-1", planId: "plan-1" }, { status: 201 });
    }
  };
}

test("list_routines giver flowets id, rutinens værdier og datoerne omkring i dag", async () => {
  const store = await setup();
  const [bf, paused] = await listRoutines(store, new Date("2026-11-11T09:00:00Z"));   // en onsdag
  assert.equal(bf.studio_flow_id, "black-friday");
  assert.deepEqual(bf.studio_inputs, { rabat: "20 %", periode: "uge 48" });
  assert.deepEqual(bf.studio_toggles, { mail: false, visuals: true });
  assert.ok(bf.projectName);
  // Mandage fra 7 dage før til 14 dage efter
  assert.deepEqual(bf.occurrences, ["2026-11-09", "2026-11-16", "2026-11-23"]);
  assert.deepEqual(paused.occurrences, [], "en rutine på pause har ingen datoer");
  assert.equal(paused.studio_flow_id, "");
});

test("Kør i Studio sender rutinens input, toggles og projekt og giver adressen på chatten", async () => {
  const store = await setup();
  const [r] = (await listRoutines(store));
  const s = fakeStudio();
  const run = await studio.runRoutine(ENV, r, "Uden projekt", s.fetch);
  assert.deepEqual(run, { taskId: "chat-1", planId: "plan-1", url: "https://studio.heyotto.win/chat/chat-1" });
  assert.equal(s.calls[0].url, "https://otto.heyotto.win/ext/flows/black-friday/run");
  assert.deepEqual(s.calls[0].body, {
    inputs: { rabat: "20 %", periode: "uge 48" },
    toggles: { mail: false, visuals: true },
    routine: { id: "bf", name: "Black Friday", project: r.project, projectName: "Uden projekt" }
  });
});

test("uden token, uden flow og uden rettigheden flows kaldes der ikke forgæves", async () => {
  const s = fakeStudio();
  await assert.rejects(studio.runRoutine(NONE, BF, "", s.fetch), /ikke forbundet/);
  await assert.rejects(studio.runRoutine(ENV, { ...BF, studio_flow_id: "" }, "", s.fetch), /ikke forbundet med et flow/);
  assert.equal(s.calls.length, 0);
  await assert.rejects(studio.runRoutine(ENV, BF, "", fakeStudio(403).fetch), /rettigheden flows/);
  await assert.rejects(studio.runRoutine(ENV, BF, "", async () => { throw new TypeError("fetch failed"); }), /offline/);
});

test("Studios flows hentes med felter, også fra et ældre Studio uden fields", async () => {
  const flows = await studio.flows(ENV, fakeStudio().fetch);
  assert.deepEqual(flows[0].fields, [{ key: "rabat", label: "Rabat", required: true }]);
  assert.deepEqual(flows[0].toggles, [{ key: "mail", label: "Mail", default: true }]);
  assert.deepEqual(flows[1].fields, [{ key: "emne", label: "emne", required: true }]);
});
