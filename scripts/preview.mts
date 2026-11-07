/* HeyOtto Tasks — lokal forhåndsvisning til design og skærmbilleder (M16, D7).

     npm run preview                  http://127.0.0.1:8790 med demo-data
     npm run preview -- --empty       uden data (tomme visninger)
     npm run preview -- --over        overbooket uge (Otto arbejder)

   Appen (dashboard/) og API'et (server/api.mts → handle()) er de rigtige; kun lageret er
   en SQLite-database i hukommelsen med opdigtede demo-data. Intet rører D1 eller skyen,
   og intet gemmes, når serveren stopper. Kræver ingen Cloudflare og ingen wrangler. */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { handle } from "../server/api.mts";
import type { Platform } from "../server/platform.mts";
import { d1Store } from "../worker/store.mts";
import { memoryD1 } from "../test/helpers.mts";
import { demoData } from "./preview-data.mts";

const PORT = Number(process.env.PORT || 8790);
const ROOT = fileURLToPath(new URL("../dashboard/", import.meta.url));
const args = new Set(process.argv.slice(2));

const store = d1Store(memoryD1());
const p: Platform = {
  store,
  env: () => undefined,
  ip: "127.0.0.1",
  waitUntil: () => {},
  startRun: async () => false,
  user: "demo@preview.local"   // som et Cloudflare Access-login: ingen adgangskode
};

// Læg demo-data ind gennem API'et selv, så de valideres som rigtige data
if (!args.has("--empty")) {
  const data = demoData({ over: args.has("--over") });
  const put = await handle(new Request("http://127.0.0.1/api/data", {
    method: "PUT", headers: { "Content-Type": "application/json", "X-Tasks": "1" },
    body: JSON.stringify({ rev: "", data })
  }), p);
  if (put.status !== 200) throw new Error("Demo-data blev afvist: " + await put.text());
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".svg": "image/svg+xml"
};

createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1:" + PORT);
  try {
    if (url.pathname.startsWith("/api/")) {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const r = await handle(new Request(url, {
        method: req.method, headers: req.headers as Record<string, string>,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : body
      }), p);
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    const rel = normalize(decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)).replace(/^([\\/])+/, "");
    if (rel.startsWith("..")) { res.writeHead(403).end(); return; }
    const file = await readFile(join(ROOT, rel));
    res.writeHead(200, { "Content-Type": TYPES[extname(rel)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(file);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Ikke fundet");
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log("HeyOtto Tasks (forhåndsvisning med demo-data): http://127.0.0.1:" + PORT);
});
