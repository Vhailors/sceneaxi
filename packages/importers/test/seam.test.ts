import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { proposeSceneDocumentImport, seam } from "@sceneaxi/importers";

// SAFETY: The repository-owned package.json is the package manifest fixture, with name and sceneaxi metadata checked against its public seam below.
const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { name: string; sceneaxi: { releaseGroup: string } };

describe("@sceneaxi/importers public seam", () => {
  it("identifies itself exactly as its manifest does", () => {
    expect(seam.name).toBe(manifest.name);
    expect(seam.releaseGroup).toBe(manifest.sceneaxi.releaseGroup);
  });

  it("is immutable", () => {
    expect(isPackageSeam(seam)).toBe(true);
    expect(Object.isFrozen(seam)).toBe(true);
  });

  it("exports a real external-content adapter beyond the package seam", () => {
    expect(isDocumentImporter(proposeSceneDocumentImport)).toBe(true);
  });
});

function isPackageSeam(value: unknown): value is typeof seam { return isBoundaryObjectValue(value); }

function isDocumentImporter(value: unknown): value is typeof proposeSceneDocumentImport { return isBoundaryCallableValue(value); }

type BoundaryObjectValue = object | null;

type BoundaryCallableValue = (...args: never[]) => void;

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}

function isBoundaryCallableValue<Input>(value: Input): value is Input & BoundaryCallableValue & object {
  return typeof value === "function";
}
