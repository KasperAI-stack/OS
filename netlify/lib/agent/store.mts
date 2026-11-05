/* HeyOtto OS — agentens lager i Netlify Blobs. Alt ligger uden for data, så en
   kørsel aldrig giver "data er ændret et andet sted" i browseren.

     agent/settings        { enabled, budgetDkk, usdDkk, tz, kinds: { <id>: { enabled, model } }, auto: {}, lastScheduled: {} }
     agent/spend/<dag>     { usd, runs, alerted } — forbrug pr. dag (lokal dato), til dagsbudgettet
     agent-runs/<id>       én kørsel: udløser, input, hvert trin, resultat, tokens og pris (de seneste 200) */

import { randomBytes } from "node:crypto";
import { KINDS, MODELS, type Usage } from "./kinds.mts";

export type Store = {
  get(key: string, opts?: any): Promise<any>;
  set(key: string, value: string, opts?: any): Promise<any>;
  setJSON(key: string, value: unknown): Promise<any>;
  delete(key: string): Promise<any>;
  list(opts?: { prefix?: string }): Promise<{ blobs: { key: string }[] }>;
};

export type Trigger = "dig" | "planlagt" | "hændelse";
export type RunStatus = "i kø" | "kører" | "færdig" | "fejlet" | "stoppet";
export type Step = {
  at: string; type: "model" | "tool"; ms: number;
  name?: string; input?: string; output?: string; error?: string;
  text?: string; stop?: string; tokens?: Usage;
};
export type Run = {
  id: string; kind: string; trigger: Trigger; status: RunStatus;
  input: string; parent: string; model: string;
  output: string; error: string; steps: Step[];
  usage: Usage; costUsd: number; costDkk: number;
  createdAt: string; startedAt: string; finishedAt: string; updatedAt: string;
};
export type KindSetting = { enabled: boolean; model: string };
export type Settings = {
  enabled: boolean; budgetDkk: number; usdDkk: number; tz: string;
  kinds: Record<string, KindSetting>; auto: Record<string, boolean>; lastScheduled: Record<string, string>;
};

const SETTINGS_KEY = "agent/settings";
const SPEND = "agent/spend/";
export const RUNS = "agent-runs/";
const RUNS_KEEP = 200;
export const DEFAULT_BUDGET_DKK = 20;
export const DEFAULT_USD_DKK = 7;
const DEFAULT_TZ = "Europe/Copenhagen";

const num = (v: unknown, lo: number, hi: number, d: number) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d;
};

/* ---------- Indstillinger ---------- */

export async function readSettings(store: Store): Promise<Settings> {
  const s = (await store.get(SETTINGS_KEY, { type: "json" })) || {};
  const kinds: Record<string, KindSetting> = {};
  for (const k of Object.values(KINDS)) {
    const saved = s.kinds?.[k.id] || {};
    kinds[k.id] = {
      enabled: typeof saved.enabled === "boolean" ? saved.enabled : k.defaultEnabled,
      model: MODELS[saved.model] ? saved.model : k.model
    };
  }
  let tz = typeof s.tz === "string" && s.tz ? s.tz : DEFAULT_TZ;
  try { new Intl.DateTimeFormat("da-DK", { timeZone: tz }); } catch { tz = DEFAULT_TZ; }
  return {
    enabled: s.enabled !== false,
    budgetDkk: num(s.budgetDkk, 0, 1000, DEFAULT_BUDGET_DKK),
    usdDkk: num(s.usdDkk, 1, 20, DEFAULT_USD_DKK),
    tz,
    kinds,
    auto: s.auto && typeof s.auto === "object" ? s.auto : {},
    lastScheduled: s.lastScheduled && typeof s.lastScheduled === "object" ? s.lastScheduled : {}
  };
}

export const saveSettings = (store: Store, s: Settings) => store.setJSON(SETTINGS_KEY, s);

