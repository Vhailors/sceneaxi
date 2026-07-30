import { describe, expect, it } from "vitest";
import {
  ADMIN_EMAIL_ENV_VAR,
  digestSessionToken,
  resolveAdminIdentity,
} from "@sceneaxi/auth";
import {
  CREATOR_SHARE_BASIS_POINTS,
  FORBIDDEN_PAYOUT_KEYS,
  REVENUE_SHARE_REFUSE_CODES,
  validateCreatorShareRecord,
  validateMoneySplitRecord,
  type CatalogListing,
  type CheckoutSessionIntent,
  type CreditAccount,
} from "@sceneaxi/schemas";
import {
  BILLING_REFUSE_REASONS,
  CHECKOUT_METADATA_KEYS,
  LISTING_SALE_IDEMPOTENCY_PREFIX,
  applyCreditsSale,
  appendCreditEntry,
  authorizeCreatorPublish,
  bindSettledIntent,
  createInMemoryCreditStore,
  createLedgerState,
  deriveIntentId,
  loadCatalogListings,
  lookupCatalogListing,
  parseCheckoutCompletedEvent,
  persistCreditsSale,
  recordMoneySale,
  signStripeWebhookPayload,
  splitCredits,
  splitMoneyMinorUnits,
  verifyStripeWebhookSignature,
  type LedgerState,
  type CreditStore,
} from "@sceneaxi/billing";
import { issuePrincipalForTest } from "../../auth/test/principal-fixture.js";

const NOW = Date.parse("2026-07-25T10:00:00Z");
const adminResolution = resolveAdminIdentity({
  [ADMIN_EMAIL_ENV_VAR]: "captain@example.com",
});
if (!adminResolution.ok) throw new Error(adminResolution.message);
// Resolved, never hand-built: guards check the identity's runtime provenance,
// so a structurally identical `{ email, source }` literal is refused.
const admin = adminResolution.value;

const account = (userId: string, accountId: string) =>
  Object.freeze({
    schemaVersion: 1,
    kind: "sceneaxi.credit-account",
    accountId,
    userId,
    createdAt: "2026-07-25T09:00:00Z",
  }) as CreditAccount;

const principal = (
  overrides: { userId?: string; role?: "admin" | "user"; surface?: string } = {},
): unknown => {
  const userId = overrides.userId ?? "usr_buyer";
  const role = overrides.role ?? "user";
  return issuePrincipalForTest({
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
  });
};

const funded = (credits: number, forAccount: CreditAccount): LedgerState => {
  if (credits === 0) return createLedgerState(forAccount);
  const appended = appendCreditEntry(createLedgerState(forAccount), {
    entryId: "ent_fund",
    movement: "grant",
    delta: credits,
    reason: "test funding",
    idempotencyKey: "fixture:fund",
    now: NOW,
  });
  if (!appended.ok) throw new Error("fixture funding failed");
  return appended.value.state;
};

const listing = (listingId: string): CatalogListing => {
  const loaded = loadCatalogListings();
  if (!loaded.ok) throw new Error("listing load failed");
  const found = lookupCatalogListing(loaded.value, listingId);
  if (!found.ok) throw new Error(`fixture listing missing: ${listingId}`);
  return found.value;
};

const BUYER = account("usr_buyer", "acc_buyer");

