/**
 * Named refusal registry for `@sceneaxi/site-kit`.
 *
 * Every fail-closed path in this package refuses with a key from this frozen
 * registry, and `test/refuse-matrix.test.ts` asserts every key is reachable. A
 * new refusal therefore cannot be added without a covering case.
 */

export const SITE_REFUSALS = Object.freeze({
  // --- plane wiring (the seam with sceneaxi-auth-credits-v1) ---
  IDENTITY_PLANE_NOT_WIRED:
    "No identity adapter is wired. The site refuses rather than serving an unauthenticated allow.",
  CREDITS_PLANE_NOT_WIRED:
    "No credits adapter is wired. The site refuses rather than assuming a balance.",
  BILLING_PLANE_NOT_WIRED:
    "No billing adapter is wired. The site refuses rather than inventing a checkout.",

  // --- boundary refusals, evaluated before any adapter dispatch ---
  KIDS_SURFACE_DENIED:
    "The Kids surface has a separate identity plane. No session may be minted for or accepted from it.",
  ROLE_CLAIM_FROM_CLIENT_DENIED:
    "A role claim arrived from the client. Roles are server-derived only and never client-claimable.",
  SITE_SURFACE_UNKNOWN: "The requested site surface is not a known SceneAxi surface.",
  SITE_REQUEST_MALFORMED: "The identity request is malformed.",

  // --- adapter-output validation ---
  IDENTITY_ADAPTER_OUTPUT_INVALID:
    "The identity adapter returned a value that is not a valid principal.",
  IDENTITY_ROLE_UNKNOWN: "The identity adapter returned a role outside the known role set.",
  IDENTITY_USER_DISABLED: "The resolved user is disabled.",
  IDENTITY_SESSION_EXPIRED: "The resolved session has expired.",
  IDENTITY_SESSION_NOT_YET_VALID:
    "The resolved session was issued in the future, so it is not yet valid.",
  IDENTITY_SESSION_SURFACE_MISMATCH:
    "The resolved session belongs to a different surface than the request.",
  CREDIT_BALANCE_INVALID:
    "The credits adapter returned a balance that is not a non-negative integer.",
  CREDIT_ADAPTER_OUTPUT_INVALID:
    "The credits adapter returned a value that is not a valid balance record.",

  // --- editor entitlement ---
  EDITOR_ENTITLEMENT_ANONYMOUS: "The web editor requires a signed-in principal.",
  EDITOR_ENTITLEMENT_NO_CREDITS:
    "The web editor requires credits above zero or an unused starter allotment.",
  EDITOR_ENTITLEMENT_BALANCE_INVALID:
    "The credit balance could not be read as a non-negative integer, so entitlement refuses.",
  EDITOR_ENTITLEMENT_UNAVAILABLE:
    "Entitlement could not be decided because no credit reading was supplied.",

  // --- capability matrix ---
  CAPABILITY_UNKNOWN: "The requested capability is not in the published site capability matrix.",
  HOSTED_AI_REQUIRES_CREDITS:
    "Hosted AI requires a positive credit balance for a non-admin; the unused starter allotment is not sufficient.",

  // --- billing ---
  BILLING_LIVE_MODE_NOT_AUTHORIZED:
    "Live billing mode requires an explicit captain authorization. Test mode is the default.",
  BILLING_URL_INSECURE: "Checkout success and cancel URLs must be https.",
  BILLING_CHECKOUT_REQUEST_INVALID: "The checkout request is malformed.",
  BILLING_ADAPTER_OUTPUT_INVALID:
    "The billing adapter returned a value that is not a valid checkout handoff.",

  // --- catalog (see catalog.ts) ---
  CATALOG_COMMERCE_INERT:
    "Catalog commerce is structurally inert until tier-6b marketplace activation holds open.",
  CATALOG_PRICE_UNAVAILABLE: "The listing carries neither a credit price nor a money price.",
  CATALOG_ITEM_NOT_FOUND: "No listed catalog item matches the requested id.",

  // --- editor deep link (see deep-link.ts) ---
  DEEP_LINK_SOURCE_UNKNOWN: "The deep-link source is not a known catalog surface.",
  DEEP_LINK_ORIGIN_INSECURE:
    "The umbrella origin must be an https origin (or http://localhost for development).",
  DEEP_LINK_ITEM_MISSING: "The deep link carries no catalog item id.",
  DEEP_LINK_UNKNOWN_PARAMETER: "The deep link carries a parameter outside the published contract.",

  // --- starter artifact (see starter-artifact.ts) ---
  EDITOR_STARTER_ARTIFACT_INVALID:
    "The starter sculpt intake did not reconstruct, so no editor scene can be opened.",

  // --- public engine SDK offer (see engine-sdk-offer.ts) ---
  ENGINE_SDK_ARTIFACT_MISSING:
    "The engine SDK archive or its manifest is not present in this build.",
  ENGINE_SDK_MANIFEST_INVALID:
    "The engine SDK manifest is malformed, so no download or checksum can be offered.",

  // --- bounded web editor session (see web-editor.ts) ---
  EDITOR_SESSION_DISPOSED: "The editor session has been disposed.",
  EDITOR_WORKSPACE_ESCAPE: "The document path escapes the session workspace root.",
  EDITOR_WORKSPACE_INVALID: "The session workspace root is not an absolute path.",
} as const);

export type SiteRefusalReason = keyof typeof SITE_REFUSALS;

/** Every refusal reason, frozen, for exhaustive matrix tests. */
export const SITE_REFUSAL_REASONS: readonly SiteRefusalReason[] = Object.freeze(
  Object.keys(SITE_REFUSALS) as SiteRefusalReason[],
);

export type SiteRefusal = {
  readonly ok: false;
  readonly reason: SiteRefusalReason;
  readonly message: string;
};

export type SiteOk<T> = { readonly ok: true; readonly value: T };

export type SiteResult<T> = SiteOk<T> | SiteRefusal;

/** Build a frozen refusal carrying the registry message for `reason`. */
export function refuse(reason: SiteRefusalReason): SiteRefusal {
  return Object.freeze({ ok: false as const, reason, message: SITE_REFUSALS[reason] });
}

/** Build a frozen ok result. */
export function ok<T>(value: T): SiteOk<T> {
  return Object.freeze({ ok: true as const, value });
}
