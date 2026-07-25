/**
 * The free-vs-paid enforcement matrix (v1).
 *
 * This is a **product boundary**, so it is a closed enumeration rather than a
 * lookup with a default. An unknown capability refuses; there is no path where
 * forgetting to register something makes it free, and none where forgetting
 * makes it silently chargeable either.
 *
 * Captain commercial model, 2026-07-25:
 *
 * - **Free forever, no account:** the public engine SDK download, CLI and local
 *   agent authoring, and bring-your-own AI keys. Bring-your-own keys never burn
 *   SceneAxi credits — the user is already paying their own provider.
 * - **Costs credits and/or money:** SceneAxi-hosted AI, and catalog assets at
 *   whatever the seller listed.
 * - **Admin** has an unlimited allowance and is never charged.
 * - **Kids commerce is denied** on every capability, free ones included.
 *
 * Enforcement lives in @sceneaxi/billing; this module is contracts only.
 */

import {
  firstMissingKey,
  firstUnexpectedKey,
  isPlainRecord,
  isSafeInteger,
  refuseWith,
  type ContractRefuse,
} from "./record-validation.js";

export const ENTITLEMENT_SCHEMA_VERSION = 1 as const;

export const ENTITLEMENT_DECISION_KIND =
  "sceneaxi.entitlement-decision" as const;

/** How a capability is priced. */
export const ENTITLEMENT_PRICE_KINDS = Object.freeze([
  "free",
  "credits",
  "money",
  "credits-or-money",
] as const);

/** What an evaluation concluded. */
export const ENTITLEMENT_OUTCOMES = Object.freeze([
  /** Free, and reachable with no account at all. */
  "allow-free",
  /** Admin's unlimited allowance; nothing is charged. */
  "allow-unlimited",
  /** Entitled, at an exact integer credit cost. */
  "charge-credits",
  /** Entitled to start a money checkout (Stripe, test mode by default). */
  "allow-checkout",
] as const);

export type EntitlementPriceKind = (typeof ENTITLEMENT_PRICE_KINDS)[number];
export type EntitlementOutcome = (typeof ENTITLEMENT_OUTCOMES)[number];

export type EntitlementRule = Readonly<{
  /** False means the free path works with no account — a product guarantee. */
  accountRequired: boolean;
  price: EntitlementPriceKind;
}>;

/**
 * The matrix. Mirrored as a contract fixture
 * (`contracts/entitlement-matrix.fixtures.json`) which `pnpm check:contracts`
 * keeps in lockstep with the `docs/auth-credits.md` table; a test asserts this
 * table and that fixture are identical, so all three move together.
 */
export const ENTITLEMENT_MATRIX = Object.freeze({
  "engine-sdk-download": Object.freeze({
    accountRequired: false,
    price: "free",
  }),
  "cli-authoring": Object.freeze({ accountRequired: false, price: "free" }),
  "byo-model-keys": Object.freeze({ accountRequired: false, price: "free" }),
  "hosted-ai-assistant": Object.freeze({
    accountRequired: true,
    price: "credits",
  }),
  "metered-model-port": Object.freeze({
    accountRequired: true,
    price: "credits",
  }),
  "catalog-asset-purchase": Object.freeze({
    accountRequired: true,
    price: "credits-or-money",
  }),
  "creator-publish": Object.freeze({ accountRequired: true, price: "free" }),
  "credit-pack-purchase": Object.freeze({
    accountRequired: true,
    price: "money",
  }),
}) satisfies Readonly<Record<string, EntitlementRule>>;

export type EntitlementCapability = keyof typeof ENTITLEMENT_MATRIX;

/** Capability ids in a stable order, for docs and exhaustiveness checks. */
export const ENTITLEMENT_CAPABILITIES = Object.freeze(
  Object.keys(ENTITLEMENT_MATRIX) as ReadonlyArray<EntitlementCapability>,
);

/** Canonical matrix fixture, relative to this package root. */
export const ENTITLEMENT_MATRIX_FIXTURES_PATH =
  "contracts/entitlement-matrix.fixtures.json" as const;

/** Credits every new user receives exactly once. */
export const STARTER_CREDIT_GRANT = 100 as const;

export const ENTITLEMENT_REFUSE_CODES = Object.freeze({
  notObject: "ENTITLEMENT_RECORD_NOT_OBJECT",
  schemaVersionMismatch: "ENTITLEMENT_SCHEMA_VERSION_MISMATCH",
  kindMismatch: "ENTITLEMENT_KIND_MISMATCH",
  missingProperty: "ENTITLEMENT_REQUIRED_PROPERTY_MISSING",
  unexpectedProperty: "ENTITLEMENT_UNEXPECTED_PROPERTY",
  invalidProperty: "ENTITLEMENT_PROPERTY_INVALID",
} as const);

