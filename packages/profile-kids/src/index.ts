/**
 * @sceneaxi/profile-kids — fully isolated Kids profile with a fail-closed
 * policy compiled into the package. Nothing outside Kids surfaces may depend
 * on it.
 */
import type { ProfileSeam } from "@sceneaxi/schemas";

export const KIDS_POLICY_VERSION = 1 as const;

/** Every product plane covered by the locked full-isolation decision. */
export const KIDS_ISOLATION_PLANES = Object.freeze([
  "origin",
  "application-surface",
  "identity-data",
  "accounts",
  "sessions",
  "cookies",
  "telemetry",
  "llm-provider-traffic",
] as const);

export type KidsIsolationPlane = (typeof KIDS_ISOLATION_PLANES)[number];

export type KidsIsolationDecision =
  | Readonly<{
      ok: true;
      plane: KidsIsolationPlane;
      mode: "isolated";
    }>
  | Readonly<{
      ok: false;
      plane: string | null;
      reason: "UNKNOWN_ISOLATION_PLANE" | "KIDS_ISOLATION_REQUIRED";
      message: string;
    }>;

export type KidsLlmRouteDecision = Readonly<{
  ok: false;
  routeKind: string | null;
  reason: "THIRD_PARTY_LLM_DENIED_BY_DEFAULT" | "KIDS_LLM_ROUTE_NOT_ALLOWED";
  message: string;
}>;

export const KIDS_NETWORK_DESTINATION_ALLOWLIST = Object.freeze([] as const);

export const KIDS_REFUSE_REASONS = Object.freeze({
  claimInvalid: "KIDS_BOUNDARY_CLAIM_INVALID",
  externalDataPlaneDenied: "EXTERNAL_DATA_PLANE_DENIED",
  dataPlaneNotEnabled: "KIDS_DATA_PLANE_NOT_ENABLED",
  nonKidsCatalogDenied: "NON_KIDS_CATALOG_DENIED",
  catalogNotEnabled: "KIDS_CATALOG_NOT_ENABLED",
  commerceNotEnabled: "KIDS_COMMERCE_NOT_ENABLED",
  networkDestinationNotAllowlisted:
    "KIDS_NETWORK_DESTINATION_NOT_ALLOWLISTED",
} as const);

export type KidsBoundaryClaim =
  | Readonly<{ kind: "external-data-plane"; plane: string }>
  | Readonly<{ kind: "catalog"; profile: string }>
  | Readonly<{ kind: "commerce"; action: string }>
  | Readonly<{ kind: "network"; destination: string }>;

export type KidsBoundaryRefusal = Readonly<{
  ok: false;
  claimKind: KidsBoundaryClaim["kind"] | null;
  reason: (typeof KIDS_REFUSE_REASONS)[keyof typeof KIDS_REFUSE_REASONS];
  message: string;
}>;

const kidsIsolationPlaneSet = new Set<string>(KIDS_ISOLATION_PLANES);

/**
 * Validate one product plane against the compiled Kids isolation policy.
 * Shared modes, unknown modes, and unknown planes all refuse.
 */
export function evaluateKidsIsolation(
  plane: unknown,
  mode: unknown,
): KidsIsolationDecision {
  if (typeof plane !== "string" || !kidsIsolationPlaneSet.has(plane)) {
    return Object.freeze({
      ok: false,
      plane: typeof plane === "string" ? plane : null,
      reason: "UNKNOWN_ISOLATION_PLANE",
      message: "Unknown Kids isolation plane refused; policy expansion must be explicit.",
    });
  }

  if (mode !== "isolated") {
    return Object.freeze({
      ok: false,
      plane,
      reason: "KIDS_ISOLATION_REQUIRED",
      message: `Kids plane '${plane}' must remain isolated; shared or runtime-switchable modes are refused.`,
    });
  }

  return Object.freeze({
    ok: true,
    plane: plane as KidsIsolationPlane,
    mode: "isolated",
  });
}

/**
 * Current Kids LLM route gate. The stub has no allowed route kinds, so every
 * route refuses; third-party routes receive the stable default-denial reason.
 */
