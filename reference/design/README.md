# Designbibliotek

Skærmbilleder af offentlige sider fra de teams, der laver den bedste UI/UX, plus Kaspers egne eksempler. Biblioteket bruges af skillen `ui-design` (`.claude/skills/ui-design/`). Principperne, der er uddraget herfra, står i `.claude/skills/ui-design/references/flot-design.md`.

**Hentet 2026-11-07** med `node scripts/refshots.mts` (Chrome, ingen login). Kilderne står i `kilder.json`, og status pr. kilde står i `hentet.json`. Hver kilde har tre billeder:

- `<id>-fold.jpg`: første skærmbillede, 1440×900
- `<id>-side.jpg`: hele siden, højst 6000 px
- `<id>-mobil.jpg`: 390 px

**Brug:** billederne er referencer til at forstå principper. De må ikke kopieres som et produkts udseende. Kilde og dato står ved hvert billede. Ny kilde: tilføj den i `kilder.json`, og kør `node scripts/refshots.mts <id>`.

**Kvalitet:**
- ★★★ = et forbillede for præcis det, der står i "Lær"
- ★★ = brugbart
- ★ = mest markedsføring; brug kun detaljen

**Kendte huller:**
- Mange produktsider viser kun appen som en lille illustration.
- Cookiebannere dækker enkelte billeder (Notion Calendar, Attio, Ramp, Material).
- Revolut og Land-book blokerer automatiske besøg.
- Arc er lukket. ClickUps Workload-side findes ikke mere.
- Sider bag login er ikke med; dem skal Kasper selv tage (`fra-kasper/`).

## fra-kasper/: Kaspers egne eksempler (vejer tungest)

| Fil | Lær |
|---|---|
| `heyotto-kapacitet-foer-m16.png` | Appen før M16: kort med blød ramme, Otto-flise, tre celler med nøgletal. Kasper foretrak den frem for den flade udgave |
| `heyotto-tasks-foer-m16.png` | Før M16: fire kort med nøgletal, chips og en liste i et kort |
| `monday-tabel-farvede-statusceller.png` | Gruppe med farvet kant og titel, tabel med kolonnehoveder, statusceller med fuld farve, en opsummeringsbjælke pr. kolonne |
| `slack-agent-med-eget-ansigt.png` | Agenten har en avatar og et navn i samtalen og en plads i sidebaren under "Agents" |
| `clickup-box-belastning-og-kort.png` | Belastning som søjler med avatarer; et kort pr. person med ring, tal (Not done / Done) og statusgrupper med farve og antal |
| `dashboard-kort-paa-tonet-flade.png` | Tonet side, hvide kort, nøgletal med ikon og ændring, søjler, ring og tabel i hver sit kort |

## design/: farverig, legende, med personlighed

| Id | Kilde | Kvalitet | Lær |
|---|---|---|---|
| duolingo | duolingo.com | ★★★ | Maskotten er hovedpersonen; én stærk farve til den primære handling; knapper med "fysisk" bund (skygge under) |
| duolingo-brand | design.duolingo.com | ★★ | Artikler om, hvordan figurer og farver bruges |
| headspace | headspace.com | ★★★ | Store, bløde kort på tonet flade; figur og illustration ved siden af produktbilleder; varm farve |
| monzo | monzo.com | ★★ | Stort billede i et kort med store hjørner; én hvid knap; tillidsmærker diskret i hjørnet |
| spotify-webplayer | open.spotify.com | ★★★ | Rigtig app: mørk ramme, indhold i afrundede paneler, kort med billede, titel og meta i to linjer, "Show all" pr. række |
| airbnb | airbnb.com | ★★ | Søgning som hovedhandling, kort med billede og kort tekst |
| slack | slack.com | ★★ | Personlighed og avatarer |
| slack-ai | slack.com/ai | ★★ | Agent i samme flade som mennesker; tonet baggrund bag produktbillede |
| monday | monday.com | ★ | Markedsføring; se `monday-wm` og Kaspers eget billede |
| monday-wm | monday.com/work-management | ★★ | Chatboble fra en agent over et produktkort; illustreret figur; farvet flade som scene for produktet |
| clickup | clickup.com | ★★★ | Rigtig liste: statusgrupper som farvet pille med antal ("In Progress 2"), kolonner Name/Due/Priority, avatar pr. række, flagikon for prioritet, chat i et panel ved siden af |
| notion | notion.com | ★★ | Ro, illustrationer, få farver |
| notion-calendar | notion.com/product/calendar | ★★★ | Ikoner i farvede fliser med farvet kant (kategori); kalender, hvor hver begivenhed har kategoriens farve |
| notion-projects | notion.com/product/projects | ★★ | Projekter, tavler og tidslinjer |
| asana | asana.com | ★ | Markedsføring |
| asana-features | asana.com/features | ★ | Stor typografi, mørk flade som scene |
| trello | trello.com | ★★ | Telefon med blå tavle; farvede former bag produktet; tydelig primær knap |
| todoist | todoist.com | ★★★ | Rigtig app: sidebar med farvede projekt-#, prioritet som farvet cirkel, "Add task" i listen; varm baggrund bag produktbillede |
| todoist-features | todoist.com/features | ★★ | Funktioner med rigtige skærmbilleder |
| sunsama | sunsama.com | ★★★ | Personlig dagsplan: dage som kolonner med opgavekort og tid ("1:30"), kalender til højre med farvede blokke, #kanal som farvet mærke |
| float | float.com | ★★★ | Kapacitet: avatarkort med "120 % utilized" i rødt, skema med farvede blokke, graf "Capacity vs. demand" |

