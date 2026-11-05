/* HeyOtto OS — Google-forbindelsen: login hos Google (OAuth), konti og kalendersynk.

   Intet her er bundet til en bestemt person. OS'et kan forbinde én eller flere
   Google-konti, og en anden person kan sætte sit eget HeyOtto OS op med sin egen
   OAuth-klient (GOOGLE_CLIENT_ID og GOOGLE_CLIENT_SECRET i Netlify). Fremgangsmåden
   står i dashboard/README.md under "Google: kalender og mail".

   Lageret (Netlify Blobs):
     google/accounts     [{ id, email, scopes, refresh (krypteret), calendars, connectedAt, lastSync, error }]
     google/state/<n>    engangsnøgler til login-flowet (10 minutter)
     calendar/snapshot   { fetchedAt, from, to, accounts, events } — det, appen og Claude læser

   Kun læsning: HeyOtto OS kan aldrig oprette, ændre eller svare på noget i kalenderen.
   Refresh-tokens krypteres med AES-256-GCM og forlader aldrig serveren. */

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type Store = {
  get(key: string, opts?: any): Promise<any>;
  set(key: string, value: string, opts?: any): Promise<any>;
  setJSON(key: string, value: unknown): Promise<any>;
  delete(key: string): Promise<any>;
};
type Env = (k: string) => string | undefined;

export const ACCOUNTS_KEY = "google/accounts";
export const CALENDAR_KEY = "calendar/snapshot";
const STATE = "google/state/";
const SECRET_KEY = "auth/secret";
const STATE_MS = 10 * 60_000;
const FETCH_MS = 7000;                  // Netlify giver funktionen 10 sekunder (planlagte: 30)
const PAST_DAYS = 7;
const FUTURE_DAYS = 84;                 // 12 uger frem: kalendervisning og prognose
export const REFRESH_GAP_MS = 60_000;   // højst én manuel synk i minuttet

// Hvad man kan bede om. "calendar" bruges nu (M4); "gmail" tilføjes i M8 som et ekstra
// samtykke på den samme konto (include_granted_scopes), så man ikke skal forbinde forfra.
export const SCOPES: Record<string, string> = {
  calendar: "https://www.googleapis.com/auth/calendar.readonly",
  gmail: "https://www.googleapis.com/auth/gmail.readonly"
};
const BASE_SCOPES = ["openid", "email"];

export type Calendar = { id: string; name: string; primary: boolean; included: boolean; color: string };
export type Account = {
  id: string; email: string; scopes: string[]; refresh: string; calendars: Calendar[];
  connectedAt: string; lastSync: string; error: string;
};
export type CalEvent = {
  id: string; account: string; calendarId: string; title: string;
  start: string; end: string; allDay: boolean;
  type: string; busy: boolean; response: string; attendees: number;
  meetUrl: string; htmlLink: string;
};
export type Snapshot = {
  fetchedAt: string; from: string; to: string;
  accounts: { id: string; email: string; ok: boolean; error: string; events: number }[];
  events: CalEvent[];
};

export class GoogleError extends Error {}

/* ---------- Opsætning ---------- */

export function client(env: Env) {
  const id = (env("GOOGLE_CLIENT_ID") || "").trim();
  const secret = (env("GOOGLE_CLIENT_SECRET") || "").trim();
  return id && secret ? { id, secret } : null;
}

export function missingEnv(env: Env) {
  return ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"].filter((k) => !(env(k) || "").trim());
}

export const redirectUri = (origin: string) => origin.replace(/\/+$/, "") + "/api/google/callback";

/* ---------- Hemmelighed og kryptering ---------- */

// Samme tilfældige hemmelighed, som sessionerne bruger. Laves første gang.
export async function serverSecret(store: Store): Promise<string> {
  let secret = await store.get(SECRET_KEY);
  if (typeof secret !== "string" || !secret) {
    await store.set(SECRET_KEY, randomBytes(32).toString("hex"));
    secret = await store.get(SECRET_KEY);
  }
  return String(secret);
}

const keyFrom = (secret: string, purpose: string) => createHmac("sha256", secret).update(purpose).digest();

