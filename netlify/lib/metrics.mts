/* HeyOtto OS — dataudtrækket bag fanen Dashboard.

   Henter tal fra fire kilder og samler dem i ét øjebliksbillede:

     gsc   Google Search Console   klik, visninger, CTR, position + top-søgninger og -sider
     ga4   Google Analytics 4      sessioner, engagerede sessioner, key events + kanaler og landingssider
     gads  Google Ads              forbrug, klik, visninger, konverteringer + kampagner
     meta  Meta Ads                forbrug, visninger, linkklik, resultater + kampagner

   For hver kilde hentes en dagsserie på 180 dage (så både 90 dage og de 90 før
   kan sammenlignes) og toplister for 7, 28 og 90 dage. Dashboardet regner selv
   perioder og ændringer ud fra dagsserien.

   Nøglerne er miljøvariabler i Netlify med samme navne som i den lokale .env i
   marketing-repoet, så værdierne kan kopieres direkte. Mangler en kilde sine
   nøgler, står den som "mangler" med listen over, hvad der skal sættes. Fejler
   en kilde, beholdes dens seneste gode tal, og fejlen vises ved siden af.

   Kun læsning. Intet her ændrer noget i kontiene.

   Bruges af netlify/functions/api.mts (GET /api/metrics, POST /api/metrics/refresh)
   og netlify/functions/metrics-sync.mts (hver 6. time). Modulet kender ikke
   Netlify, så det kan også køres direkte med node. */

export type Env = (key: string) => string | undefined;
export type SourceKey = "gsc" | "ga4" | "gads" | "meta";
export type Day = { date: string } & Record<string, number | string>;
export type Row = Record<string, string | number>;
export type Period = "7" | "28" | "90";
export type Source = {
  key: SourceKey;
  name: string;
  status: "ok" | "fejl" | "mangler";
  account: string;
  currency: string;
  end: string;                                   // sidste dag i dagsserien (ÅÅÅÅ-MM-DD)
  daily: Day[];
  tables: Record<string, Partial<Record<Period, Row[]>>>;
  missing: string[];
  error: string;
  fetchedAt: string;                             // seneste forsøg
  okAt: string;                                  // seneste vellykkede hentning
};
export type Snapshot = { fetchedAt: string; sources: Record<SourceKey, Source> };

export const SOURCE_KEYS: SourceKey[] = ["gsc", "ga4", "gads", "meta"];
export const METRICS_KEY = "metrics/snapshot";   // nøglen i Netlify Blobs
const PERIODS: Period[] = ["7", "28", "90"];
const SERIES_DAYS = 180;
const TOP = 10;
const TIMEOUT_MS = 8000;                         // Netlify giver funktionen 10 sekunder

const GOOGLE_CLIENT = ["GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET"];

/* ---------- Datoer ----------
   Kontiene kører i dansk tid, så "i går" er i går i København. */

function todayCph() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen" }).format(new Date());
}
function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const startOf = (end: string, days: number) => addDays(end, -(days - 1));

// Tomme dage findes ikke i svarene. De udfyldes med nul, så hver serie har præcis
// SERIES_DAYS dage, og dashboardet kan tælle sig frem uden at kigge på datoer.
function frame(end: string, keys: string[]) {
  const days = new Map<string, Day>();
  for (let i = SERIES_DAYS - 1; i >= 0; i--) {
    const date = addDays(end, -i);
    const day: Day = { date };
    for (const k of keys) day[k] = 0;
    days.set(date, day);
  }
  return days;
}
function add(days: Map<string, Day>, date: string, values: Record<string, number>) {
  const day = days.get(date);
  if (!day) return;
  for (const [k, v] of Object.entries(values)) day[k] = (Number(day[k]) || 0) + (Number.isFinite(v) ? v : 0);
}
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/* ---------- HTTP ---------- */

class SourceError extends Error {}

