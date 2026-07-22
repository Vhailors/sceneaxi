import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { seam } from "@sceneaxi/profile-web";

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { name: string; sceneaxi: { releaseGroup: string; corePin: string } };

describe("@sceneaxi/profile-web public seam", () => {
  it("identifies itself exactly as its manifest does", () => {
    expect(seam.name).toBe(manifest.name);
    expect(seam.releaseGroup).toBe(manifest.sceneaxi.releaseGroup);
  });

  it("is immutable", () => {
    expect(typeof seam).toBe("object");
    expect(Object.isFrozen(seam)).toBe(true);
  });

  it("pins the core train exactly as its manifest does", () => {
    expect(seam.corePin).toBe(manifest.sceneaxi.corePin);
  });
});
