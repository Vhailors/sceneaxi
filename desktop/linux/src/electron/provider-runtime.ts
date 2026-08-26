/**
 * Privileged desktop composition for the OpenRouter-backed BYOK path.
 *
 * This module is deliberately exported from an `electron/` subpath rather than
 * the browser-safe package root. It joins the existing provider adapter, Model
 * Provider Port, assistant authoring action, secure key lease, and desktop
 * bridge runner without creating another protocol or provider interface.
 */
import {
  createModelProviderPort,
  requestRarityProviderContribution,
  runAssistantSculptAction,
  type AssistantSculptResult,
  type CreateModelProviderPortOptions,
  type ModelDescriptor,
  type RarityProviderContributionResult,
} from "@sceneaxi/authoring-core";
import {
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  RARITY_POLICY_KIND,
  RARITY_REQUEST_KIND,
  RARITY_SCHEMA_VERSION,
  type JsonObject,
} from "@sceneaxi/schemas";
import {
  OPENROUTER_PROVIDER_ID,
  createOpenRouterAdapter,
  type OpenRouterEvalConfig,
  type OpenRouterTransport,
} from "@sceneaxi/provider-openrouter";
import type {
  DesktopAssistantRunRequest,
  DesktopRarityProviderRunRequest,
} from "../lib/bridge.js";
import {
  DesktopByoRunnerRefusal,
  createDesktopByoConfiguration,
  createSecureDesktopByoAssistantRunner,
  type CreateDesktopByoProviderSession,
  type DesktopByoConfiguration,
  type ProviderKeyAccess,
} from "../lib/byo-configuration.js";
import {
  DESKTOP_BYO_CONFIGURATION_REFUSALS,
  DESKTOP_BYO_PROVIDERS,
  PROVIDER_KEY_STORE_REFUSALS,
  type DesktopByoProvider,
} from "../lib/byo-configuration-contract.js";
import type { ProviderKeyStore } from "../lib/provider-key-store.js";
import {
  DESKTOP_DEEPSEEK_MODEL,
  createDesktopOpenCodeLiveTransport,
  desktopOpenCodeCompleteResponse,
} from "./live-transport.js";

export type DesktopOpenRouterTransportSession = Readonly<{
  transport: OpenRouterTransport;
  close?: () => void | Promise<void>;
}>;

/**
 * Deployment-owned transport construction. The credential stays behind the
 * revocable accessor; this interface never accepts or returns a raw key.
 */
export type OpenDesktopOpenRouterTransport = (input: Readonly<{
  credential: ProviderKeyAccess;
}>) => DesktopOpenRouterTransportSession;

export type CreateDesktopOpenRouterProviderSessionOptions = Readonly<{
  model: ModelDescriptor;
  eval: OpenRouterEvalConfig;
  profilePolicies: CreateModelProviderPortOptions["profilePolicies"];
  openTransport: OpenDesktopOpenRouterTransport;
}>;

/**
 * Strip provider-authored failure detail before it can reach bridge status,
 * local RPC, renderer state, or a project file. Successful output has already
 * crossed the adapter envelope checks and Sculpt Intake validation.
 */
function rendererSafeResult(result: AssistantSculptResult): AssistantSculptResult {
  if (result.ok) return result;
  return Object.freeze({
    ok: false as const,
    reason: result.reason,
    message: result.message,
    recoverable: result.recoverable,
  });
}

/**
 * Create the provider session injected into `createSecureDesktopByoAssistantRunner`.
 * One session owns one transport and one exact model pin; no ambient key, model
 * selection, fallback, network client, or profile policy is consulted.
 */
