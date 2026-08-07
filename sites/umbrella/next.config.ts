import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/**
 * SceneAxi packages export TypeScript source (`"." : "./src/index.ts"`) and, per the
 * repo's nodenext module settings, their internal imports carry `.js` specifiers that
 * resolve to `.ts` files. So the bundler needs both: transpile the packages, and map a
 * `.js` specifier onto its TypeScript source.
 */
const nextConfig: NextConfig = {
  // The site is its own install root, but its `link:` packages live two levels above
  // it. Vercel materializes serverless functions from Next's file traces, so the trace
  // root must contain both the app and those package sources; using the site directory
  // leaves package-directory symlinks in the emitted function instead.
  outputFileTracingRoot: resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
  // `@sceneaxi/engine-presentation` is the umbrella's one engine edge (ADR 0022): it
  // carries the Three presentation core the public live open path draws with. It is not
  // accompanied by `@sceneaxi/engine-kernel`, whose only appearance there is a
  // type-only import that erases before any bundle exists.
  //
  // `@sceneaxi/auth` and `@sceneaxi/billing` are the identity plane (sceneaxi#131),
  // reached only from `src/lib/identity-plane.ts` on the server. They are listed here
  // because they too export TypeScript source; neither ships a provider SDK.
  transpilePackages: [
    "@sceneaxi/site-kit",
    "@sceneaxi/schemas",
    "@sceneaxi/authoring-core",
    "@sceneaxi/engine-presentation",
    "@sceneaxi/auth",
    "@sceneaxi/billing",
  ],
  // The Neon and Stripe SDKs are loaded through Node's own `require` in
  // `src/lib/provider-adapters.ts`, deliberately reached in a form the bundler
  // does not rewrite, so neither the bundler nor output-file tracing sees the
  // specifiers statically. Listing them keeps them external (required from
  // `node_modules` at runtime rather than bundled), and the trace include pins
  // the packages into the deployed function — without it a traced serverless
  // build ships a lambda missing them, and both construction failures are caught
  // into ordinary provider absence, so a fully configured deployment would report
  // the same state as an unconfigured one.
  // Better Auth and pg are statically imported only by the provider host and stay
  // server-external for the same trace reason; no browser graph reaches this module.
  serverExternalPackages: ["@neondatabase/serverless", "better-auth", "pg", "stripe"],
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/@neondatabase/serverless/**",
      "./node_modules/better-auth/**",
      "./node_modules/pg/**",
      "./node_modules/stripe/**",
    ],
  },
  reactStrictMode: true,
  turbopack: {
    resolveExtensions: [".ts", ".tsx", ".mjs", ".js", ".jsx", ".json"],
  },
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
