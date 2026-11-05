/* HeyOtto OS — kører én af Ottos kørsler. Baggrundsfunktion: op til 15 minutter.

   Startes af api.mts (dig) og agent-schedule.mts (planen) med en signeret
   forespørgsel. Selve løkken står i netlify/lib/agent/runtime.mts. */

import { getDeployStore, getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
import { sendAll } from "../lib/alerts.mts";
import { execute } from "../lib/agent/runtime.mts";
import { validSignature } from "../lib/agent/queue.mts";
import { readRun, readSettings, saveRun, type Store } from "../lib/agent/store.mts";

export default async (req: Request, context: Context) => {
  // Samme lager som api.mts: kun produktion rører de rigtige data
  const options = { name: "heyotto-os", consistency: "strong" as const };
  const store = (context.deploy?.context === "production" ? getStore(options) : getDeployStore(options)) as unknown as Store;
  const body = (await req.json().catch(() => null)) as { runId?: unknown } | null;
  const id = typeof body?.runId === "string" ? body.runId : "";
  if (!id || !(await validSignature(store, id, req.headers.get("x-heyotto-signature") || ""))) {
    console.log("agent-run: afvist (mangler gyldig signatur)");
    return;
  }

  // Prognosen regner i lokal tid, ligesom i appen
  process.env.TZ = (await readSettings(store)).tz;
  const origin = new URL(req.url).origin;
  const notify = async (title: string, text: string, tag: string) => {
    await sendAll(store, [{ title, body: text, url: "/#otto", tag }], origin);
  };

  try {
    const run = await execute(store, id, { notify });
    if (!run) return;
    console.log(`agent-run ${run.id} (${run.kind}): ${run.status}, ${run.steps.length} trin, ${run.costDkk} kr.`);
    // Morgenbriefen sendes også som notifikation: første linje som titel
    if (run.kind === "morgenbrief" && run.status === "færdig" && run.output) {
      const [first, ...rest] = run.output.split("\n").map((l) => l.replace(/^[-*#\s]+/, "").trim()).filter(Boolean);
      if (first) await notify("Otto: " + first.slice(0, 80), rest.join(" · ").slice(0, 180), "morgenbrief");
    }
  } catch (e) {
    console.error("agent-run fejlede:", e);
    const run = await readRun(store, id);
    if (run && (run.status === "kører" || run.status === "i kø")) {
      run.status = "fejlet";
      run.error = "Serverfejl: " + (e instanceof Error ? e.message : String(e)).slice(0, 300);
      run.finishedAt = new Date().toISOString();
      await saveRun(store, run);
    }
  }
};

export const config: Config = {
  background: true,
  path: "/agent-run"   // = RUN_PATH i queue.mts. Netlify læser config statisk, så det skal stå som tekst
};
