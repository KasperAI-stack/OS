# M1: Fjern Marketing-dashboardet

> "fjern alt kode omkring dashboardet"

## Fortolkning

"Dashboardet" læses som **Marketing-dashboardet** (sidebar-sektionen *Marketing*, `#marketing`, med Search Console, GA4, Google Ads og Meta Ads). Hele HeyOtto OS bliver i README'en også kaldt "dashboardet", men det giver ikke mening at slette, når resten af punkterne bygger videre på det. **Bekræft, hvis du mente noget andet.**

## Analyse: hvad findes i dag

| Sted | Hvad | Omfang |
|---|---|---|
| `netlify/lib/metrics.mts` | Hele udtrækket fra Google og Meta | 398 linjer, slettes |
| `netlify/functions/metrics-sync.mts` | Planlagt funktion hver 6. time | 22 linjer, slettes |
| `netlify/functions/api.mts` | `import … metrics.mts` (l. 38), sektionen "Marketing-dashboard" (l. 527–563), ruten (l. 603), kommentaren øverst (l. 19–20) | ~45 linjer |
| `dashboard/index.html` CSS | Blokken "Marketing-dashboard" (l. 563–~622: `.dmeta`, `.seg-ctl`, `.dchart`, `.dtip`, `.dlegend` …) | ~60 linjer |
| `dashboard/index.html` HTML | `<div class="nav-label">Marketing</div>` og `<div id="mktnav">` i sidebaren | 2 linjer |
| `dashboard/index.html` JS | Sektionen l. 2464–2874 (`renderDashboard`, `loadMetrics`, `dashMeta`, grafer, formatering, `DASH`/`mos-dash`), sidebar-knappen i `renderSidebar` (l. 916–920), `#marketing` i `route()` (l. 2897), `loadMetrics(false)` i `boot()` (l. 2974), `#mktnav` i CSS l. 210 | ~420 linjer |
| `dashboard/README.md` | Sektionen "Marketing-dashboard" + "Forbind kilderne", to rækker i API-tabellen, "dashboard-tal" i oversigtstabellen | ~45 linjer |
| `CLAUDE.md` | Sætningen om Marketing-dashboardet under `dashboard/` | 1 sætning |
| Netlify Blobs | `metrics/snapshot` | Bliver liggende, uskadeligt. Kan slettes |
| Netlify miljøvariabler | `GOOGLE_ADS_*`, `GSC_*`, `GA4_*`, `META_ACCESS_TOKEN`, `META_AD_ACCOUNTS`, `*_API_VERSION` | Kasper fjerner dem i Netlify |

Pas på med helpers, der deles: `seg-ctl` (segmenteret kontrol) bruges kun af dashboardet i dag, men M5 skal bruge en toggle. Den kan enten beholdes og genbruges, eller skrives forfra i M5. **Anbefaling: behold `.seg-ctl`** og flyt den op til de fælles komponent-styles.

Formatterne `NF0`/`NF1`/`fInt` osv. er kun dashboardets. De slettes med det.

## Plan

1. Slet `netlify/lib/metrics.mts` og `netlify/functions/metrics-sync.mts` (og mappen `netlify/lib/`, hvis den bliver tom). Den planlagte kørsel stopper ved næste deploy.
2. `api.mts`: fjern import, sektion, rute og linjerne i toppens kommentar.
3. `index.html`: fjern CSS-blok, sidebar-markup, JS-sektion, `route`-gren, `boot`-kald og sidebar-knap. Behold `.seg-ctl`.
4. Et gammelt bogmærke til `#marketing` lander nu på forsiden (Kapacitet), fordi ukendte hash allerede gør det. Der skal ikke laves mere.
5. Opdatér `dashboard/README.md` og `CLAUDE.md`. Tjek `reference/connections.md` for omtaler.
6. Verificér:
   - `grep -ri "metric\|mktnav\|renderDashboard\|mos-dash" dashboard netlify` giver intet
   - appen åbner uden konsolfejl på Deploy Preview: kapacitet, et projekt, Historik og Claude-adgang
7. Efter merge (Kasper): slet miljøvariablerne i Netlify. **Men** hvis M4 skal genbruge Google OAuth-klienten (`GOOGLE_ADS_CLIENT_ID`/`_SECRET`), så lad de to blive stående, indtil M4 har besluttet det.

## Risiko

Lav. Koden er isoleret i egne sektioner. Den største risiko er at fjerne en helper, som andre dele bruger. Kør appen igennem på preview.

## Færdig når

- Ingen Marketing-sektion i sidebaren, og ingen `/api/metrics`
- Ingen planlagt funktion i Netlify-oversigten
- Dokumentationen nævner den ikke længere
