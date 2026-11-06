/* HeyOtto Tasks på Cloudflare Workers.

     fetch       /api/* → API'et (netlify/lib/api.mts). Alt andet: appens statiske filer
                 (dashboard/), som Cloudflare serverer uden om Workeren.
     queue       én Otto-kørsel pr. besked (erstatter Netlifys baggrundsfunktion)
     scheduled   hvert 15. minut: kalender + Ottos planlagte udløser. Hver time: alarmer.

   Opsætningen står i wrangler.jsonc. Hemmeligheder (adgangskode, Claude- og
   Google-nøgler) sættes med `wrangler secret put` og ligger aldrig i repoet. */

import { handle } from "../netlify/lib/api.mts";
import { alertsTick, calendarTick, runAgent, scheduleTick } from "../netlify/lib/jobs.mts";
import type { Env as EnvFn, Platform } from "../netlify/lib/platform.mts";
import { d1Store, type D1Like } from "./store.mts";

type QueueMessage = { body: { runId?: unknown }; ack(): void };

export type WorkerEnv = {
  DB: D1Like;
  ASSETS: { fetch(req: Request): Promise<Response> };
  AGENT_QUEUE: { send(body: { runId: string }): Promise<unknown> };
  APP_URL?: string;              // appens egen https-adresse (links i notifikationer, VAPID)
  [k: string]: unknown;
};

type Ctx = { waitUntil(p: Promise<unknown>): void };

export const CRON_EVERY_15 = "*/15 * * * *";
export const CRON_HOURLY = "0 * * * *";

const envOf = (env: WorkerEnv): EnvFn => (k) => (typeof env[k] === "string" ? (env[k] as string) : undefined);

function startRun(env: WorkerEnv) {
  return async (id: string) => {
    try {
      await env.AGENT_QUEUE.send({ runId: id });
      return true;
    } catch (e) {
      console.error("kunne ikke lægge kørslen i køen:", e);
      return false;
    }
  };
}

export function platform(req: Request, env: WorkerEnv, ctx: Ctx): Platform {
  return {
    store: d1Store(env.DB),
    env: envOf(env),
    ip: req.headers.get("cf-connecting-ip") || "",
    waitUntil: (p) => ctx.waitUntil(p),
    startRun: startRun(env)
  };
}

export default {
  async fetch(req: Request, env: WorkerEnv, ctx: Ctx): Promise<Response> {
    const path = new URL(req.url).pathname;
    if (path === "/api" || path.startsWith("/api/")) return handle(req, platform(req, env, ctx));
    return env.ASSETS.fetch(req);
  },

  // Én kørsel pr. besked (max_batch_size = 1). Fejl gemmes på kørslen af runAgent,
  // så beskeden kvitteres altid. Den planlagte oprydning starter tabte kørsler igen.
  async queue(batch: { messages: QueueMessage[] }, env: WorkerEnv): Promise<void> {
    const store = d1Store(env.DB);
    for (const m of batch.messages) {
      const id = typeof m.body?.runId === "string" ? m.body.runId : "";
      if (id) await runAgent(store, id, env.APP_URL || "");
      m.ack();
    }
  },

  async scheduled(controller: { cron: string }, env: WorkerEnv): Promise<void> {
    const store = d1Store(env.DB);
    if (controller.cron === CRON_EVERY_15) {
      try { console.log("kalender —", await calendarTick(store, envOf(env))); } catch (e) { console.error("kalender fejlede:", e); }
      try { console.log("otto —", await scheduleTick(store, startRun(env))); } catch (e) { console.error("otto-planen fejlede:", e); }
    } else if (controller.cron === CRON_HOURLY) {
      try { console.log("alarmer —", await alertsTick(store, env.APP_URL || "")); } catch (e) { console.error("alarmer fejlede:", e); }
    }
  }
};
