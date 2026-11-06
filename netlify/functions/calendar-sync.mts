/* HeyOtto Tasks — henter de forbundne Google-kalendere på Netlify. Hvert 15. minut, kun
   produktion. Appen beder desuden selv om en frisk synk, når den åbnes og kalenderen er
   over 5 minutter gammel. Logikken står i netlify/lib/jobs.mts og netlify/lib/google.mts. */

import type { Config } from "@netlify/functions";
import { calendarTick } from "../lib/jobs.mts";
import { netlifyEnv, productionStore } from "../lib/netlify-platform.mts";

export default async () => {
  console.log("kalender —", await calendarTick(productionStore(), netlifyEnv));
};

// Hvert 15. minut (UTC). Netlify giver planlagte funktioner 30 sekunder.
export const config: Config = {
  schedule: "*/15 * * * *"
};
