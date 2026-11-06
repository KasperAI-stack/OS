# HeyOtto Tasks — appen (tidligere HeyOtto OS)

Et Scrum-/projektoverblik over de store initiativer, med kapacitet på forsiden. Det er en webapp på Cloudflare Workers (fra flytningen i M13: **tasks.heyotto.win**), som du bruger fra computer og telefon. Alt ligger i skyen — der er ingen filer at holde styr på.

## Sådan hænger det sammen

| Hvad | Hvor |
|---|---|
| Prognose og alarmregler (deles af app og server) | `dashboard/lib/forecast.mjs` |
| Alarmer og push-notifikationer | `server/alerts.mts` og `server/webpush.mts`, kørt hver time af Workerens cron. Service worker: `dashboard/sw.js` |
| Assistenten, agent-kernen (Claude API + egne værktøjer) | `server/agent/` (motor, værktøjer, slags, skills, lager). Kørsler i køen (`worker/index.mts` → `queue`), planen i `server/jobs.mts` |
| Google-forbindelsen og kalendersynken | `server/google.mts`, kørt hvert 15. minut af Workerens cron |
| Appen (layout, logik, redigering) | `dashboard/index.html` — én HTML-fil, intet byggetrin, ingen biblioteker |
| Otto-illustrationerne | `dashboard/otto/` — PNG'er med gennemsigtig baggrund |
| API'et (login, data, historik, Claudes nøgle, Claude-jobs) | `server/api.mts` (`handle(req, platform)`), kaldt af `worker/index.mts` |
| Workeren (fetch, queue, cron) | `worker/index.mts`. Det, serveren får fra den: `server/platform.mts`. Job: `server/jobs.mts` |
| Indholdet (projekter, sprints, opgaver, kapacitet) | D1 — Cloudflares database (`worker/store.mts`, tabellen `docs`). Aldrig i git |
| Opsætningen | `wrangler.jsonc` (Worker, D1, kø, cron). Headers: `dashboard/_headers` |
| Tests | `test/` — `npm test` (Node, ingen server og ingen Cloudflare) |

Siden indeholder ingen data. Den henter dem fra API'et som JSON, når du er logget ind, og gemmer dem samme vej.

## Log ind

Første gang i en browser beder appen om adgangskoden. Derefter husker browseren dig i 90 dage. **Log ud** står nederst i sidebaren.

- Adgangskoden er hemmeligheden **`HEYOTTO_PASSWORD`** i Cloudflare (`npx wrangler secret put HEYOTTO_PASSWORD`). Den skal være mindst 12 tegn. Står den der ikke, kan ingen logge ind, og appen siger det.
- Vil du skifte adgangskode, så sæt hemmeligheden igen. Alle, der var logget ind, bliver logget ud.
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

Claude kan læse og rette dine data — fx lægge opgaver ind fra Asana, når du beder om det. Claude bruger API'et `/ext` med et API-token, ligesom Studio. Det sættes op én gang:

1. **Indstillinger → API-tokens**: lav et token med navnet **Claude**, med **Læse** og **Skrive**. Tokenet vises kun den ene gang.
2. Gem det som miljøvariablen **`HEYOTTO_TASKS_TOKEN`**:
   - på din pc: Windows → *Rediger miljøvariabler for din konto*. Genstart VS Code bagefter.
   - i et Claude-miljø i skyen (fx routinen): miljøets indstillinger (miljø-menuen i sessionens titellinje → **Edit**). Under **Network access**: vælg **Custom**, og tilføj `tasks-api.heyotto.win` under Allowed domains (behold standardlisten).
3. Start en ny session.

Alt, hvad Claude gemmer, står i Historik under tokenets navn og kan fortrydes. Tilbagekald tokenet under API-tokens for at lukke adgangen. Sletning, projekter og rutiner sker kun i appen. Fremgangsmåden for Claude står i `.claude/skills/heyotto-tasks-data/SKILL.md`. Siden **Claude-adgang** viser de samme trin.

## Send til Studio

Du kan sende en opgave til **HeyOtto Studio** (`otto.heyotto.win`), hvor Studios Otto tager den. Koden står i `server/studio.mts`.

