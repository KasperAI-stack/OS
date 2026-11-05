/* HeyOtto OS — prognose og alarmer. Ingen AI: et regnestykke.

   Bruges både af appen (hentes med import() i dashboard/index.html) og af serveren
   (netlify/functions/alerts-sync.mts), så der kun findes én udgave af reglerne.

   Kapacitet pr. uge (de næste 12):
     (arbejdsuge − møder − fravær − mail & admin − øvrigt fravær) × loft − drift − ad hoc-buffer
   Møder og fravær kommer fra kalenderen, når den er forbundet, ellers fra de faste tal.
   Den aktuelle uge tæller kun de arbejdsdage, der er tilbage (i dag medregnet).

   Prognose: Earliest Deadline First. Åbne opgaver med "timer tilbage" (remaining)
   sorteres efter deadline (så prioritet) og fylder ugerne i den rækkefølge. EDF er den
   optimale rækkefølge til spørgsmålet "kan alle deadlines nås?" for én person: når EDF
   ikke kan, kan ingen rækkefølge.

   Alle datoer regnes i den lokale tidszone (browserens, eller TZ på serveren). */

export const PRIORITIES = ["høj", "normal", "lav"];
const PRIO_RANK = { "høj": 0, normal: 1, lav: 2 };
const DONE = /^(færdig|faerdig|droppet)$/i;
const HORIZON_WEEKS = 12;
const TIGHT_WORKDAYS = 2;

const num = (v, d) => { const x = parseFloat(v); return isFinite(x) ? x : (d || 0); };
export const isOpen = (t) => !DONE.test(String((t && t.status) || "").trim());
export const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/* ---------- Datoer ---------- */

export function localIso(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
export function dateOnly(s) { return new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))); }
export function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
export function weekStart(d) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  return t;
}
export function isoWeekNumber(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}
// Et klokkeslæt på en dag, regnet med uret, så sommertid ikke flytter det
export function atHour(day, h) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(h), Math.round((h % 1) * 60)).getTime();
}
const isWorkday = (d) => d.getDay() !== 0 && d.getDay() !== 6;

// Arbejdsdage fra a til b (a medregnet, b ikke). Negativ, hvis b ligger før a.
export function workdaysBetween(aIso, bIso) {
  if (bIso < aIso) return -workdaysBetween(bIso, aIso);
  let n = 0;
  for (let d = dateOnly(aIso); localIso(d) < bIso; d = addDays(d, 1)) if (isWorkday(d)) n++;
  return n;
}

const F_SHORT = new Intl.DateTimeFormat("da-DK", { weekday: "short", day: "numeric", month: "short" });
export const shortDate = (iso) => F_SHORT.format(dateOnly(iso));

/* ---------- Kalender ---------- */

export const ABSENCE_WORDS = /\b(ferie|fri|fridag|syg|sygdom|afspadsering|barsel|orlov|kursus)\b/i;
export function isAbsence(e) { return e.type === "outOfOffice" || (e.allDay && e.busy && ABSENCE_WORDS.test(e.title || "")); }
export function isMeeting(e) {
  return !e.allDay && e.busy && e.response !== "declined" && (e.type === "default" || e.type === "fromGmail");
}
export function evStart(e) { return e.allDay ? dateOnly(e.start).getTime() : Date.parse(e.start); }
export function evEnd(e) { return e.allDay ? dateOnly(e.end || e.start).getTime() : Date.parse(e.end); }

export function sumIntervals(list) {
  list = list.slice().sort((a, b) => a[0] - b[0]);
  let tot = 0, cs = null, ce = null;
  for (const iv of list) {
    if (cs === null || iv[0] > ce) { if (cs !== null) tot += ce - cs; cs = iv[0]; ce = iv[1]; }
    else if (iv[1] > ce) ce = iv[1];
  }
  if (cs !== null) tot += ce - cs;
  return tot / 3600000;
}

export function workHours(k) {
  const h0 = num(k && k.workStart, 8);
  return { h0, h1: Math.max(num(k && k.workEnd, 17), h0 + 0.5) };
}

export function calendarUsed(k, cal) {
  return !!(cal && cal.accounts && cal.accounts.length) && (k || {}).meetingsSource !== "fast";
}

