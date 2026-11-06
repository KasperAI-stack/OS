# M10: Cloudflare-fundament: Tasks kører på Workers

**Status (2026-11-06):** bygget, deployet og røgtestet. Kører i produktion på `tasks.heyotto.win` (appen) og `tasks-api.heyotto.win` (API). Der er intet separat testmiljø (Kasper, 2026-11-06): test sker med `npm test`. Netlify er fjernet helt fra projektet. Første af seks iterationer (M10–M15), der giver HeyOtto Tasks samme opsætning som HeyOtto Studio: API med tokens, MCP, UI bag Cloudflare Access og en forbindelse til Studio. Grundlaget er Studios guide "byg et værktøj med samme opsætning som HeyOtto Studio" (M38–M42 i Studio).

> "jeg synes vi skal fuldstændig væk fra netlify"

## Beslutning

HeyOtto Tasks kører **kun på Cloudflare** (besluttet 2026-11-06). Der er ingen Netlify-kode, -konfiguration eller -pakker i repoet. **Ingen data flyttes** (Kasper, 2026-11-06: ingen tasks, der ikke må slettes). Tasks starter forfra på Cloudflare, Google forbindes igen, og det gamle Netlify-site slettes, når Tasks er live (M13).

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
| `test/*.test.mts` (`npm test`) | 20 tests: D1-lageret, API'et gennem `handle()` med D1, Workerens `fetch`/`queue`/`scheduled`, Web Push mod `http_ece` og `web-push`-nøgler, og prognosen på en server i UTC, Los Angeles og Tokyo = browseren i København |

Valg undervejs:
- **Queues** til Otto-kørsler: `startRun` lægger kørslens id i køen `heyotto-tasks-otto`. Køen kan ikke kaldes udefra.
- **Ingen Hono i M10:** Workeren sender `/api/*` til den eksisterende router. Hono kommer med `/ext` i M11.
- **Claude API kun med `ANTHROPIC_API_KEY`** som hemmelighed i Cloudflare.
- Appen hedder nu **HeyOtto Tasks** (titel, manifest og notifikationer). Routine-teksterne ("HeyOtto OS-job", "HeyOtto OS-opgaver") er uændrede, fordi skillen og routinen genkender dem.
- Workeren fylder 1,25 MB (226 KB gzip). Grænsen på den gratis plan er 3 MB.

## Røgtest i Cloudflares runtime

Kørt i det første testmiljø (D1 `heyotto-tasks-test`, nu slettet). Workeren starter på 10 ms.

| Test | Resultat |
|---|---|
| Appen, statiske filer og headers | `200`. `README.md` er ikke offentlig (`dashboard/.assetsignore`) |
| Uden login / login | `401` / session-cookie |
| Gem, konflikt og Historik | ny `rev` i D1, `409` ved gammel `rev`, versionen i Historik |
| Push-nøgle | laves, krypteres og læses igen (`createCipheriv`, som Google-tokens bruger) |
| Otto og Google | svarer korrekt "ikke sat op", fordi nøglerne ikke er sat endnu |

`wrangler dev` kan ikke starte lokalt, fordi Microsoft Visual C++ Redistributable mangler på pc'en.

## Trin, der mangler

1. Mål CPU-tiden pr. kald i Workers-loggen (`npx wrangler tail`), når appen er i brug. Grænsen på den gratis plan er 10 ms.

## Plan

Tasks starter på **Workers Free**. Queues, Cron Triggers (5 pr. konto, Tasks bruger 2) og D1 er med. Grænsen er **10 ms CPU-tid pr. kald**. Ventetid på Claude, Google og databasen tæller ikke med. Kun hvis kald rammer grænsen, skal der vælges mellem at optimere dem og Workers Paid (ca. 5 USD/md.).

## Åbne spørgsmål

1. Skal testadressen også stå bag Cloudflare Access? Kommer naturligt med M12.

## Færdig når

- Hele appen virker på testadressen ✅ (røgtest)
- Otto-kørsler, kalendersync og alarmer kører fra køen og cron
- Prognosen giver samme resultat på serveren som i browseren, også sent om aftenen
