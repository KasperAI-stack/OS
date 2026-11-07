# M16: Designløft af HeyOtto Tasks

**Status (2026-11-07):** bygget, lokalt testet, ikke udrullet og ikke committet. D1–D7 er lavet i én omgang på grenen `claude/m10-cloudflare` i stedet for syv PR'er (se "Afvigelser"). Planen herunder er uændret; det, der blev bygget, står i dette afsnit.

### Hvad der blev bygget

| # | Resultat |
|---|---|
| D7 | `npm run preview` (`scripts/preview.mts`): appen med det rigtige API (`handle()`) og en SQLite-database i hukommelsen med opdigtede demo-data, uden wrangler. `npm run shots` (`scripts/shots.mts`): alle visninger i lyst, mørkt og 390 px gennem Chrome/Edge (DevTools-protokollen, ingen Playwright). `npm run a11y` (`scripts/a11y.mts`): axe-core og et tastaturtjek på alle visninger i begge temaer. Før-billeder blev taget, før noget blev ændret |
| D1 | CSS flyttet til `dashboard/app.css` og ordnet pr. komponent i 12 afsnit. Typeskala (`--fs-*`, seks trin) og afstandsskala (`--s-1`…`--s-6`); ingen `font-size` uden for skalaen. Inline-styles fra 103 til 36, og de 36 er alle dynamiske (positioner, bredder, statusfarver). `.legend`- og `.btn:disabled:hover`-dubletterne er samlet. Fokusringen bruger `--focus`. `--control-border` (`#8E89A0`, 3,4:1) på felter og sekundære knapper |
| D1b | `<!doctype html>` og `<html lang="da">`. Alt med `data-act` kan bruges med Enter/mellemrum (én fælles lytter), og `.hrow`, `.g-label`, `.tcard` har `tabindex` og `role="button"`; `.ceil-lbl` og `.cn` er nu knapper. `#flash` har `role="status"`, en fejl bliver stående med luk-knap, og "Kunne ikke gemme" har "Prøv igen". Fokus flyttes til sidens `h1` ved sideskift. `role="grid"` er fjernet fra ugekalenderen. 44 px trykområder og 16 px felter ved `pointer: coarse`, `dvh`, `viewport-fit=cover` og safe-area. Gem viser "Gemmer …", ligesom Spørg, Hent mails og Lav forslag |
| D2 | Ingen `text-transform: uppercase` (kun `::first-letter` til ugedage). "I DAG" → "I dag". Løft ved hover erstattet af `:active`. "Tasks" → "Opgaver" i grænsefladen. Midterprik-strengene i sidebaren er væk |
| D3 | `.card` er nu en sektion: en vandret linje i fuld bredde med plus-mærker. `.otto-says`, `.pcard`, `.isug`, `.ag-day`, `.pmet`, `.tray`, `.gacc` og historikken er rækker eller celler med linjer. Ét panel (`.panel`) pr. side: ugen (Kapacitet), sprinten (projekt), spørgefeltet (Assistenten, Omplanlæg) |
| D4 | Ugen som beholder: sætningen ("Du er 1,8 timer over i denne uge" i rødt), bjælken med loftet, skravering ud over loftet, Otto efter stemningen, belægning/loft/næste deadline i foden og én udfyldning fra venstre ved første indlæsning. Tallene er stadig `capacity()` |
| D5 | Prikker kun til sundhed, tal højrestillet. Tema og indstillinger i sidebarens fod, Log ud for sig. Under 1024 px: skuffe og fanebjælke (Kapacitet, Opgaver, Kalender, Assistent, Mere). Ny side `#kalender`. Temaet huskes i browseren |
| D6 | Indstillinger er et panel fra højre (fuld skærm under 640 px). Sletning af opgave, projekt, sprint og rutine uden `confirm()`, med "Fortryd" i beskeden. De fem bekræftelser, der blev (token, Google, kladde, historik, log ud), står i appens egen dialog. Fejl i dialogen står ved knapperne og markerer feltet (`aria-invalid`, `aria-describedby`). Projekter er rækker, opgavelisten har 44 px rækker, visningsvalgene ruller vandret på mobil |

### Kontrol

