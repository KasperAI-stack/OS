# HeyOtto Tasks: API og MCP

Til HeyOtto Studio, n8n, Claude, Cursor og andre værktøjer. Begge dele ligger på `https://tasks-api.heyotto.win` og bruger de samme API-tokens.

| Del | Adresse | Til |
|---|---|---|
| REST-API | `https://tasks-api.heyotto.win/ext` | n8n, scripts, curl. Maskinlæsbart: [`openapi.json`](openapi.json) |
| MCP | `https://tasks-api.heyotto.win/mcp` | Studios agenter, Claude, Cursor |

`tasks.heyotto.win` er appen bag Cloudflare Access. Den svarer ikke på `/ext` og `/mcp`.

## Tokens

- Laves og tilbagekaldes i appen under **Indstillinger → API-tokens**. Tokenet (`tsk_…`) vises én gang, og kun en hash gemmes.
- Rettigheder (scopes): `read` (læse) og `write` (oprette og rette). Intet token kan slette. Sletning, projekter og rutiner ændres kun i appen.
- Send det som `Authorization: Bearer tsk_…`. Til MCP-klienter uden headers kan det stå i stien: `https://tasks-api.heyotto.win/mcp/tsk_…`.
- Ændringer står i **Historik** med tokenets navn og kan fortrydes.

## Grænser og fejl

- 60 kald i minuttet pr. token (Cloudflares Rate Limiting, omtrentlig pr. datacenter). Body højst 256 KB.
- Fejl er JSON `{ "error": "…" }` på dansk:

| Kode | Betyder |
|---|---|
| `400` | Ugyldigt felt eller ikke JSON. Beskeden siger hvilket |
| `401` | Manglende, ukendt eller tilbagekaldt token |
| `403` | Tokenet mangler rettigheden (`read` eller `write`) |
| `404` | Ukendt task eller adresse |
| `409` | Findes allerede (sprint i samme måned) |
| `413` | Mere end 256 KB |
| `429` | Mere end 60 kald i minuttet. Vent et minut |

- Log: én linje pr. kald med tokenets navn, metode, sti og status. Tokens renses til `tsk_***`.

## REST-API (`/ext`)

| Kald | Rettighed | Hvad |
|---|---|---|
| `GET /ext/health` | alle | `{ ok, token, scopes }` |
| `GET /ext/tasks?status=&project=&due_before=&include_done=true` | `read` | `{ tasks }`: åbne tasks (alle med `include_done`) |
| `GET /ext/tasks/{id}` | `read` | `{ task }` med noter og kommentarer |
| `POST /ext/tasks` | `write` | Ny task. Kun `title` er krævet. Uden `project` havner den under "Uden projekt". `201` med `{ task }` |
| `PATCH /ext/tasks/{id}` | `write` | Ret felter (ikke `project`). `{ task }` |
| `POST /ext/tasks/{id}/comments` | `write` | `{ text }` (højst 4.000 tegn). `201` med `{ comment }` |
| `GET /ext/projects` | `read` | `{ projects }` med antal åbne og færdige tasks |
| `GET /ext/routines` | `read` | `{ routines }` |
| `GET /ext/sprints?project=` | `read` | `{ sprints }`: `project`, `month`, `goal` |
| `POST /ext/sprints` | `write` | `{ project, month: "ÅÅÅÅ-MM", goal }`. `409`, hvis projektet har en sprint den måned. `201` med `{ sprint }` |
| `GET /ext/calendar` | `read` | `{ snapshot }`: møder fra de forbundne Google-konti, `null` uden |
| `GET /ext/forecast` | `read` | Prognosen: `{ today, alerts, tasks, weeks }` (se `get_forecast`) |

### Felter på en task

