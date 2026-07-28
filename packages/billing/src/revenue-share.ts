/**
 * Creator revenue share: 50% of credits on a credits sale, 50/50 bookkeeping on
 * a money sale.
 *
 * The split is integer arithmetic on basis points — `floor(gross × 5000 /
 * 10000)` to the creator, remainder to the platform — so it is exactly
 * reproducible and never mints a fractional credit. The remainder always lands
 * with the platform, which is the deliberate choice: rounding in the platform's
 * favour by at most one unit is defensible and auditable, whereas rounding up to
 * the creator would let a stream of 1-credit sales pay out more than came in.
 *
 * A credits sale is **atomic in effect**: `applyCreditsSale` computes both ledger
 * appends and returns them only if both succeed, so a failure anywhere leaves the
 * buyer's balance untouched. That falls out of the ledger being pure — there is
 * no half-applied intermediate state to roll back.
 *
 * A sale that charged nothing pays nothing. An admin buyer's unlimited allowance
 * debits no ledger, so there is no gross to split: no creator grant is minted and
 * no `CreatorShareRecord` is written, because a record asserting a gross nobody
 * paid would describe credits that never moved.
 *
 * Money sales record a `MoneySplitRecord` and nothing else. No payout, no Stripe
 * Connect: real cash payouts to creators are a later captain gate. They are also
 * the one path here that books money nobody in this process debited, so
 * `recordMoneySale` accepts no gross, currency, buyer, mode, or sale id at all:
 * it is built from a runtime-witnessed settlement plus the persisted intent that
 * settlement was bound to, and refuses everything else by name (sceneaxi#127).
 */

import {
  BASIS_POINTS_TOTAL,
  CREATOR_SHARE_BASIS_POINTS,
  MONEY_SPLIT_RECORD_KIND,
  REVENUE_SHARE_SCHEMA_VERSION,
  snapshotPlainRecord,
  validateCheckoutCompletedEvent,
  validateCheckoutSessionIntent,
  validateCreatorShareRecord,
  validateMoneySplitRecord,
  type CatalogListing,
  type CheckoutCompletedEvent,
  type CheckoutSessionIntent,
  type CreatorShareRecord,
  type EntitlementDecision,
  type IdentitySurface,
  type MoneySplitRecord,
} from "@sceneaxi/schemas";
import type { AdminIdentity } from "@sceneaxi/auth";
import {
  LISTING_SALE_IDEMPOTENCY_PREFIX,
  assertCurrencyListed,
  loadCatalogListings,
  lookupCatalogListing,
  purchaseListingWithCredits,
} from "./catalog-listings.js";
import { assertModeAuthorized, deriveIntentId } from "./checkout.js";
import { evaluateEntitlement } from "./entitlements.js";
import {
  appendCreditEntry,
  deriveEntryId,
  type AppendOutcome,
  type LedgerState,
} from "./ledger.js";
import {
  BILLING_REFUSE_REASONS,
  billingOk,
  billingRefuse,
  type BillingOutcome,
} from "./refusals.js";
import type { CreditStore } from "./store.js";
import {
  hasVerifiedCompletionProvenance,
  type VerifiedCheckoutCompletion,
} from "./stripe-webhook.js";

export { CREATOR_SHARE_BASIS_POINTS };

export type Split = Readonly<{ creator: number; platform: number }>;

/**
 * Split an integer amount by the creator's basis points.
 *
 * `Math.floor` on the creator side and subtraction for the platform means the
 * two always sum to `gross` by construction, rather than by two roundings that
 * happen to agree.
 */
function splitByBasisPoints(gross: number): Split {
  const creator = Number(
    (BigInt(gross) * BigInt(CREATOR_SHARE_BASIS_POINTS)) /
      BigInt(BASIS_POINTS_TOTAL),
  );
  return Object.freeze({ creator, platform: gross - creator });
}

