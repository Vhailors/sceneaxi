/**
 * Deployment-owned provider adapters for the umbrella identity plane.
 *
 * The package contracts stay provider-neutral. This module is the only place the
 * deployable site knows how Neon rows, a Better Auth HTTP instance, and Stripe's
 * API map onto those contracts. It deliberately exposes a small query/client seam
 * so the default gate can mock every provider call without a database or network.
 */
import { createHash } from "node:crypto";
import {
  mapBetterAuthAuthentication,
  type Awaitable,
  type BetterAuthAuthentication,
  type BetterAuthInstanceLike,
  type IdentityAdapter,
  type IdentityStore,
} from "@sceneaxi/auth";
import {
  CHECKOUT_METADATA_KEYS,
  createCheckoutSessionIntent,
  createCreditStore,
  saleEntryKeys,
  type CheckoutSettlement,
  type CreditStore,
  type CreditStoreAdapter,
  type CreditsSaleSettlement,
} from "@sceneaxi/billing";

export { CHECKOUT_METADATA_KEYS };
export type { CheckoutSettlement, CreditStore };
export {
  BILLING_REFUSE_REASONS,
  checkoutPurposeGrantsCredits,
  checkoutPurposeSettlesElsewhere,
  loadLedgerState,
  parseCreditPackRefundEvent,
  parseCheckoutCompletedEvent,
  persistCreditPackRefund,
  persistCheckoutCompletedGrant,
  verifyStripeWebhookSignature,
} from "@sceneaxi/billing";

export type SqlRow = Readonly<Record<string, unknown>>;

type NeonRuntimeQuery = Readonly<{
  query(text: string, values?: ReadonlyArray<unknown>): Promise<ReadonlyArray<SqlRow>>;
  transaction(
    queries: ReadonlyArray<Promise<ReadonlyArray<SqlRow>>>,
  ): Promise<ReadonlyArray<ReadonlyArray<SqlRow>>>;
}>;

export type SqlStatement = Readonly<{
  readonly text: string;
  readonly values: ReadonlyArray<unknown>;
}>;

/** The mockable subset of a Neon HTTP client used by these adapters. */
export type NeonDatabase = Readonly<{
  query(
    text: string,
    values?: ReadonlyArray<unknown>,
  ): Promise<ReadonlyArray<SqlRow>>;
  /** Required for the two-ledger-leg + share commit. */
  transaction?(
    statements: ReadonlyArray<SqlStatement>,
  ): Promise<ReadonlyArray<ReadonlyArray<SqlRow>>>;
}>;

/** The provider-neutral intent type, kept on the billing package's public seam. */
type CheckoutIntent = Extract<
  ReturnType<typeof createCheckoutSessionIntent>,
  { readonly ok: true }
>["value"];

type StoredUser = NonNullable<
  Awaited<ReturnType<IdentityStore["findUserById"]>>
>;
type StoredSession = NonNullable<
  Awaited<ReturnType<IdentityStore["findSession"]>>
>;
type StoredAccount = NonNullable<
  Awaited<ReturnType<CreditStore["findAccountByUserId"]>>
>;
type StoredEntry = Awaited<
  ReturnType<CreditStore["listEntries"]>
>[number];
type StoredShare = CreditsSaleSettlement["share"];

function firstRow(rows: ReadonlyArray<SqlRow>): SqlRow | undefined {
  return rows[0];
}

function requiredString(row: SqlRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`provider row is missing string column ${key}`);
  }
  return value;
}

function requiredInteger(row: SqlRow, key: string): number {
  const value = row[key];
  const number =
    typeof value === "number"
      ? value
      : typeof value === "bigint"
        ? Number(value)
        : typeof value === "string"
          ? Number(value)
          : Number.NaN;
  if (!Number.isSafeInteger(number)) {
    throw new Error(`provider row is missing safe integer column ${key}`);
  }
  return number;
}

function checkoutPaymentStatus(
  value: string | null | undefined,
): CheckoutSettlement["paymentStatus"] | undefined {
  switch (value) {
    case "paid":
    case "unpaid":
    case "no_payment_required":
      return value;
    default:
      return undefined;
  }
}

function safeInteger(value: unknown): number | undefined {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "bigint"
        ? Number(value)
        : typeof value === "string"
          ? Number(value)
          : Number.NaN;
  return Number.isSafeInteger(number) ? number : undefined;
}

function optionalInteger(row: SqlRow, key: string): number | undefined {
  const value = row[key];
  if (value === null || value === undefined) return undefined;
  const number =
    typeof value === "number"
      ? value
      : typeof value === "bigint"
        ? Number(value)
        : typeof value === "string"
          ? Number(value)
          : Number.NaN;
  return Number.isSafeInteger(number) ? number : undefined;
}

function requiredBoolean(row: SqlRow, key: string): boolean {
  const value = row[key];
  if (typeof value !== "boolean") {
    throw new Error(`provider row is missing boolean column ${key}`);
  }
  return value;
}

function requiredDateTime(row: SqlRow, key: string): string {
  const value = row[key];
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : undefined;
  if (date === undefined || !Number.isFinite(date.getTime())) {
    throw new Error(`provider row is missing date-time column ${key}`);
  }
  return date.toISOString();
}