// Møder, fravær og fri tid én dag inden for arbejdstiden. Weekenden har ingen arbejdstid.
export function dayStats(events, day, k) {
  const w = workHours(k);
  const workDay = isWorkday(day) ? w.h1 - w.h0 : 0;
  if (!workDay || !events) return { meetings: 0, absence: 0, workDay, free: workDay };
  const ds = atHour(day, w.h0), de = atHour(day, w.h1), A = [], M = [];
  for (const e of events) {
    const s = Math.max(evStart(e), ds), en = Math.min(evEnd(e), de);
    if (!(en > s)) continue;
    if (isAbsence(e)) A.push([s, en]);
    else if (isMeeting(e)) M.push([s, en]);
  }
  const a = sumIntervals(A);
  const m = sumIntervals(A.concat(M)) - a;      // et møde på en feriedag tæller ikke som møde
  return { meetings: m, absence: a, workDay, free: Math.max(0, workDay - m - a) };
}

/* ---------- Rutiner ----------
   En rutine er noget, der kommer igen: { id, name, every, weekday, monthday, hours, project, note, active, last }.
     every: "dag" (hverdage) | "uge" | "2uger" | "maaned"
     weekday: 1–5 (mandag–fredag) til uge og 2uger · monthday: 1–28 eller 0 (sidste dag) til maaned; weekend → fredagen før
   Hver forekomst bliver en task med deadline (task.routine = rutinens id). Rutinens tid
   tæller som fast tid pr. uge i kapaciteten (som drift), og selve tasken har 0 timer,
   så tiden ikke tælles to gange. */

export const EVERY = { dag: "Hver hverdag", uge: "Hver uge", "2uger": "Hver anden uge", maaned: "Hver måned" };
const PER_WEEK = { dag: 5, uge: 1, "2uger": 0.5, maaned: 12 / 52 };

export function routineWeeklyHours(data) {
  return (data.rutiner || []).filter((r) => r && r.active !== false)
    .reduce((s, r) => s + num(r.hours) * (PER_WEEK[r.every] || 0), 0);
}

// Forekomster (ÅÅÅÅ-MM-DD) fra og med fromIso til og med toIso
export function occurrences(r, fromIso, toIso) {
  const out = [];
  if (!r || !isDate(fromIso) || !isDate(toIso) || fromIso > toIso) return out;
  let d = dateOnly(fromIso);
  const end = dateOnly(toIso);
  for (let i = 0; d <= end && i < 400; i++, d = addDays(d, 1)) {
    const wd = d.getDay(), iso = localIso(d);
    if (wd === 0 || wd === 6) continue;
    if (r.every === "dag") out.push(iso);
    else if (r.every === "uge" && wd === (Number(r.weekday) || 5)) out.push(iso);
    else if (r.every === "2uger" && wd === (Number(r.weekday) || 5) && isoWeekNumber(d) % 2 === (Number(r.parity) || 0)) out.push(iso);
    else if (r.every === "maaned") {
      // Dag 1–28, eller 0 = sidste dag. Falder den i en weekend, er det fredagen før.
      const md = Number(r.monthday) || 0;
      let t = md > 0 ? new Date(d.getFullYear(), d.getMonth(), Math.min(md, 28)) : new Date(d.getFullYear(), d.getMonth() + 1, 0);
      while (t.getDay() === 0 || t.getDay() === 6) t = addDays(t, -1);
      if (localIso(t) === iso) out.push(iso);
    }
  }
  return out;
}

/* ---------- Kapacitet pr. uge ---------- */

function kindMap(data) {
  const m = {};
  for (const p of data.projects || []) m[p.id] = p.kind === "drift" || p.kind === "adhoc" ? p.kind : "projekt";
  return m;
}

export function adhocBuffer(data) {
  const weeks = data.uger || [];
  if (weeks.length >= 2) return weeks.reduce((s, w) => s + num(w.adhoc), 0) / weeks.length;
  return num((data.kapacitet || {}).adhoc);
}

// Timer til planlagt arbejde i ugen, der starter ws. Kun de arbejdsdage, der er tilbage.
export function weekCapacity(data, cal, ws, today) {
  const k = data.kapacitet || {};
  const todayIso = localIso(today);
  const days = [];
  for (let i = 0; i < 5; i++) { const d = addDays(ws, i); if (localIso(d) >= todayIso) days.push(d); }
  const frac = days.length / 5;
  const useCal = calendarUsed(k, cal);
  let meetings = 0, absence = 0;
  if (useCal) for (const d of days) { const s = dayStats(cal.events, d, k); meetings += s.meetings; absence += s.absence; }
  else meetings = num(k.meetings) * frac;
  const kinds = kindMap(data);
  const drift = (data.tasks || []).filter((t) => isOpen(t) && kinds[t.project] === "drift").reduce((s, t) => s + num(t.hours), 0) +
                routineWeeklyHours(data);
  const avail = num(k.contract) * frac - meetings - absence - (num(k.admin) + num(k.other)) * frac;
  const raw = Math.max(0, avail) * num(k.ceiling, 85) / 100 - (drift + adhocBuffer(data)) * frac;
  return { start: localIso(ws), days: days.map(localIso), frac, meetings, absence, raw, hours: Math.max(0, raw) };
}

