/**
 * Open-path demo policy contract (sceneaxi#137).
 *
 * Tests the external contract through the public package name: the table, the
 * shared decision function's refuse matrix, and the fixture lockstep that keeps
 * the TypeScript table, the JSON fixture, and docs/open-path-policy.md from
 * drifting apart.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  OPEN_PATH_DEMO_DECISION_KIND,
  OPEN_PATH_DEMO_OPERATIONS,
  OPEN_PATH_POLICY,
  OPEN_PATH_POLICY_FIXTURES_PATH,
  OPEN_PATH_POLICY_PROFILES,
  OPEN_PATH_POLICY_SCHEMA_VERSION,
  OPEN_PATH_REFUSE_CODES,
  OPEN_PATH_REFUSE_ONLY_PROFILE,
  evaluateOpenPathDemo,
  openPathPolicyRowFor,
  openPathPolicyView,
  openPathPolicyViewFor,
  resolveOpenPathSurfaceRequest,
  validateOpenPathDemoDecision,
} from "@sceneaxi/schemas";

function fixture(): Record<string, unknown> {
  return JSON.parse(
    readFileSync(
      new URL(`../${OPEN_PATH_POLICY_FIXTURES_PATH}`, import.meta.url),
      "utf8",
    ),
  ) as Record<string, unknown>;
}

describe("open-path demo policy table", () => {
  it("is identical to the canonical contract fixture", () => {
    const contract = fixture();
    expect(contract["schemaVersion"]).toBe(OPEN_PATH_POLICY_SCHEMA_VERSION);
    expect(contract["refuseOnlyProfile"]).toBe(OPEN_PATH_REFUSE_ONLY_PROFILE);
    expect(contract["profiles"]).toEqual(
      OPEN_PATH_POLICY.map((row) => ({
        profile: row.profile,
        demoLevel: row.demoLevel,
        sessionKind: row.sessionKind,
        operations: [...row.operations],
        evidence: row.evidence,
        shippingClaim: row.shippingClaim,
        summary: row.summary,
      })),
    );
  });

  it("never lets a row claim shipping, and always names its evidence", () => {
    for (const row of OPEN_PATH_POLICY) {
      expect(row.shippingClaim).toBe(false);
      expect(row.evidence.length).toBeGreaterThan(0);
      expect(row.evidence).toMatch(/^tests\/e2e\/.+\.test\.ts$/);
    }
  });

  it("keeps the Kids profile refuse-only with no operations", () => {
    const kids = openPathPolicyRowFor(OPEN_PATH_REFUSE_ONLY_PROFILE);
    expect(kids).toBeDefined();
    expect(kids?.demoLevel).toBe("refuse-only");
    expect(kids?.sessionKind).toBe("none");
    expect(kids?.operations).toEqual([]);
  });

  it("covers exactly the three known profiles, in canonical order", () => {
    expect(OPEN_PATH_POLICY_PROFILES).toEqual([
      "@sceneaxi/profile-game",
      "@sceneaxi/profile-web",
      "@sceneaxi/profile-kids",
    ]);
  });
});

describe("evaluateOpenPathDemo", () => {
  it("allows every declared operation for a demo-driveable profile", () => {
    for (const profile of ["@sceneaxi/profile-game", "@sceneaxi/profile-web"]) {
      const row = openPathPolicyRowFor(profile);
      expect(row).toBeDefined();
      for (const operation of row?.operations ?? []) {
        const decision = evaluateOpenPathDemo({ profile, operation });
        expect(decision).toEqual({
          ok: true,
          kind: OPEN_PATH_DEMO_DECISION_KIND,
          schemaVersion: OPEN_PATH_POLICY_SCHEMA_VERSION,
          profile,
          operation,
          demoLevel: "demo-driveable",
          sessionKind: row?.sessionKind,
          evidence: row?.evidence,
          shippingClaim: false,
        });
      }
    }
  });

  it("refuses the Kids profile by name, for every operation", () => {
    for (const operation of OPEN_PATH_DEMO_OPERATIONS) {
      const decision = evaluateOpenPathDemo({
        profile: OPEN_PATH_REFUSE_ONLY_PROFILE,
        operation,
      });
      expect(decision.ok).toBe(false);
      if (decision.ok) return;
      expect(decision.code).toBe(OPEN_PATH_REFUSE_CODES.kidsRefused);
    }
  });

  it("refuses Kids before the operation is even considered", () => {
    const decision = evaluateOpenPathDemo({
      profile: OPEN_PATH_REFUSE_ONLY_PROFILE,
      operation: "not-an-operation",
    });
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    // Not operationNotInPolicy: the Kids boundary must not depend on operation
    // validity, so a future operation cannot become one Kids happens to allow.
    expect(decision.code).toBe(OPEN_PATH_REFUSE_CODES.kidsRefused);
  });

  it("refuses a shipping claim on an otherwise valid demo", () => {
    const decision = evaluateOpenPathDemo({
      profile: "@sceneaxi/profile-game",
      operation: "open",
      claimsShipping: true,
    });
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.code).toBe(
      OPEN_PATH_REFUSE_CODES.shippingClaimForbidden,
    );
  });

  it("refuses unknown profiles, unknown operations, and malformed requests", () => {
    const cases: ReadonlyArray<readonly [unknown, string]> = [
      [
        { profile: "@sceneaxi/profile-imaginary", operation: "open" },
        OPEN_PATH_REFUSE_CODES.unknownProfile,
      ],
      [
        { profile: "@sceneaxi/profile-game", operation: "publish" },
        OPEN_PATH_REFUSE_CODES.operationNotInPolicy,
      ],
      [
        { profile: "@sceneaxi/profile-game", operation: "checkout" },
        OPEN_PATH_REFUSE_CODES.operationNotInPolicy,
      ],
      [null, OPEN_PATH_REFUSE_CODES.notObject],
      ["open", OPEN_PATH_REFUSE_CODES.notObject],
      [{ profile: "@sceneaxi/profile-game" }, OPEN_PATH_REFUSE_CODES.missingProperty],
      [
        { profile: "@sceneaxi/profile-game", operation: "open", extra: 1 },
        OPEN_PATH_REFUSE_CODES.unexpectedProperty,
      ],
      [
        { profile: 7, operation: "open" },
        OPEN_PATH_REFUSE_CODES.invalidProperty,
      ],
      [
        {
          profile: "@sceneaxi/profile-game",
          operation: "open",
          claimsShipping: "yes",
        },
        OPEN_PATH_REFUSE_CODES.invalidProperty,
      ],
    ];
    for (const [request, code] of cases) {
      const decision = evaluateOpenPathDemo(request);
      expect(decision.ok).toBe(false);
      if (decision.ok) continue;
      expect(decision.code).toBe(code);
    }
  });
});

describe("openPathPolicyView", () => {
  it("reports every row with shippingClaim false and the refuse-only profile named", () => {
    const view = openPathPolicyView();
    expect(view.schemaVersion).toBe(OPEN_PATH_POLICY_SCHEMA_VERSION);
    expect(view.policyCount).toBe(OPEN_PATH_POLICY.length);
    expect(view.refuseOnlyProfile).toBe(OPEN_PATH_REFUSE_ONLY_PROFILE);
    expect(view.shippingClaim).toBe(false);
    expect(view.rows.map((row) => row.profile)).toEqual([
      ...OPEN_PATH_POLICY_PROFILES,
    ]);
    for (const row of view.rows) expect(row.shippingClaim).toBe(false);
    expect(view.notes.length).toBeGreaterThan(0);
  });

  it("is a stable value: two calls are deep-equal", () => {
    expect(openPathPolicyView()).toEqual(openPathPolicyView());
  });

  it("never renders the word shippable, shipping-ready, or production-ready", () => {
    const text = JSON.stringify(openPathPolicyView()).toLowerCase();
    for (const forbidden of ["shipping-ready", "production-ready", "ready to ship"]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe("openPathPolicyViewFor", () => {
  it("projects one row while keeping the policy's true count and naming the filter", () => {
    for (const row of OPEN_PATH_POLICY) {
      const projection = openPathPolicyViewFor(row.profile);
      expect(projection.ok).toBe(true);
      if (!projection.ok) continue;
      expect(projection.policy.rows).toHaveLength(1);
      expect(projection.policy.rows[0]).toEqual(
        openPathPolicyView().rows.find(
          (entry) => entry.profile === row.profile,
        ),
      );
      expect(projection.policy.filteredTo).toBe(row.profile);
      expect(projection.policy.policyCount).toBe(OPEN_PATH_POLICY.length);
      expect(projection.policy.shippingClaim).toBe(false);
    }
  });

  it("lists the refuse-only row rather than hiding the boundary", () => {
    const projection = openPathPolicyViewFor(OPEN_PATH_REFUSE_ONLY_PROFILE);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.policy.rows[0].demoLevel).toBe("refuse-only");
    expect(projection.policy.rows[0].operations).toEqual([]);
  });

  it("refuses an off-policy profile with the same code and message an evaluation gives", () => {
    const profile = "@sceneaxi/profile-imaginary";
    const projection = openPathPolicyViewFor(profile);
    const evaluated = evaluateOpenPathDemo({ profile, operation: "open" });

    expect(projection.ok).toBe(false);
    expect(evaluated.ok).toBe(false);
    if (projection.ok || evaluated.ok) return;
    expect(projection.code).toBe(OPEN_PATH_REFUSE_CODES.unknownProfile);
    expect(projection.code).toBe(evaluated.code);
    expect(projection.message).toBe(evaluated.message);
    expect(projection.profile).toBe(profile);
  });

  it("refuses a profile that is not a non-empty string", () => {
    for (const value of [undefined, null, "", 7, {}]) {
      const projection = openPathPolicyViewFor(value);
      expect(projection.ok).toBe(false);
      if (projection.ok) continue;
      expect(projection.code).toBe(OPEN_PATH_REFUSE_CODES.invalidProperty);
    }
  });

  it("is frozen, so a surface cannot mutate the projection it reports", () => {
    const projection = openPathPolicyViewFor("@sceneaxi/profile-game");
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(Object.isFrozen(projection)).toBe(true);
    expect(Object.isFrozen(projection.policy)).toBe(true);
    expect(Object.isFrozen(projection.policy.rows)).toBe(true);
  });
});

describe("validateOpenPathDemoDecision", () => {
  const valid = evaluateOpenPathDemo({
    profile: "@sceneaxi/profile-web",
    operation: "save",
  });

  it("accepts a decision the policy itself produced", () => {
    expect(valid.ok).toBe(true);
    const result = validateOpenPathDemoDecision(valid);
    expect(result.ok).toBe(true);
  });

  it("refuses a decision that flips shippingClaim to true", () => {
    const result = validateOpenPathDemoDecision({
      ...(valid as Record<string, unknown>),
      shippingClaim: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(OPEN_PATH_REFUSE_CODES.shippingClaimForbidden);
  });

  it("refuses a decision whose evidence does not match the policy row", () => {
    const result = validateOpenPathDemoDecision({
      ...(valid as Record<string, unknown>),
      evidence: "tests/e2e/some-other-test.test.ts",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(OPEN_PATH_REFUSE_CODES.evidenceMissing);
  });

  it("refuses a schema major mismatch rather than migrating silently", () => {
    const result = validateOpenPathDemoDecision({
      ...(valid as Record<string, unknown>),
      schemaVersion: 2,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(OPEN_PATH_REFUSE_CODES.schemaVersionMismatch);
  });

  it("refuses a fabricated Kids decision", () => {
    const result = validateOpenPathDemoDecision({
      ok: true,
      kind: OPEN_PATH_DEMO_DECISION_KIND,
      schemaVersion: OPEN_PATH_POLICY_SCHEMA_VERSION,
      profile: OPEN_PATH_REFUSE_ONLY_PROFILE,
      operation: "open",
      demoLevel: "demo-driveable",
      sessionKind: "kernel-session",
      evidence: "tests/e2e/profile-kids-refuse-golden.test.ts",
      shippingClaim: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(OPEN_PATH_REFUSE_CODES.kidsRefused);
  });
});

describe("open-path surface request resolution", () => {
  it("reports the whole policy when neither value was provided", () => {
    const outcome = resolveOpenPathSurfaceRequest({});
    expect(outcome.kind).toBe("policy");
    if (outcome.kind !== "policy") return;
    expect(outcome.policy).toEqual(openPathPolicyView());
  });

  it("projects one row when only a profile was provided", () => {
    const outcome = resolveOpenPathSurfaceRequest({
      profile: "@sceneaxi/profile-game",
    });
    expect(outcome.kind).toBe("projection");
    if (outcome.kind !== "projection") return;
    expect(outcome.policy.filteredTo).toBe("@sceneaxi/profile-game");
    expect(outcome.policy.policyCount).toBe(OPEN_PATH_POLICY.length);
  });

  it("evaluates when both values were provided", () => {
    const outcome = resolveOpenPathSurfaceRequest({
      profile: "@sceneaxi/profile-web",
      operation: "advance",
    });
    expect(outcome.kind).toBe("decision");
    if (outcome.kind !== "decision") return;
    expect(outcome.decision).toEqual(
      evaluateOpenPathDemo({
        profile: "@sceneaxi/profile-web",
        operation: "advance",
      }),
    );
  });

  it("refuses an explicitly empty value rather than widening the branch", () => {
    for (const request of [
      { profile: "" },
      { profile: "   " },
      { profile: "@sceneaxi/profile-kids", operation: "" },
      { profile: "@sceneaxi/profile-game", operation: "  " },
    ]) {
      const outcome = resolveOpenPathSurfaceRequest(request);
      expect(outcome.kind).toBe("refusal");
      if (outcome.kind !== "refusal") continue;
      expect(outcome.source).toBe("request");
      expect(outcome.refusal.code).toBe(OPEN_PATH_REFUSE_CODES.invalidProperty);
    }
  });

  it("refuses an operation named without a profile", () => {
    const outcome = resolveOpenPathSurfaceRequest({ operation: "open" });
    expect(outcome.kind).toBe("refusal");
    if (outcome.kind !== "refusal") return;
    expect(outcome.source).toBe("request");
    expect(outcome.refusal.code).toBe(OPEN_PATH_REFUSE_CODES.missingProperty);
    expect(outcome.operation).toBe("open");
  });

  it("passes policy refusals through with their shared code", () => {
    const unknown = resolveOpenPathSurfaceRequest({
      profile: "@sceneaxi/profile-imaginary",
    });
    expect(unknown.kind).toBe("refusal");
    if (unknown.kind !== "refusal") return;
    expect(unknown.source).toBe("policy");
    expect(unknown.refusal.code).toBe(OPEN_PATH_REFUSE_CODES.unknownProfile);

    const kids = resolveOpenPathSurfaceRequest({
      profile: OPEN_PATH_REFUSE_ONLY_PROFILE,
      operation: "open",
    });
    expect(kids.kind).toBe("refusal");
    if (kids.kind !== "refusal") return;
    expect(kids.source).toBe("policy");
    expect(kids.refusal.code).toBe(OPEN_PATH_REFUSE_CODES.kidsRefused);
  });
});
