import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/**
 * SceneAxi packages export TypeScript source (`"." : "./src/index.ts"`) and, per the
 * repo's nodenext module settings, their internal imports carry `.js` specifiers that
 * resolve to `.ts` files. So the bundler needs both: transpile the packages, and map a
 * `.js` specifier onto its TypeScript source.
 */
const nextConfig: NextConfig = {
  // This site keeps its own lockfile, so Next must be told which directory is the
  // deployment root rather than inferring it from the repository lockfile above.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
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
  // The two provider SDKs are loaded through `createRequire` in
  // `src/lib/provider-adapters.ts`, so neither the bundler nor output-file tracing
  // can see the specifiers statically. Listing them keeps them external (required
  // from `node_modules` at runtime rather than bundled), and the trace include
  // pins the packages into the deployed function — without it a traced serverless
  // build ships a lambda missing them, and both construction failures are caught
  // into ordinary provider absence, so a fully configured deployment would report
  // the same state as an unconfigured one.
  serverExternalPackages: ["@neondatabase/serverless", "stripe"],
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/@neondatabase/serverless/**",
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
