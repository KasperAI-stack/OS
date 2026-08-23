---
Last verified against live Asana data: 2026-08-23
---

# Personal assistant playbook — Africa Tours marketing

Durable domain knowledge for the `personal-assistant` agent and the `personal-assistant-dashboard` skill. This file is the source of truth for board structure and open data-quality issues — update it whenever something here turns out to be wrong or changes live in Asana.

## Role

Daily status (mentally targeted at ~07:00) and weekly review (Monday, ~08:00) covering: today's Asana priorities, today's calendar, unanswered email. See the skill for the executable procedure and delivery mechanics.

## Migration note (2026-08-23)

These boards originally lived in Microsoft Planner, read via a flaky Activepieces connector (recurring Entra token-expiry failures). Kasper moved task tracking to Asana instead. The 6 boards below were rebuilt in Asana as projects with matching sections. Task data for **Paid Ads and Årshjul** was migrated from live Planner screenshots on 2026-08-23. **Marketing HQ, Events, Email, and Opstart are structural skeletons only — sections exist, no tasks migrated yet;** Kasper is filling those in manually. Don't report those four as "empty"/"on track" in a dashboard — say migration is still pending.

Workspace GID: `1217755854232758` (africatours.dk)

## The Asana boards — confirmed structure (as of 2026-08-23)

Use these GIDs directly — don't re-resolve by name.

