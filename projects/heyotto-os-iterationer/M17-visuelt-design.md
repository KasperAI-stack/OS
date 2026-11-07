# M17: Visuelt design af HeyOtto Tasks (efter M16 og M16b)

**Status (2026-11-07):** bygget lokalt med `ui-design`-skillen, ikke committet og ikke udrullet. Runde 1 (Kapacitet, Opgaver, Projekt) er godkendt af Kasper. Runde 2: Projekter (kort med tal og ring), Rutiner (rækker med status), Assistenten (samtale med Ottos ansigt og forslag), Indbakke (projektmærker, forslag som kort), Omplanlæg (før/efter som små kort) og Kalender (projektfarve på deadlines og ugens opgaver). Indstillinger, Historik og Claude-adgang har arvet fladerne uden yderligere ændringer. Kontrol: `npm test` 52/52, `npm run a11y` ingen fund (inkl. kontrast på statuspiller i begge temaer), browsertjek 12/12. Skærmbilleder i `shots/m17/`. Oprindelig status: Skrevet efter Kaspers feedback: M16 og M16b har gjort appen kedeligere. Alt er hvidt, strukturen og flowet er utydelige, og der er ingen visuel opdeling. Kasper sammenlignede med skærmbilleder af appen før M16 og med monday, Slack, ClickUp og et Klaviyo-dashboard.

## Hvad gik galt

**Kort sagt:** M16 og M16b var et oprydningsarbejde, ikke et designarbejde. De fjernede ting, men lagde intet nyt til. Resultatet er rent og tilgængeligt, men det ser ikke designet ud.

1. **M16 valgte "linjer frem for kasser" og "færre Tåge-flader".** Kortene, flisen med Otto og nøgletallene blev til linjer og rækker på hvid baggrund. Dermed forsvandt dybden: før lå hvide kort på en side med luft imellem, nu er alt én flade.
2. **Brandreglen blev læst som et forbud.** "Sort, grå og hvid bærer appen, ingen lilla flader" gjorde, at status, projekter og kategorier ikke har nogen farve. Monday og ClickUp har farve på netop det.
3. **M16b fjernede mere, end det burde.** Skillen `detect-slop-ui` siger selv: "keep cards that earn their boundaries", "keep meaningful categories, status indicators", "do not make minimalism a rule" og "avoid a universal flattening pass". Jeg brugte den som en sletteliste. Nøgletalskortene, de røde titler og kortene på tavlen havde en mening, og den burde være gjort bedre i stedet for at blive fjernet.
4. **Produktprofilen fra `ui-ux-pro-max` blev læst halvt.** For "Productivity Tool" siger den "Flat Design + Micro-interactions", med "Soft UI Evolution" som sekundær stil og "Clear hierarchy + functional colors". Jeg tog "flat" og "minimalism" og sprang over "functional colors" og "Soft UI".
5. **Processen var forkert.** Jeg byggede hele retningen, før du havde set den. Skærmbillederne af resultatet burde være vist for dig, før M16b fjernede endnu mere.

**Det, der virkede, og som skal blive:**

- Det usynlige arbejde fra M16:
  - tastaturadgang, `lang="da"`, beskeder der læses op og fokus ved sideskift
  - 44 px trykflader og mobilens fanebjælke med skuffen
  - "Gemmer …" og "Fortryd" i stedet for `confirm()`
  - forhåndsvisningen og `npm run shots` / `npm run a11y`
- Sætningen på forsiden ("Du er 1,8 timer over i denne uge"), timeskalaen og Otto efter stemningen.
- Oprydningen i teksten fra M16b: ingen tekst om Claude Code, og Otto i stedet for gnisten.

## Hvad dine eksempler har til fælles

