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
     GET    /api/claude/jobs                 { connected, jobs } — de seneste opgaver, Claude er sat på
     POST   /api/claude/jobs                 { taskId, task, instruction } → sæt Claude i gang (kun Kasper)
     GET    /api/claude/jobs/:id             ét job
     PUT    /api/claude/jobs/:id             { status, result?, error? } — Claude melder tilbage,
                                             Kasper godkender eller kasserer

   To måder at være logget ind på:
     * Kasper: adgangskoden fra miljøvariablen HEYOTTO_PASSWORD giver en signeret
       session-cookie (HttpOnly, SameSite=Strict, 90 dage).
     * Claude: "Authorization: Bearer <nøgle>". Nøglen laves i appen og gemmes kun
       som hash. Claude kan læse og skrive data, men ikke lave nøgler og ikke
       sætte sig selv i gang.

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

// Tidsstemplet id, der kan sorteres og læses tilbage af dateOf().
const newId = () => new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomBytes(2).toString("hex");

// Hver gemt version lægges også i historikken — de ældste ryddes, så der højst er KEEP.
async function write(store: Store, data: any, by: Who, restoredFrom?: string) {
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

async function getData(store: Store) {
  const found = await store.getWithMetadata(DATA_KEY, { type: "json" });
  if (!found) return json(200, { rev: "", data: emptyData() });
  return json(200, { rev: revOf(found), data: found.data });
}

async function putData(req: Request, context: Context, store: Store, who: Who) {
  const body = await readJson(req);
  const problem = checkData(body?.data);
  if (problem) return fail(400, problem);
  if (typeof body.rev !== "string") return fail(400, "rev mangler — hent data først, og send den rev, du fik med.");
  const before = await store.getWithMetadata(DATA_KEY, { type: "json" });
  if (body.rev !== revOf(before)) return fail(409, CONFLICT);
  const rev = await write(store, body.data, who);
  const claude = who === "dig" ? await autoStart(context, store, before?.data, body.data) : null;
  return json(200, claude ? { rev, claude } : { rev });
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

/* ---------- Claude udfører opgaver ----------
   Et job er én opgave, Claude er sat til at udføre. HeyOtto OS starter en
   Claude Code Routine (CLAUDE_ROUTINE_URL og CLAUDE_ROUTINE_TOKEN i Netlify) og
   sender kun job-id'et med. Routinen henter selv jobbet her med Claudes nøgle,
   laver arbejdet — kun udkast, aldrig noget der sendes — og skriver resultatet
   tilbage. Jobs ligger ved siden af data, så Claudes svar aldrig giver
   "data er ændret et andet sted" i browseren. */

type JobStatus = "sendt" | "i gang" | "til godkendelse" | "fejlet" | "godkendt" | "kasseret";
type TaskSnapshot = { title: string; note: string; owner: string; due: string; status: string;
                      project: string; projectName: string; sprintGoal: string };
type Job = {
  id: string; taskId: string; task: TaskSnapshot; instruction: string; startedBy: "knap" | "ejer";
  status: JobStatus; sessionUrl: string; result: string; error: string; createdAt: string; updatedAt: string;
};
type Wanted = Pick<Job, "taskId" | "task" | "instruction" | "startedBy">;

const JOBS = "claude-jobs/";
const JOBS_KEEP = 100;                 // så mange jobs gemmes i alt …
const JOBS_LISTED = 40;                // … og så mange vises
const JOBS_PER_HOUR = 10;
const AUTO_PER_SAVE = 3;
const STALE_MS = 2 * 3_600_000;        // et job uden livstegn i to timer tæller ikke længere som i gang
const FIRE_TIMEOUT_MS = 8000;          // Netlify giver funktionen 10 sekunder
const MAX_RESULT = 20_000;
const SNAPSHOT_LIMITS: Record<keyof TaskSnapshot, number> = {
  title: 200, note: 2000, owner: 60, due: 10, status: 30, project: 60, projectName: 100, sprintGoal: 400
};

const NOT_CONNECTED = "Claude er ikke forbundet endnu. Sæt CLAUDE_ROUTINE_URL og CLAUDE_ROUTINE_TOKEN " +
                      "i Netlify — vejledningen står under Claude-adgang i appen.";

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isClaude = (owner: unknown) => typeof owner === "string" && owner.trim().toLowerCase() === "claude";
const busy = (j: Job) => (j.status === "sendt" || j.status === "i gang") && Date.now() - Date.parse(j.updatedAt) < STALE_MS;

function routine() {
  const url = (Netlify.env.get("CLAUDE_ROUTINE_URL") || "").trim();
  const token = (Netlify.env.get("CLAUDE_ROUTINE_TOKEN") || "").trim();
  return url && token ? { url, token } : null;
}

function cleanSnapshot(s: any): TaskSnapshot {
  const out = {} as TaskSnapshot;
  for (const k of Object.keys(SNAPSHOT_LIMITS) as (keyof TaskSnapshot)[]) out[k] = clip(s?.[k], SNAPSHOT_LIMITS[k]);
  return out;
}

// Samme oplysninger, som appen sender med, når du trykker på knappen.
function snapshotOf(data: any, t: any): TaskSnapshot {
  const p = data.projects.find((x: any) => x?.id === t.project);
  const s = data.sprints.find((x: any) => x?.project === t.project && x?.month === t.sprint);
  return cleanSnapshot({ ...t, projectName: p?.name, sprintGoal: s?.goal });
}

async function jobIds(store: Store) {
  const { blobs } = await store.list({ prefix: JOBS });
  return blobs.map((b) => b.key.slice(JOBS.length)).filter((id) => dateOf(id)).sort().reverse();
}

async function readJob(store: Store, id: string) {
  return dateOf(id) ? ((await store.get(JOBS + id, { type: "json" })) as Job | null) : null;
}

async function readJobs(store: Store, ids: string[]) {
  return (await Promise.all(ids.map((id) => readJob(store, id)))).filter((j): j is Job => !!j);
}

async function saveJob(store: Store, job: Job) {
  job.updatedAt = new Date().toISOString();
  await store.setJSON(JOBS + job.id, job);
  return job;
}

// Opretter jobbene, hvis grænserne tillader det. Selve starten sker i launch().
async function createJobs(store: Store, wanted: Wanted[]) {
  const ids = await jobIds(store);
  const recent = await readJobs(store, ids.slice(0, JOBS_LISTED));
  let lastHour = ids.filter((id) => Date.now() - dateOf(id)!.getTime() < 3_600_000).length;
  const jobs: Job[] = [];
  const skipped: string[] = [];
  for (const w of wanted) {
    if (recent.some((j) => j.taskId === w.taskId && busy(j))) {
      skipped.push(`„${w.task.title}“: Claude arbejder allerede på den.`);
    } else if (lastHour >= JOBS_PER_HOUR) {
      skipped.push(`„${w.task.title}“: Claude kan højst sættes i gang ${JOBS_PER_HOUR} gange i timen. Prøv igen senere.`);
    } else {
      const now = new Date().toISOString();
      const job: Job = { id: newId(), ...w, status: "sendt", sessionUrl: "", result: "", error: "", createdAt: now, updatedAt: now };
      await store.setJSON(JOBS + job.id, job);
      jobs.push(job);
      lastHour++;
    }
  }
  for (const old of ids.slice(Math.max(0, JOBS_KEEP - jobs.length))) await store.delete(JOBS + old);
  return { jobs, skipped };
}

function fireError(status: number, retryAfter: string | null) {
  if (status === 401) return "Routine-nøglen virker ikke. Lav en ny under routinens API-trigger på claude.ai/code/routines, og ret CLAUDE_ROUTINE_TOKEN i Netlify.";
  if (status === 404) return "Routinen findes ikke. Tjek CLAUDE_ROUTINE_URL i Netlify.";
  if (status === 403) return "Din Claude-konto har ikke adgang til at starte routines.";
  if (status === 429) {
    const min = Math.ceil(Number(retryAfter) / 60);
    return "Claude har nået grænsen for kørsler i timen. " + (min > 0 ? `Prøv igen om ${min} min.` : "Prøv igen senere.");
  }
  if (status === 400) return "Claude afviste at starte. Er routinen sat på pause på claude.ai/code/routines?";
  return `Claude svarer ikke lige nu (fejl ${status}). Prøv igen om lidt.`;
}

// Starter routinen for et job. Går det galt, står fejlen på jobbet, så den kan ses i appen.
async function launch(store: Store, job: Job): Promise<Job> {
  const r = routine();
  let sessionUrl = "";
  let error = "";
  try {
    if (!r) throw new HttpError(400, NOT_CONNECTED);
    if (!/^https:\/\/\S+\/fire$/.test(r.url) && !/^http:\/\/(127\.0\.0\.1|localhost)[:/]\S*\/fire$/.test(r.url)) {
      throw new HttpError(400, "CLAUDE_ROUTINE_URL ser forkert ud. Den skal være den URL, claude.ai viser ved routinens API-trigger, og slutte med /fire.");
    }
    const res = await fetch(r.url, {
      method: "POST",
      headers: { Authorization: "Bearer " + r.token, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ text: `HeyOtto OS-job ${job.id}\nOpgave: ${job.task.title}` }),
      signal: AbortSignal.timeout(FIRE_TIMEOUT_MS)
    });
    if (!res.ok) throw new HttpError(502, fireError(res.status, res.headers.get("retry-after")));
    const body = (await res.json().catch(() => null)) as { claude_code_session_url?: unknown } | null;
    sessionUrl = typeof body?.claude_code_session_url === "string" ? body.claude_code_session_url : "";
  } catch (e) {
    error = e instanceof HttpError ? e.message
      : e instanceof Error && e.name === "TimeoutError" ? "Claude svarede ikke i tide. Måske er den alligevel gået i gang — se efter på claude.ai/code. Ellers prøv igen."
      : "Kunne ikke nå Claude. Prøv igen om lidt.";
    if (!(e instanceof HttpError)) console.error("routine-start fejlede:", e);
  }
  // Læs jobbet igen: routinen kan allerede have meldt sig.
  const job2 = (await readJob(store, job.id)) || job;
  if (sessionUrl) job2.sessionUrl = sessionUrl;
  if (error && job2.status === "sendt") {
    job2.status = "fejlet";
    job2.error = error;
  }
  return await saveJob(store, job2);
}

// Ejer = "Claude" betyder "udfør den". Det gælder kun, når DU gemmer, og kun
// opgaver, der lige er givet til Claude. Claudes egne gem og gendannelser fra
// Historik sætter aldrig noget i gang, så Claude ikke kan starte sig selv.
async function autoStart(context: Context, store: Store, before: any, data: any) {
  const had = new Map<string, unknown>((Array.isArray(before?.tasks) ? before.tasks : []).map((t: any) => [t?.id, t?.owner]));
  const fresh = data.tasks.filter((t: any) => isClaude(t.owner) && !isClaude(had.get(t.id)) &&
                                              !/^(færdig|faerdig|droppet)$/i.test(String(t.status ?? "").trim()));
  if (!fresh.length) return null;
  if (!routine()) return { started: 0, skipped: [NOT_CONNECTED] };

  const now = fresh.slice(0, AUTO_PER_SAVE);
  const { jobs, skipped } = await createJobs(store, now.map((t: any) => ({
    taskId: t.id, task: snapshotOf(data, t), instruction: "", startedBy: "ejer" as const
  })));
  for (const t of fresh.slice(AUTO_PER_SAVE)) {
    skipped.push(`„${clip(t.title, 120)}“: højst ${AUTO_PER_SAVE} opgaver startes ad gangen. Åbn den, og tryk ✦ Lad Claude udføre.`);
  }
  // Svaret til browseren venter ikke på, at Claude starter. Fejl kan ses på jobbet.
  for (const job of jobs) context.waitUntil(launch(store, job));
  return { started: jobs.length, skipped };
}

async function startByHand(req: Request, store: Store) {
  const body = await readJson(req);
  const taskId = clip(body?.taskId, 80);
  const task = cleanSnapshot(body?.task);
  if (!taskId || !task.title) return fail(400, "Opgaven skal have et id og en titel.");
  if (!routine()) return fail(400, NOT_CONNECTED);
  const { jobs, skipped } = await createJobs(store, [{ taskId, task, instruction: clip(body?.instruction, 2000), startedBy: "knap" }]);
  if (!jobs.length) return fail(400, skipped[0]);
  return json(200, { job: await launch(store, jobs[0]) });
}

async function updateJob(req: Request, store: Store, who: Who, id: string) {
  const job = await readJob(store, id);
  if (!job) return fail(410, "Jobbet findes ikke længere.");
  const body = await readJson(req);
  const status = body?.status;

  if (who === "Claude") {
    if (!["i gang", "til godkendelse", "fejlet"].includes(status)) {
      return fail(400, 'Claude kan sætte status til "i gang", "til godkendelse" eller "fejlet".');
    }
    if (job.status === "godkendt" || job.status === "kasseret") {
      return fail(410, `Kasper har allerede lukket jobbet (${job.status}). Intet er gemt.`);
    }
    if (typeof body.result === "string") {
      if (body.result.length > MAX_RESULT) return fail(400, `Resultatet må højst være ${MAX_RESULT} tegn.`);
      job.result = body.result.trim();
    }
    job.error = status === "fejlet" ? clip(body.error, 1000) : "";
    if (status === "til godkendelse" && !job.result) return fail(400, "Et job til godkendelse skal have et result.");
    if (status === "fejlet" && !job.error) return fail(400, "Skriv i error, hvorfor jobbet fejlede.");
  } else if (!["godkendt", "kasseret"].includes(status)) {
    return fail(400, 'Du kan sætte status til "godkendt" eller "kasseret".');
  }
  job.status = status;
  return json(200, { job: await saveJob(store, job) });
}

async function claudeJobs(req: Request, store: Store, who: Who, path: string) {
  if (path === "/api/claude/jobs") {
    if (req.method === "GET") {
      return json(200, { connected: !!routine(), jobs: await readJobs(store, (await jobIds(store)).slice(0, JOBS_LISTED)) });
    }
    if (req.method === "POST") {
      if (who !== "dig") return fail(401, "Claude kan ikke sætte sig selv i gang — det gør Kasper i appen.");
      return await startByHand(req, store);
    }
    return fail(405, "Brug GET eller POST.");
  }
  const id = decodeURIComponent(path.slice("/api/claude/jobs/".length));
  if (req.method === "GET") {
    const job = await readJob(store, id);
    return job ? json(200, { job }) : fail(410, "Jobbet findes ikke længere.");
  }
  if (req.method === "PUT") return await updateJob(req, store, who, id);
  return fail(405, "Brug GET eller PUT.");
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
      if (method === "PUT") return await putData(req, context, store, who);
      return fail(405, "Brug GET eller PUT.");
    }
    if (path === "/api/history" && method === "GET") return await history(store);
    const restoreMatch = path.match(/^\/api\/history\/([^/]+)\/restore$/);
    if (restoreMatch && method === "POST") return await restore(store, decodeURIComponent(restoreMatch[1]), who);
    if (path === "/api/claude-key") {
      if (who !== "dig") return fail(401, "Kun du kan lave eller fjerne Claudes nøgle — log ind i appen.");
      return await claudeKey(req, store);
    }
    if (path === "/api/claude/jobs" || /^\/api\/claude\/jobs\/[^/]+$/.test(path)) return await claudeJobs(req, store, who, path);
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
