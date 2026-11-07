---
name: ui-design
description: Design og byg flot, brugbar UI til Kaspers produkter (HeyOtto Tasks, Hey Otto, landingssider) med referencebiblioteket i reference/design/, regler for opbygning og et tjek for AI slop. Brug den, når en side, app-visning, komponent eller landingsside skal designes, redesignes eller gøres "flottere", "mere levende", "mindre AI-agtig" eller "som en grafisk designer ville lave den", og når Kasper sender skærmbilleder af design, han kan lide.
---

# UI-design: opbygning, flot design og ingen AI slop

Tre lag, i den rækkefølge:

1. **Opbygning:** hvad siden er til, struktur, flow og regler. Se `references/opbygning.md` (uddrag af `ui-ux-pro-max`).
2. **Flot design:** dybde, farve med mening, typografi, data som grafik og personlighed, lært fra de bedste. Se `references/flot-design.md` og billederne i `reference/design/`.
3. **Ingen AI slop:** en kontrol bagefter, ikke en sletteliste. Se `references/ingen-ai-slop.md` (fra `detect-slop-ui` og `frontend-design`).

**Læs altid først `references/smag-og-laeringer.md`.** Kaspers egne ord og eksempler vinder over alle generelle regler. Han har afvist sort-hvid minimalisme og flade sider uden dybde.

## Arbejdsgang

### 1. Brief

- Hvad er siden til, hvem bruger den, og hvad er den ene handling? Brug produktets egne ord og rigtige data, ikke pladsholdere.
- Hvad findes allerede: brand (`brand/`), tokens, komponenter? Byg videre, start ikke forfra.
- Hvis Kasper har sendt eksempler, så beskriv kort, hvad du ser i dem (dybde, farve, struktur), og bekræft, at det er det, han mener.

### 2. Referencer

- Find 3–6 relevante billeder i `reference/design/README.md`: mindst ét fra hvert spor (design, håndværk, regler) og gerne et af Kaspers egne fra `fra-kasper/`.
- Se billederne med Read. Skriv for hvert billede én sætning om, hvad du låner, fx "statuspiller med lys flade og mørk tekst" eller "ét hovedkort og tre små kort med tal".
- Lån principper, ikke et bestemt produkts udseende. Bland referencer, så resultatet ikke ligner én af dem.

### 3. Designplan (før kode)

Skriv en kort plan:

- **Flader:** side, kort, hævet kort, dialog, og skyggen for hver.
- **Farveroller:** neutrale farver, primær, status og kategori, hver med betydning og hex-værdi for lyst og mørkt tema.
- **Typografi:** roller og skala (display, h1, h2, brød, lille, mikro).
- **Afstand:** skala og rytme.
- **Layout:** pr. side som ASCII-skitse.
- **Det ene memorable greb:** én ting, siden huskes for.

Gennemgå planen mod `ingen-ai-slop.md`: ville du nå frem til samme plan for et hvilket som helst andet produkt? Så gør den mere specifik. Tjek også den modsatte vej: er planen blevet tom og flad? Så læg dybde og farve med mening tilbage.

### 4. Vis før du bygger

Byg én til tre nøglesider som mockup med rigtige data, i lyst og mørkt tema, og tag skærmbilleder på 1440 og 390 px. Vis dem for Kasper og få et ja, før resten bygges. Til HeyOtto Tasks: `npm run preview`, og derefter `npm run shots`.

### 5. Byg

- Tokens først (flader, farver, typografi, afstand, skygger, radius, bevægelse), så komponenter, så sider.
- Hver komponent findes én gang og bruges flere steder.
- Følg `opbygning.md` for struktur, tilgængelighed, berøring, formularer og tilstande (tom, henter, fejl, succes).
- Én side ad gangen med skærmbilleder.

### 6. Kontrol

- Skærmbilleder i lyst og mørkt tema, 1440 og 390 px, set med Read. Sammenlign med referencerne: er det lige så gennemarbejdet?
- Tilgængelighed: `npm run a11y` (HeyOtto Tasks) eller tilsvarende. Kontrast på alle farvede piller i begge temaer.
- Gennemgå tjeklisten i `ingen-ai-slop.md`, inkl. punktet om at have ryddet for meget.
- Rapportér ærligt: hvad er set, hvad er testet, og hvad er ikke.

## Referencebiblioteket

`reference/design/` har skærmbilleder af offentlige sider fra de teams, der laver den bedste UI/UX, i tre spor:

| Mappe | Indhold |
|---|---|
| `design/` | Farverig, legende, med personlighed: Duolingo, Headspace, Monzo, Slack, monday, ClickUp, Notion … |
| `haandvaerk/` | Præcision og detaljer: Linear, Stripe, Things, Arc, Raycast, Mercury, Attio … |
| `regler/` | Designsystemer: Apple HIG, Material 3, Atlassian, Primer, Polaris, Fluent, Carbon, monday Vibe |
| `galleri/` | Udvalgte landingssider (Godly, Land-book) |
| `fra-kasper/` | Kaspers egne eksempler. Vejer tungest |

`README.md` har én linje pr. billede: kilde, dato og hvad man kan lære. Nye kilder tilføjes i `kilder.json` og hentes med `node scripts/refshots.mts <id>`. Kun offentlige sider, intet login.
