# M13: Tasks går live på Cloudflare

**Status (2026-11-06):** næsten færdig. Tilbage er at slette Netlify-sitet. Push er udskudt.

**Ingen data flyttes** (Kasper, 2026-11-06). Tasks starter forfra på Cloudflare, og der er intet separat testmiljø.

## Gjort

- D1## Gjort

- D1 `heyotto-tasks`, køen `heyotto-tasks-otto` og migrationen
- Workeren deployet med custom domains `tasks.heyotto.win` (appen) og `tasks-api.heyotto.win` (API)
- Det første testmiljø (`tasks-test*`, D1 og kø) er slettet
- Access-applikationen for `tasks.heyotto.win` og AUD-tagget i `wrangler.jsonc`. Appen åbnes uden adgangskode
- Hemmelighederne `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID` og `GOOGLE_CLIENT_SECRET`. Otto kører
- Google forbundet med kalender og mail. Kalenderen "Renas" (den primære) er slået til, og mailen læses
- Skillen hedder nu `heyotto-tasks-data` og bruger et API-token (`HEYOTTO_TASKS_TOKEN`) på `tasks-api.heyotto.win/ext`. `/ext` har fået sprints og kalenderen, så skillen ikke behøver `/api`. Tokenet "Claude" er lavet og virker
- Claude Code Routine-delen ("Lad Claude udføre", ejer "Claude", `heyotto-tasks-job`) er fjernet. Opgaver sendes i stedet til Studio (M15)
- Den gamle Claude-nøgle (`/api/claude-key`) er fjernet fra app og server. Siden Claude-adgang viser i stedet, hvordan man laver et token

## Mangler

1. **Slet Netlify-sitet**, og frakobl GitHub-repoet fra Netlify (Kasper).

**Udskudt:** push på pc og telefon (Kasper, 2026-11-06: "ikke endnu").


- Alt i appen virker på `tasks.heyotto.win` med Access-login
- Otto-kørsler, kalendersync og alarmer kører på Cloudflare (push er udskudt)
- Skillsene bruger den nye adresse
- Netlify-sitet er slettet
