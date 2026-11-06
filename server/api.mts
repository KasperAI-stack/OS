/* HeyOtto Tasks — API'et bag appen.

   Alt indhold ligger som JSON i lageret (D1 på Cloudflare, se worker/store.mts).
   Ingen filer. Workeren (worker/index.mts) kalder handle() for alt under /api.

     POST   /api/login                       log ind med adgangskoden → session-cookie
     POST   /api/logout                      log ud
     GET    /api/data                        { rev, data }
     PUT    /api/data                        { rev, data } → { rev }   (409 hvis rev er forældet)
     GET    /api/history                     de seneste gemte versioner
     POST   /api/history/:id/restore         gør en gammel version til den gældende
     GET    /api/studio                      { configured, online, error, app } — er Studio sat op og tændt?
     GET    /api/studio/tasks                { tasks } — opgaver sendt til Studio, med status (spørger Studio om nyt)
     POST   /api/studio/tasks                { taskId, title, text } → send opgaven til Studio (kun Kasper)
     DELETE /api/studio/tasks/:taskId        glem en afsluttet Studio-opgave
     GET    /api/google                      { configured, missing, redirectUri, accounts } — forbindelsens status
     GET    /api/google/connect?scopes=…     send browseren til Google for at forbinde en konto
     GET    /api/google/callback             Google sender browseren tilbage hertil (ingen cookie, signeret state)
     PUT    /api/google/accounts/:id/calendars  { included: [kalender-id …] }
     DELETE /api/google/accounts/:id         afbryd en konto (tilbagekaldes også hos Google)
     GET    /api/calendar                    { snapshot } — møder fra de forbundne kalendere
     POST   /api/calendar/refresh            hent kalenderne nu (højst én gang i minuttet)
     GET    /api/alerts                      { state: { snoozed, prefs }, push: { publicKey, devices } }
     PUT    /api/alerts/snooze               { key, until } — udsæt en alarm til en dato (null = fortryd)
     PUT    /api/alerts/prefs                { daily?, instant? } — morgenoverblik og straks-beskeder
     POST   /api/push/subscribe              { subscription, label, tz } — slå notifikationer til på en enhed
     POST   /api/push/unsubscribe            { endpoint }
     POST   /api/push/test                   { endpoint } — send en prøve til én enhed
     GET    /api/agent                       Otto: sat op?, indstillinger, dagens forbrug, slags og modeller
     PUT    /api/agent/settings              { enabled?, budgetDkk?, usdDkk?, kinds?: { <id>: { enabled?, model? } } }
     GET    /api/agent/runs                  de seneste kørsler (uden trin)
     POST   /api/agent/runs                  { kind, input?, parent? } → læg en kørsel i kø og start den (kun Kasper)
     GET    /api/agent/runs/:id              én kørsel med hvert trin, tokens og pris
     GET    /api/inbox                       { suggestions, handled, mail } — Ottos forslag fra mail
     PUT    /api/inbox/:id                   { status: "oprettet" | "ignoreret" | "ny", taskId? } (kun Kasper)
     GET    /api/plans                       Ottos seneste planforslag (M9)
     GET    /api/plans/:id                   ét forslag (id = kørslens id)
     PUT    /api/plans/:id                   { status: "anvendt" | "kasseret" } (kun Kasper)

   Kun du kommer ind her: via Cloudflare Access (server/gate.mts), eller lokalt med
   adgangskoden fra HEYOTTO_PASSWORD, som giver en signeret session-cookie (HttpOnly,
   SameSite=Strict, 90 dage). Uden Access og uden adgangskode svarer alt med 503.
   Andre værktøjer og Claude bruger /ext med et API-token (server/ext.mts).

   Afvisninger er 400/401, og en forsvundet version er 410. */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import * as google from "./google.mts";
import * as alarm from "./alerts.mts";
import * as agent from "./agent/store.mts";
import { KINDS, MODELS } from "./agent/kinds.mts";
import { enqueue } from "./agent/queue.mts";
import { configured as agentConfigured } from "./agent/runtime.mts";
import * as inbox from "./inbox.mts";
import * as plans from "./plans.mts";
import type { DocStore, Env, Platform } from "./platform.mts";
import * as tokens from "./tokens.mts";
import * as studio from "./studio.mts";

type Store = DocStore;
type Who = "dig" | "Claude";
// by: "dig", "Claude" eller navnet på det API-token, der gemte (fx "Studio")
type IndexEntry = { id: string; by: string; projects: number; tasks: number; restoredFrom?: string };

