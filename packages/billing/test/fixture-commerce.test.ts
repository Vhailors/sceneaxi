import { describe, expect, it } from "vitest";
import { AUTH_REFUSE_REASONS, digestSessionToken } from "@sceneaxi/auth";
import {
  CREATOR_SHARE_BASIS_POINTS,
  validateCheckoutSessionIntent,
  validateMoneySplitRecord,
  type CatalogListing,
  type CheckoutSessionIntent,
  type CreditAccount,
} from "@sceneaxi/schemas";
import {
  BILLING_REFUSE_REASONS,
  CHECKOUT_METADATA_KEYS,
  FIXTURE_COMMERCE_CAPABILITY,
  FIXTURE_COMMERCE_CHECKOUT_PURPOSE,
  FIXTURE_COMMERCE_LISTING_IDS,
  FIXTURE_COMMERCE_MODE,
  LISTING_SALE_IDEMPOTENCY_PREFIX,
  appendCreditEntry,
  applyCheckoutCompletedGrant,
  authorizeFixtureListingPurchase,
  createFixtureListingCheckoutIntent,
  createCheckoutSessionIntent,
  createLedgerState,
  createListingCheckoutIntent,
  loadCatalogListings,
  loadCreditPackCatalog,
  parseCheckoutCompletedEvent,
  purchaseFixtureListingWithCredits,
  resolveFixtureCommerceListing,
  settleFixtureListingMoneySale,
  signStripeWebhookPayload,
  verifyStripeWebhookSignature,
  type LedgerState,
  type VerifiedCheckoutCompletion,
} from "@sceneaxi/billing";

/**
 * The bounded fixture-commerce path.
 *
 * Two things are under test and they pull in opposite directions: that exactly
 * one SKU transacts green in both its currencies, and that nothing else in the
 * catalog — or outside it — can be transacted at all.
 */

const NOW = Date.parse("2026-07-25T10:00:00Z");
const NOW_SECONDS = Math.floor(NOW / 1000);
const SECRET = "whsec_fixture_commerce";
const admin = {
  email: "captain@example.com",
  source: "SCENEAXI_ADMIN_EMAIL",
} as const;

const ENABLED_LISTING_ID = "market-stall-kit";
const SELLER_USER_ID = "usr_creator_ada";
const CREDIT_PRICE = 75;
const MONEY_MINOR = 2500;

const account = (userId: string): CreditAccount =>
  Object.freeze({
    schemaVersion: 1,
    kind: "sceneaxi.credit-account",
    accountId: `acc_${userId}`,
    userId,
    createdAt: "2026-07-25T09:00:00Z",
  }) as CreditAccount;

const principal = (
  overrides: {
    userId?: string;
    role?: "admin" | "user";
    surface?: string;
  } = {},
): unknown => {
  const userId = overrides.userId ?? "usr_buyer";
  const role = overrides.role ?? "user";
  return {
    user: {
      schemaVersion: 1,
      kind: "sceneaxi.user",
      userId,
      email: role === "admin" ? "captain@example.com" : "buyer@example.com",
      emailVerified: true,
      disabled: false,
      createdAt: "2026-07-25T09:00:00Z",
    },
    role: {
      schemaVersion: 1,
      kind: "sceneaxi.role-assignment",
      userId,
      role,
      source: role === "admin" ? "admin-env" : "default-user",
      assignedAt: "2026-07-25T09:30:00Z",
    },
    session: {
      schemaVersion: 1,
      kind: "sceneaxi.session",
      sessionId: "ses_01",
      userId,
      surface: overrides.surface ?? "web-shell",
      issuedAt: "2026-07-25T09:00:00Z",
      expiresAt: "2026-07-26T10:00:00Z",
      tokenDigest: digestSessionToken("tok"),
    },
  };
};

const funded = (credits: number, userId = "usr_buyer"): LedgerState => {
  const empty = createLedgerState(account(userId));
  if (credits === 0) return empty;
  const appended = appendCreditEntry(empty, {
    entryId: "ent_fund",
    movement: "grant",
    delta: credits,
    reason: "test funding",
    idempotencyKey: `fixture:fund:${userId}`,
    now: NOW,
  });
  if (!appended.ok) throw new Error("fixture funding failed");
  return appended.value.state;
};

