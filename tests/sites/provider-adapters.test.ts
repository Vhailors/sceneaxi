type SqlParameter = NonNullable<Parameters<NeonDatabase["query"]>[1]>[number];

function isSqlText(value: SqlParameter | undefined): value is string { return typeof value === "string"; }

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { AUTH_REFUSE_REASONS, createIdentityPort, createInMemoryIdentityStore, digestSessionToken, mapBetterAuthAuthentication, resolveAdminIdentity, type BetterAuthInstanceLike, } from "@sceneaxi/auth";
import { loadLedgerState, meterCredits, saleEntryKeys, signStripeWebhookPayload, type CreditsSaleSettlement, } from "@sceneaxi/billing";
import { applyCreditPackWebhook, createBetterAuthHttpClient, createNeonCheckoutIntentStore, createNeonConnectStore, createNeonLiveModeAuditSink, createNeonCreditStore, createNeonDatabase, createNeonIdentityStore, createProvisioningIdentityAdapter, createStripeCheckoutEvidenceAdapter, createStripeCheckoutSessionAdapter, createStripeClient, resolveBetterAuthOrigin, type NeonDatabase, type ProviderFetch, type SqlRow, type StripeClientLike, } from "../../sites/umbrella/src/index.ts";
import { createDeploymentPlaneHandles } from "../../sites/umbrella/src/lib/identity-plane.ts";
import { createNeonHostedCallStore } from "../../sites/umbrella/src/lib/provider-adapters.ts";
import { logWebhookOutcome, serverLog } from "../../sites/umbrella/src/lib/server-logger.ts";

describe("raw SQL deployment boundary compatibility", () => {
    it("compiles the formerly supported unknown-column SDK consumer without assertions", () => {
        const file = fileURLToPath(new URL("./provider-sdk-consumer.ts", import.meta.url));

        const source = `import type { NeonDatabase } from "../../sites/umbrella/src/lib/provider-adapters.js";
      const sdk = {
        async query(): Promise<ReadonlyArray<Record<string, unknown>>> { return []; },
        async transaction(): Promise<ReadonlyArray<ReadonlyArray<Record<string, unknown>>>> { return []; }
      };
      const database: NeonDatabase = sdk;
      void database;`;

        const options: ts.CompilerOptions = {
            strict: true, noEmit: true, target: ts.ScriptTarget.ES2023,
            module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
            types: ["node"],
        };

        const host = ts.createCompilerHost(options);
        const read = host.readFile;
        const exists = host.fileExists;
        host.readFile = path => path === file ? source : read(path);
        host.fileExists = path => path === file || exists(path);
        const program = ts.createProgram([file], options, host);
        const consumer = program.getSourceFile(file);
        expect(consumer).toBeDefined();

        if (consumer === undefined)
            throw new Error("consumer was not compiled");
        const diagnostics = [...program.getSyntacticDiagnostics(consumer), ...program.getSemanticDiagnostics(consumer)];
        expect(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))).toEqual([]);
    });
    it.each([
        { user_id: 7 }, { email_verified: "true" }, { disabled: 0 },
        { created_at: "not-a-date" }, { email: new Map() },
    ])("refuses invalid identity columns before constructing a trusted user: %j", async (invalid) => {
        const database = {
            async query(): Promise<ReadonlyArray<SqlRow>> {
                return [{ user_id: "raw-user", email: "raw@example.test", email_verified: true,
                        disabled: false, created_at: "2026-10-01T00:00:00Z", ...invalid }];
            },
        };

        const store = createNeonIdentityStore(database);
        await expect(store.findUserById("raw-user")).rejects.toThrow(/provider row is missing/);
    });
    it("decodes real SQL bigint and timestamp columns while rejecting unsafe integer values", async () => {
        const fixture = createDatabase();
        fixture.entries.push({ entry_id: "entry-raw", account_id: accountRow.account_id,
            sequence: "1", movement: "grant", delta: 100n, balance_after: "100",
            reason: "fixture grant", idempotency_key: "raw:grant", occurred_at: new Date(iso(0)) });
        const store = createNeonCreditStore(fixture.database);
        expect(await store.listEntries(accountRow.account_id)).toMatchObject([
            { sequence: 1, delta: 100, balanceAfter: 100, occurredAt: iso(0) },
        ]);
        fixture.entries[0] = { ...fixture.entries[0], delta: "9007199254740992" };
        await expect(store.listEntries(accountRow.account_id)).rejects.toThrow(/safe integer/);
    });
});

describe("umbrella server logging", () => {
    it("emits stable JSON events and redacts secrets, tokens, emails, URLs, and unapproved fields", () => {
        const lines: string[] = [];
        serverLog("warn", "umbrella.test.refused", {
            reason: "SITE_REQUEST_CROSS_ORIGIN",
            email: "private@example.test",
            outcome: "token=opaque-token",
        }, (_level, line) => lines.push(line));
        expect(lines).toHaveLength(1);
        expect(JSON.parse(lines[0] ?? "null")).toEqual({
            event: "umbrella.test.refused",
            outcome: "[REDACTED]",
            reason: "SITE_REQUEST_CROSS_ORIGIN",
        });
    });
    it("writes exactly one safe event for each webhook outcome", () => {
        const outcomes = [
            { ok: false as const, reason: "CREDIT_STORE_FAILED", message: "private" },
            { ok: true as const, ignored: true as const, reason: "STRIPE_WEBHOOK_EVENT_UNRELATED", message: "private" },
            { ok: true as const, ignored: false as const, replayed: true, movement: "grant" as const, credits: 2, balance: 4 },
            { ok: true as const, ignored: false as const, replayed: false, movement: "refund" as const, credits: -2, balance: 2 },
        ];

        for (const outcome of outcomes) {
            const lines: string[] = [];
            logWebhookOutcome("checkout.session.completed", outcome, (_level, line) => lines.push(line));
            expect(lines).toHaveLength(1);
            expect(JSON.parse(lines[0] ?? "null")).toMatchObject({
                event: "umbrella.webhook.outcome",
                eventType: "checkout.session.completed",
            });
            expect(lines[0]).not.toContain("private");
        }
    });
});

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
    created_at: iso(-86400000),
};

