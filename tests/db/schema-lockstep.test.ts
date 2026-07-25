import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contract ↔ DDL lockstep, verified with no database.
 *
 * The point is drift: a contract field added without a column, or a column added
 * without a contract field, is the kind of mistake that only shows up at runtime
 * against a real Neon branch — which the gate deliberately never has. So the DDL
 * is parsed here and compared field-for-field against the shipped contracts.
 *
 * It also asserts the invariants the database is supposed to enforce on its own,
 * because a migration that quietly dropped the append-only trigger would leave
 * the application as the only thing protecting the ledger.
 */

const dbDir = fileURLToPath(new URL("../../db", import.meta.url));
const migrationsDir = join(dbDir, "migrations");

const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const sql = migrationFiles
  .map((name) => readFileSync(join(migrationsDir, name), "utf8"))
  .join("\n");

/** Column names declared by one CREATE TABLE block. */
const columnsOf = (table: string): string[] => {
  const match = new RegExp(
    `CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\n\\);`,
  ).exec(sql);
  if (match === null) throw new Error(`no CREATE TABLE for ${table}`);
  const body = match[1];
  if (body === undefined) throw new Error(`empty body for ${table}`);
  const columns: string[] = [];
  // Depth tracking matters: a multi-line CHECK constraint's continuation lines
  // start with bare column names, which a line-by-line scan would mistake for
  // column declarations.
  let depth = 0;
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    const atTopLevel = depth === 0;
    for (const character of line) {
      if (character === "(") depth += 1;
      else if (character === ")") depth -= 1;
    }
    if (!atTopLevel) continue;
    if (line.length === 0 || line.startsWith("--")) continue;
    if (/^(CONSTRAINT|PRIMARY KEY|UNIQUE|FOREIGN KEY|CHECK)\b/i.test(line)) {
      continue;
    }
    const name = /^([a-z_][a-z0-9_]*)\s/.exec(line);
    if (name?.[1] !== undefined) columns.push(name[1]);
  }
  return columns;
};

const snake = (camel: string): string =>
  camel.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

type JsonObjectSchema = {
  properties?: Record<string, JsonObjectSchema>;
  items?: JsonObjectSchema;
  $defs?: Record<string, JsonObjectSchema>;
};

const contractSchema = (name: string): JsonObjectSchema =>
  JSON.parse(
    readFileSync(
      join(dbDir, "..", "packages", "schemas", "contracts", name),
      "utf8",
    ),
  ) as JsonObjectSchema;

const persistedDefinitionFields = (
  schemaName: string,
  definition: string,
): string[] => {
  const properties = contractSchema(schemaName).$defs?.[definition]?.properties;
  if (properties === undefined) {
    throw new Error(`missing ${definition} properties in ${schemaName}`);
  }
  return Object.keys(properties).filter(
    (field) => field !== "schemaVersion" && field !== "kind",
  );
};

const catalogListingFields = (): string[] => {
  const properties = contractSchema("catalog-listings.schema.json").properties
    ?.listings?.items?.properties;
  if (properties === undefined) {
    throw new Error("missing catalog listing item properties");
  }
  return Object.entries(properties).flatMap(([field, schema]) => {
    if (field === "schemaVersion" || field === "kind") return [];
    if (field !== "moneyPrice") return [field];
    return Object.keys(schema.properties ?? {}).map(
      (nested) => `money${nested[0]?.toUpperCase()}${nested.slice(1)}`,
    );
  });
};

const CONTRACT_FIELDS: Record<string, readonly string[]> = {
  users: persistedDefinitionFields("identity.schema.json", "user"),
  role_assignments: persistedDefinitionFields(
    "identity.schema.json",
    "roleAssignment",
  ),
  sessions: persistedDefinitionFields("identity.schema.json", "session"),
  credit_accounts: persistedDefinitionFields(
    "credit-ledger.schema.json",
    "creditAccount",
  ),
  credit_ledger_entries: persistedDefinitionFields(
    "credit-ledger.schema.json",
    "creditLedgerEntry",
  ),
  stripe_customer_links: persistedDefinitionFields(
    "billing-checkout.schema.json",
    "stripeCustomerLink",
  ),
  checkout_session_intents: persistedDefinitionFields(
    "billing-checkout.schema.json",
    "checkoutSessionIntent",
  ),
  catalog_listings: catalogListingFields(),
  creator_share_records: persistedDefinitionFields(
    "revenue-share.schema.json",
    "creatorShareRecord",
  ),
  money_split_records: persistedDefinitionFields(
    "revenue-share.schema.json",
    "moneySplitRecord",
  ),
};

