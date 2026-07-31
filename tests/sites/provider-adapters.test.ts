import { describe, expect, it } from "vitest";
import {
  createIdentityPort,
  createInMemoryIdentityStore,
  digestSessionToken,
  resolveAdminIdentity,
  type BetterAuthInstanceLike,
} from "@sceneaxi/auth";
import {
  loadLedgerState,
  meterCredits,
  signStripeWebhookPayload,
} from "@sceneaxi/billing";
import {
  applyCreditPackWebhook,
  createDeploymentPlaneHandles,
  createStripeCheckoutEvidenceAdapter,
  createStripeCheckoutSessionAdapter,
  type NeonDatabase,
  type SqlRow,
  type StripeClientLike,
} from "../../sites/umbrella/src/index.ts";

const NOW = Date.parse("2026-07-26T12:00:00.000Z");
const iso = (offset: number) => new Date(NOW + offset).toISOString();

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

function createDatabase(withAccount = true) {
  const calls: string[] = [];
  const users: SqlRow[] = [];
  const accounts: SqlRow[] = withAccount ? [accountRow] : [];
  const sessions: SqlRow[] = [];
  const entries: SqlRow[] = [];
  const intents: SqlRow[] = [];

  const database: NeonDatabase = {
    async query(query, values = []) {
      calls.push(query);
      if (query.includes("WITH ensured_user")) {
        const userId = text(values[0]);
        if (!users.some((row) => row.user_id === userId)) {
          users.push({
            user_id: userId,
            email: text(values[1]),
            email_verified: values[2] === true,
            disabled: false,
            created_at: values[3] ?? "",
          });
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
    async transaction(statements) {
      for (const statement of statements) {
        if (!statement.text.includes("credit_ledger_entries")) continue;
        const existing = entries.find(
          (row) => row.idempotency_key === text(statement.values[7]),
        );
        if (existing === undefined) entries.push(rowForEntry(statement.values));
      }
      return [];
    },
  };

  return { database, calls, users, accounts, entries, intents };
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

  it("grants the starter and spends through the Neon store's append-or-replay boundary", async () => {
    const fixture = createDatabase();
    const handles = createDeploymentPlaneHandles({
      env: {},
      providers: { database: fixture.database },
      clock: () => NOW,
    });
    const store = handles.creditStore;
    if (store === undefined) return;

    const account = await store.findAccountByUserId("member-1");
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
});
