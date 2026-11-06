/* Prognosen på serveren (wall + zonedSnapshot, i enhver servertidszone) skal give det
   samme som i browseren i København. Hver variant køres i sin egen proces med sin egen TZ. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { wall, zonedSnapshot } from "../server/zone.mts";

const script = fileURLToPath(new URL("./fixtures/forecast-run.mts", import.meta.url));
const run = (mode: string, tz: string, now: string) =>
  JSON.parse(execFileSync(process.execPath, [script, mode, now], { env: { ...process.env, TZ: tz }, encoding: "utf8" }));

test("wall giver vægurets tid i tidszonen", () => {
  const d = wall("2026-11-06T23:30:00Z", "Europe/Copenhagen");
  assert.deepEqual([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getDay()], [2026, 11, 7, 0, 30, 6]);
  const s = wall("2026-07-01T22:15:00Z", "Europe/Copenhagen");      // sommertid: +2
  assert.deepEqual([s.getDate(), s.getHours(), s.getMinutes()], [2, 0, 15]);
});

test("zonedSnapshot flytter kun møder med klokkeslæt", () => {
  const snap = zonedSnapshot({ events: [
    { allDay: true, start: "2026-11-19", end: "2026-11-21" },
    { allDay: false, start: "2026-11-10T23:30:00Z", end: "2026-11-11T09:00:00Z" }
  ] }, "Europe/Copenhagen");
  assert.equal(snap.events[0].start, "2026-11-19");
  const s = new Date(snap.events[1].start);
  assert.deepEqual([s.getDate(), s.getHours(), s.getMinutes()], [11, 0, 30]);
  assert.equal(zonedSnapshot(null, "Europe/Copenhagen"), null);
});

for (const now of ["2026-11-06T09:00:00Z", "2026-11-06T22:30:00Z", "2026-11-08T23:10:00Z", "2026-11-13T15:59:00Z"]) {
  test(`prognosen er den samme som i browseren (nu = ${now})`, () => {
    const browser = run("native", "Europe/Copenhagen", now);
    for (const serverTz of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
      assert.deepEqual(run("zoned", serverTz, now), browser, "server i " + serverTz);
    }
  });
}
