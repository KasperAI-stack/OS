# HeyOtto OS — dashboard

Et Scrum-/projektoverblik over de store initiativer. Filerne hedder stadig `marketing-os…` — kun navnet på skærmen er skiftet, så datafil, server og gemte kladder virker som før. Selve dashboardet har ingen byggetrin og ingen biblioteker — det er én HTML-fil. Til daglig kører det på Netlify (se **På nettet** nedenfor), men det kan stadig åbnes lokalt.

## Kode og data er adskilt

| Fil | Hvad | I git? |
|---|---|---|
| `marketing-os.html` | Al kode: layout, logik, redigering | **Ja** |
| `marketing-os-data.js` | Alt indhold: projekter, sprints, opgaver | **Nej** — data, ikke kode |
| `marketing-os-data.example.js` | Tom skabelon at starte fra | Ja |
| `server.js` + `start-dashboard.cmd` | Valgfri lokal server | Ja |
| `../netlify.toml` + `../netlify/functions/data.mts` | Netlify-opsætningen og funktionen, der gemmer data på nettet | Ja |

Datafilen er bevidst holdt uden for versionsstyring. På nettet ligger den i Netlify Blobs med sin egen historik (se **På nettet**). Lokalt versioneres den af OneDrive — mister du den, så højreklik filen i File Explorer → **Versionshistorik**. Sikkerhedsnettet er aldrig git.

Det tekniske greb, der gør opdelingen mulig: HTML-filen indlæser data med et klassisk `<script src>`. En `file://`-side må nemlig **ikke** `fetch`e en nabofil — men den må godt indlæse den som script. Derfor virker opdelingen også, når du bare dobbeltklikker filen.

## Tre måder at køre den på

**På nettet: `heyotto-os.netlify.app`** — sådan bruges det til daglig, fra computer og telefon. Gem sker lydløst i skyen. Se afsnittet nedenfor.

**Dobbeltklik `marketing-os.html`** — virker altid, også uden Node. Du kan redigere alt, og når du trykker Gem, spørger Windows én gang pr. session, hvilken fil der må skrives. Vælg `marketing-os-data.js`. Derefter er gem lydløst resten af sessionen.

**Dobbeltklik `start-dashboard.cmd`** — starter en lille lokal server og åbner `localhost:7777`. Gem sker lydløst uden dialoger. Serveren lytter kun på din egen maskine. Luk vinduet for at stoppe den.

Siden mærker selv, hvilken tilstand den er i, og skriver det nederst i sidebaren.

De to lokale måder bruger datafilen på din computer — ikke den på nettet. Bruger du begge, har du to sæt data. Flyt mellem dem med **Download datafil** og **Hent datafil ind**.

## På nettet (Netlify)

Dashboardet ligger på Netlify-projektet **heyotto-os**. Projektet er **privat**: siden — og funktionen, der gemmer — kan kun nås af den, der er logget ind på Netlify som medlem af teamet. Første gang i en browser beder Netlify dig logge ind; derefter husker browseren det. Der er intet password i koden.

**Hvor data bor.** I Netlify Blobs — Netlifys indbyggede lager, som ikke kan nås udefra. `netlify/functions/data.mts` gør det samme, som `server.js` gør lokalt, så dashboardet ikke ved forskel:

| Adresse | Hvad |
|---|---|
| `/marketing-os-data.js` | Datafilen, som siden indlæser |
| `/save` | Gem — afviser alt, der ikke ligner datafilen |
| `/historik` | De seneste 60 gemte versioner, hver med et download-link |

**Knapperne nederst i sidebaren.**

- **Download datafil** — hent de nuværende data ned som fil. En manuel backup, og vejen til at lade Claude rette i data (se nedenfor).
- **Hent datafil ind** — gør en fil til de gældende data: din gamle fil fra OneDrive, en download, eller en version fra historikken. Siden spørger først.
- **Historik** — hver gang du gemmer, lægges versionen også i historikken. Vil du tilbage: hent den version ned, og vælg den med **Hent datafil ind**.

**Computer og telefon på samme tid.** Siden husker, hvilken version den indlæste. Har du gemt på telefonen, siden du åbnede siden på computeren, nægter computeren at gemme og siger det — i stedet for stille at overskrive telefonens ændringer. Genindlæs, så ser du de nye data; dine ugemte ændringer ligger i kladden og kan gendannes.

**Test rører aldrig rigtige data.** Kun produktionen (`heyotto-os.netlify.app`) bruger det rigtige lager. En Deploy Preview af en pull request — eller et branch-deploy — får sit eget, tomme lager.

**Udrulning.** Netlify bygger fra `main` på GitHub. Alt står i `netlify.toml` — der er intet byggetrin at sætte op. Merger du en pull request, er den live et minut efter.

## Forsiden: kapacitet

Dashboardet åbner på kapacitetskontrollen, fordi det er dét, man åbner det for: hvor mange timer er der reelt tilbage, når drift, projekter og det uplanlagte er trukket fra.