describe("basis-point splits", () => {
  it("give the creator 50% and the platform the remainder", () => {
    const cases: [number, number, number][] = [
      [40, 20, 20],
      [75, 37, 38],
      [7, 3, 4],
      [1, 0, 1],
      [2, 1, 1],
      [333, 166, 167],
      [1200, 600, 600],
      [2500, 1250, 1250],
    ];
    for (const [gross, creator, platform] of cases) {
      const credits = splitCredits(gross);
      expect(credits.ok).toBe(true);
      if (!credits.ok) return;
      expect(credits.value).toEqual({ creator, platform });

      const money = splitMoneyMinorUnits(gross);
      expect(money.ok).toBe(true);
      if (!money.ok) return;
      expect(money.value).toEqual({ creator, platform });
    }
  });

  it("never create or destroy value, and always favour the platform on odd amounts", () => {
    for (let gross = 1; gross <= 500; gross += 1) {
      const split = splitCredits(gross);
      expect(split.ok).toBe(true);
      if (!split.ok) return;
      expect(split.value.creator + split.value.platform).toBe(gross);
      expect(split.value.platform).toBeGreaterThanOrEqual(split.value.creator);
      expect(split.value.platform - split.value.creator).toBeLessThanOrEqual(1);
      expect(Number.isInteger(split.value.creator)).toBe(true);
    }
  });

  it("stays exact across the safe-integer range", () => {
    for (const [gross, creator, platform] of [
      [9_007_199_254_740_986, 4_503_599_627_370_493, 4_503_599_627_370_493],
      [Number.MAX_SAFE_INTEGER, 4_503_599_627_370_495, 4_503_599_627_370_496],
    ] as const) {
      expect(splitCredits(gross)).toEqual({
        ok: true,
        value: { creator, platform },
      });
      expect(splitMoneyMinorUnits(gross)).toEqual({
        ok: true,
        value: { creator, platform },
      });
    }
  });

  it("refuse a non-positive, fractional, or non-finite gross", () => {
    for (const gross of [0, -10, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(splitCredits(gross).ok).toBe(false);
      expect(splitMoneyMinorUnits(gross).ok).toBe(false);
    }
  });

  it("uses 5000 basis points", () => {
    expect(CREATOR_SHARE_BASIS_POINTS).toBe(5000);
  });
});

describe("authorizeCreatorPublish", () => {
  it("refuses a malformed request envelope", () => {
    const result = authorizeCreatorPublish(null as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.requestInvalid);
    }
  });

  it("refuses an anonymous publish", () => {
    const result = authorizeCreatorPublish({ now: NOW });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.accountRequired);
  });

  it("allows a signed-in creator, free of charge", () => {
    const result = authorizeCreatorPublish({
      now: NOW,
      principal: principal({ userId: "usr_creator_ada" }),
      admin,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outcome).toBe("allow-free");
  });

  it("refuses the Kids surface", () => {
    const result = authorizeCreatorPublish({ now: NOW, surface: "kids" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.kidsCommerceDenied);
  });
});

describe("applyCreditsSale", () => {
  it("refuses a malformed request envelope", () => {
    const result = applyCreditsSale(null as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.requestInvalid);
    }
  });

  const sale = (overrides: Record<string, unknown> = {}) => {
    const target = listing("lantern-prop");
    return applyCreditsSale({
      principal: principal(),
      admin,
      listing: target,
      buyerState: funded(100, BUYER),
      creatorState: createLedgerState(
        account(target.sellerUserId, "acc_creator"),
      ),
      now: NOW,
      saleId: "sale_01",
      ...overrides,
    } as never);
  };

  it("debits the buyer and grants the creator exactly 50%", () => {
    const result = sale();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 40 credits: 20 creator, 20 platform.
    expect(result.value.buyer.entry?.delta).toBe(-40);
    expect(result.value.buyer.state.balance).toBe(60);
    expect(result.value.creator?.entry?.delta).toBe(20);
    expect(result.value.creator?.state.balance).toBe(20);
    expect(result.value.share?.creatorCredits).toBe(20);
    expect(result.value.share?.platformCredits).toBe(20);
    expect(result.value.share?.grossCredits).toBe(40);
  });

  it("gives the platform the remainder on an odd price", () => {
    const target = listing("odd-price-charm");
    const result = applyCreditsSale({
      principal: principal(),
      admin,
      listing: target,
      buyerState: funded(100, BUYER),
      creatorState: createLedgerState(
        account(target.sellerUserId, "acc_creator"),
      ),
      now: NOW,
      saleId: "sale_odd",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 7 credits: 3 creator, 4 platform.
    expect(result.value.buyer.entry?.delta).toBe(-7);
    expect(result.value.creator?.entry?.delta).toBe(3);
    expect(result.value.share?.platformCredits).toBe(4);
    expect(
      (result.value.share?.creatorCredits ?? 0) +
        (result.value.share?.platformCredits ?? 0),
    ).toBe(7);
  });

  it("lands creator earnings in the creator's own append-only ledger", () => {
    const result = sale();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.creator?.entry?.movement).toBe("grant");
    expect(result.value.creator?.state.entries.length).toBe(1);
    expect(result.value.creator?.state.account.accountId).toBe("acc_creator");
  });

  it("leaves the buyer untouched when the creator grant refuses", () => {
    const buyerState = funded(100, BUYER);
    const target = listing("lantern-prop");
    const result = applyCreditsSale({
      principal: principal(),
      admin,
      listing: target,
      // A creator ledger whose account belongs to someone else.
      creatorState: createLedgerState(account("usr_someone", "acc_wrong")),
      buyerState,
      now: NOW,
      saleId: "sale_fail",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.accountNotOwned);
    expect(buyerState.balance).toBe(100);
    expect(buyerState.entries.length).toBe(1);
  });

  it("leaves the buyer untouched when the creator ledger is corrupt", () => {
    const buyerState = funded(100, BUYER);
    const target = listing("lantern-prop");
    const result = applyCreditsSale({
      principal: principal(),
      admin,
      listing: target,
      creatorState: {
        account: account(target.sellerUserId, "acc_creator"),
        entries: "not an array",
      } as never,
      buyerState,
      now: NOW,
      saleId: "sale_corrupt",
    });
    expect(result.ok).toBe(false);
    expect(buyerState.balance).toBe(100);
    expect(buyerState.entries.length).toBe(1);
  });

  it("refuses a seller buying their own listing", () => {
    const target = listing("lantern-prop");
    const result = applyCreditsSale({
      principal: principal({ userId: target.sellerUserId }),
      admin,
      listing: target,
      buyerState: funded(100, account(target.sellerUserId, "acc_creator")),
      creatorState: createLedgerState(
        account(target.sellerUserId, "acc_creator"),
      ),
      now: NOW,
      saleId: "sale_self",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(
      BILLING_REFUSE_REASONS.listingSelfPurchaseDenied,
    );
  });

  it("refuses paying credits for a money-only listing", () => {
    const target = listing("harbour-diorama");
    const result = applyCreditsSale({
      principal: principal(),
      admin,
      listing: target,
      buyerState: funded(100, BUYER),
      creatorState: createLedgerState(
        account(target.sellerUserId, "acc_creator"),
      ),
      now: NOW,
      saleId: "sale_money",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(
      BILLING_REFUSE_REASONS.listingCurrencyNotListed,
    );
  });

  it("refuses an insufficient buyer balance and pays no creator", () => {
    const target = listing("lantern-prop");
    const creatorState = createLedgerState(
      account(target.sellerUserId, "acc_creator"),
    );
    const result = applyCreditsSale({
      principal: principal(),
      admin,
      listing: target,
      buyerState: funded(10, BUYER),
      creatorState,
      now: NOW,
      saleId: "sale_poor",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.balanceInsufficient);
    expect(creatorState.balance).toBe(0);
    expect(creatorState.entries.length).toBe(0);
  });

  it("refuses the Kids surface", () => {
    const result = sale({ surface: "kids" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.kidsCommerceDenied);
  });

  it("is idempotent on the sale id — a replay moves nothing", () => {
    const first = sale();
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const target = listing("lantern-prop");
    const replay = applyCreditsSale({
      principal: principal(),
      admin,
      listing: target,
      buyerState: first.value.buyer.state,
      creatorState:
            first.value.creator?.state ??
            createLedgerState(account(target.sellerUserId, "acc_creator")),
      now: NOW + 60_000,
      saleId: "sale_01",
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.value.replayed).toBe(true);
    expect(replay.value.buyer.state.balance).toBe(60);
    expect(replay.value.creator?.state.balance).toBe(20);
    expect(replay.value.buyer.state.entries.length).toBe(
      first.value.buyer.state.entries.length,
    );
    expect(replay.value.creator?.state.entries.length).toBe(
      first.value.creator?.state.entries.length,
    );
  });

  it("mints nothing for the creator when the admin buyer is not charged", () => {
    const target = listing("lantern-prop");
    const creatorState = createLedgerState(
      account(target.sellerUserId, "acc_creator"),
    );
    const result = applyCreditsSale({
      principal: principal({ role: "admin" }),
      admin,
      listing: target,
      buyerState: funded(0, BUYER),
      creatorState,
      now: NOW,
      saleId: "sale_admin",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.charged).toBe(false);
    expect(result.value.buyer.state.balance).toBe(0);
    expect(result.value.buyer.entry).toBeUndefined();
    // No gross was collected, so there is no gross to split: granting the
    // creator half of it would create credits nobody paid for.
    expect(result.value.creator).toBeUndefined();
    expect(creatorState.balance).toBe(0);
    expect(creatorState.entries.length).toBe(0);
    // And no record may assert a gross that never moved.
    expect(result.value.share).toBeUndefined();
  });

  it("persists the debit, creator grant, and share in one atomic store call", async () => {
    const target = listing("lantern-prop");
    const buyerState = funded(100, BUYER);
    const creatorAccount = account(target.sellerUserId, "acc_creator");
    const store = createInMemoryCreditStore({
      accounts: [BUYER, creatorAccount],
      entries: buyerState.entries,
    });
    const result = await persistCreditsSale({
      store,
      principal: principal(),
      admin,
      listing: target,
      buyerState,
      creatorState: createLedgerState(creatorAccount),
      now: NOW,
      saleId: "sale_persisted",
    });
    expect(result.ok).toBe(true);
    expect(store.entryCount(BUYER.accountId)).toBe(2);
    expect(store.entryCount(creatorAccount.accountId)).toBe(1);
    expect(store.shareRecordCount()).toBe(1);
  });

  it("snapshots and freezes every atomic settlement record", async () => {
    const target = listing("lantern-prop");
    const buyerState = funded(100, BUYER);
    const creatorAccount = account(target.sellerUserId, "acc_creator");
    const applied = applyCreditsSale({
      principal: principal(),
      admin,
      listing: target,
      buyerState,
      creatorState: createLedgerState(creatorAccount),
      now: NOW,
      saleId: "sale_snapshot",
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.buyer.entry).toBeDefined();
    expect(applied.value.creator?.entry).toBeDefined();
    expect(applied.value.share).toBeDefined();
    if (
      applied.value.buyer.entry === undefined ||
      applied.value.creator?.entry === undefined ||
      applied.value.share === undefined
    ) {
      return;
    }

    const buyerEntry = { ...applied.value.buyer.entry };
    const creatorEntry = { ...applied.value.creator.entry };
    const share = { ...applied.value.share };
    const store = createInMemoryCreditStore({
      accounts: [BUYER, creatorAccount],
      entries: buyerState.entries,
    });
    const settled = await store.settleCreditsSale({
      buyerEntry,
      creatorEntry,
      share,
    });
    expect(settled.replayed).toBe(false);

    buyerEntry.reason = "rewritten buyer";
    creatorEntry.reason = "rewritten creator";
    share.creatorCredits = 0;

    const storedBuyer = (await store.listEntries(BUYER.accountId)).at(-1);
    const storedCreator = (await store.listEntries(creatorAccount.accountId)).at(
      -1,
    );
    expect(storedBuyer?.reason).toBe(applied.value.buyer.entry.reason);
    expect(storedCreator?.reason).toBe(applied.value.creator.entry.reason);
    expect(Object.isFrozen(storedBuyer)).toBe(true);
    expect(Object.isFrozen(storedCreator)).toBe(true);

    const replay = await store.settleCreditsSale({
      buyerEntry: applied.value.buyer.entry,
      creatorEntry: applied.value.creator.entry,
      share: applied.value.share,
    });
    expect(replay.replayed).toBe(true);
  });

  it("refuses a settlement whose gross carries no buyer debit", () => {
    const target = listing("lantern-prop");
    const creatorAccount = account(target.sellerUserId, "acc_creator");
    const buyerState = funded(100, BUYER);
    const applied = applyCreditsSale({
      principal: principal(),
      admin,
      listing: target,
      buyerState,
      creatorState: createLedgerState(creatorAccount),
      now: NOW,
      saleId: "sale_no_buyer_leg",
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const share = applied.value.share;
    const creatorEntry = applied.value.creator?.entry;
    expect(share).toBeDefined();
    expect(creatorEntry).toBeDefined();
    if (share === undefined || creatorEntry === undefined) return;

    const store = createInMemoryCreditStore({
      accounts: [BUYER, creatorAccount],
      entries: buyerState.entries,
    });
    // Granting the creator their half without the buyer's debit would mint
    // credits, so the persistence boundary refuses it independently.
    expect(() => store.settleCreditsSale({ creatorEntry, share })).toThrow(
      /missing its buyer entry/,
    );
    expect(store.shareRecordCount()).toBe(0);
    expect(store.entryCount(creatorAccount.accountId)).toBe(0);
  });

  it("leaves no buyer debit behind when the creator leg cannot commit", async () => {
    const target = listing("lantern-prop");
    const buyerState = funded(100, BUYER);
    const creatorAccount = account(target.sellerUserId, "acc_creator");
    // The creator's ledger already holds a row, so the grant computed against an
    // empty creator state collides at sequence 1. Everything about the buyer's
    // side is valid — which is exactly the half-sale shape: the debit would
    // commit, and the creator would never be paid.
    const creatorFunding = appendCreditEntry(
      createLedgerState(creatorAccount),
      {
        entryId: "ent_creator_prior",
        movement: "grant",
        delta: 5,
        reason: "earlier earnings",
        idempotencyKey: "fixture:creator:prior",
        now: NOW,
      },
    );
    expect(creatorFunding.ok).toBe(true);
    if (!creatorFunding.ok) return;
    const store = createInMemoryCreditStore({
      accounts: [BUYER, creatorAccount],
      entries: [...buyerState.entries, ...creatorFunding.value.state.entries],
    });

    const result = await persistCreditsSale({
      store,
      principal: principal(),
      admin,
      listing: target,
      buyerState,
      creatorState: createLedgerState(creatorAccount),
      now: NOW,
      saleId: "sale_creator_conflict",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.storeFailed);
    // The buyer keeps only their funding grant, the creator only their prior
    // row, and no share record claims a collection that did not happen.
    expect(store.entryCount(BUYER.accountId)).toBe(1);
    expect(store.entryCount(creatorAccount.accountId)).toBe(1);
    expect(store.shareRecordCount()).toBe(0);
  });

  it("refuses settlement entries that do not extend persisted ledger tails", async () => {
    const target = listing("lantern-prop");
    const persistedBuyerState = funded(10, BUYER);
    const submittedBuyerState = funded(100, BUYER);
    const creatorAccount = account(target.sellerUserId, "acc_creator");
    const store = createInMemoryCreditStore({
      accounts: [BUYER, creatorAccount],
      entries: persistedBuyerState.entries,
    });
    const result = await persistCreditsSale({
      store,
      principal: principal(),
      admin,
      listing: target,
      buyerState: submittedBuyerState,
      creatorState: createLedgerState(creatorAccount),
      now: NOW,
      saleId: "sale_wrong_tail",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.storeFailed);
    expect(store.entryCount(BUYER.accountId)).toBe(1);
    expect(store.entryCount(creatorAccount.accountId)).toBe(0);
    expect(store.shareRecordCount()).toBe(0);
  });

  it("replays a restored sale with its persisted ledger legs", async () => {
    const target = listing("lantern-prop");
    const creatorAccount = account(target.sellerUserId, "acc_creator");
    const first = applyCreditsSale({
      principal: principal(),
      admin,
      listing: target,
      buyerState: funded(100, BUYER),
      creatorState: createLedgerState(creatorAccount),
      now: NOW,
      saleId: "sale_restored",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.creator).toBeDefined();
    expect(first.value.share).toBeDefined();
    if (first.value.creator === undefined || first.value.share === undefined) {
      return;
    }

    const store = createInMemoryCreditStore({
      accounts: [BUYER, creatorAccount],
      entries: [
        ...first.value.buyer.state.entries,
        ...first.value.creator.state.entries,
      ],
      shareRecords: [first.value.share],
    });
    const replay = await persistCreditsSale({
      store,
      principal: principal(),
      admin,
      listing: target,
      buyerState: first.value.buyer.state,
      creatorState: first.value.creator.state,
      now: NOW + 60_000,
      saleId: "sale_restored",
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.value.replayed).toBe(true);
    expect(store.entryCount(BUYER.accountId)).toBe(2);
    expect(store.entryCount(creatorAccount.accountId)).toBe(1);
    expect(store.shareRecordCount()).toBe(1);
  });

  it("persists no settlement at all for an uncharged admin sale", async () => {
    const listed = listing("lantern-prop");
    const target = Object.freeze({
      ...listed,
      listingId: "one-credit",
      creditPrice: 1,
    });
    const creatorAccount = account(target.sellerUserId, "acc_creator");
    const buyerState = funded(0, BUYER);
    const creatorState = createLedgerState(creatorAccount);
    const store = createInMemoryCreditStore({
      accounts: [BUYER, creatorAccount],
    });
    const adminSale = () =>
      persistCreditsSale({
        store,
        principal: principal({ role: "admin" }),
        admin,
        listing: target,
        buyerState,
        creatorState,
        now: NOW,
        saleId: "sale_admin_replay",
      });
    const first = await adminSale();
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.charged).toBe(false);
    expect(first.value.buyer.entry).toBeUndefined();
    expect(first.value.creator).toBeUndefined();
    expect(first.value.share).toBeUndefined();

    // Repeating it is not a replay of something recorded — nothing was ever
    // recorded, so no ledger row and no share record exists to mint from.
    const again = await adminSale();
    expect(again.ok).toBe(true);
    expect(store.entryCount(BUYER.accountId)).toBe(0);
    expect(store.entryCount(creatorAccount.accountId)).toBe(0);
    expect(store.shareRecordCount()).toBe(0);
  });

  it("returns one refusal when the atomic store settlement fails", async () => {
    let settlementCalls = 0;
    let appendCalls = 0;
    const store: CreditStore = Object.freeze({
      findAccountByUserId: () => undefined,
      findAccountById: () => undefined,
      listEntries: () => [],
      appendEntry() {
        appendCalls += 1;
      },
      appendOrReplayEntry(entry) {
        appendCalls += 1;
        return { entry, replayed: false };
      },
      settleCreditsSale() {
        settlementCalls += 1;
        throw new Error("transaction rolled back");
      },
    });
    const target = listing("lantern-prop");
    const result = await persistCreditsSale({
      store,
      principal: principal(),
      admin,
      listing: target,
      buyerState: funded(100, BUYER),
      creatorState: createLedgerState(
        account(target.sellerUserId, "acc_creator"),
      ),
      now: NOW,
      saleId: "sale_store_failure",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.storeFailed);
    expect(settlementCalls).toBe(1);
    expect(appendCalls).toBe(0);
  });
});

/**
 * Money bookkeeping, built only from evidence this process verified (sceneaxi#127).
 *
 * `recordMoneySale` has no parameter for a gross, a currency, a buyer, a mode, or
 * a sale id, so every fixture below has to produce a real settlement: a signed
 * webhook body, parsed against the persisted intent it was created under, with
 * settlement bound to that body's own Checkout Session.
 */
const SECRET = "whsec_revenue_share_fixture";
const NOW_SECONDS = Math.floor(NOW / 1000);

const listingIntent = (
  overrides: {
    readonly listingId?: string;
    readonly userId?: string;
    readonly saleId?: string;
    readonly mode?: "test" | "live";
  } = {},
): CheckoutSessionIntent => {
  const listingId = overrides.listingId ?? "harbour-diorama";
  // A credits-only listing has no money price, so one is invented for the
  // intent — which is exactly the case the money path must refuse on the
  // listing, after the intent itself binds cleanly.
  const price = listing(listingId).moneyPrice ?? {
    unitAmount: 1200,
    currency: "usd",
    stripePriceId: "price_test_unlisted",
  };
  const idempotencyKey = `${LISTING_SALE_IDEMPOTENCY_PREFIX}${overrides.saleId ?? "sale_money_01"}`;
  return {
    schemaVersion: 1,
    kind: "sceneaxi.checkout-session-intent",
    intentId: deriveIntentId(idempotencyKey),
    userId: overrides.userId ?? "usr_buyer",
    purpose: "catalog-listing",
    itemId: listingId,
    unitAmount: price.unitAmount,
    currency: price.currency,
    stripePriceId: price.stripePriceId,
    mode: overrides.mode ?? "test",
    successUrl: "https://sceneaxi.example/ok",
    cancelUrl: "https://sceneaxi.example/no",
    idempotencyKey,
    createdAt: new Date(NOW).toISOString(),
  };
};

const packIntent = (): CheckoutSessionIntent => ({
  schemaVersion: 1,
  kind: "sceneaxi.checkout-session-intent",
  intentId: deriveIntentId("checkout:pack_money"),
  userId: "usr_buyer",
  purpose: "credit-pack",
  itemId: "starter",
  credits: 100,
  unitAmount: 900,
  currency: "usd",
  stripePriceId: "price_test_starter",
  mode: "test",
  successUrl: "https://sceneaxi.example/ok",
  cancelUrl: "https://sceneaxi.example/no",
  idempotencyKey: "checkout:pack_money",
  createdAt: new Date(NOW).toISOString(),
});

const sessionIdFor = (intent: CheckoutSessionIntent) => `cs_${intent.intentId}`;

/** The raw signed body a Stripe completion for this intent would carry. */
const verifiedBodyFor = (intent: CheckoutSessionIntent, sessionId: string) => {
  const body = JSON.stringify({
    id: `evt_${intent.intentId}`,
    type: "checkout.session.completed",
    created: NOW_SECONDS,
    livemode: intent.mode === "live",
    data: {
      object: {
        id: sessionId,
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
  return verified.value;
};

const settlementFor = (intent: CheckoutSessionIntent, sessionId: string) => ({
  sessionId,
  paymentStatus: "paid" as const,
  amountTotal: intent.unitAmount,
  currency: intent.currency,
  quantity: 1,
  stripePriceId: intent.stripePriceId,
});

/** A genuinely settled completion for an intent, through the real parser. */
const settleIntent = (intent: CheckoutSessionIntent) => {
  const sessionId = sessionIdFor(intent);
  const completion = parseCheckoutCompletedEvent({
    verified: verifiedBodyFor(intent, sessionId),
    intent,
    settlement: settlementFor(intent, sessionId),
  });
  if (!completion.ok) {
    throw new Error(`fixture parse failed: ${completion.message}`);
  }
  return completion.value;
};

describe("recordMoneySale", () => {
  it("refuses a malformed request envelope", () => {
    const result = recordMoneySale(null as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.requestInvalid);
    }
  });

  const record = (intent = listingIntent()) =>
    recordMoneySale({ completion: settleIntent(intent), intent });

  it("records a balanced 50/50 split from the settled intent", () => {
    const result = record();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.grossMinor).toBe(1200);
    expect(result.value.creatorMinor).toBe(600);
    expect(result.value.platformMinor).toBe(600);
    expect(result.value.creatorMinor + result.value.platformMinor).toBe(
      result.value.grossMinor,
    );
    expect(result.value.mode).toBe("test");
    expect(result.value.saleId).toBe("sale_money_01");
    expect(result.value.listingId).toBe("harbour-diorama");
    expect(result.value.buyerUserId).toBe("usr_buyer");
    expect(result.value.creatorUserId).toBe("usr_creator_ben");
  });

  it("balances every money-priced fixture, odd ones included", () => {
    for (const listingId of [
      "harbour-diorama",
      "market-stall-kit",
      "odd-price-charm",
    ]) {
      const result = record(listingIntent({ listingId }));
      expect(result.ok, listingId).toBe(true);
      if (!result.ok) return;
      expect(result.value.grossMinor).toBe(listing(listingId).moneyPrice?.unitAmount);
      expect(result.value.creatorMinor + result.value.platformMinor).toBe(
        result.value.grossMinor,
      );
      expect(result.value.platformMinor).toBeGreaterThanOrEqual(
        result.value.creatorMinor,
      );
    }
  });

  it("is bookkeeping only — no payout field can exist on the record", () => {
    const result = record();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const keys = Object.keys(result.value);
    for (const forbidden of FORBIDDEN_PAYOUT_KEYS) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("refuses a record carrying a payout field", () => {
    for (const forbidden of FORBIDDEN_PAYOUT_KEYS) {
      const result = validateMoneySplitRecord({
        schemaVersion: 1,
        kind: "sceneaxi.money-split-record",
        saleId: "sale_x",
        listingId: "harbour-diorama",
        buyerUserId: "usr_buyer",
        creatorUserId: "usr_creator_ben",
        grossMinor: 1200,
        creatorMinor: 600,
        platformMinor: 600,
        currency: "usd",
        basisPoints: 5000,
        mode: "test",
        occurredAt: "2026-07-25T10:00:00Z",
        [forbidden]: "acct_123",
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe(
        REVENUE_SHARE_REFUSE_CODES.payoutFieldForbidden,
      );
    }
  });

  it("refuses recording money for a credits-only listing", () => {
    const result = record(listingIntent({ listingId: "lantern-prop" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(
      BILLING_REFUSE_REASONS.listingCurrencyNotListed,
    );
  });

  it("refuses a completion it did not verify, however genuine it looks", () => {
    const intent = listingIntent();
    const completion = settleIntent(intent);
    // A copy is a different object, so the runtime witness does not know it —
    // which is the whole point: a caller cannot hand-build settled evidence.
    for (const impostor of [
      { ...completion },
      structuredClone(completion),
      JSON.parse(JSON.stringify(completion)) as typeof completion,
    ]) {
      const result = recordMoneySale({ completion: impostor, intent });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(
        BILLING_REFUSE_REASONS.completionNotVerified,
      );
    }
  });

  it("cannot be reached at all with settlement from another paid session", () => {
    // Two paid sessions for the same listing agree on amount, currency, and
    // price; only the session id separates them. The refusal lands at the
    // parser, so no completion exists for the money path to record.
    const intent = listingIntent();
    const parsed = parseCheckoutCompletedEvent({
      verified: verifiedBodyFor(intent, sessionIdFor(intent)),
      intent,
      settlement: settlementFor(intent, "cs_another_paid_session"),
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe(
      BILLING_REFUSE_REASONS.settlementSessionMismatch,
    );
  });

  it("names the exact Checkout Session on the evidence it records from", () => {
    const intent = listingIntent();
    const completion = settleIntent(intent);
    expect(completion.checkoutSessionId).toBe(sessionIdFor(intent));
  });

  it("refuses a credit-pack completion, which books no money sale", () => {
    const intent = packIntent();
    const result = recordMoneySale({
      completion: settleIntent(intent),
      intent,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(
      BILLING_REFUSE_REASONS.webhookEventTypeUnsupported,
    );
  });

  it("refuses an intent that does not describe the settled completion", () => {
    const intent = listingIntent();
    const completion = settleIntent(intent);
    for (const wrong of [
      { ...intent, unitAmount: intent.unitAmount + 1 },
      { ...intent, currency: "eur" },
      { ...intent, userId: "usr_someone_else" },
      { ...intent, stripePriceId: "price_test_other" },
      { ...intent, itemId: "market-stall-kit" },
    ]) {
      const result = recordMoneySale({ completion, intent: wrong });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(
        BILLING_REFUSE_REASONS.checkoutIntentInvalid,
      );
    }
  });

  it("refuses an intent keyed outside the listing-sale namespace", () => {
    const renamed = {
      ...listingIntent(),
      idempotencyKey: "checkout:usr_buyer:harbour",
    };
    const rekeyed = { ...renamed, intentId: deriveIntentId(renamed.idempotencyKey) };
    const result = recordMoneySale({
      completion: settleIntent(rekeyed),
      intent: rekeyed,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.checkoutIntentInvalid);
  });

  it("refuses an in-namespace key renamed onto someone else's settlement", () => {
    // The sale id is read out of the intent's key, so a key kept inside the
    // "sale:" namespace is the only way bookkeeping could be re-attached to a
    // sale nobody settled. Re-deriving the intent id is what stops it.
    const intent = listingIntent();
    const completion = settleIntent(intent);
    const renamed = {
      ...intent,
      idempotencyKey: `${LISTING_SALE_IDEMPOTENCY_PREFIX}sale_someone_elses`,
    };
    const result = recordMoneySale({ completion, intent: renamed });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.checkoutIntentInvalid);

    // The genuine intent still settles, under its own sale id.
    const genuine = recordMoneySale({ completion, intent });
    expect(genuine.ok).toBe(true);
    if (!genuine.ok) return;
    expect(genuine.value.saleId).toBe("sale_money_01");
  });

  it("reads the sale id out of the key, colons and all", () => {
    const result = record(listingIntent({ saleId: "stream:1" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.saleId).toBe("stream:1");
    // The buyer id can never carry a colon: it comes from the completion, whose
    // contract already refuses one, so the two id spaces cannot be confused.
    expect(result.value.buyerUserId).not.toContain(":");
  });

  it("refuses a sale whose buyer is the seller", () => {
    const result = record(
      listingIntent({ userId: listing("harbour-diorama").sellerUserId }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.revenueShareInvalid);
  });

  it("keeps live mode behind the captain gate, test mode as the default", () => {
    const live = listingIntent({ mode: "live" });
    const completion = settleIntent(live);

    const ungated = recordMoneySale({ completion, intent: live });
    expect(ungated.ok).toBe(false);
    if (ungated.ok) return;
    expect(ungated.reason).toBe(BILLING_REFUSE_REASONS.liveModeNotAuthorized);

    const gated = recordMoneySale({
      completion,
      intent: live,
      liveModeAuthorized: true,
    });
    expect(gated.ok).toBe(true);
    if (!gated.ok) return;
    expect(gated.value.mode).toBe("live");

    // The default is test, and it needs no gate.
    expect(record().ok).toBe(true);
  });

  it("takes occurredAt from the settlement, so a replay records the same row", () => {
    const intent = listingIntent();
    const completion = settleIntent(intent);
    const first = recordMoneySale({ completion, intent });
    const second = recordMoneySale({ completion, intent });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value).toEqual(first.value);
    expect(first.value.occurredAt).toBe(completion.occurredAt);
  });
});

describe("bindSettledIntent", () => {
  it("binds a persisted intent to its completion and names the sale", () => {
    const intent = listingIntent({ saleId: "sale_bound_01" });
    const bound = bindSettledIntent(intent, settleIntent(intent));
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    expect(bound.value.saleId).toBe("sale_bound_01");
    expect(bound.value.intent).toEqual(intent);
  });

  it("refuses an intent that describes some other purchase", () => {
    const intent = listingIntent();
    const other = listingIntent({ saleId: "sale_other_01" });
    const bound = bindSettledIntent(other, settleIntent(intent));
    expect(bound.ok).toBe(false);
    if (bound.ok) return;
    expect(bound.reason).toBe(BILLING_REFUSE_REASONS.checkoutIntentInvalid);
  });
});

describe("split records refuse an unbalanced split", () => {
  it("on credits", () => {
    const result = validateCreatorShareRecord({
      schemaVersion: 1,
      kind: "sceneaxi.creator-share-record",
      saleId: "sale_x",
      listingId: "lantern-prop",
      buyerUserId: "usr_buyer",
      creatorUserId: "usr_creator_ada",
      grossCredits: 40,
      creatorCredits: 20,
      platformCredits: 25,
      basisPoints: 5000,
      occurredAt: "2026-07-25T10:00:00Z",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(REVENUE_SHARE_REFUSE_CODES.splitDoesNotBalance);
  });

  it("on money", () => {
    const result = validateMoneySplitRecord({
      schemaVersion: 1,
      kind: "sceneaxi.money-split-record",
      saleId: "sale_x",
      listingId: "harbour-diorama",
      buyerUserId: "usr_buyer",
      creatorUserId: "usr_creator_ben",
      grossMinor: 1200,
      creatorMinor: 600,
      platformMinor: 601,
      currency: "usd",
      basisPoints: 5000,
      mode: "test",
      occurredAt: "2026-07-25T10:00:00Z",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(REVENUE_SHARE_REFUSE_CODES.splitDoesNotBalance);
  });

  it("and refuses a split other than 5000 basis points", () => {
    const result = validateCreatorShareRecord({
      schemaVersion: 1,
      kind: "sceneaxi.creator-share-record",
      saleId: "sale_x",
      listingId: "lantern-prop",
      buyerUserId: "usr_buyer",
      creatorUserId: "usr_creator_ada",
      grossCredits: 40,
      creatorCredits: 28,
      platformCredits: 12,
      basisPoints: 7000,
      occurredAt: "2026-07-25T10:00:00Z",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(REVENUE_SHARE_REFUSE_CODES.invalidProperty);
  });

  it("and refuses a buyer who is also the creator", () => {
    const result = validateCreatorShareRecord({
      schemaVersion: 1,
      kind: "sceneaxi.creator-share-record",
      saleId: "sale_x",
      listingId: "lantern-prop",
      buyerUserId: "usr_creator_ada",
      creatorUserId: "usr_creator_ada",
      grossCredits: 40,
      creatorCredits: 20,
      platformCredits: 20,
      basisPoints: 5000,
      occurredAt: "2026-07-25T10:00:00Z",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(REVENUE_SHARE_REFUSE_CODES.invalidProperty);
  });
});
