/* HeyOtto OS — Ottos planforslag (M9): omplanlægning som en ændringsliste, du godkender.

     plans/<kørsels-id>   { id, runId, kind, createdAt, summary, changes, dropped, questions, before, after, status }

   Otto foreslår ændringer med værktøjet plan_propose_changes. Serveren tjekker hver
   ændring (opgaven findes og er åben, feltet er tilladt, værdien er gyldig) og regner
   før/efter med den samme prognose, som appen viser. Tallene kommer altså ikke fra
   Claude. Intet skrives i data: det gør appen, når du trykker Anvend. */

import { activeAlerts, alerts as computeAlerts, forecast, isOpen } from "../../dashboard/lib/forecast.mjs";

type Store = {
  get(key: string, opts?: any): Promise<any>;
  setJSON(key: string, value: unknown): Promise<any>;
  delete(key: string): Promise<any>;
  list(opts?: { prefix?: string }): Promise<{ blobs: { key: string }[] }>;
};

export const PLANS = "plans/";
const KEEP = 30;
const MAX_CHANGES = 40;

export const FIELDS = ["sprint", "start", "end", "hours", "remaining", "priority", "status", "due"] as const;
export type Field = typeof FIELDS[number];
export type Change = {
  taskId: string; title: string; project: string; field: Field;
  from: string | number | null; to: string | number; reason: string; needsAgreement: boolean;
};
export type Metrics = { atRisk: number; overdue: number; red: number; overbookedWeeks: number };
export type PlanStatus = "ny" | "anvendt" | "kasseret";
export type Plan = {
  id: string; runId: string; kind: string; createdAt: string; summary: string;
  changes: Change[]; dropped: { taskId: string; field: string; to: unknown; why: string }[];
  questions: string[]; before: Metrics; after: Metrics; status: PlanStatus; appliedAt: string;
};

const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v);
const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

export function metrics(data: any, cal: any, now: Date, snoozed: Record<string, string> = {}): Metrics {
  const fc = forecast(data, cal, now);
  const list = activeAlerts(computeAlerts(data, cal, now, fc), snoozed, fc.today);
  const st = Object.values(fc.tasks as Record<string, any>);
  return {
    atRisk: st.filter((t) => t.status === "risiko").length,
    overdue: st.filter((t) => t.status === "over").length,
    red: list.filter((a: any) => a.level === 3).length,
    overbookedWeeks: list.filter((a: any) => a.kind === "uge").length
  };
}

// Tjekker én ændring mod data. Giver den rensede værdi eller en forklaring.
function check(data: any, t: any, field: string, to: unknown): { ok: true; value: string | number } | { ok: false; why: string } {
  switch (field) {
    case "sprint": {
      if (to === "" || to === null) return { ok: true, value: "" };
      if (!isMonth(to)) return { ok: false, why: "sprint skal være ÅÅÅÅ-MM eller tom." };
      const exists = data.sprints.some((s: any) => s.project === t.project && s.month === to);
      return exists ? { ok: true, value: to } : { ok: false, why: `Projektet har ingen sprint i ${to}.` };
    }
    case "start":
    case "end":
      return isMonth(to) ? { ok: true, value: to } : { ok: false, why: `${field} skal være ÅÅÅÅ-MM.` };
    case "hours": {
      const n = Number(to);
      return Number.isFinite(n) && n >= 0 && n <= 40 ? { ok: true, value: Math.round(n * 2) / 2 } : { ok: false, why: "hours skal være 0–40." };
    }
    case "remaining": {
      const n = Number(to);
      return Number.isFinite(n) && n >= 0 && n <= 2000 ? { ok: true, value: Math.round(n * 2) / 2 } : { ok: false, why: "remaining skal være 0–2000." };
    }
    case "priority":
      return ["høj", "normal", "lav"].includes(String(to)) ? { ok: true, value: String(to) } : { ok: false, why: "priority skal være høj, normal eller lav." };
    case "status": {
      const v = String(to).trim().toLowerCase();
      if (v === "i gang") return { ok: true, value: "I gang" };
      if (v === "droppet") return { ok: true, value: "Droppet" };
      return { ok: false, why: 'status kan kun foreslås som "I gang" eller "Droppet".' };
    }
    case "due":
      return isDay(to) ? { ok: true, value: to } : { ok: false, why: "due skal være ÅÅÅÅ-MM-DD." };
    default:
      return { ok: false, why: `Feltet ${field} må ikke ændres.` };
  }
}

