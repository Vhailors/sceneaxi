import type { MetadataRoute } from "next";
import { resolveUmbrellaOriginConfiguration } from "@sceneaxi/site-kit";

/**
 * Crawl policy. Public marketing and documentation routes are crawlable; the signed-in
 * surfaces and every API route are not. The sitemap is advertised only when the
 * deployment names its own origin, because a sitemap URL has to be absolute and this
 * file must never derive it from a request `Host`.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = resolveUmbrellaOriginConfiguration(process.env).origin;
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/account", "/editor", "/login"],
      },
    ],
    ...(origin.ok ? { sitemap: `${origin.value}/sitemap.xml` } : {}),
  };
}
