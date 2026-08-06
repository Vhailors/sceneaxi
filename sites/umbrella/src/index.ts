/**
 * @sceneaxi/site-umbrella — the deployable umbrella site.
 *
 * A thin view + wiring layer over `@sceneaxi/site-kit`, which owns every
 * non-presentational behaviour and is tested in `pnpm gate`. This seam and the
 * `src/lib/` modules beside it are pure TypeScript, so the hermetic gate type-checks
 * them; only `src/app/` imports React or Next.
 *
 * `src/lib/identity-plane.ts` is the single documented plug point for
 * `@sceneaxi/auth` and `@sceneaxi/billing`, and is where the provider handles those
 * packages need — Better Auth, Neon, the Stripe API — arrive when a deployment has them.
 */
import type { PackageSeam } from "@sceneaxi/site-kit";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/site-umbrella",
  releaseGroup: "sites",
});

export {
  UMBRELLA_BRAND,
  resolveFamilyLinks,
  resolveUmbrellaEditorAccess,
  type FamilyLinks,
  type UmbrellaEditorAccess,
} from "./lib/site-config.js";
export {
  UMBRELLA_CATALOG_INTAKE_ACTION,
  buildUmbrellaCatalogIntakeView,
  readUmbrellaCatalogIntakePanel,
  submitUmbrellaEditorToCatalog,
  umbrellaCatalogIntake,
  umbrellaCatalogIntakeKey,
  umbrellaEditorStateFields,
  umbrellaEditorStateFromFields,
  type UmbrellaCatalogIntakeInjection,
  type UmbrellaCatalogIntakePanel,
  type UmbrellaCatalogIntakeRecordView,
  type UmbrellaCatalogIntakeView,
} from "./lib/catalog-submission.js";

export { EDITOR_VIEWPORT_COPY } from "./lib/editor-viewport.js";

export {
  DOWNLOAD_PLATFORMS,
  downloadCallToAction,
  resolveDownloadPlatform,
  type DetectedDownloadPlatform,
  type DownloadPlatformId,
  type DownloadPlatformOffer,
} from "./lib/download-platform.js";

export {
  ENGINE_COMPARISONS,
  LAUNCH_PROOFS,
  PROFILE_RELEASE_MATRIX,
  type EngineComparison,
  type LaunchProof,
  type ReleaseCapability,
  type ReleaseProfile,
  type ReleaseProfileId,
} from "./lib/launch-marketing.js";

export {
  LIVE_OPEN_COPY,
  LIVE_OPEN_INSTANCE_COUNT,
  LIVE_OPEN_PATH,
  LIVE_OPEN_PRESENTATION,
  describePlacement,
  resolveLiveOpenScene,
  type LiveOpenInstance,
  type LiveOpenScene,
} from "./lib/live-open.js";

export {
  BILLING_PLANE_PENDING_NOTE,
  IDENTITY_PLANE_DOC,
  IDENTITY_PLANE_PENDING_NOTE,
  createAuthIdentityAdapter,
  createAuthLoginAdapter,
  createBillingCheckoutAdapter,
  createBillingCreditsAdapter,
  createUmbrellaIdentityPlane,
  parseSessionToken,
  resolveBillingMode,
  siteReasonForAuthReason,
  siteReasonForBillingReason,
  siteReasonForLoginAuthReason,
  toSitePrincipal,
  type BillingReadPlane,
  type CheckoutSessionAdapter,
  type CreditWebhookCapability,
  type IdentityPlaneAdapters,
  type IdentityPlaneWiring,
  type UmbrellaIdentityPlane,
  type UmbrellaPlaneHandles,
} from "./lib/identity-plane.js";

export {
  umbrellaRequestAuthority,
  type UmbrellaRequestAuthority,
  type UmbrellaRequestEvidence,
  type UmbrellaWebhookRequestEvidence,
} from "./lib/request-authority.js";

export {
  LOGIN_DEFAULT_DESTINATION,
  LOGIN_PATH,
  loginRefusalHref,
  loginRefusalOutcome,
  performLogin,
  performLogout,
  readLoginRefusalReason,
  resolveLoginDestination,
  resolveSessionCookieSecurity,
  verifyLoginRequestOrigin,
  type LoginAttemptOutcome,
  type LoginFormFields,
  type LogoutOutcome,
} from "./lib/login-flow.js";

export {
  createBetterAuthHttpClient,
  createNeonCheckoutIntentStore,
  createNeonCreditStore,
  createNeonCreditStoreAdapter,
  createNeonDatabase,
  createNeonIdentityStore,
  createProvisioningIdentityAdapter,
  createStripeCheckoutEvidenceAdapter,
  createStripeCheckoutSessionAdapter,
  createStripeClient,
  resolveBetterAuthOrigin,
  resolveNonEmptyEnv,
  type DeploymentProviderOverrides,
  type NeonDatabase,
  type NeonIdentityStore,
  type ProviderFetch,
  type ProviderResponseHeaders,
  type SqlRow,
  type SqlStatement,
  type StripeClientLike,
  type StripeSession,
  type StripeSessionCreateParams,
} from "./lib/provider-adapters.js";

export {
  CREDIT_WEBHOOK_REASONS,
  STRIPE_SIGNATURE_HEADER,
  STRIPE_WEBHOOK_SECRET_ENV,
  applyCreditPackWebhook,
  creditWebhookHttpStatus,
  type CheckoutEvidencePort,
  type CreditWebhookOutcome,
} from "./lib/credit-webhook.js";
