/**
 * The credit persistence port, its shared boundary, and an in-memory reference
 * implementation.
 *
 * The in-memory store enforces the same invariants the database does — global
 * `entryId`, unique `(accountId, sequence)`, unique `idempotencyKey`, and no
 * update or delete of an existing entry. If it were merely a `Map` push, a bug
 * that the real trigger would catch could pass the whole test suite.
 *
 * An adapter is never handed to a caller directly. `createCreditStore` wraps one
 * and is where the invariants that must hold for *every* adapter live, so a
 * future Neon adapter inherits them by construction instead of by remembering
 * to re-implement them (sceneaxi#128).
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
 * The atomic result of a credits sale: the buyer debit, the creator grant (absent
 * when the floor split left the creator a zero share, which is never granted as a
 * zero-value row), and the share record. `CreditStore.settleCreditsSale` commits
 * all of it or none of it, so a failure on the creator side can never leave the
 * buyer charged without their 50% share — and a share record without the buyer's
 * debit is refused, so no settlement can book a gross that was never collected.
 */
export type CreditsSaleSettlement = Readonly<{
  buyerEntry?: CreditLedgerEntry | undefined;
  creatorEntry?: CreditLedgerEntry | undefined;
  share: CreatorShareRecord;
}>;

export type CreditsSaleSettlementOutcome = Readonly<{ replayed: boolean }>;

/**
 * The outcome of an atomic append-or-replay: the entry the ledger actually holds
 * under the requested idempotency key, and whether it was already there.
 */
export type CommittedEntry = Readonly<{
  entry: CreditLedgerEntry;
  replayed: boolean;
}>;

export type CreditStore = Readonly<{
  findAccountByUserId(userId: string): Awaitable<CreditAccount | undefined>;
  findAccountById(accountId: string): Awaitable<CreditAccount | undefined>;
  listEntries(accountId: string): Awaitable<ReadonlyArray<CreditLedgerEntry>>;
  appendEntry(entry: CreditLedgerEntry): Awaitable<void>;
  /**
   * Append one entry, or hand back the entry already committed under its
   * idempotency key.
   *
   * This is the operation a lost response needs. A caller whose append committed
   * but whose answer never arrived retries and is told `replayed: true` rather
   * than colliding with its own row, and exactly one entry exists either way.
   * A committed entry carrying a different semantic payload under the same key
   * is a conflict, never a second append.
   */
  appendOrReplayEntry(entry: CreditLedgerEntry): Awaitable<CommittedEntry>;
  /**
   * Persist a credits sale atomically: every entry and the share record commit
   * together, an identical settlement reports a replay, and a conflicting
   * settlement rolls back.
   */
  settleCreditsSale(
    settlement: CreditsSaleSettlement,
  ): Awaitable<CreditsSaleSettlementOutcome>;
}>;

/**
 * The raw persistence operations one adapter implements.
 *
 * Structurally identical to `CreditStore`, and deliberately a separate name: an
 * adapter is the thing that talks to storage, and a `CreditStore` is what
 * `createCreditStore` returns after guarding it. Nothing in this package accepts
 * an adapter where a store is required.
 */
export type CreditStoreAdapter = CreditStore;

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
 * The idempotency-key namespace reserved to atomic sale settlement.
 *
 * A sale has two ledger legs in two different accounts. Any path that can append
 * one of them on its own can leave a buyer charged for a creator who was never
 * paid, so the namespace is refused by `appendEntry` at the shared boundary and
 * reaches persistence only through `settleCreditsSale`.
 */
export const SALE_ENTRY_KEY_PREFIX = "sale:" as const;

const SALE_BUYER_SUFFIX = ":buyer";
const SALE_CREATOR_SUFFIX = ":creator";

/** The two reserved ledger keys of one credits sale. */
export function saleEntryKeys(
  saleId: string,
): Readonly<{ buyer: string; creator: string }> {
  return Object.freeze({
    buyer: `${SALE_ENTRY_KEY_PREFIX}${saleId}${SALE_BUYER_SUFFIX}`,
    creator: `${SALE_ENTRY_KEY_PREFIX}${saleId}${SALE_CREATOR_SUFFIX}`,
  });
}

/** Whether a ledger idempotency key is reserved to atomic sale settlement. */
export function isSaleEntryKey(idempotencyKey: string): boolean {
  return idempotencyKey.startsWith(SALE_ENTRY_KEY_PREFIX);
}

function saleIdForEntryKey(key: string): string | undefined {
  if (!isSaleEntryKey(key)) return undefined;
  const rest = key.slice(SALE_ENTRY_KEY_PREFIX.length);
  if (rest.endsWith(SALE_BUYER_SUFFIX)) {
    return rest.slice(0, -SALE_BUYER_SUFFIX.length);
  }
  if (rest.endsWith(SALE_CREATOR_SUFFIX)) {
    return rest.slice(0, -SALE_CREATOR_SUFFIX.length);
  }
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
    left.occurredAt === right.occurredAt
  );
}

