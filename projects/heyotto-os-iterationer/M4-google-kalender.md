# M4: Google Kalender, møder og kapacitet

> "connecte det til min gmail og min google kalender — hertil skal den selv ekstrakte tasks og møder, opdatere kapaciteterne og oprette tasks i projekter"

## Analyse

Der er fire ting i ønsket, og de har meget forskellig karakter:

| Del | Karakter | Kræver AI? |
|---|---|---|
| Hente møder fra kalenderen | Deterministisk synk, skal være frisk (kalendervisningen i M5) | Nej |
| Opdatere kapaciteten ud fra møderne | Ren beregning | Nej |
| Udtrække opgaver fra mail | Fortolkning af fri tekst | **Ja** |
| Oprette opgaverne i det rigtige projekt | Klassifikation + skrivning i `data` | Ja (klassifikation) |

Derfor er det delt i to iterationer: **M4 Kalender** (denne, server, uden AI, bygges først) og **M8 Mail → opgaver** (OS-agenten, bygges efter M5–M7).

### Sådan virker det i dag

- `DATA.kapacitet.meetings` er et fast tal, som du taster ind ("Faste møder, interne + eksterne"). `capacity()` trækker det fra arbejdsugen.
- Modellen kender kun "denne uge". Den har ingen idé om, at næste uge er fuld af møder.
- Der er ingen Google-forbindelse tilbage efter M1. Den gamle OAuth-klient (`GOOGLE_ADS_CLIENT_ID/SECRET`) havde kun scopes til Ads/GSC/GA4.
- Kun du og Claude kan skrive i `data`. Hver skrivning tjekker `rev`, og ved en forældet `rev` afvises skrivningen med 409. **Flere automatiske skrivere betyder flere 409'ere**, mens du har ugemte ændringer. Det løses i denne iteration (se "Forudsætning" nedenfor).
- claude.ai-forbindelserne **Gmail** og **Google Calendar** findes i dine Claude-sessioner, men HeyOtto OS bruger dem ikke. Appen får sin egen Google-forbindelse, så funktionen ikke afhænger af værktøjer udenfor (se [M7](M7-agent-kernen.md)).

### Det store åbne spørgsmål: hvilke konti?

Din arbejdsmail og -kalender hos Africa Tours ligger i **Outlook/Microsoft 365** (personal-assistant bruger den). Du skriver Gmail og Google Kalender. Er det:

- (a) kun Google (Hey Otto / privat), eller
- (b) Google **og** Outlook?

Det ændrer ikke arkitekturen, men det fordobler opsætningen af kalendersynken. Planen bygger Google først, så Outlook kan sættes på bagefter med samme datamodel (`source: "google" | "outlook"`).

## Forudsætning: fletning i stedet for "data er ændret et andet sted"

I dag gemmer browseren hele `data` med den `rev`, den hentede. Når kalendersynken, mailudtrækket (M8), Claudes forslag (M9) og orkestratoren (M10) skriver oftere, kommer du til at se 409-beskeden langt oftere.

**Løsning:** Kalender, forslag, planer og jobs ligger **uden for `data`** i egne blob-nøgler, så de aldrig ændrer `rev`. Kun accepterede ting kommer ind i `data`. Derudover:

- Ved 409 henter browseren den nyeste version og laver en **3-vejs-fletning pr. opgave/projekt/sprint-id**: base (det, du hentede), din version og serverens.
  - kun ændret hos dig → din
  - kun ændret på serveren → serverens
  - ændret begge steder i samme felt → konflikt vises til dig
- Kladden i browseren har allerede din version. Basen gemmes ved siden af den.

Det er ~80 linjer i `save()` og gør alle de næste iterationer sikre.

## Google Kalender → møder og kapacitet

### Forbindelse (OAuth)

