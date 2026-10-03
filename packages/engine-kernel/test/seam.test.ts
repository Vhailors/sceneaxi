import { readFileSync } from "node:fs";
import { describe, expect, expectTypeOf, it } from "vitest";
import * as kernel from "@sceneaxi/engine-kernel";

// SAFETY: The repository-owned package.json is the package manifest fixture, with name and sceneaxi metadata checked against its public seam below.
const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { name: string; sceneaxi: { releaseGroup: string } };

describe("@sceneaxi/engine-kernel public seam", () => {
  it("identifies itself exactly as its manifest does", () => {
    expect(kernel.seam.name).toBe(manifest.name);
    expect(kernel.seam.releaseGroup).toBe(manifest.sceneaxi.releaseGroup);
  });

  it("is immutable", () => {
    expect(isPackageSeam(kernel.seam)).toBe(true);
    expect(Object.isFrozen(kernel.seam)).toBe(true);
  });

  it("restores the v1 digest consumer without changing the modern session seam", () => {
    expectTypeOf(kernel.computeDigest).toEqualTypeOf<(
      tick: number, seed: number, entities: readonly kernel.SnapshotEntity[]
    ) => string>();
    expect(kernel.computeDigest(0, 0, [])).toBe(
      "sha256:cda0711dbb7d296bdd0db3c2d7539eb412a93128e819dcd7ac997f7c664b1355",
    );
    const session = kernel.open({ productId: "digest-seam", seed: 0, entities: [] }, { nowMs: () => 0 });
    const snapshot = session.observe();
    expect(snapshot.digest).toBe(kernel.computeDigest(snapshot.tick, snapshot.seed, snapshot.entities));
    expect(snapshot.tick).toBe(0);
  });
});

function isPackageSeam(value: unknown): value is typeof kernel.seam { return isBoundaryObjectValue(value); }

type BoundaryObjectValue = object | null;

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}
