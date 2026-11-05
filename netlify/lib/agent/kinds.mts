/* HeyOtto OS — de slags kørsler, Otto kan lave.

   Hver slags får KUN de værktøjer, der står her. Det er det vigtigste forsvar mod
   prompt injection: indholdet i en kalender eller (senere) en mail kan højst give et
   forkert svar eller forslag, aldrig en handling.

   Indbakken (M8) har kun mail-læsning, data_read og de to indbakke-værktøjer: en mail kan
   højst give et forkert forslag. M9 (omplanlægning) tilføjer sin slags her. */

import OTTO from "./skills/otto.mts";
import PING from "./skills/ping.mts";
import SPOERG from "./skills/spoerg.mts";
import MORGENBRIEF from "./skills/morgenbrief.mts";
import INDBAKKE from "./skills/indbakke.mts";

export type Effort = "low" | "medium" | "high";
export type Kind = {
  id: string;
  label: string;
  tools: readonly string[];
  model: string;                 // standardmodel; kan ændres under Indstillinger → Otto
  effort: Effort;
  maxSteps: number;
  skill: string;
  defaultEnabled: boolean;
  byHand: boolean;               // må startes fra appen
  needsInput: boolean;           // kræver tekst fra dig (et spørgsmål)
  schedule?: { hour: number; weekdays: boolean };
};

const READ_ALL = ["data_read", "forecast_run", "calendar_list"] as const;

export const KINDS: Record<string, Kind> = {
  ping: {
    id: "ping", label: "Forbindelsestest", tools: ["ping"], model: "claude-haiku-5-5", effort: "low",
    maxSteps: 3, skill: PING, defaultEnabled: true, byHand: true, needsInput: false
  },
  spoerg: {
    id: "spoerg", label: "Spørg Otto", tools: READ_ALL, model: "claude-opus-5-5", effort: "medium",
    maxSteps: 12, skill: SPOERG, defaultEnabled: true, byHand: true, needsInput: true
  },
  indbakke: {
    id: "indbakke", label: "Indbakke (mail → opgaver)",
    tools: ["data_read", "gmail_new", "gmail_read", "inbox_suggest_task", "inbox_skip"],
    model: "claude-sonnet-5-5", effort: "medium",
    maxSteps: 20, skill: INDBAKKE, defaultEnabled: true, byHand: true, needsInput: false
  },
  morgenbrief: {
    id: "morgenbrief", label: "Morgenbrief", tools: READ_ALL, model: "claude-sonnet-5-5", effort: "medium",
    maxSteps: 6, skill: MORGENBRIEF, defaultEnabled: false, byHand: true, needsInput: false,
    schedule: { hour: 7, weekdays: true }
  }
};

export const BASE_PROMPT = OTTO;

/* ---------- Modeller og priser ----------
   Listepriser i USD pr. million tokens (Claude API, oktober 2026). Bruges kun til at
   regne hver kørsels pris og dagsbudgettet ud. Ret her, hvis priserne ændres.
   Cache-skrivning (5 min) koster 1,25 × input; cache-læsning står for sig. */

export type Price = { input: number; output: number; cacheRead: number; cacheWrite: number };
export const MODELS: Record<string, { label: string; price: Price }> = {
  "claude-haiku-5-5":  { label: "Haiku 5.5 (hurtig og billig)", price: { input: 0.10, output: 0.50, cacheRead: 0.01, cacheWrite: 0.125 } },
  "claude-sonnet-5-5": { label: "Sonnet 5.5 (mellem)",          price: { input: 2,    output: 10,   cacheRead: 0.20, cacheWrite: 2.5 } },
  "claude-opus-5-5":   { label: "Opus 5.5 (klogest)",           price: { input: 4,    output: 20,   cacheRead: 0.20, cacheWrite: 5 } }
};

export type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number };

export function costUsd(model: string, u: Usage) {
  const p = (MODELS[model] || MODELS["claude-opus-5-5"]).price;
  return (u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) / 1_000_000;
}