// Lægger ændringerne på en kopi af data (som appen gør ved Anvend)
export function applyChanges(data: any, changes: Pick<Change, "taskId" | "field" | "to">[]) {
  const copy = JSON.parse(JSON.stringify(data));
  for (const c of changes) {
    const t = copy.tasks.find((x: any) => x.id === c.taskId);
    if (!t) continue;
    if (c.field === "priority" && c.to === "normal") delete t.priority; else t[c.field] = c.to;
  }
  return copy;
}

export function validate(data: any, raw: unknown) {
  const list = Array.isArray(raw) ? raw.slice(0, MAX_CHANGES * 2) : [];
  const changes: Change[] = [];
  const dropped: Plan["dropped"] = [];
  const seen = new Set<string>();
  for (const r of list as any[]) {
    const taskId = str(r?.taskId, 120), field = str(r?.field, 20);
    const t = data.tasks.find((x: any) => x.id === taskId);
    const drop = (why: string) => dropped.push({ taskId, field, to: r?.to, why });
    if (!t) { drop("Opgaven findes ikke."); continue; }
    if (!isOpen(t)) { drop("Opgaven er allerede færdig eller droppet."); continue; }
    if (seen.has(taskId + "|" + field)) { drop("Samme felt er ændret to gange."); continue; }
    if (changes.length >= MAX_CHANGES) { drop(`Højst ${MAX_CHANGES} ændringer.`); continue; }
    const c = check(data, t, field, r?.to);
    if (!c.ok) { drop(c.why); continue; }
    const from = t[field] ?? (field === "priority" ? "normal" : null);
    if (String(from ?? "") === String(c.value)) { drop("Ingen ændring."); continue; }
    seen.add(taskId + "|" + field);
    changes.push({
      taskId, title: String(t.title || taskId), project: t.project, field: field as Field,
      from: from as any, to: c.value, reason: str(r?.reason, 300),
      // Deadlines er som regel lovet til andre: de skal altid aftales
      needsAgreement: field === "due" || r?.needsAgreement === true
    });
  }
  // Slutmåned før startmåned efter ændringerne?
  const after = applyChanges(data, changes);
  for (const c of [...changes]) {
    if (c.field !== "start" && c.field !== "end") continue;
    const t = after.tasks.find((x: any) => x.id === c.taskId);
    if (t.start && t.end && t.end < t.start) {
      changes.splice(changes.indexOf(c), 1);
      dropped.push({ taskId: c.taskId, field: c.field, to: c.to, why: "Slutmåneden ville ligge før startmåneden." });
    }
  }
  return { changes, dropped };
}

/* ---------- Lager ---------- */

export async function savePlan(store: Store, plan: Plan) {
  await store.setJSON(PLANS + plan.id, plan);
  const { blobs } = await store.list({ prefix: PLANS });
  const ids = blobs.map((b) => b.key.slice(PLANS.length)).sort().reverse();
  for (const old of ids.slice(KEEP)) await store.delete(PLANS + old);
  return plan;
}

export async function readPlan(store: Store, id: string): Promise<Plan | null> {
  return /^[0-9A-Za-z-]{10,60}$/.test(id) ? ((await store.get(PLANS + id, { type: "json" })) as Plan | null) : null;
}

export async function latestPlans(store: Store, n = 5): Promise<Plan[]> {
  const { blobs } = await store.list({ prefix: PLANS });
  const ids = blobs.map((b) => b.key.slice(PLANS.length)).sort().reverse().slice(0, n);
  return (await Promise.all(ids.map((id) => readPlan(store, id)))).filter((p): p is Plan => !!p);
}

export async function setPlanStatus(store: Store, id: string, status: PlanStatus) {
  const p = await readPlan(store, id);
  if (!p) return null;
  p.status = status;
  p.appliedAt = status === "anvendt" ? new Date().toISOString() : "";
  await store.setJSON(PLANS + id, p);
  return p;
}
