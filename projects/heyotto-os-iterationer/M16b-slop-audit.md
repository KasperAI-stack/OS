# M16b: Slop-audit af HeyOtto Tasks efter M16, og plan

**Status (2026-11-07):** bygget og testet lokalt, ikke udrullet og ikke committet. Lavet med `detect-slop-ui`-skillen.

**Bygget:** de tre første ændringer og gridet (se "Gridet" nederst). `npm test` 52/52, `npm run a11y` ingen fund, browsertjekket 12/12. `icon("spark")`, "vedligeholdes af", "chefen" og "Senere kan" findes ikke længere i `index.html`. Skærmbilleder i `shots/m16b/`.

**Grundlag:** skærmbilleder af alle 13 visninger i lyst, mørkt og 390 px (`npm run shots` → `shots/audit/`), med demo-data fra `npm run preview`. Desuden koden i `dashboard/index.html` og `dashboard/app.css`. Ikke set: en rigtig telefon, en forbundet Google-kalender og en assistent, der er sat op.

## Diagnose

Det generiske indtryk efter M16 kommer ikke fra pynt. Der er ingen gradienter, ingen glas og ingen emoji. Det kommer fra tre skabeloner, der står på næsten hver side:

1. en grå forklarende undertekst under hver sidetitel
2. en række med fire nøgletal, som gentager listen lige under
3. tekst, der forklarer modellen og koden i stedet for at hjælpe med opgaven

Dertil kommer den generiske AI-gnist som assistentens tegn og rød brugt så tit, at den ikke længere skiller sig ud.

**Det, der skal blive:** ugen som beholder på Kapacitet. Sætningen, bjælken med loftet, skraveringen og Otto efter stemningen er appens eget. Det er kun relevant for netop dette produkt. Det samme gælder status båret af form (skravering = blokeret, stiplet = droppet) og grid-linjerne fra brandbogen.

## Fund

