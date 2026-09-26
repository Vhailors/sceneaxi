import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { saleEntryKeys } from "@sceneaxi/billing";
import {
  createNeonCheckoutIntentStore,
  createNeonCreditStore,
  createNeonIdentityStore,
  type NeonDatabase,
  type SqlRow,
} from "../src/lib/provider-adapters";

function authentication(userId: string, email: string) {
  return {
    user: { id: userId, email, emailVerified: true },
    session: {
      id: `session-${userId}`,
      token: `token-${userId}`,
      userId,
      expiresAt: "2026-01-01T01:00:00.000Z",
    },
  };
}

async function createDatabase() {
  const postgres = new PGlite();
  const migrationDirectory = new URL("../../../db/migrations/", import.meta.url);
  const migrations = (await readdir(fileURLToPath(migrationDirectory)))
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort();
  for (const migration of migrations) {
    await postgres.exec(await readFile(new URL(migration, migrationDirectory), "utf8"));
  }

  const database: NeonDatabase = {
    async query(text, values = []) {
      return (await postgres.query<SqlRow>(text, [...values])).rows;
    },
    async transaction(statements) {
      return postgres.transaction(async (transaction) => {
        const results = [];
        for (const statement of statements) {
          results.push((await transaction.query<SqlRow>(statement.text, [...statement.values])).rows);
        }
        return results;
      });
    },
  };
  return { postgres, database };
}

