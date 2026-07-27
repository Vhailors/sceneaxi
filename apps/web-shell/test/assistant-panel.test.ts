/**
 * Seam tests for the in-app AI assistant panel (sceneaxi#121).
 *
 * Everything here imports `@sceneaxi/web-shell` by its public package name and
 * wires the *real* Model Provider Port and the *real* credit gate over injected
 * stubs. The stub adapter records every prompt it is handed, so "refused before
 * dispatch" is asserted against the deepest observable point in the provider
 * stack rather than against the thunk the gate was given; the in-memory credit
 * store's entry count is the matching ground truth for "nothing was charged".
 *
 * The composition with a real recorded OpenRouter transport lives in
 * `tests/e2e/assistant-panel-golden.test.ts`, where `@sceneaxi/provider-openrouter`
 * is nameable — the web shell may not depend on a provider package, and that is
 * the point of injecting a port.
 */

import { describe, expect, it } from "vitest";
import {
  ASSISTANT_DEBIT_REASON,
  ASSISTANT_DEFAULT_MODE,
  ASSISTANT_MODES,
  ASSISTANT_MODE_BILLING,
  ASSISTANT_PANEL_REASONS,
  ASSISTANT_TURN_KEY_PREFIX,
  createAssistantPanel,
  type AssistantCreditsView,
  type AssistantMode,
  type AssistantPanelReason,
  type CreateAssistantPanelOptions,
} from "@sceneaxi/web-shell";
import {
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  MODEL_PROVIDER_REFUSE_REASONS,
  createModelProviderPort,
  type ModelProviderAdapter,
  type ModelProviderPort,
} from "@sceneaxi/authoring-core";
import {
  ADMIN_EMAIL_ENV_VAR,
  AUTH_REFUSE_REASONS,
  digestSessionToken,
} from "@sceneaxi/auth";
import {
  BILLING_REFUSE_REASONS,
  HOSTED_AI_DEFAULT_CONFIG,
  HOSTED_AI_ROUTE_CAPABILITIES,
  appendCreditEntry,
  createInMemoryCreditStore,
  createLedgerState,
  meteringIdempotencyKey,
  type LedgerState,
} from "@sceneaxi/billing";
import type { CreditAccount, ModelDescriptor } from "@sceneaxi/schemas";

const NOW = Date.parse("2026-07-27T10:00:00Z");
const clock = () => NOW;
const admin = {
  email: "captain@example.com",
  source: ADMIN_EMAIL_ENV_VAR,
} as const;

const MODEL: ModelDescriptor = Object.freeze({
  model: "openai/gpt-fixture-2026-07-24",
  provider: "openrouter",
  quantization: "provider-default-pinned",
  version: "2026-07-24",
});

const ACCOUNT = Object.freeze({
  schemaVersion: 1,
  kind: "sceneaxi.credit-account",
  accountId: "acc_crew",
  userId: "usr_crew",
  createdAt: "2026-07-27T09:00:00Z",
}) as CreditAccount;

const OTHER_ACCOUNT = Object.freeze({
  ...ACCOUNT,
  accountId: "acc_stranger",
  userId: "usr_stranger",
}) as CreditAccount;

const PRINCIPAL = Object.freeze({
  user: {
    schemaVersion: 1,
    kind: "sceneaxi.user",
    userId: "usr_crew",
    email: "crew@example.com",
    emailVerified: true,
    disabled: false,
    createdAt: "2026-07-27T09:00:00Z",
  },
  role: {
    schemaVersion: 1,
    kind: "sceneaxi.role-assignment",
    userId: "usr_crew",
    role: "user",
    source: "default-user",
    assignedAt: "2026-07-27T09:30:00Z",
  },
  session: {
    schemaVersion: 1,
    kind: "sceneaxi.session",
    sessionId: "ses_01",
    userId: "usr_crew",
    surface: "web-shell",
    issuedAt: "2026-07-27T09:00:00Z",
    expiresAt: "2026-07-28T10:00:00Z",
    tokenDigest: digestSessionToken("tok"),
  },
}) as never as CreateAssistantPanelOptions["principal"] & object;

const funded = (credits: number, account: CreditAccount = ACCOUNT) => {
  if (credits === 0) return createLedgerState(account);
  const appended = appendCreditEntry(createLedgerState(account), {
    entryId: "ent_grant",
    movement: "grant",
    delta: credits,
    reason: "fixture funding",
    idempotencyKey: "fixture:grant",
    now: NOW,
  });
  if (!appended.ok) throw new Error("fixture funding failed");
  return appended.value.state;
};

