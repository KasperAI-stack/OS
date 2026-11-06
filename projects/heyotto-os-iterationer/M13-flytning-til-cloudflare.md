# M13: Tasks går live på Cloudflare

**Status (2026-11-06):** i gang. Produktionen kører allerede; det sidste er Access, nøgler og at rydde op.

**Ingen data flyttes** (Kasper, 2026-11-06). Tasks starter forfra på Cloudflare, og der er intet separat testmiljø.

## Gjort

- D1 `heyotto-tasks`, køen `heyotto-tasks-otto` og migrationen
- Workeren deployet med custom domains `tasks.heyotto.win` (appen) og `tasks-api.heyotto.win` (API)
- Det første testmiljø (`tasks-test*`, D1 og kø) er slettet

## Mangler

1. **Access** (M12): applikationen for `tasks.heyotto.win` og AUD-tagget i `wrangler.jsonc`. Så kan appen åbnes, uden adgangskode.
2. **Hemmeligheder** med `npx wrangler secret put`: `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (og `CLAUDE_ROUTINE_URL`/`CLAUDE_ROUTINE_TOKEN`, hvis routinen bruges).
3. **Google:** `https://tasks.heyotto.win/api/google/callback` som redirect-adresse i OAuth-klienten. Forbind kalender og mail igen under Indstillinger → Forbindelser.
4. **Push:** slå notifikationer til på pc og telefon.
5. **Henvisninger** til den nye adresse: `CLAUDE.md`, `heyotto-os-data`-skillen (omdøbes til `heyotto-tasks-data` og bruger et API-token på `tasks-api.heyotto.win/ext`) og `heyotto-os-job`-skillen.
6. **Slet Netlify-sitet**, og frakobl GitHub-repoet fra Netlify.

## Færdig når

- Alt i appen virker på `tasks.heyotto.win` med Access-login
- Otto-kørsler, kalendersync, alarmer og push kører på Cloudflare
- Skillsene bruger den nye adresse
- Netlify-sitet er slettet