/** Split credits 50/50, remainder to the platform. */
export function splitCredits(gross: number): BillingOutcome<Split> {
  if (!Number.isSafeInteger(gross) || gross < 1) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.amountInvalid,
      "A credit split requires a positive safe integer gross amount.",
    );
  }
  return billingOk(splitByBasisPoints(gross));
}

/** Split money minor units 50/50, remainder to the platform. */
export function splitMoneyMinorUnits(gross: number): BillingOutcome<Split> {
  if (!Number.isSafeInteger(gross) || gross < 1) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.amountInvalid,
      "A money split requires a positive safe integer gross amount in minor units.",
    );
  }
  return billingOk(splitByBasisPoints(gross));
}

/**
 * Authorize a creator publish.
 *
 * Thin on purpose: the entitlement matrix already says publishing is free but
 * account-gated, and duplicating that rule here is how the two would drift.
 */
export function authorizeCreatorPublish(input: {
  readonly principal?: unknown;
  readonly admin?: AdminIdentity | undefined;
  readonly now: number;
  readonly surface?: IdentitySurface | undefined;
}): BillingOutcome<EntitlementDecision> {
  const record = snapshotPlainRecord(input);
  if (record === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A creator publish request must be a plain object.",
    );
  }
  const screened = record as {
    readonly principal?: unknown;
    readonly admin?: AdminIdentity | undefined;
    readonly now: number;
    readonly surface?: IdentitySurface | undefined;
  };
  return evaluateEntitlement({
    capability: "creator-publish",
    now: screened.now,
    ...(screened.admin === undefined ? {} : { admin: screened.admin }),
    ...(screened.principal === undefined
      ? {}
      : { principal: screened.principal }),
    ...(screened.surface === undefined
      ? {}
      : { surface: screened.surface }),
  });
}

export type ApplyCreditsSaleRequest = Readonly<{
  principal: unknown;
  /** The single resolved admin identity, threaded to the buyer-side guard. */
  admin: AdminIdentity;
  listing: CatalogListing;
  /** The buyer's ledger. */
  buyerState: LedgerState;
  /** The creator's ledger; must belong to the listing's seller. */
  creatorState: LedgerState;
  /** Epoch milliseconds. */
  now: number;
  saleId: string;
  surface?: IdentitySurface | undefined;
}>;

export type CreditsSaleOutcome = Readonly<{
  buyer: AppendOutcome;
  /**
   * The creator's grant outcome. Absent when the floor split left the creator a
   * zero share (a 1-credit sale), so a zero-value ledger row is never created,
   * and absent when nothing was charged at all.
   */
  creator?: AppendOutcome | undefined;
  /**
   * The share record. Absent exactly when `charged` is false: no gross was
   * collected, so there is no gross to split, and a record claiming one would
   * describe credits that never moved.
   */
  share?: CreatorShareRecord | undefined;
  /** False when the buyer was an admin and nothing was debited. */
  charged: boolean;
  replayed: boolean;
}>;

export type PersistCreditsSaleRequest = ApplyCreditsSaleRequest &
  Readonly<{ store: CreditStore }>;

/**
 * Apply a credits sale: debit the buyer, credit the creator 50%, platform keeps
 * the remainder.
 *
 * Returns only when *both* appends succeed. Because ledger appends are pure, a
 * refusal on the creator side simply means nothing is returned — the caller's
 * buyer state is the same object it passed in, never a partially applied one.
 */
