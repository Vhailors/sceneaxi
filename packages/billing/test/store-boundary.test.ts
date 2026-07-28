/**
 * The shared persistence boundary (sceneaxi#128).
 *
 * These tests are written against a **hand-rolled adapter** rather than the
 * in-memory reference store, because that is the whole claim: the invariants
 * below must hold for an adapter whose author never heard of them. The adapter
 * here is deliberately naive — a `Map` that appends whatever it is handed, the
 * shape a first Neon adapter would take before anyone reviewed it — and each
 * test shows the raw adapter accepting what the boundary refuses.
 */

import { describe, expect, it } from "vitest";
import type {
  CreatorShareRecord,
  CreditAccount,
  CreditLedgerEntry,
} from "@sceneaxi/schemas";
import {
  SALE_ENTRY_KEY_PREFIX,
  createCreditStore,
  isSaleEntryKey,
  saleEntryKeys,
  type CommittedEntry,
  type CreditStoreAdapter,
  type CreditsSaleSettlement,
} from "@sceneaxi/billing";

const ACCOUNT = Object.freeze({
  schemaVersion: 1,
  kind: "sceneaxi.credit-account",
  accountId: "acc_crew",
  userId: "usr_crew",
  createdAt: "2026-07-25T09:00:00Z",
}) as CreditAccount;

const entry = (
  overrides: Partial<Record<string, unknown>> = {},
): CreditLedgerEntry =>
  Object.freeze({
    schemaVersion: 1,
    kind: "sceneaxi.credit-ledger-entry",
    entryId: "ent_01",
    accountId: ACCOUNT.accountId,
    sequence: 1,
    movement: "grant",
    delta: 100,
    balanceAfter: 100,
    reason: "test funding",
    idempotencyKey: "fixture:grant",
    occurredAt: "2026-07-25T10:00:00Z",
    ...overrides,
  }) as CreditLedgerEntry;

/**
 * The adapter a new persistence author writes first: it stores rows and knows
 * nothing about which keys are reserved to which operation.
 */
const naiveAdapter = () => {
  const rows = new Map<string, CreditLedgerEntry>();
  const settlements: CreditsSaleSettlement[] = [];
  const adapter: CreditStoreAdapter = Object.freeze({
    findAccountByUserId: (userId: string) =>
      userId === ACCOUNT.userId ? ACCOUNT : undefined,
    findAccountById: (accountId: string) =>
      accountId === ACCOUNT.accountId ? ACCOUNT : undefined,
    listEntries: () => Object.freeze([...rows.values()]),
    appendEntry(candidate: CreditLedgerEntry) {
      rows.set(candidate.idempotencyKey, candidate);
    },
    appendOrReplayEntry(candidate: CreditLedgerEntry): CommittedEntry {
      const existing = rows.get(candidate.idempotencyKey);
      if (existing !== undefined) {
        return { entry: existing, replayed: true };
      }
      rows.set(candidate.idempotencyKey, candidate);
      return { entry: candidate, replayed: false };
    },
    settleCreditsSale(settlement: CreditsSaleSettlement) {
      settlements.push(settlement);
      for (const leg of [settlement.buyerEntry, settlement.creatorEntry]) {
        if (leg !== undefined) rows.set(leg.idempotencyKey, leg);
      }
      return { replayed: false };
    },
  });
  return { adapter, rows, settlements };
};

describe("the reserved sale namespace", () => {
  it("names the keys both sale legs must carry", () => {
    expect(saleEntryKeys("sale_01")).toEqual({
      buyer: "sale:sale_01:buyer",
      creator: "sale:sale_01:creator",
    });
    expect(SALE_ENTRY_KEY_PREFIX).toBe("sale:");
    expect(isSaleEntryKey("sale:sale_01:buyer")).toBe(true);
    expect(isSaleEntryKey("usage:acc_crew:turn_01")).toBe(false);
  });

  it("is refused by appendEntry at the shared boundary, not by the adapter", () => {
    const { adapter, rows } = naiveAdapter();
    const leg = entry({
      movement: "debit",
      delta: -40,
      balanceAfter: 60,
      reason: "listing purchase",
      idempotencyKey: saleEntryKeys("sale_01").buyer,
    });

    // The adapter itself is happy to append one leg of a two-account sale —
    // which is exactly the half-sale the reservation exists to prevent.
    adapter.appendEntry(leg);
    expect(rows.size).toBe(1);
    rows.clear();

    // Wrapped, the same adapter cannot: the boundary refuses before it is reached.
    const store = createCreditStore(adapter);
    expect(() => store.appendEntry(leg)).toThrow(/requires atomic settlement/);
    expect(rows.size).toBe(0);
  });

  it("is refused by appendOrReplayEntry too, so no second door exists", () => {
    const { adapter, rows } = naiveAdapter();
    const store = createCreditStore(adapter);
    const leg = entry({
      idempotencyKey: saleEntryKeys("sale_01").creator,
      reason: "creator share",
    });
    expect(() => store.appendOrReplayEntry(leg)).toThrow(
      /requires atomic settlement/,
    );
    expect(rows.size).toBe(0);
  });

  it("lets both legs through settleCreditsSale, the one operation that owns them", () => {
    const { adapter, rows, settlements } = naiveAdapter();
    const store = createCreditStore(adapter);
    const keys = saleEntryKeys("sale_01");
    const share = Object.freeze({
      schemaVersion: 1,
      kind: "sceneaxi.creator-share-record",
      saleId: "sale_01",
      listingId: "lantern-prop",
      buyerUserId: "usr_crew",
      creatorUserId: "usr_maker",
      grossCredits: 40,
      creatorCredits: 20,
      platformCredits: 20,
      basisPoints: 5000,
      occurredAt: "2026-07-25T10:00:00Z",
    }) as CreatorShareRecord;

    const outcome = store.settleCreditsSale({
      buyerEntry: entry({
        movement: "debit",
        delta: -40,
        balanceAfter: 60,
        reason: "listing purchase",
        idempotencyKey: keys.buyer,
        sequence: 2,
      }),
      creatorEntry: entry({
        entryId: "ent_02",
        accountId: "acc_maker",
        delta: 20,
        balanceAfter: 20,
        reason: "creator share",
        idempotencyKey: keys.creator,
      }),
      share,
    });
    expect(outcome).toEqual({ replayed: false });
    expect(settlements.length).toBe(1);
    expect([...rows.keys()].sort()).toEqual([keys.buyer, keys.creator].sort());
  });

  it("refuses a settlement whose legs are not that sale's own keys", () => {
    const { adapter, settlements } = naiveAdapter();
    const store = createCreditStore(adapter);
    const share = Object.freeze({
      schemaVersion: 1,
      kind: "sceneaxi.creator-share-record",
      saleId: "sale_01",
      listingId: "lantern-prop",
      buyerUserId: "usr_crew",
      creatorUserId: "usr_maker",
      grossCredits: 40,
      creatorCredits: 20,
      platformCredits: 20,
      basisPoints: 5000,
      occurredAt: "2026-07-25T10:00:00Z",
    }) as CreatorShareRecord;

    // Another sale's buyer leg, smuggled into this sale's settlement.
    expect(() =>
      store.settleCreditsSale({
        buyerEntry: entry({
          movement: "debit",
          delta: -40,
          balanceAfter: 60,
          reason: "listing purchase",
          idempotencyKey: saleEntryKeys("sale_99").buyer,
        }),
        creatorEntry: entry({
          idempotencyKey: saleEntryKeys("sale_01").creator,
          delta: 20,
          balanceAfter: 20,
        }),
        share,
      }),
    ).toThrow(/invalid buyer entry key/);
    expect(settlements.length).toBe(0);
  });
});