| Træk | monday | ClickUp | Klaviyo-dashboardet | Slack | HeyOtto Tasks i dag |
|---|---|---|---|---|---|
| **Dybde:** sidens baggrund og kortene har to forskellige flader | Grå bjælke, hvide tabeller | Lys grå side, hvide kort med blød skygge | Lyseblå side, hvide kort | Lilla ramme, hvidt indhold | Alt er hvidt |
| **Farve med mening:** status, gruppe og kategori har hver deres farve | Farvede statusceller og gruppefarver | Farvede statusgrupper og farvede bogstavmærker for områder | Farver pr. dataserie | — | Kun rød |
| **Identitet:** hver ting har et genkendeligt mærke | Avatarer, filer | Avatarer, bogstavmærker | Logo for kilden | Avatarer, agent med eget ansigt | Kun prikker |
| **Data som grafik** | Opsummeringsbjælker pr. kolonne | Belastning som søjler, ringe for fremdrift | Søjler, ring, fremdriftsbjælker | — | Én bjælke |
| **Værktøjslinje:** visninger og handlinger over indholdet | Hovedtabel, Søg, Filter, Sortér, Gruppér | List · Board · Box | Periode, Del | Søg | Spredt rundt på siden |
| **Tæt, ordnet data** | Kolonner med overskrift | Kolonner i kortene | Tabel | — | Rækker uden kolonner |

**En ærlig note:** flere af de træk (nøgletalskort med ikon, ringe og bløde skygger) er også SaaS-skabelon. De ser gode ud i eksemplerne, fordi de er lavet med håndværk: ens afstande, farver med samme betydning overalt og rigtige data. Det er det niveau, M17 skal ramme. Det handler ikke om at kopiere stilen.

## Retning: "Ottos arbejdsbord"

> Et arbejdsværktøj med dybde og farve, hvor farven altid betyder noget (status, projekt eller tidstype), og hvor Otto er assistentens ansigt.

**Fladerne**
- Siden får Tåge (`#F4F2F8`, findes i brandet) som baggrund.
- Indholdet ligger på hvide kort med 16 px hjørner og en blød skygge.
- Sidebaren forbliver Onyx (mørk). Den er appens særkende.

**Farverne**
- Tre familier, hver med én betydning:
  - **Status:** Ikke startet grå, I gang violet (Ottos farve), Blokeret rød med skravering, Færdig grøn, Droppet stiplet.
  - **Projekter:** hvert projekt vælger én af otte farver. Farven står i et bogstavmærke ("N" for Nyt website) i sidebaren, på kort, på rækker og i kalenderen.
  - **Tidstype i kapaciteten:** drift blæk, projekter violet, ad hoc rosé, ubooket hvid.
- Rød er stadig kun signalet.

**Formerne**
- Status vises som piller med lys flade og mørk tekst: "● I gang". Ikke som prikker alene.
- Grupper får en farvet overskrift med antal, som i monday og ClickUp: "Over deadline 1" i rødt, "I dag 2" i violet.

**Otto**
- Hans hoved er assistentens avatar i chatten (som Sales Agent i Slack), i "Assistenten siger" og på fanen.

**Typografien**
- Geist og skalaen fra M16 bliver.
- Etiketter må igen stå med store bogstaver, hvor de fungerer som korte gruppenavne (ClickUp: "READY (8)"). Brødtekst og felter står med almindelige bogstaver.

### Farveforslag (illustrative værdier, kontrasten er ikke testet endnu)

| Rolle | Lyst tema | Mørkt tema |
|---|---|---|
| Sidens baggrund | `#F4F2F8` | `#0F0E13` |
| Kort | `#FFFFFF`, skygge `0 1px 2px rgb(15 14 19 / .06), 0 8px 24px -12px rgb(15 14 19 / .14)` | `#1A1820`, kant `#2B2932` |
| I gang | tekst `#5B21B6` på `#EDE7FE` | tekst `#D8C8FF` på `#2E2147` |
| Ikke startet | `#5E5A6B` på `#ECEAF1` | `#A7A3B2` på `#24222B` |
| Blokeret | `#B42318` på `#FDE8E6`, skraveret | `#F97066` på `#3A1B1A` |
| Færdig | `#13703A` på `#E3F4E8` | `#7FD9A0` på `#17301F` |
| Projektfarver | violet `#7C3AED`, rosé `#DB2777`, blå `#2563EB`, teal `#0D9488`, rav `#B45309`, grøn `#15803D`, skifer `#475569`, rød-brun `#9F1239` | samme farver i lysere udgave |

