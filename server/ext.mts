/* HeyOtto Tasks — det offentlige API på /ext (M11). Til Studio, n8n og andre værktøjer.

   Hvert kald skal have "Authorization: Bearer tsk_…" (Indstillinger → API-tokens).
   Vagten (guard) gør i denne rækkefølge, som i HeyOtto Studio:
     1. token → 401 uden, med forkert eller med tilbagekaldt token
     2. 60 kald i minuttet pr. token → 429 (Cloudflares Rate Limiting, ikke en tæller i hukommelsen)
     3. body højst 256 KB → 413, og skal være JSON → 400
     4. én logline pr. kald med tokenets NAVN, aldrig selve tokenet
   Forkert scope → 403. Fejl er JSON { error } på dansk.

   Ændringer gemmes som appens egne (saveData: læs, ret, gem med versionstjek) og står i
   Historik med tokenets navn, så de kan fortrydes. Der er ingen sletning her: det sker kun i appen.
   Fuld beskrivelse: dashboard/README.md under "API'et /ext". */

import { Hono, type Context, type MiddlewareHandler } from "hono";
import { HttpError, readData, saveData } from "./api.mts";
import { readSnapshot } from "./google.mts";
import { readSettings } from "./agent/store.mts";
import { localIso } from "../dashboard/lib/forecast.mjs";
import { wall } from "./zone.mts";
import { scrub, verifyToken, type ApiToken, type Scope } from "./tokens.mts";
import type { Platform } from "./platform.mts";

export const MAX_BODY = 256 * 1024;
export const STATUSES = ["Ikke startet", "I gang", "Blokeret", "Færdig", "Droppet"];
const PRIORITIES = ["høj", "normal", "lav"];
const MAX_COMMENT = 4000;
const MAX_COMMENTS = 100;

type E = { Bindings: { p: Platform }; Variables: { token: ApiToken; body: any } };

const err = (c: Context<E>, status: number, error: string) => c.json({ error }, status as any);

/* ---------- Vagten: deles af /ext og (fra M14) /mcp ---------- */

export const guard: MiddlewareHandler<E> = async (c, next) => {
  const t0 = Date.now();
  let name = "-";
  const stop = await (async (): Promise<Response | null> => {
    const m = (c.req.header("authorization") || "").match(/^Bearer\s+(\S+)$/i);
    if (!m) return err(c, 401, "Mangler token. Send Authorization: Bearer <token>.");
    const token = await verifyToken(c.env.p.store, m[1]);
    if (!token) return err(c, 401, "Ukendt eller tilbagekaldt token.");
    name = token.name;
    c.set("token", token);
    if (c.env.p.rateLimit && !(await c.env.p.rateLimit(token.id))) {
      return err(c, 429, "For mange kald. Højst 60 i minuttet pr. token.");
    }
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      const text = await c.req.text();
      if (new TextEncoder().encode(text).length > MAX_BODY) return err(c, 413, "For meget data i ét kald (højst 256 KB).");
      try { c.set("body", text ? JSON.parse(text) : {}); } catch { return err(c, 400, "Forventede JSON."); }
    }
    return null;
  })();
  if (!stop) await next();
  const status = stop ? stop.status : c.res.status;
  console.log(`ext ${name} ${c.req.method} ${scrub(new URL(c.req.url).pathname)} ${status} ${Date.now() - t0}ms`);
  return stop || undefined;
};

const need = (c: Context<E>, scope: Scope) => {
  if (!c.get("token").scopes.includes(scope)) throw new HttpError(403, `Tokenet har ikke rettigheden „${scope}“.`);
};

/* ---------- Hvordan en task ser ud udefra ---------- */

function projectName(data: any, id: string) {
  const p = data.projects.find((x: any) => x?.id === id);
  return !p ? id : p.kind === "adhoc" ? "Uden projekt" : String(p.name || id);
}

function publicTask(data: any, t: any) {
  return {
    id: t.id, title: t.title || "", project: t.project, projectName: projectName(data, t.project),
    status: t.status || "Ikke startet", due: t.due || "", owner: t.owner || "", note: t.note || "",
    hours: Number(t.hours) || 0, remaining: t.remaining ?? null, priority: t.priority || "normal",
    sprint: t.sprint || "", routine: t.routine || "", comments: Array.isArray(t.comments) ? t.comments : []
  };
}

const isOpen = (t: any) => !/^(færdig|droppet)$/i.test(String(t?.status || "").trim());
const isDay = (v: unknown) => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v);
const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

