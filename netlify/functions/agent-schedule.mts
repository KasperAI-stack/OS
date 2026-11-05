/* HeyOtto OS — Ottos planlagte udløser. Kører hvert 15. minut på produktion.

   Planlagte funktioner må kun køre 30 sekunder, så her lægges kørsler bare i kø, og
   baggrundsfunktionen (/agent-run) startes. Desuden ryddes der op:
     * en kørsel, der har stået i kø i over 2 minutter (startsignalet gik tabt), startes igen
     * en kørsel, der har "kørt" i over 16 minutter, markeres som fejlet

   M7 har én planlagt slags: morgenbriefen (hverdage kl. 7, slået fra som standard).
   M8 tilføjer indbakken og M9 ugeplanen. */

import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { KINDS } from "../lib/agent/kinds.mts";
import { enqueue, fire } from "../lib/agent/queue.mts";
import { STALE_QUEUE_MS, STALE_RUN_MS, configured } from "../lib/agent/runtime.mts";
import { dayIn, readRuns, readSettings, saveRun, saveSettings, type Store } from "../lib/agent/store.mts";

export default async () => {
  const origin = Netlify.env.get("URL") || "";
  if (!/^https:\/\//.test(origin)) { console.log("otto: sitets adresse (URL) mangler"); return; }
  const store = getStore({ name: "heyotto-os", consistency: "strong" }) as unknown as Store;
  const now = new Date();
  const log: string[] = [];

  // Oprydning i de seneste kørsler
  for (const r of await readRuns(store, 20)) {
    const age = now.getTime() - Date.parse(r.updatedAt);
    if (r.status === "i kø" && age > STALE_QUEUE_MS) { await fire(store, origin, r.id); log.push("startet igen: " + r.id); }
    if (r.status === "kører" && age > STALE_RUN_MS) {
      r.status = "fejlet"; r.error = "Kørslen stoppede uden at melde tilbage (over 15 minutter)."; r.finishedAt = now.toISOString();
      await saveRun(store, r); log.push("gået i stå: " + r.id);
    }
  }

  const s = await readSettings(store);
  if (!s.enabled || !configured()) { console.log("otto —", log.join(", ") || "slået fra eller ikke sat op"); return; }

  // Lokal tid i brugerens tidszone
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: s.tz, hour: "numeric", hourCycle: "h23", weekday: "short" })
    .formatToParts(now).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour), weekend = parts.weekday === "Sat" || parts.weekday === "Sun";
  const today = dayIn(s.tz, now);

  for (const k of Object.values(KINDS)) {
    if (!k.schedule || !s.kinds[k.id]?.enabled) continue;
    if (k.schedule.weekdays && weekend) continue;
    if (hour !== k.schedule.hour || s.lastScheduled[k.id] === today) continue;
    s.lastScheduled[k.id] = today;
    await saveSettings(store, s);
    const run = await enqueue(store, k.id, "planlagt");
    await fire(store, origin, run.id);
    log.push(k.id + ": " + run.id);
  }
  console.log("otto —", log.join(", ") || "intet at gøre");
};

// Hvert 15. minut (UTC). Klokkeslæt regnes i brugerens tidszone ovenfor.
export const config: Config = {
  schedule: "*/15 * * * *"
};