/** A recorded adapter that answers every prompt and counts its dispatches. */
const recordedAdapter = (prompts: string[]): ModelProviderAdapter =>
  Object.freeze({
    routeKind: "third-party" as const,
    capabilities: Object.freeze({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operations: Object.freeze(["complete"] as const),
    }),
    complete(request) {
      prompts.push(request.prompt);
      return Object.freeze({
        response: Object.freeze({
          schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
          operation: "complete" as const,
          text: `recorded: ${request.prompt}`,
          finishReason: "stop" as const,
        }),
        executedModel: MODEL,
      });
    },
  });

const providerStack = (
  policies: Parameters<
    typeof createModelProviderPort
  >[0]["profilePolicies"] = {
    "@sceneaxi/profile-web": () => ({ ok: true }),
  },
) => {
  const prompts: string[] = [];
  const port = createModelProviderPort({
    adapter: recordedAdapter(prompts),
    profilePolicies: policies,
  });
  return { prompts, port };
};

const creditsView = (state: LedgerState | undefined): AssistantCreditsView =>
  Object.freeze({ ledgerFor: () => state });

type PanelOverrides = Partial<CreateAssistantPanelOptions>;

const panelFor = (
  ports: Readonly<Partial<Record<AssistantMode, ModelProviderPort>>>,
  overrides: PanelOverrides = {},
) => {
  const created = createAssistantPanel({
    surface: "web-shell",
    profile: "@sceneaxi/profile-web",
    model: MODEL,
    ports,
    admin,
    clock,
    ...overrides,
  });
  if (!created.ok) throw new Error(`panel refused: ${created.reason}`);
  return created.panel;
};

/** A funded hosted panel wired to one store, returned with that store. */
const hostedPanel = (credits: number, overrides: PanelOverrides = {}) => {
  const state = funded(credits);
  const store = createInMemoryCreditStore({
    accounts: [state.account],
    entries: state.entries,
  });
  const stack = providerStack();
  const panel = panelFor(
    { fixture: stack.port, hosted: stack.port },
    {
      mode: "hosted",
      hostedAi: { enabled: true },
      principal: PRINCIPAL,
      credits: creditsView(state),
      store,
      hostedTurnCredits: 4,
      ...overrides,
    },
  );
  return { panel, store, stack, state };
};

describe("assistant mode table", () => {
  it("is a projection of billing's own route capabilities, not a second policy", () => {
    for (const mode of ASSISTANT_MODES) {
      const { route, capability } = ASSISTANT_MODE_BILLING[mode];
      expect(HOSTED_AI_ROUTE_CAPABILITIES[route]).toContain(capability);
    }
  });

  it("meters the hosted mode and only the hosted mode", () => {
    expect(ASSISTANT_MODE_BILLING.fixture.route).toBe("byo");
    expect(ASSISTANT_MODE_BILLING.byo.route).toBe("byo");
    expect(ASSISTANT_MODE_BILLING.hosted.route).toBe("hosted");
  });

  it("defaults to the deterministic fixture transport", () => {
    expect(ASSISTANT_DEFAULT_MODE).toBe("fixture");
    const stack = providerStack();
    const panel = panelFor({ fixture: stack.port });
    expect(panel.snapshot()).toMatchObject({
      mode: "fixture",
      metered: false,
      hostedEnabled: false,
      turns: [],
    });
    expect(panel.snapshot().creditBalance).toBeUndefined();
  });

  it("keeps SceneAxi-hosted AI off unless a caller enables it", () => {
    expect(HOSTED_AI_DEFAULT_CONFIG.enabled).toBe(false);
    const stack = providerStack();
    const panel = panelFor(
      { fixture: stack.port, hosted: stack.port },
      { mode: "hosted" },
    );
    expect(panel.snapshot().hostedEnabled).toBe(false);
  });
});

