/**
 * The deployment-owned Better Auth HTTP provider for the umbrella.
 *
 * This module is deliberately provider-only: it imports no SceneAxi identity or
 * billing package and issues no role. Better Auth owns credential verification and
 * its own Neon tables; the existing umbrella HTTP adapter then maps an authenticated
 * provider result through `@sceneaxi/auth`, where session provenance, the sole-admin
 * decision, Kids denial, and SceneAxi session persistence remain authoritative.
 */
import { randomUUID } from "node:crypto";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { bearer } from "better-auth/plugins";
import { Pool, types as pgTypes, type PoolClient } from "pg";

export const BETTER_AUTH_PROVIDER_REFUSALS = Object.freeze({
  configurationAbsent: "BETTER_AUTH_PROVIDER_CONFIGURATION_ABSENT",
  configurationInvalid: "BETTER_AUTH_PROVIDER_CONFIGURATION_INVALID",
  bootstrapDisagreement: "BETTER_AUTH_PROVIDER_BOOTSTRAP_DISAGREEMENT",
  storageUnavailable: "BETTER_AUTH_PROVIDER_STORAGE_UNAVAILABLE",
} as const);

export type BetterAuthProviderRefusal =
  (typeof BETTER_AUTH_PROVIDER_REFUSALS)[keyof typeof BETTER_AUTH_PROVIDER_REFUSALS];

export type BetterAuthProviderConfig = Readonly<{
  databaseUrl: string;
  origin: string;
  secret: string;
  bootstrapEmail: string;
  bootstrapSecret: string;
}>;

export type BetterAuthProviderConfigResult =
  | Readonly<{ ok: true; value: BetterAuthProviderConfig }>
  | Readonly<{ ok: false; reason: BetterAuthProviderRefusal }>;

const REQUIRED_PROVIDER_ENV = Object.freeze([
  "DATABASE_URL",
  "BETTER_AUTH_ORIGIN",
  "BETTER_AUTH_SECRET",
  "SCENEAXI_ADMIN_EMAIL",
  "SCENEAXI_ADMIN_BOOTSTRAP_SECRET",
] as const);

function nonEmpty(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === undefined || normalized.length === 0 ? undefined : normalized;
}

function providerOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    const loopback =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]";
    if (url.username !== "" || url.password !== "") return undefined;
    if (url.pathname !== "/" || url.search !== "" || url.hash !== "") return undefined;
    if (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function postgresUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "postgres:" || protocol === "postgresql:";
  } catch {
    return false;
  }
}

function bootstrapEmail(value: string): string | undefined {
  const normalized = value.toLowerCase();
  if (/[\s,;]/.test(normalized)) return undefined;
  return /^[^@]+@[^@]+\.[^@]+$/.test(normalized) ? normalized : undefined;
}

/** Resolve names only; no refusal message ever includes a supplied value. */
export function resolveBetterAuthProviderConfig(
  env: Readonly<Record<string, string | undefined>>,
): BetterAuthProviderConfigResult {
  const values = Object.fromEntries(
    REQUIRED_PROVIDER_ENV.map((name) => [name, nonEmpty(env[name])]),
  ) as Record<(typeof REQUIRED_PROVIDER_ENV)[number], string | undefined>;
  if (REQUIRED_PROVIDER_ENV.some((name) => values[name] === undefined)) {
    return Object.freeze({
      ok: false as const,
      reason: BETTER_AUTH_PROVIDER_REFUSALS.configurationAbsent,
    });
  }

  const databaseUrl = values.DATABASE_URL;
  const originValue = values.BETTER_AUTH_ORIGIN;
  const secret = values.BETTER_AUTH_SECRET;
  const emailValue = values.SCENEAXI_ADMIN_EMAIL;
  const firstRunSecret = values.SCENEAXI_ADMIN_BOOTSTRAP_SECRET;
  if (
    databaseUrl === undefined ||
    originValue === undefined ||
    secret === undefined ||
    emailValue === undefined ||
    firstRunSecret === undefined
  ) {
    return Object.freeze({
      ok: false as const,
      reason: BETTER_AUTH_PROVIDER_REFUSALS.configurationAbsent,
    });
  }

  const origin = providerOrigin(originValue);
  const email = bootstrapEmail(emailValue);
  if (
    !postgresUrl(databaseUrl) ||
    origin === undefined ||
    secret.length < 32 ||
    firstRunSecret.length < 8 ||
    firstRunSecret.length > 128 ||
    email === undefined
  ) {
    return Object.freeze({
      ok: false as const,
      reason: BETTER_AUTH_PROVIDER_REFUSALS.configurationInvalid,
    });
  }

  return Object.freeze({
    ok: true as const,
    value: Object.freeze({
      databaseUrl,
      origin,
      secret,
      bootstrapEmail: email,
      bootstrapSecret: firstRunSecret,
    }),
  });
}

