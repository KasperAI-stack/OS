# Marketing OS — dashboard

`marketing-os.html` er et Scrum-/projektoverblik over de store initiativer. Én selvstændig fil uden byggetrin, biblioteker eller server.

**Sådan åbnes den:** dobbeltklik filen i File Explorer. Den kører fra `file://` i Edge eller Chrome. OneDrive synkroniserer den til Microsoft 365, så versionshistorik og backup følger med.

**Sådan opdateres den:** ved at bede Claude Code om det — *"sæt crm-lancering til I gang"*, *"opret en december-sprint for Hjemmeside"*. Dashboardet er **read-only i browseren**; der er ingen knapper at redigere med. Efter en ændring: tryk **F5**. Hvis tidsstemplet i bunden ikke er skiftet, cacher browseren filen — tryk **Ctrl+Shift+R**.

---

## Datakontrakten

Al data ligger i `<script>`-blokken **øverst i filen**, før CSS'en. Tre flade arrays: `projects`, `sprints`, `tasks`.

**Den bærende regel: én opgave = én linje.** Redigeringer forankres altid på opgavens `id`, så de rammer præcis den linje og intet andet.

### Felter på en opgave

| Felt | Format | Bemærkning |
|---|---|---|
| `id` | kort og unikt, fx `crm-lancering` | Håndtaget. Skift det aldrig — det er dét, man refererer til |
| `project` | et `id` fra `projects` | Peger den på noget ukendt, bliver opgaven usynlig overalt |
| `sprint` | `"ÅÅÅÅ-MM"` | Hvilken sprint opgaven er **committet** til |
| `start` / `end` | `"ÅÅÅÅ-MM"` | Bjælkens udstrækning på tidslinjen. Udelades de, bruges `sprint` |
| `status` | se nedenfor | Skal matche præcist |
| `title` | fri tekst | |
| `owner` | fri tekst | |
| `due` | `"ÅÅÅÅ-MM-DD"` eller `""` | Den eneste rigtige dato. Tegner en diamant på bjælken og markerer overskredet deadline |
| `epic` | en nøgle fra `epics`, fx `"E2"` | Valgfri. Vises som lille mærke; det fulde navn kommer frem som tooltip |
| `note` | fri tekst | Vises på opgavekortet og som tooltip på tidslinjen |

`epics` er et valgfrit opslag øverst i datablokken (`{E1:"Fundament & hosting", …}`). Projekter uden epics udelader bare feltet — intet går i stykker.

### Statusser — skal skrives præcis sådan her

```
"Ikke startet"   "I gang"   "Blokeret"   "Færdig"   "Droppet"
```

`Droppet` tælles ikke med i fremdriften, men bliver stående i historikken.

### Hvorfor `sprint` og `start`/`end` er adskilt

`sprint` er en **forpligtelse** — "det her arbejder jeg på i oktober". `start`/`end` er en **tidslinje** — hvornår opgaven løber. En opgave, der strækker sig over fem måneder, hører stadig kun til i én sprint. Slog man de to sammen, ville den dukke op i fem sprints i træk, og sprintvisningen ville miste sin mening.

### Hvorfor måneder og ikke datoer

En sprint *er* en måned, og tidslinjens kolonner *er* måneder — dagspræcision ville blive kasseret i visningen. Det gør også håndredigering sikrere: `"2026-11"` → `"2026-12"` kræver ikke at vide, om december har 30 eller 31 dage. Og månedsstrenge rører aldrig `Date`, så en tidszone kan ikke skubbe november til oktober. `due` er den ene undtagelse, hvor dagen faktisk betyder noget.

---

## Opskrifter

**Ændr en status** — find linjen med opgavens `id`, ret `status`-feltet, opdatér `meta.updated`.

**Tilføj en opgave** — indsæt én ny linje før `]`, der lukker `tasks`. Kopiér en eksisterende linje og ret felterne, så feltrækkefølgen holdes ensartet.

**Opret en sprint** — tilføj `{project:"…", month:"ÅÅÅÅ-MM", goal:"…"}` til `sprints`. Et sprintmål er en sætning om, hvad der skal være sandt, når måneden er slut — ikke en opremsning af opgaverne.

**Tilføj et projekt** — tilføj `{id:"…", name:"…", tagline:"…"}` til `projects`. Rækkefølgen i arrayet er rækkefølgen i sidebaren. Et projekt uden opgaver viser en tom tilstand, ikke en fejl.

**Flyt en opgave** — ret `project` eller `sprint` på linjen. Intet skal flyttes fysisk i filen.

**Opdatér altid `meta.updated`.** Den vises i sidebaren og i bunden og er den eneste måde at se, om browseren viser den nyeste version.

`meta.note` tegner det grå banner øverst. Sæt den til `""`, når såningsforbeholdet ikke længere er relevant.

---

## Valideringen

Flade data fejler i stilhed — en stavefejl i en status giver en usynlig bjælke, ikke en fejlmeddelelse. Derfor tjekkes data ved hver indlæsning, og problemer vises som et orange banner øverst i stedet for at blive skjult:

- ukendt status (bjælken tegnes **magenta**, så den ikke kan overses)
- opgave, der peger på et projekt eller en sprint, der ikke findes
- `end` før `start`
- to opgaver med samme `id`
- ugyldige dato- eller månedsformater

Bliver JSON'en direkte ødelagt, fanges det af en try/catch, og siden viser fejlen frem for en hvid skærm.

Dukker banneret op: ret det, der står i det. Det er altid en fejl i datablokken, aldrig i koden.

---

## Noter om design

Farver og typografi følger [`brand/guidelines.md`](../brand/guidelines.md). Overskrifter bruger **Cormorant Garamond** som stand-in for brandfonten **The Seasons**, der er betalt og ikke ligger i repoet. Fontstakken har The Seasons først, så den overtager af sig selv, den dag den installeres — søg efter `BRANDFONT` i filen.

Tidslinjen er bygget med CSS Grid frem for SVG, fordi en Gantt i praksis er en tabel: det giver sticky navnekolonne, tekstafkortning, tooltips og korrekt opførsel ved zoom uden en eneste linje koordinatmatematik.

Filen understøtter lyst og mørkt tema (følger systemet, med en knap der kan overstyre begge veje) og har print-styles, så tidslinjen kan tages med til et møde på papir.