/**
 * Kids is refused on this path independently of `@sceneaxi/auth`.
 *
 * The `sessions` table's own CHECK constraint excludes `'kids'` for the same
 * reason, so a Kids surface can neither be written by this store nor mapped out
 * of a row it should never have held.
 */
function identitySurface(value: unknown): StoredSession["surface"] {
  switch (value) {
    case "web-shell":
    case "desktop-shell":
    case "site":
      return value;
    case "kids":
      throw new Error("umbrella identity provider denies the Kids surface");
    default:
      throw new Error("provider row contains an unknown identity surface");
  }
}

function ledgerMovement(value: unknown): StoredEntry["movement"] {
  switch (value) {
    case "grant":
    case "debit":
    case "adjustment":
      return value;
    default:
      throw new Error("provider row contains an unknown ledger movement");
  }
}

function checkoutPurpose(value: unknown): CheckoutIntent["purpose"] {
  switch (value) {
    case "credit-pack":
    case "catalog-listing":
      return value;
    default:
      throw new Error("provider row contains an unknown checkout purpose");
  }
}

function billingMode(value: unknown): CheckoutIntent["mode"] {
  switch (value) {
    case "test":
    case "live":
      return value;
    default:
      throw new Error("provider row contains an unknown billing mode");
  }
}

function userFromRow(row: SqlRow): StoredUser {
  return Object.freeze({
    schemaVersion: 1 as const,
    kind: "sceneaxi.user" as const,
    userId: requiredString(row, "user_id"),
    email: requiredString(row, "email").trim().toLowerCase(),
    emailVerified: requiredBoolean(row, "email_verified"),
    disabled: requiredBoolean(row, "disabled"),
    createdAt: requiredDateTime(row, "created_at"),
  });
}

function sessionFromRow(row: SqlRow): StoredSession {
  return Object.freeze({
    schemaVersion: 1 as const,
    kind: "sceneaxi.session" as const,
    sessionId: requiredString(row, "session_id"),
    userId: requiredString(row, "user_id"),
    surface: identitySurface(row["surface"]),
    issuedAt: requiredDateTime(row, "issued_at"),
    expiresAt: requiredDateTime(row, "expires_at"),
    tokenDigest: requiredString(row, "token_digest"),
  });
}

function accountFromRow(row: SqlRow): StoredAccount {
  return Object.freeze({
    schemaVersion: 1 as const,
    kind: "sceneaxi.credit-account" as const,
    accountId: requiredString(row, "account_id"),
    userId: requiredString(row, "user_id"),
    createdAt: requiredDateTime(row, "created_at"),
  });
}

function entryFromRow(row: SqlRow): StoredEntry {
  return Object.freeze({
    schemaVersion: 1 as const,
    kind: "sceneaxi.credit-ledger-entry" as const,
    entryId: requiredString(row, "entry_id"),
    accountId: requiredString(row, "account_id"),
    sequence: requiredInteger(row, "sequence"),
    movement: ledgerMovement(row["movement"]),
    delta: requiredInteger(row, "delta"),
    balanceAfter: requiredInteger(row, "balance_after"),
    reason: requiredString(row, "reason"),
    idempotencyKey: requiredString(row, "idempotency_key"),
    occurredAt: requiredDateTime(row, "occurred_at"),
  });
}

function shareFromRow(row: SqlRow): StoredShare {
  return Object.freeze({
    schemaVersion: 1 as const,
    kind: "sceneaxi.creator-share-record" as const,
    saleId: requiredString(row, "sale_id"),
    listingId: requiredString(row, "listing_id"),
    buyerUserId: requiredString(row, "buyer_user_id"),
    creatorUserId: requiredString(row, "creator_user_id"),
    grossCredits: requiredInteger(row, "gross_credits"),
    creatorCredits: requiredInteger(row, "creator_credits"),
    platformCredits: requiredInteger(row, "platform_credits"),
    basisPoints: requiredInteger(row, "basis_points"),
    occurredAt: requiredDateTime(row, "occurred_at"),
  });
}

const ENTRY_COLUMNS =
  "entry_id, account_id, sequence, movement, delta, balance_after, reason, idempotency_key, occurred_at";

const ACCOUNT_COLUMNS = "account_id, user_id, created_at";

const USER_COLUMNS = "user_id, email, email_verified, disabled, created_at";

const SESSION_COLUMNS =
  "session_id, user_id, surface, issued_at, expires_at, token_digest";

function accountIdFor(userId: string): string {
  return `acct_${createHash("sha256").update(userId, "utf8").digest("hex").slice(0, 32)}`;
}

/** Build a Neon HTTP client without making Neon a dependency of SceneAxi core. */
export function createNeonDatabase(
  connectionString: string,
  load: SiteModuleLoader = requireSiteModule,
): NeonDatabase {
  const neonFactory = moduleFunctionExport(load("@neondatabase/serverless"), [
    "neon",
    "default",
  ]);
  if (typeof neonFactory !== "function") throw new Error("Neon provider is unavailable");
  const sql = (neonFactory as (url: string) => NeonRuntimeQuery)(connectionString);
  const query = async (
    text: string,
    values: ReadonlyArray<unknown> = [],
  ): Promise<ReadonlyArray<SqlRow>> => {
    const rows = await sql.query(text, [...values]);
    return rows.map((row) => Object.freeze({ ...row }));
  };
  return Object.freeze({
    query,
    async transaction(statements) {
      const results = await sql.transaction(
        statements.map((statement) => sql.query(statement.text, [...statement.values])),
      );
      return results.map((rows) =>
        rows.map((row) => Object.freeze({ ...row })),
      );
    },
  });
}

