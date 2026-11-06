/* HeyOtto OS — Gmail, kun læsning (M8).

   Bruger de samme Google-konti som kalenderen. En konto kan læse mail, når den er
   forbundet med scopet gmail.readonly ("Giv adgang til mail" under Indstillinger →
   Forbindelser). HeyOtto OS kan aldrig sende, slette, arkivere eller mærke mails:
   der er ingen kode til det, og scopet tillader det ikke.

   Kun det nødvendige læses: afsender, modtagere, emne, dato og teksten uden citeret
   historik, klippet. Intet af mailens tekst gemmes, kun Ottos korte resumé i forslaget. */

import { accessToken, googleJson, readAccounts, serverSecret, type Account } from "./google.mts";

type Store = { get(key: string, opts?: any): Promise<any> };
type Env = (k: string) => string | undefined;

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const WINDOW_DAYS = 3;          // så langt tilbage kigges der ved hvert træk
const MAX_LIST = 60;            // beskeder pr. konto pr. træk
const MAX_TEXT = 4000;          // tegn pr. tråd til Claude
const MAX_MSGS = 3;             // de seneste beskeder i en tråd

// Nyhedsbreve, kampagner og automatiske opdateringer springes over allerede i søgningen
const QUERY = "-in:sent -in:drafts -in:chats -category:promotions -category:social -category:updates -category:forums";

export type ThreadHead = {
  threadId: string; account: string; accountEmail: string; lastMessageId: string;
  from: string; to: string; cc: string; subject: string; date: string; snippet: string; messages: number;
};

export async function mailAccounts(store: Store): Promise<Account[]> {
  return (await readAccounts(store as any)).filter((a) => a.scopes.includes("gmail"));
}

async function token(store: Store, env: Env, acc: Account) {
  return accessToken(env, await serverSecret(store as any), acc);
}

const get = (tok: string, path: string) => googleJson(API + path, { headers: { Authorization: "Bearer " + tok } });
const header = (m: any, name: string) =>
  String((m?.payload?.headers || []).find((h: any) => String(h.name).toLowerCase() === name.toLowerCase())?.value || "");
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + " …" : s);

export const threadUrl = (email: string, threadId: string) =>
  "https://mail.google.com/mail/u/?authuser=" + encodeURIComponent(email) + "#all/" + encodeURIComponent(threadId);

// Nye tråde (de seneste dage) fra én konto. processed: threadId → seneste besked, Otto har set.
export async function newThreads(store: Store, env: Env, acc: Account, processed: Record<string, string>, now = new Date()) {
  const tok = await token(store, env, acc);
  const after = Math.floor(now.getTime() / 1000) - WINDOW_DAYS * 86400;
  const list = await get(tok, "/messages?" + new URLSearchParams({ q: `after:${after} ${QUERY}`, maxResults: String(MAX_LIST) }));
  // Gmail giver nyeste først: den første besked pr. tråd er den seneste
  const latest = new Map<string, string>();
  const count = new Map<string, number>();
  for (const m of list.messages || []) {
    if (!latest.has(m.threadId)) latest.set(m.threadId, m.id);
    count.set(m.threadId, (count.get(m.threadId) || 0) + 1);
  }
  const fresh = [...latest].filter(([t, id]) => processed[t] !== id);
  const heads: ThreadHead[] = [];
  for (const [threadId, id] of fresh) {
    const m = await get(tok, `/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`);
    heads.push({
      threadId, account: acc.id, accountEmail: acc.email, lastMessageId: id,
      from: clip(header(m, "From"), 200), to: clip(header(m, "To"), 300), cc: clip(header(m, "Cc"), 300),
      subject: clip(header(m, "Subject"), 200), date: header(m, "Date"), snippet: clip(String(m.snippet || ""), 200),
      messages: count.get(threadId) || 1
    });
  }
  return heads;
}

/* ---------- Tekst ---------- */

function b64(data: string) {
  try { return Buffer.from(String(data || ""), "base64url").toString("utf8"); } catch { return ""; }
}

function findPart(p: any, mime: string): any {
  if (!p) return null;
  if (p.mimeType === mime && p.body?.data) return p;
  for (const c of p.parts || []) { const f = findPart(c, mime); if (f) return f; }
  return null;
}

function htmlToText(html: string) {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, " ");
}

// Skærer citeret historik fra: alt efter "Den … skrev:" / "On … wrote:" og linjer med ">"
export function stripQuoted(text: string) {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  for (const l of lines) {
    if (/^\s*(On .{4,200} wrote:|Den .{4,200} skrev:|-{2,}\s*(Original Message|Oprindelig meddelelse|Forwarded message|Videresendt meddelelse)\s*-{2,}|From: .+|Fra: .+)\s*$/i.test(l)) break;
    if (/^\s*>/.test(l)) continue;
    out.push(l);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function messageText(m: any) {
  const plain = findPart(m.payload, "text/plain");
  const html = plain ? null : findPart(m.payload, "text/html");
  const raw = plain ? b64(plain.body.data) : html ? htmlToText(b64(html.body.data)) : String(m.snippet || "");
  return stripQuoted(raw);
}

// De seneste beskeder i en tråd, som tekst til Claude
export async function readThread(store: Store, env: Env, acc: Account, threadId: string) {
  const tok = await token(store, env, acc);
  const t = await get(tok, `/threads/${encodeURIComponent(threadId)}?format=full`);
  const msgs = (t.messages || []).slice(-MAX_MSGS);
  let budget = MAX_TEXT;
  const out = [];
  for (const m of msgs.reverse()) {                  // nyeste først, så den får pladsen
    const text = clip(messageText(m), Math.max(200, budget));
    budget -= text.length;
    out.unshift({ from: header(m, "From"), to: clip(header(m, "To"), 300), cc: clip(header(m, "Cc"), 300),
                  date: header(m, "Date"), subject: header(m, "Subject"), text });
  }
  return { threadId, account: acc.email, messages: out };
}
