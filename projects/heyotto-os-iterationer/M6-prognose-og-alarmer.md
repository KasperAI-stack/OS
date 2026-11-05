# M6: Prognose og alarmer, så du ved, om alt kommer i mål

> "claude skal kunne analysere min kalender og tasks, alarmere mig ved deadlines, claude skal kunne omstrukturere mine tasks og belastning så alt kommer i mål"

## Analyse

Tre ting, der skal holdes adskilt:

1. **Ved vi, om alt kommer i mål?** Det er et regnestykke, ikke en AI-opgave. Det skal være deterministisk, hurtigt og forklarligt.
2. **Alarmer.** Det er regler oven på regnestykket. Udfordringen er kanalen: hvordan når en alarm dig, når appen ikke er åben?
3. **Omplanlægning.** Her giver Claude værdi: afvejninger, prioritering og forklaring. Men Claude skal **foreslå**, du vælger.

### Hvad mangler i datamodellen

I dag har en opgave `hours` = timer **pr. uge lige nu** og `due` = deadline. Det kan ikke fortælle, om en opgave når sin deadline, for der står ingen steder, **hvor meget arbejde der er tilbage**. En opgave med 4 t/uge og deadline om 2 uger kan være på 2 timer eller 40.

**Nyt felt:** `remaining` = timer tilbage i alt (estimat). Valgfrit. Opgaver uden `remaining` men med `due` giver alarmen "mangler estimat". Fra mail (M8) foreslår Claude et estimat. Og `priority` (`høj` / `normal` / `lav`, standard normal), så omplanlægningen ved, hvad der må skubbes.

Plus kapacitet pr. uge fremad (`capacityForWeek`, M4), som tager højde for møder og fravær i kalenderen.

## Gennemførlighedsmotoren (uden AI)

En ren funktion `forecast(data, calendar, today) → { weeks, tasks, alerts }`:

1. **Kapacitet pr. uge** for de næste 12 uger: `(arbejdsuge − møder_u − admin − fravær_u) × loft − drift − ad hoc-buffer`. Møder og fravær kommer fra kalenderen, når M4 er forbundet, ellers fra de faste tal.
2. **Earliest Deadline First:** åbne opgaver med `remaining > 0` sorteres efter `due` (derefter prioritet). Ugekapaciteten fyldes i den rækkefølge. Hver opgave får en **forventet færdigdato**. EDF er den optimale rækkefølge til spørgsmålet "kan alle deadlines nås?" for én person, så hvis EDF ikke kan nå det, kan ingen rækkefølge.
3. Opgaver uden deadline fylder resten op og påvirker ikke de daterede.
4. Resultat pr. opgave: `ok` / `stramt` (færdig inden for 2 arbejdsdage før deadline) / `i risiko` (færdig efter deadline, med underskuddet i timer) / `mangler estimat`.

Den samme fil bruges i browseren og på serveren: `dashboard/lib/forecast.mjs`. Den kan hentes af siden som `/lib/forecast.mjs` og importeres af Netlify-funktionerne med en relativ sti, så der kun er én implementering.

### Alarmerne (regler)

| Alarm | Regel | Niveau |
|---|---|---|
| Overskredet | `due` < i dag, ikke færdig | Rød (findes allerede som markering) |
| Deadline i risiko | prognosen siger færdig efter `due` | Rød |
| Ikke startet tæt på deadline | `due` ≤ 3 arbejdsdage, status "Ikke startet" | Rød |
| Blokeret med deadline | Blokeret, og `due` ≤ 7 dage | Rød |
| Stram | prognose `stramt` | Gul |
| Overbooket uge | belastning > loft i en af de næste 4 uger | Gul |
| Mødetung deadline-dag | fri tid den dag < 2 t, og en deadline samme dag | Gul |
| Mangler estimat | `due` sat, `remaining` tom | Grå |

### Hvor alarmerne vises

- **"Otto siger"-panel** øverst på forsiden (over verdict-rækken), maks. 5 linjer med de vigtigste først. Hver linje: hvad, hvorfor ("12 t tilbage, 6 t fri før fredag") og en handling (åbn opgave / omplanlæg). **Udsæt** (1 dag / til næste uge) gemmes i `alerts/state` på serveren, så det gælder både på telefon og computer.
- Tal i sidebaren ved Kapacitet ("2 ⚠").
- Kalenderen (M5) markerer risiko-deadlines.
- Opgavekort og tidslinje får prognosedatoen som tooltip.

### Alarmer, når appen er lukket: vælg kanal

| Kanal | Fordele | Ulemper |
|---|---|---|
| **Web Push** (anbefalet) | Virker på computer og Android. Kræver ingen AI og ingen mail. Kører fra en planlagt Netlify-funktion | iPhone kun, hvis HeyOtto OS lægges på hjemmeskærmen (PWA). Kræver service worker, manifest og VAPID-nøgler |
| Morgenbrief som mail til dig selv | Fungerer overalt, og Claude kan skrive den | At sende mail kræver bekræftelse efter `CLAUDE.md`, medmindre du giver en stående tilladelse til "kun til mig selv". Ellers kun som kladde |
| Begivenhed i din kalender | Dukker op i telefonens kalender | At skrive i kalenderen er en handling udenfor. Larmende |

**Anbefaling:** Web Push til røde alarmer (højst én samlet besked pr. morgen kl. 07:30 + én med det samme ved nye røde), via `alerts-sync.mts`, planlagt hver time i arbejdstiden. Den kører `forecast()` på serveren, sammenligner med sidste gang (`alerts/state`) og sender kun **nye** alarmer, så du ikke bliver spammet.

## Plan

1. Felterne `remaining` og `priority` i opgavedialogen og datakontrakten. Validering.
2. `dashboard/lib/forecast.mjs` + tests med faste eksempler (EDF, overlap, uger med fravær).
3. Otto-panelet, alarmer i sidebar, kalender og kort. Udsæt via `alerts/state`.
4. Web Push: manifest, service worker, VAPID, tilmelding i Indstillinger → Alarmer, og `alerts-sync.mts`.
5. README og `heyotto-os-data`-skillen (nye felter).

## Åbne spørgsmål til Kasper

1. Alarmkanal: Web Push, mail til dig selv eller kun i appen?
2. Hvor stramt er "stramt"? 2 arbejdsdages margin som udgangspunkt?
3. Vil du sætte `remaining` på eksisterende opgaver selv, eller skal Claude foreslå estimater første gang (som et forslag, du godkender)?

## Færdig når

- Forsiden siger, hvilke deadlines der er i risiko og hvorfor, uden AI og med det samme
- Røde alarmer når dig på telefonen, selvom appen er lukket
