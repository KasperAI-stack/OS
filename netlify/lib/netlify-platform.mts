/* HeyOtto Tasks — Platform på Netlify (se platform.mts).

   Kun produktion rører de rigtige data. Deploy Previews og branch-deploys får hver
   deres eget lager (getDeployStore), så en test aldrig kan overskrive noget. */

import { getDeployStore, getStore } from "@netlify/blobs";
import type { Context } from "@netlify/functions";
import { fire } from "./agent/queue.mts";
import type { Blobs, Platform } from "./platform.mts";

const OPTIONS = { name: "heyotto-os", consistency: "strong" as const };

export const productionStore = () => getStore(OPTIONS) as unknown as Blobs;

export function contextStore(context: Context) {
  return (context.deploy?.context === "production" ? getStore(OPTIONS) : getDeployStore(OPTIONS)) as unknown as Blobs;
}

// AI Gateway sætter sine nøgler i process.env, når funktionen starter
export const netlifyEnv = (k: string) => Netlify.env.get(k) || process.env[k];

export function netlifyPlatform(req: Request, context: Context): Platform {
  const store = contextStore(context);
  const origin = new URL(req.url).origin;
  return {
    store,
    env: netlifyEnv,
    ip: context.ip || "",
    waitUntil: (p) => context.waitUntil(p),
    startRun: (id) => fire(store as any, origin, id)
  };
}
