# M13: Flytningen: Tasks går live på Cloudflare

**Status (2026-11-06):** planlagt. Bygger på M10–M12. Først når adgangsvagten og Access er på plads, flytter de rigtige data.

## Mål

`tasks-ui.heyotto.win` er HeyOtto Tasks. Data, Google-forbindelser og Claude-token er flyttet, og det gamle Netlify-site er slettet.

Netlify er allerede væk fra koden (M10). Det eneste, der er tilbage derovre, er de nuværende data og det kørende site, som ikke ændres mere.

## Rækkefølge (flyttedag, ca. 30 minutter)

1. **Rør ikke den gamle app**, mens der kopieres.
2. **Kopiér data** til produktions-D1 med `scripts/copy-blobs-to-d1.mjs`. Alle nøgler kommer med: `data`, Historik, `auth/server-secret` (så Google-tokens kan læses), Claude-nøglen, `agent/*`, `agent-runs/*`, `inbox/*`, `plans/*` og kalender-snapshots.
3. **Tjek**, at antal nøgler og længden af `data` er ens (scriptet skriver begge dele).
4. **Hemmeligheder** med `wrangler secret put`:
   - `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`
   - `CLAUDE_ROUTINE_URL`, `CLAUDE_ROUTINE_TOKEN`
   - `APP_URL` = `https://tasks-ui.heyotto.win`
5. **Google:** sæt `https://tasks-ui.heyotto.win/api/google/callback` som redirect-adresse i OAuth-klienten, og fjern den gamle. Appen viser den præcise adresse under Forbindelser.
6. **Opdatér henvisninger** til `tasks-ui.heyotto.win` (appens `/api`) eller `tasks.heyotto.win/ext` (API'et med token), alt efter hvad skillen gør:
   - `CLAUDE.md`
   - `heyotto-os-data`-skillen (omdøbes til `heyotto-tasks-data`)
   - `heyotto-os-job`-skillen
7. **Slet Netlify-sitet**, og frakobl GitHub-repoet fra Netlify, så det ikke bygger mere.

## Det, der ikke kan flyttes

- **Push-notifikationer** er bundet til adressen. Slå dem til igen på hver enhed (Indstillinger → Notifikationer).
- **Login:** du logger ind igen på den nye adresse via Access.

## Hvis noget går galt

Data i D1 kan altid hentes igen fra det gamle site, indtil det er slettet. Slet det derfor først, når du har brugt Tasks på Cloudflare i et par dage.

## Kasper skal selv

- Vælge flyttedagen.
- Rette redirect-adressen i Google Cloud Console.
- Slå push til igen på pc og telefon.
- Slette Netlify-sitet til sidst.

## Færdig når

- Alt i appen virker på `tasks-ui.heyotto.win`, og Google-forbindelserne virker uden at forbinde igen
- Otto-kørsler, kalendersync, alarmer og push kører på Cloudflare
- Skillsene bruger den nye adresse
- Netlify-sitet er slettet
