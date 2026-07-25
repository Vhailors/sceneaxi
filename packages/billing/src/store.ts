/**
 * The credit persistence port and an in-memory reference implementation.
 *
 * The in-memory store enforces the same invariants the database does — global
 * `entryId`, unique `(accountId, sequence)`, unique `idempotencyKey`, and no
 * update or delete of an existing entry. If it were merely a `Map` push, a bug
 * that the real trigger would catch could pass the whole test suite.
 */

import type {
  CreatorShareRecord,
  CreditAccount,
  CreditLedgerEntry,
} from "@sceneaxi/schemas";
import type { Awaitable } from "@sceneaxi/auth";

/**
 * The atomic result of a credits sale: the buyer debit and creator grant (either
 * may be absent — an admin buyer is not debited, a zero creator share is not
 * granted) plus the share record. `CreditStore.settleCreditsSale` commits all of
 * it or none of it, so a failure on the creator side can never leave the buyer
 * charged without their 50% share.
 */
export type CreditsSaleSettlement = Readonly<{
  buyerEntry?: CreditLedgerEntry | undefined;
  creatorEntry?: CreditLedgerEntry | undefined;
  share: CreatorShareRecord;
}>;

export type CreditsSaleSettlementOutcome = Readonly<{ replayed: boolean }>;

export type CreditStore = Readonly<{
  findAccountByUserId(userId: string): Awaitable<CreditAccount | undefined>;
  findAccountById(accountId: string): Awaitable<CreditAccount | undefined>;
  listEntries(accountId: string): Awaitable<ReadonlyArray<CreditLedgerEntry>>;
  appendEntry(entry: CreditLedgerEntry): Awaitable<void>;
  /**
   * Persist a credits sale atomically: every entry and the share record commit
   * together, an identical settlement reports a replay, and a conflicting
   * settlement rolls back.
   */
  settleCreditsSale(
    settlement: CreditsSaleSettlement,
  ): Awaitable<CreditsSaleSettlementOutcome>;
}>;

export type InMemoryCreditStoreOptions = Readonly<{
  accounts?: ReadonlyArray<CreditAccount>;
  entries?: ReadonlyArray<CreditLedgerEntry>;
  shareRecords?: ReadonlyArray<CreatorShareRecord>;
}>;

export type InMemoryCreditStore = CreditStore &
  Readonly<{
    entryCount(accountId: string): number;
    shareRecordCount(): number;
  }>;

function sameEntry(
  left: CreditLedgerEntry | undefined,
  right: CreditLedgerEntry | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return (
    left.schemaVersion === right.schemaVersion &&
    left.kind === right.kind &&
    left.entryId === right.entryId &&
    left.accountId === right.accountId &&
    left.sequence === right.sequence &&
    left.movement === right.movement &&
    left.delta === right.delta &&
    left.balanceAfter === right.balanceAfter &&
    left.reason === right.reason &&
    left.idempotencyKey === right.idempotencyKey &&
    left.occurredAt === right.occurredAt
  );
}

function sameShare(
  left: CreatorShareRecord,
  right: CreatorShareRecord,
  ignoreOccurredAt: boolean,
): boolean {
  return (
    left.schemaVersion === right.schemaVersion &&
    left.kind === right.kind &&
    left.saleId === right.saleId &&
    left.listingId === right.listingId &&
    left.buyerUserId === right.buyerUserId &&
    left.creatorUserId === right.creatorUserId &&
    left.grossCredits === right.grossCredits &&
    left.creatorCredits === right.creatorCredits &&
    left.platformCredits === right.platformCredits &&
    left.basisPoints === right.basisPoints &&
    (ignoreOccurredAt || left.occurredAt === right.occurredAt)
  );
}

function sameSettlement(
  left: CreditsSaleSettlement,
  right: CreditsSaleSettlement,
): boolean {
  const noLedgerLegs =
    left.buyerEntry === undefined &&
    left.creatorEntry === undefined &&
    right.buyerEntry === undefined &&
    right.creatorEntry === undefined;
  return (
    sameEntry(left.buyerEntry, right.buyerEntry) &&
    sameEntry(left.creatorEntry, right.creatorEntry) &&
    sameShare(left.share, right.share, noLedgerLegs)
  );
}

/**
 * Reference store. `appendEntry` throws on any invariant violation rather than
 * returning a result, mirroring a database constraint: the caller's ledger logic
 * is supposed to have made this impossible, so reaching it is a defect.
 */