describe("append-or-replay at the shared boundary", () => {
  it("appends once and replays the committed entry on retry", async () => {
    const { adapter, rows } = naiveAdapter();
    const store = createCreditStore(adapter);
    const debit = entry({
      movement: "debit",
      delta: -10,
      balanceAfter: 90,
      reason: "hosted assistant turn",
      idempotencyKey: "usage:acc_crew:turn_01",
    });

    expect(await store.appendOrReplayEntry(debit)).toEqual({
      entry: debit,
      replayed: false,
    });
    // The retry regenerates its entry id, exactly as a real retrying caller does.
    const retry = await store.appendOrReplayEntry({
      ...debit,
      entryId: "ent_retry",
    });
    expect(retry.replayed).toBe(true);
    expect(retry.entry.entryId).toBe(debit.entryId);
    expect(rows.size).toBe(1);
  });

  it("refuses an adapter that answers with a different entry", () => {
    const { adapter } = naiveAdapter();
    const impostor = entry({ idempotencyKey: "usage:acc_crew:other" });
    const store = createCreditStore(
      Object.freeze({
        ...adapter,
        appendOrReplayEntry: () => ({ entry: impostor, replayed: true }),
      }),
    );
    expect(() =>
      store.appendOrReplayEntry(entry({ idempotencyKey: "usage:acc_crew:mine" })),
    ).toThrow(/answered with a different entry/);
  });

  it("refuses an adapter that calls a rewritten row a fresh append", () => {
    const { adapter } = naiveAdapter();
    const requested = entry({ idempotencyKey: "usage:acc_crew:mine" });
    const store = createCreditStore(
      Object.freeze({
        ...adapter,
        // Same money, renumbered — which would break the next reader's balance
        // derivation, so a fresh append must be exactly what was handed over.
        appendOrReplayEntry: () => ({
          entry: { ...requested, sequence: 7, balanceAfter: 700 },
          replayed: false,
        }),
      }),
    );
    expect(() => store.appendOrReplayEntry(requested)).toThrow(
      /claims a fresh append it did not make/,
    );
  });

  it("refuses an adapter that answers with nothing at all", () => {
    const { adapter } = naiveAdapter();
    const store = createCreditStore(
      Object.freeze({
        ...adapter,
        appendOrReplayEntry: () => undefined as never,
      }),
    );
    expect(() =>
      store.appendOrReplayEntry(entry({ idempotencyKey: "usage:acc_crew:mine" })),
    ).toThrow(/returned no committed entry/);
  });

  it("needs no database to prove any of this", () => {
    // The boundary is where a live store would plug in, so this is the suite
    // most likely to acquire a connection string. It must not: the gate proves
    // the persistence contract against adapters it constructs itself, and a
    // live-database test is opt-in and never part of the default run.
    expect(process.env["DATABASE_URL"]).toBeUndefined();
  });

  it("resolves an asynchronous adapter through the same checks", async () => {
    const { adapter } = naiveAdapter();
    const store = createCreditStore(
      Object.freeze({
        ...adapter,
        appendOrReplayEntry: (candidate: CreditLedgerEntry) =>
          Promise.resolve({ entry: { ...candidate, delta: 1 }, replayed: true }),
      }),
    );
    await expect(
      store.appendOrReplayEntry(entry({ idempotencyKey: "usage:acc_crew:mine" })),
    ).rejects.toThrow(/answered with a different entry/);
  });
});
