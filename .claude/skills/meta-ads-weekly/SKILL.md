---
name: meta-ads-weekly
description: Africa Tours' weekly Meta Ads performance analysis and HTML dashboard for the Africa Tours ad account (338620318). Use when asked for "ads performance", "meta ads report", "weekly ads dashboard", or when running the scheduled Monday check-in.
---

Ported from a claude.ai Project scheduled-task prompt (2026-08-17, referenced there as skill `africatours-meta-ads-weekly` — that skill was never actually built in that environment either; this is the first real implementation) and adapted to this repo's tools. See `reference/marketing-specialist-playbook.md` for standing account/autonomy/competitor context — read it first if anything below is unclear or looks stale.

**Account & conversion context:** Meta ad account `338620318` (DKK), Africa Tours only — see the playbook for why Digital Athletes is excluded pending confirmation. Primary conversion event is **"Køb"** (Meta's standard Purchase pixel event), used as a working proxy for "request a quote"/lead — **not** a real e-commerce purchase (see the playbook's Primary KPI section). Two tracks stay separate from the primary: **"Rejseforedrag"** custom conversion (id `3929613057173615`) and the campaign **"KAS_08:26_Trafik_Kenya Kampagne"** (currently mis-optimized toward landing-page views instead of Purchase — keep flagging until fixed).

Always pull data live via the Meta Ads MCP — never guess or reuse stale numbers: `mcp__claude_ai_Meta_Ads_MCP__ads_get_ad_entities`, `ads_insights_performance_trend`, `ads_insights_anomaly_signal`, `ads_get_opportunity_score`.

## 1. Account-level numbers

Spend, number of Purchases, price per Purchase, CTR, CPM, frequency for the last 30 days vs. the 30 days before that, plus a 90-day trend.

## 2. Campaign-level, three panels

Split into three panels — **Køb** (primary), **Rejseforedrag** (secondary), **Kenya/Bestil tilbud** (secondary, its own line) — and categorize every active element:
- ✅ working / ❌ not working / 🕒 too early to tell
- 🕒 always applies under ~5–7 days of runtime or under 50 clicks
- frequency > 3.5 → warning
- falling CTR + rising frequency → creative fatigue

## 3. Anomalies and opportunities

Run the anomaly-signal and opportunity-score tools; include the most important new findings.

## 4. Account hygiene

Count active campaigns/ad sets with 0 kr spend.

## 5. Build the dashboard

Self-contained HTML, **in Danish**: top bar (spend/Køb/CPA + change, color-coded), 90-day trend chart, the three campaign panels color-coded ✅/❌/🕒, an "Obs" section listing only warnings that actually trigger (frequency > 3.5, CPA increase > 25%, CTR drop > 20%, zero-spend "ghost" campaigns running 14+ days, Meta's own narrow-audience/budget-limited signals), and 2–3 prioritized recommendations (what/why/expected effect — **never executed automatically**). Before writing the HTML, consider loading the `dataviz` skill for the trend chart/panels and `artifact-design` for the overall pass, same as `personal-assistant-dashboard` does.

Always include this fixed note verbatim: *"Uafklaret: pixlen fyrer også de rå hændelser 'tilbud' og 'bestil_tilbud', som ikke er bygget til Custom Conversions og ikke bruges af nogen kampagne — afklar med webudvikler om det er redundant tracking."*

## 6. Deliver

Attempt all three; complete the others even if one fails:

1. **Publish via Artifact** using a fixed file path (e.g. `.../scratchpad/meta-ads-dashboard.html`) so re-runs update the same URL. This is this repo's replacement for the original draft's `SendUserFile`, which doesn't exist here (same substitution `personal-assistant-dashboard` makes).
2. **Upload to SharePoint**: site "ATsharepoint", folder "Delte dokumenter/Marketing/Ugenlig rapportering", filename `meta-ads-dashboard-ÅÅÅÅ-MM-DD.html` (today's date). Resolve the site/folder's `driveId`/`parentItemId` via `mcp__claude_ai_Microsoft_365__sharepoint_folder_search` first, then `sharepoint_upload_file`.
3. **Create an Outlook draft** (`mcp__claude_ai_Microsoft_365__outlook_create_draft`) to ka@africatours.dk with a short Danish summary and the Artifact link in the body — **do not send it**. Unlike the original draft (which auto-sent), this repo's working convention requires Kasper to confirm before any email goes out (`CLAUDE.md`), and `outlook_create_draft` has no attachment support anyway, so the dashboard is linked, not attached.

End the run's final message with the artifact URL, the draft's webLink, and a one-paragraph Danish summary.

## Autonomy

This skill may **only** analyze, categorize, and propose. It must **never** create, pause, edit budgets on, or otherwise change anything live in the Meta ad account — reporting and proposals only, per `reference/marketing-specialist-playbook.md`. Write all dashboard/summary content in Danish.

## Automation

Scheduled as a cloud routine via the `schedule` skill (`RemoteTrigger`) — every Monday, 07:00 Europe/Copenhagen. Cloud routines run in UTC and don't auto-adjust for DST — re-check the offset after the late-October 2026 clock change. The routine's prompt is self-contained and reads this skill plus the playbook from the git repo, so edits here only take effect on the next scheduled run once committed and pushed.
