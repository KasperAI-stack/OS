# Connections

Status log for every MCP connector and CLI tool this workspace depends on. Update this whenever a connector's status changes — CLAUDE.md's table stays a quick-glance summary, this file has the detail.

## MCP connectors

MCP connectors are authorized per Claude account via **claude.ai → Settings → Connectors**, not from this repo — the OAuth/browser step can only be done by Kasper. Claude's role is: confirm the connector works once added, wire it into the relevant agent's instructions, and log it here.

| Connector | Used by | Status | Notes |
|---|---|---|---|
| Microsoft 365 (Outlook, SharePoint) | `personal-assistant` | Connected | Calendar, email, SharePoint file search |
| Asana | `personal-assistant` | Connected | Task/project boards. Replaced Microsoft Planner (Activepieces) on 2026-08-23 — see deprecation note below. Workspace GID and per-board project/section GIDs are in `reference/personal-assistant-playbook.md`; use those directly rather than re-resolving names. |
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
| Node.js (LTS) | General-purpose runtime (many MCP servers are npm-based) | Installed (v24.19.0) |

**Tried and abandoned (2026-08-23):** Microsoft Work IQ CLI (`@microsoft/workiq`), investigated as a possible replacement for the flaky Activepieces Planner connector. Installed, then uninstalled the same day once it became clear it wouldn't help: it needs a paid Copilot Studio usage-based billing plan plus Entra tenant admin consent to even activate, its natural-language query model isn't a like-for-like replacement for the structured `custom_api_call` reads the `personal-assistant-dashboard` skill relied on, and — most importantly — it uses the same delegated Entra ID auth as Activepieces, so it would likely hit the same tenant-level Conditional Access / token-lifetime expiry ("fejler tit") rather than fixing it.

**Deprecated (2026-08-23): Microsoft planner (Activepieces).** Replaced by Asana for `personal-assistant` — task tracking moved off Planner entirely rather than fixing the underlying issue. History, for context: this connector was actually a workflow/automation builder (`ap_*`), not the native MS Planner task app, exposing Microsoft 365 Planner as one "piece" (connection externalId `BXf3j03Db1DxU9518gpcK`). It had a recurring failure where the underlying Microsoft OAuth token expired outright ("Lifetime validation failed, the token is expired") — likely an Entra ID token-lifetime/Conditional Access policy on Kasper's work account. `ap_list_connections` reported "ACTIVE" even when the token was dead (cached status, not a live check). The 6 Planner boards (Marketing HQ, Paid Ads, Events, Email, Opstart, Årshjul) were rebuilt as Asana projects; Paid Ads and Årshjul got their task data migrated from live screenshots, the other 4 are empty skeletons pending manual migration by Kasper.

## Process for adding a new connector

1. Kasper connects it via claude.ai → Settings → Connectors (browser OAuth).
2. Tell Claude it's connected.
3. Claude confirms with a read-only test call, updates this table and the status table in `CLAUDE.md`, and updates the relevant agent's `.claude/agents/*.md` file to actually use it (removing "not connected" caveats).
4. Once an agent has made real MCP calls a few times, consider running the `fewer-permission-prompts` skill to allowlist the safe, repeated read-only calls in `.claude/settings.json`.