const otherCommittedListingIds = (): readonly string[] => {
  const loaded = loadCatalogListings();
  if (!loaded.ok) throw new Error("listing load failed");
  return loaded.value.listings
    .map((held) => held.listingId)
    .filter((id) => !FIXTURE_COMMERCE_LISTING_IDS.some((held) => held === id));
};

/** Drive a listing intent through the real signature and parse path. */
const settleIntent = (
  intent: CheckoutSessionIntent,
  overrides: { readonly amountTotal?: number } = {},
): VerifiedCheckoutCompletion => {
  const body = JSON.stringify({
    id: `evt_${intent.intentId}`,
    type: "checkout.session.completed",
    created: NOW_SECONDS,
    livemode: intent.mode === "live",
    data: {
      object: {
        id: `cs_${intent.intentId}`,
        metadata: {
          [CHECKOUT_METADATA_KEYS.userId]: intent.userId,
          [CHECKOUT_METADATA_KEYS.purpose]: intent.purpose,
          [CHECKOUT_METADATA_KEYS.itemId]: intent.itemId,
          [CHECKOUT_METADATA_KEYS.intentId]: intent.intentId,
        },
      },
    },
  });
  const verified = verifyStripeWebhookSignature({
    payload: body,
    header: signStripeWebhookPayload({
      payload: body,
      secret: SECRET,
      timestamp: NOW_SECONDS,
    }),
    secret: SECRET,
    now: NOW,
  });
  if (!verified.ok) throw new Error("fixture signature failed");
  const completion = parseCheckoutCompletedEvent({
    verified: verified.value,
    intent,
    settlement: {
      paymentStatus: "paid",
      amountTotal: overrides.amountTotal ?? intent.unitAmount,
      currency: intent.currency,
      quantity: 1,
      stripePriceId: intent.stripePriceId,
    },
  });
  if (!completion.ok) throw new Error(`fixture parse failed: ${completion.message}`);
  return completion.value;
};

const moneyIntent = (): CheckoutSessionIntent => {
  const intent = createFixtureListingCheckoutIntent({
    principal: principal(),
    admin,
    listingId: ENABLED_LISTING_ID,
    successUrl: "https://sceneaxi.example/checkout/success",
    cancelUrl: "https://sceneaxi.example/checkout/cancel",
    now: NOW,
    saleId: "sale_fixture_money",
  });
  if (!intent.ok) throw new Error(`fixture intent failed: ${intent.message}`);
  return intent.value;
};

describe("the enabled fixture SKU", () => {
  it("enumerates exactly one purchasable listing", () => {
    expect(FIXTURE_COMMERCE_LISTING_IDS).toEqual([ENABLED_LISTING_ID]);
    expect(Object.isFrozen(FIXTURE_COMMERCE_LISTING_IDS)).toBe(true);
    expect(FIXTURE_COMMERCE_MODE).toBe("test");
    expect(FIXTURE_COMMERCE_CAPABILITY).toBe("catalog-asset-purchase");
    expect(FIXTURE_COMMERCE_CHECKOUT_PURPOSE).toBe("catalog-listing");
  });

  it("resolves it from the committed set, dual-priced", () => {
    const listing = resolveFixtureCommerceListing(ENABLED_LISTING_ID);
    expect(listing.ok).toBe(true);
    if (!listing.ok) return;
    expect(listing.value.priceMode).toBe("credits-and-money");
    expect(listing.value.creditPrice).toBe(CREDIT_PRICE);
    expect(listing.value.moneyPrice?.unitAmount).toBe(MONEY_MINOR);
    expect(listing.value.sellerUserId).toBe(SELLER_USER_ID);
  });
});

