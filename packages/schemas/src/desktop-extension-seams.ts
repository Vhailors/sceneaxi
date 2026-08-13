/**
 * Honest advanced extension seams. Networking, XR, marketplace, and
 * collaboration are declared and remain disabled until a separately
 * authorized adapter exists. No control starts those systems.
 */
export const EXTENSION_SEAM_SCHEMA_VERSION = 1 as const;
export const EXTENSION_SEAM_KIND = "sceneaxi.extension-seams" as const;

export const EXTENSION_SEAM_IDS = Object.freeze([
  "networking",
  "xr",
  "marketplace",
  "collaboration",
] as const);

export const EXTENSION_SEAM_CAPABILITY_IDS = Object.freeze({
  networking: "sceneaxi.extension.networking.v1",
  xr: "sceneaxi.extension.xr.v1",
  marketplace: "sceneaxi.extension.marketplace.v1",
  collaboration: "sceneaxi.extension.collaboration.v1",
} as const);

export const EXTENSION_SEAM_REFUSALS = Object.freeze({
  adapterAbsent: "EXTENSION_ADAPTER_ABSENT",
  undeclaredGrant: "EXTENSION_UNDECLARED_GRANT",
  kidsDenied: "EXTENSION_KIDS_DENIED",
  inputUnsupported: "EXTENSION_INPUT_UNSUPPORTED",
} as const);

export type ExtensionSeamId = (typeof EXTENSION_SEAM_IDS)[number];
export type ExtensionSeamRefusal =
  (typeof EXTENSION_SEAM_REFUSALS)[keyof typeof EXTENSION_SEAM_REFUSALS];

export type ExtensionSeam = Readonly<{
  id: ExtensionSeamId;
  capabilityId: (typeof EXTENSION_SEAM_CAPABILITY_IDS)[ExtensionSeamId];
  status: "disabled";
  reason: typeof EXTENSION_SEAM_REFUSALS.adapterAbsent;
  startsListener: false;
  startsSession: false;
  startsTransaction: false;
  startsChannel: false;
  adapterIssueRequired: true;
}>;

export function inspectExtensionSeams(input: Readonly<{ profile: unknown }>):
  | Readonly<{
      ok: true;
      kind: typeof EXTENSION_SEAM_KIND;
      schemaVersion: 1;
      seams: readonly ExtensionSeam[];
    }>
  | Readonly<{ ok: false; reason: ExtensionSeamRefusal; message: string }> {
  if (input.profile === "kids" || input.profile === "@sceneaxi/profile-kids") {
    return Object.freeze({
      ok: false as const,
      reason: EXTENSION_SEAM_REFUSALS.kidsDenied,
      message: "Advanced extension seams stay refuse-only on Kids.",
    });
  }
  return Object.freeze({
    ok: true as const,
    kind: EXTENSION_SEAM_KIND,
    schemaVersion: 1 as const,
    seams: Object.freeze(
      EXTENSION_SEAM_IDS.map((id) =>
        Object.freeze({
          id,
          capabilityId: EXTENSION_SEAM_CAPABILITY_IDS[id],
          status: "disabled" as const,
          reason: EXTENSION_SEAM_REFUSALS.adapterAbsent,
          startsListener: false as const,
          startsSession: false as const,
          startsTransaction: false as const,
          startsChannel: false as const,
          adapterIssueRequired: true as const,
        }),
      ),
    ),
  });
}

export function refuseUndeclaredExtensionGrant(capabilityId: string) {
  return Object.freeze({
    ok: false as const,
    reason: EXTENSION_SEAM_REFUSALS.undeclaredGrant,
    message: `Package metadata cannot grant undeclared capability "${capabilityId}".`,
  });
}

export function isDeclaredExtensionCapability(capabilityId: string): boolean {
  return Object.values(EXTENSION_SEAM_CAPABILITY_IDS).some((id) => id === capabilityId);
}

export function startExtensionSeam(input: Readonly<{
  profile: unknown;
  seamId: unknown;
}>):
  | Readonly<{ ok: false; reason: ExtensionSeamRefusal; message: string }> {
  if (input.profile === "kids" || input.profile === "@sceneaxi/profile-kids") {
    return Object.freeze({
      ok: false as const,
      reason: EXTENSION_SEAM_REFUSALS.kidsDenied,
      message: "Advanced extension seams stay refuse-only on Kids.",
    });
  }
  if (typeof input.seamId !== "string" || !(EXTENSION_SEAM_IDS as readonly string[]).includes(input.seamId)) {
    return Object.freeze({
      ok: false as const,
      reason: EXTENSION_SEAM_REFUSALS.inputUnsupported,
      message: "Start names one declared seam: networking, xr, marketplace, or collaboration.",
    });
  }
  return Object.freeze({
    ok: false as const,
    reason: EXTENSION_SEAM_REFUSALS.adapterAbsent,
    message: `The ${input.seamId} seam is declared and disabled until a separately authorized adapter issue lands.`,
  });
}
