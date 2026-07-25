import { describe, expect, it } from "vitest";
import {
  validateCreditLedgerEntry,
  type CreditAccount,
} from "@sceneaxi/schemas";
import {
  BILLING_REFUSE_REASONS,
  appendCreditEntry,
  createInMemoryCreditStore,
  createLedgerState,
  deriveBalance,
  loadLedgerState,
  type LedgerState,
} from "@sceneaxi/billing";
const NOW = Date.parse("2026-07-25T10:00:00Z");

const ACCOUNT = Object.freeze({
  schemaVersion: 1,
  kind: "sceneaxi.credit-account",
  accountId: "acc_crew",
  userId: "usr_crew",
  createdAt: "2026-07-25T09:00:00Z",
}) as CreditAccount;


const grant = (overrides: Record<string, unknown> = {}) => ({
  entryId: "ent_01",
  movement: "grant" as const,
  delta: 100,
  reason: "checkout completed",
  idempotencyKey: "stripe-event:evt_01",
  now: NOW,
  ...overrides,
});

const seeded = (): LedgerState => {
  const appended = appendCreditEntry(createLedgerState(ACCOUNT), grant());
  if (!appended.ok) throw new Error("fixture append failed");
  return appended.value.state;
};

describe("appendCreditEntry", () => {
  it("returns a new state and leaves the prior one untouched", () => {
    const before = createLedgerState(ACCOUNT);
    const appended = appendCreditEntry(before, grant());
    expect(appended.ok).toBe(true);
    if (!appended.ok) return;

    expect(appended.value.state).not.toBe(before);
    expect(before.entries.length).toBe(0);
    expect(before.balance).toBe(0);
    expect(appended.value.state.balance).toBe(100);
  });

  it("freezes the state and its entries so a rewrite throws", () => {
    const state = seeded();
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.entries)).toBe(true);
    const first = state.entries[0];
    if (first === undefined) throw new Error("expected an entry");
    expect(Object.isFrozen(first)).toBe(true);
    expect(() => {
      (first as unknown as Record<string, unknown>)["delta"] = 999;
    }).toThrow();
    expect(() => {
      (state.entries as unknown as unknown[]).push({});
    }).toThrow();
  });

  it("assigns a strictly monotonic 1-based sequence", () => {
    let state = createLedgerState(ACCOUNT);
    for (let i = 1; i <= 3; i += 1) {
      const appended = appendCreditEntry(state, {
        ...grant(),
        entryId: `ent_0${i}`,
        delta: 10,
        idempotencyKey: `grant:${i}`,
      });
      expect(appended.ok).toBe(true);
      if (!appended.ok) return;
      expect(appended.value.entry?.sequence).toBe(i);
      state = appended.value.state;
    }
    expect(state.balance).toBe(30);
  });

  it("computes balanceAfter itself so a caller cannot assert a wrong one", () => {
    const appended = appendCreditEntry(seeded(), {
      ...grant(),
      entryId: "ent_02",
      delta: 5,
      idempotencyKey: "grant:2",
      balanceAfter: 9999,
    });
    expect(appended.ok).toBe(true);
    if (!appended.ok) return;
    expect(appended.value.entry?.balanceAfter).toBe(105);
  });

  it("enforces delta sign rules per movement", () => {
    const state = seeded();
    const badGrant = appendCreditEntry(state, {
      ...grant(),
      delta: -5,
      idempotencyKey: "g:neg",
    });
    expect(badGrant.ok).toBe(false);
    if (!badGrant.ok) {
      expect(badGrant.reason).toBe(BILLING_REFUSE_REASONS.deltaSignMismatch);
    }
    const badDebit = appendCreditEntry(state, {
      ...grant(),
      movement: "debit",
      delta: 5,
      idempotencyKey: "d:pos",
    });
    expect(badDebit.ok).toBe(false);
    if (!badDebit.ok) {
      expect(badDebit.reason).toBe(BILLING_REFUSE_REASONS.deltaSignMismatch);
    }
  });

  it("accepts an adjustment in either direction", () => {
    const state = seeded();
    for (const delta of [7, -7]) {
      const appended = appendCreditEntry(state, {
        ...grant(),
        movement: "adjustment",
        delta,
        reason: "admin correction",
        idempotencyKey: `adj:${delta}`,
      });
      expect(appended.ok).toBe(true);
    }
  });

  it("refuses a zero, fractional, or non-finite delta", () => {
    for (const delta of [0, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = appendCreditEntry(seeded(), {
        ...grant(),
        delta,
        idempotencyKey: `bad:${String(delta)}`,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.requestInvalid);
    }
  });

  it("refuses a debit larger than the balance and appends nothing", () => {
    const state = seeded();
    const result = appendCreditEntry(state, {
      ...grant(),
      movement: "debit",
      delta: -101,
      reason: "too much",
      idempotencyKey: "usage:big",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.balanceInsufficient);
    expect(state.entries.length).toBe(1);
    expect(state.balance).toBe(100);
  });

  it("allows a debit that lands exactly on zero", () => {
    const result = appendCreditEntry(seeded(), {
      ...grant(),
      movement: "debit",
      delta: -100,
      reason: "spend it all",
      idempotencyKey: "usage:all",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.balance).toBe(0);
  });

  it("replays an identical idempotency key without appending", () => {
    const state = seeded();
    const replay = appendCreditEntry(state, {
      ...grant(),
      entryId: "ent_regenerated",
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.value.replayed).toBe(true);
    expect(replay.value.state.entries.length).toBe(1);
    expect(replay.value.state.balance).toBe(100);
    // The original entry is returned, not the regenerated id.
    expect(replay.value.entry?.entryId).toBe("ent_01");
  });

  it("refuses the same key carrying different money — a mutated replay cannot top up", () => {
    for (const patch of [
      { delta: 500 },
      { movement: "debit" as const, delta: -1 },
      { reason: "different reason" },
    ]) {
      const result = appendCreditEntry(seeded(), { ...grant(), ...patch });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.idempotencyConflict);
    }
  });

  it("refuses a malformed state, request, clock, reason, and key", () => {
    expect(appendCreditEntry(null, grant()).ok).toBe(false);
    expect(appendCreditEntry({ entries: [] }, grant()).ok).toBe(false);
    expect(appendCreditEntry(createLedgerState(ACCOUNT), null).ok).toBe(false);
    for (const patch of [
      { now: Number.NaN },
      { reason: "" },
      { reason: "   " },
      { idempotencyKey: "" },
    ]) {
      const result = appendCreditEntry(createLedgerState(ACCOUNT), {
        ...grant(),
        ...patch,
      });
      expect(result.ok).toBe(false);
    }
  });

  it("produces entries that satisfy the published contract", () => {
    const state = seeded();
    for (const entry of state.entries) {
      expect(validateCreditLedgerEntry(entry).ok).toBe(true);
    }
  });

  it("stamps occurredAt from the injected clock", () => {
    const state = seeded();
    expect(state.entries[0]?.occurredAt).toBe("2026-07-25T10:00:00.000Z");
  });
});

describe("deriveBalance", () => {
  it("equals the last entry's balanceAfter", () => {
    const state = seeded();
    const derived = deriveBalance(state.entries);
    expect(derived.ok).toBe(true);
    if (!derived.ok) return;
    expect(derived.value).toBe(state.entries.at(-1)?.balanceAfter);
  });

  it("is zero for an empty ledger", () => {
    const derived = deriveBalance([]);
    expect(derived.ok).toBe(true);
    if (!derived.ok) return;
    expect(derived.value).toBe(0);
  });

  it("refuses a gapped sequence", () => {
    const state = seeded();
    const first = state.entries[0];
    if (first === undefined) throw new Error("expected an entry");
    const gapped = [{ ...first, sequence: 2 }];
    const derived = deriveBalance(gapped);
    expect(derived.ok).toBe(false);
    if (derived.ok) return;
    expect(derived.reason).toBe(BILLING_REFUSE_REASONS.ledgerOrderInvalid);
  });

  it("refuses a reordered list", () => {
    let state = createLedgerState(ACCOUNT);
    for (let i = 1; i <= 2; i += 1) {
      const appended = appendCreditEntry(state, {
        ...grant(),
        entryId: `ent_0${i}`,
        delta: 10,
        idempotencyKey: `g:${i}`,
      });
      if (!appended.ok) throw new Error("fixture append failed");
      state = appended.value.state;
    }
    const derived = deriveBalance([...state.entries].reverse());
    expect(derived.ok).toBe(false);
    if (derived.ok) return;
    expect(derived.reason).toBe(BILLING_REFUSE_REASONS.ledgerOrderInvalid);
  });

  it("refuses a duplicated idempotency key", () => {
    const state = seeded();
    const first = state.entries[0];
    if (first === undefined) throw new Error("expected an entry");
    const derived = deriveBalance([
      first,
      { ...first, entryId: "ent_dupe", sequence: 2, balanceAfter: 200 },
    ]);
    expect(derived.ok).toBe(false);
    if (derived.ok) return;
    expect(derived.reason).toBe(BILLING_REFUSE_REASONS.ledgerOrderInvalid);
  });

  it("refuses a tampered balanceAfter", () => {
    const state = seeded();
    const first = state.entries[0];
    if (first === undefined) throw new Error("expected an entry");
    const derived = deriveBalance([{ ...first, balanceAfter: 1_000_000 }]);
    expect(derived.ok).toBe(false);
    if (derived.ok) return;
    expect(derived.reason).toBe(BILLING_REFUSE_REASONS.ledgerOrderInvalid);
  });

  it("refuses an invalid entry and a non-array", () => {
    expect(deriveBalance([{ nope: true }]).ok).toBe(false);
    expect(deriveBalance("entries").ok).toBe(false);
  });
});

describe("loadLedgerState", () => {
  it("rebuilds state from persisted entries", () => {
    const state = seeded();
    const loaded = loadLedgerState(ACCOUNT, state.entries);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.balance).toBe(100);
    expect(loaded.value.entries.length).toBe(1);
  });

  it("refuses entries belonging to another account", () => {
    const state = seeded();
    const first = state.entries[0];
    if (first === undefined) throw new Error("expected an entry");
    const loaded = loadLedgerState(ACCOUNT, [
      { ...first, accountId: "acc_other" },
    ]);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.reason).toBe(BILLING_REFUSE_REASONS.ledgerStateInvalid);
  });

  it("refuses a corrupted history rather than producing plausible arithmetic", () => {
    const state = seeded();
    const first = state.entries[0];
    if (first === undefined) throw new Error("expected an entry");
    const loaded = loadLedgerState(ACCOUNT, [{ ...first, sequence: 5 }]);
    expect(loaded.ok).toBe(false);
  });
});

describe("in-memory credit store", () => {
  it("mirrors the database append-only constraints", () => {
    const state = seeded();
    const entry = state.entries[0];
    if (entry === undefined) throw new Error("expected an entry");
    const store = createInMemoryCreditStore({ accounts: [ACCOUNT] });

    store.appendEntry(entry);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);

    expect(() => store.appendEntry(entry)).toThrow(/append-only|already applied/);
    expect(() =>
      store.appendEntry({ ...entry, entryId: "ent_other", idempotencyKey: "k2" }),
    ).toThrow(/sequence 1 already exists/);
    expect(() =>
      store.appendEntry({ ...entry, entryId: "ent_other", sequence: 2 }),
    ).toThrow(/idempotency key/);
  });

  it("looks accounts up by id and by user", async () => {
    const store = createInMemoryCreditStore({ accounts: [ACCOUNT] });
    expect(await store.findAccountById("acc_crew")).toEqual(ACCOUNT);
    expect(await store.findAccountByUserId("usr_crew")).toEqual(ACCOUNT);
    expect(await store.findAccountById("acc_missing")).toBeUndefined();
  });
});