- Åbn opgaven. Under **Studio** står en tekst med titel, note, projekt, deadline og opgavens id. Ret den, hvis du vil, og tryk **Send til Studio**.
- Opgaven viser, hvad Studio gør: **Studio arbejder**, **Venter på dig** (med et link til Studio, hvor du godkender) eller **Svar fra Studio**.
- Når Studio er færdig, står svaret som en **kommentar på opgaven** fra "Studio". Det står også i Historik.
- Tasks spørger Studio om nyt hvert minut (Workerens cron) og hvert 20. sekund, mens appen er åben.

**Opsætning (én gang).**

1. Studio → **Agenter → Integrationer → Adgang udefra** → nyt token "HeyOtto Tasks" med **task** og **read**.
2. Cloudflare → Workers & Pages → heyotto-tasks → Settings → Variables and Secrets → **Add**, **Type: Secret**: `HEYOTTO_TOKEN` med tokenet. (`HEYOTTO_URL` behøves kun, hvis Studio ligger et andet sted end `https://otto.heyotto.win/ext`.)

**Når Studio er slukket.** Studio kører på din pc gennem en Cloudflare Tunnel. Kan den ikke nås, står opgaven som **Studio er offline**, og Tasks prøver igen hvert 5. minut i en time. Derefter står den som **Ikke sendt**, og du kan sende igen. Svarer Studio ikke i tide, ved Tasks ikke, om opgaven kom frem, så den sendes **ikke** igen af sig selv. Se efter i Studio først.

**Grænser.** Højst én Studio-opgave ad gangen pr. opgave, tekst højst 20.000 tegn. Opfølgning på en opgave sker i Studio, fordi Studios API endnu ikke har en svar-rute. Studio-opgaverne ligger i lageret under `studio-tasks/`, ved siden af dine data.

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
| `GET /api/studio` | `{ configured, online, error, app }`: er Studio sat op og tændt? |
| `GET /api/studio/tasks` | `{ configured, tasks }`: opgaver sendt til Studio. Spørger Studio om nyt først |
| `POST /api/studio/tasks` `{ taskId, title, text }` | Send opgaven til Studio. Kun for dig. **409**, hvis Studio allerede har den |
| `DELETE /api/studio/tasks/:taskId` | Glem en afsluttet Studio-opgave, så en ny kan sendes |
| `GET /api/google` | `{ configured, missing, redirectUri, accounts }`. Kun for dig. Tokens sendes aldrig |
| `GET /api/google/connect?scopes=calendar` | Sender browseren til Google for at forbinde en konto. Kun for dig |
| `GET /api/google/callback` | Google sender browseren tilbage hertil. Ender på `/?google=forbundet` eller `?google=fejl&besked=…` |
| `PUT /api/google/accounts/:id/calendars` `{ included }` | Vælg, hvilke kalendere der tæller. Henter kalenderne igen |
| `DELETE /api/google/accounts/:id` | Afbryd en konto. Adgangen trækkes også tilbage hos Google |
| `GET /api/calendar` | `{ snapshot }`: møder fra 7 dage tilbage til 12 uger frem. Også for Claude |
| `POST /api/calendar/refresh` | Hent kalenderne nu. Højst én gang i minuttet. Kun for dig |
| `GET /api/alerts` | `{ state: { snoozed, prefs }, push: { publicKey, devices } }` |
| `PUT /api/alerts/snooze` `{ key, until }` | Udsæt en alarm til en dato (`null` fortryder). Kun for dig |
| `PUT /api/alerts/prefs` `{ daily?, instant? }` | Morgenoverblik og straks-beskeder til/fra. Kun for dig |
| `POST /api/push/subscribe` `{ subscription, label, tz }` | Slå notifikationer til på en enhed. Kun for dig |
| `POST /api/push/unsubscribe` `{ endpoint }` | Slå fra på en enhed |
| `POST /api/push/test` `{ endpoint }` | Send en prøve til én enhed |
| `GET /api/agent` | Assistenten: `{ configured, settings, today, kinds, models }` |
| `PUT /api/agent/settings` `{ enabled?, budgetDkk?, usdDkk?, kinds? }` | Assistentens indstillinger. Kun for dig |
| `GET /api/agent/runs` | De seneste 40 kørsler, uden trin. Også for Claude |
| `POST /api/agent/runs` `{ kind, input?, parent? }` | Start en kørsel (`ping`, `spoerg`, `morgenbrief`). Højst 30 i timen. Kun for dig |
| `GET /api/agent/runs/:id` | Én kørsel med hvert trin, tokens og pris |
| `GET /api/inbox` | `{ suggestions, handled, mail }`: Assistentens forslag fra mail, og hvilke konti der har givet adgang til mail |
| `PUT /api/inbox/:id` `{ status, taskId? }` | Markér et forslag `oprettet` / `ignoreret` (eller `ny`). Kun for dig |
| `GET /api/plans` · `GET /api/plans/:id` | Assistentens seneste planforslag / ét forslag (id = kørslens id) |
| `PUT /api/plans/:id` `{ status }` | `anvendt` eller `kasseret`. Kun for dig |

