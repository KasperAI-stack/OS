# M12: Global adgangsvagt og UI'et bag Cloudflare Access

**Status (2026-11-06):** bygget og deployet. Venter på Access-applikationen for `tasks.heyotto.win` (AUD-tagget), før appen kan åbnes. Med Access er der ingen adgangskode: vagten giver e-mailen videre, og API'et behandler kaldet som dig. "Log ud" går til Cloudflare Access' log ud.

Bygget:
- `server/gate.mts` (vagten), `server/access.mts` (JWT med Web Crypto), `run_worker_first`, `workers_dev: false` og `preview_urls: false`.
- Testmiljøet: `tasks.heyotto.win` (appen) og `tasks-api.heyotto.win` (API). Produktion er sat op i `wrangler.jsonc` med `tasks-ui` og `tasks`.
- Appen sender `X-Tasks: 1`. Ændrende `/api`-kald uden den eller med fremmed Origin afvises.
- 7 nye tests (i alt 35).
- Testet udefra: API-adressen `401` uden token og `404` på `/` og `/api`. App-adressen `403` (fail closed, AUD mangler). workers.dev svarer ikke længere.
- `CF_ACCESS_TEAM_DOMAIN` og `CF_ACCESS_AUD` er `vars` i `wrangler.jsonc` (ikke hemmelige). Svarer til M2 og M4 i Studios guide. Bygger på M10 og M11.

## Mål

Lukket som standard. Kun tre ting kan nås udefra:

| Adresse | Hvem | Hvordan |
|---|---|---|
| `https://tasks-api.heyotto.win/ext/*` og `/mcp` | Studio, n8n, Claude | API-token (M11) |
| `https://tasks.heyotto.win` | Kasper fra pc og telefon | Cloudflare Access (engangskode eller Google) + Tasks' eget JWT-tjek |
| Alt andet | ingen | `403` eller `404` |

Tasks tjekker selv adgangen, selv om Cloudflare også gør det.

## Analyse af den nuværende kode

- Appen er beskyttet af én adgangskode (`HEYOTTO_PASSWORD`) og en signeret session-cookie (90 dage). Siden er offentligt tilgængelig, og login-formularen kan nås af alle.
- CSRF: ændringer med cookie skal komme fra siden selv. Tjekket findes allerede i `api.mts`.
- Google sender browseren til `/api/google/callback` uden cookie, beskyttet af signeret `state`.

## Anbefalet løsning

### Adgangsvagten (én middleware før alle ruter)

- Host `tasks-api.heyotto.win`: kun `/ext` og `/mcp` med token (M11). Alt andet `404`.
- Host `tasks.heyotto.win`: gyldig Access-JWT, ellers `403`. Gælder også `/api/*` og de statiske filer.
- Host `127.0.0.1`/`localhost` (`wrangler dev`): som i dag.
- Alle andre hosts, også `*.workers.dev`: `403`. Testadressen får sin egen Access-applikation.
- Ændrende `/api`-kald kræver headeren `X-Tasks: 1` og Tasks' egen `Origin` (mod CSRF).
- **Faldgrube fra Studio:** ukendte stier under `/ext` og `/mcp` skal svare `404`, før static assets falder tilbage til `index.html`. På Workers sættes `assets.run_worker_first = true`, så vagten altid kører først.

### Access-JWT (kopi af Studios `server/access.ts`, tilpasset Workers)

- Header `Cf-Access-Jwt-Assertion`.
- Nøgler fra `https://old-dust-74a9.cloudflareaccess.com/cdn-cgi/access/certs` (samme team som Studio), cachet pr. `kid`. Hentes igen ved ukendt `kid`, højst én gang i minuttet.
- `alg` = `RS256`, signatur verificeret med **Web Crypto** (`crypto.subtle.importKey("jwk", …, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" })`), ikke Nodes `crypto.verify`. `aud` indeholder `CF_ACCESS_AUD`, `iss` = `https://<team>`, `exp` ikke passeret.
- **Fail closed:** mangler `CF_ACCESS_TEAM_DOMAIN` eller `CF_ACCESS_AUD`, afvises alt udefra med `403`.

### Adgangskoden

Når Access-JWT'en er tjekket, er adgangskoden overflødig på UI'et. Den beholdes til M13 er live og testet, og fjernes så (en ting mindre at lække). Anbefaling: fjern den.

### Flere brugere

Intet er bundet til Kaspers konto: e-mailen står i Access-policyen i Cloudflare, og `CF_ACCESS_*` sættes pr. installation. Opsætningen beskrives trin for trin i appen (Indstillinger → Forbindelser), som Google-opsætningen er i dag.

## Trin

1. Adgangsvagten med host-regler og `run_worker_first`.
2. `access.ts` med Web Crypto og nøgle-cache.
3. Tests med testnøgler (`crypto.subtle.generateKey` RSA): `403` uden JWT, med forkert `aud`, forkert `iss`, udløbet JWT og forkert signatur. `403` for ukendte hosts og `404` for `/` på `tasks-api.heyotto.win`.
4. Vejledning til Access-applikationen (5 minutter, én gang).

## Kasper skal selv

1. Cloudflare Zero Trust → Access → Applications → Self-hosted: `tasks.heyotto.win`, policy "Allow" med kun din e-mail.
2. Give mig applikationens AUD-tag. Det skrives i `wrangler.jsonc` (`CF_ACCESS_AUD`).

## Færdig når

- Testene ovenfor er grønne, og lokalt virker alt som før
- Udefra: `tasks-api.heyotto.win/` og `/api` giver `404`, `tasks.heyotto.win` beder om Access-login, og efter login virker appen
