import { describe, expect, it } from "vitest";
import {
  AUTH_REFUSE_REASONS,
  createIdentityPort,
  createInMemoryIdentityStore,
  digestSessionToken,
  resolveAdminIdentity,
  type BetterAuthInstanceLike,
} from "@sceneaxi/auth";
import {
  loadLedgerState,
  meterCredits,
  saleEntryKeys,
  signStripeWebhookPayload,
  type CreditsSaleSettlement,
} from "@sceneaxi/billing";
import {
  applyCreditPackWebhook,
  createDeploymentPlaneHandles,
  createNeonCheckoutIntentStore,
  createNeonCreditStore,
  createNeonDatabase,
  createNeonIdentityStore,
  createProvisioningIdentityAdapter,
  createStripeCheckoutEvidenceAdapter,
  createStripeCheckoutSessionAdapter,
  createStripeClient,
  resolveBetterAuthOrigin,
  type NeonDatabase,
  type SqlRow,
  type StripeClientLike,
} from "../../sites/umbrella/src/index.ts";

const NOW = Date.parse("2026-07-26T12:00:00.000Z");
const iso = (offset: number) => new Date(NOW + offset).toISOString();

/**
 * Placeholders for the two provider constructors, deliberately shaped so they can
 * never read as a credential: the repo-wide scan in
 * `tests/contracts/no-committed-secrets.test.ts` matches a Stripe key body of eight
 * or more alphanumerics and any Postgres connection URL, and this file earns no
 * exemption from it. The adapters only inspect the `sk_test_` prefix and hand the
 * connection string straight to an injected fake factory, so the non-alphanumeric
 * suffix and the non-URL string exercise exactly the same paths.
 */
const TEST_MODE_KEY = "sk_test_fixture-key";
const LIVE_MODE_KEY = "sk_live_fixture-key";
const FIXTURE_CONNECTION = "neon-fixture-connection";

const accountRow = {
  account_id: "acct_member_1",
  user_id: "member-1",
  created_at: iso(-86_400_000),
};

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function rowForEntry(values: ReadonlyArray<unknown>): SqlRow {
  return {
    entry_id: text(values[0]),
    account_id: text(values[1]),
    sequence: values[2] ?? 0,
    movement: values[3] ?? "",
    delta: values[4] ?? 0,
    balance_after: values[5] ?? 0,
    reason: values[6] ?? "",
    idempotency_key: text(values[7]),
    occurred_at: values[8] ?? "",
  };
}

function rowForShare(values: ReadonlyArray<unknown>): SqlRow {
  return {
    sale_id: text(values[0]),
    listing_id: text(values[1]),
    buyer_user_id: text(values[2]),
    creator_user_id: text(values[3]),
    gross_credits: values[4] ?? 0,
    creator_credits: values[5] ?? 0,
    platform_credits: values[6] ?? 0,
    basis_points: values[7] ?? 0,
    occurred_at: values[8] ?? "",
  };
}