Du er logget ind med enten session-cookien eller `Authorization: Bearer <nøgle>` (Claude). Ændringer med cookie skal komme fra appen selv: JSON og samme oprindelse. Afvisninger er 400/401, og en forsvundet version er 410.

**Test rører aldrig rigtige data.** Miljøet `test` i `wrangler.jsonc` har sin egen D1-database og sin egen kø. `npm test` kører API'et, Workeren og prognosen i Node uden Cloudflare.

**Udrulning.** `npm run cf:deploy:test` til testmiljøet, `npx wrangler deploy --env=""` til produktion.

## API'et /ext (til andre værktøjer)

Studio, n8n og andre værktøjer bruger `/ext` med et API-token. Tokens laves og tilbagekaldes under **Indstillinger → API-tokens**. Tokenet vises én gang, og kun en hash gemmes. Koden står i `server/ext.mts` og `server/tokens.mts`.

```
Authorization: Bearer tsk_…
```

Samme tokens virker på **MCP** på `https://tasks-api.heyotto.win/mcp` (`server/mcp.mts`) til Studios agenter, Claude og Cursor, med værktøjerne `list_tasks`, `get_task`, `list_projects`, `list_routines`, `get_forecast`, `create_task`, `update_task` og `add_comment`.

**Hele beskrivelsen** (alle kald, felter, fejlkoder, MCP-værktøjer og eksempler) står i [`docs/api.md`](../docs/api.md), og maskinlæsbart til n8n i [`docs/openapi.json`](../docs/openapi.json). Testen `test/openapi.test.mts` fejler, hvis en rute mangler i filen.

- **Ingen sletning**, ingen Historik og ingen tokens via `/ext` eller `/mcp`. Ændringer står i Historik med tokenets navn, så de kan fortrydes.
- **Grænser:** 60 kald i minuttet pr. token, body højst 256 KB. Tokens renses (`tsk_***`) i logs og stier.

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

## Prognose og alarmer

Prognosen svarer på ét spørgsmål: **når alt sin deadline?** Den er et regnestykke uden AI, og den samme kode (`dashboard/lib/forecast.mjs`) bruges af appen og af serveren.

- **Kapacitet pr. uge, 12 uger frem:** (arbejdsuge − møder − fravær − mail & admin − øvrigt fravær) × loft − drift − ad hoc-buffer. Møder og fravær kommer fra kalenderen, når den er forbundet. I den aktuelle uge tæller kun de arbejdsdage, der er tilbage.
- **Rækkefølge:** åbne opgaver med **timer tilbage** fylder ugerne i deadline-rækkefølge (*Earliest Deadline First*). Ved samme deadline går **høj** prioritet før **lav**. Kan alt ikke nås i den rækkefølge, kan det ikke nås i nogen.
- **Hver opgave får en status:** *når deadline*, *stramt* (færdig under 2 arbejdsdage før), *når ikke deadline* (med ca. hvor mange timer der mangler), *over deadline* eller *mangler et estimat*. Status og forventet færdigdato står i opgavedialogen. På kortene og i kalenderen markeres *i risiko* som overskredet.

**Assistenten siger** øverst på forsiden viser alarmerne. De vigtigste står først, og der vises højst 5 ad gangen:

