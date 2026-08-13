import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  auditModuleCoverage,
  loadDependencyMatrix,
  liveModuleCoverageMarkdown,
  repoRootFromUrl,
} from "./module-coverage.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const root = repoRootFromUrl(import.meta.url);

function document(body: string) {
  return [
    "The Electron 43.2.0 local headless graphics crash is a host limitation.",
    "tests/e2e/desktop-provider-host-golden.test.ts",
    "tests/e2e/desktop-provider-authoring-engine-golden.test.ts",
    "tests/e2e/rarity-provider-desktop-golden.test.ts",
    "tests/e2e/desktop-linux-bridge-golden.test.ts",
    "ASSISTANT_SCULPT_KIDS_DENIED",
    "DESKTOP_ASSISTANT_HOSTED_METERING_UNAVAILABLE",
    "DESKTOP_ASSISTANT_BYO_UNAVAILABLE",
    "DESKTOP_RARITY_PROVIDER_UNAVAILABLE",
    "content-hash-conflict",
    body,
  ].join("\n\n");
}

describe("module coverage audit", () => {
  it("fails missing packages, unknown status, stale paths, and missing role/seam/owner", () => {
    const fixture = mkdtempSync(join(tmpdir(), "sceneaxi-module-coverage-"));
    dirs.push(fixture);
    writeFileSync(join(fixture, "exists.ts"), "export {}\n");
    const markdown = document(`
| Package | Role | Public seam | Verification owner | Status |
|---|---|---|---|---|
| \`@sceneaxi/schemas\` |  | \`missing.ts\` |  | **maybe** |
| \`@sceneaxi/ghost\` | Extra | \`exists.ts\` | \`exists.ts\` | **real** |
`);
    const codes = auditModuleCoverage(markdown, fixture, {
      packages: {
        "@sceneaxi/schemas": { dir: "packages/schemas", allow: [] },
        "@sceneaxi/cli": { dir: "packages/cli", allow: ["@sceneaxi/schemas"] },
      },
      delayed: {
        "@sceneaxi/engine-evidence": { allow: ["@sceneaxi/schemas"] },
      },
    }).map((finding) => finding.code);
    expect(codes).toEqual(expect.arrayContaining([
      "missing-package",
      "extra-package",
      "missing-role",
      "missing-owner",
      "unknown-status",
      "stale-evidence-path",
    ]));
  });

  it("fails when the host limitation, chain sequence, or named refusals are missing", () => {
    const findings = auditModuleCoverage("# empty", root, loadDependencyMatrix(root));
    expect(findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      "missing-host-limitation",
      "missing-chain-sequence",
      "missing-named-refusal",
      "missing-package",
    ]));
  });

  it("passes the live dependency matrix and module-coverage document", () => {
    const findings = auditModuleCoverage(
      liveModuleCoverageMarkdown(root),
      root,
      loadDependencyMatrix(root),
    );
    expect(findings, findings.map((finding) => `${finding.code}: ${finding.message}`).join("\n")).toEqual([]);
  });
});
