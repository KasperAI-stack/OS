/* HeyOtto OS — Ottos kørselsmotor: en tool use-løkke mod Claude API.

   Send beskeder + værktøjsliste → udfør de værktøjskald, Claude beder om → send
   resultaterne tilbage → gentag, til Claude er færdig. Løkken er skrevet i hånden
   (ikke SDK'ets tool runner), fordi hvert trin skal tjekke budget og grænser, logges
   og kun må bruge kørslens egne værktøjer.

   Grænser pr. kørsel: kindens maxSteps (højst 20), 400.000 tokens og 10 minutter.
   Dagsbudgettet tjekkes før HVERT kald til Claude. Når det er nået, stopper kørslen,
   og du får én push-besked om dagen.

   Claude kaldes med det officielle SDK. Nøglen kommer fra Netlify AI Gateway
   (ANTHROPIC_API_KEY og ANTHROPIC_BASE_URL sættes automatisk) eller fra din egen
   ANTHROPIC_API_KEY i Netlify. Koden er den samme. */

import Anthropic from "@anthropic-ai/sdk";
import { BASE_PROMPT, KINDS, costUsd } from "./kinds.mts";
import { toolsFor, type Tool } from "./tools.mts";
import {
  addSpend, dayIn, markBudgetAlerted, readRun, readSettings, readSpend, saveRun,
  type Run, type Settings, type Step, type Store
} from "./store.mts";

export type ModelCall = (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>;
export type Notify = (title: string, body: string, tag: string) => Promise<void>;

const MAX_STEPS = 20;
const MAX_TOKENS_RUN = 400_000;
const MAX_MS = 10 * 60_000;
const MAX_TOKENS_REPLY = 16_000;
const MAX_TOOL_RESULT = 60_000;     // tegn pr. værktøjssvar til Claude
const PARENTS = 5;                  // så mange tidligere spørgsmål følger med i en samtale

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + " …" : s);
const short = (v: unknown, n: number) => clip(typeof v === "string" ? v : JSON.stringify(v), n);

// Claude API via SDK'et. Klienten laves først, når der skal kaldes, så moduler kan
// indlæses (og testes) uden nøgle.
let client: Anthropic | null = null;
export const callClaude: ModelCall = (params) => {
  client ||= new Anthropic({ timeout: 180_000, maxRetries: 2 });
  return client.messages.create(params);
};

export function configured(env: (k: string) => string | undefined = (k) => process.env[k]) {
  return !!(env("ANTHROPIC_API_KEY") || "").trim();
}

function apiError(e: unknown) {
  if (e instanceof Anthropic.AuthenticationError) return "Claude API afviste nøglen. Tjek ANTHROPIC_API_KEY i Netlify, eller fjern den, så AI Gateway bruges.";
  if (e instanceof Anthropic.PermissionDeniedError) return "Nøglen har ikke adgang til modellen. Vælg en anden model under Indstillinger → Otto.";
  if (e instanceof Anthropic.NotFoundError) return "Modellen findes ikke hos Claude API (eller AI Gateway). Vælg en anden model under Indstillinger → Otto.";
  if (e instanceof Anthropic.RateLimitError) return "Claude API har for travlt lige nu (for mange kald). Prøv igen om lidt.";
  if (e instanceof Anthropic.BadRequestError) return "Claude API afviste kaldet: " + clip(e.message, 300);
  if (e instanceof Anthropic.APIConnectionTimeoutError) return "Claude API svarede ikke i tide. Prøv igen.";
  if (e instanceof Anthropic.APIConnectionError) return "Kunne ikke nå Claude API. Prøv igen om lidt.";
  if (e instanceof Anthropic.APIError) return `Claude API svarede med fejl ${e.status}. Prøv igen om lidt.`;
  return "Uventet fejl: " + clip(e instanceof Error ? e.message : String(e), 300);
}

