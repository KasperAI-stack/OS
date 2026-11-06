/* HeyOtto Tasks — regn i brugerens tidszone, uanset hvor serveren kører.

   Prognosen (dashboard/lib/forecast.mjs) er skrevet til browseren og bruger lokale
   dato-funktioner (getDay, getHours, new Date(år, måned, dag)). Serveren kører i UTC,
   og på Cloudflare Workers kan tidszonen ikke ændres (process.env.TZ virker ikke).

   Løsningen: lav datoer, hvis LOKALE felter er vægurets tid i brugerens tidszone.
   Det gælder både "nu" og mødernes tidspunkter, så de passer sammen. Resultatet er
   det samme, som appen regner i browseren, og koden virker i enhver servertidszone. */

const formats = new Map<string, Intl.DateTimeFormat>();

function format(tz: string) {
  let f = formats.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric"
    });
    formats.set(tz, f);
  }
  return f;
}

export function validZone(tz: unknown, fallback = "Europe/Copenhagen") {
  if (typeof tz !== "string" || !tz) return fallback;
  try { format(tz); return tz; } catch { return fallback; }
}

// Øjeblik → Date, hvis lokale felter (getFullYear … getSeconds) er vægurets tid i tz.
export function wall(at: Date | string | number, tz: string): Date {
  const d = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(d.getTime())) return d;
  const p: Record<string, number> = {};
  for (const part of format(tz).formatToParts(d)) if (part.type !== "literal") p[part.type] = Number(part.value);
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, d.getMilliseconds());
}

// Kalender-snapshot med mødernes tidspunkter flyttet til vægur-tid. Heldagshændelser
// er allerede datoer og røres ikke. Bruges kun til regning, aldrig gemt eller vist.
export function zonedSnapshot<T extends { events?: any[] } | null>(snap: T, tz: string): T {
  if (!snap || !Array.isArray(snap.events)) return snap;
  const move = (v: unknown) => (typeof v === "string" && v ? wall(v, tz).toISOString() : v);
  return {
    ...snap,
    events: snap.events.map((e) => (e && !e.allDay ? { ...e, start: move(e.start), end: move(e.end) } : e))
  };
}