function createDatabase(withAccount = true) {
  const calls: string[] = [];
  const users: SqlRow[] = [];
  const accounts: SqlRow[] = withAccount ? [accountRow] : [];
  const sessions: SqlRow[] = [];
  const entries: SqlRow[] = [];
  const intents: SqlRow[] = [];
  const shares: SqlRow[] = [];

  const database: NeonDatabase = {
    async query(query, values = []) {
      calls.push(query);
      if (query.includes("WITH ensured_user")) {
        const userId = text(values[0]);
        const heldIndex = users.findIndex((row) => row.user_id === userId);
        if (heldIndex === -1) {
          users.push({
            user_id: userId,
            email: text(values[1]),
            email_verified: values[2] === true,
            disabled: false,
            created_at: values[3] ?? "",
          });
        } else {
          // `ON CONFLICT (user_id) DO UPDATE` reconciles exactly the two
          // provider-owned columns and leaves the deployment-owned ones alone.
          users[heldIndex] = {
            ...users[heldIndex],
            email: text(values[1]),
            email_verified: values[2] === true,
          };
        }
        if (!accounts.some((row) => row.user_id === userId)) {
          accounts.push({
            account_id: text(values[4]),
            user_id: userId,
            created_at: values[3] ?? "",
          });
        }
        return [];
      }
      if (query.includes("FROM users WHERE")) {
        const key = query.includes("email =") ? "email" : "user_id";
        const found = users.find((row) => row[key] === values[0]);
        return found === undefined ? [] : [found];
      }
      if (query.startsWith("INSERT INTO sessions")) {
        const row = {
          session_id: values[0],
          user_id: values[1],
          surface: values[2],
          issued_at: values[3],
          expires_at: values[4],
          token_digest: values[5],
        };
        const index = sessions.findIndex((held) => held.session_id === row.session_id);
        if (index === -1) sessions.push(row);
        else sessions[index] = row;
        return [];
      }
      if (query.startsWith("SELECT session_id")) {
        const found = sessions.find((row) => row.session_id === values[0]);
        return found === undefined ? [] : [found];
      }
      if (query.startsWith("DELETE FROM sessions")) {
        const index = sessions.findIndex(
          (row) =>
            row.session_id === values[0] &&
            row.user_id === values[1] &&
            row.surface === values[2] &&
            row.issued_at === values[3] &&
            row.expires_at === values[4] &&
            row.token_digest === values[5],
        );
        if (index === -1) return [];
        const [removed] = sessions.splice(index, 1);
        return removed === undefined ? [] : [removed];
      }
      if (query.includes("FROM credit_accounts WHERE")) {
        const key = query.includes("user_id =") ? "user_id" : "account_id";
        const found = accounts.find((row) => row[key] === values[0]);
        return found === undefined ? [] : [found];
      }
      if (query.includes("FROM credit_ledger_entries WHERE account_id")) {
        return entries
          .filter((row) => row.account_id === values[0])
          .sort((left, right) => Number(left.sequence) - Number(right.sequence));
      }
      if (query.includes("FROM credit_ledger_entries WHERE idempotency_key")) {
        const found = entries.find((row) => row.idempotency_key === values[0]);
        return found === undefined ? [] : [found];
      }
      if (query.includes("INSERT INTO credit_ledger_entries")) {
        const key = text(values[7]);
        const existing = entries.find((row) => row.idempotency_key === key);
        if (existing !== undefined) return [];
        const row = rowForEntry(values);
        entries.push(row);
        return query.includes("RETURNING") ? [row] : [];
      }
      if (query.includes("FROM creator_share_records WHERE sale_id")) {
        const found = shares.find((row) => row.sale_id === values[0]);
        return found === undefined ? [] : [found];
      }
      if (query.startsWith("SELECT intent_id")) {
        const found = intents.find((row) => row.intent_id === values[0]);
        return found === undefined ? [] : [found];
      }
      if (query.includes("INSERT INTO checkout_session_intents")) {
        if (!intents.some((row) => row.intent_id === values[0])) {
          intents.push({
            intent_id: values[0],
            user_id: values[1],
            purpose: values[2],
            item_id: values[3],
            credits: values[4],
            unit_amount: values[5],
            currency: values[6],
            stripe_price_id: values[7],
            mode: values[8],
            success_url: values[9],
            cancel_url: values[10],
            idempotency_key: values[11],
            created_at: values[12],
          });
        }
        return [];
      }
      throw new Error(`unhandled fake SQL: ${query}`);
    },
    // Staged then committed together, so a statement rejected part-way through
    // leaves the fake ledger exactly as Postgres would leave the real one.
    async transaction(statements) {
      const stagedEntries: SqlRow[] = [];
      const stagedShares: SqlRow[] = [];
      for (const statement of statements) {
        calls.push(statement.text);
        if (statement.text.includes("credit_ledger_entries")) {
          const key = text(statement.values[7]);
          if (entries.some((row) => row.idempotency_key === key)) {
            throw new Error(`duplicate ledger idempotency key ${key}`);
          }
          stagedEntries.push(rowForEntry(statement.values));
          continue;
        }
        if (statement.text.includes("creator_share_records")) {
          const saleId = text(statement.values[0]);
          if (shares.some((row) => row.sale_id === saleId)) {
            throw new Error(`duplicate sale ${saleId}`);
          }
          stagedShares.push(rowForShare(statement.values));
          continue;
        }
        throw new Error(`unhandled fake transaction statement: ${statement.text}`);
      }
      entries.push(...stagedEntries);
      shares.push(...stagedShares);
      return statements.map(() => []);
    },
  };

  return { database, calls, users, accounts, sessions, entries, intents, shares };
}

const authProvider: BetterAuthInstanceLike = {
  api: {
    async signInEmail() {
      return {
        user: {
          id: "member-1",
          email: "member@example.com",
          emailVerified: true,
        },
        session: {
          id: "provider-session-1",
          token: "provider-token-1",
          userId: "member-1",
          expiresAt: iso(3_600_000),
        },
      };
    },
  },
};

