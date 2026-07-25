import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ENTITLEMENT_CAPABILITIES,
  ENTITLEMENT_DECISION_KIND,
  ENTITLEMENT_MATRIX,
  ENTITLEMENT_MATRIX_FIXTURES_PATH,
  ENTITLEMENT_OUTCOMES,
  ENTITLEMENT_REFUSE_CODES,
  STARTER_CREDIT_GRANT,
  entitlementRuleFor,
  isEntitlementCapability,
  validateEntitlementDecision,
} from "@sceneaxi/schemas";

interface MatrixFixture {
  schemaVersion: number;
  starterCreditGrant: number;
  capabilities: {
    capability: string;
    accountRequired: boolean;
    price: string;
  }[];
}

const fixture = JSON.parse(
  readFileSync(
    new URL(`../${ENTITLEMENT_MATRIX_FIXTURES_PATH}`, import.meta.url),
    "utf8",
  ),
) as MatrixFixture;

describe("entitlement matrix", () => {
  it("is identical to the canonical contract fixture, entry for entry and in order", () => {
    expect(fixture.capabilities.map((entry) => entry.capability)).toEqual([
      ...ENTITLEMENT_CAPABILITIES,
    ]);
    for (const entry of fixture.capabilities) {
      const rule = entitlementRuleFor(entry.capability);
      expect(rule).toBeDefined();
      expect(rule?.accountRequired).toBe(entry.accountRequired);
      expect(rule?.price).toBe(entry.price);
    }
  });

  it("agrees with the fixture on the starter grant", () => {
    expect(STARTER_CREDIT_GRANT).toBe(100);
    expect(fixture.starterCreditGrant).toBe(STARTER_CREDIT_GRANT);
  });

  it("keeps the free path free and account-free", () => {
    for (const capability of [
      "engine-sdk-download",
      "cli-authoring",
      "byo-model-keys",
    ] as const) {
      const rule = ENTITLEMENT_MATRIX[capability];
      expect(rule.accountRequired).toBe(false);
      expect(rule.price).toBe("free");
    }
  });

  it("requires an account for every paid capability", () => {
    for (const capability of [
      "hosted-ai-assistant",
      "metered-model-port",
      "catalog-asset-purchase",
      "credit-pack-purchase",
    ] as const) {
      expect(ENTITLEMENT_MATRIX[capability].accountRequired).toBe(true);
    }
  });

  it("is a closed enumeration", () => {
    expect(Object.isFrozen(ENTITLEMENT_MATRIX)).toBe(true);
    expect(isEntitlementCapability("engine-sdk-download")).toBe(true);
    for (const unknown of ["", "everything", "__proto__", "toString", 42]) {
      expect(isEntitlementCapability(unknown)).toBe(false);
      expect(entitlementRuleFor(unknown)).toBeUndefined();
    }
  });
});

describe("validateEntitlementDecision", () => {
  const base = {
    schemaVersion: 1,
    kind: ENTITLEMENT_DECISION_KIND,
    capability: "hosted-ai-assistant",
  } as const;

  it("accepts every outcome shape", () => {
    for (const outcome of ENTITLEMENT_OUTCOMES) {
      const candidate =
        outcome === "charge-credits"
          ? { ...base, outcome, credits: 10 }
          : { ...base, outcome };
      const result = validateEntitlementDecision(candidate);
      expect(result.ok).toBe(true);
    }
  });

  it("requires a positive credit amount on charge-credits", () => {
    for (const credits of [undefined, 0, -1, 1.5, "10"]) {
      const candidate =
        credits === undefined
          ? { ...base, outcome: "charge-credits" }
          : { ...base, outcome: "charge-credits", credits };
      const result = validateEntitlementDecision(candidate);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe(ENTITLEMENT_REFUSE_CODES.invalidProperty);
    }
  });

  it("refuses a credit amount on an outcome that charges nothing", () => {
    for (const outcome of ["allow-free", "allow-unlimited", "allow-checkout"]) {
      const result = validateEntitlementDecision({
        ...base,
        outcome,
        credits: 10,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe(ENTITLEMENT_REFUSE_CODES.invalidProperty);
    }
  });

  it("refuses an unregistered capability", () => {
    const result = validateEntitlementDecision({
      ...base,
      capability: "everything",
      outcome: "allow-free",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(ENTITLEMENT_REFUSE_CODES.invalidProperty);
  });

  it("refuses a non-object, a version mismatch, a kind mismatch, and extra keys", () => {
    expect(validateEntitlementDecision(null).ok).toBe(false);
    expect(
      validateEntitlementDecision({
        ...base,
        schemaVersion: 2,
        outcome: "allow-free",
      }).ok,
    ).toBe(false);
    expect(
      validateEntitlementDecision({
        ...base,
        kind: "sceneaxi.user",
        outcome: "allow-free",
      }).ok,
    ).toBe(false);
    expect(
      validateEntitlementDecision({
        ...base,
        outcome: "allow-free",
        note: "hi",
      }).ok,
    ).toBe(false);
  });

  it("refuses an unknown outcome", () => {
    const result = validateEntitlementDecision({
      ...base,
      outcome: "allow-everything",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(ENTITLEMENT_REFUSE_CODES.invalidProperty);
  });
});
