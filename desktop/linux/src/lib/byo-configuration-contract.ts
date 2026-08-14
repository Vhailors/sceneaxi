/** Browser-safe vocabulary for the desktop-only BYOK configuration channel. */
import type { DesktopAssistantProfile } from "./bridge.js";

export const DESKTOP_BYO_PROVIDERS = Object.freeze(["opencode", "openrouter"] as const);
export type DesktopByoProvider = (typeof DESKTOP_BYO_PROVIDERS)[number];

export const DESKTOP_BYO_PROVIDER_LABELS = Object.freeze({
  opencode: "OpenCode · DeepSeek V4 Pro",
  openrouter: "OpenRouter",
} as const);

export const PROVIDER_KEY_STORE_REFUSALS = Object.freeze({
  unavailable: "DESKTOP_PROVIDER_KEY_STORE_UNAVAILABLE",
  locked: "DESKTOP_PROVIDER_KEY_STORE_LOCKED",
  unsupported: "DESKTOP_PROVIDER_KEY_STORE_UNSUPPORTED",
  corrupt: "DESKTOP_PROVIDER_KEY_STORE_CORRUPT",
  failed: "DESKTOP_PROVIDER_KEY_STORE_FAILED",
  keyMissing: "DESKTOP_PROVIDER_KEY_MISSING",
  keyInvalid: "DESKTOP_PROVIDER_KEY_INVALID",
  providerUnsupported: "DESKTOP_BYO_PROVIDER_UNSUPPORTED",
} as const);

export type ProviderKeyStoreRefusalReason =
  (typeof PROVIDER_KEY_STORE_REFUSALS)[keyof typeof PROVIDER_KEY_STORE_REFUSALS];

/** The refusals that mean the platform backend itself could not be reached. */
export const PROVIDER_KEY_STORE_AVAILABILITY_REFUSALS = Object.freeze([
  PROVIDER_KEY_STORE_REFUSALS.unavailable,
  PROVIDER_KEY_STORE_REFUSALS.locked,
  PROVIDER_KEY_STORE_REFUSALS.unsupported,
] as const);

export const DESKTOP_BYO_CONFIGURATION_CHANNEL =
  "sceneaxi:desktop-byo-configuration";

export const DESKTOP_BYO_CONFIGURATION_ACTIONS = Object.freeze([
  "status",
  "save",
  "remove",
] as const);

export type DesktopByoConfigurationAction =
  (typeof DESKTOP_BYO_CONFIGURATION_ACTIONS)[number];

export const DESKTOP_BYO_CONFIGURATION_REFUSALS = Object.freeze({
  requestMalformed: "DESKTOP_BYO_CONFIGURATION_REQUEST_MALFORMED",
  kidsDenied: "ASSISTANT_SCULPT_KIDS_DENIED",
  providerSessionUnavailable: "DESKTOP_BYO_PROVIDER_SESSION_UNAVAILABLE",
  providerSessionFailed: "DESKTOP_BYO_PROVIDER_SESSION_FAILED",
} as const);

export type DesktopByoConfigurationRefusalReason =
  | (typeof DESKTOP_BYO_CONFIGURATION_REFUSALS)[keyof typeof DESKTOP_BYO_CONFIGURATION_REFUSALS]
  | ProviderKeyStoreRefusalReason;

export type DesktopByoConfigurationRefusal = Readonly<{
  ok: false;
  reason: DesktopByoConfigurationRefusalReason;
  message: string;
  /**
   * Whether a stored envelope is still safely unlinkable. Deletion needs no
   * cipher, so a refusal caused by an unavailable, locked, or unsupported
   * backend can still offer Remove. Presence only — never key material.
   */
  removable?: boolean;
}>;

export type DesktopByoConfigurationStatus = Readonly<{
  ok: true;
  action: DesktopByoConfigurationAction;
  provider: DesktopByoProvider;
  providerLabel: string;
  keyStatus: "missing" | "configured";
  operation: "status" | "saved" | "replaced" | "removed" | "already-missing";
  /**
   * Whether the platform backend is reachable *now*. A successful removal proves
   * nothing about it — unlinking needs no cipher — so this is resolved rather
   * than inferred from the operation succeeding, and it is what decides whether
   * the key field and Save may be offered.
   */
  storageStatus: "ready" | "unavailable";
  runtimeStatus: "ready" | "unavailable";
}>;

/**
 * What a refusal actually establishes. The surface may state the cause it was
 * given and nothing more: an unreachable backend says so, an invalid envelope
 * says only that, a rejected submission says only that — the backend was never
 * consulted — and anything else asserts no more than the presence the probe
 * found. Nothing outside `storage-unavailable` may claim the platform failed.
 */
export type DesktopByoRefusalContext =
  | "storage-unavailable"
  | "envelope-invalid"
  | "request-invalid"
  | "envelope-present";

export function desktopByoRefusalContext(
  reason: DesktopByoConfigurationRefusalReason,
): DesktopByoRefusalContext {
  if ((PROVIDER_KEY_STORE_AVAILABILITY_REFUSALS as readonly string[]).includes(reason)) {
    return "storage-unavailable";
  }
  if (reason === PROVIDER_KEY_STORE_REFUSALS.corrupt) return "envelope-invalid";
  return reason === PROVIDER_KEY_STORE_REFUSALS.keyInvalid
    ? "request-invalid"
    : "envelope-present";
}

export type DesktopByoConfigurationResponse =
  | DesktopByoConfigurationStatus
  | DesktopByoConfigurationRefusal;

export type DesktopByoConfigurationRequest = Readonly<{
  action: DesktopByoConfigurationAction;
  profile: DesktopAssistantProfile;
  provider?: DesktopByoProvider;
  key?: string;
}>;
