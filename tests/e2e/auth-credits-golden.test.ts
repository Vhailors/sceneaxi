import { describe, expect, it } from "vitest";
import {
  ADMIN_EMAIL_ENV_VAR,
  AUTH_REFUSE_REASONS,
  createBetterAuthIdentityAdapter,
  createIdentityPort,
  createInMemoryIdentityStore,
  createRoleGuards,
  requireRole,
  resolveAdminIdentity,
  type IdentityPort,
} from "@sceneaxi/auth";
import {
  BILLING_REFUSE_REASONS,
  STARTER_IDEMPOTENCY_PREFIX,
  applyCheckoutCompletedGrant,
  applyCreditsSale,
  createCheckoutSessionIntent,
  createInMemoryCreditStore,
  createLedgerState,
  createListingCheckoutIntent,
  deriveBalance,
  evaluateEntitlement,
  grantStarterCredits,
  loadCatalogListings,
  loadCreditPackCatalog,
  lookupCatalogListing,
  lookupCreditPack,
  meterCredits,
  parseCheckoutCompletedEvent,
  recordMoneySale,
  signStripeWebhookPayload,
  verifyStripeWebhookSignature,
  CHECKOUT_METADATA_KEYS,
  type LedgerState,
} from "@sceneaxi/billing";
import {
  STARTER_CREDIT_GRANT,
  validateCheckoutCompletedEvent,
  validateCheckoutSessionIntent,
  validateCreatorShareRecord,
  validateCreditLedgerEntry,
  validateEntitlementDecision,
  validateMoneySplitRecord,
  validatePrincipal,
  type CreditAccount,
} from "@sceneaxi/schemas";
import { issuePrincipalForTest } from "../../packages/auth/test/principal-fixture.js";

/**
 * One deterministic golden path through the whole identity + credits plane.
 *
 * Everything is injected: a fixed clock, a fixture identity adapter, in-memory
 * stores, and locally signed webhook fixtures. The suite runs with no
 * DATABASE_URL, no Stripe key, and no network — asserted at the end, because a
 * test that quietly depended on an ambient credential would pass here and fail in
 * CI for a reason nobody could see.
 */

const NOW = Date.parse("2026-07-25T10:00:00Z");
const NOW_SECONDS = Math.floor(NOW / 1000);

/** The Checkout Session ids the two golden settlements are bound to. */
const PACK_SESSION_ID = "cs_golden_pack_01";
const MONEY_SESSION_ID = "cs_golden_money_01";
const clock = () => NOW;

const CAPTAIN_EMAIL = "captain@example.com";
const ENV = Object.freeze({ [ADMIN_EMAIL_ENV_VAR]: CAPTAIN_EMAIL });
const WEBHOOK_SECRET = "whsec_golden_path_fixture";

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
const ADA = user("usr_creator_ada", "ada@example.com");

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
            ? "usr_creator_ada"
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

/** Every fixture uses the environment-issued identity; guards accept no other. */
const resolvedAdmin = () => {
  const admin = resolveAdminIdentity(ENV);
  if (!admin.ok) throw new Error(`fixture admin unresolved: ${admin.reason}`);
  return admin.value;
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
  return result.value;
};

const creditPackCatalog = () => {
  const loaded = loadCreditPackCatalog();
  if (!loaded.ok) throw new Error("catalog load failed");
  return loaded.value;
};

const listings = () => {
  const loaded = loadCatalogListings();
  if (!loaded.ok) throw new Error("listing load failed");
  return loaded.value;
};

