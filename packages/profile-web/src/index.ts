/**
 * @sceneaxi/profile-web — Web Experience profile; pins a core range and
 * compiles the locked v1 scope boundary into its public seam.
 */
import {
  apply,
  createDocument,
  parseDocumentText,
  propose,
  writeDocumentFile,
} from "@sceneaxi/authoring-core";
import { open, replay } from "@sceneaxi/engine-kernel";
import { createNullPresentationRuntime } from "@sceneaxi/engine-presentation";
import {
  evaluateOpenPathDemo,
  openPathPolicyRowFor,
  type OpenPathDemoDecision,
  type OpenPathPolicyRow,
  type ProfileSeam,
} from "@sceneaxi/schemas";

export const WEB_EXPERIENCE_POLICY_VERSION = 1 as const;

/** Capabilities inside the locked Web Experience boundary. */
export const WEB_EXPERIENCE_SCOPES = Object.freeze([
  "interactive-experience",
  "interactive-site-shell",
  "interactive-site-chrome",
] as const);

/** Neighboring product lanes explicitly excluded by the locked decision. */
export const WEB_EXPERIENCE_REFUSED_SCOPES = Object.freeze([
  "cms",
  "form-builder",
  "app-builder",
  "conventional-next-trpc-saas",
] as const);

export type WebExperienceScope = (typeof WEB_EXPERIENCE_SCOPES)[number];
export type WebExperienceRefusedScope =
  (typeof WEB_EXPERIENCE_REFUSED_SCOPES)[number];

export type WebExperiencePolicyDecision =
  | Readonly<{
      ok: true;
      scope: WebExperienceScope;
    }>
  | Readonly<{
      ok: false;
      requestedScope: string | null;
      reason: "OUTSIDE_WEB_EXPERIENCE_SCOPE" | "UNKNOWN_WEB_EXPERIENCE_SCOPE";
      message: string;
    }>;

const webExperienceScopeSet = new Set<string>(WEB_EXPERIENCE_SCOPES);
const refusedWebExperienceScopeSet = new Set<string>(
  WEB_EXPERIENCE_REFUSED_SCOPES,
);

/**
 * Evaluate a requested product scope at the profile boundary.
 * Unknown values refuse: extending the profile requires an explicit policy edit.
 */
export function evaluateWebExperienceScope(
  requestedScope: unknown,
): WebExperiencePolicyDecision {
  if (
    typeof requestedScope === "string" &&
    webExperienceScopeSet.has(requestedScope)
  ) {
    return Object.freeze({
      ok: true,
      scope: requestedScope as WebExperienceScope,
    });
  }

  const scope = typeof requestedScope === "string" ? requestedScope : null;
  const outsideLockedBoundary =
    scope !== null && refusedWebExperienceScopeSet.has(scope);

  return Object.freeze({
    ok: false,
    requestedScope: scope,
    reason: outsideLockedBoundary
      ? "OUTSIDE_WEB_EXPERIENCE_SCOPE"
      : "UNKNOWN_WEB_EXPERIENCE_SCOPE",
    message: outsideLockedBoundary
      ? `Scope '${scope}' belongs outside the Web Experience profile.`
      : "Unknown Web Experience scope refused; policy expansion must be explicit.",
  });
}

export const policy = Object.freeze({
  version: WEB_EXPERIENCE_POLICY_VERSION,
  decisionKey: "web-experience-profile-scope" as const,
  defaultDecision: "refuse" as const,
  scopes: WEB_EXPERIENCE_SCOPES,
  refusedScopes: WEB_EXPERIENCE_REFUSED_SCOPES,
});

export const seam: ProfileSeam = Object.freeze({
  name: "@sceneaxi/profile-web",
  releaseGroup: "profile",
  corePin: "^0.0.0",
});

/**
 * This profile's row in the shared open-path demo policy (sceneaxi#137).
 *
 * The row is *read*, never restated: the Web profile does not get to describe
 * its own demo level in its own words, because the CLI and both shells report
 * the same table and the parity suite compares them byte for byte. A missing
 * row is a build-time failure rather than a silent fallback — the profile
 * cannot exist outside the policy that governs it.
 */
export const openPathPolicy: OpenPathPolicyRow = (() => {
  const row = openPathPolicyRowFor("@sceneaxi/profile-web");
  if (row === undefined) {
    throw new Error(
      "@sceneaxi/profile-web has no row in the shared open-path demo policy.",
    );
  }
  return row;
})();

/**
 * Ask the shared policy whether this profile may demonstrate one open-path
 * operation. Identical semantics on every surface: same function, same table.
 */
export function evaluateOpenPath(
  operation: string,
  claimsShipping = false,
): OpenPathDemoDecision {
  return evaluateOpenPathDemo({
    profile: "@sceneaxi/profile-web",
    operation,
    claimsShipping,
  });
}

/**
 * Development-only Web profile pin for the shared MVP fixture. This is not a
 * Profile Conformance registry claim and does not describe a shipped website.
 */
export const mvpGoldenPath = Object.freeze({
  seam,
  policy,
  evaluateScope: evaluateWebExperienceScope,
  openPath: Object.freeze({
    policy: openPathPolicy,
    evaluate: evaluateOpenPath,
  }),
  status: Object.freeze({
    developmentConsumer: true as const,
    shippingClaim: false as const,
    productSurface: "not-shipped" as const,
  }),
  core: Object.freeze({
    authoring: Object.freeze({
      createDocument,
      parseDocumentText,
      writeDocumentFile,
      propose,
      apply,
    }),
    kernel: Object.freeze({ open, replay }),
    presentation: Object.freeze({ createNullPresentationRuntime }),
  }),
});