describe("fixture and BYO modes never touch the ledger", () => {
  it("answers a fixture turn through the port with no metering", async () => {
    const stack = providerStack();
    const panel = panelFor({ fixture: stack.port });

    const snapshot = await panel.ask({ prompt: "how do I place a cube?" });

    expect(snapshot.refusal).toBeUndefined();
    expect(stack.prompts).toEqual(["how do I place a cube?"]);
    expect(snapshot.turns).toHaveLength(1);
    expect(snapshot.turns[0]).toMatchObject({
      mode: "fixture",
      prompt: "how do I place a cube?",
      text: "recorded: how do I place a cube?",
      finishReason: "stop",
      metered: false,
      evidence: {
        kind: "sceneaxi.model-provider-call-evidence",
        operation: "complete",
        profile: "@sceneaxi/profile-web",
        model: MODEL,
      },
    });
    expect(snapshot.turns[0]?.credits).toBeUndefined();
    expect(snapshot.creditBalance).toBeUndefined();
  });

  it("charges nothing on the BYO route even for a funded signed-in viewer", async () => {
    const state = funded(10);
    const store = createInMemoryCreditStore({
      accounts: [state.account],
      entries: state.entries,
    });
    const stack = providerStack();
    let ledgerReads = 0;
    const panel = panelFor(
      { fixture: stack.port, byo: stack.port },
      {
        mode: "byo",
        principal: PRINCIPAL,
        credits: {
          ledgerFor: () => {
            ledgerReads += 1;
            return state;
          },
        },
        store,
        hostedTurnCredits: 4,
        hostedAi: { enabled: true },
      },
    );

    const snapshot = await panel.ask({ prompt: "byo turn", turnId: "t1" });

    expect(snapshot.refusal).toBeUndefined();
    expect(stack.prompts).toHaveLength(1);
    expect(snapshot.turns[0]?.metered).toBe(false);
    expect(snapshot.turns[0]?.credits).toBeUndefined();
    // The ledger is neither read by the panel nor written by the gate.
    expect(ledgerReads).toBe(0);
    expect(snapshot.creditBalance).toBeUndefined();
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
    expect(state.balance).toBe(10);
  });

  it("refuses a mode with no wired port instead of borrowing another's", async () => {
    const stack = providerStack();
    const panel = panelFor({ fixture: stack.port });

    const switched = panel.setMode("hosted");

    expect(switched.refusal?.reason).toBe(
      ASSISTANT_PANEL_REASONS.transportMissing,
    );
    // The refused switch does not move the panel off the mode it was on.
    expect(switched.mode).toBe("fixture");
    expect(panel.snapshot().mode).toBe("fixture");
    expect(stack.prompts).toHaveLength(0);
  });

  it("refuses an unknown mode", () => {
    const stack = providerStack();
    const panel = panelFor({ fixture: stack.port });
    expect(panel.setMode("live").refusal?.reason).toBe(
      ASSISTANT_PANEL_REASONS.modeUnknown,
    );
  });
});

