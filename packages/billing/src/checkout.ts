/**
 * Checkout session intents.
 *
 * An *intent* is a provider-neutral, secret-free description of the checkout
 * SceneAxi wants created. It is not a Stripe API call: turning an intent into a
 * hosted checkout URL is the injected adapter's job, outside core. That split
 * keeps credentials out of this package entirely and makes the whole path
 * testable with no network.
 *
 * `live` mode is unreachable by default. It requires `liveModeAuthorized: true`
 * to be passed explicitly at the call site — the captain go-live gate — so no
 * configuration mistake, env var, or default can start charging real money.
 */

import {
  DEFAULT_BILLING_MODE,
  isBillingMode,
  isHttpsUrl,
  validateCheckoutSessionIntent,
  type BillingMode,
  type CheckoutPurpose,
  type CheckoutSessionIntent,
} from "@sceneaxi/schemas";
import { lookupCreditPack } from "./credit-packs.js";
import {
  BILLING_REFUSE_REASONS,
  billingOk,
  billingRefuse,
  type BillingOutcome,
} from "./refusals.js";

export type CreateMoneyCheckoutIntentRequest = Readonly<{
  purpose: CheckoutPurpose;
  itemId: string;
  userId: string;
  unitAmount: number;
  currency: string;
  stripePriceId: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  /** Epoch milliseconds. */
  now: number;
  /** Present only for a credit-pack purchase. */
  credits?: number | undefined;
  mode?: BillingMode | undefined;
  liveModeAuthorized?: boolean | undefined;
}>;

export type CreateCheckoutSessionIntentRequest = Readonly<{
  /** Injected catalog; `loadCreditPackCatalog()` provides the canonical one. */
  catalog: unknown;
  packId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  /** Epoch milliseconds. */
  now: number;
  /** Defaults to `test`. */
  mode?: BillingMode | undefined;
  /** The captain go-live gate. Absent or false means `live` refuses. */
  liveModeAuthorized?: boolean | undefined;
}>;

const IDENTIFIER_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Guard the billing mode. Shared by checkout and grant application so the
 * go-live gate is enforced at both ends: creating a live intent and honoring a
 * live event both need the same explicit authorization.
 */
export function assertModeAuthorized(
  mode: BillingMode,
  liveModeAuthorized: boolean | undefined,
): BillingOutcome<BillingMode> {
  if (!isBillingMode(mode)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.checkoutIntentInvalid,
      "The billing mode must be 'test' or 'live'.",
    );
  }
  if (mode === "live" && liveModeAuthorized !== true) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.liveModeNotAuthorized,
      "Live-mode billing is not authorized; it requires an explicit captain go-live decision.",
    );
  }
  return billingOk(mode);
}

/**
 * Derive a contract-valid intent id from an idempotency key. Namespaced keys
 * carry a `:`, which the identifier pattern excludes.
 */
export function deriveIntentId(idempotencyKey: string): string {
  return `int_${idempotencyKey.replace(/[^A-Za-z0-9._-]/g, "-")}`.slice(0, 128);
}

/** Build a checkout intent for a credit pack, or refuse. */
export function createCheckoutSessionIntent(
  request: CreateCheckoutSessionIntentRequest,
): BillingOutcome<CheckoutSessionIntent> {
  if (!isRecord(request)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A checkout intent request must be a plain object.",
    );
  }
  const {
    catalog,
    packId,
    userId,
    successUrl,
    cancelUrl,
    idempotencyKey,
    now,
    mode,
    liveModeAuthorized,
  } = request;

  if (typeof now !== "number" || !Number.isFinite(now)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.clockInvalid,
      "A checkout intent requires a finite epoch-millisecond clock.",
    );
  }
  if (typeof userId !== "string" || !IDENTIFIER_RE.test(userId)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A checkout intent requires a url-safe user id.",
    );
  }
  if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A checkout intent requires a non-empty idempotency key.",
    );
  }
  if (!isHttpsUrl(successUrl) || !isHttpsUrl(cancelUrl)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.redirectUrlInsecure,
      "Checkout redirect URLs must be absolute https; a post-payment state transition is not upgraded from plaintext.",
    );
  }

  const resolvedMode = assertModeAuthorized(
    mode ?? DEFAULT_BILLING_MODE,
    liveModeAuthorized,
  );
  if (!resolvedMode.ok) return resolvedMode;

  const pack = lookupCreditPack(catalog, packId);
  if (!pack.ok) return pack;

  const candidate = {
    schemaVersion: 1 as const,
    kind: "sceneaxi.checkout-session-intent" as const,
    intentId: deriveIntentId(idempotencyKey),
    userId,
    purpose: "credit-pack" as const,
    itemId: pack.value.packId,
    credits: pack.value.credits,
    unitAmount: pack.value.unitAmount,
    currency: pack.value.currency,
    stripePriceId: pack.value.stripePriceId,
    mode: resolvedMode.value,
    successUrl,
    cancelUrl,
    idempotencyKey,
    createdAt: new Date(now).toISOString(),
  };

  const intent = validateCheckoutSessionIntent(candidate);
  if (!intent.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.checkoutIntentInvalid,
      `The checkout intent would be invalid (${intent.code}): ${intent.message}`,
    );
  }
  return billingOk(intent.value);
}

/**
 * Build a checkout intent from already-resolved price fields.
 *
 * Both the credit-pack path and the catalog-listing path funnel through here, so
 * the https guard, the live-mode gate, and the contract validation have exactly
 * one implementation. `credits` is passed only for a credit pack — a listing sale
 * grants none, and the contract refuses a nominal one.
 */
export function createMoneyCheckoutIntent(
  request: CreateMoneyCheckoutIntentRequest,
): BillingOutcome<CheckoutSessionIntent> {
  const {
    purpose,
    itemId,
    userId,
    unitAmount,
    currency,
    stripePriceId,
    successUrl,
    cancelUrl,
    idempotencyKey,
    now,
    credits,
    mode,
    liveModeAuthorized,
  } = request;

  if (typeof now !== "number" || !Number.isFinite(now)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.clockInvalid,
      "A checkout intent requires a finite epoch-millisecond clock.",
    );
  }
  if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A checkout intent requires a non-empty idempotency key.",
    );
  }
  if (!isHttpsUrl(successUrl) || !isHttpsUrl(cancelUrl)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.redirectUrlInsecure,
      "Checkout redirect URLs must be absolute https; a post-payment state transition is not upgraded from plaintext.",
    );
  }

  const resolvedMode = assertModeAuthorized(
    mode ?? DEFAULT_BILLING_MODE,
    liveModeAuthorized,
  );
  if (!resolvedMode.ok) return resolvedMode;

  const base = {
    schemaVersion: 1 as const,
    kind: "sceneaxi.checkout-session-intent" as const,
    intentId: deriveIntentId(idempotencyKey),
    userId,
    purpose,
    itemId,
    unitAmount,
    currency,
    stripePriceId,
    mode: resolvedMode.value,
    successUrl,
    cancelUrl,
    idempotencyKey,
    createdAt: new Date(now).toISOString(),
  };

  const intent = validateCheckoutSessionIntent(
    credits === undefined ? base : { ...base, credits },
  );
  if (!intent.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.checkoutIntentInvalid,
      `The checkout intent would be invalid (${intent.code}): ${intent.message}`,
    );
  }
  return billingOk(intent.value);
}
