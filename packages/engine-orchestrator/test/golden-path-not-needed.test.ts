import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as orchestrator from "@sceneaxi/engine-orchestrator";

const rootFile = (path: string) =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

describe("engine-orchestrator MVP disposition", () => {
  it("remains a seam because both golden paths use kernel-owned sessions directly", () => {
    expect(Object.keys(orchestrator)).toEqual(["seam"]);
    for (const path of [
      "tests/e2e/cli-golden-path.test.ts",
      "tests/e2e/profile-web-golden-path.test.ts",
    ]) {
      const source = rootFile(path);
      expect(source).not.toContain("@sceneaxi/engine-orchestrator");
      expect(source).not.toMatch(/packages\/engine-orchestrator\/src/);
      expect(source).toMatch(/\.core\.kernel\.(open|replay)/);
    }
  });

  it("removes aspirational runtime dependencies from every golden-path consumer", () => {
    for (const path of [
      "packages/engine-orchestrator/package.json",
      "packages/authoring-core/package.json",
      "packages/profile-game/package.json",
      "packages/profile-web/package.json",
      "packages/profile-kids/package.json",
    ]) {
      const manifest = JSON.parse(rootFile(path)) as {
        dependencies?: Record<string, string>;
      };
      expect(
        manifest.dependencies?.["@sceneaxi/engine-orchestrator"],
      ).toBeUndefined();
      if (path === "packages/engine-orchestrator/package.json") {
        expect(
          manifest.dependencies?.["@sceneaxi/engine-kernel"],
        ).toBeUndefined();
        expect(manifest.dependencies).toEqual({
          "@sceneaxi/schemas": "workspace:^",
        });
      }
    }
  });

  it("records the explicit not-needed boundary instead of inventing a queue", () => {
    const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
    expect(readme).toContain("MVP disposition: not in the golden path");
    expect(readme).toContain("No multi-tenant job queue");
  });
});
