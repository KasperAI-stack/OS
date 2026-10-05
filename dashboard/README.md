# HeyOtto OS — dashboard

Et Scrum-/projektoverblik over de store initiativer, med kapacitet på forsiden. Det er en webapp på **heyotto-os.netlify.app**, som du bruger fra computer og telefon. Alt ligger i skyen — der er ingen filer at holde styr på.

## Sådan hænger det sammen

| Hvad | Hvor |
|---|---|
| Appen (layout, logik, redigering) | `dashboard/index.html` — én HTML-fil, intet byggetrin, ingen biblioteker |
| API'et (login, data, historik, Claudes nøgle) | `netlify/functions/api.mts` |
| Indholdet (projekter, sprints, opgaver, kapacitet) | Netlify Blobs — Netlifys indbyggede lager. Aldrig i git |
| Opsætningen | `netlify.toml` — Netlify bygger fra `main` på GitHub |

Siden indeholder ingen data. Den henter dem fra API'et som JSON, når du er logget ind, og gemmer dem samme vej.

## Log ind

Første gang i en browser beder appen om adgangskoden. Derefter husker browseren dig i 90 dage. **Log ud** står nederst i sidebaren.

- Adgangskoden er miljøvariablen **`HEYOTTO_PASSWORD`** i Netlify (*Project configuration → Environment variables*). Den skal være mindst 12 tegn. Står den der ikke, kan ingen logge ind, og appen siger det.
- Vil du skifte adgangskode, så ret variablen i Netlify og lav et nyt deploy (*Deploys → Trigger deploy*). Alle, der var logget ind, bliver logget ud.
- Efter 10 forkerte forsøg fra samme sted spærres der i et kvarter.

## Gem, kladde og to enheder

Ændringer lægger sig i hukommelsen, indtil du trykker **Gem ændringer**. At der er noget ugemt, vises tre steder: knappen skifter farve, sidebaren skriver det, og fanens titel får en prik foran.

**Ugemte ændringer overlever et genindlæs.** Ved hver ændring skrives en kladde til browseren. Åbner du siden igen med noget ugemt, møder du et banner med **Gendan ændringerne** eller **Kassér**. Kladden er en sikkerhedsline i den browser, du sidder ved — ikke et lager. Det, der er gemt i skyen, er sandheden.

**Computer, telefon og Claude på samme tid.** Siden husker, hvilken version den hentede. Er der gemt et andet sted siden — på telefonen eller af Claude — nægter siden at gemme og siger det, i stedet for stille at overskrive. Genindlæs, så ser du de nye data. Dine ugemte ændringer ligger i kladden, og banneret advarer, hvis du er ved at erstatte nyere data med dem.

## Historik

Hver gang der gemmes — af dig eller af Claude — lægges versionen også i **Historik** (link nederst i sidebaren). De seneste 60 versioner gemmes, med hvem der gemte og hvor mange projekter og opgaver der var. **Gå tilbage hertil** gør en ældre version til den gældende. Den nuværende bliver liggende i historikken, så det kan altid fortrydes.

## Claude-adgang

Claude kan læse og rette dine data direkte — fx lægge opgaver ind fra Asana, når du beder om det. Det sættes op én gang:

1. Åbn **Claude-adgang** nederst i sidebaren, og klik **Lav en nøgle til Claude**. Nøglen vises kun den ene gang.
2. I Claude: miljøets indstillinger (miljø-menuen i sessionens titellinje → **Edit**):
   - tilføj miljøvariablen **`HEYOTTO_API_KEY`** med nøglen som værdi
   - under **Network access**: vælg **Custom**, og tilføj `heyotto-os.netlify.app` under Allowed domains (behold standardlisten)
3. Start en ny session.

Claude kan ikke se din adgangskode eller lave nye nøgler. Alt, hvad Claude gemmer, står i Historik som „gemt af Claude“. **Lav en ny nøgle** udskifter nøglen (den gamle holder op med at virke med det samme), og **Fjern Claudes adgang** lukker helt. Fremgangsmåden for Claude står i `.claude/skills/heyotto-os-data/SKILL.md`.

## API'et

Alle svar er JSON. Fejl er `{ "error": "dansk besked" }`.