export type NeonIdentityStore = IdentityStore &
  Readonly<{
    /** Called after provider authentication; both rows are idempotent. */
    ensureUserAndCreditAccount(
      authentication: BetterAuthAuthentication,
      now: number,
    ): Promise<void>;
  }>;

/**
 * Map the deployment's Neon rows onto the existing IdentityStore contract.
 * Provisioning is one CTE: the user and its one credit account become visible
 * together, and both inserts are `ON CONFLICT DO NOTHING`.
 */
export function createNeonIdentityStore(database: NeonDatabase): NeonIdentityStore {
  const findUser = async (where: string, value: string): Promise<StoredUser | undefined> => {
    const rows = await database.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE ${where} = $1 LIMIT 1`,
      [value],
    );
    const row = firstRow(rows);
    return row === undefined ? undefined : userFromRow(row);
  };

  return Object.freeze({
    async findUserByEmail(normalizedEmail) {
      return findUser("email", normalizedEmail.trim().toLowerCase());
    },
    async findUserById(userId) {
      return findUser("user_id", userId);
    },
    async putSession(session) {
      await database.query(
        `INSERT INTO sessions (${SESSION_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (session_id) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           surface = EXCLUDED.surface,
           issued_at = EXCLUDED.issued_at,
           expires_at = EXCLUDED.expires_at,
           token_digest = EXCLUDED.token_digest`,
        [
          session.sessionId,
          session.userId,
          identitySurface(session.surface),
          session.issuedAt,
          session.expiresAt,
          session.tokenDigest,
        ],
      );
    },
    async findSession(sessionId) {
      const rows = await database.query(
        `SELECT ${SESSION_COLUMNS} FROM sessions WHERE session_id = $1 LIMIT 1`,
        [sessionId],
      );
      const row = firstRow(rows);
      return row === undefined ? undefined : sessionFromRow(row);
    },
    async deleteSession(session) {
      const rows = await database.query(
        `DELETE FROM sessions
         WHERE session_id = $1 AND user_id = $2 AND surface = $3
           AND issued_at = $4 AND expires_at = $5 AND token_digest = $6
         RETURNING session_id`,
        [
          session.sessionId,
          session.userId,
          identitySurface(session.surface),
          session.issuedAt,
          session.expiresAt,
          session.tokenDigest,
        ],
      );
      return firstRow(rows) !== undefined;
    },
    async ensureUserAndCreditAccount(authentication, now) {
      const userId = authentication.user.id;
      const email = authentication.user.email.trim().toLowerCase();
      if (userId.length === 0 || email.length === 0) {
        throw new Error("identity provider returned an empty user identity");
      }
      const accountId = accountIdFor(userId);
      // The identity provider owns the address and its verification state, so both
      // columns are reconciled on every authentication rather than frozen at the
      // first one. `disabled` and `created_at` are deployment-owned and stay
      // untouched, and the credit account is still created at most once — its own
      // conflict target is `user_id`, and `DO UPDATE` makes `ensured_user` return
      // exactly one row on both the insert and the conflict path.
      await database.query(
        `WITH ensured_user AS (
           INSERT INTO users (${USER_COLUMNS})
           VALUES ($1, $2, $3, false, $4)
           ON CONFLICT (user_id) DO UPDATE
             SET email = EXCLUDED.email,
                 email_verified = EXCLUDED.email_verified
           RETURNING user_id
         )
         INSERT INTO credit_accounts (account_id, user_id, created_at)
         SELECT $5, user_id, $4 FROM ensured_user
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, email, authentication.user.emailVerified, new Date(now).toISOString(), accountId],
      );
    },
  });
}

/** Decorate Better Auth authentication with deployment-owned provisioning. */
export function createProvisioningIdentityAdapter(options: {
  readonly adapter: IdentityAdapter;
  provision(authentication: BetterAuthAuthentication): Awaitable<void>;
  readonly clock: () => number;
}): IdentityAdapter {
  return Object.freeze({
    async authenticate(credentials) {
      // Kids is denied by name here, not upstream: this adapter owns a
      // deployment write, so it refuses before the provider is even asked and
      // before any SceneAxi row can exist for a Kids surface.
      if (credentials.surface === "kids") {
        throw new Error("umbrella identity provider denies the Kids surface");
      }
      const authentication = await options.adapter.authenticate(credentials);
      if (authentication === undefined) return undefined;
      // Validate the provider envelope before it can create a SceneAxi row. The
      // identity port performs the same check again; this one protects the
      // deployment's provisioning side effect.
      const mapped = mapBetterAuthAuthentication({
        authentication,
        surface: credentials.surface,
        issuedAt: options.clock(),
      });
      if (mapped === undefined) return authentication;
      await options.provision(authentication);
      return authentication;
    },
  });
}

