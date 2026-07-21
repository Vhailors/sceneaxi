/**
 * Game is the first development consumer of the shared Profile Conformance suite.
 * The suite itself is generic (schemas); this file only points it at profile-game.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PROFILE_ROLLOUT_ORDER_HELD_KEY,
  runProfileConformanceSuite,
} from "@sceneaxi/schemas";
import { claim, conformance, seam } from "@sceneaxi/profile-game";

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as {
  name: string;
  sceneaxi: { releaseGroup: string; corePin: string };
  dependencies: Record<string, string>;
};

describe("@sceneaxi/profile-game Profile Conformance (shared suite)", () => {
  it("passes the shared suite with no suite modifications", () => {
    const result = runProfileConformanceSuite(conformance);
    const failures = result.checks.filter((c) => !c.ok);
    expect(
      failures,
      failures.map((f) => `${f.name}: ${f.detail ?? "failed"}`).join("\n"),
    ).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.suiteVersion).toBe(1);
  });

  it("pins a real core range matching the package manifest and seam", () => {
    expect(typeof manifest.sceneaxi.corePin).toBe("string");
    expect(manifest.sceneaxi.corePin.length).toBeGreaterThan(0);
    expect(manifest.sceneaxi.corePin).toMatch(/[\d*]/);
    expect(seam.corePin).toBe(manifest.sceneaxi.corePin);
    expect(claim.corePin).toBe(manifest.sceneaxi.corePin);
  });

  it("stamps releaseGroup profile (boundary checker + seam)", () => {
    expect(manifest.sceneaxi.releaseGroup).toBe("profile");
    expect(seam.releaseGroup).toBe("profile");
  });

  it("depends on the pinned core packages (kernel + authoring) and not other profiles", () => {
    expect(manifest.dependencies["@sceneaxi/engine-kernel"]).toBe("workspace:^");
    expect(manifest.dependencies["@sceneaxi/authoring-core"]).toBe(
      "workspace:^",
    );
    expect(manifest.dependencies["@sceneaxi/profile-web"]).toBeUndefined();
    expect(manifest.dependencies["@sceneaxi/profile-kids"]).toBeUndefined();
  });

  it("cites profile-rollout-order as open and makes no shipping claim", () => {
    expect(claim.heldKeysCited).toContain(PROFILE_ROLLOUT_ORDER_HELD_KEY);
    expect(claim.shippingClaim).toBe(false);
    expect(claim.claimStatus).toBe("development-consumer");
  });
});