// Det, du kan ændre fra appen. Ukendte felter ignoreres.
export async function updateSettings(store: Store, patch: any) {
  const s = await readSettings(store);
  if (typeof patch?.enabled === "boolean") s.enabled = patch.enabled;
  if (patch?.budgetDkk !== undefined) s.budgetDkk = num(patch.budgetDkk, 0, 1000, s.budgetDkk);
  if (patch?.usdDkk !== undefined) s.usdDkk = num(patch.usdDkk, 1, 20, s.usdDkk);
  if (typeof patch?.tz === "string") {
    try { new Intl.DateTimeFormat("da-DK", { timeZone: patch.tz }); s.tz = patch.tz; } catch { /* behold den gamle */ }
  }
  for (const [id, k] of Object.entries(patch?.kinds || {}) as [string, any][]) {
    if (!s.kinds[id]) continue;
    if (typeof k?.enabled === "boolean") s.kinds[id].enabled = k.enabled;
    if (typeof k?.model === "string" && MODELS[k.model]) s.kinds[id].model = k.model;
  }
  await saveSettings(store, s);
  return s;
}

/* ---------- Dagsbudget ---------- */

// Dagens dato i brugerens tidszone, ÅÅÅÅ-MM-DD
export function dayIn(tz: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export type Spend = { usd: number; runs: number; alerted: boolean };

export async function readSpend(store: Store, day: string): Promise<Spend> {
  const s = (await store.get(SPEND + day, { type: "json" })) || {};
  return { usd: Number(s.usd) || 0, runs: Number(s.runs) || 0, alerted: s.alerted === true };
}

// To kørsler på samme tid kan i værste fald miste et enkelt beløb her. Det er
// acceptabelt: budgettet tjekkes før hvert kald, og ét kald koster få øre.
export async function addSpend(store: Store, day: string, usd: number, newRun = false) {
  const s = await readSpend(store, day);
  s.usd += usd;
  if (newRun) s.runs += 1;
  await store.setJSON(SPEND + day, s);
  return s;
}

export async function markBudgetAlerted(store: Store, day: string) {
  const s = await readSpend(store, day);
  s.alerted = true;
  await store.setJSON(SPEND + day, s);
}

/* ---------- Kørsler ---------- */

const runId = () => new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomBytes(2).toString("hex");
export const validRunId = (id: string) => /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f]{4}$/.test(id);
export const zeroUsage = (): Usage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

export async function runIds(store: Store) {
  const { blobs } = await store.list({ prefix: RUNS });
  return blobs.map((b) => b.key.slice(RUNS.length)).filter(validRunId).sort().reverse();
}

export async function readRun(store: Store, id: string): Promise<Run | null> {
  return validRunId(id) ? ((await store.get(RUNS + id, { type: "json" })) as Run | null) : null;
}

export async function saveRun(store: Store, run: Run) {
  run.updatedAt = new Date().toISOString();
  await store.setJSON(RUNS + run.id, run);
  return run;
}

export async function createRun(store: Store, kind: string, trigger: Trigger, model: string, input = "", parent = "") {
  const now = new Date().toISOString();
  const run: Run = {
    id: runId(), kind, trigger, status: "i kø", input, parent, model,
    output: "", error: "", steps: [], usage: zeroUsage(), costUsd: 0, costDkk: 0,
    createdAt: now, startedAt: "", finishedAt: "", updatedAt: now
  };
  await store.setJSON(RUNS + run.id, run);
  const ids = await runIds(store);
  for (const old of ids.slice(RUNS_KEEP)) await store.delete(RUNS + old);
  return run;
}

export async function readRuns(store: Store, n: number) {
  const ids = (await runIds(store)).slice(0, n);
  return (await Promise.all(ids.map((id) => readRun(store, id)))).filter((r): r is Run => !!r);
}

// Til listen i appen: uden trinene, som kan være lange
export const runSummary = (r: Run) => ({
  id: r.id, kind: r.kind, trigger: r.trigger, status: r.status, input: r.input.slice(0, 200),
  output: r.output.slice(0, 300), error: r.error, model: r.model, steps: r.steps.length,
  tools: r.steps.filter((s) => s.type === "tool").length, costDkk: r.costDkk,
  createdAt: r.createdAt, finishedAt: r.finishedAt
});