export function createDesktopOpenRouterProviderSession(
  options: CreateDesktopOpenRouterProviderSessionOptions,
): CreateDesktopByoProviderSession {
  const model = Object.freeze({ ...options.model });
  const evalConfig = Object.freeze({ ...options.eval });

  return ({ provider, key }) => {
    if (provider !== OPENROUTER_PROVIDER_ID) {
      throw new DesktopByoRunnerRefusal(
        PROVIDER_KEY_STORE_REFUSALS.providerUnsupported,
        "The privileged OpenRouter session received an unsupported provider.",
      );
    }

    const transportSession = options.openTransport({ credential: key });

    // Everything that can refuse after the deployment has already allocated a
    // transport lives under one guard, so a malformed session is closed on the way
    // out exactly like a mis-pinned adapter is.
    let closed = false;
    const closeTransport = async () => {
      if (closed) return;
      closed = true;
      const close: unknown =
        transportSession === null || typeof transportSession !== "object"
          ? undefined
          : (transportSession as { close?: unknown }).close;
      if (typeof close === "function") {
        await (close as () => void | Promise<void>).call(transportSession);
      }
    };

    let port: ReturnType<typeof createModelProviderPort>;
    try {
      if (
        typeof transportSession !== "object" ||
        transportSession === null ||
        typeof transportSession.transport !== "function" ||
        (transportSession.close !== undefined &&
          typeof transportSession.close !== "function")
      ) {
        throw new DesktopByoRunnerRefusal(
          DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionFailed,
          "The privileged OpenRouter transport session is invalid.",
        );
      }
      port = createModelProviderPort({
        adapter: createOpenRouterAdapter({
          model,
          eval: evalConfig,
          transport: transportSession.transport,
        }),
        profilePolicies: options.profilePolicies,
      });
    } catch {
      void closeTransport().catch(() => {});
      throw new DesktopByoRunnerRefusal(
        DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionFailed,
        "The privileged OpenRouter provider session could not be composed.",
      );
    }

    return Object.freeze({
      async run(request: DesktopAssistantRunRequest) {
        if (closed) {
          throw new DesktopByoRunnerRefusal(
            DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionFailed,
            "The privileged OpenRouter provider session is closed.",
          );
        }
        return rendererSafeResult(
          await runAssistantSculptAction({
            ...request,
            route: "byo",
            operation: "complete",
            model,
            port,
          }),
        );
      },
      async close() {
        await closeTransport();
      },
    });
  };
}

export type PrivilegedDesktopByoRuntime = Readonly<{
  configuration: DesktopByoConfiguration;
  runByoAssistant?: (
    request: DesktopAssistantRunRequest,
  ) => Promise<AssistantSculptResult>;
}>;

export type CreatePrivilegedDesktopByoRuntimeOptions = Readonly<{
  keyStore: ProviderKeyStore;
  createProviderSession?: CreateDesktopByoProviderSession;
  /**
   * Provider whose stored key the runner leases. Packaged Linux uses OpenCode
   * (DeepSeek V4 Flash). Tests keep the OpenRouter fixture path by default.
   */
  provider?: DesktopByoProvider;
}>;

/**
 * Keep the renderer-visible readiness bit and the bridge runner on one host-owned
 * decision. The packaged Linux host injects the OpenCode/DeepSeek session factory;
 * tests may omit it or replace it with a fixture transport.
 */
export function createPrivilegedDesktopByoRuntime(
  options: CreatePrivilegedDesktopByoRuntimeOptions,
): PrivilegedDesktopByoRuntime {
  const configuration = createDesktopByoConfiguration({
    keyStore: options.keyStore,
    providerRuntimeAvailable: options.createProviderSession !== undefined,
  });
  if (options.createProviderSession === undefined) {
    return Object.freeze({ configuration });
  }
  const provider = options.provider ??
    (DESKTOP_BYO_PROVIDERS.includes(OPENROUTER_PROVIDER_ID)
      ? OPENROUTER_PROVIDER_ID
      : DESKTOP_BYO_PROVIDERS[0]);
  return Object.freeze({
    configuration,
    runByoAssistant: createSecureDesktopByoAssistantRunner({
      keyStore: options.keyStore,
      provider,
      createProviderSession: options.createProviderSession,
    }),
  });
}

/**
 * Privileged DeepSeek V4 Flash session over the named OpenCode US/EU path.
 * Complete-only: the locked DeepSeek adoption decision keeps this out of
 * strict tool-calling lanes. Kids is denied before the key is leased.
 */
export function createDesktopOpenCodeProviderSession(
  options: Readonly<{
    fetchImpl?: typeof fetch;
    apiBase?: string;
    model?: ModelDescriptor;
  }> = {},
): CreateDesktopByoProviderSession {
  const model = Object.freeze({ ...(options.model ?? DESKTOP_DEEPSEEK_MODEL) });
  return ({ provider, key }) => {
    if (provider !== "opencode") {
      throw new DesktopByoRunnerRefusal(
        PROVIDER_KEY_STORE_REFUSALS.providerUnsupported,
        "The privileged DeepSeek session received an unsupported provider.",
      );
    }
    const transport = createDesktopOpenCodeLiveTransport({
      credential: key,
      ...(options.apiBase === undefined ? {} : { apiBase: options.apiBase }),
      ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
    });
    const port = createModelProviderPort({
      adapter: Object.freeze({
        routeKind: "third-party" as const,
        capabilities: Object.freeze({
          schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
          operations: Object.freeze(["complete" as const]),
        }),
        complete: async (request) => {
          const text = await transport.complete(request.prompt, model);
          return Object.freeze({
            response: desktopOpenCodeCompleteResponse(text),
            executedModel: model,
          });
        },
      }),
      profilePolicies: Object.freeze({
        "@sceneaxi/profile-game": () => Object.freeze({ ok: true as const }),
        "@sceneaxi/profile-web": () => Object.freeze({ ok: true as const }),
      }),
    });
    return Object.freeze({
      async run(request: DesktopAssistantRunRequest) {
        return rendererSafeResult(
          await runAssistantSculptAction({
            ...request,
            route: "byo",
            operation: "complete",
            model,
            port,
          }),
        );
      },
      async close() {
        return;
      },
    });
  };
}

