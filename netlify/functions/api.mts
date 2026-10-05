/* HeyOtto OS — API'et bag dashboardet.

   Alt indhold ligger i Netlify Blobs som JSON. Ingen filer.

     POST   /api/login                       log ind med adgangskoden → session-cookie
     POST   /api/logout                      log ud
     GET    /api/data                        { rev, data }
     PUT    /api/data                        { rev, data } → { rev }   (409 hvis rev er forældet)
     GET    /api/history                     de seneste gemte versioner
     POST   /api/history/:id/restore         gør en gammel version til den gældende
     GET    /api/claude-key                  findes der en nøgle til Claude?
     POST   /api/claude-key                  lav (eller udskift) nøglen — vises kun én gang
     DELETE /api/claude-key                  fjern Claudes adgang

   To måder at være logget ind på:
     * Kasper: adgangskoden fra miljøvariablen HEYOTTO_PASSWORD giver en signeret
       session-cookie (HttpOnly, SameSite=Strict, 90 dage).
     * Claude: "Authorization: Bearer <nøgle>". Nøglen laves i appen og gemmes kun
       som hash. Claude kan læse og skrive data, men ikke lave nøgler.

   Mangler adgangskoden, svarer alt med 503. Der er aldrig en åben dør.

   API'et svarer aldrig 403 eller 404: Netlify prøver ved de koder at finde en
   statisk side i stedet (/api/login.html …), og så kommer det forkerte svar frem.
   Afvisninger er derfor 400/401, og en forsvundet version er 410. */

import { getDeployStore, getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type Store = ReturnType<typeof getStore>;
type Who = "dig" | "Claude";
type IndexEntry = { id: string; by: Who; projects: number; tasks: number; restoredFrom?: string };

const DATA_KEY = "data";
const INDEX_KEY = "historik-index";
const HISTORY = "historik/";
const SECRET_KEY = "auth/secret";
const CLAUDE_KEY = "auth/claude-key";
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

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Tom start: Drift og Ad hoc findes altid, fordi kapacitetsmodellen regner i dem.
function emptyData() {
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
    tasks: []
  };
}

// Kun produktion rører de rigtige data. Deploy Previews og branch-deploys får
// hver deres eget lager — med egen nøgle og egen hemmelighed — så en test aldrig
// kan overskrive noget.
function dataStore(context: Context): Store {
  const options = { name: "heyotto-os", consistency: "strong" as const };
  return context.deploy?.context === "production" ? getStore(options) : getDeployStore(options);
}

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });
}
const fail = (status: number, error: string) => json(status, { error });
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
  const p = Netlify.env.get("HEYOTTO_PASSWORD");
  return p && p.length >= MIN_PASSWORD ? p : null;
}

// En tilfældig hemmelighed, der laves første gang og bor i lageret. Sessionerne
// signeres med den OG adgangskoden: skift adgangskode, så er alle logget ud.
async function sessionKey(store: Store, password: string) {
  let secret = await store.get(SECRET_KEY);
  if (typeof secret !== "string" || !secret) {
    await store.set(SECRET_KEY, randomBytes(32).toString("hex"));
    secret = await store.get(SECRET_KEY);
  }
  return createHmac("sha256", String(secret)).update("session:" + password).digest("hex");
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

async function caller(req: Request, store: Store, password: string): Promise<Who | null> {
  const bearer = (req.headers.get("authorization") || "").match(/^Bearer\s+(\S+)$/i);
  if (bearer) {
    const saved = (await store.get(CLAUDE_KEY, { type: "json" })) as { hash?: string } | null;
    return saved?.hash && same(sha256(bearer[1]).toString("hex"), saved.hash) ? "Claude" : null;
  }
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

async function login(req: Request, context: Context, store: Store, password: string) {
  const failKey = FAILS + sha256(context.ip || "ukendt").toString("hex").slice(0, 32);
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
function checkData(d: any): string | null {
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

// Hver gemt version lægges også i historikken — de ældste ryddes, så der højst er KEEP.
async function write(store: Store, data: any, by: Who, restoredFrom?: string) {
  const id = new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomBytes(2).toString("hex");
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
  if (body.rev !== revOf(await store.getMetadata(DATA_KEY))) return fail(409, CONFLICT);
  return json(200, { rev: await write(store, body.data, who) });
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

/* ---------- Claudes nøgle ---------- */

async function claudeKey(req: Request, store: Store) {
  if (req.method === "GET") {
    const saved = (await store.get(CLAUDE_KEY, { type: "json" })) as { createdAt?: string } | null;
    return json(200, { exists: !!saved, createdAt: saved?.createdAt ?? null });
  }
  if (req.method === "DELETE") {
    await store.delete(CLAUDE_KEY);
    return json(200, { exists: false });
  }
  if (req.method === "POST") {
    const key = "ho_" + randomBytes(24).toString("base64url");
    const createdAt = new Date().toISOString();
    await store.setJSON(CLAUDE_KEY, { hash: sha256(key).toString("hex"), createdAt });
    return json(200, { key, createdAt });
  }
  return fail(405, "Metoden understøttes ikke her.");
}

/* ---------- Ruter ---------- */

export default async (req: Request, context: Context) => {
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  const method = req.method;
  try {
    const password = configuredPassword();
    if (!password) {
      return fail(503, "HeyOtto OS er ikke sat op endnu: sæt en adgangskode på mindst " + MIN_PASSWORD +
                       " tegn som miljøvariablen HEYOTTO_PASSWORD i Netlify.");
    }
    const store = dataStore(context);

    if (path === "/api/logout" && method === "POST") {
      return json(200, { ok: true }, { "Set-Cookie": sessionCookie(req, "", 0) });
    }
    if (path === "/api/login" && method === "POST") {
      if (!fromOwnPage(req)) return fail(400, "Login skal ske fra HeyOtto OS selv.");
      return await login(req, context, store, password);
    }

    const who = await caller(req, store, password);
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
    if (path === "/api/claude-key") {
      if (who !== "dig") return fail(401, "Kun du kan lave eller fjerne Claudes nøgle — log ind i appen.");
      return await claudeKey(req, store);
    }
    return fail(400, "Ukendt adresse eller metode: " + method + " " + path);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    console.error("api fejlede:", e);
    return fail(500, "Serverfejl: " + (e instanceof Error ? e.message : String(e)));
  }
};

export const config: Config = {
  path: "/api/*"
};
