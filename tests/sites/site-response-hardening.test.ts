/**
 * Response hardening for the three deployable non-Kids sites.
 *
 * Kids owns its own, stricter policy (`tests/sites/kids-surface.test.ts`). The umbrella and
 * both catalogs share one baseline: no framing, no `<base>` rewrite, no plugins, no
 * `X-Powered-By`. The umbrella additionally owns its crawl policy, branded 404 and error
 * pages, and the same-origin proof on its checkout POST.
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SITES = ["umbrella", "catalog-game", "catalog-web"] as const;

const read = (path: string) =>
  readFileSync(new URL(`../../sites/${path}`, import.meta.url), "utf8");

type HeaderPolicy = { readonly headers: readonly { key: string; value: string }[] };

describe.each(SITES)("sites/%s response headers", (site) => {
  const policy = JSON.parse(read(`${site}/security-headers.json`)) as HeaderPolicy;
  const header = (key: string) => policy.headers.find((entry) => entry.key === key)?.value;

  it("forbids framing, base rewriting, plugins, and MIME sniffing", () => {
    const csp = header("Content-Security-Policy") ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(header("X-Frame-Options")).toBe("DENY");
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("does not restrict form targets, which the hosted checkout redirect needs", () => {
    expect(header("Content-Security-Policy")).not.toContain("form-action");
  });

  it("applies the policy to every route and drops X-Powered-By", () => {
    const config = read(`${site}/next.config.ts`);
    expect(config).toContain('import securityPolicy from "./security-headers.json";');
    expect(config).toContain("poweredByHeader: false");
    expect(config).toMatch(
      /headers\(\) \{\s*return \[\{ source: "\/:path\*", headers: securityPolicy\.headers \}\];/,
    );
  });
});

describe("the two catalogs share one header policy", () => {
  it("is byte-identical between catalog-game and catalog-web", () => {
    expect(read("catalog-web/security-headers.json")).toBe(
      read("catalog-game/security-headers.json"),
    );
    expect(read("catalog-web/next.config.ts")).toBe(read("catalog-game/next.config.ts"));
  });
});

describe("umbrella crawl policy and fallback pages", () => {
  it("ships branded not-found and error boundaries", () => {
    for (const file of ["not-found.tsx", "error.tsx", "robots.ts", "sitemap.ts"]) {
      expect(existsSync(new URL(`../../sites/umbrella/src/app/${file}`, import.meta.url))).toBe(
        true,
      );
    }
    const error = read("umbrella/src/app/error.tsx");
    expect(error.startsWith('"use client";')).toBe(true);
    // Only the digest is shown; the message can carry server detail.
    expect(error).not.toMatch(/error\.message/);
    // A client component compiled for the browser: no imports, and no re-attempt control.
    expect(error).not.toMatch(/^import\s/m);
    expect(error).not.toMatch(/<button|reset/);
  });

  it("keeps signed-in surfaces and API routes out of crawlers", () => {
    const robots = read("umbrella/src/app/robots.ts");
    for (const path of ["/api/", "/account", "/editor", "/login"]) {
      expect(robots).toContain(`"${path}"`);
    }
    for (const file of ["login/page.tsx", "account/page.tsx", "editor/layout.tsx"]) {
      expect(read(`umbrella/src/app/${file}`)).toContain(
        "robots: { index: false, follow: false }",
      );
    }
  });

  it("derives sitemap URLs from the configured origin, never a request host", () => {
    for (const file of ["robots.ts", "sitemap.ts"]) {
      const source = read(`umbrella/src/app/${file}`);
      expect(source).toContain("resolveUmbrellaOriginConfiguration(process.env)");
      expect(source).not.toContain("next/headers");
      expect(source).toMatch(/export default function (robots|sitemap)\(\)/);
    }
  });
});

describe("umbrella checkout", () => {
  it("verifies the same-origin form proof before reading the form", () => {
    const route = read("umbrella/src/app/api/checkout/route.ts");
    const proof = route.indexOf("verifyLoginRequestOrigin(");
    const formRead = route.indexOf("request.formData()");
    expect(proof).toBeGreaterThan(-1);
    expect(formRead).toBeGreaterThan(proof);
    // A refused proof answers by name before any field is read, like the login flow.
    expect(route).toMatch(/if \(!requestOrigin\.ok\) \{\s*return refusalResponse\(\s*request,\s*requestOrigin\.reason/);
    // Refusal redirects are same-site relative; nothing is derived from the request host.
    expect(route).not.toMatch(/new URL\([^)]*request\.url\)\s*;?\s*$/m);
    expect(route).toContain("headers: { Location: `${signedOut ? \"/login\" : \"/pricing\"}?${query.toString()}` }");
  });
});
