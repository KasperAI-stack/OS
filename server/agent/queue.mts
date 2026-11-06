/* HeyOtto Tasks — læg en assistent-kørsel i kø.

   Udløsere er kun planen (scheduleTick), hændelser og dig (knapper i appen). Agenten kan
   ikke starte kørsler selv: ingen af dens værktøjer kan kalde herind. Selve starten sker
   via platformens startRun (Cloudflare Queue, se worker/index.mts). */

import { KINDS } from "./kinds.mts";
import { createRun, readSettings, type Store, type Trigger } from "./store.mts";

export async function enqueue(store: Store, kindId: string, trigger: Trigger, input = "", parent = "") {
  const kind = KINDS[kindId];
  if (!kind) throw new Error("Ukendt slags kørsel: " + kindId);
  const s = await readSettings(store);
  return await createRun(store, kind.id, trigger, s.kinds[kind.id].model, input, parent);
}
