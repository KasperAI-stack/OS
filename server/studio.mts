/* HeyOtto Tasks → HeyOtto Studio (M15, del 1). Du trykker "Send til Studio" på en opgave.

   Studios API (otto.heyotto.win/ext, se Studios docs/api.md):
     POST /tasks { text }   → 201 { id }
     GET  /tasks/{id}       → { status: "working" | "awaiting_approval" | "idle", lastReply, pendingApprovals }
   Tokenet er hemmeligheden HEYOTTO_TOKEN (hot_…, rettighederne task og read). HEYOTTO_URL kan
   pege et andet sted hen; standard er https://otto.heyotto.win/ext.

   Hver opgave har højst én Studio-opgave ad gangen, gemt under studio-tasks/<opgave-id> ved
   siden af data (så Gem i browseren aldrig støder ind i den). Når Studio er færdig, skrives
   svaret som kommentar på opgaven (af "Studio", så det står i Historik).

   Studio kører på Kaspers pc bag en Cloudflare Tunnel. Er den slukket, står opgaven som
   "offline", og Tasks prøver igen hvert 5. minut i en time. Derefter "ikke sendt". Svarer Studio
   ikke i tide, ved vi ikke, om opgaven kom frem, så den sendes IKKE igen ("ukendt"). */

import type { DocStore, Env } from "./platform.mts";

export const PREFIX = "studio-tasks/";
export const DEFAULT_URL = "https://otto.heyotto.win/ext";
export const STUDIO_APP = "https://studio.heyotto.win";
export const MAX_TEXT = 20_000;
const TIMEOUT_MS = 15_000;
const RETRY_EVERY_MS = 5 * 60_000;
const RETRY_FOR_MS = 60 * 60_000;
const CHECK_EVERY_MS = 20_000;          // højst så ofte spørges Studio om én opgave
const MAX_REPLY = 4000;                 // samme loft som kommentarer

export type Status =
  | "offline"            // Studio kunne ikke nås; prøves igen
  | "ikke sendt"         // opgivet efter en time offline
  | "ukendt"             // Studio svarede ikke i tide: måske kom den frem
  | "fejl"               // Studio afviste (token, rettighed, grænse)
  | "working" | "awaiting_approval" | "idle";

export type StudioTask = {
  taskId: string; title: string; text: string; studioId: string; status: Status;
  error: string; lastReply: string; replied: boolean; pendingApprovals: number;
  createdAt: string; sentAt: string; checkedAt: string; lastTry: string;
};

export type Config = { url: string; token: string };

export function config(env: Env): Config | null {
  const token = (env("HEYOTTO_TOKEN") || "").trim();
  const url = ((env("HEYOTTO_URL") || "").trim() || DEFAULT_URL).replace(/\/+$/, "");
  return token ? { url, token } : null;
}

export const busy = (r: StudioTask | null) =>
  !!r && (r.status === "offline" || r.status === "working" || r.status === "awaiting_approval");

// Et kald til Studio. Skelner mellem "kunne ikke nås" (offline), "for langsomt" og et svar.
type Reply = { kind: "ok"; status: number; body: any } | { kind: "offline" } | { kind: "timeout" };

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

async function call(cfg: Config, method: string, path: string, body: unknown, f: Fetcher): Promise<Reply> {
  try {
    const res = await f(cfg.url + path, {
      method,
      headers: { Authorization: "Bearer " + cfg.token, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    // 502/503/504/530: Cloudflare nåede ikke frem til tunnelen (pc'en er slukket)
    if ([502, 503, 504, 530].includes(res.status)) return { kind: "offline" };
    return { kind: "ok", status: res.status, body: await res.json().catch(() => ({})) };
  } catch (e) {
    return e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError") ? { kind: "timeout" } : { kind: "offline" };
  }
}

function refusal(status: number, body: any) {
  const why = typeof body?.error === "string" ? " (" + body.error.slice(0, 200) + ")" : "";
  if (status === 401) return "Studio genkender ikke tokenet. Lav et nyt i Studio under Adgang udefra, og ret HEYOTTO_TOKEN i Cloudflare." + why;
  if (status === 403) return "Tokenet mangler rettigheden task eller read i Studio." + why;
  if (status === 404) return "Studio kender ikke opgaven længere." + why;
  if (status === 413 || status === 400) return "Studio afviste teksten" + (why || ".");
  if (status === 429) return "For mange kald til Studio lige nu. Prøv igen om et minut.";
  return `Studio svarede med fejl ${status}.` + why;
}

const keyOf = (taskId: string) => PREFIX + taskId;

export async function read(store: DocStore, taskId: string) {
  return ((await store.get(keyOf(taskId), { type: "json" })) as StudioTask | null) || null;
}

export async function readAll(store: DocStore) {
  const { blobs } = await store.list({ prefix: PREFIX });
  const all = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }) as Promise<StudioTask | null>));
  return all.filter((r): r is StudioTask => !!r);
}

