/* HeyOtto Tasks — det, der er forskelligt fra platform til platform.

   API'et (api.mts) og jobbene (jobs.mts) kender kun denne type. Netlify
   (netlify/functions/*) og Cloudflare Workers (worker/index.mts) laver hver deres
   Platform: lager, miljøvariabler, klientens IP, waitUntil og hvordan en
   Otto-kørsel startes (Netlify: baggrundsfunktion, Cloudflare: Queue). */

// Det udsnit af Netlify Blobs' interface, koden bruger. worker/store.mts giver det
// samme oven på D1.
export type Blobs = {
  get(key: string, opts?: { type?: "json" | "text" }): Promise<any>;
  getWithMetadata(key: string, opts?: { type?: "json" | "text" }): Promise<{ data: any; metadata: Record<string, unknown> } | null>;
  getMetadata(key: string): Promise<{ metadata: Record<string, unknown> } | null>;
  list(opts?: { prefix?: string }): Promise<{ blobs: { key: string }[] }>;
  set(key: string, value: string, opts?: { metadata?: Record<string, unknown> }): Promise<unknown>;
  setJSON(key: string, value: unknown, opts?: { metadata?: Record<string, unknown> }): Promise<unknown>;
  delete(key: string): Promise<unknown>;
};

export type Env = (k: string) => string | undefined;

export type Platform = {
  store: Blobs;
  env: Env;
  ip: string;
  waitUntil(p: Promise<unknown>): void;
  // Start en kørsel, der allerede ligger i kø (agent-runs/<id>). false = startsignalet
  // gik tabt; den planlagte oprydning starter den igen.
  startRun(id: string): Promise<boolean>;
};
