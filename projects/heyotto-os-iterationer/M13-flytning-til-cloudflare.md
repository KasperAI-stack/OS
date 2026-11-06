# M13: Flytningen: Tasks går live på Cloudflare

**Status (2026-11-06):** planlagt. Bygger på M10–M12. Først når adgangsvagten og Access er på plads, flytter de rigtige data.

## Mål

`tasks-ui.heyotto.win` er HeyOtto Tasks. Data, Google-forbindelser, Claude-token og push er flyttet, og Netlify-sitet er slukket bagefter, med en vej tilbage indtil da.

## Rækkefølge (flyttedag, ca. 30 minutter)

1. **Frys Netlify:** sæt appen skrivebeskyttet (et flag i `data`, så appen viser "Flytter. Kun læsning"), så intet ændres midt i kopieringen.
2. **Kopiér data** fra Netlify Blobs til produktions-D1 med scriptet fra M10. Alle nøgler: `data`, Historik, `auth/server-secret` (så Google-tokens kan læses), Claude-nøglen, `agent/*`, `agent-runs/*`, `inbox/*`, `plans/*`, push-abonnementer og kalender-snapshots.
3. **Tjek:** antal nøgler og en hash af `data` er ens begge steder.
4. **Hemmeligheder** med `wrangler secret put`: `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `CLAUDE_ROUTINE_URL`, `CLAUDE_ROUTINE_TOKEN`. `HEYOTTO_PASSWORD` kun så længe adgangskoden findes.
5. **Google:** tilføj `https://tasks-ui.heyotto.win/api/google/callback` som redirect-adresse i OAuth-klienten. Den gamle bliver stående, til Netlify er slukket. Appen viser allerede den præcise adresse under Forbindelser.
6. **Netlify-sitet** viser en side med linket til den nye adresse (ingen data, ingen API).
7. **Opdatér henvisninger:** `CLAUDE.md`, `dashboard/README.md`, `heyotto-os-data`-skillen og `heyotto-os-job`-skillen til `tasks-ui.heyotto.win` (appens `/api`) eller `tasks.heyotto.win/ext` (API'et med token). Det afhænger af, hvad skillen gør.

## Det, der ikke kan flyttes

- **Push-notifikationer** er bundet til adressen. Slå dem til igen på hver enhed (Indstillinger → Notifikationer). Appen viser en besked om det første gang.
- **Login:** man logger ind igen på den nye adresse via Access.

## Vejen tilbage

Netlify-koden og Blobs bliver liggende urørt i 14 dage. Går noget galt, fjernes skrivebeskyttelsen på Netlify, og det kører videre som før. Ændringer lavet på Cloudflare i mellemtiden kopieres tilbage med samme script.

## Efter 14 dage

- Slet `netlify/`, `netlify.toml`, `@netlify/*`-pakkerne og AI Gateway-teksterne fra koden og README.
- Slet sitet i Netlify og fjern den gamle redirect-adresse i Google.

## Kasper skal selv

- Vælge flyttedagen (appen er skrivebeskyttet i ca. en halv time).
- Rette redirect-adressen i Google Cloud Console.
- Slå push til igen på pc og telefon.

## Færdig når

- Alt i appen virker på `tasks-ui.heyotto.win`, og Google-forbindelserne virker uden at forbinde igen
- Otto-kørsler, kalendersync, alarmer og push kører på Cloudflare
- Skillsene bruger den nye adresse
- Netlify kan slukkes uden, at noget mangler
