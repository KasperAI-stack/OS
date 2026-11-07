/* Skærmbilleder af HeyOtto Tasks (M16, D7): alle visninger i lyst, mørkt og 390 px.

     npm run preview                       (i et andet vindue)
     npm run shots                         → shots/<visning>-<tema>-<bredde>.png
     npm run shots -- kapacitet tasks      kun de nævnte visninger
     OUT=shots/foer npm run shots          en anden mappe, fx før/efter

   Bruger Chrome eller Edge, der allerede er installeret, gennem Chrome DevTools Protocol
   (Nodes indbyggede WebSocket). Ingen Playwright eller Puppeteer. Mappen shots/ er i .gitignore. */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:8790/";
const OUT = process.env.OUT || "shots";
const BROWSERS = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium"
].filter(Boolean) as string[];

const VIEWS = ["kapacitet", "tasks", "tasks/uge", "projekter", "nyt-website", "rutiner", "otto", "indbakke", "omplan", "versioner", "claude", "kalender", "indstillinger", "menu"];
const SIZES = [
  { name: "lys-1440", w: 1440, h: 1000, dark: false, mobile: false },
  { name: "moerk-1440", w: 1440, h: 1000, dark: true, mobile: false },
  { name: "lys-390", w: 390, h: 844, dark: false, mobile: true },
  { name: "moerk-390", w: 390, h: 844, dark: true, mobile: true }
];

const pick = process.argv.slice(2);
const views = pick.length ? VIEWS.filter((v) => pick.includes(v)) : VIEWS;
const exe = BROWSERS.find((b) => existsSync(b));
if (!exe) throw new Error("Fandt hverken Chrome eller Edge. Sæt CHROME=<sti til browseren>.");
mkdirSync(OUT, { recursive: true });

const port = 9333;
const proc = spawn(exe, ["--headless=new", "--remote-debugging-port=" + port, "--no-first-run", "--no-default-browser-check",
  "--hide-scrollbars", "--user-data-dir=" + mkdtempSync(join(tmpdir(), "ho-shots-")), "about:blank"], { stdio: "ignore" });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let target: any = null;
for (let i = 0; i < 50 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t: any) => t.type === "page"); } catch {}
  if (!target) await sleep(200);
}
if (!target) { proc.kill(); throw new Error("Browseren startede ikke."); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const waiting = new Map<number, (v: any) => void>();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(String(e.data));
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)!(m.error ? Promise.reject(new Error(m.error.message)) : m.result); waiting.delete(m.id); }
});
const cdp = (method: string, params: object = {}) => new Promise<any>((r) => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expr: string) => (await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;

await cdp("Page.enable");
await cdp("Runtime.enable");

for (const s of SIZES) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: s.w, height: s.h, deviceScaleFactor: s.mobile ? 2 : 1, mobile: s.mobile });
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: s.mobile });
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: s.dark ? "dark" : "light" }, { name: "prefers-reduced-motion", value: "reduce" }] });
  for (const v of views) {
    const hash = v === "indstillinger" || v === "menu" ? "kapacitet" : v;
    await cdp("Page.navigate", { url: BASE + "#" + hash });
    await sleep(300);
    await cdp("Page.reload", { ignoreCache: true });
    for (let i = 0; i < 40; i++) { if (await evaluate("!!document.querySelector('#main h1')")) break; await sleep(150); }
    if (v === "menu") { if (!s.mobile) continue; await evaluate("document.querySelector('[data-act=navopen]').click()"); }
    if (v === "indstillinger") await evaluate("(document.querySelector('[data-act=settings]')||{click(){}}).click()");
    await evaluate("document.fonts && document.fonts.ready.then(()=>1)");
    await sleep(700);
    // Hele siden på skrivebordet (højst 4000 px); på mobil kun det første skærmbillede
    const full = !s.mobile && v !== "indstillinger" && v !== "menu";
    const h = full ? Math.min(4000, Math.max(s.h, await evaluate("document.documentElement.scrollHeight"))) : s.h;
    if (full) await cdp("Emulation.setDeviceMetricsOverride", { width: s.w, height: h, deviceScaleFactor: 1, mobile: false });
    const shot = await cdp("Page.captureScreenshot", { format: "png" });
    if (full) await cdp("Emulation.setDeviceMetricsOverride", { width: s.w, height: s.h, deviceScaleFactor: 1, mobile: false });
    const file = join(OUT, v.replace(/\//g, "-") + "-" + s.name + ".png");
    writeFileSync(file, Buffer.from(shot.data, "base64"));
    console.log(file);
  }
}
ws.close();
proc.kill();
