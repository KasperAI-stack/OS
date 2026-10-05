/* HeyOtto OS — datafilen på Netlify.

   Efterligner dashboard/server.js, så dashboardet virker uændret på nettet:
     GET  /marketing-os-data.js   datafilen, som dashboardet indlæser med <script src>
     POST /save                   gem — samme sikkerhedsnet som den lokale server
     GET  /historik               liste over de seneste gemte versioner
     GET  /historik/:id           én gemt version som fil

   Data ligger i Netlify Blobs. Der er intet login her: projektet er privat på
   Netlify, så ingen forespørgsel når hertil uden at være logget ind. */

import { getDeployStore, getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";

const DATA_KEY = "data";
const HISTORY = "historik/";
const KEEP = 60;                 // så mange gemte versioner beholdes
const MAX_CHARS = 4_000_000;     // langt over en rigtig datafil, under Netlifys grænse

// Tom start, indtil den første datafil er hentet ind. Samme form som skabelonen.
const EMPTY = [
  "/* HeyOtto OS — endnu ingen data. Brug »Hent datafil ind« nederst i sidebaren. */",
  "var DATA = {",
  "  meta: { updated: \"\", note: \"\" },",
  "  kapacitet: { contract:37, meetings:6, admin:5, other:2, ceiling:85, adhoc:6 },",
  "  uger: [],",
  "  epics: {},",
  "  projects: [],",
  "  sprints: [],",
  "  tasks: []",
  "};",
  ""
].join("\n");

// Kun produktion rører de rigtige data. Deploy Previews og branch-deploys får
// hver deres eget lager, så en test aldrig kan overskrive noget.
function dataStore(context: Context) {
  const options = { name: "heyotto-os", consistency: "strong" as const };
  return context.deploy?.context === "production" ? getStore(options) : getDeployStore(options);
}

function text(status: number, body: string, headers: Record<string, string> = {}) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// "2026-10-05T12-03-07-123Z" → Date. Nøglerne har ingen koloner, så de er sikre i en URL.
function stampToDate(id: string) {
  const m = id.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/);
  return m ? new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`) : null;
}

// Versionen gemmes som metadata sammen med data, så de altid følges ad.
// Den er tidsstemplet for gemmet — samme id som versionen i historikken.
function revOf(found: { metadata?: Record<string, unknown> } | null) {
  return found && typeof found.metadata?.rev === "string" ? found.metadata.rev : "";
}

async function getData(context: Context) {
  const store = dataStore(context);
  const found = await store.getWithMetadata(DATA_KEY);
  const body = found && typeof found.data === "string" ? found.data : EMPTY;
  const rev = revOf(found);
  // DATA_REV fortæller dashboardet, hvilken version det har indlæst. Det sender
  // den med, når det gemmer, så to enheder ikke overskriver hinanden i stilhed.
  return new Response(body.replace(/\s*$/, "\n") + "var DATA_REV = " + JSON.stringify(rev) + ";\n", {
    status: 200,
    headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" }
  });
}

async function save(req: Request, context: Context) {
  const body = await req.text();
  if (body.length > MAX_CHARS) return text(413, "Filen er for stor til at være en datafil — intet gemt.");

  // Samme sikkerhedsnet som server.js: skriv kun, hvis det faktisk ligner datafilen.
  if (!/var\s+DATA\s*=\s*\{/.test(body) || !/tasks\s*:\s*\[/.test(body)) {
    return text(400, "Indholdet ligner ikke datafilen — intet gemt.");
  }

  const store = dataStore(context);
  const sentRev = req.headers.get("X-Data-Rev");
  if (sentRev !== null && sentRev !== revOf(await store.getMetadata(DATA_KEY))) {
    return text(409, "Data er ændret et andet sted, siden du åbnede siden — fx på telefonen. " +
                     "Intet er gemt. Genindlæs for at se de nye data; dine ugemte ændringer kan gendannes bagefter.");
  }

  const id = new Date().toISOString().replace(/[:.]/g, "-");
  await store.set(DATA_KEY, body, { metadata: { rev: id } });

  // Hver gemt version lægges også i historikken — det er sikkerhedsnettet, der
  // før var OneDrives versionshistorik. De ældste ryddes, så der højst er KEEP.
  await store.set(HISTORY + id, body);
  const { blobs } = await store.list({ prefix: HISTORY });
  const keys = blobs.map((b) => b.key).sort();
  for (const key of keys.slice(0, Math.max(0, keys.length - KEEP))) await store.delete(key);

  return text(200, "ok", { "X-Data-Rev": id });
}

async function historyList(context: Context) {
  const store = dataStore(context);
  const { blobs } = await store.list({ prefix: HISTORY });
  const ids = blobs.map((b) => b.key.slice(HISTORY.length)).filter((id) => stampToDate(id)).sort().reverse();

  const fmt = new Intl.DateTimeFormat("da-DK", { dateStyle: "long", timeStyle: "medium", timeZone: "Europe/Copenhagen" });
  const rows = ids.length
    ? ids.map((id, i) =>
        `<li><a href="/historik/${esc(id)}">${esc(fmt.format(stampToDate(id) as Date))}</a>` +
        (i === 0 ? ' <span class="now">nuværende</span>' : "") + "</li>").join("")
    : "<li class=\"none\">Ingen gemte versioner endnu. Den første kommer, når du trykker Gem.</li>";

  const html = `<!doctype html>
<html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Historik — HeyOtto OS</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: light dark; --bg: #FFFFFF; --ink: #0F0E13; --muted: #5E5A6B; --line: #E4E1EC; --accent: #7C3AED; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0F0E13; --ink: #F4F2F8; --muted: #A7A3B2; --line: #2B2932; --accent: #F472B6; } }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 "Geist", "Helvetica Neue", Arial, sans-serif; }
  main { max-width: 40rem; margin: 0 auto; padding: 40px 18px 80px; }
  h1 { font-size: 30px; font-weight: 600; letter-spacing: -0.03em; margin: 0 0 8px; }
  p { color: var(--muted); margin: 0 0 24px; }
  ul { list-style: none; padding: 0; margin: 0; border-top: 1px solid var(--line); }
  li { padding: 12px 0; border-bottom: 1px solid var(--line); }
  a { color: var(--ink); font-weight: 500; text-underline-offset: 3px; }
  a:hover { color: var(--accent); }
  .now { font-size: 12px; color: var(--muted); margin-left: 8px; }
  .none { color: var(--muted); }
  .back { display: inline-block; margin-bottom: 28px; font-size: 14px; }
</style></head>
<body><main>
<a class="back" href="/">← Tilbage til dashboardet</a>
<h1>Historik</h1>
<p>De seneste ${KEEP} gemte versioner. Hent en version ned, og vælg den med »Hent datafil ind« nederst i dashboardets sidebar for at gå tilbage til den.</p>
<ul>${rows}</ul>
</main></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

async function historyItem(id: string, context: Context) {
  if (!stampToDate(id)) return text(404, "Den version findes ikke.");
  const body = await dataStore(context).get(HISTORY + id);
  if (typeof body !== "string") return text(404, "Den version findes ikke — den kan være ryddet væk.");
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Content-Disposition": `attachment; filename="marketing-os-data-${id}.js"`,
      "Cache-Control": "no-store"
    }
  });
}

export default async (req: Request, context: Context) => {
  const path = new URL(req.url).pathname.replace(/\/+$/, "") || "/";
  try {
    if (path === "/save") return req.method === "POST" ? await save(req, context) : text(405, "Brug POST.");
    if (req.method !== "GET" && req.method !== "HEAD") return text(405, "Kun GET her.");
    if (path === "/marketing-os-data.js") return await getData(context);
    if (path === "/historik") return await historyList(context);
    if (path.startsWith("/historik/")) return await historyItem(decodeURIComponent(path.slice("/historik/".length)), context);
    return text(404, "ikke fundet");
  } catch (e) {
    console.error("data-funktionen fejlede:", e);
    return text(500, "Serverfejl: " + (e instanceof Error ? e.message : String(e)));
  }
};

export const config: Config = {
  path: ["/marketing-os-data.js", "/save", "/historik", "/historik/:id"]
};
