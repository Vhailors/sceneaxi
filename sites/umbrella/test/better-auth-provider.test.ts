import { memoryAdapter, type MemoryDB } from "better-auth/adapters/memory";
import { hashPassword } from "better-auth/crypto";
import { describe, expect, it } from "vitest";
import {
  AUTH_REFUSE_REASONS,
  createIdentityPort,
  type IdentityAdapter,
  type IdentityStore,
} from "@sceneaxi/auth";
import {
  BETTER_AUTH_PROVIDER_REFUSALS,
  createBetterAuthProviderHandler,
  createBetterAuthProviderRuntime,
  resolveBetterAuthProviderConfig,
  type BetterAuthProviderConfig,
  type BetterAuthProviderRuntimeResult,
} from "../src/lib/better-auth-provider.js";

const ORIGIN = "https://auth.example.invalid";
const EMAIL = ["captain", "example.invalid"].join("@");
const PASSWORD = ["Synthetic", "Credential", "42!"].join("");
const SIGNING_SECRET = "synthetic-provider-signing-material".padEnd(48, "x");

function providerEnv(overrides: Readonly<Record<string, string>> = {}) {
  return Object.fromEntries([
    ["DATABASE_URL", overrides["databaseUrl"] ?? "postgresql://synthetic.invalid/sceneaxi"],
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
        async ready() {
          throw new Error(`unavailable ${PASSWORD} ${SIGNING_SECRET}`);
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