```
fri kapacitet = (tilgængelige timer × planlægningsloft) − drift − projekter − ad hoc-buffer
```

**Timer betyder "lige nu", ikke "i alt".** En opgave med deadline i marts trækker 0 timer i denne uge. Det er dét, der gør forskel på en opgaveliste og et kapacitetsregnskab — og det er derfor tidslinjen og kapaciteten er to forskellige tidshorisonter.

**Kategorien kommer fra projektet, ikke fra opgaven.** Hvert projekt har en `kind` — `drift`, `projekt` eller `adhoc` — og alle dets opgaver tæller i den bås. Derfor ligger Drift og Ad hoc som projekter i sidebaren på linje med Africa Tours 2.0: de er hverdagen, ikke noget ved siden af.

**Ad hoc-bufferen måler sig selv.** Indtil to uger er registreret i ugeloggen, er den dit estimat. Derefter er den gennemsnittet af det faktiske forbrug, og feltet låses. Har du selv ført ad hoc-opgaver ind for mere end bufferen, er det dit tal der gælder — ellers ville det tælle dobbelt.

**Planlægningsloftet er ikke 100 %,** og Kingman-kurven på forsiden viser hvorfor: ventetiden vokser hyperbolsk med belægningen. Springet fra 85 % til 95 % tredobler ventetiden på alt, der ligger i kø, uden at nogen har arbejdet langsommere.

Asana kan ikke hentes automatisk. Det krævede claude.ai's MCP-runtime, som kun findes inde i et artifact — en fil på disken har ingen vej derhen. Bed i stedet Claude om at hente opgaverne og skrive dem ind.

## Redigering

- **Opgave** — klik på et kort, på en linje i historikken, eller på navnet i tidslinjen
- **Ny opgave** — knappen i sprintens hoved
- **Projekt** — blyanten ved projektnavnet; nyt projekt via **+ Nyt projekt** i sidebaren
- **Sprint** — blyanten ved sprintens navn; ny via **+ Ny sprint**

Ændringer lægger sig i hukommelsen, indtil du trykker **Gem ændringer**. At der er noget ugemt, vises tre steder: knappen skifter farve, sidebaren skriver det, og fanens titel får en prik foran.

**Ugemte ændringer overlever nu et genindlæs.** Ved hver ændring skrives en kladde til browseren. Åbner du siden igen med noget ugemt, møder du et banner med **Gendan ændringerne** eller **Kassér**. Kladden ryddes, så snart du har gemt rigtigt.

Kladden er en sikkerhedsline, ikke et lager. Den ligger i den browser, du sidder ved, og følger ikke med filen — og fordi `file://` og `localhost` tæller som hver sit sted i browseren, deler de to måder at åbne dashboardet på ikke kladde. Filen er stadig den eneste sandhed.

**Når du gemmer fra en fil åbnet med dobbeltklik,** spørger Windows én gang pr. session, hvilken fil der må skrives — vælg `marketing-os-data.js`. Lukker du filvælgeren uden at vælge, bliver der **ikke** gemt, og siden siger det tydeligt. Det er værd at læse beskeden: en lukket filvælger ligner ellers et vellykket gem.

Sletning af et projekt eller en sprint blokeres, så længe der ligger opgaver i den. Flyt eller slet dem først.

## Tidslinjen: filtrering og gruppering

Bjælken over tidslinjen har fire kontroller:

- **Gruppér** — ingen, epic, status eller ejer. Grupperne bliver til baner med en overskriftsrække og et antal. Epics kommer i den rækkefølge, de står i `epics`; statusser i tavlerækkefølge; ejere alfabetisk. "Uden epic" og "uden ejer" ligger altid nederst.
- **Vis** — alle, kun åbne, kun med deadline, eller kun det der forfalder inden tre måneder.
- **Sortér** — tidslinje (startmåned), deadline eller titel. Opgaver uden deadline ligger sidst ved deadline-sortering.
- **Epics** — vises kun for projekter, der faktisk bruger epics.

Månedsvinduet følger det filtrerede. Filtrerer du til én epic, zoomer tidslinjen ind på netop dens spænd — indeværende måned er dog altid med.

Valgene er **visning, ikke data**. De gemmes i browseren og havner aldrig i datafilen; et filterskift gør derfor ikke siden "ugemt". Det betyder også, at de er personlige for den browser, du sidder ved.

Et epic-filter fra ét projekt tømmer ikke et andet: gælder filteret ikke for det projekt, du ser på, ignoreres det.

## Datakontrakten

Tre flade arrays: `projects`, `sprints`, `tasks`. **Én opgave = én linje.** Det er dét, der gør, at både dashboardet og Claude Code kan redigere den samme fil uden at træde på hinanden — og at git-diffene forbliver læselige.

