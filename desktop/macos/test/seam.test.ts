import { describe, expect, it } from "vitest";
import { seam } from "@sceneaxi/desktop-macos";

describe("desktop-macos public seam", () => {
  it("exports the frozen desktop release-group identity", () => {
    expect(seam).toEqual({ name: "@sceneaxi/desktop-macos", releaseGroup: "desktop" });
    expect(Object.isFrozen(seam)).toBe(true);
  });
});
