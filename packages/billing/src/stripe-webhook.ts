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

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  createProvenanceWitness,
  isEpochMilliseconds,
  isCheckoutPurpose,
  isNonEmptyString,
  snapshotPlainRecord,
  validateCheckoutCompletedEvent,
  validateCheckoutSessionIntent,
  type BillingMode,
  type CheckoutCompletedEvent,
  type CheckoutSessionIntent,
} from "@sceneaxi/schemas";
import type { Awaitable } from "@sceneaxi/auth";
import { assertModeAuthorized } from "./checkout.js";
import { resolveCreditPackRevision } from "./credit-packs.js";
import {
  appendCreditEntry,
  deriveEntryId,
  validateLedgerState,
  type AppendOutcome,
  type LedgerState,
} from "./ledger.js";
import { readCommittedEntry, type CreditStore } from "./store.js";
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
 * Compile-time provenance markers. They guide ordinary typed callers toward
 * `verifyStripeWebhookSignature` and `parseCheckoutCompletedEvent`, but they are
 * not a trust boundary: JavaScript and an `as` cast can fabricate either type.
 * The runtime witnesses below enforce origin; these brands add no runtime
 * property.
 */
declare const verifiedWebhookBrand: unique symbol;
declare const verifiedCompletionBrand: unique symbol;

/**
 * The runtime half of those brands, and the load-bearing half.
 *
 * A type brand stops a TypeScript caller; it stops neither a JavaScript one nor
 * an `as` cast, and both of those reach the same exported functions. Credits are
 * granted here, so "did a signature check actually produce this value" has to be
 * a question the code asks at runtime, not one the compiler asks about the code.
 *
 * These witnesses are module-private, so the only way to hold a value they
 * recognise is to have called the step that issues it — verification for a
 * webhook, parsing-from-a-verified-webhook for a completion. Nothing is written
 * onto the values, so every structural check downstream is unchanged.
 */
const verifiedWebhookProvenance = createProvenanceWitness<VerifiedWebhook>();
const verifiedCompletionProvenance =
  createProvenanceWitness<VerifiedCheckoutCompletion>();

/**
 * Whether a value is a webhook this module verified. Exported because a caller
 * sequencing its own webhook route may want to assert it; checking provenance
 * grants nothing, and issuing it is not exported at all.
 */
export function hasVerifiedWebhookProvenance(
  value: unknown,
): value is VerifiedWebhook {
  return verifiedWebhookProvenance.holds(value);
}

/** Whether a value is a completion this module parsed from a verified webhook. */
export function hasVerifiedCompletionProvenance(
  value: unknown,
): value is VerifiedCheckoutCompletion {
  return verifiedCompletionProvenance.holds(value);
}

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
 *
 * `sessionId` is what makes the evidence *this event's*. Amount, currency, and
 * price are shared by every session that bought the same thing, so without the
 * session id a settlement retrieved for one genuinely paid session validates a
 * different one's event. It is the id the retrieval was made for, echoed back by
 * the adapter, and the parser refuses unless it equals the id in the verified
 * body — so a caller that retrieved for the wrong session, or that reused a
 * settlement across events, refuses instead of settling.
 */
export type CheckoutSettlement = Readonly<{
  /** The Checkout Session this settlement was retrieved for. */
  sessionId: string;
  paymentStatus: "paid" | "unpaid" | "no_payment_required";
  amountTotal: number;
  currency: string;
  quantity: number;
  stripePriceId: string;
}>;

/**
 * Injected retrieval of settlement evidence for a checkout session.
 *
 * The adapter must answer for the id it was asked about and echo it back on
 * `sessionId`; anything else refuses at the parser rather than being trusted.
 */
export type CheckoutSettlementPort = Readonly<{
  retrieveSettlement(
    sessionId: string,
  ): Awaitable<CheckoutSettlement | undefined>;
}>;

/** A checkout completion whose provenance is proven: parsed from a verified webhook. */
export type VerifiedCheckoutCompletion = CheckoutCompletedEvent &
  Readonly<{ readonly [verifiedCompletionBrand]: true }>;

function fingerprintCheckoutCompletion(
  completion: CheckoutCompletedEvent,
): string {
  const canonical = JSON.stringify([
    completion.schemaVersion,
    completion.kind,
    completion.eventId,
    completion.type,
    completion.mode,
    completion.checkoutSessionId,
    completion.intentId,
    completion.userId,
    completion.purpose,
    completion.itemId,
    completion.credits ?? null,
    completion.unitAmount,
    completion.currency,
    completion.stripePriceId,
    completion.occurredAt,
  ]);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

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
    verifiedWebhookProvenance.issue({
      timestamp,
      payload: body.toString("utf8"),
    } as VerifiedWebhook),
  );
}