| Prioritet | Hvor og evidens | Effekt | Ændring | Sikkerhed |
|---|---|---|---|---|
| Høj | **Undertekst under hver titel** (tell 10). Alle 10 sider bruger `pageHead`/`tasksHead` med `tagline`. Eksempler: Kapacitet "Hvor mange timer er der reelt tilbage, når drift, projekter og det uplanlagte er trukket fra?", som sætningen lige under besvarer. Opgaver "Alt, der skal laves: opgaver uden projekt, opgaver i projekter og opgaver fra rutiner." Rutiner "Det, der kommer igen. Hver gang laver HeyOtto Tasks …" | Kasper bruger appen hver dag. Teksten forklarer sider, han kender, og skubber arbejdet 40–60 px ned (på 390 px står titel og undertekst i hele første tredjedel). Det ligner hver anden SaaS-skabelon | **Fjern** underteksten på Kapacitet, Opgaver, Projekter, Rutiner, Kalender og Assistenten. **Behold** den kun, hvor den siger noget, man skal vide: Claude-adgang, Historik og Omplanlæg ("Intet ændres, før du trykker Anvend"). Projektets egen undertekst (data, fx "Ny forside og bookingflow før sæsonstart") bliver | Observeret |
| Høj | **Tekst om koden og modellen** (tell 8). Projektets fod: "vedligeholdes af Claude Code i dashboard/index.html" (`index.html` l. 2615). Kapacitet: "… men den sætning der skal med, når chefen spørger" (l. 1747) og "det er dét, der gør forskel på en opgaveliste og et kapacitetsregnskab" (l. 1789). Ugelog: "Registrér groft; præcision er ikke pointen." (l. 2084). Rutiner: "Senere kan assistenten køre rutiner som flows." (l. 3618) | Det er byggebriefen og køreplanen, der er blevet stående i grænsefladen. Det hjælper ikke med at sætte timer eller registrere en uge | **Fjern** foden på projektsiden, "Senere kan …" og chef-sætningen. **Omskriv** de to forklaringer til én kort regel ved feltet, hvor den bruges (se eksemplet herunder). Formlen bliver under "Sådan er ugen regnet", for den er en reel forklaring af tallet | Observeret |
| Mellem | **Nøgletalsrække, der gentager listen** (yderligere fund, ikke en af de ti). `statRow` på Opgaver, Projekter og Rutiner: fire celler med etiket og stort tal. På Opgaver står "Over deadline 1" og "Denne uge 8", og lige under står filtrene "Denne uge" og gruppen "Over deadline 1". På Rutiner står "Ikke gjort 0" | Klassisk KPI-strimmel: stor plads, ingen handling, og den samme information to gange. Brugeren skal læse tal, før listen kommer | **Erstat** med tallene i filterchipsene ("Denne uge 8", "Uden projekt 2") og et rødt tal kun, når noget er over deadline. Projekter: "I risiko" står allerede pr. række, og "Næste deadline" pr. række, så rækken kan fjernes helt. Rutiner: "Fast tid 3,5 t pr. uge" flyttes ind i overskriften "Dine rutiner" | Observeret |
| Mellem | **AI-gnisten som assistentens tegn** (tell 5 og 7: et generisk ikon i stedet for egen identitet). `icon("spark")` bruges 15 steder: Omplanlæg, Spørg, Hent mails, Lav forslag, "Assistenten siger", fanen "Assistent" og ventetekster | ✦ er blevet det fælles tegn for "AI" på tværs af produkter. Appen har sit eget tegn, Otto, som allerede står i sidebaren og på forsiden | **Erstat** fanens og "Assistenten siger"s gnist med Ottos hoved (`otto/hoved.png`, 20 px, findes). **Fjern** gnisten fra knapperne: "Omplanlæg", "Spørg", "Hent mails" og "Lav forslag" er tydelige som tekst. Ventetekster ("Assistenten tænker …") får `otto/taenker.png` i lille størrelse eller ingen figur | Observeret |
| Mellem | **Rød overalt** (tell 2). På Kapacitet står fem røde ting over folden: sætningen, "1 deadline overskredet", fire røde titler i "Assistenten siger" og det røde tal 4 i sidebaren og på fanen. På projektsiden står "1 Blokeret" og "1 over deadline" to gange: i chipsene og igen i sprintens panel | Rød skal være signalet "se her først". Når fire rækker i træk er røde, kan øjet ikke prioritere, og dobbelte chips læses som støj | **Behold** rød på sætningen, prikkerne og datoer, der er overskredet. **Gør** titlerne i "Assistenten siger" sorte; den røde prik bærer niveauet. **Fjern** de gentagne chips i sprintpanelet (de står allerede over panelet). Ét rødt tal pr. sted: tallet i sidebaren bliver, prikken på fanen bliver | Observeret |
| Mellem | **Kort med farvet venstrekant** (tell 4). `.tcard` på tavlen har en kant på 3 px i statusfarven og afrundede hjørner. Status står i forvejen i kolonnens overskrift | Kanten gentager kolonnen og er netop det "neglekort", skillen beskriver. Blokeret har desuden både rød kant og skravering | **Fjern** venstrekanten. Kortet beholder sin tynde ramme, for et kort på en tavle er en ting. Blokeret beholder skraveringen (form, ikke farve). Sprintmålet (`.goal`, også en venstrekant) bliver almindelig tekst: "Mål: Forsiden er live på staging …" | Observeret |
| Lav | **Teksten sidder øverst i genvejsknapperne på mobil** (tell 6, en rigtig fejl). "Sprint", "Øvrige sprints" og "Tidslinje" på projektsiden (390 px): teksten står i toppen af 44 px-knappen. Årsag: `.jump a` får `min-height: 44px` ved `pointer: coarse` uden `display: inline-flex; align-items: center` | Ser ufærdigt ud og skjuler, at det er knapper | **Ret** `.jump a` til `display: inline-flex; align-items: center`. Overvej at fjerne genvejene helt på mobil: siden er kort nok til at rulle | Observeret |
| Lav | **Sprinthovedet på mobil.** "+ Ny opgave" og "+ Ny sprint" brydes rundt mellem "Aktuel" og blyanten, og hver får sin egen linje (390 px) | Fire linjer før sprintens mål | **Saml** "+ Ny opgave" som eneste knap i hovedet. "Ny sprint" flyttes til blyantens menu eller bunden af "Øvrige sprints" | Observeret |

**Det, der ikke er et problem (bevidst bevaret):** Geist som eneste familie er brandets valg og bruges med en rigtig skala. Plus-mærkerne og de lodrette linjer kommer fra brandbogen og er ikke en tilfældig stil. Den ene røde signalfarve er en defineret rolle. Statusprikkerne i sidebaren betyder kun sundhed. "Aktuel" er en rigtig tilstand (aktuel, kommende eller seneste sprint) og bliver.

## Retning: et regnskab, ikke et dashboard

> Hjælp Kasper med at se, om ugen holder, og hvad der skal flyttes, ud fra hans egen kapacitetsmodel. Karakteren kommer fra regnskabet (timer, et loft og et facit) og fra Otto, der viser stemningen.

Det giver tre konkrete beslutninger:

1. **Hver side starter med sit indhold, ikke med en forklaring.** Titel og én handling. På Kapacitet er sætningen ("Du er 1,8 timer over i denne uge") sidens eneste introduktion.
2. **Tal står ved det, de tæller.** Ingen KPI-strimler. Tal står i filtrene, ved rækkerne og i ugens fod.
3. **Otto er assistentens ansigt.** Ingen gnister. Otto optræder, hvor hans stemning betyder noget: forsiden, ventetid, tomme visninger og fanen.

