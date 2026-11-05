/* HeyOtto OS — Ottos kø: læg en kørsel i kø, og start baggrundsfunktionen.

   Udløsere er kun planen (agent-schedule), hændelser og dig (knapper i appen).
   Agenten kan ikke starte kørsler selv: ingen af dens værktøjer kan kalde herind.

   Baggrundsfunktionen (/agent-run) kan nås af alle på nettet, så kaldet signeres med
   en HMAC af kørslens id og serverens hemmelighed. Uden gyldig signatur sker der intet. */

import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { serverSecret } from "../google.mts";
import { KINDS } from "./kinds.mts";
import { createRun, readSettings, type Store, type Trigger } from "./store.mts";

export const RUN_PATH = "/agent-run";
const FIRE_MS = 5000;

export async function signRun(store: Store, id: string) {
  return createHmac("sha256", await serverSecret(store)).update("agent-run:" + id).digest("hex");
}

export async function validSignature(store: Store, id: string, sig: string) {
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(sig || ""), h(await signRun(store, id)));
}

// Starter baggrundsfunktionen. Netlify svarer 202 med det samme.
export async function fire(store: Store, origin: string, id: string) {
  try {
    const res = await fetch(origin.replace(/\/+$/, "") + RUN_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-HeyOtto-Signature": await signRun(store, id) },
      body: JSON.stringify({ runId: id }),
      signal: AbortSignal.timeout(FIRE_MS)
    });
    if (!res.ok) console.error("agent-run svarede", res.status);
    return res.ok;
  } catch (e) {
    console.error("kunne ikke starte agent-run:", e);
    return false;
  }
}

export async function enqueue(store: Store, kindId: string, trigger: Trigger, input = "", parent = "") {
  const kind = KINDS[kindId];
  if (!kind) throw new Error("Ukendt slags kørsel: " + kindId);
  const s = await readSettings(store);
  return await createRun(store, kind.id, trigger, s.kinds[kind.id].model, input, parent);
}