describe("hosted mode debits through the existing ledger", () => {
  it("is default-off: a wired hosted port alone enables nothing", async () => {
    const { panel, store, stack } = hostedPanel(10, {
      hostedAi: HOSTED_AI_DEFAULT_CONFIG,
    });

    const snapshot = await panel.ask({ prompt: "hosted turn", turnId: "t1" });

    expect(snapshot.refusal?.reason).toBe(
      BILLING_REFUSE_REASONS.hostedAiNotEnabled,
    );
    expect(stack.prompts).toHaveLength(0);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
  });

  it("debits exactly the configured credits for one turn", async () => {
    const { panel, store, stack } = hostedPanel(10);

    const snapshot = await panel.ask({ prompt: "hosted turn", turnId: "t1" });

    expect(snapshot.refusal).toBeUndefined();
    expect(stack.prompts).toEqual(["hosted turn"]);
    expect(snapshot.metered).toBe(true);
    expect(snapshot.turns[0]).toMatchObject({
      mode: "hosted",
      text: "recorded: hosted turn",
      metered: true,
      credits: 4,
    });
    expect(snapshot.creditBalance).toBe(6);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(2);
  });

  it("scopes the turn key to the account and attributes the debit", async () => {
    const { panel, store } = hostedPanel(10);

    await panel.ask({ prompt: "hosted turn", turnId: "t1" });

    const entries = await store.listEntries(ACCOUNT.accountId);
    expect(entries[1]).toMatchObject({
      movement: "debit",
      delta: -4,
      reason: ASSISTANT_DEBIT_REASON,
      idempotencyKey: meteringIdempotencyKey(
        ACCOUNT.accountId,
        `${ASSISTANT_TURN_KEY_PREFIX}:t1`,
      ),
    });
  });

  it("answers a retried turn from the debit it already made", async () => {
    const { panel, store, stack } = hostedPanel(10);

    await panel.ask({ prompt: "hosted turn", turnId: "t1" });
    const retry = await panel.ask({ prompt: "hosted turn", turnId: "t1" });

    expect(retry.refusal?.reason).toBe(
      ASSISTANT_PANEL_REASONS.turnAlreadyCharged,
    );
    // No second provider execution, no second charge, and no invented answer.
    expect(stack.prompts).toHaveLength(1);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(2);
    expect(retry.turns).toHaveLength(1);
    expect(retry.creditBalance).toBe(6);
  });

  it("refuses an insufficient balance before the provider is dispatched", async () => {
    const { panel, store, stack } = hostedPanel(3);

    const snapshot = await panel.ask({ prompt: "hosted turn", turnId: "t1" });

    expect(snapshot.refusal?.reason).toBe(
      BILLING_REFUSE_REASONS.balanceInsufficient,
    );
    expect(stack.prompts).toHaveLength(0);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
  });

  it("refuses a zero balance before the provider is dispatched", async () => {
    const { panel, store, stack } = hostedPanel(0);

    const snapshot = await panel.ask({ prompt: "hosted turn", turnId: "t1" });

    expect(snapshot.refusal?.reason).toBe(
      BILLING_REFUSE_REASONS.balanceInsufficient,
    );
    expect(stack.prompts).toHaveLength(0);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(0);
  });

  it("judges a stale ledger against persistence, not against the copy it was handed", async () => {
    const state = funded(10);
    const store = createInMemoryCreditStore({
      accounts: [state.account],
      entries: state.entries,
    });
    const stack = providerStack();
    const spend = (credits: number, view: AssistantCreditsView) =>
      panelFor(
        { fixture: stack.port, hosted: stack.port },
        {
          mode: "hosted",
          hostedAi: { enabled: true },
          principal: PRINCIPAL,
          credits: view,
          store,
          hostedTurnCredits: credits,
        },
      );

    const first = await spend(8, creditsView(state)).ask({
      prompt: "hosted turn",
      turnId: "t1",
    });
    expect(first.creditBalance).toBe(2);

    // A second panel still holding the pre-debit ledger, with a *fresh* key so
    // the replay path cannot answer it. The stale copy says 10 and would clear
    // the balance gate; persistence says 2, and that is what decides.
    const stale = await spend(8, creditsView(state)).ask({
      prompt: "hosted turn again",
      turnId: "t2",
    });

    expect(stale.refusal?.reason).toBe(
      BILLING_REFUSE_REASONS.balanceInsufficient,
    );
    expect(stack.prompts).toEqual(["hosted turn"]);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(2);
    // And it does not publish the stale copy's number beside that refusal: the
    // panel has no gate-derived balance for this turn, so it reports none.
    expect(stale.creditBalance).toBeUndefined();
  });

  it("reports only a balance the credit gate derived from persistence", async () => {
    const { panel } = hostedPanel(10);

    // Nothing authoritative exists before a turn has been priced.
    expect(panel.snapshot().creditBalance).toBeUndefined();
    const refused = await panel.ask({ prompt: "hosted turn" });
    expect(refused.refusal?.reason).toBe(BILLING_REFUSE_REASONS.requestInvalid);
    expect(refused.creditBalance).toBeUndefined();

    const charged = await panel.ask({ prompt: "hosted turn", turnId: "t1" });
    expect(charged.creditBalance).toBe(6);
  });

  it("keeps a turn on the mode it was asked in when the mode changes mid-flight", async () => {
    const { panel, store } = hostedPanel(10);

    const inFlight = panel.ask({ prompt: "hosted turn", turnId: "t1" });
    panel.setMode("fixture");
    const snapshot = await inFlight;

    expect(snapshot.turns[0]).toMatchObject({
      mode: "hosted",
      metered: true,
      credits: 4,
    });
    expect(store.entryCount(ACCOUNT.accountId)).toBe(2);
    // The switch itself still took effect for the *next* turn.
    expect(panel.snapshot().mode).toBe("fixture");
  });

  it("refuses an absent ledger rather than reading it as a zero balance", async () => {
    const { panel, stack } = hostedPanel(10, {
      credits: creditsView(undefined),
    });

    const snapshot = await panel.ask({ prompt: "hosted turn", turnId: "t1" });

    expect(snapshot.refusal?.reason).toBe(
      ASSISTANT_PANEL_REASONS.ledgerMissing,
    );
    expect(stack.prompts).toHaveLength(0);
    expect(snapshot.creditBalance).toBeUndefined();
  });

  it("refuses an unreadable credits view rather than substituting a default", async () => {
    const { panel, stack } = hostedPanel(10, {
      credits: {
        ledgerFor() {
          throw new Error("neon unreachable");
        },
      },
    });

    const snapshot = await panel.ask({ prompt: "hosted turn", turnId: "t1" });

    expect(snapshot.refusal?.reason).toBe(
      ASSISTANT_PANEL_REASONS.creditsUnavailable,
    );
    expect(stack.prompts).toHaveLength(0);
  });

  it("refuses a ledger owned by a different user", async () => {
    const { panel, stack } = hostedPanel(10, {
      credits: creditsView(funded(10, OTHER_ACCOUNT)),
    });

    const snapshot = await panel.ask({ prompt: "hosted turn", turnId: "t1" });

    expect(snapshot.refusal?.reason).toBe(
      ASSISTANT_PANEL_REASONS.ledgerOwnerMismatch,
    );
    expect(stack.prompts).toHaveLength(0);
  });

  it("refuses a structurally invalid ledger in the ledger's own vocabulary", async () => {
    const broken = { ...funded(10), balance: 999 } as LedgerState;
    const { panel, stack } = hostedPanel(10, { credits: creditsView(broken) });

    const snapshot = await panel.ask({ prompt: "hosted turn", turnId: "t1" });

    expect(snapshot.refusal?.reason).toBe(
      BILLING_REFUSE_REASONS.ledgerStateInvalid,
    );
    expect(stack.prompts).toHaveLength(0);
  });

  it("requires a credits view before it will broker a hosted turn", async () => {
    const { panel, stack } = hostedPanel(10, { credits: undefined });

    const snapshot = await panel.ask({ prompt: "hosted turn", turnId: "t1" });

    expect(snapshot.refusal?.reason).toBe(
      ASSISTANT_PANEL_REASONS.creditsViewMissing,
    );
    expect(stack.prompts).toHaveLength(0);
  });

  it("lets the entitlement matrix speak for an anonymous hosted turn", async () => {
    const { panel, stack } = hostedPanel(10, { principal: undefined });

    const snapshot = await panel.ask({ prompt: "hosted turn", turnId: "t1" });

    expect(snapshot.refusal?.reason).toBe(
      BILLING_REFUSE_REASONS.accountRequired,
    );
    expect(stack.prompts).toHaveLength(0);
  });

  it("lets the credit gate refuse a hosted turn with no replayable key", async () => {
    const { panel, store, stack } = hostedPanel(10);

    const snapshot = await panel.ask({ prompt: "hosted turn" });

    expect(snapshot.refusal?.reason).toBe(
      BILLING_REFUSE_REASONS.requestInvalid,
    );
    expect(stack.prompts).toHaveLength(0);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
  });

  it("refuses an expired session in the auth guard's own vocabulary", async () => {
    const expired = {
      ...PRINCIPAL,
      session: { ...PRINCIPAL.session, expiresAt: "2026-07-27T09:30:00Z" },
    };
    const { panel, store, stack } = hostedPanel(10, {
      principal: expired as typeof PRINCIPAL,
    });

    const snapshot = await panel.ask({ prompt: "hosted turn", turnId: "t1" });

    expect(snapshot.refusal?.reason).toBe(AUTH_REFUSE_REASONS.sessionExpired);
    expect(stack.prompts).toHaveLength(0);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
  });
});

