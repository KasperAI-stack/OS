---
Last verified against live Planner data: 2026-08-21
---

# Personal assistant playbook — Africa Tours marketing

Durable domain knowledge for the `personal-assistant` agent and the `africatours-planner-assistant` skill. This file is the source of truth for board structure and open data-quality issues — update it whenever something here turns out to be wrong or changes live in Planner.

## Role

Daily status (mentally targeted at ~07:00) and weekly review (Monday, ~08:00) covering: today's Planner priorities, today's calendar, unanswered email. See the skill for the executable procedure and delivery mechanics.

## The Planner boards — confirmed structure (verified 2026-08-21)

All IDs below were pulled live via `custom_api_call` against Microsoft Graph. **Use these IDs directly rather than re-resolving names with `findAPlan`** — several plan names collide (see Data-quality issues below), so name lookup is not reliable here.

| Board | Plan ID | Buckets (as found) | Notes |
|---|---|---|---|
| **Marketing HQ** | `5mXZ3vtbx0uNHhPR1SIhNpYAEkt7` | To do, Planned, Doing, Done, Events, Web | Operational catch-all — today's concrete tasks usually live here. One more bucket ("Web") than the original assumption of 5. |
| **Paid Ads** | `7Vi_lzsu7USHuayimxLeP5YABzVw` | Sandbox, Produciton *(sic — real bucket name is misspelled)*, Active *(trailing space in real name)*, Done, Stuck | Flag Stuck prominently in weekly review. |
| **Events** | `6evlpc74B06M7_RQ5qRzU5YAFJ4p` | Sandbox, Brainstorming, Planlagt, Afholdte, Stuck | Matches original assumption exactly. |
| **Email** | `e85jp4yjI0iQypVRb7ozPJYAB9WY` | Brainstorm, Planlagt, Producerer, Upcoming, Shipped, Stuck | Confirmed — was previously unverified. Own pipeline, distinct naming from other boards. |
| **Opstart** | `wXglhfkk8E63Im3xNhXj6ZYACtC7` | Email, Meta, Website, Performance, SEO, Google ads, Diverse | **Correction:** this is not a simple personal to-do board — buckets are organized by marketing channel. Still treated as low-priority/background per Kasper's original framing, but don't assume the old 5-stage-pipeline shape if actually reading it. |
| **Årshjul** (active) | `09uz648nC0KQ9oYfUOVPhZYAAOft` | 11 month buckets (Jan–Aug, Nov, Dec separate; Jun/Jul merged into one bucket) | **Use this one.** Created 2026-08-19, holds the real launch items (Vinsmagning, website relaunch, logo launch, CRM launch, lead campaign launch, etc.) — matches the intended "12-month initiative wheel" role. |

## Data-quality issues found 2026-08-21 — resolve with Kasper before trusting automation fully

1. **Duplicate "Årshjul" plan.** A second plan also named "Årshjul" exists — plan ID `4BtoadsZj060Cs-fl8npfZYAA8ov`, created 2026-08-13 (older), contains 1 bucket ("September") and **zero tasks**. It's almost certainly an abandoned duplicate. Recommend Kasper deletes it in the Planner UI (deletion isn't exposed as a safe action via this MCP). Until deleted, the skill hardcodes the *other* plan ID above — don't let a future run re-resolve "Årshjul" by name and pick the wrong one.
2. **Unaccounted-for plan: "Årsplan".** Plan ID `EbzggKJBKUGip04Hu-n_LpYAF-1I`, not mentioned anywhere in the original playbook. 12 month buckets, 9 tasks that look like general ops/project work (website 2.0 build, CRM rollout, ad production) rather than launch milestones. Ask Kasper: is this a legacy board to ignore, or should it be folded into weekly review alongside Årshjul?
3. **Vinsmagning date conflict — now pinned down exactly, still needs Kasper's call:**
   - Årshjul (`09uz648...`) task **"Vinsmagning"** → due **2026-11-18**, sits in the "December" bucket (bucket assignment itself looks stale/wrong too).
   - Events (`6evlpc74...`) task **"Vinsmagning / Horsens and friends? / Hotel"** → due **2026-11-11**.
   - These read as the same real-world event with two different dates recorded in two places. Ask Kasper which date is correct, then update both tasks to match.

## Prioritization logic ("what should I work on today")

Combine high priority + close deadline. Rank:

1. Overdue (due date < today)
2. High priority (Urgent/Important, or a ❗ marker) **and** due within the next few days
3. Due today
4. High priority without a near deadline
5. Everything else — mention briefly as background/backlog only, never as "work on today"

## Calendar (Outlook)

`outlook_calendar_search` with `query: "*"`, `afterDateTime: "today"`, `beforeDateTime: "tomorrow"`. Filter out any event whose `start.dateTime` date isn't actually today (timezone rounding can leak in a next-day event). Show time, title, attendees. **Flag double-bookings** (overlapping times) clearly — happens regularly.

## Unanswered email (Outlook)

No native "unanswered" filter exists. Method:

1. Fetch Inbox for the last 3 weekdays: `outlook_email_search`, `folderName: "Inbox"`, `afterDateTime: "3 days ago"`, `order: "newest"`, `limit: 25` (paginate if needed).
2. Fetch Sent Items for the same window, same call shape.
3. For each Inbox mail where Kasper is a direct recipient (not just cc/newsletter/calendar invite): check whether a Sent Items mail to the same sender exists with `sentDateTime` after the Inbox mail's `receivedDateTime`. If not → counts as unanswered.
4. Exclude pure FYI/group broadcasts, calendar invites, and automated newsletters — focus on mail with a real question/action for Kasper.
5. Unread mail (`isRead: false`) is always included.

This is an approximation, not thread analysis — don't call that out in the dashboard itself, but stay conservative: only include mail where it's reasonably clear Kasper still owes a reply.

## Dashboard content

**Daily** (in order): connection-failure banner (if any) → today's calendar (flag double-bookings) → unanswered mail → today's Planner priorities (3–6 items, board + deadline, per the ranking above) → "needs attention" (overdue tasks, Stuck cards, anything needing a decision).

**Weekly** (Monday): done last week (moved to Done/Afholdte since last Monday) → still missing from last week (expected but not done) → attention points (Stuck cards, overdue items, cross-board inconsistencies like the Vinsmagning date conflict) → focus for the coming week (upcoming deadlines from Årshjul + other boards, next 7 days).

## Open items still needing Kasper's input

- Which "Vinsmagning" date is correct — 11/11 or 18/11 (see Data-quality issues above)
- Whether the "Årsplan" board (separate from Årshjul) should be part of weekly review
- Delete or repurpose the empty duplicate "Årshjul" plan
- First full daily/weekly test run to sanity-check the dashboard output before trusting the scheduled version
