/**
 * Stripe webhook verification and idempotent credit grants.
 *
 * Signature verification is implemented **here**, not delegated, for three
 * reasons: it is the security boundary of the whole purchase path, it is a
 * documented HMAC construction with no provider round-trip, and it is fully
 * deterministic — so it can be tested exhaustively from local fixtures with no
 * network and no Stripe SDK. The provider API *call* that turns an intent into a
 * hosted checkout stays an injected adapter outside core.
 *
 * The scheme: `Stripe-Signature: t=<unix>,v1=<hex>[,v1=<hex>]`, where the signed
 * payload is `"<t>.<raw body bytes>"` under HMAC-SHA256 with the endpoint
 * secret. The **raw** bytes matter: re-serialising the JSON changes them and
 * must fail, which is why this function takes bytes and never an object.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  isEpochMilliseconds,
  isCheckoutPurpose,
  snapshotPlainRecord,
  validateCheckoutCompletedEvent,
  validateCheckoutSessionIntent,
  type BillingMode,
  type CheckoutCompletedEvent,
  type CheckoutSessionIntent,
} from "@sceneaxi/schemas";
import type { Awaitable } from "@sceneaxi/auth";
import { assertModeAuthorized } from "./checkout.js";
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

/** Stripe's default replay window. */
export const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300 as const;

/** Namespace for grant idempotency keys, so a replayed event cannot re-grant. */
export const STRIPE_EVENT_IDEMPOTENCY_PREFIX = "stripe-event:" as const;

export type VerifyStripeWebhookSignatureRequest = Readonly<{
  /** The **raw** request body. Never a re-serialised object. */
  payload: string | Uint8Array;
  /** The `Stripe-Signature` header value. */
  header: string;
  secret: string;
  /** Epoch milliseconds. */
  now: number;
  toleranceSeconds?: number | undefined;
}>;

/**
 * Compile-time provenance brands. A `VerifiedWebhook` can only be produced by
 * `verifyStripeWebhookSignature`, and a `VerifiedCheckoutCompletion` only by
 * `parseCheckoutCompletedEvent` from a verified webhook — so the public grant
 * path cannot be reached with a structurally valid but fabricated event. The
 * brands are type-level only and add no runtime property.
 */
declare const verifiedWebhookBrand: unique symbol;
declare const verifiedCompletionBrand: unique symbol;

export type VerifiedWebhook = Readonly<{
  /** Signature timestamp, epoch seconds. */
  timestamp: number;
  /** The verified body, decoded as UTF-8 for parsing. */
  payload: string;
  readonly [verifiedWebhookBrand]: true;
}>;

/**
 * Settlement evidence retrieved through the injected adapter boundary.
 *
 * Stripe webhook objects are minimal: `line_items` (and the per-line price) are
 * expandable and are not present in a signed `checkout.session.completed` body.
 * The authoritative settlement — paid status, amount, currency, quantity, and
 * Stripe price — is retrieved separately and supplied here, so the parser never
 * trusts embedded line items that a real webhook does not carry.
 */
export type CheckoutSettlement = Readonly<{
  paymentStatus: "paid" | "unpaid" | "no_payment_required";
  amountTotal: number;
  currency: string;
  quantity: number;
  stripePriceId: string;
}>;

/** Injected retrieval of settlement evidence for a checkout session. */
export type CheckoutSettlementPort = Readonly<{
  retrieveSettlement(
    sessionId: string,
  ): Awaitable<CheckoutSettlement | undefined>;
}>;

/** A checkout completion whose provenance is proven: parsed from a verified webhook. */
export type VerifiedCheckoutCompletion = CheckoutCompletedEvent &
  Readonly<{ readonly [verifiedCompletionBrand]: true }>;

function toBuffer(payload: string | Uint8Array): Buffer {
  return typeof payload === "string"
    ? Buffer.from(payload, "utf8")
    : Buffer.from(payload);
}

/**
 * Constant-time hex comparison.
 *
 * Length is checked first — that is a property of the *presented* header, whose
 * length is not secret — and the digests themselves are compared with
 * `timingSafeEqual`. A byte-wise early return would leak how much of a forged
 * signature was correct, which is enough to construct one byte at a time.
 */
function hexEquals(expected: string, presented: string): boolean {
  if (presented.length !== expected.length) return false;
  if (!/^[0-9a-fA-F]+$/.test(presented)) return false;
  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(presented.toLowerCase(), "hex"),
  );
}

