/* Testhjælpere: D1 i hukommelsen (via Nodes indbyggede SQLite), så API'et kan testes
   med præcis det lager, Workeren bruger, uden server og uden Cloudflare. */

import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Like } from "../worker/store.mts";

export function memoryD1(): D1Like {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../migrations/0001_docs.sql", import.meta.url), "utf8"));
  // D1 nummererer parametre som ?1, ?2 … ligesom SQLite
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind(...values: unknown[]) {
          const args = values as any[];
          return {
            async first<T>() { return ((stmt.get(...args) as T) ?? null); },
            async all<T>() { return { results: stmt.all(...args) as T[] }; },
            async run() { return stmt.run(...args); }
          };
        }
      };
    }
  };
}