function text(value: SqlParameter | undefined): string {
    return isSqlText(value) ? value : "";
}

function rowForEntry(values: ReadonlyArray<SqlParameter>): SqlRow {
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

function rowForShare(values: ReadonlyArray<SqlParameter>): SqlRow {
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
    const reconciliations: SqlRow[] = [];

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
                }
                else {
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

                if (index === -1)
                    sessions.push(row);
                else
                    sessions[index] = row;

                return [];
            }

            if (query.startsWith("SELECT session_id")) {
                const found = sessions.find((row) => row.session_id === values[0]);

                return found === undefined ? [] : [found];
            }

            if (query.startsWith("DELETE FROM sessions")) {
                const index = sessions.findIndex((row) => row.session_id === values[0] &&
                    row.user_id === values[1] &&
                    row.surface === values[2] &&
                    row.issued_at === values[3] &&
                    row.expires_at === values[4] &&
                    row.token_digest === values[5]);

                if (index === -1)
                    return [];
                const [removed] = sessions.splice(index, 1);

                return removed === undefined ? [] : [removed];
            }

            if (query.includes("FROM credit_reconciliation_records")) {
                return query.includes("WHERE")
                    ? reconciliations.filter((row) => row.mode === values[0] && row.event_id === values[1])
                    : [...reconciliations];
            }

            if (query.includes("INSERT INTO credit_reconciliation_records")) {
                if (reconciliations.some((row) => row.event_id === values[0] && row.mode === values[1]))
                    return [];

                const row = {
                    event_id: values[0], mode: values[1], intent_id: values[2], user_id: values[3], charge_id: values[4],
                    event_type: values[5], reason: values[6], amount: values[7], currency: values[8],
                    dispute_id: values[9], dispute_status: values[10], occurred_at: values[11], payload_digest: values[12],
                };

                reconciliations.push(row);

                return [row];
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

                if (existing !== undefined)
                    return [];
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

    return { database, calls, users, accounts, sessions, entries, intents, shares, reconciliations };
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
                    expiresAt: iso(3600000),
                },
            };
        },
    },
};

function issuedAdmin(email: string) {
    const result = resolveAdminIdentity({ SCENEAXI_ADMIN_EMAIL: email });

    if (!result.ok)
        throw new Error(`fixture admin unresolved: ${result.reason}`);

    return result.value;
}

