/* HeyOtto Tasks — API-tokens til /ext og /mcp (M11, som i HeyOtto Studio).

   Token = "tsk_" + 32 tilfældige bytes (base64url). Kun sha256 af tokenet gemmes, og
   tokenet vises én gang, når det laves. Tilbagekaldt = revokedAt sat; det virker aldrig igen.

     api-tokens/<sha256>   { id, name, hash, scopes, createdAt, lastUsedAt, revokedAt }

   Nøglen er hashen, så et kald slår tokenet op direkte. Scopes er en lukket liste.
   Intet scope kan slette, se Historik, lave tokens eller godkende noget. */

import { createHash, randomBytes } from "node:crypto";
import type { DocStore } from "./platform.mts";

export const SCOPES = ["read", "write"] as const;
export type Scope = (typeof SCOPES)[number];
export type ApiToken = {
  id: string; name: string; hash: string; scopes: Scope[];
  createdAt: string; lastUsedAt: string; revokedAt: string;
};

const PREFIX = "api-tokens/";
const MAX_TOKENS = 50;
const TOUCH_MS = 60_000;                 // "sidst brugt" skrives højst én gang i minuttet

export const TOKEN_PATTERN = /tsk_[A-Za-z0-9_-]{10,}/g;
// Til logs, fejl og stier: et token må aldrig stå i klartekst nogen steder
export const scrub = (s: string) => s.replace(TOKEN_PATTERN, "tsk_***");

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export const publicToken = (t: ApiToken) => ({
  id: t.id, name: t.name, scopes: t.scopes, createdAt: t.createdAt, lastUsedAt: t.lastUsedAt, revokedAt: t.revokedAt
});

export async function listTokens(store: DocStore): Promise<ApiToken[]> {
  const { blobs } = await store.list({ prefix: PREFIX });
  const all = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }) as Promise<ApiToken | null>));
  return all.filter((t): t is ApiToken => !!t).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createToken(store: DocStore, name: unknown, scopes: unknown) {
  const clean = typeof name === "string" ? name.trim().slice(0, 60) : "";
  if (!clean) throw new Error("Giv tokenet et navn, fx „Studio“.");
  const wanted = Array.isArray(scopes) ? scopes : [];
  const ok = SCOPES.filter((s) => wanted.includes(s));
  if (!ok.length || ok.length !== wanted.length) throw new Error("Rettigheder skal være read og/eller write.");
  if ((await listTokens(store)).filter((t) => !t.revokedAt).length >= MAX_TOKENS) {
    throw new Error(`Der kan højst være ${MAX_TOKENS} aktive tokens. Tilbagekald nogle først.`);
  }
  const token = "tsk_" + randomBytes(32).toString("base64url");
  const record: ApiToken = {
    id: randomBytes(8).toString("hex"), name: clean, hash: sha256(token), scopes: ok,
    createdAt: new Date().toISOString(), lastUsedAt: "", revokedAt: ""
  };
  await store.setJSON(PREFIX + record.hash, record);
  return { token, record };
}

export async function revokeToken(store: DocStore, id: string) {
  const rec = (await listTokens(store)).find((t) => t.id === id);
  if (!rec) return null;
  if (!rec.revokedAt) {
    rec.revokedAt = new Date().toISOString();
    await store.setJSON(PREFIX + rec.hash, rec);
  }
  return rec;
}

// Gyldigt, ikke tilbagekaldt token → posten. Ellers null.
export async function verifyToken(store: DocStore, token: string, now = Date.now()): Promise<ApiToken | null> {
  if (!/^tsk_[A-Za-z0-9_-]{40,50}$/.test(token)) return null;
  const rec = (await store.get(PREFIX + sha256(token), { type: "json" })) as ApiToken | null;
  if (!rec || rec.revokedAt) return null;
  if (!rec.lastUsedAt || now - Date.parse(rec.lastUsedAt) > TOUCH_MS) {
    rec.lastUsedAt = new Date(now).toISOString();
    await store.setJSON(PREFIX + rec.hash, rec);
  }
  return rec;
}