**Det kræver dit ja:** brandbogen siger "ingen lilla flader" og "sort, grå og hvid bærer appen". Retningen bruger Ottos violet som farven for "i gang" og projektfarver i små mærker og piller. Store flader forbliver neutrale.

### Siderne

**Kapacitet** (hovedet: titel til venstre; "Gem" og "+ Ny opgave" til højre)
```
┌──────────────────────────────────────────────┐ ┌───────────────┐
│ UGEN                                         │ │ Fri  −1,8 t   │ ← tre små kort med tal
│ Du er 1,8 timer over i denne uge     [Otto]  │ ├───────────────┤   (som før M16, men med
│ ▇▇▇▇▇ ▇▇▇▇▇▇▇▇▇▇▇▇▇ ▒▒ ░░   (farvet timeskala) │ │ Belægning 92% │    rigtige data og ens
│ 0    5    10   15   20  25 t                 │ ├───────────────┤    opbygning)
│ ■ Drift 5,5  ■ Projekter 14,5  ■ Ad hoc 3   │ │ Deadline: 1   │
└──────────────────────────────────────────────┘ └───────────────┘
┌──────────────────────────────┐ ┌──────────────────────────────┐
│ (Otto) Assistenten siger   4 │ │ Belastning pr. dag           │ ← søjler man–fre: møder,
│ ● Billeder fra fotograf  [Åbn]│ │ ▇ ▇ ▆ ▇ ▃   (fri tid lys)    │   opgaver og fri tid
│ ● Svar revisor           [Åbn]│ │ man tir ons tor fre          │   (data findes: calDayStats)
└──────────────────────────────┘ └──────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ Opgaver, der trækker tid   (Liste · Kalender)                    │ ← tabel med kolonner:
│ Opgave            Projekt        Status        Timer  Deadline   │   projektmærke og statuspille
└─────────────────────────────────────────────────────────────────┘
```

**Opgaver** (som monday, men stille)
- Hovedet har visningsfaner: "Liste · Tavle · Kalender".
- Værktøjslinjen har søg, filtrene med antal og "+ Ny opgave" som primær knap.
- Grupperne ("Over deadline", "I dag", "Næste uge" …) er hvide kort med en farvet overskrift og antal.
- Kolonnerne er ☐, Titel, Projekt (mærke og navn), Status (pille), Timer og Deadline.
- Hver gruppe slutter med "+ Tilføj opgave". Nøgletalskortene kommer ikke igen, for tallene står i grupperne og filtrene.

**Projekter** (som ClickUps Box)
- Projekterne står som et grid af kort.
- Hvert kort har et farvet bogstavmærke, navnet og et tal for åbne og færdige opgaver.
- Det har en fremdriftsring, sprintmålet, næste deadline og et rødt mærke ved "i risiko".

**Projekt**
- Hovedet har projektmærket og fanerne "Sprint · Tidslinje · Øvrige sprints". Fanerne skifter visning i stedet for at rulle.
- Tavlen har farvede kolonneoverskrifter med antal og hvide kort på Tåge-flade med statuspiller.
- Tidslinjens bjælker har projektets farve.

**Assistenten** (som Slack)
- Samtalen står med Ottos avatar og navn ved hvert svar og dit initial ved dine spørgsmål.
- Feltet står nederst som en beskedlinje.

**Kalender**
- Møder får farven fra kalenderen eller projektet, og deadlines får projektets farve.

**Sidebaren**
- Projekterne står med farvet bogstavmærke i stedet for prik, ligesom ClickUps "D/M/P".
- Sundheden vises som en lille rød prik på mærket, kun når noget er galt.

