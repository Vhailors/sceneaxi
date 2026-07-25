/**
 * The credit persistence port and an in-memory reference implementation.
 *
 * The in-memory store enforces the same invariants the database does — global
 * `entryId`, unique `(accountId, sequence)`, unique `idempotencyKey`, and no
 * update or delete of an existing entry. If it were merely a `Map` push, a bug
 * that the real trigger would catch could pass the whole test suite.
 */

import {
  snapshotPlainRecord,
  validateCreatorShareRecord,
  validateCreditAccount,
  validateCreditLedgerEntry,
  type CreatorShareRecord,
  type CreditAccount,
  type CreditLedgerEntry,
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

const SALE_ENTRY_PREFIX = "sale:";

function saleIdForEntryKey(key: string): string | undefined {
  if (!key.startsWith(SALE_ENTRY_PREFIX)) return undefined;
  if (key.endsWith(":buyer")) return key.slice(5, -6);
  if (key.endsWith(":creator")) return key.slice(5, -8);
  return "";
}

function fail(message: string): never {
  throw new Error(`credit store: ${message}`);
}

function snapshotAccount(account: unknown): CreditAccount {
  const validated = validateCreditAccount(account);
  if (!validated.ok) {
    return fail(`invalid account (${validated.code}): ${validated.message}`);
  }
  return validated.value;
}

function snapshotEntry(entry: unknown): CreditLedgerEntry {
  const validated = validateCreditLedgerEntry(entry);
  if (!validated.ok) {
    return fail(`invalid entry (${validated.code}): ${validated.message}`);
  }
  return validated.value;
}

function snapshotShare(share: unknown): CreatorShareRecord {
  const validated = validateCreatorShareRecord(share);
  if (!validated.ok) {
    return fail(`invalid share (${validated.code}): ${validated.message}`);
  }
  return validated.value;
}

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
  const entriesByIdempotencyKey = new Map<string, CreditLedgerEntry>();
  const shareRecords: CreatorShareRecord[] = [];
  const settlementsBySaleId = new Map<string, CreditsSaleSettlement>();

  for (const candidate of options.accounts ?? []) {
    const account = snapshotAccount(candidate);
    if (accountsById.has(account.accountId)) {
      fail(`account ${account.accountId} already exists`);
    }
    if (accountsByUserId.has(account.userId)) {
      fail(`user ${account.userId} already has a credit account`);
    }
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

  const assertExtendsTail = (
    entry: CreditLedgerEntry,
    previous: CreditLedgerEntry | undefined,
  ): void => {
    const expectedSequence = (previous?.sequence ?? 0) + 1;
    if (entry.sequence !== expectedSequence) {
      throw new Error(
        `credit store: sequence ${entry.sequence} does not extend ${entry.accountId} at ${expectedSequence}`,
      );
    }
    const expectedBalance = (previous?.balanceAfter ?? 0) + entry.delta;
    if (
      !Number.isSafeInteger(expectedBalance) ||
      entry.balanceAfter !== expectedBalance
    ) {
      throw new Error(
        `credit store: balance ${entry.balanceAfter} does not extend ${entry.accountId} at ${expectedBalance}`,
      );
    }
  };

  const assertKnownAccount = (entry: CreditLedgerEntry): CreditAccount => {
    const account = accountsById.get(entry.accountId);
    if (account === undefined) {
      return fail(`account ${entry.accountId} does not exist`);
    }
    return account;
  };

  const appendSnapshot = (entry: CreditLedgerEntry): void => {
    assertKnownAccount(entry);
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
    if (entriesByIdempotencyKey.has(entry.idempotencyKey)) {
      throw new Error(
        `credit store: idempotency key ${entry.idempotencyKey} already applied`,
      );
    }
    assertExtendsTail(entry, list.at(-1));
    entryIds.add(entry.entryId);
    entriesByIdempotencyKey.set(entry.idempotencyKey, entry);
    list.push(entry);
  };

  const append = (candidate: unknown): void => {
    const entry = snapshotEntry(candidate);
    if (entry.idempotencyKey.startsWith(SALE_ENTRY_PREFIX)) {
      fail(
        `sale entry ${entry.idempotencyKey} requires atomic settlement`,
      );
    }
    appendSnapshot(entry);
  };

  for (const candidate of options.entries ?? []) {
    appendSnapshot(snapshotEntry(candidate));
  }

  const snapshotSettlement = (
    candidate: unknown,
  ): CreditsSaleSettlement => {
    const record = snapshotPlainRecord(candidate);
    if (
      record === undefined ||
      !Object.hasOwn(record, "share") ||
      Object.keys(record).some(
        (key) =>
          key !== "buyerEntry" && key !== "creatorEntry" && key !== "share",
      )
    ) {
      return fail("a sale settlement must be a plain settlement object");
    }
    const share = snapshotShare(record["share"]);
    const buyerEntry =
      record["buyerEntry"] === undefined
        ? undefined
        : snapshotEntry(record["buyerEntry"]);
    const creatorEntry =
      record["creatorEntry"] === undefined
        ? undefined
        : snapshotEntry(record["creatorEntry"]);

    if (
      buyerEntry !== undefined &&
      buyerEntry.idempotencyKey !== `sale:${share.saleId}:buyer`
    ) {
      return fail(`sale ${share.saleId} has an invalid buyer entry key`);
    }
    if (
      creatorEntry !== undefined &&
      creatorEntry.idempotencyKey !== `sale:${share.saleId}:creator`
    ) {
      return fail(`sale ${share.saleId} has an invalid creator entry key`);
    }
    if (
      buyerEntry !== undefined &&
      (buyerEntry.movement !== "debit" ||
        buyerEntry.delta !== -share.grossCredits ||
        assertKnownAccount(buyerEntry).userId !== share.buyerUserId)
    ) {
      return fail(`sale ${share.saleId} has an invalid buyer entry`);
    }
    if (
      creatorEntry !== undefined &&
      (creatorEntry.movement !== "grant" ||
        creatorEntry.delta !== share.creatorCredits ||
        assertKnownAccount(creatorEntry).userId !== share.creatorUserId)
    ) {
      return fail(`sale ${share.saleId} has an invalid creator entry`);
    }
    if (creatorEntry === undefined && share.creatorCredits !== 0) {
      return fail(`sale ${share.saleId} is missing its creator entry`);
    }

    return Object.freeze({
      ...(buyerEntry === undefined ? {} : { buyerEntry }),
      ...(creatorEntry === undefined ? {} : { creatorEntry }),
      share,
    });
  };

  for (const candidate of options.shareRecords ?? []) {
    const share = snapshotShare(candidate);
    if (settlementsBySaleId.has(share.saleId)) {
      fail(`share sale id ${share.saleId} already recorded`);
    }
    const settlement = snapshotSettlement({
      buyerEntry: entriesByIdempotencyKey.get(`sale:${share.saleId}:buyer`),
      creatorEntry: entriesByIdempotencyKey.get(
        `sale:${share.saleId}:creator`,
      ),
      share,
    });
    settlementsBySaleId.set(share.saleId, settlement);
    shareRecords.push(settlement.share);
  }
  for (const key of entriesByIdempotencyKey.keys()) {
    const saleId = saleIdForEntryKey(key);
    if (saleId !== undefined && !settlementsBySaleId.has(saleId)) {
      fail(`sale entry ${key} has no atomic settlement record`);
    }
  }

  const settle = (
    candidate: CreditsSaleSettlement,
  ): CreditsSaleSettlementOutcome => {
    const settlement = snapshotSettlement(candidate);
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
    const stagedSequences = new Set<string>();
    const stagedEntryIds = new Set<string>();
    const stagedIdempotencyKeys = new Set<string>();
    const stagedTails = new Map<string, CreditLedgerEntry>();
    for (const entry of entries) {
      assertKnownAccount(entry);
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
      if (entriesByIdempotencyKey.has(entry.idempotencyKey)) {
        throw new Error(
          `credit store: idempotency key ${entry.idempotencyKey} already applied`,
        );
      }
      if (stagedIdempotencyKeys.has(entry.idempotencyKey)) {
        throw new Error(
          `credit store: idempotency key ${entry.idempotencyKey} already staged`,
        );
      }
      assertExtendsTail(
        entry,
        stagedTails.get(entry.accountId) ?? list.at(-1),
      );
      stagedSequences.add(sequenceKey);
      stagedEntryIds.add(entry.entryId);
      stagedIdempotencyKeys.add(entry.idempotencyKey);
      stagedTails.set(entry.accountId, entry);
    }
    for (const entry of entries) {
      entryIds.add(entry.entryId);
      entriesByIdempotencyKey.set(entry.idempotencyKey, entry);
      listFor(entry.accountId).push(entry);
    }
    settlementsBySaleId.set(
      settlement.share.saleId,
      Object.freeze(settlement),
    );
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
