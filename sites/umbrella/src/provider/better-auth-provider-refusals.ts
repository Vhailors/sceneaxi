export const BETTER_AUTH_PROVIDER_REFUSALS = Object.freeze({
  configurationAbsent: "BETTER_AUTH_PROVIDER_CONFIGURATION_ABSENT",
  configurationInvalid: "BETTER_AUTH_PROVIDER_CONFIGURATION_INVALID",
  bootstrapDisagreement: "BETTER_AUTH_PROVIDER_BOOTSTRAP_DISAGREEMENT",
  storageUnavailable: "BETTER_AUTH_PROVIDER_STORAGE_UNAVAILABLE",
} as const);

export const SCENEAXI_PROVIDER_ENTRYPOINT_CATALOG = Object.freeze({
  "sites/umbrella/src/provider/better-auth-provider.ts": BETTER_AUTH_PROVIDER_REFUSALS,
});

export type BetterAuthProviderRefusal =
  (typeof BETTER_AUTH_PROVIDER_REFUSALS)[keyof typeof BETTER_AUTH_PROVIDER_REFUSALS];
