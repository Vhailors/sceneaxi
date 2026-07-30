import { describe, expect, it } from "vitest";
import {
  ADMIN_EMAIL_ENV_VAR,
  AUTH_REFUSE_REASONS,
  digestSessionToken,
  resolveAdminIdentity,
} from "@sceneaxi/auth";
import type { CreditAccount } from "@sceneaxi/schemas";
import {
  BILLING_REFUSE_REASONS,
  appendCreditEntry,
  createInMemoryCreditStore,
  createLedgerState,
  meterCredits,
  meteringIdempotencyKey,
  type LedgerState,
} from "@sceneaxi/billing";
import { issuePrincipalForTest } from "@sceneaxi/auth/testing/principal-issuance";
const NOW = Date.parse("2026-07-25T10:00:00Z");
const adminResolution = resolveAdminIdentity({
  [ADMIN_EMAIL_ENV_VAR]: "captain@example.com",
});
if (!adminResolution.ok) throw new Error(adminResolution.message);
// Resolved, never hand-built: guards check the identity's runtime provenance,
// so a structurally identical `{ email, source }` literal is refused.
const admin = adminResolution.value;

const ACCOUNT = Object.freeze({
  schemaVersion: 1,
  kind: "sceneaxi.credit-account",
  accountId: "acc_crew",
  userId: "usr_crew",
  createdAt: "2026-07-25T09:00:00Z",
}) as CreditAccount;

/** A valid principal for guard-backed paths; `user` role unless asked otherwise. */
const principal = (
  overrides: {
    userId?: string;
    role?: "admin" | "user";
    surface?: string;
    disabled?: boolean;
    expiresAt?: string;
  } = {},
): unknown => {
  const userId = overrides.userId ?? "usr_crew";
  const role = overrides.role ?? "user";
  return issuePrincipalForTest({
    user: {
      schemaVersion: 1,
      kind: "sceneaxi.user",
      userId,
      email: role === "admin" ? "captain@example.com" : "crew@example.com",
      emailVerified: true,
      disabled: overrides.disabled ?? false,
      createdAt: "2026-07-25T09:00:00Z",
    },
    role: {
      schemaVersion: 1,
      kind: "sceneaxi.role-assignment",
      userId,
      role,
      source: role === "admin" ? "admin-env" : "default-user",
      assignedAt: "2026-07-25T09:30:00Z",
    },
    session: {
      schemaVersion: 1,
      kind: "sceneaxi.session",
      sessionId: "ses_01",
      userId,
      surface: overrides.surface ?? "web-shell",
      issuedAt: "2026-07-25T09:00:00Z",
      expiresAt: overrides.expiresAt ?? "2026-07-26T10:00:00Z",
      tokenDigest: digestSessionToken("tok"),
    },
  });
};


const funded = (credits = 100): LedgerState => {
  const appended = appendCreditEntry(createLedgerState(ACCOUNT), {
    entryId: "ent_grant",
    movement: "grant",
    delta: credits,
    reason: "test funding",
    idempotencyKey: "fixture:grant",
    now: NOW,
  });
  if (!appended.ok) throw new Error("fixture funding failed");
  return appended.value.state;
};

const storeFor = (state: LedgerState) =>
  createInMemoryCreditStore({
    accounts: [state.account],
    entries: state.entries,
  });

const meter = (overrides: Record<string, unknown> = {}) => {
  const state = funded();
  return meterCredits({
    principal: principal(),
    admin,
    store: storeFor(state),
    state,
    amount: 10,
    reason: "hosted assistant turn",
    idempotencyKey: "usage:turn_01",
    now: NOW,
    ...overrides,
  } as never);
};