/** Verify a Stripe webhook signature over the raw payload bytes. */
export function verifyStripeWebhookSignature(
  request: VerifyStripeWebhookSignatureRequest,
): BillingOutcome<VerifiedWebhook> {
  const record = snapshotPlainRecord(request);
  if (record === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A webhook verification request must be a plain object.",
    );
  }
  const screened = record as VerifyStripeWebhookSignatureRequest;
  const { payload, header, secret, now, toleranceSeconds } = screened;

  if (typeof secret !== "string" || secret.length === 0) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookSecretMissing,
      "No Stripe webhook secret is configured; verification refuses rather than accepting an unsigned event.",
    );
  }
  if (!isEpochMilliseconds(now)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.clockInvalid,
      "Webhook verification requires valid epoch milliseconds.",
    );
  }
  if (typeof header !== "string" || header.trim().length === 0) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.signatureHeaderMissing,
      "The Stripe-Signature header is absent.",
    );
  }
  if (typeof payload !== "string" && !(payload instanceof Uint8Array)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookPayloadInvalid,
      "The webhook payload must be the raw request body as a string or byte array.",
    );
  }

  let timestamp: number | undefined;
  const presented: string[] = [];
  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator <= 0) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.signatureHeaderMalformed,
        "The Stripe-Signature header is malformed.",
      );
    }
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "t") {
      if (!/^\d+$/.test(value)) {
        return billingRefuse(
          BILLING_REFUSE_REASONS.signatureHeaderMalformed,
          "The Stripe-Signature timestamp is not an integer.",
        );
      }
      timestamp = Number(value);
    } else if (key === "v1") {
      presented.push(value);
    }
    // Other schemes (v0, and anything Stripe adds later) are ignored, never
    // treated as an acceptable substitute for v1.
  }

  if (timestamp === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.signatureHeaderMalformed,
      "The Stripe-Signature header carries no timestamp.",
    );
  }
  if (presented.length === 0) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.signatureSchemeMissing,
      "The Stripe-Signature header carries no v1 signature; no other scheme is accepted.",
    );
  }

  const tolerance =
    typeof toleranceSeconds === "number" && Number.isFinite(toleranceSeconds)
      ? Math.min(
          Math.abs(toleranceSeconds),
          STRIPE_SIGNATURE_TOLERANCE_SECONDS,
        )
      : STRIPE_SIGNATURE_TOLERANCE_SECONDS;
  const nowSeconds = Math.floor(now / 1000);
  if (nowSeconds - timestamp > tolerance) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.signatureTimestampStale,
      `The webhook signature is older than the ${tolerance}s tolerance; a captured event cannot be replayed later.`,
    );
  }
  if (timestamp - nowSeconds > tolerance) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.signatureTimestampFuture,
      `The webhook signature is dated more than ${tolerance}s in the future.`,
    );
  }

  const body = toBuffer(payload);
  const expected = createHmac("sha256", secret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), body]))
    .digest("hex");

  // Every candidate is compared, so signature rotation works, and the loop does
  // not short-circuit on a length mismatch in a way that reveals which failed.
  let matched = false;
  for (const candidate of presented) {
    if (hexEquals(expected, candidate)) matched = true;
  }
  if (!matched) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.signatureMismatch,
      "The webhook signature does not match the raw payload under the configured secret.",
    );
  }

  return billingOk(
    Object.freeze({
      timestamp,
      payload: body.toString("utf8"),
    }) as VerifiedWebhook,
  );
}

/** Metadata keys SceneAxi sets on the Stripe Checkout Session. */
export const CHECKOUT_METADATA_KEYS = Object.freeze({
  userId: "sceneaxiUserId",
  purpose: "sceneaxiPurpose",
  itemId: "sceneaxiItemId",
  intentId: "sceneaxiIntentId",
} as const);

/**
 * Normalize a *verified* `checkout.session.completed` body into SceneAxi
 * vocabulary.
 *
 * The `verified` argument is the branded output of `verifyStripeWebhookSignature`,
 * so only a signature-checked body reaches this point. Settlement (paid status,
 * amount, currency, quantity, Stripe price) comes from the injected adapter
 * boundary — Stripe webhook objects are minimal and do not carry `line_items` —
 * and is bound to the persisted intent, which is the immutable price snapshot.
 * `credits` comes from that intent, never from the event: an attacker who could
 * influence event metadata must not be able to name their own credit amount.
 */
