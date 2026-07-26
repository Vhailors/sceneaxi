/**
 * The hosted-AI credit metering golden path (sceneaxi#139, Ladder Step 11).
 *
 * The package tests prove each half in isolation; this proves the seam between
 * them, which is the part no single package can assert. It wires the real Model
 * Provider Port and the real OpenRouter adapter — over a recorded fixture
 * transport, so nothing here can reach a network or read a credential — into the
 * real credit gate, and then checks the two questions that only the composition
 * can answer:
 *
 *   - does a funded hosted call actually produce provider evidence *and* exactly
 *     one debit of the configured size, and
 *   - does an unfunded one stop before the adapter's transport is ever entered?
 *
 * The transport counts its invocations for that reason. "Refused before provider
 * execution" is a claim about something not happening, so it is asserted against
 * the deepest observable point in the provider stack, not against the thunk the
 * gate was handed.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  createModelProviderPort,
  type ModelDescriptor,
} from "@sceneaxi/authoring-core";
import {
  createFixtureTransport,
  createOpenRouterAdapter,
  type OpenRouterTransportRequest,
} from "@sceneaxi/provider-openrouter";
import { digestSessionToken } from "@sceneaxi/auth";
import {
  BILLING_REFUSE_REASONS,
  HOSTED_AI_DEFAULT_CONFIG,
  appendCreditEntry,
  createInMemoryCreditStore,
  createLedgerState,
  meteringIdempotencyKey,
  runMeteredModelCall,
  type LedgerState,
} from "@sceneaxi/billing";
import type { CreditAccount } from "@sceneaxi/schemas";

const NOW = Date.parse("2026-07-25T10:00:00Z");
const admin = {
  email: "captain@example.com",
  source: "SCENEAXI_ADMIN_EMAIL",
} as const;

const MODEL: ModelDescriptor = Object.freeze({
  model: "openai/gpt-fixture-2026-07-24",
  provider: "openrouter",
  quantization: "provider-default-pinned",
  version: "2026-07-24",
});

const EVAL = Object.freeze({
  mode: "deterministic" as const,
  allowFallbacks: false as const,
  temperature: 0 as const,
  seed: 46,
});

/** The recorded OpenRouter completion the provider package already ships. */
const COMPLETE_FIXTURE = JSON.parse(
  readFileSync(
    new URL(
      "../../packages/provider-openrouter/test/fixtures/complete.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as unknown;

const ACCOUNT = Object.freeze({
  schemaVersion: 1,
  kind: "sceneaxi.credit-account",
  accountId: "acc_crew",
  userId: "usr_crew",
  createdAt: "2026-07-25T09:00:00Z",
}) as CreditAccount;

const PRINCIPAL = Object.freeze({
  user: {
    schemaVersion: 1,
    kind: "sceneaxi.user",
    userId: "usr_crew",
    email: "crew@example.com",
    emailVerified: true,
    disabled: false,
    createdAt: "2026-07-25T09:00:00Z",
  },
  role: {
    schemaVersion: 1,
    kind: "sceneaxi.role-assignment",
    userId: "usr_crew",
    role: "user",
    source: "default-user",
    assignedAt: "2026-07-25T09:30:00Z",
  },
  session: {
    schemaVersion: 1,
    kind: "sceneaxi.session",
    sessionId: "ses_01",
    userId: "usr_crew",
    surface: "web-shell",
    issuedAt: "2026-07-25T09:00:00Z",
    expiresAt: "2026-07-26T10:00:00Z",
    tokenDigest: digestSessionToken("tok"),
  },
});

const funded = (credits: number): LedgerState => {
  if (credits === 0) return createLedgerState(ACCOUNT);
  const appended = appendCreditEntry(createLedgerState(ACCOUNT), {
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

/**
 * The whole provider stack, assembled the way a product surface would: fixture
 * transport → OpenRouter adapter → Model Provider Port. `transportRequests` is
 * the ground truth for whether the provider was reached.
 */
const providerStack = () => {
  const transportRequests: OpenRouterTransportRequest[] = [];
  const fixtureTransport = createFixtureTransport({
    model: MODEL,
    responses: { complete: COMPLETE_FIXTURE },
  });
  const port = createModelProviderPort({
    adapter: createOpenRouterAdapter({
      model: MODEL,
      eval: EVAL,
      transport(request) {
        transportRequests.push(request);
        return fixtureTransport(request);
      },
    }),
    profilePolicies: {
      "@sceneaxi/profile-web": () => ({ ok: true }),
      "@sceneaxi/profile-game": () => ({ ok: true }),
    },
  });
  const call = async () => {
    const result = await port.complete({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "complete",
      profile: "@sceneaxi/profile-web",
      model: MODEL,
      prompt: "fixture prompt",
    });
    // The documented integration obligation (docs/auth-credits.md, "Only a throw
    // is a provider failure"): the port refuses by value, and a value the thunk
    // returns is a completed call billing pays for, so the refusal is translated
    // here — in the provider integration — rather than inside the credit plane.
    if (!result.ok) throw new Error(result.reason);
    return result;
  };
  return { transportRequests, call };
};

const hostedRequest = (
  state: LedgerState,
  stack: ReturnType<typeof providerStack>,
  store = createInMemoryCreditStore({
    accounts: [state.account],
    entries: state.entries,
  }),
  overrides: Record<string, unknown> = {},
) => ({
  request: {
    route: "hosted" as const,
    capability: "metered-model-port" as const,
    call: stack.call,
    now: NOW,
    hostedAi: { enabled: true },
    admin,
    principal: PRINCIPAL,
    state,
    store,
    creditAmount: 4,
    reason: "metered model port call",
    idempotencyKey: "turn_01",
    surface: "web-shell" as const,
    ...overrides,
  },
  store,
});

describe("hosted AI metering golden path", () => {
  it("charges exactly the configured credits for one real port call", async () => {
    const state = funded(10);
    const stack = providerStack();
    const { request, store } = hostedRequest(state, stack);

    const result = await runMeteredModelCall(request as never);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.replayed).toBe(false);
    if (result.value.replayed) return;

    // Provider evidence: the deterministic adapter ran, pinned and no-fallback.
    expect(stack.transportRequests).toHaveLength(1);
    expect(stack.transportRequests[0]).toMatchObject({
      operation: "complete",
      model: MODEL.model,
      modelDescriptor: MODEL,
      provider: { allow_fallbacks: false },
      temperature: 0,
      seed: EVAL.seed,
    });
    expect(result.value.response).toMatchObject({
      ok: true,
      response: { text: "fixture completion", finishReason: "stop" },
      evidence: {
        kind: "sceneaxi.model-provider-call-evidence",
        operation: "complete",
        profile: "@sceneaxi/profile-web",
        model: MODEL,
      },
    });

    // Billing evidence: one debit, the exact configured size, persisted.
    expect(result.value.metered).toBe(true);
    expect(result.value.capability).toBe("metered-model-port");
    expect(result.value.decision).toEqual({
      schemaVersion: 1,
      kind: "sceneaxi.entitlement-decision",
      capability: "metered-model-port",
      outcome: "charge-credits",
      credits: 4,
    });
    expect(result.value.entry).toMatchObject({
      movement: "debit",
      delta: -4,
      balanceAfter: 6,
      reason: "metered model port call",
      idempotencyKey: meteringIdempotencyKey(ACCOUNT.accountId, "turn_01"),
    });
    expect(result.value.balance).toBe(6);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(2);
  });

  it("answers a retry from the prior debit without re-entering the transport", async () => {
    const state = funded(10);
    const stack = providerStack();
    const { request, store } = hostedRequest(state, stack);

    const first = await runMeteredModelCall(request as never);
    expect(first.ok).toBe(true);
    if (!first.ok || first.value.state === undefined) return;
    expect(first.value.balance).toBe(6);

    const retry = await runMeteredModelCall({
      ...request,
      state: first.value.state,
    } as never);

    expect(retry.ok).toBe(true);
    if (!retry.ok) return;
    expect(retry.value.replayed).toBe(true);
    expect(retry.value.balance).toBe(6);
    // The claim the composition alone can make: one debit, and the provider stack
    // entered exactly once for it. A retry that re-entered the transport would be
    // real upstream spend with no ledger row to show for it.
    expect(stack.transportRequests).toHaveLength(1);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(2);
    if (!retry.value.replayed) return;
    expect(retry.value.entry.idempotencyKey).toBe(
      meteringIdempotencyKey(ACCOUNT.accountId, "turn_01"),
    );
  });

  it("is default-off: the wired adapter alone does not enable hosted AI", async () => {
    const state = funded(10);
    const stack = providerStack();
    const { request, store } = hostedRequest(state, stack, undefined, {
      hostedAi: HOSTED_AI_DEFAULT_CONFIG,
    });

    const result = await runMeteredModelCall(request as never);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.hostedAiNotEnabled);
    expect(stack.transportRequests).toHaveLength(0);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
  });

  it("refuses a zero balance before the transport is entered", async () => {
    const state = funded(0);
    const stack = providerStack();
    const { request, store } = hostedRequest(state, stack);

    const result = await runMeteredModelCall(request as never);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.balanceInsufficient);
    expect(stack.transportRequests).toHaveLength(0);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(0);
  });

  it("refuses an insufficient balance before the transport is entered", async () => {
    const state = funded(3);
    const stack = providerStack();
    const { request, store } = hostedRequest(state, stack);

    const result = await runMeteredModelCall(request as never);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.balanceInsufficient);
    expect(stack.transportRequests).toHaveLength(0);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
    expect(state.balance).toBe(3);
  });

  it("keeps the same wired provider free on the BYO route", async () => {
    const state = funded(10);
    const stack = providerStack();
    const store = createInMemoryCreditStore({
      accounts: [state.account],
      entries: state.entries,
    });

    const result = await runMeteredModelCall({
      route: "byo",
      capability: "byo-model-keys",
      call: stack.call,
      now: NOW,
      admin,
      principal: PRINCIPAL,
      state,
      store,
      surface: "web-shell",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Same provider, same adapter, same transport — and no charge, because the
    // user brought their own key and is already paying their own provider.
    expect(stack.transportRequests).toHaveLength(1);
    expect(result.value.metered).toBe(false);
    expect(result.value.decision.outcome).toBe("allow-free");
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
    expect(state.balance).toBe(10);
  });

  it("denies Kids before the port, the ledger, or the transport", async () => {
    const state = funded(10);
    const stack = providerStack();
    const { request, store } = hostedRequest(state, stack, undefined, {
      surface: "kids",
    });

    const result = await runMeteredModelCall(request as never);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.kidsCommerceDenied);
    expect(stack.transportRequests).toHaveLength(0);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
  });

  it("turns a port refusal into a named provider failure with no debit", async () => {
    const state = funded(10);
    const stack = providerStack();
    // A profile with no registered policy: the port refuses, so the adapter is
    // never dispatched and the gate must not treat the outcome as a success.
    const call = async () => {
      const port = createModelProviderPort({
        adapter: createOpenRouterAdapter({
          model: MODEL,
          eval: EVAL,
          transport: createFixtureTransport({
            model: MODEL,
            responses: { complete: COMPLETE_FIXTURE },
          }),
        }),
        profilePolicies: {},
      });
      const result = await port.complete({
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "complete",
        profile: "@sceneaxi/profile-web",
        model: MODEL,
        prompt: "fixture prompt",
      });
      if (!result.ok) throw new Error(result.reason);
      return result;
    };
    const { request, store } = hostedRequest(state, stack, undefined, { call });

    const result = await runMeteredModelCall(request as never);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.hostedAiProviderFailed);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
    expect(state.balance).toBe(10);
  });

  it("needs no network and no credential: the transport is recorded data", async () => {
    const transport = createFixtureTransport({
      model: MODEL,
      responses: { complete: COMPLETE_FIXTURE },
    });
    const replayed = transport({
      schemaVersion: 1,
      operation: "complete",
      modelDescriptor: MODEL,
      model: MODEL.model,
      messages: [{ role: "user", content: "fixture prompt" }],
      provider: { allow_fallbacks: false },
      temperature: 0,
      seed: EVAL.seed,
    });
    expect(replayed).toEqual({
      response: COMPLETE_FIXTURE,
      executedModel: MODEL,
    });

    // An unrecorded operation refuses rather than returning a blank envelope a
    // consumer would read as "the model answered nothing".
    expect(() =>
      transport({
        schemaVersion: 1,
        operation: "tool-call",
        modelDescriptor: MODEL,
        model: MODEL.model,
        messages: [{ role: "user", content: "fixture prompt" }],
        provider: { allow_fallbacks: false },
        temperature: 0,
        seed: EVAL.seed,
        tools: [],
      }),
    ).toThrow(/OPENROUTER_FIXTURE_NOT_RECORDED|no openrouter fixture/i);

    // No credential is on this path, and that is a property of the code rather
    // than of the shell the gate runs in: the adapter hands its transport exactly
    // these pinned fields, none of which can carry a secret, and the transport
    // itself is a pure function of the recorded envelope.
    const stack = providerStack();
    await stack.call();
    expect(stack.transportRequests).toHaveLength(1);
    expect(Object.keys(stack.transportRequests[0] ?? {}).sort()).toEqual([
      "messages",
      "model",
      "modelDescriptor",
      "operation",
      "provider",
      "schemaVersion",
      "seed",
      "temperature",
    ]);
  });
});