| Board | Project GID | Sections (GIDs) |
|---|---|---|
| **Marketing HQ** | `1217755828419858` | To do `1217755855315307`, Planned `1217755978022451`, Doing `1217755978044335`, Done `1217755855315371`, Events `1217755828421723`, Web `1217755855315243` |
| **Paid Ads** | `1217755828402211` | Sandbox `1217756055023433`, Produciton *(sic — kept from the original Planner bucket name)* `1217755978042996`, Active `1217755978044848`, Done `1217755855340916`, Stuck `1217755855340852` |
| **Events** | `1217755855341813` | Sandbox `1217755876804548`, Brainstorming `1217756030538210`, Planlagt `1217755876804481`, Afholdte `1217755876804254`, Stuck `1217755978014868` |
| **Email** | `1217755978072754` | Brainstorm `1217755876756061`, Planlagt `1217755876753121`, Producerer `1217755876814076`, Upcoming `1217755876805170`, Shipped `1217755978073718`, Stuck `1217756055132416` |
| **Opstart** | `1217756055078273` | Email `1217755978044853`, Meta `1217756030564819`, Website `1217756030564755`, Performance `1217755876804328`, SEO `1217756055159863`, Google ads `1217756030550686`, Diverse `1217756030564691` |
| **Årshjul** | `1217756030580068` | Untitled *(empty, Asana's auto-created first section — safe to ignore/delete)* `1217756030580092`, Januar `1217755978096559`, Februar `1217755978096495`, Marts `1217755978096623`, April `1217756030582118`, Maj `1217756055167740` *(unconfirmed live — not contradicted, just not seen in a screenshot)*, Jun/Jul `1217755978064202` *(unconfirmed live)*, August `1217756030582022`, September `1217756057587243`, Oktober `1217756069542211`, November `1217756055171854`, December `1217755855357367` |

## Paid Ads and Årshjul — task-level data (migrated 2026-08-23)

**Paid Ads** — 21 tasks migrated from a live Planner screenshot:
- **Sandbox** (11): Grupperejser and Book møde med rådgiver (statisk annonce) were flagged "prioriteret" (!) in Planner — noted in each task's `notes`. Five are tagged "Awerness" *(sic)*: Scrapbook, Engagskamera, Calling Africa, Gæt vinen, Vores ansattes bedste minder. Plus: Anledninger (Bryllup, fødselsdage), Top 10 seværdigheder i X, Testimonial, Blindranking.
- **Produciton** (3): Speciffke rejser ala vinkort *(sic)*, Specifikke rejser ala Strava, A day in my life / POV.
- **Active** (2): "2027" (subtasks: Kamerarulle, Bucketliste, Byg selv, ??) and "Foredrag Viborg" (had a 0/4 checklist in Planner whose items weren't visible in the source screenshot — subtasks not migrated, needs manual follow-up from Kasper).
- **Stuck** (5): all tagged "Lead gen" — Vind denne plakat; 10 myter om Afrika / misforstpelser (som vi afmystificerer ved foredraget); 'Doorstep' 'MTV crip'; "Du har 1 minut til at overbevise os om at deltage i vores foredrag"; Vind denne coffee table book.
- **Done**: not migrated — the one completed task was collapsed/unnamed in the source screenshot.
- Category tags ("Awerness"/"Lead gen") are stored as a `Tag: X` line in each task's `notes` field — no native Asana custom field set up for this yet.

**Årshjul** — 9 tasks migrated:
- September: Lead kampagne lancering (due 2026-09-16)
- Oktober: Byg tilbuds giver-agent (due 2026-10-14), Ambassadør-team test (due 2026-10-06), Logo lancering?? (due 2026-10-15)
- December *(section)*: CRM lancering (due 2026-11-30), Vinsmagning (due 2026-11-18 — see data-quality note below)
- Januar: Tryk af egne rejsebøger (due 2027-01-14)
- Februar: Spot i JP/Politikken med rejsebog (due 2027-02-19)
- Marts: Hjemmeside lancering?? (due 2027-03-27)
- August, November, April: no tasks visible in the source screenshots — not confirmed empty, may still have unmigrated content.

## Data-quality issues found — resolve with Kasper before trusting automation fully

1. **Vinsmagning date/bucket mismatch — confirmed, still needs Kasper's call.** Årshjul's "Vinsmagning" task sits in the December section but is due 2026-11-18. The old Planner Events board also had a "Vinsmagning / Horsens and friends? / Hotel" task due 2026-11-11 — these read as the same real-world event with two different dates recorded. Ask Kasper which date is correct.
2. **Marketing HQ, Events, Email, and Opstart have no tasks in Asana yet.** Kasper is migrating these manually from Planner. Treat empty as "not migrated", never as "nothing due".
3. **Paid Ads "Foredrag Viborg" checklist (0/4 in Planner) wasn't migrated** — the 4 item names weren't visible in the source screenshot.
4. **Årshjul has an extra empty "Untitled section"** (Asana auto-creates a first section on project creation) — cosmetic only, safe for Kasper to delete in the UI.
5. Planner-era issues from before the migration (a duplicate empty "Årshjul" plan, an unclear "Årsplan" plan, duplicate tasks in the old Marketing HQ) applied to the retired Planner boards and don't carry over automatically — they'll resurface here only if Kasper reintroduces them while migrating manually.

## Prioritization logic ("what should I work on today")

Combine high priority + close deadline. Rank:

1. Overdue (due date < today)
2. High priority (Urgent/Important, or a ❗ marker) **and** due within the next few days
3. Due today
4. High priority without a near deadline
5. Everything else — mention briefly as background/backlog only, never as "work on today"

**Caveat carried over from the Planner era:** a generic "priority" field wasn't a useful signal there — deadline did almost all the real prioritization work. Assume the same is true in Asana until Kasper actually starts setting task priority deliberately. Paid Ads specifically has no due dates on any task — it can't participate in date-based ranking; treat it separately by section position (what's in Active with an unfinished checklist, what's sitting in Stuck) rather than trying to rank it against dated tasks from other boards.

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

**Daily** (in order): connection-failure banner (if any) → today's calendar (flag double-bookings) → unanswered mail → today's Asana priorities (3–6 items, board + deadline, per the ranking above) → "needs attention" (overdue tasks, Stuck items, anything needing a decision).

**Weekly** (Monday): done last week (completed in Asana since last Monday) → still missing from last week (expected but not done) → attention points (Stuck items, overdue items, cross-board inconsistencies like the Vinsmagning date conflict) → focus for the coming week (upcoming deadlines from Årshjul + other boards, next 7 days).

## Open items still needing Kasper's input

- Which "Vinsmagning" date is correct — 11/11 or 18/11 (see Data-quality issues above)
- Finish manually migrating Marketing HQ, Events, Email, and Opstart task data from Planner into Asana
- Delete the empty "Untitled section" in Årshjul (cosmetic)
- First full daily/weekly scheduled run to sanity-check the dashboard output now that it's automated
