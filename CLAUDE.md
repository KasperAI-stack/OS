# Claude Marketing OS

Kasper's agentic workspace for personal admin and marketing operations. Work here is done by specialized subagents (`.claude/agents/`), each scoped to a domain and a set of MCP connectors.

## Agents

| Agent | Domain | MCP tools | Status |
|---|---|---|---|
| `personal-assistant` | Outlook calendar/email, task & weekly status tracking | Microsoft 365, Asana | Connected |
| `marketing-specialist` | Paid media / Meta Ads | Meta Ads MCP | Connected. Adkit not in use — no account yet |
| `email-specialist` | Email marketing / CRM | Drip, HubSpot | **Neither connected** |
| `art-director` | Creative / design | Canva | Connected. Higgsfield not in use — no account yet |
| `cfo` | Budget tracking | Microsoft 365 (Excel in SharePoint) | Connected |

Missing connectors are added by Kasper via claude.ai connector settings — Claude cannot authorize them from here. Until connected, the relevant agent should say so rather than fabricate results. Adkit and Higgsfield are a special case: no account exists yet, so they're not an active to-do — don't propose them as steps in a task.

When invoking an agent explicitly, use its name (e.g. "use the marketing-specialist to..."). Otherwise pick the agent whose domain matches the request.

## Folder structure

- `brand/` — guidelines, tone-of-voice, brand assets. Every content-producing agent checks this first. Two brands: Africa Tours (`brand/guidelines.md`) and Hey Otto (`brand/hey-otto/`, also used by the `dashboard/`).
- `projects/` — one subfolder per active campaign/project; briefs, creative, budget, performance live together here.
- `reference/` — standing context (personas, contacts, recurring meetings, benchmarks) agents should read before asking Kasper to repeat himself.
- `templates/` — reusable starting points (`ads/`, `email/`, `reports/`).
- `reports/weekly/` — recurring status updates from `personal-assistant`, dated `YYYY-MM-DD.md`.
- `dashboard/` — **HeyOtto OS**, Kasper's project/capacity web app on Netlify (`heyotto-os.netlify.app`). Its data lives in the cloud (Netlify Blobs), not in files — read and change it via the `heyotto-os-data` skill. Its **Marketing-dashboard** (own sidebar section, `#marketing`) shows live Search Console, GA4, Google Ads and Meta Ads numbers, pulled server-side by `netlify/lib/metrics.mts` and readable at `GET /api/metrics`. See `dashboard/README.md`.
- `.claude/skills/` — packaged, repeatable workflows that any agent can invoke consistently. See `.claude/skills/README.md`. Real skills so far: `heyotto-os-data` (read and change HeyOtto OS data through its API), `heyotto-os-job` (carry out a task Kasper sent from HeyOtto OS — run by the Claude Code Routine "HeyOtto OS-opgaver", drafts only), plus two ported from claude.ai Project drafts and adapted to this environment's tools: `personal-assistant-dashboard` (daily/weekly status dashboard for `personal-assistant`, covering calendar + email + Asana tasks as one routine) and `meta-ads-weekly` (weekly Meta Ads performance dashboard for `marketing-specialist`, proposals-only per `reference/marketing-specialist-playbook.md`).

## Working conventions

- Confirm before any action with real-world side effects: sending email, responding to calendar invites, launching/editing live ad campaigns, spending budget. Read-only lookups don't need confirmation.
- Cite real numbers pulled from tools — never estimate or guess metrics, budgets, or performance figures.
- If a task needs a connector that isn't set up, say so explicitly instead of working around it.
