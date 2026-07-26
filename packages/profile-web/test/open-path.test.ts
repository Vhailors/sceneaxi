/**
 * The Web Experience profile reads its open-path demo level from the shared
 * policy rather than declaring one (sceneaxi#137). Tested through the public
 * package name, like every other seam test in this repo.
 */
import { describe, expect, it } from "vitest";
import {
  OPEN_PATH_REFUSE_CODES,
  openPathPolicyRowFor,
} from "@sceneaxi/schemas";
import {
  evaluateOpenPath,
  mvpGoldenPath,
  openPathPolicy,
} from "@sceneaxi/profile-web";

describe("@sceneaxi/profile-web open-path policy", () => {
  it("exposes the shared policy row, not a locally authored one", () => {
    expect(openPathPolicy).toBe(openPathPolicyRowFor("@sceneaxi/profile-web"));
    expect(openPathPolicy.demoLevel).toBe("demo-driveable");
    expect(openPathPolicy.sessionKind).toBe("kernel-session");
  });

  it("claims no shipping readiness anywhere on the surface", () => {
    expect(openPathPolicy.shippingClaim).toBe(false);
    expect(mvpGoldenPath.status.shippingClaim).toBe(false);
    expect(mvpGoldenPath.status.productSurface).toBe("not-shipped");
  });

  it("names committed evidence for the level it reports", () => {
    expect(openPathPolicy.evidence).toBe(
      "tests/e2e/profile-web-golden-path.test.ts",
    );
  });

  it("allows the kernel-seam operations its row declares", () => {
    for (const operation of openPathPolicy.operations) {
      const decision = evaluateOpenPath(operation);
      expect(decision.ok).toBe(true);
      if (!decision.ok) continue;
      expect(decision.shippingClaim).toBe(false);
      expect(decision.sessionKind).toBe("kernel-session");
    }
  });

  it("refuses an operation outside the policy and any shipping claim", () => {
    const outside = evaluateOpenPath("publish");
    expect(outside.ok).toBe(false);
    if (!outside.ok) {
      expect(outside.code).toBe(OPEN_PATH_REFUSE_CODES.operationNotInPolicy);
    }

    const shipping = evaluateOpenPath("open", true);
    expect(shipping.ok).toBe(false);
    if (!shipping.ok) {
      expect(shipping.code).toBe(
        OPEN_PATH_REFUSE_CODES.shippingClaimForbidden,
      );
    }
  });

  it("reaches the same policy through the golden-path pin", () => {
    expect(mvpGoldenPath.openPath.policy).toBe(openPathPolicy);
    expect(mvpGoldenPath.openPath.evaluate("observe").ok).toBe(true);
  });
});