/**
 * The one checkout purpose this path settles into the credit ledger.
 *
 * A catalog-listing purchase transfers an asset and splits money instead, so it
 * grants no credits. `applyCheckoutCompletedGrant` remains the authority — it
 * refuses any other purpose rather than silently ignoring it — and this constant
 * plus its predicate exist so a caller *sequencing* the grant can tell, from a
 * completion it already holds, that no ledger read is owed at all. An event that
 * grants nothing by design must not depend on a store that may be unreachable.
 */
export const CREDIT_GRANTING_CHECKOUT_PURPOSE = "credit-pack" as const;

/** Whether a completed checkout's purpose is one the credit ledger settles. */
export function checkoutPurposeGrantsCredits(
  purpose: unknown,
): purpose is typeof CREDIT_GRANTING_CHECKOUT_PURPOSE {
  return purpose === CREDIT_GRANTING_CHECKOUT_PURPOSE;
}

/**
 * Whether a value names a *known* checkout purpose that settles somewhere other than
 * the credit ledger.
 *
 * This is the routing form of the rule above, for a caller that holds only raw session
 * metadata and has not yet read the evidence a completion must be bound to. It answers
 * `false` for anything that is not one of `CHECKOUT_PURPOSES`, so an absent, malformed,
 * or unknown purpose keeps its existing path and is still refused as an invalid payload
 * by `parseCheckoutCompletedEvent` — this can only send a body *away* from the grant
 * path, never admit one to it.
 */
export function checkoutPurposeSettlesElsewhere(purpose: unknown): boolean {
  return isCheckoutPurpose(purpose) && !checkoutPurposeGrantsCredits(purpose);
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
 * The `verified` argument is the exact object `verifyStripeWebhookSignature`
 * issued, checked at runtime below, so only a signature-checked body reaches this
 * point. Settlement (paid status,
 * amount, currency, quantity, Stripe price) comes from the injected adapter
 * boundary — Stripe webhook objects are minimal and do not carry `line_items` —
 * and is bound to the persisted intent, which is the immutable price snapshot.
 * The normalized `credits` starts from that intent, never from the event, but the
 * grant path cross-checks it against the committed archive before any ledger entry:
 * an attacker who could influence event metadata or the persisted amount must not
 * be able to name their own credit amount.
 *
 * The event's Checkout Session id (`data.object.id`) is read here and compared
 * against the settlement's own `sessionId` **inside this boundary**, so the
 * comparison cannot be skipped by a caller that retrieved evidence for the wrong
 * session. It is carried onto the completion, so every downstream grant and split
 * names the exact session that paid rather than an identically-priced one.
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
  // Provenance before parsing: the whole meaning of `verified` is that a
  // signature check produced it, and `{ timestamp, payload }` is a shape anyone
  // can build. Asking the witness is what makes an unsigned body unable to
  // reach the normalization below at all.
  if (!hasVerifiedWebhookProvenance(inputRecord["verified"])) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookNotVerified,
      "The webhook was not produced by verifyStripeWebhookSignature; an unverified or hand-built body is refused before it is parsed.",
    );
  }
  const verified = inputRecord["verified"];
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
  // The session's own id, before anything is compared. Every other figure the
  // settlement carries — amount, currency, price — is shared by every session
  // that bought the same thing, so this is the only field that can say *which*
  // paid session this event is about.
  const checkoutSessionId = object["id"];
  // Presence only, through the completion contract's own predicate rather than a
  // second copy of it, so the two layers cannot disagree about what "present"
  // means and name different refusals for the same id. Deliberately not
  // SceneAxi's IDENTIFIER_RE: the id is provider-generated and opaque, and
  // Stripe guarantees nothing about its length or charset, so a format rule here
  // would refuse a genuinely paid webhook for good. What the binding needs is an
  // id to compare — absent, it would equal a settlement carrying no sessionId
  // and pass — and the comparison itself is exact string equality.
  if (!isNonEmptyString(checkoutSessionId)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.checkoutSessionIdMissing,
      "The checkout event's session object names no Checkout Session id, so no settlement can be bound to the session that was paid.",
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
  // No evidence at all is a different fault from evidence about another session,
  // and saying so is what lets a caller tell a failed retrieval apart from a
  // retrieval made for the wrong session.
  if (settlementRecord === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookPayloadInvalid,
      "No settlement was supplied for the checkout session; nothing can be verified about what was paid.",
    );
  }
  // Which session it settles is asked first, and separately. Amount, currency,
  // and price all match by construction between two genuinely paid sessions for
  // the same item, so checking them first would let a settlement retrieved for
  // another paid session validate this event and report only a payload problem.
  if (settlementRecord["sessionId"] !== checkoutSessionId) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.settlementSessionMismatch,
      `The settlement is not bound to Checkout Session "${checkoutSessionId}"; evidence from another session settles nothing here, however well its amount and currency match.`,
    );
  }
  if (
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
    checkoutSessionId,
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
  return billingOk(
    verifiedCompletionProvenance.issue(
      event.value as VerifiedCheckoutCompletion,
    ),
  );
}