type ProviderAuth = Readonly<{
  handler(request: Request): Promise<Response>;
}>;

/**
 * Whether the one configured provider credential is provisioned. Only sign-in
 * needs it, and a disagreement is reported as itself rather than as a storage
 * fault, so an operator rotating the captain-held secret is not sent looking for
 * a database that is answering perfectly well.
 */
export type BetterAuthProviderReadiness =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: BetterAuthProviderRefusal }>;

const PROVIDER_READY: BetterAuthProviderReadiness = Object.freeze({ ok: true as const });

export type BetterAuthProviderRuntime = Readonly<{
  auth: ProviderAuth;
  ready(): Promise<BetterAuthProviderReadiness>;
}>;

export type BetterAuthProviderRuntimeResult =
  | Readonly<{ ok: true; value: BetterAuthProviderRuntime }>
  | Readonly<{ ok: false; reason: BetterAuthProviderRefusal }>;

const providerModels = Object.freeze({
  user: "better_auth_users",
  session: "better_auth_sessions",
  account: "better_auth_accounts",
  verification: "better_auth_verifications",
  rateLimit: "better_auth_rate_limits",
});

/**
 * Durable throttling for the public credential endpoint.
 *
 * The counter lives in the provider's own PostgreSQL, not in per-instance
 * memory, because a serverless instance's memory resets on every cold start and
 * so throttles nothing an attacker cannot simply outlast. Sign-up is disabled
 * and exactly one account is ever provisioned, which makes `/sign-in/email` the
 * whole brute-force surface for the sole admin address.
 *
 * Session lookup is exempt on purpose: every request reaches this provider
 * server-to-server from the deployment's own egress address, so a shared bucket
 * on that path would throttle unrelated visitors rather than an attacker, and
 * the path creates nothing and already requires an issued 32-byte token. That
 * same shared egress is why the sign-in rule is deliberately a deployment-wide
 * ceiling on credential attempts rather than a per-caller one.
 */
export const BETTER_AUTH_PROVIDER_RATE_LIMIT = Object.freeze({
  signIn: Object.freeze({ window: 300, max: 5 }),
  fallback: Object.freeze({ window: 60, max: 120 }),
});

/**
 * Create Better Auth over an injected database adapter. Production supplies a pg
 * Pool; the injection keeps the provider contract integration-testable without a
 * network or credential.
 */
export function createBetterAuthProviderRuntime(options: {
  readonly config: BetterAuthProviderConfig;
  readonly database: BetterAuthOptions["database"];
  readonly ready?: (() => Promise<BetterAuthProviderReadiness>) | undefined;
}): BetterAuthProviderRuntime {
  const { config } = options;
  const auth = betterAuth({
    appName: "SceneAxi",
    baseURL: config.origin,
    secret: config.secret,
    database: options.database,
    user: { modelName: providerModels.user },
    session: { modelName: providerModels.session },
    account: { modelName: providerModels.account },
    verification: { modelName: providerModels.verification },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
    },
    plugins: [bearer()],
    trustedOrigins: [config.origin],
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: providerModels.rateLimit,
      window: BETTER_AUTH_PROVIDER_RATE_LIMIT.fallback.window,
      max: BETTER_AUTH_PROVIDER_RATE_LIMIT.fallback.max,
      customRules: {
        "/sign-in/email": { ...BETTER_AUTH_PROVIDER_RATE_LIMIT.signIn },
        "/get-session": false,
      },
    },
    advanced: {
      useSecureCookies: new URL(config.origin).protocol === "https:",
      database: { generateId: () => randomUUID() },
    },
    logger: { disabled: true },
  });
  return Object.freeze({
    auth,
    ready: options.ready ?? (async () => PROVIDER_READY),
  });
}

