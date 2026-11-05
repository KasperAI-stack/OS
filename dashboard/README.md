# HeyOtto OS — dashboard

Et Scrum-/projektoverblik over de store initiativer, med kapacitet på forsiden. Det er en webapp på **heyotto-os.netlify.app**, som du bruger fra computer og telefon. Alt ligger i skyen — der er ingen filer at holde styr på.

## Sådan hænger det sammen

| Hvad | Hvor |
|---|---|
| Google-forbindelsen og kalendersynken | `netlify/lib/google.mts`, kørt hvert 15. minut af `netlify/functions/calendar-sync.mts` |
| Appen (layout, logik, redigering) | `dashboard/index.html` — én HTML-fil, intet byggetrin, ingen biblioteker |
| Otto-illustrationerne | `dashboard/otto/` — PNG'er med gennemsigtig baggrund |
| API'et (login, data, historik, Claudes nøgle, Claude-jobs) | `netlify/functions/api.mts` |
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

**Computer, telefon og Claude på samme tid.** Siden husker, hvilken version den hentede. Er der gemt et andet sted siden — på telefonen eller af Claude — afviser serveren først. Siden henter så den nye version og fletter dine ændringer ind pr. projekt, sprint, opgave og uge:

- ændret kun hos dig → din værdi
- ændret kun derude → den nye
- tilføjet eller slettet ét sted → det gælder

Kun hvis samme felt er ændret begge steder, bliver du spurgt: **Behold mine** eller **Brug de nye**. Begge versioner ligger bagefter i Historik.

Kladden husker også, hvad den byggede på. Gendanner du en kladde efter, at data er ændret i skyen, flettes den ind på samme måde i stedet for at erstatte det nye.

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

## Claude udfører opgaver

Claude kan gå i gang med en opgave, så snart du beder om det, fx skrive et mailudkast, lave en ugerapport eller foreslå annoncetekster. Der er to måder at starte på:

- Åbn opgaven, og tryk **✦ Lad Claude udføre**. Feltet over knappen er valgfrit. Står der ingenting, arbejder Claude ud fra titel og note.
- Skriv **Claude** som ejer, og gem. Det virker både på nye opgaver og på opgaver, du giver videre til Claude.

Claude arbejder i skyen i en **Claude Code Routine** på dette repo, med dine agenter, skills og forbindelser. Mens Claude arbejder, står der „Claude arbejder …“ på kortet. Når Claude er færdig, står der **Klar til dig**, og i opgaven ser du udkastet med knapperne **Kopiér**, **Godkend**, **Kassér** og **Se Claudes session**. Siden opdager selv, når Claude er færdig, så du behøver ikke genindlæse.

**Claude laver kun udkast.** En automatisk start kan ikke give samtykke til noget, så Claude sender ingen mails, svarer ikke på invitationer, ændrer ingen annoncer og bruger ingen penge. Vil du have noget sendt, åbner du Claudes session og siger det dér. Så er det din beslutning.

**Opsætning (én gang).** Trinene står også på siden **Claude-adgang**, hvor instruktionen kan kopieres med én knap.

