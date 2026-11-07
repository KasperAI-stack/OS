# Flot design: det de bedste gør

Uddraget af referencebiblioteket (`reference/design/`, se `README.md` for kilderne) og af `frontend-design`. Hvert princip står med de kilder, det kommer fra, så billederne kan ses igen med Read. Principperne er håndværk; de giver ikke et færdigt udseende. Kombinér dem med produktets eget brand og indhold.

## 1. Dybde: to eller tre flader, ikke én

**Det, de gør:**
- Siden har en tonet baggrund, og indholdet ligger på lysere kort. Skyggen er blød og lav.
- Fladerne har faste niveauer.
- Kilder: Kaspers dashboard-eksempel, Headspace, Things, Spotify (mørk udgave: ramme `#000`, paneler `#121212`), Atlassian Elevation (sunken, default, raised, overlay), Material Elevation (surface-container i fem toner).

**Regel:** definér 3–4 niveauer og brug kun dem:

| Niveau | Bruges til | Lyst (eksempel) | Mørkt (eksempel) |
|---|---|---|---|
| Sænket | Sidens baggrund, felter | tonet (fx `#F4F2F8`) | `#0F0E13` |
| Standard | Kort, paneler, tabeller | `#FFFFFF`, ingen eller meget svag skygge | `#1A1820` |
| Hævet | Kort, der kan klikkes, valgte ting | `#FFFFFF` + `0 1px 2px rgb(0 0 0/.06), 0 8px 24px -12px rgb(0 0 0/.14)` | `#22202A` + kant |
| Overlejret | Menuer, dialoger, paneler fra siden | `#FFFFFF` + `0 24px 60px -24px rgb(0 0 0/.35)` | `#2B2932` |

Mørkt tema viser dybde med lysere flader, ikke med skygger (Material, Atlassian).

## 2. Farve med mening: roller, ikke pynt

