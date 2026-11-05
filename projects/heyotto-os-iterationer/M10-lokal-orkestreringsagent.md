# M10: Forbindelse til din lokale orkestreringsagent

> "OS skal kunne connectes med min orkestreringsagent, lokalt hostet på min pc, selvudviklet, og sende opgaverne til den. Eks. tænd kampagne eller lav kampagne"

## Analyse

### Det grundlæggende problem: skyen kan ikke ringe til din PC

HeyOtto OS kører på Netlify. Din agent kører på din PC bag din router (NAT/firewall). Netlify kan **ikke** kalde `localhost` eller din PC direkte. Der er tre måder at løse det på:

| | Sådan virker det | Fordele | Ulemper |
|---|---|---|---|
| **A. Agenten henter (pull/kø)** (anbefalet) | Agenten spørger HeyOtto OS hvert ~30 sek.: "har du noget til mig?" | Kun udgående HTTPS fra PC'en, ingen åbne porte, intet at konfigurere i routeren. Er PC'en slukket, venter jobbet i kø | Op til ~30 sek. forsinkelse |
| B. Tunnel (Cloudflare Tunnel / Tailscale Funnel / ngrok) | Din agent får en offentlig adresse. HeyOtto OS sender en webhook | Øjeblikkeligt | Din PC bliver tilgængelig fra internettet. Tunnelen skal køre. Ekstra sikkerhedslag nødvendigt. Er PC'en slukket, fejler afsendelsen |
| C. Vedvarende forbindelse (WebSocket/SSE) | Agenten holder en linje åben | Øjeblikkeligt uden at åbne porte | Netlify Functions kan ikke holde forbindelser åbne ret længe. Kræver en anden server |

**Anbefaling: A.** Det er det sikreste og det mest robuste. Forsinkelsen betyder intet for "lav kampagne". Hvis du senere vil have det øjeblikkeligt, kan B lægges ovenpå uden at ændre jobformatet.

### Halvdelen findes allerede

`claude-jobs/` i `api.mts` er allerede en job-kø med status, grænser, timeout og resultat. M10 generaliserer den: `target: "claude" | "orkestrator"`. Forskellen er kun, hvordan jobbet startes. Claude får en routine-*fire*, orkestratoren henter selv.

**Rollefordeling med M7:** OS-agenten er hjernen (triage, planlægning) med OS'ets egne værktøjer. Orkestratoren er hænderne med dine tunge værktøjer (kampagner osv.). OS-agenten kan *foreslå* et orkestrator-job (`orchestrator.propose_job`), men kun du sender det.

### "Tænd kampagne" er en handling med penge på spil

`CLAUDE.md`: bekræft før enhver handling udenfor, især at starte kampagner og bruge budget. Det skal være indbygget i protokollen, ikke overladt til god vilje.

## Løsning

### 1. Agenten melder sig og fortæller, hvad den kan

Agenten sender `POST /api/agent/hello` ved opstart og derefter hvert minut som hjerteslag:

```json
{
  "name": "Kaspers orkestrator",
  "version": "0.3.1",
  "actions": [
    { "id": "kampagne.opret", "label": "Lav kampagne", "risk": "draft",
      "params": { "platform": "meta|google", "brief": "tekst", "budget_dkk": "tal?" } },
    { "id": "kampagne.tænd", "label": "Tænd kampagne", "risk": "spend",
      "params": { "campaign_id": "tekst" } },
    { "id": "fri", "label": "Fri opgave", "risk": "draft", "params": { "instruction": "tekst" } }
  ]
}
```

- `risk`: `read` (kun læse) · `draft` (laver noget, der ikke er live) · `live` (ændrer noget offentligt) · `spend` (bruger penge).
- HeyOtto OS gemmer det i `agent/status`. **Indstillinger → Forbindelser** viser "Orkestrator online · sidst set for 20 sek. siden" og listen over handlinger.
- Appen bygger menuen ud fra listen. Når du lærer agenten noget nyt, dukker det op af sig selv.

### 2. Du sender en opgave

På en opgave: knappen **→ Send til orkestrator** (ved siden af "✦ Lad Claude udføre"). Vælg handling, udfyld parametre (forudfyldt fra opgavens titel og note) og send.

- `risk: read/draft` → jobbet lægges i kø med det samme.
- `risk: live/spend` → **bekræftelsesdialog** med handling og parametre i klar tekst ("Tænd kampagne *Black Friday – Meta*, dagsbudget 500 kr."), og du skal skrive/klikke **Bekræft**. Kun cookie-sessionen (dig) kan bekræfte. Hverken Claudes nøgle eller orkestratorens kan.

### 3. To-trins for alt med penge

"Lav kampagne og tænd den" bliver til to trin:

1. Agenten laver kampagnen **sat på pause** og melder `status: "afventer godkendelse"` med et resultat ("Kampagne oprettet, pauset. Budget 500 kr./dag. Link: …").
2. Du trykker **Godkend og tænd** i appen → jobbet går til `godkendt` → agenten henter det igen og tænder.

Agenten **skal** selv afvise `live/spend`-jobs, der ikke har `approvedAt` fra serveren. Det er det andet lag, hvis noget i HeyOtto OS går galt.

### 4. Protokollen (HTTP, JSON)

