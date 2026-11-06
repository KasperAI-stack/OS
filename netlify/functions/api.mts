/* HeyOtto Tasks — API'et på Netlify. Selve API'et står i netlify/lib/api.mts og
   deles med Cloudflare Workers (worker/index.mts). */

import type { Config, Context } from "@netlify/functions";
import { handle } from "../lib/api.mts";
import { netlifyPlatform } from "../lib/netlify-platform.mts";

export default (req: Request, context: Context) => handle(req, netlifyPlatform(req, context));

export const config: Config = {
  path: "/api/*"
};