## Plan

Første trin vises for dig, før noget bygges i appen.

| # | Indhold | Leverance | Godkendt når |
|---|---|---|---|
| 0 | **Dine valg:** udvidet palet (ja/nej), retningen herover eller en anden, og hvad der skal blive fra M16/M16b | Svar på tre spørgsmål | Du har svaret |
| 1 | **Mockups af tre sider:** Kapacitet, Opgaver og Projekt, i lyst og mørkt, som statiske sider med de rigtige demo-data og tokens. Gerne to varianter af Kapacitet | Skærmbilleder + et link til forhåndsvisningen | Du har valgt en variant og sagt "det er sådan, den skal se ud" |
| 2 | **Fundament:** fladerne (side, kort, skygge), farvefamilierne og projektfarven i data (`project.color`, valgfri; et fast standardvalg pr. projekt, så gamle data virker) | `app.css`-tokens, felt i projektdialogen, test i `store`-tests for at farven gemmes | Kontrasten for alle piller er ≥ 4,5:1 i begge temaer (målt med `npm run a11y`) |
| 3 | **Komponenter:** kort, statuspille, projektmærke, gruppehoved med antal, tabelrække, visningsfaner og værktøjslinje | `app.css` + små render-hjælpere i `index.html` | Hver komponent bruges mindst to steder, og ingen side har sin egen variant |
| 4 | **Siderne** i rækkefølgen Kapacitet, Opgaver, Projekt, Projekter, Assistenten, Kalender, Rutiner, Indbakke og Indstillinger. Én side ad gangen med skærmbilleder til dig | Skærmbilleder pr. side | Du har set hver side, før den næste bygges |
| 5 | **Kontrol:** `npm test`, `npm run a11y` (inkl. kontrast på farvede piller), skærmbilleder på 1440 og 390 px i begge temaer og et tjek på telefonen | Rapport | Ingen fund. Mobilen fungerer som i M16 |

**Det, der rulles tilbage fra M16/M16b**
- "Linjer frem for kasser": kortene kommer igen, nu på en tonet side.
- Den rent sort-hvide palet.
- Fjernelsen af nøgletallene på forsiden: de tre kort kommer igen.
- De sorte titler i "Assistenten siger": niveauet vises med en farvet pille i stedet.

**Det, der bliver**
- Alt usynligt fra M16: tilgængelighed, mobilnavigation, Fortryd, Gemmer og forhåndsvisningen.
- Sætningen og timeskalaen, nu i farve.
- Otto som assistentens ansigt.
- Tekstoprydningen.

## Spørgsmål til dig

1. **Farver:** må brandreglen udvides, så status og projekter har farve (Ottos violet for "i gang", otte projektfarver i små mærker)? Store flader forbliver neutrale. Anbefalet: ja.
2. **Retning:** "Ottos arbejdsbord" (tonet side, hvide kort og farvede piller som ClickUp, med en tabel som i monday på Opgaver), eller noget tættere på et af dine eksempler? Anbefalet: arbejdsbordet.
3. **Første trin:** skal jeg lave de tre mockups (Kapacitet, Opgaver, Projekt), så du kan se retningen, før appen ændres? Anbefalet: ja.

## Designplan (lavet med `ui-design`-skillen, 2026-11-07)

Kasper bad om at bruge skillen til at optimere appen og vise en forhåndsvisning. De tre åbne spørgsmål er besvaret med anbefalingerne: farve på status og projekter, retningen "Ottos arbejdsbord", og først tre nøglesider (Kapacitet, Opgaver og Projekt). Resten af appen arver fladerne og farverne, men er ikke gennemarbejdet.

**Referencer og hvad der lånes**