1. Giv Claude adgang med en nøgle (se ovenfor), i det Claude-miljø routinen skal bruge.
2. På [claude.ai/code/routines](https://claude.ai/code/routines) → **New routine**:
   - navn: „HeyOtto OS-opgaver“
   - repo: `KasperAI-stack/OS`
   - miljø: det fra trin 1
   - forbindelser: fjern dem, opgaverne ikke skal bruge
   - instruktion: teksten fra Claude-adgang
3. Under **Select a trigger**: vælg **API**, og tryk **Create**. Åbn routinen igen → **Edit** → API-triggeren. Kopiér URL'en, og tryk **Generate token**. Tokenet vises kun én gang.
4. I Netlify (*Project configuration → Environment variables*) tilføjer du:
   - **`CLAUDE_ROUTINE_URL`** med URL'en
   - **`CLAUDE_ROUTINE_TOKEN`** med tokenet, markeret som hemmeligt

   Lav derefter et nyt deploy (*Deploys → Trigger deploy*).

Routinen bruger skillen `.claude/skills/heyotto-os-job/SKILL.md` fra `main`. Routinen kloner altid `main`, så ændringer i skillen virker først, når de er merget.

**Grænser og sikkerhed**

- **Starter Claude?** Kun du kan starte Claude. Claudes nøgle kan ikke, og hverken Claudes egne gem eller en gendannelse fra Historik sætter noget i gang. Så kan Claude aldrig starte sig selv.
- **Hvad sendes med?** Routinen får kun job-id'et og opgavens titel. Resten henter Claude selv fra API'et.
- **Hvor mange?** Højst ét aktivt job pr. opgave og 10 starter i timen. Gemmer du mange opgaver med Claude som ejer på én gang, starter kun 3 automatisk; resten startes med knappen. Anthropic tillader desuden 30 starter i timen pr. routine.
- **Hvad koster det?** Kørslerne bruger af dit Claude-abonnement, ligesom almindelige sessioner.
- **Hvis noget går galt.** Melder Claude ikke tilbage inden for to timer, viser opgaven „Intet svar“, og du kan starte igen. Fejler starten (forkert token, routinen sat på pause, for mange kørsler), står en dansk forklaring på opgaven.
- **Hvor ligger jobbene?** I Netlify Blobs under `claude-jobs/`, ved siden af dine data, og de seneste 100 gemmes. Når Claude skriver et resultat, ændres dine data ikke. Derfor giver det aldrig „data er ændret et andet sted“.

Routines er stadig en testfunktion hos Anthropic, så navne og grænser kan ændre sig.

## API'et

Alle svar er JSON. Fejl er `{ "error": "dansk besked" }`.

| Metode og adresse | Hvad |
|---|---|
| `POST /api/login` `{ password }` | Log ind → session-cookie |
| `POST /api/logout` | Log ud |
| `GET /api/data` | `{ rev, data }` |
| `PUT /api/data` `{ rev, data }` | Gem → `{ rev }`, plus `claude: { started, skipped }`, hvis gemmet satte Claude i gang. **409**, hvis `rev` ikke længere er den nyeste |
| `GET /api/history` | `{ versions: [...] }` |
| `POST /api/history/:id/restore` | Gør en gammel version gældende |
| `GET` / `POST` / `DELETE /api/claude-key` | Status / lav ny / fjern — kun for dig, ikke for Claude |
| `GET /api/claude/jobs` | `{ connected, jobs }`: er routinen sat op, og de seneste 40 jobs |
| `POST /api/claude/jobs` `{ taskId, task, instruction }` | Sæt Claude i gang. Kun for dig, ikke for Claude |
| `GET /api/claude/jobs/:id` | Ét job |
| `PUT /api/claude/jobs/:id` `{ status, result?, error? }` | Claude: `i gang` / `til godkendelse` / `fejlet`. Dig: `godkendt` / `kasseret`. **410**, hvis jobbet er lukket |
| `GET /api/google` | `{ configured, missing, redirectUri, accounts }`. Kun for dig. Tokens sendes aldrig |
| `GET /api/google/connect?scopes=calendar` | Sender browseren til Google for at forbinde en konto. Kun for dig |
| `GET /api/google/callback` | Google sender browseren tilbage hertil. Ender på `/?google=forbundet` eller `?google=fejl&besked=…` |
| `PUT /api/google/accounts/:id/calendars` `{ included }` | Vælg, hvilke kalendere der tæller. Henter kalenderne igen |
| `DELETE /api/google/accounts/:id` | Afbryd en konto. Adgangen trækkes også tilbage hos Google |
| `GET /api/calendar` | `{ snapshot }`: møder fra 7 dage tilbage til 12 uger frem. Også for Claude |
| `POST /api/calendar/refresh` | Hent kalenderne nu. Højst én gang i minuttet. Kun for dig |

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

**Planlægningsloftet er ikke 100 %,** fordi det uforudsete altid kommer. Det er andelen af din tilgængelige tid, der må bookes fast.

Øverst står tre tal: **fri kapacitet**, **belægning** og **næste deadline**. Den sidste er den nærmeste åbne opgave med deadline. Er noget allerede overskredet, står antallet i rødt i stedet, og et klik åbner opgaven.

## Kalenderoverblikket

Kortet **Aktive opgaver** på forsiden har en toggle: **Liste** (som før) eller **Kalender**, der viser de samme opgaver i tid sammen med dine møder. Valget er visning, ikke data. Det huskes i browseren og gør aldrig siden „ugemt“.

**Uge** (standard):

- **Øverst** står deadlines som diamanter (røde, når de er overskredet) og heldagshændelser som *Ferie*.
- **I midten** står møderne som blokke i deres tid. Overlappende møder står side om side, og foreløbige er skraveret. Fokustid og „Ledig“ er dæmpede, og afviste vises ikke. Gitteret dækker arbejdstiden og strækker sig, hvis der er møder før eller efter. En linje viser, hvad klokken er nu.
- **Nederst** står den fri tid pr. dag efter møder og fravær. Den er rød, hvis der er en deadline på en dag med under 2 timer fri.
- I den aktuelle uge kommer **Skal laves denne uge** til sidst: opgaverne med timer og summen holdt op mod ugens fri tid.
- Weekenden vises kun, når der er noget i den.

**Måned:** et gitter med mødetimer, fravær og deadlines pr. dag. Klik på en dato for at se ugen.

Klik på et møde for at se tid, dit svar og antal deltagere, med links til Google Kalender og Meet. **Opret opgave fra mødet** åbner en ny opgave med mødets titel og dato. Klik på en deadline for at åbne opgaven. På en telefon bliver ugen til en dagsliste.

Uden en forbundet kalender viser kalenderen kun deadlines og et link til at forbinde. Møder findes fra 7 dage tilbage til 12 uger frem.

## Indstillinger

Tandhjulet øverst til højre på alle sider åbner **Indstillinger**. Her ligger grundtallene bag kapaciteten: arbejdsuge, faste møder, mail & admin, øvrigt fravær, planlægningsloftet og ad hoc-estimatet. Når to uger er registreret i ugeloggen, låses estimatet, og bufferen måles i stedet. Du kan også åbne indstillingerne fra loft-mærket i belastningsbjælken.

Ændringerne slår igennem på forsiden bag panelet, mens du taster. De gemmes med **Gem**, ligesom alt andet, enten i panelet eller i sidehovedet. Panelet har også genveje til Historik, Claude-adgang og Log ud.

Nye sektioner (forbindelser, alarmer, agent) føjes til `SETTINGS_SECTIONS` i `index.html`.

Asana hentes ikke automatisk. Bed i stedet Claude om at hente opgaverne og skrive dem ind — med Claude-adgang skriver Claude direkte i skyen.

## Google: kalender og mail

HeyOtto OS kan forbinde én eller flere Google-konti, fx en privat og en til arbejdet. Kalenderen bruges i dag. Mail kommer i M8, som et ekstra samtykke på de samme konti. Der er intet i koden, der er bundet til én person, så en anden kan sætte sit eget HeyOtto OS op med de samme trin.

**Hvad den gør.** Serveren henter møderne hvert 15. minut og når du åbner appen (hvis de er over 5 minutter gamle). Den henter fra 7 dage tilbage til 12 uger frem. Kapaciteten regner selv ugens timer ud fra dem:

- **Møder**: optagede møder, du ikke har afvist, inden for arbejdstiden. Overlappende møder tælles kun én gang.
- **Fravær**: "Ikke til stede"-hændelser og heldagshændelser som *Ferie*, *Syg* eller *Kursus*. Et møde på en feriedag tæller ikke som møde.
- Fokustid, arbejdssted og hændelser markeret "Ledig" tæller ikke.

I Indstillinger kan du vælge mellem **Kalenderen** og **Fast tal** og sætte arbejdstiden. Under **Forbindelser** vælger du, hvilke kalendere der tæller pr. konto. Du kommer også dertil fra linket **Forbind Google** (eller **Google forbundet**) nederst i sidebaren. Den primære og dem, du selv ejer, er slået til fra start. Helligdage og andres delte kalendere er slået fra.

**Kun læsning.** Scopet er `calendar.readonly`. HeyOtto OS kan aldrig oprette, ændre eller svare på noget. Der gemmes kun titel, tidspunkt, type, dit svar og antal deltagere, ikke beskrivelser eller deltagernes adresser. Refresh-tokens krypteres (AES-256-GCM) i Netlify Blobs og sendes aldrig til browseren. **Afbryd** trækker også adgangen tilbage hos Google.

### Sæt Google op (én gang pr. installation)

Det gør den, der ejer HeyOtto OS-installationen. Vejledningen står også i appen under **Indstillinger → Forbindelser**, med den præcise redirect-adresse og en kopiér-knap.

1. Lav et projekt i [Google Cloud](https://console.cloud.google.com/projectcreate), fx „HeyOtto OS“.
2. *APIs & Services → Library*: slå **Google Calendar API** til. (Når mail kommer: også **Gmail API**.)
3. *Google Auth Platform* (OAuth consent screen): vælg **External**, og skriv app-navn og e-mail. Tryk **Publish app**. I *Testing* udløber adgangen efter 7 dage. Til eget brug viser Google en advarsel om en „ikke verificeret app“ første gang. Klik *Avanceret → Fortsæt*.
4. *Clients*: **Create client → Web application**. Under **Authorized redirect URIs** tilføjes `https://<din-adresse>/api/google/callback`, fx `https://heyotto-os.netlify.app/api/google/callback`. Skal en Deploy Preview også kunne forbindes, tilføjes dens adresse på samme måde.
5. I Netlify (*Project configuration → Environment variables*): `GOOGLE_CLIENT_ID` og `GOOGLE_CLIENT_SECRET` (markér den som hemmelig). Lav et nyt deploy.
6. I appen: **Indstillinger → Forbindelser → Forbind Google Kalender**. Gentag for hver konto.

**Til andre end dig selv.** Hver installation har sin egen adgangskode og sine egne data, så en anden person laver sit eget Netlify-site fra repoet og sin egen OAuth-klient. Skal mange personer bruge den *samme* OAuth-klient, kræver Google, at appen bliver verificeret. Til Gmail (`gmail.readonly`) kræver Google desuden en sikkerhedsvurdering, når appen bruges af andre end en lille gruppe testbrugere.

**Når noget går galt**, står fejlen på kontoen under Forbindelser, og de seneste møder bliver liggende:

| Besked | Løsning |
|---|---|
| Adgangen er udløbet eller trukket tilbage | Forbind kontoen igen. Står klienten som *Testing*, så tryk *Publish app* |
| Google kender ikke denne adresse som redirect-URI | Tilføj adressen fra Indstillinger til klienten i Google Cloud |
| Google Calendar API er ikke slået til | *APIs & Services → Library → Google Calendar API → Enable* |

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

Projekter har desuden `kind` (`drift` / `projekt` / `adhoc`), som afgør hvilken bås deres timer havner i på forsiden. `kapacitet` og `uger` holder modellens tal og ugeloggen. I `kapacitet` styrer `meetingsSource` (`"kalender"` / `"fast"`) om møderne regnes fra kalenderen, og `workStart`/`workEnd` (timer, standard 8 og 17) er arbejdstiden, møderne klippes til.

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

Farver, skrift og former følger Hey Otto-designsystemet — se [`brand/hey-otto/guidelines.md`](../brand/hey-otto/guidelines.md). Alle farver ligger som CSS-variabler øverst i `<style>`, så et farveskift er ét sted.

- **Skrift:** Geist til alt, også de små etiketter. Geist Mono bruges kun til kode og nøgler. Begge hentes fra Google Fonts; uden net falder siden tilbage til Helvetica Neue / Arial, og intet layout afhænger af en bestemt fonts mål.
- **Farver:** sort, grå og hvid. Der er ingen gradienter og ingen lilla flader i appen. Den primære farve er blæk (Onyx i lyst tema, Tåge i mørkt), og knapper, valgte faner, kurver og „i dag“-linjen står i den. Lilla findes kun i Otto selv. Fokusringen ved tastaturnavigation står i blæk (2 px), ligesom resten af grænsefladen.
- **Signalfarve:** én rød (`#B42318`, `#F97066` i mørkt tema) bruges kun til blokeret, overskredet deadline og overbooket. Den findes ikke i brandet, men appen er et arbejdsredskab, og de tre ting skal kunne ses med det samme.
- **Statusfarver:** Ikke startet = lysegrå, I gang = blæk, Blokeret = rød med skravering, Færdig = mellemgrå, Droppet = stiplet. Skraveringen gør, at Blokeret kan skelnes i sort/hvid-print og af en farveblind læser.
- **Former:** knapper og chips er helt runde og i tekstfarven, kort har 22 px hjørner, felter 10 px med 1,5 px kant, alt er 1 px-linjer uden skygger. Knapper løfter sig 1 px ved hover, og bevægelse slås fra ved `prefers-reduced-motion`. Hovedkolonnen står mellem tynde lodrette linjer med plus-mærker, hvor de møder de vandrette.
- **Otto:** maskotten ligger som PNG'er med gennemsigtig baggrund i `dashboard/otto/` (udskåret fra Kaspers illustrationer). Han står altid i en lys flise (`--otto-tile`), så han ser ens ud i begge temaer: med tommel op på login, tænkende i tomme tilstande, ved computeren mens Claude arbejder, jublende når et udkast er klar, og på kapacitetssiden efter stemningen — kaffe ved plads tilbage, løb ved på kanten, hårdt arbejde ved overbooket. Hans hoved er fane-ikon og står ved ordmærket i sidebaren. `laeser.png` og `praesenterer.png` ligger klar, men er ikke i brug endnu.

Tidslinjen er CSS Grid, ikke SVG: en Gantt er i praksis en tabel, og grid giver sticky navnekolonne, tooltips og korrekt zoom uden koordinatmatematik.

Lyst og mørkt tema følger systemet, med en knap der overstyrer begge veje. Der er print-styles, så tidslinjen kan tages med til et møde på papir.