export function applyCreditsSale(
  request: ApplyCreditsSaleRequest,
): BillingOutcome<CreditsSaleOutcome> {
  const record = snapshotPlainRecord(request);
  if (record === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A credits sale request must be a plain object.",
    );
  }
  const screened = record as ApplyCreditsSaleRequest;
  const { principal, admin, listing, buyerState, creatorState, now, saleId, surface } =
    screened;

  const listed = assertCurrencyListed(listing, "credits");
  if (!listed.ok) return listed;
  const grossCredits = listed.value.creditPrice;
  if (grossCredits === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.listingPriceModeMismatch,
      `Listing "${listed.value.listingId}" claims a credit price mode but carries no creditPrice.`,
    );
  }

  const creatorRecord = snapshotPlainRecord(creatorState);
  const creatorAccount = snapshotPlainRecord(creatorRecord?.["account"]);
  if (
    creatorRecord === undefined ||
    creatorAccount === undefined ||
    creatorAccount["userId"] !== listed.value.sellerUserId
  ) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.accountNotOwned,
      "The creator ledger does not belong to the listing's seller.",
    );
  }

  const purchase = purchaseListingWithCredits({
    principal,
    admin,
    listing: listed.value,
    buyerState,
    now,
    saleId,
    ...(surface === undefined ? {} : { surface }),
  });
  if (!purchase.ok) return purchase;

  // An admin buyer's unlimited allowance debits nothing. Paying the creator
  // their half of a gross nobody paid would mint credits out of nothing, and the
  // share record would assert a collection that never happened, so the sale
  // stops here: the admin gets the listing, and no ledger anywhere moves.
  if (!purchase.value.charged) {
    return billingOk(
      Object.freeze({
        buyer: purchase.value.buyer,
        charged: false,
        replayed: false,
      }),
    );
  }

  const split = splitCredits(grossCredits);
  if (!split.ok) return split;

  // The floor split can leave the creator a zero share (a 1-credit sale rounds
  // to creator 0 / platform 1). A zero-value ledger row is illegal, so the
  // creator grant is omitted entirely and reported as a zero share instead.
  const creatorKey = `${LISTING_SALE_IDEMPOTENCY_PREFIX}${saleId}:creator`;
  const creatorGrant =
    split.value.creator === 0
      ? undefined
      : appendCreditEntry(creatorState, {
          entryId: deriveEntryId(creatorKey),
          movement: "grant",
          delta: split.value.creator,
          reason: `creator share for listing ${listed.value.listingId}`,
          idempotencyKey: creatorKey,
          now,
        });
  // Nothing has been committed anywhere: the buyer's own state object is
  // untouched, so refusing here leaves no half-applied sale behind.
  if (creatorGrant !== undefined && !creatorGrant.ok) return creatorGrant;

  const share = validateCreatorShareRecord({
    schemaVersion: REVENUE_SHARE_SCHEMA_VERSION,
    kind: "sceneaxi.creator-share-record",
    saleId,
    listingId: listed.value.listingId,
    buyerUserId: purchase.value.buyer.state.account.userId,
    creatorUserId: listed.value.sellerUserId,
    grossCredits,
    creatorCredits: split.value.creator,
    platformCredits: split.value.platform,
    basisPoints: CREATOR_SHARE_BASIS_POINTS,
    occurredAt:
      purchase.value.buyer.entry?.occurredAt ??
      creatorGrant?.value.entry?.occurredAt ??
      new Date(now).toISOString(),
  });
  if (!share.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.revenueShareInvalid,
      `The creator share record would be invalid (${share.code}): ${share.message}`,
    );
  }

  return billingOk(
    Object.freeze({
      buyer: purchase.value.buyer,
      ...(creatorGrant === undefined ? {} : { creator: creatorGrant.value }),
      share: share.value,
      charged: purchase.value.charged,
      replayed:
        purchase.value.buyer.replayed &&
        (creatorGrant === undefined || creatorGrant.value.replayed),
    }),
  );
}

export async function persistCreditsSale(
  request: PersistCreditsSaleRequest,
): Promise<BillingOutcome<CreditsSaleOutcome>> {
  const record = snapshotPlainRecord(request);
  if (record === undefined || record["store"] === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A persisted credits sale requires a credit store.",
    );
  }
  const { store, ...saleRequest } = record as PersistCreditsSaleRequest;
  const outcome = applyCreditsSale(saleRequest);
  if (!outcome.ok) return outcome;
  // Nothing was collected and nothing was granted, so there is no settlement to
  // commit; persisting a share record here would book an uncollected gross.
  if (outcome.value.share === undefined) return outcome;
  const share = outcome.value.share;

  try {
    const settled = await store.settleCreditsSale({
      ...(outcome.value.buyer.entry === undefined
        ? {}
        : { buyerEntry: outcome.value.buyer.entry }),
      ...(outcome.value.creator?.entry === undefined
        ? {}
        : { creatorEntry: outcome.value.creator.entry }),
      share,
    });
    return billingOk(
      Object.freeze({
        ...outcome.value,
        replayed: settled.replayed,
      }),
    );
  } catch {
    return billingRefuse(
      BILLING_REFUSE_REASONS.storeFailed,
      "The credit store failed while atomically settling the sale; no partial settlement is accepted.",
    );
  }
}

