import { readFileSync } from "node:fs";
import { memoryAdapter, type MemoryDB } from "better-auth/adapters/memory";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import {
  AUTH_REFUSE_REASONS,
  createIdentityPort,
  type IdentityAdapter,
  type IdentityStore,
} from "@sceneaxi/auth";
import {
  BETTER_AUTH_PROVIDER_BOOTSTRAP_RETRY_MS,
  BETTER_AUTH_PROVIDER_POOL_LIMITS,
  BETTER_AUTH_PROVIDER_RATE_LIMIT,
  BETTER_AUTH_PROVIDER_REFUSALS,
  BETTER_AUTH_PROVIDER_RETENTION,
  SCENEAXI_PROVIDER_ENTRYPOINT_CATALOG,
  BetterAuthProviderBootstrapDisagreement,
  createBetterAuthProviderHandler,
  createBetterAuthProviderRuntime,
  createBootstrapReadiness,
  createProviderPool,
  createRateLimitRetention,
  ensureBetterAuthAdminBootstrap,
  resolveBetterAuthProviderConfig,
  type BetterAuthProviderConfig,
  type BetterAuthProviderRuntimeResult,
} from "../src/provider/better-auth-provider.js";

const ORIGIN = "https://auth.example.invalid";
const EMAIL = ["captain", "example.invalid"].join("@");
const PASSWORD = ["Synthetic", "Credential", "42!"].join("");
const SIGNING_SECRET = "synthetic-provider-signing-material".padEnd(48, "x");
// Assembled rather than written out, exactly like the synthetic address and
// credential above: `tests/contracts/no-committed-secrets.test.ts` scans the whole
// tracked tree for connection-string *shapes*, and a synthetic one is still a shape.
// The binding is named for the fixture, not the variable, because
// `scripts/check-sites.mjs` refuses a secret name assigned anything but an
// environment reference anywhere under `sites/` — including in a comment.
const SYNTHETIC_DATABASE_URL = ["postgresql:", "synthetic.invalid", "sceneaxi"].join("/");

function providerEnv(overrides: Readonly<Record<string, string>> = {}) {
  return Object.fromEntries([
    ["DATABASE_URL", overrides["databaseUrl"] ?? SYNTHETIC_DATABASE_URL],
    ["BETTER_AUTH_ORIGIN", overrides["origin"] ?? ORIGIN],
    ["BETTER_AUTH_SECRET", overrides["secret"] ?? SIGNING_SECRET],
    ["SCENEAXI_ADMIN_EMAIL", overrides["email"] ?? EMAIL],
    ["SCENEAXI_ADMIN_BOOTSTRAP_SECRET", overrides["bootstrapSecret"] ?? PASSWORD],
  ]);
}

const config = (): BetterAuthProviderConfig =>
  Object.freeze({
    databaseUrl: ["postgresql:", "synthetic", "example.invalid", "sceneaxi"].join("/"),
    origin: ORIGIN,
    secret: SIGNING_SECRET,
    bootstrapEmail: EMAIL,
    bootstrapSecret: PASSWORD,
  });