const save = (store: DocStore, r: StudioTask) => store.setJSON(keyOf(r.taskId), r);

// Prøv at sende. Bruges både første gang og ved gentagelser, mens Studio er offline.
async function trySend(store: DocStore, cfg: Config, r: StudioTask, f: Fetcher, now: Date) {
  r.lastTry = now.toISOString();
  const res = await call(cfg, "POST", "/tasks", { text: r.text }, f);
  if (res.kind === "offline") {
    const gaveUp = now.getTime() - Date.parse(r.createdAt) >= RETRY_FOR_MS;
    r.status = gaveUp ? "ikke sendt" : "offline";
    r.error = gaveUp ? "Studio kunne ikke nås i en time. Tænd pc'en med Studio, og send igen." : "Studio er offline. Tasks prøver igen hvert 5. minut i en time.";
  } else if (res.kind === "timeout") {
    r.status = "ukendt";
    r.error = "Studio svarede ikke i tide. Måske kom opgaven frem: se efter i Studio, før du sender igen.";
  } else if (res.status === 201 || res.status === 200) {
    r.studioId = String(res.body?.id || "");
    r.status = r.studioId ? "working" : "fejl";
    r.error = r.studioId ? "" : "Studio svarede uden et opgave-id.";
    r.sentAt = r.checkedAt = now.toISOString();
  } else {
    r.status = "fejl";
    r.error = refusal(res.status, res.body);
  }
  await save(store, r);
  return r;
}

export class StudioError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export async function send(store: DocStore, env: Env, input: { taskId: string; title: string; text: string },
                           f: Fetcher = fetch, now = new Date()) {
  const cfg = config(env);
  if (!cfg) throw new StudioError(400, "Studio er ikke forbundet. Læg Studios token i Cloudflare som hemmeligheden HEYOTTO_TOKEN.");
  const text = input.text.trim();
  if (!text) throw new StudioError(400, "Skriv, hvad Studio skal gøre.");
  if (text.length > MAX_TEXT) throw new StudioError(400, `Teksten må højst være ${MAX_TEXT} tegn.`);
  if (busy(await read(store, input.taskId))) throw new StudioError(409, "Opgaven er allerede sendt til Studio. Vent på svaret.");
  const r: StudioTask = {
    taskId: input.taskId, title: input.title.slice(0, 200), text, studioId: "", status: "offline",
    error: "", lastReply: "", replied: false, pendingApprovals: 0,
    createdAt: now.toISOString(), sentAt: "", checkedAt: "", lastTry: ""
  };
  return await trySend(store, cfg, r, f, now);
}

// Svaret lander som kommentar på opgaven. comment() gemmer i data (saveData i api.mts).
export type Commenter = (taskId: string, text: string) => Promise<void>;

async function check(store: DocStore, cfg: Config, r: StudioTask, f: Fetcher, now: Date, comment: Commenter) {
  r.checkedAt = now.toISOString();
  const res = await call(cfg, "GET", "/tasks/" + encodeURIComponent(r.studioId), undefined, f);
  if (res.kind !== "ok") { await save(store, r); return r; }          // prøv igen næste gang
  if (res.status !== 200) {
    r.status = "fejl";
    r.error = refusal(res.status, res.body);
  } else {
    const s = res.body?.status;
    if (s === "working" || s === "awaiting_approval" || s === "idle") r.status = s;
    r.pendingApprovals = Number(res.body?.pendingApprovals) || 0;
    r.lastReply = typeof res.body?.lastReply === "string" ? res.body.lastReply : "";
    if (r.status === "idle" && !r.replied) {
      const reply = r.lastReply.trim() || "Studio er færdig, men skrev intet svar.";
      await comment(r.taskId, reply.length > MAX_REPLY ? reply.slice(0, MAX_REPLY - 40) + "\n\n… (resten står i Studio)" : reply);
      r.replied = true;
    }
  }
  await save(store, r);
  return r;
}

// Kør alt, der venter: gentag afsendelser, mens Studio er offline, og hent status for
// opgaver, Studio arbejder på. Køres af cron'en hvert minut og når appen spørger.
export async function tick(store: DocStore, env: Env, comment: Commenter, f: Fetcher = fetch, now = new Date()) {
  const cfg = config(env);
  const all = await readAll(store);
  if (!cfg) return { checked: 0, waiting: all.filter(busy).length };
  let checked = 0;
  for (const r of all) {
    const since = (iso: string) => now.getTime() - (Date.parse(iso) || 0);
    if (r.status === "offline" && since(r.lastTry) >= RETRY_EVERY_MS) { await trySend(store, cfg, r, f, now); checked++; }
    else if ((r.status === "working" || r.status === "awaiting_approval") && since(r.checkedAt) >= CHECK_EVERY_MS) {
      await check(store, cfg, r, f, now, comment); checked++;
    }
  }
  return { checked, waiting: (await readAll(store)).filter(busy).length };
}

