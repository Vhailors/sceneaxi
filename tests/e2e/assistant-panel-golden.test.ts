/**
 * The in-app AI assistant golden path (sceneaxi#121, S7).
 *
 * The package tests prove each layer alone; this proves the seam none of them
 * can. It assembles the surface exactly as a product would — recorded fixture
 * transport → real `@sceneaxi/provider-openrouter` adapter → real Model Provider
 * Port → real `createAssistantPanel` → real credit gate and ledger — and then
 * answers the questions only the composition can:
 *
 *   - do the three modes differ in exactly one respect, metering, while all three
 *     reach the model through the same port;
 *   - does a hosted turn produce provider evidence *and* exactly one debit, and
 *   - do the refusals — hosted default-off, an insufficient balance, an absent
 *     ledger, a Kids surface — stop before the adapter's transport is entered?
 *
 * The transport counts its invocations for that last reason: "refused before
 * dispatch" is a claim about something not happening, so it is asserted at the
 * deepest observable point in the provider stack rather than at the thunk the
 * panel handed the credit gate.
 *
 * Nothing here can reach a network or read a credential: the only transport is
 * `createFixtureTransport` over the response envelope the provider package
 * already ships.
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
import {
  ADMIN_EMAIL_ENV_VAR,
  digestSessionToken,
  resolveAdminIdentity,
} from "@sceneaxi/auth";
import {
  BILLING_REFUSE_REASONS,
  HOSTED_AI_DEFAULT_CONFIG,
  HOSTED_AI_ROUTE_CAPABILITIES,
  appendCreditEntry,
  createInMemoryCreditStore,
  createLedgerState,
  loadLedgerState,
  meteringIdempotencyKey,
  type LedgerState,
} from "@sceneaxi/billing";
import {
  ASSISTANT_DEBIT_REASON,
  ASSISTANT_DEFAULT_MODE,
  ASSISTANT_MODES,
  ASSISTANT_MODE_BILLING,
  ASSISTANT_PANEL_REASONS,
  ASSISTANT_TURN_KEY_PREFIX,
  createAssistantPanel,
  type CreateAssistantPanelOptions,
} from "../../apps/web-shell/src/index.ts";
import type { CreditAccount } from "@sceneaxi/schemas";
import { issuePrincipalForTest } from "../../packages/auth/test/principal-fixture.js";

const NOW = Date.parse("2026-07-27T10:00:00Z");
const clock = () => NOW;
const adminResolution = resolveAdminIdentity({
  [ADMIN_EMAIL_ENV_VAR]: "captain@example.com",
});
if (!adminResolution.ok) throw new Error(adminResolution.message);
// Resolved, never hand-built: the guard behind the panel checks the identity's
// runtime provenance, so a structurally identical `{ email, source }` literal
// is refused `AUTH_ADMIN_IDENTITY_UNPROVEN` before any assistant work happens.
const admin = adminResolution.value;

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
  createdAt: "2026-07-27T09:00:00Z",
}) as CreditAccount;

const PRINCIPAL = issuePrincipalForTest({
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
}) as NonNullable<CreateAssistantPanelOptions["principal"]>;

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
 * The whole provider stack, assembled the way a product surface would.
 * `transportRequests` is the ground truth for whether the provider was reached.
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
  return { transportRequests, port };
};

/** One panel over one store, wired for every mode the caller offers. */
const assistant = (
  overrides: Partial<CreateAssistantPanelOptions> = {},
  credits = 10,
) => {
  const state = funded(credits);
  const store = createInMemoryCreditStore({
    accounts: [state.account],
    entries: state.entries,
  });
  const stack = providerStack();
  const created = createAssistantPanel({
    surface: "web-shell",
    profile: "@sceneaxi/profile-web",
    model: MODEL,
    ports: {
      fixture: stack.port,
      byo: stack.port,
      hosted: stack.port,
    },
    admin,
    clock,
    principal: PRINCIPAL,
    credits: {
      async ledgerFor(userId: string) {
        const account = await store.findAccountByUserId(userId);
        if (account === undefined) return undefined;
        const loaded = loadLedgerState(
          account,
          await store.listEntries(account.accountId),
        );
        if (!loaded.ok) throw new Error(loaded.message);
        return loaded.value;
      },
    },
    store,
    hostedTurnCredits: 4,
    ...overrides,
  });
  return { created, stack, store, state };
};

