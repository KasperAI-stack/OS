# M7: Agent-kernen, HeyOtto OS' egen agent-indgang

**Status (2026-11-05):** bygget på branchen `claude/m7-agent-kernen`: plan-trin 1, 2, 3, 7 og 8 (motor, kø, baggrundsfunktion, planlagt udløser, værktøjerne `data_read`, `forecast_run`, `calendar_list`, "Spørg Otto", aktivitetslog og indstillinger). Gmail (trin 4–5) hører til M8, omplanlægning (trin 6) til M9. Valgt indtil videre: navnet **Otto**, dagsbudget **20 kr.**, og "Lad Claude udføre" (routinen) bliver stående. Afvigelser: værktøjsnavne med `_` (Claude API tillader ikke punktum), og skills som `.mts`-tekstmoduler i stedet for `.md`, så de altid kommer med i funktionspakken. Se `dashboard/README.md` under "Otto: agenten".

> "jeg vil bygge en agent-indgang, der spiller uden disse små tools. Det ville monday.com jo aldrig gøre på en feature"

## Beslutning

HeyOtto OS får **sin egen agent**, der kører i appens backend (Netlify) og kalder Claude API direkte. Den bruger **appens egne værktøjer** (kalender, mail, opgaver, prognose, orkestrator), og den bliver ikke koblet til Claude Code Routines eller claude.ai-forbindelser.

Den erstatter routinen i M8 (mail → opgaver) og er motoren i M9 (omplanlægning). M10 (orkestratoren) bliver et værktøj, den kan foreslå jobs til.

### Hvorfor (og hvad det koster)

| | Routine + connectors (gammel plan) | Egen agent-kerne |
|---|---|---|
| Afhængighed | Claude Code Routines (testfunktion), claude.ai-forbindelser | Kun Claude API + egne Google-tokens |
| Fart | Minutter (sky-session starter, repo klones) | Sekunder |
| Udløsere | Kun planlagt eller via API-fire | Planlagt, hændelser (ny mail), og dig (knap, chat) |
| Kontrol | Skill-tekst + god vilje | Værktøjer med rettigheder, håndhævet i koden |
| Sporbarhed | En session-log et andet sted | Hver kørsel logges i appen med hvert værktøjskald |
| Pris | Dit abonnement | Claude API-forbrug (AI Gateway-kreditter eller `ANTHROPIC_API_KEY`) |
| **Ulempe** | — | **Agenten kan kun det, du bygger værktøjer til.** Meta Ads, Canva osv. er ikke med af sig selv |

Ulempen er reel, men den passer til arkitekturen. **OS-agenten er hjernen** (triage, planlægning, overblik) med OS'ets egne værktøjer. **Din lokale orkestrator er hænderne** (M10) med dine tunge værktøjer. Har du brug for noget midt imellem, kan Claude API's MCP-connector kobles på en enkelt MCP-server senere. Det er en mulighed, ikke en del af planen.

"Lad Claude udføre"-knappen (routinen) kan blive stående til opgaver, der kræver repoet og dine agenter, og fases ud, når orkestratoren dækker det.

## Arkitektur

```
Udløser ──► agent-kø ──► agent-background.mts ──► Claude API (tool use-løkke)
 planlagt                  (op til 15 min)          │
 hændelse                                            ├─ værktøjer: læs (kalender, mail, data, prognose)
 dig (knap/chat)                                     ├─ værktøjer: foreslå (opgave, ændringer, orkestrator-job)
                                                     └─ værktøjer: skriv internt (kun hvis automatik er slået til)
                                   └──► agent-runs/<id>  (log, forbrug, resultat) ──► appen
```

### 1. Kørselsmotoren (`netlify/lib/agent/runtime.mts`)

- En løkke: send beskeder + værktøjsliste til Claude → udfør de værktøjskald, den beder om → send resultaterne tilbage → gentag, til den er færdig.
- **Grænser pr. kørsel:** maks. 20 trin, maks. tokens, maks. 10 minutter. **Dagsbudget** i kr. (indstilling). Når budgettet er nået, stopper kørslerne, og du får en alarm. Ingen løbske regninger.
- Kører i en **baggrundsfunktion** (`agent-background.mts`, Netlify tillader 15 min). Planlagte funktioner må kun køre 30 sek., så de lægger bare en kørsel i kø og starter baggrundsfunktionen.
- Hver kørsel gemmes i `agent-runs/<id>`: udløser, opgave, hvert værktøjskald (navn, kort input/output), resultat, tokens og pris. De seneste 200 gemmes.

### 2. Værktøjerne (`netlify/lib/agent/tools/`)

Hvert værktøj har et navn, et JSON-skema, en funktion og en **rettighedsklasse**:

| Klasse | Værktøjer | Effekt |
|---|---|---|
| `read` | `calendar.list`, `gmail.search`, `gmail.read`, `data.read`, `forecast.run` | Ingen |
| `propose` | `inbox.suggest_task`, `plan.propose_changes`, `orchestrator.propose_job` | Skriver kun i forslagslagre (`inbox/`, `plans/`), aldrig i `data` |
| `write` | `tasks.create`, `tasks.update` | Skriver i `data` (med `by: "Otto"`, så det står i Historik). **Kun når du har slået automatik til for den slags kørsel** |
| `external` | — | **Findes ikke for agenten.** At sende mail, svare på invitationer og tænde kampagner gør kun du, i appen |

