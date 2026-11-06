# M10: Cloudflare-fundament: Tasks kører på Workers

**Status (2026-11-06):** koden er bygget og testet i Node (se "Bygget"). Deploy til testmiljøet mangler og kræver adgang til Cloudflare-kontoen. Første af seks iterationer (M10–M15), der giver HeyOtto Tasks samme opsætning som HeyOtto Studio: API med tokens, MCP, UI bag Cloudflare Access og en forbindelse til Studio. Grundlaget er Studios guide "byg et værktøj med samme opsætning som HeyOtto Studio" (M38–M42 i Studio).

> "min agent tool ligger nu online, sikkert med kode adgang - alt igennem cloudfare. det skal vi have til dig også"

## Mål

Den nuværende app og alle funktioner kører uændret på Cloudflare, på en testadresse med en kopi af data. Der er intet nyt for Kasper at se. Det er flytningen af motoren, så M11–M15 bygges på Cloudflare fra start.

Guiden beskriver tre måder at køre et værktøj på (a: samme pc som Studio, b: anden maskine med egen tunnel, c: hosting med egen HTTPS). **Tasks bruger c:** det kører på Cloudflare Workers med eget domæne. Der er ingen tunnel og ingen pc, der skal være tændt. Studio har en tunnel, fordi det kører på pc'en. Tasks har ikke brug for en.

## Analyse af den nuværende kode

Logikken er platformsuafhængig. Det, der er bundet til Netlify:

| I dag (Netlify) | Hvor | På Cloudflare |
|---|---|---|
| Statisk site `dashboard/` (`netlify.toml` → `publish`) | `netlify.toml` | Workers static assets (`assets.directory = "dashboard"`). Headers fra `netlify.toml` → `dashboard/_headers` |
| `api.mts` med `config.path = "/api/*"` (866 linjer) | `netlify/functions/api.mts` | Én Worker med **Hono**. Handlerne er allerede `Request → Response`, så det meste flyttes direkte |
| Netlify Blobs (`getStore`/`getDeployStore`, nøgler som `data`, `agent-runs/<id>`, `inbox/…`, `plans/…`) | alle funktioner og `netlify/lib/*` | **D1** med én tabel `docs(key, value, version, updated_at)` bag en lille `Store`-adapter med samme metoder (`get`, `setJSON`, `list`, `delete`). Libs ændres næsten ikke. D1 er konsistent (én primær), så fletningen og "ændret et andet sted" virker som før. Ikke KV: KV kan være op til et minut forsinket |
| Baggrundsfunktion `agent-background.mts` (op til 15 min, HMAC-signeret trigger) | `netlify/lib/agent/queue.mts` | **Cloudflare Queues**: `fire()` bliver `env.AGENT_QUEUE.send({ id })`, og consumeren kalder `execute()`. HMAC-triggeren udgår, fordi køen ikke kan kaldes udefra. Ventetid på Claude tæller ikke som CPU-tid |
| Planlagte funktioner: `agent-schedule` (*/15), `calendar-sync` (*/15), `alerts-sync` (hver time) | `netlify/functions/*` | **Cron Triggers** i `wrangler.jsonc` og én `scheduled()`-handler, der fordeler på cron-udtrykket |
| `Netlify.env.get(…)`: `HEYOTTO_PASSWORD`, `URL`, `CLAUDE_ROUTINE_URL/TOKEN`; `env(…)`: `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID/SECRET` | `api.mts`, `google.mts`, `runtime.mts` | Workers-bindings (`env`) og `wrangler secret put`. Ingen `.env` i repoet, ingen session læser hemmelighederne |
| Netlify AI Gateway som mulighed | `runtime.mts` | Kun `ANTHROPIC_API_KEY`. `@anthropic-ai/sdk` virker på Workers |
| Deploy Previews med eget tomt lager (`getDeployStore`) | `api.mts`, `agent-background.mts` | Miljøet `test` i `wrangler.jsonc` med sin egen D1-database. Test rører aldrig de rigtige data |
| `node:crypto` (`createHmac`, `createHash`, `randomBytes`, `createCipheriv` til Google-tokens) | `api.mts`, `google.mts` | `nodejs_compat`-flaget. Krypteringen af Google-tokens skal give samme resultat, så de flyttede tokens kan læses (testes med en kopi) |
| `web-push` (VAPID, push-notifikationer) | `netlify/lib/alerts.mts` | **Største risiko.** Biblioteket bruger Nodes `https` og ECDH. Virker det ikke under `nodejs_compat`, skrives VAPID og payload-kryptering med Web Crypto (ca. 150 linjer) |
| `process.env.TZ = settings.tz` før `forecast()` og alarmer | `agent-background.mts`, `agent-schedule.mts`, `alerts.mts` | **Virker ikke på Workers:** uret er altid UTC. Prognosen bruger `getDay()`/`getHours()` lokalt. Løses med en hjælper, der regner "nu i tidszonen" via `Intl.DateTimeFormat` og giver `forecast()` en dato i den zone. Fanges af en test, der kører prognosen kl. 23:30 dansk tid |

`dashboard/index.html` og `dashboard/lib/forecast.mjs` ændres ikke. Appen kalder stadig `/api/*` på sin egen adresse.

## Bygget (branchen `claude/m10-cloudflare`)

Samme kode kører på begge platforme, til M13 er live. Platformsforskellene står ét sted:

