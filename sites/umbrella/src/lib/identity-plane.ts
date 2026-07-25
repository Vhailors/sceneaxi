/**
 * The single wiring point for the identity plane.
 *
 * This is the **only** module that constructs the identity, credits, and billing
 * ports. Everything else on the umbrella consumes what it returns.
 *
 * `sceneaxi-auth-credits-v1` (#90–#98) owns identity and billing: single-admin
 * resolution from `SCENEAXI_ADMIN_EMAIL`, fail-closed role guards, the append-only
 * credit ledger, and Stripe webhook verification. `packages/auth` and
 * `packages/billing` now exist, but that vertical scopes its own shell wiring to
 * `apps/web-shell`; wiring **this** site is a separate change, so the umbrella is
 * deliberately still unwired here.
 *
 * Rather than fork auth, this module leaves the adapters unset. Every port then
 * refuses with its own named reason, so the umbrella tells the truth about being
 * unwired instead of minting a fake session or showing a fake balance.
 *
 * Activation is three steps and touches no other site file: widen this site's allow
 * list in `docs/dependency-matrix.json` to include the two identity-plane packages,
 * add them to this site's manifest, and pass their adapter factories into
 * `createUmbrellaIdentityPlane` below. The step-by-step procedure and the full env
 * var list live in `docs/websites-deploy.md`.
 *
 * The allow list stays deliberately narrow until that change, so the boundary checker
 * refuses an accidental early dependency rather than letting a half-wired plane ship.
 */
import {
  createBillingPlane,
  createCreditsPlane,
  createIdentityPlane,
  type SiteBillingAdapter,
  type SiteBillingMode,
  type SiteBillingPort,
  type SiteCreditsAdapter,
  type SiteCreditsPort,
  type SiteIdentityAdapter,
  type SiteIdentityPort,
} from "@sceneaxi/site-kit";

export type IdentityPlaneAdapters = {
  readonly identity?: SiteIdentityAdapter | undefined;
  readonly credits?: SiteCreditsAdapter | undefined;
  readonly billing?: SiteBillingAdapter | undefined;
};

export type UmbrellaIdentityPlane = {
  readonly identity: SiteIdentityPort;
  readonly credits: SiteCreditsPort;
  readonly billing: SiteBillingPort;
  /** Whether an adapter is present for each plane, for honest UI copy. */
  readonly wired: {
    readonly identity: boolean;
    readonly credits: boolean;
    readonly billing: boolean;
  };
  readonly billingMode: SiteBillingMode;
};

/**
 * Billing mode from the environment. Anything other than an explicit `live` is
 * `test`, and `live` still refuses inside the port without separate authorization,
 * so a stray env value cannot start real charges.
 */
export function resolveBillingMode(
  env: Readonly<Record<string, string | undefined>>,
): SiteBillingMode {
  return env["SCENEAXI_BILLING_MODE"]?.trim().toLowerCase() === "live" ? "live" : "test";
}

/** Build the umbrella's identity plane. Unwired by default, and honest about it. */
export function createUmbrellaIdentityPlane(
  env: Readonly<Record<string, string | undefined>> = {},
  adapters: IdentityPlaneAdapters = {},
): UmbrellaIdentityPlane {
  const billingMode = resolveBillingMode(env);
  return Object.freeze({
    identity: createIdentityPlane({ adapter: adapters.identity }),
    credits: createCreditsPlane({ adapter: adapters.credits }),
    billing: createBillingPlane({ adapter: adapters.billing, mode: billingMode }),
    wired: Object.freeze({
      identity: adapters.identity !== undefined,
      credits: adapters.credits !== undefined,
      billing: adapters.billing !== undefined,
    }),
    billingMode,
  });
}

/** Where a reader is sent when a plane is unwired. */
export const IDENTITY_PLANE_DOC = "docs/websites-deploy.md";

export const IDENTITY_PLANE_PENDING_NOTE =
  "Sign-in, credit balances, and credit-pack checkout activate when this site is wired to the auth + credits plane (sceneaxi#90). Until then these surfaces refuse rather than showing an invented session or balance.";
