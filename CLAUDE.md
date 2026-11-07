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
- `reference/` — standing context (personas, contacts, recurring meetings, benchmarks) agents should read before asking Kasper to repeat himself. `reference/design/` is the design reference library (screenshots of the best UI/UX, plus Kasper's own examples in `fra-kasper/`), used by the `ui-design` skill for any UI or landing-page design work.
- `templates/` — reusable starting points (`ads/`, `email/`, `reports/`).
- `reports/weekly/` — recurring status updates from `personal-assistant`, dated `YYYY-MM-DD.md`.
- `dashboard/` — **HeyOtto Tasks** (formerly HeyOtto OS), Kasper's project/capacity web app on **Cloudflare Workers only** (no Netlify): Worker in `worker/`, server code in `server/`, config `wrangler.jsonc`, data in D1, tests in `test/` (`npm test`). The app is `dashboard/index.html` + `dashboard/app.css` (design tokens and type scale, M16); `npm run preview` runs it locally with demo data, `npm run shots` / `npm run a11y` take screenshots and run axe. It runs at `tasks.heyotto.win` (app, behind Cloudflare Access) and `tasks-api.heyotto.win` (`/ext` API with `tsk_` tokens). It started fresh on Cloudflare (no data moved); the old Netlify site `heyotto-os.netlify.app` is being retired. Its data lives in the cloud (D1), not in files — read and change it via the `heyotto-tasks-data` skill (token in `HEYOTTO_TASKS_TOKEN`). It can connect one or more Google accounts (Indstillinger → Forbindelser). Its own agent, shown in the app as **Assistenten** (M7: Claude API + the OS's own read-only tools, run log, daily budget), lives in `server/agent/`. "Otto" means only HeyOtto Studio's agent (and the Hey Otto mascot). Tasks can send a task to Studio ("Send til Studio", `server/studio.mts`, token `HEYOTTO_TOKEN`). Calendar meetings are synced server-side by `server/google.mts` and readable at `GET /api/calendar`. A forecast (`dashboard/lib/forecast.mjs`, shared by app and server) flags deadlines at risk. Alerts are shown in the app and sent as push notifications by the Worker's hourly cron (`server/alerts.mts`). Nothing is tied to one person's account. See `dashboard/README.md` ("Google: kalender og mail"). Planned iterations (M1–M15; M10–M15 = Cloudflare, API tokens, Access, MCP and the connection to HeyOtto Studio) live in `projects/heyotto-os-iterationer/`.
- `.claude/skills/` — packaged, repeatable workflows that any agent can invoke consistently. See `.claude/skills/README.md`. Real skills so far: `heyotto-tasks-data` (read and change HeyOtto Tasks data through its `/ext` API), plus two ported from claude.ai Project drafts and adapted to this environment's tools: `personal-assistant-dashboard` (daily/weekly status dashboard for `personal-assistant`, covering calendar + email + Asana tasks as one routine) and `meta-ads-weekly` (weekly Meta Ads performance dashboard for `marketing-specialist`, proposals-only per `reference/marketing-specialist-playbook.md`).

## Working conventions

- Confirm before any action with real-world side effects: sending email, responding to calendar invites, launching/editing live ad campaigns, spending budget. Read-only lookups don't need confirmation.
- Cite real numbers pulled from tools — never estimate or guess metrics, budgets, or performance figures.
- If a task needs a connector that isn't set up, say so explicitly instead of working around it.
