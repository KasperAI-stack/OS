# M14: MCP-endpoint og API-dokumentation

**Status (2026-11-06):** planlagt. Svarer til M5 og M6 i Studios guide. Bygger på M11 og M12.

## Mål

Claude, Cursor og Studios agenter kan arbejde i Tasks via `https://tasks-api.heyotto.win/mcp`, og n8n kan bruge API'et direkte ud fra en OpenAPI-fil.

## MCP

- `McpServer` og `WebStandardStreamableHTTPServerTransport` fra `@modelcontextprotocol/sdk` 1.32+. Med Hono: `transport.handleRequest(c.req.raw)`. Transporten er bygget på web-standarder og kører på Workers.
- **Stateless:** `sessionIdGenerator: undefined`, `enableJsonResponse: true`, ny server og transport pr. kald. Det passer til Workers, hvor intet ligger i hukommelsen mellem kald.
- Samme `tokenGuard` som `/ext` (M11). Klienter uden headers kan bruge `/mcp/<token>`. Stien logges som `/mcp/***`.
- `tools/list` viser kun de værktøjer, tokenets scopes tillader.

### Værktøjer

Navngivet, så Studio kan klassificere dem som læsende, skrivende eller farlige:

| Værktøj | Scope | Klasse i Studio | Hvad |
|---|---|---|---|
| `list_tasks` | `read` | read | Åbne tasks, filtre: status, projekt, deadline før |
| `get_task` | `read` | read | Én task med noter og kommentarer |
| `list_projects` | `read` | read | Projekter med status og åbne tasks |
| `list_routines` | `read` | read | Rutiner og næste forekomst |
| `get_forecast` | `read` | read | Prognosen: deadlines i risiko, overbookede uger (M6) |
| `create_task` | `write` | write | Ny task |
| `update_task` | `write` | write | Ændr status, deadline, timer, ejer, noter |
| `add_comment` | `write` | write | Kommentar på en task |

- Hvert værktøj har `annotations: { readOnlyHint }` og et `inputSchema` med zod.
- Der laves **ikke** et `delete_task`. Sletning sker kun i appen.
- Værktøjerne kalder de samme funktioner som `/ext`, så logikken findes ét sted.
- Ændringer står i Historik med tokenets navn og kan fortrydes.

## Dokumentation

- `docs/api.md` på dansk: tokens, scopes, grænser (60/min, 256 KB), fejlkoder (`401`, `403`, `404`, `413`, `429`), alle endpoints og MCP-værktøjer med eksempler i curl.
- `docs/openapi.json`, så n8n og andre kan importere API'et.
- En test, der læser `/ext`-ruterne fra Hono-routeren og fejler, hvis en mangler i `openapi.json` (som den sidste test i Studios `server/ext/ext.test.ts`).
- Appen linker til dokumentationen fra Indstillinger → API-tokens.

## Trin

1. `/mcp` med de læsende værktøjer og scope-filtrering.
2. De skrivende værktøjer ovenpå `/ext`-funktionerne.
3. `docs/api.md`, `docs/openapi.json` og ruteparitetstesten.
4. Test: i hukommelsen, lokalt med curl, så udefra (også de negative kald).

## Færdig når

- `tools/list` viser kun de tilladte værktøjer pr. scope
- Et kald udefra virker med token og afvises uden
- `openapi.json` dækker alle ruter, og testen holder den sådan