function findTask(data: any, id: string) {
  const t = data.tasks.find((x: any) => x?.id === id);
  if (!t) throw new HttpError(404, "Ukendt task: " + id);
  return t;
}

// Feltregler for oprettelse og ændring. Ukendte felter afvises, så fejl ikke forsvinder i stilhed.
const FIELDS = ["title", "project", "status", "due", "owner", "note", "hours", "remaining", "priority", "sprint"];

function applyFields(data: any, t: any, body: any, creating: boolean) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Forventede et JSON-objekt.");
  const unknown = Object.keys(body).filter((k) => !FIELDS.includes(k));
  if (unknown.length) throw new HttpError(400, "Ukendte felter: " + unknown.join(", ") + ". Tilladt: " + FIELDS.join(", ") + ".");
  if (!creating && "project" in body) throw new HttpError(400, "Projektet kan kun ændres i appen.");

  if ("title" in body) {
    const v = str(body.title, 120);
    if (!v) throw new HttpError(400, "title må ikke være tom.");
    t.title = v;
  }
  if ("status" in body) {
    if (!STATUSES.includes(body.status)) throw new HttpError(400, "status skal være en af: " + STATUSES.join(", ") + ".");
    t.status = body.status;
  }
  if ("due" in body) {
    if (body.due !== "" && body.due !== null && !isDay(body.due)) throw new HttpError(400, "due skal være ÅÅÅÅ-MM-DD eller tom.");
    t.due = body.due || "";
  }
  if ("owner" in body) t.owner = str(body.owner, 40);
  if ("note" in body) t.note = str(body.note, 2000);
  if ("hours" in body) {
    const h = Number(body.hours);
    if (!Number.isFinite(h) || h < 0 || h > 40) throw new HttpError(400, "hours skal være et tal mellem 0 og 40.");
    t.hours = h;
  }
  if ("remaining" in body) {
    if (body.remaining === null || body.remaining === "") delete t.remaining;
    else {
      const r = Number(body.remaining);
      if (!Number.isFinite(r) || r < 0 || r > 2000) throw new HttpError(400, "remaining skal være et tal mellem 0 og 2000 eller null.");
      t.remaining = r;
    }
  }
  if ("priority" in body) {
    if (!PRIORITIES.includes(body.priority)) throw new HttpError(400, "priority skal være høj, normal eller lav.");
    if (body.priority === "normal") delete t.priority; else t.priority = body.priority;
  }
  if ("sprint" in body) {
    const s = body.sprint || "";
    if (s && !data.sprints.some((x: any) => x.project === t.project && x.month === s)) {
      throw new HttpError(400, `Projektet har ingen sprint i ${s}.`);
    }
    t.sprint = s;
  }
}

function slugId(project: string, title: string, taken: Set<string>) {
  const base = (project.slice(0, 5) + "-" + title).toLowerCase()
    .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
    .normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "task";
  let id = base, n = 2;
  while (taken.has(id)) id = base + "-" + n++;
  return id;
}

/* ---------- Ruterne ---------- */

export const ext = new Hono<E>().basePath("/ext");

ext.use("*", guard);

ext.get("/health", (c) => c.json({ ok: true, token: c.get("token").name, scopes: c.get("token").scopes }));

ext.get("/tasks", async (c) => {
  need(c, "read");
  const data = await readData(c.env.p.store);
  const status = c.req.query("status"), project = c.req.query("project"), before = c.req.query("due_before");
  const all = c.req.query("include_done") === "true";
  if (status && !STATUSES.includes(status)) throw new HttpError(400, "status skal være en af: " + STATUSES.join(", ") + ".");
  if (before && !isDay(before)) throw new HttpError(400, "due_before skal være ÅÅÅÅ-MM-DD.");
  const tasks = data.tasks
    .filter((t: any) => (status ? t.status === status : all || isOpen(t)))
    .filter((t: any) => !project || t.project === project)
    .filter((t: any) => !before || (t.due && t.due < before))
    .map((t: any) => publicTask(data, t));
  return c.json({ tasks });
});

ext.get("/tasks/:id", async (c) => {
  need(c, "read");
  const data = await readData(c.env.p.store);
  return c.json({ task: publicTask(data, findTask(data, c.req.param("id"))) });
});

