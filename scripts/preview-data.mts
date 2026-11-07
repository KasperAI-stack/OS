/* Opdigtede demo-data til forhåndsvisningen (scripts/preview.mts). Ingen rigtige personer,
   kunder eller tal. Datoerne regnes fra i dag, så visningerne altid har en aktuel sprint,
   deadlines denne uge og én overskredet opgave. */

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const month = (d: Date) => d.getFullYear() + "-" + pad(d.getMonth() + 1);
const days = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const months = (n: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return d; };

export function demoData({ over = false } = {}) {
  const now = month(new Date()), prev = month(months(-1)), next = month(months(1)), next2 = month(months(2));
  const t = (id: string, project: string, title: string, o: Record<string, unknown> = {}) =>
    ({ id, project, title, status: "Ikke startet", sprint: "", start: now, end: "", due: "", owner: "", epic: "", hours: 0, note: "", ...o });

  return {
    meta: { updated: iso(new Date()), note: "Demo-data til forhåndsvisning" },
    kapacitet: { contract: 37, meetings: 6, admin: 4, other: 2, ceiling: 85, adhoc: over ? 6 : 3 },
    uger: [],
    epics: { E1: "Lancering", E2: "Indhold" },
    projects: [
      { id: "drift", name: "Drift", kind: "drift", tagline: "Løbende arbejde, der kører hver uge" },
      { id: "adhoc", name: "Ad hoc", kind: "adhoc", tagline: "Det uplanlagte" },
      { id: "nyt-website", name: "Nyt website", kind: "projekt", tagline: "Ny forside og bookingflow før sæsonstart" },
      { id: "vinterkampagne", name: "Vinterkampagne", kind: "projekt", tagline: "Annoncer og mails til vintersæsonen" },
      { id: "nyhedsbrev", name: "Nyhedsbrev", kind: "projekt", tagline: "Månedligt brev til eksisterende kunder" }
    ],
    sprints: [
      { project: "nyt-website", month: prev, goal: "Wireframes godkendt" },
      { project: "nyt-website", month: now, goal: "Forsiden er live på staging, og bookingflowet kan testes" },
      { project: "nyt-website", month: next, goal: "" },
      { project: "vinterkampagne", month: now, goal: "Tre annoncevarianter kører med eget budget" },
      { project: "nyhedsbrev", month: now, goal: "" }
    ],
    tasks: [
      t("w1", "nyt-website", "Forside: hero og tekst", { sprint: now, status: "I gang", hours: over ? 8 : 5, due: iso(days(3)), epic: "E1", owner: "Kasper", remaining: 6 }),
      t("w2", "nyt-website", "Bookingflow: trin 2 og 3", { sprint: now, status: "Ikke startet", hours: over ? 6 : 3, due: iso(days(12)), epic: "E1", start: now, end: next }),
      t("w3", "nyt-website", "Billeder fra fotograf", { sprint: now, status: "Blokeret", due: iso(days(-2)), note: "Venter på aftale om rettigheder", epic: "E2" }),
      t("w4", "nyt-website", "Opsæt staging", { sprint: now, status: "Færdig", epic: "E1" }),
      t("w5", "nyt-website", "Wireframes", { sprint: prev, start: prev, status: "Færdig" }),
      t("w6", "nyt-website", "SEO-gennemgang", { sprint: next, start: next, end: next2, hours: 0 }),
      t("k1", "vinterkampagne", "Annoncetekster, tre varianter", { sprint: now, status: "I gang", hours: 3, due: iso(days(1)), priority: "høj" }),
      t("k2", "vinterkampagne", "Målgrupper og budget", { sprint: now, status: "Ikke startet", hours: 2, due: iso(days(5)) }),
      t("k3", "vinterkampagne", "Rapport efter første uge", { sprint: now, status: "Ikke startet", due: iso(days(16)) }),
      t("n1", "nyhedsbrev", "Skriv udkast", { sprint: now, status: "Ikke startet", hours: 1.5, due: iso(days(8)) }),
      t("a1", "adhoc", "Svar revisor om bilag", { due: iso(days(0)), hours: 0.5 }),
      t("a2", "adhoc", "Ny pris fra trykkeri", { status: "Ikke startet" }),
      t("d1", "drift", "Ugentlig rapport", { status: "I gang", hours: 2 })
    ],
    rutiner: [
      { id: "ugerapport", name: "Ugerapport til ledelsen", every: "uge", weekday: 5, hours: 1, active: true, project: "", owner: "", note: "", last: "" },
      { id: "indbakke", name: "Tøm indbakken", every: "dag", hours: 0.5, active: true, project: "", owner: "", note: "", last: "" },
      { id: "regnskab", name: "Bilag til regnskab", every: "maaned", monthday: 0, hours: 1, active: false, project: "", owner: "", note: "", last: "" }
    ]
  };
}
