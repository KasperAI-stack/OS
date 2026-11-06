/* HeyOtto Tasks — baggrundsjob og planlagte job, uafhængigt af platformen.

     runAgent       én assistent-kørsel (fra køen)
     scheduleTick   assistentens planlagte udløser og oprydning, hvert 15. minut
     calendarTick   henter de forbundne Google-kalendere, hvert 15. minut
     alertsTick     alarmer som push-notifikationer, hver time

   worker/index.mts kalder herind (queue og scheduled). */

import { readState, run as runAlerts, sendAll } from "./alerts.mts";
import { client, readAccounts, readSnapshot, syncAll } from "./google.mts";
import { KINDS } from "./agent/kinds.mts";
import { enqueue } from "./agent/queue.mts";
import { STALE_QUEUE_MS, STALE_RUN_MS, configured, execute } from "./agent/runtime.mts";
import { dayIn, readRun, readRuns, readSettings, saveRun, saveSettings, type Store } from "./agent/store.mts";
import { metrics, readPlan } from "./plans.mts";
import { wall, zonedSnapshot } from "./zone.mts";
import type { DocStore, Env } from "./platform.mts";

/* ---------- Én assistent-kørsel ---------- */

export async function runAgent(blobs: DocStore, id: string, origin: string) {
  const store = blobs as unknown as Store;
  const notify = async (title: string, text: string, tag: string, url = "/#otto") => {
    await sendAll(store as any, [{ title, body: text, url, tag }], origin);
  };

  try {
    const run = await execute(store, id, { notify });
    if (!run) return;
    console.log(`agent-run ${run.id} (${run.kind}): ${run.status}, ${run.steps.length} trin, ${run.costDkk} kr.`);
    // Morgenbriefen sendes også som notifikation: første linje som titel
    if (run.kind === "morgenbrief" && run.status === "færdig" && run.output) {
      const [first, ...rest] = run.output.split("\n").map((l) => l.replace(/^[-*#\s]+/, "").trim()).filter(Boolean);
      if (first) await notify("Tasks: " + first.slice(0, 80), rest.join(" · ").slice(0, 180), "morgenbrief");
    }
    // Ugeforslaget: kun en besked, når der faktisk er et forslag at se på
    if (run.kind === "ugeforslag" && run.status === "færdig") {
      const plan = await readPlan(store as any, run.id);
      if (plan && plan.changes.length) {
        await notify("Assistenten har et forslag til ugen",
          `${plan.changes.length} ændringer. I risiko: ${plan.before.atRisk + plan.before.overdue} → ${plan.after.atRisk + plan.after.overdue}.`, "ugeforslag", "/#omplan");
      }
    }
  } catch (e) {
    console.error("agent-run fejlede:", e);
    const run = await readRun(store, id);
    if (run && (run.status === "kører" || run.status === "i kø")) {
      run.status = "fejlet";
      run.error = "Serverfejl: " + (e instanceof Error ? e.message : String(e)).slice(0, 300);
      run.finishedAt = new Date().toISOString();
      await saveRun(store, run);
    }
  }
}

/* ---------- Assistentens planlagte udløser ----------
   Lægger planlagte kørsler i kø og starter dem. Rydder desuden op:
     * en kørsel, der har stået i kø i over 2 minutter (startsignalet gik tabt), startes igen
     * en kørsel, der har "kørt" i over 16 minutter, markeres som fejlet
   Planlagte slags: morgenbriefen (hverdage kl. 7) og ugeforslaget (mandag kl. 7, kun når
   noget er i risiko). Begge er slået fra som standard. */

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export async function scheduleTick(blobs: DocStore, startRun: (id: string) => Promise<boolean>, now = new Date()) {
  const store = blobs as unknown as Store;
  const log: string[] = [];

  for (const r of await readRuns(store, 20)) {
    const age = now.getTime() - Date.parse(r.updatedAt);
    if (r.status === "i kø" && age > STALE_QUEUE_MS) { await startRun(r.id); log.push("startet igen: " + r.id); }
    if (r.status === "kører" && age > STALE_RUN_MS) {
      r.status = "fejlet"; r.error = "Kørslen stoppede uden at melde tilbage (over 15 minutter)."; r.finishedAt = now.toISOString();
      await saveRun(store, r); log.push("gået i stå: " + r.id);
    }
  }

  const s = await readSettings(store);
  if (!s.enabled || !configured()) return log.join(", ") || "slået fra eller ikke sat op";

  // Lokal tid i brugerens tidszone
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: s.tz, hour: "numeric", hourCycle: "h23", weekday: "short" })
    .formatToParts(now).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour), weekend = parts.weekday === "Sat" || parts.weekday === "Sun";
  const today = dayIn(s.tz, now);

  for (const k of Object.values(KINDS)) {
    if (!k.schedule || !s.kinds[k.id]?.enabled) continue;
    if (k.schedule.weekdays && weekend) continue;
    if (k.schedule.weekday !== undefined && WEEKDAY[parts.weekday] !== k.schedule.weekday) continue;
    if (hour !== k.schedule.hour || s.lastScheduled[k.id] === today) continue;
    s.lastScheduled[k.id] = today;
    await saveSettings(store, s);
    // Ugeforslaget: kun når noget er i risiko eller overbooket. Ellers koster det intet.
    if (k.schedule.onlyIfRisk) {
      const data = await store.get("data", { type: "json" });
      if (!data || !Array.isArray(data.tasks)) continue;
      const cal = zonedSnapshot(await readSnapshot(store as any), s.tz);
      const m = metrics(data, cal, wall(now, s.tz), (await readState(store as any)).snoozed);
      if (!m.red && !m.overbookedWeeks) { log.push(k.id + ": intet i risiko"); continue; }
    }
    const run = await enqueue(store, k.id, "planlagt");
    await startRun(run.id);
    log.push(k.id + ": " + run.id);
  }
  return log.join(", ") || "intet at gøre";
}

/* ---------- Kalender og alarmer ---------- */

export async function calendarTick(store: DocStore, env: Env) {
  if (!client(env)) return "Google er ikke sat op";
  if (!(await readAccounts(store as any)).length) return "ingen konti forbundet";
  const snap = await syncAll(store as any, env);
  return snap.accounts.map((a) => `${a.email}: ${a.ok ? a.events + " hændelser" : a.error}`).join(", ");
}

// subject = appens egen https-adresse (VAPID-afsender og links i notifikationer)
export async function alertsTick(store: DocStore, subject: string) {
  if (!/^https:\/\//.test(subject)) return "appens adresse mangler, intet sendt";
  return JSON.stringify(await runAlerts(store as any, subject));
}