type ProviderUserRow = Readonly<{
  id: string;
  emailVerified: boolean;
}>;

type ProviderAccountRow = Readonly<{
  password: string | null;
}>;

/**
 * Persisted provider state disagrees with the configured bootstrap credential.
 *
 * This is a deployment configuration disagreement, not an unavailable database,
 * and re-deciding it cannot change the answer — so it is both reported and
 * memoized separately from a storage fault.
 */
export class BetterAuthProviderBootstrapDisagreement extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BetterAuthProviderBootstrapDisagreement";
  }
}

async function queryRows<Row extends object>(
  client: PoolClient,
  text: string,
  values: ReadonlyArray<unknown> = [],
) {
  const result = await client.query<Row>(text, [...values]);
  return result.rows;
}

/**
 * Idempotently create the one provider credential named by deployment config.
 *
 * This writes no SceneAxi role and never stores the raw bootstrap secret. Existing
 * provider state is accepted only when it is verified and the configured credential
 * still matches; disagreement refuses instead of rotating or overwriting an account.
 */
export async function ensureBetterAuthAdminBootstrap(
  pool: Pool,
  config: BetterAuthProviderConfig,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [config.bootstrapEmail]);
    const users = await queryRows<ProviderUserRow>(
      client,
      `SELECT "id", "emailVerified"
         FROM "better_auth_users"
        WHERE lower("email") = $1
        FOR UPDATE`,
      [config.bootstrapEmail],
    );

    let userId = users[0]?.id;
    if (userId === undefined) {
      userId = randomUUID();
      const now = new Date();
      await client.query(
        `INSERT INTO "better_auth_users"
           ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, $4, $4)`,
        [userId, "SceneAxi Admin", config.bootstrapEmail, now],
      );
    } else if (users[0]?.emailVerified !== true) {
      throw new BetterAuthProviderBootstrapDisagreement(
        "provider bootstrap state is not verified",
      );
    }

    const accounts = await queryRows<ProviderAccountRow>(
      client,
      `SELECT "password"
         FROM "better_auth_accounts"
        WHERE "userId" = $1 AND "providerId" = 'credential'
        FOR UPDATE`,
      [userId],
    );
    const heldPassword = accounts[0]?.password;
    if (heldPassword === undefined) {
      const password = await hashPassword(config.bootstrapSecret);
      const now = new Date();
      await client.query(
        `INSERT INTO "better_auth_accounts"
           ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
         VALUES ($1, $2, 'credential', $2, $3, $4, $4)`,
        [randomUUID(), userId, password, now],
      );
    } else if (
      heldPassword === null ||
      !(await verifyPassword({ hash: heldPassword, password: config.bootstrapSecret }))
    ) {
      throw new BetterAuthProviderBootstrapDisagreement(
        "provider bootstrap credential does not match persisted state",
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Deliberately far below node-postgres's default of ten.
 *
 * The umbrella already reaches this same Neon database through the stateless
 * `@neondatabase/serverless` HTTP driver; this pooled driver exists only because
 * Better Auth's Kysely adapter needs one. Every concurrently warm serverless
 * instance holds its own copy of this pool, so an unbounded default multiplies
 * held Neon connections across instances for two endpoints that issue a handful
 * of short queries each. `connectionTimeoutMillis` is set for the same reason a
 * refusal beats a hang: without it a request waits forever for a client instead
 * of failing closed.
 */
export const BETTER_AUTH_PROVIDER_POOL_LIMITS = Object.freeze({
  max: 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});

const PG_INT8_OID = 20;

/**
 * The provider-owned connection pool.
 *
 * node-postgres reports a backend or network failure on an otherwise idle client
 * as an `'error'` event on the pool rather than as a rejected query, so the pool
 * owns that event itself: a suspended or reset connection stays a storage fault
 * the next request refuses by name. The `int8` parser is pool-local rather than
 * a process-wide `setTypeParser`, and keeps the rate limiter's millisecond
 * timestamps arithmetic rather than text.
 */
export function createProviderPool(config: BetterAuthProviderConfig): Pool {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ...BETTER_AUTH_PROVIDER_POOL_LIMITS,
    types: {
      getTypeParser: ((oid: number, format?: unknown) =>
        oid === PG_INT8_OID
          ? Number
          : (pgTypes.getTypeParser as (id: number, format?: unknown) => unknown)(
              oid,
              format,
            )) as typeof pgTypes.getTypeParser,
    },
  });
  pool.on("error", () => undefined);
  return pool;
}

