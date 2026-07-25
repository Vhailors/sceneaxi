/**
 * The credit persistence port and an in-memory reference implementation.
 *
 * The in-memory store enforces the same invariants the database does — unique
 * `(accountId, sequence)`, unique `idempotencyKey`, and no update or delete of
 * an existing entry. If it were merely a `Map` push, a bug that the real trigger
 * would catch could pass the whole test suite.
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

export type CreditStore = Readonly<{
  findAccountByUserId(userId: string): Awaitable<CreditAccount | undefined>;
  findAccountById(accountId: string): Awaitable<CreditAccount | undefined>;
  listEntries(accountId: string): Awaitable<ReadonlyArray<CreditLedgerEntry>>;
  appendEntry(entry: CreditLedgerEntry): Awaitable<void>;
  /**
   * Persist a credits sale atomically: every entry and the share record commit
   * together, or a violation rolls the whole settlement back.
   */
  settleCreditsSale(settlement: CreditsSaleSettlement): Awaitable<void>;
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
  const idempotencyKeys = new Set<string>();
  const shareRecords: CreatorShareRecord[] = [];
  const shareSaleIds = new Set<string>();

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
    if (list.some((held) => held.entryId === entry.entryId)) {
      throw new Error(
        `credit store: entry ${entry.entryId} already exists — the ledger is append-only`,
      );
    }
    if (idempotencyKeys.has(entry.idempotencyKey)) {
      throw new Error(
        `credit store: idempotency key ${entry.idempotencyKey} already applied`,
      );
    }
    idempotencyKeys.add(entry.idempotencyKey);
    list.push(entry);
  };

  for (const entry of options.entries ?? []) append(entry);
  for (const share of options.shareRecords ?? []) {
    if (shareSaleIds.has(share.saleId)) {
      throw new Error(
        `credit store: share sale id ${share.saleId} already recorded`,
      );
    }
    shareSaleIds.add(share.saleId);
    shareRecords.push(share);
  }

  const settle = (settlement: CreditsSaleSettlement): void => {
    const entries = [
      settlement.buyerEntry,
      settlement.creatorEntry,
    ].filter((entry): entry is CreditLedgerEntry => entry !== undefined);
    // Validate every entry against the current state first, so a violation on
    // the creator side cannot leave an already-validated buyer debit committed.
    for (const entry of entries) {
      const list = listFor(entry.accountId);
      if (list.some((held) => held.sequence === entry.sequence)) {
        throw new Error(
          `credit store: sequence ${entry.sequence} already exists for ${entry.accountId} — the ledger is append-only`,
        );
      }
      if (list.some((held) => held.entryId === entry.entryId)) {
        throw new Error(
          `credit store: entry ${entry.entryId} already exists — the ledger is append-only`,
        );
      }
      if (idempotencyKeys.has(entry.idempotencyKey)) {
        throw new Error(
          `credit store: idempotency key ${entry.idempotencyKey} already applied`,
        );
      }
    }
    if (shareSaleIds.has(settlement.share.saleId)) {
      throw new Error(
        `credit store: share sale id ${settlement.share.saleId} already recorded`,
      );
    }
    // All validated: commit every entry and the share record together.
    for (const entry of entries) {
      idempotencyKeys.add(entry.idempotencyKey);
      listFor(entry.accountId).push(entry);
    }
    shareSaleIds.add(settlement.share.saleId);
    shareRecords.push(settlement.share);
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
      settle(settlement);
    },
    entryCount(accountId) {
      return listFor(accountId).length;
    },
    shareRecordCount() {
      return shareRecords.length;
    },
  });
}
