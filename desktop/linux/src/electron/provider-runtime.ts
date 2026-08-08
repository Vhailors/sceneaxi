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
  runAssistantSculptAction,
  type AssistantSculptResult,
  type CreateModelProviderPortOptions,
  type ModelDescriptor,
} from "@sceneaxi/authoring-core";
import {
  OPENROUTER_PROVIDER_ID,
  createOpenRouterAdapter,
  type OpenRouterEvalConfig,
  type OpenRouterTransport,
} from "@sceneaxi/provider-openrouter";
import type { DesktopAssistantRunRequest } from "../lib/bridge.js";
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
  PROVIDER_KEY_STORE_REFUSALS,
} from "../lib/byo-configuration-contract.js";
import type { ProviderKeyStore } from "../lib/provider-key-store.js";

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
    message:
      "The OpenRouter-backed assistant action refused before producing a renderer-safe artifact.",
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

    const port = createModelProviderPort({
      adapter: createOpenRouterAdapter({
        model,
        eval: evalConfig,
        transport: transportSession.transport,
      }),
      profilePolicies: options.profilePolicies,
    });
    let closed = false;

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
            route: "byo",
            operation: "complete",
            model,
            port,
            ...request,
          }),
        );
      },
      async close() {
        if (closed) return;
        closed = true;
        await transportSession.close?.();
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
}>;

/**
 * Keep the renderer-visible readiness bit and the bridge runner on one host-owned
 * decision. The checked-in build supplies no session factory and stays unavailable;
 * tests and an authorized deployment can inject one without changing either IPC.
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
  return Object.freeze({
    configuration,
    runByoAssistant: createSecureDesktopByoAssistantRunner({
      keyStore: options.keyStore,
      provider: OPENROUTER_PROVIDER_ID,
      createProviderSession: options.createProviderSession,
    }),
  });
}
