# M5: Kalenderoverblik med møder og opgaver

> "der skal være et kalender overview, hvor man kan se mine møder og opgaverne der skal laves. Det er lige før det skal være et toggle view på forsiden i forlængelse af aktive opgaver"

## Analyse

- Forsiden (`renderCapacity`) viser i rækkefølge: verdict → model+belastning → (Kingman, fjernes i M2) → **Aktive opgaver** (`capTasks`) → ugelog.
- "Aktive opgaver" er en liste grupperet efter Drift/Projekter/Ad hoc med timefelter.
- Der findes ingen datoer på opgaver ud over `due` (deadline). `sprint`/`start`/`end` er måneder. En kalender kan derfor vise **deadlines** præcist, men ikke "hvornår laver jeg opgaven", før M9 laver tidsblokke.
- Tidslinjen (Gantt) er bygget i CSS Grid med vilje (README: "en Gantt er i praksis en tabel"). Kalenderen bør følge samme princip.
- Visningsvalg gemmes i `localStorage` (`mos-view`) og gør aldrig siden "ugemt". Toggle-valget skal gøre det samme.
- Efter M1 er `.seg-ctl` (segmenteret kontrol) fri til genbrug.

## Løsning

**Kortet "Aktive opgaver" får en toggle i hovedet: `Liste | Kalender`.** Det er præcis "i forlængelse af aktive opgaver". Listen er som i dag. Kalender viser samme opgaver i tid, sammen med møderne.

Kalenderen har selv et lille valg: **Uge | Måned**, og pile ◀ ▶ + "I dag".

### Ugevisning (standard)

```
            Man 9.   Tir 10.   Ons 11.   Tor 12.   Fre 13.
Hele dagen  ◆ Brief  ·         ◆ Rapport ·         Ferie
            (Deadline, rød hvis overskredet)
08          ┌──────┐           ┌──────┐
09          │Status│           │Kunde │
10          └──────┘           └──────┘
…
Fri tid     5,5 t    7 t       3 t       8 t       —
```

- **Møder** (fra M4): blokke med titel og tid i blæk-kontur. Foreløbige (tentative) skraveres. Afviste vises ikke. Fokustid vises lysegrå, så den kan skelnes fra møder.
- **Deadlines**: i heldagsrækken som diamant + titel (samme symbol som tidslinjen). Rød, hvis overskredet. Status-farve som på kortene.
- **Fri tid pr. dag**: arbejdstid minus møder. Det binder kalenderen sammen med kapaciteten. Er en dag med en deadline næsten fuld af møder, vises den røde markering (bliver til en alarm i M6).
- **"Skal laves denne uge"**: en bakke under ugen med opgaver, der har `hours > 0`, og summen "14 t opgaver / 23,5 t fri tid". Indtil M9 placerer de sig ikke på bestemte tidspunkter.
- Klik på møde → popover: tid, deltagere (antal), "Åbn i Google Kalender", Meet-link og "Opret opgave fra mødet" (M8).
- Klik på opgave → `editTask` (som overalt i appen).
- Weekend: skjules, medmindre der er noget i den.
- Nu-linje: en tynd linje i blæk på i dag, ligesom "i dag"-linjen i tidslinjen.

### Månedsvisning

Et månedsgitter med pr. dag: antal mødetimer som en lille bjælke, deadlines som diamanter med titel (maks. 2, derefter "+3"). Klik på en dag → skifter til ugevisning for den uge.

### Mobil (< 560 px)

Ugevisningen bliver en **dagsliste** (agenda): én dag ad gangen med møder og deadlines i tidsrækkefølge og pile til næste dag. Et timegitter med fem kolonner kan ikke læses på en telefon.

### Uden M4

Bygges M5 før kalendersynken, viser kalenderen kun deadlines og "skal laves denne uge", med en diskret linje: "Forbind Google Kalender i indstillinger for at se dine møder". Så kan M5 bygges parallelt med M4.

## Teknisk

- `renderCalendar(mode, anchorDate)` returnerer HTML til kortets krop. `capTasks` får toggle i hovedet og vælger mellem `listHtml` og `renderCalendar`.
- CSS Grid: `grid-template-columns: 56px repeat(5, 1fr)`, rækker pr. halve time. Hændelser placeres med `grid-row: <start> / <slut>`. Overlappende møder får kolonner side om side (simpel lane-tildeling: sortér efter start, læg i første ledige bane).
- **Tid og tidszone:** her skal der bruges `Date` (README undgår det med vilje for måneder). Alt formateres med `Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen" })`, og ugestart beregnes i den zone, så sommertid ikke flytter møder en time.
- Data: `GET /api/calendar?from=&to=` (M4) hentes ved åbning og ved ugeskift, og caches i hukommelsen pr. uge.
- Valg gemmes i `localStorage` under `mos-view`: `capView: "liste"|"kalender"`, `calMode: "uge"|"maaned"`.
- Print: ugevisningen kan printes i landskab (eksisterende print-styles).
- Tilgængelighed: hver hændelse er en knap med `aria-label` "Møde, tirsdag 10:00–11:00, Statusmøde". Piletaster flytter uger.

## Senere (ikke i M5)

- **Tidsblokke:** træk en opgave fra bakken ind i en ledig tid → `blocks: [{date, from, to}]` på opgaven. Det er det naturlige næste skridt, og M9's omplanlægning kan foreslå blokkene. Skrives **ikke** til Google Kalender (det ville være en handling udenfor, der kræver bekræftelse).
- En selvstændig side `#kalender` i sidebaren i fuld bredde, hvis kortet føles trangt.

## Plan

1. Toggle i "Aktive opgaver"-hovedet (genbrug `.seg-ctl`) + `localStorage`.
2. Ugevisning kun med deadlines og "skal laves"-bakke (virker uden M4).
3. Møder fra `/api/calendar`, med lanes, popover og fri tid pr. dag.
4. Månedsvisning.
5. Mobilagenda.
6. README: afsnit "Kalenderen".

## Færdig når

Du kan på forsiden skifte mellem liste og kalender. Kalenderen viser ugens møder, deadlines og fri tid. Den virker i lyst og mørkt tema, på telefon og i print.