describe("umbrella deployment provider adapters", () => {
  it("provisions one account with the SceneAxi user exactly once at authentication", async () => {
    const fixture = createDatabase(false);
    const handles = createDeploymentPlaneHandles({
      env: { SCENEAXI_ADMIN_EMAIL: "captain@example.com" },
      providers: { database: fixture.database, betterAuth: authProvider },
      clock: () => NOW,
    });

    expect(handles.identityPort).toBeDefined();
    const port = handles.identityPort;
    if (port === undefined) return;
    const first = await port.signIn({
      surface: "site",
      email: "member@example.com",
      password: "test-password",
    });
    const second = await port.signIn({
      surface: "site",
      email: "member@example.com",
      password: "test-password",
    });

    expect(first).toMatchObject({ ok: true, value: { user: { userId: "member-1" }, role: { role: "user" } } });
    expect(second).toMatchObject({ ok: true, value: { user: { userId: "member-1" }, role: { role: "user" } } });
    // Provisioning happened before the identity port read the SceneAxi user.
    expect(fixture.users).toHaveLength(1);
    expect(fixture.accounts).toHaveLength(1);
    expect(fixture.accounts.filter((row) => row.user_id === "member-1")).toHaveLength(1);
    expect(fixture.calls.filter((query) => query.includes("WITH ensured_user"))).toHaveLength(2);
  });

  it("reconciles the provider's address and verification state on every authentication", async () => {
    const fixture = createDatabase(false);
    let providerUser = {
      id: "member-1",
      email: "captain@example.com",
      emailVerified: false,
    };
    const mutableProvider: BetterAuthInstanceLike = {
      api: {
        async signInEmail() {
          return {
            user: providerUser,
            session: {
              id: "provider-session-1",
              token: "provider-token-1",
              userId: "member-1",
              expiresAt: iso(3_600_000),
            },
          };
        },
      },
    };
    const handles = createDeploymentPlaneHandles({
      env: { SCENEAXI_ADMIN_EMAIL: "captain@example.com" },
      providers: { database: fixture.database, betterAuth: mutableProvider },
      clock: () => NOW,
    });
    expect(handles.identityPort).toBeDefined();
    const port = handles.identityPort;
    if (port === undefined) return;

    // Signing in before verifying the address writes an unverified row, and admin
    // elevation refuses by name against that stored record.
    const unverified = await port.signIn({
      surface: "site",
      email: "captain@example.com",
      password: "test-password",
    });
    expect(unverified).toMatchObject({
      ok: false,
      reason: AUTH_REFUSE_REASONS.adminEmailUnverified,
    });

    // Verifying at the provider must repair the row: the provider owns the column,
    // so the next authentication reconciles it rather than freezing the refusal.
    providerUser = { ...providerUser, emailVerified: true };
    const verified = await port.signIn({
      surface: "site",
      email: "captain@example.com",
      password: "test-password",
    });
    expect(verified).toMatchObject({
      ok: true,
      value: { user: { userId: "member-1" }, role: { role: "admin" } },
    });

    // A provider-side address change is followed too, so the by-email lookup keeps
    // resolving the same SceneAxi user instead of refusing `userNotFound`.
    providerUser = { ...providerUser, email: "captain.new@example.com" };
    const renamed = await port.signIn({
      surface: "site",
      email: "captain.new@example.com",
      password: "test-password",
    });
    expect(renamed).toMatchObject({ ok: true, value: { user: { userId: "member-1" } } });
    expect(fixture.users).toHaveLength(1);
    expect(fixture.users[0]).toMatchObject({
      user_id: "member-1",
      email: "captain.new@example.com",
      email_verified: true,
      disabled: false,
    });
    // Reconciling the user never provisions a second credit account.
    expect(fixture.accounts).toHaveLength(1);
  });

  it("maps provider rows to identity sessions and preserves the token digest boundary", async () => {
    const fixture = createDatabase();
    const store = createDeploymentPlaneHandles({
      env: {},
      providers: { database: fixture.database },
    }).creditStore;
    expect(store).toBeDefined();

    const identityStore = createInMemoryIdentityStore({
      users: [
        {
          schemaVersion: 1,
          kind: "sceneaxi.user",
          userId: "member-1",
          email: "member@example.com",
          emailVerified: true,
          disabled: false,
          createdAt: iso(-86_400_000),
        },
      ],
    });
    const admin = resolveAdminIdentity({ SCENEAXI_ADMIN_EMAIL: "member@example.com" });
    expect(admin.ok).toBe(true);
    if (!admin.ok || store === undefined) return;
    const port = createIdentityPort({
      store: identityStore,
      admin: admin.value,
      clock: () => NOW,
      adapter: { authenticate: () => undefined },
    });
    const session = {
      schemaVersion: 1 as const,
      kind: "sceneaxi.session" as const,
      sessionId: "session-1",
      userId: "member-1",
      surface: "site" as const,
      issuedAt: iso(-1_000),
      expiresAt: iso(3_600_000),
      tokenDigest: digestSessionToken("token-1"),
    };
    await identityStore.putSession(session);
    const verified = await port.verifySession({
      surface: "site",
      sessionId: session.sessionId,
      token: "token-1",
    });
    expect(verified.ok).toBe(true);
    expect(await store.findAccountByUserId("member-1")).toMatchObject({
      userId: "member-1",
    });
  });

  it("round-trips a session row through the Neon store's write, read, and delete", async () => {
    const fixture = createDatabase();
    const store = createNeonIdentityStore(fixture.database);
    const session = {
      schemaVersion: 1 as const,
      kind: "sceneaxi.session" as const,
      sessionId: "session-round-trip",
      userId: "member-1",
      surface: "site" as const,
      issuedAt: iso(-1_000),
      expiresAt: iso(3_600_000),
      tokenDigest: digestSessionToken("token-round-trip"),
    };

    await store.putSession(session);
    expect(fixture.sessions).toHaveLength(1);
    expect(fixture.sessions[0]).toEqual({
      session_id: session.sessionId,
      user_id: session.userId,
      surface: session.surface,
      issued_at: session.issuedAt,
      expires_at: session.expiresAt,
      token_digest: session.tokenDigest,
    });
    expect(await store.findSession(session.sessionId)).toEqual(session);

    const rotated = {
      ...session,
      expiresAt: iso(7_200_000),
      tokenDigest: digestSessionToken("token-round-trip-2"),
    };
    await store.putSession(rotated);
    expect(fixture.sessions).toHaveLength(1);
    expect(await store.findSession(session.sessionId)).toEqual(rotated);

    expect(await store.deleteSession({ ...rotated, tokenDigest: session.tokenDigest })).toBe(
      false,
    );
    expect(await store.deleteSession({ ...rotated, issuedAt: iso(-2_000) })).toBe(false);
    expect(fixture.sessions).toHaveLength(1);

    expect(await store.deleteSession(rotated)).toBe(true);
    expect(fixture.sessions).toHaveLength(0);
    expect(await store.findSession(session.sessionId)).toBeUndefined();
    expect(await store.deleteSession(rotated)).toBe(false);
  });

  it("grants the starter and spends through the Neon store's append-or-replay boundary", async () => {
    const fixture = createDatabase();
    const handles = createDeploymentPlaneHandles({
      env: {},
      providers: { database: fixture.database },
      clock: () => NOW,
    });
    const store = handles.creditStore;
    expect(store).toBeDefined();
    if (store === undefined) return;

    const account = await store.findAccountByUserId("member-1");
    expect(account).toBeDefined();
    if (account === undefined) return;
    const initial = loadLedgerState(account, await store.listEntries(account.accountId));
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;

    const admin = resolveAdminIdentity({ SCENEAXI_ADMIN_EMAIL: "captain@example.com" });
    if (!admin.ok) return;
    const identity = createInMemoryIdentityStore({
      users: [
        {
          schemaVersion: 1,
          kind: "sceneaxi.user",
          userId: "member-1",
          email: "member@example.com",
          emailVerified: true,
          disabled: false,
          createdAt: iso(-1_000),
        },
      ],
    });
    const identityPort = createIdentityPort({
      store: identity,
      admin: admin.value,
      clock: () => NOW,
      adapter: { authenticate: () => undefined },
    });
    await identity.putSession({
      schemaVersion: 1,
      kind: "sceneaxi.session",
      sessionId: "session-1",
      userId: "member-1",
      surface: "site",
      issuedAt: iso(-1_000),
      expiresAt: iso(3_600_000),
      tokenDigest: digestSessionToken("token-1"),
    });
    const principal = await identityPort.verifySession({
      surface: "site",
      sessionId: "session-1",
      token: "token-1",
    });
    expect(principal.ok).toBe(true);
    if (!principal.ok) return;

    const plane = createDeploymentPlaneHandles({
      env: {},
      providers: { database: fixture.database },
      clock: () => NOW,
    });
    const credits = plane.creditStore;
    expect(credits).toBeDefined();
    if (credits === undefined) return;
    const withStarter = await credits.appendOrReplayEntry({
      schemaVersion: 1,
      kind: "sceneaxi.credit-ledger-entry",
      entryId: "entry-starter",
      accountId: account.accountId,
      sequence: 1,
      movement: "grant",
      delta: 100,
      balanceAfter: 100,
      reason: "starter credits",
      idempotencyKey: "starter:member-1",
      occurredAt: iso(0),
    });
    expect(withStarter.replayed).toBe(false);

    const state = loadLedgerState(account, await credits.listEntries(account.accountId));
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    const spent = await meterCredits({
      principal: principal.value,
      admin: admin.value,
      store: credits,
      state: state.value,
      amount: 10,
      reason: "test hosted call",
      idempotencyKey: "turn-1",
      now: NOW,
      surface: "site",
    });
    expect(spent).toMatchObject({ ok: true, value: { balance: 90, metered: true } });
    expect(fixture.entries).toHaveLength(2);
  });

  it("persists a TEST intent before creating Stripe checkout and stamps contract metadata", async () => {
    const calls: string[] = [];
    const intent = {
      schemaVersion: 1 as const,
      kind: "sceneaxi.checkout-session-intent" as const,
      intentId: "int_test_1",
      userId: "member-1",
      purpose: "credit-pack" as const,
      itemId: "starter",
      credits: 100,
      unitAmount: 500,
      currency: "usd",
      stripePriceId: "price_test_starter_100",
      mode: "test" as const,
      successUrl: "https://sceneaxi.test/account",
      cancelUrl: "https://sceneaxi.test/pricing",
      idempotencyKey: "pack:starter:1",
      createdAt: iso(0),
    };
    const stripe = {
      checkout: {
        sessions: {
          async create(params) {
            calls.push(JSON.stringify(params));
            return { url: "https://checkout.stripe.test/cs_test_1" };
          },
          async retrieve() {
            return {};
          },
        },
      },
    } satisfies StripeClientLike;
    const adapter = createStripeCheckoutSessionAdapter({
      stripe,
      intents: {
        async persistIntent(value) {
          expect(value).toEqual(intent);
          return value;
        },
        async findIntent() {
          return intent;
        },
      },
    });
    await expect(adapter.createCheckoutSession(intent)).resolves.toEqual({
      redirectUrl: "https://checkout.stripe.test/cs_test_1",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("sceneaxiUserId");
    expect(calls[0]).toContain("sceneaxiPurpose");
    expect(calls[0]).toContain("sceneaxiIntentId");
  });

  it("replays a persisted intent when the same idempotency key is submitted again", async () => {
    const fixture = createDatabase();
    const intents = createNeonCheckoutIntentStore(fixture.database);
    const first = {
      schemaVersion: 1 as const,
      kind: "sceneaxi.checkout-session-intent" as const,
      intentId: "int_test_replay",
      userId: "member-1",
      purpose: "credit-pack" as const,
      itemId: "starter",
      credits: 100,
      unitAmount: 500,
      currency: "usd",
      stripePriceId: "price_test_starter_100",
      mode: "test" as const,
      successUrl: "https://sceneaxi.test/account",
      cancelUrl: "https://sceneaxi.test/pricing",
      idempotencyKey: "pack:starter:user:member-1:attempt:a",
      createdAt: iso(0),
    };
    await expect(intents.persistIntent(first)).resolves.toEqual(first);

    // The same rendered form submitted twice reuses its attempt token, so the
    // derived intent id and every price column match while the clock has moved.
    // That is the retry the idempotency key exists to absorb, not a conflict.
    const retried = { ...first, createdAt: iso(4_000) };
    await expect(intents.persistIntent(retried)).resolves.toEqual(first);
    expect(fixture.intents).toHaveLength(1);
    expect(fixture.intents[0]).toMatchObject({ created_at: first.createdAt });

    // A price-bearing difference under the same id is still a hard conflict.
    await expect(
      intents.persistIntent({ ...first, unitAmount: 900 }),
    ).rejects.toThrow(/checkout intent conflict/);
  });

  it("runs a persisted TEST intent through webhook grant and replay on the Neon store", async () => {
    const fixture = createDatabase();
    const stripe = {
      checkout: {
        sessions: {
          async create() {
            return { url: "https://checkout.stripe.test/cs_provider_1" };
          },
          async retrieve() {
            return {
              id: "cs_provider_1",
              payment_status: "paid",
              amount_total: 500,
              currency: "usd",
              line_items: {
                data: [{ quantity: 1, price: { id: "price_test_starter_100" } }],
              },
            };
          },
        },
      },
    } satisfies StripeClientLike;
    const handles = createDeploymentPlaneHandles({
      env: {},
      providers: { database: fixture.database, stripe },
    });
    const checkout = handles.checkoutSessions;
    const store = handles.creditStore;
    const evidence = handles.checkoutEvidence;
    expect(checkout).toBeDefined();
    expect(store).toBeDefined();
    expect(evidence).toBeDefined();
    if (checkout === undefined || store === undefined || evidence === undefined) return;
    const intent = {
      schemaVersion: 1 as const,
      kind: "sceneaxi.checkout-session-intent" as const,
      intentId: "int_provider_grant_1",
      userId: "member-1",
      purpose: "credit-pack" as const,
      itemId: "starter",
      credits: 100,
      unitAmount: 500,
      currency: "usd",
      stripePriceId: "price_test_starter_100",
      mode: "test" as const,
      successUrl: "https://sceneaxi.test/account",
      cancelUrl: "https://sceneaxi.test/pricing",
      idempotencyKey: "provider:checkout:1",
      createdAt: iso(0),
    };
    await checkout.createCheckoutSession(intent);
    const payload = JSON.stringify({
      id: "evt_provider_grant_1",
      type: "checkout.session.completed",
      created: Math.floor(NOW / 1_000),
      livemode: false,
      data: {
        object: {
          id: "cs_provider_1",
          metadata: {
            sceneaxiUserId: "member-1",
            sceneaxiPurpose: "credit-pack",
            sceneaxiItemId: "starter",
            sceneaxiIntentId: intent.intentId,
          },
        },
      },
    });
    const signed = signStripeWebhookPayload({
      payload,
      secret: "whsec_test_provider_fixture",
      timestamp: Math.floor(NOW / 1_000),
    });
    const first = await applyCreditPackWebhook({
      payload,
      signatureHeader: signed,
      secret: "whsec_test_provider_fixture",
      store,
      evidence,
      now: NOW,
    });
    const replay = await applyCreditPackWebhook({
      payload,
      signatureHeader: signed,
      secret: "whsec_test_provider_fixture",
      store,
      evidence,
      now: NOW,
    });
    expect(first).toMatchObject({ ok: true, ignored: false, replayed: false, credits: 100 });
    expect(replay).toMatchObject({ ok: true, ignored: false, replayed: true, credits: 100 });
    expect(fixture.entries).toHaveLength(1);
  });

  it("fails closed when the deployment has no Neon provider", () => {
    const handles = createDeploymentPlaneHandles({ env: {} });
    expect(handles).toEqual({});
  });

  it("echoes Stripe's retrieved session id so the core parser owns mismatch refusal", async () => {
    const stripe = {
      checkout: {
        sessions: {
          async create() {
            return {};
          },
          async retrieve() {
            return {
              id: "cs_other",
              payment_status: "paid",
              amount_total: 500,
              currency: "usd",
              line_items: {
                data: [{ quantity: 1, price: { id: "price_test_starter_100" } }],
              },
            };
          },
        },
      },
    } satisfies StripeClientLike;
    const evidence = createStripeCheckoutEvidenceAdapter({
      stripe,
      intents: {
        async persistIntent(value) {
          return value;
        },
        async findIntent() {
          return undefined;
        },
      },
    });
    await expect(evidence.retrieveSettlement("cs_requested")).resolves.toMatchObject({
      sessionId: "cs_other",
      amountTotal: 500,
    });
  });

  it("refuses a Kids surface on both halves of the session row path", async () => {
    const fixture = createDatabase();
    const store = createNeonIdentityStore(fixture.database);
    fixture.sessions.push({
      session_id: "session-kids",
      user_id: "member-1",
      surface: "kids",
      issued_at: iso(-1_000),
      expires_at: iso(3_600_000),
      token_digest: digestSessionToken("token-kids"),
    });

    await expect(store.findSession("session-kids")).rejects.toThrow(/Kids surface/);
    await expect(
      store.putSession({
        schemaVersion: 1,
        kind: "sceneaxi.session",
        sessionId: "session-kids-2",
        userId: "member-1",
        surface: "kids",
        issuedAt: iso(-1_000),
        expiresAt: iso(3_600_000),
        tokenDigest: digestSessionToken("token-kids-2"),
      }),
    ).rejects.toThrow(/Kids surface/);
    expect(fixture.sessions).toHaveLength(1);
  });

  it("refuses a Kids surface before the provider or the provisioning write", async () => {
    const seen: string[] = [];
    const adapter = createProvisioningIdentityAdapter({
      adapter: {
        authenticate(credentials) {
          seen.push(`authenticate:${credentials.surface}`);
          return undefined;
        },
      },
      provision() {
        seen.push("provision");
      },
      clock: () => NOW,
    });

    await expect(
      adapter.authenticate({
        surface: "kids",
        email: "member@example.com",
        password: "test-password",
      }),
    ).rejects.toThrow(/Kids surface/);
    expect(seen).toEqual([]);
    await adapter.authenticate({
      surface: "site",
      email: "member@example.com",
      password: "test-password",
    });
    expect(seen).toEqual(["authenticate:site"]);
  });

  it("constructs Stripe from both the CommonJS and the ES module export shape", () => {
    class FakeStripe {
      readonly key: string;
      readonly checkout = { sessions: { create: async () => ({}), retrieve: async () => ({}) } };
      constructor(key: string) {
        this.key = key;
      }
    }

    for (const loaded of [
      FakeStripe,
      Object.assign(FakeStripe, { default: FakeStripe }),
      { default: FakeStripe },
      { Stripe: FakeStripe },
      { default: { default: FakeStripe } },
    ]) {
      const client = createStripeClient(TEST_MODE_KEY, () => loaded);
      expect(client).toBeInstanceOf(FakeStripe);
      expect((client as unknown as FakeStripe).key).toBe(TEST_MODE_KEY);
    }

    expect(() => createStripeClient(TEST_MODE_KEY, () => ({}))).toThrow(
      /Stripe provider is unavailable/,
    );
    expect(() => createStripeClient(LIVE_MODE_KEY, () => FakeStripe)).toThrow(
      /TEST keys only/,
    );
  });

  it("reads the Neon factory from a CommonJS or an ES module namespace", () => {
    const sql = Object.assign(() => undefined, {
      query: async () => [],
      transaction: async () => [],
    });
    const neon = () => sql;

    for (const loaded of [{ neon }, { default: { neon } }]) {
      expect(createNeonDatabase(FIXTURE_CONNECTION, () => loaded)).toBeDefined();
    }
    expect(() => createNeonDatabase(FIXTURE_CONNECTION, () => ({}))).toThrow(
      /Neon provider is unavailable/,
    );
  });

  it("accepts a remote auth origin only over https or an exact loopback host", () => {
    expect(resolveBetterAuthOrigin("https://auth.sceneaxi.test")).toBe(
      "https://auth.sceneaxi.test",
    );
    expect(resolveBetterAuthOrigin("http://localhost:3000/api")).toBe(
      "http://localhost:3000",
    );
    expect(resolveBetterAuthOrigin("http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
    expect(resolveBetterAuthOrigin("http://[::1]:3000")).toBe("http://[::1]:3000");
    // A prefix match would have handed a member's password to these hosts.
    expect(resolveBetterAuthOrigin("http://localhost.attacker.example")).toBeUndefined();
    expect(resolveBetterAuthOrigin("http://localhostfoo:3000")).toBeUndefined();
    expect(resolveBetterAuthOrigin("http://auth.sceneaxi.test")).toBeUndefined();
    expect(resolveBetterAuthOrigin("ftp://localhost")).toBeUndefined();
    expect(resolveBetterAuthOrigin("not-a-url")).toBeUndefined();
    expect(resolveBetterAuthOrigin("   ")).toBeUndefined();
    expect(resolveBetterAuthOrigin(undefined)).toBeUndefined();
  });
});

const SALE_ID = "sale-fixture-1";
const CREATOR_ACCOUNT = "acct_creator_1";

function saleSettlement(
  overrides: {
    readonly creatorAccountId?: string;
    readonly shareOccurredAt?: string;
  } = {},
): CreditsSaleSettlement {
  const keys = saleEntryKeys(SALE_ID);
  return {
    buyerEntry: {
      schemaVersion: 1,
      kind: "sceneaxi.credit-ledger-entry",
      entryId: "entry-sale-buyer",
      accountId: "acct_member_1",
      sequence: 1,
      movement: "debit",
      delta: -100,
      balanceAfter: 0,
      reason: "catalog listing purchase",
      idempotencyKey: keys.buyer,
      occurredAt: iso(0),
    },
    creatorEntry: {
      schemaVersion: 1,
      kind: "sceneaxi.credit-ledger-entry",
      entryId: "entry-sale-creator",
      accountId: overrides.creatorAccountId ?? CREATOR_ACCOUNT,
      sequence: 1,
      movement: "grant",
      delta: 50,
      balanceAfter: 50,
      reason: "creator revenue share",
      idempotencyKey: keys.creator,
      occurredAt: iso(0),
    },
    share: {
      schemaVersion: 1,
      kind: "sceneaxi.creator-share-record",
      saleId: SALE_ID,
      listingId: "fixture-listing",
      buyerUserId: "member-1",
      creatorUserId: "creator-1",
      grossCredits: 100,
      creatorCredits: 50,
      platformCredits: 50,
      basisPoints: 5000,
      occurredAt: overrides.shareOccurredAt ?? iso(0),
    },
  };
}

function creditsFixture() {
  const fixture = createDatabase();
  fixture.accounts.push({
    account_id: CREATOR_ACCOUNT,
    user_id: "creator-1",
    created_at: iso(-86_400_000),
  });
  return fixture;
}

describe("umbrella Neon credit settlement", () => {
  it("commits both sale legs and the share record through one transaction", async () => {
    const fixture = creditsFixture();
    const store = createNeonCreditStore(fixture.database);

    await expect(store.settleCreditsSale(saleSettlement())).resolves.toEqual({
      replayed: false,
    });
    expect(fixture.entries).toHaveLength(2);
    expect(fixture.shares).toHaveLength(1);
    expect(fixture.shares[0]).toMatchObject({
      sale_id: SALE_ID,
      buyer_user_id: "member-1",
      creator_user_id: "creator-1",
      gross_credits: 100,
      creator_credits: 50,
      platform_credits: 50,
      basis_points: 5000,
    });
  });

  it("replays an identical settlement from the committed rows without appending", async () => {
    const fixture = creditsFixture();
    const store = createNeonCreditStore(fixture.database);

    await store.settleCreditsSale(saleSettlement());
    await expect(store.settleCreditsSale(saleSettlement())).resolves.toEqual({
      replayed: true,
    });
    expect(fixture.entries).toHaveLength(2);
    expect(fixture.shares).toHaveLength(1);
  });

  it("refuses a second settlement of the same sale carrying different evidence", async () => {
    const fixture = creditsFixture();
    const store = createNeonCreditStore(fixture.database);

    await store.settleCreditsSale(saleSettlement());
    await expect(
      store.settleCreditsSale(saleSettlement({ shareOccurredAt: iso(1_000) })),
    ).rejects.toThrow(/different settlement evidence/);
    expect(fixture.entries).toHaveLength(2);
    expect(fixture.shares).toHaveLength(1);
  });

  it("refuses a leg whose account belongs to the other settlement party", async () => {
    const fixture = creditsFixture();
    const store = createNeonCreditStore(fixture.database);

    await expect(
      store.settleCreditsSale(saleSettlement({ creatorAccountId: "acct_member_1" })),
    ).rejects.toThrow(/does not belong to its settlement party/);
    expect(fixture.entries).toHaveLength(0);
    expect(fixture.shares).toHaveLength(0);
  });

  it("refuses to settle a sale when the provider offers no transaction", async () => {
    const fixture = creditsFixture();
    const withoutTransaction: NeonDatabase = {
      query: (text, values) => fixture.database.query(text, values),
    };
    const store = createNeonCreditStore(withoutTransaction);

    await expect(store.settleCreditsSale(saleSettlement())).rejects.toThrow(
      /requires a Neon transaction/,
    );
    expect(fixture.entries).toHaveLength(0);
    expect(fixture.shares).toHaveLength(0);
  });

  it("keeps a sale leg out of the plain append path", () => {
    const fixture = creditsFixture();
    const store = createNeonCreditStore(fixture.database);
    const { buyerEntry } = saleSettlement();

    expect(buyerEntry).toBeDefined();
    if (buyerEntry === undefined) return;
    // The boundary guard runs synchronously, exactly as a constraint rejects
    // before the write, so this is a throw and never a rejected promise.
    expect(() => store.appendEntry(buyerEntry)).toThrow(/requires atomic settlement/);
    expect(fixture.entries).toHaveLength(0);
  });
});