ext.post("/tasks", async (c) => {
  need(c, "write");
  const body = c.get("body");
  const tz = (await readSettings(c.env.p.store as any)).tz;
  const month = localIso(wall(new Date(), tz)).slice(0, 7);
  const { result } = await saveData(c.env.p.store, c.get("token").name, (data) => {
    const loose = data.projects.find((p: any) => p?.kind === "adhoc");
    const project = body?.project ?? loose?.id;
    if (typeof project !== "string" || !data.projects.some((p: any) => p?.id === project)) {
      throw new HttpError(400, "Ukendt projekt. Se GET /ext/projects, eller udelad project for „Uden projekt“.");
    }
    const t: any = { id: "", project, status: "Ikke startet", title: "", owner: "", due: "", note: "", hours: 0, sprint: "", start: month, end: month };
    applyFields(data, t, { ...body, project: undefined }, true);
    if (!t.title) throw new HttpError(400, "title mangler.");
    t.id = slugId(project, t.title, new Set(data.tasks.map((x: any) => x.id)));
    data.tasks.push(t);
    return publicTask(data, t);
  });
  return c.json({ task: result }, 201);
});

ext.patch("/tasks/:id", async (c) => {
  need(c, "write");
  const { result } = await saveData(c.env.p.store, c.get("token").name, (data) => {
    const t = findTask(data, c.req.param("id"));
    applyFields(data, t, c.get("body"), false);
    return publicTask(data, t);
  });
  return c.json({ task: result });
});

ext.post("/tasks/:id/comments", async (c) => {
  need(c, "write");
  const text = str(c.get("body")?.text, MAX_COMMENT);
  if (!text) throw new HttpError(400, "text mangler.");
  const by = c.get("token").name;
  const { result } = await saveData(c.env.p.store, by, (data) => {
    const t = findTask(data, c.req.param("id"));
    const comment = { at: new Date().toISOString(), by, text };
    t.comments = [...(Array.isArray(t.comments) ? t.comments : []), comment].slice(-MAX_COMMENTS);
    return comment;
  });
  return c.json({ comment: result }, 201);
});

ext.get("/projects", async (c) => {
  need(c, "read");
  const data = await readData(c.env.p.store);
  return c.json({
    projects: data.projects.map((p: any) => {
      const tasks = data.tasks.filter((t: any) => t.project === p.id);
      return {
        id: p.id, name: projectName(data, p.id), kind: p.kind || "projekt", tagline: p.tagline || "",
        openTasks: tasks.filter(isOpen).length, doneTasks: tasks.length - tasks.filter(isOpen).length
      };
    })
  });
});

ext.get("/routines", async (c) => {
  need(c, "read");
  const data = await readData(c.env.p.store);
  return c.json({
    routines: (Array.isArray(data.rutiner) ? data.rutiner : []).map((r: any) => ({
      id: r.id, name: r.name, every: r.every, weekday: r.weekday ?? null, monthday: r.monthday ?? null,
      hours: Number(r.hours) || 0, project: r.project || "", active: r.active !== false, last: r.last || ""
    }))
  });
});

// Sprints: et mål for ét projekt i én måned. En task kan kun ligge i en sprint, der findes.
const isMonth = (v: unknown) => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

ext.get("/sprints", async (c) => {
  need(c, "read");
  const data = await readData(c.env.p.store);
  const project = c.req.query("project");
  return c.json({
    sprints: data.sprints.filter((s: any) => !project || s.project === project)
      .map((s: any) => ({ project: s.project, month: s.month, goal: s.goal || "" }))
  });
});

ext.post("/sprints", async (c) => {
  need(c, "write");
  const body = c.get("body");
  const { result } = await saveData(c.env.p.store, c.get("token").name, (data) => {
    if (!data.projects.some((p: any) => p?.id === body?.project)) throw new HttpError(400, "Ukendt projekt. Se GET /ext/projects.");
    if (!isMonth(body?.month)) throw new HttpError(400, "month skal være ÅÅÅÅ-MM.");
    if (data.sprints.some((s: any) => s.project === body.project && s.month === body.month)) {
      throw new HttpError(409, `Projektet har allerede en sprint i ${body.month}.`);
    }
    const s = { project: body.project, month: body.month, goal: str(body.goal, 400) };
    data.sprints.push(s);
    return s;
  });
  return c.json({ sprint: result }, 201);
});

// Kalenderen (kun læsning): møder fra de forbundne Google-konti. null = intet forbundet.
ext.get("/calendar", async (c) => {
  need(c, "read");
  return c.json({ snapshot: await readSnapshot(c.env.p.store) });
});

ext.notFound((c) => err(c, 404, "Ukendt adresse: " + c.req.method + " " + scrub(new URL(c.req.url).pathname)));

ext.onError((e, c) => {
  if (e instanceof HttpError) return err(c, e.status, e.message);
  console.error("ext fejlede:", e);
  return err(c, 500, "Serverfejl.");
});
