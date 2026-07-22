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

export const policy = Object.freeze({
  version: KIDS_POLICY_VERSION,
  decisionKey: "kids-surface-isolation" as const,
  isolation: "fully-isolated" as const,
  defaultDecision: "refuse" as const,
  isolationPlanes: KIDS_ISOLATION_PLANES,
  allowedLlmRouteKinds: Object.freeze([]),
  thirdPartyLlmDefault: "deny" as const,
});

export const seam: ProfileSeam = Object.freeze({
  name: "@sceneaxi/profile-kids",
  releaseGroup: "profile",
  corePin: "^0.0.0",
});