| Reference | Lån |
|---|---|
| `fra-kasper/dashboard-kort-paa-tonet-flade.png` | Tonet side, hvide kort, ét stort kort og tre små med tal |
| `fra-kasper/clickup-box-belastning-og-kort.png` + `design/clickup` | Statusgrupper med farve og antal; kolonner; ring for fremdrift |
| `fra-kasper/monday-tabel-farvede-statusceller.png` | Gruppe med farvet markering; kolonnehoveder; status i farve |
| `design/float` | Udnyttelse står ved tallet; farvede blokke pr. projekt |
| `design/todoist` + `design/sunsama` | Projektfarve som lille mærke i listen; kolonner pr. status med kort |
| `regler/atlassian-lozenge` + `regler/atlassian-elevation` | Statuspille: lys flade og mørk tekst; flader i faste niveauer |

**Flader:**
- Siden har Tåge `#F4F2F8` (mørkt: `#0F0E13`). Kortene er hvide (`#1A1820`) med 18 px hjørner, en svag kant og en blød skygge.
- Sænkede felter (bjælkens spor, tavlens kolonner) bruger sidens farve.
- Dialoger og indstillinger beholder den kraftige skygge.

**Farveroller**

| Rolle | Lyst | Mørkt |
|---|---|---|
| Primær handling | Onyx `#0F0E13` | Tåge `#F4F2F8` |
| I gang | `#5B21B6` på `#EDE7FE` | `#D8C8FF` på `#33255A` |
| Ikke startet | `#4A4656` på `#ECEAF1` | `#C9C5D3` på `#2A2833` |
| Blokeret | `#B42318` på `#FDE8E6` | `#FFB4AB` på `#4A1F1C` |
| Færdig | `#13703A` på `#E3F4E8` | `#9BE3B4` på `#173A25` |
| Projekter (bogstavmærke, hvid tekst) | violet `#7C3AED`, rosé `#BE185D`, blå `#2563EB`, teal `#0F766E`, rav `#B45309`, grøn `#15803D`, skifer `#475569`, bær `#9F1239` | samme |
| Tidstype | drift blæk, projekter violet, ad hoc rosé | drift Tåge, projekter `#A78BFA`, ad hoc `#F472B6` |

**Typografi:** Geist med skalaen 48 (forsidens svar) / 32 / 20 / 16 (korttitel) / 15 / 13 / 11.

**Det ene greb:** ugen som kort. Sætningen, timeskalaen i farve og Otto efter stemningen.

**Kapacitet**
```
┌ Ugen (stort kort) ─────────────────────────┐ ┌ Fri tid ─────────┐
│ Du er 1,8 timer over i denne uge    [Otto] │ │ −1,8 t (Overbook)│
│ ▇▇▇▇▇|▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇|▒▒|░░ (timer)       │ ├ Belægning ──────┤
│ 0  5  10  15  20  25 t                     │ │ 92 % (ring)      │
│ ■ Drift ■ Projekter ■ Ad hoc □ Ubooket     │ ├ Deadline ───────┤
└────────────────────────────────────────────┘ │ 1 overskredet    │
┌ Assistenten siger ──────┐ ┌ Timer pr. projekt ┐└──────────────────┘
│ ● … [Åbn]               │ │ N ███████ 8 t      │
└─────────────────────────┘ └────────────────────┘
┌ Opgaver, der trækker tid: Opgave · Projekt · Status · Timer ────────┐
```

**Opgaver:** værktøjslinje med filtre og tal, søgefelt og hurtig tilføjelse. Hver gruppe er et kort med farvet overskrift og antal, og kolonnerne er Opgave, Projekt, Status, Timer og Deadline.

**Projekt:** hovedet har projektmærket. Status står som piller, og fanerne er Sprint, Øvrige sprints og Tidslinje. Sprintkortet har en ring for fremdrift. Tavlens kolonner er sænkede felter med en farvet statuspille og hvide kort.

**Tjek mod `ingen-ai-slop.md`:**
- Hver farve har én betydning.
- Kortene har hierarki: et stort kort, små kort med tal, tabeller.
- Ingen gradienter og ingen gnister.
- Planen er ikke tom: farve og dybde er tilbage.