/** Raw provider shape used by the Stripe adapters and deterministic tests. */
export type StripeSession = Readonly<{
  readonly url?: string;
  readonly id?: string;
  readonly payment_status?: string | null;
  readonly amount_total?: number | null;
  readonly currency?: string | null;
  readonly line_items?: Readonly<{
    readonly data?: ReadonlyArray<Readonly<{
      readonly quantity?: number | null;
      readonly price?: string | Readonly<{ readonly id: string }> | null;
    }>>;
  }> | null;
}>;

export type StripeSessionCreateParams = Readonly<{
  readonly mode: "payment";
  readonly line_items: ReadonlyArray<Readonly<{ readonly price: string; readonly quantity: 1 }>>;
  readonly payment_method_types: ReadonlyArray<"card">;
  readonly success_url: string;
  readonly cancel_url: string;
  readonly client_reference_id: string;
  readonly metadata: Readonly<Record<string, string>>;
  readonly payment_intent_data: Readonly<{
    readonly metadata: Readonly<Record<string, string>>;
  }>;
}>;

export type StripeClientLike = Readonly<{
  readonly checkout: Readonly<{
    readonly sessions: Readonly<{
      create(
        params: StripeSessionCreateParams,
        options?: Readonly<{ readonly idempotencyKey?: string }>,
      ): Promise<StripeSession>;
      retrieve(
        id: string,
        params?: Readonly<{ readonly expand?: ReadonlyArray<string> }>,
      ): Promise<StripeSession>;
    }>;
  }>;
}>;

/**
 * Node's own `require`, reached through `process.getBuiltinModule` rather than an
 * imported `createRequire`.
 *
 * The import form is one webpack recognises and rewrites. Both provider
 * specifiers arrive through the injected `load` parameter below, so the bundler
 * can extract no dependency from `createRequire(import.meta.url)` and replaces it
 * with an empty context module that throws `MODULE_NOT_FOUND` for every
 * specifier. Both constructors would then fail on any production `next build`,
 * and `createDeploymentPlaneHandles` catches those failures into ordinary
 * provider absence — so a fully configured deployment would report exactly the
 * state an unconfigured one does. `process.getBuiltinModule` is opaque to the
 * bundler, which leaves the loader as Node's real `require` resolving the two
 * packages `next.config.ts` keeps external and traces into the deployed function.
 */
const requireSiteModule: SiteModuleLoader = process
  .getBuiltinModule("module")
  .createRequire(siteModuleAnchor());

/**
 * The file Node resolves the two provider specifiers relative to.
 *
 * The bundler inlines `import.meta.url` as this source file's build-time path,
 * which the deployed function does not have, so resolution would walk up a
 * directory tree that is not there. `__filename` is the emitted chunk's own
 * runtime path inside the deployed function, whose root is where the traced
 * `node_modules` lives; it is absent when this module runs unbundled as ESM
 * (the gate, `next dev`), where `import.meta.url` is the real path.
 */
function siteModuleAnchor(): string {
  return typeof __filename === "string" ? __filename : import.meta.url;
}

export function createStripeClient(
  secretKey: string,
  load: SiteModuleLoader = requireSiteModule,
): StripeClientLike {
  if (!secretKey.startsWith("sk_test_")) {
    throw new Error("umbrella Stripe adapter accepts TEST keys only");
  }
  const constructor = moduleFunctionExport(load("stripe"), ["default", "Stripe"]);
  if (typeof constructor !== "function") throw new Error("Stripe provider is unavailable");
  return new (constructor as new (key: string) => StripeClientLike)(secretKey);
}

/**
 * Identity- and price-equality between a persisted intent and the one a caller
 * just built for the same idempotency key.
 *
 * `createdAt` is excluded deliberately. `intentId` is derived from the
 * idempotency key alone, while `createdAt` is stamped from the clock at build
 * time, so a legitimate replay of one rendered checkout — a double-submitted
 * form, a resubmit after a failed provider call — carries the same identity and
 * the same price with a later timestamp. Comparing it would turn exactly the
 * retry the stable key exists to absorb into a hard persistence failure. The
 * database agrees: migration 0003 makes `credits`, `unit_amount`, `currency`,
 * and `stripe_price_id` immutable and leaves `created_at` operational.
 */
function sameIntent(left: CheckoutIntent, right: CheckoutIntent): boolean {
  return (
    left.schemaVersion === right.schemaVersion &&
    left.kind === right.kind &&
    left.intentId === right.intentId &&
    left.userId === right.userId &&
    left.purpose === right.purpose &&
    left.itemId === right.itemId &&
    left.credits === right.credits &&
    left.unitAmount === right.unitAmount &&
    left.currency === right.currency &&
    left.stripePriceId === right.stripePriceId &&
    left.mode === right.mode &&
    left.successUrl === right.successUrl &&
    left.cancelUrl === right.cancelUrl &&
    left.idempotencyKey === right.idempotencyKey
  );
}

