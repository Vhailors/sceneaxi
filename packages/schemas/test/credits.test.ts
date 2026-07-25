import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CREDITS_REFUSE_CODES,
  CREDITS_SCHEMA_VERSION,
  CREDIT_ACCOUNT_KIND,
  CREDIT_LEDGER_ENTRY_KIND,
  CREDIT_MOVEMENTS,
  validateCreditAccount,
  validateCreditLedgerEntry,
} from "@sceneaxi/schemas";

const ACCOUNT = {
  schemaVersion: 1,
  kind: CREDIT_ACCOUNT_KIND,
  accountId: "acc_01",
  userId: "usr_01",
  createdAt: "2026-07-25T10:00:00Z",
} as const;

/** A record with one required key removed, for missing-property refusals. */
const without = (record: object, key: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));

const ENTRY = {
  schemaVersion: 1,
  kind: CREDIT_LEDGER_ENTRY_KIND,
  entryId: "ent_01",
  accountId: "acc_01",
  sequence: 1,
  movement: "grant",
  delta: 100,
  balanceAfter: 100,
  reason: "checkout completed",
  idempotencyKey: "stripe-event:evt_01",
  occurredAt: "2026-07-25T10:00:00Z",
} as const;

describe("credit movements", () => {
  it("are exactly grant, debit, adjustment", () => {
    expect([...CREDIT_MOVEMENTS]).toEqual(["grant", "debit", "adjustment"]);
    expect(Object.isFrozen(CREDIT_MOVEMENTS)).toBe(true);
  });
});

describe("validateCreditAccount", () => {
  it("accepts a canonical account", () => {
    const result = validateCreditAccount(ACCOUNT);
    expect(result.ok).toBe(true);
  });

  it("refuses a stored balance — the ledger is the only source of truth", () => {
    const result = validateCreditAccount({ ...ACCOUNT, balance: 100 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(CREDITS_REFUSE_CODES.unexpectedProperty);
  });

  it("refuses a non-object, version mismatch, kind mismatch, and missing property", () => {
    const notObject = validateCreditAccount([ACCOUNT]);
    expect(notObject.ok).toBe(false);
    if (!notObject.ok) {
      expect(notObject.code).toBe(CREDITS_REFUSE_CODES.notObject);
    }
    const version = validateCreditAccount({ ...ACCOUNT, schemaVersion: 99 });
    expect(version.ok).toBe(false);
    if (!version.ok) {
      expect(version.code).toBe(CREDITS_REFUSE_CODES.schemaVersionMismatch);
    }
    const kind = validateCreditAccount({ ...ACCOUNT, kind: "sceneaxi.user" });
    expect(kind.ok).toBe(false);
    if (!kind.ok) {
      expect(kind.code).toBe(CREDITS_REFUSE_CODES.kindMismatch);
    }
    const missing = validateCreditAccount(without(ACCOUNT, "userId"));
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.code).toBe(CREDITS_REFUSE_CODES.missingProperty);
    }
  });
});

describe("validateCreditLedgerEntry", () => {
  it("accepts a canonical grant", () => {
    const result = validateCreditLedgerEntry(ENTRY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it("accepts a debit with a negative delta", () => {
    const result = validateCreditLedgerEntry({
      ...ENTRY,
      entryId: "ent_02",
      sequence: 2,
      movement: "debit",
      delta: -10,
      balanceAfter: 90,
      idempotencyKey: "usage:job_01",
    });
    expect(result.ok).toBe(true);
  });

  it("refuses a grant with a negative delta and a debit with a positive delta", () => {
    const grant = validateCreditLedgerEntry({ ...ENTRY, delta: -100, balanceAfter: 0 });
    expect(grant.ok).toBe(false);
    if (!grant.ok) {
      expect(grant.code).toBe(CREDITS_REFUSE_CODES.deltaSignMismatch);
    }
    const debit = validateCreditLedgerEntry({
      ...ENTRY,
      movement: "debit",
      delta: 10,
      balanceAfter: 110,
    });
    expect(debit.ok).toBe(false);
    if (!debit.ok) {
      expect(debit.code).toBe(CREDITS_REFUSE_CODES.deltaSignMismatch);
    }
  });

  it("refuses a zero, fractional, or non-finite delta", () => {
    for (const delta of [0, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = validateCreditLedgerEntry({ ...ENTRY, delta });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe(CREDITS_REFUSE_CODES.invalidProperty);
    }
  });

  it("publishes the runtime delta sign rules in JSON Schema", () => {
    const schema: unknown = JSON.parse(
      readFileSync(
        new URL("../contracts/credit-ledger.schema.json", import.meta.url),
        "utf8",
      ),
    );
    expect(schema).toMatchObject({
      $defs: {
        creditLedgerEntry: {
          properties: {
            delta: {
              type: "integer",
              not: { const: 0 },
            },
          },
          allOf: [
            {
              if: {
                properties: { movement: { const: "grant" } },
                required: ["movement"],
              },
              then: {
                properties: { delta: { minimum: 1 } },
              },
            },
            {
              if: {
                properties: { movement: { const: "debit" } },
                required: ["movement"],
              },
              then: {
                properties: { delta: { maximum: -1 } },
              },
            },
          ],
        },
      },
    });
  });

  it("refuses a negative balanceAfter", () => {
    const result = validateCreditLedgerEntry({
      ...ENTRY,
      movement: "debit",
      delta: -200,
      balanceAfter: -100,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(CREDITS_REFUSE_CODES.balanceNegative);
  });

  it("refuses a zero or fractional sequence — the ledger is 1-based", () => {
    for (const sequence of [0, -1, 1.5]) {
      const result = validateCreditLedgerEntry({ ...ENTRY, sequence });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe(CREDITS_REFUSE_CODES.invalidProperty);
    }
  });

  it("refuses an empty reason — every movement is attributable", () => {
    for (const reason of ["", "   "]) {
      const result = validateCreditLedgerEntry({ ...ENTRY, reason });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe(CREDITS_REFUSE_CODES.invalidProperty);
    }
  });

  it("accepts a namespaced idempotency key and refuses a malformed one", () => {
    expect(
      validateCreditLedgerEntry({
        ...ENTRY,
        idempotencyKey: "stripe-event:evt_1ABCdef",
      }).ok,
    ).toBe(true);
    for (const idempotencyKey of ["", "has space", "-leading-dash"]) {
      const result = validateCreditLedgerEntry({ ...ENTRY, idempotencyKey });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe(CREDITS_REFUSE_CODES.invalidProperty);
    }
  });

  it("refuses an unknown movement and an unexpected property", () => {
    const movement = validateCreditLedgerEntry({ ...ENTRY, movement: "refund" });
    expect(movement.ok).toBe(false);
    if (!movement.ok) {
      expect(movement.code).toBe(CREDITS_REFUSE_CODES.invalidProperty);
    }
    const extra = validateCreditLedgerEntry({ ...ENTRY, note: "hello" });
    expect(extra.ok).toBe(false);
    if (!extra.ok) {
      expect(extra.code).toBe(CREDITS_REFUSE_CODES.unexpectedProperty);
    }
  });
});

describe("credits contract version", () => {
  it("is major version 1", () => {
    expect(CREDITS_SCHEMA_VERSION).toBe(1);
  });
});