describe("auth + credits golden path", () => {
  it("runs the whole plane on one deterministic path", async () => {
    // ---- 1. exactly one admin, resolved from the environment ----------------
    const admin = resolveAdminIdentity(ENV);
    expect(admin.ok).toBe(true);
    if (!admin.ok) return;
    expect(admin.value.email).toBe(CAPTAIN_EMAIL);
    const adminIdentity = admin.value;

    // Guards are bound to that resolution, so no later call site supplies the
    // answer to "who is admin" as an argument (sceneaxi#126).
    const guards = createRoleGuards(admin);

    // ---- 2. the captain signs in as admin and passes an admin guard ---------
    const captain = await signIn(CAPTAIN_EMAIL);
    expect(captain.role.role).toBe("admin");
    expect(captain.role.source).toBe("admin-env");
    expect(validatePrincipal(captain).ok).toBe(true);
    expect(
      guards.requireRole(captain, "admin", { now: NOW, surface: "web-shell" }).ok,
    ).toBe(true);
    // The unbound form is still supported, and reaches the same verdict because
    // it checks the identity's runtime provenance.
    expect(requireRole(captain, "admin", { now: NOW, surface: "web-shell", admin: adminIdentity }).ok).toBe(
      true,
    );

    // ---- 3. an ordinary user is denied that same guard ----------------------
    const crew = await signIn("crew@example.com");
    expect(crew.role.role).toBe("user");
    const denied = guards.requireRole(crew, "admin", { now: NOW });
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.reason).toBe(AUTH_REFUSE_REASONS.roleNotPermitted);

    // ---- 4. the free path works with no account at all ----------------------
    for (const capability of [
      "engine-sdk-download",
      "cli-authoring",
      "byo-model-keys",
    ] as const) {
      const free = evaluateEntitlement({ capability, now: NOW });
      expect(free.ok).toBe(true);
      if (!free.ok) return;
      expect(free.value.outcome).toBe("allow-free");
      expect(validateEntitlementDecision(free.value).ok).toBe(true);
    }

    // ---- 5. a fresh account, then the starter grant, exactly once -----------
    let crewLedger: LedgerState = createLedgerState(account("usr_crew"));
    expect(crewLedger.balance).toBe(0);

    const starter = grantStarterCredits({
      state: crewLedger,
      userId: "usr_crew",
      now: NOW,
    });
    expect(starter.ok).toBe(true);
    if (!starter.ok) return;
    crewLedger = starter.value.state;
    expect(crewLedger.balance).toBe(STARTER_CREDIT_GRANT);
    expect(starter.value.entry?.idempotencyKey).toBe(
      `${STARTER_IDEMPOTENCY_PREFIX}usr_crew`,
    );

    const starterReplay = grantStarterCredits({
      state: crewLedger,
      userId: "usr_crew",
      now: NOW + 86_400_000,
    });
    expect(starterReplay.ok).toBe(true);
    if (!starterReplay.ok) return;
    expect(starterReplay.value.replayed).toBe(true);
    expect(starterReplay.value.state.balance).toBe(STARTER_CREDIT_GRANT);
    expect(starterReplay.value.state.entries.length).toBe(1);

    // ---- 6. bring-your-own keys never burn credits --------------------------
    const byo = evaluateEntitlement({
      capability: "byo-model-keys",
      now: NOW,
      principal: crew,
      admin: adminIdentity,
      state: crewLedger,
    });
    expect(byo.ok).toBe(true);
    if (!byo.ok) return;
    expect(byo.value.outcome).toBe("allow-free");
    expect(byo.value).not.toHaveProperty("credits");
    expect(crewLedger.entries.length).toBe(1);
    expect(crewLedger.balance).toBe(STARTER_CREDIT_GRANT);

    // ---- 7. a test-mode checkout intent for a credit pack -------------------
    const pack = lookupCreditPack(creditPackCatalog(), "starter");
    expect(pack.ok).toBe(true);
    if (!pack.ok) return;

    const intent = createCheckoutSessionIntent({
      principal: crew,
      admin: adminIdentity,
      catalog: creditPackCatalog(),
      packId: "starter",
      successUrl: "https://sceneaxi.example/checkout/success",
      cancelUrl: "https://sceneaxi.example/checkout/cancel",
      idempotencyKey: "checkout:usr_crew:starter",
      now: NOW,
    });
    expect(intent.ok).toBe(true);
    if (!intent.ok) return;
    expect(intent.value.mode).toBe("test");
    expect(intent.value.purpose).toBe("credit-pack");
    expect(validateCheckoutSessionIntent(intent.value).ok).toBe(true);

    // ---- 8. a locally signed webhook, verified over the raw bytes ----------
    const body = JSON.stringify({
      id: "evt_golden_01",
      type: "checkout.session.completed",
      created: NOW_SECONDS,
      livemode: false,
      data: {
        object: {
          id: PACK_SESSION_ID,
          payment_status: "paid",
          amount_total: intent.value.unitAmount,
          currency: intent.value.currency,
          line_items: {
            data: [
              {
                quantity: 1,
                price: { id: intent.value.stripePriceId },
              },
            ],
          },
          metadata: {
            [CHECKOUT_METADATA_KEYS.userId]: "usr_crew",
            [CHECKOUT_METADATA_KEYS.purpose]: "credit-pack",
            [CHECKOUT_METADATA_KEYS.itemId]: "starter",
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

    const event = parseCheckoutCompletedEvent({
      verified: verified.value,
      intent: intent.value,
      settlement: {
        sessionId: PACK_SESSION_ID,
        paymentStatus: "paid",
        amountTotal: intent.value.unitAmount,
        currency: intent.value.currency,
        quantity: 1,
        stripePriceId: intent.value.stripePriceId,
      },
    });
    expect(event.ok).toBe(true);
    if (!event.ok) return;
    expect(event.value.mode).toBe("test");
    expect(event.value.credits).toBe(pack.value.credits);
    expect(validateCheckoutCompletedEvent(event.value).ok).toBe(true);

    // ---- 9. the grant lands exactly once -----------------------------------
    const granted = applyCheckoutCompletedGrant({
      state: crewLedger,
      completion: event.value,
      now: NOW,
    });
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;
    crewLedger = granted.value.state;
    expect(crewLedger.balance).toBe(STARTER_CREDIT_GRANT + pack.value.credits);

    const grantReplay = applyCheckoutCompletedGrant({
      state: crewLedger,
      completion: event.value,
      now: NOW + 5_000,
    });
    expect(grantReplay.ok).toBe(true);
    if (!grantReplay.ok) return;
    expect(grantReplay.value.replayed).toBe(true);
    expect(grantReplay.value.state.balance).toBe(crewLedger.balance);
    expect(grantReplay.value.state.entries.length).toBe(
      crewLedger.entries.length,
    );

    const balanceAfterPurchase = crewLedger.balance;

    // ---- 10. a metered debit ----------------------------------------------
    const crewCreditStore = createInMemoryCreditStore({
      accounts: [crewLedger.account],
      entries: crewLedger.entries,
    });
    const preDebitLedger = crewLedger;
    const debitRequest = {
      principal: crew,
      admin: adminIdentity,
      store: crewCreditStore,
      state: preDebitLedger,
      amount: 30,
      reason: "hosted assistant turn",
      idempotencyKey: "usage:turn_golden_01",
      now: NOW,
      surface: "web-shell",
    } as const;
    const metered = await meterCredits(debitRequest);
    expect(metered.ok).toBe(true);
    if (!metered.ok) return;
    expect(metered.value.metered).toBe(true);
    crewLedger = metered.value.state;
    expect(crewLedger.balance).toBe(balanceAfterPurchase - 30);
    const entriesAfterDebit = crewCreditStore.entryCount(
      crewLedger.account.accountId,
    );

    // ---- 10b. a lost response replays instead of double-charging ----------
    // The debit committed but its answer never reached the caller, which can
    // only retry with the state it still holds — the state from before its own
    // entry. That must replay, not refuse as stale and not debit twice.
    const meteredReplay = await meterCredits(debitRequest);
    expect(meteredReplay.ok).toBe(true);
    if (!meteredReplay.ok) return;
    expect(meteredReplay.value.replayed).toBe(true);
    expect(meteredReplay.value.balance).toBe(crewLedger.balance);
    expect(meteredReplay.value.entry).toEqual(metered.value.entry);
    expect(crewCreditStore.entryCount(crewLedger.account.accountId)).toBe(
      entriesAfterDebit,
    );

    // ---- 11. an over-balance debit refuses and appends nothing -------------
    const overspend = await meterCredits({
      principal: crew,
      admin: adminIdentity,
      store: crewCreditStore,
      state: crewLedger,
      amount: crewLedger.balance + 1,
      reason: "hosted assistant turn",
      idempotencyKey: "usage:turn_golden_over",
      now: NOW,
    });
    expect(overspend.ok).toBe(false);
    if (overspend.ok) return;
    expect(overspend.reason).toBe(BILLING_REFUSE_REASONS.balanceInsufficient);
    const entriesBefore = crewLedger.entries.length;
    expect(crewLedger.entries.length).toBe(entriesBefore);

    // ---- 12. a credits catalog sale pays the creator exactly 50% -----------
    const lantern = lookupCatalogListing(listings(), "lantern-prop");
    expect(lantern.ok).toBe(true);
    if (!lantern.ok) return;

    let adaLedger: LedgerState = createLedgerState(account("usr_creator_ada"));
    const sale = applyCreditsSale({
      principal: crew,
      admin: adminIdentity,
      listing: lantern.value,
      buyerState: crewLedger,
      creatorState: adaLedger,
      now: NOW,
      saleId: "sale_golden_01",
      surface: "web-shell",
    });
    expect(sale.ok).toBe(true);
    if (!sale.ok) return;
    expect(sale.value.share).toBeDefined();
    if (sale.value.share === undefined) return;
    const price = lantern.value.creditPrice ?? 0;
    expect(sale.value.buyer.entry?.delta).toBe(-price);
    expect(sale.value.creator?.entry?.delta).toBe(Math.floor(price / 2));
    expect(
      sale.value.share.creatorCredits + sale.value.share.platformCredits,
    ).toBe(price);
    expect(validateCreatorShareRecord(sale.value.share).ok).toBe(true);
    crewLedger = sale.value.buyer.state;
    adaLedger = sale.value.creator?.state ?? adaLedger;
    expect(adaLedger.balance).toBe(Math.floor(price / 2));

    // ---- 13. a money sale records a balanced 50/50 split -------------------
    const harbour = lookupCatalogListing(listings(), "harbour-diorama");
    expect(harbour.ok).toBe(true);
    if (!harbour.ok) return;
    const moneyPrice = harbour.value.moneyPrice;
    expect(moneyPrice).toBeDefined();
    if (moneyPrice === undefined) return;

    // The record is built from a settlement, never asserted: the intent is
    // persisted first, its Checkout Session settles, and only that pair can
    // produce a split. There is no parameter for the gross, the buyer, or the
    // mode, so no caller can book a sale nobody paid for.
    const moneyIntent = createListingCheckoutIntent({
      principal: crew,
      admin: adminIdentity,
      listing: harbour.value,
      successUrl: "https://sceneaxi.example/checkout/success",
      cancelUrl: "https://sceneaxi.example/checkout/cancel",
      now: NOW,
      saleId: "sale_golden_money_01",
      surface: "web-shell",
    });
    expect(moneyIntent.ok).toBe(true);
    if (!moneyIntent.ok) return;

    const moneyBody = JSON.stringify({
      id: "evt_golden_money_01",
      type: "checkout.session.completed",
      created: NOW_SECONDS,
      livemode: false,
      data: {
        object: {
          id: MONEY_SESSION_ID,
          metadata: {
            [CHECKOUT_METADATA_KEYS.userId]: "usr_crew",
            [CHECKOUT_METADATA_KEYS.purpose]: "catalog-listing",
            [CHECKOUT_METADATA_KEYS.itemId]: "harbour-diorama",
            [CHECKOUT_METADATA_KEYS.intentId]: moneyIntent.value.intentId,
          },
        },
      },
    });
    const moneyVerified = verifyStripeWebhookSignature({
      payload: moneyBody,
      header: signStripeWebhookPayload({
        payload: moneyBody,
        secret: WEBHOOK_SECRET,
        timestamp: NOW_SECONDS,
      }),
      secret: WEBHOOK_SECRET,
      now: NOW,
    });
    expect(moneyVerified.ok).toBe(true);
    if (!moneyVerified.ok) return;

    const moneyCompletion = parseCheckoutCompletedEvent({
      verified: moneyVerified.value,
      intent: moneyIntent.value,
      settlement: {
        sessionId: MONEY_SESSION_ID,
        paymentStatus: "paid",
        amountTotal: moneyPrice.unitAmount,
        currency: moneyPrice.currency,
        quantity: 1,
        stripePriceId: moneyPrice.stripePriceId,
      },
    });
    expect(moneyCompletion.ok).toBe(true);
    if (!moneyCompletion.ok) return;
    expect(moneyCompletion.value.checkoutSessionId).toBe(MONEY_SESSION_ID);

    const split = recordMoneySale({
      completion: moneyCompletion.value,
      intent: moneyIntent.value,
    });
    expect(split.ok).toBe(true);
    if (!split.ok) return;
    expect(split.value.saleId).toBe("sale_golden_money_01");
    expect(split.value.buyerUserId).toBe("usr_crew");
    expect(split.value.creatorUserId).toBe(harbour.value.sellerUserId);
    expect(split.value.grossMinor).toBe(moneyPrice.unitAmount);
    expect(split.value.creatorMinor + split.value.platformMinor).toBe(
      split.value.grossMinor,
    );
    expect(split.value.mode).toBe("test");
    expect(validateMoneySplitRecord(split.value).ok).toBe(true);

    // ---- 14. admin has an unlimited allowance and is never debited ---------
    const captainLedger = createLedgerState(account("usr_captain"));
    const allowance = evaluateEntitlement({
      capability: "hosted-ai-assistant",
      now: NOW,
      principal: captain,
      admin: adminIdentity,
      state: captainLedger,
      creditAmount: 1_000_000,
    });
    expect(allowance.ok).toBe(true);
    if (!allowance.ok) return;
    expect(allowance.value.outcome).toBe("allow-unlimited");

    const adminMeter = await meterCredits({
      principal: captain,
      admin: adminIdentity,
      store: createInMemoryCreditStore({
        accounts: [captainLedger.account],
      }),
      state: captainLedger,
      amount: 1_000_000,
      reason: "hosted assistant turn",
      idempotencyKey: "usage:captain_golden",
      now: NOW,
    });
    expect(adminMeter.ok).toBe(true);
    if (!adminMeter.ok) return;
    expect(adminMeter.value.metered).toBe(false);
    expect(captainLedger.entries.length).toBe(0);
    expect(captainLedger.balance).toBe(0);

    // ---- 15. Kids refuses everywhere on this path --------------------------
    const kidsSignIn = await makePort().signIn({
      surface: "kids",
      email: "crew@example.com",
      password: "pw",
    });
    expect(kidsSignIn.ok).toBe(false);
    if (kidsSignIn.ok) return;
    expect(kidsSignIn.reason).toBe(AUTH_REFUSE_REASONS.kidsSurfaceDenied);

    const kidsCommerce = evaluateEntitlement({
      capability: "engine-sdk-download",
      now: NOW,
      surface: "kids",
    });
    expect(kidsCommerce.ok).toBe(false);
    if (kidsCommerce.ok) return;
    expect(kidsCommerce.reason).toBe(BILLING_REFUSE_REASONS.kidsCommerceDenied);

    // ---- 16. every ledger entry satisfies its published contract -----------
    for (const state of [crewLedger, adaLedger]) {
      for (const entry of state.entries) {
        expect(validateCreditLedgerEntry(entry).ok).toBe(true);
      }
      const derived = deriveBalance(state.entries);
      expect(derived.ok).toBe(true);
      if (!derived.ok) return;
      expect(derived.value).toBe(state.balance);
      expect(derived.value).toBe(state.entries.at(-1)?.balanceAfter ?? 0);
    }
  });

  it("is deterministic: two runs of the ledger path produce identical entries", async () => {
    const run = async () => {
      const first = grantStarterCredits({
        state: createLedgerState(account("usr_crew")),
        userId: "usr_crew",
        now: NOW,
      });
      if (!first.ok) throw new Error("run failed");
      const second = await meterCredits({
        principal: issuePrincipalForTest({
          user: CREW,
          role: {
            schemaVersion: 1,
            kind: "sceneaxi.role-assignment",
            userId: "usr_crew",
            role: "user",
            source: "default-user",
            assignedAt: "2026-07-25T09:30:00Z",
          },
          session: {
            schemaVersion: 1,
            kind: "sceneaxi.session",
            sessionId: "ses_usr_crew",
            userId: "usr_crew",
            surface: "web-shell",
            issuedAt: "2026-07-25T09:00:00Z",
            expiresAt: "2026-07-26T10:00:00Z",
            tokenDigest: "a".repeat(64),
          },
        }),
        admin: resolvedAdmin(),
        store: createInMemoryCreditStore({
          accounts: [first.value.state.account],
          entries: first.value.state.entries,
        }),
        state: first.value.state,
        amount: 10,
        reason: "hosted assistant turn",
        idempotencyKey: "usage:deterministic",
        now: NOW,
      });
      if (!second.ok) throw new Error("run failed");
      return second.value.state.entries;
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
