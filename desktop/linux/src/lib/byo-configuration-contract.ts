/** Browser-safe vocabulary for the desktop-only BYOK configuration channel. */
import type { DesktopAssistantProfile } from "./bridge.js";

export const DESKTOP_BYO_PROVIDERS = Object.freeze(["openrouter"] as const);
export type DesktopByoProvider = (typeof DESKTOP_BYO_PROVIDERS)[number];

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
}>;

export type DesktopByoConfigurationStatus = Readonly<{
  ok: true;
  action: DesktopByoConfigurationAction;
  provider: DesktopByoProvider;
  providerLabel: string;
  keyStatus: "missing" | "configured";
  operation: "status" | "saved" | "replaced" | "removed" | "already-missing";
  runtimeStatus: "ready" | "unavailable";
}>;

export type DesktopByoConfigurationResponse =
  | DesktopByoConfigurationStatus
  | DesktopByoConfigurationRefusal;

export type DesktopByoConfigurationRequest = Readonly<{
  action: DesktopByoConfigurationAction;
  profile: DesktopAssistantProfile;
  provider?: DesktopByoProvider;
  key?: string;
}>;
