# M2: Slet "Hvorfor loftet ikke er 100 %"

## Analyse

Kortet bygges af `capCurve(m)` i `dashboard/index.html` (l. 1991–2032) og kaldes i `renderCapacity()` (l. 2143: `capCurve(m) + capTasks(m) + capWeeks(m)`). Det har ingen data og ingen API-del. Det er ren visning.

Tilknyttet kortet:

- CSS: `.curve-wrap` (l. 528–531)
- Kommentaren øverst i kapacitetssektionen (l. 1854–1856) nævner Kingman som begrundelse
- README: afsnittet "Planlægningsloftet er ikke 100 %, og Kingman-kurven på forsiden viser hvorfor …"
- **Verdict-rækken øverst har cellen "Kø-faktor (Kingman)"** (l. 2137–2139) med `m.queue` og teksten `qnote`. Den hører logisk til kurven

## Beslutning: hvad med Kø-faktor-cellen?

Du bad om at slette kortet. Cellen er ikke en del af kortet, men uden kurven forklarer intet, hvad "×3,2" betyder.

**Anbefaling:** fjern også cellen, og brug pladsen i verdict-rækken til noget, der bliver relevant med M4/M6:

- før M4: **"Næste deadline"**, altså den nærmeste åbne `due` med titel og antal dage
- efter M4: **"Møder denne uge"** i timer, hentet fra kalenderen

Selve planlægningsloftet (slideren 60–100 %) bliver. Det flytter til indstillinger i M3.

## Plan

1. Slet `capCurve` og kaldet i `renderCapacity`.
2. Slet `.curve-wrap`-CSS.
3. Hvis cellen også skal væk: fjern Kø-faktor-cellen og `qnote`. Fjern `queue` fra `capacity()`'s returobjekt, når intet andet bruger det (det gør det ikke i dag). Indsæt "Næste deadline".
4. Ret kommentaren i l. 1850–1856 og README-afsnittet. Loftet forklares stadig med én sætning i indstillingerne (M3): "Andelen af din tid, der må bookes fast …".
5. Tjek mobilbredde: `.verdict` har tre kolonner (`1.4fr 1fr 1fr`). Med tre celler som før er layoutet uændret.

## Færdig når

Forsiden viser verdict, belastning, aktive opgaver og ugelog, og intet nævner Kingman.
