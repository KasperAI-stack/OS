/* HeyOtto Tasks — kopiér alle data fra Netlify Blobs til en SQL-fil til D1 (M10/M13).

   Brug:
     NETLIFY_SITE_ID=… NETLIFY_AUTH_TOKEN=… node scripts/copy-blobs-to-d1.mjs <ud.sql> [--uden-push]
     npx wrangler d1 execute heyotto-tasks-test --env test --remote --file <ud.sql>
     slet <ud.sql> bagefter

   Filen indeholder alt, også serverens hemmelighed (auth/server-secret), som Google-tokens
   og sessioner er krypteret med. Den skal med, ellers skal alle Google-konti forbindes igen.
   Læg derfor filen UDEN FOR repoet og slet den, når den er indlæst.

   --uden-push udelader push-abonnementer (push/subs), så testmiljøet ikke sender
   notifikationer til dine rigtige enheder. Brug det til testmiljøet, ikke til flytningen.
   Mislykkede login-forsøg (auth/fail/*) kopieres aldrig.

   Til sidst skrives antal nøgler og længden af "data", så de kan sammenlignes med D1:
     npx wrangler d1 execute heyotto-tasks-test --env test --remote \
       --command "SELECT count(*) AS n, (SELECT length(value) FROM docs WHERE key='data') AS data FROM docs" */

import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { getStore } from "@netlify/blobs";

const out = process.argv[2];
const noPush = process.argv.includes("--uden-push");
const siteID = process.env.NETLIFY_SITE_ID;
const token = process.env.NETLIFY_AUTH_TOKEN;
if (!out || out.startsWith("--") || !siteID || !token) {
  console.error("Brug: NETLIFY_SITE_ID=… NETLIFY_AUTH_TOKEN=… node scripts/copy-blobs-to-d1.mjs <ud.sql> [--uden-push]");
  process.exit(1);
}
if (resolve(out).startsWith(resolve("."))) {
  console.error("Læg SQL-filen uden for repoet (den indeholder hemmeligheder), fx i din Temp-mappe.");
  process.exit(1);
}

const store = getStore({ name: "heyotto-os", siteID, token, consistency: "strong" });
const sql = (v) => (v === null || v === undefined ? "NULL" : "'" + String(v).replace(/'/g, "''") + "'");

const { blobs } = await store.list();
const lines = ["-- HeyOtto Tasks: kopi fra Netlify Blobs " + new Date().toISOString()];
let n = 0, skipped = 0, dataInfo = "";
for (const { key } of blobs) {
  if (key.startsWith("auth/fail/") || (noPush && key === "push/subs")) { skipped++; continue; }
  const found = await store.getWithMetadata(key, { type: "text" });
  if (!found) continue;
  const meta = found.metadata && Object.keys(found.metadata).length ? JSON.stringify(found.metadata) : null;
  lines.push(`INSERT OR REPLACE INTO docs (key, value, metadata, updated_at) VALUES (${sql(key)}, ${sql(found.data)}, ${sql(meta)}, ${sql(new Date().toISOString())});`);
  n++;
  if (key === "data") {
    dataInfo = `data: ${found.data.length} tegn, sha256 ${createHash("sha256").update(found.data).digest("hex").slice(0, 16)}, rev ${found.metadata?.rev ?? "?"}`;
  }
}
writeFileSync(out, lines.join("\n") + "\n");
console.log(`${n} nøgler skrevet til ${out} (${skipped} udeladt).`);
console.log(dataInfo || "Ingen data-nøgle fundet.");
