import { describe, expect, it } from "vitest";
import {
  ADMIN_EMAIL_ENV_VAR,
  AUTH_REFUSE_REASONS,
  digestSessionToken,
  resolveAdminIdentity,
} from "@sceneaxi/auth";
import type { CreditAccount, CreditLedgerEntry } from "@sceneaxi/schemas";
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
  type CreditStore,
  type CreditsSaleSettlement,
  type LedgerState,
} from "@sceneaxi/billing";

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
 * Persist a debit the caller never learns about, the way a second surface
 * spending the same account concurrently would. The `state` handed back to the
 * caller is deliberately left untouched, so from here on it is the stale copy a
 * real race leaves a caller holding.
 */
const spendBehindTheCaller = async (
  state: LedgerState,
  store: ReturnType<typeof storeFor>,
  credits: number,
) => {
  const spent = appendCreditEntry(state, {
    entryId: `ent_behind_${credits}`,
    movement: "debit",
    delta: -credits,
    reason: "another surface's turn",
    idempotencyKey: meteringIdempotencyKey(ACCOUNT.accountId, "other_turn"),
    now: NOW,
  });
  if (!spent.ok || spent.value.entry === undefined) {
    throw new Error("fixture concurrent debit failed");
  }
  await store.appendEntry(spent.value.entry);
};

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
    expect(result.value.replayed).toBe(false);
    if (result.value.replayed) return;
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

  it("refuses the captain when the hosted ledger is absent or stale", async () => {
    const state = funded(100);
    const store = storeFor(state);
    const provider = recordingProvider();
    const request = {
      route: "hosted",
      capability: "hosted-ai-assistant",
      call: provider.call,
      now: NOW,
      hostedAi: hostedOn,
      admin,
      principal: principal({ role: "admin" }),
      store,
      creditAmount: 7,
      reason: "hosted assistant turn",
      idempotencyKey: "turn_admin",
      surface: "web-shell",
    } as const;

    const absent = await runMeteredModelCall(request);
    expect(absent.ok).toBe(false);
    if (absent.ok) return;
    expect(absent.reason).toBe(BILLING_REFUSE_REASONS.ledgerStateInvalid);

    await spendBehindTheCaller(state, store, 1);
    const stale = await runMeteredModelCall({ ...request, state });
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.reason).toBe(BILLING_REFUSE_REASONS.ledgerStateInvalid);
    expect(provider.calls).toHaveLength(0);
  });

  it("is replay-safe: the same key charges once and calls the provider once", async () => {
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
    // The retry is answered from the debit that already exists, so the upstream
    // provider is not paid a second time for one charge.
    expect(provider.calls.length).toBe(1);
    if (!replay.value.replayed) return;
    expect(replay.value.entry.idempotencyKey).toBe(
      meteringIdempotencyKey(ACCOUNT.accountId, "turn_01"),
    );
    expect(replay.value.entry.delta).toBe(-7);
    expect(replay.value.metered).toBe(true);
  });

  it("replays a charge the remaining balance can no longer afford", async () => {
    // The account is funded for exactly one turn. After it, the balance is below
    // the price — which is precisely when a timed-out caller retries, and exactly
    // where a bottom-of-the-stack replay check would answer "you cannot afford
    // this" for a turn the caller has already paid for.
    const state = funded(10);
    const store = storeFor(state);
    const provider = recordingProvider();
    const first = await hostedCall(state, provider, { store });
    expect(first.ok).toBe(true);
    if (!first.ok || first.value.state === undefined) return;
    expect(first.value.balance).toBe(3);

    const replay = await hostedCall(first.value.state, provider, { store });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.value.replayed).toBe(true);
    expect(replay.value.balance).toBe(3);
    expect(provider.calls.length).toBe(1);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(2);
  });

  it("refuses a retry that still holds the pre-debit ledger view", async () => {
    const state = funded(10);
    const store = storeFor(state);
    const provider = recordingProvider();
    const first = await hostedCall(state, provider, { store });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const replay = await hostedCall(state, provider, { store });
    expect(replay.ok).toBe(false);
    if (replay.ok) return;
    expect(replay.reason).toBe(BILLING_REFUSE_REASONS.ledgerStateInvalid);
    expect(provider.calls.length).toBe(1);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(2);
  });

  it("reports a debit a concurrent request committed under the same key", async () => {
    // Two requests share one scoped key. Both read a ledger with no such debit,
    // so both enter the provider; the other one commits first. This call's own
    // append is answered from that committed row, and reporting it as a fresh
    // charge would claim an append this request never made.
    const state = funded(100);
    const store = storeFor(state);
    const provider = recordingProvider();
    let raced = false;
    const racedStore: CreditStore = {
      findAccountByUserId: (userId) => store.findAccountByUserId(userId),
      findAccountById: (accountId) => store.findAccountById(accountId),
      listEntries: (accountId) => store.listEntries(accountId),
      appendEntry: (entry) => store.appendEntry(entry),
      async appendOrReplayEntry(entry) {
        if (!raced) {
          raced = true;
          await store.appendEntry({ ...entry, entryId: "ent_race_winner" });
        }
        return store.appendOrReplayEntry(entry);
      },
      settleCreditsSale: (settlement: CreditsSaleSettlement) =>
        store.settleCreditsSale(settlement),
    };

    const result = await hostedCall(state, provider, { store: racedStore });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The provider was entered, so this is a completed call carrying a real
    // answer — not the response-less replayed shape.
    expect(result.value.replayed).toBe(false);
    if (result.value.replayed) return;
    expect(result.value.response).toEqual({ text: "fixture answer" });
    expect(result.value.debitReplayed).toBe(true);
    expect(result.value.metered).toBe(true);
    // Exactly one debit exists, and it is the row the ledger actually holds.
    expect(store.entryCount(ACCOUNT.accountId)).toBe(2);
    expect(result.value.entry?.entryId).toBe("ent_race_winner");
    expect(result.value.entry?.idempotencyKey).toBe(
      meteringIdempotencyKey(ACCOUNT.accountId, "turn_01"),
    );
    expect(result.value.balance).toBe(93);
  });

  it("reports a fresh debit as one this call appended", async () => {
    const state = funded(100);
    const store = storeFor(state);
    const provider = recordingProvider();
    const result = await hostedCall(state, provider, { store });
    expect(result.ok).toBe(true);
    if (!result.ok || result.value.replayed) return;
    expect(result.value.debitReplayed).toBe(false);
  });

  it("refuses a mutated replay rather than returning the cheaper original", async () => {
    const state = funded(100);
    const store = storeFor(state);
    const provider = recordingProvider();
    const first = await hostedCall(state, provider, { store });
    expect(first.ok).toBe(true);
    if (!first.ok || first.value.state === undefined) return;

    for (const overrides of [
      { creditAmount: 12 },
      { reason: "a different turn entirely" },
    ]) {
      const mutated = await hostedCall(first.value.state, provider, {
        store,
        ...overrides,
      });
      expect(mutated.ok).toBe(false);
      if (mutated.ok) return;
      expect(mutated.reason).toBe(BILLING_REFUSE_REASONS.idempotencyConflict);
      expect(provider.calls.length).toBe(1);
      expect(store.entryCount(ACCOUNT.accountId)).toBe(2);
    }
  });

  it("still applies the guard to a replay: a settled session refuses", async () => {
    const state = funded(100);
    const store = storeFor(state);
    const provider = recordingProvider();
    const first = await hostedCall(state, provider, { store });
    expect(first.ok).toBe(true);
    if (!first.ok || first.value.state === undefined) return;

    const replay = await hostedCall(first.value.state, provider, {
      store,
      principal: principal({ expiresAt: "2026-07-25T09:30:00Z" }),
    });
    expect(replay.ok).toBe(false);
    if (replay.ok) return;
    expect(replay.reason).toBe(AUTH_REFUSE_REASONS.sessionExpired);
    expect(provider.calls.length).toBe(1);
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

  it("refuses a stale caller's fresh key before judging its balance", async () => {
    const state = funded(10);
    const store = storeFor(state);
    await spendBehindTheCaller(state, store, 8);
    const provider = recordingProvider();

    const result = await hostedCall(state, provider, {
      store,
      idempotencyKey: "turn_02",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.ledgerStateInvalid);
    expect(provider.calls.length).toBe(0);
    // The funding grant and the concurrent debit, and nothing else.
    expect(store.entryCount(ACCOUNT.accountId)).toBe(2);
    expect(state.balance).toBe(10);
  });

  it("refuses a stale caller even when the persisted balance is sufficient", async () => {
    const state = funded(10);
    const store = storeFor(state);
    await spendBehindTheCaller(state, store, 1);
    const provider = recordingProvider();

    const result = await hostedCall(state, provider, {
      store,
      idempotencyKey: "turn_02",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.ledgerStateInvalid);
    expect(provider.calls.length).toBe(0);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(2);
  });

  it("does not read the account store for a principal that cannot spend", async () => {
    // The account id arrives inside a caller-supplied state, so an expired,
    // disabled, or wrong-user principal must not be able to make persistence
    // answer questions about it. The refusal still comes from the entitlement
    // layer that owns identity vocabulary.
    const state = funded(100);
    for (const [overrides, reason] of [
      [
        { principal: principal({ expiresAt: "2026-07-25T09:30:00Z" }) },
        AUTH_REFUSE_REASONS.sessionExpired,
      ],
      [
        { principal: principal({ disabled: true }) },
        AUTH_REFUSE_REASONS.userDisabled,
      ],
      [
        { principal: principal({ userId: "usr_someone" }) },
        BILLING_REFUSE_REASONS.accountNotOwned,
      ],
    ] as const) {
      const reads: string[] = [];
      const backing = storeFor(state);
      const watchedStore = Object.freeze({
        ...backing,
        findAccountById(accountId: string) {
          reads.push(accountId);
          return backing.findAccountById(accountId);
        },
        listEntries(accountId: string) {
          reads.push(accountId);
          return backing.listEntries(accountId);
        },
      });
      const provider = recordingProvider();

      const result = await hostedCall(state, provider, {
        store: watchedStore,
        ...overrides,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(reason);
      expect(reads).toEqual([]);
      expect(provider.calls.length).toBe(0);
    }
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

  it("refuses a fabricated claim on another user's account before reading its history", async () => {
    // The supplied state is the caller's own writing, so claiming ownership of a
    // stranger's account id validates. The account persistence returns is what
    // settles it: the entries of an account the principal does not own are never
    // loaded, so a guessed metering key cannot be answered from them.
    const other = Object.freeze({
      ...ACCOUNT,
      accountId: "acc_other",
      userId: "usr_other",
    }) as CreditAccount;
    const otherFunded = appendCreditEntry(createLedgerState(other), {
      entryId: "ent_other_grant",
      movement: "grant",
      delta: 100,
      reason: "another user's funding",
      idempotencyKey: "fixture:other-grant",
      now: NOW,
    });
    if (!otherFunded.ok) throw new Error("fixture funding failed");
    const otherSpent = appendCreditEntry(otherFunded.value.state, {
      entryId: "ent_other_turn",
      movement: "debit",
      delta: -3,
      reason: "another user's turn",
      idempotencyKey: meteringIdempotencyKey(other.accountId, "turn_01"),
      now: NOW,
    });
    if (!otherSpent.ok) throw new Error("fixture debit failed");
    const backing = createInMemoryCreditStore({
      accounts: [other],
      entries: otherSpent.value.state.entries,
    });
    const histories: string[] = [];
    const store = Object.freeze({
      ...backing,
      listEntries(accountId: string) {
        histories.push(accountId);
        return backing.listEntries(accountId);
      },
    });
    const provider = recordingProvider();

    const result = await hostedCall(
      { account: { ...other, userId: "usr_crew" }, entries: [], balance: 0 },
      provider,
      { store },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.accountNotOwned);
    expect(histories).toEqual([]);
    expect(provider.calls.length).toBe(0);
    expect(backing.entryCount(other.accountId)).toBe(2);
  });

  it("refuses an absent hosted ledger port before the provider runs", async () => {
    const state = funded(100);
    for (const overrides of [
      { store: undefined },
      { store: { findAccountById: 1 } },
    ]) {
      const provider = recordingProvider();
      const result = await hostedCall(state, provider, overrides);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.ledgerStateInvalid);
      expect(provider.calls.length).toBe(0);
    }
  });

  it("refuses missing debit attribution before the provider runs", async () => {
    const state = funded(100);
    for (const overrides of [{ reason: "  " }, { idempotencyKey: "" }]) {
      const provider = recordingProvider();
      const result = await hostedCall(state, provider, overrides);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.requestInvalid);
      expect(provider.calls.length).toBe(0);
    }
  });

  it("accepts an injected store whose methods live on a prototype", async () => {
    const state = funded(100);
    const backing = storeFor(state);
    class PrototypeCreditStore implements CreditStore {
      findAccountByUserId(userId: string) {
        return backing.findAccountByUserId(userId);
      }
      findAccountById(accountId: string) {
        return backing.findAccountById(accountId);
      }
      listEntries(accountId: string) {
        return backing.listEntries(accountId);
      }
      appendEntry(entry: CreditLedgerEntry) {
        return backing.appendEntry(entry);
      }
      appendOrReplayEntry(entry: CreditLedgerEntry) {
        return backing.appendOrReplayEntry(entry);
      }
      settleCreditsSale(settlement: CreditsSaleSettlement) {
        return backing.settleCreditsSale(settlement);
      }
    }
    const provider = recordingProvider();
    const result = await hostedCall(state, provider, {
      store: new PrototypeCreditStore(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.metered).toBe(true);
    expect(result.value.balance).toBe(93);
    expect(provider.calls.length).toBe(1);
    expect(backing.entryCount(ACCOUNT.accountId)).toBe(2);
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

  it("charges nothing for a value-shaped refusal the integration translates", async () => {
    // The documented caller obligation: a provider layer that reports refusals as
    // data — the Model Provider Port's `{ ok: false, reason }` — converts them to
    // a throw in its own integration, because the thunk is provider-neutral and a
    // returned value is a completed call billing must pay for. Written out here
    // in billing's own tests so the obligation is regressed at the seam that
    // spends the money, without billing naming a provider type.
    const state = funded(100);
    const store = storeFor(state);
    const calls: number[] = [];
    const refusal = {
      ok: false as const,
      reason: "MODEL_PROVIDER_PROFILE_POLICY_MISSING",
    };
    const result = await hostedCall(state, recordingProvider(), {
      store,
      call: () => {
        calls.push(calls.length + 1);
        if (!refusal.ok) throw new Error(refusal.reason);
        return refusal;
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.hostedAiProviderFailed);
    expect(calls.length).toBe(1);
    // The funding grant, and nothing else: a refused call is not a sold one.
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
    expect(state.balance).toBe(100);
  });

  it("names a store failure and leaves no partial debit", async () => {
    const state = funded(100);
    const provider = recordingProvider();
    const store = storeFor(state);
    const throwingStore = Object.freeze({
      ...store,
      appendOrReplayEntry() {
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

  it("refuses an unreadable ledger before the provider is entered", async () => {
    // "We cannot tell whether this key was already charged" is not a licence to
    // pay the upstream provider on the chance that it was not.
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
    expect(provider.calls.length).toBe(0);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
    expect(state.balance).toBe(100);
  });

  it("refuses an account persistence does not have, before the provider", async () => {
    const state = funded(100);
    const provider = recordingProvider();
    const store = storeFor(state);
    const emptyStore = Object.freeze({
      ...store,
      findAccountById() {
        return undefined;
      },
    });
    const result = await hostedCall(state, provider, { store: emptyStore });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.ledgerStateInvalid);
    expect(provider.calls.length).toBe(0);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
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
    expect(result.value.replayed).toBe(false);
    if (result.value.replayed) return;
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