- `npm test`: 52 af 52 grønne.
- `npm run a11y`: ingen fund i 11 visninger × 2 temaer (axe-core 4.10.2, WCAG 2.1 AA + best practice). De første fund (talfelter uden etiket, Gantt-filtre uden navn, en knap inde i `role="img"`, en tom kolonneoverskrift) er rettet.
- Et browsertjek af Enter på kanban-kort, fejl ved feltet, slet og Fortryd, fokus efter sideskift, skuffen med Escape og fanebjælkens trykmål (59 px): alle 12 tjek bestod.
- Skærmbilleder af alle visninger før (`shots/foer`) og efter (`shots/efter`) er gennemgået. Ikke set: en rigtig iPhone, Google-forbundne kalendere med møder og en lang Indbakke.

### Afvigelser fra planen

- **Ét hug, ikke syv PR'er.** D1–D6 rører de samme render-funktioner, og en mellemtilstand (fx nye tokens uden ny struktur) ville se halvfærdig ud. Ændringerne kan stadig deles i commits pr. iteration ved review.
- **`wrangler dev` virker ikke på maskinen** (`write EOF`, også uden sandkasse), så D7 bruger en Node-forhåndsvisning med det rigtige API i stedet for `npm run cf:dev`. `cf:dev` er ikke ændret.
- **Åbne spørgsmål besvaret med anbefalingerne:** (1) brandreglen er rettet i `brand/hey-otto/guidelines.md`: eyebrows i Mono med store bogstaver gælder ikke app-grænseflader. (2) Mobil: fanebjælken fra ui-ux-gennemgangen (N1) frem for skuffe alene; det femte punkt hedder "Mere" i stedet for "Projekter", fordi skuffen også har Rutiner, Indbakke, Historik, Indstillinger og Log ud. (3) CSS i egen fil: ja; `sw.js` cacher intet, så der var intet at rette der. Sig til, hvis et af svarene skal være anderledes.
- **Kalender som egen side** (`#kalender`) er ny: fanen "Kalender" skulle pege et sted hen. Liste/Kalender på forsiden er uændret.
- **Gem-knappen vises kun, når der er ugemte ændringer.** Sidebaren siger "Gemt i skyen" ellers.
- **Fredoka** er ikke hentet: Otto taler ikke i grænsefladen endnu, så skriften ville kun være en ekstra download.

### Næste skridt

1. Se forhåndsvisningen (`npm run preview`) og sig til om retningen, især forsiden og fanebjælken.
2. Commit (evt. delt pr. iteration) og udrul med `npm run cf:deploy`. Tjek derefter appen på telefonen som installeret PWA (safe-area, fanebjælken).

**Oprindelig status (2026-11-07):** plan, intet bygget. Lavet med `frontend-design`-skillen ud fra koden i `dashboard/index.html`. Appen var ikke set i en browser: den står bag Cloudflare Access, og lokalt kræver den D1-data.

## Analyse af den nuværende frontend

### Det, der virker, og som skal blive

- **Tokensystemet** følger brandet: blæk som primærfarve, ingen gradienter, én rød signalfarve, lyst og mørkt tema via `:root`-tokens og `data-theme`.
- **Status bæres af form**, ikke kun farve: skravering ved blokeret, stiplet kant ved droppet og signalgul ved datafejl. Det er godt og skal blive.
- **Otto-stemningen på Kapacitet** (kaffe, løber eller arbejder efter belastningen) er det eneste øjeblik, hvor appen har sin egen personlighed. Den skal styrkes, ikke fjernes.
- Reduced motion, print-layout, tabular-nums og synlig fokus findes allerede.

### Problemer (efter alvor)

