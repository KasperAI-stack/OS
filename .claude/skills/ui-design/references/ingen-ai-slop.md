# Ingen AI slop: tjek og modgift

Samlet fra `detect-slop-ui` (de ti kendetegn) og `frontend-design` (de typiske genererede stilarter). Brug det som en **kontrol** efter designet er lavet, ikke som en opskrift. En sletteliste gør en side tom, ikke god (se "Lektien fra M16" nederst).

**Grundreglen:** et træk er ikke slop, fordi det findes på mange sider. Det er slop, når det står der uden at være valgt: det betyder ingenting, det kunne flyttes til et andet produkt uændret, eller det erstatter en beslutning, der burde være truffet. Kaspers egne ønsker vinder altid over listen.

## De ti kendetegn (detect-slop-ui)

| # | Kendetegn | Slop, når … | I orden, når … | Modgift |
|---|---|---|---|---|
| 1 | Gradienter overalt | De konkurrerer om opmærksomheden eller er hele identiteten | Ét bevidst brandmotiv eller data | Faste flader til læsning; ét sted med effekt |
| 2 | Farve uden mening | Hver flise har sin egen farve uden en kategori bag | Farven betyder det samme overalt (status, projekt, serie) | En lille palet af roller; samme farve = samme betydning |
| 3 | Overflødige eller pulserende mærker | "Live", "Verified", "AI" uden en rigtig tilstand bag | Mærket viser en tilstand, man handler på | Tjek tilstanden; et stille mærke for vedvarende ting, bevægelse kun ved ændring |
| 4 | Kort med farvet kant | Samme farvede kant på alle kort, kort i kort | Kortet er en selvstændig ting, kanten betyder noget | Vælg struktur efter relation: rækker, tabel, tavle; behold kort, der fortjener rammen |
| 5 | Emoji som pynt | Emoji ved hver overskrift og knap | Brugerens indhold, reaktioner, et legende brand | Et sammenhængende ikonsæt eller ren tekst |
| 6 | Skævheder | Prikker ved siden af sporet, ikoner over grundlinjen | En bevidst forskydning | Fælles spor og anker; ret komponenten, ikke det enkelte element |
| 7 | Standardskrift og "programmør-kostume" | Ingen hierarki, mono og `//` for at virke teknisk | Fonten passer til brandet; mono til koder og tal | Roller (display, brød, data) og skala før ny font |
| 8 | Byggerester i teksten | Teksten forklarer, hvordan siden er lavet ("bygget med …") | Teknik påvirker brugerens valg | Slet eller oversæt til en evne, brugeren har |
| 9 | Glas og færdige stilarter | Blur og gennemsigtighed som hud; brutalisme som modgift | Lagdelingen forklarer noget | Én rolle pr. flade; ændr komposition før stil |
| 10 | Tomme slogans | "Elevate", "seamless", en grå undertekst under hver titel | En konkret, troværdig værdi | Navngiv tingen, opgaven, resultatet; slet det, siden selv siger |

## De typiske genererede stilarter (frontend-design)

AI-design klumper sig omkring disse fem. De er ikke forbudt, men de skal være valgt:

1. Cremefarvet baggrund (ca. `#F4F1EA`), høj-kontrast serif og en terrakotta-accent (ca. `#D97757`).
2. Næsten sort baggrund med én skarp syregrøn eller orange accent.
3. Avislayout med hårstreger, nul hjørner og tætte spalter.
4. **SaaS-kortsættet:** alt hakket i ens kort med samme hjørne og samme grå skygge (`rgba(0,0,0,.1)`), gradienter som pynt.
5. **Skabelonkrom:**
   - en etiket med store bogstaver over hver overskrift
   - meta-tekst med midterprikker ("A · B · C")
   - "ORD — fragment" med en tankestreg
   - #0B0B0B i stedet for sort
   - mono til små etiketter
   - "→" efter hver knaptekst

Andre typiske træk:

- Ét ord i overskriften, der er fremhævet med kursiv eller farve.
- Nummererede markører (01 / 02 / 03) på indhold, der ikke er en rækkefølge.
- Ens animation (fade og glid op) på hver sektion, hover-effekt på hvert kort.
- Det store tal med lille etiket og tre nøgletal ved siden af som standardløsning på en forside.

## Kort er ikke slop i sig selv

Kasper vil have kort, dybde og farve (se `smag-og-laeringer.md`). Forskellen på et godt kortdesign og "SaaS-kortsættet":

| SaaS-kortsættet (slop) | Godt kortdesign |
|---|---|
| Alle kort er ens | Kortenes størrelse og placering følger vigtigheden: ét hovedkort, mindre kort til detaljer |
| Én radius og én skygge overalt | En skala for højde: side → kort → hævet kort → dialog, hver med sin skygge |
| Farve som pynt (gradient i hjørnet) | Farve, der betyder noget: status, projekt, tidstype |
| Kort i kort i kort | Kortet holder én ting; indeni er der rækker, ikke flere kort |
| Tomme tal ("+12 %") | Rigtige data med en forklaring og en handling |

## Lektien fra M16 (november 2026)

M16 og M16b brugte denne liste som en sletteliste:

- kortene blev til linjer
- farverne blev til sort-hvid
- nøgletallene blev fjernet

Resultatet var rent og tilgængeligt, men kedeligt. Kasper afviste det. Skillen siger selv: "keep cards that earn their boundaries", "keep meaningful status indicators", "do not make minimalism a rule", "avoid a universal flattening pass".

**Derfor:** når et kendetegn findes, er første spørgsmål "hvordan gør vi det godt?", ikke "skal det væk?". Fjern kun det, der ikke har en mening, og læg noget bedre ind i stedet.

## Kontrol (efter hver side)

- [ ] Hver farve har en betydning, der er den samme på alle sider
- [ ] Hvert mærke viser en rigtig tilstand
- [ ] Ingen tekst om, hvordan siden er bygget; ingen slogans; ingen undertekst, der gentager titlen
- [ ] Kort har et hierarki (ikke ens), og ingen kort ligger i kort
- [ ] Ingen af de fem genererede stilarter er brugt uden et valg
- [ ] Bevægelse kun ved handling eller ét orkestreret øjeblik
- [ ] Substitutionstesten: skift logoet. Kunne siden høre til et andet produkt uændret? Så mangler der noget, der er dette produkts eget
- [ ] **Og modsat:** er siden blevet tom? Er der mistet farve, dybde eller information, der hjalp? Så er der ryddet for meget