/**
 * Memoize provisioning by outcome, not by attempt.
 *
 * A disagreement is deterministic, so it is answered from the memo forever:
 * re-running it would re-open a client and re-run an advisory lock, two locking
 * reads, and a scrypt verification for every unauthenticated request while the
 * deployment stays misconfigured. A storage fault is transient, so it is
 * forgotten and the next request tries again.
 */
export function createBootstrapReadiness(
  provision: () => Promise<void>,
): () => Promise<BetterAuthProviderReadiness> {
  let held: Promise<BetterAuthProviderReadiness> | undefined;
  return () => {
    held ??= provision()
      .then(() => PROVIDER_READY)
      .catch((error: unknown) =>
        Object.freeze({
          ok: false as const,
          reason:
            error instanceof BetterAuthProviderBootstrapDisagreement
              ? BETTER_AUTH_PROVIDER_REFUSALS.bootstrapDisagreement
              : BETTER_AUTH_PROVIDER_REFUSALS.storageUnavailable,
        }),
      )
      .then((readiness) => {
        if (!readiness.ok && readiness.reason !== BETTER_AUTH_PROVIDER_REFUSALS.bootstrapDisagreement) {
          held = undefined;
        }
        return readiness;
      });
    return held;
  };
}

function productionRuntime(config: BetterAuthProviderConfig): BetterAuthProviderRuntime {
  const pool = createProviderPool(config);
  return createBetterAuthProviderRuntime({
    config,
    database: pool,
    ready: createBootstrapReadiness(() => ensureBetterAuthAdminBootstrap(pool, config)),
  });
}

let heldProductionRuntime: BetterAuthProviderRuntimeResult | undefined;

export function loadProductionBetterAuthProvider(): BetterAuthProviderRuntimeResult {
  if (heldProductionRuntime !== undefined) return heldProductionRuntime;
  const config = resolveBetterAuthProviderConfig(process.env);
  if (!config.ok) {
    heldProductionRuntime = config;
    return heldProductionRuntime;
  }
  try {
    heldProductionRuntime = Object.freeze({
      ok: true as const,
      value: productionRuntime(config.value),
    });
  } catch {
    heldProductionRuntime = Object.freeze({
      ok: false as const,
      reason: BETTER_AUTH_PROVIDER_REFUSALS.storageUnavailable,
    });
  }
  return heldProductionRuntime;
}

function refusal(reason: BetterAuthProviderRefusal): Response {
  return Response.json(
    { code: reason },
    {
      status: 503,
      headers: { "cache-control": "no-store" },
    },
  );
}

type ProviderEndpoint = "sign-in" | "get-session";

function requiredEndpoint(request: Request): ProviderEndpoint | undefined {
  const { pathname } = new URL(request.url);
  if (request.method === "POST" && pathname === "/api/auth/sign-in/email") return "sign-in";
  if (request.method === "GET" && pathname === "/api/auth/get-session") return "get-session";
  return undefined;
}

/**
 * Build the two-route HTTP boundary with an injectable runtime loader for tests.
 *
 * Provisioning gates sign-in alone. It exists to create the one configured
 * credential, and nothing it decides makes an already-issued session forged, so
 * a disagreement stops new credential grants without taking session lookup down
 * for principals it never described.
 */
export function createBetterAuthProviderHandler(
  loadRuntime: () => BetterAuthProviderRuntimeResult = loadProductionBetterAuthProvider,
) {
  return async (request: Request): Promise<Response> => {
    const endpoint = requiredEndpoint(request);
    if (endpoint === undefined) {
      return Response.json({ code: "NOT_FOUND" }, { status: 404 });
    }
    const loaded = loadRuntime();
    if (!loaded.ok) return refusal(loaded.reason);
    try {
      if (endpoint === "sign-in") {
        const readiness = await loaded.value.ready();
        if (!readiness.ok) return refusal(readiness.reason);
      }
      return await loaded.value.auth.handler(request);
    } catch {
      return refusal(BETTER_AUTH_PROVIDER_REFUSALS.storageUnavailable);
    }
  };
}

export const betterAuthProviderHandler = createBetterAuthProviderHandler();
