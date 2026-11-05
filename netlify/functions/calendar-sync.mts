/* HeyOtto OS — henter de forbundne Google-kalendere hvert 15. minut.

   Netlify kører kun planlagte funktioner på produktion, så de rigtige data bruges
   altid her. Selve synken står i netlify/lib/google.mts. Appen beder desuden selv
   om en frisk synk, når den åbnes og kalenderen er over 5 minutter gammel. */

import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { client, readAccounts, syncAll } from "../lib/google.mts";

export default async () => {
  const env = (k: string) => Netlify.env.get(k);
  if (!client(env)) return;                       // Google er ikke sat op: intet at gøre
  const store = getStore({ name: "heyotto-os", consistency: "strong" });
  if (!(await readAccounts(store)).length) return; // ingen konti forbundet endnu
  const snap = await syncAll(store, env);
  console.log("kalender hentet —", snap.accounts.map((a) => `${a.email}: ${a.ok ? a.events + " hændelser" : a.error}`).join(", "));
};

// Hvert 15. minut (UTC). Netlify giver planlagte funktioner 30 sekunder.
export const config: Config = {
  schedule: "*/15 * * * *"
};