// Er Studio sat op og tændt? Vises i appen.
export async function health(env: Env, f: Fetcher = fetch) {
  const cfg = config(env);
  if (!cfg) return { configured: false, online: false, error: "", app: STUDIO_APP };
  const res = await call(cfg, "GET", "/health", undefined, f);
  if (res.kind !== "ok") return { configured: true, online: false, error: res.kind === "timeout" ? "Studio svarer ikke." : "Studio er offline.", app: STUDIO_APP };
  return { configured: true, online: res.status === 200, error: res.status === 200 ? "" : refusal(res.status, res.body), app: STUDIO_APP };
}

/* ---------- Rutiner forbundet med flows i Studio (M18) ----------
   Tasks ejer rutinen (hvad og hvornår), Studio ejer flowet (hvordan). En rutine gemmer kun
   flowets id og sine standardværdier: studio_flow_id, studio_inputs og studio_toggles.
     GET  /flows             → [{ id, name, description, inputs, fields, toggles }]
     POST /flows/{id}/run    { inputs, toggles, routine } → 201 { id, planId }
   Kørslen er kun et forslag: den venter på Kaspers godkendelse i Studio (startkortet).
   Tokenet skal have rettigheden flows. */

export type StudioFlow = {
  id: string; name: string; description: string;
  fields: Array<{ key: string; label: string; required: boolean; default?: string }>;
  toggles: Array<{ key: string; label: string; default: boolean }>;
};

const NOT_CONNECTED = "Studio er ikke forbundet. Læg Studios token i Cloudflare som hemmeligheden HEYOTTO_TOKEN.";

function unreachable(r: Reply) {
  return r.kind === "timeout" ? "Studio svarede ikke i tide. Se efter i Studio, før du prøver igen." : "Studio er offline. Tænd pc'en med Studio, og prøv igen.";
}

export async function flows(env: Env, f: Fetcher = fetch): Promise<StudioFlow[]> {
  const cfg = config(env);
  if (!cfg) throw new StudioError(400, NOT_CONNECTED);
  const res = await call(cfg, "GET", "/flows", undefined, f);
  if (res.kind !== "ok") throw new StudioError(503, unreachable(res));
  if (res.status !== 200 || !Array.isArray(res.body)) throw new StudioError(502, refusal(res.status, res.body));
  return res.body.map((x: any) => ({
    id: String(x.id), name: String(x.name || x.id), description: String(x.description || ""),
    // fields kom i Studios M49; ældre Studio sender kun inputs som navne.
    fields: Array.isArray(x.fields) ? x.fields : (Array.isArray(x.inputs) ? x.inputs : []).map((k: string) => ({ key: k, label: k, required: true })),
    toggles: Array.isArray(x.toggles) ? x.toggles : []
  }));
}

/** Kun tekst-værdier og ja/nej, med navne som Studios flows bruger. */
export function cleanValues(v: unknown, kind: "string" | "boolean") {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string | boolean> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (!/^[\p{L}\p{N}_-]{1,64}$/u.test(k) || typeof x !== kind) continue;
    out[k] = kind === "string" ? String(x).slice(0, 2000) : x as boolean;
  }
  return out;
}

export type RoutineRun = { taskId: string; planId: string; url: string };

export async function runRoutine(env: Env, r: any, projectName: string, f: Fetcher = fetch): Promise<RoutineRun> {
  const cfg = config(env);
  if (!cfg) throw new StudioError(400, NOT_CONNECTED);
  const flowId = typeof r?.studio_flow_id === "string" ? r.studio_flow_id.trim() : "";
  if (!flowId) throw new StudioError(400, "Rutinen er ikke forbundet med et flow i Studio.");
  const res = await call(cfg, "POST", "/flows/" + encodeURIComponent(flowId) + "/run", {
    inputs: cleanValues(r.studio_inputs, "string"),
    toggles: cleanValues(r.studio_toggles, "boolean"),
    routine: { id: String(r.id), name: String(r.name || r.id), project: String(r.project || ""), projectName }
  }, f);
  if (res.kind !== "ok") throw new StudioError(503, unreachable(res));
  if (res.status === 403) throw new StudioError(403, "Tokenet mangler rettigheden flows i Studio. Giv HEYOTTO_TOKEN adgangen flows under Adgang udefra.");
  if (res.status !== 201 && res.status !== 200) throw new StudioError(res.status === 404 ? 404 : 502, refusal(res.status, res.body));
  const taskId = String(res.body?.id || "");
  if (!taskId) throw new StudioError(502, "Studio svarede uden et opgave-id.");
  return { taskId, planId: String(res.body?.planId || ""), url: STUDIO_APP + "/chat/" + encodeURIComponent(taskId) };
}

// Glem en afsluttet Studio-opgave (fx før en ny sendes). En opgave, Studio arbejder på, bliver.
export async function forget(store: DocStore, taskId: string) {
  const r = await read(store, taskId);
  if (busy(r)) throw new StudioError(409, "Studio arbejder stadig på opgaven.");
  await store.delete(keyOf(taskId));
}
