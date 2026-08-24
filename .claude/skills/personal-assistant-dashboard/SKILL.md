---
name: personal-assistant-dashboard
description: Kasper's daily or weekly personal-assistant routine — reviews his calendar, inbox, and Asana to-do lists together and produces one HTML dashboard covering all three. Use when asked for "today's status", "daily update", "weekly review", or when running the scheduled morning/Monday check-in. Args — "daily" or "weekly".
---

The routine has three equal inputs — **calendar, email, tasks** — combined into one dashboard. Don't treat this as a Planner-reporting skill that happens to also glance at calendar/email; all three get read every run and all three feed the same output.

Ported from a claude.ai Project playbook (2026-08-19) and adapted to Claude Code's actual tools — the original used `SendUserFile` / Cowork artifacts and native scheduling, neither of which exist here. This version uses the **Artifact** tool for delivery and the **schedule** skill (CronCreate) for recurring runs. That other environment's saved skill is called `africatours-planner-assistant` — same domain, different system, not to be confused with this one. See `reference/personal-assistant-playbook.md` for the full domain knowledge (board structure, prioritization logic, known data-quality issues) this skill assumes — read it first if anything below is unclear or looks stale.

## 1. Calendar (today only, both daily and weekly runs)

`mcp__claude_ai_Microsoft_365__outlook_calendar_search` with `query: "*"`, `afterDateTime: "today"`, `beforeDateTime: "tomorrow"`. Drop any event whose `start.dateTime` isn't actually today. Flag overlapping-time meetings as double-bookings.

## 2. Unanswered email

Follow the Inbox-vs-Sent-Items comparison method in `reference/personal-assistant-playbook.md` under "Unanswered email". Only include mail that's reasonably clearly awaiting a reply — don't over-include FYI/group mail.

## 3. To-do lists (Asana)

**First, check the connection** with a lightweight read call, e.g. `mcp__claude_ai_Asana__get_me`. If it errors: stop trying to fetch Asana data, don't guess or reuse stale data, and carry a clear banner in the dashboard saying the Asana connection needs attention. Calendar and email sections still run regardless — they're independent of this.

Use the **project and section GIDs from `reference/personal-assistant-playbook.md`** directly, don't re-resolve by name.

- **Daily:** `mcp__claude_ai_Asana__get_tasks` (or `search_tasks` for date filtering), scoped to `project`, `completed=false`/`completed: false`, for Marketing HQ, Paid Ads, Events, Email, Opstart. Skip Årshjul unless something in it is due within the next few days. Apply the prioritization ranking from the playbook; pick 3–6 items for "today".
- **Weekly:** same boards plus Årshjul. For "done last week", use `search_tasks` with `completed: true` and `completed_on_after`/`completed_on_before` bounding the last 7 days. For "missing from last week", compare tasks whose due date fell in that window against which of those are still incomplete.
- **Only Paid Ads and Årshjul currently have real task data** (migrated from Planner screenshots on 2026-08-23). **Marketing HQ, Events, Email, and Opstart are empty section skeletons** — Kasper is filling them in manually. Don't report those four as "nothing due"/"on track"; say migration is still pending instead.
- Paid Ads category tags ("Awerness", "Lead gen") are stored as a `Tag: X` line in each task's `notes` field (no native Asana category field set up yet) — request `notes` via `opt_fields` to surface them, e.g. for Stuck-section items.
- Always flag `Stuck` section contents in Paid Ads/Email/Events.
- Known open data issues to keep surfacing until Kasper resolves them (don't silently pick one or merge them yourself): the Vinsmagning date/bucket mismatch (Årshjul's December section has it due 18/11) — see the playbook's data-quality section for the full list.

## 4. Build the dashboard

One dashboard, three sections (calendar, email, tasks) plus the cross-cutting "needs attention"/"focus for the week" summary — follow the exact section structure in `reference/personal-assistant-playbook.md` under "Dashboard content" (daily vs weekly). Before writing the HTML, load the `artifact-design` skill to calibrate the visual pass — this is a real recurring deliverable, not a throwaway page, so it's worth a proper design pass once and then reusing the pattern. Requirements: self-contained HTML, inline CSS, no external calls, theme-aware (light/dark), scannable cards with clear section breaks, color-coded badges for overdue/today/high-priority.

## 5. Deliver via Artifact

Write the HTML to a scratch file, then publish with the **Artifact** tool using a fixed file path per run type so redeploys update the same URL instead of creating a new artifact each time:
- Daily: always use the same file path, e.g. `.../scratchpad/kasper-daglig-status.html`
- Weekly: always use the same file path, e.g. `.../scratchpad/kasper-ugentlig-status.html`

Report the artifact URL back to Kasper in the chat response. If this run is happening inside a scheduled/background context, the URL still needs to reach him somehow (chat message on completion) — there's no equivalent of `SendUserFile` here, the Artifact link is the delivery mechanism.

## 6. Also upload to SharePoint

The Artifact link is easy to lose track of between runs — mirror the `meta-ads-weekly` skill's approach and also save the HTML to a SharePoint folder Kasper can browse normally (typically synced to his OneDrive/File Explorer), so all dashboards accumulate in one accessible place instead of living only as chat links.

1. `mcp__Microsoft-365__sharepoint_folder_search` for a folder named "Personlig status" under the same Marketing site used by `meta-ads-weekly` (sibling to "Ugenlig rapportering"). If it doesn't exist yet, create it with `sharepoint_create_folder`.
2. Upload the same HTML written for the Artifact with `mcp__Microsoft-365__sharepoint_upload_file`, using a dated filename so history accumulates rather than overwrites — e.g. `daglig-status-YYYY-MM-DD.html` / `ugentlig-status-YYYY-MM-DD.html`.
3. Report both links back to Kasper (Artifact URL + SharePoint webUrl), same pattern as the Meta Ads briefing.

If the SharePoint upload fails, don't let it block delivery — the Artifact publish in step 5 already succeeded and is the primary deliverable; just note the SharePoint upload failed rather than fabricating a link.

## Automation

Scheduled as two cloud routines via the `schedule` skill (`RemoteTrigger` — a cloud agent runs each fire, not this local session):
- Daily briefing — 07:00 Europe/Copenhagen
- Weekly briefing — Monday 08:00 Europe/Copenhagen

Cloud routines run in UTC and don't auto-adjust for DST — re-check the offset after the late-October 2026 clock change. Each routine's prompt is self-contained (the cloud session starts with zero conversation context) and reads this skill plus the playbook from the git repo, so edits here only take effect on the next scheduled run once committed and pushed.