| Metode og adresse | Hvad |
|---|---|
| `POST /api/login` `{ password }` | Log ind → session-cookie |
| `POST /api/logout` | Log ud |
| `GET /api/data` | `{ rev, data }` |
| `PUT /api/data` `{ rev, data }` | Gem → `{ rev }`. **409**, hvis `rev` ikke længere er den nyeste |
| `GET /api/history` | `{ versions: [...] }` |
| `POST /api/history/:id/restore` | Gør en gammel version gældende |
| `GET` / `POST` / `DELETE /api/claude-key` | Status / lav ny / fjern — kun for dig, ikke for Claude |

Du er logget ind med enten session-cookien eller `Authorization: Bearer <nøgle>` (Claude). Ændringer med cookie skal komme fra appen selv: JSON og samme oprindelse. API'et svarer aldrig 403 eller 404. Netlify ville ved de koder lede efter en statisk side i stedet, så afvisninger er 400/401, og en forsvundet version er 410.

**Test rører aldrig rigtige data.** Kun produktionen (`heyotto-os.netlify.app`) bruger det rigtige lager. En Deploy Preview af en pull request — eller et branch-deploy — får sit eget, tomme lager med sin egen Claude-nøgle. Netlify kræver desuden team-login på previews.

**Udrulning.** Netlify bygger fra `main` på GitHub. Merger du en pull request, er den live et minut efter. Prøv den først på den Deploy Preview, Netlify linker til i pull requesten.

## Forsiden: kapacitet

Dashboardet åbner på kapacitetskontrollen, fordi det er dét, man åbner det for: hvor mange timer er der reelt tilbage, når drift, projekter og det uplanlagte er trukket fra.

```
fri kapacitet = (tilgængelige timer × planlægningsloft) − drift − projekter − ad hoc-buffer
```

**Timer betyder "lige nu", ikke "i alt".** En opgave med deadline i marts trækker 0 timer i denne uge. Det er dét, der gør forskel på en opgaveliste og et kapacitetsregnskab — og det er derfor tidslinjen og kapaciteten er to forskellige tidshorisonter.

**Kategorien kommer fra projektet, ikke fra opgaven.** Hvert projekt har en `kind` — `drift`, `projekt` eller `adhoc` — og alle dets opgaver tæller i den bås. Derfor ligger Drift og Ad hoc som projekter i sidebaren på linje med Africa Tours 2.0: de er hverdagen, ikke noget ved siden af.

**Ad hoc-bufferen måler sig selv.** Indtil to uger er registreret i ugeloggen, er den dit estimat. Derefter er den gennemsnittet af det faktiske forbrug, og feltet låses. Har du selv ført ad hoc-opgaver ind for mere end bufferen, er det dit tal der gælder — ellers ville det tælle dobbelt.

**Planlægningsloftet er ikke 100 %,** og Kingman-kurven på forsiden viser hvorfor: ventetiden vokser hyperbolsk med belægningen. Springet fra 85 % til 95 % tredobler ventetiden på alt, der ligger i kø, uden at nogen har arbejdet langsommere.

Asana hentes ikke automatisk. Bed i stedet Claude om at hente opgaverne og skrive dem ind — med Claude-adgang skriver Claude direkte i skyen.

## Redigering

- **Opgave** — klik på et kort, på en linje i historikken, eller på navnet i tidslinjen
- **Ny opgave** — knappen i sprintens hoved
- **Projekt** — blyanten ved projektnavnet; nyt projekt via **+ Nyt projekt** i sidebaren
- **Sprint** — blyanten ved sprintens navn; ny via **+ Ny sprint**

Se **Gem, kladde og to enheder** ovenfor for, hvordan der gemmes.

Sletning af et projekt eller en sprint blokeres, så længe der ligger opgaver i den. Flyt eller slet dem først.

## Tidslinjen: filtrering og gruppering

Bjælken over tidslinjen har fire kontroller:

- **Gruppér** — ingen, epic, status eller ejer. Grupperne bliver til baner med en overskriftsrække og et antal. Epics kommer i den rækkefølge, de står i `epics`; statusser i tavlerækkefølge; ejere alfabetisk. "Uden epic" og "uden ejer" ligger altid nederst.
- **Vis** — alle, kun åbne, kun med deadline, eller kun det der forfalder inden tre måneder.
- **Sortér** — tidslinje (startmåned), deadline eller titel. Opgaver uden deadline ligger sidst ved deadline-sortering.
- **Epics** — vises kun for projekter, der faktisk bruger epics.