export function parseCheckoutCompletedEvent(input: {
  readonly verified: VerifiedWebhook;
  readonly intent: CheckoutSessionIntent | unknown;
  readonly settlement: CheckoutSettlement | unknown;
}): BillingOutcome<VerifiedCheckoutCompletion> {
  const inputRecord = snapshotPlainRecord(input);
  if (inputRecord === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A checkout event parse request must be a plain object.",
    );
  }
  const verified = inputRecord["verified"] as VerifiedWebhook;
  let raw: unknown;
  try {
    raw = JSON.parse(verified.payload) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookPayloadInvalid,
      `The webhook payload is not JSON: ${detail}`,
    );
  }
  const rawRecord = snapshotPlainRecord(raw);
  if (rawRecord === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookPayloadInvalid,
      "The webhook payload must be a JSON object.",
    );
  }

  if (rawRecord["type"] !== "checkout.session.completed") {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookEventTypeUnsupported,
      `Webhook event type "${String(rawRecord["type"])}" is not handled; only checkout.session.completed grants credits.`,
    );
  }

  const eventId = rawRecord["id"];
  const created = rawRecord["created"];
  const livemode = rawRecord["livemode"];
  if (typeof eventId !== "string" || eventId.length === 0) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookPayloadInvalid,
      "The webhook event carries no id; idempotency would be impossible.",
    );
  }
  const occurredAtEpoch =
    typeof created === "number" ? created * 1_000 : Number.NaN;
  if (!isEpochMilliseconds(occurredAtEpoch)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookPayloadInvalid,
      "The webhook event carries no valid created timestamp.",
    );
  }
  if (typeof livemode !== "boolean") {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookPayloadInvalid,
      "The webhook event must state livemode explicitly; an absent flag is not assumed to be test.",
    );
  }

  const data = snapshotPlainRecord(rawRecord["data"]);
  const object = snapshotPlainRecord(data?.["object"]);
  if (object === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookPayloadInvalid,
      "The checkout event carries no session object.",
    );
  }
  const metadata = object["metadata"];
  const metadataRecord = snapshotPlainRecord(metadata);
  if (metadataRecord === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookPayloadInvalid,
      "The checkout session carries no metadata object.",
    );
  }

  const userId = metadataRecord[CHECKOUT_METADATA_KEYS.userId];
  const purpose = metadataRecord[CHECKOUT_METADATA_KEYS.purpose];
  const itemId = metadataRecord[CHECKOUT_METADATA_KEYS.itemId];
  const intentId = metadataRecord[CHECKOUT_METADATA_KEYS.intentId];
  if (
    typeof userId !== "string" ||
    typeof itemId !== "string" ||
    typeof intentId !== "string" ||
    !isCheckoutPurpose(purpose)
  ) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookPayloadInvalid,
      `The checkout session metadata must carry ${CHECKOUT_METADATA_KEYS.userId}, a valid ${CHECKOUT_METADATA_KEYS.purpose}, ${CHECKOUT_METADATA_KEYS.itemId}, and ${CHECKOUT_METADATA_KEYS.intentId}.`,
    );
  }

  const mode: BillingMode = livemode ? "live" : "test";
  const intent = validateCheckoutSessionIntent(inputRecord["intent"]);
  if (!intent.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookPayloadInvalid,
      `The persisted checkout intent is invalid (${intent.code}): ${intent.message}`,
    );
  }
  if (
    intent.value.intentId !== intentId ||
    intent.value.userId !== userId ||
    intent.value.purpose !== purpose ||
    intent.value.itemId !== itemId ||
    intent.value.mode !== mode
  ) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookPayloadInvalid,
      "The checkout session metadata or mode does not match the persisted intent.",
    );
  }

  // Settlement is retrieved through the injected adapter boundary (Stripe webhook
  // objects are minimal and do not carry line items) and bound to the persisted
  // intent — the immutable price snapshot — rather than to the mutable catalog.
  const settlementRecord = snapshotPlainRecord(inputRecord["settlement"]);
  if (
    settlementRecord === undefined ||
    settlementRecord["paymentStatus"] !== "paid" ||
    settlementRecord["amountTotal"] !== intent.value.unitAmount ||
    settlementRecord["currency"] !== intent.value.currency ||
    settlementRecord["quantity"] !== 1 ||
    settlementRecord["stripePriceId"] !== intent.value.stripePriceId
  ) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookPayloadInvalid,
      "The settlement is unpaid or its amount, currency, quantity, or Stripe price does not match the persisted intent.",
    );
  }

  const base = {
    schemaVersion: 1 as const,
    kind: "sceneaxi.checkout-completed-event" as const,
    eventId,
    type: "checkout.session.completed" as const,
    mode,
    intentId,
    userId,
    purpose,
    itemId,
    stripePriceId: intent.value.stripePriceId,
    occurredAt: new Date(occurredAtEpoch).toISOString(),
  };

  const candidate: Record<string, unknown> =
    purpose === "credit-pack"
      ? {
          ...base,
          credits: intent.value.credits,
          unitAmount: intent.value.unitAmount,
          currency: intent.value.currency,
        }
      : {
          ...base,
          unitAmount: intent.value.unitAmount,
          currency: intent.value.currency,
        };

  const event = validateCheckoutCompletedEvent(candidate);
  if (!event.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookPayloadInvalid,
      `The normalized checkout event is invalid (${event.code}): ${event.message}`,
    );
  }
  return billingOk(event.value as VerifiedCheckoutCompletion);
}

