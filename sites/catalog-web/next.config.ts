import type { NextConfig } from "next";

/**
 * `@sceneaxi/site-kit` exports TypeScript source (`"." : "./src/index.ts"`), which is
 * how every package in this repo is consumed, so Next must transpile it rather than
 * expect a built `dist`.
 */
const nextConfig: NextConfig = {
  transpilePackages: ["@sceneaxi/site-kit", "@sceneaxi/schemas", "@sceneaxi/authoring-core"],
  reactStrictMode: true,
  // The editor session reads and writes a workspace on the server; nothing in the
  // site's server-only modules may be bundled for the browser.
  serverExternalPackages: [],
};

export default nextConfig;
