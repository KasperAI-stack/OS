# M15: Tasks og Studio taler sammen

**Status (2026-11-06):** del 1 (Tasks → Studio) er bygget: `server/studio.mts`, knappen Send til Studio på opgaven, cron hvert minut og svaret som kommentar. Tokenet ligger som `HEYOTTO_TOKEN`. Afvigelse: Studio-opgaven gemmes under `studio-tasks/<opgave-id>` ved siden af data, ikke på tasken, så Gem i browseren aldrig støder ind i den. Den gamle Claude Code Routine-del er fjernet. Del 2 (Studio → Tasks via MCP) venter på M14. Svarer til afsnit 3 og 4 i Studios guide. Bygger på M11–M14. Erstatter den tidligere M10-plan (Studio på pc'en med `/actions` og `/runs` via tunnel). Studio har nu sit eget API på `otto.heyotto.win/ext`, og Tasks bruger det, som det er.

> "jeg vil have at OS og Studio får en API connection"

```
   HeyOtto Tasks (Cloudflare Workers)                   HeyOtto Studio (Cloudflare Tunnel)
   ┌──────────────────────────────┐   POST /tasks    ┌──────────────────────────────┐
   │ tasks-api.heyotto.win/ext   (M11)   │ ───────────────▶ │ otto.heyotto.win/ext         │
   │ tasks-api.heyotto.win/mcp   (M14)   │   GET /tasks/:id │ otto.heyotto.win/mcp         │
   │ tasks.heyotto.win    (M12)   │ ◀─────────────── │ studio.heyotto.win (Access)  │
   └──────────────────────────────┘  MCP list/update └──────────────────────────────┘
          hot_-token i Tasks                                   tsk_-token i Studio
```

To retninger, hver med sit eget token:

## 1. Tasks → Studio: send en task til Studios agent

### Opsætning (Kasper, én gang)

1. Studio → Agenter → Integrationer → **Adgang udefra** → nyt token "HeyOtto Tasks" med `task` og `read` (og `flows`, hvis Tasks skal starte gemte flows).
2. Tokenet (`hot_…`) gemmes som hemmeligheden `HEYOTTO_TOKEN` i Workeren, og `HEYOTTO_URL=https://otto.heyotto.win/ext`.
3. **Indstillinger → Forbindelser → Studio** viser "Studio online", når `GET /ext/health` svarer `200`.

### I appen

- **På en task: Send til Studio.** Teksten forudfyldes med taskens titel, noter, projekt og deadline og Tasks' task-id ("Tasks-id <id>"), så svaret kan matches. Du kan rette teksten, før den sendes.
- Tasks kalder `POST /tasks { text }` og gemmer Studios `id` på tasken (`studio: { id, status, sentAt }`).
- **Status:** en cron hvert minut kalder `GET /tasks/{id}` for tasks med en åben Studio-opgave:
  - `working`: "Studio arbejder"
  - `awaiting_approval`: "Venter på dig i Studio" med link til `studio.heyotto.win`
  - `idle`: færdig. `lastReply` skrives som kommentar på tasken, og du får en notifikation
- **Svarer Studio ikke** (pc'en er slukket): tasken viser "Studio er offline", og Tasks prøver igen hvert 5. minut i en time, så står den som "ikke sendt". Der sendes aldrig en ny opgave af sig selv. Der er ingen løkke.
- **Opfølgning:** `/ext` har ingen svar-rute endnu. Indtil Studio har en, laves opfølgning i Studio. (Studios MCP har `svar_paa_opgave`, men Tasks kalder ikke MCP.)
- Grænser respekteres: tekst højst 20.000 tegn, og fejl fra Studio (`401`, `403`, `404`, `429`) vises på dansk på tasken.

## 2. Studio → Tasks: Studios agenter arbejder i Tasks via MCP

### Opsætning (Kasper, i Studio)

1. Opret et token i Tasks (Indstillinger → API-tokens), fx "Studio", med `read` + `write`.
2. Læg det i Studios `.env` som `HEYOTTO_TASKS_MCP_TOKEN`.
3. I `studio.config.json` → `"mcp"`:
   ```jsonc
   "heyotto-tasks": {
     "name": "HeyOtto Tasks",
     "type": "http",
     "url": "https://tasks-api.heyotto.win/mcp",
     "auth": { "env": "HEYOTTO_TASKS_MCP_TOKEN" },
     "tools": {
       "read": ["list_tasks", "get_task", "list_projects", "list_routines", "get_forecast"],
       "write": ["create_task", "update_task", "add_comment"],
       "never": []
     }
   }
   ```
4. Agenter, der skal bruge Tasks, får `mcp: [heyotto-tasks]` i deres `agent.md` (eller `heyotto-tasks:read` for kun at læse). `write` går gennem Studios godkendelseskø.
5. Integrationer → MCP-servere → "Test MCP-servere" viser Tasks med 8 værktøjer.

## 3. Tasks' egen agent og Studio

- Tasks-agenten (M7) får værktøjet `studio_propose_task`: den kan **foreslå** at sende en task til Studio med en færdig tekst. Du ser forslaget på tasken og trykker *Send til Studio*.
- Tasks-agenten kalder aldrig Studio selv. Intet token kan godkende noget, hverken i Tasks eller i Studio.

## Navnekonflikt: to agenter, der hedder Otto

Studios agent hedder Otto (`otto.heyotto.win`), og Tasks' egen agent (M7) hedder også Otto i appen (siden `#otto`, "Spørg Otto", "Omplanlæg med Otto"). Når de to taler sammen, bliver det forvirrende i appen og i notifikationer. Se åbne spørgsmål.

## Trin

1. Klient til Studio (`sendToStudio`, `studioStatus`) med 15 sekunders timeout, og Forbindelser → Studio med Test forbindelsen.
2. *Send til Studio* på tasks, status-cron og svar som kommentar og notifikation.
3. Test med opgaven "Test fra HeyOtto Tasks: svar bare ok" (ikke en, der starter et hold).
4. MCP-opsætningen i Studio (Kasper) og test af `list_tasks` og `add_comment` fra en Studio-agent.
5. `studio_propose_task` til Tasks-agenten.

## Åbne spørgsmål til Kasper

1. ~~**Navnet**~~ **Afgjort (Kasper, 2026-11-06):** Tasks' agent hedder nu **Assistenten** i appen ("Spørg assistenten", "Omplanlæg med assistenten", Indstillinger → Assistent). Otto er kun Studios agent og Hey Otto-maskotten.
2. **Adresser:** `tasks-api.heyotto.win` (API og MCP) og `tasks.heyotto.win` (appen), eller `tasks-api.heyotto.win` og `tasks.heyotto.win` som i guiden?
3. Skal Tasks kunne starte gemte flows i Studio (`POST /flows/{id}/run`)? Planen venter altid på din godkendelse i Studio.

## Færdig når

- En task sendes til Studio med én knap, status står på tasken, og svaret lander som kommentar
- En Studio-agent kan læse tasks og skrive en kommentar i Tasks via MCP, og det står i Historik som "Studio"
- Studio offline giver en klar besked og ingen gentagne opgaver
