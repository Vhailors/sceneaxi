import { describe, expect, it } from "vitest";
import {
  ADMIN_EMAIL_ENV_VAR,
  AUTH_REFUSE_REASONS,
  createBetterAuthIdentityAdapter,
  createIdentityPort,
  createInMemoryIdentityStore,
  resolveAdminIdentity,
  type IdentityPort,
} from "@sceneaxi/auth";
import {
  BILLING_REFUSE_REASONS,
  CHECKOUT_METADATA_KEYS,
  FIXTURE_COMMERCE_CAPABILITY,
  FIXTURE_COMMERCE_CHECKOUT_PURPOSE,
  FIXTURE_COMMERCE_LISTING_IDS,
  FIXTURE_COMMERCE_MODE,
  applyCheckoutCompletedGrant,
  authorizeFixtureListingPurchase,
  createFixtureListingCheckoutIntent,
  createInMemoryCreditStore,
  createLedgerState,
  deriveBalance,
  grantStarterCredits,
  loadCatalogListings,
  parseCheckoutCompletedEvent,
  purchaseFixtureListingWithCredits,
  resolveFixtureCommerceListing,
  settleFixtureListingMoneySale,
  signStripeWebhookPayload,
  verifyStripeWebhookSignature,
  type LedgerState,
} from "@sceneaxi/billing";
import {
  CREATOR_SHARE_BASIS_POINTS,
  STARTER_CREDIT_GRANT,
  validateCatalogListing,
  validateCheckoutCompletedEvent,
  validateCheckoutSessionIntent,
  validateCreatorShareRecord,
  validateCreditLedgerEntry,
  validateEntitlementDecision,
  validateMoneySplitRecord,
  type CreditAccount,
} from "@sceneaxi/schemas";

/**
 * Ladder Step 10 (sceneaxi#138) — the fixture-SKU commerce path, end to end.
 *
 * One dual-priced fixture SKU is bought twice: once with credits, which moves
 * the append-only ledger and pays the creator their 50%, and once with money,
 * which moves no ledger at all and produces bookkeeping bound to a
 * signature-verified Stripe **test** settlement. The exact figures are asserted,
 * not merely their invariants, so a change to the split arithmetic or the
 * committed price cannot pass by staying internally consistent.
 *
 * The other half of the proof is what stays inert: every other listing in the
 * committed set, every unknown id, a fabricated listing, and any live-mode
 * settlement all refuse by name. Nothing here needs a Stripe key, a database, or
 * a network — asserted at the end.
 */

const NOW = Date.parse("2026-07-25T10:00:00Z");
const NOW_SECONDS = Math.floor(NOW / 1000);
const clock = () => NOW;

const CAPTAIN_EMAIL = "captain@example.com";
const ENV = Object.freeze({ [ADMIN_EMAIL_ENV_VAR]: CAPTAIN_EMAIL });
const WEBHOOK_SECRET = "whsec_fixture_commerce_golden";

/** The Checkout Sessions the two settlements below are bound to. */
const MONEY_SESSION_ID = "cs_step10_money_01";
const LIVE_SESSION_ID = "cs_step10_live";

/** The single enabled SKU and its committed prices. */
const LISTING_ID = "market-stall-kit";
const SELLER_USER_ID = "usr_creator_ada";
const CREDIT_PRICE = 75;
const CREDIT_TO_CREATOR = 37;
const CREDIT_TO_PLATFORM = 38;
const MONEY_MINOR = 2500;
const MONEY_TO_CREATOR = 1250;
const MONEY_TO_PLATFORM = 1250;
const STRIPE_TEST_PRICE_ID = "price_test_market_stall_kit";

const user = (userId: string, email: string) =>
  ({
    schemaVersion: 1,
    kind: "sceneaxi.user",
    userId,
    email,
    emailVerified: true,
    disabled: false,
    createdAt: "2026-07-25T09:00:00Z",
  }) as never;

const CAPTAIN = user("usr_captain", CAPTAIN_EMAIL);
const CREW = user("usr_crew", "crew@example.com");
const ADA = user(SELLER_USER_ID, "ada@example.com");

