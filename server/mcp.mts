/* HeyOtto Tasks — MCP-endpointet på /mcp (M14). Til Studios agenter, Claude og Cursor.

   Streamable HTTP, stateless: hvert kald er én JSON-RPC-besked i en POST, og svaret er JSON
   (ingen sessioner, ingen SSE). Det passer til Workers, hvor intet ligger i hukommelsen mellem kald.
   GET og DELETE svarer 405, som specifikationen tillader for en server uden SSE-strøm.

   Skrevet uden @modelcontextprotocol/sdk: SDK'ens skemavalidering (ajv) genererer kode med
   new Function, hvilket Workers ikke tillader. Vi bruger kun værktøjsdelen af protokollen
   (initialize, ping, tools/list, tools/call), og felterne valideres af de samme funktioner som /ext.

   Samme vagt som /ext (token, 60/min, 256 KB, logline med tokenets navn). Tokenet kan også stå
   i stien, /mcp/tsk_…, for klienter uden headers. tools/list viser kun værktøjer, tokenets scopes
   tillader, og et værktøj uden for scope behandles som ukendt.

   Navnene er en kontrakt med HeyOtto Studio, som klassificerer værktøjerne på navn
   (read/write/never). Omdøb eller fjern ikke et værktøj uden at sige det til Kasper. */

import { Hono } from "hono";
import { HttpError } from "./api.mts";
import {
  addComment, createTask, getForecast, getTask, guard, hasScope, listProjects, listRoutines, listTasks,
  PRIORITIES, STATUSES, updateTask, type E
} from "./ext.mts";
import type { Scope } from "./tokens.mts";
import type { Platform } from "./platform.mts";

export const SERVER_INFO = { name: "heyotto-tasks", title: "HeyOtto Tasks", version: "1.0.0" };
export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCTIONS =
  "HeyOtto Tasks er Kaspers opgaver, projekter og kapacitet. Læs med list_tasks, get_task, list_projects, " +
  "list_routines og get_forecast. Opret og ret med create_task, update_task og add_comment. Sletning sker kun i appen. " +
  "status er en af: " + STATUSES.join(", ") + ". due er ÅÅÅÅ-MM-DD. hours er timer pr. uge lige nu, " +
  "remaining er timer tilbage i alt (gæt den aldrig).";

type Ctx = { store: Platform["store"]; by: string };
type Tool = {
  name: string; title: string; description: string; scope: Scope;
  inputSchema: Record<string, unknown>;
  annotations: Record<string, boolean | string>;
  run: (args: any, ctx: Ctx) => Promise<unknown>;
};

const obj = (properties: Record<string, unknown> = {}, required: string[] = []) =>
  ({ type: "object", properties, ...(required.length ? { required } : {}), additionalProperties: false });

const FIELD_SCHEMA = {
  title: { type: "string", maxLength: 120, description: "Kort titel" },
  status: { type: "string", enum: STATUSES },
  due: { type: "string", description: "Deadline ÅÅÅÅ-MM-DD, eller tom for ingen" },
  owner: { type: "string", maxLength: 40 },
  note: { type: "string", maxLength: 2000 },
  hours: { type: "number", minimum: 0, maximum: 40, description: "Timer pr. uge lige nu (ikke i alt)" },
  remaining: { type: ["number", "null"], minimum: 0, maximum: 2000, description: "Timer tilbage i alt. Udelad, hvis ukendt" },
  priority: { type: "string", enum: PRIORITIES },
  sprint: { type: "string", description: "Måned ÅÅÅÅ-MM; projektet skal have en sprint den måned" }
};

const read = { readOnlyHint: true, openWorldHint: false };
const write = (idempotent: boolean) => ({ readOnlyHint: false, destructiveHint: false, idempotentHint: idempotent, openWorldHint: false });
const id = { type: "string", description: "Taskens id, fx web-12" };