1. **Ingen typeskala.** CSS'en bruger 22 forskellige skriftstørrelser, og halvpixel-trin (12 / 12,5 / 13 / 13,5 / 14 / 14,5) kan ikke skelnes. Hierarkiet bliver derfor fladt: næsten alt står i 12–14 px. Overskrifter springer fra 17 til 22, 24, 28, 30 og 36 uden system.
2. **Kasser i kasser.** `.card`, `.otto-says`, `.verdict`, `.pcard`, `.isug`, `.gacc`, `.tray`, `.ag-day`, `.pmet`, `.cw` og `.cm` er alle en rammet boks med runde hjørner, og de står ofte inden i hinanden. Brandets egen idé, et grid af tynde linjer med plus-mærker, ses kun ved sidehovedet og footeren (`.phead::before/after`). Resten er SaaS-kort.
3. **Etiketter i store bogstaver overalt.** 15 steder bruger `text-transform: uppercase` med spatiering: `.sec-label`, `.vlabel`, `.flab`, `.tag`, `.set-sec h4`, `.g-corner`, `.wtbl th`, `.cw-lab`, `.cm-head`, "I DAG" og flere. De står over næsten hvert felt og hver sektion, er svære at læse og er det mest generiske træk i designet.
4. **Prikker betyder forskellige ting.** I sidebaren betyder en prik sundhed (projekter), "der er nyt" (Indbakke), "aktiv/inaktiv" (rutiner) eller ingenting ("Spørg assistenten" har altid en accentprik). Man kan ikke lære, hvad den betyder.
5. **Mobil er en eftertanke.** Under 760 px bliver sidebaren en fuld blok øverst, så man scroller forbi hele navigationen, før indholdet kommer. Appen har et manifest og bruges som PWA, så det betyder noget.
6. **Brandet er ikke fulgt.** `--focus` (violet i lyst, rosé i mørkt) er defineret, men bruges ingen steder: fokusringen er blæk (`:focus-visible { outline: 2px solid var(--ink) }`). Brandet siger, at lilla netop skal findes i fokusringen.
7. **CSS-gæld.** `.legend` og `.legend i` er defineret to gange med forskellige mål (l. 434 og 530, 14×9 mod 11×11), og `.btn:disabled:hover` står to gange. Der er 103 inline `style="…"`, og omkring 45 af dem er `margin-top: Npx`. Det betyder, at der mangler en afstandsskala. CSS'en er vokset med én blok pr. iteration (M3, M7, M8, M9 …) i stedet for pr. komponent.
8. **Generisk bevægelse.** `.btn:hover` og `.pcard:hover` løfter elementet 1 px (`translateY(-1px)`). Det svarer ikke på en handling, det er bare pynt.
9. **Sidehovedet gentager værktøjer.** Tema-knappen og tandhjulet står i hver sides `phead` og konkurrerer med sidens egen primære handling.
10. **Ordvalg.** "Tasks" (navigationen) og "opgaver" (alle andre steder) blandes. Meta-strenge med midterprik ("3 åbne · 8 i alt", "−2,0 t fri · 104 % · 1 ⚠") fylder sidebaren.

## Designplan

### Farve: uændret

Brandet ligger fast, og det er rigtigt for et arbejdsværktøj. Fem roller er nok:

| Navn | Hex (lyst / mørkt) | Rolle |
|---|---|---|
| Blæk | `#0F0E13` / `#F4F2F8` | Tekst, primærknap, "i gang" |
| Papir | `#FFFFFF` / `#0F0E13` | Baggrund |
| Tåge | `#F4F2F8` / `#1E1C24` | Den ene panelflade pr. side og Ottos flise |
| Linje | `#E4E1EC` / `#2B2932` | Gridlinjer og rækkeskel |
| Signal | `#B42318` / `#F97066` | Kun blokeret, overskredet og overbooket |
| Violet (fokus) | `#7C3AED` / `#F472B6` | Kun fokusring, nu faktisk brugt |

Det, der ændres, er **hvor meget flade** der er: færre Tåge-kort og mere hvid side med linjer.

### Typografi: Geist med en rigtig skala

Én familie, Geist. Fredoka kun til "Otto". Geist Mono kun til koder og tokens. Skalaen er seks trin, og intet ligger imellem:

| Token | px / linje | Brug |
|---|---|---|
| `--t-display` | 56 / 1.02, 600, −0.045em | Kun forsidens svar (D4) |
| `--t-h1` | 32 / 1.08, 600, −0.03em | Sidetitel |
| `--t-h2` | 20 / 1.2, 600, −0.015em | Sektionstitel |
| `--t-body` | 15 / 1.5 | Rækker, felter, brødtekst |
| `--t-small` | 13 / 1.45 | Meta, hjælpetekst, kolonnehoveder |
| `--t-micro` | 11 / 1.3, 500 | Kun inde i grafik (Gantt-celler, kalenderens timetal) |