function dateLine(now: Date, tz: string) {
  const f = new Intl.DateTimeFormat("da-DK", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return `Lige nu: ${f.format(now)} (${tz}).`;
}

// Tidligere spørgsmål og svar i samme samtale (Spørg Otto), ældste først
async function history(store: Store, run: Run): Promise<Anthropic.MessageParam[]> {
  const chain: Run[] = [];
  let id = run.parent;
  while (id && chain.length < PARENTS) {
    const p = await readRun(store, id);
    if (!p || p.kind !== run.kind) break;
    chain.unshift(p);
    id = p.parent;
  }
  return chain.filter((p) => p.output).flatMap((p) => [
    { role: "user" as const, content: p.input || "(intet spørgsmål)" },
    { role: "assistant" as const, content: p.output }
  ]);
}

async function overBudget(store: Store, s: Settings, now: Date) {
  const spend = await readSpend(store, dayIn(s.tz, now));
  return { over: spend.usd * s.usdDkk >= s.budgetDkk, spend };
}

export async function execute(store: Store, id: string, opts: { call?: ModelCall; notify?: Notify; now?: () => Date } = {}) {
  const call = opts.call || callClaude;
  const now = opts.now || (() => new Date());
  const run = await readRun(store, id);
  if (!run) return null;
  if (run.status !== "i kø") return run;          // allerede taget (Netlify kan prøve igen)

  const kind = KINDS[run.kind];
  const settings = await readSettings(store);
  const t0 = Date.now();
  run.status = "kører";
  run.startedAt = now().toISOString();
  await saveRun(store, run);

  const finish = async (status: Run["status"], error = "") => {
    run.status = status;
    run.error = error;
    run.finishedAt = now().toISOString();
    return await saveRun(store, run);
  };

  if (!kind) return await finish("fejlet", "Ukendt slags kørsel: " + run.kind);
  if (!settings.enabled) return await finish("stoppet", "Otto er slået fra under Indstillinger → Otto.");
  if (!settings.kinds[kind.id]?.enabled) return await finish("stoppet", `„${kind.label}“ er slået fra under Indstillinger → Otto.`);

  const tools: Tool[] = toolsFor(kind.tools, settings.auto[kind.id] === true);
  const allowed = new Set(tools.map((t) => t.name));
  const system: Anthropic.TextBlockParam[] = [{ type: "text", text: BASE_PROMPT + "\n\n" + kind.skill }];
  const apiTools: Anthropic.Tool[] = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
  const ask = kind.needsInput ? run.input : (run.input || "Udfør kørslen.");
  const messages: Anthropic.MessageParam[] = [
    ...(await history(store, run)),
    { role: "user", content: dateLine(now(), settings.tz) + "\n\n" + ask }
  ];
  const day = dayIn(settings.tz, now());
  let firstCall = true;
  const maxSteps = Math.min(MAX_STEPS, kind.maxSteps);

  for (let step = 0; ; step++) {
    if (step >= maxSteps) return await finish("stoppet", `Stoppet efter ${maxSteps} trin uden at blive færdig.`);
    if (Date.now() - t0 > MAX_MS) return await finish("stoppet", "Stoppet efter 10 minutter uden at blive færdig.");
    const used = run.usage.input + run.usage.output + run.usage.cacheRead + run.usage.cacheWrite;
    if (used > MAX_TOKENS_RUN) return await finish("stoppet", `Stoppet ved ${MAX_TOKENS_RUN.toLocaleString("da-DK")} tokens uden at blive færdig.`);
    const b = await overBudget(store, settings, now());
    if (b.over) {
      if (!b.spend.alerted && opts.notify) {
        await markBudgetAlerted(store, day);
        await opts.notify("Otto har nået dagsbudgettet",
          `${Math.round(b.spend.usd * settings.usdDkk * 100) / 100} kr. af ${settings.budgetDkk} kr. er brugt i dag. Otto kører igen i morgen, eller når du hæver budgettet.`,
          "agent-budget").catch((e) => console.error("budget-besked fejlede:", e));
      }
      return await finish("stoppet", `Dagsbudgettet på ${settings.budgetDkk} kr. er brugt. Otto kører igen i morgen, eller når du hæver budgettet under Indstillinger → Otto.`);
    }

    const ts = Date.now();
    let res: Anthropic.Message;
    try {
      res = await call({
        model: run.model,
        max_tokens: MAX_TOKENS_REPLY,
        system,
        tools: apiTools,
        messages,
        cache_control: { type: "ephemeral" },
        output_config: { effort: kind.effort }
      });
    } catch (e) {
      if (!(e instanceof Anthropic.APIError)) console.error("Claude-kald fejlede:", e);
      return await finish("fejlet", apiError(e));
    }

    const u = {
      input: res.usage.input_tokens || 0, output: res.usage.output_tokens || 0,
      cacheRead: res.usage.cache_read_input_tokens || 0, cacheWrite: res.usage.cache_creation_input_tokens || 0
    };
    const usd = costUsd(run.model, u);
    for (const k of Object.keys(u) as (keyof typeof u)[]) run.usage[k] += u[k];
    run.costUsd += usd;
    run.costDkk = Math.round(run.costUsd * settings.usdDkk * 10000) / 10000;
    await addSpend(store, day, usd, firstCall);
    firstCall = false;

    const text = res.content.filter((c): c is Anthropic.TextBlock => c.type === "text").map((c) => c.text).join("\n").trim();
    run.steps.push({ at: new Date(ts).toISOString(), type: "model", ms: Date.now() - ts, stop: res.stop_reason || "", text: clip(text, 2000), tokens: u });
    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason === "refusal") {
      const cat = (res as any).stop_details?.category;
      return await finish("fejlet", "Claude afviste at svare" + (cat ? ` (${cat})` : "") + ". Prøv at formulere det anderledes.");
    }
    if (res.stop_reason === "max_tokens") {
      run.output = text;
      return await finish("fejlet", "Svaret blev for langt og blev klippet over.");
    }
    if (res.stop_reason === "pause_turn") { await saveRun(store, run); continue; }
    if (res.stop_reason !== "tool_use") {
      run.output = text;
      return await finish("færdig");
    }

    // Udfør værktøjskaldene (alle i ét svar tilbage). Et navn uden for kørslens liste
    // afvises her, uanset hvad Claude beder om: rettighederne håndhæves i koden.
    const uses = res.content.filter((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
    const results = await Promise.all(uses.map(async (tu): Promise<[Anthropic.ToolResultBlockParam, Step]> => {
      const t1 = Date.now();
      const input = (tu.input && typeof tu.input === "object" ? tu.input : {}) as Record<string, unknown>;
      const logged: Step = { at: new Date(t1).toISOString(), type: "tool", ms: 0, name: tu.name, input: short(input, 300) };
      try {
        if (!allowed.has(tu.name)) throw new Error(`Værktøjet ${tu.name} er ikke tilladt i denne kørsel.`);
        const out = await tools.find((t) => t.name === tu.name)!.run(input, { store, now: now() });
        const textOut = JSON.stringify(out);
        logged.output = short(textOut, 500);
        logged.ms = Date.now() - t1;
        return [{ type: "tool_result", tool_use_id: tu.id, content: clip(textOut, MAX_TOOL_RESULT) }, logged];
      } catch (e) {
        logged.error = clip(e instanceof Error ? e.message : String(e), 300);
        logged.ms = Date.now() - t1;
        return [{ type: "tool_result", tool_use_id: tu.id, content: logged.error, is_error: true }, logged];
      }
    }));
    run.steps.push(...results.map((r) => r[1]));
    messages.push({ role: "user", content: results.map((r) => r[0]) });
    await saveRun(store, run);
  }
}

// Til den planlagte kontrol: kørsler, der er gået i stå
export const STALE_QUEUE_MS = 2 * 60_000;
export const STALE_RUN_MS = 16 * 60_000;   // baggrundsfunktioner må køre 15 min