const account = (userId: string): CreditAccount =>
  Object.freeze({
    schemaVersion: 1,
    kind: "sceneaxi.credit-account",
    accountId: `acc_${userId}`,
    userId,
    createdAt: "2026-07-25T09:00:00Z",
  }) as CreditAccount;

/** A Better-Auth-shaped instance over a fixture credential table. */
const betterAuthLike = {
  api: {
    signInEmail({ body }: { body: { email: string; password: string } }) {
      if (body.password !== "pw") return null;
      const userId =
        body.email === CAPTAIN_EMAIL
          ? "usr_captain"
          : body.email === "ada@example.com"
            ? SELLER_USER_ID
            : "usr_crew";
      return {
        user: { id: userId, email: body.email, emailVerified: true },
        session: {
          id: `ses_${userId}`,
          token: `tok_${userId}`,
          userId,
          expiresAt: "2026-07-26T10:00:00Z",
        },
      };
    },
  },
};

const makePort = (): IdentityPort => {
  const admin = resolveAdminIdentity(ENV);
  if (!admin.ok) throw new Error(`fixture admin unresolved: ${admin.reason}`);
  return createIdentityPort({
    adapter: createBetterAuthIdentityAdapter(betterAuthLike),
    store: createInMemoryIdentityStore({ users: [CAPTAIN, CREW, ADA] }),
    admin: admin.value,
    clock,
  });
};

const signIn = async (email: string) => {
  const result = await makePort().signIn({
    surface: "web-shell",
    email,
    password: "pw",
  });
  if (!result.ok) throw new Error(`fixture sign-in failed: ${result.reason}`);
  return result.value.principal;
};

const adminIdentity = () => {
  const admin = resolveAdminIdentity(ENV);
  if (!admin.ok) throw new Error("fixture admin unresolved");
  return admin.value;
};

