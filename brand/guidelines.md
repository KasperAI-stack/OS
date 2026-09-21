# Visuel identitet — Africa Tours

Kilde: brandbogens farveside. Denne fil er den skriftlige kilde, agenter og HTML-leverancer refererer til — `CLAUDE.md` beder hver indholdsproducerende agent tjekke `brand/` først, og indtil nu pegede den instruktion på en tom mappe.

## Farvepalette

| Farve | Hex | Rolle |
|---|---|---|
| Creme | `#FDF0D5` | Varm flade, tekst på mørk bund, luft omkring indhold |
| Sand | `#C2A172` | Sekundær flade, hårfine kanter, dæmpet/inaktiv tilstand |
| Orange | `#F39422` | **Primær accent.** Aktiv tilstand, fremhævning, call-to-action. Bruges sparsomt — den mister sin kraft, hvis den er overalt |
| Oliven | `#777955` | Rolig, positiv tone. Afsluttet/godkendt |
| Mørkegrøn | `#494F43` | **Blæk.** Brødtekst, overskrifter, mørke flader og sidebars |

Understøttende neutral: `#F1EFEA` — den knækkede hvid, brandbogens eget opslag står på. Bruges som sidebaggrund, hvor ren hvid ville virke klinisk.

### Funktionel udvidelse (uden for brandbogen)

`#B4552F` — dæmpet terrakotta, afstemt i kulør med orangen.

Paletten indeholder ingen rød, men grænseflader har brug for én farve, der betyder *stop*. At låne en brandfarve til det formål ødelægger betydningen af de øvrige: bruger man orange til både "i gang" og "blokeret", kan man ikke længere aflæse et statusfarvet overblik. `#B4552F` er derfor et bevidst, afgrænset tillæg — ikke afdrift. Den bruges **kun** til fejl- og blokeret-tilstande, aldrig i kundevendt materiale.

Hvor en statusfarve skal kunne skelnes i sort/hvid-print eller af en farveblind læser, suppleres farven med et mønster (fx 45° skravering) frem for at bære betydningen alene.

## Typografi

**Overskrifter: The Seasons** (Nicky Laatz) — høj kontrast, elegant antikva. Den er en **betalt font og findes ikke i dette repo**. Der er ingen fontfiler committet overhovedet.

Indtil licensfilen ligger i `brand/fonts/`, bruges **Cormorant Garamond** (Google Fonts) som stand-in — samme familie af høj-kontrast-antikva, tættest på udtrykket blandt de frit tilgængelige.

Fontstakken skrives altid med The Seasons først:

```css
font-family: "The Seasons", "Cormorant Garamond", "Iowan Old Style", Georgia, serif;
```

Den dag fonten installeres lokalt eller indlejres, overtager den af sig selv — uden kodeændringer. Layout må aldrig afhænge af en bestemt fonts metrik (ingen faste teksthøjder, ingen manuel line-height-tuning der kun holder ved én x-højde), netop fordi stakken skal kunne skifte under det.

**Brødtekst:** systemsans — `system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`. Renderer hurtigt, kræver ingen ekstern hentning, og ser hjemmehørende ud på den maskine, læseren sidder ved.

**Tal:** `font-variant-numeric: tabular-nums`, så kolonner med tal flugter.

## Note om logoet

Der er ingen logofiler i repoet. Asana-opgaven "Logo lancering??" (deadline 2026-10-15) tyder på, at logoet stadig er i bevægelse — hent brandaktiver via Canva- eller Brandfetch-connectoren frem for at gemme en kopi her, der kan nå at blive forældet.