export type EntitlementRefuseCode =
  (typeof ENTITLEMENT_REFUSE_CODES)[keyof typeof ENTITLEMENT_REFUSE_CODES];

/**
 * A recorded entitlement conclusion. `credits` is present exactly when the
 * outcome is `charge-credits`, so a decision can never imply a charge without
 * naming the amount.
 */
export type EntitlementDecision = Readonly<{
  schemaVersion: typeof ENTITLEMENT_SCHEMA_VERSION;
  kind: typeof ENTITLEMENT_DECISION_KIND;
  capability: EntitlementCapability;
  outcome: EntitlementOutcome;
  credits?: number;
}>;

export type EntitlementValidationOk = Readonly<{
  ok: true;
  value: EntitlementDecision;
}>;

export type EntitlementValidationRefuse = ContractRefuse<EntitlementRefuseCode>;

export type EntitlementValidationResult =
  | EntitlementValidationOk
  | EntitlementValidationRefuse;

export function isEntitlementCapability(
  value: unknown,
): value is EntitlementCapability {
  return (
    typeof value === "string" && Object.hasOwn(ENTITLEMENT_MATRIX, value)
  );
}

export function isEntitlementOutcome(
  value: unknown,
): value is EntitlementOutcome {
  return ENTITLEMENT_OUTCOMES.some((outcome) => outcome === value);
}

/** The rule for a capability, or undefined when it is not in the matrix. */
export function entitlementRuleFor(
  capability: unknown,
): EntitlementRule | undefined {
  return isEntitlementCapability(capability)
    ? ENTITLEMENT_MATRIX[capability]
    : undefined;
}

export function validateEntitlementDecision(
  value: unknown,
): EntitlementValidationResult {
  if (!isPlainRecord(value)) {
    return refuseWith(
      ENTITLEMENT_REFUSE_CODES.notObject,
      "An entitlement decision must be a plain JSON object.",
    );
  }
  if (value["schemaVersion"] !== ENTITLEMENT_SCHEMA_VERSION) {
    return refuseWith(
      ENTITLEMENT_REFUSE_CODES.schemaVersionMismatch,
      `entitlement decision schemaVersion must be ${ENTITLEMENT_SCHEMA_VERSION}; silent migration is refused.`,
    );
  }
  if (value["kind"] !== ENTITLEMENT_DECISION_KIND) {
    return refuseWith(
      ENTITLEMENT_REFUSE_CODES.kindMismatch,
      `entitlement decision kind must be "${ENTITLEMENT_DECISION_KIND}".`,
    );
  }

  const required = ["schemaVersion", "kind", "capability", "outcome"];
  const missing = firstMissingKey(value, required);
  if (missing !== undefined) {
    return refuseWith(
      ENTITLEMENT_REFUSE_CODES.missingProperty,
      `entitlement decision is missing required property "${missing}".`,
    );
  }
  const unexpected = firstUnexpectedKey(value, required, ["credits"]);
  if (unexpected !== undefined) {
    return refuseWith(
      ENTITLEMENT_REFUSE_CODES.unexpectedProperty,
      `entitlement decision has unexpected property "${unexpected}".`,
    );
  }

  const capability = value["capability"];
  if (!isEntitlementCapability(capability)) {
    return refuseWith(
      ENTITLEMENT_REFUSE_CODES.invalidProperty,
      `entitlement decision capability "${String(capability)}" is not in the matrix; the matrix is a closed enumeration.`,
    );
  }
  const outcome = value["outcome"];
  if (!isEntitlementOutcome(outcome)) {
    return refuseWith(
      ENTITLEMENT_REFUSE_CODES.invalidProperty,
      `entitlement decision outcome must be one of ${ENTITLEMENT_OUTCOMES.join(", ")}.`,
    );
  }

  const hasCredits = Object.hasOwn(value, "credits");
  if (outcome === "charge-credits") {
    const credits = value["credits"];
    if (!hasCredits || !isSafeInteger(credits) || credits < 1) {
      return refuseWith(
        ENTITLEMENT_REFUSE_CODES.invalidProperty,
        "a charge-credits decision must name a positive integer credit amount.",
      );
    }
    return Object.freeze({
      ok: true,
      value: Object.freeze({
        schemaVersion: ENTITLEMENT_SCHEMA_VERSION,
        kind: ENTITLEMENT_DECISION_KIND,
        capability,
        outcome,
        credits,
      }),
    });
  }

  if (hasCredits) {
    return refuseWith(
      ENTITLEMENT_REFUSE_CODES.invalidProperty,
      `a ${outcome} decision must not carry a credit amount.`,
    );
  }

  return Object.freeze({
    ok: true,
    value: Object.freeze({
      schemaVersion: ENTITLEMENT_SCHEMA_VERSION,
      kind: ENTITLEMENT_DECISION_KIND,
      capability,
      outcome,
    }),
  });
}
