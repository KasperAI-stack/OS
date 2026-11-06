/* Kører prognose og alarmer for testdata og skriver resultatet som JSON.
   mode "native": som browseren i brugerens tidszone (processen startes med TZ=…).
   mode "zoned":  som serveren: wall() og zonedSnapshot() (processen kan køre i enhver TZ). */
import { alerts, forecast } from "../../dashboard/lib/forecast.mjs";
import { metrics } from "../../netlify/lib/plans.mts";
import { wall, zonedSnapshot } from "../../netlify/lib/zone.mts";

const [mode, nowIso] = process.argv.slice(2);
const TZ = "Europe/Copenhagen";

const data = {
  meta: {}, uger: [], epics: {},
  kapacitet: { contract: 37, meetings: 6, admin: 5, other: 2, ceiling: 85, adhoc: 6, workStart: 8, workEnd: 16 },
  projects: [
    { id: "drift", name: "Drift", kind: "drift" }, { id: "adhoc", name: "Uden projekt", kind: "adhoc" },
    { id: "web", name: "Website", kind: "projekt" }
  ],
  sprints: [{ project: "web", month: "2026-11", goal: "Ny forside" }],
  tasks: [
    { id: "t1", project: "web", title: "Forside", status: "I gang", due: "2026-11-09", remaining: 14, hours: 0, sprint: "2026-11", priority: "høj" },
    { id: "t2", project: "web", title: "Tekster", status: "Ikke startet", due: "2026-11-13", remaining: 20, hours: 0, sprint: "2026-11" },
    { id: "t3", project: "adhoc", title: "Faktura", status: "Ikke startet", due: "2026-11-06", remaining: 1 },
    { id: "t4", project: "drift", title: "Nyhedsbrev", status: "I gang", hours: 3 },
    { id: "t5", project: "web", title: "Billeder", status: "Ikke startet", due: "2026-11-30", remaining: 30 }
  ],
  rutiner: [{ id: "r1", name: "Ugerapport", every: "uge", weekday: 5, hours: 1, active: true }]
};

const cal = {
  fetchedAt: "2026-11-06T06:00:00Z", from: "2026-11-01", to: "2026-12-31",
  accounts: [{ id: "a", email: "k@example.com", ok: true, error: "", events: 5 }],
  events: [
    // Møde 08:00–10:00 dansk tid (07:00–09:00 UTC) — tidligt nok til at UTC-dagen og den danske dag er ens
    { id: "e1", title: "Statusmøde", start: "2026-11-09T08:00:00+01:00", end: "2026-11-09T10:00:00+01:00", allDay: false, type: "default", busy: true, response: "accepted", attendees: 4 },
    // Møde, der starter kl. 00:30 dansk tid = 23:30 UTC dagen før
    { id: "e2", title: "Natmøde", start: "2026-11-10T23:30:00Z", end: "2026-11-11T09:00:00Z", allDay: false, type: "default", busy: true, response: "accepted", attendees: 2 },
    { id: "e3", title: "Workshop", start: "2026-11-12T13:00:00+01:00", end: "2026-11-12T15:30:00+01:00", allDay: false, type: "default", busy: true, response: "accepted", attendees: 6 },
    { id: "e4", title: "Ferie", start: "2026-11-19", end: "2026-11-21", allDay: true, type: "default", busy: true, response: "", attendees: 0 },
    { id: "e5", title: "Fri", start: "2026-11-23T00:00:00+01:00", end: "2026-11-24T00:00:00+01:00", allDay: false, type: "outOfOffice", busy: true, response: "", attendees: 0 }
  ]
};

const real = new Date(nowIso);
const now = mode === "native" ? real : wall(real, TZ);
const c = mode === "native" ? cal : zonedSnapshot(cal, TZ);
const fc = forecast(data, c, now);
process.stdout.write(JSON.stringify({ fc, alerts: alerts(data, c, now, fc), metrics: metrics(data, c, now) }));
