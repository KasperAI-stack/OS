/* Skærmbilleder af offentlige referencesider til designbiblioteket (reference/design/).

     node scripts/refshots.mts                 alle kilder i reference/design/kilder.json
     node scripts/refshots.mts linear stripe   kun de nævnte id'er

   For hver kilde gemmes reference/design/<spor>/<id>-fold.jpg (første skærmbillede, 1440×900)
   og <id>-side.jpg (hele siden, højst 6000 px), samt <id>-mobil.jpg (390 px). Cookiebannere
   forsøges lukket med et klik på "Accept"-lignende knapper. Kun offentlige sider; intet login.
   Resultatet skrives til reference/design/hentet.json (dato, titel, status). */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = "reference/design";
const all = JSON.parse(readFileSync(join(ROOT, "kilder.json"), "utf8")) as { id: string; track: string; url: string; why: string }[];
const pick = process.argv.slice(2);
const list = pick.length ? all.filter((k) => pick.includes(k.id)) : all;
const exe = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome"].filter(Boolean).find((b) => existsSync(b!)) as string;

const port = 9340;
const proc = spawn(exe, ["--headless=new", "--remote-debugging-port=" + port, "--no-first-run", "--hide-scrollbars", "--lang=en-US",
  "--user-data-dir=" + mkdtempSync(join(tmpdir(), "ho-ref-")), "about:blank"], { stdio: "ignore" });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let target: any = null;
for (let i = 0; i < 50 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t: any) => t.type === "page"); } catch {}
  if (!target) await sleep(200);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const waiting = new Map<number, (v: any) => void>();
ws.addEventListener("message", (e) => { const m = JSON.parse(String(e.data)); if (m.id && waiting.has(m.id)) { waiting.get(m.id)!(m.result || { error: m.error }); waiting.delete(m.id); } });
const cdp = (method: string, params: object = {}) => new Promise<any>((r) => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expr: string) => (await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;

const ACCEPT = `(() => {
  const words = /^(accept( all)?( cookies)?|allow all( cookies)?|i agree|agree|got it|ok|okay|accept & close|accepter alle|godkend alle|tillad alle)$/i;
  const els = [...document.querySelectorAll('button, a[role=button], [role=button], input[type=button]')];
  const b = els.find(e => words.test((e.innerText || e.value || '').trim()));
  if (b) { b.click(); return true; } return false; })()`;

await cdp("Page.enable");
const done: any[] = existsSync(join(ROOT, "hentet.json")) ? JSON.parse(readFileSync(join(ROOT, "hentet.json"), "utf8")) : [];
for (const k of list) {
  const dir = join(ROOT, k.track);
  mkdirSync(dir, { recursive: true });
  const rec: any = { id: k.id, track: k.track, url: k.url, why: k.why, date: new Date().toISOString().slice(0, 10) };
  try {
    for (const view of [{ name: "desk", w: 1440, h: 900, mobile: false }, { name: "mobil", w: 390, h: 844, mobile: true }]) {
      await cdp("Emulation.setDeviceMetricsOverride", { width: view.w, height: view.h, deviceScaleFactor: view.mobile ? 2 : 1, mobile: view.mobile });
      await cdp("Page.navigate", { url: k.url });
      await sleep(6000);
      if (await evaluate(ACCEPT)) await sleep(1200);
      rec.title = rec.title || await evaluate("document.title");
      if (view.mobile) {
        const s = await cdp("Page.captureScreenshot", { format: "jpeg", quality: 78 });
        writeFileSync(join(dir, k.id + "-mobil.jpg"), Buffer.from(s.data, "base64"));
        continue;
      }
      const fold = await cdp("Page.captureScreenshot", { format: "jpeg", quality: 82 });
      writeFileSync(join(dir, k.id + "-fold.jpg"), Buffer.from(fold.data, "base64"));
      // Rul igennem, så billeder, der hentes ved rulning, kommer med
      await evaluate("(async () => { for (let y = 0; y < Math.min(document.documentElement.scrollHeight, 6000); y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 250)); } scrollTo(0, 0); })()");
      await sleep(800);
      const h = Math.min(6000, Math.max(900, await evaluate("document.documentElement.scrollHeight") || 900));
      await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: h, deviceScaleFactor: 1, mobile: false });
      await sleep(800);
      const side = await cdp("Page.captureScreenshot", { format: "jpeg", quality: 70 });
      writeFileSync(join(dir, k.id + "-side.jpg"), Buffer.from(side.data, "base64"));
      rec.height = h;
    }
    rec.ok = true;
    console.log("ok   " + k.id + "  " + (rec.title || ""));
  } catch (e) {
    rec.ok = false; rec.error = String(e);
    console.log("FEJL " + k.id + "  " + e);
  }
  const i = done.findIndex((d) => d.id === k.id);
  if (i >= 0) done[i] = rec; else done.push(rec);
  writeFileSync(join(ROOT, "hentet.json"), JSON.stringify(done, null, 2) + "\n");
}
ws.close();
proc.kill();
