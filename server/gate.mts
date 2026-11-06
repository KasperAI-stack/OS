/* HeyOtto Tasks — den globale adgangsvagt (M12). Kører før alt andet i Workeren.

   Lukket som standard. Kun tre ting kan nås:

     API-adressen (API_HOST, fx tasks.heyotto.win)    /ext og /mcp med token. Alt andet 404.
     App-adressen (UI_HOST, fx tasks-ui.heyotto.win)  kun med gyldigt Cloudflare Access-login.
                                                      Ændrende /api-kald kræver desuden
                                                      X-Tasks: 1 og appens egen Origin (CSRF).
     localhost / 127.0.0.1                            lokal udvikling (wrangler dev)
     alle andre adresser                               403

   Svaret er null, når kaldet må fortsætte. */

import { verifyAccess, type CertFetcher } from "./access.mts";

export type GateConfig = { uiHost: string; apiHost: string; team: string; aud: string };

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

const isApiPath = (p: string) => p === "/ext" || p.startsWith("/ext/") || p === "/mcp" || p.startsWith("/mcp/");
const LOCAL = new Set(["localhost", "127.0.0.1"]);

export async function gate(req: Request, cfg: GateConfig, fetcher?: CertFetcher): Promise<Response | null> {
  const url = new URL(req.url);
  const host = url.hostname, path = url.pathname;

  if (LOCAL.has(host)) return null;

  if (cfg.apiHost && host === cfg.apiHost) {
    return isApiPath(path) ? null : json(404, "Ukendt adresse.");
  }

  if (cfg.uiHost && host === cfg.uiHost) {
    if (isApiPath(path)) return json(404, "API'et ligger på https://" + cfg.apiHost + path);
    const access = await verifyAccess(req.headers.get("cf-access-jwt-assertion"), { team: cfg.team, aud: cfg.aud }, fetcher);
    if (!access.ok) return json(403, "Ingen adgang: " + access.why);
    if ((path === "/api" || path.startsWith("/api/")) && req.method !== "GET" && req.method !== "HEAD") {
      if (req.headers.get("x-tasks") !== "1") return json(403, "Ændringer skal komme fra appen selv.");
      const origin = req.headers.get("origin");
      if (origin !== "https://" + cfg.uiHost) return json(403, "Ændringer skal komme fra appen selv.");
    }
    return null;
  }

  return json(403, "Ingen adgang på denne adresse.");
}