| Alarm | Hvornår | Farve |
|---|---|---|
| Over deadline | deadline passeret, ikke færdig | rød |
| Når ikke deadline | prognosen siger færdig efter deadline | rød |
| Ikke startet | deadline inden for 3 arbejdsdage, status Ikke startet | rød |
| Blokeret | blokeret, og deadline inden for en uge | rød |
| Stram | færdig under 2 arbejdsdage før deadline | blæk |
| Uge overbooket | møder, drift og buffer alene fylder mere end loftet (næste 4 uger) | blæk |
| Mødetung deadline-dag | under 2 t fri på en dag med deadline (kræver kalender) | blæk |
| Mangler estimat | deadline, men ingen timer tilbage | grå |

Én alarm pr. opgave, den alvorligste. **I morgen** og **Om en uge** udsætter en alarm. Udsættelsen gemmes på serveren, så den gælder på alle enheder. Ændres deadlinen, er det en ny alarm. Antallet af røde alarmer står ved Kapacitet i sidebaren.

### Notifikationer

Under **Indstillinger → Alarmer** slår du notifikationer til på den enhed, du sidder ved. Browseren spørger om lov, og du skal gøre det på hver enhed for sig. Serveren tjekker hver time:

- **Morgenoverblik** kl. 7 på hverdage, hvis der er noget at sige.
- **Besked med det samme** mellem 7 og 19, når der er kommet nye røde alarmer.

Begge dele kan slås fra. Udsatte alarmer sendes ikke, og samme alarm sendes ikke to gange. Tiden regnes i den tidszone, enheden havde, da notifikationer blev slået til.

**Intet at sætte op.** HeyOtto OS laver selv sine push-nøgler (VAPID) og gemmer dem krypteret i lageret. Afsenderen er sitets egen adresse. Det virker derfor i en ny installation uden miljøvariabler.

**iPhone og iPad:** notifikationer virker kun, når HeyOtto OS ligger på hjemmeskærmen. Tryk *Del → Føj til hjemmeskærm*, og åbn appen derfra. Siden har et manifest og et app-ikon (`dashboard/manifest.webmanifest`, `otto/app-192.png` og `otto/app-512.png`). Service workeren (`dashboard/sw.js`) viser kun notifikationer og cacher ikke noget.

## Assistenten: Tasks egen agent (M7)

Assistenten er HeyOtto OS' egen agent. Den kører på serveren og kalder Claude API direkte med OS'ets egne værktøjer. Der bruges ingen Claude Code Routines og ingen claude.ai-forbindelser.

- **Spørg assistenten** (i sidebaren): et chatfelt. Assistenten læser data, prognose og kalender og svarer. Assistenten kan ikke ændre noget, så ændringer foreslår den, og du laver dem selv. Opfølgende spørgsmål husker de seneste 5 i samtalen.
- **Aktivitet** (samme side): hver kørsel med udløser, svar, hvert værktøjskald (input og forkortet output), tokens og pris. Klik på en kørsel for at se trinene.
- **Morgenbrief**: dagens overblik kl. 7 på hverdage, sendt som notifikation. Slået fra som standard.
- **Indstillinger → Assistent (agent)**: til/fra, dagsbudget i kr., dollarkurs, hvilke kørsler der er slået til, og model pr. kørsel. **Test assistenten** laver den billigste kørsel (Haiku + `ping`).

**Sikkerhed, håndhævet i koden:**

| Klasse | Værktøjer i M7 | Effekt |
|---|---|---|
| `read` | `ping`, `data_read`, `forecast_run`, `calendar_list` | Ingen |
| `read` (mail, M8) | `gmail_new`, `gmail_read` | Ingen |
| `propose` | `inbox_suggest_task`, `inbox_skip` (M8), `plan_propose_changes` (M9) | Skriver kun i forslagslagre uden for data |
| `write` | (ingen endnu) | Kun når automatik er slået til for kørslen |

Der findes ingen klasse til handlinger udenfor (mail, invitationer, kampagner), og serveren starter ikke, hvis et værktøj har en ukendt klasse. Hver slags kørsel får kun sine egne værktøjer (`server/agent/kinds.mts`), og et kald til andre værktøjer afvises i løkken. Agenten kan ikke starte kørsler selv: udløsere er kun planen og dig. Baggrundsfunktionen kræver en HMAC-signatur.

**Grænser:** højst 20 trin, 400.000 tokens og 10 minutter pr. kørsel, 30 kørsler i timen fra appen, og et **dagsbudget** (standard 20 kr.). Budgettet tjekkes før hvert kald til Claude. Når det er brugt, stopper assistenten til næste dag, og du får én notifikation. Prisen regnes ud fra Claudes listepriser i `kinds.mts` og omregnes med dollarkursen fra indstillingerne.

