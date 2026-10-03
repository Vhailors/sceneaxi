import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as desktopShell from "@sceneaxi/desktop-shell";

const { seam } = desktopShell;

// SAFETY: This is the checked-in owning package manifest, whose name and sceneaxi.releaseGroup fields define the seam identity tested below.
const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { name: string; sceneaxi: { releaseGroup: string } };

describe("@sceneaxi/desktop-shell public seam", () => {
  it("identifies itself exactly as its manifest does", () => {
    expect(seam.name).toBe(manifest.name);
    expect(seam.releaseGroup).toBe(manifest.sceneaxi.releaseGroup);
  });

  it("is immutable", () => {
    expect(isSeamObject(seam)).toBe(true);
    expect(Object.isFrozen(seam)).toBe(true);
  });

  it("does not expose Git mutation authority helpers", () => {
    expect(Object.hasOwn(desktopShell, "bindDesktopSessionProjectGitAuthority")).toBe(false);
    expect(Object.hasOwn(desktopShell, "stageDesktopSessionProjectGitPaths")).toBe(false);
    expect(Object.hasOwn(desktopShell, "prepareDesktopSessionProjectGitCommit")).toBe(false);
  });
});

function isSeamObject<Value>(value: Value): value is Value & (object | null) {
  return isBoundaryObjectValue(value);
}

type BoundaryObjectValue = object | null;

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}
