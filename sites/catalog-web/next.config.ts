import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import pageExtensions from "./page-extensions.json";

/**
 * SceneAxi packages export TypeScript source (`"." : "./src/index.ts"`) and, per the
 * repo's nodenext module settings, their internal imports carry `.js` specifiers that
 * resolve to `.ts` files. So the bundler needs both: transpile the packages, and map a
 * `.js` specifier onto its TypeScript source.
 */
const nextConfig: NextConfig = {
  pageExtensions,
  // The site is its own install root, but its `link:` packages live two levels above
  // it. Vercel materializes serverless functions from Next's file traces, so the trace
  // root must contain both the app and those package sources.
  outputFileTracingRoot: resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
  transpilePackages: ["@sceneaxi/site-kit", "@sceneaxi/schemas", "@sceneaxi/authoring-core"],
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