export type RecordMoneySaleRequest = Readonly<{
  /**
   * A completion whose provenance is proven: the exact object
   * `parseCheckoutCompletedEvent` returned for a signature-verified webhook whose
   * settlement was bound to its own Checkout Session. Checked at runtime, so
   * neither a fabricated completion, an `as` cast, nor a copy of a real one
   * satisfies it.
   */
  completion: VerifiedCheckoutCompletion;
  /**
   * The persisted intent that completion was bound to — the immutable price
   * record. It supplies the gross and the currency, and its idempotency key
   * names the sale, so none of those is a caller-supplied figure.
   */
  intent: CheckoutSessionIntent;
  /** The captain go-live gate; a live settlement refuses without it. */
  liveModeAuthorized?: boolean | undefined;
}>;

/**
 * Record a settled money sale's 50/50 split, from verified evidence only.
 *
 * Every figure in the record is read out of something this process verified. The
 * gross and currency come from the persisted intent; the buyer and the billing
 * mode come from the runtime-witnessed completion; the sale id is read out of the
 * intent's own idempotency key, which is re-derived into its intent id so it
 * cannot be renamed after settlement; the listing and its seller are resolved
 * from the committed catalog by the completion's item id. Nothing is accepted as
 * an assertion — there is no parameter for a gross, a currency, a buyer, a mode,
 * or a sale id, so a caller cannot book a split for a sale nobody paid.
 *
 * The intent, not the catalog, is the price authority: it is the snapshot the
 * checkout was actually created against, and the settlement was already bound to
 * it upstream. The listing is consulted only to name the seller who is owed the
 * creator half, and to refuse a listing the seller never priced in money.
 *
 * Bookkeeping only. This function performs no payout and the record it produces
 * has no field that could describe one — real cash payouts to creators are a
 * later captain gate.
 */
export function recordMoneySale(
  request: RecordMoneySaleRequest,
): BillingOutcome<MoneySplitRecord> {
  const requestRecord = snapshotPlainRecord(request);
  if (requestRecord === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A money sale request must be a plain object.",
    );
  }
  const screened = requestRecord as RecordMoneySaleRequest;

  // A `MoneySplitRecord` asserts that money moved. That claim can only rest on a
  // settlement this process verified, so provenance is asked before the
  // completion's contents are read at all.
  if (!hasVerifiedCompletionProvenance(screened.completion)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.completionNotVerified,
      "The checkout completion was not produced by parseCheckoutCompletedEvent from a verified webhook; no money sale is booked.",
    );
  }

  const completion = validateCheckoutCompletedEvent(screened.completion);
  if (!completion.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookPayloadInvalid,
      `The checkout completion is invalid (${completion.code}): ${completion.message}`,
    );
  }
  if (completion.value.purpose !== "catalog-listing") {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookEventTypeUnsupported,
      `A ${completion.value.purpose} completion books no money sale; it settles on the credit-grant path instead.`,
    );
  }

  const authorizedMode = assertModeAuthorized(
    completion.value.mode,
    screened.liveModeAuthorized,
  );
  if (!authorizedMode.ok) return authorizedMode;

  const bound = bindSettledIntent(screened.intent, completion.value);
  if (!bound.ok) return bound;

  const listings = loadCatalogListings();
  if (!listings.ok) return listings;
  const listing = lookupCatalogListing(
    listings.value,
    completion.value.itemId,
  );
  if (!listing.ok) return listing;
  const listed = assertCurrencyListed(listing.value, "money");
  if (!listed.ok) return listed;

  const split = splitMoneyMinorUnits(bound.value.intent.unitAmount);
  if (!split.ok) return split;

  const record = validateMoneySplitRecord({
    schemaVersion: REVENUE_SHARE_SCHEMA_VERSION,
    kind: MONEY_SPLIT_RECORD_KIND,
    saleId: bound.value.saleId,
    listingId: listed.value.listingId,
    buyerUserId: completion.value.userId,
    creatorUserId: listed.value.sellerUserId,
    grossMinor: bound.value.intent.unitAmount,
    creatorMinor: split.value.creator,
    platformMinor: split.value.platform,
    currency: bound.value.intent.currency,
    basisPoints: CREATOR_SHARE_BASIS_POINTS,
    mode: authorizedMode.value,
    // The settlement's own time, not the recorder's clock: re-recording the same
    // completion must produce the same record, and the moment that matters is
    // when the money moved.
    occurredAt: completion.value.occurredAt,
  });
  if (!record.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.revenueShareInvalid,
      `The money split record would be invalid (${record.code}): ${record.message}`,
    );
  }
  return billingOk(record.value);
}