function errorText(body: any, text: string) {
  const e = body?.error;
  if (typeof e === "string") return e + (body.error_description ? ": " + body.error_description : "");
  // Google Ads gemmer den egentlige forklaring dybt i details
  const ads = e?.details?.[0]?.errors?.[0]?.message;
  if (ads) return ads;
  if (e?.message) return e.message;
  return text.slice(0, 200) || "intet svar";
}

async function call(url: string, init: RequestInit, label: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    throw new SourceError(e instanceof Error && e.name === "TimeoutError"
      ? `${label} svarede ikke inden for ${TIMEOUT_MS / 1000} sekunder.`
      : `Kunne ikke nå ${label}.`);
  }
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : {}; } catch { /* ikke JSON */ }
  if (!res.ok) throw new SourceError(`${label} svarede ${res.status}: ${errorText(body, text)}`);
  return body;
}

const postJson = (body: unknown, headers: Record<string, string>): RequestInit =>
  ({ method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) });

// Et refresh token pr. tjeneste, ligesom i den lokale .env (ga4.py, gsc.py, gads.py).
async function googleToken(env: Env, refreshKey: string, script: string) {
  const body = new URLSearchParams({
    client_id: env("GOOGLE_ADS_CLIENT_ID")!.trim(),
    client_secret: env("GOOGLE_ADS_CLIENT_SECRET")!.trim(),
    refresh_token: env(refreshKey)!.trim(),
    grant_type: "refresh_token"
  });
  try {
    const tok = await call("https://oauth2.googleapis.com/token",
      { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } }, "Google-login");
    return String(tok.access_token);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (/invalid_grant/.test(m)) {
      throw new SourceError(`Google afviste ${refreshKey}: tokenet er udløbet eller trukket tilbage. ` +
        `Kør "python scripts/${script} auth" i marketing-repoet, og kopiér det nye token til Netlify.`);
    }
    throw e;
  }
}

/* ---------- Google Search Console ---------- */