**Modeller (standard):** Haiku 5.5 til testen, Sonnet 5.5 til morgenbriefen og Opus 5.5 til Spørg assistenten. De faste instruktioner caches (prompt caching), så gentagne kørsler bliver billigere.

**Skills** (instruktionerne til hver slags kørsel) ligger i `server/agent/skills/` som tekst i `.mts`-filer, så de versioneres i git og følger med, når Workeren pakkes.

### Indbakke: mail → opgaver (M8)

**Indbakke** i sidebaren. Tryk **Hent mails**, så læser assistenten de seneste 3 dages mails fra de Google-konti, der har givet adgang til mail. Kampagner, sociale, opdateringer, fora og sendte mails springes over allerede i søgningen. For hver mail, hvor nogen venter på dig, laver assistenten et forslag med titel, kort resumé, projekt, deadline (kun hvis mailen nævner en) og et estimat.

- **Opret** laver opgaven med det samme og gemmer. **Ret og opret** åbner opgavedialogen udfyldt. **Ignorér** skjuler forslaget. **Åbn mail** åbner tråden i Gmail.
- Nye opgaver får 0 timer i denne uge, assistentens estimat som *timer tilbage*, link til tråden i noten og `source: { type: "gmail", id, url }`.
- En tråd, assistenten har vurderet, kommer ikke igen, medmindre der kommer et nyt svar i den.
- Kørslen har kun værktøjerne `data_read`, `gmail_new`, `gmail_read`, `inbox_suggest_task` og `inbox_skip`. Forslag kan kun laves til tråde, `gmail_new` har vist i samme kørsel. En mail med "instruktioner" kan derfor højst give et forkert forslag.
- Mailtekst gemmes aldrig, kun assistentens resumé og trådens afsender, emne og dato. Kun læsning (`gmail.readonly`): HeyOtto OS kan ikke sende, slette, arkivere eller mærke mail.

**Opsætning:** slå **Gmail API** til i Google Cloud-projektet (*APIs & Services → Library*). Tryk så **Giv adgang til mail** i Indbakken eller under Indstillinger → Forbindelser, og sæt flueben ved Gmail hos Google.

### Omplanlæg med assistenten (M9)

Knappen **Omplanlæg med assistenten** står i "Assistenten siger" på forsiden og åbner `#omplan`. Skriv evt. noget, assistenten skal vide ("Jeg er syg torsdag"), og tryk **Lav forslag**. Efter ca. et minut kommer:

- et kort resumé og **før/efter** (i risiko eller over deadline, røde alarmer, overbookede uger). Tallene regnes af prognosen (`dashboard/lib/forecast.mjs`) på serveren, ikke af Claude
- en **ændringsliste med flueben**. Ny deadline og "Droppet" er fravalgt som standard, og deadlines er altid mærket *kræver aftale*
- spørgsmål, hvis assistenten mangler noget, og de ændringer, serveren afviste (med grund)

**Anvend valgte** lægger ændringerne ind og gemmer. Er en opgave ændret, siden forslaget blev lavet, springes den over. Alt kan fortrydes under Historik.

Assistenten må kun foreslå felterne `sprint` (skal findes i projektet), `start`, `end`, `hours`, `remaining`, `priority`, `status` (kun *I gang* eller *Droppet*) og `due`, og kun på åbne opgaver. Den kan ikke oprette eller slette opgaver. Kørslen har kun `data_read`, `forecast_run`, `calendar_list` og `plan_propose_changes`, som gemmer forslaget i `plans/<kørsels-id>` uden for data.

**Ugeforslag** (Indstillinger → Assistent, slået fra som standard): mandag kl. 7. Det kører kun, når prognosen har røde alarmer eller overbookede uger, og sender en notifikation, når der er et forslag.

### Sæt Claude API op (én gang pr. installation)

Lav en API-nøgle på platform.claude.com, og gem den i Cloudflare: `npx wrangler secret put ANTHROPIC_API_KEY`.

Kørsler, hvis startsignal går tabt, startes igen af Workerens cron (`server/jobs.mts`) inden for et kvarter.

## Tasks, Projekter og Rutiner

