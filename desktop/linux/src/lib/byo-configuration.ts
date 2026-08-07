/** Desktop-only BYOK configuration and secure provider-session wiring. */
import type { AssistantSculptResult } from "@sceneaxi/authoring-core";
import type {
  DesktopAssistantProfile,
  DesktopAssistantRunRequest,
} from "./bridge.js";
import {
  type ProviderKeyStore,
} from "./provider-key-store.js";
import {
  DESKTOP_BYO_CONFIGURATION_REFUSALS,
  DESKTOP_BYO_PROVIDERS,
  PROVIDER_KEY_STORE_REFUSALS,
  type DesktopByoConfigurationAction,
  type DesktopByoConfigurationRefusal,
  type DesktopByoConfigurationRefusalReason,
  type DesktopByoConfigurationResponse,
  type DesktopByoConfigurationStatus,
  type DesktopByoProvider,
} from "./byo-configuration-contract.js";

export type DesktopByoConfiguration = Readonly<{
  handle(request: unknown): Promise<DesktopByoConfigurationResponse>;
}>;

function field(value: unknown, name: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

function isProvider(value: unknown): value is DesktopByoProvider {
  return (
    typeof value === "string" &&
    (DESKTOP_BYO_PROVIDERS as readonly string[]).includes(value)
  );
}

function isProfile(value: unknown): value is DesktopAssistantProfile {
  return (
    value === "@sceneaxi/profile-game" ||
    value === "@sceneaxi/profile-web" ||
    value === "@sceneaxi/profile-kids"
  );
}

function refusal(
  reason: DesktopByoConfigurationRefusalReason,
  message: string,
): DesktopByoConfigurationRefusal {
  return Object.freeze({ ok: false as const, reason, message });
}

export type CreateDesktopByoConfigurationOptions = Readonly<{
  keyStore: ProviderKeyStore;
  providerRuntimeAvailable: boolean;
}>;

export function createDesktopByoConfiguration(
  options: CreateDesktopByoConfigurationOptions,
): DesktopByoConfiguration {
  const answer = (
    action: DesktopByoConfigurationAction,
    provider: DesktopByoProvider,
    keyStatus: "missing" | "configured",
    operation: DesktopByoConfigurationStatus["operation"],
  ): DesktopByoConfigurationStatus =>
    Object.freeze({
      ok: true as const,
      action,
      provider,
      providerLabel: "OpenRouter",
      keyStatus,
      operation,
      runtimeStatus: options.providerRuntimeAvailable ? "ready" as const : "unavailable" as const,
    });

  const handle = async (request: unknown): Promise<DesktopByoConfigurationResponse> => {
    // Profile is the first and only field read before the Kids guard. In
    // particular, a hostile key getter cannot run on a Kids request.
    const profile = field(request, "profile");
    if (!isProfile(profile)) {
      return refusal(
        DESKTOP_BYO_CONFIGURATION_REFUSALS.requestMalformed,
        "BYOK configuration requires a SceneAxi profile.",
      );
    }
    if (profile === "@sceneaxi/profile-kids") {
      return refusal(
        DESKTOP_BYO_CONFIGURATION_REFUSALS.kidsDenied,
        "BYOK configuration is denied for Kids before credential input or secure-storage access.",
      );
    }

    const action = field(request, "action");
    const provider = field(request, "provider") ?? DESKTOP_BYO_PROVIDERS[0];
    if (
      (action !== "status" && action !== "save" && action !== "remove") ||
      !isProvider(provider)
    ) {
      return refusal(
        DESKTOP_BYO_CONFIGURATION_REFUSALS.requestMalformed,
        "BYOK configuration requires status, save, or remove and a supported provider.",
      );
    }

    if (action === "save") {
      const key = field(request, "key");
      if (typeof key !== "string") {
        return refusal(
          PROVIDER_KEY_STORE_REFUSALS.keyInvalid,
          "Saving a provider credential requires a non-empty key value.",
        );
      }
      const saved = await options.keyStore.save(provider, key);
      if (!saved.ok) return saved;
      return answer(
        action,
        provider,
        "configured",
        saved.replaced ? "replaced" : "saved",
      );
    }

    if (action === "remove") {
      const removed = await options.keyStore.remove(provider);
      if (!removed.ok) return removed;
      return answer(
        action,
        provider,
        "missing",
        removed.removed ? "removed" : "already-missing",
      );
    }

    const current = await options.keyStore.status(provider);
    if (!current.ok) return current;
    return answer(action, provider, current.keyStatus, "status");
  };

  return Object.freeze({ handle });
}

export type ProviderKeyAccess = Readonly<{
  read(): string;
}>;

export type DesktopByoProviderSession = Readonly<{
  run(request: DesktopAssistantRunRequest): Promise<AssistantSculptResult>;
  close(): void | Promise<void>;
}>;

export type CreateDesktopByoProviderSession = (input: Readonly<{
  provider: DesktopByoProvider;
  key: ProviderKeyAccess;
}>) => DesktopByoProviderSession;

export class DesktopByoRunnerRefusal extends Error {
  readonly reason: DesktopByoConfigurationRefusalReason;

  constructor(reason: DesktopByoConfigurationRefusalReason, message: string) {
    super(message);
    this.name = "DesktopByoRunnerRefusal";
    this.reason = reason;
  }
}

export type CreateSecureDesktopByoAssistantRunnerOptions = Readonly<{
  keyStore: ProviderKeyStore;
  provider: DesktopByoProvider;
  createProviderSession?: CreateDesktopByoProviderSession;
}>;

/**
 * Retrieve one key in the privileged process, lease it to one injected provider
 * session, then revoke the lease in `finally` before the session closes.
 */
export function createSecureDesktopByoAssistantRunner(
  options: CreateSecureDesktopByoAssistantRunnerOptions,
): (request: DesktopAssistantRunRequest) => Promise<AssistantSculptResult> {
  return async (request) => {
    if (request.profile === "@sceneaxi/profile-kids") {
      throw new DesktopByoRunnerRefusal(
        DESKTOP_BYO_CONFIGURATION_REFUSALS.kidsDenied,
        "The desktop BYOK provider session is denied for Kids before secure-storage access.",
      );
    }
    if (options.createProviderSession === undefined) {
      throw new DesktopByoRunnerRefusal(
        DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionUnavailable,
        "No privileged BYOK provider session is available in this desktop build.",
      );
    }

    const stored = await options.keyStore.read(options.provider);
    if (!stored.ok) {
      throw new DesktopByoRunnerRefusal(stored.reason, stored.message);
    }
    let keyReference: string | null = stored.key;
    const access: ProviderKeyAccess = Object.freeze({
      read(): string {
        if (keyReference === null) {
          throw new DesktopByoRunnerRefusal(
            DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionFailed,
            "The privileged provider credential lease has ended.",
          );
        }
        return keyReference;
      },
    });

    let session: DesktopByoProviderSession;
    try {
      session = options.createProviderSession({ provider: options.provider, key: access });
    } catch {
      keyReference = null;
      throw new DesktopByoRunnerRefusal(
        DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionFailed,
        "The privileged BYOK provider session could not be created.",
      );
    }

    try {
      const providerRequest: DesktopAssistantRunRequest = Object.freeze({
        ...request,
        onProgress: (snapshot) => {
          const serialized = JSON.stringify(snapshot);
          if (
            keyReference !== null &&
            serialized.includes(keyReference)
          ) {
            request.onProgress(Object.freeze({
              phase: snapshot.phase,
              percent: snapshot.percent,
              message: "Provider progress was redacted.",
            }));
            return;
          }
          request.onProgress(snapshot);
        },
      });
      const result = await session.run(providerRequest);
      if (
        keyReference !== null &&
        JSON.stringify(result).includes(keyReference)
      ) {
        throw new DesktopByoRunnerRefusal(
          DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionFailed,
          "The privileged BYOK provider session returned credential material and was refused.",
        );
      }
      return result;
    } catch {
      throw new DesktopByoRunnerRefusal(
        DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionFailed,
        "The privileged BYOK provider session failed.",
      );
    } finally {
      keyReference = null;
      try {
        await session.close();
      } catch {
        // Credential cleanup already happened; provider cleanup has no safe
        // renderer-facing detail and cannot restore access to the lease.
      }
    }
  };
}
