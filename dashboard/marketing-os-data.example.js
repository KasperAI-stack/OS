/* =============================================================================
   MARKETING OS — DATA (skabelon)

   Kopiér denne fil til marketing-os-data.js for at starte forfra:
       copy marketing-os-data.example.js marketing-os-data.js

   Derefter skrives filen af dashboardet, når du trykker Gem — og kan
   stadig redigeres i hånden eller af Claude Code. Formatet skal holdes:

     * ÉN OPGAVE = ÉN LINJE
     * status:  "Ikke startet" | "I gang" | "Blokeret" | "Færdig" | "Droppet"
     * sprint / start / end er MÅNEDER  ("ÅÅÅÅ-MM")
     * due er en DATO ("ÅÅÅÅ-MM-DD") eller tom
     * hours er timer pr. uge LIGE NU — ikke i alt. Trækker opgaven ikke
       tid i denne uge, er den 0, selv om den har en deadline i marts.
     * projekternes kind styrer kapacitetsregnskabet:
         "drift"  løbende arbejde   "projekt" tidsbegrænset   "adhoc" det uplanlagte

   Filen er bevidst uden for git — den er data, ikke kode.
   OneDrive holder versionshistorik på den.
   ============================================================================= */

var DATA = {

  meta: {
    updated: "2026-01-01",
    note: ""
  },

  /* ===== KAPACITET ===== timer pr. uge; loft i procent ===== */
  kapacitet: {
    contract:37, meetings:6, admin:5, other:2, ceiling:85, adhoc:6
  },

  /* ===== UGELOG ===== faktisk forbrug; to uger kalibrerer ad hoc-bufferen ===== */
  uger: [],

  /* ===== EPICS ===== valgfri gruppering; nøglen sættes i opgavens epic-felt ===== */
  epics: {
    E1:"Første arbejdsstrøm",
    E2:"Anden arbejdsstrøm"
  },

  /* ===== PROJEKTER ===== rækkefølgen her er rækkefølgen i sidebaren ===== */
  projects: [
    {id:"drift",    name:"Drift",           kind:"drift",   tagline:"Løbende arbejde, der kører hver uge"},
    {id:"adhoc",    name:"Ad hoc",          kind:"adhoc",   tagline:"Det uplanlagte"},
    {id:"eksempel", name:"Eksempelprojekt", kind:"projekt", tagline:"Slet dette og opret dine egne"}
  ],

  /* ===== SPRINTS ===== én sprint = ét projekt + én kalendermåned ===== */
  sprints: [
    {project:"eksempel", month:"2026-01", goal:"Et sprintmål er én sætning om, hvad der skal være sandt, når måneden er slut"}
  ],

  /* ===== OPGAVER ===== ÉN OPGAVE = ÉN LINJE ===== */
  tasks: [
    {id:"drift-1",    project:"drift",    sprint:"",        start:"2026-01", end:"2026-12", status:"I gang",       title:"En fast driftsopgave",   owner:"Kasper", due:"",           epic:"",   hours:3, note:"Timer pr. uge lige nu — tæller med i kapaciteten."},
    {id:"eksempel-1", project:"eksempel", sprint:"2026-01", start:"2026-01", end:"2026-03", status:"Ikke startet", title:"En opgave med deadline", owner:"",       due:"2026-03-15", epic:"E1", hours:0, note:"Trækker 0 timer nu, men fylder på tidslinjen."}
  ]

};
