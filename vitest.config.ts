import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // `sites/*` are separate single-package workspaces outside the repository-root
      // workspace, so their `link:` dependency is not resolvable from the hermetic
      // root. Aliasing it here lets the gate test the sites' pure logic without adding
      // a framework dependency to the root install.
      "@sceneaxi/site-kit": fileURLToPath(
        new URL("./packages/site-kit/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: [
      "packages/*/test/**/*.test.ts",
      "apps/*/test/**/*.test.ts",
      "tests/**/*.test.ts",
    ],
    // Fail-closed: an empty test surface is a gate failure, never a pass.
    passWithNoTests: false,
  },
});
