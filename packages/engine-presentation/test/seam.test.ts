import { readFileSync } from "node:fs";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  createNullPresentationRuntime,
  seam,
  type PresentationCaptureResult,
  type PresentationRuntime,
} from "@sceneaxi/engine-presentation";

// SAFETY: The repository-owned package.json is the package manifest fixture, with name and sceneaxi metadata checked against its public seam below.
const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { name: string; sceneaxi: { releaseGroup: string } };

describe("@sceneaxi/engine-presentation public seam", () => {
  it("identifies itself exactly as its manifest does", () => {
    expect(seam.name).toBe(manifest.name);
    expect(seam.releaseGroup).toBe(manifest.sceneaxi.releaseGroup);
  });

  it("is immutable", () => {
    expect(isPackageSeam(seam)).toBe(true);
    expect(Object.isFrozen(seam)).toBe(true);
  });

  it("exports the null Presentation Runtime factory", () => {
    expect(isNullRuntimeFactory(createNullPresentationRuntime)).toBe(true);
  });

  it("keeps capture results backend-neutral and nullable", () => {
    expectTypeOf<ReturnType<PresentationRuntime["capture"]>>().toEqualTypeOf<
      PresentationCaptureResult | null
    >();
  });
});

function isPackageSeam(value: unknown): value is typeof seam { return isBoundaryObjectValue(value); }

function isNullRuntimeFactory(value: unknown): value is typeof createNullPresentationRuntime { return isBoundaryCallableValue(value); }

type BoundaryObjectValue = object | null;

type BoundaryCallableValue = (...args: never[]) => void;

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}

function isBoundaryCallableValue<Input>(value: Input): value is Input & BoundaryCallableValue & object {
  return typeof value === "function";
}
