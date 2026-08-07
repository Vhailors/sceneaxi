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
import { Pool, type PoolClient } from "pg";

export const BETTER_AUTH_PROVIDER_REFUSALS = Object.freeze({
  configurationAbsent: "BETTER_AUTH_PROVIDER_CONFIGURATION_ABSENT",
  configurationInvalid: "BETTER_AUTH_PROVIDER_CONFIGURATION_INVALID",
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

export type BetterAuthProviderRuntime = Readonly<{
  auth: ProviderAuth;
  ready(): Promise<void>;
}>;

export type BetterAuthProviderRuntimeResult =
  | Readonly<{ ok: true; value: BetterAuthProviderRuntime }>
  | Readonly<{ ok: false; reason: BetterAuthProviderRefusal }>;

const providerModels = Object.freeze({
  user: "better_auth_users",
  session: "better_auth_sessions",
  account: "better_auth_accounts",
  verification: "better_auth_verifications",
});

/**
 * Create Better Auth over an injected database adapter. Production supplies a pg
 * Pool; the injection keeps the provider contract integration-testable without a
 * network or credential.
 */
export function createBetterAuthProviderRuntime(options: {
  readonly config: BetterAuthProviderConfig;
  readonly database: BetterAuthOptions["database"];
  readonly ready?: (() => Promise<void>) | undefined;
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
    advanced: {
      useSecureCookies: new URL(config.origin).protocol === "https:",
      database: { generateId: () => randomUUID() },
    },
    logger: { disabled: true },
  });
  return Object.freeze({
    auth,
    ready: options.ready ?? (async () => undefined),
  });
}

type ProviderUserRow = Readonly<{
  id: string;
  emailVerified: boolean;
}>;

type ProviderAccountRow = Readonly<{
  password: string | null;
}>;

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
      throw new Error("provider bootstrap state is not verified");
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
      throw new Error("provider bootstrap credential does not match persisted state");
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function productionRuntime(config: BetterAuthProviderConfig): BetterAuthProviderRuntime {
  const pool = new Pool({ connectionString: config.databaseUrl });
  let bootstrap: Promise<void> | undefined;
  return createBetterAuthProviderRuntime({
    config,
    database: pool,
    ready() {
      bootstrap ??= ensureBetterAuthAdminBootstrap(pool, config).catch((error: unknown) => {
        bootstrap = undefined;
        throw error;
      });
      return bootstrap;
    },
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

function requiredEndpoint(request: Request): boolean {
  const { pathname } = new URL(request.url);
  return (
    (request.method === "POST" && pathname === "/api/auth/sign-in/email") ||
    (request.method === "GET" && pathname === "/api/auth/get-session")
  );
}

/** Build the two-route HTTP boundary with an injectable runtime loader for tests. */
export function createBetterAuthProviderHandler(
  loadRuntime: () => BetterAuthProviderRuntimeResult = loadProductionBetterAuthProvider,
) {
  return async (request: Request): Promise<Response> => {
    if (!requiredEndpoint(request)) {
      return Response.json({ code: "NOT_FOUND" }, { status: 404 });
    }
    const loaded = loadRuntime();
    if (!loaded.ok) return refusal(loaded.reason);
    try {
      await loaded.value.ready();
      return await loaded.value.auth.handler(request);
    } catch {
      return refusal(BETTER_AUTH_PROVIDER_REFUSALS.storageUnavailable);
    }
  };
}

export const betterAuthProviderHandler = createBetterAuthProviderHandler();
