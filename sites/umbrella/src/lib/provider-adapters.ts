/**
 * Deployment-owned provider adapters for the umbrella identity plane.
 *
 * The package contracts stay provider-neutral. This module is the only place the
 * deployable site knows how Neon rows, a Better Auth HTTP instance, and Stripe's
 * API map onto those contracts. It deliberately exposes a small query/client seam
 * so the default gate can mock every provider call without a database or network.
 */
import { createHash } from "node:crypto";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { isDeepStrictEqual } from "node:util";
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
  CONNECT_STORE_CONFLICT_CODE,
  createCheckoutSessionIntent,
  createCreditStore,
  snapshotHostedResponse,
  saleEntryKeys,
  validateCreditReconciliationRecord,
  validateReconciliationQuery,
  type PurchaseHistoryPage,
  type HostedCallStore,
  type CheckoutSettlement,
  type ConnectAccountRecord,
  type ConnectOnboardingIntent,
  type ConnectPayoutIntent,
  type ConnectPayoutOutcome,
  type ConnectStatusRecord,
  type ConnectStore,
  type CreditStore,
  type CreditStoreAdapter,
  type CreditsSaleSettlement,
  type LiveModeAuthorizationAudit,
  connectPayoutMatchesMoneySplit,
  validateConnectAccountRecord,
  validateConnectOnboardingIntent,
  validateConnectPayoutIntent,
  validateConnectPayoutOutcome,
  validateConnectStatusRecord,
  validateMoneySplitRecord,
} from "@sceneaxi/billing";

export { CHECKOUT_METADATA_KEYS };

export type { CheckoutSettlement, CreditStore };

export {
  BILLING_REFUSE_REASONS,
  checkoutPurposeGrantsCredits,
  checkoutPurposeSettlesElsewhere,
  loadLedgerState,
  persistCreditPackChargeEvent,
  parseCheckoutCompletedEvent,
  persistCheckoutCompletedGrant,
  verifyStripeWebhookSignature,
} from "@sceneaxi/billing";

/** PostgreSQL scalar, timestamp, array and JSON column values. */
export type SqlValue = string | number | bigint | boolean | null | undefined | Date | readonly SqlValue[] | { readonly [key: string]: SqlValue };

/** Raw SDK output is untrusted. Column decoders below construct domain values. */
type NeonRow = Awaited<ReturnType<NeonQueryFunction<false, false>>>[number];

// Preserve the SDK raw-output seam (including existing unknown-column clients).
// Never trust a column until requiredString/requiredInteger/etc. validate it.
export type SqlRow = Readonly<NeonRow>;

type SqlColumnInput = SqlRow[keyof SqlRow];

type ProviderJson = string | number | boolean | null | readonly ProviderJson[] | ProviderJsonObject;

type ProviderJsonObject = { readonly [key: string]: ProviderJson };

/** The two owned provider packages expose callable factories/constructors or nested namespaces. */
type ProviderModule = string | number | bigint | boolean | symbol | null | undefined | ProviderNamespace | ProviderCallable | ProviderConstructor;

type ProviderCallable = (...args: never[]) => void;

type ProviderConstructor = new (key: string) => StripeClientLike;

type ProviderExportName = "neon" | "default" | "Stripe";

type ProviderNamespace = { readonly [exportName: string]: ProviderModule };

function isString<Value>(value: Value): value is Value & string { return typeof value === "string"; }

function isNumber<Value>(value: Value): value is Value & number { return typeof value === "number"; }

function isBigInt<Value>(value: Value): value is Value & bigint { return typeof value === "bigint"; }

function isBoolean<Value>(value: Value): value is Value & boolean { return typeof value === "boolean"; }

function isObject<Value>(value: Value): value is Value & object { return typeof value === "object" && value !== null; }

function isCallable<Value>(value: Value): value is Value & ((...args: never[]) => object) { return isBoundaryCallableValue(value); }

function isJsonObject<Value>(value: Value): value is Value & ProviderJsonObject { return isBoundaryObjectValue(value) && value !== null; }

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

type HeldSettlement = { share: StoredShare; buyerEntry?: StoredEntry | undefined; creatorEntry?: StoredEntry | undefined };

type HostedReservation = { status: Awaited<ReturnType<HostedCallStore["reserve"]>>["status"]; response?: unknown };

type SessionHeaders = { authorization: string; "content-type": string; cookie?: string };

type StoredReconciliation = Parameters<CreditStore["appendOrReplayReconciliation"]>[0];

const RECONCILIATION_COLUMNS = "event_id, mode, intent_id, user_id, charge_id, event_type, reason, amount, currency, dispute_id, dispute_status, occurred_at, payload_digest";