Månedsvinduet følger det filtrerede. Filtrerer du til én epic, zoomer tidslinjen ind på netop dens spænd — indeværende måned er dog altid med.

Valgene er **visning, ikke data**. De gemmes i browseren og havner aldrig i dine data; et filterskift gør derfor ikke siden "ugemt". Det betyder også, at de er personlige for den browser, du sidder ved.

Et epic-filter fra ét projekt tømmer ikke et andet: gælder filteret ikke for det projekt, du ser på, ignoreres det.

## Datakontrakten

`data` er ét JSON-objekt med `meta`, `kapacitet`, `uger`, `epics` og tre flade lister: `projects`, `sprints`, `tasks`. Både appen og Claude retter i det samme objekt. API'et afviser data, der ikke har den grundform.

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

Projekter har desuden `kind` (`drift` / `projekt` / `adhoc`), som afgør hvilken bås deres timer havner i på forsiden. `kapacitet` og `uger` holder modellens tal og ugeloggen.

**Statusser — præcis disse fem:**

```
"Ikke startet"   "I gang"   "Blokeret"   "Færdig"   "Droppet"
```

`Droppet` tælles ikke med i fremdriften, men bliver stående i historikken.

**Hvorfor `sprint` og `start`/`end` er adskilt:** `sprint` er en *forpligtelse* — "det her arbejder jeg på i oktober". `start`/`end` er en *tidslinje*. En opgave, der løber fem måneder, hører stadig kun til i én sprint.

**Hvorfor måneder og ikke datoer:** en sprint *er* en måned, og tidslinjens kolonner *er* måneder. Månedsstrenge rører aldrig `Date`, så ingen tidszone kan skubbe november til oktober. `due` er undtagelsen, hvor dagen faktisk betyder noget.

## Valideringen

Flade data fejler i stilhed — en stavefejl i en status giver en usynlig bjælke, ikke en fejlmeddelelse. Derfor tjekkes alt ved indlæsning, og problemer vises som et banner:

- ukendt status (bjælken tegnes **signalgul med kant**, så den ikke kan overses — en farve, der bevidst ikke findes i brandet)
- opgave, der peger på et projekt eller en sprint, der ikke findes
- `end` før `start`, ugyldige dato- eller månedsformater
- to opgaver med samme `id`

Kan data slet ikke tegnes eller hentes, vises fejlen i stedet for en hvid skærm — og dine ugemte ændringer i browseren røres ikke.

## Design

Farver, skrift og former følger Hey Otto-brandbogen — se [`brand/hey-otto/guidelines.md`](../brand/hey-otto/guidelines.md) og selve brandbogen i [`brand/hey-otto/brand-book.html`](../brand/hey-otto/brand-book.html). Alle farver ligger som CSS-variabler øverst i `<style>`, så et farveskift er ét sted.

- **Skrift:** Geist til alt, Geist Mono til de små etiketter med store bogstaver. Begge hentes fra Google Fonts; uden net falder siden tilbage til Helvetica Neue / Arial, og intet layout afhænger af en bestemt fonts mål.
- **Farver:** sort, grå og hvid bærer designet. Lilla er en accent og bruges sparsomt — gradientrammen om dommen på forsiden er det eneste sted, den får lov at fylde.
- **Statusfarver** holder sig til brandfarverne: Ikke startet = Sølvgrå, I gang = Violet, Blokeret = Orkidé med skravering, Færdig = Onyx (Tåge i mørkt tema), Droppet = stiplet. Skraveringen gør, at Blokeret kan skelnes i sort/hvid-print og af en farveblind læser.
- **Former:** knapper og chips er helt runde og i tekstfarven, kort har 22 px hjørner, alt er 1 px-linjer uden skygger. Hovedkolonnen står mellem tynde lodrette linjer med plus-mærker, hvor de møder de vandrette.

Tidslinjen er CSS Grid, ikke SVG: en Gantt er i praksis en tabel, og grid giver sticky navnekolonne, tooltips og korrekt zoom uden koordinatmatematik.

Lyst og mørkt tema følger systemet, med en knap der overstyrer begge veje. Der er print-styles, så tidslinjen kan tages med til et møde på papir.
