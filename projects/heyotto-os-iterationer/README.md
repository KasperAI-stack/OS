# HeyOtto Tasks (tidligere HeyOtto OS): iterationer M1–M15

Status (2026-11-06):

- **M1–M3** er bygget. PR #6.
- **M4** er bygget på branchen `claude/m4-google-kalender` (bygger på M1–M3). Det er testet lokalt, men ikke mod rigtig Google, før en OAuth-klient er sat op.
- **M5** (kalenderoverblikket) er bygget på branchen `claude/m5-kalenderoverblik`.
- **M6** (prognose og alarmer, inkl. push-notifikationer) er bygget på branchen `claude/m6-prognose-alarmer`.
- **M7** (Otto, agent-kernen) og **M8** (Indbakke med "Hent mails") er merget og live (PR #13 og #14).
- **M9** (omplanlæg med Otto, inkl. ugeforslag mandag) er bygget på branchen `claude/m9-omplanlaeg`.
- **M10** er bygget og testet i Node på branchen `claude/m10-cloudflare` (deploy til testmiljøet mangler). Appen hedder nu **HeyOtto Tasks**.
- **M10–M15** er planlagt (2026-11-06): OS flytter til Cloudflare og får samme opsætning som HeyOtto Studio (API med tokens, MCP, UI bag Cloudflare Access) og en forbindelse til Studio. Grundlaget er Studios guide "byg et værktøj med samme opsætning som HeyOtto Studio". Den tidligere M10-plan (Studio på pc'en via tunnel med `/actions` og `/runs`) er erstattet af M15.

**Krav fra Kasper (2026-11-05):** det skal være nemt at sætte kalender og Gmail op for andre konti. Derfor er intet bundet til én konto. Man kan forbinde flere Google-konti, og opsætningen står i appen med den præcise redirect-adresse. En anden person kan sætte sit eget HeyOtto OS op med samme trin. Numrene er byggerækkefølgen: hver iteration bygger kun på dem med lavere numre. Hver fil har en analyse af den nuværende kode, en anbefalet løsning, konkrete trin, åbne spørgsmål og en definition af "færdig".

| # | Iteration | Dit ønske | Størrelse | Bygger på | Kasper skal selv |
|---|---|---|---|---|---|
| [M1](M1-fjern-marketing-dashboard.md) | Fjern Marketing-dashboardet | 1 | S | — | Rydde miljøvariabler i Netlify bagefter |
| [M2](M2-slet-kingman-kurven.md) | Slet "Hvorfor loftet ikke er 100 %" | 4 | XS | — | Beslutte om "Kø-faktor"-tallet også skal væk |
| [M3](M3-indstillinger.md) | Kapacitetsmodel → indstillinger bag tandhjul | 5 | S | M2 | — |
| [M4](M4-google-kalender.md) | Google Kalender: møder → kapacitet, + fletning i stedet for 409 | 2 | M | M1, M3 | Lave en Google OAuth-klient, godkende adgang |
| [M5](M5-kalenderoverblik.md) | Kalenderoverblik som toggle ved Aktive opgaver | 3 | M | M4 (møder). Opgavedelen kan bygges før | — |
| [M6](M6-prognose-og-alarmer.md) | Prognose og alarmer: når alt i mål? | 6 | M | M4, M5 | Vælge alarmkanal |
| [M7](M7-agent-kernen.md) | **Agent-kernen:** OS'ets egen agent (Claude API + egne værktøjer) | 2, 6, 7 | L | M4, M6 | Sætte et dagsbudget, Claude API via AI Gateway eller nøgle |
| [M8](M8-mail-til-opgaver.md) | Mail → opgaver i projekterne | 2 | M | M4, M7 | — |
| [M9](M9-omplanlaeg-med-otto.md) | Omplanlæg med Claude | 6 | M | M6, M7 | — |
| [M10](M10-cloudflare-fundament.md) | **Cloudflare-fundament:** OS kører på Workers + D1 (testadresse) | 7 | L | M1–M9 | Adgang til Cloudflare-kontoen (gratis plan, Paid kun hvis CPU-grænsen rammes) |
| [M11](M11-api-tokens.md) | API-tokens (`hos_`) med scopes og OS' API `/ext` | 7 | M | M10 | — |
| [M12](M12-adgangsvagt-og-access.md) | Global adgangsvagt og UI'et bag Cloudflare Access | 7 | M | M10, M11 | Lave Access-applikationen |
| [M13](M13-flytning-til-cloudflare.md) | Flytningen: data, domæne, Google og push, Netlify slukkes | 7 | S | M10–M12 | Vælge flyttedag, rette Google-redirect, slå push til igen |
| [M14](M14-mcp-og-dokumentation.md) | MCP-endpoint og API-dokumentation (OpenAPI) | 7 | M | M11, M12 | — |
| [M15](M15-os-og-studio.md) | OS og Studio taler sammen (begge veje) | 7 | M | M11–M14 | Tokens i Studio og OS, MCP-opsætning i Studio |

## Pull requests

1. **M1 + M2:** oprydning. Ren sletning med lav risiko, der gør resten lettere at bygge.
2. **M3:** indstillinger. Det sted, M4, M6, M7 og M10 sætter deres forbindelser og præferencer.
3. **M4 + M5:** kalenderen. Giver hurtigst noget synligt: møder på forsiden og "Faste møder" regnet automatisk.
4. **M6:** prognose og alarmer. Ingen AI, bare regler: er der timer nok til, at alt kommer i mål?
5. **M7:** agent-kernen. Kørselsmotor, værktøjer med rettigheder, log og budget.
6. **M8:** den første agentkørsel. Mail bliver til opgaver.
7. **M9:** den anden agentkørsel. Omplanlægning som en ændringsliste, du godkender.
8. **M10:** OS kører på Cloudflare Workers og D1 på en testadresse. Intet nyt at se.
9. **M11:** API-tokens og `/ext`.
10. **M12:** adgangsvagt og Cloudflare Access. Først derefter flytter rigtige data.
11. **M13:** flyttedag. `os-ui.heyotto.win` bliver HeyOtto OS.
12. **M14:** MCP og dokumentation.
13. **M15:** OS sender tasks til Studio, og Studios agenter arbejder i OS via MCP.

## Tværgående beslutninger

- **Ingen afhængighed af små værktøjer udenfor (besluttet 2026-11-05).** HeyOtto OS' intelligens kører i appen selv via agent-kernen (M7): Claude API, appens egne værktøjer og egne Google-tokens. Der bruges ingen Claude Code Routines og ingen claude.ai-forbindelser til produktfunktioner.
- **Nye datakilder ligger uden for `data`.** Kalenderen, mailforslag, Claudes planforslag og orkestrator-jobs ligger som egne nøgler i lageret (Netlify Blobs, fra M10 D1 på Cloudflare), ligesom `claude-jobs/` gør i dag. Kun det, du accepterer, skrives ind i `data` og kommer dermed i Historik. Fletningen i M4 klarer resten.
- **Hjerne og hænder.** OS-agenten (M7) tænker, planlægger og foreslår med OS'ets egne værktøjer. Studio (M15) udfører med dine tunge værktøjer. OS og Studio er selvstændige værktøjer med hvert sit API og hvert sit token; OS-agenten kan kun foreslå at sende en task til Studio, du sender den.
- **Samme opsætning som Studio (besluttet 2026-11-06).** Lukket som standard: kun `/ext` og `/mcp` med token og UI'et bag Cloudflare Access kan nås udefra. Hemmeligheder ligger kun som secrets, tokens gemmes som hash og logges aldrig, og intet token kan godkende noget. OS kører på Cloudflare Workers (guidens mulighed c), så der er ingen tunnel og ingen pc, der skal være tændt.
- **Udkast og forslag, ikke handlinger.** Agenten må ændre HeyOtto OS' egne data, når du har sagt ja til det (eller har slået automatik til for den slags). Handlinger udenfor, som at sende mail, svare på invitationer eller tænde kampagner, gør kun du med en bekræftelse i appen. Det er håndhævet i koden (`CLAUDE.md`).
- **Visning er ikke data.** Toggle-valg (liste/kalender, uge/måned) gemmes i browseren, som filtrene på tidslinjen allerede gør.
- **Hvem er kalenderen?** Din arbejdskalender hos Africa Tours ligger i Outlook (Microsoft 365), ikke i Google. Det er det største åbne spørgsmål i M4.
