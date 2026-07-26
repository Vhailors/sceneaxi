import { describe, expect, it } from "vitest";
import { AUTH_REFUSE_REASONS, digestSessionToken } from "@sceneaxi/auth";
import type { CreditAccount } from "@sceneaxi/schemas";
import {
  BILLING_REFUSE_REASONS,
  HOSTED_AI_DEFAULT_CONFIG,
  HOSTED_AI_ROUTES,
  HOSTED_AI_ROUTE_CAPABILITIES,
  appendCreditEntry,
  createInMemoryCreditStore,
  createLedgerState,
  meteringIdempotencyKey,
  runMeteredModelCall,
  type LedgerState,
} from "@sceneaxi/billing";

const NOW = Date.parse("2026-07-25T10:00:00Z");
const admin = {
  email: "captain@example.com",
  source: "SCENEAXI_ADMIN_EMAIL",
} as const;

const ACCOUNT = Object.freeze({
  schemaVersion: 1,
  kind: "sceneaxi.credit-account",
  accountId: "acc_crew",
  userId: "usr_crew",
  createdAt: "2026-07-25T09:00:00Z",
}) as CreditAccount;

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

const funded = (credits: number): LedgerState => {
  if (credits === 0) return createLedgerState(ACCOUNT);
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

/**
 * A provider fake that records every invocation.
 *
 * The call *count* is what most of these tests assert on: "refused before the
 * provider ran" is only provable by observing that it did not run, and a fake
 * that merely returned a value could not tell that apart from a refusal after a
 * completed call.
 */
const recordingProvider = (response: unknown = { text: "fixture answer" }) => {
  const calls: number[] = [];
  return {
    calls,
    call: () => {
      calls.push(calls.length + 1);
      return response;
    },
  };
};

const hostedOn = { enabled: true } as const;

/** A funded hosted request; overrides narrow it to the case under test. */
const hostedCall = (
  state: LedgerState,
  provider: ReturnType<typeof recordingProvider>,
  overrides: Record<string, unknown> = {},
) =>
  runMeteredModelCall({
    route: "hosted",
    capability: "hosted-ai-assistant",
    call: provider.call,
    now: NOW,
    hostedAi: hostedOn,
    admin,
    principal: principal(),
    state,
    store: storeFor(state),
    creditAmount: 7,
    reason: "hosted assistant turn",
    idempotencyKey: "turn_01",
    surface: "web-shell",
    ...overrides,
  } as never);

describe("hosted-AI routes", () => {
  it("names both routes and the capabilities each may bill", () => {
    expect(HOSTED_AI_ROUTES).toEqual(["hosted", "byo"]);
    expect(HOSTED_AI_ROUTE_CAPABILITIES).toEqual({
      hosted: ["hosted-ai-assistant", "metered-model-port"],
      byo: ["byo-model-keys"],
    });
    expect(Object.isFrozen(HOSTED_AI_ROUTE_CAPABILITIES)).toBe(true);
  });

  it("ships hosted AI off", () => {
    expect(HOSTED_AI_DEFAULT_CONFIG).toEqual({ enabled: false });
    expect(Object.isFrozen(HOSTED_AI_DEFAULT_CONFIG)).toBe(true);
  });
});

describe("runMeteredModelCall — hosted route, funded", () => {
  it("runs the provider and debits exactly the configured credits, once", async () => {
    const state = funded(100);
    const store = storeFor(state);
    const provider = recordingProvider({ text: "fixture answer" });
    const result = await runMeteredModelCall({
      route: "hosted",
      capability: "hosted-ai-assistant",
      call: provider.call,
      now: NOW,
      hostedAi: hostedOn,
      admin,
      principal: principal(),
      state,
      store,
      creditAmount: 7,
      reason: "hosted assistant turn",
      idempotencyKey: "turn_01",
      surface: "web-shell",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(provider.calls.length).toBe(1);
    expect(result.value.response).toEqual({ text: "fixture answer" });
    expect(result.value.metered).toBe(true);
    expect(result.value.decision).toMatchObject({
      capability: "hosted-ai-assistant",
      outcome: "charge-credits",
      credits: 7,
    });
    expect(result.value.entry?.movement).toBe("debit");
    expect(result.value.entry?.delta).toBe(-7);
    expect(result.value.balance).toBe(93);
    // The debit reached persistence, under the account-scoped key.
    expect(store.entryCount(ACCOUNT.accountId)).toBe(2);
    expect(result.value.entry?.idempotencyKey).toBe(
      meteringIdempotencyKey(ACCOUNT.accountId, "turn_01"),
    );
  });

  it("bills a direct port call under its own matrix capability", async () => {
    const state = funded(20);
    const provider = recordingProvider();
    const result = await hostedCall(state, provider, {
      capability: "metered-model-port",
      creditAmount: 3,
      idempotencyKey: "port_01",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.capability).toBe("metered-model-port");
    expect(result.value.balance).toBe(17);
  });

  it("never debits the captain, and writes no zero-credit row for the allowance", async () => {
    const state = funded(100);
    const store = storeFor(state);
    const provider = recordingProvider();
    const result = await runMeteredModelCall({
      route: "hosted",
      capability: "hosted-ai-assistant",
      call: provider.call,
      now: NOW,
      hostedAi: hostedOn,
      admin,
      principal: principal({ role: "admin" }),
      state,
      store,
      creditAmount: 7,
      reason: "hosted assistant turn",
      idempotencyKey: "turn_admin",
      surface: "web-shell",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(provider.calls.length).toBe(1);
    expect(result.value.metered).toBe(false);
    expect(result.value.entry).toBeUndefined();
    expect(result.value.decision.outcome).toBe("allow-unlimited");
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
  });

  it("is replay-safe: the same key charges once", async () => {
    const state = funded(100);
    const store = storeFor(state);
    const provider = recordingProvider();
    const first = await runMeteredModelCall({
      route: "hosted",
      capability: "hosted-ai-assistant",
      call: provider.call,
      now: NOW,
      hostedAi: hostedOn,
      admin,
      principal: principal(),
      state,
      store,
      creditAmount: 7,
      reason: "hosted assistant turn",
      idempotencyKey: "turn_01",
    });
    expect(first.ok).toBe(true);
    if (!first.ok || first.value.state === undefined) return;

    const replay = await runMeteredModelCall({
      route: "hosted",
      capability: "hosted-ai-assistant",
      call: provider.call,
      now: NOW,
      hostedAi: hostedOn,
      admin,
      principal: principal(),
      state: first.value.state,
      store,
      creditAmount: 7,
      reason: "hosted assistant turn",
      idempotencyKey: "turn_01",
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.value.replayed).toBe(true);
    expect(replay.value.balance).toBe(93);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(2);
  });
});

describe("runMeteredModelCall — hosted route is default-off", () => {
  it("refuses when no hosted configuration is supplied at all", async () => {
    const state = funded(100);
    const provider = recordingProvider();
    const result = await hostedCall(state, provider, { hostedAi: undefined });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.hostedAiNotEnabled);
    expect(provider.calls.length).toBe(0);
  });

  it("refuses under the shipped default configuration", async () => {
    const state = funded(100);
    const provider = recordingProvider();
    const result = await hostedCall(state, provider, {
      hostedAi: HOSTED_AI_DEFAULT_CONFIG,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.hostedAiNotEnabled);
    expect(provider.calls.length).toBe(0);
  });

  it("refuses a truthy-but-not-true opt-in, so nothing enables it by accident", async () => {
    const state = funded(100);
    for (const enabled of ["true", 1, {}]) {
      const provider = recordingProvider();
      const result = await hostedCall(state, provider, {
        hostedAi: { enabled },
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.hostedAiNotEnabled);
      expect(provider.calls.length).toBe(0);
    }
  });

  it("refuses before identity or the ledger is consulted", async () => {
    const provider = recordingProvider();
    // No principal, no admin, no state, no store — and still the *same* refusal,
    // which is what makes "off" answerable without an account.
    const result = await runMeteredModelCall({
      route: "hosted",
      capability: "hosted-ai-assistant",
      call: provider.call,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.hostedAiNotEnabled);
    expect(provider.calls.length).toBe(0);
  });
});

describe("runMeteredModelCall — hosted route refuses before spending", () => {
  it("refuses a zero balance without calling the provider or appending a row", async () => {
    const state = funded(0);
    const store = storeFor(state);
    const provider = recordingProvider();
    const result = await hostedCall(state, provider, { store });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.balanceInsufficient);
    expect(provider.calls.length).toBe(0);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(0);
    expect(state.entries.length).toBe(0);
  });

  it("refuses an insufficient balance without calling the provider", async () => {
    const state = funded(6);
    const store = storeFor(state);
    const provider = recordingProvider();
    const result = await hostedCall(state, provider, { store });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.balanceInsufficient);
    expect(provider.calls.length).toBe(0);
    // The funding grant, and nothing else.
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
    expect(state.balance).toBe(6);
  });

  it("refuses an anonymous hosted call", async () => {
    const provider = recordingProvider();
    const result = await runMeteredModelCall({
      route: "hosted",
      capability: "hosted-ai-assistant",
      call: provider.call,
      now: NOW,
      hostedAi: hostedOn,
      admin,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.accountRequired);
    expect(provider.calls.length).toBe(0);
  });

  it("surfaces the guard's own reason for a settled session", async () => {
    const state = funded(100);
    const provider = recordingProvider();
    const expired = await hostedCall(state, provider, {
      principal: principal({ expiresAt: "2026-07-25T09:30:00Z" }),
    });
    expect(expired.ok).toBe(false);
    if (expired.ok) return;
    expect(expired.reason).toBe(AUTH_REFUSE_REASONS.sessionExpired);
    expect(provider.calls.length).toBe(0);
  });

  it("refuses a ledger owned by another user", async () => {
    const state = funded(100);
    const provider = recordingProvider();
    const result = await hostedCall(state, provider, {
      principal: principal({ userId: "usr_someone" }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.accountNotOwned);
    expect(provider.calls.length).toBe(0);
  });

  it("refuses missing metering inputs before the provider runs", async () => {
    const state = funded(100);
    for (const overrides of [
      { store: undefined },
      { store: { findAccountById: 1 } },
      { reason: "  " },
      { idempotencyKey: "" },
    ]) {
      const provider = recordingProvider();
      const result = await hostedCall(state, provider, overrides);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.requestInvalid);
      expect(provider.calls.length).toBe(0);
    }
  });

  it("refuses a missing or non-positive credit amount", async () => {
    const state = funded(100);
    for (const creditAmount of [undefined, 0, -1, 1.5]) {
      const provider = recordingProvider();
      const result = await hostedCall(state, provider, { creditAmount });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.creditAmountRequired);
      expect(provider.calls.length).toBe(0);
    }
  });
});

describe("runMeteredModelCall — failures do not half-apply", () => {
  it("names a provider failure and appends nothing", async () => {
    const state = funded(100);
    const store = storeFor(state);
    const result = await runMeteredModelCall({
      route: "hosted",
      capability: "hosted-ai-assistant",
      call: () => {
        throw new Error("provider exploded");
      },
      now: NOW,
      hostedAi: hostedOn,
      admin,
      principal: principal(),
      state,
      store,
      creditAmount: 7,
      reason: "hosted assistant turn",
      idempotencyKey: "turn_fail",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.hostedAiProviderFailed);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
    expect(state.balance).toBe(100);
  });

  it("names a rejected async provider the same way", async () => {
    const state = funded(100);
    const store = storeFor(state);
    const result = await runMeteredModelCall({
      route: "hosted",
      capability: "hosted-ai-assistant",
      call: () => Promise.reject(new Error("transport timeout")),
      now: NOW,
      hostedAi: hostedOn,
      admin,
      principal: principal(),
      state,
      store,
      creditAmount: 7,
      reason: "hosted assistant turn",
      idempotencyKey: "turn_reject",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.hostedAiProviderFailed);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
  });

  it("names a store failure and leaves no partial debit", async () => {
    const state = funded(100);
    const provider = recordingProvider();
    const store = storeFor(state);
    const throwingStore = Object.freeze({
      ...store,
      findAccountById() {
        throw new Error("db down");
      },
    });
    const result = await hostedCall(state, provider, { store: throwingStore });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.storeFailed);
    // The provider did run — the failure is downstream of it — but nothing was
    // charged, so the account is exactly as it was.
    expect(provider.calls.length).toBe(1);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
    expect(state.balance).toBe(100);
  });
});

describe("runMeteredModelCall — the BYO route stays free", () => {
  it("runs with no account, no store, and no ledger", async () => {
    const provider = recordingProvider({ text: "byo answer" });
    const result = await runMeteredModelCall({
      route: "byo",
      capability: "byo-model-keys",
      call: provider.call,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(provider.calls.length).toBe(1);
    expect(result.value.response).toEqual({ text: "byo answer" });
    expect(result.value.metered).toBe(false);
    expect(result.value.decision.outcome).toBe("allow-free");
    expect(result.value.entry).toBeUndefined();
    expect(result.value.balance).toBeUndefined();
  });

  it("does not need the hosted opt-in — BYO is not the hosted route", async () => {
    const provider = recordingProvider();
    const result = await runMeteredModelCall({
      route: "byo",
      capability: "byo-model-keys",
      call: provider.call,
      now: NOW,
      hostedAi: HOSTED_AI_DEFAULT_CONFIG,
    });
    expect(result.ok).toBe(true);
    expect(provider.calls.length).toBe(1);
  });

  it("charges nothing even when the caller is signed in with a balance", async () => {
    const state = funded(100);
    const store = storeFor(state);
    const provider = recordingProvider();
    const result = await runMeteredModelCall({
      route: "byo",
      capability: "byo-model-keys",
      call: provider.call,
      now: NOW,
      admin,
      principal: principal(),
      state,
      store,
      creditAmount: 7,
      reason: "byo turn",
      idempotencyKey: "byo_01",
      surface: "web-shell",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.metered).toBe(false);
    expect(result.value.entry).toBeUndefined();
    // The user is already paying their own provider; charging twice would be
    // indefensible, so the ledger is untouched.
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
    expect(state.balance).toBe(100);
  });

  it("refuses a hosted capability on the BYO route", async () => {
    const provider = recordingProvider();
    const result = await runMeteredModelCall({
      route: "byo",
      capability: "hosted-ai-assistant",
      call: provider.call,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.capabilityUnknown);
    expect(provider.calls.length).toBe(0);
  });
});

describe("runMeteredModelCall — Kids is denied on every route", () => {
  it("denies the Kids surface before identity, provider, or ledger", async () => {
    const state = funded(100);
    const store = storeFor(state);
    for (const route of HOSTED_AI_ROUTES) {
      const provider = recordingProvider();
      const result = await runMeteredModelCall({
        route,
        capability: HOSTED_AI_ROUTE_CAPABILITIES[route][0],
        call: provider.call,
        now: NOW,
        hostedAi: hostedOn,
        admin,
        principal: principal(),
        state,
        store,
        creditAmount: 7,
        reason: "kids turn",
        idempotencyKey: `kids_${route}`,
        surface: "kids",
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.kidsCommerceDenied);
      expect(provider.calls.length).toBe(0);
      expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
    }
  });

  it("denies a Kids session even when the surface is not named", async () => {
    const provider = recordingProvider();
    const result = await runMeteredModelCall({
      route: "byo",
      capability: "byo-model-keys",
      call: provider.call,
      now: NOW,
      principal: principal({ surface: "kids" }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.kidsCommerceDenied);
    expect(provider.calls.length).toBe(0);
  });

  it("denies Kids ahead of the default-off refusal, so the deny is not maskable", async () => {
    const provider = recordingProvider();
    const result = await runMeteredModelCall({
      route: "hosted",
      capability: "hosted-ai-assistant",
      call: provider.call,
      now: NOW,
      surface: "kids",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.kidsCommerceDenied);
  });
});

describe("runMeteredModelCall — request shape", () => {
  it("refuses an unnamed or unknown route", async () => {
    const provider = recordingProvider();
    for (const route of [undefined, "", "hosted-ai", "HOSTED", 1]) {
      const result = await runMeteredModelCall({
        route,
        capability: "byo-model-keys",
        call: provider.call,
        now: NOW,
      } as never);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.hostedAiRouteInvalid);
    }
    expect(provider.calls.length).toBe(0);
  });

  it("refuses a non-object request, a bad clock, and a missing provider call", async () => {
    const notObject = await runMeteredModelCall(null as never);
    expect(notObject.ok).toBe(false);
    if (!notObject.ok) {
      expect(notObject.reason).toBe(BILLING_REFUSE_REASONS.requestInvalid);
    }

    const badClock = await runMeteredModelCall({
      route: "byo",
      capability: "byo-model-keys",
      call: () => null,
      now: Number.NaN,
    });
    expect(badClock.ok).toBe(false);
    if (!badClock.ok) {
      expect(badClock.reason).toBe(BILLING_REFUSE_REASONS.clockInvalid);
    }

    const noCall = await runMeteredModelCall({
      route: "byo",
      capability: "byo-model-keys",
      call: undefined,
      now: NOW,
    } as never);
    expect(noCall.ok).toBe(false);
    if (!noCall.ok) {
      expect(noCall.reason).toBe(BILLING_REFUSE_REASONS.requestInvalid);
    }
  });

  it("refuses a capability outside the matrix", async () => {
    const provider = recordingProvider();
    const result = await runMeteredModelCall({
      route: "hosted",
      capability: "free-lunch",
      call: provider.call,
      now: NOW,
      hostedAi: hostedOn,
    } as never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.capabilityUnknown);
    expect(provider.calls.length).toBe(0);
  });
});
