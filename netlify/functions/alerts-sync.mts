/* HeyOtto OS — sender alarmer som push-notifikationer. Kører hver time.

   Netlify kører kun planlagte funktioner på produktion. Reglerne står i
   dashboard/lib/forecast.mjs (de samme, som appen viser), og selve kørslen i
   netlify/lib/alerts.mts. Uden enheder med notifikationer slået til sker der intet. */

import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { run } from "../lib/alerts.mts";

export default async () => {
  const store = getStore({ name: "heyotto-os", consistency: "strong" });
  const subject = Netlify.env.get("URL") || "";
  if (!/^https:\/\//.test(subject)) { console.log("alarmer: sitets adresse (URL) mangler, intet sendt"); return; }
  console.log("alarmer —", JSON.stringify(await run(store, subject)));
};

// Hver hele time (UTC). Kørslen tjekker selv, om klokken er mellem 7 og 19 lokalt.
export const config: Config = {
  schedule: "0 * * * *"
};
