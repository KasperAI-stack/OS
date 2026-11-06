/* HeyOtto Tasks — tjek af Cloudflare Access' JWT (M12, som Studios server/access.ts).

   Cloudflare Access står foran appens adresse og logger dig ind (e-mail-kode eller Google).
   Hvert kald, der slipper igennem, har headeren Cf-Access-Jwt-Assertion. Tasks tjekker selv
   JWT'en, så intet kommer ind, selv hvis Access er slået forkert til:

     alg = RS256, gyldig signatur med Access-teamets offentlige nøgle (hentet fra
     https://<team>/cdn-cgi/access/certs, cachet pr. kid, hentet igen ved ukendt kid højst
     én gang i minuttet), aud indeholder applikationens AUD-tag, iss = https://<team>,
     exp ikke passeret.

   Fail closed: mangler team eller AUD, er svaret altid "nej". Signaturen tjekkes med
   Web Crypto (Workers har ikke Nodes crypto.verify med JWK). */

export type AccessConfig = { team: string; aud: string };
export type CertFetcher = (url: string) => Promise<{ keys?: JsonWebKey[] }>;
export type AccessResult = { ok: true; email: string } | { ok: false; why: string };

const REFETCH_MS = 60_000;
let cache: { team: string; keys: Map<string, CryptoKey>; fetchedAt: number } | null = null;

const defaultFetcher: CertFetcher = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error("Access-nøglerne kunne ikke hentes (" + res.status + ").");
  return await res.json() as { keys?: JsonWebKey[] };
};

function b64urlBytes(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
const b64urlJson = (s: string) => JSON.parse(new TextDecoder().decode(b64urlBytes(s)));

async function keyFor(team: string, kid: string, fetcher: CertFetcher, now: number): Promise<CryptoKey | null> {
  if (cache?.team === team && cache.keys.has(kid)) return cache.keys.get(kid)!;
  if (cache?.team === team && now - cache.fetchedAt < REFETCH_MS) return null;   // ukendt kid, hentet for nylig
  const { keys = [] } = await fetcher(`https://${team}/cdn-cgi/access/certs`);
  const map = new Map<string, CryptoKey>();
  for (const jwk of keys) {
    const id = (jwk as any).kid;
    if (typeof id !== "string" || jwk.kty !== "RSA") continue;
    map.set(id, await crypto.subtle.importKey("jwk", { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]));
  }
  cache = { team, keys: map, fetchedAt: now };
  return map.get(kid) || null;
}

export async function verifyAccess(jwt: string | null, cfg: AccessConfig, fetcher: CertFetcher = defaultFetcher, now = Date.now()): Promise<AccessResult> {
  if (!cfg.team || !cfg.aud) return { ok: false, why: "Access er ikke sat op (CF_ACCESS_TEAM_DOMAIN og CF_ACCESS_AUD mangler)." };
  if (!jwt) return { ok: false, why: "Mangler Access-login." };
  const parts = jwt.split(".");
  if (parts.length !== 3) return { ok: false, why: "Ugyldig Access-JWT." };
  let header: any, claims: any;
  try { header = b64urlJson(parts[0]); claims = b64urlJson(parts[1]); } catch { return { ok: false, why: "Ugyldig Access-JWT." }; }
  if (header.alg !== "RS256" || typeof header.kid !== "string") return { ok: false, why: "Forkert algoritme." };

  let key: CryptoKey | null;
  try { key = await keyFor(cfg.team, header.kid, fetcher, now); } catch (e) { return { ok: false, why: e instanceof Error ? e.message : String(e) }; }
  if (!key) return { ok: false, why: "Ukendt nøgle (kid)." };
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlBytes(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!valid) return { ok: false, why: "Forkert signatur." };

  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(cfg.aud)) return { ok: false, why: "Forkert aud." };
  if (claims.iss !== `https://${cfg.team}`) return { ok: false, why: "Forkert iss." };
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= now) return { ok: false, why: "Access-login er udløbet." };
  return { ok: true, email: typeof claims.email === "string" ? claims.email : "" };
}

// Kun til tests: glem de hentede nøgler
export const resetAccessCache = () => { cache = null; };