Sidebaren har tre enheder under Kapacitet, Spørg assistenten og Indbakke. Hver har sin egen landingsside, og listen under folder sig selv ud, mens du er i enheden. Der er ingen pile at trykke på.

| Enhed | Landingsside | Liste i sidebaren |
|---|---|---|
| **Tasks** | `#tasks`: nøgletal (åbne, over deadline, denne uge, uden projekt), hurtig tilføjelse og alle åbne tasks grupperet efter deadline | Alle tasks · Denne uge · Uden projekt · Fra rutiner |
| **Projekter** | `#projekter`: nøgletal og et kort pr. projekt med fremdrift, åbne tasks, timer pr. uge, sprint og mål, næste deadline og antal i risiko | Projekterne + Nyt projekt |
| **Rutiner** | `#rutiner`: nøgletal (aktive, fast tid pr. uge, kommende, ikke gjort), kommende tasks fra rutiner og dine rutiner | Rutinerne, Drift og Ny rutine |

Et projekt hører til Projekter, Drift til Rutiner, og "Uden projekt" (kind `adhoc`) til Tasks.

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
4. *Clients*: **Create client → Web application**. Under **Authorized redirect URIs** tilføjes `https://<din-adresse>/api/google/callback`, fx `https://tasks.heyotto.win/api/google/callback`. Skal testmiljøet også kunne forbindes, tilføjes dets adresse på samme måde.
5. Gem dem i Cloudflare: `npx wrangler secret put GOOGLE_CLIENT_ID` og `npx wrangler secret put GOOGLE_CLIENT_SECRET`.
6. I appen: **Indstillinger → Forbindelser → Forbind Google Kalender**. Gentag for hver konto.

**Til andre end dig selv.** Hver installation har sin egen adgangskode og sine egne data, så en anden person laver sin egen Worker fra repoet og sin egen OAuth-klient. Skal mange personer bruge den *samme* OAuth-klient, kræver Google, at appen bliver verificeret. Til Gmail (`gmail.readonly`) kræver Google desuden en sikkerhedsvurdering, når appen bruges af andre end en lille gruppe testbrugere.

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

`data` er ét JSON-objekt med `meta`, `kapacitet`, `uger`, `epics` og flade lister: `projects`, `sprints`, `tasks` og `rutiner` (kan mangle i ældre data). Både appen og Claude retter i det samme objekt. API'et afviser data, der ikke har den grundform.

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
| `remaining` | tal eller udeladt | Timer **tilbage i alt** (estimat). Bruges af prognosen. Udeladt = ikke estimeret |
| `priority` | `"høj"` / `"lav"` eller udeladt | Afgør rækkefølgen ved samme deadline. Udeladt = normal |

| `routine` | et `id` fra `rutiner` eller udeladt | Sat, når opgaven er én forekomst af en rutine. Id'et er `r-<rutine>-<dato>` |
| `source` | `{ type: "gmail", id, url }` eller udeladt | Sat, når opgaven kom fra Indbakken |
| `comments` | `[{ at, by, text }]` eller udeladt | Kommentarer fra API'et `/ext` (fx Studio). `by` er tokenets navn. Højst 100 pr. opgave |

Projekter har desuden `kind` (`drift` / `projekt` / `adhoc`), som afgør hvilken bås deres timer havner i på forsiden. Kun `projekt` vises under **Projekter** i sidebaren. Projektet med `kind: "adhoc"` er **"Uden projekt"**: tasks dér er løse tasks, og deres timer trækker først fra ad hoc-bufferen. `drift` vises under **Rutiner**.

`rutiner` (valgfri liste) er det, der kommer igen: `{ id, name, every, weekday, monthday, hours, project, note, active, last }`. `every` er `"dag"` (hverdage), `"uge"`, `"2uger"` eller `"maaned"`. `weekday` er 1–5 (mandag–fredag), `monthday` er 1–28 eller 0 (sidste dag; weekend → fredagen før). `hours` er timer pr. gang og tæller som fast tid pr. uge i kapaciteten (som drift). `last` er den seneste forekomst, der er lavet en task til. Appen laver tasks til forekomsterne de næste 7 dage, daglige kun for i dag, med `hours: 0`, så tiden ikke tælles to gange. `kapacitet` og `uger` holder modellens tal og ugeloggen. I `kapacitet` styrer `meetingsSource` (`"kalender"` / `"fast"`) om møderne regnes fra kalenderen, og `workStart`/`workEnd` (timer, standard 8 og 17) er arbejdstiden, møderne klippes til.

