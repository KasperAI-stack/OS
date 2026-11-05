/* HeyOtto OS — alarmer: udsættelser, præferencer, push-enheder og den planlagte kørsel.

   Selve reglerne (hvad er i risiko?) står i dashboard/lib/forecast.mjs og deles med appen.
   Her ligger det, der kun giver mening på serveren:

     alerts/state   { snoozed: { key: "ÅÅÅÅ-MM-DD" }, prefs: { daily, instant }, sent: { key: iso }, lastDaily }
     push/vapid     { publicKey, privateKey (krypteret) } — laves første gang, intet at sætte op
     push/subs      [{ endpoint, keys, label, tz, createdAt }] — én pr. enhed med notifikationer slået til

   Push sendes med Web Push (VAPID). Nøglerne laves af HeyOtto OS selv og ligger i lageret,
   så en ny installation virker uden miljøvariabler. Afsenderen (VAPID "subject") er sitets
   egen adresse. */

import webpush from "web-push";
import { alerts as computeAlerts, activeAlerts, localIso } from "../../dashboard/lib/forecast.mjs";
import { decrypt, encrypt, readSnapshot, serverSecret } from "./google.mts";

type Store = {
  get(key: string, opts?: any): Promise<any>;
  set(key: string, value: string, opts?: any): Promise<any>;
  setJSON(key: string, value: unknown): Promise<any>;
  delete(key: string): Promise<any>;
};
export type Sub = { endpoint: string; keys: { p256dh: string; auth: string }; label: string; tz: string; createdAt: string };
export type State = { snoozed: Record<string, string>; prefs: { daily: boolean; instant: boolean }; sent: Record<string, string>; lastDaily: string };
export type Message = { title: string; body: string; url: string; tag: string };

const STATE_KEY = "alerts/state";
const VAPID_KEY = "push/vapid";
const SUBS_KEY = "push/subs";
const MAX_SUBS = 20;
const DEFAULT_TZ = "Europe/Copenhagen";
export const DAY_FROM = 7, DAY_TO = 19;      // notifikationer kun i dette tidsrum (lokal tid)

export async function readState(store: Store): Promise<State> {
  const s = (await store.get(STATE_KEY, { type: "json" })) || {};
  return {
    snoozed: s.snoozed && typeof s.snoozed === "object" ? s.snoozed : {},
    prefs: { daily: s.prefs?.daily !== false, instant: s.prefs?.instant !== false },
    sent: s.sent && typeof s.sent === "object" ? s.sent : {},
    lastDaily: typeof s.lastDaily === "string" ? s.lastDaily : ""
  };
}
export const saveState = (store: Store, s: State) => store.setJSON(STATE_KEY, s);

export async function snooze(store: Store, key: string, until: string | null) {
  const s = await readState(store);
  if (until) s.snoozed[key] = until; else delete s.snoozed[key];
  // Ryd gamle udsættelser, så listen ikke vokser for evigt
  const today = new Date().toISOString().slice(0, 10);
  for (const [k, v] of Object.entries(s.snoozed)) if (v < today) delete s.snoozed[k];
  await saveState(store, s);
  return s;
}

export async function setPrefs(store: Store, prefs: { daily?: unknown; instant?: unknown }) {
  const s = await readState(store);
  if (typeof prefs.daily === "boolean") s.prefs.daily = prefs.daily;
  if (typeof prefs.instant === "boolean") s.prefs.instant = prefs.instant;
  await saveState(store, s);
  return s;
}

/* ---------- Push ---------- */

export async function vapid(store: Store) {
  const secret = await serverSecret(store);
  const saved = await store.get(VAPID_KEY, { type: "json" });
  if (saved?.publicKey && saved?.privateKey) return { publicKey: String(saved.publicKey), privateKey: decrypt(secret, String(saved.privateKey)) };
  const k = webpush.generateVAPIDKeys();
  await store.setJSON(VAPID_KEY, { publicKey: k.publicKey, privateKey: encrypt(secret, k.privateKey) });
  return k;
}

export async function readSubs(store: Store): Promise<Sub[]> {
  const s = await store.get(SUBS_KEY, { type: "json" });
  return Array.isArray(s) ? s : [];
}

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

export async function subscribe(store: Store, body: any) {
  const sub = body?.subscription;
  const endpoint = clip(sub?.endpoint, 1000);
  if (!/^https:\/\//.test(endpoint) || typeof sub?.keys?.p256dh !== "string" || typeof sub?.keys?.auth !== "string") {
    throw new Error("Ugyldig abonnements-besked fra browseren.");
  }
  let tz = clip(body?.tz, 60);
  try { new Intl.DateTimeFormat("da-DK", { timeZone: tz }); } catch { tz = DEFAULT_TZ; }
  const entry: Sub = { endpoint, keys: { p256dh: clip(sub.keys.p256dh, 200), auth: clip(sub.keys.auth, 100) },
                       label: clip(body?.label, 60) || "Ukendt enhed", tz: tz || DEFAULT_TZ, createdAt: new Date().toISOString() };
  const list = [entry, ...(await readSubs(store)).filter((s) => s.endpoint !== endpoint)].slice(0, MAX_SUBS);
  await store.setJSON(SUBS_KEY, list);
  return list.length;
}

