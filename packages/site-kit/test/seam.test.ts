import { describe, expect, it } from "vitest";
import { seam } from "@sceneaxi/site-kit";

describe("@sceneaxi/site-kit seam", () => {
  it("names itself and declares the sites release group", () => {
    expect(seam.name).toBe("@sceneaxi/site-kit");
    expect(seam.releaseGroup).toBe("sites");
  });

  it("is frozen", () => {
    expect(Object.isFrozen(seam)).toBe(true);
    expect(() => {
      (seam as { name: string }).name = "other";
    }).toThrow();
  });
});
