import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHAIN_REFUSALS,
  CHAIN_SEQUENCE,
  HOST_GRAPHICS_LIMITATION,
  auditModuleCoverage,
  loadDependencyMatrix,
  liveModuleCoverageMarkdown,
  matrixPackageNames,
  repoRootFromUrl,
} from "../docs/module-coverage.ts";

const root = repoRootFromUrl(import.meta.url);
const matrix = loadDependencyMatrix(root);
const markdown = liveModuleCoverageMarkdown(root);

describe("module coverage end-to-end evidence", () => {
  it("accounts for every dependency-matrix package with role, edges, seam, owner, and status", () => {
    const findings = auditModuleCoverage(markdown, root, matrix);
    expect(findings, findings.map((finding) => `${finding.code}: ${finding.message}`).join("\n")).toEqual([]);
    expect(matrixPackageNames(matrix).length).toBeGreaterThan(20);
    for (const name of matrixPackageNames(matrix)) {
      const entry = matrix.packages[name] ?? matrix.delayed?.[name];
      expect(entry, name).toBeDefined();
      expect(Array.isArray(entry?.allow), name).toBe(true);
    }
  });

  it("records the provider-authoring-desktop-engine sequence, refusals, and host limitation", () => {
    expect(markdown).toContain(HOST_GRAPHICS_LIMITATION);
    expect(markdown).toMatch(/host limitation/i);
    for (const path of CHAIN_SEQUENCE) {
      expect(markdown).toContain(path);
      expect(existsSync(resolve(root, path)), path).toBe(true);
    }
    for (const refusal of CHAIN_REFUSALS) {
      expect(markdown).toContain(refusal);
    }
    expect(markdown).toContain("sceneaxi#1");
    expect(markdown).not.toMatch(/kids-safe and marketplace-ready/i);
  });
});
