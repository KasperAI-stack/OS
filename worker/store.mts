/* HeyOtto Tasks — lageret på Cloudflare: D1 bag samme interface som Netlify Blobs.

   Én tabel (migrations/0001_docs.sql):

     docs(key TEXT PRIMARY KEY, value TEXT, metadata TEXT, updated_at TEXT)

   Hver nøgle er det samme som en blob på Netlify (data, historik/<id>, agent-runs/<id> …),
   så resten af koden ikke ved, hvilken platform den kører på. D1 er konsistent (én
   primær database), så "data er ændret et andet sted" virker præcis som før. */

import type { Blobs } from "../netlify/lib/platform.mts";

// Det udsnit af D1's API, der bruges (så der ikke skal være en typepakke)
export type D1Like = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
      run(): Promise<unknown>;
    };
  };
};

// D1 tillader højst 2 MB pr. værdi. Appens data er langt under det.
export const MAX_VALUE = 1_900_000;

const parse = (text: string | null, type?: string) => (text === null ? null : type === "json" ? JSON.parse(text) : text);
const meta = (text: unknown) => {
  if (typeof text !== "string" || !text) return {};
  try { return JSON.parse(text) as Record<string, unknown>; } catch { return {}; }
};

export function d1Store(db: D1Like): Blobs {
  async function put(key: string, value: string, metadata?: Record<string, unknown>) {
    if (value.length > MAX_VALUE) {
      throw new Error(`For meget data under „${key}“ (${Math.round(value.length / 1000)} kB). Grænsen er ${MAX_VALUE / 1000} kB.`);
    }
    await db.prepare(
      "INSERT INTO docs (key, value, metadata, updated_at) VALUES (?1, ?2, ?3, ?4) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value, metadata = excluded.metadata, updated_at = excluded.updated_at"
    ).bind(key, value, metadata ? JSON.stringify(metadata) : null, new Date().toISOString()).run();
  }

  return {
    async get(key, opts) {
      const row = await db.prepare("SELECT value FROM docs WHERE key = ?1").bind(key).first<{ value: string }>();
      return parse(row ? row.value : null, opts?.type);
    },
    async getWithMetadata(key, opts) {
      const row = await db.prepare("SELECT value, metadata FROM docs WHERE key = ?1").bind(key).first<{ value: string; metadata: string | null }>();
      return row ? { data: parse(row.value, opts?.type), metadata: meta(row.metadata) } : null;
    },
    async getMetadata(key) {
      const row = await db.prepare("SELECT metadata FROM docs WHERE key = ?1").bind(key).first<{ metadata: string | null }>();
      return row ? { metadata: meta(row.metadata) } : null;
    },
    async list(opts) {
      const prefix = opts?.prefix || "";
      // Alle nøgler, der starter med prefix: fra prefix til (men ikke med) prefix + højeste tegn
      const { results } = await db.prepare("SELECT key FROM docs WHERE key >= ?1 AND key < ?2 ORDER BY key")
        .bind(prefix, prefix + "￿").all<{ key: string }>();
      return { blobs: results.map((r) => ({ key: r.key })) };
    },
    async set(key, value, opts) {
      await put(key, String(value), opts?.metadata);
    },
    async setJSON(key, value, opts) {
      await put(key, JSON.stringify(value), opts?.metadata);
    },
    async delete(key) {
      await db.prepare("DELETE FROM docs WHERE key = ?1").bind(key).run();
    }
  };
}