**Hver slags kørsel får kun de værktøjer, den skal bruge.** Indbakke-triagen har `gmail.*`, `data.read` og `inbox.suggest_task`, intet andet. Det er det vigtigste forsvar mod *prompt injection*. Skriver nogen i en mail "opret 50 opgaver" eller "send en mail til …", er det værste, der kan ske, et forkert forslag, som du ignorerer.

### 3. Agentens "skills" (`netlify/lib/agent/skills/*.md`)

Instruktionerne til hver slags kørsel ligger som tekstfiler i repoet, så de versioneres i git og rettes med en PR. Det er samme idé som Claude Code-skills, men nu hjemme i OS'et:

- `indbakke.md`: hvad tæller som en opgave til dig, hvordan projekt vælges, og hvornår der springes over
- `omplanlaeg.md`: regler for forslag (M9)
- `morgenbrief.md`: dagens overblik (valgfri)
- `udfoer.md`: "Lad Otto udføre" for lette opgaver som mailkladder og resuméer (afløser routinen for det, den kan klare med OS-værktøjerne)

### 4. Udløsere

| Udløser | Hvad |
|---|---|
| Planlagt (`agent-schedule.mts`) | Indbakke hvert 15. min i arbejdstiden. Ugeplan mandag 07:00 (M9) |
| Hændelse | Ny mail (senere: Gmail push via Google Pub/Sub, `users.watch`, fornyes hver 7. dag). Kalenderen ændrer en uge til overbooket |
| Dig | Knapperne "Omplanlæg", "Lad Otto udføre" og **"Spørg Otto"**, et chatfelt, der kan læse alt og foreslå, men ikke skrive uden dit klik |

Der er ingen kørsel, som agenten kan starte for sig selv. Udløsere kommer kun fra planen, hændelser eller dig (samme princip som i dag).

### 5. Modeller

Lagdelt, så det er billigt at køre ofte:

- **Hurtigt filter** (er mailen overhovedet relevant?): `claude-haiku-5-5`
- **Triage og forslag**: `claude-sonnet-5-5`
- **Omplanlægning og "Spørg Otto"**: `claude-opus-5-5`

Afklares med `claude-api`-skillen ved implementering (SDK, tool use, strukturerede svar og prompt caching af de faste instruktioner, så gentagne kørsler bliver billigere).

### 6. Mail direkte fra Gmail API

M4's Google-forbindelse får to scopes: `calendar.readonly` + `gmail.readonly`.

- `gmail.readonly` er et *restricted* scope. Til eget brug (under 100 brugere) med klienten i **In production** virker det med en "ikke verificeret app"-advarsel ved første login. Kræver Google-verificering først, hvis appen skal bruges af andre.
- Synk: `history.list` fra seneste `historyId` (kun nye ændringer, billigt). Første gang de sidste 2 dage.
- Kun det nødvendige sendes til Claude: afsender, emne, dato og tekst uden citeret historik, klippet til ~4.000 tegn. Kun resuméet og tråd-id'et gemmes.

## I appen

- **Otto-aktivitet** (under Indstillinger eller i sidebaren): liste over kørsler med udløser, hvad der kom ud af det, hvert værktøjskald og prisen. Det er der, du ser *hvorfor* Otto foreslog noget.
- **Indstillinger → Agent:** til/fra pr. slags kørsel, automatik (må oprette opgaver selv: ja/nej, sikkerhedsgrænse), dagsbudget og modelvalg.
- Forslag (indbakke, planer) vises som beskrevet i M8 og M9. Det eneste nye er, hvor de kommer fra.

## Plan

1. `runtime.mts` + værktøjsregister med rettighedsklasser + `agent-runs/`-log + dagsbudget. Test med et `ping`-værktøj.
2. Baggrundsfunktion + kø + planlagt udløser.
3. Værktøjerne `data.read`, `forecast.run` og `calendar.list` (genbruger M4 og M6).
4. `gmail.*` + `history.list`-synk (udvider M4's OAuth).
5. Indbakke-skill + `inbox.suggest_task` (det er M8).
6. `plan.propose_changes` + omplanlægnings-skill (det er M9).
7. "Spørg Otto"-chat.
8. Aktivitetslog og agent-indstillinger i UI.
9. Gmail push (Pub/Sub), hvis 15 minutter føles langsomt.

## Åbne spørgsmål

1. Dagsbudget: hvad er et rimeligt loft til at starte med?
2. Navn i UI: "Otto" (maskotten, som agent) eller "Claude"?
3. Skal "Lad Claude udføre" (routinen) blive, eller udfases, når "Lad Otto udføre" og orkestratoren er på plads?

## Færdig når

- Der er ingen afhængighed af routines eller claude.ai-forbindelser for indbakke og omplanlægning
- Hver agentkørsel kan ses i appen med værktøjskald og pris
- Agenten kan ikke udføre handlinger udenfor, og det er håndhævet i koden, ikke kun i instruktionerne