describe("umbrella deployment provider adapters", () => {
    it("builds hermetically from typed evidence without reading env or a network default", () => {
        const options = {
            admin: issuedAdmin("captain@example.com"),
            providers: { database: createDatabase(false).database, betterAuth: authProvider },
            clock: () => NOW,
        };

        Object.defineProperty(options, "env", {
            get() {
                throw new Error("the hermetic builder read a caller environment");
            },
        });
        const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
        Object.defineProperty(globalThis, "fetch", {
            configurable: true,
            get() {
                throw new Error("the hermetic builder read the ambient network transport");
            },
        });

        try {
            const handles = createDeploymentPlaneHandles(options);
            expect(handles.identityPort).toBeDefined();
            expect(handles.connectStore).toBeDefined();
            expect(handles.liveModeAuditSink).toBeDefined();
            expect(handles.admin).toBe(options.admin);
            expect(String(createDeploymentPlaneHandles)).not.toMatch(/process\.env|providerFetch|createNeonDatabase|createStripeClient/);
        }
        finally {
            if (fetchDescriptor === undefined) {
                Reflect.deleteProperty(globalThis, "fetch");
            }
            else {
                Object.defineProperty(globalThis, "fetch", fetchDescriptor);
            }
        }
    });
    it("provisions one account with the SceneAxi user exactly once at authentication", async () => {
        const fixture = createDatabase(false);

        const handles = createDeploymentPlaneHandles({
            admin: issuedAdmin("captain@example.com"),
            providers: { database: fixture.database, betterAuth: authProvider },
            clock: () => NOW,
        });

        expect(handles.identityPort).toBeDefined();
        const port = handles.identityPort;

        if (port === undefined)
            return;

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

        // `signIn` answers with a `SignInGrant` — the server-derived principal plus the
        // one redeemable copy of the raw session token — never a bare principal.
        const grant = {
            ok: true,
            value: {
                principal: { user: { userId: "member-1" }, role: { role: "user" } },
                sessionToken: "provider-token-1",
            },
        };

        expect(first).toMatchObject(grant);
        expect(second).toMatchObject(grant);
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
                            expiresAt: iso(3600000),
                        },
                    };
                },
            },
        };

        const handles = createDeploymentPlaneHandles({
            admin: issuedAdmin("captain@example.com"),
            providers: { database: fixture.database, betterAuth: mutableProvider },
            clock: () => NOW,
        });

        expect(handles.identityPort).toBeDefined();
        const port = handles.identityPort;

        if (port === undefined)
            return;

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
            value: {
                principal: { user: { userId: "member-1" }, role: { role: "admin" } },
                sessionToken: "provider-token-1",
            },
        });
        // A provider-side address change is followed too, so the by-email lookup keeps
        // resolving the same SceneAxi user instead of refusing `userNotFound`.
        providerUser = { ...providerUser, email: "captain.new@example.com" };

        const renamed = await port.signIn({
            surface: "site",
            email: "captain.new@example.com",
            password: "test-password",
        });

        expect(renamed).toMatchObject({
            ok: true,
            value: {
                principal: { user: { userId: "member-1" } },
                sessionToken: "provider-token-1",
            },
        });
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
                    createdAt: iso(-86400000),
                },
            ],
        });

        const admin = resolveAdminIdentity({ SCENEAXI_ADMIN_EMAIL: "member@example.com" });
        expect(admin.ok).toBe(true);

        if (!admin.ok || store === undefined)
            return;

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
            issuedAt: iso(-1000),
            expiresAt: iso(3600000),
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
            issuedAt: iso(-1000),
            expiresAt: iso(3600000),
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
            expiresAt: iso(7200000),
            tokenDigest: digestSessionToken("token-round-trip-2"),
        };

        await store.putSession(rotated);
        expect(fixture.sessions).toHaveLength(1);
        expect(await store.findSession(session.sessionId)).toEqual(rotated);
        expect(await store.deleteSession({ ...rotated, tokenDigest: session.tokenDigest })).toBe(false);
        expect(await store.deleteSession({ ...rotated, issuedAt: iso(-2000) })).toBe(false);
        expect(fixture.sessions).toHaveLength(1);
        expect(await store.deleteSession(rotated)).toBe(true);
        expect(fixture.sessions).toHaveLength(0);
        expect(await store.findSession(session.sessionId)).toBeUndefined();
        expect(await store.deleteSession(rotated)).toBe(false);
    });
    it("grants the starter and spends through the Neon store's append-or-replay boundary", async () => {
        const fixture = createDatabase();

        const handles = createDeploymentPlaneHandles({
            providers: { database: fixture.database },
            clock: () => NOW,
        });

        const store = handles.creditStore;
        expect(store).toBeDefined();

        if (store === undefined)
            return;
        const account = await store.findAccountByUserId("member-1");
        expect(account).toBeDefined();

        if (account === undefined)
            return;
        const initial = loadLedgerState(account, await store.listEntries(account.accountId));
        expect(initial.ok).toBe(true);

        if (!initial.ok)
            return;
        const admin = resolveAdminIdentity({ SCENEAXI_ADMIN_EMAIL: "captain@example.com" });

        if (!admin.ok)
            return;

        const identity = createInMemoryIdentityStore({
            users: [
                {
                    schemaVersion: 1,
                    kind: "sceneaxi.user",
                    userId: "member-1",
                    email: "member@example.com",
                    emailVerified: true,
                    disabled: false,
                    createdAt: iso(-1000),
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
            issuedAt: iso(-1000),
            expiresAt: iso(3600000),
            tokenDigest: digestSessionToken("token-1"),
        });

        const principal = await identityPort.verifySession({
            surface: "site",
            sessionId: "session-1",
            token: "token-1",
        });

        expect(principal.ok).toBe(true);

        if (!principal.ok)
            return;

        const plane = createDeploymentPlaneHandles({
            providers: { database: fixture.database },
            clock: () => NOW,
        });

        const credits = plane.creditStore;
        expect(credits).toBeDefined();

        if (credits === undefined)
            return;

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

        if (!state.ok)
            return;

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
        expect(calls[0]).toContain("payment_intent_data");
        // Session metadata binds completion; PaymentIntent metadata is copied to the
        // Charge and binds a later `charge.refunded` event to the same immutable intent.
        expect(calls[0]?.match(/sceneaxiIntentId/g)).toHaveLength(2);
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
        const retried = { ...first, createdAt: iso(4000) };
        await expect(intents.persistIntent(retried)).resolves.toEqual(first);
        expect(fixture.intents).toHaveLength(1);
        expect(fixture.intents[0]).toMatchObject({ created_at: first.createdAt });
        // A price-bearing difference under the same id is still a hard conflict.
        await expect(intents.persistIntent({ ...first, unitAmount: 900 })).rejects.toThrow(/checkout intent conflict/);
    });
    it("runs a persisted TEST intent through grant, dispute, partial refund, and replay on the Neon adapter", async () => {
        const fixture = createDatabase();

        const charge = {
            id: "ch_provider_1", amount: 500, currency: "usd", livemode: false,
            metadata: { sceneaxiUserId: "member-1", sceneaxiPurpose: "credit-pack", sceneaxiItemId: "starter", sceneaxiIntentId: "int_provider_grant_1" },
        };

        const stripe = {
            charges: {
                async retrieve(id: string) {
                    expect(id).toBe(charge.id);

                    return charge;
                },
            },
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
            providers: { database: fixture.database, stripe },
        });

        const checkout = handles.checkoutSessions;
        const store = handles.creditStore;
        const evidence = handles.checkoutEvidence;
        expect(checkout).toBeDefined();
        expect(store).toBeDefined();
        expect(evidence).toBeDefined();

        if (checkout === undefined || store === undefined || evidence === undefined)
            return;

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
            created: Math.floor(NOW / 1000),
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
            timestamp: Math.floor(NOW / 1000),
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

        for (const type of ["charge.dispute.created", "charge.dispute.closed", "charge.refunded"]) {
            const payload = JSON.stringify({
                id: `evt_provider_${type}`, type, created: NOW / 1000, livemode: false,
                data: { object: type === "charge.refunded"
                        ? { ...charge, refunded: false, amount_refunded: 200 }
                        : { id: "dp_provider_1", charge: charge.id, amount: 500, currency: "usd", status: "lost" } },
            });

            const request = { payload, signatureHeader: signStripeWebhookPayload({ payload, secret: "whsec_test_provider_fixture", timestamp: NOW / 1000 }), secret: "whsec_test_provider_fixture", store, evidence, now: NOW };
            expect(await applyCreditPackWebhook(request)).toMatchObject({ ok: true, ignored: true, reconciliationRequired: true, replayed: false });
            const reopened = createNeonCreditStore(fixture.database);
            expect(await applyCreditPackWebhook({ ...request, store: reopened })).toMatchObject({ ok: true, reconciliationRequired: true, replayed: true });
        }

        expect(fixture.reconciliations).toHaveLength(3);
        expect(await store.listReconciliations()).toMatchObject([
            { eventType: "charge.dispute.created", disputeId: "dp_provider_1" },
            { eventType: "charge.dispute.closed", disputeStatus: "lost" },
            { eventType: "charge.refunded", amount: 200, reason: "STRIPE_REFUND_NOT_FULL" },
        ]);
        expect(fixture.entries).toHaveLength(1);
        const saved = (await store.listReconciliations())[0];

        if (saved === undefined)
            throw new Error("Missing reconciliation record");
        expect(await store.appendOrReplayReconciliation(saved)).toMatchObject({ replayed: true });
        await expect(store.appendOrReplayReconciliation({ ...saved, amount: 499 })).rejects.toThrow(/no matching record/);
        expect(fixture.reconciliations).toHaveLength(3);
    });
    it("fails closed when the deployment has no Neon provider", () => {
        const admin = issuedAdmin("captain@example.com");
        const handles = createDeploymentPlaneHandles({ admin });
        expect(handles.admin).toBe(admin);
        expect(handles.billingMode).toBe("test");
        expect(handles.identityPort).toBeUndefined();
        expect(handles.creditStore).toBeUndefined();
        expect(handles.checkoutSessions).toBeUndefined();
        expect(handles.checkoutEvidence).toBeUndefined();
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
            issued_at: iso(-1000),
            expires_at: iso(3600000),
            token_digest: digestSessionToken("token-kids"),
        });
        await expect(store.findSession("session-kids")).rejects.toThrow(/Kids surface/);
        await expect(store.putSession({
            schemaVersion: 1,
            kind: "sceneaxi.session",
            sessionId: "session-kids-2",
            userId: "member-1",
            surface: "kids",
            issuedAt: iso(-1000),
            expiresAt: iso(3600000),
            tokenDigest: digestSessionToken("token-kids-2"),
        })).rejects.toThrow(/Kids surface/);
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

        await expect(adapter.authenticate({
            surface: "kids",
            email: "member@example.com",
            password: "test-password",
        })).rejects.toThrow(/Kids surface/);
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
            // SAFETY: createStripeClient was given the FakeStripe factory above, so its returned client is that concrete fixture instance.
            expect((client as FakeStripe).key).toBe(TEST_MODE_KEY);
        }

        expect(() => createStripeClient(TEST_MODE_KEY, () => ({}))).toThrow(/Stripe provider is unavailable/);
        expect(() => createStripeClient(LIVE_MODE_KEY, () => FakeStripe)).toThrow(/TEST keys only/);
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

        expect(() => createNeonDatabase(FIXTURE_CONNECTION, () => ({}))).toThrow(/Neon provider is unavailable/);
    });
    it("accepts a remote auth origin only over https or an exact loopback host", () => {
        expect(resolveBetterAuthOrigin("https://auth.sceneaxi.test")).toBe("https://auth.sceneaxi.test");
        expect(resolveBetterAuthOrigin("http://localhost:3000/api")).toBe("http://localhost:3000");
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
    /**
     * The default loader must survive a production `next build`, which the gate
     * cannot run: the sites are separate install roots and CI installs only the
     * hermetic root, so this is asserted on the source that the bundler reads.
     *
     * Both provider specifiers arrive through the injected `load` parameter, so an
     * imported `createRequire(import.meta.url)` gives webpack no dependency to
     * extract and it substitutes an empty context module that throws
     * `MODULE_NOT_FOUND` for every specifier — observed as
     * `1704:a=>{function b(a){var b=Error("Cannot find module '"+a+"'");...}`
     * in `.next/server/chunks`. Both constructors then throw on every deployment,
     * `createDeploymentPlaneHandles` catches that into ordinary provider absence,
     * and a fully configured deployment reports `IDENTITY_PLANE_NOT_WIRED` exactly
     * as an unconfigured one does. The two properties that keep it loadable are
     * that the require is reached through a builtin accessor the bundler does not
     * recognise, and that it is anchored to the emitted chunk's runtime path —
     * `import.meta.url` alone is inlined as this file's build-time source path,
     * which the deployed function does not have.
     */
    it("builds its provider loader in a form a production bundler cannot replace", () => {
        const source = readFileSync(fileURLToPath(new URL("../../sites/umbrella/src/lib/provider-adapters.ts", import.meta.url)), "utf8");
        expect(source).toMatch(/process\s*\.getBuiltinModule\("module"\)\s*\.createRequire\(/);
        expect(source).not.toMatch(/from "node:module"/);
        expect(source).toMatch(/typeof __filename === "string" \? __filename : import\.meta\.url/);
        // Tracing cannot see the specifiers either, so the deployed function only
        // holds the packages because the config pins them.
        const config = readFileSync(fileURLToPath(new URL("../../sites/umbrella/next.config.ts", import.meta.url)), "utf8");

        for (const provider of ["@neondatabase/serverless", "stripe"]) {
            expect(config).toContain(`"./node_modules/${provider}/**"`);
        }
    });
    /**
     * That loader's accessor is itself a runtime assumption: `process.getBuiltinModule`
     * landed in Node 20.16.0 / 22.3.0, and below it the module throws a `TypeError`
     * while evaluating rather than degrading — `identity-plane.ts` imports it, so every
     * umbrella server route would answer 500 instead of refusing by name, which is the
     * opposite of what the loader exists to protect. The site is its own install root
     * (ADR 0018), so the hermetic root's `engines` governs nothing here; the site
     * manifest is what a deployment reads to pick its Node runtime, and it must pin the
     * same floor rather than inherit one it is not part of.
     */
    it("pins a Node floor that has the builtin-module accessor its loader needs", () => {
        // SAFETY: the parsed file is a checked-in repository fixture read from a fixed path, not external input.
        const readManifest = (path: string) => JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8")) as {
            readonly engines?: {
                readonly node?: string;
            };
        };

        const declared = readManifest("../../sites/umbrella/package.json").engines?.node;
        expect(declared).toBe(readManifest("../../package.json").engines?.node);
        const branches = (declared ?? "").split("||").map((branch) => branch.trim());
        expect(branches.length).toBeGreaterThan(0);

        for (const branch of branches) {
            const parsed = /^(?:\^|>=)(\d+)(?:\.(\d+))?/.exec(branch);
            expect(parsed, `unparseable engines branch '${branch}'`).not.toBeNull();
            const major = Number(parsed?.[1]);
            const minor = Number(parsed?.[2] ?? "0");
            const hasAccessor = major > 22 || (major === 22 && minor >= 3) || (major === 20 && minor >= 16);
            expect(hasAccessor, `engines branch '${branch}' admits a Node without getBuiltinModule`)
                .toBe(true);
        }
    });
});