describe("a port refusal is never billed as an answer", () => {
  it("reports the port's own reason and charges nothing", async () => {
    const state = funded(10);
    const store = createInMemoryCreditStore({
      accounts: [state.account],
      entries: state.entries,
    });
    // A port with no policy registered for the panel's profile: it refuses by
    // value, so an untranslated refusal would be billed as a completed call.
    const stack = providerStack({});
    const panel = panelFor(
      { fixture: stack.port, hosted: stack.port },
      {
        mode: "hosted",
        hostedAi: { enabled: true },
        principal: PRINCIPAL,
        credits: creditsView(state),
        store,
        hostedTurnCredits: 4,
      },
    );

    const snapshot = await panel.ask({ prompt: "hosted turn", turnId: "t1" });

    expect(snapshot.refusal?.reason).toBe(
      BILLING_REFUSE_REASONS.hostedAiProviderFailed,
    );
    expect(snapshot.refusal?.providerReason).toBe(
      MODEL_PROVIDER_REFUSE_REASONS.profilePolicyMissing,
    );
    expect(snapshot.turns).toHaveLength(0);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
    expect(state.balance).toBe(10);
  });

  it("carries no provider reason when the refusal came from the credit plane", async () => {
    const { panel } = hostedPanel(3);
    const snapshot = await panel.ask({ prompt: "hosted turn", turnId: "t1" });
    expect(snapshot.refusal?.providerReason).toBeUndefined();
  });
});

