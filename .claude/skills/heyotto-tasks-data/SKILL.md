---
name: heyotto-tasks-data
description: Read and change Kasper's HeyOtto Tasks data (tasks, projects, sprints, routines, calendar) through its API at tasks-api.heyotto.win/ext. Use when asked to add, update or close tasks or sprints in "HeyOtto Tasks" / "Tasks" / "HeyOtto OS" / "dashboardet", to put Asana tasks into it, to comment on a task, or to report what is in it.
---

# HeyOtto Tasks data

HeyOtto Tasks is Kasper's project and capacity app on Cloudflare Workers. The app is at `https://tasks.heyotto.win` behind Cloudflare Access; you can't reach it. You work through its API at **`https://tasks-api.heyotto.win/ext`** (`server/ext.mts`, documented in `dashboard/README.md` under "API'et /ext"). All data lives in Cloudflare D1. **There are no data files.** Never ask Kasper to download, upload or hand over a file.

## 1. Access

- The token is the environment variable `HEYOTTO_TASKS_TOKEN` (`tsk_…`), sent as `Authorization: Bearer $HEYOTTO_TASKS_TOKEN`. Never print it, log it, write it to a file in the repo, or ask Kasper to paste it into the chat.
- Start with `GET /ext/health`. It returns the token's name and scopes (`read`, `write`).
- `HEYOTTO_TASKS_TOKEN` missing, or **401** (unknown or revoked token) → stop and tell Kasper, in Danish:
  1. Open HeyOtto Tasks → **Indstillinger → API-tokens** → make a token named "Claude" with **Læse** and **Skrive**.
  2. Save it as the environment variable `HEYOTTO_TASKS_TOKEN`: on this PC under Windows' *Rediger miljøvariabler for din konto*, or in a cloud environment's settings (environment menu → Edit).
  3. Restart VS Code / start a new session.
- **403** → the token lacks the scope named in the message. Kasper makes a new token with that scope.
- **429** → more than 60 calls a minute. Wait a minute.
- Refused by the network policy (cloud sessions) → tell Kasper to add `tasks-api.heyotto.win` under **Network access → Custom → Allowed domains**, keeping the default list.
- Do not work around a missing connection, and never report changes you could not save.

## 2. Read

| Call | Returns |
|---|---|
| `GET /ext/tasks` | open tasks. Filters: `status`, `project`, `due_before=YYYY-MM-DD`, `include_done=true` |
| `GET /ext/tasks/:id` | one task, with `note` and `comments` |
| `GET /ext/projects` | `id, name, kind, tagline, openTasks, doneTasks` |
| `GET /ext/sprints?project=` | `project, month, goal` |
| `GET /ext/routines` | recurring tasks (read only here) |
| `GET /ext/calendar` | `{ snapshot }`: meetings from Kasper's connected Google accounts, 7 days back to 12 weeks ahead. `null` = nothing connected: say so rather than guessing at meetings |

```bash
curl -sS -H "Authorization: Bearer $HEYOTTO_TASKS_TOKEN" "https://tasks-api.heyotto.win/ext/tasks?due_before=2026-12-01"
```

On Windows without `python3`, use `node` with `fetch` for scripts.

## 3. Change

Each change is a small call. The server reads, changes and saves with a version check, so you never send the whole data set and never handle conflicts yourself. Every save is listed in the app's **Historik** under the token's name and can be undone there.

| Call | Body |
|---|---|
| `POST /ext/tasks` → 201 | `title` (required), `project` (an id from `/ext/projects`; left out = "Uden projekt"), `status`, `due`, `owner`, `note`, `hours`, `remaining`, `priority`, `sprint` |
| `PATCH /ext/tasks/:id` | any of the fields above except `project` |
| `POST /ext/tasks/:id/comments` → 201 | `{ "text": "…" }`, max 4000 characters. Use this to report back on a task |
| `POST /ext/sprints` → 201 | `{ project, month: "YYYY-MM", goal }`. 409 if the project already has that month |

```bash
curl -sS -X PATCH -H "Authorization: Bearer $HEYOTTO_TASKS_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"Færdig"}' https://tasks-api.heyotto.win/ext/tasks/web-12
```

**400** means a field is wrong. The Danish message says which and what is allowed. Unknown fields are refused, not ignored.

**Only in the app** (tell Kasper to do it there): deleting anything, moving a task to another project, creating or changing projects and routines, Google connections, and undoing a save.

## 4. Data rules

The server checks the shape. What it can't check is up to you:

- **status** is exactly one of: `"Ikke startet"`, `"I gang"`, `"Blokeret"`, `"Færdig"`, `"Droppet"`.
- **due** is a date (`"YYYY-MM-DD"`) or `""`.
- **hours** is hours per week *right now* (0–40), not in total. If the task doesn't take time this week, it's 0.
- **remaining** (optional) is the estimated hours left *in total*. The forecast and alerts use it. Leave it out when unknown; never guess it. If Kasper gives an estimate, send it as a number.
- **priority** is `"høj"`, `"normal"` or `"lav"`.
- **sprint** is a month (`"YYYY-MM"`) that must exist for the task's project. Create it with `POST /ext/sprints` first if needed. New tasks are placed in the current month.
- The `adhoc` project is **"Uden projekt"**: put small one-off tasks there, not in a real project.
- **Never invent** hours, dates or owners. Leave them out, and tell Kasper what is missing.
- Tasks with `routine` set are made by the app from a routine. Don't create those by hand.

Tasks Kasper sends to HeyOtto Studio from the app ("Send til Studio") are handled by Studio, not by you. Studio's reply arrives as a comment by "Studio".

## 5. Conventions

- Ask Kasper before changing many items at once (roughly 10 or more). Additions and edits he asked for directly need no extra confirmation.
- If Kasper has unsaved edits open in the app, his next save is merged with yours where possible. Mention it if you changed the same task.
- Report back in Danish:
  - which items changed, by title
  - that the changes show up when he reloads the app
  - that the save is listed in **Historik** under the token's name and can be undone there
