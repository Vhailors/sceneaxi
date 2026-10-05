// Executes real owned implementations against exact pending index exports.
import { defineConfig, mergeConfig } from "vitest/config";
import root from "/home/devuser/Documents/Projects/sceneaxi/vitest.config.ts";
export default mergeConfig(root, defineConfig({ resolve: { alias: [
  { find: /^@sceneaxi\/schemas$/, replacement: "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/implementation-expansion-2026-10-02/versioned-transforms/schema-exports-probe.ts" },
  { find: /^@sceneaxi\/engine-presentation$/, replacement: "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/implementation-expansion-2026-10-02/versioned-transforms/presentation-exports-probe.ts" },
] } }));
