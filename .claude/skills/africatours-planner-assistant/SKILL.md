---
name: africatours-planner-assistant
description: Produces Kasper's daily or weekly status dashboard (Planner tasks, today's calendar, unanswered email) as a published HTML artifact. Use when asked for "today's status", "daily update", "weekly review", or when running the scheduled morning/Monday check-in. Args — "daily" or "weekly".
---

Ported from a claude.ai Project playbook (2026-08-19) and adapted to Claude Code's actual tools — the original used `SendUserFile` / Cowork artifacts and native scheduling, neither of which exist here. This version uses the **Artifact** tool for delivery and the **schedule** skill (CronCreate) for recurring runs. See `reference/personal-assistant-playbook.md` for the full domain knowledge (board structure, prioritization logic, known data-quality issues) this skill assumes — read it first if anything below is unclear or looks stale.

## 0. Check the Planner connection before anything else

Do one real (not just `ap_list_connections`) read call, e.g.:
```
ap_run_action: piece "@activepieces/piece-microsoft-365-planner", action "findAPlan",
connectionExternalId "BXf3j03Db1DxU9518gpcK", input {"title": "a"}
```
`ap_list_connections` reporting "ACTIVE" means nothing — it's cached, not a live check (this has bitten us before, see connections.md). If the real call fails (e.g. "Lifetime validation failed, the token is expired"): stop trying to fetch Planner data, don't guess or reuse stale data, and carry a clear banner in the dashboard saying the Planner connection needs Kasper to reconnect it (Activepieces → Settings → Connections → Microsoft 365 Planner → Reconnect). Continue with calendar and email regardless — they're independent.

## 1. Calendar (today only, both daily and weekly runs)

`mcp__claude_ai_Microsoft_365__outlook_calendar_search` with `query: "*"`, `afterDateTime: "today"`, `beforeDateTime: "tomorrow"`. Drop any event whose `start.dateTime` isn't actually today. Flag overlapping-time meetings as double-bookings.

## 2. Unanswered email

Follow the Inbox-vs-Sent-Items comparison method in `reference/personal-assistant-playbook.md` under "Unanswered email". Only include mail that's reasonably clearly awaiting a reply — don't over-include FYI/group mail.

## 3. Planner tasks (only if step 0 succeeded)

Use `custom_api_call` (GET) against Microsoft Graph, not `findAPlan`/`findTask` — the latter only substring-search and plan names collide in this account. Use the **plan IDs from `reference/personal-assistant-playbook.md`** directly, don't re-resolve by name.

- **Daily:** `GET /planner/plans/{id}/tasks` for Marketing HQ, Paid Ads, Events, Email, Opstart. Skip Årshjul unless something in it is due within the next few days. Apply the prioritization ranking from the playbook; pick 3–6 items for "today".
- **Weekly:** same boards plus Årshjul. For "done last week" and "missing from last week", read `completedDateTime` and `dueDateTime` off each task (`GET /planner/tasks/{id}/details` or `$select` on the list call) rather than inventing a history you don't have — Planner's API gives you a snapshot, not a diff. If `completedDateTime` isn't populated reliably, say so rather than presenting an approximate "done last week" list as exact.
- **Don't detect "done" by bucket alone.** In Marketing HQ, the Done bucket is empty — completed tasks (`percentComplete: 100`) stay wherever they were created. Always check `percentComplete`/`completedDateTime`, never assume bucket name = status.
- **Paid Ads has no due dates on any task** — it can't feed the date-based ranking at all. Surface it separately by bucket position instead: what's in Active (with checklist progress), what's sitting in Stuck.
- **Don't lean on the `priority` field** — it's 5 (Medium/default) on nearly every task across every board right now, so it doesn't meaningfully distinguish anything. Deadline is carrying the real prioritization signal today.
- Always flag `Stuck` bucket contents in Paid Ads/Email/Events. In Paid Ads specifically, decode `appliedCategories` against the plan's `categoryDescriptions` (`category1`="Awerness", `category2`="Lead gen", `category4`="Sales") so Stuck items show their real tag, not a raw category number.
- Known open data issues to keep surfacing until Kasper resolves them (don't silently pick one or merge them yourself): the duplicate empty "Årshjul" plan, the unclear status of the "Årsplan" plan, the Vinsmagning date conflict (18/11 in Årshjul vs 11/11 in Events), and the duplicate tasks in Marketing HQ ("Byg agent - Find skills og MCP'er" ×2, "GTM - event registrering" ×2, "Mere fokus på hotellerne" ×2) — see the playbook for exact task IDs.

## 4. Build the dashboard

Follow the section structure in `reference/personal-assistant-playbook.md` under "Dashboard content" (daily vs weekly). Before writing the HTML, load the `artifact-design` skill to calibrate the visual pass — this is a real recurring deliverable, not a throwaway page, so it's worth a proper design pass once and then reusing the pattern. Requirements: self-contained HTML, inline CSS, no external calls, theme-aware (light/dark), scannable cards with clear section breaks, color-coded badges for overdue/today/high-priority.

## 5. Deliver via Artifact

Write the HTML to a scratch file, then publish with the **Artifact** tool using a fixed file path per run type so redeploys update the same URL instead of creating a new artifact each time:
- Daily: always use the same file path, e.g. `.../scratchpad/kasper-daglig-status.html`
- Weekly: always use the same file path, e.g. `.../scratchpad/kasper-ugentlig-status.html`

Report the artifact URL back to Kasper in the chat response. If this run is happening inside a scheduled/background context, the URL still needs to reach him somehow (chat message on completion) — there's no equivalent of `SendUserFile` here, the Artifact link is the delivery mechanism.

## Automation

Not yet scheduled. Per the plan agreed with Kasper: do a full manual daily and weekly run first to validate the board IDs, the dashboard content, and the still-open data issues above — only then set up recurring runs via the `schedule` skill (CronCreate), targeting ~07:00 daily and Monday ~08:00, Europe/Copenhagen. Note CronCreate schedules typically run in UTC and won't auto-adjust for DST — re-check the offset after the late-October 2026 clock change.