export type ApplyCheckoutCompletedGrantRequest = Readonly<{
  state: LedgerState;
  /**
   * A checkout completion whose provenance is proven: the branded output of
   * `parseCheckoutCompletedEvent`, which only accepts a signature-verified
   * webhook. A fabricated event cannot satisfy this type.
   */
  completion: VerifiedCheckoutCompletion;
  /** Epoch milliseconds. */
  now: number;
  /** The captain go-live gate; a live event refuses without it. */
  liveModeAuthorized?: boolean | undefined;
}>;

/**
 * Grant a completed purchase's credits, exactly once.
 *
 * Keyed on `stripe-event:<eventId>`, so Stripe's at-least-once delivery is safe:
 * an identical redelivery returns the existing entry and grants nothing, while
 * the same event id carrying different money is an idempotency conflict rather
 * than a second grant.
 */
export function applyCheckoutCompletedGrant(
  request: ApplyCheckoutCompletedGrantRequest,
): BillingOutcome<AppendOutcome> {
  const record = snapshotPlainRecord(request);
  if (record === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A checkout grant request must be a plain object.",
    );
  }
  const screened = record as ApplyCheckoutCompletedGrantRequest;
  const { state, completion, now, liveModeAuthorized } = screened;

  const validated = validateCheckoutCompletedEvent(completion);
  if (!validated.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookPayloadInvalid,
      `The checkout event is invalid (${validated.code}): ${validated.message}`,
    );
  }
  const mode = assertModeAuthorized(validated.value.mode, liveModeAuthorized);
  if (!mode.ok) return mode;

  const validatedState = validateLedgerState(state);
  if (!validatedState.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.ledgerStateInvalid,
      "Granting credits requires a valid ledger state.",
    );
  }
  if (validatedState.value.account.userId !== validated.value.userId) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.accountNotOwned,
      "The checkout event names a different user than the credit account; the grant refuses.",
    );
  }

  // Only a credit-pack purchase grants credits. A catalog-listing purchase
  // transfers an asset and splits money; routing it here would mint credits
  // nobody bought, so it refuses rather than being silently ignored.
  if (validated.value.purpose !== "credit-pack") {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookEventTypeUnsupported,
      `A ${validated.value.purpose} completion grants no credits; use the revenue-share path instead.`,
    );
  }
  const credits = validated.value.credits;
  if (credits === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookPayloadInvalid,
      "A credit-pack completion event carries no credit amount.",
    );
  }

  const idempotencyKey = `${STRIPE_EVENT_IDEMPOTENCY_PREFIX}${validated.value.eventId}`;
  return appendCreditEntry(state, {
    entryId: deriveEntryId(idempotencyKey),
    movement: "grant",
    delta: credits,
    reason: `credit pack ${validated.value.itemId} purchased (${validated.value.mode})`,
    idempotencyKey,
    now,
  });
}

/**
 * Sign a payload the way Stripe does. Exists so fixtures and a real endpoint's
 * smoke test share one construction — a test that hand-rolled the header could
 * pass against a wrong implementation.
 */
export function signStripeWebhookPayload(input: {
  readonly payload: string | Uint8Array;
  readonly secret: string;
  /** Epoch seconds. */
  readonly timestamp: number;
}): string {
  const digest = createHmac("sha256", input.secret)
    .update(
      Buffer.concat([
        Buffer.from(`${input.timestamp}.`, "utf8"),
        toBuffer(input.payload),
      ]),
    )
    .digest("hex");
  return `t=${input.timestamp},v1=${digest}`;
}
