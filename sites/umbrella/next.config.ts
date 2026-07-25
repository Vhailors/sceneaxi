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
  transpilePackages: [
    "@sceneaxi/site-kit",
    "@sceneaxi/schemas",
    "@sceneaxi/authoring-core",
    "@sceneaxi/engine-presentation",
  ],
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
