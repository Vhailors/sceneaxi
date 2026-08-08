import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendTo,
  editManifest,
  makeFixture,
  removeFixture,
  runCheck,
  writeTo,
} from "../helpers/fixture.ts";

/**
 * Injected-violation regressions for the `desktop/` tier (ADR 0024).
 *
 * `check-boundaries.mjs` and `check-syntax.mjs` were extended to walk `desktop/`,
 * and `check-desktop.mjs` joined the gate. Extending a checker without extending
 * its injection fixtures would leave the new coverage unproven, so each test below
 * injects exactly one forbidden change into a throwaway copy of the tree and
 * asserts the relevant checker fails on that violation alone — and the charted
 * permissions are asserted beside their denials, so the widening and its bound are
 * proven together.
 */
describe("desktop tier — injected violations", () => {
  let fx: string;

  beforeEach(() => {
    fx = makeFixture();
  });

  afterEach(() => {
    removeFixture(fx);
  });

  it("control: the unmodified tree passes all three checkers", () => {
    for (const script of ["check-boundaries.mjs", "check-syntax.mjs", "check-desktop.mjs"] as const) {
      const res = runCheck(fx, script);
      expect(res.status, `${script} stderr: ${res.stderr}`).toBe(0);
    }
  });

  it("boundary check covers desktop/ and fails when the app is missing from the matrix", () => {
    editManifest(fx, "docs/dependency-matrix.json", (matrix) => {
      const packages = matrix["packages"] as Record<string, unknown>;
      delete packages["@sceneaxi/desktop-linux"];
    });
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "@sceneaxi/desktop-linux exists on disk but is not listed in the dependency matrix",
    );
  });

  it("boundary check covers the macOS packaging root", () => {
    editManifest(fx, "docs/dependency-matrix.json", (matrix) => {
      const packages = matrix["packages"] as Record<string, unknown>;
      delete packages["@sceneaxi/desktop-macos"];
    });
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "@sceneaxi/desktop-macos exists on disk but is not listed in the dependency matrix",
    );
  });

  it("boundary check denies the macOS packaging root the identity plane", () => {
    editManifest(fx, "desktop/macos/package.json", (manifest) => {
      manifest.dependencies = {
        ...manifest.dependencies,
        "@sceneaxi/auth": "link:../../packages/auth",
      };
    });
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "@sceneaxi/desktop-macos: dependency @sceneaxi/auth is DENIED by the matrix",
    );
  });

  it("boundary check allows the desktop app's charted engine edges", () => {
    // ADR 0024: the packaged desktop app draws through the presentation seam and
    // opens kernel sessions through the orchestrator. These edges must pass.
    appendTo(
      fx,
      "desktop/linux/src/index.ts",
      '\nimport "@sceneaxi/engine-presentation";\nimport "@sceneaxi/engine-orchestrator";\n',
    );
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status, `stderr: ${res.stderr}`).toBe(0);
  });

  it("boundary check denies the desktop app a profile package", () => {
    appendTo(fx, "desktop/linux/src/index.ts", '\nimport "@sceneaxi/profile-game";\n');
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("imports @sceneaxi/profile-game, DENIED by the matrix");
  });

  it("boundary check denies the desktop app the identity plane", () => {
    editManifest(fx, "desktop/linux/package.json", (manifest) => {
      manifest.dependencies = {
        ...manifest.dependencies,
        "@sceneaxi/auth": "link:../../packages/auth",
      };
    });
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("@sceneaxi/desktop-linux: dependency @sceneaxi/auth is DENIED by the matrix");
  });

  it("Kids isolation holds in the desktop tier", () => {
    appendTo(fx, "desktop/linux/src/index.ts", '\nimport "@sceneaxi/profile-kids";\n');
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("imports Kids package @sceneaxi/profile-kids — Kids boundary violation");
  });

  it("syntax check covers desktop/ sources", () => {
    writeTo(fx, "desktop/linux/src/lib/broken.ts", "export const = broken syntax here\n");
    const res = runCheck(fx, "check-syntax.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("desktop/linux/src/lib/broken.ts");
  });

  // Electron, its bundler, and its packaging toolchain each move the hermetic root
  // lockfile and the gate runtime, which is exactly what the separate install root
  // exists to prevent — so each is denied at the root by name.
  it.each(["electron", "electron-builder", "esbuild"])(
    "desktop check fails when '%s' leaks into the hermetic root manifest",
    (dep) => {
      editManifest(fx, "package.json", (manifest) => {
        (manifest as { devDependencies?: Record<string, string> }).devDependencies = {
          ...(manifest as { devDependencies?: Record<string, string> }).devDependencies,
          [dep]: "^0.0.1",
        };
      });
      const res = runCheck(fx, "check-desktop.mjs");
      expect(res.status).toBe(1);
      expect(res.stderr).toContain(`root package.json declares '${dep}' in devDependencies`);
      expect(res.stderr).toContain("stay in the desktop/ tier");
    },
  );

  it("desktop check fails when the root workspace globs desktop/", () => {
    appendTo(fx, "pnpm-workspace.yaml", '  - "desktop/*"\n');
    const res = runCheck(fx, "check-desktop.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("desktop apps are separate install roots");
  });

  it("desktop check fails on an Electron import outside src/electron/", () => {
    appendTo(fx, "desktop/linux/src/lib/bridge.ts", '\nimport "electron";\n');
    const res = runCheck(fx, "check-desktop.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("only desktop/linux/src/electron/ may import Electron");
  });

  it("desktop check confines the concrete provider adapter to the privileged host", () => {
    appendTo(
      fx,
      "desktop/linux/src/lib/bridge.ts",
      '\nimport "@sceneaxi/provider-openrouter";\n',
    );
    const res = runCheck(fx, "check-desktop.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "only desktop/linux/src/electron/ may import a desktop provider adapter",
    );
  });

  it("desktop check refuses re-export laundering of the privileged host", () => {
    // Naming neither Electron nor the adapter still pulls both into an unprivileged
    // bundle, so reaching into src/electron/ from outside it is refused on its own.
    appendTo(
      fx,
      "desktop/linux/src/renderer/viewport.ts",
      '\nexport { createDesktopOpenRouterProviderSession } from "../electron/provider-runtime.js";\n',
    );
    const res = runCheck(fx, "check-desktop.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("nothing outside desktop/linux/src/electron/ may reach the privileged host");
  });

  it("desktop check fails on a workspace: specifier — install roots need link:", () => {
    editManifest(fx, "desktop/linux/package.json", (manifest) => {
      manifest.dependencies = {
        ...manifest.dependencies,
        "@sceneaxi/schemas": "workspace:^",
      };
    });
    const res = runCheck(fx, "check-desktop.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("must use a 'link:' specifier");
  });

  it("desktop check fails on a missing required file", () => {
    rmSync(join(fx, "desktop/linux/electron-builder.yml"));
    const res = runCheck(fx, "check-desktop.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("is missing required file 'electron-builder.yml'");
  });

  it("desktop check fails on committed secret-shaped material", () => {
    // The planted value must trip the desktop checker's 8+ webhook-secret pattern
    // while staying invisible to the repo-wide scan, whose whsec rule starts at 16
    // characters — a longer body would fail tests/contracts/no-committed-secrets.
    writeTo(fx, "desktop/linux/notes.txt", "whsec_abcdefgh\n");
    const res = runCheck(fx, "check-desktop.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("contains secret-shaped material");
  });

  it("desktop check refuses an empty tier rather than passing on it", () => {
    rmSync(join(fx, "desktop"), { recursive: true, force: true });
    const res = runCheck(fx, "check-desktop.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("refusing to pass on a missing tier");
  });

  it("publish-ready check still covers the desktop manifest", () => {
    editManifest(fx, "desktop/linux/package.json", (manifest) => {
      (manifest as { version?: string }).version = "1.0.0";
    });
    const res = runCheck(fx, "check-publish-ready.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("@sceneaxi/desktop-linux is version '1.0.0'");
  });
});
