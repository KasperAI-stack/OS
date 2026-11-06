/* HeyOtto Tasks — alarmer som push-notifikationer på Netlify. Hver time, kun produktion.
   Logikken står i netlify/lib/jobs.mts og netlify/lib/alerts.mts. */

import type { Config } from "@netlify/functions";
import { alertsTick } from "../lib/jobs.mts";
import { productionStore } from "../lib/netlify-platform.mts";

export default async () => {
  console.log("alarmer —", await alertsTick(productionStore(), Netlify.env.get("URL") || ""));
};

// Hver hele time (UTC). Kørslen tjekker selv, om klokken er mellem 7 og 19 lokalt.
export const config: Config = {
  schedule: "0 * * * *"
};