Etiketterne går fra STORE BOGSTAVER til `--t-small` i 500 og dæmpet farve, med almindeligt store og små bogstaver. Kolonnehoveder i tabeller må beholde en tydelig form, men i sentence case. Afstandsskalaen er `--s-1 … --s-6` = 4, 8, 12, 16, 24 og 40 px og erstatter alle inline-margins.

### Layout: blueprint-gridet bærer siden

Brandbogen beskriver allerede den ide, der skal bære appen: *"Siden står i et grid af tynde linjer med små plus-mærker, hvor linjerne mødes."* I dag findes den kun som pynt ved sidehovedet. I M16 bliver den strukturen.

```
┌ sidebar ┐+───────────────────────────────────────────────+
│         │ Kapacitet                         [Omplanlæg]  │  ← titel + én primær handling
│ Onyx    │+───────────────────────────────────────────────+  ← sektionsskel = gridlinje m. plus
│         │  ╭───────────────────────────────────────────╮ │
│         │  │  UGEN  (det ene panel på siden, se D4)    │ │
│         │  ╰───────────────────────────────────────────╯ │
│         │+──────────────────────+────────────────────────+  ← lodret gridlinje deler sektionen
│         │ Assistenten siger     │ Næste deadline         │
│         │ ● række              │ Kampagnerapport         │
│         │ ● række              │ om 3 dage               │
│         │+──────────────────────+────────────────────────+
│         │ Opgaver denne uge                              │
│         │ ─ række ─────────────────────────── 2 t  fre   │  ← rækker, ingen kort
│         │ ─ række ─────────────────────────── 4 t  12/11 │
└─────────┘+───────────────────────────────────────────────+
```

- Indholdet står **venstrestillet** i en kolonne på max 1120 px med de lodrette linjer, der allerede findes (`.main-inner`).
- **Sektioner skilles af vandrette linjer i fuld bredde med plus-mærker**, ikke af kort. Indholdet i en sektion er rækker uden rammer. Grid-krydsene er genbrug af `.phead::before/after`, gjort til en komponent (`.rule`).
- **Ét afrundet panel pr. side** (22 px, Tåge-flade). Det er sidens vigtigste ting. Alt andet er rækker og linjer.

### Principper

1. **Brug dristigheden ét sted:** forsidens uge-beholder (D4). Resten er stille og stramt.
2. **Linjer frem for kasser.** En ramme skal fortælle noget (et panel, et felt eller en dialog), ikke bare holde indhold.
3. **Én betydning pr. tegn.** En prik er sundhed, en diamant er en deadline, skravering er blokeret. Tal står som tal, ikke som prikker.
4. **Otto viser tilstand, ikke pynt.** Han optræder der, hvor hans stemning betyder noget: forsiden, tomme visninger og mens Studio arbejder.

### Gennemgang mod briefet (hvad blev ændret)

- **Første udkast** gjorde hele appen til et tæt net af hårstreger uden hjørner. Det ligner standard-"avis"-looket og passer ikke til brandets bløde, runde former. **Ændret til** at gridet kun er sidens ramme og sektionsskel, mens brandets runde former (999 px på knapper, 22 px på det ene panel) bliver.
- **Første udkast** til forsiden var et stort tal med en lille etiket og to nøgletal ved siden af. Det er det, forsiden har i dag, og det er standardløsningen. **Ændret til** uge-beholderen, hvor tallet er en del af en tegning af selve ugen (D4).
- **Brandet siger** "Geist Mono til små etiketter med store bogstaver (eyebrows)". Det er netop det generiske træk, M16 fjerner. **Anbefaling:** ret `brand/hey-otto/guidelines.md`, så eyebrows i grænseflader står i Geist og sentence case. Det er dit valg (se åbne spørgsmål).

## Iterationer (hver er én PR)