describe("Kids is denied before any metering or dispatch", () => {
  it("offers no assistant panel at all on the Kids surface", () => {
    const stack = providerStack();
    const created = createAssistantPanel({
      surface: "kids",
      profile: "@sceneaxi/profile-web",
      model: MODEL,
      ports: { fixture: stack.port },
      admin,
      clock,
    });

    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.reason).toBe(ASSISTANT_PANEL_REASONS.kidsSurfaceDenied);
    expect(stack.prompts).toHaveLength(0);
  });

  it("offers no assistant panel for the Kids profile on any surface", () => {
    const stack = providerStack();
    const created = createAssistantPanel({
      surface: "web-shell",
      profile: "@sceneaxi/profile-kids",
      model: MODEL,
      ports: { fixture: stack.port },
      admin,
      clock,
    });

    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.reason).toBe(ASSISTANT_PANEL_REASONS.kidsProfileDenied);
  });

  it("denies Kids in every mode, including the ones that never meter", () => {
    const stack = providerStack();
    for (const mode of ASSISTANT_MODES) {
      const created = createAssistantPanel({
        surface: "kids",
        profile: "@sceneaxi/profile-web",
        model: MODEL,
        mode,
        ports: { fixture: stack.port, byo: stack.port, hosted: stack.port },
        admin,
        clock,
        hostedAi: { enabled: true },
      });
      expect(created.ok).toBe(false);
      if (created.ok) continue;
      expect(created.reason).toBe(ASSISTANT_PANEL_REASONS.kidsSurfaceDenied);
    }
    expect(stack.prompts).toHaveLength(0);
  });

  it("denies the Kids surface before it validates anything else", () => {
    // Every other option is unusable; the Kids answer must still be the one
    // given, because a defect elsewhere must not be able to demote it.
    const created = createAssistantPanel({
      surface: "kids",
      profile: "not-a-profile" as never,
      model: undefined as never,
      ports: {},
      admin: undefined as never,
      clock: undefined as never,
    });
    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.reason).toBe(ASSISTANT_PANEL_REASONS.kidsSurfaceDenied);
  });
});