export function encrypt(secret: string, plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyFrom(secret, "google-token-v1"), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

export function decrypt(secret: string, sealed: string) {
  const [v, iv, tag, body] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !body) throw new GoogleError("Tokenet kan ikke læses.");
  const d = createDecipheriv("aes-256-gcm", keyFrom(secret, "google-token-v1"), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
}

/* ---------- Login-flowet ----------
   1. connect: kun for en logget ind bruger. Laver en signeret engangs-state og sender
      browseren til Google.
   2. callback: Google sender browseren tilbage. Session-cookien følger ikke med her
      (SameSite=Strict ved et kald fra et andet site), så det er den signerede og
      engangsbrugte state, der beviser, at flowet blev startet inde fra appen. */

function sign(secret: string, payload: string) {
  return createHmac("sha256", keyFrom(secret, "google-state-v1")).update(payload).digest("base64url");
}

export async function startUrl(store: Store, env: Env, origin: string, wanted: string[]) {
  const c = client(env);
  if (!c) throw new GoogleError("Google er ikke sat op: " + missingEnv(env).join(" og ") + " mangler i Netlify.");
  const scopes = wanted.filter((s) => SCOPES[s]);
  if (!scopes.length) throw new GoogleError("Vælg mindst én ting at forbinde (kalender).");
  const nonce = randomBytes(16).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ n: nonce, t: Date.now(), s: scopes })).toString("base64url");
  const secret = await serverSecret(store);
  await store.setJSON(STATE + nonce, { t: Date.now() });
  const q = new URLSearchParams({
    client_id: c.id,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: [...BASE_SCOPES, ...scopes.map((s) => SCOPES[s])].join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent select_account",  // altid et refresh-token, og man vælger selv kontoen
    state: payload + "." + sign(secret, payload)
  });
  return "https://accounts.google.com/o/oauth2/v2/auth?" + q;
}

async function checkState(store: Store, state: string) {
  const [payload, mac] = String(state || "").split(".");
  if (!payload || !mac) throw new GoogleError("Login-svaret fra Google mangler sin kontrolkode. Prøv igen fra Indstillinger.");
  const secret = await serverSecret(store);
  const want = sign(secret, payload);
  const a = createHash("sha256").update(want).digest(), b = createHash("sha256").update(mac).digest();
  if (!timingSafeEqual(a, b)) throw new GoogleError("Login-svaret fra Google kunne ikke godkendes. Prøv igen fra Indstillinger.");
  let p: { n: string; t: number; s: string[] };
  try { p = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { throw new GoogleError("Ugyldigt login-svar."); }
  if (Date.now() - p.t > STATE_MS) throw new GoogleError("Login tog for lang tid (over 10 minutter). Prøv igen.");
  const saved = await store.get(STATE + p.n, { type: "json" });
  if (!saved) throw new GoogleError("Login-svaret er allerede brugt. Prøv igen fra Indstillinger.");
  await store.delete(STATE + p.n);
  return { secret, scopes: p.s };
}

async function googleJson(url: string, init: RequestInit = {}) {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_MS) });
  } catch (e) {
    throw new GoogleError(e instanceof Error && e.name === "TimeoutError" ? "Google svarede ikke i tide." : "Kunne ikke nå Google.");
  }
  const body: any = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.error_description || body?.error?.message || (typeof body?.error === "string" ? body.error : "") || ("fejl " + res.status);
    const err = new GoogleError(explain(res.status, String(msg)));
    (err as any).status = res.status;
    (err as any).code = typeof body?.error === "string" ? body.error : "";
    throw err;
  }
  return body;
}

function explain(status: number, msg: string) {
  if (/invalid_grant/i.test(msg) || /expired or revoked/i.test(msg)) {
    return "Adgangen er udløbet eller trukket tilbage hos Google. Forbind kontoen igen. (Står OAuth-klienten som \"Testing\" i Google Cloud, udløber adgangen efter 7 dage — sæt den til \"In production\".)";
  }
  if (/redirect_uri_mismatch/i.test(msg)) return "Google kender ikke denne adresse som redirect-URI. Tilføj den, der står i Indstillinger, til OAuth-klienten i Google Cloud.";
  if (status === 403 && /has not been used|disabled/i.test(msg)) return "Google Calendar API er ikke slået til i Google Cloud-projektet. Slå den til under APIs & Services → Library.";
  if (status === 401) return "Google afviste adgangen. Forbind kontoen igen.";
  return "Google: " + msg;
}

function emailFromIdToken(idToken: string) {
  try {
    const p = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
    return { sub: String(p.sub || ""), email: String(p.email || "") };
  } catch {
    return { sub: "", email: "" };
  }
}

export async function readAccounts(store: Store): Promise<Account[]> {
  const a = await store.get(ACCOUNTS_KEY, { type: "json" });
  return Array.isArray(a) ? a : [];
}
const saveAccounts = (store: Store, list: Account[]) => store.setJSON(ACCOUNTS_KEY, list);