## haandvaerk/: præcision og detaljer

| Id | Kilde | Kvalitet | Lær |
|---|---|---|---|
| linear | linear.app | ★★★ | Rigtig app i et vindue: sidebar med ikoner, issue med aktivitet, agent-panel ("Thinking…"). Tæt, men luftigt; ét lysniveau pr. flade |
| linear-changelog | linear.app/changelog | ★★ | Tidslinje med dato og prik til venstre, indhold til højre |
| linear-features | linear.app/features | ★ | Ikonfliser; mørk stil |
| stripe | stripe.com | ★★★ | Overskrift i to toner (sort + gråblå), én stor farveflade som signatur, tynde lodrette linjer, der deler siden |
| stripe-billing | stripe.com/billing | ★★★ | Kort med indre små kort (nøgletal pr. linje), "Popular"-mærke, kortet med farvet top for den anbefalede |
| stripe-docs | docs.stripe.com | ★★ | Navigation og dokumentation |
| things | culturedcode.com/things | ★★★ | Prisvindende: lys blågrå flade, appen på alle enheder, få farver med fast betydning (gul stjerne = I dag, rød = deadline) |
| raycast | raycast.com | ★ | Mørk og dramatisk; lån kun kommandopaletten |
| superhuman | superhuman.com | ★★ | Arbejdsgang og fokus |
| mercury | mercury.com | ★★ | Fotografi som stemning; glas-felt med e-mail og knap |
| ramp | ramp.com | ★★ | Tæller med levende tal, gul primær knap, prikket gitter som baggrund |
| figma | figma.com | ★★ | Værktøjs-UI og farverige former |
| framer | framer.com | ★★ | Landingsside, bevægelse |
| vercel | vercel.com | ★★ | Præcision, typografi |
| attio | attio.com | ★★★ | Rigtig app i vindue: sidebar med Quick Actions og ⌘K, agent-samtale; ekstremt rene afstande |
| motion | usemotion.com | ★ | Gradient i overskriften og "#1"-hype. Eksempel på det, vi undgår |
| reclaim | reclaim.ai | ★★ | Kalender med fokustid som stiplet grøn blok, assistent-panel til højre; "#1"-hype i overskriften undgås |

## regler/: designsystemer

| Id | Kilde | Kvalitet | Lær |
|---|---|---|---|
| apple-hig | developer.apple.com/design/human-interface-guidelines | ★★★ | Regler for alt |
| apple-hig-layout | …/layout | ★★★ | Hierarki, grupper, afstand |
| apple-hig-color | …/color | ★★★ | Farve med betydning, systemfarver, mørkt tema |
| material3 | m3.material.io | ★★ | Tonede flader, store hjørner, farverige eksempler |
| material-color-roles | m3.material.io/styles/color/roles | ★★★ | Farveroller: primary / on-primary / primary-container / surface-container (fem niveauer) |
| material-elevation | m3.material.io/styles/elevation/overview | ★★★ | Højde vises med tone og skygge i faste niveauer |
| atlassian | atlassian.design | ★★ | Farvede navnemærker, prikgitter |
| atlassian-lozenge | atlassian.design/components/lozenge | ★★★ | Statusmærker: semantiske farver (neutral, success, removed, in progress, new, moved) i lys og stærk udgave |
| atlassian-color | atlassian.design/foundations/color-new | ★★★ | Tokens for farveroller |
| atlassian-elevation | atlassian.design/foundations/elevation | ★★★ | Flader: sunken, default, raised, overlay, hver med sin skygge |
| primer | primer.style | ★★ | GitHubs system |
| primer-label | primer.style/components/label | ★★ | Mærker med farve og varianter |
| polaris | polaris-react.shopify.com | ★★ | Shopifys app-referencer: sidebar, kort med ikon |
| fluent2 | fluent2.microsoft.design | ★★ | Microsofts system |
| carbon | carbondesignsystem.com | ★★ | IBMs system |
| carbon-data-table | carbondesignsystem.com/components/data-table | ★★★ | Tabeller: tæthed (kompakt/normal), værktøjslinje, valg af rækker, sortering |
| vibe | vibe.monday.com | ★★ | monday.coms komponenter (Storybook) |

## galleri/

| Id | Kilde | Kvalitet | Lær |
|---|---|---|---|
| godly | godly.website | ★★ | Udvalgte sider; brug den til at finde nye kilder |
