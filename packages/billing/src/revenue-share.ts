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
 * Money sales record a `MoneySplitRecord` and nothing else. No payout, no Stripe
 * Connect: real cash payouts to creators are a later captain gate.
 */

import {
  BASIS_POINTS_TOTAL,
  CREATOR_SHARE_BASIS_POINTS,
  MONEY_SPLIT_RECORD_KIND,
  REVENUE_SHARE_SCHEMA_VERSION,
  isEpochMilliseconds,
  snapshotPlainRecord,
  validateCreatorShareRecord,
  validateMoneySplitRecord,
  type BillingMode,
  type CatalogListing,
  type CreatorShareRecord,
  type EntitlementDecision,
  type IdentitySurface,
  type MoneySplitRecord,
} from "@sceneaxi/schemas";
import {
  LISTING_SALE_IDEMPOTENCY_PREFIX,
  assertCurrencyListed,
  purchaseListingWithCredits,
} from "./catalog-listings.js";
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
  const creator = Math.floor((gross * CREATOR_SHARE_BASIS_POINTS) / BASIS_POINTS_TOTAL);
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
    readonly now: number;
    readonly surface?: IdentitySurface | undefined;
  };
  return evaluateEntitlement({
    capability: "creator-publish",
    now: screened.now,
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
  creator: AppendOutcome;
  share: CreatorShareRecord;
  /** False when the buyer was an admin and nothing was debited. */
  charged: boolean;
  replayed: boolean;
}>;

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
  const { principal, listing, buyerState, creatorState, now, saleId, surface } =
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
    listing: listed.value,
    buyerState,
    now,
    saleId,
    ...(surface === undefined ? {} : { surface }),
  });
  if (!purchase.ok) return purchase;

  const split = splitCredits(grossCredits);
  if (!split.ok) return split;

  const creatorKey = `${LISTING_SALE_IDEMPOTENCY_PREFIX}${saleId}:creator`;
  const creatorGrant = appendCreditEntry(creatorState, {
    entryId: deriveEntryId(creatorKey),
    movement: "grant",
    delta: split.value.creator,
    reason: `creator share for listing ${listed.value.listingId}`,
    idempotencyKey: creatorKey,
    now,
  });
  // Nothing has been committed anywhere: the buyer's own state object is
  // untouched, so refusing here leaves no half-applied sale behind.
  if (!creatorGrant.ok) return creatorGrant;

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
    occurredAt: new Date(now).toISOString(),
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
      creator: creatorGrant.value,
      share: share.value,
      charged: purchase.value.charged,
      replayed: purchase.value.buyer.replayed && creatorGrant.value.replayed,
    }),
  );
}

export type RecordMoneySaleRequest = Readonly<{
  listing: CatalogListing;
  buyerUserId: string;
  saleId: string;
  /** Gross paid, in the currency's minor unit. */
  grossMinor: number;
  currency: string;
  mode: BillingMode;
  /** Epoch milliseconds. */
  now: number;
}>;

/**
 * Record a money sale's 50/50 split.
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
  const { listing, buyerUserId, saleId, grossMinor, currency, mode, now } =
    screened;

  const listed = assertCurrencyListed(listing, "money");
  if (!listed.ok) return listed;

  if (!isEpochMilliseconds(now)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.clockInvalid,
      "A money sale record requires valid epoch milliseconds.",
    );
  }

  const split = splitMoneyMinorUnits(grossMinor);
  if (!split.ok) return split;

  const record = validateMoneySplitRecord({
    schemaVersion: REVENUE_SHARE_SCHEMA_VERSION,
    kind: MONEY_SPLIT_RECORD_KIND,
    saleId,
    listingId: listed.value.listingId,
    buyerUserId,
    creatorUserId: listed.value.sellerUserId,
    grossMinor,
    creatorMinor: split.value.creator,
    platformMinor: split.value.platform,
    currency,
    basisPoints: CREATOR_SHARE_BASIS_POINTS,
    mode,
    occurredAt: new Date(now).toISOString(),
  });
  if (!record.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.revenueShareInvalid,
      `The money split record would be invalid (${record.code}): ${record.message}`,
    );
  }
  return billingOk(record.value);
}
