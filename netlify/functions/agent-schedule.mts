/* HeyOtto Tasks — Ottos planlagte udløser på Netlify. Hvert 15. minut, kun produktion.
   Planlagte funktioner må kun køre 30 sekunder, så kørslerne startes i
   baggrundsfunktionen (/agent-run). Logikken står i netlify/lib/jobs.mts. */

import type { Config } from "@netlify/functions";
import { fire } from "../lib/agent/queue.mts";
import { scheduleTick } from "../lib/jobs.mts";
import { productionStore } from "../lib/netlify-platform.mts";

export default async () => {
  const origin = Netlify.env.get("URL") || "";
  if (!/^https:\/\//.test(origin)) { console.log("otto: sitets adresse (URL) mangler"); return; }
  const store = productionStore();
  console.log("otto —", await scheduleTick(store, (id) => fire(store as any, origin, id)));
};

// Hvert 15. minut (UTC). Klokkeslæt regnes i brugerens tidszone.
export const config: Config = {
  schedule: "*/15 * * * *"
};
