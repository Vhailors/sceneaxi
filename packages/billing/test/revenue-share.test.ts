import { describe, expect, it } from "vitest";
import { digestSessionToken } from "@sceneaxi/auth";
import {
  CREATOR_SHARE_BASIS_POINTS,
  FORBIDDEN_PAYOUT_KEYS,
  REVENUE_SHARE_REFUSE_CODES,
  validateCreatorShareRecord,
  validateMoneySplitRecord,
  type CatalogListing,
  type CreditAccount,
} from "@sceneaxi/schemas";
import {
  BILLING_REFUSE_REASONS,
  applyCreditsSale,
  appendCreditEntry,
  authorizeCreatorPublish,
  createInMemoryCreditStore,
  createLedgerState,
  loadCatalogListings,
  lookupCatalogListing,
  persistCreditsSale,
  recordMoneySale,
  splitCredits,
  splitMoneyMinorUnits,
  type LedgerState,
  type CreditStore,
} from "@sceneaxi/billing";

const NOW = Date.parse("2026-07-25T10:00:00Z");
const admin = { email: "captain@example.com", source: "SCENEAXI_ADMIN_EMAIL" } as const;

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
    if (
      !applied.ok ||
      applied.value.buyer.entry === undefined ||
      applied.value.creator?.entry === undefined
    ) {
      return;
    }

    if (applied.value.share === undefined) return;
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
    if (
      !first.ok ||
      first.value.creator === undefined ||
      first.value.share === undefined
    ) {
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

describe("recordMoneySale", () => {
  it("refuses a malformed request envelope", () => {
    const result = recordMoneySale(null as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.requestInvalid);
    }
  });

  const record = (overrides: Record<string, unknown> = {}) =>
    recordMoneySale({
      listing: listing("harbour-diorama"),
      buyerUserId: "usr_buyer",
      saleId: "sale_money_01",
      mode: "test",
      now: NOW,
      ...overrides,
    } as never);

  it("records a balanced 50/50 split", () => {
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
  });

  it("balances every money-priced fixture, odd ones included", () => {
    for (const listingId of [
      "harbour-diorama",
      "market-stall-kit",
      "odd-price-charm",
    ]) {
      const result = record({ listing: listing(listingId) });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
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
    const result = record({ listing: listing("lantern-prop") });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(
      BILLING_REFUSE_REASONS.listingCurrencyNotListed,
    );
  });

  it("keeps sale ids distinct from user ids", () => {
    expect(record({ saleId: "sale:stream:1" }).ok).toBe(true);
    const colonUser = record({ buyerUserId: "buyer:1" });
    expect(colonUser.ok).toBe(false);
    if (!colonUser.ok) {
      expect(colonUser.reason).toBe(BILLING_REFUSE_REASONS.revenueShareInvalid);
    }
    expect(record({ buyerUserId: "u".repeat(129) }).ok).toBe(false);
  });

  it("refuses an epoch outside the Date range", () => {
    const result = record({ now: Number.MAX_VALUE });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.clockInvalid);
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