function reconciliationFromRow(row: SqlRow): StoredReconciliation {
  const parsed = validateCreditReconciliationRecord({
    schemaVersion: 1,
    kind: "sceneaxi.credit-reconciliation-record",
    eventId: row["event_id"], mode: row["mode"], intentId: row["intent_id"], userId: row["user_id"],
    chargeId: row["charge_id"], eventType: row["event_type"], reason: row["reason"],
    amount: requiredInteger(row, "amount"), currency: row["currency"],
    disputeId: row["dispute_id"], disputeStatus: row["dispute_status"],
    occurredAt: requiredDateTime(row, "occurred_at"), payloadDigest: row["payload_digest"],
  });

  if (!parsed.ok) throw new Error(parsed.message);

  return parsed.value;
}

function firstRow(rows: ReadonlyArray<SqlRow>): SqlRow | undefined {
  return rows[0];
}

function requiredString(row: SqlRow, key: string): string {
  const value = row[key];

  if (!isString(value) || value.length === 0) {
    throw new Error(`provider row is missing string column ${key}`);
  }

  return value;
}

function requiredInteger(row: SqlRow, key: string): number {
  const value = row[key];

  const number =
    isNumber(value)
      ? value
      : isBigInt(value)
        ? Number(value)
        : isString(value)
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

function safeInteger(value: SqlColumnInput): number | undefined {
  const number =
    isNumber(value)
      ? value
      : isBigInt(value)
        ? Number(value)
        : isString(value)
          ? Number(value)
          : Number.NaN;

  return Number.isSafeInteger(number) ? number : undefined;
}

function optionalInteger(row: SqlRow, key: string): number | undefined {
  const value = row[key];

  if (value === null || value === undefined) return undefined;

  const number =
    isNumber(value)
      ? value
      : isBigInt(value)
        ? Number(value)
        : isString(value)
          ? Number(value)
          : Number.NaN;

  return Number.isSafeInteger(number) ? number : undefined;
}

function requiredBoolean(row: SqlRow, key: string): boolean {
  const value = row[key];

  if (!isBoolean(value)) {
    throw new Error(`provider row is missing boolean column ${key}`);
  }

  return value;
}

function requiredDateTime(row: SqlRow, key: string): string {
  const value = row[key];
  const date = value instanceof Date ? value : isString(value) ? new Date(value) : undefined;

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
function identitySurface(value: SqlColumnInput): StoredSession["surface"] {
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

function ledgerMovement(value: SqlColumnInput): StoredEntry["movement"] {
  switch (value) {
    case "grant":
    case "debit":
    case "adjustment":
      return value;
    default:
      throw new Error("provider row contains an unknown ledger movement");
  }
}

function checkoutPurpose(value: SqlColumnInput): CheckoutIntent["purpose"] {
  switch (value) {
    case "credit-pack":
    case "catalog-listing":
      return value;
    default:
      throw new Error("provider row contains an unknown checkout purpose");
  }
}

function billingMode(value: SqlColumnInput): CheckoutIntent["mode"] {
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

  if (!isCallable(neonFactory)) throw new Error("Neon provider is unavailable");
  // SAFETY: callable export is resolved from trusted @neondatabase/serverless, whose neon factory accepts a connection URL.
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

export type StripeCharge = Readonly<{
  id: string;
  amount: number;
  currency: string;
  livemode: boolean;
  metadata: Readonly<Record<string, string>>;
}>;

export type StripeClientLike = Readonly<{
  readonly charges?: Readonly<{ retrieve(id: string): Promise<StripeCharge> }>;
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
/** A candidate is an anchor only when it matches Node's selected CJS/ESM resolution source. */
function isResolutionAnchor<Value>(value: Value): value is Value & string {
  return value === (typeof __filename !== "undefined" ? __filename : import.meta.url);
}

function siteModuleAnchor(): string {
  const moduleUrl = import.meta.url;

  // In ESM this candidate is always the anchor; a differing CJS anchor proves __filename exists.
  return isResolutionAnchor(moduleUrl) ? moduleUrl : __filename;
}

export function createStripeClient(
  secretKey: string,
  load: SiteModuleLoader = requireSiteModule,
): StripeClientLike {
  if (!secretKey.startsWith("sk_test_")) {
    throw new Error("umbrella Stripe adapter accepts TEST keys only");
  }

  const constructor = moduleFunctionExport(load("stripe"), ["default", "Stripe"]);

  if (!isCallable(constructor)) throw new Error("Stripe provider is unavailable");

  // SAFETY: callable export comes from trusted stripe; its default/Stripe export is the client constructor.
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

  const findReconciliation: CreditStore["findReconciliation"] = async (mode, eventId) => {
    const row = firstRow(await database.query(
      `SELECT ${RECONCILIATION_COLUMNS} FROM credit_reconciliation_records WHERE mode = $1 AND event_id = $2 LIMIT 1`,
      [mode, eventId],
    ));

    return row === undefined ? undefined : reconciliationFromRow(row);
  };

  return Object.freeze({
    hostedCalls: createNeonHostedCallStore(database),
    findReconciliation,
    async listReconciliations(query) {
      const scoped = query === undefined ? undefined : validateReconciliationQuery(query);

      const rows = scoped === undefined
        ? await database.query(`SELECT ${RECONCILIATION_COLUMNS} FROM credit_reconciliation_records ORDER BY occurred_at, mode, event_id`)
        : await database.query(`SELECT ${RECONCILIATION_COLUMNS} FROM credit_reconciliation_records
            WHERE user_id = $1 AND ($2::text[] IS NULL OR intent_id = ANY($2::text[]))
              AND ($3::timestamptz IS NULL OR (occurred_at, mode, event_id) > ($3::timestamptz, $4::text, $5::text))
            ORDER BY occurred_at, mode, event_id LIMIT $6`,
          [scoped.userId, scoped.intentIds ?? null, scoped.after?.occurredAt ?? null, scoped.after?.mode ?? null, scoped.after?.eventId ?? null, scoped.limit]);

      return Object.freeze(rows.map(reconciliationFromRow));
    },
    async listPurchaseEntries(accountId, intentIds) {
      if (intentIds.length > 50) throw new Error("invalid purchase page");

      const rows = await database.query(`SELECT ${ENTRY_COLUMNS} FROM credit_ledger_entries
        WHERE account_id = $1 AND EXISTS (SELECT 1 FROM unnest(string_to_array(reason, ';')) AS anchor
          WHERE btrim(anchor) = ANY($2::text[])) ORDER BY sequence LIMIT 100`,
        [accountId, intentIds.map((id) => `intent:${id}`)]);

      return Object.freeze(rows.map(entryFromRow));
    },
    async appendOrReplayReconciliation(record) {
      const row = firstRow(await database.query(
        `INSERT INTO credit_reconciliation_records (${RECONCILIATION_COLUMNS})
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (mode, event_id) DO NOTHING RETURNING ${RECONCILIATION_COLUMNS}`,
        [record.eventId, record.mode, record.intentId, record.userId, record.chargeId, record.eventType, record.reason, record.amount, record.currency, record.disputeId, record.disputeStatus, record.occurredAt, record.payloadDigest],
      ));

      if (row !== undefined) return { record: reconciliationFromRow(row), replayed: false };
      const held = await findReconciliation(record.mode, record.eventId);

      if (held === undefined) throw new Error("Reconciliation conflict returned no committed record");

      return { record: held, replayed: true };
    },
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

        const held: HeldSettlement = { share: existing };

        if (settlement.buyerEntry !== undefined) held.buyerEntry = await findEntryByKey(keys.buyer);

        if (settlement.creatorEntry !== undefined) held.creatorEntry = await findEntryByKey(keys.creator);
        Object.freeze(held);

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

/** Durable reservation/result state. Missing migration or uncertain state refuses,
 * never a process-local fallback or expired-lease provider retry. */
export function createNeonHostedCallStore(database: NeonDatabase): HostedCallStore {
  const values = (operation: Parameters<HostedCallStore["reserve"]>[0]) => [operation.accountId, operation.idempotencyKey, operation.amount, operation.reason, operation.model, operation.operation];

  return Object.freeze({
    async reserve(operation) {
      const row = firstRow(await database.query(
        "SELECT * FROM sceneaxi_reserve_hosted_call($1, $2, $3, $4, $5, $6, $7::timestamptz)",
        [...values(operation), new Date(operation.now).toISOString()],
      ));

      const status = row?.["status"];

      if (status !== "acquired" && status !== "pending" && status !== "response-ready" && status !== "completed" && status !== "insufficient" && status !== "conflict") throw new Error("invalid hosted reservation outcome");

      const outcome: HostedReservation = { status };

      if (status === "response-ready") {
        const snapshot = snapshotHostedResponse(row?.["response"]);

        if (snapshot === undefined) throw new Error("hosted response is not bounded JSON");
        outcome.response = snapshot.value;
      }

      return Object.freeze(outcome);
    },
    async saveResponse(operation, response) {
      const snapshot = snapshotHostedResponse(response);

      if (snapshot === undefined) throw new Error("hosted response is not bounded JSON");
      const json = snapshot.json;

      const rows = await database.query(`UPDATE hosted_model_operations SET status = 'response-ready', response = $7::jsonb
        WHERE account_id = $1 AND idempotency_key = $2 AND amount = $3 AND reason = $4 AND model = $5 AND operation = $6 AND status = 'pending' RETURNING idempotency_key`, [...values(operation), json]);

      if (rows.length !== 1) throw new Error("hosted response persistence unconfirmed");
    },
    async finish(operation) {
      const rows = await database.query(`UPDATE hosted_model_operations SET status = 'completed'
        WHERE account_id = $1 AND idempotency_key = $2 AND amount = $3 AND reason = $4 AND model = $5 AND operation = $6
          AND status IN ('response-ready', 'completed')
          AND EXISTS (SELECT 1 FROM credit_ledger_entries WHERE account_id = $1 AND idempotency_key = $2 AND delta = -$3 AND reason = $4 AND movement = 'debit') RETURNING idempotency_key`, values(operation));

      if (rows.length !== 1) throw new Error("hosted completion has no confirmed debit");
    },
    async release(operation) {
      const rows = await database.query(`DELETE FROM hosted_model_operations
        WHERE account_id = $1 AND idempotency_key = $2 AND amount = $3 AND reason = $4 AND model = $5 AND operation = $6 AND status = 'pending'
          AND NOT EXISTS (SELECT 1 FROM credit_ledger_entries WHERE idempotency_key = $2) RETURNING idempotency_key`, values(operation));

      if (rows.length !== 1) throw new Error("only a confirmed uncharged failure releases a reservation");
    },
  });
}

/** The only credit store constructor exposed to the deployment wiring. */
export function createNeonCreditStore(database: NeonDatabase): CreditStore {
  return createCreditStore(createNeonCreditStoreAdapter(database));
}

const CONNECT_ACCOUNT_COLUMNS =
  "creator_user_id, stripe_account_id, mode, provider_request_id, created_at";

const CONNECT_ONBOARDING_COLUMNS =
  "onboarding_intent_id, creator_user_id, stripe_account_id, expires_at, mode, idempotency_key, provider_request_id, created_at";

const CONNECT_STATUS_COLUMNS =
  "status_id, creator_user_id, stripe_account_id, onboarding_complete, payouts_enabled, requirements_due, provider_request_id, observed_at";

const CONNECT_PAYOUT_COLUMNS =
  "payout_intent_id, sale_id, creator_user_id, stripe_account_id, gross_minor, creator_minor, platform_minor, currency, basis_points, mode, idempotency_key, requested_at";

const CONNECT_OUTCOME_COLUMNS =
  "payout_outcome_id, payout_intent_id, status, provider_payout_id, provider_evidence_id, provider_message, observed_at";

const validatedRecord = <Value>(
  candidate: SqlRow,
  validate: (value: SqlRow) =>
    | Readonly<{ ok: true; value: Value }>
    | Readonly<{ ok: false }>,
  label: string,
): Value => {
  const result = validate(candidate);

  if (!result.ok) throw new Error(`invalid persisted ${label}`);

  return result.value;
};

const accountFromConnectRow = (row: SqlRow): ConnectAccountRecord =>
  validatedRecord({
    schemaVersion: 1,
    kind: "sceneaxi.connect-account-record",
    creatorUserId: requiredString(row, "creator_user_id"),
    stripeAccountId: requiredString(row, "stripe_account_id"),
    mode: requiredString(row, "mode"),
    providerRequestId: requiredString(row, "provider_request_id"),
    createdAt: requiredDateTime(row, "created_at"),
  }, validateConnectAccountRecord, "Connect account");

const onboardingFromConnectRow = (row: SqlRow): ConnectOnboardingIntent =>
  validatedRecord({
    schemaVersion: 1,
    kind: "sceneaxi.connect-onboarding-intent",
    onboardingIntentId: requiredString(row, "onboarding_intent_id"),
    creatorUserId: requiredString(row, "creator_user_id"),
    stripeAccountId: requiredString(row, "stripe_account_id"),
    expiresAt: requiredDateTime(row, "expires_at"),
    mode: requiredString(row, "mode"),
    idempotencyKey: requiredString(row, "idempotency_key"),
    providerRequestId: requiredString(row, "provider_request_id"),
    createdAt: requiredDateTime(row, "created_at"),
  }, validateConnectOnboardingIntent, "Connect onboarding intent");

const statusFromConnectRow = (row: SqlRow): ConnectStatusRecord =>
  validatedRecord({
    schemaVersion: 1,
    kind: "sceneaxi.connect-status-record",
    statusId: requiredString(row, "status_id"),
    creatorUserId: requiredString(row, "creator_user_id"),
    stripeAccountId: requiredString(row, "stripe_account_id"),
    onboardingComplete: row["onboarding_complete"],
    payoutsEnabled: row["payouts_enabled"],
    requirementsDue: row["requirements_due"],
    providerRequestId: requiredString(row, "provider_request_id"),
    observedAt: requiredDateTime(row, "observed_at"),
  }, validateConnectStatusRecord, "Connect status");

const payoutIntentFromConnectRow = (row: SqlRow): ConnectPayoutIntent =>
  validatedRecord({
    schemaVersion: 1,
    kind: "sceneaxi.connect-payout-intent",
    payoutIntentId: requiredString(row, "payout_intent_id"),
    saleId: requiredString(row, "sale_id"),
    creatorUserId: requiredString(row, "creator_user_id"),
    stripeAccountId: requiredString(row, "stripe_account_id"),
    grossMinor: requiredInteger(row, "gross_minor"),
    creatorMinor: requiredInteger(row, "creator_minor"),
    platformMinor: requiredInteger(row, "platform_minor"),
    currency: requiredString(row, "currency").trim(),
    basisPoints: requiredInteger(row, "basis_points"),
    mode: requiredString(row, "mode"),
    idempotencyKey: requiredString(row, "idempotency_key"),
    requestedAt: requiredDateTime(row, "requested_at"),
  }, validateConnectPayoutIntent, "Connect payout intent");

const payoutOutcomeFromConnectRow = (row: SqlRow): ConnectPayoutOutcome =>
  validatedRecord({
    schemaVersion: 1,
    kind: "sceneaxi.connect-payout-outcome",
    payoutOutcomeId: requiredString(row, "payout_outcome_id"),
    payoutIntentId: requiredString(row, "payout_intent_id"),
    status: requiredString(row, "status"),
    providerPayoutId: row["provider_payout_id"],
    providerEvidenceId: requiredString(row, "provider_evidence_id"),
    providerMessage: requiredString(row, "provider_message"),
    observedAt: requiredDateTime(row, "observed_at"),
  }, validateConnectPayoutOutcome, "Connect payout outcome");

const samePersisted = isDeepStrictEqual;

/** Durable ConnectStore over the migration-owned append-only tables. */
export function createNeonConnectStore(database: NeonDatabase): ConnectStore {
  const one = async <Value>(
    text: string,
    values: ReadonlyArray<unknown>,
    map: (row: SqlRow) => Value,
  ): Promise<Value | undefined> => {
    const row = firstRow(await database.query(text, values));

    return row === undefined ? undefined : map(row);
  };

  const conflict = (): never => {
    throw Object.assign(new Error("connect store: idempotency conflict"), {
      code: CONNECT_STORE_CONFLICT_CODE,
    });
  };

  const transact = async (statements: ReadonlyArray<SqlStatement>) => {
    if (database.transaction === undefined) throw new Error("Connect persistence requires a Neon transaction");

    try {
      return await database.transaction(statements);
    } catch (error) {
      if (isObject(error) && "code" in error && error.code === "23505") conflict();
      throw error;
    }
  };

  const readOnboarding = (key: string) => one(
    `SELECT ${CONNECT_ONBOARDING_COLUMNS} FROM stripe_connect_onboarding_intents WHERE idempotency_key = $1 LIMIT 1`,
    [key], onboardingFromConnectRow,
  );

  const readAccount = (creator: string) => one(
    `SELECT ${CONNECT_ACCOUNT_COLUMNS} FROM stripe_connect_accounts WHERE creator_user_id = $1 LIMIT 1`,
    [creator], accountFromConnectRow,
  );

  const readPayoutIntent = (key: string) => one(
    `SELECT ${CONNECT_PAYOUT_COLUMNS} FROM stripe_connect_payout_intents WHERE idempotency_key = $1 LIMIT 1`,
    [key], payoutIntentFromConnectRow,
  );

  const readSplit = (saleId: string) => one(
    `SELECT sale_id, listing_id, buyer_user_id, creator_user_id, gross_minor, creator_minor, platform_minor, currency, basis_points, mode, occurred_at FROM money_split_records WHERE sale_id = $1 LIMIT 1`,
    [saleId], (row) => validatedRecord({
      schemaVersion: 1,
      kind: "sceneaxi.money-split-record",
      saleId: requiredString(row, "sale_id"),
      listingId: requiredString(row, "listing_id"),
      buyerUserId: requiredString(row, "buyer_user_id"),
      creatorUserId: requiredString(row, "creator_user_id"),
      grossMinor: requiredInteger(row, "gross_minor"),
      creatorMinor: requiredInteger(row, "creator_minor"),
      platformMinor: requiredInteger(row, "platform_minor"),
      currency: requiredString(row, "currency").trim(),
      basisPoints: requiredInteger(row, "basis_points"),
      mode: requiredString(row, "mode"),
      occurredAt: requiredDateTime(row, "occurred_at"),
    }, validateMoneySplitRecord, "money split"),
  );

  return Object.freeze({
    findAccountByCreatorUserId: readAccount,
    findOnboardingIntent: readOnboarding,
    async commitOnboarding({ account, intent }) {
      const validAccount = validatedRecord(account, validateConnectAccountRecord, "Connect account");
      const validIntent = validatedRecord(intent, validateConnectOnboardingIntent, "Connect onboarding intent");

      if (validAccount.creatorUserId !== validIntent.creatorUserId || validAccount.stripeAccountId !== validIntent.stripeAccountId || validAccount.mode !== validIntent.mode) throw new Error("connect store: onboarding account does not match intent");

      const inserted = await transact([
        { text: `INSERT INTO stripe_connect_accounts (${CONNECT_ACCOUNT_COLUMNS}) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`, values: [validAccount.creatorUserId, validAccount.stripeAccountId, validAccount.mode, validAccount.providerRequestId, validAccount.createdAt] },
        { text: `INSERT INTO stripe_connect_onboarding_intents (${CONNECT_ONBOARDING_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING RETURNING onboarding_intent_id`, values: [validIntent.onboardingIntentId, validIntent.creatorUserId, validIntent.stripeAccountId, validIntent.expiresAt, validIntent.mode, validIntent.idempotencyKey, validIntent.providerRequestId, validIntent.createdAt] },
      ]);

      const [heldAccount, heldIntent] = await Promise.all([readAccount(validAccount.creatorUserId), readOnboarding(validIntent.idempotencyKey)]);

      if (heldAccount === undefined || heldIntent === undefined) return conflict();

      if (heldAccount.stripeAccountId !== validAccount.stripeAccountId || heldAccount.mode !== validAccount.mode || !samePersisted(heldIntent, validIntent)) conflict();

      return Object.freeze({ account: heldAccount, intent: heldIntent, replayed: (inserted[1]?.length ?? 0) === 0 });
    },
    async appendStatus(candidate) {
      const status = validatedRecord(candidate, validateConnectStatusRecord, "Connect status");
      const inserted = await database.query(`INSERT INTO stripe_connect_status_records (${CONNECT_STATUS_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (status_id) DO NOTHING RETURNING ${CONNECT_STATUS_COLUMNS}`, [status.statusId, status.creatorUserId, status.stripeAccountId, status.onboardingComplete, status.payoutsEnabled, status.requirementsDue, status.providerRequestId, status.observedAt]);
      const insertedRow = firstRow(inserted);

      const held = insertedRow === undefined
        ? await one(`SELECT ${CONNECT_STATUS_COLUMNS} FROM stripe_connect_status_records WHERE status_id = $1`, [status.statusId], statusFromConnectRow)
        : statusFromConnectRow(insertedRow);

      if (held === undefined) throw new Error("connect store: status insert returned no row");

      if (!samePersisted(held, status)) conflict();

      return Object.freeze({ record: held, replayed: insertedRow === undefined });
    },
    latestStatus: (accountId) => one(`SELECT ${CONNECT_STATUS_COLUMNS} FROM stripe_connect_status_records WHERE stripe_account_id = $1 ORDER BY observed_at DESC LIMIT 1`, [accountId], statusFromConnectRow),
    findPayoutIntent: readPayoutIntent,
    async findPayoutOutcome(intentId) {
      return one(`SELECT ${CONNECT_OUTCOME_COLUMNS} FROM stripe_connect_payout_outcomes WHERE payout_intent_id = $1 LIMIT 1`, [intentId], payoutOutcomeFromConnectRow);
    },
    async commitPayoutIntent({ split: candidateSplit, intent: candidateIntent }) {
      const split = validatedRecord(candidateSplit, validateMoneySplitRecord, "money split");
      const intent = validatedRecord(candidateIntent, validateConnectPayoutIntent, "Connect payout intent");

      if (!connectPayoutMatchesMoneySplit(intent, split)) throw new Error("connect store: payout intent does not match money split");

      const inserted = await transact([
        { text: `INSERT INTO money_split_records (sale_id, listing_id, buyer_user_id, creator_user_id, gross_minor, creator_minor, platform_minor, currency, basis_points, mode, occurred_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT DO NOTHING`, values: [split.saleId, split.listingId, split.buyerUserId, split.creatorUserId, split.grossMinor, split.creatorMinor, split.platformMinor, split.currency, split.basisPoints, split.mode, split.occurredAt] },
        // The intent is written only against a held split identical to this one, so a
        // conflicting pre-existing split can never commit a payout beside it.
        { text: `INSERT INTO stripe_connect_payout_intents (${CONNECT_PAYOUT_COLUMNS}) SELECT $1::text, $2::text, $3::text, $4::text, $5::bigint, $6::bigint, $7::bigint, $8::char(3), $9::integer, $10::text, $11::text, $12::timestamptz WHERE EXISTS (SELECT 1 FROM money_split_records WHERE sale_id = $2 AND listing_id = $13 AND buyer_user_id = $14 AND creator_user_id = $3 AND gross_minor = $5 AND creator_minor = $6 AND platform_minor = $7 AND currency = $8 AND basis_points = $9 AND mode = $10 AND occurred_at = $15::timestamptz) ON CONFLICT DO NOTHING RETURNING payout_intent_id`, values: [intent.payoutIntentId, intent.saleId, intent.creatorUserId, intent.stripeAccountId, intent.grossMinor, intent.creatorMinor, intent.platformMinor, intent.currency, intent.basisPoints, intent.mode, intent.idempotencyKey, intent.requestedAt, split.listingId, split.buyerUserId, split.occurredAt] },
      ]);

      const [heldSplit, heldIntent] = await Promise.all([readSplit(split.saleId), readPayoutIntent(intent.idempotencyKey)]);

      if (heldSplit === undefined) throw new Error("connect store: payout commit returned no split");

      if (!samePersisted(heldSplit, split)) return conflict();

      if (heldIntent === undefined || !samePersisted(heldIntent, intent)) return conflict();

      return Object.freeze({ split: heldSplit, intent: heldIntent, replayed: (inserted[1]?.length ?? 0) === 0 });
    },
    async appendPayoutOutcome(candidate) {
      const outcome = validatedRecord(candidate, validateConnectPayoutOutcome, "Connect payout outcome");
      const inserted = await database.query(`INSERT INTO stripe_connect_payout_outcomes (${CONNECT_OUTCOME_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING RETURNING ${CONNECT_OUTCOME_COLUMNS}`, [outcome.payoutOutcomeId, outcome.payoutIntentId, outcome.status, outcome.providerPayoutId, outcome.providerEvidenceId, outcome.providerMessage, outcome.observedAt]);
      const insertedRow = firstRow(inserted);

      if (insertedRow !== undefined) return Object.freeze({ record: payoutOutcomeFromConnectRow(insertedRow), replayed: false });
      const held = await one(`SELECT ${CONNECT_OUTCOME_COLUMNS} FROM stripe_connect_payout_outcomes WHERE payout_outcome_id = $1 OR payout_intent_id = $2 LIMIT 1`, [outcome.payoutOutcomeId, outcome.payoutIntentId], payoutOutcomeFromConnectRow);

      if (held === undefined) throw new Error("connect store: payout outcome insert returned no row");

      if (!samePersisted(held, outcome)) conflict();

      return Object.freeze({ record: held, replayed: true });
    },
  });
}

/** Neon audit writer. The database trigger makes every recorded statement immutable. */
export function createNeonLiveModeAuditSink(database: NeonDatabase): (audit: LiveModeAuthorizationAudit) => Promise<void> {
  return async (audit) => {
    await database.query(
      `INSERT INTO stripe_live_mode_authorization_audit (schema_version, kind, source, authorized_by, authorized_on, fingerprint, record) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [audit.schemaVersion, audit.kind, audit.source, audit.authorizedBy, audit.authorizedOn, audit.fingerprint, audit.record],
    );
  };
}

export type CheckoutIntentStore = Readonly<{
  persistIntent(intent: CheckoutIntent): Promise<CheckoutIntent>;
  findIntent(intentId: string): Promise<CheckoutIntent | undefined>;
}>;

export function createNeonCheckoutIntentStore(
  database: NeonDatabase,
): CheckoutIntentStore & Readonly<{
  listByUserId(userId: string, page?: PurchaseHistoryPage): Promise<ReadonlyArray<CheckoutIntent>>;
}> {
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
    async listByUserId(userId, page) {
      const limit = page?.limit ?? 50;

      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 51 || (page?.before !== undefined && (!Number.isFinite(Date.parse(page.before.createdAt)) || !/^[A-Za-z0-9._-]{1,128}$/.test(page.before.intentId)))) throw new Error("invalid checkout history page");

      const rows = await database.query(
        `SELECT intent_id, user_id, purpose, item_id, credits, unit_amount, currency,
                stripe_price_id, mode, success_url, cancel_url, idempotency_key, created_at
         FROM checkout_session_intents WHERE user_id = $1 AND purpose = 'credit-pack'
           AND ($2::timestamptz IS NULL OR (created_at, intent_id) < ($2::timestamptz, $3::text))
         ORDER BY created_at DESC, intent_id DESC LIMIT $4`,
        [userId, page?.before?.createdAt ?? null, page?.before?.intentId ?? null, limit],
      );

      return Object.freeze(rows.map(intentFromRow));
    },
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
  json(): Promise<ProviderJson>;
}> >;

function recordOf(value: ProviderJson | undefined): ProviderJsonObject | undefined {
  return isJsonObject(value) ? value : undefined;
}

/** Loader shape shared by the provider constructors, injectable for tests. */
export type SiteModuleLoader = (specifier: string) => ProviderModule;

function moduleNamespaceOf(value: ProviderModule): ProviderNamespace | undefined {
  if (!isCallable(value) && !isObject(value)) return undefined;

  // SAFETY: object/function check permits property reads; optional export slots cover every JavaScript value require can expose.
  return value as ProviderNamespace;
}

/**
 * Resolve a callable provider export across the shapes `require()` can return:
 * the callable itself (CommonJS `module.exports = fn`), an ES namespace holding
 * it, or a namespace nesting one inside the other. Resolving only `["default"]`
 * of an object namespace misses the CommonJS shape stripe-node actually ships,
 * and the miss is indistinguishable from an unconfigured deployment.
 */
function moduleFunctionExport(loaded: ProviderModule, names: ReadonlyArray<ProviderExportName>): ProviderModule {
  const seen = new Set<ProviderModule>();
  let candidate: ProviderModule = loaded;

  while (candidate !== undefined && candidate !== null && !seen.has(candidate)) {
    if (isCallable(candidate)) return candidate;
    seen.add(candidate);
    const namespace = moduleNamespaceOf(candidate);

    if (namespace === undefined) return undefined;
    candidate = names
      .map((name) => namespace[name])
      .find((value) => value !== undefined && value !== null);
  }

  return undefined;
}

function stringValue(value: ProviderJson | undefined): string {
  return isString(value) ? value : "";
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
    isCallable(headers.getSetCookie)
      ? [...headers.getSetCookie()]
      : (headers.get("set-cookie") ?? "").split(SET_COOKIE_SEPARATOR);

  const pairs = issued
    .map((value) => (value.split(";")[0] ?? "").trim())
    .filter((pair) => pair.length > 0 && pair.includes("="));

  return pairs.length === 0 ? undefined : pairs.join("; ");
}

export type ProviderSessionRevoker = Readonly<{
  /** Resolves only after the provider confirms revocation, including an already absent session. */
  revokeSession(token: string): Promise<void>;
}>;

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
}): BetterAuthInstanceLike & ProviderSessionRevoker {
  const origin = new URL(options.origin).origin;

  async function readSessionRecord(
    token: string,
    cookie: string | undefined,
  ): Promise<
    Readonly<{
      readonly session: ProviderJsonObject;
      readonly user: ProviderJsonObject | undefined;
    }>
  > {
      const headers: SessionHeaders = { authorization: `Bearer ${token}`, "content-type": "application/json" };

      if (cookie !== undefined) headers.cookie = cookie;
      const response = await options.fetch(`${origin}/api/auth/get-session`, { method: "GET", headers });

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
    async revokeSession(token: string) {
      const response = await options.fetch(`${origin}/api/auth/sign-out`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          origin,
        },
        body: "{}",
        redirect: "error",
        cache: "no-store",
      });

      if (!response.ok) throw new Error(`Better Auth sign-out failed (${response.status})`);
      const payload = recordOf(await response.json());

      if (payload?.["success"] !== true) {
        throw new Error("Better Auth did not confirm session revocation");
      }

      // Better Auth sign-out reports success even when its database deletion throws.
      const verified = await options.fetch(`${origin}/api/auth/get-session`, {
        method: "GET",
        headers: { authorization: `Bearer ${token}` },
        redirect: "error",
        cache: "no-store",
      });

      if (!verified.ok || (await verified.json()) !== null) {
        throw new Error("Better Auth session revocation could not be verified");
      }
    },
    api: Object.freeze({
      async signInEmail(input: { body: { email: string; password: string } }) {
        const { body } = input;

        const response = await options.fetch(`${origin}/api/auth/sign-in/email`, {
          method: "POST",
          headers: { "content-type": "application/json", origin },
          redirect: "error",
          cache: "no-store",
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

      if (!isString(session.url) || !session.url.startsWith("https://")) {
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
  retrieveCharge(chargeId: string): Promise<StripeCharge>;
}> {
  return Object.freeze({
    findIntent: options.intents.findIntent,
    async retrieveCharge(chargeId) {
      if (options.stripe.charges === undefined) throw new Error("Stripe Charge retrieval is unavailable");

      return options.stripe.charges.retrieve(chargeId);
    },
    async retrieveSettlement(sessionId) {
      const session = await options.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["line_items.data.price"],
      });

      const line = session.line_items?.data?.[0];
      const price = line?.price;

      const stripePriceId =
        isString(price)
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
        !isString(currency) ||
        quantity === undefined ||
        !isString(stripePriceId)
      ) {
        return undefined;
      }

      return Object.freeze({
        sessionId: isString(session.id) ? session.id : "",
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
  readonly betterAuth?: (BetterAuthInstanceLike & Partial<ProviderSessionRevoker>) | undefined;
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
  return isCallable(globalThis.fetch) ? globalThis.fetch.bind(globalThis) : undefined;
}

export const SCENEAXI_PROVIDER_ENTRYPOINT_CATALOG = Object.freeze({
  "sites/umbrella/src/lib/provider-adapters.ts": createStripeClient,
});

type BoundaryObjectValue = object | null;

type BoundaryCallableValue = (...args: never[]) => void;

function isBoundaryCallableValue<Input>(value: Input): value is Input & BoundaryCallableValue & object {
  return typeof value === "function";
}

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}