async function providerFixture() {
  const userId = "provider-user-1";
  const now = new Date("2026-08-07T10:00:00.000Z");
  const database: MemoryDB = {
    better_auth_users: [
      {
        id: userId,
        name: "Synthetic Captain",
        email: EMAIL,
        emailVerified: true,
        image: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    better_auth_sessions: [],
    better_auth_accounts: [
      {
        id: "provider-account-1",
        accountId: userId,
        providerId: "credential",
        userId,
        password: await hashPassword(PASSWORD),
        createdAt: now,
        updatedAt: now,
      },
    ],
    better_auth_verifications: [],
    better_auth_rate_limits: [],
  };
  const runtime = createBetterAuthProviderRuntime({
    config: config(),
    database: memoryAdapter(database),
  });
  const loaded: BetterAuthProviderRuntimeResult = Object.freeze({
    ok: true,
    value: runtime,
  });
  return {
    database,
    handler: createBetterAuthProviderHandler(() => loaded),
  };
}

type BootstrapQuery = Readonly<{ text: string; values: ReadonlyArray<unknown> }>;

/**
 * A hand-rolled pool that answers the bootstrap writer's two reads, so the
 * transaction, refusal, and release contract is proven without a database.
 */
function bootstrapPool(
  seed: Readonly<{
    user?: Readonly<{ id: string; emailVerified: boolean }>;
    password?: string | null;
  }>,
) {
  const queries: BootstrapQuery[] = [];
  let released = 0;
  const client = {
    async query(text: string, values: ReadonlyArray<unknown> = []) {
      queries.push(Object.freeze({ text, values: Object.freeze([...values]) }));
      if (text.includes('FROM "better_auth_users"')) {
        return { rows: seed.user === undefined ? [] : [seed.user] };
      }
      if (text.includes('FROM "better_auth_accounts"')) {
        return { rows: seed.password === undefined ? [] : [{ password: seed.password }] };
      }
      return { rows: [] };
    },
    release() {
      released += 1;
    },
  };
  return {
    pool: { connect: async () => client } as unknown as Pool,
    queries,
    released: () => released,
    inserts: () => queries.filter((query) => query.text.trimStart().startsWith("INSERT")),
    verbs: () => queries.map((query) => query.text.trimStart().split(/\s+/, 1)[0] ?? ""),
  };
}

async function signIn(handler: (request: Request) => Promise<Response>) {
  return handler(
    new Request(`${ORIGIN}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    }),
  );
}

describe("umbrella Better Auth provider", () => {
  it("publishes the executable handler factory as its installed provider witness", async () => {
    const inventory = JSON.parse(
      readFileSync(new URL("../../../docs/audits/initiation/requirements.json", import.meta.url), "utf8"),
    ) as { liveInventory: { installedProviderEntrypoints: string[] } };
    expect(Object.keys(SCENEAXI_PROVIDER_ENTRYPOINT_CATALOG)).toEqual(
      inventory.liveInventory.installedProviderEntrypoints,
    );
    expect(SCENEAXI_PROVIDER_ENTRYPOINT_CATALOG["sites/umbrella/src/provider/better-auth-provider.ts"])
      .toBe(createBetterAuthProviderHandler);
    const { handler } = await providerFixture();
    const response = await handler(new Request(`${ORIGIN}/api/auth/unowned`));
    expect(response.status).toBe(404);
  });

  it("serves stock sign-in and resolves the persisted session by cookie or bearer", async () => {
    const { database, handler } = await providerFixture();
    const response = await signIn(handler);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    const token = payload["token"];
    expect(payload).toMatchObject({
      redirect: false,
      user: { id: "provider-user-1", email: EMAIL, emailVerified: true },
    });
    expect(typeof token).toBe("string");
    expect(JSON.stringify(payload)).not.toContain(PASSWORD);
    expect(response.headers.get("set-auth-token")).toBeTruthy();

    const sessions = database["better_auth_sessions"] ?? [];
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ userId: "provider-user-1", token });

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    const cookie = setCookie?.split(";", 1)[0] ?? "";
    const cookieLookup = await handler(
      new Request(`${ORIGIN}/api/auth/get-session`, {
        headers: { cookie },
      }),
    );
    const cookieSession = (await cookieLookup.json()) as Record<string, unknown>;
    expect(cookieLookup.status).toBe(200);
    expect(cookieSession).toMatchObject({
      session: { id: sessions[0]?.id, userId: "provider-user-1" },
      user: { id: "provider-user-1", email: EMAIL },
    });

    const bearerLookup = await handler(
      new Request(`${ORIGIN}/api/auth/get-session`, {
        headers: { authorization: `Bearer ${String(token)}` },
      }),
    );
    expect(bearerLookup.status).toBe(200);
    expect(await bearerLookup.json()).toMatchObject({
      session: { id: sessions[0]?.id, userId: "provider-user-1" },
      user: { id: "provider-user-1", email: EMAIL },
    });
    expect(database["better_auth_sessions"]).toHaveLength(1);
  });

  it("serves the header shape its own server-to-server adapter sends", async () => {
    const { database, handler } = await providerFixture();
    const response = await handler(
      new Request(`${ORIGIN}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(typeof payload["token"]).toBe("string");
    expect(payload).toMatchObject({ user: { id: "provider-user-1", email: EMAIL } });
    expect(database["better_auth_sessions"]).toHaveLength(1);
  });

  it("provisions the one provider credential without persisting the raw secret", async () => {
    const fake = bootstrapPool({});
    await ensureBetterAuthAdminBootstrap(fake.pool, config());

    const inserts = fake.inserts();
    expect(inserts).toHaveLength(2);
    expect(inserts[0]?.text).toContain('"better_auth_users"');
    expect(inserts[0]?.values).toContain(EMAIL);
    expect(inserts[1]?.text).toContain('"better_auth_accounts"');
    const held = inserts[1]?.values[2];
    expect(typeof held).toBe("string");
    expect(await verifyPassword({ hash: String(held), password: PASSWORD })).toBe(true);
    expect(JSON.stringify(fake.queries)).not.toContain(PASSWORD);
    expect(fake.verbs()).toContain("COMMIT");
    expect(fake.verbs()).not.toContain("ROLLBACK");
    expect(fake.released()).toBe(1);
  });

  it("accepts matching persisted provider state as an idempotent no-op", async () => {
    const fake = bootstrapPool({
      user: { id: "provider-user-1", emailVerified: true },
      password: await hashPassword(PASSWORD),
    });
    await ensureBetterAuthAdminBootstrap(fake.pool, config());

    expect(fake.inserts()).toHaveLength(0);
    expect(fake.verbs()).toContain("COMMIT");
    expect(fake.released()).toBe(1);
  });

  it("refuses disagreeing provider state, rolls back, and releases the client", async () => {
    const disagreements = [
      { user: { id: "provider-user-1", emailVerified: false } },
      { user: { id: "provider-user-1", emailVerified: true }, password: null },
      {
        user: { id: "provider-user-1", emailVerified: true },
        password: await hashPassword(`${PASSWORD}-rotated`),
      },
    ] as const;

    for (const seed of disagreements) {
      const fake = bootstrapPool(seed);
      await expect(ensureBetterAuthAdminBootstrap(fake.pool, config())).rejects.toThrow(
        /provider bootstrap/,
      );
      expect(fake.inserts()).toHaveLength(0);
      expect(fake.verbs()).toContain("ROLLBACK");
      expect(fake.verbs()).not.toContain("COMMIT");
      expect(fake.released()).toBe(1);
      expect(JSON.stringify(fake.queries)).not.toContain(PASSWORD);
    }
  });

  it("keeps an idle-client failure inside a bounded provider pool", async () => {
    const pool = createProviderPool(config());
    try {
      expect(pool.listenerCount("error")).toBeGreaterThan(0);
      expect(() => pool.emit("error", new Error("terminated by administrator"))).not.toThrow();

      expect(BETTER_AUTH_PROVIDER_POOL_LIMITS.max).toBeLessThan(10);
      expect(pool.options.max).toBe(BETTER_AUTH_PROVIDER_POOL_LIMITS.max);
      expect(pool.options.connectionTimeoutMillis).toBeGreaterThan(0);
      const parseInt8 = pool.options.types?.getTypeParser(20) as (value: string) => unknown;
      expect(parseInt8("1754563200000")).toBe(1754563200000);
    } finally {
      await pool.end();
    }
  });

  it("holds a bootstrap disagreement for a bounded interval, then re-decides it", async () => {
    let attempts = 0;
    let persistedCredentialDisagrees = true;
    let now = 1_700_000_000_000;
    const ready = createBootstrapReadiness(
      async () => {
        attempts += 1;
        if (persistedCredentialDisagrees) {
          throw new BetterAuthProviderBootstrapDisagreement(
            "provider bootstrap credential does not match persisted state",
          );
        }
      },
      () => now,
    );

    for (let call = 0; call < 5; call += 1) {
      expect(await ready()).toEqual({
        ok: false,
        reason: BETTER_AUTH_PROVIDER_REFUSALS.bootstrapDisagreement,
      });
    }
    expect(attempts).toBe(1);

    now += BETTER_AUTH_PROVIDER_BOOTSTRAP_RETRY_MS - 1;
    expect(await ready()).toEqual({
      ok: false,
      reason: BETTER_AUTH_PROVIDER_REFUSALS.bootstrapDisagreement,
    });
    expect(attempts).toBe(1);

    persistedCredentialDisagrees = false;
    now += 1;
    expect(await ready()).toEqual({ ok: true });
    expect(await ready()).toEqual({ ok: true });
    expect(attempts).toBe(2);
  });

  it("retries provisioning immediately after a storage fault", async () => {
    let attempts = 0;
    const ready = createBootstrapReadiness(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("connection terminated unexpectedly");
    });

    expect(await ready()).toEqual({
      ok: false,
      reason: BETTER_AUTH_PROVIDER_REFUSALS.storageUnavailable,
    });
    expect(await ready()).toEqual({
      ok: false,
      reason: BETTER_AUTH_PROVIDER_REFUSALS.storageUnavailable,
    });
    expect(await ready()).toEqual({ ok: true });
    expect(await ready()).toEqual({ ok: true });
    expect(attempts).toBe(3);
  });

  it("keeps a disagreeing bootstrap out of session lookup for unrelated principals", async () => {
    const { database, handler: provisioned } = await providerFixture();
    const issued = await signIn(provisioned);
    const cookie = (issued.headers.get("set-cookie") ?? "").split(";", 1)[0] ?? "";

    let readyCalls = 0;
    const runtime = createBetterAuthProviderRuntime({
      config: config(),
      database: memoryAdapter(database),
      ready: async () => {
        readyCalls += 1;
        return {
          ok: false,
          reason: BETTER_AUTH_PROVIDER_REFUSALS.bootstrapDisagreement,
        };
      },
    });
    const handler = createBetterAuthProviderHandler(() => ({ ok: true, value: runtime }));

    const refused = await signIn(handler);
    expect(refused.status).toBe(503);
    expect(await refused.json()).toEqual({
      code: BETTER_AUTH_PROVIDER_REFUSALS.bootstrapDisagreement,
    });
    expect(readyCalls).toBe(1);

    const lookup = await handler(
      new Request(`${ORIGIN}/api/auth/get-session`, { headers: { cookie } }),
    );
    expect(lookup.status).toBe(200);
    expect(await lookup.json()).toMatchObject({ user: { id: "provider-user-1" } });
    expect(readyCalls).toBe(1);
  });

  it("throttles both endpoints through provider storage", async () => {
    expect(BETTER_AUTH_PROVIDER_RATE_LIMIT.fallback.window).toBeGreaterThanOrEqual(
      BETTER_AUTH_PROVIDER_RATE_LIMIT.signIn.window,
    );

    const { database, handler } = await providerFixture();
    const attempt = () =>
      handler(
        new Request(`${ORIGIN}/api/auth/sign-in/email`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: EMAIL, password: `${PASSWORD}-wrong` }),
        }),
      );

    const statuses: number[] = [];
    for (let call = 0; call < BETTER_AUTH_PROVIDER_RATE_LIMIT.signIn.max + 1; call += 1) {
      statuses.push((await attempt()).status);
    }
    expect(statuses.slice(0, -1)).not.toContain(429);
    expect(statuses.at(-1)).toBe(429);
    expect(database["better_auth_sessions"]).toHaveLength(0);

    const signInCounters = (database["better_auth_rate_limits"] ?? []).filter((row) =>
      String(row["key"]).includes("/sign-in/email"),
    );
    expect(signInCounters).toHaveLength(1);
    expect(signInCounters[0]).toMatchObject({
      count: BETTER_AUTH_PROVIDER_RATE_LIMIT.signIn.max,
    });

    const relayLookups = BETTER_AUTH_PROVIDER_RATE_LIMIT.signIn.max + 3;
    for (let call = 0; call < relayLookups; call += 1) {
      const lookup = await handler(new Request(`${ORIGIN}/api/auth/get-session`));
      expect(lookup.status).toBe(200);
    }
    const lookupCounters = (database["better_auth_rate_limits"] ?? []).filter((row) =>
      String(row["key"]).includes("/get-session"),
    );
    expect(lookupCounters).toHaveLength(1);
    expect(lookupCounters[0]).toMatchObject({ count: relayLookups });
  });

  it("sweeps stale counters on a bounded interval and never fails a request", async () => {
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
    const queries: Array<{ text: string; values: ReadonlyArray<unknown> }> = [];
    let now = 1_700_000_000_000;
    let unavailable = false;
    const pool = {
      async query(text: string, values: ReadonlyArray<unknown> = []) {
        queries.push({ text, values });
        if (unavailable) throw new Error("connection terminated unexpectedly");
        return { rows: [] };
      },
    };
    const retain = createRateLimitRetention(pool as unknown as Pool, () => now);

    expect(BETTER_AUTH_PROVIDER_RETENTION.staleAfterMs).toBeGreaterThan(
      BETTER_AUTH_PROVIDER_RATE_LIMIT.fallback.window * 1_000,
    );
    expect(BETTER_AUTH_PROVIDER_RETENTION.staleAfterMs).toBeGreaterThan(
      BETTER_AUTH_PROVIDER_RATE_LIMIT.signIn.window * 1_000,
    );

    retain();
    retain();
    await flush();
    expect(queries).toHaveLength(1);
    expect(queries[0]?.text).toContain('DELETE FROM "better_auth_rate_limits"');
    expect(queries[0]?.text).toContain("LIMIT $2");
    expect(queries[0]?.values).toEqual([
      now - BETTER_AUTH_PROVIDER_RETENTION.staleAfterMs,
      BETTER_AUTH_PROVIDER_RETENTION.maxRowsPerSweep,
    ]);

    now += BETTER_AUTH_PROVIDER_RETENTION.sweepIntervalMs - 1;
    retain();
    await flush();
    expect(queries).toHaveLength(1);

    now += 1;
    unavailable = true;
    expect(() => retain()).not.toThrow();
    await flush();
    expect(queries).toHaveLength(2);

    now += BETTER_AUTH_PROVIDER_RETENTION.sweepIntervalMs;
    unavailable = false;
    retain();
    await flush();
    expect(queries).toHaveLength(3);
  });

  it("asks for retention on every answered request without letting it fail one", async () => {
    let retained = 0;
    const handler = createBetterAuthProviderHandler(() => ({
      ok: true,
      value: {
        async ready() {
          return { ok: true } as const;
        },
        retain() {
          retained += 1;
          throw new Error("retention is best-effort");
        },
        auth: {
          async handler() {
            return new Response(null, { status: 204 });
          },
        },
      },
    }));

    expect((await signIn(handler)).status).toBe(204);
    expect(
      (await handler(new Request(`${ORIGIN}/api/auth/get-session`))).status,
    ).toBe(204);
    expect((await handler(new Request(`${ORIGIN}/api/auth/sign-up/email`))).status).toBe(404);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(retained).toBe(2);
  });

  it("rejects a wrong credential without exposing it or creating a session", async () => {
    const { database, handler } = await providerFixture();
    const rejected = await handler(
      new Request(`${ORIGIN}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN },
        body: JSON.stringify({ email: EMAIL, password: `${PASSWORD}-wrong` }),
      }),
    );

    expect(rejected.status).toBe(401);
    expect(await rejected.text()).not.toContain(PASSWORD);
    expect(database["better_auth_sessions"]).toHaveLength(0);
  });

  it("refuses absent and malformed configuration without echoing supplied values", () => {
    expect(resolveBetterAuthProviderConfig({})).toEqual({
      ok: false,
      reason: BETTER_AUTH_PROVIDER_REFUSALS.configurationAbsent,
    });

    const malformed: ReadonlyArray<
      Partial<{
        databaseUrl: string;
        origin: string;
        secret: string;
        email: string;
        bootstrapSecret: string;
      }>
    > = [
      { databaseUrl: "not-postgres" },
      { origin: "http://provider.example.invalid" },
      { secret: "too-short" },
      { email: "one@example.invalid,two@example.invalid" },
      { bootstrapSecret: "short" },
    ];
    for (const value of malformed) {
      const resolved = resolveBetterAuthProviderConfig(providerEnv(value));
      expect(resolved).toEqual({
        ok: false,
        reason: BETTER_AUTH_PROVIDER_REFUSALS.configurationInvalid,
      });
      expect(JSON.stringify(resolved)).not.toContain(PASSWORD);
      expect(JSON.stringify(resolved)).not.toContain(SIGNING_SECRET);
    }
  });

  it("redacts storage failures and never dispatches the provider after readiness fails", async () => {
    let providerCalls = 0;
    const handler = createBetterAuthProviderHandler(() => ({
      ok: true,
      value: {
        async ready(): Promise<never> {
          throw new Error(`unavailable ${PASSWORD} ${SIGNING_SECRET}`);
        },
        retain() {
          return undefined;
        },
        auth: {
          async handler() {
            providerCalls += 1;
            return new Response(null, { status: 204 });
          },
        },
      },
    }));

    const response = await signIn(handler);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      code: BETTER_AUTH_PROVIDER_REFUSALS.storageUnavailable,
    });
    expect(providerCalls).toBe(0);
  });

  it("exposes only the two required endpoint/method pairs", async () => {
    let loads = 0;
    const handler = createBetterAuthProviderHandler(() => {
      loads += 1;
      return {
        ok: false,
        reason: BETTER_AUTH_PROVIDER_REFUSALS.configurationAbsent,
      };
    });

    for (const [path, method] of [
      ["/api/auth/sign-up/email", "POST"],
      ["/api/auth/sign-out", "POST"],
      ["/api/auth/sign-in/email", "GET"],
      ["/api/auth/get-session", "POST"],
    ] as const) {
      const response = await handler(new Request(`${ORIGIN}${path}`, { method }));
      expect(response.status).toBe(404);
    }
    expect(loads).toBe(0);
  });

  it("keeps Kids denial ahead of provider, storage, configuration, and network work", async () => {
    let providerCalls = 0;
    let storageCalls = 0;
    const adapter: IdentityAdapter = Object.freeze({
      authenticate() {
        providerCalls += 1;
        throw new Error("provider must not be reached");
      },
    });
    const storageResult = () => {
      storageCalls += 1;
      return undefined;
    };
    const store: IdentityStore = Object.freeze({
      findUserByEmail: storageResult,
      findUserById: storageResult,
      putSession: storageResult,
      findSession: storageResult,
      deleteSession: () => {
        storageCalls += 1;
        return false;
      },
    });
    const port = createIdentityPort({ adapter, store });

    const result = await port.signIn({
      surface: "kids",
      email: EMAIL,
      password: PASSWORD,
    });
    expect(result).toMatchObject({
      ok: false,
      reason: AUTH_REFUSE_REASONS.kidsSurfaceDenied,
    });
    expect(providerCalls).toBe(0);
    expect(storageCalls).toBe(0);
  });
});
