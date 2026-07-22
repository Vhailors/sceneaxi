import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as kernel from "@sceneaxi/engine-kernel";

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { name: string; sceneaxi: { releaseGroup: string } };

describe("@sceneaxi/engine-kernel public seam", () => {
  it("identifies itself exactly as its manifest does", () => {
    expect(kernel.seam.name).toBe(manifest.name);
    expect(kernel.seam.releaseGroup).toBe(manifest.sceneaxi.releaseGroup);
  });

  it("is immutable", () => {
    expect(typeof kernel.seam).toBe("object");
    expect(Object.isFrozen(kernel.seam)).toBe(true);
  });

  it("keeps canonical digest computation behind the command/snapshot seam", () => {
    expect("computeDigest" in kernel).toBe(false);
  });
});