describe("Neon adapters against PostgreSQL semantics", () => {
  let fixture: Awaited<ReturnType<typeof createDatabase>>;
  beforeAll(async () => {
    fixture = await createDatabase();
  }, 60_000);
  afterAll(async () => {
    await fixture.postgres.close();
  });

  it("provisions a user and credit account idempotently through every migration", async () => {
    const { postgres, database } = fixture;
    const identity = createNeonIdentityStore(database);
    const authentication = {
      user: { id: "member-provision", email: "provision@example.com", emailVerified: true },
      session: {
        id: "provider-session-1",
        token: "provider-token-1",
        userId: "member-provision",
        expiresAt: "2026-01-01T01:00:00.000Z",
      },
    };

    await identity.ensureUserAndCreditAccount(authentication, Date.parse("2026-01-01T00:00:00Z"));
    await identity.ensureUserAndCreditAccount(authentication, Date.parse("2026-01-02T00:00:00Z"));

    expect(await identity.findUserById("member-provision")).toMatchObject({
      userId: "member-provision",
      email: "provision@example.com",
      emailVerified: true,
    });
    expect(await createNeonCreditStore(database).findAccountByUserId("member-provision"))
      .toMatchObject({ userId: "member-provision" });
    expect((await postgres.query("SELECT account_id FROM credit_accounts WHERE user_id = $1", ["member-provision"])).rows)
      .toHaveLength(1);
    expect((await postgres.query("SELECT count(*)::int AS count FROM users")).rows)
      .toEqual([{ count: 1 }]);
  });

  it("appends once on a repeated idempotency key and races on unique account sequence", async () => {
    const { postgres, database } = fixture;
    const identity = createNeonIdentityStore(database);
    await identity.ensureUserAndCreditAccount(
      authentication("member-race", "race@example.com"),
      Date.parse("2026-01-01T00:00:00Z"),
    );
    const account = await createNeonCreditStore(database).findAccountByUserId("member-race");
    expect(account).toBeDefined();
    if (account === undefined) return;
    const credits = createNeonCreditStore(database);
    const grant = {
      schemaVersion: 1 as const,
      kind: "sceneaxi.credit-ledger-entry" as const,
      entryId: "entry-grant",
      accountId: account.accountId,
      sequence: 1,
      movement: "grant" as const,
      delta: 100,
      balanceAfter: 100,
      reason: "integration fixture",
      idempotencyKey: "integration:grant",
      occurredAt: "2026-01-01T00:00:00.000Z",
    };
    const first = await credits.appendOrReplayEntry(grant);
    const replay = await credits.appendOrReplayEntry({ ...grant, entryId: "entry-retry" });
    expect(first.replayed).toBe(false);
    expect(replay).toMatchObject({ replayed: true, entry: { entryId: "entry-grant" } });

    const race = await Promise.allSettled(["one", "two"].map((suffix) =>
      credits.appendOrReplayEntry({
        ...grant,
        entryId: `entry-debit-${suffix}`,
        sequence: 2,
        movement: "debit",
        delta: -10,
        balanceAfter: 90,
        idempotencyKey: `integration:debit:${suffix}`,
      }),
    ));
    expect(race.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = race.find((result) => result.status === "rejected");
    expect(rejected?.status).toBe("rejected");
    if (rejected?.status === "rejected") {
      expect(String(rejected.reason)).toContain("credit_ledger_entries_account_sequence");
    }
    expect(await credits.listEntries(account.accountId)).toHaveLength(2);
    await expect(postgres.query(
      `INSERT INTO sessions (session_id, user_id, surface, issued_at, expires_at, token_digest)
       VALUES ('session-kids', 'member-race', 'kids', '2026-01-01T00:00:00Z',
               '2026-01-01T01:00:00Z', repeat('a', 64))`,
    )).rejects.toThrow(/sessions_surface_known/);
  });

  it("settles both ledger legs and the share through one PostgreSQL transaction", async () => {
    const { postgres, database } = fixture;
    const identity = createNeonIdentityStore(database);
    for (const [id, email] of [["buyer", "buyer@example.com"], ["creator", "creator@example.com"]] as const) {
      await identity.ensureUserAndCreditAccount(
        authentication(`member-${id}`, email),
        Date.parse("2026-01-01T00:00:00Z"),
      );
    }
    const buyer = await createNeonCreditStore(database).findAccountByUserId("member-buyer");
    const creator = await createNeonCreditStore(database).findAccountByUserId("member-creator");
    expect(buyer).toBeDefined();
    expect(creator).toBeDefined();
    if (buyer === undefined || creator === undefined) return;
    await postgres.query(
      `INSERT INTO catalog_listings
       (listing_id, catalog, seller_user_id, title, price_mode, credit_price, published_at)
       VALUES ($1, 'game', $2, 'Fixture listing', 'credits', 100, $3)`,
      ["listing-transaction", "member-creator", "2026-01-01T00:00:00.000Z"],
    );
    const keys = saleEntryKeys("sale-transaction");
    const settlement = {
      buyerEntry: {
        schemaVersion: 1 as const,
        kind: "sceneaxi.credit-ledger-entry" as const,
        entryId: "entry-buyer-sale",
        accountId: buyer.accountId,
        sequence: 1,
        movement: "debit" as const,
        delta: -100,
        balanceAfter: 0,
        reason: "catalog listing purchase",
        idempotencyKey: keys.buyer,
        occurredAt: "2026-01-01T00:00:00.000Z",
      },
      creatorEntry: {
        schemaVersion: 1 as const,
        kind: "sceneaxi.credit-ledger-entry" as const,
        entryId: "entry-creator-sale",
        accountId: creator.accountId,
        sequence: 1,
        movement: "grant" as const,
        delta: 50,
        balanceAfter: 50,
        reason: "creator revenue share",
        idempotencyKey: keys.creator,
        occurredAt: "2026-01-01T00:00:00.000Z",
      },
      share: {
        schemaVersion: 1 as const,
        kind: "sceneaxi.creator-share-record" as const,
        saleId: "sale-transaction",
        listingId: "listing-transaction",
        buyerUserId: "member-buyer",
        creatorUserId: "member-creator",
        grossCredits: 100,
        creatorCredits: 50,
        platformCredits: 50,
        basisPoints: 5000,
        occurredAt: "2026-01-01T00:00:00.000Z",
      },
    };
    const credits = createNeonCreditStore(database);
    await expect(credits.settleCreditsSale(settlement)).resolves.toEqual({ replayed: false });
    await expect(credits.settleCreditsSale(settlement)).resolves.toEqual({ replayed: true });
    expect((await postgres.query(
      "SELECT count(*)::int AS count FROM credit_ledger_entries WHERE account_id IN ($1, $2)",
      [buyer.accountId, creator.accountId],
    )).rows).toEqual([{ count: 2 }]);
    expect((await postgres.query(
      "SELECT count(*)::int AS count FROM creator_share_records WHERE sale_id = $1",
      ["sale-transaction"],
    )).rows).toEqual([{ count: 1 }]);
  });

  it("enforces append-only ledger and immutable checkout pricing in SQL", async () => {
    const { postgres, database } = fixture;
    const identity = createNeonIdentityStore(database);
    await identity.ensureUserAndCreditAccount(
      authentication("member-immutable", "immutable@example.com"),
      Date.parse("2026-01-01T00:00:00Z"),
    );
    const account = await createNeonCreditStore(database).findAccountByUserId("member-immutable");
    expect(account).toBeDefined();
    if (account === undefined) return;
    const credits = createNeonCreditStore(database);
    await credits.appendOrReplayEntry({
      schemaVersion: 1,
      kind: "sceneaxi.credit-ledger-entry",
      entryId: "entry-immutable",
      accountId: account.accountId,
      sequence: 1,
      movement: "grant",
      delta: 100,
      balanceAfter: 100,
      reason: "integration fixture",
      idempotencyKey: "integration:immutable",
      occurredAt: "2026-01-01T00:00:00.000Z",
    });
    await expect(postgres.query("UPDATE credit_ledger_entries SET reason = 'rewritten' WHERE entry_id = $1", ["entry-immutable"]))
      .rejects.toThrow(/append-only/);
    await expect(postgres.query("DELETE FROM credit_ledger_entries WHERE entry_id = $1", ["entry-immutable"]))
      .rejects.toThrow(/append-only/);

    const intents = createNeonCheckoutIntentStore(database);
    const intent = {
      schemaVersion: 1 as const,
      kind: "sceneaxi.checkout-session-intent" as const,
      intentId: "int_integration_1",
      userId: "member-immutable",
      purpose: "credit-pack" as const,
      itemId: "starter",
      credits: 100,
      unitAmount: 500,
      currency: "usd",
      stripePriceId: "price_test_starter_100",
      mode: "test" as const,
      successUrl: "https://sceneaxi.test/account",
      cancelUrl: "https://sceneaxi.test/pricing",
      idempotencyKey: "integration:checkout:1",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    await intents.persistIntent(intent);
    await expect(postgres.query("UPDATE checkout_session_intents SET unit_amount = 900 WHERE intent_id = $1", [intent.intentId]))
      .rejects.toThrow(/price columns are immutable/);
    await expect(intents.persistIntent({ ...intent, unitAmount: 900 }))
      .rejects.toThrow(/checkout intent conflict/);
  });
});
