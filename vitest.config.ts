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
    // Several suites here are process-level rather than unit-level: the
    // injected-violation suites copy the tree and spawn a real gate checker
    // (`check-syntax` alone parses every source file with the TypeScript
    // compiler), and the `bin-smoke` suites spawn the built workspace binaries.
    // Vitest's 5s default makes those a wall-clock budget, so the same
    // assertions go red on a slower or contended machine — a gate failing on
    // host speed rather than on a violation. This raises the budget only: it
    // skips no test and allows no failure, and a suite that truly hangs still
    // fails the gate.
    //
    // `hookTimeout` carries the same allowance because the expensive half of
    // those suites is their setup, not their body: `makeFixture()` copies the
    // whole tree per test from `beforeEach`. Leaving it at the 10s default
    // would reopen the identical host-speed failure through the setup path.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    include: [
      "packages/*/test/**/*.test.ts",
      "apps/*/test/**/*.test.ts",
      "tests/**/*.test.ts",
    ],
    // Fail-closed: an empty test surface is a gate failure, never a pass.
    passWithNoTests: false,
  },
});