**Det, de gør:**
- Hver farve har én betydning, som er den samme overalt.
- Status står som et lille mærke med lys flade og mørk tekst, og "stærk" udgave (fuld farve, hvid tekst) bruges kun til det vigtigste.
- Kategorier (projekt, kanal, kalender) har hver deres farve og står som en prik, et # eller en farvet flise.
- Kilder: Atlassian Lozenge (neutral, success, removed, in progress, new, moved), Material Color Roles (primary / on-primary / container), ClickUp (statusgrupper med farve), monday (farvede statusceller), Todoist (farvede projekt-# og prioritetscirkler), Notion Calendar (kategorifliser), Sunsama (#kanal som farvet mærke).

**Regel:**
- **Neutrale:** 4–5 trin (tekst, dæmpet tekst, kant, flade, side).
- **Primær:** én farve til den vigtigste handling og "valgt". Duolingo og Trello bruger den modigt; den må gerne være mættet.
- **Status:** 4–6 farver med fast betydning, hver i en lys (flade + mørk tekst) og en stærk udgave. Altid med tekst eller ikon ved siden af, aldrig kun farve.
- **Kategori:** 6–10 farver, som brugeren kan vælge til projekter og lignende. Vises i små flader (prik, mærke, flise), ikke som store flader.
- Kontrasten måles for hvert par i begge temaer (4,5:1 for tekst).

## 3. Identitet: hver ting har et ansigt

**Det, de gør:**
- Personer har avatarer, projekter har farvede bogstavmærker eller ikoner, og agenter har deres egen figur og navn.
- Kilder: Slack (agent med avatar under "Agents"), ClickUp (avatar pr. opgave og person), Float (avatarkort med kapacitet), Linear og Attio (agent-panel med navn og "Thinking…"), Duolingo og Headspace (figuren er hovedpersonen), monday (illustreret figur).

**Regel:** giv hver gentagen ting et genkendeligt mærke. Har produktet en maskot, er den assistentens ansigt og optræder, hvor dens stemning betyder noget: velkomst, tomme visninger, ventetid, resultat.

## 4. Data som grafik, ved siden af tallet

**Det, de gør:**
- Tal står sammen med en grafik, der forklarer dem: en ring for fremdrift, søjler for belastning, en bjælke for andel og en graf over tid.
- Advarsler står ved tallet ("120 % utilized" i rødt).
- Kilder: ClickUp Box (ring, søjler pr. person, Not done / Done), Float (kapacitet mod efterspørgsel), Kaspers dashboard-eksempel (nøgletal med ikon og ændring, søjler, ring), Stripe Billing (små kort med tal).

**Regel:**
- Ét hovedtal pr. kort med en kort etiket, gerne med en ændring eller en sammenligning.
- Grafen vælges efter data (se `opbygning.md` §8).
- Skriv værdien direkte på små grafer.
- Brug samme farver som i resten af appen: kategoriens farve i grafen er den samme som på mærket.

## 5. Struktur, man kan se

**Det, de gør:**
- Grupper har en farvet overskrift med antal.
- Tabeller har kolonnehoveder, og hver kolonne har én type indhold (person, dato, status).
- Visninger (List · Board · Box) står som faner over indholdet, og én værktøjslinje samler søg, filter, sortér og ny.
- Kilder: ClickUp (In Progress 2 / Open 2 med kolonnerne Name, Due, Priority), monday (gruppe med farvet kant, kolonner og opsummering pr. kolonne), Carbon Data Table (tæthed, værktøjslinje, sortering), Sunsama (dage som kolonner).

**Regel:**
- Hver liste med mere end ca. 7 poster grupperes, og grupperne kan foldes.
- Hver række har samme kolonner.
- Antal står ved gruppen, ikke i en separat række med nøgletal.
- "+ Tilføj" står nederst i hver gruppe.

## 6. Kort med hierarki (ikke "SaaS-kortsættet")

**Det, de gør:**
- Ét stort kort bærer siden, og mindre kort holder detaljerne.
- Et anbefalet eller valgt kort skiller sig ud med en farvet top eller et mærke.
- Kort med indre små kort bruges til at sammenligne tal.
- Kilder: Headspace (to store kort side om side i forskellig bredde), Stripe Billing (det anbefalede kort med farvet top og "Popular"), Kaspers eksempler (ét hovedkort og tre små).

**Regel:** variér størrelse efter vigtighed: 1 stort, 2–4 mellem, resten rækker. Ingen kort i kort i kort.

## 7. Typografi bærer hierarkiet

**Det, de gør:**
- Få størrelser med stor afstand imellem.
- Overskrifter med stram spatiering og høj vægt, brødtekst rolig.
- Stripe sætter overskriften i to toner (sort start, gråblå fortsættelse) i stedet for at fremhæve et enkelt ord.
- Kilder: Stripe, Linear, Attio, ClickUp, Sunsama.

**Regel:** skala med 6–8 trin og vægtene 400 / 500 / 600. Tal med `tabular-nums`. Ingen fremhævet enkeltord, ingen etiket med store bogstaver over hver overskrift (`frontend-design`).

## 8. Produktet er helten

**Det, de gør på landingssider:**
- Appen vises i et vindue med rigtige data, gerne lagt på en farvet eller tonet scene.
- Ved siden af står en figur, et chat-element eller et nøgletal, der "flyder" over.
- Kilder: Sunsama, Todoist, Linear, Attio, Reclaim, Float, monday-wm, Headspace, Trello (telefon med farvede former bag).

**Regel:**
- Første skærm har én sætning om værdien, én primær knap og produktet.
- Undgå tal og hype uden kilde ("#1", "double productivity" med gradient (Motion, Reclaim)).
- Skriv konkret, hvad det gør (Things: "plan your day, manage your projects").

## 9. Bevægelse og respons

**Det, de gør:**
- Knapper har en tydelig trykket tilstand (Duolingos knapper har en "fysisk" bund, der trykkes ned).
- Paneler glider ind fra der, hvor de åbnes.
- Ét orkestreret øjeblik ved indlæsning, ikke animation på alt.
- Kilder: Duolingo, Linear, `frontend-design`.

**Regel:** se `opbygning.md` §9. Én signaturbevægelse pr. produkt er nok.

## 10. Brug dristigheden ét sted

Hver af de bedste har ét greb, de huskes for:

| Produkt | Greb |
|---|---|
| Stripe | Den store farveflade |
| Duolingo | Uglen |
| Spotify | Billederne |
| ClickUp | Farvede statusgrupper |
| Float | Procent for udnyttelse på personen |

Resten er roligt og disciplineret (`frontend-design`: "Spend your boldness in one place"). Vælg det ene greb bevidst for hvert produkt, og skriv det i designplanen.

## Tjek mod referencerne

Læg et skærmbillede af dit resultat ved siden af 2–3 referencer fra samme kategori, og spørg:

- [ ] Har siden lige så tydelige flader og niveauer?
- [ ] Betyder hver farve noget, og er der farve nok til at skille ting ad?
- [ ] Har gentagne ting et ansigt (avatar, mærke, figur)?
- [ ] Står tal sammen med grafik, der forklarer dem?
- [ ] Er grupper, kolonner og visninger lige så tydelige?
- [ ] Er der ét greb, siden huskes for?
- [ ] Er afstande, hjørner og skygger lige så ensartede?