function sameSettlement(
  left: CreditsSaleSettlement,
  right: CreditsSaleSettlement,
): boolean {
  return (
    sameEntry(left.buyerEntry, right.buyerEntry) &&
    sameEntry(left.creatorEntry, right.creatorEntry) &&
    sameShare(left.share, right.share)
  );
}

/**
 * Normalize a settlement and enforce the parts of its shape that belong to every
 * adapter: the two legs carry the sale's own reserved keys, and neither a
 * collected gross nor a creator's share is ever asserted without the entry that
 * moved it.
 *
 * The symmetric rule is the one that keeps a share record from asserting money
 * that never moved: a non-zero gross must be evidenced by the buyer's debit.
 * Without it a settlement could grant the creator half of a gross nobody paid,
 * minting credits into the plane.
 */
function snapshotSaleSettlement(candidate: unknown): CreditsSaleSettlement {
  const record = snapshotPlainRecord(candidate);
  if (
    record === undefined ||
    !Object.hasOwn(record, "share") ||
    Object.keys(record).some(
      (key) => key !== "buyerEntry" && key !== "creatorEntry" && key !== "share",
    )
  ) {
    return fail("a sale settlement must be a plain settlement object");
  }
  const share = snapshotShare(record["share"]);
  const keys = saleEntryKeys(share.saleId);
  const buyerEntry =
    record["buyerEntry"] === undefined
      ? undefined
      : snapshotEntry(record["buyerEntry"]);
  const creatorEntry =
    record["creatorEntry"] === undefined
      ? undefined
      : snapshotEntry(record["creatorEntry"]);

  if (buyerEntry !== undefined && buyerEntry.idempotencyKey !== keys.buyer) {
    return fail(`sale ${share.saleId} has an invalid buyer entry key`);
  }
  if (creatorEntry !== undefined && creatorEntry.idempotencyKey !== keys.creator) {
    return fail(`sale ${share.saleId} has an invalid creator entry key`);
  }
  if (creatorEntry === undefined && share.creatorCredits !== 0) {
    return fail(`sale ${share.saleId} is missing its creator entry`);
  }
  if (buyerEntry === undefined && share.grossCredits !== 0) {
    return fail(`sale ${share.saleId} is missing its buyer entry`);
  }

  return Object.freeze({
    ...(buyerEntry === undefined ? {} : { buyerEntry }),
    ...(creatorEntry === undefined ? {} : { creatorEntry }),
    share,
  });
}

/** An entry an adapter may append on its own — never a reserved sale leg. */
function assertAppendable(candidate: unknown): CreditLedgerEntry {
  const entry = snapshotEntry(candidate);
  if (isSaleEntryKey(entry.idempotencyKey)) {
    return fail(
      `sale entry ${entry.idempotencyKey} requires atomic settlement`,
    );
  }
  return entry;
}

/**
 * Hold an adapter to the append-or-replay contract.
 *
 * A replay answer is only trustworthy if it is a replay of *this* request, so the
 * committed entry is checked against the requested one on the semantic payload
 * the ledger's own idempotency rule compares. A fresh append must be exactly the
 * entry that was handed over: the sequence and the balance witness were computed
 * from the ledger the caller read, and an adapter that renumbered them silently
 * would break the derivation the next reader performs.
 *
 * The sequence and balance witness are required of a *replay* too, and for the
 * same reason. Both callers of this operation rebuild their reported state by
 * placing the committed entry after the history they read, so a row that landed
 * on a different ledger — the same key committed concurrently on top of entries
 * this request never saw — would be reported with a gapped history and a balance
 * that is not the ledger's. That divergence is refused here rather than
 * flattened into a wrong answer, so the caller re-reads and replays against what
 * is actually committed.
 */
function assertCommittedEntry(
  requested: CreditLedgerEntry,
  committed: unknown,
): CommittedEntry {
  const record = snapshotPlainRecord(committed);
  if (record === undefined || typeof record["replayed"] !== "boolean") {
    return fail(
      `append-or-replay of ${requested.idempotencyKey} returned no committed entry`,
    );
  }
  const entry = snapshotEntry(record["entry"]);
  const replayed = record["replayed"];
  if (
    entry.idempotencyKey !== requested.idempotencyKey ||
    entry.accountId !== requested.accountId ||
    entry.movement !== requested.movement ||
    entry.delta !== requested.delta ||
    entry.reason !== requested.reason
  ) {
    return fail(
      `append-or-replay of ${requested.idempotencyKey} answered with a different entry`,
    );
  }
  if (
    entry.sequence !== requested.sequence ||
    entry.balanceAfter !== requested.balanceAfter
  ) {
    return fail(
      replayed
        ? `append-or-replay of ${requested.idempotencyKey} replayed a row that does not extend the ledger this request read`
        : `append-or-replay of ${requested.idempotencyKey} claims a fresh append it did not make`,
    );
  }
  if (!replayed && !sameEntry(entry, requested)) {
    return fail(
      `append-or-replay of ${requested.idempotencyKey} claims a fresh append it did not make`,
    );
  }
  return Object.freeze({ entry, replayed });
}

