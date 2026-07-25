/**
 * Free-vs-paid enforcement.
 *
 * The evaluation order is the product boundary, so it is fixed here rather than
 * assembled per call site:
 *
 *   1. capability in the matrix        — a closed enumeration, never default-allow
 *   2. Kids commerce                   — refused by name, free capabilities included
 *   3. free-without-account            — resolved with no principal, no store, no ledger
 *   4. account required                — refused before any balance is read
 *   5. guard (disabled/expired/Kids)   — the guard's own reason is surfaced
 *   6. admin                           — unlimited allowance, nothing charged
 *   7. price                           — free / money-checkout / exact credit charge
 *
 * Step 3 before step 4 is what makes "the free path works without an account" a
 * property of the code rather than a promise in a doc: those capabilities return
 * before anything that could need identity.
 */

import {
  requireAuthenticated,
  AUTH_REFUSE_REASONS as AUTH_REFUSE,
  type AdminIdentity,
} from "@sceneaxi/auth";
import {
  ENTITLEMENT_DECISION_KIND,
  ENTITLEMENT_SCHEMA_VERSION,
  STARTER_CREDIT_GRANT,
  entitlementRuleFor,
  isEpochMilliseconds,
  isEntitlementCapability,
  snapshotPlainRecord,
  type EntitlementCapability,
  type EntitlementDecision,
  type IdentitySurface,
} from "@sceneaxi/schemas";
import {
  appendCreditEntry,
  deriveEntryId,
  validateLedgerState,
  type AppendOutcome,
  type LedgerState,
} from "./ledger.js";
import {
  BILLING_REFUSE_REASONS,
  billingOk,
  billingRefuse,
  type BillingOutcome,
} from "./refusals.js";

/** Namespace for the once-per-user starter grant. */
export const STARTER_IDEMPOTENCY_PREFIX = "starter:" as const;

export type EntitlementPaymentMethod = "credits" | "money";

export type EvaluateEntitlementRequest = Readonly<{
  capability: unknown;
  /** Epoch milliseconds. */
  now: number;
  /**
   * The single resolved admin identity. Required when a principal is evaluated
   * (the guard re-derives the role from it); absent on the anonymous free path,
   * which never reaches the guard.
   */
  admin?: AdminIdentity | undefined;
  /** Absent means anonymous — valid for the free path, refused for paid. */
  principal?: unknown;
  /** Required for a credit charge; the ledger the charge would land on. */
  state?: LedgerState | undefined;
  /** Required for a credit charge; the exact integer cost. */
  creditAmount?: number | undefined;
  /** Required when the capability is priced `credits-or-money`. */
  payWith?: EntitlementPaymentMethod | undefined;
  /**
   * The surface the request arrives on. `kids` refuses every capability. Passed
   * separately from the principal because an anonymous free request has no
   * session to read it from.
   */
  surface?: IdentitySurface | undefined;
}>;

/**
 * Build a decision.
 *
 * Constructed directly rather than round-tripped through
 * `validateEntitlementDecision`: every input here has already been validated, so
 * the shape is statically guaranteed and a re-validation branch would be
 * unreachable — dead code that reads like a guarantee. Consumers that receive a
 * decision from elsewhere should still validate it, and the golden path does.
 */
function decide(
  capability: EntitlementCapability,
  outcome: EntitlementDecision["outcome"],
  credits?: number,
): BillingOutcome<EntitlementDecision> {
  return billingOk(
    Object.freeze(
      credits === undefined
        ? {
            schemaVersion: ENTITLEMENT_SCHEMA_VERSION,
            kind: ENTITLEMENT_DECISION_KIND,
            capability,
            outcome,
          }
        : {
            schemaVersion: ENTITLEMENT_SCHEMA_VERSION,
            kind: ENTITLEMENT_DECISION_KIND,
            capability,
            outcome,
            credits,
          },
    ),
  );
}