| Felt | Format | Bemærkning |
|---|---|---|
| `id` | kort og unikt | Håndtaget. Skift det aldrig |
| `project` | et `id` fra `projects` | Peger den forkert, bliver opgaven usynlig |
| `sprint` | `"ÅÅÅÅ-MM"` | Hvilken sprint opgaven er **committet** til |
| `start` / `end` | `"ÅÅÅÅ-MM"` | Bjælkens udstrækning. Tomme? Så bruges `sprint` |
| `status` | se nedenfor | Skal matche præcist |
| `title`, `owner`, `note` | fri tekst | |
| `due` | `"ÅÅÅÅ-MM-DD"` eller tom | Den eneste rigtige dato. Tegner en diamant og markerer overskredet |
| `epic` | nøgle fra `epics` | Valgfri. Lille mærke på kortet, fuldt navn som tooltip |
| `hours` | tal | Timer pr. uge **lige nu**. 0 hvis opgaven ikke trækker tid i denne uge |

Projekter har desuden `kind` (`drift` / `projekt` / `adhoc`), som afgør hvilken bås deres timer havner i på forsiden. `kapacitet` og `uger` øverst i filen holder modellens tal og ugeloggen.

**Statusser — præcis disse fem:**

```
"Ikke startet"   "I gang"   "Blokeret"   "Færdig"   "Droppet"
```

`Droppet` tælles ikke med i fremdriften, men bliver stående i historikken.

**Hvorfor `sprint` og `start`/`end` er adskilt:** `sprint` er en *forpligtelse* — "det her arbejder jeg på i oktober". `start`/`end` er en *tidslinje*. En opgave, der løber fem måneder, hører stadig kun til i én sprint.

**Hvorfor måneder og ikke datoer:** en sprint *er* en måned, og tidslinjens kolonner *er* måneder. Månedsstrenge rører aldrig `Date`, så ingen tidszone kan skubbe november til oktober. `due` er undtagelsen, hvor dagen faktisk betyder noget.

## Når Claude redigerer filen

Redigeringer forankres på opgavens `id`, så de rammer præcis én linje. Efter en ændring: **F5** i browseren. Står tidsstemplet i bunden stadig på det gamle, cacher browseren filen — så **Ctrl+Shift+R**.

**På nettet** kan Claude ikke selv nå dine data — projektet er privat. Fremgangsmåden er: **Download datafil** → giv filen til Claude → Claude retter → **Hent datafil ind** med den rettede fil. Har du gemt noget på nettet imens, så download igen først.

Omvendt: har du redigeret i browseren uden at gemme, og beder Claude ændre noget, går dine ugemte ændringer tabt. Gem først.

## Valideringen

Flade data fejler i stilhed — en stavefejl i en status giver en usynlig bjælke, ikke en fejlmeddelelse. Derfor tjekkes alt ved indlæsning, og problemer vises som et orange banner:

- ukendt status (bjælken tegnes **signalgul med kant**, så den ikke kan overses — en farve, der bevidst ikke findes i brandet)
- opgave, der peger på et projekt eller en sprint, der ikke findes
- `end` før `start`, ugyldige dato- eller månedsformater
- to opgaver med samme `id`

Er filen direkte ødelagt, vises fejlen i stedet for en hvid skærm.

## Design

Farver, skrift og former følger Hey Otto-brandbogen — se [`brand/hey-otto/guidelines.md`](../brand/hey-otto/guidelines.md) og selve brandbogen i [`brand/hey-otto/brand-book.html`](../brand/hey-otto/brand-book.html). Alle farver ligger som CSS-variabler øverst i `<style>`, så et farveskift er ét sted.

- **Skrift:** Geist til alt, Geist Mono til de små etiketter med store bogstaver. Begge hentes fra Google Fonts; uden net falder siden tilbage til Helvetica Neue / Arial, og intet layout afhænger af en bestemt fonts mål.
- **Farver:** sort, grå og hvid bærer designet. Lilla er en accent og bruges sparsomt — gradientrammen om dommen på forsiden er det eneste sted, den får lov at fylde.
- **Statusfarver** holder sig til brandfarverne: Ikke startet = Sølvgrå, I gang = Violet, Blokeret = Orkidé med skravering, Færdig = Onyx (Tåge i mørkt tema), Droppet = stiplet. Skraveringen gør, at Blokeret kan skelnes i sort/hvid-print og af en farveblind læser.
- **Former:** knapper og chips er helt runde og i tekstfarven, kort har 22 px hjørner, alt er 1 px-linjer uden skygger. Hovedkolonnen står mellem tynde lodrette linjer med plus-mærker, hvor de møder de vandrette.

Tidslinjen er CSS Grid, ikke SVG: en Gantt er i praksis en tabel, og grid giver sticky navnekolonne, tooltips og korrekt zoom uden koordinatmatematik.

Lyst og mørkt tema følger systemet, med en knap der overstyrer begge veje. Der er print-styles, så tidslinjen kan tages med til et møde på papir.
