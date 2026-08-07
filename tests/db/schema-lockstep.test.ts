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

/**
 * The checkout intent price trigger, parsed into the pieces that decide whether
 * an UPDATE is refused: the columns the guard compares, the statements it runs
 * when they changed, and the statements that run regardless. A refusal hoisted
 * out of the guarded branch refuses every UPDATE, including the operational
 * ones the migration deliberately permits, so the split is what the assertions
 * below are actually about.
 */
const checkoutIntentPriceTrigger = () => {
  const functionBody =
    /CREATE OR REPLACE FUNCTION checkout_session_intents_price_immutable\(\)([\s\S]*?)\n\$\$;/.exec(
      sql,
    )?.[1];
  if (functionBody === undefined) {
    throw new Error("missing checkout intent price immutability function");
  }

  const statements = /\bBEGIN\b([\s\S]*)\bEND;\s*$/.exec(functionBody)?.[1];
  if (statements === undefined) {
    throw new Error("missing checkout intent price immutability body");
  }

  const guard = /\bIF\s([\s\S]*?)\sTHEN\b([\s\S]*?)\bEND IF;/.exec(statements);
  const guardText = guard?.[0];
  const condition = guard?.[1];
  const guarded = guard?.[2];
  if (
    guard === null ||
    guardText === undefined ||
    condition === undefined ||
    guarded === undefined
  ) {
    throw new Error("missing checkout intent price immutability predicate");
  }

  const columns = [
    ...condition.matchAll(
      /NEW\.([a-z_][a-z0-9_]*)\s+IS DISTINCT FROM\s+OLD\.\1/g,
    ),
  ].map((match) => match[1]);
  const operators = condition
    .replace(
      /NEW\.[a-z_][a-z0-9_]*\s+IS DISTINCT FROM\s+OLD\.[a-z_][a-z0-9_]*/g,
      "",
    )
    .replace(/\bOR\b/g, "")
    .trim();
  if (operators.length > 0) {
    throw new Error(`unexpected checkout intent trigger predicate: ${condition}`);
  }

  const unguarded = (
    statements.slice(0, guard.index) +
    statements.slice(guard.index + guardText.length)
  ).trim();

  return {
    columns: columns.filter((column): column is string => column !== undefined),
    guarded,
    unguarded,
  };
};

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
  stripe_connect_accounts: persistedDefinitionFields(
    "stripe-connect.schema.json",
    "connectAccountRecord",
  ),
  stripe_connect_onboarding_intents: persistedDefinitionFields(
    "stripe-connect.schema.json",
    "connectOnboardingIntent",
  ),
  stripe_connect_status_records: persistedDefinitionFields(
    "stripe-connect.schema.json",
    "connectStatusRecord",
  ),
  stripe_connect_payout_intents: persistedDefinitionFields(
    "stripe-connect.schema.json",
    "connectPayoutIntent",
  ),
  stripe_connect_payout_outcomes: persistedDefinitionFields(
    "stripe-connect.schema.json",
    "connectPayoutOutcome",
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
  stripe_connect_accounts: [
    "creatorUserId",
    "stripeAccountId",
    "mode",
    "providerRequestId",
    "createdAt",
  ],
  stripe_connect_onboarding_intents: [
    "onboardingIntentId",
    "creatorUserId",
    "stripeAccountId",
    "expiresAt",
    "mode",
    "idempotencyKey",
    "providerRequestId",
    "createdAt",
  ],
  stripe_connect_status_records: [
    "statusId",
    "creatorUserId",
    "stripeAccountId",
    "onboardingComplete",
    "payoutsEnabled",
    "requirementsDue",
    "providerRequestId",
    "observedAt",
  ],
  stripe_connect_payout_intents: [
    "payoutIntentId",
    "saleId",
    "creatorUserId",
    "stripeAccountId",
    "grossMinor",
    "creatorMinor",
    "platformMinor",
    "currency",
    "basisPoints",
    "mode",
    "idempotencyKey",
    "requestedAt",
  ],
  stripe_connect_payout_outcomes: [
    "payoutOutcomeId",
    "payoutIntentId",
    "status",
    "providerPayoutId",
    "providerEvidenceId",
    "providerMessage",
    "observedAt",
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

  it("keeps Better Auth persistence provider-owned and schema-pinned", () => {
    const providerSource = readFileSync(
      new URL("../../sites/umbrella/src/lib/better-auth-provider.ts", import.meta.url),
      "utf8",
    );
    for (const table of [
      "better_auth_users",
      "better_auth_sessions",
      "better_auth_accounts",
      "better_auth_verifications",
    ]) {
      expect(providerSource).toContain(`"${table}"`);
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    const providerMigration = readFileSync(
      join(migrationsDir, "0005_better_auth_provider.sql"),
      "utf8",
    );
    expect(providerMigration).not.toMatch(/^\s*"?role"?\s+/m);
    expect(providerMigration).toContain(
      'UNIQUE ("userId", "providerId")',
    );
    expect(providerMigration).toContain(
      '"providerId" <> \'credential\' OR "password" IS NOT NULL',
    );
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
      expect(CONTRACT_FIELDS[table]).toEqual(expect.arrayContaining([...fields]));
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

  it("keeps checkout intent prices immutable while operational updates proceed", () => {
    const {
      columns: priceColumns,
      guarded,
      unguarded,
    } = checkoutIntentPriceTrigger();
    expect(priceColumns).toEqual([
      "credits",
      "unit_amount",
      "currency",
      "stripe_price_id",
    ]);
    // Every NEW/OLD field the trigger names must be a real column, or Postgres
    // raises 42703 on every UPDATE and the targeted price guard becomes a total
    // UPDATE block — including the operational updates it deliberately permits.
    const intentColumns = columnsOf("checkout_session_intents");
    expect(intentColumns).toEqual(expect.arrayContaining(priceColumns));
    expect(sql).toMatch(
      /CREATE TRIGGER checkout_session_intents_price_immutable_trigger\s+BEFORE UPDATE ON checkout_session_intents/,
    );
    // The refusal has to sit inside the guarded branch and nowhere else: an
    // unconditional RAISE would still name the right columns and the right
    // errcode while refusing every operational update too.
    expect(guarded).toMatch(
      /RAISE EXCEPTION\s+'checkout_session_intents price columns are immutable; UPDATE is refused'\s+USING ERRCODE = 'restrict_violation';/,
    );
    expect(unguarded).not.toMatch(/\bRAISE\b/);
    expect(unguarded).toBe("RETURN NEW;");

    const operationalColumn = "success_url";
    expect(intentColumns).toContain(operationalColumn);
    expect(priceColumns).not.toContain(operationalColumn);

    const before: Record<string, bigint | string | null> = {
      credits: 100n,
      unit_amount: 1_000n,
      currency: "USD",
      stripe_price_id: "price_original",
      [operationalColumn]: "https://sceneaxi.example/success",
    };
    const triggerRefuses = (after: Record<string, bigint | string | null>) =>
      priceColumns.some((column) => !Object.is(before[column], after[column]));

    expect(
      triggerRefuses({
        ...before,
        [operationalColumn]: "https://sceneaxi.example/complete",
      }),
    ).toBe(false);

    const changedPriceValues: Record<string, bigint | string> = {
      credits: 200n,
      unit_amount: 2_000n,
      currency: "EUR",
      stripe_price_id: "price_changed",
    };
    for (const column of priceColumns) {
      const changed = changedPriceValues[column];
      if (changed === undefined) {
        throw new Error(`no changed value for price column ${column}`);
      }
      expect(triggerRefuses({ ...before, [column]: changed })).toBe(true);
    }
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

  it("stores every runtime-safe financial amount as bigint", () => {
    expect(sql).toMatch(/\bcredits\s+bigint,/);
    expect(sql).toMatch(/\bunit_amount\s+bigint\s+NOT NULL,/);
    expect(sql).toMatch(/\bcredit_price\s+bigint,/);
    expect(sql).toMatch(/\bmoney_unit_amount\s+bigint,/);
  });

  it("refuses a plaintext checkout redirect", () => {
    expect(sql).toContain("success_url LIKE 'https://%'");
    expect(sql).toContain("cancel_url LIKE 'https://%'");
  });

  it("forces every split to balance at exactly 5000 basis points", () => {
    expect(sql).toContain("creator_credits + platform_credits = gross_credits");
    expect(sql).toContain("creator_minor + platform_minor = gross_minor");
    expect(sql).toContain(
      "creator_credits = floor((gross_credits::numeric * 5000) / 10000)",
    );
    expect(sql).toContain(
      "platform_credits = gross_credits - creator_credits",
    );
    expect(sql).toContain(
      "creator_minor = floor((gross_minor::numeric * 5000) / 10000)",
    );
    expect(sql).toContain("platform_minor = gross_minor - creator_minor");
    const basisChecks = sql.match(/basis_points = 5000/g) ?? [];
    expect(basisChecks.length).toBe(3);
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

  it("keeps every Connect audit table and its money split append-only", () => {
    for (const table of [
      "money_split_records",
      "stripe_connect_accounts",
      "stripe_connect_onboarding_intents",
      "stripe_connect_status_records",
      "stripe_connect_payout_intents",
      "stripe_connect_payout_outcomes",
    ]) {
      expect(sql).toContain(
        `BEFORE UPDATE OR DELETE ON ${table}`,
      );
    }
    expect(sql).toContain("RAISE EXCEPTION '% is append-only', TG_TABLE_NAME");
  });

  it("cannot record Connect payout success without provider evidence", () => {
    expect(sql).toContain("provider_evidence_id text        NOT NULL UNIQUE");
    expect(sql).toContain(
      "status = 'succeeded' AND provider_payout_id IS NOT NULL",
    );
    expect(sql).toContain(
      "status = 'failed' AND provider_payout_id IS NULL",
    );
  });
});
