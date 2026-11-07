/* Tilgængelighedstjek af HeyOtto Tasks (M16, D7).

     npm run preview          (i et andet vindue)
     npm run a11y             axe-core på alle visninger i lyst og mørkt tema + tastaturtjek

   Tastaturtjekket finder elementer med data-act, som hverken er en knap, et link eller et felt
   og ikke har tabindex: dem kan man klikke på, men ikke nå med Tab. axe-core hentes fra cdnjs
   ved hver kørsel (kræver net). Kører med Chrome/Edge gennem DevTools-protokollen som shots.mts. */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:8790/";
const AXE = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js";
const VIEWS = ["kapacitet", "kalender", "tasks", "projekter", "nyt-website", "rutiner", "otto", "indbakke", "omplan", "versioner", "claude"];
const exe = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome"].filter(Boolean).find((b) => existsSync(b!)) as string;
if (!exe) throw new Error("Fandt hverken Chrome eller Edge. Sæt CHROME=<sti>.");

const axeSrc = await (await fetch(AXE)).text();
const port = 9334;
const proc = spawn(exe, ["--headless=new", "--remote-debugging-port=" + port, "--no-first-run",
  "--user-data-dir=" + mkdtempSync(join(tmpdir(), "ho-a11y-")), "about:blank"], { stdio: "ignore" });
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
ws.addEventListener("message", (e) => { const m = JSON.parse(String(e.data)); if (m.id && waiting.has(m.id)) { waiting.get(m.id)!(m.result); waiting.delete(m.id); } });
const cdp = (method: string, params: object = {}) => new Promise<any>((r) => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expr: string) => (await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;

await cdp("Page.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
let total = 0;
for (const dark of [false, true]) {
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }] });
  for (const v of VIEWS) {
    await cdp("Page.navigate", { url: BASE + "#" + v });
    await sleep(300);
    await cdp("Page.reload", { ignoreCache: true });
    for (let i = 0; i < 40; i++) { if (await evaluate("!!document.querySelector('#main h1')")) break; await sleep(150); }
    await sleep(600);
    await evaluate(axeSrc + ";1");
    const res = await evaluate(`axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] })
      .then(r => r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes.slice(0, 2).map(n => n.target.join(" ")) })))`);
    const kb = await evaluate(`[...document.querySelectorAll("[data-act]")].filter(e => !/^(BUTTON|A|INPUT|SELECT|TEXTAREA|SUMMARY|LABEL)$/.test(e.tagName) && !e.hasAttribute("tabindex") && !e.classList.contains("scrim")).map(e => e.tagName + "." + e.className + "[" + e.getAttribute("data-act") + "]")`);
    const label = (dark ? "mørk " : "lys  ") + v;
    if (!res.length && !kb.length) { console.log("ok   " + label); continue; }
    total += res.length + kb.length;
    console.log("FEJL " + label);
    for (const r of res) console.log("     axe " + r.impact + " " + r.id + " ×" + r.n + "  " + r.ex.join(" | "));
    for (const k of kb) console.log("     tastatur: " + k);
  }
}
ws.close();
proc.kill();
console.log(total ? total + " fund" : "Ingen fund");
process.exitCode = total ? 1 : 0;
