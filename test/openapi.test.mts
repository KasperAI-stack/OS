/* docs/openapi.json skal dække alle /ext-ruter i koden, og omvendt (M14).
   Ruterne læses fra Hono-routeren, så en ny rute uden dokumentation får testen til at fejle. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ext } from "../server/ext.mts";

test("openapi.json dækker præcis /ext-ruterne", () => {
  const spec = JSON.parse(readFileSync(new URL("../docs/openapi.json", import.meta.url), "utf8"));
  assert.equal(spec.servers[0].url, "https://tasks-api.heyotto.win/ext");
  const inCode = new Set(
    ext.routes.filter((r) => r.method !== "ALL")
      .map((r) => r.method + " " + r.path.replace(/^\/ext/, "").replace(/:(\w+)/g, "{$1}"))
  );
  const inSpec = new Set<string>();
  for (const [path, ops] of Object.entries<any>(spec.paths)) {
    for (const m of Object.keys(ops)) if (m !== "parameters") inSpec.add(m.toUpperCase() + " " + path);
  }
  assert.deepEqual([...inCode].filter((r) => !inSpec.has(r)), [], "ruter i koden uden dokumentation");
  assert.deepEqual([...inSpec].filter((r) => !inCode.has(r)), [], "dokumenterede ruter, der ikke findes");
});