describe("construction and request refusals", () => {
  const stack = providerStack();
  const base = {
    surface: "web-shell",
    profile: "@sceneaxi/profile-web",
    model: MODEL,
    ports: { fixture: stack.port },
    admin,
    clock,
  } as const satisfies CreateAssistantPanelOptions;

  const refusedWith = (overrides: Record<string, unknown>) => {
    const created = createAssistantPanel({
      ...base,
      ...overrides,
    } as CreateAssistantPanelOptions);
    expect(created.ok).toBe(false);
    return created.ok ? undefined : created.reason;
  };

  it("refuses an unknown surface", () => {
    expect(refusedWith({ surface: "console" })).toBe(
      ASSISTANT_PANEL_REASONS.surfaceInvalid,
    );
    expect(refusedWith({ surface: undefined })).toBe(
      ASSISTANT_PANEL_REASONS.surfaceInvalid,
    );
  });

  it("refuses a profile the port could hold no policy for", () => {
    expect(refusedWith({ profile: "profile-web" })).toBe(
      ASSISTANT_PANEL_REASONS.profileInvalid,
    );
  });

  it("refuses a model descriptor that is not fully pinned", () => {
    expect(refusedWith({ model: { ...MODEL, version: "" } })).toBe(
      ASSISTANT_PANEL_REASONS.modelInvalid,
    );
  });

  it("refuses with no port wired at all", () => {
    expect(refusedWith({ ports: {} })).toBe(
      ASSISTANT_PANEL_REASONS.transportMissing,
    );
    expect(refusedWith({ ports: undefined })).toBe(
      ASSISTANT_PANEL_REASONS.transportMissing,
    );
  });

  it("refuses an unknown initial mode", () => {
    expect(refusedWith({ mode: "live" })).toBe(
      ASSISTANT_PANEL_REASONS.modeUnknown,
    );
  });

  it("refuses without the resolved admin identity", () => {
    expect(refusedWith({ admin: undefined })).toBe(
      ASSISTANT_PANEL_REASONS.adminIdentityMissing,
    );
  });

  it("refuses without an injected clock", () => {
    expect(refusedWith({ clock: undefined })).toBe(
      ASSISTANT_PANEL_REASONS.clockInvalid,
    );
  });

  it("refuses an empty prompt before the provider", async () => {
    const live = providerStack();
    const panel = panelFor({ fixture: live.port });
    const snapshot = await panel.ask({ prompt: "   " });
    expect(snapshot.refusal?.reason).toBe(
      ASSISTANT_PANEL_REASONS.promptInvalid,
    );
    expect(live.prompts).toHaveLength(0);
  });

  it("refuses a clock that stops returning epoch milliseconds", async () => {
    const live = providerStack();
    const created = createAssistantPanel({
      ...base,
      ports: { fixture: live.port },
      clock: () => Number.NaN,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const snapshot = await created.panel.ask({ prompt: "anything" });
    expect(snapshot.refusal?.reason).toBe(
      ASSISTANT_PANEL_REASONS.clockInvalid,
    );
    expect(live.prompts).toHaveLength(0);
  });
});

describe("every panel refusal is reachable", () => {
  it("has a covering case above for each named reason", async () => {
    const reached = new Set<AssistantPanelReason>();
    const stack = providerStack();

    const created = (overrides: Record<string, unknown>) => {
      const result = createAssistantPanel({
        surface: "web-shell",
        profile: "@sceneaxi/profile-web",
        model: MODEL,
        ports: { fixture: stack.port },
        admin,
        clock,
        ...overrides,
      } as CreateAssistantPanelOptions);
      if (!result.ok) reached.add(result.reason);
    };

    created({ surface: "kids" });
    created({ profile: "@sceneaxi/profile-kids" });
    created({ surface: "console" });
    created({ profile: "profile-web" });
    created({ model: { ...MODEL, model: "" } });
    created({ mode: "live" });
    created({ ports: {} });
    created({ admin: undefined });
    created({ clock: undefined });

    const panel = panelFor({ fixture: stack.port });
    const record = (reason: unknown) => {
      if (typeof reason === "string") {
        reached.add(reason as AssistantPanelReason);
      }
    };
    record((await panel.ask({ prompt: "" })).refusal?.reason);
    record(panel.setMode("hosted").refusal?.reason);

    const hosted = hostedPanel(10, { credits: undefined });
    record(
      (await hosted.panel.ask({ prompt: "p", turnId: "t1" })).refusal?.reason,
    );
    const absent = hostedPanel(10, { credits: creditsView(undefined) });
    record(
      (await absent.panel.ask({ prompt: "p", turnId: "t1" })).refusal?.reason,
    );
    const unreadable = hostedPanel(10, {
      credits: {
        ledgerFor() {
          throw new Error("down");
        },
      },
    });
    record(
      (await unreadable.panel.ask({ prompt: "p", turnId: "t1" })).refusal
        ?.reason,
    );
    const stranger = hostedPanel(10, {
      credits: creditsView(funded(10, OTHER_ACCOUNT)),
    });
    record(
      (await stranger.panel.ask({ prompt: "p", turnId: "t1" })).refusal?.reason,
    );
    const charged = hostedPanel(10);
    await charged.panel.ask({ prompt: "p", turnId: "t1" });
    record(
      (await charged.panel.ask({ prompt: "p", turnId: "t1" })).refusal?.reason,
    );

    const stopped = createAssistantPanel({
      surface: "web-shell",
      profile: "@sceneaxi/profile-web",
      model: MODEL,
      ports: { fixture: stack.port },
      admin,
      clock: () => Number.NaN,
    });
    if (stopped.ok) {
      record((await stopped.panel.ask({ prompt: "p" })).refusal?.reason);
    }

    expect([...reached].sort()).toEqual(
      Object.values(ASSISTANT_PANEL_REASONS).sort(),
    );
  });
});
