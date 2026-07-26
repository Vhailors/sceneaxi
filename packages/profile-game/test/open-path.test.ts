/**
 * The Game profile reads its open-path demo level from the shared policy
 * (sceneaxi#137).
 *
 * This profile drives the most capable open path in the product, so the test
 * that matters most here is the negative one: `demo-driveable` must never be
 * readable as production game readiness, on any part of the surface.
 */
import { describe, expect, it } from "vitest";
import {
  OPEN_PATH_REFUSE_CODES,
  openPathPolicyRowFor,
} from "@sceneaxi/schemas";
import {
  claim,
  evaluateOpenPath,
  openPathPolicy,
  sceneGoldenPath,
} from "@sceneaxi/profile-game";

describe("@sceneaxi/profile-game open-path policy", () => {
  it("exposes the shared policy row, not a locally authored one", () => {
    expect(openPathPolicy).toBe(openPathPolicyRowFor("@sceneaxi/profile-game"));
    expect(openPathPolicy.demoLevel).toBe("demo-driveable");
    expect(openPathPolicy.sessionKind).toBe("scene-kernel-session");
  });

  it("claims no shipping or production readiness anywhere on the surface", () => {
    expect(openPathPolicy.shippingClaim).toBe(false);
    expect(sceneGoldenPath.status.shippingClaim).toBe(false);
    expect(sceneGoldenPath.status.productSurface).toBe("not-shipped");
    // Profile Conformance and the open-path policy grade different things, and
    // neither one is authority to ship.
    expect(claim.shippingClaim).toBe(false);
    expect(claim.claimStatus).toBe("development-consumer");
  });

  it("names committed evidence for the level it reports", () => {
    expect(openPathPolicy.evidence).toBe(
      "tests/e2e/profile-game-scene-golden.test.ts",
    );
  });

  it("allows the kernel-seam operations its row declares", () => {
    for (const operation of openPathPolicy.operations) {
      const decision = evaluateOpenPath(operation);
      expect(decision.ok).toBe(true);
      if (!decision.ok) continue;
      expect(decision.shippingClaim).toBe(false);
      expect(decision.sessionKind).toBe("scene-kernel-session");
    }
  });

  it("refuses commerce-shaped operations and any shipping claim", () => {
    for (const operation of ["publish", "checkout", "deploy", "meter-credits"]) {
      const decision = evaluateOpenPath(operation);
      expect(decision.ok).toBe(false);
      if (decision.ok) continue;
      expect(decision.code).toBe(OPEN_PATH_REFUSE_CODES.operationNotInPolicy);
    }

    const shipping = evaluateOpenPath("open", true);
    expect(shipping.ok).toBe(false);
    if (!shipping.ok) {
      expect(shipping.code).toBe(
        OPEN_PATH_REFUSE_CODES.shippingClaimForbidden,
      );
    }
  });

  it("reaches the same policy through the scene golden-path pin", () => {
    expect(sceneGoldenPath.openPath.policy).toBe(openPathPolicy);
    expect(sceneGoldenPath.openPath.evaluate("replay").ok).toBe(true);
  });
});
