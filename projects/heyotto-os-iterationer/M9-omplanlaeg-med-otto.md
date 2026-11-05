# M9: Omplanlæg med Claude, så alt kommer i mål

**Status (2026-11-05):** bygget på branchen `claude/m9-omplanlaeg` som kørslen `omplanlaeg` i Otto (M7), ikke som en separat `plan-background.mts`. Svar på det åbne spørgsmål (valgt indtil videre): Otto **må** foreslå at droppe opgaver, men de står uden flueben. Ugeforslaget mandag kl. 7 er med som kørslen `ugeforslag`, slået fra som standard, og kører kun, når noget er i risiko. Anvend gemmer med det samme (kan fortrydes i Historik). Standardmodel: Sonnet 5.5 med høj effort.

> "claude skal kunne omstrukturere mine tasks og belastning så alt kommer i mål"

Bygger på prognosen fra M6 (den regner før/efter) og kører som en kørsel i OS-agenten (M7).

### Brugeroplevelse

1. Knappen **✦ Omplanlæg med Claude** i Otto-panelet og på kapacitetssiden. Et valgfrit felt: "Noget, Claude skal vide?" (fx "Jeg er syg torsdag", "Africa Tours 2.0 har forrang", "Rapporten må gerne glide").
2. Claude svarer på 20–60 sekunder med:
   - et kort resumé ("3 deadlines er i risiko. Jeg flytter 2 opgaver til december, sænker drift i uge 47 og foreslår at aftale ny frist på X")
   - en **ændringsliste** med flueben, fx:
     - ☑ *Nyhedsbrev december*: sprint 2026-11 → 2026-12, fordi deadline er 15/12, og november er overbooket
     - ☑ *Kampagnerapport*: timer denne uge 2 → 6, fordi den ellers ikke når fredag
     - ☐ *Website-tekster*: deadline 20/11 → 27/11, **kræver aftale med modtageren**
     - ☐ *Gammel idé X*: status → Droppet
   - **før/efter**: "I risiko: 3 → 0. Overbookede uger: 2 → 0". Det regnes af `forecast()` på den foreslåede tilstand, ikke af Claude.
   - spørgsmål, hvis Claude mangler noget ("Hvor mange timer er der tilbage på Y?")
3. **Anvend valgte** lægger ændringerne ind i `DATA` lokalt. Siden bliver "ugemt", og du gemmer som altid. Alt kan fortrydes via Historik.

### Hvad Claude må foreslå

Felterne `sprint`, `start`, `end`, `hours`, `remaining`, `priority`, `status` (kun → Droppet eller → I gang) og `due`. Ændringer i `due` markeres altid "kræver aftale", fordi deadlines som regel er lovet til andre. Claude må ikke oprette eller slette opgaver i et forslag. Det kan stå som et spørgsmål.

### Teknik: hvorfor Claude API og ikke routinen

**Bygges som en kørsel i OS-agenten ([M7](M7-agent-kernen.md))** med værktøjerne `data.read`, `calendar.list`, `forecast.run` og `plan.propose_changes`. Beskrivelsen nedenfor er det, M7 skal levere for denne kørsel.

Routinen ("HeyOtto OS-opgaver") starter en sky-session, kloner repoet og tager minutter. Den er god til arbejde, der har brug for dine agenter og forbindelser. Omplanlægning har kun brug for data, kalender og prognose. De ligger allerede på serveren.

- `netlify/functions/plan-background.mts` (en baggrundsfunktion, der må køre op til 15 min, langt over de ~60 sek. det tager). Den kalder Claude via **Netlify AI Gateway**, så der ikke skal administreres en API-nøgle. Alternativ: `ANTHROPIC_API_KEY` i Netlify.
- Model: `claude-sonnet-5-5` som standard (hurtig, god til strukturerede forslag). `claude-opus-5-5`, hvis forslagene ikke er gode nok. Afklares med `claude-api`-skillen ved implementering.
- **Input** (kompakt, kun det nødvendige): åbne opgaver (id, titel, projekt, kind, status, due, remaining, hours, priority, sprint), kapacitet pr. uge, møder pr. uge i timer + navngivne fraværsdage, `forecast()`-resultatet og din besked.
- **Output** via tool use med et fast JSON-skema: `{ summary, changes: [{ taskId, field, to, reason, needsAgreement }], questions }`.
- **Serveren validerer** hver ændring: opgaven findes, feltet er tilladt, og formatet er gyldigt (måneder `ÅÅÅÅ-MM`, status blandt de fem). Den regner før/efter med `forecast()`. Ugyldige ændringer droppes og nævnes.
- Forslaget gemmes i `plans/<id>` (uden for `data`). Browseren poller, som den gør med Claude-jobs i dag.
- Opgavetitler og noter (også fra mail) er ikke-betroet tekst. Claude kan kun svare inden for skemaet, og serveren håndhæver det. Der er ingen handlinger udenfor at misbruge.
- Grænser: 10 forslag i timen. Omkostning: AI Gateway-kreditter i Netlify, nogle få øre pr. forslag.

### Automatisk ugeforslag

Mandag kl. 07:00 (`plan-weekly.mts`, kun produktion): kører `forecast()`. Kun hvis noget er i risiko eller overbooket, laver den et forslag og giver alarmen "Claude har et forslag til ugen". Der ændres aldrig noget af sig selv.

## Plan

1. Kørslen `omplanlaeg` i agent-kernen: skill, værktøjet `plan.propose_changes` og validering på serveren.
2. `plans/` + polling + ændringsliste-UI med før/efter.
3. Ugeforslaget om mandagen.
4. README og `CLAUDE.md`.

## Åbne spørgsmål til Kasper

1. Må Claude foreslå at droppe opgaver, eller kun flytte dem?

## Færdig når

"Omplanlæg med Claude" giver inden for et minut en ændringsliste med før/efter, som du kan vælge til og fra og gemme.
