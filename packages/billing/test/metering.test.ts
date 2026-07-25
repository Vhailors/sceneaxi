import { describe, expect, it } from "vitest";
import { AUTH_REFUSE_REASONS, digestSessionToken } from "@sceneaxi/auth";
import type { CreditAccount } from "@sceneaxi/schemas";
import {
  BILLING_REFUSE_REASONS,
  appendCreditEntry,
  createLedgerState,
  meterCredits,
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
  return {
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
  };
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

const meter = (overrides: Record<string, unknown> = {}) =>
  meterCredits({
    principal: principal(),
    state: funded(),
    amount: 10,
    reason: "hosted assistant turn",
    idempotencyKey: "usage:turn_01",
    now: NOW,
    ...overrides,
  } as never);

describe("meterCredits", () => {
  it("debits a user account and lowers the balance by exactly the amount", () => {
    const result = meter();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.metered).toBe(true);
    expect(result.value.balance).toBe(90);
    expect(result.value.entry?.delta).toBe(-10);
    expect(result.value.entry?.movement).toBe("debit");
  });

  it("never debits an admin — the captain has an unlimited allowance", () => {
    const state = funded();
    const result = meterCredits({
      principal: principal({ role: "admin" }),
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

  it("refuses a debit larger than the balance and appends nothing", () => {
    const state = funded(5);
    const result = meterCredits({
      principal: principal(),
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

  it("refuses an account owned by another user", () => {
    const result = meter({ principal: principal({ userId: "usr_someone" }) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.accountNotOwned);
  });

  it("surfaces the guard's exact reason rather than flattening it", () => {
    const kids = meter({ principal: principal({ surface: "kids" }) });
    expect(kids.ok).toBe(false);
    if (!kids.ok) {
      expect(kids.reason).toBe(AUTH_REFUSE_REASONS.kidsSurfaceDenied);
    }

    const expired = meter({
      principal: principal({ expiresAt: "2026-07-25T09:30:00Z" }),
    });
    expect(expired.ok).toBe(false);
    if (!expired.ok) {
      expect(expired.reason).toBe(AUTH_REFUSE_REASONS.sessionExpired);
    }

    const disabled = meter({ principal: principal({ disabled: true }) });
    expect(disabled.ok).toBe(false);
    if (!disabled.ok) {
      expect(disabled.reason).toBe(AUTH_REFUSE_REASONS.userDisabled);
    }

    const malformed = meter({ principal: { user: {} } });
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) {
      expect(malformed.reason).toBe(AUTH_REFUSE_REASONS.principalInvalid);
    }
  });

  it("refuses a surface mismatch when a surface is demanded", () => {
    const result = meter({
      principal: principal({ surface: "site" }),
      surface: "web-shell",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.sessionSurfaceMismatch);
  });

  it("refuses a non-positive, fractional, or non-finite amount", () => {
    for (const amount of [0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = meter({ amount });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.amountInvalid);
    }
  });

  it("refuses an empty reason, an empty key, a bad clock, and a bad state", () => {
    expect(meter({ reason: "" }).ok).toBe(false);
    expect(meter({ idempotencyKey: "" }).ok).toBe(false);
    expect(meter({ now: Number.NaN }).ok).toBe(false);
    expect(meter({ state: { entries: [] } }).ok).toBe(false);
  });

  it("is replay-safe on the same idempotency key", () => {
    const first = meter();
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const replay = meterCredits({
      principal: principal(),
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
});