function intentFromRow(row: SqlRow): CheckoutIntent {
  const purpose = checkoutPurpose(requiredString(row, "purpose"));
  const mode = billingMode(requiredString(row, "mode"));
  const credits = optionalInteger(row, "credits");
  const base = {
    schemaVersion: 1 as const,
    kind: "sceneaxi.checkout-session-intent" as const,
    intentId: requiredString(row, "intent_id"),
    userId: requiredString(row, "user_id"),
    purpose,
    itemId: requiredString(row, "item_id"),
    unitAmount: requiredInteger(row, "unit_amount"),
    currency: requiredString(row, "currency").trim().toLowerCase(),
    stripePriceId: requiredString(row, "stripe_price_id"),
    mode,
    successUrl: requiredString(row, "success_url"),
    cancelUrl: requiredString(row, "cancel_url"),
    idempotencyKey: requiredString(row, "idempotency_key"),
    createdAt: requiredDateTime(row, "created_at"),
  };
  if (purpose === "credit-pack") {
    if (credits === undefined) throw new Error("credit-pack intent row has no credits");
    return Object.freeze({ ...base, credits });
  }
  return Object.freeze(base);
}

function sameEntry(left: StoredEntry | undefined, right: StoredEntry | undefined): boolean {
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

function sameShare(left: StoredShare, right: StoredShare): boolean {
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

function statementForEntry(entry: StoredEntry): SqlStatement {
  return Object.freeze({
    text: `INSERT INTO credit_ledger_entries (${ENTRY_COLUMNS})
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    values: [
      entry.entryId,
      entry.accountId,
      entry.sequence,
      entry.movement,
      entry.delta,
      entry.balanceAfter,
      entry.reason,
      entry.idempotencyKey,
      entry.occurredAt,
    ],
  });
}

/** Raw Neon adapter. The returned adapter is wrapped immediately below. */
export function createNeonCreditStoreAdapter(
  database: NeonDatabase,
): CreditStoreAdapter {
  const findAccount = async (
    where: string,
    value: string,
  ): Promise<StoredAccount | undefined> => {
    const rows = await database.query(
      `SELECT ${ACCOUNT_COLUMNS} FROM credit_accounts WHERE ${where} = $1 LIMIT 1`,
      [value],
    );
    const row = firstRow(rows);
    return row === undefined ? undefined : accountFromRow(row);
  };

  const findEntryByKey = async (
    idempotencyKey: string,
  ): Promise<StoredEntry | undefined> => {
    const rows = await database.query(
      `SELECT ${ENTRY_COLUMNS} FROM credit_ledger_entries WHERE idempotency_key = $1 LIMIT 1`,
      [idempotencyKey],
    );
    const row = firstRow(rows);
    return row === undefined ? undefined : entryFromRow(row);
  };

  const findShare = async (saleId: string): Promise<StoredShare | undefined> => {
    const rows = await database.query(
      `SELECT sale_id, listing_id, buyer_user_id, creator_user_id, gross_credits,
              creator_credits, platform_credits, basis_points, occurred_at
       FROM creator_share_records WHERE sale_id = $1 LIMIT 1`,
      [saleId],
    );
    const row = firstRow(rows);
    return row === undefined ? undefined : shareFromRow(row);
  };

  return Object.freeze({
    async findAccountByUserId(userId) {
      return findAccount("user_id", userId);
    },
    async findAccountById(accountId) {
      return findAccount("account_id", accountId);
    },
    async listEntries(accountId) {
      const rows = await database.query(
        `SELECT ${ENTRY_COLUMNS}
         FROM credit_ledger_entries WHERE account_id = $1 ORDER BY sequence ASC`,
        [accountId],
      );
      return Object.freeze(rows.map(entryFromRow));
    },
    async appendEntry(entry) {
      await database.query(
        `INSERT INTO credit_ledger_entries (${ENTRY_COLUMNS})
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          entry.entryId,
          entry.accountId,
          entry.sequence,
          entry.movement,
          entry.delta,
          entry.balanceAfter,
          entry.reason,
          entry.idempotencyKey,
          entry.occurredAt,
        ],
      );
    },
    async appendOrReplayEntry(entry) {
      const inserted = await database.query(
        `INSERT INTO credit_ledger_entries (${ENTRY_COLUMNS})
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING ${ENTRY_COLUMNS}`,
        [
          entry.entryId,
          entry.accountId,
          entry.sequence,
          entry.movement,
          entry.delta,
          entry.balanceAfter,
          entry.reason,
          entry.idempotencyKey,
          entry.occurredAt,
        ],
      );
      const insertedRow = firstRow(inserted);
      if (insertedRow !== undefined) {
        return Object.freeze({ entry: entryFromRow(insertedRow), replayed: false });
      }
      const existing = await findEntryByKey(entry.idempotencyKey);
      if (existing === undefined) {
        throw new Error("credit entry conflict returned no committed row");
      }
      return Object.freeze({ entry: existing, replayed: true });
    },
    async settleCreditsSale(settlement) {
      const existing = await findShare(settlement.share.saleId);
      if (existing !== undefined) {
        const keys = saleEntryKeys(settlement.share.saleId);
        const held = Object.freeze({
          ...(settlement.buyerEntry === undefined
            ? {}
            : { buyerEntry: await findEntryByKey(keys.buyer) }),
          ...(settlement.creatorEntry === undefined
            ? {}
            : { creatorEntry: await findEntryByKey(keys.creator) }),
          share: existing,
        });
        if (
          sameShare(held.share, settlement.share) &&
          sameEntry(held.buyerEntry, settlement.buyerEntry) &&
          sameEntry(held.creatorEntry, settlement.creatorEntry)
        ) {
          return Object.freeze({ replayed: true });
        }
        throw new Error("credit sale already exists with different settlement evidence");
      }

      const accountChecks = [
        ...(settlement.buyerEntry === undefined ? [] : [settlement.buyerEntry]),
        ...(settlement.creatorEntry === undefined ? [] : [settlement.creatorEntry]),
      ];
      for (const entry of accountChecks) {
        const account = await findAccount("account_id", entry.accountId);
        const expectedUserId =
          entry === settlement.buyerEntry
            ? settlement.share.buyerUserId
            : settlement.share.creatorUserId;
        if (account === undefined || account.userId !== expectedUserId) {
          throw new Error("credit sale entry does not belong to its settlement party");
        }
      }

      if (database.transaction === undefined) {
        throw new Error("credit sale persistence requires a Neon transaction");
      }
      const statements: SqlStatement[] = [];
      if (settlement.buyerEntry !== undefined) {
        statements.push(statementForEntry(settlement.buyerEntry));
      }
      if (settlement.creatorEntry !== undefined) {
        statements.push(statementForEntry(settlement.creatorEntry));
      }
      statements.push({
        text: `INSERT INTO creator_share_records
               (sale_id, listing_id, buyer_user_id, creator_user_id, gross_credits,
                creator_credits, platform_credits, basis_points, occurred_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        values: [
          settlement.share.saleId,
          settlement.share.listingId,
          settlement.share.buyerUserId,
          settlement.share.creatorUserId,
          settlement.share.grossCredits,
          settlement.share.creatorCredits,
          settlement.share.platformCredits,
          settlement.share.basisPoints,
          settlement.share.occurredAt,
        ],
      });
      await database.transaction(statements);
      return Object.freeze({ replayed: false });
    },
  });
}

/** The only credit store constructor exposed to the deployment wiring. */
export function createNeonCreditStore(database: NeonDatabase): CreditStore {
  return createCreditStore(createNeonCreditStoreAdapter(database));
}

export type CheckoutIntentStore = Readonly<{
  persistIntent(intent: CheckoutIntent): Promise<CheckoutIntent>;
  findIntent(intentId: string): Promise<CheckoutIntent | undefined>;
}>;

export function createNeonCheckoutIntentStore(
  database: NeonDatabase,
): CheckoutIntentStore {
  const readIntent = async (intentId: string): Promise<CheckoutIntent | undefined> => {
    const rows = await database.query(
      `SELECT intent_id, user_id, purpose, item_id, credits, unit_amount, currency,
              stripe_price_id, mode, success_url, cancel_url, idempotency_key, created_at
       FROM checkout_session_intents WHERE intent_id = $1 LIMIT 1`,
      [intentId],
    );
    const row = firstRow(rows);
    return row === undefined ? undefined : intentFromRow(row);
  };

  return Object.freeze({
    async persistIntent(intent) {
      await database.query(
        `INSERT INTO checkout_session_intents
           (intent_id, user_id, purpose, item_id, credits, unit_amount, currency,
            stripe_price_id, mode, success_url, cancel_url, idempotency_key, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (intent_id) DO NOTHING`,
        [
          intent.intentId,
          intent.userId,
          intent.purpose,
          intent.itemId,
          intent.credits ?? null,
          intent.unitAmount,
          intent.currency,
          intent.stripePriceId,
          intent.mode,
          intent.successUrl,
          intent.cancelUrl,
          intent.idempotencyKey,
          intent.createdAt,
        ],
      );
      const held = await readIntent(intent.intentId);
      if (held === undefined || !sameIntent(held, intent)) {
        throw new Error("checkout intent conflict or persistence failure");
      }
      return held;
    },
    findIntent: readIntent,
  });
}

/**
 * The response headers this client reads.
 *
 * `getSetCookie()` is the only faithful reader of a multi-value `Set-Cookie`
 * answer, so it is preferred; `get()` is the fallback for a transport that does
 * not implement it. Both are optional, because a caller may inject a transport
 * that exposes no headers at all — that costs the cookie path, not the client.
 */
export type ProviderResponseHeaders = Readonly<{
  get(name: string): string | null;
  getSetCookie?(): ReadonlyArray<string>;
}>;

/** Better Auth's standard sign-in response, reached over an injected HTTP client. */
export type ProviderFetch = (
  input: string,
  init?: Readonly<RequestInit>,
) => Promise<Readonly<{
  readonly ok: boolean;
  readonly status: number;
  readonly headers?: ProviderResponseHeaders | undefined;
  json(): Promise<unknown>;
}> >;

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

/** Loader shape shared by the provider constructors, injectable for tests. */
export type SiteModuleLoader = (specifier: string) => unknown;

function moduleNamespaceOf(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "function") return value as unknown as Record<string, unknown>;
  return recordOf(value);
}

/**
 * Resolve a callable provider export across the shapes `require()` can return:
 * the callable itself (CommonJS `module.exports = fn`), an ES namespace holding
 * it, or a namespace nesting one inside the other. Resolving only `["default"]`
 * of an object namespace misses the CommonJS shape stripe-node actually ships,
 * and the miss is indistinguishable from an unconfigured deployment.
 */
function moduleFunctionExport(loaded: unknown, names: ReadonlyArray<string>): unknown {
  const seen = new Set<unknown>();
  let candidate = loaded;
  while (candidate !== undefined && candidate !== null && !seen.has(candidate)) {
    if (typeof candidate === "function") return candidate;
    seen.add(candidate);
    const namespace = moduleNamespaceOf(candidate);
    if (namespace === undefined) return undefined;
    candidate = names
      .map((name) => namespace[name])
      .find((value) => value !== undefined && value !== null);
  }
  return undefined;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Split a folded `Set-Cookie` header back into its values.
 *
 * A single joined header is ambiguous — an `Expires=Wed, 09 Jun 2027 …`
 * attribute contains the same separator — so the split only fires before a
 * `name=` that carries no whitespace, which no date attribute produces.
 */
const SET_COOKIE_SEPARATOR = /,\s*(?=[^\s;,=]+=)/;

/**
 * Rebuild the `Cookie` header a provider issued its session under.
 *
 * Stock Better Auth resolves `get-session` from the session cookie it just set;
 * only the `bearer()` plugin reads the token from an `Authorization` header. The
 * lookup therefore replays the issued cookie **and** sends the bearer token, so
 * neither provider configuration is a silent sign-in failure.
 */
function issuedCookieHeader(headers: ProviderResponseHeaders | undefined): string | undefined {
  if (headers === undefined) return undefined;
  const issued =
    typeof headers.getSetCookie === "function"
      ? [...headers.getSetCookie()]
      : (headers.get("set-cookie") ?? "").split(SET_COOKIE_SEPARATOR);
  const pairs = issued
    .map((value) => (value.split(";")[0] ?? "").trim())
    .filter((pair) => pair.length > 0 && pair.includes("="));
  return pairs.length === 0 ? undefined : pairs.join("; ");
}

/**
 * Create the small Better Auth instance shape consumed by @sceneaxi/auth. The
 * provider remains external; this site never stores a password or implements a
 * second credential verifier.
 *
 * Better Auth answers `POST /api/auth/sign-in/email` with `{ redirect, token,
 * user }` and no session record, so the session this boundary needs — its id,
 * owner, and expiry — is read back from `GET /api/auth/get-session`. That lookup
 * carries both credentials the provider may accept — the issued session cookie
 * and the issued token as a bearer header — because stock Better Auth reads the
 * cookie while the `bearer()` plugin reads the header, and neither choice is
 * observable from here. A provider that does return a session inline is used
 * as-is. No field is inferred from the other half of the answer: a provider that
 * does not state the session's id, owner, or expiry produces an envelope
 * `mapBetterAuthAuthentication` refuses, which is the intended fail-closed
 * outcome rather than a session attributed to a user the provider never named.
 * A lookup that accepts the request but names no session is a provider
 * configuration fault, not a rejected password, and is thrown as one so it
 * cannot be read as "wrong credentials".
 */
export function createBetterAuthHttpClient(options: {
  readonly origin: string;
  readonly fetch: ProviderFetch;
}): BetterAuthInstanceLike {
  const origin = new URL(options.origin).origin;

  async function readSessionRecord(
    token: string,
    cookie: string | undefined,
  ): Promise<
    Readonly<{
      readonly session: Record<string, unknown>;
      readonly user: Record<string, unknown> | undefined;
    }>
  > {
    const response = await options.fetch(`${origin}/api/auth/get-session`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(cookie === undefined ? {} : { cookie }),
      },
    });
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Better Auth session lookup denied after sign-in (${response.status})`);
    }
    if (!response.ok) {
      throw new Error(`Better Auth session lookup failed (${response.status})`);
    }
    const payload = recordOf(await response.json());
    const session = recordOf(payload?.["session"]);
    if (session === undefined) {
      throw new Error(
        "Better Auth session lookup named no session for the issued token; the provider must honour the issued session cookie or accept the token as a bearer credential",
      );
    }
    return Object.freeze({ session, user: recordOf(payload?.["user"]) });
  }

  return Object.freeze({
    api: Object.freeze({
      async signInEmail(input: { body: { email: string; password: string } }) {
        const { body } = input;
        const response = await options.fetch(`${origin}/api/auth/sign-in/email`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (response.status === 401 || response.status === 403) return undefined;
        if (!response.ok) throw new Error(`Better Auth sign-in failed (${response.status})`);
        const payload = recordOf(await response.json());
        let user = recordOf(payload?.["user"]);
        let providerSession = recordOf(payload?.["session"]);
        const issuedToken = stringValue(payload?.["token"]);

        if (providerSession === undefined) {
          if (issuedToken.length === 0) {
            throw new Error("Better Auth sign-in returned neither a session nor a token");
          }
          const resolved = await readSessionRecord(issuedToken, issuedCookieHeader(response.headers));
          providerSession = resolved.session;
          user = resolved.user ?? user;
        }

        return {
          user: {
            id: stringValue(user?.["id"]),
            email: stringValue(user?.["email"]),
            emailVerified: user?.["emailVerified"] === true,
          },
          session: {
            id: stringValue(providerSession?.["id"]),
            token: issuedToken || stringValue(providerSession?.["token"]),
            userId: stringValue(providerSession?.["userId"]),
            expiresAt: stringValue(providerSession?.["expiresAt"]),
          },
        };
      },
    }),
  });
}

export function createStripeCheckoutSessionAdapter(options: {
  readonly stripe: StripeClientLike;
  readonly intents: CheckoutIntentStore;
}): {
  createCheckoutSession(
    intent: CheckoutIntent,
  ): Promise<{ readonly redirectUrl: string }>;
} {
  return Object.freeze({
    async createCheckoutSession(intent) {
      // This adapter is deliberately TEST-only. The billing package remains the
      // authority for the named live refusal; this provider refuses a direct live
      // call too, so no deployment wiring can turn a key into a live charge.
      if (intent.mode !== "test") throw new Error("umbrella checkout adapter is test-only");
      const persisted = await options.intents.persistIntent(intent);
      const metadata = Object.freeze({
        [CHECKOUT_METADATA_KEYS.userId]: persisted.userId,
        [CHECKOUT_METADATA_KEYS.purpose]: persisted.purpose,
        [CHECKOUT_METADATA_KEYS.itemId]: persisted.itemId,
        [CHECKOUT_METADATA_KEYS.intentId]: persisted.intentId,
      });
      const session = await options.stripe.checkout.sessions.create(
        {
          mode: "payment",
          line_items: [{ price: persisted.stripePriceId, quantity: 1 }],
          payment_method_types: ["card"],
          success_url: persisted.successUrl,
          cancel_url: persisted.cancelUrl,
          client_reference_id: persisted.intentId,
          metadata,
          // Stripe copies this metadata onto the PaymentIntent and its Charge. A signed
          // `charge.refunded` event can therefore be rebound to this immutable intent
          // without trusting caller input or guessing which purchase was refunded.
          payment_intent_data: { metadata },
        },
        { idempotencyKey: persisted.idempotencyKey },
      );
      if (typeof session.url !== "string" || !session.url.startsWith("https://")) {
        throw new Error("Stripe returned no secure checkout URL");
      }
      return Object.freeze({ redirectUrl: session.url });
    },
  });
}

export function createStripeCheckoutEvidenceAdapter(options: {
  readonly stripe: StripeClientLike;
  readonly intents: CheckoutIntentStore;
}): Readonly<{
  findIntent(intentId: string): Promise<CheckoutIntent | undefined>;
  retrieveSettlement(
    sessionId: string,
  ): Promise<CheckoutSettlement | undefined>;
}> {
  return Object.freeze({
    findIntent: options.intents.findIntent,
    async retrieveSettlement(sessionId) {
      const session = await options.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["line_items.data.price"],
      });
      const line = session.line_items?.data?.[0];
      const price = line?.price;
      const stripePriceId =
        typeof price === "string"
          ? price
          : price === null || price === undefined
            ? undefined
            : price.id;
      const paymentStatus = checkoutPaymentStatus(session.payment_status);
      const amountTotal = safeInteger(session.amount_total);
      const currency = session.currency;
      const quantity = safeInteger(line?.quantity);
      if (
        paymentStatus === undefined ||
        amountTotal === undefined ||
        typeof currency !== "string" ||
        quantity === undefined ||
        typeof stripePriceId !== "string"
      ) {
        return undefined;
      }
      return Object.freeze({
        sessionId: typeof session.id === "string" ? session.id : "",
        paymentStatus,
        amountTotal,
        currency,
        quantity,
        stripePriceId,
      });
    },
  });
}

export type DeploymentProviderOverrides = Readonly<{
  readonly database?: NeonDatabase | undefined;
  readonly betterAuth?: BetterAuthInstanceLike | undefined;
  readonly stripe?: StripeClientLike | undefined;
  readonly fetch?: ProviderFetch | undefined;
}>;

/**
 * Loopback hosts, matched as whole hostnames.
 *
 * `URL.hostname` renders an IPv6 literal with its brackets, so both spellings
 * are listed rather than stripped.
 */
const LOOPBACK_AUTH_HOSTS: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
]);

/**
 * Resolve a remote auth origin without turning malformed config into a provider.
 *
 * Plaintext HTTP is accepted only for an exact loopback host: this client POSTs a
 * member's email and password to whatever origin resolves here, so a prefix match
 * would let `http://localhost.example` — a real remote host — collect them.
 */
export function resolveBetterAuthOrigin(value: string | undefined): string | undefined {
  if (value === undefined || value.trim().length === 0) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url.origin;
    if (url.protocol !== "http:") return undefined;
    return LOOPBACK_AUTH_HOSTS.has(url.hostname) ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

export function resolveNonEmptyEnv(
  env: Readonly<Record<string, string | undefined>>,
  key: string,
): string | undefined {
  const value = env[key]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
}

export function providerFetch(): ProviderFetch | undefined {
  return typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : undefined;
}