| # | Indhold | Størrelse | Synligt? |
|---|---|---|---|
| D1 | **Fundament.** Type- og afstandstokens, de 103 inline-styles flyttet til klasser, dubletterne (`.legend`, `.btn:disabled:hover`) samlet, `--focus` brugt i fokusringen, CSS sorteret pr. komponent i stedet for pr. iteration. Ingen ny layoutændring | S | Lidt |
| D1b | **Tilgængelighed og berøring** (se "Gennemgang med ui-ux-pro-max"). `lang`, tastatur på alle klikbare elementer, beskeder der læses op, fokus ved sideskift, 44 px trykområder og 16 px felter på touch, `dvh` og safe-area, knapper der viser "Gemmer …" | S | Lidt |
| D2 | **Etiketter og ord.** Store bogstaver væk (15 steder), "I DAG" → "I dag", løft ved hover væk, midterprik-strenge i sidebaren skåret ned, "Tasks"/"opgaver" gjort ens | XS | Ja |
| D3 | **Struktur.** `.rule` med plus-mærker som sektionsskel. `.card`, `.otto-says`, `.pcard`, `.isug`, `.ag-day` og `.pmet` bliver rækker eller sektioner. Ét panel pr. side | M | Meget |
| D4 | **Forsiden: ugen som beholder** (se nedenfor) | M | Meget |
| D5 | **Navigation.** Prikker kun til sundhed, tal højrestillet, ingen anden metalinje på underpunkter. Tema-knap og tandhjul ud af `phead` og ned i sidebarens fod. Mobil: topbar med appnavn og en skuffe, der glider ind, så indholdet står øverst | M | Ja |
| D6 | **Visningerne én for én.** Opgaver (liste), projekt (sprint, kanban og Gantt), kalender, Indbakke, Omplanlæg og Indstillinger (bliver et sidepanel fra højre på brede skærme og fuld skærm på mobil, som i dag) | L | Ja |
| D7 | **Kontrol.** Lokal opsætning til skærmbilleder (`npm run cf:migrate:local`, `npm run cf:dev` med `HEYOTTO_PASSWORD`, testdata), skærmbilleder i lyst, mørkt og 390 px før D3 og efter hver PR, kontrasttjek af dæmpet tekst | S | — |

D7's opsætning laves **først**, så D3–D6 kan bedømmes på billeder og ikke kun på kode.

### D4 i detaljer: ugen som beholder

Kapacitet svarer på ét spørgsmål: *hvor mange timer er der reelt tilbage?* I dag svarer et stort tal ("4,5 t/uge") og to celler ved siden af. I M16 tegnes ugen som en beholder:

```
╭──────────────────────────────────────────────────────────────────╮
│  Du har 4,5 timer fri i denne uge                       [Otto]   │  ← --t-display, tallet i blæk
│                                                         kaffe    │
│  ████████████▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░│           ┆                 │
│  drift 9 t    projekter 14 t  ad hoc 4│  fri 4,5 t ┆ loft 80 %     │  ← bar-track, nu sidens helt
│                                                                  │
│  Belægning 76 % af 37 t        Næste deadline: Rapport, om 3 dage│
╰──────────────────────────────────────────────────────────────────╯
```

- **Sætningen er svaret.** Ved overbooking står der fx "Du er 2 timer over i denne uge" i signalrødt, og den overskredne del skraveres ud over loftet (`.bar-over` findes allerede).
- **Otto står i det tomme rum** til højre for den fri del: kaffe ved plads, løber på kanten og arbejder ved overbooket, med de samme billeder som i dag.
- **Det ene orkestrerede øjeblik:** ved første indlæsning fyldes segmenterne fra venstre én gang (~400 ms). Det sker ikke ved hver gentegning og er slået fra ved reduced motion.
- På mobil står sætningen over bjælken, og Otto står under den.
- Tallene kommer fra `capacity()` som i dag. Det er kun visningen, der ændres.

## Gennemgang med ui-ux-pro-max (2026-11-07)

Anden gennemgang, lavet med `ui-ux-pro-max`-skillen. Den vægter i denne rækkefølge: tilgængelighed, berøring, ydelse, stil, layout, typografi, bevægelse, formularer og navigation. Planen ovenfor dækker mest stil og typografi. Det her dækker resten. Skillens søgescript kræver Python, som ikke er installeret på maskinen, så reglerne er læst direkte i `references/quick-reference.md` og `data/products.csv`. Fundene kommer fra koden i `dashboard/index.html`, ikke fra en browser.

