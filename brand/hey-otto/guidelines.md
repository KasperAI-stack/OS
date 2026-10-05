# Visuel identitet — Hey Otto

Kilde: [`brand-book.html`](brand-book.html) (Brand book light · v1, heyotto.dk). Denne fil er den skriftlige udgave, agenter og HTML-leverancer refererer til. Dashboardet i `dashboard/` bruger den.

Africa Tours-brandet ligger stadig i [`../guidelines.md`](../guidelines.md) og gælder for Africa Tours-indhold.

## Logo og ikon

| Fil | Hvad |
|---|---|
| [`logo.svg`](logo.svg) | Ordmærket "hey otto". Én sti i Onyx `#0F0E13`. På mørk bund sættes `fill` til Tåge eller hvid |
| [`icon.svg`](icon.svg) | Ottos hoved på gradient. Favicon, profilbillede, app-ikon |
| [`otto.svg`](otto.svg) | Otto, hel figur |
| [`stack.svg`](stack.svg) | Stablet flise med Ottos ansigt, til værktøjer og illustrationer |

- Logoet bruges i Onyx på lyse baggrunde og i Tåge eller hvid på mørke. Det må aldrig være lilla, strækkes, drejes eller have skygge.
- Hold fri plads om logoet, mindst lige så meget som højden på "o" i otto.
- Mindste bredde på skærm er 90 px. Er der mindre plads, bruges ikonet alene.
- Ikon foran logo: afstanden er cirka en tredjedel af ikonets bredde.
- Otto står gerne bag en ramme, så kun hoved og skuldre ses. Al grafik er flade vektortegninger i samme stil. Der bruges ingen pixel-art og ingen fotorealistiske AI-billeder.

## Farver

Sort, grå og hvid bærer designet. Lilla er en accent og bruges sparsomt: i gradientrammer, store farvede paneler og små ikoner. Fordelingen er omtrent hvid 55 %, Tåge 20 %, Onyx 15 % og lilla 10 %.

**Neutrale**

| Farve | Hex | Rolle |
|---|---|---|
| Onyx | `#0F0E13` | Tekst og knapper i lyst tema, baggrund i mørkt |
| Grafit | `#1E1C24` | Flader og kort i mørkt tema |
| Skifer | `#3B3845` | Linjer og rammer i mørkt tema |
| Dæmpet | `#5E5A6B` | Dæmpet tekst i lyst tema |
| Sølvgrå | `#A7A3B2` | Dæmpet tekst i mørkt tema |
| Tåge | `#F4F2F8` | Flader i lyst tema, tekst og knapper i mørkt |
| Hvid | `#FFFFFF` | Baggrund i lyst tema |

Linjer i lyst tema: `#E4E1EC` og (stærkere) `#D3CFDD`. I mørkt tema: `#2B2932` og Skifer.

**Lilla accenter**

| Farve | Hex | Rolle |
|---|---|---|
| Dyb violet | `#4C1D95` | Gradientens start og mørke flader |
| Violet | `#7C3AED` | Primær accent og ikoner i lyst tema |
| Orkidé | `#C026D3` | Gradientens midte |
| Rosé | `#F472B6` | Gradientens slut og accent i mørkt tema. Må ikke bruges til tekst på hvid |

**Gradient:**

```css
linear-gradient(135deg, #4C1D95 0%, #7C3AED 38%, #C026D3 72%, #F472B6 100%)
```

### Statusfarver i grænseflader

Brandbogen har ingen rød eller grøn. Status oversættes derfor til brandfarverne, og betydningen bæres også af form, ikke kun af farve:

| Status | Lyst tema | Mørkt tema / mørk flade |
|---|---|---|
| Ikke startet | Sølvgrå | `#6B6778` |
| I gang | Violet | Violet |
| Blokeret | Orkidé + 45° skravering | Orkidé + skravering. Tekst i Rosé |
| Færdig | Onyx | Tåge |
| Droppet | stiplet kant | stiplet kant |

**Bevidst undtagelse:** ukendt status, altså en datafejl, tegnes i signalgul `#FACC15` med kant. Farven findes ikke i brandet med vilje. En fejl må ikke kunne forveksles med noget, der er designet sådan. Den bruges kun til datafejl og aldrig i kundevendt materiale.

## Skrift

**Geist** bruges til alt: overskrifter, brødtekst og knapper. **Fredoka** (600) bruges kun til navnet "Otto", når han taler. Begge er gratis på Google Fonts. I grænseflader bruges **Geist Mono** til små etiketter med store bogstaver (eyebrows) og koder.

```css
font-family: "Geist", "Helvetica Neue", Arial, sans-serif;
font-family: "Geist Mono", ui-monospace, Menlo, Consolas, monospace;
```

| Niveau | Specifikation |
|---|---|
| Overskrift 1 | Geist 600 · 40–80 px · linje 1.02 · spacing −4,5 % |
| Overskrift 2 | Geist 600 · 32–48 px · linje 1.08 · spacing −3 % |
| Overskrift 3 | Geist 600 · 18 px · spacing −1 % |
| Brødtekst | Geist 400 · 17 px · linje 1.6 |
| Lille tekst | Geist 400 · 15 px · dæmpet farve |
| Eyebrow | Geist Mono · 12 px · store bogstaver · spacing 6 % · dæmpet farve |

I tætte grænseflader som dashboardet skaleres størrelserne ned, men vægten og den stramme spatiering i overskrifterne bevares. Tal sættes med `font-variant-numeric: tabular-nums`.

## Former

| Mål | Bruges til |
|---|---|
| 999 px | Knapper, chips og vælgere |
| 22 px | Kort, rammer og paneler |
| 12–14 px | Vinduer og felter inden i rammer |
| 1 px | Linjer i Tåge-grå eller Skifer |

- Knapper er helt runde i enderne og i tekstfarven. Den primære knap er Onyx med hvid tekst og ikke lilla.
- Gradientramme: gradient som baggrund, 6–10 px indvendig luft og et indre vindue med 14 px hjørner.
- Siden står i et grid af tynde linjer med små plus-mærker, hvor linjerne mødes.
- Fladt design: linjer frem for skygger.
- Ikoner har en streg på 1,8 px i et 24 px felt med runde ender og hjørner.