async function gsc(env: Env): Promise<Partial<Source>> {
  const site = (env("GSC_SITE") || "https://heyotto.dk/").trim();
  const token = await googleToken(env, "GSC_REFRESH_TOKEN", "gsc.py");
  // Search Console er 2-3 dage bagud. Seneste dag er derfor for tre dage siden.
  const end = addDays(todayCph(), -3);
  const url = "https://searchconsole.googleapis.com/webmasters/v3/sites/" + encodeURIComponent(site) + "/searchAnalytics/query";
  const query = (body: object) => call(url, postJson(body, { Authorization: "Bearer " + token }), "Search Console");

  const days = frame(end, ["clicks", "impressions", "posSum"]);
  const top = (dim: string, p: Period) =>
    query({ startDate: startOf(end, Number(p)), endDate: end, dimensions: [dim], rowLimit: TOP })
      .then((r) => (r.rows || []).map((x: any) => ({
        name: x.keys[0], clicks: x.clicks, impressions: x.impressions, ctr: round(x.ctr, 4), position: round(x.position, 1)
      })));

  const [series, ...lists] = await Promise.all([
    query({ startDate: startOf(end, SERIES_DAYS), endDate: end, dimensions: ["date"], rowLimit: 1000 }),
    ...PERIODS.map((p) => top("query", p)),
    ...PERIODS.map((p) => top("page", p))
  ]);
  // Position er et gennemsnit. Den vægtes med visninger, så perioder kan lægges sammen.
  for (const r of series.rows || []) add(days, r.keys[0], { clicks: r.clicks, impressions: r.impressions, posSum: r.position * r.impressions });

  const n = PERIODS.length;
  return {
    account: site.replace(/^sc-domain:/, "").replace(/^https?:\/\//, "").replace(/\/$/, ""),
    end, daily: [...days.values()],
    tables: {
      queries: Object.fromEntries(PERIODS.map((p, i) => [p, lists[i]])),
      pages: Object.fromEntries(PERIODS.map((p, i) => [p, lists[n + i]]))
    }
  };
}

/* ---------- Google Analytics 4 ---------- */

async function ga4(env: Env): Promise<Partial<Source>> {
  const raw = (env("GA4_PROPERTY") || "557401007").trim();
  const property = raw.startsWith("properties/") ? raw : "properties/" + raw;
  const token = await googleToken(env, "GA4_REFRESH_TOKEN", "ga4.py");
  const end = addDays(todayCph(), -1);
  const report = (body: object) => call(`https://analyticsdata.googleapis.com/v1beta/${property}:runReport`,
    postJson(body, { Authorization: "Bearer " + token }), "Google Analytics");

  const days = frame(end, ["sessions", "engagedSessions", "keyEvents"]);
  const top = (dim: string, p: Period) => report({
    dateRanges: [{ startDate: startOf(end, Number(p)), endDate: end }],
    dimensions: [{ name: dim }], metrics: [{ name: "sessions" }, { name: "keyEvents" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: TOP
  }).then((r) => (r.rows || []).map((x: any) => ({
    name: x.dimensionValues[0].value, sessions: Number(x.metricValues[0].value), keyEvents: Number(x.metricValues[1].value)
  })));

  const [series, meta, ...lists] = await Promise.all([
    report({
      dateRanges: [{ startDate: startOf(end, SERIES_DAYS), endDate: end }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }, { name: "engagedSessions" }, { name: "keyEvents" }],
      limit: 1000
    }),
    call(`https://analyticsadmin.googleapis.com/v1beta/${property}`, { headers: { Authorization: "Bearer " + token } }, "Google Analytics")
      .catch(() => null),
    ...PERIODS.map((p) => top("sessionDefaultChannelGroup", p)),
    ...PERIODS.map((p) => top("landingPage", p))
  ]);
  for (const r of series.rows || []) {
    const d = r.dimensionValues[0].value;                                     // "20261005"
    const [s, e, k] = r.metricValues.map((v: any) => Number(v.value));
    add(days, `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, { sessions: s, engagedSessions: e, keyEvents: k });
  }

  const n = PERIODS.length;
  return {
    account: meta?.displayName || property, currency: meta?.currencyCode || "",
    end, daily: [...days.values()],
    tables: {
      channels: Object.fromEntries(PERIODS.map((p, i) => [p, lists[i]])),
      landingPages: Object.fromEntries(PERIODS.map((p, i) => [p, lists[n + i]]))
    }
  };
}

/* ---------- Google Ads ---------- */

const digits = (s: string | undefined) => (s || "").replace(/\D/g, "");

async function gads(env: Env): Promise<Partial<Source>> {
  const customer = digits(env("GOOGLE_ADS_CUSTOMER_ID")) || "3826858823";
  // Kontoen ligger under HeyOtto-MCC'en. Står login-ID'et tomt i Netlify, bruges den.
  const login = env("GOOGLE_ADS_LOGIN_CUSTOMER_ID") === undefined ? "7601106978" : digits(env("GOOGLE_ADS_LOGIN_CUSTOMER_ID"));
  const version = (env("GOOGLE_ADS_API_VERSION") || "v25").trim();
  const token = await googleToken(env, "GOOGLE_ADS_REFRESH_TOKEN", "gads.py");
  const headers: Record<string, string> = { Authorization: "Bearer " + token, "developer-token": env("GOOGLE_ADS_DEVELOPER_TOKEN")!.trim() };
  if (login) headers["login-customer-id"] = login;
  const end = addDays(todayCph(), -1);

  const search = async (query: string) => {
    const rows: any[] = [];
    let pageToken = "";
    do {
      const r = await call(`https://googleads.googleapis.com/${version}/customers/${customer}/googleAds:search`,
        postJson(pageToken ? { query, pageToken } : { query }, headers), "Google Ads");
      rows.push(...(r.results || []));
      pageToken = r.nextPageToken || "";
    } while (pageToken);
    return rows;
  };
  const between = (start: string) => `segments.date BETWEEN '${start}' AND '${end}'`;
  const money = (micros: unknown) => round(Number(micros || 0) / 1e6);

  const days = frame(end, ["cost", "clicks", "impressions", "conversions", "value"]);
  const top = (p: Period) => search(
    "SELECT campaign.name, campaign.status, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions " +
    `FROM campaign WHERE ${between(startOf(end, Number(p)))} AND metrics.impressions > 0 ` +
    `ORDER BY metrics.cost_micros DESC LIMIT ${TOP}`
  ).then((rows) => rows.map((x) => ({
    name: x.campaign?.name || "", status: x.campaign?.status || "", cost: money(x.metrics?.costMicros),
    clicks: Number(x.metrics?.clicks || 0), impressions: Number(x.metrics?.impressions || 0),
    conversions: round(Number(x.metrics?.conversions || 0))
  })));

  const [info, series, ...lists] = await Promise.all([
    search("SELECT customer.descriptive_name, customer.currency_code FROM customer LIMIT 1"),
    search("SELECT segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, " +
           `metrics.conversions_value FROM customer WHERE ${between(startOf(end, SERIES_DAYS))}`),
    ...PERIODS.map(top)
  ]);
  for (const r of series) {
    const m = r.metrics || {};
    add(days, r.segments?.date, {
      cost: Number(m.costMicros || 0) / 1e6, clicks: Number(m.clicks || 0), impressions: Number(m.impressions || 0),
      conversions: Number(m.conversions || 0), value: Number(m.conversionsValue || 0)
    });
  }
  for (const d of days.values()) for (const k of ["cost", "conversions", "value"]) d[k] = round(Number(d[k]));

  return {
    account: info[0]?.customer?.descriptiveName || customer, currency: info[0]?.customer?.currencyCode || "",
    end, daily: [...days.values()],
    tables: { campaigns: Object.fromEntries(PERIODS.map((p, i) => [p, lists[i]])) }
  };
}

/* ---------- Meta Ads ---------- */

// "Resultater" er de samlede handlinger, Meta selv lægger sammen. Underarterne
// (fx offsite_conversion.fb_pixel_lead) tælles ikke med, ellers tælles dobbelt.
const RESULT_TYPES = new Set(["lead", "purchase", "complete_registration"]);
const results = (actions: any) =>
  (Array.isArray(actions) ? actions : []).reduce((s: number, a: any) => s + (RESULT_TYPES.has(a?.action_type) ? Number(a.value) || 0 : 0), 0);

async function meta(env: Env): Promise<Partial<Source>> {
  const accounts = (env("META_AD_ACCOUNTS") || "1834773060878221").split(/[\s,]+/).map(digits).filter(Boolean);
  const version = (env("META_API_VERSION") || "v24.0").trim();
  const headers = { Authorization: "Bearer " + env("META_ACCESS_TOKEN")!.trim() };
  const end = addDays(todayCph(), -1);

  const graph = async (path: string, params: Record<string, string>) => {
    const rows: any[] = [];
    let url: string | null = `https://graph.facebook.com/${version}/${path}?` + new URLSearchParams(params);
    while (url) {
      const r = await call(url, { headers }, "Meta");
      if (!Array.isArray(r.data)) return r;                  // et enkelt objekt, ikke en liste
      rows.push(...r.data);
      url = r.paging?.next || null;
    }
    return rows;
  };
  const range = (start: string) => JSON.stringify({ since: start, until: end });

  const days = frame(end, ["spend", "impressions", "clicks", "results"]);
  const perAccount = await Promise.all(accounts.map(async (id) => {
    const [info, series, ...lists] = await Promise.all([
      graph("act_" + id, { fields: "name,currency" }),
      graph(`act_${id}/insights`, {
        level: "account", time_increment: "1", time_range: range(startOf(end, SERIES_DAYS)),
        fields: "spend,impressions,inline_link_clicks,actions", limit: "500"
      }),
      ...PERIODS.map((p) => graph(`act_${id}/insights`, {
        level: "campaign", time_range: range(startOf(end, Number(p))),
        fields: "campaign_name,spend,impressions,inline_link_clicks,actions", sort: "spend_descending", limit: String(TOP)
      }))
    ]);
    return { info, series, lists };
  }));

  const tables: Partial<Record<Period, Row[]>> = {};
  PERIODS.forEach((p, i) => {
    const rows = perAccount.flatMap((a) => (a.lists[i] as any[]).map((x) => ({
      name: x.campaign_name || "", account: accounts.length > 1 ? a.info?.name || "" : "",
      spend: round(Number(x.spend || 0)), impressions: Number(x.impressions || 0),
      clicks: Number(x.inline_link_clicks || 0), results: results(x.actions)
    })));
    tables[p] = rows.sort((a, b) => b.spend - a.spend).slice(0, TOP);
  });
  for (const a of perAccount) {
    for (const r of a.series as any[]) {
      add(days, r.date_start, {
        spend: Number(r.spend || 0), impressions: Number(r.impressions || 0),
        clicks: Number(r.inline_link_clicks || 0), results: results(r.actions)
      });
    }
  }
  for (const d of days.values()) d.spend = round(Number(d.spend));

  const currencies = [...new Set(perAccount.map((a) => a.info?.currency).filter(Boolean))];
  if (currencies.length > 1) {
    throw new SourceError(`Meta-kontiene bruger forskellige valutaer (${currencies.join(", ")}), så de kan ikke lægges sammen. ` +
      "Vælg konti med samme valuta i META_AD_ACCOUNTS.");
  }
  return {
    account: perAccount.map((a) => a.info?.name || "").filter(Boolean).join(" + ") || accounts.join(", "),
    currency: currencies[0] || "", end, daily: [...days.values()], tables: { campaigns: tables }
  };
}

/* ---------- Samlet ---------- */

type Spec = { name: string; needs: string[]; run: (env: Env) => Promise<Partial<Source>> };

const SPECS: Record<SourceKey, Spec> = {
  gsc:  { name: "Google Search Console", needs: [...GOOGLE_CLIENT, "GSC_REFRESH_TOKEN"], run: gsc },
  ga4:  { name: "Google Analytics 4",    needs: [...GOOGLE_CLIENT, "GA4_REFRESH_TOKEN"], run: ga4 },
  gads: { name: "Google Ads",            needs: [...GOOGLE_CLIENT, "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_DEVELOPER_TOKEN"], run: gads },
  meta: { name: "Meta Ads",              needs: ["META_ACCESS_TOKEN"], run: meta }
};

export function missingKeys(env: Env, key: SourceKey) {
  return SPECS[key].needs.filter((k) => !(env(k) || "").trim());
}

// Henter alle kilder side om side. En kilde, der fejler, beholder sine seneste
// gode tal fra `previous`, så en midlertidig fejl ikke tømmer dashboardet.
export async function collect(env: Env, previous?: Snapshot | null): Promise<Snapshot> {
  const now = new Date().toISOString();
  const list = await Promise.all(SOURCE_KEYS.map(async (key): Promise<Source> => {
    const spec = SPECS[key];
    const base: Source = {
      key, name: spec.name, status: "ok", account: "", currency: "", end: "", daily: [], tables: {},
      missing: [], error: "", fetchedAt: now, okAt: ""
    };
    const missing = missingKeys(env, key);
    if (missing.length) return { ...base, status: "mangler", missing };
    try {
      return { ...base, ...(await spec.run(env)), status: "ok", okAt: now };
    } catch (e) {
      if (!(e instanceof SourceError)) console.error(`udtræk fra ${key} fejlede:`, e);
      const prev = previous?.sources?.[key];
      const kept = prev && prev.okAt ? prev : base;
      return { ...kept, key, name: spec.name, status: "fejl", missing: [], fetchedAt: now,
               error: e instanceof Error ? e.message : String(e) };
    }
  }));
  return { fetchedAt: now, sources: Object.fromEntries(list.map((s) => [s.key, s])) as Record<SourceKey, Source> };
}