describe("the non-fixture marketplace stays inert", () => {
  it("refuses every other committed listing by name", () => {
    const others = otherCommittedListingIds();
    expect(others.length).toBeGreaterThan(0);
    for (const listingId of others) {
      const refused = resolveFixtureCommerceListing(listingId);
      expect(refused.ok).toBe(false);
      if (refused.ok) return;
      expect(refused.reason).toBe(
        BILLING_REFUSE_REASONS.listingFixtureCommerceNotEnabled,
      );
    }
  });

  it("refuses an unknown id, and a non-string one", () => {
    for (const listingId of ["not-a-listing", "", undefined, 7, null, {}]) {
      const refused = resolveFixtureCommerceListing(listingId);
      expect(refused.ok).toBe(false);
      if (refused.ok) return;
      expect(refused.reason).toBe(
        BILLING_REFUSE_REASONS.listingFixtureCommerceNotEnabled,
      );
    }
  });

  it("offers no entry point that accepts a caller-supplied listing", async () => {
    // A fabricated listing is the arbitrary-SKU hole this module exists to
    // close: the id is what is resolved, and a listing object is never read.
    const fabricated = {
      schemaVersion: 1,
      kind: "sceneaxi.catalog-listing",
      listingId: "counterfeit-kit",
      catalog: "game",
      sellerUserId: "usr_attacker",
      title: "Counterfeit kit",
      priceMode: "credits-and-money",
      creditPrice: 1,
      moneyPrice: {
        unitAmount: 1,
        currency: "usd",
        stripePriceId: "price_test_counterfeit",
      },
      publishedAt: "2026-07-24T12:00:00Z",
    } as unknown as CatalogListing;

    const purchased = await purchaseFixtureListingWithCredits({
      principal: principal(),
      admin,
      listingId: fabricated,
      buyerState: funded(100),
      creatorState: createLedgerState(account("usr_attacker")),
      now: NOW,
      saleId: "sale_counterfeit",
    });
    expect(purchased.ok).toBe(false);
    if (purchased.ok) return;
    expect(purchased.reason).toBe(
      BILLING_REFUSE_REASONS.listingFixtureCommerceNotEnabled,
    );
  });

  it("books no money split for a settled non-fixture listing", () => {
    const harbour = createListingCheckoutIntent({
      principal: principal(),
      admin,
      listing: (() => {
        const loaded = loadCatalogListings();
        if (!loaded.ok) throw new Error("listing load failed");
        const found = loaded.value.listings.find(
          (held) => held.listingId === "harbour-diorama",
        );
        if (found === undefined) throw new Error("fixture listing missing");
        return found;
      })(),
      successUrl: "https://sceneaxi.example/checkout/success",
      cancelUrl: "https://sceneaxi.example/checkout/cancel",
      now: NOW,
      saleId: "sale_harbour",
    });
    expect(harbour.ok).toBe(true);
    if (!harbour.ok) return;

    const settled = settleFixtureListingMoneySale({
      completion: settleIntent(harbour.value),
      intent: harbour.value,
      now: NOW,
    });
    expect(settled.ok).toBe(false);
    if (settled.ok) return;
    expect(settled.reason).toBe(
      BILLING_REFUSE_REASONS.listingFixtureCommerceNotEnabled,
    );
  });
});

