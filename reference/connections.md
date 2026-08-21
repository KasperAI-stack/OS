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

No other CLI tools requested yet.

## Process for adding a new connector

1. Kasper connects it via claude.ai → Settings → Connectors (browser OAuth).
2. Tell Claude it's connected.
3. Claude confirms with a read-only test call, updates this table and the status table in `CLAUDE.md`, and updates the relevant agent's `.claude/agents/*.md` file to actually use it (removing "not connected" caveats).
4. Once an agent has made real MCP calls a few times, consider running the `fewer-permission-prompts` skill to allowlist the safe, repeated read-only calls in `.claude/settings.json`.
