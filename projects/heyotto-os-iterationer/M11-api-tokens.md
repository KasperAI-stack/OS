# M11: API-tokens og Tasks' eget API (`/ext`)

**Status (2026-11-06):** planlagt. Svarer til M1 i Studios guide. Bygger på M10.

> "jeg vil gerne have at OS og studio ligger som dedikerede tools, hvor jeg kan bygge API indgange"

## Mål

Tasks får et rigtigt API på `https://tasks.heyotto.win/ext`, som Studio, n8n og fremtidige værktøjer bruger med hver sit token og hver sine rettigheder.

## Analyse af den nuværende kode

- I dag findes **én** nøgle: "Claude-nøglen" (`ho_…`, `auth/claude-key` i `api.mts`). Den bruges af `heyotto-os-data`-skillen og routinen og har fuld adgang til `/api/data`.
- Der er ingen navne, ingen rettigheder, ingen tilbagekaldelse pr. nøgle, ingen rate limit og ingen log over, hvem der kaldte.
- `/api/*` er appens eget API (hele `data`-dokumentet ad gangen). Det er ikke egnet som offentligt API.

## Anbefalet løsning

### Tokens (som i Studio)

- Token = `"tsk_" + 32 tilfældige bytes i base64url` (som i Studios guide; Studio bruger `hot_`).
- Kun `sha256(token)` gemmes. Tokenet vises én gang ved oprettelse.
- D1-tabel `api_tokens(id, name, token_hash, scopes, created_at, last_used_at, revoked_at)`. Tilbagekald = sæt `revoked_at`.
- Scopes (lukket liste): `read`, `write`. Ingen scope kan slette, se Historik, lave tokens eller godkende noget.
- **Indstillinger → API-tokens:** liste med navn, rettigheder og "sidst brugt", knappen *Nyt token* og *Tilbagekald*.
- Claude-nøglen flyttes ind som et token med navnet "Claude" og `read` + `write`, så `heyotto-os-data`-skillen virker uden ændring. Skillen opdateres i M13 til den nye adresse.

### Vagten på `/ext` og `/mcp` (`tokenGuard`)

1. `Authorization: Bearer tsk_…` → slå hash op. Ukendt, forkert eller tilbagekaldt token → `401`.
2. Forkert scope → `403`.
3. Rate limit 60 kald i minuttet pr. token → `429`. På Workers med **Rate Limiting-bindingen** (nøgle = token-id), ikke en tæller i hukommelsen, fordi Workers kører i mange instanser.
4. Body højst 256 KB → `413`.
5. Én logline pr. kald med tokenets **navn**, metode, sti og status.
6. Rens logs, fejl og Historik: `tsk_[A-Za-z0-9_-]{10,}` → `tsk_***`, også i stier.

Fejl er JSON `{ "error": "…" }` på dansk, som i Studio.

### Endpoints (første version)

| Kald | Scope | Hvad |
|---|---|---|
| `GET /ext/health` | alle | `{ ok: true, token: "<navn>" }` |
| `GET /ext/tasks?status=&project=&due_before=` | `read` | Åbne tasks (også rutine-tasks), med projekt og deadline |
| `GET /ext/tasks/{id}` | `read` | Én task med noter og kommentarer |
| `POST /ext/tasks` | `write` | Ny task. Uden projekt havner den under "Uden projekt" |
| `PATCH /ext/tasks/{id}` | `write` | Ændr titel, status, deadline, timer, ejer, noter |
| `POST /ext/tasks/{id}/comments` | `write` | Kommentar på en task (fx svar fra Studio) |
| `GET /ext/projects` | `read` | Projekter med åbne tasks og status |
| `GET /ext/routines` | `read` | Rutiner med næste forekomst |

- Alle ændringer skrives gennem samme fletning som appen (M4) med `by: "<tokenets navn>"`. De står i Historik og kan fortrydes.
- Der er ingen `DELETE`. Sletning sker kun i appen.
- `/ext` er sin egen Hono-router. Ukendte stier under `/ext` svarer `404` (ikke appens `index.html`).

## Trin

1. D1-migration `api_tokens`, oprettelse, hash-opslag og rensning.
2. `tokenGuard` med Rate Limiting-binding og body-grænse.
3. `/ext`-ruterne ovenpå den eksisterende fletning.
4. Indstillinger → API-tokens i appen og flytning af Claude-nøglen.
5. Tests i hukommelsen med `app.request("https://tasks.heyotto.win/ext/…")`.

## Færdig når

- Test viser `401` uden token, med forkert token og med tilbagekaldt token, `403` ved forkert scope, `429` ved kald nr. 61, og at tokenet hverken står i D1, i log eller i Historik
- `GET /ext/tasks` og `POST /ext/tasks` virker med et token, og ændringen står i Historik med tokenets navn
- `heyotto-os-data`-skillen virker stadig
