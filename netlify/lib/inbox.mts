/* HeyOtto OS — indbakken: Ottos forslag til opgaver fra mail (M8).

     inbox/suggestions   [{ id, threadId, account, accountEmail, url, from, subject, date,
                            title, note, due, estimate, project, confidence, status, runId, createdAt, handledAt, taskId }]
     inbox/state         { processed: { threadId: seneste besked-id } } — tråde, Otto har vurderet

   Forslag ligger uden for data. Først når du trykker Opret, bliver det til en opgave,
   og den gemmes som alt andet (og står i Historik). Ignorerede tråde kommer ikke igen,
   medmindre der kommer et nyt svar i tråden. */

import { randomBytes } from "node:crypto";

type Store = {
  get(key: string, opts?: any): Promise<any>;
  setJSON(key: string, value: unknown): Promise<any>;
};

export type SuggestionStatus = "ny" | "oprettet" | "ignoreret";
export type Suggestion = {
  id: string; threadId: string; account: string; accountEmail: string; url: string;
  from: string; subject: string; date: string;
  title: string; note: string; due: string; estimate: number | null; project: string; confidence: number;
  status: SuggestionStatus; runId: string; createdAt: string; handledAt: string; taskId: string;
};

const SUGG_KEY = "inbox/suggestions";
const STATE_KEY = "inbox/state";
const KEEP = 300;
const KEEP_PROCESSED = 2000;

// Værktøjskald i samme svar kører samtidig. Skrivninger til indbakken tages én ad gangen,
// så ingen forslag går tabt.
let chain: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
}

export async function readSuggestions(store: Store): Promise<Suggestion[]> {
  const s = await store.get(SUGG_KEY, { type: "json" });
  return Array.isArray(s) ? s : [];
}

export async function readProcessed(store: Store): Promise<Record<string, string>> {
  const s = (await store.get(STATE_KEY, { type: "json" })) || {};
  return s.processed && typeof s.processed === "object" ? s.processed : {};
}

export function markProcessed(store: Store, threadId: string, messageId: string) {
  return locked(async () => {
    const p = await readProcessed(store);
    delete p[threadId];
    p[threadId] = messageId;                       // nyeste sidst, så de ældste kan ryddes
    const keys = Object.keys(p);
    for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_PROCESSED))) delete p[k];
    await store.setJSON(STATE_KEY, { processed: p });
  });
}

export function addSuggestion(store: Store, s: Omit<Suggestion, "id" | "status" | "createdAt" | "handledAt" | "taskId">) {
  return locked(async () => {
    const list = await readSuggestions(store);
    // Samme tråd og samme titel, der stadig venter: opdatér i stedet for at lave en ny
    const same = list.find((x) => x.status === "ny" && x.threadId === s.threadId && x.title.toLowerCase() === s.title.toLowerCase());
    if (same) { Object.assign(same, s); await store.setJSON(SUGG_KEY, list); return same; }
    const item: Suggestion = { ...s, id: randomBytes(6).toString("hex"), status: "ny", createdAt: new Date().toISOString(), handledAt: "", taskId: "" };
    await store.setJSON(SUGG_KEY, [item, ...list].slice(0, KEEP));
    return item;
  });
}

export function setStatus(store: Store, id: string, status: SuggestionStatus, taskId = "") {
  return locked(async () => {
    const list = await readSuggestions(store);
    const s = list.find((x) => x.id === id);
    if (!s) return null;
    s.status = status;
    s.handledAt = status === "ny" ? "" : new Date().toISOString();
    s.taskId = status === "oprettet" ? taskId.slice(0, 120) : "";
    await store.setJSON(SUGG_KEY, list);
    return s;
  });
}
