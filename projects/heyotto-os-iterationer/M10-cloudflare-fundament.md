# M10: Cloudflare-fundament: Tasks kører på Workers

**Status (2026-11-06):** koden er bygget og testet i Node (se "Bygget"). Netlify er fjernet helt fra projektet. Deploy til testmiljøet mangler og kræver adgang til Cloudflare-kontoen. Første af seks iterationer (M10–M15), der giver HeyOtto Tasks samme opsætning som HeyOtto Studio: API med tokens, MCP, UI bag Cloudflare Access og en forbindelse til Studio. Grundlaget er Studios guide "byg et værktøj med samme opsætning som HeyOtto Studio" (M38–M42 i Studio).

> "jeg synes vi skal fuldstændig væk fra netlify"

## Beslutning

HeyOtto Tasks kører **kun på Cloudflare** (besluttet 2026-11-06). Der er ingen Netlify-kode, -konfiguration eller -pakker i repoet. Det gamle Netlify-site kører videre urørt med de nuværende data, indtil de er kopieret til D1 (M13). Derefter slettes det.

Guiden beskriver tre måder at køre et værktøj på (a: samme pc som Studio, b: anden maskine med egen tunnel, c: hosting med egen HTTPS). **Tasks bruger c:** Cloudflare Workers med eget domæne. Der er ingen tunnel og ingen pc, der skal være tændt.

## Bygget (branchen `claude/m10-cloudflare`)

| Fil | Hvad |
|---|---|
| `worker/index.mts` | Workeren: `fetch` (`/api/*` → API'et, resten er appens statiske filer), `queue` (én Otto-kørsel pr. besked) og `scheduled` (cron) |
| `worker/store.mts` + `migrations/0001_docs.sql` | D1 som nøgle/værdi-lager (én række pr. nøgle: `data`, `historik/<id>`, `agent-runs/<id>` …). Afviser værdier over 1,9 MB med en klar besked (D1's grænse er 2 MB). D1 er konsistent, så "data er ændret et andet sted" virker som før |
| `server/` | Serverkoden (API, Otto, Google, Gmail, alarmer, planer). `server/api.mts` er `handle(req, platform)` |
| `server/platform.mts` | Det, serveren får fra Workeren: lager, hemmeligheder, IP, `waitUntil` og `startRun` (Queue). Gør det muligt at teste uden Cloudflare |
| `server/jobs.mts` | `runAgent`, `scheduleTick`, `calendarTick`, `alertsTick` |
| `server/zone.mts` | `wall()` og `zonedSnapshot()`: prognose og alarmer i brugerens tidszone. Workers kører altid i UTC, og `process.env.TZ` virker ikke |
| `server/webpush.mts` | Web Push med Web Crypto (VAPID + aes128gcm). Nøglerne i lageret virker uændret |
| `dashboard/_headers` | Sikkerheds-headers på de statiske filer |
| `wrangler.jsonc` | Produktion og miljøet `test` (egen D1 og kø), cron hvert 15. minut og hver time, `nodejs_compat` |
| `scripts/copy-blobs-to-d1.mjs` | Engangsflytning af data fra det gamle Netlify-site til D1 (`--uden-push` til testmiljøet). Netlify-biblioteket hentes kun til den kørsel |
| `test/*.test.mts` (`npm test`) | 20 tests: D1-lageret, API'et gennem `handle()` med D1, Workerens `fetch`/`queue`/`scheduled`, Web Push mod `http_ece` og `web-push`-nøgler, og prognosen på en server i UTC, Los Angeles og Tokyo = browseren i København |

Valg undervejs:
- **Queues** til Otto-kørsler: `startRun` lægger kørslens id i køen `heyotto-tasks-otto`. Køen kan ikke kaldes udefra.
- **Ingen Hono i M10:** Workeren sender `/api/*` til den eksisterende router. Hono kommer med `/ext` i M11.
- **Claude API kun med `ANTHROPIC_API_KEY`** som hemmelighed i Cloudflare.
- Appen hedder nu **HeyOtto Tasks** (titel, manifest og notifikationer). Routine-teksterne ("HeyOtto OS-job", "HeyOtto OS-opgaver") er uændrede, fordi skillen og routinen genkender dem.
- Workeren fylder 1,25 MB (226 KB gzip). Grænsen på den gratis plan er 3 MB.

**Ikke testet endnu:** Workeren i Cloudflares egen runtime. `wrangler dev` kan ikke starte på pc'en, fordi Microsoft Visual C++ Redistributable mangler (workerd kræver den). Den første kørsel i den rigtige runtime bliver derfor testmiljøet.

## Trin, der mangler

1. `npx wrangler login`, `npx wrangler d1 create heyotto-tasks-test` og `npx wrangler queues create heyotto-tasks-otto-test`. Indsæt database-id'et i `wrangler.jsonc`.
2. `npm run cf:migrate:test`, hemmelighederne med `npx wrangler secret put … --env test` og `APP_URL` til testadressen.
3. Kopi af data: `npm install --no-save @netlify/blobs`, `npm run cf:copy -- <sti uden for repoet> --uden-push`, indlæs med `wrangler d1 execute`, og slet filen.
4. `npm run cf:deploy:test`, og gennemgå appen: login, gem, fletning, kalender, Indbakke, Otto, Omplanlæg og push (slå til på testadressen).
5. Mål CPU-tiden pr. kald i Workers-loggen (grænsen på den gratis plan er 10 ms).

## Kasper skal selv

- `npx wrangler login` i repoet med kontoen, der har `heyotto.win`.
- Netlify-site-id og et adgangstoken til den ene kopi af data.
- Intet om planen: Tasks starter på **Workers Free**. Queues, Cron Triggers (5 pr. konto, Tasks bruger 2) og D1 er med. Grænsen er **10 ms CPU-tid pr. kald**. Ventetid på Claude, Google og databasen tæller ikke med. Kun hvis kald rammer grænsen, skal der vælges mellem at optimere dem og Workers Paid (ca. 5 USD/md.).

## Åbne spørgsmål

1. Skal testadressen også stå bag Cloudflare Access fra start? Anbefaling: ja, med den eksisterende adgangskode som ekstra lag, fordi den indeholder en kopi af rigtige data.

## Færdig når

- Hele appen virker på testadressen med en kopi af data, og Google-forbindelserne kan læses uden at logge ind igen
- Otto-kørsler, kalendersync og alarmer kører fra køen og cron
- Prognosen giver samme resultat på serveren som i browseren, også sent om aftenen