describe("catalog fixture commerce golden path", () => {
  it("buys the one enabled dual-priced SKU in both currencies", async () => {
    const admin = adminIdentity();
    const crew = await signIn("crew@example.com");

    // ---- 1. exactly one SKU is for sale, and it is dual-priced -------------
    expect(FIXTURE_COMMERCE_LISTING_IDS).toEqual([LISTING_ID]);
    expect(FIXTURE_COMMERCE_MODE).toBe("test");

    const listing = resolveFixtureCommerceListing(LISTING_ID);
    expect(listing.ok).toBe(true);
    if (!listing.ok) return;
    expect(validateCatalogListing(listing.value).ok).toBe(true);
    expect(listing.value.priceMode).toBe("credits-and-money");
    expect(listing.value.creditPrice).toBe(CREDIT_PRICE);
    expect(listing.value.moneyPrice).toEqual({
      unitAmount: MONEY_MINOR,
      currency: "usd",
      stripePriceId: STRIPE_TEST_PRICE_ID,
    });
    expect(listing.value.sellerUserId).toBe(SELLER_USER_ID);

    // ---- 2. a funded buyer, and the documented entitlement ------------------
    const starter = grantStarterCredits({
      state: createLedgerState(account("usr_crew")),
      userId: "usr_crew",
      now: NOW,
    });
    expect(starter.ok).toBe(true);
    if (!starter.ok) return;
    let buyerLedger: LedgerState = starter.value.state;
    expect(buyerLedger.balance).toBe(STARTER_CREDIT_GRANT);

    const authorized = authorizeFixtureListingPurchase({
      principal: crew,
      admin,
      listingId: LISTING_ID,
      payWith: "credits",
      buyerState: buyerLedger,
      now: NOW,
      surface: "web-shell",
    });
    expect(authorized.ok).toBe(true);
    if (!authorized.ok) return;
    expect(authorized.value.decision.capability).toBe(
      FIXTURE_COMMERCE_CAPABILITY,
    );
    expect(authorized.value.decision.outcome).toBe("charge-credits");
    expect(authorized.value.decision.credits).toBe(CREDIT_PRICE);
    expect(validateEntitlementDecision(authorized.value.decision).ok).toBe(true);

    // ---- 3. the credits purchase, settled atomically through a store -------
    let creatorLedger: LedgerState = createLedgerState(account(SELLER_USER_ID));
    const store = createInMemoryCreditStore({
      accounts: [buyerLedger.account, creatorLedger.account],
      entries: buyerLedger.entries,
    });

    const sale = await purchaseFixtureListingWithCredits({
      principal: crew,
      admin,
      listingId: LISTING_ID,
      buyerState: buyerLedger,
      creatorState: creatorLedger,
      now: NOW,
      saleId: "sale_step10_credits",
      surface: "web-shell",
      store,
    });
    expect(sale.ok).toBe(true);
    if (!sale.ok) return;
    expect(sale.value.charged).toBe(true);
    expect(sale.value.replayed).toBe(false);

    // The buyer paid exactly the listed credit price, and nothing else moved.
    expect(sale.value.buyer.entry?.movement).toBe("debit");
    expect(sale.value.buyer.entry?.delta).toBe(-CREDIT_PRICE);
    expect(sale.value.buyer.entry?.idempotencyKey).toBe(
      "sale:sale_step10_credits:buyer",
    );
    buyerLedger = sale.value.buyer.state;
    expect(buyerLedger.balance).toBe(STARTER_CREDIT_GRANT - CREDIT_PRICE);

    // The creator was granted exactly half, floored; the platform keeps the rest.
    expect(sale.value.creator?.entry?.movement).toBe("grant");
    expect(sale.value.creator?.entry?.delta).toBe(CREDIT_TO_CREATOR);
    expect(sale.value.creator?.entry?.idempotencyKey).toBe(
      "sale:sale_step10_credits:creator",
    );
    creatorLedger = sale.value.creator?.state ?? creatorLedger;
    expect(creatorLedger.balance).toBe(CREDIT_TO_CREATOR);

    const share = sale.value.share;
    expect(share).toBeDefined();
    if (share === undefined) return;
    expect(share.grossCredits).toBe(CREDIT_PRICE);
    expect(share.creatorCredits).toBe(CREDIT_TO_CREATOR);
    expect(share.platformCredits).toBe(CREDIT_TO_PLATFORM);
    expect(share.creatorCredits + share.platformCredits).toBe(CREDIT_PRICE);
    expect(share.basisPoints).toBe(CREATOR_SHARE_BASIS_POINTS);
    expect(share.buyerUserId).toBe("usr_crew");
    expect(share.creatorUserId).toBe(SELLER_USER_ID);
    expect(validateCreatorShareRecord(share).ok).toBe(true);
    expect(store.shareRecordCount()).toBe(1);

    // ---- 4. re-sending the same sale moves nothing ------------------------
    const replay = await purchaseFixtureListingWithCredits({
      principal: crew,
      admin,
      listingId: LISTING_ID,
      buyerState: buyerLedger,
      creatorState: creatorLedger,
      now: NOW + 5_000,
      saleId: "sale_step10_credits",
      surface: "web-shell",
      store,
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.value.replayed).toBe(true);
    expect(replay.value.buyer.state.balance).toBe(buyerLedger.balance);
    expect(replay.value.buyer.state.entries.length).toBe(
      buyerLedger.entries.length,
    );
    expect(replay.value.creator?.state.balance).toBe(CREDIT_TO_CREATOR);
    expect(store.shareRecordCount()).toBe(1);

    // ---- 5. the money purchase: a test-mode intent -------------------------
    const intent = createFixtureListingCheckoutIntent({
      principal: crew,
      admin,
      listingId: LISTING_ID,
      successUrl: "https://sceneaxi.example/checkout/success",
      cancelUrl: "https://sceneaxi.example/checkout/cancel",
      now: NOW,
      saleId: "sale_step10_money",
      surface: "web-shell",
    });
    expect(intent.ok).toBe(true);
    if (!intent.ok) return;
    expect(intent.value.mode).toBe("test");
    expect(intent.value.purpose).toBe(FIXTURE_COMMERCE_CHECKOUT_PURPOSE);
    expect(intent.value.itemId).toBe(LISTING_ID);
    expect(intent.value.unitAmount).toBe(MONEY_MINOR);
    expect(intent.value.stripePriceId).toBe(STRIPE_TEST_PRICE_ID);
    expect(intent.value.idempotencyKey).toBe("sale:sale_step10_money");
    // A listing sale grants no credits, so no amount is nominated.
    expect(intent.value).not.toHaveProperty("credits");
    expect(validateCheckoutSessionIntent(intent.value).ok).toBe(true);

    // ---- 6. a locally signed webhook, verified over the raw bytes ----------
    const body = JSON.stringify({
      id: "evt_step10_money_01",
      type: "checkout.session.completed",
      created: NOW_SECONDS,
      livemode: false,
      data: {
        object: {
          id: MONEY_SESSION_ID,
          metadata: {
            [CHECKOUT_METADATA_KEYS.userId]: "usr_crew",
            [CHECKOUT_METADATA_KEYS.purpose]: FIXTURE_COMMERCE_CHECKOUT_PURPOSE,
            [CHECKOUT_METADATA_KEYS.itemId]: LISTING_ID,
            [CHECKOUT_METADATA_KEYS.intentId]: intent.value.intentId,
          },
        },
      },
    });
    const verified = verifyStripeWebhookSignature({
      payload: body,
      header: signStripeWebhookPayload({
        payload: body,
        secret: WEBHOOK_SECRET,
        timestamp: NOW_SECONDS,
      }),
      secret: WEBHOOK_SECRET,
      now: NOW,
    });
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;

    const completion = parseCheckoutCompletedEvent({
      verified: verified.value,
      intent: intent.value,
      settlement: {
        sessionId: MONEY_SESSION_ID,
        paymentStatus: "paid",
        amountTotal: MONEY_MINOR,
        currency: "usd",
        quantity: 1,
        stripePriceId: STRIPE_TEST_PRICE_ID,
      },
    });
    expect(completion.ok).toBe(true);
    if (!completion.ok) return;
    expect(completion.value.mode).toBe("test");
    expect(completion.value.purpose).toBe(FIXTURE_COMMERCE_CHECKOUT_PURPOSE);
    expect(completion.value).not.toHaveProperty("credits");
    expect(validateCheckoutCompletedEvent(completion.value).ok).toBe(true);

    // ---- 7. the money split, bound to that settlement ----------------------
    const settled = settleFixtureListingMoneySale({
      completion: completion.value,
      intent: intent.value,
    });
    expect(settled.ok).toBe(true);
    if (!settled.ok) return;
    expect(settled.value.saleId).toBe("sale_step10_money");
    expect(settled.value.listingId).toBe(LISTING_ID);
    expect(settled.value.grossMinor).toBe(MONEY_MINOR);
    expect(settled.value.creatorMinor).toBe(MONEY_TO_CREATOR);
    expect(settled.value.platformMinor).toBe(MONEY_TO_PLATFORM);
    expect(settled.value.creatorMinor + settled.value.platformMinor).toBe(
      MONEY_MINOR,
    );
    expect(settled.value.currency).toBe("usd");
    expect(settled.value.mode).toBe("test");
    expect(settled.value.basisPoints).toBe(CREATOR_SHARE_BASIS_POINTS);
    expect(settled.value.buyerUserId).toBe("usr_crew");
    expect(settled.value.creatorUserId).toBe(SELLER_USER_ID);
    expect(validateMoneySplitRecord(settled.value).ok).toBe(true);

    // Bookkeeping only: no payout instruction, and no Stripe Connect.
    for (const forbidden of [
      "payout",
      "transfer",
      "destination",
      "connectAccountId",
    ]) {
      expect(settled.value).not.toHaveProperty(forbidden);
    }

    // ---- 8. the money purchase moved no credit ledger ----------------------
    const wouldGrant = applyCheckoutCompletedGrant({
      state: buyerLedger,
      completion: completion.value,
      now: NOW,
    });
    expect(wouldGrant.ok).toBe(false);
    if (wouldGrant.ok) return;
    expect(wouldGrant.reason).toBe(
      BILLING_REFUSE_REASONS.webhookEventTypeUnsupported,
    );
    expect(buyerLedger.balance).toBe(STARTER_CREDIT_GRANT - CREDIT_PRICE);
    expect(creatorLedger.balance).toBe(CREDIT_TO_CREATOR);
    expect(store.entryCount(buyerLedger.account.accountId)).toBe(2);
    expect(store.entryCount(creatorLedger.account.accountId)).toBe(1);

    // ---- 9. every entry still satisfies its published contract -------------
    for (const state of [buyerLedger, creatorLedger]) {
      for (const entry of state.entries) {
        expect(validateCreditLedgerEntry(entry).ok).toBe(true);
      }
      const derived = deriveBalance(state.entries);
      expect(derived.ok).toBe(true);
      if (!derived.ok) return;
      expect(derived.value).toBe(state.balance);
    }
  });

  it("keeps the rest of the marketplace inert", async () => {
    const admin = adminIdentity();
    const crew = await signIn("crew@example.com");

    // Every other committed listing refuses, by a reason that says why: it
    // exists in the catalog and is simply not for sale.
    const loaded = loadCatalogListings();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const others = loaded.value.listings
      .map((held) => held.listingId)
      .filter((id) => id !== LISTING_ID);
    expect(others).toEqual([
      "lantern-prop",
      "harbour-diorama",
      "odd-price-charm",
    ]);

    for (const listingId of [...others, "not-a-listing"]) {
      const purchase = await purchaseFixtureListingWithCredits({
        principal: crew,
        admin,
        listingId,
        buyerState: createLedgerState(account("usr_crew")),
        creatorState: createLedgerState(account(SELLER_USER_ID)),
        now: NOW,
        saleId: `sale_inert_${listingId}`,
      });
      expect(purchase.ok).toBe(false);
      if (purchase.ok) return;
      expect(purchase.reason).toBe(
        BILLING_REFUSE_REASONS.listingFixtureCommerceNotEnabled,
      );

      const checkout = createFixtureListingCheckoutIntent({
        principal: crew,
        admin,
        listingId,
        successUrl: "https://sceneaxi.example/checkout/success",
        cancelUrl: "https://sceneaxi.example/checkout/cancel",
        now: NOW,
        saleId: `sale_inert_${listingId}`,
      });
      expect(checkout.ok).toBe(false);
      if (checkout.ok) return;
      expect(checkout.reason).toBe(
        BILLING_REFUSE_REASONS.listingFixtureCommerceNotEnabled,
      );
    }
  });

  it("offers Kids nothing, and live mode nothing", async () => {
    const admin = adminIdentity();
    const crew = await signIn("crew@example.com");

    const kidsCredits = await purchaseFixtureListingWithCredits({
      principal: crew,
      admin,
      listingId: LISTING_ID,
      buyerState: createLedgerState(account("usr_crew")),
      creatorState: createLedgerState(account(SELLER_USER_ID)),
      now: NOW,
      saleId: "sale_kids",
      surface: "kids",
    });
    expect(kidsCredits.ok).toBe(false);
    if (kidsCredits.ok) return;
    expect(kidsCredits.reason).toBe(BILLING_REFUSE_REASONS.kidsCommerceDenied);

    const kidsMoney = createFixtureListingCheckoutIntent({
      principal: crew,
      admin,
      listingId: LISTING_ID,
      successUrl: "https://sceneaxi.example/checkout/success",
      cancelUrl: "https://sceneaxi.example/checkout/cancel",
      now: NOW,
      saleId: "sale_kids_money",
      surface: "kids",
    });
    expect(kidsMoney.ok).toBe(false);
    if (kidsMoney.ok) return;
    expect(kidsMoney.reason).toBe(BILLING_REFUSE_REASONS.kidsCommerceDenied);

    const kidsSignIn = await makePort().signIn({
      surface: "kids",
      email: "crew@example.com",
      password: "pw",
    });
    expect(kidsSignIn.ok).toBe(false);
    if (kidsSignIn.ok) return;
    expect(kidsSignIn.reason).toBe(AUTH_REFUSE_REASONS.kidsSurfaceDenied);

    // The checkout path cannot produce a live intent, so a live settlement is
    // forged here — and still books nothing, because no live authorization is
    // accepted anywhere on this path.
    const intent = createFixtureListingCheckoutIntent({
      principal: crew,
      admin,
      listingId: LISTING_ID,
      successUrl: "https://sceneaxi.example/checkout/success",
      cancelUrl: "https://sceneaxi.example/checkout/cancel",
      now: NOW,
      saleId: "sale_live_attempt",
    });
    expect(intent.ok).toBe(true);
    if (!intent.ok) return;
    const liveIntent = { ...intent.value, mode: "live" as const };

    const liveBody = JSON.stringify({
      id: "evt_step10_live",
      type: "checkout.session.completed",
      created: NOW_SECONDS,
      livemode: true,
      data: {
        object: {
          id: LIVE_SESSION_ID,
          metadata: {
            [CHECKOUT_METADATA_KEYS.userId]: "usr_crew",
            [CHECKOUT_METADATA_KEYS.purpose]: FIXTURE_COMMERCE_CHECKOUT_PURPOSE,
            [CHECKOUT_METADATA_KEYS.itemId]: LISTING_ID,
            [CHECKOUT_METADATA_KEYS.intentId]: liveIntent.intentId,
          },
        },
      },
    });
    const liveVerified = verifyStripeWebhookSignature({
      payload: liveBody,
      header: signStripeWebhookPayload({
        payload: liveBody,
        secret: WEBHOOK_SECRET,
        timestamp: NOW_SECONDS,
      }),
      secret: WEBHOOK_SECRET,
      now: NOW,
    });
    expect(liveVerified.ok).toBe(true);
    if (!liveVerified.ok) return;
    const liveCompletion = parseCheckoutCompletedEvent({
      verified: liveVerified.value,
      intent: liveIntent,
      settlement: {
        sessionId: LIVE_SESSION_ID,
        paymentStatus: "paid",
        amountTotal: MONEY_MINOR,
        currency: "usd",
        quantity: 1,
        stripePriceId: STRIPE_TEST_PRICE_ID,
      },
    });
    expect(liveCompletion.ok).toBe(true);
    if (!liveCompletion.ok) return;
    expect(liveCompletion.value.mode).toBe("live");

    const liveSettled = settleFixtureListingMoneySale({
      completion: liveCompletion.value,
      intent: liveIntent,
    });
    expect(liveSettled.ok).toBe(false);
    if (liveSettled.ok) return;
    expect(liveSettled.reason).toBe(
      BILLING_REFUSE_REASONS.liveModeNotAuthorized,
    );
  });

  it("is deterministic: two runs produce identical records", async () => {
    const admin = adminIdentity();
    const crew = await signIn("crew@example.com");
    const run = async () => {
      const funded = grantStarterCredits({
        state: createLedgerState(account("usr_crew")),
        userId: "usr_crew",
        now: NOW,
      });
      if (!funded.ok) throw new Error("run failed");
      const sale = await purchaseFixtureListingWithCredits({
        principal: crew,
        admin,
        listingId: LISTING_ID,
        buyerState: funded.value.state,
        creatorState: createLedgerState(account(SELLER_USER_ID)),
        now: NOW,
        saleId: "sale_deterministic",
      });
      if (!sale.ok) throw new Error("run failed");
      return {
        buyer: sale.value.buyer.state.entries,
        creator: sale.value.creator?.state.entries ?? [],
        share: sale.value.share,
      };
    };
    expect(JSON.stringify(await run())).toBe(JSON.stringify(await run()));
  });

  it("needs no ambient credential, and would notice if it did", () => {
    for (const name of [
      "DATABASE_URL",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "SCENEAXI_ADMIN_EMAIL",
    ]) {
      expect(process.env[name]).toBeUndefined();
    }
  });
});