export const TOOLS: Tool[] = [
  {
    name: "list_tasks", title: "List tasks", scope: "read", annotations: { title: "List tasks", ...read },
    description: "Åbne tasks (også fra rutiner) med projekt, status og deadline. Filtre: status, project, due_before (ÅÅÅÅ-MM-DD), include_done.",
    inputSchema: obj({
      status: { type: "string", enum: STATUSES }, project: { type: "string", description: "Projektets id (se list_projects)" },
      due_before: { type: "string", description: "Kun tasks med deadline før denne dag, ÅÅÅÅ-MM-DD" },
      include_done: { type: "boolean", description: "Medtag færdige og droppede" }
    }),
    run: async (a, { store }) => ({ tasks: await listTasks(store, a) })
  },
  {
    name: "get_task", title: "Hent task", scope: "read", annotations: { title: "Hent task", ...read },
    description: "Én task med noter og kommentarer.",
    inputSchema: obj({ id }, ["id"]),
    run: async (a, { store }) => ({ task: await getTask(store, a.id) })
  },
  {
    name: "list_projects", title: "List projekter", scope: "read", annotations: { title: "List projekter", ...read },
    description: "Projekter med antal åbne og færdige tasks. \"Uden projekt\" (kind adhoc) er til løse opgaver.",
    inputSchema: obj(),
    run: async (_a, { store }) => ({ projects: await listProjects(store) })
  },
  {
    name: "list_routines", title: "List rutiner", scope: "read", annotations: { title: "List rutiner", ...read },
    description: "Rutiner (tilbagevendende opgaver) med hyppighed og timer. Kan kun ændres i appen.",
    inputSchema: obj(),
    run: async (_a, { store }) => ({ routines: await listRoutines(store) })
  },
  {
    name: "get_forecast", title: "Prognose", scope: "read", annotations: { title: "Prognose", ...read },
    description: "Prognosen: alarmer, tasks i risiko for at misse deadline (status risiko, stramt, over eller mangler timer) og kapaciteten de næste 12 uger.",
    inputSchema: obj(),
    run: async (_a, { store }) => getForecast(store)
  },
  {
    name: "create_task", title: "Opret task", scope: "write", annotations: { title: "Opret task", ...write(false) },
    description: "Opret en ny task. Kun title er krævet. Uden project havner den under \"Uden projekt\". Står i Historik med tokenets navn.",
    inputSchema: obj({ ...FIELD_SCHEMA, project: { type: "string", description: "Projektets id (se list_projects)" } }, ["title"]),
    run: async (a, { store, by }) => ({ task: await createTask(store, by, a) })
  },
  {
    name: "update_task", title: "Ret task", scope: "write", annotations: { title: "Ret task", ...write(true) },
    description: "Ret felter på en task: send kun dem, der skal ændres. Projektet kan kun ændres i appen.",
    inputSchema: obj({ id, ...FIELD_SCHEMA }, ["id"]),
    run: async ({ id, ...fields }, { store, by }) => ({ task: await updateTask(store, by, id, fields) })
  },
  {
    name: "add_comment", title: "Kommentér task", scope: "write", annotations: { title: "Kommentér task", ...write(false) },
    description: "Skriv en kommentar på en task (højst 4.000 tegn). Vises på opgaven i appen med tokenets navn.",
    inputSchema: obj({ id, text: { type: "string", maxLength: 4000 } }, ["id", "text"]),
    run: async (a, { store, by }) => ({ comment: await addComment(store, by, a.id, a.text) })
  }
];

/* ---------- JSON-RPC ---------- */

type Msg = { jsonrpc?: string; id?: string | number | null; method?: string; params?: any; result?: unknown; error?: unknown };

const ok = (id: Msg["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const fail = (id: Msg["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

const text = (value: unknown, isError = false) => ({
  content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }],
  ...(isError ? { isError: true } : { structuredContent: value })
});

export async function rpc(msg: Msg, scopes: Scope[], ctx: Ctx) {
  const tools = TOOLS.filter((t) => scopes.includes(t.scope));
  switch (msg.method) {
    case "initialize": {
      const asked = msg.params?.protocolVersion;
      return ok(msg.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[1],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS
      });
    }
    case "ping":
      return ok(msg.id, {});
    case "tools/list":
      return ok(msg.id, {
        tools: tools.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations }))
      });
    case "tools/call": {
      const name = msg.params?.name;
      const tool = tools.find((t) => t.name === name);
      if (!tool) {
        const exists = TOOLS.some((t) => t.name === name);
        return fail(msg.id, -32602, exists ? `Tokenet har ikke adgang til værktøjet „${name}“.` : `Ukendt værktøj: ${String(name)}.`);
      }
      const args = msg.params?.arguments ?? {};
      if (!args || typeof args !== "object" || Array.isArray(args)) return ok(msg.id, text("arguments skal være et objekt.", true));
      try {
        return ok(msg.id, text(await tool.run(args, ctx)));
      } catch (e) {
        if (e instanceof HttpError) return ok(msg.id, text(e.message, true));
        console.error("mcp-værktøj fejlede:", name, e);
        return ok(msg.id, text("Serverfejl i " + name + ".", true));
      }
    }
    default:
      return fail(msg.id, -32601, "Ukendt metode: " + String(msg.method));
  }
}

/* ---------- Ruten ---------- */

export const mcp = new Hono<E>().basePath("/mcp");

mcp.use("*", guard);

const handler = async (c: any) => {
  const msg = c.get("body") as Msg;
  if (Array.isArray(msg)) return c.json(fail(null, -32600, "Batches understøttes ikke. Send én besked pr. kald."), 400);
  if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0") return c.json(fail(null, -32600, "Forventede en JSON-RPC 2.0-besked."), 400);
  // Notifikationer (fx notifications/initialized) og svar har intet id: kvittér uden indhold.
  if (msg.id === undefined || msg.id === null || !msg.method) return c.body(null, 202);
  const token = c.get("token");
  return c.json(await rpc(msg, token.scopes, { store: c.env.p.store, by: token.name }));
};

const notAllowed = (c: any) => c.json({ error: "Brug POST. Serveren har ingen SSE-strøm." }, 405, { Allow: "POST" });

const WITH_TOKEN = "/:token{tsk_[A-Za-z0-9_-]+}";

mcp.post("/", handler);
mcp.post(WITH_TOKEN, handler);
mcp.on(["GET", "DELETE"], ["/", WITH_TOKEN], notAllowed);

mcp.notFound((c) => c.json({ error: "Ukendt adresse." }, 404));
mcp.onError((e, c) => {
  console.error("mcp fejlede:", e);
  return c.json(fail(null, -32603, "Serverfejl."), 500);
});