| Fil | Hvad |
|---|---|
| `netlify/lib/platform.mts` | Typen `Platform`: lager (Blobs-interfacet), miljø, IP, `waitUntil` og `startRun` (start en Otto-kørsel) |
| `netlify/lib/api.mts` | API'et som `handle(req, platform)`. Flyttet fra `netlify/functions/api.mts`, logikken er uændret |
| `netlify/lib/jobs.mts` | `runAgent`, `scheduleTick`, `calendarTick`, `alertsTick`: det, baggrundsfunktionen og de planlagte funktioner gjorde |
| `netlify/lib/netlify-platform.mts` + `netlify/functions/*` | Netlify: tynde indpakninger, der opfører sig som før |
| `worker/index.mts` | Cloudflare: `fetch` (`/api/*` → API, resten er statiske filer), `queue` (Otto) og `scheduled` (cron) |
| `worker/store.mts` + `migrations/0001_docs.sql` | D1 bag Blobs-interfacet. Afviser værdier over 1,9 MB med en klar besked (D1's grænse er 2 MB) |
| `netlify/lib/zone.mts` | `wall()` og `zonedSnapshot()`: prognose og alarmer i brugerens tidszone uden `process.env.TZ` |
| `netlify/lib/webpush.mts` | Web Push med Web Crypto (VAPID + aes128gcm). `web-push`-pakken er fjernet fra runtime. Nøglerne i lageret virker uændret |
| `dashboard/_headers` | De samme sikkerheds-headers som i `netlify.toml`, så de også gælder på Cloudflare |
| `wrangler.jsonc` | Produktion og miljøet `test` (egen D1 og kø), cron hvert 15. minut og hver time, `nodejs_compat` |
| `scripts/copy-blobs-to-d1.mjs` | Kopi af alle nøgler fra Netlify Blobs til en SQL-fil til D1 (`--uden-push` til testmiljøet) |
| `test/*.test.mts` (`npm test`) | 20 tests: D1-lageret, API'et gennem `handle()` med D1, Workerens `fetch`/`queue`/`scheduled`, Web Push mod `http_ece` og `web-push`-nøgler, og prognosen på en server i UTC, Los Angeles og Tokyo = browseren i København |

Valg undervejs:
- Ingen Hono i M10: Workeren sender bare `/api/*` til den eksisterende router. Hono kommer med `/ext` i M11.
- Queues i stedet for Workflows: `fire()` blev til `AGENT_QUEUE.send()`. HMAC-triggeren bruges kun på Netlify.
- Appen hedder nu **HeyOtto Tasks** (titel, manifest og notifikationer). Routine-teksterne ("HeyOtto OS-job", "HeyOtto OS-opgaver") er uændrede, fordi skillen og routinen genkender dem.
- Workeren fylder 1,25 MB (226 KB gzip). Grænsen på den gratis plan er 3 MB.

**Ikke testet endnu:** Workeren i Cloudflares egen runtime. `wrangler dev` kan ikke starte på pc'en, fordi Microsoft Visual C++ Redistributable mangler (workerd kræver den). Den første kørsel i den rigtige runtime bliver derfor testmiljøet.

## Trin, der mangler

1. `npx wrangler login`, `npx wrangler d1 create heyotto-tasks-test` og `npx wrangler queues create heyotto-tasks-otto-test`. Indsæt database-id'et i `wrangler.jsonc`.
2. `npm run cf:migrate:test`, hemmelighederne med `npx wrangler secret put … --env test` og `APP_URL` til testadressen.
3. `npm run cf:copy -- <sti uden for repoet> --uden-push`, indlæs med `wrangler d1 execute`, og slet filen.
4. `npm run cf:deploy:test`, og gennemgå appen: login, gem, fletning, kalender, Indbakke, Otto, Omplanlæg og push (slå til på testadressen).
5. Mål CPU-tiden pr. kald i Workers-loggen (grænsen på den gratis plan er 10 ms).

## Kasper skal selv

- Give adgang til Cloudflare-kontoen med `heyotto.win` (et API-token med Workers, D1 og Queues, eller `wrangler login` på pc'en).
- Intet om planen: Tasks starter på **Workers Free**. Queues (siden februar 2026), Cron Triggers (5 pr. konto, Tasks bruger 2) og D1 er med i den gratis plan. Grænsen er **10 ms CPU-tid pr. kald**. Ventetid på Claude, Google og databasen tæller ikke med. Det, der kan ramme grænsen, er at gemme hele `data`-dokumentet med fletning, prognosen, dekryptering af Google-tokens og kryptering af push. I trin 5 måles CPU-tiden på testadressen (Workers-loggen viser den pr. kald). Først hvis kald rammer 10 ms, skal der vælges mellem at optimere dem og Workers Paid (ca. 5 USD/md., 5 min CPU).

## Åbne spørgsmål

1. Skal testadressen også stå bag Cloudflare Access fra start? Anbefaling: ja, med den eksisterende adgangskode som ekstra lag, fordi den indeholder en kopi af rigtige data.

## Færdig når

- Hele appen virker på testadressen med en kopi af data, og Google-forbindelserne kan læses uden at logge ind igen
- Otto-kørsler, kalendersync og alarmer kører fra køen og cron
- Prognosen giver samme resultat på Cloudflare som på Netlify, også sent om aftenen
- Netlify kører uændret videre
