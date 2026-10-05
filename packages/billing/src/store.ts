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
  validateCreditReconciliationRecord,
  type BillingMode,
  type CreditReconciliationRecord,
  type CreatorShareRecord,
  type CreditAccount,
  type CreditLedgerEntry,
} from "@sceneaxi/schemas";
import type { Awaitable } from "@sceneaxi/auth";
import { snapshotHostedResponse } from "./hosted-response.js";

/**
 * The atomic result of a credits sale: the buyer debit, the creator grant (absent
 * when the floor split left the creator a zero share, which is never granted as a
 * zero-value row), and the share record. `CreditStore.settleCreditsSale` commits
 * all of it or none of it, so a failure on the creator side can never leave the
 * buyer charged without their 50% share — and a share record without the buyer's
 * debit is refused, so no settlement can book a gross that was never collected.
 */
/** Raw values admitted to the schema parsing boundary; no value is trusted until validated. */
export type StoreBoundaryValue = Parameters<typeof validateCreditLedgerEntry>[0];

function isText<Value>(value: Value): value is Value & string { return typeof value === "string"; }

function isBoolean<Value>(value: Value): value is Value & boolean { return typeof value === "boolean"; }


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

/**
 * The committed entry an append-or-replay answered *this* request with, or
 * `undefined` when it answered with anything else.
 *
 * `createCreditStore` already holds an adapter to this, but a caller holding a
 * `CreditStore` cannot prove the store it was handed was built there — the port
 * is a structural type, so a deployment that implements it directly reaches a
 * commit path unguarded. Shape alone is not enough there: an answer carrying a
 * schema-valid entry that is not the requested one would be reported as this
 * request's grant or debit. A commit therefore reads the answer through this,
 * inside the block that names a store failure, so an answer that does not
 * belong to the request is a commit the store could not confirm rather than a
 * foreign row reported as committed.
 *
 * It is `assertCommittedEntry`'s own comparison, so the guarded and unguarded
 * paths cannot drift apart.
 */
export function readCommittedEntry(
  requested: CreditLedgerEntry,
  candidate: StoreBoundaryValue,
): CommittedEntry | undefined {
  try {
    return assertCommittedEntry(requested, candidate);
  } catch {
    return undefined;
  }
}

export type CommittedReconciliation = Readonly<{
  record: CreditReconciliationRecord;
  replayed: boolean;
}>;

function snapshotReconciliation(candidate: StoreBoundaryValue): CreditReconciliationRecord {
  const parsed = validateCreditReconciliationRecord(candidate);

  if (!parsed.ok) return fail(parsed.message);

  return parsed.value;
}

export function readCommittedReconciliation(
  requested: CreditReconciliationRecord,
  candidate: StoreBoundaryValue,
): CommittedReconciliation | undefined {
  const answer = snapshotPlainRecord(candidate);

  if (answer === undefined || !isBoolean(answer["replayed"])) return undefined;
  const parsed = validateCreditReconciliationRecord(answer["record"]);

  if (!parsed.ok || JSON.stringify(parsed.value) !== JSON.stringify(snapshotReconciliation(requested))) return undefined;

  return Object.freeze({ record: parsed.value, replayed: answer["replayed"] });
}

export type ReconciliationQuery = Readonly<{
  userId: string;
  limit?: number;
  intentIds?: ReadonlyArray<string>;
  after?: Readonly<{ occurredAt: string; mode: BillingMode; eventId: string }>;
}>;

export function validateReconciliationQuery(query: ReconciliationQuery): ReconciliationQuery {
  const limit = query.limit ?? 100;

  if (!isText(query.userId) || query.userId.length === 0 || query.userId.length > 128 ||
    !Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
    (query.intentIds !== undefined && (query.intentIds.length > 50 || query.intentIds.some((id) => !isText(id) || id.length === 0 || id.length > 128))) ||
    (query.after !== undefined && (!Number.isFinite(Date.parse(query.after.occurredAt)) || !["test", "live"].includes(query.after.mode) || query.after.eventId.length === 0))) {
    return fail("invalid reconciliation page");
  }

  return Object.freeze({ ...query, limit });
}

export type HostedCallOperation = Readonly<{
  accountId: string; idempotencyKey: string; amount: number; reason: string;
  model: string; operation: string; now: number;
}>;

export type HostedCallReservation = Readonly<{
  status: "acquired" | "pending" | "response-ready" | "completed" | "insufficient" | "conflict";
  response?: unknown;
}>;

export type HostedCallStore = Readonly<{
  reserve(operation: HostedCallOperation): Awaitable<HostedCallReservation>;
  saveResponse(operation: HostedCallOperation, response: StoreBoundaryValue): Awaitable<void>;
  finish(operation: HostedCallOperation): Awaitable<void>;
  release(operation: HostedCallOperation): Awaitable<void>;
}>;