// Byt koden fra Google til tokens, og gem (eller opdatér) kontoen. Returnerer e-mailen.
export async function finish(store: Store, env: Env, origin: string, code: string, state: string) {
  const c = client(env);
  if (!c) throw new GoogleError("Google er ikke sat op i Netlify.");
  const { secret, scopes } = await checkState(store, state);
  if (!code) throw new GoogleError("Google sendte ingen kode tilbage.");
  const tok = await googleJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: c.id, client_secret: c.secret, redirect_uri: redirectUri(origin), grant_type: "authorization_code" })
  });
  const granted = String(tok.scope || "").split(" ");
  const who = emailFromIdToken(String(tok.id_token || ""));
  if (!who.sub) throw new GoogleError("Google sendte ikke, hvilken konto der blev valgt.");
  const missing = scopes.filter((s) => !granted.includes(SCOPES[s]));
  if (missing.includes("calendar")) {
    throw new GoogleError("Du gav ikke adgang til kalenderen. Prøv igen, og sæt flueben ved kalenderen på Googles side.");
  }

  const list = await readAccounts(store);
  const old = list.find((a) => a.id === who.sub);
  // Google sender kun et nyt refresh-token ved samtykke. Får vi intet, beholdes det gamle.
  const refresh = tok.refresh_token ? encrypt(secret, String(tok.refresh_token)) : old?.refresh || "";
  if (!refresh) throw new GoogleError("Google sendte ingen varig adgang. Fjern HeyOtto OS under myaccount.google.com/permissions, og forbind igen.");
  const acc: Account = {
    id: who.sub, email: who.email, refresh,
    scopes: Object.keys(SCOPES).filter((s) => granted.includes(SCOPES[s]) || old?.scopes.includes(s)),
    calendars: old?.calendars || [],
    connectedAt: old?.connectedAt || new Date().toISOString(),
    lastSync: old?.lastSync || "", error: ""
  };
  await saveAccounts(store, [acc, ...list.filter((a) => a.id !== acc.id)]);
  return acc.email;
}

async function accessToken(env: Env, secret: string, acc: Account) {
  const c = client(env);
  if (!c) throw new GoogleError("Google er ikke sat op i Netlify.");
  const tok = await googleJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, refresh_token: decrypt(secret, acc.refresh), grant_type: "refresh_token" })
  });
  return String(tok.access_token);
}

export async function disconnect(store: Store, id: string) {
  const list = await readAccounts(store);
  const acc = list.find((a) => a.id === id);
  if (!acc) return false;
  try {
    const token = decrypt(await serverSecret(store), acc.refresh);
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }), signal: AbortSignal.timeout(FETCH_MS)
    });
  } catch (e) {
    console.error("tilbagekaldelse hos Google fejlede (kontoen fjernes alligevel):", e);
  }
  await saveAccounts(store, list.filter((a) => a.id !== id));
  const snap = await readSnapshot(store);
  if (snap) {
    snap.events = snap.events.filter((e) => e.account !== id);
    snap.accounts = snap.accounts.filter((a) => a.id !== id);
    await store.setJSON(CALENDAR_KEY, snap);
  }
  return true;
}

export async function setCalendars(store: Store, id: string, included: string[]) {
  const list = await readAccounts(store);
  const acc = list.find((a) => a.id === id);
  if (!acc) return null;
  acc.calendars = acc.calendars.map((c) => ({ ...c, included: included.includes(c.id) }));
  await saveAccounts(store, list);
  return acc;
}

// Det, appen må se om en konto. Aldrig tokenet.
export const publicAccount = (a: Account) => ({
  id: a.id, email: a.email, scopes: a.scopes, calendars: a.calendars,
  connectedAt: a.connectedAt, lastSync: a.lastSync, error: a.error
});

/* ---------- Kalendersynk ---------- */

export async function readSnapshot(store: Store): Promise<Snapshot | null> {
  return (await store.get(CALENDAR_KEY, { type: "json" })) as Snapshot | null;
}

