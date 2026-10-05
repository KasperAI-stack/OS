---
name: heyotto-os-data
description: Read and change Kasper's HeyOtto OS dashboard data (projects, sprints, tasks, capacity, week log) through its API at heyotto-os.netlify.app. Use when asked to add, update, move or close tasks, sprints or projects in "HeyOtto OS" / "dashboardet", to put Asana tasks into the dashboard, or to report what is in it.
---

# HeyOtto OS data

HeyOtto OS is a web app (`dashboard/index.html`, deployed on Netlify). All content lives in Netlify Blobs behind `https://heyotto-os.netlify.app/api` (`netlify/functions/api.mts`). **There are no data files.** Never ask Kasper to download, upload or hand over a file.

## 1. Access

- The key is the environment variable `HEYOTTO_API_KEY`, sent as `Authorization: Bearer $HEYOTTO_API_KEY`. Never print it, log it, write it to a file in the repo, or ask Kasper to paste it into the chat.
- `HEYOTTO_API_KEY` missing, or the API answers **401** (the key was replaced or removed) → stop and tell Kasper, in Danish: open HeyOtto OS → **Claude-adgang** → make a key, add it as the environment variable `HEYOTTO_API_KEY` in this environment's settings (environment menu in the session title bar → Edit), and start a new session.
- The request is refused by the network policy → tell Kasper to add `heyotto-os.netlify.app` under **Network access → Custom → Allowed domains** in the same settings, keeping the default list.
- Do not work around a missing connection, and never report changes you could not save.

## 2. Read

```bash
curl -sS -H "Authorization: Bearer $HEYOTTO_API_KEY" https://heyotto-os.netlify.app/api/data > /tmp/heyotto.json
```

The response is `{ "rev": "...", "data": { meta, kapacitet, uger, epics, projects, sprints, tasks } }`.

## 3. Change: always read, change, then write with `rev`

1. GET fresh data right before changing anything. Never reuse data from earlier in the conversation.
2. Change it with a small script, by `id`. Leave everything you were not asked to touch exactly as it is.
3. PUT `{ "rev": <the rev you got>, "data": <the whole changed object> }` with `Content-Type: application/json`.
4. **409** means someone saved in between (Kasper in the browser, or his phone). GET again, re-apply the same change to the fresh data, and PUT again. Never overwrite without the current `rev`.
5. **400** means the data has the wrong shape. Fix it per the Danish message.

```bash
python3 - <<'EOF'
import json, os, urllib.request, datetime
URL = "https://heyotto-os.netlify.app/api/data"
H = {"Authorization": "Bearer " + os.environ["HEYOTTO_API_KEY"]}
got = json.load(urllib.request.urlopen(urllib.request.Request(URL, headers=H)))
data = got["data"]

data["tasks"].append({"id": "web-12", "project": "web", "sprint": "2026-10", "start": "2026-10", "end": "2026-10",
                      "status": "Ikke startet", "title": "…", "owner": "", "due": "", "epic": "", "hours": 0, "note": ""})
data["meta"]["updated"] = datetime.date.today().isoformat()

body = json.dumps({"rev": got["rev"], "data": data}).encode()
req = urllib.request.Request(URL, data=body, method="PUT", headers={**H, "Content-Type": "application/json"})
print(json.load(urllib.request.urlopen(req)))   # {"rev": "..."}; HTTPError 409 → start over from the GET
EOF
```

## 4. Data rules

The full contract is in `dashboard/README.md` under "Datakontrakten". The rules that most often go wrong:

- **status** is exactly one of: `"Ikke startet"`, `"I gang"`, `"Blokeret"`, `"Færdig"`, `"Droppet"`.
- **sprint / start / end** are months (`"YYYY-MM"`). **due** is a date (`"YYYY-MM-DD"`) or `""`.
- **hours** is hours per week *right now*, not in total. If the task doesn't take time this week, it's 0.
- **id** is short and unique, and is never changed. Follow the project's existing pattern (e.g. `web-12`).
- **project** must be an existing project `id`.
- **sprint** must exist for that project and month. Add the sprint (`{project, month, goal}`) if it doesn't.
- Fill every task field (`id, project, sprint, start, end, status, title, owner, due, epic, hours, note`). Use `""` / `0` when something is unknown.
- **Never invent** hours, dates or owners. Leave them empty, and tell Kasper what is missing.
- A project's **kind** (`drift` / `projekt` / `adhoc`) decides where its hours count on the capacity page.
- Set `meta.updated` to today's date when you change something.

## 5. Conventions

- Ask Kasper before deleting anything or changing many items at once (roughly 10 or more). Additions and edits he asked for directly need no extra confirmation.
- If Kasper might have unsaved edits open in the browser, mention it. His next save will be refused with a clear message, and his edits are kept in the browser's draft.
- Report back in Danish:
  - which items changed, by title
  - that the changes show up when he reloads the page
  - that the save is listed in **Historik** as "gemt af Claude" and can be undone there (`POST /api/history/<id>/restore` also works)
