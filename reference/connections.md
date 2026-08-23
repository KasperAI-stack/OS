# Connections

Status log for every MCP connector and CLI tool this workspace depends on. Update this whenever a connector's status changes — CLAUDE.md's table stays a quick-glance summary, this file has the detail.

## MCP connectors

MCP connectors are authorized per Claude account via **claude.ai → Settings → Connectors**, not from this repo — the OAuth/browser step can only be done by Kasper. Claude's role is: confirm the connector works once added, wire it into the relevant agent's instructions, and log it here.

| Connector | Used by | Status | Notes |
|---|---|---|---|
| Microsoft 365 (Outlook, SharePoint) | `personal-assistant` | Connected | Calendar, email, SharePoint file search |
| Microsoft planner (Activepieces) | `personal-assistant` | Connected | Actually a workflow/automation builder (`ap_*`), not the native MS Planner task app. Connection externalId: `BXf3j03Db1DxU9518gpcK`. **Known recurring failure:** the underlying Microsoft OAuth token expires outright ("Lifetime validation failed, the token is expired") — likely due to an Entra ID token-lifetime/Conditional Access policy on Kasper's work account, not a bug in Activepieces. `ap_list_connections` reports status "ACTIVE" even when the token is dead — it's a cached status, not a live check. **Only a real test call reveals the true state.** Fix: Kasper reconnects via Activepieces → Settings → Connections → Microsoft 365 Planner → Reconnect. No self-heal possible. Reliable read method: `custom_api_call` (raw Microsoft Graph calls) — `findAPlan`/`findTask` only do substring search and can't list everything, and plan names aren't unique in this account (see `reference/personal-assistant-playbook.md` for the duplicate "Årshjul" issue). Full board structure and known plan IDs are documented there. |
| Meta Ads MCP | `marketing-specialist` | Connected | Campaigns, ad sets, ads, insights, audiences, catalogs |
| Canva | `art-director` | Connected | Design generation/editing, brand templates |
| Windsor.ai | `cfo` (fallback) | Connected | Fallback only — budgets live in SharePoint Excel, read via Microsoft 365 instead |
| Brandfetch | shared | Connected | Brand asset/logo lookup |
| Firecrawl (x2) | shared | Connected | Web search/scrape/research |
| monday.com | unassigned | Connected | Not currently wired into any agent — flag if it should be |
| claude.ai Frontegg marketplace | unknown | **Needs auth** | Purpose unclear — check what this connector is for, or ignore if unused |
| Adkit MCP | `marketing-specialist` | **No account yet** | Not an active to-do — Kasper doesn't use Adkit currently. Revisit if that changes |
| Higgsfield MCP | `art-director` | **No account yet** | Not an active to-do — Kasper doesn't use Higgsfield currently. Revisit if that changes |
| Drip MCP | `email-specialist` | **Not connected** | |
| HubSpot MCP | `email-specialist` | **Not connected** | |

Budget source resolved: marketing budgets live in **Excel files in SharePoint**, read/written via the already-connected Microsoft 365 MCP — no dedicated Sheets connector needed. `cfo` agent updated accordingly.

## CLI tools (installed and authenticated locally)

CLI tools are set up directly in this session (Bash/PowerShell) since they don't need browser OAuth per Claude conversation the way MCP connectors do.

| Tool | Purpose | Status |
|---|---|---|
| GitHub CLI (`gh`) | Repo management, pushed this workspace to `africakasper/claude-marketing-os` | Installed & authenticated (account: africakasper) |
| Node.js (LTS) | Runtime dependency for Work IQ CLI | Installed (v24.19.0) |
| Microsoft Work IQ CLI (`workiq`, `@microsoft/workiq`) | Natural-language querying of M365 data (email, calendar, docs, Teams, **Planner**, people) via CLI or local MCP server (`workiq mcp`) | **Installed but not usable yet** — see below |

### Work IQ CLI — not yet activated

Installed 2026-08-23 at Kasper's request, hoping it could replace the flaky Activepieces Planner connector. **It is not a drop-in fix and needs real setup before it does anything:**

1. `workiq accept-eula` — EULA not yet accepted.
2. Requires a **usage-based billing plan in Copilot Studio**, tied to an Azure subscription + resource group. This is paid (Copilot Credits, consumption-based) — needs Kasper (or whoever manages the Africa Tours Azure/M365 billing) to set this up.
3. Requires **Microsoft Entra tenant admin consent** for the Work IQ application. If Kasper isn't a tenant admin, IT needs to grant this.
4. Auth is delegated Entra ID (OBO flow) — **the same tenant Conditional Access / token-lifetime policy that causes the Activepieces Planner connector to expire ("Lifetime validation failed") likely applies here too.** Switching to Work IQ probably won't fix the "fejler tit" problem — that's a tenant-level policy issue, not a defect in the specific connector.
5. Work IQ is a natural-language reasoning tool (`workiq ask`, MCP `search` tool) over M365 data — not a structured CRUD API. It's not a like-for-like replacement for the `custom_api_call` approach the `personal-assistant-dashboard` skill uses to read exact bucket/task IDs and fields. Even once activated, it may complement rather than replace the current Planner access method.

**Next step is Kasper's, not Claude's:** confirm with IT/Azure admin whether Africa Tours' tenant has (or should get) Copilot Studio usage-based billing and can grant the admin consent. Until then this stays installed but dormant.

## Process for adding a new connector

1. Kasper connects it via claude.ai → Settings → Connectors (browser OAuth).
2. Tell Claude it's connected.
3. Claude confirms with a read-only test call, updates this table and the status table in `CLAUDE.md`, and updates the relevant agent's `.claude/agents/*.md` file to actually use it (removing "not connected" caveats).
4. Once an agent has made real MCP calls a few times, consider running the `fewer-permission-prompts` skill to allowlist the safe, repeated read-only calls in `.claude/settings.json`.
