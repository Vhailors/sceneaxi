/**
 * Structural seams of the `desktop/` tier (ADR 0024).
 *
 * `pnpm check:desktop` owns the fail-closed structure; what belongs here is what a
 * checker script cannot state: the public seam is importable and frozen, the tier
 * really is a standalone install root, and the packaging surface the docs promise
 * (scripts, artifact naming, smoke proof) exists as declared.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DESKTOP_BRIDGE_ACTIONS,
  DESKTOP_BRIDGE_CHANNEL,
  DESKTOP_BRIDGE_GLOBAL,
  DESKTOP_OPEN_PLACEMENTS,
  seam,
} from "../../desktop/linux/src/index.ts";

const read = (rel: string): string =>
  readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

describe("desktop-linux seam", () => {
  it("exports a frozen seam with the desktop release group", () => {
    expect(seam).toEqual({ name: "@sceneaxi/desktop-linux", releaseGroup: "desktop" });
    expect(Object.isFrozen(seam)).toBe(true);
  });

  it("keeps the bridge vocabulary closed and frozen", () => {
    expect(Object.isFrozen(DESKTOP_BRIDGE_ACTIONS)).toBe(true);
    expect(DESKTOP_BRIDGE_ACTIONS).toEqual([
      "handshake",
      "scene",
      "open-path",
      "assistant",
      "authoring",
      "frame-report",
    ]);
    expect(DESKTOP_BRIDGE_CHANNEL).toBe("sceneaxi:desktop-bridge");
    expect(DESKTOP_BRIDGE_GLOBAL).toBe("sceneaxiDesktopLinux");
    expect(Object.isFrozen(DESKTOP_OPEN_PLACEMENTS)).toBe(true);
    expect(DESKTOP_OPEN_PLACEMENTS).toHaveLength(3);
  });
});

describe("desktop-linux install root", () => {
  it("is a valid standalone pnpm workspace rooted at itself", () => {
    expect(read("desktop/linux/pnpm-workspace.yaml")).toMatch(
      /^packages:\s*\n\s*-\s*["']?\.["']?\s*$/m,
    );
  });

  it("keeps desktop/ out of the root pnpm workspace, so the hermetic lockfile never moves", () => {
    const workspace = read("pnpm-workspace.yaml");
    expect(/^\s*-\s*["']?desktop\//m.test(workspace)).toBe(false);
  });

  it("reaches every workspace package through link:, and Electron only tier-locally", () => {
    const manifest = JSON.parse(read("desktop/linux/package.json")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      main: string;
    };
    for (const [dep, spec] of Object.entries(manifest.dependencies)) {
      if (dep.startsWith("@sceneaxi/")) expect(spec).toMatch(/^link:\.\.\/\.\.\//);
    }
    expect(manifest.devDependencies["electron"]).toBeDefined();
    expect(manifest.main).toBe("dist/main.cjs");

    const root = JSON.parse(read("package.json")) as {
      devDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    expect(root.devDependencies?.["electron"]).toBeUndefined();
    expect(root.dependencies?.["electron"]).toBeUndefined();
  });

  it("declares the packaging surface the docs promise", () => {
    const manifest = JSON.parse(read("desktop/linux/package.json")) as {
      scripts: Record<string, string>;
    };
    for (const script of ["build", "start", "dist", "smoke", "typecheck"]) {
      expect(manifest.scripts[script]).toBeDefined();
    }
    const builder = read("desktop/linux/electron-builder.yml");
    expect(builder).toContain("AppImage");
    expect(builder).toContain("deb");
    expect(builder).toContain(
      "artifactName: SceneAxi-Engine-Desktop-${version}-linux-${arch}.${ext}",
    );
    // Linux is the only packaged target: no Windows or macOS target is declared.
    expect(builder).not.toMatch(/^win:|^mac:/m);
  });

  it("prints a smoke proof that asserts real digests and a real frame, not a banner", () => {
    const smoke = read("desktop/linux/scripts/smoke.mjs");
    expect(smoke).toContain("kernel session did not advance");
    expect(smoke).toContain("frame report is not the Three core");
  });
});