Der er ikke behov for en ny stil. Farver, skrift og grid fra M16 bliver, og ændringerne er tekst, struktur og ét ikon.

### Eksempel: Opgaver, før og efter (360 px fra toppen på skrivebordet)

**Før**

```
Opgaver
Alt, der skal laves: opgaver uden projekt, opgaver i projekter og opgaver fra rutiner.
─────────────────────────────────────────────────────────────
Åbne 12 │ Over deadline 1 │ Denne uge 8 │ Uden projekt 2
─────────────────────────────────────────────────────────────
(Alle opgaver) (Denne uge) (Uden projekt) (Fra rutiner)
[Ny opgave uden projekt … tryk Enter        ] (Tilføj) (Med detaljer)
Over deadline 1
```

**Efter (forslag)**

```
Opgaver                                              
─────────────────────────────────────────────────────────────
(Alle 12) (Denne uge 8) (Uden projekt 2) (Fra rutiner 1)
[Ny opgave … tryk Enter                     ] (Tilføj) (Med detaljer)
Over deadline 1
□ Billeder fra fotograf   Blokeret            Nyt website   tors. 5. nov.
I dag 1
```

Den første opgave rykker cirka 150 px op, og ingen information forsvinder: hvert tal står i filteret, der viser det.

### Eksempel: teksten på Kapacitet

| Før | Efter (forslag) |
|---|---|
| Undertekst: "Hvor mange timer er der reelt tilbage, når drift, projekter og det uplanlagte er trukket fra?" | (ingen; sætningen i panelet er svaret) |
| "Sæt kun timer på det, der reelt trækker tid *denne* uge. En opgave med deadline i marts trækker 0 nu — det er dét, der gør forskel på en opgaveliste og et kapacitetsregnskab." | "Timer = det, opgaven tager i denne uge." (som `fhint` ved overskriften) |
| Ugelog: "Kalibrerer modellen. Registrér groft; præcision er ikke pointen." | "Efter 2 uger måler bufferen sig selv." |
| "… ikke en teoretisk pointe, men den sætning der skal med, når chefen spørger." | (fjernes; formlen før den bliver) |

## Første ændringer

| # | Ændring | Indsats | Godkendt når |
|---|---|---|---|
| 1 | **Ryd teksten:** underteksterne på seks sider, foden "vedligeholdes af Claude Code", chef-sætningen, "Senere kan assistenten …" og de to forklaringer, der omskrives (tabellen ovenfor) | Lille (kun strenge i `index.html`) | `rg "vedligeholdes af\|chefen\|Senere kan"` finder intet, og på 390 px står første indhold (panel, chips eller liste) mindst 40 px højere end i `shots/audit` på Kapacitet, Opgaver og Rutiner |
| 2 | **Fjern KPI-strimlerne:** tallene flyttes ind i filterchipsene (Opgaver), i rækkerne (Projekter) og i overskriften (Rutiner). Fjern de dobbelte chips i sprintpanelet, og gør titlerne i "Assistenten siger" sorte | Lille til mellem (`statRow`, `renderTasks`, `renderProjects`, `renderRoutines`, `renderSprint`, `.oa-rod`) | Intet tal står to gange på samme side, og "Over deadline" er stadig rødt et sted på Opgaver, når noget er overskredet |
| 3 | **Otto i stedet for gnisten:** Ottos hoved på fanen og ved "Assistenten siger", ingen ikoner på knapperne, og venstrekanten og målets kant fjernet fra tavlen. Ret samtidig genvejsknappernes lodrette centrering | Lille (`ICON`, `.tcard`, `.goal`, `.jump a`) | `icon("spark")` bruges 0 gange. Status på tavlen kan stadig læses i sort-hvid (kolonne og skravering), og `npm run a11y` har stadig ingen fund |

**Kontrol efter ændringerne:** `npm run shots` i lyst, mørkt og 390 px, gennemgået mod tabellen ovenfor, samt `npm run a11y` og `npm test`. Tjek også de tomme visninger (`npm run preview -- --empty`), for de bruger den samme sidehoved-kode.

## Gridet (tilføjet efter auditten)

Plus-mærkerne og de to lodrette rammelinjer om hovedkolonnen var pynt: de målte ingenting og var slået fra på mobil. De er fjernet. Gridet står nu kun der, hvor det måler noget:

- **Ugen på Kapacitet er en timeskala.** Bjælken er delt i én celle pr. time (`--cell` = 100 % / antal timer), og hver femte time står under bjælken (0, 5, 10 … 25 t). Fri og overbookede timer kan tælles: de 1,8 timer over loftet er de skraverede celler mellem loftet og bookingen.
- **Kalenderen** (timer og dage) og **tidslinjen** (måneder) havde allerede et grid med en funktion og er uændrede.
- **Sektionerne** skilles stadig af én vandret linje, for den skiller indhold.
