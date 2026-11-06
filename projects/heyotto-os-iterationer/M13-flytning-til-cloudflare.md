# M13: Tasks går live på Cloudflare

**Status (2026-11-06):** planlagt. Bygger på M10–M12. Først når adgangsvagten og Access er på plads, går Tasks live.

**Ingen data flyttes** (Kasper, 2026-11-06). Tasks starter forfra på Cloudflare. Netlify er allerede væk fra koden (M10), og det gamle site slettes til sidst.

## Mål

`tasks-ui.heyotto.win` er HeyOtto Tasks, med Google forbundet og push slået til. Det gamle Netlify-site er slettet.

## Rækkefølge (ca. 20 minutter)

1. **Produktion i Cloudflare:** `npx wrangler d1 create heyotto-tasks`, `npx wrangler queues create heyotto-tasks-otto`, database-id i `wrangler.jsonc`, og `npx wrangler d1 migrations apply heyotto-tasks --remote`.
2. **Hemmeligheder** med `npx wrangler secret put`:
   - `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`
   - `CLAUDE_ROUTINE_URL`, `CLAUDE_ROUTINE_TOKEN` (kun hvis routinen bruges)
   - `APP_URL` = `https://tasks-ui.heyotto.win` (i `vars`)
3. **Deploy** (`npx wrangler deploy --env=""`) med custom domains `tasks-ui.heyotto.win` og `tasks.heyotto.win`.
4. **Google:** sæt `https://tasks-ui.heyotto.win/api/google/callback` som redirect-adresse i OAuth-klienten. Forbind kalender og mail igen under Indstillinger → Forbindelser.
5. **Push:** slå notifikationer til på pc og telefon (Indstillinger → Notifikationer).
6. **Opdatér henvisninger** til den nye adresse:
   - `CLAUDE.md`
   - `heyotto-os-data`-skillen (omdøbes til `heyotto-tasks-data`, bruger API-token fra M11)
   - `heyotto-os-job`-skillen
7. **Slet Netlify-sitet**, og frakobl GitHub-repoet fra Netlify.

## Kasper skal selv

- Forbinde Google igen og slå push til på hver enhed.
- Slette Netlify-sitet.

## Færdig når

- Alt i appen virker på `tasks-ui.heyotto.win`
- Otto-kørsler, kalendersync, alarmer og push kører på Cloudflare
- Skillsene bruger den nye adresse
- Netlify-sitet er slettet