**Statusser — præcis disse fem:**

```
"Ikke startet"   "I gang"   "Blokeret"   "Færdig"   "Droppet"
```

`Droppet` tælles ikke med i fremdriften, men bliver stående i historikken.

**Hvorfor `sprint` og `start`/`end` er adskilt:** `sprint` er en *forpligtelse* — "det her arbejder jeg på i oktober". `start`/`end` er en *tidslinje*. En opgave, der løber fem måneder, hører stadig kun til i én sprint.

**Hvorfor måneder og ikke datoer:** en sprint *er* en måned, og tidslinjens kolonner *er* måneder. Månedsstrenge rører aldrig `Date`, så ingen tidszone kan skubbe november til oktober. `due` er undtagelsen, hvor dagen faktisk betyder noget.

## Cloudflare Workers

HeyOtto Tasks kører kun på Cloudflare (planen: `projects/heyotto-os-iterationer/M10`–`M15`).

| | Hvor |
|---|---|
| API | `worker/index.mts` → `fetch` → `server/api.mts` |
| Lager | D1 (`worker/store.mts`, tabellen `docs`: én række pr. nøgle) |
| Assistentens kørsler | Queue `heyotto-tasks-otto` → `queue` |
| Planlagte job | Cron hvert 15. minut (kalender, assistentens plan) og hver time (alarmer) → `scheduled` |
| Hemmeligheder | `npx wrangler secret put` |
| Testmiljø | `--env test` med egen D1 og kø |

- Prognose og alarmer regnes på serveren i brugerens tidszone med `server/zone.mts` (Workers kører altid i UTC, og `process.env.TZ` virker ikke der).
- Push sendes med Web Crypto (`server/webpush.mts`).

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
- **Farver:** sort, grå og hvid. Der er ingen gradienter og ingen lilla flader i appen. Den primære farve er blæk (Onyx i lyst tema, Tåge i mørkt), og knapper, valgte faner, kurver og „i dag“-linjen står i den. Lilla findes kun i assistenten selv. Fokusringen ved tastaturnavigation står i blæk (2 px), ligesom resten af grænsefladen.
- **Signalfarve:** én rød (`#B42318`, `#F97066` i mørkt tema) bruges kun til blokeret, overskredet deadline og overbooket. Den findes ikke i brandet, men appen er et arbejdsredskab, og de tre ting skal kunne ses med det samme.
- **Statusfarver:** Ikke startet = lysegrå, I gang = blæk, Blokeret = rød med skravering, Færdig = mellemgrå, Droppet = stiplet. Skraveringen gør, at Blokeret kan skelnes i sort/hvid-print og af en farveblind læser.
- **Former:** knapper og chips er helt runde og i tekstfarven, kort har 22 px hjørner, felter 10 px med 1,5 px kant, alt er 1 px-linjer uden skygger. Knapper løfter sig 1 px ved hover, og bevægelse slås fra ved `prefers-reduced-motion`. Hovedkolonnen står mellem tynde lodrette linjer med plus-mærker, hvor de møder de vandrette.
- **Assistenten:** maskotten ligger som PNG'er med gennemsigtig baggrund i `dashboard/otto/` (udskåret fra Kaspers illustrationer). Han står altid i en lys flise (`--otto-tile`), så han ser ens ud i begge temaer: med tommel op på login, tænkende i tomme tilstande, ved computeren mens Claude arbejder, jublende når et udkast er klar, og på kapacitetssiden efter stemningen — kaffe ved plads tilbage, løb ved på kanten, hårdt arbejde ved overbooket. Hans hoved er fane-ikon og står ved ordmærket i sidebaren. `laeser.png` og `praesenterer.png` ligger klar, men er ikke i brug endnu.

Tidslinjen er CSS Grid, ikke SVG: en Gantt er i praksis en tabel, og grid giver sticky navnekolonne, tooltips og korrekt zoom uden koordinatmatematik.

Lyst og mørkt tema følger systemet, med en knap der overstyrer begge veje. Der er print-styles, så tidslinjen kan tages med til et møde på papir.
