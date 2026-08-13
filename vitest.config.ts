import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@sceneaxi-internal/desktop-session-project-git": fileURLToPath(
        new URL("./apps/desktop-shell/src/session.ts", import.meta.url),
      ),
      "@sceneaxi-internal/project-git-authority": fileURLToPath(
        new URL("./packages/authoring-core/internal/project-git-authority.ts", import.meta.url),
      ),
      // Subpath aliases MUST precede the root @sceneaxi/site-kit alias: matching is prefix-based, so alphabetizing this block breaks every subpath.
      "@sceneaxi/site-kit/catalog-identity": fileURLToPath(
        new URL("./packages/site-kit/src/catalog-identity.ts", import.meta.url),
      ),
      "@sceneaxi/site-kit/commerce-notice": fileURLToPath(
        new URL("./packages/site-kit/src/commerce-notice.ts", import.meta.url),
      ),
      "@sceneaxi/site-kit/profile-contracts": fileURLToPath(
        new URL("./packages/site-kit/src/profile-contracts.ts", import.meta.url),
      ),
      "@sceneaxi/site-kit/site-session": fileURLToPath(
        new URL("./packages/site-kit/src/site-session.ts", import.meta.url),
      ),
      "@sceneaxi/site-kit/state-panel": fileURLToPath(
        new URL("./packages/site-kit/src/state-panel.ts", import.meta.url),
      ),
      // `sites/*` are separate single-package workspaces outside the repository-root
      // workspace, so their `link:` dependency is not resolvable from the hermetic
      // root. Aliasing it here lets the gate test the sites' pure logic without adding
      // a framework dependency to the root install.
      "@sceneaxi/site-kit": fileURLToPath(
        new URL("./packages/site-kit/src/index.ts", import.meta.url),
      ),
      // `desktop/*` are separate install roots like the sites (ADR 0024): their
      // `link:` dependencies are not resolvable from the hermetic root, so the
      // packages their pure `src/lib/` names are aliased here for the gate.
      "@sceneaxi/desktop-shell": fileURLToPath(
        new URL("./apps/desktop-shell/src/index.ts", import.meta.url),
      ),
      "@sceneaxi/importers": fileURLToPath(
        new URL("./packages/importers/src/index.ts", import.meta.url),
      ),
      "@sceneaxi/desktop-macos": fileURLToPath(
        new URL("./desktop/macos/src/index.ts", import.meta.url),
      ),
      "@sceneaxi/engine-orchestrator": fileURLToPath(
        new URL("./packages/engine-orchestrator/src/index.ts", import.meta.url),
      ),
      "@sceneaxi/engine-presentation": fileURLToPath(
        new URL("./packages/engine-presentation/src/index.ts", import.meta.url),
      ),
      "@sceneaxi/engine-kernel": fileURLToPath(
        new URL("./packages/engine-kernel/src/index.ts", import.meta.url),
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
      "desktop/*/test/**/*.test.ts",
      "tests/**/*.test.ts",
    ],
    // Fail-closed: an empty test surface is a gate failure, never a pass.
    passWithNoTests: false,
  },
});
