/**
 * The reversal of the sceneaxi#60 option-B stub disposition, made executable.
 *
 * The retired test in this slot asserted the opposite: that the package stayed a
 * bare seam, that no golden path imported it, and that no consumer carried it as
 * a runtime dependency. Ladder Step 6 (sceneaxi#134) reverses that disposition,
 * so this file asserts the new one — and keeps the bound that made the old
 * disposition right in the first place: a real open path, and still no job
 * system (ADR 0023).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as orchestrator from "@sceneaxi/engine-orchestrator";

const repoFile = (path: string) =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

const packageFile = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const GOLDEN_PATH = "tests/e2e/profile-game-scene-golden.test.ts";

describe("engine-orchestrator open-path disposition", () => {
  it("exports a real open path, not only a boundary seam", () => {
    expect(Object.keys(orchestrator).sort()).toEqual([
      "OPEN_PATH_KINDS",
      "ORCHESTRATOR_REFUSALS",
      "ORCHESTRATOR_REFUSAL_REASONS",
      "bootstrapOpenPath",
      "resumeOpenPath",
      "seam",
    ]);
    expect(typeof orchestrator.bootstrapOpenPath).toBe("function");
    expect(typeof orchestrator.resumeOpenPath).toBe("function");
  });

  it("is the way the Game profile's landed scene golden path opens a session", () => {
    const golden = repoFile(GOLDEN_PATH);
    expect(golden).toContain("core.orchestrator.bootstrapOpenPath");
    expect(golden).toContain("core.orchestrator.resumeOpenPath");

    // The profile no longer pins a kernel scene entry point beside it, so the
    // golden path cannot silently revert to opening the kernel directly.
    const profile = repoFile("packages/profile-game/src/index.ts");
    expect(profile).toContain("@sceneaxi/engine-orchestrator");
    expect(profile).not.toContain("openSceneKernelSession");
    expect(golden).not.toContain("openSceneKernelSession");
  });

  it("declares the kernel dependency it actually uses, in both manifests", () => {
    const manifest = JSON.parse(packageFile("package.json")) as {
      dependencies?: Record<string, string>;
    };
    expect(manifest.dependencies).toEqual({
      "@sceneaxi/schemas": "workspace:^",
      "@sceneaxi/engine-kernel": "workspace:^",
    });

    const profileManifest = JSON.parse(
      repoFile("packages/profile-game/package.json"),
    ) as { dependencies?: Record<string, string> };
    expect(profileManifest.dependencies?.["@sceneaxi/engine-orchestrator"]).toBe(
      "workspace:^",
    );
  });

  it("stays bounded: one session per handle, no scheduling machinery", () => {
    const sources = ["src/index.ts", "src/open-path.ts", "src/refusals.ts"].map(
      (path) => packageFile(path),
    );
    expect(sources).toHaveLength(3);

    // A job queue needs deferral, concurrency, or a worker. None of it is here,
    // and this is what stops "orchestrator" from growing into one by drift.
    for (const source of sources) {
      for (const banned of [
        "setTimeout",
        "setInterval",
        "queueMicrotask",
        "new Worker",
        "async ",
        "await ",
        "Promise",
        "node:",
      ]) {
        expect(source, `orchestrator source must not use ${banned}`).not.toContain(
          banned,
        );
      }
    }
  });

  it("records the reversed disposition in its README", () => {
    const readme = packageFile("README.md");
    expect(readme).toContain("Disposition: the real open path above the kernel");
    expect(readme).toContain("supersedes");
    expect(readme).toContain("sceneaxi#60");
    expect(readme).not.toContain("MVP disposition: not in the golden path");
  });
});