/* ---------- Prognosen ---------- */

export function forecast(data, cal, today = new Date(), opts = {}) {
  const nWeeks = opts.weeks || HORIZON_WEEKS;
  const todayIso = localIso(today);
  const ws0 = weekStart(today);
  const weeks = [];
  for (let i = 0; i < nWeeks; i++) weeks.push({ ...weekCapacity(data, cal, addDays(ws0, 7 * i), today), used: 0 });
  const horizonEnd = localIso(addDays(ws0, 7 * nWeeks));

  const open = (data.tasks || []).filter(isOpen);
  const queue = open.filter((t) => num(t.remaining) > 0).sort((a, b) =>
    (isDate(a.due) ? a.due : "9999") < (isDate(b.due) ? b.due : "9999") ? -1
      : (isDate(a.due) ? a.due : "9999") > (isDate(b.due) ? b.due : "9999") ? 1
      : (PRIO_RANK[a.priority] ?? 1) - (PRIO_RANK[b.priority] ?? 1) || String(a.title).localeCompare(String(b.title)));

  const left = {}, alloc = {}, finish = {};
  for (const t of queue) { left[t.id] = num(t.remaining); alloc[t.id] = []; }
  let qi = 0;
  weeks.forEach((w, wi) => {
    let cap = w.hours;
    while (cap > 1e-9 && qi < queue.length) {
      const t = queue[qi], take = Math.min(cap, left[t.id]);
      alloc[t.id].push({ week: wi, start: w.used, hours: take });
      left[t.id] -= take; cap -= take; w.used += take;
      if (left[t.id] <= 1e-9) {
        // Færdigdato: det sted i ugens arbejdsdage, hvor timerne slap op
        const share = w.hours > 0 ? w.used / w.hours : 1;
        const idx = Math.min(w.days.length - 1, Math.max(0, Math.ceil(share * w.days.length) - 1));
        finish[t.id] = w.days[idx] || w.start;
        qi++;
      }
    }
  });

  const tasks = {};
  for (const t of open) {
    const due = isDate(t.due) ? t.due : "";
    const rem = num(t.remaining);
    let status = "ok", deficit = 0;
    const fin = finish[t.id] || "";
    if (due && due < todayIso) status = "over";
    else if (due && !(rem > 0)) status = t.routine ? "ok" : "mangler";   // en rutines tid ligger i rutinens timer pr. uge
    else if (rem > 0 && due) {
      if (!fin && due >= horizonEnd) {
        status = "ok";                                // deadline og færdig begge efter de 12 uger: ved det ikke endnu
      } else if (!fin || fin > due) {
        status = "risiko";
        deficit = Math.max(0, rem - doneBy(weeks, alloc[t.id] || [], due, ws0));
      } else if (workdaysBetween(fin, due) < TIGHT_WORKDAYS) status = "stramt";
    }
    tasks[t.id] = { status, finish: fin, deficit, due, remaining: rem };
  }
  return { today: todayIso, horizonEnd, weeks, tasks };
}

// Timer, opgaven når at få til og med deadline-dagen. I deadline-ugen fordeles ugens timer
// jævnt over de resterende arbejdsdage, og opgavens del ligger efter dem, der kom før den.
function doneBy(weeks, alloc, due, ws0) {
  const dueWeek = Math.floor((dateOnly(due) - ws0) / (7 * 86400000));
  let done = 0;
  for (const a of alloc) {
    if (a.week < dueWeek) { done += a.hours; continue; }
    if (a.week > dueWeek) continue;
    const w = weeks[a.week], n = w.days.length || 1;
    const upto = w.days.filter((d) => d <= due).length;
    const pos = upto / n * w.hours;
    done += Math.min(a.hours, Math.max(0, pos - a.start));
  }
  return done;
}

/* ---------- Alarmer ----------
   Én alarm pr. opgave (den alvorligste) plus uger og dage. level: 3 rød, 2 gul, 1 grå.
   key er stabil, så "Udsæt" og "allerede sendt" kan huskes. Den indeholder deadlinen,
   så en ny deadline giver en ny alarm. */

const LEVEL = { rod: 3, gul: 2, graa: 1 };
const q = (s) => "„" + String(s || "(uden titel)") + "“";
const h = (v) => (Math.round(v * 2) / 2).toString().replace(".", ",") + " t";