// Hvilke kalendere tæller som standard: den primære og dem, du selv ejer og har vist i
// Google. Helligdage, fødselsdage og andres delte kalendere er fra, til du slår dem til.
function defaultIncluded(c: any) {
  if (c.primary) return true;
  if (/#(holiday|contacts|weeknum)@/.test(String(c.id))) return false;
  return c.accessRole === "owner" && c.selected === true;
}

async function syncCalendars(token: string, acc: Account) {
  const body = await googleJson("https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader&maxResults=250", {
    headers: { Authorization: "Bearer " + token }
  });
  const before = new Map(acc.calendars.map((c) => [c.id, c]));
  acc.calendars = (body.items || []).map((c: any) => ({
    id: String(c.id), name: String(c.summaryOverride || c.summary || c.id), primary: !!c.primary,
    included: before.has(String(c.id)) ? before.get(String(c.id))!.included : defaultIncluded(c),
    color: String(c.backgroundColor || "")
  }));
}

function mapEvent(acc: Account, calendarId: string, e: any): CalEvent | null {
  if (e.status === "cancelled") return null;
  const allDay = !!e.start?.date;
  const self = (e.attendees || []).find((a: any) => a.self);
  return {
    id: String(e.id), account: acc.id, calendarId,
    title: String(e.summary || "(uden titel)").slice(0, 200),
    start: String(allDay ? e.start.date : e.start?.dateTime || ""),
    end: String(allDay ? e.end?.date : e.end?.dateTime || ""),
    allDay,
    type: String(e.eventType || "default"),
    busy: e.transparency !== "transparent",
    response: self ? String(self.responseStatus || "needsAction") : "organizer",
    attendees: Array.isArray(e.attendees) ? e.attendees.length : 0,
    meetUrl: String(e.hangoutLink || ""),
    htmlLink: String(e.htmlLink || "")
  };
}

async function syncEvents(token: string, acc: Account, from: string, to: string) {
  const out: CalEvent[] = [];
  const fields = "items(id,status,summary,start,end,eventType,transparency,attendees(self,responseStatus),hangoutLink,htmlLink),nextPageToken";
  await Promise.all(acc.calendars.filter((c) => c.included).map(async (cal) => {
    let page = "";
    for (let i = 0; i < 5; i++) {
      const q = new URLSearchParams({ timeMin: from, timeMax: to, singleEvents: "true", orderBy: "startTime", maxResults: "2500", fields });
      if (page) q.set("pageToken", page);
      const body = await googleJson("https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(cal.id) + "/events?" + q, {
        headers: { Authorization: "Bearer " + token }
      });
      for (const e of body.items || []) { const m = mapEvent(acc, cal.id, e); if (m) out.push(m); }
      page = body.nextPageToken || "";
      if (!page) break;
    }
  }));
  return out;
}

// Henter alle forbundne konti. En konto, der fejler, beholder sine seneste hændelser,
// og fejlen står på kontoen, så den kan ses i Indstillinger.
export async function syncAll(store: Store, env: Env): Promise<Snapshot> {
  const secret = await serverSecret(store);
  const list = await readAccounts(store);
  const prev = await readSnapshot(store);
  const now = Date.now();
  const from = new Date(now - PAST_DAYS * 86_400_000).toISOString();
  const to = new Date(now + FUTURE_DAYS * 86_400_000).toISOString();
  const snap: Snapshot = { fetchedAt: new Date().toISOString(), from, to, accounts: [], events: [] };

  await Promise.all(list.filter((a) => a.scopes.includes("calendar")).map(async (acc) => {
    try {
      const token = await accessToken(env, secret, acc);
      await syncCalendars(token, acc);
      const events = await syncEvents(token, acc, from, to);
      snap.events.push(...events);
      acc.lastSync = snap.fetchedAt;
      acc.error = "";
      snap.accounts.push({ id: acc.id, email: acc.email, ok: true, error: "", events: events.length });
    } catch (e) {
      acc.error = e instanceof Error ? e.message : String(e);
      const kept = (prev?.events || []).filter((x) => x.account === acc.id);
      snap.events.push(...kept);
      snap.accounts.push({ id: acc.id, email: acc.email, ok: false, error: acc.error, events: kept.length });
      if (!(e instanceof GoogleError)) console.error("kalendersynk fejlede for en konto:", e);
    }
  }));

  snap.events.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  // Læs listen igen, så en konto, der blev forbundet eller fjernet under synken, ikke går tabt.
  const latest = await readAccounts(store);
  await saveAccounts(store, latest.map((a) => list.find((x) => x.id === a.id) ? { ...a, ...pick(list.find((x) => x.id === a.id)!) } : a));
  const keep = new Set(latest.map((a) => a.id));
  snap.events = snap.events.filter((e) => keep.has(e.account));
  snap.accounts = snap.accounts.filter((a) => keep.has(a.id));
  await store.setJSON(CALENDAR_KEY, snap);
  return snap;
}

const pick = (a: Account) => ({ calendars: a.calendars, lastSync: a.lastSync, error: a.error });