/**
 * Hold an adapter to the settlement outcome contract.
 *
 * `persistCreditsSale` reports the adapter's answer as a public `replayed`
 * boolean, so an adapter answering with something else — or with nothing —
 * would put an unchecked value on a typed seam. Named here, it becomes a
 * contract breach the caller turns into `CREDIT_STORE_FAILED`.
 */
function assertSettlementOutcome(
  saleId: string,
  outcome: unknown,
): CreditsSaleSettlementOutcome {
  const record = snapshotPlainRecord(outcome);
  if (record === undefined || typeof record["replayed"] !== "boolean") {
    return fail(`settlement of sale ${saleId} returned no settlement outcome`);
  }
  return Object.freeze({ replayed: record["replayed"] });
}

function isPromise<Value>(value: Awaitable<Value>): value is Promise<Value> {
  return value instanceof Promise;
}

function mapAwaitable<In, Out>(
  value: Awaitable<In>,
  map: (resolved: In) => Out,
): Awaitable<Out> {
  return isPromise(value) ? value.then(map) : map(value);
}

/**
 * The shared persistence boundary. Every `CreditStore` in this plane is built
 * here, so the invariants below hold for an adapter that has never heard of
 * them:
 *
 * - **`sale:` keys are reserved.** `appendEntry` refuses one before the adapter
 *   is reached, so no adapter can append a single leg of a two-account sale;
 *   `settleCreditsSale` is the only way in, and it commits both legs and the
 *   share record together or not at all.
 * - **An append-or-replay must answer for what it was asked.** A replay is
 *   checked against the requested payload and against the ledger position it was
 *   asked for, and a fresh append against the whole entry, so "already
 *   committed" can never quietly mean somebody else's row or a row that landed
 *   on a ledger this request never read.
 * - **Settlement shape is checked once, and so is its answer.** A settlement's
 *   legs must carry that sale's own reserved keys, no collected gross or creator
 *   share may be booked without the entry that moved it, and the adapter's
 *   outcome must actually say whether it replayed.
 *
 * Guards run synchronously and throw, exactly as a database constraint rejects
 * before the write, so a refusal never depends on the adapter being awaited.
 */
export function createCreditStore(adapter: CreditStoreAdapter): CreditStore {
  return Object.freeze({
    findAccountByUserId: (userId) => adapter.findAccountByUserId(userId),
    findAccountById: (accountId) => adapter.findAccountById(accountId),
    listEntries: (accountId) => adapter.listEntries(accountId),
    appendEntry: (entry) => adapter.appendEntry(assertAppendable(entry)),
    appendOrReplayEntry(entry) {
      const requested = assertAppendable(entry);
      return mapAwaitable(adapter.appendOrReplayEntry(requested), (committed) =>
        assertCommittedEntry(requested, committed),
      );
    },
    settleCreditsSale(settlement) {
      const requested = snapshotSaleSettlement(settlement);
      return mapAwaitable(adapter.settleCreditsSale(requested), (outcome) =>
        assertSettlementOutcome(requested.share.saleId, outcome),
      );
    },
  });
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

  /**
   * Append, or hand back the row this key already committed.
   *
   * The uniqueness that makes this atomic is the same one the DDL enforces —
   * one row per `idempotency_key` — so the reconciliation happens against the
   * committed entry rather than against anything the caller remembers. A key
   * carrying different money is a conflict, mirroring the pure ledger's rule.
   */
  const appendOrReplay = (candidate: unknown): CommittedEntry => {
    const entry = snapshotEntry(candidate);
    const existing = entriesByIdempotencyKey.get(entry.idempotencyKey);
    if (existing !== undefined) {
      if (
        existing.accountId !== entry.accountId ||
        existing.movement !== entry.movement ||
        existing.delta !== entry.delta ||
        existing.reason !== entry.reason
      ) {
        throw new Error(
          `credit store: idempotency key ${entry.idempotencyKey} already applied with a different movement`,
        );
      }
      return Object.freeze({ entry: existing, replayed: true });
    }
    appendSnapshot(entry);
    return Object.freeze({ entry, replayed: false });
  };

  for (const candidate of options.entries ?? []) {
    appendSnapshot(snapshotEntry(candidate));
  }

  /**
   * The shape and key rules are the shared boundary's, so what is left here is
   * what only a store holding accounts can answer: that each leg moves the
   * credits its share record claims, out of the account belonging to the party
   * the record names.
   */
  const snapshotSettlement = (
    candidate: unknown,
  ): CreditsSaleSettlement => {
    const settlement = snapshotSaleSettlement(candidate);
    const { buyerEntry, creatorEntry, share } = settlement;

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

    return settlement;
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

  // Built through the shared boundary rather than beside it, so the reference
  // store is held to exactly the rules a Neon adapter will be.
  const adapter: CreditStoreAdapter = Object.freeze({
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
      appendSnapshot(snapshotEntry(entry));
    },
    appendOrReplayEntry(entry) {
      return appendOrReplay(entry);
    },
    settleCreditsSale(settlement) {
      return settle(settlement);
    },
  });

  return Object.freeze({
    ...createCreditStore(adapter),
    entryCount(accountId) {
      return listFor(accountId).length;
    },
    shareRecordCount() {
      return shareRecords.length;
    },
  });
}