const FROZEN_V1_FIELDS: Record<string, readonly string[]> = {
  users: ["userId", "email", "emailVerified", "disabled", "createdAt"],
  role_assignments: ["userId", "role", "source", "assignedAt"],
  sessions: [
    "sessionId",
    "userId",
    "surface",
    "issuedAt",
    "expiresAt",
    "tokenDigest",
  ],
  credit_accounts: ["accountId", "userId", "createdAt"],
  credit_ledger_entries: [
    "entryId",
    "accountId",
    "sequence",
    "movement",
    "delta",
    "balanceAfter",
    "reason",
    "idempotencyKey",
    "occurredAt",
  ],
  stripe_customer_links: ["userId", "stripeCustomerId", "mode", "linkedAt"],
  checkout_session_intents: [
    "intentId",
    "userId",
    "purpose",
    "itemId",
    "credits",
    "unitAmount",
    "currency",
    "stripePriceId",
    "mode",
    "successUrl",
    "cancelUrl",
    "idempotencyKey",
    "createdAt",
  ],
  catalog_listings: [
    "listingId",
    "catalog",
    "sellerUserId",
    "title",
    "priceMode",
    "creditPrice",
    "moneyUnitAmount",
    "moneyCurrency",
    "moneyStripePriceId",
    "publishedAt",
  ],
  creator_share_records: [
    "saleId",
    "listingId",
    "buyerUserId",
    "creatorUserId",
    "grossCredits",
    "creatorCredits",
    "platformCredits",
    "basisPoints",
    "occurredAt",
  ],
  money_split_records: [
    "saleId",
    "listingId",
    "buyerUserId",
    "creatorUserId",
    "grossMinor",
    "creatorMinor",
    "platformMinor",
    "currency",
    "basisPoints",
    "mode",
    "occurredAt",
  ],
};

describe("migration hygiene", () => {
  it("ships numbered, forward-only migrations", () => {
    expect(migrationFiles.length).toBeGreaterThan(0);
    for (const name of migrationFiles) {
      expect(name).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
    }
    expect(migrationFiles).toEqual([...migrationFiles].sort());
  });

  it("has no down-migration, because reverting a ledger loses history", () => {
    for (const name of migrationFiles) {
      expect(name).not.toContain("down");
    }
    expect(sql).not.toMatch(/DROP TABLE/i);
  });

  it("is safe to re-run where valid", () => {
    const creates = sql.match(/CREATE TABLE/gi) ?? [];
    const guarded = sql.match(/CREATE TABLE IF NOT EXISTS/gi) ?? [];
    expect(guarded.length).toBe(creates.length);

    const indexes = sql.match(/CREATE UNIQUE INDEX|CREATE INDEX/gi) ?? [];
    const guardedIndexes = sql.match(/INDEX IF NOT EXISTS/gi) ?? [];
    expect(guardedIndexes.length).toBe(indexes.length);
  });

  it("commits no credential, host, or connection string", () => {
    const files = [
      ...migrationFiles.map((name) => join(migrationsDir, name)),
      join(dbDir, "README.md"),
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/postgres(ql)?:\/\//i);
      expect(text).not.toMatch(/\bsk_(test|live)_/);
      expect(text).not.toMatch(/\bwhsec_/);
      expect(text).not.toMatch(/\bneon\.tech\b/);
      expect(text).not.toMatch(/\bPASSWORD\s*=/i);
    }
  });
});

