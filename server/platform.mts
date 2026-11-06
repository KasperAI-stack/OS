/* HeyOtto Tasks — det, serveren får fra Cloudflare Workers.

   API'et (api.mts) og jobbene (jobs.mts) kender kun denne type, så de kan testes uden
   Cloudflare (test/). worker/index.mts laver den: lager (D1), miljøvariabler og
   hemmeligheder, klientens IP, waitUntil og hvordan en Otto-kørsel startes (Queue). */

// Et simpelt nøgle/værdi-lager med metadata. worker/store.mts giver det oven på D1.
export type DocStore = {
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
  store: DocStore;
  env: Env;
  ip: string;
  waitUntil(p: Promise<unknown>): void;
  // Start en kørsel, der allerede ligger i kø (agent-runs/<id>). false = startsignalet
  // gik tabt; den planlagte oprydning starter den igen.
  startRun(id: string): Promise<boolean>;
  // Rate limit pr. nøgle (fx et API-tokens id): true = kaldet må gå igennem.
  // Workeren bruger Cloudflares Rate Limiting (60 pr. minut). Udeladt = ingen grænse.
  rateLimit?(key: string): Promise<boolean>;
};