export function alerts(data, cal, today = new Date(), fc = forecast(data, cal, today)) {
  const out = [];
  // Danske datoer ender på punktum ("fre. 6. nov."), så sætninger må ikke få ét til
  const dot = (s) => s.split("..").join(".");
  const k = data.kapacitet || {};
  const todayIso = fc.today;
  const add = (level, kind, key, title, why, extra = {}) => out.push({ level: LEVEL[level], kind, key, title, why: dot(why), ...extra });

  for (const t of (data.tasks || []).filter(isOpen)) {
    const f = fc.tasks[t.id];
    if (!f) continue;
    const due = f.due, st = String(t.status || "").trim().toLowerCase();
    const wd = due ? workdaysBetween(todayIso, due) : null;
    const base = { taskId: t.id, due };
    const key = (kind) => kind + ":" + t.id + ":" + (due || "");
    if (f.status === "over") {
      // En glemt rutine er ikke en brand: gul, ikke rød
      add(t.routine ? "gul" : "rod", "over", key("over"), q(t.title) + " er over deadline", (t.routine ? "Rutinen skulle være gjort " : "Deadline var ") + shortDate(due) + ".", base);
    } else if (f.status === "risiko") {
      add("rod", "risiko", key("risiko"), q(t.title) + " når ikke deadline",
        (f.finish ? "Prognosen siger færdig ca. " + shortDate(f.finish) + ", deadline er " + shortDate(due) + "."
                  : "Der er ikke tid nok de næste 12 uger til deadline " + shortDate(due) + ".") +
        (f.deficit > 0 ? " Mangler ca. " + h(f.deficit) + "." : ""), base);
    } else if (due && !t.routine && st === "ikke startet" && wd !== null && wd <= 3) {
      add("rod", "ikke-startet", key("ikke-startet"), q(t.title) + " er ikke startet",
        "Deadline " + (wd <= 0 ? "i dag" : "om " + wd + " arbejdsdag" + (wd === 1 ? "" : "e")) + " (" + shortDate(due) + ").", base);
    } else if (due && st === "blokeret" && workdaysBetween(todayIso, due) <= 5) {
      add("rod", "blokeret", key("blokeret"), q(t.title) + " er blokeret", "Deadline " + shortDate(due) + ". Hvad skal der til for at komme videre?", base);
    } else if (f.status === "stramt") {
      add("gul", "stramt", key("stramt"), q(t.title) + " er stram",
        "Prognosen siger færdig ca. " + shortDate(f.finish) + ", deadline er " + shortDate(due) + ".", base);
    } else if (f.status === "mangler" && due && due <= fc.horizonEnd) {
      add("graa", "mangler", key("mangler"), q(t.title) + " mangler et estimat",
        "Sæt „timer tilbage“, så prognosen kan regne med den (deadline " + shortDate(due) + ").", base);
    }
    // Deadline på en dag næsten fuld af møder (kun med kalender, og kun de næste 14 dage)
    if (due && calendarUsed(k, cal) && due >= todayIso && workdaysBetween(todayIso, due) <= 10 && f.status !== "over") {
      const s = dayStats(cal.events, dateOnly(due), k);
      if (s.workDay && s.free < 2) {
        add("gul", "moedetung", "moedetung:" + t.id + ":" + due, "Mødetung deadline-dag",
          q(t.title) + " har deadline " + shortDate(due) + ", hvor der kun er " + h(s.free) + " fri.", base);
      }
    }
  }

  // Uger, hvor møder og fast arbejde alene fylder mere end loftet (de næste 4)
  fc.weeks.slice(0, 4).forEach((w) => {
    if (w.raw < -0.5 && w.days.length) {
      const n = isoWeekNumber(dateOnly(w.start));
      add("gul", "uge", "uge:" + w.start, "Uge " + n + " er overbooket",
        "Møder, drift og ad hoc-buffer fylder ca. " + h(-w.raw) + " mere end loftet" + (w.days.length < 5 ? " i resten af ugen" : "") + ".",
        { week: w.start });
    }
  });

  return out.sort((a, b) => b.level - a.level || String(a.due || "9").localeCompare(String(b.due || "9")));
}

// Fjerner udsatte alarmer. snoozed: { key: "ÅÅÅÅ-MM-DD" } (vises igen fra og med den dag)
export function activeAlerts(list, snoozed, todayIso) {
  snoozed = snoozed || {};
  return list.filter((a) => !(snoozed[a.key] && snoozed[a.key] > todayIso));
}
