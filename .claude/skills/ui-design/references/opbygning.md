# Opbygning: struktur, flow og regler

Uddrag af `ui-ux-pro-max` (`references/quick-reference.md` og `pro-rules.md`), ordnet efter, hvornår man har brug for dem. Det fulde regelsæt står i den skill. Reglerne er mindstekrav: de gør en side brugbar, ikke flot. Flot står i `flot-design.md`.

## 1. Før layoutet: hvad er siden til?

- **Én primær handling pr. skærm** (`primary-action`). Resten er sekundært og ser sådan ud.
- **Vigtigste indhold først**, især på mobil (`content-priority`). Spørg: hvad kom brugeren for? Det står øverst og størst.
- **Vælg strukturen efter indholdet, ikke efter vane:**

| Indhold | Struktur |
|---|---|
| Mange poster, der skal sammenlignes | Tabel eller liste med faste kolonner |
| Selvstændige ting med egen identitet (projekter, kunder) | Kort i et grid |
| Status, der flytter sig | Tavle med kolonner |
| Tid og rækkefølge | Tidslinje eller kalender |
| Ét tal, der skal forstås | Ét stort svar med grafik, der forklarer det |
| Undtagelser, der skal løses | Prioriteret kø med handlinger pr. række |
| Samtale | Tråd med avatarer, felt nederst |

## 2. Navigation (HIGH)

- Sidebar fra 1024 px, fanebjælke eller topbar under (`adaptive-navigation`). Højst 5 faner, altid ikon og tekst (`bottom-nav-limit`, `nav-label-icon`).
- Hvor man er, skal kunne ses: farve, vægt eller en markering (`nav-state-active`).
- Log ud og andre farlige handlinger står adskilt fra navigationen (`destructive-nav-separation`).
- Navigationen står samme sted på alle sider (`navigation-consistency`). Bland ikke faner, sidebar og bundbjælke på samme niveau (`avoid-mixed-patterns`).
- Visninger af det samme indhold (Liste · Tavle · Kalender) er faner over indholdet, ikke separate sider.
- Fokus flyttes til hovedindholdet ved sideskift (`focus-on-route-change`).

## 3. Layout og afstand (HIGH)

- **Afstandsskala på 4/8 px** (`spacing-scale`): 4, 8, 12, 16, 24, 32, 48, 64. Ingen tilfældige værdier.
- **Rytme i tre niveauer:** inde i en komponent (8–12), mellem komponenter (16–24), mellem sektioner (32–48). Samme niveau har altid samme afstand (`section-spacing-hierarchy`).
- **Fast indholdsbredde** på skrivebordet (`container-width`), og faste brudpunkter: 375 / 768 / 1024 / 1440.
- **Linjelængde** 60–75 tegn på skrivebordet, 35–60 på mobil (`line-length-control`).
- **Hierarki med størrelse, afstand og kontrast**, ikke kun farve (`visual-hierarchy`).
- `min-h-dvh` i stedet for `100vh`, og safe-area på faste bjælker (`viewport-units`, `safe-area-awareness`).
- Ingen vandret rulning på mobil, undtagen bevidste karruseller og tabeller.

## 4. Tilgængelighed (CRITICAL)

- Kontrast 4,5:1 for tekst, 3:1 for stor tekst, ikoner med betydning og kanter på kontroller (`color-contrast`, WCAG 1.4.11).
- Synlig fokusring på alt, der kan nås med Tab, og tabrækkefølge som den visuelle (`focus-states`, `keyboard-nav`).
- Farve er aldrig den eneste bærer af betydning: status har også tekst, ikon eller mønster (`color-not-only`).
- Ikonknapper har et tilgængeligt navn (`aria-labels`). Overskrifter i rækkefølge (`heading-hierarchy`).
- Respektér `prefers-reduced-motion`.
- `<html lang>` er sat.

## 5. Berøring og feedback (CRITICAL)

- Trykflader mindst 44×44 px, mindst 8 px mellem dem (`touch-target-size`, `touch-spacing`).
- Feedback inden for 100 ms ved tryk (`press-feedback`, `tap-feedback-speed`). Hover må aldrig være den eneste vej.
- Knapper viser, at de arbejder ("Gemmer …") og kan ikke trykkes to gange (`loading-buttons`).
- Fejl står ved feltet, siger årsag og løsning og har en vej videre ("Prøv igen") (`error-placement`, `error-clarity`, `error-recovery`).
- Sletning kan fortrydes ("Slettet · Fortryd") i stedet for en bekræftelse; bekræft kun det, der ikke kan fortrydes (`undo-support`, `confirmation-dialogs`).
- Beskeder læses op (`aria-live`), forsvinder efter 3–5 s ved succes og bliver stående ved fejl.

## 6. Formularer

- Synlig etiket over hvert felt; pladsholder er ikke en etiket (`input-labels`).
- Felter på mobil mindst 44 px høje og 16 px tekst (`touch-friendly-input`).
- Relaterede felter i grupper (`field-grouping`), avancerede felter foldet ind (`progressive-disclosure`).
- Semantiske felttyper, så telefonen viser det rigtige tastatur (`input-type-keyboard`).

## 7. Tilstande: tom, henter, fejl, succes

Hver visning designes i alle fire tilstande, ikke kun med data:

- **Tom:** hvad er det her, og hvad gør jeg nu? Én handling (`empty-states`).
- **Henter:** skelet i samme form som indholdet ved mere end 1 s, ingen hoppende layout (`progressive-loading`, `content-jumping`).
- **Fejl:** hvad gik galt, hvordan løser jeg det, og en knap (`error-state-chart`, `timeout-feedback`).
- **Succes:** kort bekræftelse, samme ord som handlingen ("Gem" → "Gemt").

## 8. Data og grafer

- Graftypen følger data: udvikling = linje, sammenligning = søjler, andel = ring (højst 5 dele) (`chart-type`, `no-pie-overuse`).
- Forklaringen står ved grafen, værdier kan ses ved tryk/hover og med tastaturet (`legend-visible`, `tooltip-keyboard`).
- Gitterlinjer er svage, data stærke (`gridline-subtle`, `contrast-data` 3:1).
- Små datasæt: skriv tallet direkte på grafen (`direct-labeling`).
- Tal i kolonner med `tabular-nums`, og danske tal- og datoformater (`number-tabular`, `number-formatting`).
- Tom graf = en besked og en handling, ikke en tom akse (`empty-data-state`).

## 9. Bevægelse

- Højst 1–2 animerede elementer pr. visning (`excessive-motion`). Hver bevægelse forklarer en ændring (`motion-meaning`).
- Kun `transform` og `opacity` (`transform-performance`). Ud er hurtigere end ind (`exit-faster-than-enter`).
- Dialoger og paneler kommer fra der, hvor de blev åbnet (`modal-motion`).
- Fælles varighed- og easing-tokens for hele appen (`motion-consistency`).

## 10. Før aflevering

Gennemgå `pro-rules.md` → "Pre-Delivery Checklist" i `ui-ux-pro-max`. Kort udgave:

- [ ] Testet på 375 og 1440 px, i lyst og mørkt tema
- [ ] Reduceret bevægelse og stor tekst virker
- [ ] Trykflader ≥ 44 px, intet under safe-area
- [ ] Ét ikonsæt, én stregtykkelse, samme ikonstørrelser
- [ ] Ingen rå hex-farver i komponenter, kun tokens
- [ ] Alle fire tilstande (tom, henter, fejl, succes) er set
