# Claude Marketing OS

Kasper's agentic workspace for personal admin and marketing operations. Work here is done by specialized subagents (`.claude/agents/`), each scoped to a domain and a set of MCP connectors.

## Agents

| Agent | Domain | MCP tools | Status |
|---|---|---|---|
| `personal-assistant` | Outlook calendar/email, task & weekly status tracking | Microsoft 365, Microsoft planner (Activepieces) | Connected |
| `marketing-specialist` | Paid media / Meta Ads | Meta Ads MCP | Connected. Adkit not in use — no account yet |
| `email-specialist` | Email marketing / CRM | Drip, HubSpot | **Neither connected** |
| `art-director` | Creative / design | Canva | Connected. Higgsfield not in use — no account yet |
| `cfo` | Budget tracking | Microsoft 365 (Excel in SharePoint) | Connected |

Missing connectors are added by Kasper via claude.ai connector settings — Claude cannot authorize them from here. Until connected, the relevant agent should say so rather than fabricate results. Adkit and Higgsfield are a special case: no account exists yet, so they're not an active to-do — don't propose them as steps in a task.

When invoking an agent explicitly, use its name (e.g. "use the marketing-specialist to..."). Otherwise pick the agent whose domain matches the request.

## Folder structure

- `brand/` — guidelines, tone-of-voice, brand assets. Every content-producing agent checks this first.
- `projects/` — one subfolder per active campaign/project; briefs, creative, budget, performance live together here.
- `reference/` — standing context (personas, contacts, recurring meetings, benchmarks) agents should read before asking Kasper to repeat himself.
- `templates/` — reusable starting points (`ads/`, `email/`, `reports/`).
- `reports/weekly/` — recurring status updates from `personal-assistant`, dated `YYYY-MM-DD.md`.
- `.claude/skills/` — packaged, repeatable workflows (e.g. "produce the weekly status update") that any agent can invoke consistently. See `.claude/skills/README.md`. Empty for now — add skills once a workflow has actually repeated, not preemptively.

## Working conventions

- Confirm before any action with real-world side effects: sending email, responding to calendar invites, launching/editing live ad campaigns, spending budget. Read-only lookups don't need confirmation.
- Cite real numbers pulled from tools — never estimate or guess metrics, budgets, or performance figures.
- If a task needs a connector that isn't set up, say so explicitly instead of working around it.
