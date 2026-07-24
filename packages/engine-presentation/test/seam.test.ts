import { readFileSync } from "node:fs";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  createNullPresentationRuntime,
  seam,
  type PresentationCaptureResult,
  type PresentationRuntime,
} from "@sceneaxi/engine-presentation";

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { name: string; sceneaxi: { releaseGroup: string } };

describe("@sceneaxi/engine-presentation public seam", () => {
  it("identifies itself exactly as its manifest does", () => {
    expect(seam.name).toBe(manifest.name);
    expect(seam.releaseGroup).toBe(manifest.sceneaxi.releaseGroup);
  });

  it("is immutable", () => {
    expect(typeof seam).toBe("object");
    expect(Object.isFrozen(seam)).toBe(true);
  });

  it("exports the null Presentation Runtime factory", () => {
    expect(typeof createNullPresentationRuntime).toBe("function");
  });

  it("keeps capture results backend-neutral and nullable", () => {
    expectTypeOf<ReturnType<PresentationRuntime["capture"]>>().toEqualTypeOf<
      PresentationCaptureResult | null
    >();
  });
});
