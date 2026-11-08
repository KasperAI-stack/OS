# M18: Rutiner forbundet med flows i Studio

**Status (2026-11-08):** bygget og testet lokalt (57 tests), ikke udrullet. Svarer til M49 i HeyOtto Studio.

Kaspers ønske (2026-11-07): rutiner bliver faste flows. Hver ting har én ejer: **Tasks ejer "hvad og hvornår"** (rutinens navn, interval, projekt og timer), og **Studio ejer "hvordan"** (flowets noder). Intet kopieres mellem dem.

## Det er bygget

- **Felter på rutinen:** `studio_flow_id` (flowets id i Studio), `studio_inputs` (tekst efter inputnavn) og `studio_toggles` (til/fra efter navn). Rutinens dialog har feltet "Flow i Studio": flowene hentes fra Studio, og det valgte flows input og toggles vises som felter og afkrydsning. Påkrævede input uden standardværdi skal udfyldes.
- **"Kør i Studio"** på rutinens række: `POST /api/studio/routines/:id/run` kalder Studios `POST /ext/flows/:id/run` med rutinens værdier og `routine: { id, name, project, projectName }`. Studio laver et startkort, og Tasks åbner chatten på `studio.heyotto.win/chat/<id>`. Kun Kasper kan trykke.
- **`list_routines` og `GET /ext/routines`** giver også `studio_*`, `projectName` og `occurrences` (rutinens datoer de seneste 7 og næste 14 dage i brugerens tidszone, efter samme regler som appen). Studio starter flowet, når en dato er nået; Tasks starter intet selv.
- `GET /api/studio/flows` henter Studios flows til dialogen (`fields` med label, påkrævet og standard).

## Kasper skal selv

1. Studio → Integrationer → Adgang udefra: giv tokenet bag `HEYOTTO_TOKEN` rettigheden **flows** (eller lav et nyt med `read`, `task` og `flows`, og ret hemmeligheden i Cloudflare).
2. Udrul: `npm run cf:deploy`.
3. Lav rutinen "SEO-uge" (hver uge, mandag, flow `seo-uge`) og rutinen "Black Friday" (flow `black-friday`, på pause: den startes kun med "Kør i Studio").

## Afvigelser

- En skabelon, der kun køres ved lejlighed (fx Black Friday), er en rutine **på pause**: den har ingen datoer, så Studio starter den aldrig selv, men "Kør i Studio" virker.
- Et manuelt "Kør i Studio" samme dag som en planlagt dato giver to kørsler; Studio husker kun de planlagte.
