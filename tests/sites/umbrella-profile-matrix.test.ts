/**
 * The `/profiles` matrix cannot overclaim (sceneaxi#157, decision D3).
 *
 * Two halves, and both are load-bearing:
 *
 *   1. **Canonical identity.** The browser-safe `@sceneaxi/site-kit/profile-contracts`
 *      entry re-exports the canonical `@sceneaxi/schemas` frozen objects. Reference
 *      identity fails if that shared path becomes a copy, and the page projection is
 *      still compared field by field so a join that drops or softens data fails here.
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
  OPEN_PATH_POLICY as SITE_OPEN_PATH_POLICY,
  OPEN_PATH_DEMO_OPERATIONS as SITE_OPEN_PATH_DEMO_OPERATIONS,
  OPEN_PATH_REFUSE_ONLY_PROFILE as SITE_OPEN_PATH_REFUSE_ONLY_PROFILE,
  profileConformanceRegistry as siteProfileConformanceRegistry,
} from "@sceneaxi/site-kit/profile-contracts";
import {
  PROFILE_MATRIX_SOURCE,
  PROFILE_OPERATIONS,
  profileCapabilityStatus,
  profileDisplayName,
  profileMatrix,
  type ProfileMatrixSource,
} from "../../sites/umbrella/src/lib/profile-matrix.ts";

describe("the shared site-kit path stays identical to the canonical contracts", () => {
  it("re-exports contract objects by reference instead of copying them", () => {
    expect(SITE_OPEN_PATH_POLICY).toBe(OPEN_PATH_POLICY);
    expect(SITE_OPEN_PATH_DEMO_OPERATIONS).toBe(OPEN_PATH_DEMO_OPERATIONS);
    expect(SITE_OPEN_PATH_REFUSE_ONLY_PROFILE).toBe(OPEN_PATH_REFUSE_ONLY_PROFILE);
    expect(siteProfileConformanceRegistry).toBe(profileConformanceRegistry);
  });

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
      const projected = PROFILE_MATRIX_SOURCE.find((row) => row.profile === policy.profile);
      expect(projected, `no projected row for ${policy.profile}`).toBeDefined();
      expect(projected?.demoLevel).toBe(policy.demoLevel);
      expect(projected?.sessionKind).toBe(policy.sessionKind);
      expect(projected?.operations).toBe(policy.operations);
      expect(projected?.evidence).toBe(policy.evidence);
      expect(projected?.summary).toBe(policy.summary);
      expect(projected?.shippingClaim).toBe(false);
    }
  });

  it("repeats each registry row's claim status verbatim", () => {
    for (const entry of profileConformanceRegistry) {
      const projected = PROFILE_MATRIX_SOURCE.find((row) => row.profile === entry.profile);
      expect(projected?.claimStatus).toBe(entry.claimStatus);
      expect(entry.shippingClaim).toBe(false);
    }
  });

  it("names the same refuse-only profile the policy does", () => {
    expect(profileMatrix().refuseOnlyProfile).toBe(OPEN_PATH_REFUSE_ONLY_PROFILE);
  });
});

describe("display labels are pinned copy, never invented from a package id", () => {
  /** The exact strings the accepted screen prints as the matrix column headers. */
  const PINNED_LABELS: ReadonlyArray<readonly [string, string]> = [
    ["@sceneaxi/profile-game", "Game"],
    ["@sceneaxi/profile-web", "Web experience"],
    ["@sceneaxi/profile-kids", "Kids"],
  ];

  it("prints the pinned label for every profile the contracts carry", () => {
    expect(PROFILE_MATRIX_SOURCE.map((row) => [row.profile, row.name])).toEqual(
      PINNED_LABELS.map(([profile, name]) => [profile, name]),
    );
    for (const row of profileMatrix().rows) {
      const pinned = PINNED_LABELS.find(([profile]) => profile === row.profile);
      expect(pinned, `no pinned label for ${row.profile}`).toBeDefined();
      expect(row.name).toBe(pinned?.[1]);
    }
  });

  it("covers every policy profile, so no contract row can render an unlabelled header", () => {
    for (const policy of OPEN_PATH_POLICY) {
      expect(() => profileDisplayName(policy.profile)).not.toThrow();
    }
  });

  it("refuses an unknown profile instead of munging one out of its id", () => {
    for (const unknown of [
      "@sceneaxi/profile-web-xr",
      "@sceneaxi/profile-",
      "profile-game",
      "",
      "toString",
    ]) {
      expect(() => profileDisplayName(unknown)).toThrow(/refuses an unknown profile/);
    }
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

  it("keeps Web and Kids unclaimed, with Kids refuse-only", () => {
    const matrix = profileMatrix();
    const web = matrix.rows.find((row) => row.profile === "@sceneaxi/profile-web");
    const kids = matrix.rows.find((row) => row.profile === "@sceneaxi/profile-kids");

    expect(web?.claimStatus).toBe("not-yet-claimed");
    expect(web?.cells.every((cell) => cell.status === "not-yet-claimed")).toBe(true);
    expect(kids?.claimStatus).toBe("not-yet-claimed");
    expect(kids?.demoLevel).toBe("refuse-only");
    expect(kids?.cells.every((cell) => cell.status === "refused")).toBe(true);
  });
});