/** Decide whether a capability is permitted, and at what cost. */
export function evaluateEntitlement(
  request: EvaluateEntitlementRequest,
): BillingOutcome<EntitlementDecision> {
  const record = snapshotPlainRecord(request);
  if (record === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "An entitlement request must be a plain object.",
    );
  }
  const screened = record as EvaluateEntitlementRequest;
  const {
    capability,
    now,
    admin,
    principal,
    state,
    creditAmount,
    payWith,
    surface,
  } = screened;

  if (!isEpochMilliseconds(now)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.clockInvalid,
      "Entitlement evaluation requires valid epoch milliseconds.",
    );
  }

  const rule = entitlementRuleFor(capability);
  if (rule === undefined || !isEntitlementCapability(capability)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.capabilityUnknown,
      `"${String(capability)}" is not in the entitlement matrix; the matrix is a closed enumeration, so an unregistered capability refuses.`,
    );
  }

  // Kids commerce is a hard out — refused before anything else can allow.
  const principalRecord = snapshotPlainRecord(principal);
  const principalSession = snapshotPlainRecord(principalRecord?.["session"]);
  if (surface === "kids" || principalSession?.["surface"] === "kids") {
    return billingRefuse(
      BILLING_REFUSE_REASONS.kidsCommerceDenied,
      "Kids commerce is denied; no SceneAxi capability is offered or sold on the Kids surface.",
    );
  }

  // The free path resolves with no principal, no store, and no ledger read.
  if (!rule.accountRequired) {
    return decide(capability, "allow-free");
  }

  if (principal === undefined || principal === null) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.accountRequired,
      `"${capability}" requires a SceneAxi account.`,
    );
  }
  if (admin === undefined) {
    return billingRefuse(
      AUTH_REFUSE.adminIdentityUnresolved,
      `"${capability}" requires the resolved admin identity so the principal's role can be re-derived.`,
    );
  }

  const guarded = requireAuthenticated(
    principal,
    surface === undefined ? { now, admin } : { now, surface, admin },
  );
  if (!guarded.ok) return billingRefuse(guarded.reason, guarded.message);

  // The captain's unlimited allowance covers every paid capability.
  if (guarded.value.role.role === "admin") {
    return decide(capability, "allow-unlimited");
  }

  if (rule.price === "free") return decide(capability, "allow-free");
  if (rule.price === "money") return decide(capability, "allow-checkout");

  if (rule.price === "credits-or-money") {
    if (payWith === undefined) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.paymentMethodRequired,
        `"${capability}" is priced in credits or money; the caller must state which, since the seller's listing decides what is offered.`,
      );
    }
    if (payWith === "money") return decide(capability, "allow-checkout");
    if (payWith !== "credits") {
      return billingRefuse(
        BILLING_REFUSE_REASONS.paymentMethodRequired,
        "A payment method must be 'credits' or 'money'.",
      );
    }
  }

  // Credit-priced from here.
  if (!Number.isSafeInteger(creditAmount) || (creditAmount ?? 0) < 1) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.creditAmountRequired,
      `"${capability}" is credit-priced; the caller must name a positive integer credit amount.`,
    );
  }
  const amount = creditAmount as number;

  const validatedState = validateLedgerState(state);
  if (!validatedState.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.ledgerStateInvalid,
      `"${capability}" is credit-priced; a valid ledger state is required to check the balance.`,
    );
  }
  if (validatedState.value.account.userId !== guarded.value.user.userId) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.accountNotOwned,
      "The credit account belongs to a different user.",
    );
  }
  if (validatedState.value.balance < amount) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.balanceInsufficient,
      `"${capability}" costs ${amount} credits; the balance is ${validatedState.value.balance}.`,
    );
  }

  return decide(capability, "charge-credits", amount);
}

export type GrantStarterCreditsRequest = Readonly<{
  state: LedgerState;
  /** Must own the account; the grant is per user, once. */
  userId: string;
  /** Epoch milliseconds. */
  now: number;
}>;

/**
 * Grant the once-per-user starter credits.
 *
 * Keyed on `starter:<userId>`, so the grant is safe to attempt on every sign-in:
 * the ledger's own idempotency makes a second attempt a no-op rather than
 * requiring callers to remember whether they already did it.
 */
export function grantStarterCredits(
  request: GrantStarterCreditsRequest,
): BillingOutcome<AppendOutcome> {
  const record = snapshotPlainRecord(request);
  if (record === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A starter grant request must be a plain object.",
    );
  }
  const screened = record as GrantStarterCreditsRequest;
  const { state, userId, now } = screened;

  if (typeof userId !== "string" || userId.length === 0) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "The starter grant requires a user id.",
    );
  }
  const validatedState = validateLedgerState(state);
  if (!validatedState.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.ledgerStateInvalid,
      "The starter grant requires a valid ledger state.",
    );
  }
  if (validatedState.value.account.userId !== userId) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.accountNotOwned,
      "The credit account belongs to a different user; the starter grant refuses.",
    );
  }

  const idempotencyKey = `${STARTER_IDEMPOTENCY_PREFIX}${userId}`;
  return appendCreditEntry(state, {
    entryId: deriveEntryId(idempotencyKey),
    movement: "grant",
    delta: STARTER_CREDIT_GRANT,
    reason: "starter credits",
    idempotencyKey,
    now,
  });
}