describe("the documented catalog entitlement governs the purchase", () => {
  it("prices the credits currency at the seller's listed credit price", () => {
    const authorized = authorizeFixtureListingPurchase({
      principal: principal(),
      admin,
      listingId: ENABLED_LISTING_ID,
      payWith: "credits",
      buyerState: funded(CREDIT_PRICE),
      now: NOW,
    });
    expect(authorized.ok).toBe(true);
    if (!authorized.ok) return;
    expect(authorized.value.decision.capability).toBe(
      FIXTURE_COMMERCE_CAPABILITY,
    );
    expect(authorized.value.decision.outcome).toBe("charge-credits");
    expect(authorized.value.decision.credits).toBe(CREDIT_PRICE);
  });

  it("sends the money currency to checkout, reading no ledger", () => {
    const authorized = authorizeFixtureListingPurchase({
      principal: principal(),
      admin,
      listingId: ENABLED_LISTING_ID,
      payWith: "money",
      now: NOW,
    });
    expect(authorized.ok).toBe(true);
    if (!authorized.ok) return;
    expect(authorized.value.decision.outcome).toBe("allow-checkout");
  });

  it("requires an account", () => {
    const refused = authorizeFixtureListingPurchase({
      principal: undefined,
      admin,
      listingId: ENABLED_LISTING_ID,
      payWith: "credits",
      buyerState: funded(CREDIT_PRICE),
      now: NOW,
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.reason).toBe(BILLING_REFUSE_REASONS.accountRequired);
  });

  it("refuses an insufficient balance before any ledger is appended to", async () => {
    const buyerState = funded(CREDIT_PRICE - 1);
    const refused = await purchaseFixtureListingWithCredits({
      principal: principal(),
      admin,
      listingId: ENABLED_LISTING_ID,
      buyerState,
      creatorState: createLedgerState(account(SELLER_USER_ID)),
      now: NOW,
      saleId: "sale_short",
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.reason).toBe(BILLING_REFUSE_REASONS.balanceInsufficient);
    expect(buyerState.entries.length).toBe(1);
    expect(buyerState.balance).toBe(CREDIT_PRICE - 1);
  });

  it("denies the Kids surface", async () => {
    const refused = await purchaseFixtureListingWithCredits({
      principal: principal({ surface: "kids" }),
      admin,
      listingId: ENABLED_LISTING_ID,
      buyerState: funded(100),
      creatorState: createLedgerState(account(SELLER_USER_ID)),
      now: NOW,
      saleId: "sale_kids",
      surface: "kids",
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.reason).toBe(BILLING_REFUSE_REASONS.kidsCommerceDenied);
  });

  it("refuses an expired session rather than transacting", async () => {
    const expired = principal();
    const refused = await purchaseFixtureListingWithCredits({
      principal: expired,
      admin,
      listingId: ENABLED_LISTING_ID,
      buyerState: funded(100),
      creatorState: createLedgerState(account(SELLER_USER_ID)),
      now: Date.parse("2026-07-27T10:00:00Z"),
      saleId: "sale_expired",
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.reason).toBe(AUTH_REFUSE_REASONS.sessionExpired);
  });
});

describe("the credits purchase pays the creator exactly half", () => {
  it("debits 75 and grants 37, platform keeping 38", async () => {
    const sale = await purchaseFixtureListingWithCredits({
      principal: principal(),
      admin,
      listingId: ENABLED_LISTING_ID,
      buyerState: funded(100),
      creatorState: createLedgerState(account(SELLER_USER_ID)),
      now: NOW,
      saleId: "sale_fixture_credits",
      surface: "web-shell",
    });
    expect(sale.ok).toBe(true);
    if (!sale.ok) return;
    expect(sale.value.charged).toBe(true);
    expect(sale.value.buyer.entry?.delta).toBe(-CREDIT_PRICE);
    expect(sale.value.buyer.state.balance).toBe(100 - CREDIT_PRICE);
    expect(sale.value.creator?.entry?.delta).toBe(37);
    expect(sale.value.creator?.state.balance).toBe(37);

    const share = sale.value.share;
    expect(share).toBeDefined();
    if (share === undefined) return;
    expect(share.grossCredits).toBe(CREDIT_PRICE);
    expect(share.creatorCredits).toBe(37);
    expect(share.platformCredits).toBe(38);
    expect(share.creatorCredits + share.platformCredits).toBe(CREDIT_PRICE);
    expect(share.basisPoints).toBe(CREATOR_SHARE_BASIS_POINTS);
    expect(share.creatorUserId).toBe(SELLER_USER_ID);
  });

  it("answers a retry from the debit it already made", async () => {
    const first = await purchaseFixtureListingWithCredits({
      principal: principal(),
      admin,
      listingId: ENABLED_LISTING_ID,
      buyerState: funded(100),
      creatorState: createLedgerState(account(SELLER_USER_ID)),
      now: NOW,
      saleId: "sale_retry",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.replayed).toBe(false);

    // The retrying caller holds the post-debit ledger: 25 credits left, against
    // a 75-credit price. The balance question was already answered by the debit
    // in that ledger, so it is not asked a second time out of its own proceeds.
    const retry = await purchaseFixtureListingWithCredits({
      principal: principal(),
      admin,
      listingId: ENABLED_LISTING_ID,
      buyerState: first.value.buyer.state,
      creatorState: first.value.creator?.state ?? createLedgerState(account(SELLER_USER_ID)),
      now: NOW + 5_000,
      saleId: "sale_retry",
    });
    expect(retry.ok).toBe(true);
    if (!retry.ok) return;
    expect(retry.value.replayed).toBe(true);
    expect(retry.value.buyer.state.balance).toBe(100 - CREDIT_PRICE);
    expect(retry.value.buyer.state.entries.length).toBe(
      first.value.buyer.state.entries.length,
    );
    expect(retry.value.creator?.state.balance).toBe(37);

    // A *different* sale out of the same depleted balance is still refused, so
    // the retry allowance did not become a general exemption.
    const second = await purchaseFixtureListingWithCredits({
      principal: principal(),
      admin,
      listingId: ENABLED_LISTING_ID,
      buyerState: first.value.buyer.state,
      creatorState: first.value.creator?.state ?? createLedgerState(account(SELLER_USER_ID)),
      now: NOW + 5_000,
      saleId: "sale_retry_other",
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.reason).toBe(BILLING_REFUSE_REASONS.balanceInsufficient);
  });

  it("pays nobody when an admin's unlimited allowance charged nothing", async () => {
    const sale = await purchaseFixtureListingWithCredits({
      principal: principal({ userId: "usr_captain", role: "admin" }),
      admin,
      listingId: ENABLED_LISTING_ID,
      buyerState: funded(100, "usr_captain"),
      creatorState: createLedgerState(account(SELLER_USER_ID)),
      now: NOW,
      saleId: "sale_admin",
    });
    expect(sale.ok).toBe(true);
    if (!sale.ok) return;
    expect(sale.value.charged).toBe(false);
    expect(sale.value.share).toBeUndefined();
    expect(sale.value.creator).toBeUndefined();
    expect(sale.value.buyer.entry).toBeUndefined();
  });

  it("refuses the seller buying their own listing", async () => {
    const refused = await purchaseFixtureListingWithCredits({
      principal: principal({ userId: SELLER_USER_ID }),
      admin,
      listingId: ENABLED_LISTING_ID,
      buyerState: funded(100, SELLER_USER_ID),
      creatorState: createLedgerState(account(SELLER_USER_ID)),
      now: NOW,
      saleId: "sale_self",
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.reason).toBe(
      BILLING_REFUSE_REASONS.listingSelfPurchaseDenied,
    );
  });
});

describe("the money purchase settles into bookkeeping only", () => {
  it("creates a test-mode intent at the seller's listed price", () => {
    const intent = moneyIntent();
    expect(intent.mode).toBe(FIXTURE_COMMERCE_MODE);
    expect(intent.purpose).toBe(FIXTURE_COMMERCE_CHECKOUT_PURPOSE);
    expect(intent.itemId).toBe(ENABLED_LISTING_ID);
    expect(intent.unitAmount).toBe(MONEY_MINOR);
    expect(intent.stripePriceId).toBe("price_test_market_stall_kit");
    // A listing sale grants no credits, so the intent nominates none.
    expect(intent).not.toHaveProperty("credits");
    expect(validateCheckoutSessionIntent(intent).ok).toBe(true);
  });

  it("splits 2500 minor units 1250/1250 with no payout field", () => {
    const intent = moneyIntent();
    const settled = settleFixtureListingMoneySale({
      completion: settleIntent(intent),
      intent,
      now: NOW,
    });
    expect(settled.ok).toBe(true);
    if (!settled.ok) return;
    expect(settled.value.grossMinor).toBe(MONEY_MINOR);
    expect(settled.value.creatorMinor).toBe(1250);
    expect(settled.value.platformMinor).toBe(1250);
    expect(settled.value.creatorMinor + settled.value.platformMinor).toBe(
      MONEY_MINOR,
    );
    expect(settled.value.currency).toBe("usd");
    expect(settled.value.mode).toBe("test");
    expect(settled.value.saleId).toBe("sale_fixture_money");
    expect(settled.value.creatorUserId).toBe(SELLER_USER_ID);
    expect(settled.value.buyerUserId).toBe("usr_buyer");
    for (const forbidden of [
      "payout",
      "transfer",
      "destination",
      "connectAccountId",
    ]) {
      expect(settled.value).not.toHaveProperty(forbidden);
    }
    expect(validateMoneySplitRecord(settled.value).ok).toBe(true);
  });

  it("grants no credits for the same completion", () => {
    const intent = moneyIntent();
    const granted = applyCheckoutCompletedGrant({
      state: createLedgerState(account("usr_buyer")),
      completion: settleIntent(intent),
      now: NOW,
    });
    expect(granted.ok).toBe(false);
    if (granted.ok) return;
    expect(granted.reason).toBe(
      BILLING_REFUSE_REASONS.webhookEventTypeUnsupported,
    );
  });

  it("refuses a credit-pack completion", () => {
    const catalog = loadCreditPackCatalog();
    expect(catalog.ok).toBe(true);
    if (!catalog.ok) return;
    const packIntent = createCheckoutSessionIntent({
      principal: principal(),
      admin,
      catalog: catalog.value,
      packId: "starter",
      successUrl: "https://sceneaxi.example/checkout/success",
      cancelUrl: "https://sceneaxi.example/checkout/cancel",
      idempotencyKey: "sale:sale_wrong_purpose",
      now: NOW,
    });
    expect(packIntent.ok).toBe(true);
    if (!packIntent.ok) return;

    const refused = settleFixtureListingMoneySale({
      completion: settleIntent(packIntent.value),
      intent: packIntent.value,
      now: NOW,
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.reason).toBe(
      BILLING_REFUSE_REASONS.webhookEventTypeUnsupported,
    );
  });

  it("refuses an intent that does not describe the completion", () => {
    const intent = moneyIntent();
    const refused = settleFixtureListingMoneySale({
      completion: settleIntent(intent),
      intent: { ...intent, unitAmount: MONEY_MINOR + 1 },
      now: NOW,
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.reason).toBe(
      BILLING_REFUSE_REASONS.checkoutIntentInvalid,
    );
  });

  it("refuses an intent keyed outside the listing-sale namespace", () => {
    const intent = moneyIntent();
    const renamed = { ...intent, idempotencyKey: "checkout:usr_buyer:kit" };
    const refused = settleFixtureListingMoneySale({
      completion: settleIntent(renamed),
      intent: renamed,
      now: NOW,
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.reason).toBe(BILLING_REFUSE_REASONS.checkoutIntentInvalid);
  });

  it("refuses an in-namespace key renamed onto someone else's settlement", () => {
    // The sale id is read out of the intent's key, and the completion pins
    // every other field — so a key kept inside the "sale:" namespace is the
    // only way bookkeeping could be re-attached to a sale nobody settled.
    const intent = moneyIntent();
    const completion = settleIntent(intent);
    const renamed = {
      ...intent,
      idempotencyKey: `${LISTING_SALE_IDEMPOTENCY_PREFIX}sale_someone_elses`,
    };
    const refused = settleFixtureListingMoneySale({
      completion,
      intent: renamed,
      now: NOW,
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.reason).toBe(BILLING_REFUSE_REASONS.checkoutIntentInvalid);

    // The genuine intent still settles, under its own sale id.
    const settled = settleFixtureListingMoneySale({
      completion,
      intent,
      now: NOW,
    });
    expect(settled.ok).toBe(true);
    if (!settled.ok) return;
    expect(settled.value.saleId).toBe("sale_fixture_money");
  });

  it("refuses a live settlement, having no way to authorize one", () => {
    // This path cannot produce a live intent at all — it forwards no
    // `liveModeAuthorized` — so the live one is forged here to prove the second
    // half of the gate: even handed a live settlement, nothing is recorded.
    const liveIntent = { ...moneyIntent(), mode: "live" as const };
    const refused = settleFixtureListingMoneySale({
      completion: settleIntent(liveIntent),
      intent: liveIntent,
      now: NOW,
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.reason).toBe(BILLING_REFUSE_REASONS.liveModeNotAuthorized);
  });
});