export function createInMemoryCreditStore(
  options: InMemoryCreditStoreOptions = {},
): InMemoryCreditStore {
  const accountsById = new Map<string, CreditAccount>();
  const accountsByUserId = new Map<string, CreditAccount>();
  const entriesByAccount = new Map<string, CreditLedgerEntry[]>();
  const entryIds = new Set<string>();
  const idempotencyKeys = new Set<string>();
  const shareRecords: CreatorShareRecord[] = [];
  const settlementsBySaleId = new Map<string, CreditsSaleSettlement>();

  for (const account of options.accounts ?? []) {
    accountsById.set(account.accountId, account);
    accountsByUserId.set(account.userId, account);
  }

  const listFor = (accountId: string): CreditLedgerEntry[] => {
    const existing = entriesByAccount.get(accountId);
    if (existing !== undefined) return existing;
    const created: CreditLedgerEntry[] = [];
    entriesByAccount.set(accountId, created);
    return created;
  };

  const append = (entry: CreditLedgerEntry): void => {
    const list = listFor(entry.accountId);
    if (list.some((held) => held.sequence === entry.sequence)) {
      throw new Error(
        `credit store: sequence ${entry.sequence} already exists for ${entry.accountId} — the ledger is append-only`,
      );
    }
    if (entryIds.has(entry.entryId)) {
      throw new Error(
        `credit store: entry ${entry.entryId} already exists — the ledger is append-only`,
      );
    }
    if (idempotencyKeys.has(entry.idempotencyKey)) {
      throw new Error(
        `credit store: idempotency key ${entry.idempotencyKey} already applied`,
      );
    }
    entryIds.add(entry.entryId);
    idempotencyKeys.add(entry.idempotencyKey);
    list.push(entry);
  };

  for (const entry of options.entries ?? []) append(entry);
  for (const share of options.shareRecords ?? []) {
    if (settlementsBySaleId.has(share.saleId)) {
      throw new Error(
        `credit store: share sale id ${share.saleId} already recorded`,
      );
    }
    settlementsBySaleId.set(share.saleId, Object.freeze({ share }));
    shareRecords.push(share);
  }

  const settle = (
    settlement: CreditsSaleSettlement,
  ): CreditsSaleSettlementOutcome => {
    const existing = settlementsBySaleId.get(settlement.share.saleId);
    if (existing !== undefined) {
      if (!sameSettlement(existing, settlement)) {
        throw new Error(
          `credit store: share sale id ${settlement.share.saleId} already recorded with different settlement evidence`,
        );
      }
      return Object.freeze({ replayed: true });
    }
    const entries = [
      settlement.buyerEntry,
      settlement.creatorEntry,
    ].filter((entry): entry is CreditLedgerEntry => entry !== undefined);
    // Validate every entry against the current state and against its siblings
    // first, so a violation on the creator side cannot leave an already-validated
    // buyer debit committed, and two staged entries cannot collide with each other.
    const stagedSequences = new Set<string>();
    const stagedEntryIds = new Set<string>();
    const stagedIdempotencyKeys = new Set<string>();
    for (const entry of entries) {
      const sequenceKey = `${entry.accountId}:${entry.sequence}`;
      const list = listFor(entry.accountId);
      if (list.some((held) => held.sequence === entry.sequence)) {
        throw new Error(
          `credit store: sequence ${entry.sequence} already exists for ${entry.accountId} — the ledger is append-only`,
        );
      }
      if (stagedSequences.has(sequenceKey)) {
        throw new Error(
          `credit store: sequence ${entry.sequence} already staged for ${entry.accountId} — the ledger is append-only`,
        );
      }
      if (entryIds.has(entry.entryId)) {
        throw new Error(
          `credit store: entry ${entry.entryId} already exists — the ledger is append-only`,
        );
      }
      if (stagedEntryIds.has(entry.entryId)) {
        throw new Error(
          `credit store: entry ${entry.entryId} already staged — the ledger is append-only`,
        );
      }
      if (idempotencyKeys.has(entry.idempotencyKey)) {
        throw new Error(
          `credit store: idempotency key ${entry.idempotencyKey} already applied`,
        );
      }
      if (stagedIdempotencyKeys.has(entry.idempotencyKey)) {
        throw new Error(
          `credit store: idempotency key ${entry.idempotencyKey} already staged`,
        );
      }
      stagedSequences.add(sequenceKey);
      stagedEntryIds.add(entry.entryId);
      stagedIdempotencyKeys.add(entry.idempotencyKey);
    }
    // All validated: commit every entry and the share record together.
    for (const entry of entries) {
      entryIds.add(entry.entryId);
      idempotencyKeys.add(entry.idempotencyKey);
      listFor(entry.accountId).push(entry);
    }
    settlementsBySaleId.set(settlement.share.saleId, settlement);
    shareRecords.push(settlement.share);
    return Object.freeze({ replayed: false });
  };

  return Object.freeze({
    findAccountByUserId(userId) {
      return accountsByUserId.get(userId);
    },
    findAccountById(accountId) {
      return accountsById.get(accountId);
    },
    listEntries(accountId) {
      return Object.freeze([...listFor(accountId)]);
    },
    appendEntry(entry) {
      append(entry);
    },
    settleCreditsSale(settlement) {
      return settle(settlement);
    },
    entryCount(accountId) {
      return listFor(accountId).length;
    },
    shareRecordCount() {
      return shareRecords.length;
    },
  });
}