describe("contract to DDL lockstep", () => {
  for (const [table, fields] of Object.entries(CONTRACT_FIELDS)) {
    it(`${table}: every contract field has a column and vice versa`, () => {
      const columns = columnsOf(table).sort();
      const expected = fields.map(snake).sort();
      expect(columns).toEqual(expected);
    });
  }

  it("carries no contract table that the DDL forgot", () => {
    for (const table of Object.keys(CONTRACT_FIELDS)) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table} (`);
    }
  });

  it("retains every frozen v1 persisted field", () => {
    for (const [table, fields] of Object.entries(FROZEN_V1_FIELDS)) {
      expect(CONTRACT_FIELDS[table]).toEqual(expect.arrayContaining(fields));
    }
  });
});

describe("invariants the database enforces itself", () => {
  it("gives users no role column at all", () => {
    expect(columnsOf("users")).not.toContain("role");
  });

  it("allows at most one admin", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS role_assignments_single_admin[\s\S]*?WHERE role = 'admin'/,
    );
  });

  it("permits the admin role only from the environment source", () => {
    expect(sql).toContain("role <> 'admin' OR source = 'admin-env'");
  });

  it("gives role_assignments.role no default that could produce admin", () => {
    const match = /role\s+text\s+NOT NULL,/.exec(sql);
    expect(match).not.toBeNull();
    expect(sql).not.toMatch(/role\s+text\s+NOT NULL\s+DEFAULT/i);
  });

  it("cannot store a Kids session", () => {
    const match = /CONSTRAINT sessions_surface_known CHECK \(([\s\S]*?)\)/.exec(
      sql,
    );
    expect(match).not.toBeNull();
    expect(match?.[1]).not.toContain("kids");
    expect(match?.[1]).toContain("web-shell");
  });

  it("has no column a raw token, secret, or password could sit in", () => {
    for (const table of Object.keys(CONTRACT_FIELDS)) {
      for (const column of columnsOf(table)) {
        expect(column).not.toBe("token");
        expect(column).not.toBe("secret");
        expect(column).not.toBe("password");
        expect(column).not.toBe("password_hash");
        expect(column).not.toBe("api_key");
      }
    }
    expect(columnsOf("sessions")).toContain("token_digest");
  });

  it("gives credit_accounts no balance column", () => {
    for (const column of columnsOf("credit_accounts")) {
      expect(column).not.toContain("balance");
    }
  });

  it("makes the ledger append-only with a raising trigger", () => {
    expect(sql).toContain("credit_ledger_entries_append_only");
    expect(sql).toMatch(
      /CREATE TRIGGER credit_ledger_entries_append_only_trigger\s+BEFORE UPDATE OR DELETE ON credit_ledger_entries/,
    );
    expect(sql).toContain("RAISE EXCEPTION");
  });

  it("makes a sequence fork and a replayed key impossible", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_entries_account_sequence\s+ON credit_ledger_entries \(account_id, sequence\)/,
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_entries_idempotency_key\s+ON credit_ledger_entries \(idempotency_key\)/,
    );
  });

  it("keeps a ledger balance non-negative and every movement attributable", () => {
    expect(sql).toContain("balance_after >= 0");
    expect(sql).toContain("btrim(reason) <> ''");
    expect(sql).toContain("delta <> 0");
  });

  it("ties a listing's prices to its price mode", () => {
    expect(sql).toContain("catalog_listings_credit_price_matches_mode");
    expect(sql).toContain("catalog_listings_money_price_matches_mode");
  });

  it("ties a checkout intent's credits to its purpose", () => {
    expect(sql).toContain("checkout_session_intents_credits_match_purpose");
  });

  it("refuses a plaintext checkout redirect", () => {
    expect(sql).toContain("success_url LIKE 'https://%'");
    expect(sql).toContain("cancel_url LIKE 'https://%'");
  });

  it("forces every split to balance at exactly 5000 basis points", () => {
    expect(sql).toContain("creator_credits + platform_credits = gross_credits");
    expect(sql).toContain("creator_minor + platform_minor = gross_minor");
    const basisChecks = sql.match(/basis_points = 5000/g) ?? [];
    expect(basisChecks.length).toBe(2);
  });

  it("records no payout — money splits are bookkeeping only", () => {
    for (const column of columnsOf("money_split_records")) {
      for (const forbidden of [
        "payout",
        "transfer",
        "destination",
        "connect",
        "stripe_account",
      ]) {
        expect(column).not.toContain(forbidden);
      }
    }
  });
});