**Retningen bekræftes.** Skillens profil for "Productivity Tool" (`products.csv` række 16) er flat design med mikrointeraktioner, Swiss-minimalisme og "speed & efficiency focus". Det passer med linjerne, gridet og den stille grænseflade i M16. Stilen skal ikke ændres.

### Fund, efter alvor

**Kritisk: tilgængelighed**

| # | Fund | Hvor | Regel |
|---|---|---|---|
| A1 | Siden har ingen `<html lang="da">`. Filen starter med `<meta charset>`, så skærmlæsere læser dansk med engelsk stemme | l. 1 | `voiceover-sr` |
| A2 | Ting, man kan klikke på, men ikke nå med tastaturet: `.hrow` (l. 1336), `.g-label` i Gantt (l. 1506), `.ceil-lbl` (l. 2530) og `.cn` (l. 2549) er `div`/`span` med `data-act` uden `tabindex` eller rolle. `.tcard` i kanban (l. 1248) kan få fokus, men Enter gør ingenting, for kun `ottorun` og `pcard` har en tastaturhandler (l. 3764, 4543) | se linjer | `keyboard-nav` |
| A3 | Beskeden `#flash` (l. 999) har hverken `role="status"` eller `aria-live`, så "Gemt" og "Kunne ikke gemme" bliver aldrig læst op. En fejl forsvinder af sig selv ligesom en succesbesked og har ingen "Prøv igen" | l. 1715 | `toast-accessibility`, `error-recovery` |
| A4 | Rammen om sekundære knapper og felter (`--border-strong` `#D3CFDD`) har kontrast 1,53:1 mod hvid. Kanten på en kontrol skal være mindst 3:1. Teksten er fin: `--muted` har 6,7:1 og sidebaren 7,8:1 | tokens l. 26–82 | `color-accessible-pairs` (WCAG 1.4.11) |
| A5 | Fokus bliver på linket i sidebaren, når man skifter side. En skærmlæser hører ikke, at der er en ny side. `route()` bevarer fokus ved gentegning, hvilket er rigtigt, men ved et nyt hash skal fokus flyttes til sidens `h1` | l. 4575 | `focus-on-route-change` |
| A6 | Ugekalenderen har `role="grid"` (l. 2785). Den rolle lover piletaster mellem cellerne, og de findes ikke. Fjern rollen (en liste pr. dag er nok), eller lav pilenavigationen | l. 2785 | `keyboard-nav` |

**Kritisk: berøring (appen er en PWA og bruges på telefonen)**

| # | Fund | Regel |
|---|---|---|
| B1 | `.icon-btn` er 30×30 px (l. 592) og `.btn` er cirka 31 px høj (13 px tekst og 7 px luft). Det er nok til WCAG's minimum på 24 px med mus, men under 44 px til en finger | `touch-target-size` |
| B2 | Felterne har 13–15 px tekst (fx `input[type=number]` 14 px på l. 513 og `.keybox` 13 px). iOS zoomer ind, når et felt under 16 px får fokus | `readable-font-size` |
| B3 | `100vh` bruges 6 steder, og der er ingen `dvh` og ingen `safe-area-inset`. Som installeret app på iPhone kommer indhold under hjemmebjælken, og højden hopper, når adresselinjen skjules | `viewport-units`, `safe-area-awareness` |
| B4 | 28 erklæringer har tekst under 12 px (11 × 10,5 px, 6 × 11 px, 5 × 11,5 px, 4 × 10 px og 2 × 9 px). Det hænger sammen med typeskalaen i D1, hvor 11 px kun er tilladt inde i grafik | `readable-font-size` |

**Høj: feedback og formularer**

