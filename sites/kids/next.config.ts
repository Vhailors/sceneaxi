import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import pageExtensions from "./page-extensions.json";
import securityPolicy from "./security-headers.json";

const nextConfig: NextConfig = {
  pageExtensions,
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  poweredByHeader: false,
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

export default function kidsNextConfig(phase: string): NextConfig {
  const headers =
    phase === "phase-development-server"
      ? securityPolicy.developmentServerHeaders
      : securityPolicy.headers;
  return {
    ...nextConfig,
    async headers() {
      return [{ source: "/:path*", headers }];
    },
  };
}