export async function unsubscribe(store: Store, endpoint: string) {
  const list = await readSubs(store);
  const left = list.filter((s) => s.endpoint !== endpoint);
  await store.setJSON(SUBS_KEY, left);
  return left.length;
}

export type Sender = (sub: Sub, payload: string, keys: { publicKey: string; privateKey: string }, subject: string) => Promise<void>;
export const webPushSender: Sender = async (sub, payload, keys, subject) => {
  await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, {
    TTL: 6 * 3600, urgency: "normal", vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey }
  });
};

// Sender til alle (eller én) enheder. Enheder, push-tjenesten siger er væk, fjernes.
export async function sendAll(store: Store, msgs: Message[], subject: string, send: Sender = webPushSender, only?: string) {
  if (!msgs.length) return { sent: 0, removed: 0 };
  const keys = await vapid(store);
  const subs = (await readSubs(store)).filter((s) => !only || s.endpoint === only);
  const gone = new Set<string>();
  let sent = 0;
  for (const sub of subs) {
    for (const m of msgs) {
      try {
        await send(sub, JSON.stringify(m), keys, subject);
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) { gone.add(sub.endpoint); break; }
        console.error("push fejlede (" + sub.label + "):", e?.statusCode || "", e?.body || e?.message || e);
      }
    }
  }
  if (gone.size) await store.setJSON(SUBS_KEY, (await readSubs(store)).filter((s) => !gone.has(s.endpoint)));
  return { sent, removed: gone.size };
}

/* ---------- Den planlagte kørsel ----------
   Hver time. Kl. 7 på hverdage: et morgenoverblik, hvis der er noget at sige.
   Ellers mellem 7 og 19: én besked, når der er kommet nye røde alarmer siden sidst.
   Udsatte alarmer sendes ikke. Uden enheder sker der intet. */

const plural = (n: number, one: string, many: string) => n + " " + (n === 1 ? one : many);

export async function run(store: Store, subject: string, now = new Date(), send: Sender = webPushSender) {
  const subs = await readSubs(store);
  if (!subs.length) return { skipped: "ingen enheder" };
  const data = await store.get("data", { type: "json" });
  if (!data || !Array.isArray(data.tasks)) return { skipped: "ingen data" };

  // Regn i brugerens tidszone (fra den seneste enhed). Node følger TZ, når den sættes.
  process.env.TZ = subs[0].tz || DEFAULT_TZ;
  const local = new Date(now.getTime());
  const hour = local.getHours(), todayIso = localIso(local), weekday = local.getDay() !== 0 && local.getDay() !== 6;
  if (hour < DAY_FROM || hour >= DAY_TO) return { skipped: "uden for " + DAY_FROM + "–" + DAY_TO };

  const cal = await readSnapshot(store);
  const st = await readState(store);
  const list = activeAlerts(computeAlerts(data, cal, local), st.snoozed, todayIso);
  const reds = list.filter((a: any) => a.level === 3);
  const msgs: Message[] = [];

  if (st.prefs.daily && weekday && st.lastDaily !== todayIso) {
    st.lastDaily = todayIso;
    const yellows = list.filter((a: any) => a.level === 2).length;
    if (reds.length || yellows) {
      msgs.push({
        title: reds.length ? "Otto: " + plural(reds.length, "ting kræver", "ting kræver") + " din opmærksomhed" : "Otto: " + plural(yellows, "ting at holde øje med", "ting at holde øje med"),
        body: list.slice(0, 3).map((a: any) => a.title).join(" · ") + (list.length > 3 ? " · +" + (list.length - 3) : ""),
        url: "/#kapacitet", tag: "morgen"
      });
    }
    for (const a of reds) st.sent[a.key] = now.toISOString();
  } else if (st.prefs.instant) {
    const fresh = reds.filter((a: any) => !st.sent[a.key]);
    if (fresh.length === 1) msgs.push({ title: fresh[0].title, body: fresh[0].why, url: "/#kapacitet", tag: fresh[0].key });
    else if (fresh.length > 1) msgs.push({ title: "Otto: " + fresh.length + " nye alarmer", body: fresh.slice(0, 3).map((a: any) => a.title).join(" · "), url: "/#kapacitet", tag: "nye" });
    for (const a of fresh) st.sent[a.key] = now.toISOString();
  }

  // Glem alarmer, der ikke længere er aktuelle, så de kan sendes igen, hvis de kommer tilbage
  const live = new Set(list.map((a: any) => a.key));
  for (const k of Object.keys(st.sent)) if (!live.has(k)) delete st.sent[k];
  await saveState(store, st);
  const res = await sendAll(store, msgs, subject, send);
  return { alerts: list.length, red: reds.length, messages: msgs.length, ...res };
}