const panelOf = (result: ReturnType<typeof assistant>) => {
  if (!result.created.ok) {
    throw new Error(`assistant panel refused: ${result.created.reason}`);
  }
  return result.created.panel;
};

describe("in-app AI assistant golden path", () => {
  it("reaches the model through the port in every mode, metering only the hosted one", async () => {
    for (const mode of ASSISTANT_MODES) {
      const wired = assistant({ mode, hostedAi: { enabled: true } });
      const panel = panelOf(wired);

      const snapshot = await panel.ask({ prompt: "fixture prompt", turnId: mode });

      expect(snapshot.refusal).toBeUndefined();
      // Same port, same pinned no-fallback adapter, same recorded transport.
      expect(wired.stack.transportRequests).toHaveLength(1);
      expect(wired.stack.transportRequests[0]).toMatchObject({
        operation: "complete",
        model: MODEL.model,
        modelDescriptor: MODEL,
        provider: { allow_fallbacks: false },
        temperature: 0,
        seed: EVAL.seed,
      });
      expect(snapshot.turns[0]).toMatchObject({
        mode,
        text: "fixture completion",
        finishReason: "stop",
        evidence: {
          kind: "sceneaxi.model-provider-call-evidence",
          operation: "complete",
          profile: "@sceneaxi/profile-web",
          model: MODEL,
        },
      });

      // The single difference between the modes: whether a debit was appended.
      const metered = mode === "hosted";
      expect(snapshot.metered).toBe(metered);
      expect(snapshot.turns[0]?.metered).toBe(metered);
      expect(wired.store.entryCount(ACCOUNT.accountId)).toBe(metered ? 2 : 1);
    }
  });

  it("defaults to the fixture transport, so nothing live is reached by default", async () => {
    const wired = assistant({ mode: undefined, hostedAi: { enabled: true } });
    const panel = panelOf(wired);

    expect(panel.snapshot().mode).toBe(ASSISTANT_DEFAULT_MODE);
    expect(panel.snapshot().mode).toBe("fixture");
    const snapshot = await panel.ask({ prompt: "fixture prompt" });

    expect(snapshot.refusal).toBeUndefined();
    expect(snapshot.metered).toBe(false);
    expect(wired.store.entryCount(ACCOUNT.accountId)).toBe(1);
  });

  it("debits exactly the configured credits for one hosted turn", async () => {
    const wired = assistant({ mode: "hosted", hostedAi: { enabled: true } });
    const panel = panelOf(wired);

    const snapshot = await panel.ask({ prompt: "fixture prompt", turnId: "t1" });

    expect(snapshot.refusal).toBeUndefined();
    expect(snapshot.turns[0]?.credits).toBe(4);
    expect(snapshot.creditBalance).toBe(6);

    const entries = await wired.store.listEntries(ACCOUNT.accountId);
    expect(entries[1]).toMatchObject({
      movement: "debit",
      delta: -4,
      balanceAfter: 6,
      reason: ASSISTANT_DEBIT_REASON,
      idempotencyKey: meteringIdempotencyKey(
        ACCOUNT.accountId,
        `${ASSISTANT_TURN_KEY_PREFIX}:t1`,
      ),
    });
  });

  it("answers a retried hosted turn without re-entering the transport", async () => {
    const wired = assistant({ mode: "hosted", hostedAi: { enabled: true } });
    const panel = panelOf(wired);

    await panel.ask({ prompt: "fixture prompt", turnId: "t1" });
    const retry = await panel.ask({ prompt: "fixture prompt", turnId: "t1" });

    expect(retry.refusal?.reason).toBe(
      ASSISTANT_PANEL_REASONS.turnAlreadyCharged,
    );
    expect(wired.stack.transportRequests).toHaveLength(1);
    expect(wired.store.entryCount(ACCOUNT.accountId)).toBe(2);
    expect(retry.creditBalance).toBe(6);
  });

  it("keeps hosted AI off by default, with the live-capable stack fully wired", async () => {
    const wired = assistant({
      mode: "hosted",
      hostedAi: HOSTED_AI_DEFAULT_CONFIG,
    });
    const panel = panelOf(wired);

    const snapshot = await panel.ask({ prompt: "fixture prompt", turnId: "t1" });

    expect(snapshot.refusal?.reason).toBe(
      BILLING_REFUSE_REASONS.hostedAiNotEnabled,
    );
    expect(snapshot.hostedEnabled).toBe(false);
    expect(wired.stack.transportRequests).toHaveLength(0);
    expect(wired.store.entryCount(ACCOUNT.accountId)).toBe(1);
  });

  it("refuses an insufficient balance before the transport is entered", async () => {
    const wired = assistant({ mode: "hosted", hostedAi: { enabled: true } }, 3);
    const panel = panelOf(wired);

    const snapshot = await panel.ask({ prompt: "fixture prompt", turnId: "t1" });

    expect(snapshot.refusal?.reason).toBe(
      BILLING_REFUSE_REASONS.balanceInsufficient,
    );
    expect(wired.stack.transportRequests).toHaveLength(0);
    expect(wired.store.entryCount(ACCOUNT.accountId)).toBe(1);
  });

  it("refuses an absent ledger before the transport is entered", async () => {
    const wired = assistant({
      mode: "hosted",
      hostedAi: { enabled: true },
      credits: { ledgerFor: () => undefined },
    });
    const panel = panelOf(wired);

    const snapshot = await panel.ask({ prompt: "fixture prompt", turnId: "t1" });

    // The panel hands the turn over with no state rather than restating billing
    // policy, so the credit gate refuses it before the transport.
    expect(snapshot.refusal?.reason).toBe(
      BILLING_REFUSE_REASONS.ledgerStateInvalid,
    );
    expect(snapshot.creditBalance).toBeUndefined();
    expect(wired.stack.transportRequests).toHaveLength(0);
  });

  it("offers no assistant on the Kids surface, in any mode", () => {
    for (const mode of ASSISTANT_MODES) {
      const wired = assistant({
        surface: "kids",
        mode,
        hostedAi: { enabled: true },
      });
      expect(wired.created.ok).toBe(false);
      if (wired.created.ok) continue;
      expect(wired.created.reason).toBe(
        ASSISTANT_PANEL_REASONS.kidsSurfaceDenied,
      );
      expect(wired.stack.transportRequests).toHaveLength(0);
      expect(wired.store.entryCount(ACCOUNT.accountId)).toBe(1);
    }
  });

  it("offers no assistant for the Kids profile, before any metering or dispatch", () => {
    const wired = assistant({
      profile: "@sceneaxi/profile-kids",
      mode: "hosted",
      hostedAi: { enabled: true },
    });

    expect(wired.created.ok).toBe(false);
    if (wired.created.ok) return;
    expect(wired.created.reason).toBe(
      ASSISTANT_PANEL_REASONS.kidsProfileDenied,
    );
    expect(wired.stack.transportRequests).toHaveLength(0);
    expect(wired.store.entryCount(ACCOUNT.accountId)).toBe(1);
  });

  it("adds no credit policy of its own: every mode bills a route billing already owns", () => {
    for (const mode of ASSISTANT_MODES) {
      const { route, capability } = ASSISTANT_MODE_BILLING[mode];
      expect(HOSTED_AI_ROUTE_CAPABILITIES[route]).toContain(capability);
    }
  });

  it("needs no network and no credential on any assistant path", async () => {
    const wired = assistant({ mode: "hosted", hostedAi: { enabled: true } });
    const panel = panelOf(wired);

    await panel.ask({ prompt: "fixture prompt", turnId: "t1" });

    // A property of the code, not of the shell the gate runs in: the adapter
    // hands its transport exactly these pinned fields, none of which can carry a
    // secret, and the transport itself is a pure function of a recorded envelope.
    expect(
      Object.keys(wired.stack.transportRequests[0] ?? {}).sort(),
    ).toEqual([
      "messages",
      "model",
      "modelDescriptor",
      "operation",
      "provider",
      "schemaVersion",
      "seed",
      "temperature",
    ]);
    // And the turn still carries the port's own evidence, so "no credential"
    // is not bought by skipping the attestation the port exists to make.
    expect(panel.snapshot().turns[0]?.evidence).toMatchObject({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      model: MODEL,
    });
  });
});