export type ApplyCheckoutCompletedGrantRequest = Readonly<{
  state: LedgerState;
  /**
   * A checkout completion whose provenance is proven: the exact object
   * `parseCheckoutCompletedEvent` returned, which it only returns for a
   * signature-verified webhook. Checked at runtime, so neither a fabricated
   * event, an `as` cast, nor a copy of a real completion satisfies it.
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
 * the same event id carrying different normalized completion evidence is an
 * idempotency conflict rather than a second grant.
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

  // This is the credit-minting step, so the provenance question comes before
  // any structural one: a completion that reads perfectly but was never parsed
  // from a verified webhook describes a purchase Stripe never settled.
  if (!hasVerifiedCompletionProvenance(completion)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.completionNotVerified,
      "The checkout completion was not produced by parseCheckoutCompletedEvent from a verified webhook; no credits are granted.",
    );
  }

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
  if (!checkoutPurposeGrantsCredits(validated.value.purpose)) {
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

  // The persisted intent is not itself an issuance authority. Resolve its exact
  // price tuple against the committed archive before constructing the ledger
  // entry, so a signed/session-bound intent cannot inflate a paid grant and a
  // repriced or retired pack remains grantable from its retained revision.
  const revision = resolveCreditPackRevision(
    validated.value.itemId,
    validated.value.stripePriceId,
    validated.value.unitAmount,
  );
  if (!revision.ok) return revision;
  if (validated.value.currency !== revision.value.currency) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.catalogRevisionUnresolvable,
      `The checkout completion settles in "${validated.value.currency}", but committed credit pack revision "${revision.value.revisionId}" is priced in "${revision.value.currency}"; no revision resolves that tuple.`,
    );
  }
  if (credits !== revision.value.credits) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.catalogRevisionCreditsMismatch,
      `The checkout completion claims ${credits} credits, but committed credit pack revision "${revision.value.revisionId}" grants ${revision.value.credits}.`,
    );
  }

  const idempotencyKey = `${STRIPE_EVENT_IDEMPOTENCY_PREFIX}${validated.value.eventId}`;
  const completionFingerprint = fingerprintCheckoutCompletion(validated.value);
  return appendCreditEntry(state, {
    entryId: deriveEntryId(idempotencyKey),
    movement: "grant",
    delta: revision.value.credits,
    reason: `credit pack ${validated.value.itemId} purchased (${validated.value.mode}); completion-sha256:${completionFingerprint}`,
    idempotencyKey,
    now,
  });
}

export type PersistCheckoutCompletedGrantRequest =
  ApplyCheckoutCompletedGrantRequest & Readonly<{ store: CreditStore }>;

/**
 * Grant a completed purchase's credits **and commit them**, or refuse.
 *
 * `applyCheckoutCompletedGrant` decides; it cannot commit, because it owns no
 * persistence. A webhook endpoint that answered 2xx on its result alone would be
 * telling Stripe the purchase was honored while the buyer's ledger was
 * unchanged, and Stripe would never redeliver it. This is the boundary that
 * closes that gap: success is reported only after the store has the entry.
 *
 * The commit is `appendOrReplayEntry` on the event's own key
 * (`stripe-event:<eventId>`), so at-least-once delivery stays safe from both
 * sides — the pure path answers a redelivery the ledger already shows, and the
 * store answers one that landed after this caller read the ledger. Exactly one
 * grant exists either way. A commit that fails refuses `CREDIT_STORE_FAILED`
 * with no entry, which is the outcome a provider must retry.
 */
export async function persistCheckoutCompletedGrant(
  request: PersistCheckoutCompletedGrantRequest,
): Promise<BillingOutcome<AppendOutcome>> {
  const record = snapshotPlainRecord(request);
  if (record === undefined || record["store"] === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A persisted checkout grant requires a credit store.",
    );
  }
  const { store, ...grantRequest } =
    record as unknown as PersistCheckoutCompletedGrantRequest;

  const granted = applyCheckoutCompletedGrant(grantRequest);
  if (!granted.ok) return granted;

  const entry = granted.value.entry;
  // The ledger the caller read already holds this event's grant, so there is
  // nothing to commit and the existing row is the answer.
  if (granted.value.replayed || entry === undefined) return granted;

  let answer: unknown;
  try {
    answer = await store.appendOrReplayEntry(entry);
  } catch {
    answer = undefined;
  }
  // A store this call cannot prove was built by `createCreditStore` is held to
  // the same answer-for-what-was-asked rule here, so `ignored: false` never
  // reports a grant the ledger does not hold under this event's own key.
  const committed = readCommittedEntry(entry, answer);
  if (committed === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.storeFailed,
      "The credit store failed while committing the checkout grant; no credits are granted.",
    );
  }
  if (!committed.replayed) return granted;

  return billingOk(
    Object.freeze({
      state: Object.freeze({
        account: granted.value.state.account,
        entries: Object.freeze([
          ...granted.value.state.entries.slice(0, -1),
          committed.entry,
        ]),
        balance: granted.value.state.balance,
      }),
      entry: committed.entry,
      replayed: true,
    }),
  );
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