/** The persisted intent a completion settles, and the sale its key names. */
export type SettledIntentBinding = Readonly<{
  intent: CheckoutSessionIntent;
  saleId: string;
}>;

/**
 * Bind a persisted intent to the completion that settled it, and read the sale
 * id out of it.
 *
 * Exported as the one named statement of that binding, so any path that must
 * attach settled money to a persisted intent uses this rule rather than a second
 * copy of it, and the rule can be exercised directly instead of only through the
 * recorder above. Every price-bearing field is compared, so an intent that
 * describes some other purchase cannot supply the gross; and the idempotency key
 * is re-derived into the intent id the completion pins, because the key is the
 * one intent field a caller could otherwise rewrite to attach settled money to a
 * different sale.
 */
export function bindSettledIntent(
  candidate: unknown,
  completion: CheckoutCompletedEvent,
): BillingOutcome<SettledIntentBinding> {
  const intent = validateCheckoutSessionIntent(candidate);
  if (!intent.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.checkoutIntentInvalid,
      `The persisted checkout intent is invalid (${intent.code}): ${intent.message}`,
    );
  }
  if (
    intent.value.intentId !== completion.intentId ||
    intent.value.userId !== completion.userId ||
    intent.value.purpose !== completion.purpose ||
    intent.value.itemId !== completion.itemId ||
    intent.value.mode !== completion.mode ||
    intent.value.unitAmount !== completion.unitAmount ||
    intent.value.currency !== completion.currency ||
    intent.value.stripePriceId !== completion.stripePriceId
  ) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.checkoutIntentInvalid,
      "The persisted checkout intent does not describe the settled completion.",
    );
  }
  if (!intent.value.idempotencyKey.startsWith(LISTING_SALE_IDEMPOTENCY_PREFIX)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.checkoutIntentInvalid,
      `A listing settlement's intent must be keyed "${LISTING_SALE_IDEMPOTENCY_PREFIX}<saleId>"; the sale id is not supplied separately, so bookkeeping cannot be attached to a different sale after the fact.`,
    );
  }
  if (deriveIntentId(intent.value.idempotencyKey) !== intent.value.intentId) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.checkoutIntentInvalid,
      "The persisted checkout intent's idempotency key does not derive its intent id; the settled sale cannot be renamed.",
    );
  }
  const saleId = intent.value.idempotencyKey.slice(
    LISTING_SALE_IDEMPOTENCY_PREFIX.length,
  );
  if (saleId.length === 0) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.checkoutIntentInvalid,
      "The checkout intent's idempotency key names no sale id.",
    );
  }
  return billingOk(Object.freeze({ intent: intent.value, saleId }));
}
