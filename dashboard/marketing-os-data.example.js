/* =============================================================================
   MARKETING OS — DATA (skabelon)

   Kopiér denne fil til marketing-os-data.js for at starte forfra:

       copy marketing-os-data.example.js marketing-os-data.js

   Den rigtige datafil ligger bevidst uden for git — den er indhold, ikke kode.
   Har du mistet den, findes historikken i OneDrives versionshistorik:
   højreklik filen i File Explorer → Versionshistorik.

   Format, der skal holdes:
     * ÉN OPGAVE = ÉN LINJE
     * status skal være præcis én af:
         "Ikke startet" | "I gang" | "Blokeret" | "Færdig" | "Droppet"
     * sprint / start / end er MÅNEDER  ("ÅÅÅÅ-MM")
     * due er en rigtig DATO ("ÅÅÅÅ-MM-DD") eller tom
   ============================================================================= */

var DATA = {

  meta: {
    updated: "2026-01-01",
    note: ""
  },

  /* ===== EPICS ===== valgfri gruppering; nøglen sættes i opgavens epic-felt ===== */
  epics: {
    E1:"Første arbejdsstrøm",
    E2:"Anden arbejdsstrøm"
  },

  /* ===== PROJEKTER ===== rækkefølgen her er rækkefølgen i sidebaren ===== */
  projects: [
    {id:"eksempel", name:"Eksempelprojekt", tagline:"Slet dette og opret dine egne"}
  ],

  /* ===== SPRINTS ===== én sprint = ét projekt + én kalendermåned ===== */
  sprints: [
    {project:"eksempel", month:"2026-01", goal:"Et sprintmål er én sætning om, hvad der skal være sandt, når måneden er slut"}
  ],

  /* ===== OPGAVER ===== ÉN OPGAVE = ÉN LINJE ===== */
  tasks: [
    {id:"eksempel-1", project:"eksempel", sprint:"2026-01", start:"2026-01", end:"2026-01", status:"I gang",       title:"En opgave i gang",     owner:"Kasper", due:"",           epic:"E1", note:"Klik på kortet for at redigere."},
    {id:"eksempel-2", project:"eksempel", sprint:"2026-01", start:"2026-01", end:"2026-03", status:"Ikke startet", title:"En opgave med deadline", owner:"",       due:"2026-03-15", epic:"E2", note:"Strækker sig over tre måneder på tidslinjen."}
  ]

};