- Kasper laver en OAuth-klient i Google Cloud (type *Web application*). Redirect-URI: `https://heyotto-os.netlify.app/api/google/callback`. Scope: `https://www.googleapis.com/auth/calendar.readonly` (kun læsning).
- Sæt klienten til **In production**. I *Testing* udløber refresh-tokens efter 7 dage (det samme problem, som README'en beskrev for de gamle Google-tokens). `calendar.readonly` er et "sensitive" scope. Til eget brug (under 100 brugere) kan man klikke sig forbi advarslen "ikke verificeret app". Verificering er ikke nødvendig.
- Miljøvariabler: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- Nye ruter i `api.mts`:
  - `GET /api/google/connect`: kun for dig (cookie). Laver `state` (HMAC af session + tid, mod CSRF) og redirecter til Google
  - `GET /api/google/callback`: tjekker `state`, bytter `code` til tokens og gemmer refresh-tokenet **krypteret** (AES-GCM med en nøgle afledt af `auth/secret`) i `auth/google`
  - `DELETE /api/google`: afbryd forbindelsen og tilbagekald tokenet hos Google
  - `GET /api/google`: status (forbundet, konto-e-mail, valgte kalendere, seneste synk og fejl)
- I **Indstillinger → Forbindelser** (M3): knappen "Forbind Google Kalender", og en liste over dine kalendere med flueben for, hvilke der tæller (fx ikke "Helligdage" eller en delt familiekalender).

### Synk

- `netlify/functions/calendar-sync.mts`: planlagt hvert 15. minut (kun produktion, som den gamle metrics-sync) **plus** en frisk synk, når appen åbnes, hvis den seneste er over 5 minutter gammel (`POST /api/calendar/refresh`, max én gang i minuttet).
- Vindue: fra 7 dage tilbage til 12 uger frem. `events.list` med `singleEvents=true` (gentagelser foldes ud), `orderBy=startTime` og `timeZone=Europe/Copenhagen`.
- Gemmes i `calendar/snapshot`:
  ```json
  { "fetchedAt": "…", "source": "google", "calendars": [{"id","name","included"}],
    "events": [{ "id", "calendarId", "title", "start", "end", "allDay",
                 "type": "default|outOfOffice|focusTime|workingLocation",
                 "busy": true, "response": "accepted|tentative|declined|needsAction|organizer",
                 "attendees": 4, "meetUrl", "htmlLink" }] }
  ```
- **Ikke gemt:** beskrivelse, deltagernes adresser, vedhæftninger. Det er minimalt af hensyn til privatliv, og M5 og kapaciteten har ikke brug for mere.
- `GET /api/calendar?from=&to=` returnerer udsnittet. Claudes nøgle må læse det (M6 og M9 skal bruge det).

### Kapacitet ud fra kalenderen

Ny ren funktion `meetingHours(events, weekStart)`:

1. Tag hændelser i ugen, der er `type=default`, ikke heldags, `busy` (ikke "ledig"), og som du ikke har afvist.
2. Klip dem til arbejdstiden (indstilling, standard 08–17, man–fre).
3. **Flet overlap**, så to møder på samme tid ikke tæller dobbelt.
4. Summér timerne.

- `outOfOffice` og heldagshændelser, du har markeret som fravær, giver `other` for ugen: dage × (arbejdsuge / 5).
- `focusTime` tæller **ikke** som møde. Det er tid til opgaver.
- `DATA.kapacitet.meetingsSource = "kalender" | "fast"`. Ved "kalender" bruger `capacity()` den beregnede værdi for den aktuelle uge, og feltet i indstillinger viser "7,5 t fra kalenderen".
- Modellen kan nu regne **pr. uge fremad** (`capacityForWeek(w)`). Det er fundamentet for M5's frie tid og M6's prognose.

### Møder knyttet til projekter (valgfrit, lille)

Projekter får et valgfrit felt `keywords` (fx `["africa tours 2.0", "AT2"]`). Et møde, hvis titel matcher, vises på projektets side under "Møder denne måned" og tæller i projektets bås i kapaciteten i stedet for i "Faste møder". Det kan vente, til du har brugt kalenderen et par uger.

## Sikkerhed og privatliv

- Kalender: kun læsning. HeyOtto OS kan aldrig oprette, ændre eller svare på invitationer.
- Google-tokenet krypteres i lageret. "Afbryd" tilbagekalder det hos Google.
- Deploy Previews har eget lager (som i dag) og dermed ingen forbindelse. Test kræver, at du forbinder på previewet med en testkalender.

## Plan (rækkefølge)

1. Fletning ved 409 (browser) + test med to faner.
2. OAuth-ruter, krypteret tokenlager og status i Indstillinger → Forbindelser.
3. `calendar-sync.mts` + `/api/calendar` + `/api/calendar/refresh`.
4. `meetingHours` + `capacityForWeek` + `meetingsSource` i indstillinger.
5. Opdatér `README.md` (datakontrakt: `keywords`, `meetingsSource`) og `heyotto-os-data`-skillen.

## Åbne spørgsmål til Kasper

1. Google alene, eller Google + Outlook (Africa Tours)? Hvilken Google-konto (privat, Hey Otto)?
2. Arbejdstid til mødeberegningen: 08–17 man–fre?
3. Skal private kalendere (familie osv.) tælle som optaget tid?

## Færdig når

- Indstillinger viser "Google Kalender forbundet". "Faste møder" regnes fra kalenderen og følger ugen. Synken kører hvert 15. minut og ved åbning.
- Gemmer du, mens en synk eller Claude har skrevet, flettes ændringerne i stedet for at give "data er ændret et andet sted".
