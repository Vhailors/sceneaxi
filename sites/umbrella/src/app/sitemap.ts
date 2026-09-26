import type { MetadataRoute } from "next";
import { resolveUmbrellaOriginConfiguration } from "@sceneaxi/site-kit";
import { LIVE_OPEN_PATH } from "../lib/live-open.js";

/** The public, crawlable routes. Signed-in surfaces are excluded, as in `robots.ts`. */
const PUBLIC_PATHS = ["/", LIVE_OPEN_PATH, "/profiles", "/engine", "/docs", "/pricing"];

/**
 * An empty sitemap when the deployment has not configured its origin: absolute URLs are
 * mandatory, and deriving them from the request would let a forwarded host rewrite them.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = resolveUmbrellaOriginConfiguration(process.env).origin;
  if (!origin.ok) return [];
  return PUBLIC_PATHS.map((path) => ({ url: `${origin.value}${path === "/" ? "" : path}` }));
}