const DATA_KEY = "data";
const INDEX_KEY = "historik-index";
const HISTORY = "historik/";
const FAILS = "auth/fail/";
const COOKIE = "heyotto_session";
const KEEP = 60;                       // så mange gemte versioner beholdes
const SESSION_DAYS = 90;
const MIN_PASSWORD = 12;
const MAX_FAILS = 10;                  // forkerte adgangskoder pr. IP …
const FAIL_WINDOW_MS = 15 * 60 * 1000; // … inden for et kvarter
const MAX_BODY = 4_000_000;

const CONFLICT = "Data er ændret et andet sted, siden du åbnede siden — fx på telefonen eller af Claude. " +
                 "Intet er gemt. Genindlæs for at se de nye data; dine ugemte ændringer kan gendannes bagefter.";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Tom start: Drift og Ad hoc findes altid, fordi kapacitetsmodellen regner i dem.
export function emptyData() {
  return {
    meta: { updated: "", note: "" },
    kapacitet: { contract: 37, meetings: 6, admin: 5, other: 2, ceiling: 85, adhoc: 6 },
    uger: [],
    epics: {},
    projects: [
      { id: "drift", name: "Drift", kind: "drift", tagline: "Løbende arbejde, der kører hver uge" },
      { id: "adhoc", name: "Ad hoc", kind: "adhoc", tagline: "Det uplanlagte" }
    ],
    sprints: [],
    tasks: [],
    rutiner: []
  };
}

// Miljøvariablerne. Sættes af handle() ved hvert kald (samme værdier hver gang).
let env: Env = () => undefined;

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });
}
const fail = (status: number, error: string) => json(status, { error });
const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const sha256 = (s: string) => createHash("sha256").update(s).digest();
// Sammenligning i konstant tid — hash først, så længden ikke afslører noget.
const same = (a: string, b: string) => timingSafeEqual(sha256(a), sha256(b));

async function readJson(req: Request): Promise<any> {
  const text = await req.text();
  if (text.length > MAX_BODY) throw new HttpError(413, "For meget data i én forespørgsel.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Forventede JSON.");
  }
}

/* ---------- Login ---------- */

function configuredPassword(): string | null {
  const p = env("HEYOTTO_PASSWORD");
  return p && p.length >= MIN_PASSWORD ? p : null;
}

// En tilfældig hemmelighed, der laves første gang og bor i lageret. Sessionerne
// signeres med den OG adgangskoden: skift adgangskode, så er alle logget ud.
async function sessionKey(store: Store, password: string) {
  return createHmac("sha256", await google.serverSecret(store)).update("session:" + password).digest("hex");
}

const sign = (key: string, expires: number) => createHmac("sha256", key).update("v1." + expires).digest("hex");

function readCookie(req: Request, name: string) {
  for (const part of (req.headers.get("cookie") || "").split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1);
  }
  return null;
}

