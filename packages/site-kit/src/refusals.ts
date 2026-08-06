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
  SITE_SURFACE_UNKNOWN: "The requested identity surface is not a known SceneAxi surface.",
  SITE_REQUEST_MALFORMED: "The identity request is malformed.",
  SITE_REQUEST_TARGET_TOO_LONG:
    "The state this request reconstructs would submit a URL beyond the bounded editor request-target budget, so it is refused by name here rather than left to a platform URL or header limit.",
  SITE_REQUEST_CROSS_ORIGIN:
    "The submission did not come from this deployment's own pages, so no session was created, revoked, or cleared from it.",

  // --- plane availability, distinct from "not wired" and from "no session" ---
  IDENTITY_SESSION_ABSENT:
    "No live session was resolved for this request. The visitor is signed out, which is not a failure.",
  IDENTITY_PLANE_UNAVAILABLE:
    "The identity adapter failed, so whether a session exists is unknown rather than absent.",
  CREDITS_PLANE_UNAVAILABLE:
    "The credits adapter failed, so the balance is unknown rather than zero.",
  BILLING_PLANE_UNAVAILABLE:
    "The billing adapter failed, so no pack list or checkout is offered.",

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

  // --- hosted login (see the login plane in ports.ts) ---
  LOGIN_CREDENTIALS_REQUIRED:
    "Sign-in requires a non-empty email and password. Nothing was dispatched to the identity plane.",
  LOGIN_CREDENTIALS_REJECTED:
    "That email and password did not authenticate. No session was created.",
  LOGIN_SESSION_NOT_ISSUED:
    "Sign-in reached the identity plane, but the session it returned cannot be issued as a browser credential, so none was set.",

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
  BILLING_CHECKOUT_ORIGIN_UNTRUSTED:
    "The request origin is not the umbrella origin this deployment is configured with, so no checkout redirect is built from it.",
  BILLING_CHECKOUT_ORIGIN_UNCONFIGURED:
    "This deployment has no configured https umbrella origin, so no checkout success or cancel URL can be built.",
  BILLING_ADAPTER_OUTPUT_INVALID:
    "The billing adapter returned a value that is not a valid checkout handoff.",

  // --- catalog (see catalog.ts) ---
  CATALOG_COMMERCE_INERT:
    "Catalog commerce is structurally inert until tier-6b marketplace activation holds open.",
  CATALOG_PURCHASE_METHOD_UNAVAILABLE:
    "The selected payment method is not offered by this committed catalog listing.",
  CATALOG_PRICE_UNAVAILABLE: "The listing carries neither a credit price nor a money price.",
  CATALOG_ITEM_NOT_FOUND: "No listed catalog item matches the requested id.",
  CATALOG_SUBMISSION_ENTITLEMENT_REQUIRED:
    "Catalog intake requires a real entitled editor request; preview access cannot submit.",
  CATALOG_SUBMISSION_SURFACE_UNSUPPORTED:
    "The editor profile does not map to a supported non-Kids catalog surface.",
  CATALOG_SUBMISSION_REQUEST_INVALID:
    "The catalog intake request is missing its bounded idempotency evidence.",
  CATALOG_SUBMISSION_DIGEST_INVALID:
    "The editor document or artifact digest is malformed, so no intake record was written.",
  CATALOG_SUBMISSION_METADATA_INVALID:
    "Required rights, provenance, AI-disclosure, or compatibility metadata is incomplete or malformed.",
  CATALOG_SUBMISSION_RETRY_CONFLICT:
    "This submitter's idempotency key, or the item id, was already used for different catalog intake evidence.",
  CATALOG_SUBMISSION_PRINCIPAL_INVALID:
    "The submitting principal is inconsistent or unusable as an idempotency scope, so nothing was written.",
  CATALOG_INTAKE_STORAGE_UNAVAILABLE:
    "The injected TEST catalog intake storage is unavailable, so nothing was written.",
  CATALOG_PIPELINE_PROVIDER_FAILED:
    "The injected TEST catalog pipeline provider failed or returned invalid evidence.",
  CATALOG_PIPELINE_TRANSITION_INVALID:
    "The requested catalog transition is not a valid next step with its required evidence.",
  CATALOG_PIPELINE_READ_MODEL_INVALID:
    "The injected catalog read model returned an invalid or digest-unbound record.",

  // --- editor deep link (see deep-link.ts) ---
  DEEP_LINK_SOURCE_UNKNOWN: "The deep-link source is not a known catalog surface.",
  DEEP_LINK_ORIGIN_INSECURE:
    "The umbrella origin must be an https origin (or http://localhost for development).",
  DEEP_LINK_ITEM_MISSING: "The deep link carries no catalog item id.",
  DEEP_LINK_UNKNOWN_PARAMETER: "The deep link carries a parameter outside the published contract.",

  // --- starter artifact (see starter-artifact.ts) ---
  EDITOR_STARTER_ARTIFACT_INVALID:
    "The starter sculpt intake did not reconstruct, so no editor scene can be opened.",

  // --- public live open path (see live-open.ts) ---
  LIVE_OPEN_NOT_COMPOSABLE:
    "The scene-composition pipeline refused the live-open placements, so no scene is opened.",

  // --- public engine SDK offer (see engine-sdk-offer.ts) ---
  ENGINE_SDK_ARTIFACT_MISSING:
    "The engine SDK archive or its manifest is not present in this build.",
  ENGINE_SDK_MANIFEST_INVALID:
    "The engine SDK manifest is malformed, so no download or checksum can be offered.",
  DESKTOP_APP_ARTIFACT_UNAVAILABLE:
    "No complete Linux desktop artifact record is available, so no desktop download can be offered.",
  DESKTOP_APP_ARTIFACT_LINK_INVALID:
    "The Linux desktop artifact link does not name its recorded repository workflow run, so no download can be offered.",

  // --- Foundations v2 tokens (see design-tokens.ts) ---
  FOUNDATION_SURFACE_UNKNOWN:
    "The requested surface is not in the published Foundations accent map, so no theme is emitted for it.",

  // --- Change Review, the signature primitive (see change-review.ts) ---
  CHANGE_REVIEW_PROPOSAL_INVALID:
    "The proposal does not satisfy the propose/apply contract, so no diff is rendered from it.",
  CHANGE_REVIEW_DOCUMENT_MISSING:
    "A document the proposal edits was not supplied, so the review cannot show what the change is against.",
  CHANGE_REVIEW_PROPOSAL_STALE:
    "The document has moved since the proposal was made. A stale proposal is refused, never merged.",
  CHANGE_REVIEW_PROJECTION_FAILED:
    "The proposed edits do not project onto the supplied document, so no resulting digest is shown.",
  CHANGE_REVIEW_DECISION_UNKNOWN_ROW:
    "A decision names a row this review does not have.",
  CHANGE_REVIEW_PARTIAL_ACCEPT_UNSUPPORTED:
    "Accepting some rows and rejecting others would need a narrowed proposal, which apply (E1, all-or-nothing) does not take and this package does not author.",

  // --- bounded web editor session (see web-editor.ts) ---
  EDITOR_SESSION_DISPOSED: "The editor session has been disposed.",
  EDITOR_WORKSPACE_ESCAPE: "The document path escapes the session workspace root.",
  EDITOR_WORKSPACE_INVALID: "The session workspace root is not an absolute path.",
  EDITOR_WORKSPACE_UNAVAILABLE:
    "The ephemeral editor workspace could not be created or removed, so no session was rendered.",
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