/** Checked-in provider identity for the packaged no-network Agent path. */
export const DESKTOP_RARITY_FIXTURE_MODEL = Object.freeze({
  model: "wayfinder-rarity-fixture",
  provider: "sceneaxi-fixture",
  quantization: "deterministic-json",
  version: "2026-08-09",
}) satisfies ModelDescriptor;

export const DESKTOP_RARITY_FIXTURE_INPUT = Object.freeze({
  policy: Object.freeze({
    schemaVersion: RARITY_SCHEMA_VERSION,
    kind: RARITY_POLICY_KIND,
    tierWeights: Object.freeze({
      common: 55,
      uncommon: 25,
      rare: 12,
      epic: 6,
      legendary: 2,
    }),
  }),
  request: Object.freeze({
    schemaVersion: RARITY_SCHEMA_VERSION,
    kind: RARITY_REQUEST_KIND,
    candidates: Object.freeze([
      Object.freeze({ candidateId: "wayfinder-stone", tier: "common", weight: 7 }),
      Object.freeze({ candidateId: "wayfinder-moss", tier: "common", weight: 3 }),
      Object.freeze({ candidateId: "wayfinder-copper", tier: "uncommon", weight: 5 }),
      Object.freeze({ candidateId: "wayfinder-silver", tier: "rare", weight: 3 }),
      Object.freeze({ candidateId: "wayfinder-aurora", tier: "epic", weight: 2 }),
      Object.freeze({ candidateId: "wayfinder-crown", tier: "legendary", weight: 1 }),
    ]),
  }),
});

export type CreateDesktopRarityFixtureProviderOptions = Readonly<{
  /** Test-only replacement used for malformed/entropy refusal vectors. */
  arguments?: JsonObject;
  executedModel?: ModelDescriptor;
  /** Observes the exact envelope the port dispatched, for no-network vectors. */
  onDispatch?: (request: unknown) => void;
}>;

/**
 * Privileged, deterministic fixture provider. It still crosses the real Model
 * Provider Port and profile policy, but owns no credential, transport, or network.
 */
export function createDesktopRarityFixtureProvider(
  options: CreateDesktopRarityFixtureProviderOptions = {},
): (
  request: DesktopRarityProviderRunRequest,
) => Promise<RarityProviderContributionResult> {
  const executedModel = Object.freeze({
    ...(options.executedModel ?? DESKTOP_RARITY_FIXTURE_MODEL),
  });
  const port = createModelProviderPort({
    adapter: Object.freeze({
      routeKind: "third-party" as const,
      capabilities: Object.freeze({
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operations: Object.freeze(["tool-call" as const]),
      }),
      toolCall: (dispatched) => {
        options.onDispatch?.(dispatched);
        return Object.freeze({
          response: Object.freeze({
            schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
            operation: "tool-call" as const,
            toolCalls: Object.freeze([
              Object.freeze({
                name: "propose_rarity",
                arguments: options.arguments ??
                  (DESKTOP_RARITY_FIXTURE_INPUT as unknown as JsonObject),
              }),
            ]),
          }),
          executedModel,
        });
      },
    }),
    profilePolicies: Object.freeze({
      "@sceneaxi/profile-game": () => Object.freeze({ ok: true as const }),
      "@sceneaxi/profile-web": () => Object.freeze({ ok: true as const }),
    }),
  });
  return (request) =>
    requestRarityProviderContribution({
      port,
      profile: request.profile,
      model: DESKTOP_RARITY_FIXTURE_MODEL,
      prompt: request.prompt,
    });
}

export const SCENEAXI_PROVIDER_ENTRYPOINT_CATALOG = Object.freeze({
  "desktop/linux/src/electron/provider-runtime.ts": createPrivilegedDesktopByoRuntime,
  "desktop/linux/src/electron/live-transport.ts": createDesktopOpenCodeLiveTransport,
});
