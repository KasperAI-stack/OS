/* HeyOtto Tasks — kører én af Ottos kørsler på Netlify. Baggrundsfunktion: op til 15 minutter.

   Startes af API'et (dig) og agent-schedule (planen) med en signeret forespørgsel.
   Selve kørslen står i netlify/lib/jobs.mts (runAgent). */

import type { Config, Context } from "@netlify/functions";
import { validSignature } from "../lib/agent/queue.mts";
import { runAgent } from "../lib/jobs.mts";
import { contextStore } from "../lib/netlify-platform.mts";

export default async (req: Request, context: Context) => {
  const store = contextStore(context);
  const body = (await req.json().catch(() => null)) as { runId?: unknown } | null;
  const id = typeof body?.runId === "string" ? body.runId : "";
  if (!id || !(await validSignature(store as any, id, req.headers.get("x-heyotto-signature") || ""))) {
    console.log("agent-run: afvist (mangler gyldig signatur)");
    return;
  }
  await runAgent(store, id, new URL(req.url).origin);
};

export const config: Config = {
  background: true,
  path: "/agent-run"   // = RUN_PATH i queue.mts. Netlify læser config statisk, så det skal stå som tekst
};