| # | Fund | Regel |
|---|---|---|
| C1 | Der er 9 indbyggede `confirm()`-dialoger. De ligner ikke appen, og ved sletning af opgaver, projekter, sprints og rutiner er en ekstra dialog den langsomme løsning. Slet med det samme, og vis "Slettet · Fortryd" i beskeden. Det er billigt, for `BASE` og Historik findes allerede. Behold en bekræftelse, i appens egen dialog, kun ved det, der ikke kan fortrydes: tilbagekald et token, afbryd en Google-konto, kassér ugemte ændringer | `undo-support`, `confirmation-dialogs` |
| C2 | Formularerne har ingen `aria-invalid` og ingen `aria-describedby`. En fejl i editoren eller i Indstillinger står i beskeden nederst, ikke ved feltet | `error-placement` |
| C3 | Knapper giver ingen besked, mens der arbejdes: "Gem", "Send til Studio" og "Spørg assistenten" bør være slået fra og vise "Gemmer …", indtil svaret kommer, så man ikke trykker to gange | `loading-buttons`, `submit-feedback` |
| C4 | Ved hover løfter knapperne sig, men der sker intet, når man trykker. Erstat `translateY(-1px)` (M16 punkt 8) med en `:active`-tilstand (`scale(.98)` eller en mørkere flade), som også kan ses på en touchskærm | `press-feedback`, `motion-meaning` |

**Høj: navigation**

| # | Fund | Regel |
|---|---|---|
| N1 | Svar på åbent spørgsmål 2. Skillen siger sidebar fra 1024 px og en bundbjælke eller topbar under det, højst 5 punkter, med både ikon og tekst. **Anbefaling:** en bundbjælke med fire faner (Kapacitet, Opgaver, Kalender, Assistenten) og et femte punkt, "Projekter", der åbner skuffen med alle projekter. Så nås de mest brugte sider med én tommelfinger, og der er stadig plads til alle projekter | `adaptive-navigation`, `bottom-nav-limit` |
| N2 | Log ud og Indstillinger skal stå adskilt fra navigationen i sidebarens fod. Det passer med D5 | `destructive-nav-separation` |

### Ændringer i iterationerne

- **Ny iteration D1b, "Tilgængelighed og berøring" (S), lige efter D1.** Den indeholder A1–A6, B1–B3 og C3. Den ændrer næsten ikke udseendet, så den kan bygges, før skærmbillederne fra D7 findes. Berøringsmålene sættes kun ved grov markør (`@media (pointer: coarse)`): knapper bliver mindst 44 px høje, felter får 16 px tekst, og `.icon-btn` får et usynligt trykområde på 44 px, så skrivebordsudgaven ikke bliver luftigere.
- **D1** får også A4: en ny token, `--control-border`, med mindst 3:1 (fx `#8E89A0`) til felter og sekundære knapper. `--border` bliver til gridlinjer, som ikke skal have 3:1. B4 løses af typeskalaen.
- **D5** får N1 og N2.
- **D6** får C1, C2 og C4. Fortryd-beskeden (C1) bliver én komponent sammen med `#flash`: `role="status"`, en succes forsvinder efter 4 s, og en fejl bliver stående med "Prøv igen".
- **D7** får et tastaturtjek: kom igennem hver visning kun med Tab, Enter og Esc. Kør også axe eller Lighthouse på den lokale opsætning.

## Åbne spørgsmål til Kasper

1. **Brandreglen om eyebrows:** må `guidelines.md` ændres, så grænsefladen ikke bruger Mono med store bogstaver? Anbefalet: ja.
2. **Mobilnavigation:** skuffe fra en topbar (anbefalet, plads til alle projekter) eller en fast bundbjælke med fire faner (Kapacitet, Opgaver, Kalender, Assistenten)?
3. **CSS i egen fil:** skal CSS'en flyttes fra `index.html` til `dashboard/app.css`? Det gør D1–D6 lettere at reviewe. Kræver et tjek af `sw.js`-cachen.

## Færdig når

- Én typeskala og én afstandsskala. Ingen `font-size` uden for skalaen og ingen inline-margins.
- Ingen etiketter i store bogstaver i grænsefladen.
- Hver side har højst ét afrundet panel. Resten er linjer og rækker på gridet.
- Fokusringen er violet/rosé og synlig på alle interaktive elementer.
- Alt, der kan klikkes, kan også nås og bruges med tastaturet, og `<html lang="da">` er sat.
- På touchskærme er alle trykområder mindst 44 px, og felterne har mindst 16 px tekst.
- Beskeder læses op (`role="status"`), og sletning kan fortrydes i stedet for at kræve `confirm()`.
- Skærmbilleder af alle visninger i lyst, mørkt og 390 px er gennemgået, og `npm test` er grøn.
