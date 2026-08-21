# Connections

Status log for every MCP connector and CLI tool this workspace depends on. Update this whenever a connector's status changes — CLAUDE.md's table stays a quick-glance summary, this file has the detail.

## MCP connectors

MCP connectors are authorized per Claude account via **claude.ai → Settings → Connectors**, not from this repo — the OAuth/browser step can only be done by Kasper. Claude's role is: confirm the connector works once added, wire it into the relevant agent's instructions, and log it here.

| Connector | Used by | Status | Notes |
|---|---|---|---|
| Microsoft 365 (Outlook, SharePoint) | `personal-assistant` | Connected | Calendar, email, SharePoint file search |
| Microsoft planner (Activepieces) | `personal-assistant` | Connected | Actually a workflow/automation builder (`ap_*`), not the native MS Planner task app |
| Meta Ads MCP | `marketing-specialist` | Connected | Campaigns, ad sets, ads, insights, audiences, catalogs |
| Canva | `art-director` | Connected | Design generation/editing, brand templates |
| Windsor.ai | `cfo` (partial) | Connected | Can read Google Sheets as a data source if a sheets connector is set up inside Windsor |
| Brandfetch | shared | Connected | Brand asset/logo lookup |
| Firecrawl (x2) | shared | Connected | Web search/scrape/research |
| monday.com | unassigned | Connected | Not currently wired into any agent — flag if it should be |
| claude.ai Frontegg marketplace | unknown | **Needs auth** | Purpose unclear — check what this connector is for, or ignore if unused |
| Adkit MCP | `marketing-specialist` | **Not connected** | |
| Higgsfield MCP | `art-director` | **Not connected** | AI image/video generation |
| Drip MCP | `email-specialist` | **Not connected** | |
| HubSpot MCP | `email-specialist` | **Not connected** | |
| Google Sheets (dedicated) | `cfo` | **Not connected / may not exist as a connector** | Fallback: Windsor.ai sheets source, or move budgets to SharePoint Excel |

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