| Metode og adresse | Hvem | Hvad |
|---|---|---|
| `POST /api/agent/hello` | Orkestrator | Hjerteslag + handlinger |
| `GET /api/agent/jobs/next` | Orkestrator | Tag næste job i kø (eller `204`-agtigt tomt svar `{ job: null }`). Jobbet får en **lease** på 10 min og status `hentet` |
| `PUT /api/agent/jobs/:id` | Orkestrator | `{ status: "i gang" \| "afventer godkendelse" \| "udført" \| "fejlet", result?, progress?, links? }` |
| `POST /api/agent/jobs` | Dig (appen) | Opret job `{ taskId, action, params, instruction }` |
| `PUT /api/agent/jobs/:id` | Dig | `{ status: "godkendt" \| "annulleret" }` |
| `GET /api/agent/jobs` | Dig, Claude | Liste til appen |

Statusflow:

```
kø → hentet → i gang → udført
                    ↘ afventer godkendelse → godkendt → hentet → i gang → udført
                    ↘ fejlet
kø/afventer → annulleret (dig)
```

**Sikker mod dobbeltkørsel:**

- Job-id'et er idempotensnøgle. Agenten husker, hvilke id'er den har udført.
- Udløber en lease uden at agenten har meldt `i gang`, går jobbet tilbage i kø.
- Har den meldt `i gang` og så tier, markeres jobbet "intet svar". Det **køres aldrig om af sig selv**, og slet ikke `spend`-jobs. Du afgør.

### 5. Adgang og nøgle

- En **tredje nøgletype** `Orkestrator` (ved siden af din cookie og Claudes nøgle). Den laves i Indstillinger → Forbindelser → "Lav nøgle til orkestrator" og vises kun én gang (samme mønster som Claudes nøgle). Den gemmes som hash i `auth/agent-key`.
- Nøglen må **kun** bruge `/api/agent/*`. Ikke `/api/data`, ikke historik, ikke Claudes jobs. Den ser kun det, der står i jobbet (opgavens titel, note og parametre). Det er det mindste privilegium. Skal agenten have mere kontekst, kan du senere give den læseadgang til `data`.
- På PC'en ligger nøglen i en miljøvariabel eller i Windows Credential Manager, aldrig i koden.
- Grænser: 30 jobs i timen, og `next` kaldes højst hvert 10. sekund (ellers `429`).

### 6. Klienten på din PC

Fordi jeg ikke kender din agent, leveres to ting:

1. **Protokollen** ovenfor, dokumenteret i README, så den kan implementeres i hvilket som helst sprog.
2. **En lille referenceklient i Python** (`tools/orkestrator-klient/heyotto_client.py`, ~120 linjer, kun standardbiblioteket), som din agent kan importere:

```python
from heyotto_client import HeyOtto

ho = HeyOtto(key=os.environ["HEYOTTO_AGENT_KEY"], actions=MINE_HANDLINGER)
for job in ho.jobs():                 # poller hvert 30. sek., sender hjerteslag
    ho.started(job)
    if job.action == "kampagne.opret":
        res = min_agent.lav_kampagne(**job.params)   # din kode
        ho.needs_approval(job, f"Oprettet og pauset: {res.url}")
    elif job.action == "kampagne.tænd":
        assert job.approved_at                       # andet lag
        min_agent.tænd(job.params["campaign_id"])
        ho.done(job, "Tændt.")
```

Polling-frekvens: 30 sek. giver ~86.000 kald om måneden, hvis PC'en står tændt døgnet rundt. Det er inden for Netlifys gratis funktionsgrænse (125.000 om måneden), men det er den største post. Klienten kan sænke til hvert 2. minut, når der ikke har været jobs i en time.

### 7. Senere

- **Claude → orkestrator:** Claude (fx i M9-planen eller et job) kan *foreslå* et orkestrator-job, der ligger som forslag, indtil du trykker send. Claude må aldrig sende det selv (samme regel som i dag: kun du starter).
- **Tunnel (B)** for øjeblikkelig levering, hvis 30 sek. føles langsomt.
- Resultater med filer (fx kreativer): agenten uploader til Blobs via `POST /api/agent/jobs/:id/files`.

## Plan

1. Generalisér job-koden i `api.mts` (`target`, `action`, `params`, `approvedAt`, lease). Claude-jobs skal virke uændret: kør dem igennem på preview.
2. Orkestrator-nøgle + scoping + grænser.
3. `/api/agent/hello`, `/next` og `PUT`-flowet med statusovergange, der håndhæves på serveren.
4. UI: "Send til orkestrator", bekræftelsesdialog ved `live/spend`, status på kortet (genbrug `jobChip`/`jobBox`), "Godkend og tænd" og status i Indstillinger.
5. Referenceklient + README-afsnit "Orkestrator".
6. Test ende-til-ende med en "dummy"-handling (`ping`), før en rigtig kampagnehandling sættes på.

## Åbne spørgsmål til Kasper (vigtige, før der bygges)

1. Hvad er agenten skrevet i, og hvordan modtager den opgaver i dag (CLI, HTTP-server, kø, chat)?
2. Hvilke handlinger skal med fra start? Er "lav kampagne" og "tænd kampagne" Meta Ads, Google Ads eller begge?
3. Har agenten selv en godkendelsesmekanisme, eller skal HeyOtto OS være den eneste?
4. Kører PC'en døgnet rundt, eller er det ok, at jobs venter til næste gang den er tændt?
5. Skal agenten melde resultater tilbage som tekst, links, eller også filer?

## Færdig når

- Indstillinger viser orkestratoren online med dens handlinger
- Du kan sende "Lav kampagne" fra en opgave, og resultatet står på opgaven
- "Tænd" kræver din bekræftelse i appen og afvises af agenten uden den
- Et job køres aldrig to gange
