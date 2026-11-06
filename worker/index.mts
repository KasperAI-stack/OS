/* HeyOtto Tasks på Cloudflare Workers.

     Først: adgangsvagten (server/gate.mts). Lukket som standard: API-adressen kun /ext og
     /mcp med token, app-adressen kun med Cloudflare Access, alle andre adresser 403.

     fetch       /api/* → appens API (server/api.mts). /ext/* → det offentlige API med
                 tokens (server/ext.mts). Alt andet: appens statiske filer
                 (dashboard/), som Cloudflare serverer uden om Workeren.
     queue       én assistent-kørsel pr. besked (Cloudflare Queue)
     scheduled   hvert 15. minut: kalender + Assistentens planlagte udløser. Hver time: alarmer.

   Opsætningen står i wrangler.jsonc. Hemmeligheder (adgangskode, Claude- og
   Google-nøgler) sættes med `wrangler secret put` og ligger aldrig i repoet. */

import { handle, studioCommenter } from "../server/api.mts";
import * as studio from "../server/studio.mts";
import { ext } from "../server/ext.mts";
import { gate } from "../server/gate.mts";
import { alertsTick, calendarTick, runAgent, scheduleTick } from "../server/jobs.mts";
import type { Env as EnvFn, Platform } from "../server/platform.mts";
import { d1Store, type D1Like } from "./store.mts";

type QueueMessage = { body: { runId?: unknown }; ack(): void };

export type WorkerEnv = {
  DB: D1Like;
  ASSETS: { fetch(req: Request): Promise<Response> };
  AGENT_QUEUE: { send(body: { runId: string }): Promise<unknown> };
  EXT_LIMITER?: { limit(opts: { key: string }): Promise<{ success: boolean }> };   // 60 kald/min pr. token
  APP_URL?: string;              // appens egen https-adresse (links i notifikationer, VAPID)
  UI_HOST?: string;              // appens adresse bag Access, fx tasks-ui.heyotto.win
  API_HOST?: string;             // API'ets adresse (/ext, /mcp), fx tasks.heyotto.win
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  [k: string]: unknown;
};

type Ctx = { waitUntil(p: Promise<unknown>): void };

export const CRON_EVERY_15 = "*/15 * * * *";
export const CRON_HOURLY = "0 * * * *";
export const CRON_EVERY_MINUTE = "* * * * *";

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

export function platform(req: Request, env: WorkerEnv, ctx: Ctx, user = ""): Platform {
  return {
    store: d1Store(env.DB),
    env: envOf(env),
    ip: req.headers.get("cf-connecting-ip") || "",
    waitUntil: (p) => ctx.waitUntil(p),
    startRun: startRun(env),
    user,
    rateLimit: async (key) => (env.EXT_LIMITER ? (await env.EXT_LIMITER.limit({ key })).success : true)
  };
}

export default {
  async fetch(req: Request, env: WorkerEnv, ctx: Ctx): Promise<Response> {
    const g = await gate(req, {
      uiHost: env.UI_HOST || "", apiHost: env.API_HOST || "",
      team: env.CF_ACCESS_TEAM_DOMAIN || "", aud: env.CF_ACCESS_AUD || ""
    });
    if (g.stop) return g.stop;
    const path = new URL(req.url).pathname;
    if (path === "/api" || path.startsWith("/api/")) return handle(req, platform(req, env, ctx, g.user));
    if (path === "/ext" || path.startsWith("/ext/")) return ext.fetch(req, { p: platform(req, env, ctx) });
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
    } else if (controller.cron === CRON_EVERY_MINUTE) {
      try { const r = await studio.tick(store, envOf(env), studioCommenter(store)); if (r.checked) console.log("studio —", r); } catch (e) { console.error("studio fejlede:", e); }
    } else if (controller.cron === CRON_HOURLY) {
      try { console.log("alarmer —", await alertsTick(store, env.APP_URL || "")); } catch (e) { console.error("alarmer fejlede:", e); }
    }
  }
};