function sessionCookie(req: Request, value: string, maxAge: number) {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

async function validSession(req: Request, store: Store, password: string) {
  const m = (readCookie(req, COOKIE) || "").match(/^v1\.(\d+)\.([0-9a-f]{64})$/);
  if (!m || Number(m[1]) < Date.now()) return false;
  return same(m[2], sign(await sessionKey(store, password), Number(m[1])));
}

async function caller(req: Request, store: Store, password: string, viaAccess: boolean): Promise<Who | null> {
  if (viaAccess) return "dig";            // Cloudflare Access har allerede logget dig ind
  return (await validSession(req, store, password)) ? "dig" : null;
}

// Cookies sendes automatisk, så ændringer med cookie skal komme fra siden selv:
// JSON (kan en fremmed formular ikke sende) og samme oprindelse.
function fromOwnPage(req: Request) {
  if (!(req.headers.get("content-type") || "").startsWith("application/json")) return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

async function login(req: Request, p: Platform, store: Store, password: string) {
  const failKey = FAILS + sha256(p.ip || "ukendt").toString("hex").slice(0, 32);
  const rec = (await store.get(failKey, { type: "json" })) as { count: number; first: number } | null;
  const recent = rec && Date.now() - rec.first < FAIL_WINDOW_MS ? rec : null;
  if (recent && recent.count >= MAX_FAILS) return fail(429, "For mange forkerte forsøg. Prøv igen om et kvarter.");

  const body = await readJson(req);
  if (!same(typeof body?.password === "string" ? body.password : "", password)) {
    await store.setJSON(failKey, { count: (recent?.count ?? 0) + 1, first: recent?.first ?? Date.now() });
    await sleep(600);
    return fail(401, "Forkert adgangskode.");
  }
  if (rec) await store.delete(failKey);
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  const token = "v1." + expires + "." + sign(await sessionKey(store, password), expires);
  return json(200, { ok: true }, { "Set-Cookie": sessionCookie(req, token, SESSION_DAYS * 86_400) });
}

/* ---------- Data og historik ---------- */

function revOf(found: { metadata?: Record<string, unknown> } | null) {
  return found && typeof found.metadata?.rev === "string" ? found.metadata.rev : "";
}

// Groft skema-tjek. Dashboardet viser selv de finere problemer (ukendt status osv.).
export function checkData(d: any): string | null {
  if (!d || typeof d !== "object" || Array.isArray(d)) return "data skal være et objekt.";
  for (const k of ["projects", "sprints", "tasks", "uger"]) {
    if (!Array.isArray(d[k])) return `data.${k} skal være en liste.`;
  }
  for (const k of ["meta", "kapacitet", "epics"]) {
    if (!d[k] || typeof d[k] !== "object" || Array.isArray(d[k])) return `data.${k} skal være et objekt.`;
  }
  if (d.projects.some((p: any) => !p || typeof p.id !== "string" || !p.id)) return "Hvert projekt skal have et id.";
  if (d.sprints.some((s: any) => !s || typeof s.project !== "string" || typeof s.month !== "string")) {
    return "Hver sprint skal have project og month.";
  }
  if (d.tasks.some((t: any) => !t || typeof t.id !== "string" || !t.id || typeof t.project !== "string")) {
    return "Hver opgave skal have et id og et projekt.";
  }
  // Rutiner (kan mangle i ældre data)
  if (d.rutiner !== undefined && (!Array.isArray(d.rutiner) ||
      d.rutiner.some((r: any) => !r || typeof r.id !== "string" || !r.id || typeof r.name !== "string"))) {
    return "data.rutiner skal være en liste, og hver rutine skal have et id og et navn.";
  }
  return null;
}

// "2026-10-05T12-03-07-123Z-a1b2" → Date. Ingen koloner, så id'et er sikkert i en URL.
function dateOf(id: string) {
  const m = id.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z-[0-9a-f]{4}$/);
  return m ? new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`) : null;
}

async function readIndex(store: Store): Promise<IndexEntry[]> {
  const index = await store.get(INDEX_KEY, { type: "json" });
  return Array.isArray(index) ? index : [];
}

// Tidsstemplet id, der kan sorteres og læses tilbage af dateOf().
const newId = () => new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomBytes(2).toString("hex");

// Hver gemt version lægges også i historikken — de ældste ryddes, så der højst er KEEP.
async function write(store: Store, data: any, by: string, restoredFrom?: string) {
  const id = newId();
  const text = JSON.stringify(data);
  await store.set(DATA_KEY, text, { metadata: { rev: id } });
  await store.set(HISTORY + id, text);
  const entry: IndexEntry = { id, by, projects: data.projects.length, tasks: data.tasks.length };
  if (restoredFrom) entry.restoredFrom = restoredFrom;
  const index = [entry, ...(await readIndex(store))];
  await store.setJSON(INDEX_KEY, index.slice(0, KEEP));
  for (const old of index.slice(KEEP)) await store.delete(HISTORY + old.id);
  return id;
}

export async function readData(store: Store) {
  const found = await store.getWithMetadata(DATA_KEY, { type: "json" });
  return found ? found.data : emptyData();
}

// Ændring fra serveren (API'et /ext): læs, ret, gem. Har nogen gemt imens, prøves forfra,
// så en ændring aldrig overskriver en anden. Står i Historik med navnet i by.
export async function saveData<T>(store: Store, by: string, change: (data: any) => T) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const found = await store.getWithMetadata(DATA_KEY, { type: "json" });
    const rev = revOf(found);
    const data = found ? found.data : emptyData();
    const result = change(data);
    const problem = checkData(data);
    if (problem) throw new HttpError(400, problem);
    if (revOf(await store.getMetadata(DATA_KEY)) !== rev) continue;
    return { rev: await write(store, data, by), result };
  }
  throw new HttpError(409, "Data blev ændret flere gange samtidig. Prøv igen.");
}

async function getData(store: Store) {
  const found = await store.getWithMetadata(DATA_KEY, { type: "json" });
  if (!found) return json(200, { rev: "", data: emptyData() });
  return json(200, { rev: revOf(found), data: found.data });
}

async function putData(req: Request, store: Store, who: Who) {
  const body = await readJson(req);
  const problem = checkData(body?.data);
  if (problem) return fail(400, problem);
  if (typeof body.rev !== "string") return fail(400, "rev mangler — hent data først, og send den rev, du fik med.");
  const before = await store.getWithMetadata(DATA_KEY, { type: "json" });
  if (body.rev !== revOf(before)) return fail(409, CONFLICT);
  const rev = await write(store, body.data, who);
  return json(200, { rev });
}

async function history(store: Store) {
  const current = revOf(await store.getMetadata(DATA_KEY));
  const versions = (await readIndex(store)).map((e) => ({
    ...e,
    savedAt: dateOf(e.id)?.toISOString() ?? null,
    current: e.id === current
  }));
  return json(200, { versions });
}

async function restore(store: Store, id: string, who: Who) {
  const data = dateOf(id) ? await store.get(HISTORY + id, { type: "json" }) : null;
  if (!data) return fail(410, "Den version findes ikke længere.");
  return json(200, { rev: await write(store, data, who, id) });
}

/* ---------- API-tokens (M11) ----------
   Til /ext og /mcp. Laves og tilbagekaldes kun af dig (cookie). Tokenet vises én gang. */

async function tokenRoutes(req: Request, store: Store, path: string) {
  if (path === "/api/tokens" && req.method === "GET") {
    return json(200, { tokens: (await tokens.listTokens(store)).map(tokens.publicToken), scopes: tokens.SCOPES });
  }
  if (path === "/api/tokens" && req.method === "POST") {
    const body = await readJson(req);
    try {
      const { token, record } = await tokens.createToken(store, body?.name, body?.scopes);
      return json(200, { token, record: tokens.publicToken(record) });
    } catch (e) {
      return fail(400, e instanceof Error ? e.message : String(e));
    }
  }
  const one = path.match(/^\/api\/tokens\/([0-9a-f]{16})$/);
  if (one && req.method === "DELETE") {
    const rec = await tokens.revokeToken(store, one[1]);
    return rec ? json(200, { record: tokens.publicToken(rec) }) : fail(410, "Tokenet findes ikke.");
  }
  return fail(400, "Ukendt adresse eller metode: " + req.method + " " + path);
}

/* ---------- Send til Studio (M15) ----------
   Selve arbejdet står i server/studio.mts. Studios svar skrives som kommentar på opgaven. */

export function studioCommenter(store: Store): studio.Commenter {
  return async (taskId, text) => {
    try {
      await saveData(store, "Studio", (data) => {
        const t = data.tasks.find((x: any) => x?.id === taskId);
        if (!t) return;                               // opgaven er slettet imens
        t.comments = [...(Array.isArray(t.comments) ? t.comments : []), { at: new Date().toISOString(), by: "Studio", text }].slice(-100);
      });
    } catch (e) {
      console.error("Studios svar kunne ikke gemmes på opgaven:", e);
      throw e;
    }
  };
}

async function studioRoutes(req: Request, store: Store, who: Who, path: string) {
  try {
    if (path === "/api/studio" && req.method === "GET") return json(200, await studio.health(env));
    if (path === "/api/studio/tasks" && req.method === "GET") {
      await studio.tick(store, env, studioCommenter(store));
      return json(200, { configured: !!studio.config(env), tasks: await studio.readAll(store) });
    }
    if (who !== "dig") return fail(401, "Kun du kan sende opgaver til Studio.");
    if (path === "/api/studio/tasks" && req.method === "POST") {
      const body = await readJson(req);
      const taskId = typeof body?.taskId === "string" ? body.taskId.trim().slice(0, 80) : "";
      if (!taskId) return fail(400, "Opgaven mangler et id.");
      const r = await studio.send(store, env, {
        taskId, title: typeof body.title === "string" ? body.title : "", text: typeof body.text === "string" ? body.text : ""
      });
      return json(200, { task: r });
    }
    const m = path.match(/^\/api\/studio\/tasks\/([^/]+)$/);
    if (m && req.method === "DELETE") {
      await studio.forget(store, decodeURIComponent(m[1]));
      return json(200, { ok: true });
    }
    return fail(400, "Ukendt adresse eller metode: " + req.method + " " + path);
  } catch (e) {
    if (e instanceof studio.StudioError) return fail(e.status, e.message);
    throw e;
  }
}

/* ---------- Google: konti og kalender ----------
   Selve arbejdet står i server/google.mts. Kalenderen ligger uden for data,
   så en synk aldrig giver "data er ændret et andet sted" i browseren. */

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store" } });
}

// Tilbage til appen med besked i adressen. Appen viser den og åbner Indstillinger.
function backToApp(ok: boolean, text: string) {
  return redirect("/?" + new URLSearchParams({ google: ok ? "forbundet" : "fejl", besked: text.slice(0, 300) }) + "#kapacitet");
}

async function googleCallback(req: Request, store: Store) {
  const u = new URL(req.url);
  if (u.searchParams.get("error")) {
    return backToApp(false, u.searchParams.get("error") === "access_denied"
      ? "Du afbrød forbindelsen hos Google. Intet er ændret."
      : "Google afviste forbindelsen: " + u.searchParams.get("error"));
  }
  try {
    const email = await google.finish(store, env, u.origin, u.searchParams.get("code") || "", u.searchParams.get("state") || "");
    try { await google.syncAll(store, env); } catch (e) { console.error("første kalendersynk fejlede:", e); }
    return backToApp(true, email);
  } catch (e) {
    if (!(e instanceof google.GoogleError)) console.error("Google-forbindelse fejlede:", e);
    return backToApp(false, e instanceof Error ? e.message : String(e));
  }
}

async function googleRoutes(req: Request, store: Store, who: Who, path: string) {
  if (who !== "dig") return fail(401, "Kun du kan forbinde og afbryde Google-konti — log ind i appen.");
  const origin = new URL(req.url).origin;
  if (path === "/api/google" && req.method === "GET") {
    return json(200, {
      configured: !!google.client(env), missing: google.missingEnv(env), redirectUri: google.redirectUri(origin),
      accounts: (await google.readAccounts(store)).map(google.publicAccount)
    });
  }
  if (path === "/api/google/connect" && req.method === "GET") {
    const scopes = (new URL(req.url).searchParams.get("scopes") || "calendar").split(",");
    try {
      return redirect(await google.startUrl(store, env, origin, scopes));
    } catch (e) {
      return backToApp(false, e instanceof Error ? e.message : String(e));
    }
  }
  const cal = path.match(/^\/api\/google\/accounts\/([^/]+)\/calendars$/);
  if (cal && req.method === "PUT") {
    const body = await readJson(req);
    const included = Array.isArray(body?.included) ? body.included.filter((x: unknown) => typeof x === "string") : null;
    if (!included) return fail(400, "included skal være en liste af kalender-id'er.");
    const acc = await google.setCalendars(store, decodeURIComponent(cal[1]), included);
    if (!acc) return fail(410, "Kontoen er ikke forbundet længere.");
    // Hent igen med det nye valg, så kapaciteten passer med det samme
    let snapshot = null;
    try { snapshot = await google.syncAll(store, env); } catch (e) { console.error("synk efter kalendervalg fejlede:", e); }
    return json(200, { account: google.publicAccount(acc), snapshot });
  }
  const one = path.match(/^\/api\/google\/accounts\/([^/]+)$/);
  if (one && req.method === "DELETE") {
    return (await google.disconnect(store, decodeURIComponent(one[1]))) ? json(200, { ok: true }) : fail(410, "Kontoen er ikke forbundet længere.");
  }
  return fail(400, "Ukendt adresse eller metode: " + req.method + " " + path);
}

async function calendarRoutes(req: Request, store: Store, who: Who, path: string) {
  if (path === "/api/calendar" && req.method === "GET") return json(200, { snapshot: await google.readSnapshot(store) });
  if (path === "/api/calendar/refresh" && req.method === "POST") {
    if (who !== "dig") return fail(401, "Claude kan læse kalenderen, men ikke starte en synk.");
    const last = await google.readSnapshot(store);
    if (last && Date.now() - Date.parse(last.fetchedAt) < google.REFRESH_GAP_MS) {
      return json(200, { snapshot: last, note: "Kalenderen blev hentet for under et minut siden." });
    }
    return json(200, { snapshot: await google.syncAll(store, env) });
  }
  return fail(405, "Brug GET /api/calendar eller POST /api/calendar/refresh.");
}

/* ---------- Alarmer og push ----------
   Reglerne står i dashboard/lib/forecast.mjs, kørslen og lageret i server/alerts.mts.
   Udsættelser ligger på serveren, så de gælder på alle enheder. */

const isoDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

async function alertRoutes(req: Request, store: Store, who: Who, path: string) {
  if (path === "/api/alerts" && req.method === "GET") {
    const st = await alarm.readState(store);
    const subs = await alarm.readSubs(store);
    return json(200, {
      state: { snoozed: st.snoozed, prefs: st.prefs },
      push: { publicKey: (await alarm.vapid(store)).publicKey,
              devices: subs.map((s) => ({ label: s.label, createdAt: s.createdAt, endpoint: s.endpoint })) }
    });
  }
  if (who !== "dig") return fail(401, "Kun du kan ændre alarmer og notifikationer — log ind i appen.");
  const body = req.method === "GET" ? null : await readJson(req);
  if (path === "/api/alerts/snooze" && req.method === "PUT") {
    const key = typeof body?.key === "string" ? body.key.slice(0, 200) : "";
    if (!key) return fail(400, "key mangler.");
    if (body.until !== null && !isoDay(body.until)) return fail(400, "until skal være ÅÅÅÅ-MM-DD eller null.");
    return json(200, { snoozed: (await alarm.snooze(store, key, body.until)).snoozed });
  }
  if (path === "/api/alerts/prefs" && req.method === "PUT") {
    return json(200, { prefs: (await alarm.setPrefs(store, body || {})).prefs });
  }
  if (path === "/api/push/subscribe" && req.method === "POST") {
    try { return json(200, { devices: await alarm.subscribe(store, body) }); }
    catch (e) { return fail(400, e instanceof Error ? e.message : String(e)); }
  }
  if (path === "/api/push/unsubscribe" && req.method === "POST") {
    return json(200, { devices: await alarm.unsubscribe(store, String(body?.endpoint || "")) });
  }
  if (path === "/api/push/test" && req.method === "POST") {
    const endpoint = String(body?.endpoint || "");
    const r = await alarm.sendAll(store, [{ title: "HeyOtto Tasks", body: "Sådan ser en notifikation fra Otto ud.", url: "/#kapacitet", tag: "test" }],
                                  new URL(req.url).origin, undefined, endpoint);
    if (!r.sent) return fail(400, r.removed ? "Enheden er ikke tilmeldt længere. Slå notifikationer til igen." : "Kunne ikke sende til enheden.");
    return json(200, r);
  }
  return fail(400, "Ukendt adresse eller metode: " + req.method + " " + path);
}

/* ---------- Otto: agent-kernen (M7) ----------
   Selve kørslerne sker i køen (worker/index.mts → queue).
   Her ligger status, indstillinger, loggen og "start en kørsel". Kun du kan starte
   Otto og ændre indstillingerne. Claude (routinen) kan læse loggen. */

const AGENT_PER_HOUR = 30;
const AGENT_INPUT_MAX = 2000;
const AGENT_NOT_SET_UP = "Otto er ikke sat op endnu: Claude API mangler. Sæt ANTHROPIC_API_KEY som hemmelighed i Cloudflare (`npx wrangler secret put`). " +
                         "Vejledningen står under Indstillinger → Otto.";

const agentReady = () => agentConfigured(env);

async function agentStatus(store: agent.Store) {
  const s = await agent.readSettings(store);
  const spend = await agent.readSpend(store, agent.dayIn(s.tz));
  return {
    configured: agentReady(),
    settings: { enabled: s.enabled, budgetDkk: s.budgetDkk, usdDkk: s.usdDkk, tz: s.tz, kinds: s.kinds },
    today: { dkk: Math.round(spend.usd * s.usdDkk * 100) / 100, runs: spend.runs },
    kinds: Object.values(KINDS).map((k) => ({
      id: k.id, label: k.label, tools: k.tools, byHand: k.byHand, needsInput: k.needsInput,
      schedule: k.schedule ? (k.schedule.weekday === 1 ? "mandag" : k.schedule.weekdays ? "hverdage" : "alle dage") + " kl. " + k.schedule.hour +
                            (k.schedule.onlyIfRisk ? ", kun når noget er i risiko" : "") : ""
    })),
    models: Object.entries(MODELS).map(([id, m]) => ({ id, label: m.label }))
  };
}

async function startAgentRun(req: Request, store: agent.Store, platform: Platform) {
  const body = await readJson(req);
  const kind = KINDS[typeof body?.kind === "string" ? body.kind : ""];
  if (!kind || !kind.byHand) return fail(400, "Ukendt slags kørsel.");
  const input = clip(body?.input, AGENT_INPUT_MAX);
  if (kind.needsInput && !input) return fail(400, "Skriv dit spørgsmål først.");
  if (!agentReady()) return fail(400, AGENT_NOT_SET_UP);
  const s = await agent.readSettings(store);
  if (!s.enabled) return fail(400, "Otto er slået fra under Indstillinger → Otto.");
  if (!s.kinds[kind.id]?.enabled) return fail(400, `„${kind.label}“ er slået fra under Indstillinger → Otto.`);
  const spend = await agent.readSpend(store, agent.dayIn(s.tz));
  if (spend.usd * s.usdDkk >= s.budgetDkk) {
    return fail(400, `Dagsbudgettet på ${s.budgetDkk} kr. er brugt. Hæv det under Indstillinger → Otto, eller vent til i morgen.`);
  }
  const lastHour = (await agent.runIds(store)).filter((id) => Date.now() - (dateOf(id)?.getTime() ?? 0) < 3_600_000).length;
  if (lastHour >= AGENT_PER_HOUR) return fail(429, `Otto kan højst startes ${AGENT_PER_HOUR} gange i timen. Prøv igen om lidt.`);
  if (kind.id === "indbakke") {
    const accounts = await google.readAccounts(store as any);
    if (!accounts.some((a) => a.scopes.includes("gmail"))) {
      return fail(400, "Ingen Google-konto har givet adgang til mail endnu. Tryk „Giv adgang til mail“ i Indbakken.");
    }
    const busy = (await agent.readRuns(store, 10)).find((r) => r.kind === "indbakke" && (r.status === "i kø" || r.status === "kører") &&
                                                          Date.now() - Date.parse(r.updatedAt) < 16 * 60_000);
    if (busy) return json(200, { run: busy, started: true, note: "Otto er allerede i gang med at hente mails." });
  }
  let parent = clip(body?.parent, 60);
  const p = parent ? await agent.readRun(store, parent) : null;
  if (!p || p.kind !== kind.id) parent = "";
  const run = await enqueue(store, kind.id, "dig", input, parent);
  // Går startsignalet tabt, starter den planlagte oprydning kørslen igen inden for et kvarter
  const started = await platform.startRun(run.id);
  return json(200, { run, started });
}

async function agentRoutes(req: Request, store: agent.Store, who: Who, path: string, p: Platform) {
  if (path === "/api/agent" && req.method === "GET") return json(200, await agentStatus(store));
  if (path === "/api/agent/runs" && req.method === "GET") {
    return json(200, { runs: (await agent.readRuns(store, 40)).map(agent.runSummary) });
  }
  const one = path.match(/^\/api\/agent\/runs\/([^/]+)$/);
  if (one && req.method === "GET") {
    const run = await agent.readRun(store, decodeURIComponent(one[1]));
    return run ? json(200, { run }) : fail(410, "Kørslen findes ikke længere.");
  }
  if (who !== "dig") return fail(401, "Kun du kan starte Otto og ændre Ottos indstillinger — log ind i appen.");
  if (path === "/api/agent/settings" && req.method === "PUT") {
    await agent.updateSettings(store, await readJson(req));
    return json(200, await agentStatus(store));
  }
  if (path === "/api/agent/runs" && req.method === "POST") return await startAgentRun(req, store, p);
  return fail(400, "Ukendt adresse eller metode: " + req.method + " " + path);
}

/* ---------- Indbakke: Ottos forslag fra mail (M8) ----------
   "Hent mails" er bare en kørsel af slagsen indbakke (POST /api/agent/runs). Her ligger
   forslagene, og du markerer dem som oprettet eller ignoreret. Selve opgaven laves af
   appen og gemmes med PUT /api/data som alt andet. */

async function inboxRoutes(req: Request, store: agent.Store, who: Who, path: string) {
  if (path === "/api/inbox" && req.method === "GET") {
    const all = await inbox.readSuggestions(store);
    const accounts = await google.readAccounts(store as any);
    return json(200, {
      suggestions: all.filter((s) => s.status === "ny"),
      handled: all.filter((s) => s.status !== "ny").slice(0, 20),
      mail: { accounts: accounts.map((a) => ({ id: a.id, email: a.email, gmail: a.scopes.includes("gmail") })) }
    });
  }
  const one = path.match(/^\/api\/inbox\/([0-9a-f]{12})$/);
  if (one && req.method === "PUT") {
    if (who !== "dig") return fail(401, "Kun du kan oprette eller ignorere forslag — log ind i appen.");
    const body = await readJson(req);
    if (!["ny", "oprettet", "ignoreret"].includes(body?.status)) return fail(400, 'status skal være "oprettet", "ignoreret" eller "ny".');
    const s = await inbox.setStatus(store, one[1], body.status, clip(body?.taskId, 120));
    return s ? json(200, { suggestion: s }) : fail(410, "Forslaget findes ikke længere.");
  }
  return fail(400, "Ukendt adresse eller metode: " + req.method + " " + path);
}

/* ---------- Planforslag: omplanlæg med Otto (M9) ----------
   Start: POST /api/agent/runs { kind: "omplanlaeg", input? }. Forslaget gemmes under
   kørslens id. Ændringerne lægges ind i data af appen, når du trykker Anvend. */

async function planRoutes(req: Request, store: agent.Store, who: Who, path: string) {
  if (path === "/api/plans" && req.method === "GET") return json(200, { plans: await plans.latestPlans(store as any, 10) });
  const one = path.match(/^\/api\/plans\/([^/]+)$/);
  if (one && req.method === "GET") {
    const p = await plans.readPlan(store as any, decodeURIComponent(one[1]));
    return p ? json(200, { plan: p }) : fail(410, "Forslaget findes ikke (Otto lavede måske intet forslag, fordi alt når i mål).");
  }
  if (one && req.method === "PUT") {
    if (who !== "dig") return fail(401, "Kun du kan anvende eller kassere et forslag — log ind i appen.");
    const body = await readJson(req);
    if (!["anvendt", "kasseret"].includes(body?.status)) return fail(400, 'status skal være "anvendt" eller "kasseret".');
    const p = await plans.setPlanStatus(store as any, decodeURIComponent(one[1]), body.status);
    return p ? json(200, { plan: p }) : fail(410, "Forslaget findes ikke længere.");
  }
  return fail(400, "Ukendt adresse eller metode: " + req.method + " " + path);
}

/* ---------- Ruter ---------- */

export async function handle(req: Request, p: Platform): Promise<Response> {
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  const method = req.method;
  try {
    env = p.env;
    // Med Cloudflare Access (p.user) er der ingen adgangskode. Uden (lokal udvikling) kræves den.
    const viaAccess = !!p.user;
    const password = viaAccess ? "" : configuredPassword();
    if (!viaAccess && !password) {
      return fail(503, "HeyOtto Tasks er ikke sat op: slå Cloudflare Access til, eller sæt en adgangskode på mindst " + MIN_PASSWORD +
                       " tegn som hemmeligheden HEYOTTO_PASSWORD (`npx wrangler secret put HEYOTTO_PASSWORD`).");
    }
    const store = p.store;

    if (path === "/api/logout" && method === "POST") {
      // Med Access logger appen ud hos Cloudflare Access (ellers er du bare logget ind igen)
      return json(200, { ok: true, accessLogout: viaAccess ? "/cdn-cgi/access/logout" : "" }, { "Set-Cookie": sessionCookie(req, "", 0) });
    }
    if (path === "/api/login" && method === "POST") {
      if (viaAccess) return json(200, { ok: true });
      if (!fromOwnPage(req)) return fail(400, "Login skal ske fra HeyOtto Tasks selv.");
      return await login(req, p, store, password);
    }
    // Google sender browseren hertil fra sit eget site, så session-cookien følger ikke
    // med. Den signerede engangs-state i google.mts beviser, at du startede flowet.
    if (path === "/api/google/callback" && method === "GET") return await googleCallback(req, store);

    const who = await caller(req, store, password, viaAccess);
    if (!who) return fail(401, "Ikke logget ind.");
    if (method !== "GET" && who === "dig" && !fromOwnPage(req)) return fail(400, "Ændringer skal komme fra HeyOtto OS selv.");

    if (path === "/api/data") {
      if (method === "GET") return await getData(store);
      if (method === "PUT") return await putData(req, store, who);
      return fail(405, "Brug GET eller PUT.");
    }
    if (path === "/api/history" && method === "GET") return await history(store);
    const restoreMatch = path.match(/^\/api\/history\/([^/]+)\/restore$/);
    if (restoreMatch && method === "POST") return await restore(store, decodeURIComponent(restoreMatch[1]), who);
    if (path === "/api/tokens" || path.startsWith("/api/tokens/")) {
      if (who !== "dig") return fail(401, "Kun du kan lave og tilbagekalde API-tokens — log ind i appen.");
      return await tokenRoutes(req, store, path);
    }
    if (path === "/api/studio" || path.startsWith("/api/studio/")) return await studioRoutes(req, store, who, path);
    if (path === "/api/google" || path.startsWith("/api/google/")) return await googleRoutes(req, store, who, path);
    if (path === "/api/calendar" || path === "/api/calendar/refresh") return await calendarRoutes(req, store, who, path);
    if (path === "/api/alerts" || path.startsWith("/api/alerts/") || path.startsWith("/api/push/")) return await alertRoutes(req, store, who, path);
    if (path === "/api/agent" || path.startsWith("/api/agent/")) return await agentRoutes(req, store as unknown as agent.Store, who, path, p);
    if (path === "/api/inbox" || path.startsWith("/api/inbox/")) return await inboxRoutes(req, store as unknown as agent.Store, who, path);
    if (path === "/api/plans" || path.startsWith("/api/plans/")) return await planRoutes(req, store as unknown as agent.Store, who, path);
    return fail(400, "Ukendt adresse eller metode: " + method + " " + path);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    console.error("api fejlede:", e);
    return fail(500, "Serverfejl: " + (e instanceof Error ? e.message : String(e)));
  }
}