| Felt | Regel |
|---|---|
| `title` | Krævet ved oprettelse, højst 120 tegn |
| `status` | `Ikke startet`, `I gang`, `Blokeret`, `Færdig` eller `Droppet` |
| `due` | Deadline `ÅÅÅÅ-MM-DD`, eller `""` |
| `hours` | Timer **pr. uge lige nu**, 0-40 |
| `remaining` | Timer tilbage **i alt**, 0-2000, eller `null`. Udelad, når den er ukendt; prognosen bruger den |
| `priority` | `høj`, `normal` eller `lav` |
| `sprint` | Måned `ÅÅÅÅ-MM`; projektet skal have en sprint den måned |
| `owner`, `note` | Fri tekst (40 og 2.000 tegn) |
| `project` | Projektets `id` (se `/ext/projects`). Kun ved oprettelse |

Ukendte felter afvises med `400`, så fejl ikke forsvinder i stilhed.

```bash
curl -sS -H "Authorization: Bearer $HEYOTTO_TASKS_TOKEN" "https://tasks-api.heyotto.win/ext/tasks?due_before=2026-12-01"

curl -sS -X POST -H "Authorization: Bearer $HEYOTTO_TASKS_TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Kampagnerapport uge 46","due":"2026-11-13","remaining":3}' https://tasks-api.heyotto.win/ext/tasks

curl -sS -X PATCH -H "Authorization: Bearer $HEYOTTO_TASKS_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"Færdig"}' https://tasks-api.heyotto.win/ext/tasks/web-12
```

## MCP (`/mcp`)

Streamable HTTP, stateless: hver POST er én JSON-RPC-besked, og svaret er JSON. Ingen sessioner og ingen SSE (`GET` giver `405`). Understøttede protokolversioner: `2025-11-25`, `2025-06-18`, `2025-03-26` og `2024-11-05`.

`tools/list` viser kun de værktøjer, tokenets rettigheder tillader. Værktøjerne kalder de samme funktioner som `/ext`, så felterne og reglerne er de samme. En fejl (fx et ugyldigt felt) kommer som et værktøjsresultat med `isError: true` og den danske besked. Resultater står både som JSON i `text` og i `structuredContent`.

| Værktøj | Rettighed | Studio-klasse | Hvad |
|---|---|---|---|
| `list_tasks` | `read` | read | Åbne tasks. Filtre: `status`, `project`, `due_before`, `include_done` |
| `get_task` | `read` | read | Én task (`id`) med noter og kommentarer |
| `list_projects` | `read` | read | Projekter med åbne og færdige tasks |
| `list_routines` | `read` | read | Rutiner |
| `get_forecast` | `read` | read | Alarmer, tasks i risiko (`risiko`, `stramt`, `over`, `mangler`) og kapaciteten de næste 12 uger |
| `create_task` | `write` | write | Ny task (`title` krævet) |
| `update_task` | `write` | write | Ret felter på en task (`id` + felterne) |
| `add_comment` | `write` | write | Kommentar på en task (`id`, `text`) |

**Navnene er en kontrakt med HeyOtto Studio**, som klassificerer værktøjerne på navn og afviser ukendte. Omdøb eller fjern ikke et værktøj uden at sige det til Kasper og rette Studios `studio.config.json`. Testen `test/mcp.test.mts` holder listen.

```bash
curl -sS -X POST https://tasks-api.heyotto.win/mcp -H "Authorization: Bearer $HEYOTTO_TASKS_TOKEN" \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### I HeyOtto Studio

```jsonc
// studio.config.json → "mcp"
"heyotto-tasks": {
  "name": "HeyOtto Tasks",
  "type": "http",
  "url": "https://tasks-api.heyotto.win/mcp",
  "auth": { "env": "HEYOTTO_TASKS_API" },
  "tools": {
    "read": ["list_tasks", "get_task", "list_projects", "list_routines", "get_forecast"],
    "write": ["create_task", "update_task", "add_comment"],
    "never": []
  }
}
```

### I Claude Code eller Cursor

```bash
claude mcp add --transport http heyotto-tasks https://tasks-api.heyotto.win/mcp --header "Authorization: Bearer $HEYOTTO_TASKS_TOKEN"
```