export function evaluateKidsLlmRoute(
  routeKind: unknown,
): KidsLlmRouteDecision {
  const normalizedRouteKind = typeof routeKind === "string" ? routeKind : null;
  const thirdParty = normalizedRouteKind === "third-party";

  return Object.freeze({
    ok: false,
    routeKind: normalizedRouteKind,
    reason: thirdParty
      ? "THIRD_PARTY_LLM_DENIED_BY_DEFAULT"
      : "KIDS_LLM_ROUTE_NOT_ALLOWED",
    message: thirdParty
      ? "Third-party LLM routes are denied by default for Kids."
      : "No Kids LLM route is enabled by the compiled policy.",
  });
}

function claimString(
  claim: Record<string, unknown>,
  key: "plane" | "profile" | "action" | "destination",
) {
  const value = claim[key];
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

/**
 * Executable MVP refusal matrix for every non-model external route. No claim
 * here enables a Kids surface, catalog, commerce flow, data plane, or network
 * destination; an explicit future safety decision must add any allow path.
 */
export function evaluateKidsBoundaryClaim(
  claim: unknown,
): KidsBoundaryRefusal {
  if (typeof claim !== "object" || claim === null || Array.isArray(claim)) {
    return Object.freeze({
      ok: false,
      claimKind: null,
      reason: KIDS_REFUSE_REASONS.claimInvalid,
      message: "Malformed Kids boundary claim refused.",
    });
  }
  const record = claim as Record<string, unknown>;
  const kind = record["kind"];

  if (kind === "external-data-plane") {
    const plane = claimString(record, "plane");
    return Object.freeze({
      ok: false,
      claimKind: kind,
      reason:
        plane === "external"
          ? KIDS_REFUSE_REASONS.externalDataPlaneDenied
          : KIDS_REFUSE_REASONS.dataPlaneNotEnabled,
      message:
        plane === "external"
          ? "External data-plane access is denied for Kids."
          : "No Kids data plane is enabled by the MVP policy.",
    });
  }

  if (kind === "catalog") {
    const profile = claimString(record, "profile");
    return Object.freeze({
      ok: false,
      claimKind: kind,
      reason:
        profile !== undefined && profile !== "kids"
          ? KIDS_REFUSE_REASONS.nonKidsCatalogDenied
          : KIDS_REFUSE_REASONS.catalogNotEnabled,
      message:
        profile !== undefined && profile !== "kids"
          ? "Non-Kids catalog routes are denied for Kids."
          : "No Kids catalog product surface is enabled.",
    });
  }

  if (kind === "commerce") {
    return Object.freeze({
      ok: false,
      claimKind: kind,
      reason: KIDS_REFUSE_REASONS.commerceNotEnabled,
      message: "Kids commerce paths are not enabled.",
    });
  }

  if (kind === "network") {
    return Object.freeze({
      ok: false,
      claimKind: kind,
      reason: KIDS_REFUSE_REASONS.networkDestinationNotAllowlisted,
      message: "The requested network destination is not on the empty Kids MVP allowlist.",
    });
  }

  return Object.freeze({
    ok: false,
    claimKind: null,
    reason: KIDS_REFUSE_REASONS.claimInvalid,
    message: "Unknown Kids boundary claim refused.",
  });
}

export const policy = Object.freeze({
  version: KIDS_POLICY_VERSION,
  decisionKey: "kids-surface-isolation" as const,
  isolation: "fully-isolated" as const,
  defaultDecision: "refuse" as const,
  isolationPlanes: KIDS_ISOLATION_PLANES,
  allowedLlmRouteKinds: Object.freeze([]),
  allowedNetworkDestinations: KIDS_NETWORK_DESTINATION_ALLOWLIST,
  thirdPartyLlmDefault: "deny" as const,
});

export const seam: ProfileSeam = Object.freeze({
  name: "@sceneaxi/profile-kids",
  releaseGroup: "profile",
  corePin: "^0.0.0",
});
