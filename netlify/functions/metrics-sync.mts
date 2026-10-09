/* HeyOtto OS — henter friske tal til Marketing-dashboardet hver 6. time.

   Netlify kører kun planlagte funktioner på produktion, så de rigtige data
   bruges altid her. Selve udtrækket står i netlify/lib/metrics.mts. */

import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { collect, METRICS_KEY, type Snapshot } from "../lib/metrics.mts";

export default async () => {
  const store = getStore({ name: "heyotto-os", consistency: "strong" });
  const previous = (await store.get(METRICS_KEY, { type: "json" })) as Snapshot | null;
  const snapshot = await collect((k) => Netlify.env.get(k), previous);
  await store.setJSON(METRICS_KEY, snapshot);
  const status = Object.values(snapshot.sources).map((s) => `${s.key}: ${s.status}`).join(", ");
  console.log("dashboard-tal hentet —", status);
};

// Hver 6. time (UTC). Netlify giver planlagte funktioner 30 sekunder.
export const config: Config = {
  schedule: "0 */6 * * *"
};
