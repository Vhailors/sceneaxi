import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BILLING_REFUSE_REASONS, seam } from "@sceneaxi/billing";

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { name: string; sceneaxi: { releaseGroup: string } };

describe("@sceneaxi/billing public seam", () => {
  it("identifies itself exactly as its manifest does", () => {
    expect(seam.name).toBe(manifest.name);
    expect(seam.releaseGroup).toBe(manifest.sceneaxi.releaseGroup);
    expect(seam.releaseGroup).toBe("identity");
  });

  it("is immutable", () => {
    expect(Object.isFrozen(seam)).toBe(true);
  });

  it("freezes its refusal vocabulary with no duplicate reasons", () => {
    expect(Object.isFrozen(BILLING_REFUSE_REASONS)).toBe(true);
    const values = Object.values(BILLING_REFUSE_REASONS);
    expect(new Set(values).size).toBe(values.length);
  });
});