export type CreditStore = Readonly<{
  /** No expiry/re-execution for uncertain calls; a durable response can resume the debit. */
  hostedCalls?: HostedCallStore;
  findReconciliation(mode: BillingMode, eventId: string): Awaitable<CreditReconciliationRecord | undefined>;
  listReconciliations(query?: ReconciliationQuery): Awaitable<ReadonlyArray<CreditReconciliationRecord>>;
  listPurchaseEntries?(accountId: string, intentIds: ReadonlyArray<string>): Awaitable<ReadonlyArray<CreditLedgerEntry>>;
  appendOrReplayReconciliation(record: CreditReconciliationRecord): Awaitable<CommittedReconciliation>;
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
    hostedCalls: HostedCallStore;
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

function snapshotAccount(account: StoreBoundaryValue): CreditAccount {
  const validated = validateCreditAccount(account);

  if (!validated.ok) {
    return fail(`invalid account (${validated.code}): ${validated.message}`);
  }

  return validated.value;
}

function snapshotEntry(entry: StoreBoundaryValue): CreditLedgerEntry {
  const validated = validateCreditLedgerEntry(entry);

  if (!validated.ok) {
    return fail(`invalid entry (${validated.code}): ${validated.message}`);
  }

  return validated.value;
}

function snapshotShare(share: StoreBoundaryValue): CreatorShareRecord {
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
 * adapter: the two legs carry the sale's own reserved keys, neither a collected
 * gross nor a creator's share is ever asserted without the entry that moved it,
 * and each leg moves exactly the credits its share record claims.
 *
 * The symmetric rule is the one that keeps a share record from asserting money
 * that never moved: a non-zero gross must be evidenced by the buyer's debit.
 * Without it a settlement could grant the creator half of a gross nobody paid,
 * minting credits into the plane. A present leg that moves some *other* amount
 * mints the same way, and the comparison needs nothing but the settlement
 * itself, so it belongs here rather than in whichever adapter remembered it.
 */
function snapshotSaleSettlement(candidate: StoreBoundaryValue): CreditsSaleSettlement {
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

  if (
    buyerEntry !== undefined &&
    (buyerEntry.movement !== "debit" || buyerEntry.delta !== -share.grossCredits)
  ) {
    return fail(`sale ${share.saleId} has an invalid buyer entry`);
  }

  if (
    creatorEntry !== undefined &&
    (creatorEntry.movement !== "grant" ||
      creatorEntry.delta !== share.creatorCredits)
  ) {
    return fail(`sale ${share.saleId} has an invalid creator entry`);
  }

  const settlement: SaleSettlementDraft = { share };

  if (buyerEntry !== undefined) settlement.buyerEntry = buyerEntry;

  if (creatorEntry !== undefined) settlement.creatorEntry = creatorEntry;

  return Object.freeze(settlement);

}

/** An entry an adapter may append on its own — never a reserved sale leg. */
function assertAppendable(candidate: StoreBoundaryValue): CreditLedgerEntry {
  const entry = snapshotEntry(candidate);

  if (isSaleEntryKey(entry.idempotencyKey)) {
    return fail(
      `sale entry ${entry.idempotencyKey} requires atomic settlement`,
    );
  }

  if (entry.sequence === 1 && entry.balanceAfter !== entry.delta) {
    return fail("the first entry must derive its balance from zero");
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
  committed: StoreBoundaryValue,
): CommittedEntry {
  const record = snapshotPlainRecord(committed);

  if (record === undefined || !isBoolean(record["replayed"])) {
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
  outcome: StoreBoundaryValue,
): CreditsSaleSettlementOutcome {
  const record = snapshotPlainRecord(outcome);

  if (record === undefined || !isBoolean(record["replayed"])) {
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
 *   share may be booked without the entry that moved it, each present leg must
 *   move exactly the credits the share record claims, and the adapter's outcome
 *   must actually say whether it replayed.
 *
 * Guards run synchronously and throw, exactly as a database constraint rejects
 * before the write, so a refusal never depends on the adapter being awaited.
 */
export function createCreditStore(adapter: CreditStoreAdapter): CreditStore {
  const store: CreditStoreDraft = {
    findReconciliation(mode, eventId) {
      return mapAwaitable(adapter.findReconciliation(mode, eventId), (candidate) => {
        if (candidate === undefined) return undefined;
        const record = snapshotReconciliation(candidate);

        if (record.mode !== mode || record.eventId !== eventId) return fail("reconciliation lookup answered for a different event");

        return record;
      });
    },
    listReconciliations(query) {
      const scoped = query === undefined ? undefined : validateReconciliationQuery(query);

      return mapAwaitable(adapter.listReconciliations(scoped), (records) => {
        const snapshots = records.map(snapshotReconciliation);

        if (scoped !== undefined && (snapshots.length > (scoped.limit ?? 100) || snapshots.some((record) => record.userId !== scoped.userId || (scoped.intentIds !== undefined && !scoped.intentIds.includes(record.intentId))))) {
          return fail("reconciliation page exceeded its scope or limit");
        }

        return Object.freeze(snapshots);
      });
    },
    appendOrReplayReconciliation(record) {
      const requested = snapshotReconciliation(record);

      return mapAwaitable(adapter.appendOrReplayReconciliation(requested), (candidate) => {
        const committed = readCommittedReconciliation(requested, candidate);

        if (committed === undefined) return fail("reconciliation append returned no matching record");

        return committed;
      });
    },
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
  };

  if (adapter.hostedCalls !== undefined) {
    const hosted = adapter.hostedCalls;
    store.hostedCalls = Object.freeze({
      reserve(operation) {
        return mapAwaitable(hosted.reserve(operation), (candidate) => {
          const reservation = snapshotPlainRecord(candidate);
          const status = reservation?.["status"];
          if (status !== "acquired" && status !== "pending" && status !== "response-ready" && status !== "completed" && status !== "insufficient" && status !== "conflict") return fail("invalid hosted reservation outcome");
          if (status !== "response-ready") return Object.freeze({ status });
          const snapshot = snapshotHostedResponse(reservation?.["response"]);
          if (snapshot === undefined) return fail("hosted response is not bounded accessor-free JSON");
          return Object.freeze({ status, response: snapshot.value });
        });
      },
      saveResponse(operation, response) {
        const snapshot = snapshotHostedResponse(response);
        if (snapshot === undefined) return fail("hosted response is not bounded accessor-free JSON");
        return hosted.saveResponse(operation, snapshot.value);
      },
      finish: (operation) => hosted.finish(operation),
      release: (operation) => hosted.release(operation),
    });
  }

  if (adapter.listPurchaseEntries !== undefined) {

    store.listPurchaseEntries = function
      listPurchaseEntries(accountId: string, intentIds: ReadonlyArray<string>) {
        if (intentIds.length > 50 || intentIds.some((id) => !isText(id) || id.length === 0)) return fail("invalid purchase page");
        const listPurchaseEntries = adapter.listPurchaseEntries;

        if (listPurchaseEntries === undefined) return fail("purchase persistence is unavailable");

        return mapAwaitable(listPurchaseEntries.call(adapter, accountId, intentIds), (rows) => {
          const entries = rows.map(snapshotEntry);

          if (entries.length > 100 || entries.some((entry) => entry.accountId !== accountId || !intentIds.some((id) => entry.reason.split(";").some((segment) => segment.trim() === `intent:${id}`)))) return fail("purchase entries exceeded page scope");

          return Object.freeze(entries);
        });
      };
  }

  return Object.freeze(store);
}

/**
 * Reference store. `appendEntry` throws on any invariant violation rather than
 * returning a result, mirroring a database constraint: the caller's ledger logic
 * is supposed to have made this impossible, so reaching it is a defect.
 */
export function createInMemoryCreditStore(
  options: InMemoryCreditStoreOptions = {},
): InMemoryCreditStore {
  const hostedOperations = new Map<string, { operation: HostedCallOperation; status: "pending" | "response-ready" | "completed"; response?: unknown }>();

  const heldCredits = (accountId: string, ownKey?: string) => [...hostedOperations.values()]
    .filter((record) => record.operation.accountId === accountId && record.operation.idempotencyKey !== ownKey && record.status !== "completed")
    .reduce((sum, record) => sum + record.operation.amount, 0);

  const reconciliations = new Map<string, CreditReconciliationRecord>();
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

    if (expectedBalance < heldCredits(entry.accountId, entry.idempotencyKey)) fail("credits are reserved for another hosted operation");

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
  const appendOrReplay = (candidate: StoreBoundaryValue): CommittedEntry => {
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
   * The shape, key, and amount rules are the shared boundary's, so what is left
   * here is what only a store holding accounts can answer: that each leg moves
   * out of the account belonging to the party the share record names.
   */
  const snapshotSettlement = (
    candidate: StoreBoundaryValue,
  ): CreditsSaleSettlement => {
    const settlement = snapshotSaleSettlement(candidate);
    const { buyerEntry, creatorEntry, share } = settlement;

    if (
      buyerEntry !== undefined &&
      assertKnownAccount(buyerEntry).userId !== share.buyerUserId
    ) {
      return fail(`sale ${share.saleId} is not the buyer's own account`);
    }

    if (
      creatorEntry !== undefined &&
      assertKnownAccount(creatorEntry).userId !== share.creatorUserId
    ) {
      return fail(`sale ${share.saleId} is not the creator's own account`);
    }

    return settlement;
  };

  for (const candidate of options.shareRecords ?? []) {
    const share = snapshotShare(candidate);

    if (settlementsBySaleId.has(share.saleId)) {
      fail(`share sale id ${share.saleId} already recorded`);
    }

    const keys = saleEntryKeys(share.saleId);

    const settlement = snapshotSettlement({
      buyerEntry: entriesByIdempotencyKey.get(keys.buyer),
      creatorEntry: entriesByIdempotencyKey.get(keys.creator),
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
  const matchesHosted = (a: HostedCallOperation, b: HostedCallOperation) => a.accountId === b.accountId && a.idempotencyKey === b.idempotencyKey && a.amount === b.amount && a.reason === b.reason && a.model === b.model && a.operation === b.operation;

  const hostedCalls: HostedCallStore = Object.freeze({
    reserve(operation) {
      if (!accountsById.has(operation.accountId) || !Number.isSafeInteger(operation.amount) || operation.amount < 1) return fail("invalid hosted reservation");
      const held = hostedOperations.get(operation.idempotencyKey);

      if (held !== undefined) {
          if (!matchesHosted(held.operation, operation)) return { status: "conflict" };
          const reservation: HostedReservationDraft = { status: held.status };

          if (held.status === "response-ready") reservation.response = held.response;

          return Object.freeze(reservation);

        }

      const balance = listFor(operation.accountId).at(-1)?.balanceAfter ?? 0;


      if (balance - heldCredits(operation.accountId) < operation.amount) return { status: "insufficient" };
      hostedOperations.set(operation.idempotencyKey, { operation: Object.freeze({ ...operation }), status: "pending" });

      return { status: "acquired" };
    },
    saveResponse(operation, response) {
      const held = hostedOperations.get(operation.idempotencyKey);

      if (held === undefined || !matchesHosted(held.operation, operation) || held.status !== "pending") return fail("hosted response has no reservation");
      const snapshot = snapshotHostedResponse(response);

      if (snapshot === undefined) return fail("hosted response is not bounded accessor-free JSON");
      held.response = snapshot.value;
      held.status = "response-ready";
    },
    finish(operation) {
      const held = hostedOperations.get(operation.idempotencyKey);
      const debit = entriesByIdempotencyKey.get(operation.idempotencyKey);

      if (held === undefined || !matchesHosted(held.operation, operation) || debit?.accountId !== operation.accountId || debit.delta !== -operation.amount || debit.reason !== operation.reason) return fail("hosted completion has no matching debit");
      held.status = "completed";
    },
    release(operation) {
      const held = hostedOperations.get(operation.idempotencyKey);

      if (held === undefined || !matchesHosted(held.operation, operation) || held.status !== "pending" || entriesByIdempotencyKey.has(operation.idempotencyKey)) return fail("only a confirmed uncharged failure releases a reservation");
      hostedOperations.delete(operation.idempotencyKey);
    },
  });

  const adapter: CreditStoreAdapter = Object.freeze({
    hostedCalls,
    findReconciliation(mode, eventId) {
      return reconciliations.get(`${mode}:${eventId}`);
    },
    listReconciliations(query) {
      const rows = [...reconciliations.values()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.mode.localeCompare(b.mode) || a.eventId.localeCompare(b.eventId));

      if (query === undefined) return Object.freeze(rows);
      const scoped = validateReconciliationQuery(query);

      return Object.freeze(rows.filter((row) => row.userId === scoped.userId &&
        (scoped.intentIds === undefined || scoped.intentIds.includes(row.intentId)) &&
        (scoped.after === undefined || row.occurredAt > scoped.after.occurredAt || (row.occurredAt === scoped.after.occurredAt && (row.mode > scoped.after.mode || (row.mode === scoped.after.mode && row.eventId > scoped.after.eventId))))).slice(0, scoped.limit));
    },
    listPurchaseEntries(accountId, intentIds) {
      return Object.freeze(listFor(accountId).filter((entry) => intentIds.some((id) => entry.reason.split(";").some((segment) => segment.trim() === `intent:${id}`))).slice(0, 100));
    },
    appendOrReplayReconciliation(record) {
      const key = `${record.mode}:${record.eventId}`;
      const existing = reconciliations.get(key);

      if (existing !== undefined) return { record: existing, replayed: true };
      reconciliations.set(key, record);

      return { record, replayed: false };
    },
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
    hostedCalls,
    entryCount(accountId) {
      return listFor(accountId).length;
    },
    shareRecordCount() {
      return shareRecords.length;
    },
  });
}

type SaleSettlementDraft = { share: CreatorShareRecord; buyerEntry?: CreditLedgerEntry; creatorEntry?: CreditLedgerEntry };

type CreditStoreDraft = { -readonly [Key in keyof CreditStore]: CreditStore[Key] };

type HostedReservationDraft = { status: HostedCallReservation["status"]; response?: HostedCallReservation["response"] };