const SALE_ID = "sale-fixture-1";

const CREATOR_ACCOUNT = "acct_creator_1";

function saleSettlement(overrides: {
    readonly creatorAccountId?: string;
    readonly shareOccurredAt?: string;
} = {}): CreditsSaleSettlement {
    const keys = saleEntryKeys(SALE_ID);

    return {
        buyerEntry: {
            schemaVersion: 1,
            kind: "sceneaxi.credit-ledger-entry",
            entryId: "entry-sale-buyer",
            accountId: "acct_member_1",
            sequence: 2,
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
    // Real domain chain: a buyer must hold 100 credits before the sale's debit.
    fixture.entries.push({
        entry_id: "entry-buyer-grant", account_id: "acct_member_1", sequence: 1,
        movement: "grant", delta: 100, balance_after: 100, reason: "fixture grant",
        idempotency_key: "fixture:buyer:grant", occurred_at: iso(-1000),
    });
    fixture.accounts.push({
        account_id: CREATOR_ACCOUNT,
        user_id: "creator-1",
        created_at: iso(-86400000),
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
        expect(fixture.entries).toHaveLength(3);
        expect(fixture.shares).toHaveLength(1);
        const account = await store.findAccountByUserId("member-1");

        if (account === undefined)
            throw new Error("missing buyer account");
        expect(loadLedgerState(account, await store.listEntries(account.accountId))).toMatchObject({ ok: true, value: { balance: 0 } });
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
        expect(fixture.entries).toHaveLength(3);
        expect(fixture.shares).toHaveLength(1);
    });
    it("refuses a second settlement of the same sale carrying different evidence", async () => {
        const fixture = creditsFixture();
        const store = createNeonCreditStore(fixture.database);
        await store.settleCreditsSale(saleSettlement());
        await expect(store.settleCreditsSale(saleSettlement({ shareOccurredAt: iso(1000) }))).rejects.toThrow(/different settlement evidence/);
        expect(fixture.entries).toHaveLength(3);
        expect(fixture.shares).toHaveLength(1);
    });
    it("refuses a leg whose account belongs to the other settlement party", async () => {
        const fixture = creditsFixture();
        const store = createNeonCreditStore(fixture.database);
        await expect(store.settleCreditsSale(saleSettlement({ creatorAccountId: "acct_member_1" }))).rejects.toThrow(/does not belong to its settlement party/);
        expect(fixture.entries).toHaveLength(1);
        expect(fixture.shares).toHaveLength(0);
    });
    it("refuses to settle a sale when the provider offers no transaction", async () => {
        const fixture = creditsFixture();

        const withoutTransaction: NeonDatabase = {
            query: (text, values) => fixture.database.query(text, values),
        };

        const store = createNeonCreditStore(withoutTransaction);
        await expect(store.settleCreditsSale(saleSettlement())).rejects.toThrow(/requires a Neon transaction/);
        expect(fixture.entries).toHaveLength(1);
        expect(fixture.shares).toHaveLength(0);
    });
    it("keeps a sale leg out of the plain append path", () => {
        const fixture = creditsFixture();
        const store = createNeonCreditStore(fixture.database);
        const { buyerEntry } = saleSettlement();
        expect(buyerEntry).toBeDefined();

        if (buyerEntry === undefined)
            return;
        // The boundary guard runs synchronously, exactly as a constraint rejects
        // before the write, so this is a throw and never a rejected promise.
        expect(() => store.appendEntry(buyerEntry)).toThrow(/requires atomic settlement/);
        expect(fixture.entries).toHaveLength(1);
    });
});

describe("Neon Connect and live-mode audit adapters", () => {
    it("maps a persisted Connect account back to the public ConnectStore record", async () => {
        const account = {
            schemaVersion: 1,
            kind: "sceneaxi.connect-account-record",
            creatorUserId: "creator-1",
            stripeAccountId: "acct_test_1",
            mode: "test",
            providerRequestId: "req_1",
            createdAt: "2026-07-01T00:00:00.000Z",
        } as const;

        const database: NeonDatabase = {
            async query() {
                return [{
                        creator_user_id: account.creatorUserId,
                        stripe_account_id: account.stripeAccountId,
                        mode: account.mode,
                        provider_request_id: account.providerRequestId,
                        created_at: account.createdAt,
                    }];
            },
        };

        await expect(createNeonConnectStore(database).findAccountByCreatorUserId("creator-1")).resolves.toEqual(account);
    });
    it("writes the exact live-mode audit contract through Neon", async () => {
        const calls: {
            query: string;
            values: ReadonlyArray<SqlParameter> | undefined;
        }[] = [];

        const database: NeonDatabase = {
            async query(query, values) {
                calls.push({ query, values });

                return [];
            },
        };

        const audit = {
            schemaVersion: 1 as const,
            kind: "sceneaxi.stripe-live-mode-authorization-audit" as const,
            source: "SCENEAXI_STRIPE_LIVE_AUTHORIZED" as const,
            authorizedBy: "captain@example.com",
            authorizedOn: "2026-07-01",
            fingerprint: "a".repeat(64),
            record: "audit record",
        };

        await createNeonLiveModeAuditSink(database)(audit);
        expect(calls).toEqual([{
                query: expect.stringContaining("INSERT INTO stripe_live_mode_authorization_audit"),
                values: [1, audit.kind, audit.source, audit.authorizedBy, audit.authorizedOn, audit.fingerprint, audit.record],
            }]);
    });
});
/**
 * The Better Auth response bodies this client is written against.
 *
 * `POST /api/auth/sign-in/email` answers `{ redirect, token, user }` and sets the
 * session cookie — it carries no session record — so the session id, owner, and
 * expiry the boundary needs come from `GET /api/auth/get-session`, which answers
 * `{ session, user }`.
 */

const SIGN_IN_BODY = Object.freeze({
    redirect: false,
    token: "provider-token-1",
    user: {
        id: "member-1",
        email: "member@example.com",
        emailVerified: true,
        name: "Member",
        createdAt: iso(-86400000),
        updatedAt: iso(-86400000),
    },
});

const GET_SESSION_BODY = Object.freeze({
    session: {
        id: "provider-session-1",
        token: "provider-token-1",
        userId: "member-1",
        expiresAt: iso(3600000),
        createdAt: iso(0),
    },
    user: SIGN_IN_BODY.user,
});
/**
 * A provider answer. `setCookie` models a transport that implements
 * `getSetCookie()`; `foldedSetCookie` models one that folds the values into a
 * single `get("set-cookie")` string, which is the harder shape to read back.
 */

type ProviderResponse = Readonly<{
    status: number;
    body: Awaited<ReturnType<Awaited<ReturnType<ProviderFetch>>["json"]>>;
    setCookie?: ReadonlyArray<string>;
    foldedSetCookie?: string;
}>;

function responseHeaders(response: ProviderResponse) {
    const setCookie = response.setCookie;

    if (setCookie !== undefined) {
        return {
            get: (name: string) => name.toLowerCase() === "set-cookie" ? [...setCookie].join(", ") : null,
            getSetCookie: () => [...setCookie],
        };
    }

    const foldedSetCookie = response.foldedSetCookie;

    if (foldedSetCookie !== undefined) {
        return {
            get: (name: string) => name.toLowerCase() === "set-cookie" ? foldedSetCookie : null,
        };
    }

    return undefined;
}

function recordingFetch(responses: ReadonlyArray<ProviderResponse>) {
    const calls: Array<{
        url: string;
        method: string;
        authorization: string;
        cookie: string;
    }> = [];

    const queue = [...responses];

    const fetch: ProviderFetch = async (input, init) => {
        // SAFETY: the provider adapter constructs these request headers as its documented string-valued transport fields.
        const headers = (init?.headers ?? {}) as Record<string, string>;
        calls.push({
            url: input,
            method: init?.method ?? "GET",
            authorization: headers["authorization"] ?? "",
            cookie: headers["cookie"] ?? "",
        });
        const next = queue.shift();

        if (next === undefined)
            throw new Error(`unexpected provider request: ${input}`);

        return (() => {
            const payload = { ok: next.status >= 200 && next.status < 300,
                status: next.status };

            if (!(responseHeaders(next) === undefined))
                Object.assign(payload, { headers: responseHeaders(next) });

            return Object.assign(payload, { json: async () => next.body });
        })();
    };

    return { fetch, calls };
}

describe("umbrella Better Auth HTTP client", () => {
    it("resolves the session Better Auth's sign-in answer does not carry", async () => {
        const { fetch, calls } = recordingFetch([
            {
                status: 200,
                body: SIGN_IN_BODY,
                setCookie: [
                    "better-auth.session_token=provider-token-1.signature; Path=/; Expires=Wed, 09 Jun 2027 10:18:14 GMT; HttpOnly; SameSite=Lax",
                ],
            },
            { status: 200, body: GET_SESSION_BODY },
        ]);

        const client = createBetterAuthHttpClient({ origin: "https://auth.example.com/", fetch });

        const authentication = await client.api.signInEmail({
            body: { email: "member@example.com", password: "test-password" },
        });

        // The lookup carries both credentials a Better Auth deployment may accept:
        // the issued session cookie (stock) and the bearer token (`bearer()` plugin).
        expect(calls).toEqual([
            {
                url: "https://auth.example.com/api/auth/sign-in/email",
                method: "POST",
                authorization: "",
                cookie: "",
            },
            {
                url: "https://auth.example.com/api/auth/get-session",
                method: "GET",
                authorization: "Bearer provider-token-1",
                cookie: "better-auth.session_token=provider-token-1.signature",
            },
        ]);
        // The envelope is only useful if @sceneaxi/auth accepts it, so the contract
        // is asserted through the mapper rather than against a hand-copied shape.
        expect(mapBetterAuthAuthentication({ authentication, surface: "site", issuedAt: NOW })).toMatchObject({
            providerUserId: "member-1",
            email: "member@example.com",
            emailVerified: true,
            session: {
                sessionId: "provider-session-1",
                userId: "member-1",
                surface: "site",
                expiresAt: iso(3600000),
                tokenDigest: digestSessionToken("provider-token-1"),
            },
        });
    });
    it("uses an inline session when the provider states one, without a second request", async () => {
        const { fetch, calls } = recordingFetch([
            {
                status: 200,
                body: {
                    ...SIGN_IN_BODY,
                    session: {
                        id: "provider-session-2",
                        token: "provider-token-2",
                        userId: "member-1",
                        expiresAt: iso(7200000),
                    },
                },
            },
        ]);

        const client = createBetterAuthHttpClient({ origin: "https://auth.example.com", fetch });

        const authentication = await client.api.signInEmail({
            body: { email: "member@example.com", password: "test-password" },
        });

        expect(calls).toHaveLength(1);
        expect(mapBetterAuthAuthentication({ authentication, surface: "site", issuedAt: NOW })).toMatchObject({
            session: { sessionId: "provider-session-2", expiresAt: iso(7200000) },
        });
    });
    it("refuses credentials only when the sign-in request rejects them", async () => {
        for (const status of [401, 403]) {
            const signInRefused = createBetterAuthHttpClient({
                origin: "https://auth.example.com",
                fetch: recordingFetch([{ status, body: { message: "denied" } }]).fetch,
            });

            await expect(signInRefused.api.signInEmail({
                body: { email: "member@example.com", password: "wrong" },
            })).resolves.toBeUndefined();
        }
    });
    it("throws on a provider fault rather than reporting a failed sign-in", async () => {
        const signInFaulted = createBetterAuthHttpClient({
            origin: "https://auth.example.com",
            fetch: recordingFetch([{ status: 500, body: {} }]).fetch,
        });

        await expect(signInFaulted.api.signInEmail({
            body: { email: "member@example.com", password: "test-password" },
        })).rejects.toThrow(/Better Auth sign-in failed \(500\)/);

        const lookupFaulted = createBetterAuthHttpClient({
            origin: "https://auth.example.com",
            fetch: recordingFetch([
                { status: 200, body: SIGN_IN_BODY },
                { status: 503, body: {} },
            ]).fetch,
        });

        await expect(lookupFaulted.api.signInEmail({
            body: { email: "member@example.com", password: "test-password" },
        })).rejects.toThrow(/Better Auth session lookup failed \(503\)/);

        for (const status of [401, 403]) {
            const lookupDenied = createBetterAuthHttpClient({
                origin: "https://auth.example.com",
                fetch: recordingFetch([
                    { status: 200, body: SIGN_IN_BODY },
                    { status, body: { message: "denied" } },
                ]).fetch,
            });

            await expect(lookupDenied.api.signInEmail({
                body: { email: "member@example.com", password: "test-password" },
            })).rejects.toThrow(new RegExp(`session lookup denied after sign-in \\(${status}\\)`));
        }
    });
    it("replays a folded set-cookie answer without splitting a cookie date attribute", async () => {
        const { fetch, calls } = recordingFetch([
            {
                status: 200,
                body: SIGN_IN_BODY,
                foldedSetCookie: "better-auth.session_token=provider-token-1.signature; Path=/; Expires=Wed, 09 Jun 2027 10:18:14 GMT; HttpOnly, better-auth.csrf=csrf-1; Path=/",
            },
            { status: 200, body: GET_SESSION_BODY },
        ]);

        const client = createBetterAuthHttpClient({ origin: "https://auth.example.com", fetch });
        await client.api.signInEmail({
            body: { email: "member@example.com", password: "test-password" },
        });
        expect(calls[1]?.cookie).toBe("better-auth.session_token=provider-token-1.signature; better-auth.csrf=csrf-1");
    });
    it("reports a provider that accepts the lookup but names no session as a fault", async () => {
        // Stock Better Auth answers `get-session` 200 with no session when it honours
        // neither the replayed cookie nor the bearer token. That is a deployment
        // configuration fault, and must not read back as a rejected password.
        for (const body of [null, { session: null, user: null }]) {
            const client = createBetterAuthHttpClient({
                origin: "https://auth.example.com",
                fetch: recordingFetch([
                    { status: 200, body: SIGN_IN_BODY },
                    { status: 200, body },
                ]).fetch,
            });

            await expect(client.api.signInEmail({
                body: { email: "member@example.com", password: "test-password" },
            })).rejects.toThrow(/named no session for the issued token/);
        }
    });
    it("reports a successful answer that names no session and no token as a fault", async () => {
        const { fetch, calls } = recordingFetch([
            { status: 200, body: { redirect: false, user: SIGN_IN_BODY.user } },
        ]);

        const client = createBetterAuthHttpClient({ origin: "https://auth.example.com", fetch });
        await expect(client.api.signInEmail({ body: { email: "member@example.com", password: "test-password" } })).rejects.toThrow(/returned neither a session nor a token/);
        expect(calls).toHaveLength(1);
    });
    it("never attributes a session to a user the provider did not name as its owner", async () => {
        const { fetch } = recordingFetch([
            { status: 200, body: SIGN_IN_BODY },
            {
                status: 200,
                body: {
                    session: { id: "provider-session-1", expiresAt: iso(3600000) },
                    user: SIGN_IN_BODY.user,
                },
            },
        ]);

        const client = createBetterAuthHttpClient({ origin: "https://auth.example.com", fetch });

        const authentication = await client.api.signInEmail({
            body: { email: "member@example.com", password: "test-password" },
        });

        expect(authentication).toMatchObject({ session: { userId: "" } });
        expect(mapBetterAuthAuthentication({ authentication, surface: "site", issuedAt: NOW })).toBeUndefined();
    });
});

describe("Neon durable response codec boundary", () => {
    const operation = { accountId: "acct_member_1", idempotencyKey: "turn:response", amount: 1, reason: "fixture hosted call", model: "fixture-model", operation: "generate", now: NOW };
    it.each([new Map([["answer", "charged answer"]]), new Date(0), 1n])("rejects unsupported JS instances before persistence: %s", async (response) => {
        const calls: string[] = [];

        const store = createNeonHostedCallStore({ query: async (text) => {
                calls.push(text);

                return [{ idempotency_key: operation.idempotencyKey }];
            } });

        await expect(store.saveResponse(operation, response)).rejects.toThrow(/bounded JSON/);
        expect(calls).toEqual([]);
    });
    it("does not invoke accessors or toJSON hooks before rejecting a supplied response", async () => {
        let invoked = 0;

        const getter = Object.defineProperty({}, "answer", { enumerable: true, get() {
                invoked++;

                return "changed";
            } });

        const hook = { answer: "original", toJSON() {
                invoked++;

                return { answer: "changed" };
            } };

        const calls: string[] = [];

        const store = createNeonHostedCallStore({ query: async (text) => {
                calls.push(text);

                return [{ idempotency_key: operation.idempotencyKey }];
            } });

        for (const response of [getter, hook])
            await expect(store.saveResponse(operation, response)).rejects.toThrow(/bounded JSON/);
        expect(invoked).toBe(0);
        expect(calls).toEqual([]);
    });
    it("preserves a JSON answer through persisted response-ready restart with an owned frozen snapshot", async () => {
        let persisted: unknown;

        const database: NeonDatabase = { async query(text, values) {
                if (text.includes("UPDATE hosted_model_operations")) {
                    const json = values?.[6];

                    if (!isSqlText(json))
                        throw new Error("missing response JSON");
                    persisted = JSON.parse(json);

                    return [{ idempotency_key: operation.idempotencyKey }];
                }

                return [{ status: "response-ready", response: persisted }];
            } };

        const response = { answer: "charged answer", nested: [1, { valid: true }] };
        await createNeonHostedCallStore(database).saveResponse(operation, response);
        response.answer = "later mutation";
        const restored = await createNeonHostedCallStore(database).reserve(operation);
        expect(restored).toEqual({ status: "response-ready", response: { answer: "charged answer", nested: [1, { valid: true }] } });
        expect(Object.isFrozen(restored.response)).toBe(true);
    });
    it("rejects malformed response-ready output rather than returning it as trusted recovery", async () => {
        const store = createNeonHostedCallStore({ query: async () => [{ status: "response-ready", response: new Map() }] });
        await expect(store.reserve(operation)).rejects.toThrow(/bounded JSON/);
    });
});
