/**
 * The `/profiles` matrix cannot overclaim (sceneaxi#157, decision D3).
 *
 * Two halves, and both are load-bearing:
 *
 *   1. **Lockstep.** `sites/umbrella/src/lib/profile-matrix.ts` carries a bundled mirror
 *      of `profileConformanceRegistry` and `OPEN_PATH_POLICY`, because
 *      `docs/dependency-matrix.json` gives the umbrella four edges and none of them
 *      reaches `@sceneaxi/schemas`. This file runs from the repository root, where naming
 *      that package *is* allowed, so the mirror is compared against both contracts field
 *      by field. A hand edit that softened a claim status, promoted a demo level, added
 *      an operation, or dropped an evidence path fails here rather than shipping.
 *
 *   2. **Derivation.** The page renders no cell of its own; every cell comes from
 *      `profileCapabilityStatus()`. These tests drive that function with adversarial
 *      inputs — a refuse-only profile handed a full operation list, an unclaimed profile
 *      handed a driveable level, a graded row with its evidence removed — and assert none
 *      of them can reach `proven`. That is the assertion the acceptance criterion names:
 *      it fails if an unproven capability is presented as claimed.
 */
import { describe, expect, it } from "vitest";
import {
  OPEN_PATH_POLICY,
  OPEN_PATH_DEMO_OPERATIONS,
  OPEN_PATH_REFUSE_ONLY_PROFILE,
  profileConformanceRegistry,
} from "@sceneaxi/schemas";
import {
  PROFILE_MATRIX_SOURCE,
  PROFILE_OPERATIONS,
  profileCapabilityStatus,
  profileMatrix,
  type ProfileMatrixSource,
} from "../../sites/umbrella/src/lib/profile-matrix.ts";

describe("the bundled mirror stays in lockstep with the contracts it mirrors", () => {
  it("covers exactly the profiles the open-path policy covers, in order", () => {
    expect(PROFILE_MATRIX_SOURCE.map((row) => row.profile)).toEqual(
      OPEN_PATH_POLICY.map((row) => row.profile),
    );
  });

  it("covers exactly the profiles the conformance registry knows, in order", () => {
    expect(PROFILE_MATRIX_SOURCE.map((row) => row.profile)).toEqual(
      profileConformanceRegistry.map((entry) => entry.profile),
    );
  });

  it("declares exactly the Kernel-seam operations the policy grades, in order", () => {
    expect([...PROFILE_OPERATIONS]).toEqual([...OPEN_PATH_DEMO_OPERATIONS]);
  });

  it("repeats each policy row's level, session, operations, and evidence verbatim", () => {
    for (const policy of OPEN_PATH_POLICY) {
      const mirrored = PROFILE_MATRIX_SOURCE.find((row) => row.profile === policy.profile);
      expect(mirrored, `no mirror row for ${policy.profile}`).toBeDefined();
      expect(mirrored?.demoLevel).toBe(policy.demoLevel);
      expect(mirrored?.sessionKind).toBe(policy.sessionKind);
      expect(mirrored?.operations).toEqual([...policy.operations]);
      expect(mirrored?.evidence).toBe(policy.evidence);
      expect(mirrored?.summary).toBe(policy.summary);
      expect(mirrored?.shippingClaim).toBe(false);
    }
  });

  it("repeats each registry row's claim status verbatim", () => {
    for (const entry of profileConformanceRegistry) {
      const mirrored = PROFILE_MATRIX_SOURCE.find((row) => row.profile === entry.profile);
      expect(mirrored?.claimStatus).toBe(entry.claimStatus);
      expect(entry.shippingClaim).toBe(false);
    }
  });

  it("names the same refuse-only profile the policy does", () => {
    expect(profileMatrix().refuseOnlyProfile).toBe(OPEN_PATH_REFUSE_ONLY_PROFILE);
  });
});

describe("no unproven capability can be presented as claimed", () => {
  /** A row that would be maximally generous if the derivation trusted its data. */
  const permissive = (over: Partial<ProfileMatrixSource>): ProfileMatrixSource => ({
    profile: "@sceneaxi/profile-test",
    name: "Test",
    claimStatus: "development-consumer",
    demoLevel: "demo-driveable",
    sessionKind: "kernel-session",
    operations: PROFILE_OPERATIONS,
    evidence: "tests/e2e/some-golden.test.ts",
    shippingClaim: false,
    summary: "",
    ...over,
  });

  it("refuses every cell of a refuse-only profile, even one handed every operation", () => {
    const row = permissive({ demoLevel: "refuse-only", operations: PROFILE_OPERATIONS });
    for (const operation of PROFILE_OPERATIONS) {
      expect(profileCapabilityStatus(row, operation)).toBe("refused");
    }
  });

  it("never claims a cell for a profile that has not claimed conformance", () => {
    const row = permissive({ claimStatus: "not-yet-claimed" });
    for (const operation of PROFILE_OPERATIONS) {
      expect(profileCapabilityStatus(row, operation)).toBe("not-yet-claimed");
    }
  });

  it("never claims an operation outside the profile's own policy list", () => {
    const row = permissive({ operations: ["open"] });
    expect(profileCapabilityStatus(row, "open")).toBe("proven");
    for (const operation of PROFILE_OPERATIONS.filter((entry) => entry !== "open")) {
      expect(profileCapabilityStatus(row, operation)).toBe("not-yet-claimed");
    }
  });

  it("never claims a level with no committed evidence behind it", () => {
    const row = permissive({ evidence: "" });
    for (const operation of PROFILE_OPERATIONS) {
      expect(profileCapabilityStatus(row, operation)).toBe("not-yet-claimed");
    }
  });

  it("proves cells only for profiles the registry marks a development consumer", () => {
    const matrix = profileMatrix();
    const claimed = new Set<string>(
      profileConformanceRegistry
        .filter((entry) => entry.claimStatus === "development-consumer")
        .map((entry) => entry.profile),
    );
    for (const row of matrix.rows) {
      const proven = row.cells.filter((cell) => cell.status === "proven");
      if (claimed.has(row.profile)) continue;
      expect(proven, `${row.profile} presents ${proven.length} unproven cells as proven`).toEqual(
        [],
      );
    }
    // …and the reduced matrix still says something: at least one real cell is proven, so
    // a derivation that refused everything would not silently pass as "not overclaiming".
    expect(matrix.provenCount).toBeGreaterThan(0);
  });

  it("makes no shipping claim on the view or any row", () => {
    const matrix = profileMatrix();
    expect(matrix.shippingClaim).toBe(false);
    for (const row of matrix.rows) expect(row.shippingClaim).toBe(false);
  });
});
