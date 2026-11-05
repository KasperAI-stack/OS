# M3: Kapacitetsmodellen bliver en grundindstilling bag et tandhjul

> "Kapacitetsmodel indstillinger skal være en grund indstilling, lav et settings-ikon i højre hjørne"

## Analyse

I dag er "Kapacitetsmodel" et kort på forsiden (`capModel(m)`, l. 1932–1950), placeret ved siden af "Belastning pr. uge" i `.cap2`-griddet. Det indeholder:

| Felt | Nøgle i `DATA.kapacitet` |
|---|---|
| Arbejdsuge | `contract` |
| Faste møder | `meetings` |
| Mail & admin | `admin` |
| Øvrigt fravær | `other` |
| Planlægningsloft (slider) | `ceiling` |

Ad hoc-estimatet (`adhoc`) står i "Belastning"-kortet, men er også en modelindstilling.

Felterne virker live: `data-cap="model"` → `applyCap()` → `markDirty()` → `route()`. `route()` genfinder fokus via `data-cap`/`data-key`, så man kan taste videre, mens siden tegnes om.

Højre hjørne i sidehovedet (`.pacts`) har i dag **Gem** og tema-knappen. Den samme blok gentages i `render()`, `renderCapacity()`, `pageHead()` osv.

## Løsning

**Et tandhjul i `.pacts` på alle sider**, til højre for tema-knappen, åbner **Indstillinger** som et panel (`<dialog>`, samme mønster som `openDialog`). Det bliver ikke en side, fordi indstillingerne skal kunne justeres, mens du ser forsiden ændre sig bag panelet.

Indstillinger bliver det sted, M4, M6, M7 og M10 også skal bruge. Indhold i faner eller sektioner:

1. **Kapacitet** (nu): arbejdsuge, mail & admin, øvrigt fravær, planlægningsloft og ad hoc-estimat. "Faste møder" også, indtil M4 regner den fra kalenderen. Derefter vises den som "fra kalender: 7,5 t denne uge", med et valg mellem "Brug kalenderen" og "Fast tal".
2. **Forbindelser** (M4/M10): Google (forbundet / ikke forbundet / seneste synk), orkestreringsagent (online / sidst set), Claude-routine (flyttes eller linkes fra Claude-adgang).
3. **Alarmer** (M6): hvilke alarmer og hvilken kanal.
4. **Udseende**: tema (lyst/mørkt/system). Tema-knappen kan blive stående i hovedet som genvej.

Kun sektion 1 bygges i M3. De andre tilføjes af de iterationer, der skaber dem. Strukturen laves fra starten, så de har et sted at sætte sig.

**Gem-semantikken ændres ikke.** Felterne i panelet skriver i `DATA.kapacitet` og gør siden "ugemt" præcis som i dag. Panelet har en **Gem ændringer**-knap i bunden, der kalder den samme `save()`.

**Forsiden efter M2 og M3:** `.cap2` mister sin venstre kolonne. "Belastning pr. uge" går i fuld bredde, og i ad hoc-rækken står kun tallet med en lille "Ret i indstillinger"-knap, når det er et estimat. Planlægningsloftet vises stadig som stregen "Loft 27 t" i belastningsbjælken. Et klik på den åbner indstillingerne.

## Plan

1. Tilføj ikonet `gear` i `icon()` (24×24-stil som de andre, 1,5 px streg).
2. Lav én fælles `headActions()`, der returnerer Gem, tema og tandhjul. Brug den i alle sidehoveder, så tandhjulet ikke skal sættes ind fem steder (det fjerner også dubleret kode).
3. `openSettings(section)`: bygger panelet med de eksisterende `numInput`-felter med `data-cap="model"`. `applyCap` virker uændret, fordi den lytter på `document`.
4. Fokus-genfinding: `route()` tegner kun `#main` om, ikke dialogen. Fokus i panelet bevares derfor automatisk. Tjek, at `route()`'s fokuslogik ikke trækker fokus ud af dialogen (den søger `document.querySelector('[data-cap=…]')`, som nu kan finde felter i dialogen. Det er det rigtige felt).
5. Fjern `capModel` fra forsiden og ad hoc-feltet fra `capLoad`. Vis i stedet tal og link. Opdatér `.cap2`-gridden.
6. Tastatur: `Esc` lukker (standard for `<dialog>`). `aria-label="Indstillinger"` på knappen. Fokus vender tilbage til tandhjulet ved luk.
7. Mobil: panelet fylder skærmen under 560 px.
8. README: nyt afsnit "Indstillinger". Opdatér "Forsiden: kapacitet".

## Åbne spørgsmål

- Skal tema-knappen blive i hovedet, eller kun ligge i indstillinger? Anbefaling: blive, fordi den bruges ofte.

## Færdig når

- Tandhjulet står øverst til højre på alle sider og åbner indstillingerne
- Ændringer i panelet slår igennem på forsiden med det samme og gemmes med Gem
- Forsiden har ikke længere kortet "Kapacitetsmodel"