describe("meterCredits", () => {
  it("debits a user account and lowers the balance by exactly the amount", async () => {
    const state = funded();
    const store = storeFor(state);
    const result = await meterCredits({
      principal: principal(),
      admin,
      store,
      state,
      amount: 10,
      reason: "hosted assistant turn",
      idempotencyKey: "usage:turn_01",
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.metered).toBe(true);
    expect(result.value.balance).toBe(90);
    expect(result.value.entry?.delta).toBe(-10);
    expect(result.value.entry?.movement).toBe("debit");
    expect(store.entryCount(ACCOUNT.accountId)).toBe(2);
  });

  it("refuses the Appendix B.1 cross-user debit from an unissued principal", async () => {
    // The attacker is `usr_thief`; the targeted ledger is `acc_crew`, owned by
    // `usr_crew`. The forged principal names its own user, so it is not a role
    // claim the ownership comparison would catch — the only thing standing
    // between it and 40 of somebody else's credits is provenance, and it refuses
    // before the account is ever compared.
    const state = funded();
    const store = storeFor(state);
    const forged = structuredClone(principal({ userId: "usr_thief" }));

    const result = await meterCredits({
      principal: forged,
      admin,
      store,
      state,
      amount: 40,
      reason: "a turn the victim never asked for",
      idempotencyKey: "usage:forged_01",
      now: NOW,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.principalUnproven);
    // Not the ownership refusal: an unissued principal never reaches it.
    expect(result.reason).not.toBe(BILLING_REFUSE_REASONS.accountNotOwned);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
    const persisted = await store.listEntries(ACCOUNT.accountId);
    expect(persisted.at(-1)?.balanceAfter).toBe(100);
    expect(state.entries.length).toBe(1);
    expect(state.balance).toBe(100);
    expect(await store.findAccountByUserId("usr_thief")).toBeUndefined();
  });

  it("never debits an admin — the captain has an unlimited allowance", async () => {
    const state = funded();
    const result = await meterCredits({
      principal: principal({ role: "admin" }),
      admin,
      store: storeFor(state),
      state,
      amount: 10_000,
      reason: "hosted assistant turn",
      idempotencyKey: "usage:admin_01",
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.metered).toBe(false);
    expect(result.value.entry).toBeUndefined();
    expect(result.value.balance).toBe(100);
    // Reported, not faked with a zero-credit row.
    expect(result.value.state.entries.length).toBe(state.entries.length);
  });

  it("refuses a malformed admin ledger before applying unlimited allowance", async () => {
    const result = await meter({
      principal: principal({ role: "admin" }),
      state: {
        account: ACCOUNT,
        entries: funded().entries,
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.ledgerStateInvalid);
  });

  it("refuses a debit larger than the balance and appends nothing", async () => {
    const state = funded(5);
    const result = await meterCredits({
      principal: principal(),
      admin,
      store: storeFor(state),
      state,
      amount: 6,
      reason: "hosted assistant turn",
      idempotencyKey: "usage:over",
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.balanceInsufficient);
    expect(state.entries.length).toBe(1);
    expect(state.balance).toBe(5);
  });

  it("refuses an account owned by another user", async () => {
    const result = await meter({
      principal: principal({ userId: "usr_someone" }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.accountNotOwned);
  });

  it("surfaces the guard's exact reason rather than flattening it", async () => {
    const kids = await meter({ principal: principal({ surface: "kids" }) });
    expect(kids.ok).toBe(false);
    if (!kids.ok) {
      expect(kids.reason).toBe(AUTH_REFUSE_REASONS.kidsSurfaceDenied);
    }

    const expired = await meter({
      principal: principal({ expiresAt: "2026-07-25T09:30:00Z" }),
      admin,
    });
    expect(expired.ok).toBe(false);
    if (!expired.ok) {
      expect(expired.reason).toBe(AUTH_REFUSE_REASONS.sessionExpired);
    }

    const disabled = await meter({ principal: principal({ disabled: true }) });
    expect(disabled.ok).toBe(false);
    if (!disabled.ok) {
      expect(disabled.reason).toBe(AUTH_REFUSE_REASONS.userDisabled);
    }

    const malformed = await meter({ principal: { user: {} } });
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) {
      expect(malformed.reason).toBe(AUTH_REFUSE_REASONS.principalInvalid);
    }
  });

  it("refuses a surface mismatch when a surface is demanded", async () => {
    const result = await meter({
      principal: principal({ surface: "site" }),
      admin,
      surface: "web-shell",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.sessionSurfaceMismatch);
  });

  it("refuses a non-positive, fractional, or non-finite amount", async () => {
    for (const amount of [0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = await meter({ amount });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.amountInvalid);
    }
  });

  it("refuses an empty reason, an empty key, a bad clock, and a bad state", async () => {
    expect((await meter({ reason: "" })).ok).toBe(false);
    expect((await meter({ idempotencyKey: "" })).ok).toBe(false);
    expect((await meter({ now: Number.NaN })).ok).toBe(false);
    expect((await meter({ state: { entries: [] } })).ok).toBe(false);
  });

  it("is replay-safe on the same idempotency key", async () => {
    const state = funded();
    const store = storeFor(state);
    const first = await meterCredits({
      principal: principal(),
      admin,
      store,
      state,
      amount: 10,
      reason: "hosted assistant turn",
      idempotencyKey: "usage:turn_01",
      now: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const replay = await meterCredits({
      principal: principal(),
      admin,
      store,
      state: first.value.state,
      amount: 10,
      reason: "hosted assistant turn",
      idempotencyKey: "usage:turn_01",
      now: NOW,
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.value.replayed).toBe(true);
    expect(replay.value.balance).toBe(90);
    expect(replay.value.state.entries.length).toBe(
      first.value.state.entries.length,
    );
  });

  it("scopes the caller's key by account, so two accounts may share one key", async () => {
    const MATE = Object.freeze({
      schemaVersion: 1,
      kind: "sceneaxi.credit-account",
      accountId: "acc_mate",
      userId: "usr_mate",
      createdAt: "2026-07-25T09:00:00Z",
    }) as CreditAccount;
    const mateGrant = appendCreditEntry(createLedgerState(MATE), {
      entryId: "ent_grant_mate",
      movement: "grant",
      delta: 100,
      reason: "test funding",
      idempotencyKey: "fixture:grant:mate",
      now: NOW,
    });
    expect(mateGrant.ok).toBe(true);
    if (!mateGrant.ok) return;
    const crewState = funded();
    const mateState = mateGrant.value.state;
    // One store, so the global idempotency-key uniqueness the database enforces
    // applies across both accounts exactly as it does in production.
    const store = createInMemoryCreditStore({
      accounts: [crewState.account, MATE],
      entries: [...crewState.entries, ...mateState.entries],
    });

    const crew = await meterCredits({
      principal: principal(),
      admin,
      store,
      state: crewState,
      amount: 10,
      reason: "hosted assistant turn",
      idempotencyKey: "usage:turn_01",
      now: NOW,
    });
    expect(crew.ok).toBe(true);
    if (!crew.ok) return;
    expect(crew.value.entry?.idempotencyKey).toBe(
      meteringIdempotencyKey("acc_crew", "usage:turn_01"),
    );

    // The same caller key on a different account is distinct usage, not a
    // replay, and must not collide on the persisted unique index.
    const mate = await meterCredits({
      principal: principal({ userId: "usr_mate" }),
      admin,
      store,
      state: mateState,
      amount: 10,
      reason: "hosted assistant turn",
      idempotencyKey: "usage:turn_01",
      now: NOW,
    });
    expect(mate.ok).toBe(true);
    if (!mate.ok) return;
    expect(mate.value.metered).toBe(true);
    expect(mate.value.replayed).toBe(false);
    expect(mate.value.balance).toBe(90);
    expect(mate.value.entry?.idempotencyKey).toBe(
      meteringIdempotencyKey("acc_mate", "usage:turn_01"),
    );
    expect(store.entryCount("acc_mate")).toBe(2);
  });

  it("refuses a commit answer that is not this debit, however well-formed", async () => {
    // The port is structural, so a store that never went through
    // `createCreditStore` can answer with a schema-valid row belonging to some
    // other request. Trusting its shape alone would report a foreign entry as
    // this debit — and the balance derived beside it — instead of naming a
    // commit that could not be confirmed.
    const state = funded();
    const backing = storeFor(state);
    const store = Object.freeze({
      ...backing,
      appendOrReplayEntry() {
        return {
          entry: {
            ...state.entries[0],
            entryId: "ent_someone_else",
            idempotencyKey: "usage:someone-else",
          },
          replayed: true,
        };
      },
    });

    const result = await meterCredits({
      principal: principal(),
      admin,
      store,
      state,
      amount: 10,
      reason: "hosted assistant turn",
      idempotencyKey: "usage:turn_01",
      now: NOW,
    } as never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.storeFailed);
    expect(backing.entryCount(ACCOUNT.accountId)).toBe(state.entries.length);
  });

  it("refuses an unknown or stale persisted account", async () => {
    const state = funded();
    const missing = await meterCredits({
      principal: principal(),
      admin,
      store: createInMemoryCreditStore(),
      state,
      amount: 10,
      reason: "hosted assistant turn",
      idempotencyKey: "usage:missing",
      now: NOW,
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.reason).toBe(BILLING_REFUSE_REASONS.ledgerStateInvalid);
    }

    const stale = await meterCredits({
      principal: principal(),
      admin,
      store: createInMemoryCreditStore({ accounts: [ACCOUNT] }),
      state,
      amount: 10,
      reason: "hosted assistant turn",
      idempotencyKey: "usage:stale",
      now: NOW,
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) {
      expect(stale.reason).toBe(BILLING_REFUSE_REASONS.ledgerStateInvalid);
    }
  });

  /**
   * A lost response is the operational fault that makes a stale-state refusal
   * wrong (sceneaxi#128): the debit committed, the answer never arrived, and the
   * caller can only retry with the state it still holds — the state from *before*
   * its own entry. Refusing that as stale would strand the caller, since the
   * money is already gone and no retry it can construct would ever succeed.
   */
  describe("a debit whose first response was lost", () => {
    const lostRequest = (state: LedgerState, store: ReturnType<typeof storeFor>) =>
      ({
        principal: principal(),
        admin,
        store,
        state,
        amount: 10,
        reason: "hosted assistant turn",
        idempotencyKey: "usage:turn_01",
        now: NOW,
      }) as const;

    it("replays on retry and appends exactly one entry", async () => {
      const state = funded();
      const store = storeFor(state);

      const first = await meterCredits(lostRequest(state, store));
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      expect(first.value.replayed).toBe(false);

      // The caller never saw that result, so it retries with the pre-debit state.
      const retry = await meterCredits(lostRequest(state, store));
      expect(retry.ok).toBe(true);
      if (!retry.ok) return;
      expect(retry.value.metered).toBe(true);
      expect(retry.value.replayed).toBe(true);
      expect(retry.value.balance).toBe(90);
      expect(retry.value.entry).toEqual(first.value.entry);
      expect(retry.value.state.entries).toEqual(first.value.state.entries);
      // The funding grant plus one debit. A second debit would be the bug.
      expect(store.entryCount(ACCOUNT.accountId)).toBe(2);
    });

    it("does not reconcile a retry that asks for different money", async () => {
      const state = funded();
      const store = storeFor(state);
      const first = await meterCredits(lostRequest(state, store));
      expect(first.ok).toBe(true);

      // Same key, larger amount. The committed entry is not what this request
      // describes, so it is a conflict and stays a refusal.
      const mutated = await meterCredits({
        ...lostRequest(state, store),
        amount: 25,
      });
      expect(mutated.ok).toBe(false);
      if (mutated.ok) return;
      expect(mutated.reason).toBe(BILLING_REFUSE_REASONS.ledgerStateInvalid);
      expect(store.entryCount(ACCOUNT.accountId)).toBe(2);
    });

    it("still refuses a state made stale by somebody else's entry", async () => {
      const state = funded();
      const store = storeFor(state);

      // A different debit committed against this account, so the caller's state
      // is stale for a reason that is not its own lost response.
      const other = await meterCredits({
        ...lostRequest(state, store),
        idempotencyKey: "usage:turn_00",
      });
      expect(other.ok).toBe(true);

      const retry = await meterCredits(lostRequest(state, store));
      expect(retry.ok).toBe(false);
      if (retry.ok) return;
      expect(retry.reason).toBe(BILLING_REFUSE_REASONS.ledgerStateInvalid);
      expect(store.entryCount(ACCOUNT.accountId)).toBe(2);
    });
  });
});
