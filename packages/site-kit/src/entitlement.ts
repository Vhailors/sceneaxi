/**
 * Free-vs-paid capability matrix and Minimum E2 web editor entitlement.
 *
 * Entitlement is decided here; credits are **granted** elsewhere. This module
 * decides *eligibility* for the 100-credit starter allotment and never appends a
 * ledger entry — the idempotent grant belongs to `@sceneaxi/billing`.
 *
 * ADR 0019 records the product decision. It does not authorize general E2
 * (ADR 0003 stands) and does not open tier-6b marketplace activation.
 */
import {
  type SiteCreditBalance,
  type SiteCreditsPort,
  type SiteIdentityPort,
  type SiteIdentityRequest,
  type SitePrincipal,
} from "./ports.js";
import { type SiteRefusal, type SiteRefusalReason, type SiteResult, refuse } from "./refusals.js";

/** Starter allotment: 100 credits, once per new user (captain decision). */
export const SITE_STARTER_CREDIT_ALLOTMENT = 100 as const;

export type SiteCapabilityTier = "free" | "paid";

/**
 * The published free-vs-paid matrix. Free capabilities are served to anonymous
 * visitors; paid capabilities refuse fail-closed until the identity/credits/
 * billing planes are wired.
 */
export const SITE_CAPABILITIES = Object.freeze({
  "docs-and-product": Object.freeze({ tier: "free", requires: "nothing" }),
  "engine-sdk-download": Object.freeze({ tier: "free", requires: "nothing" }),
  "cli-byo-ai-docs": Object.freeze({ tier: "free", requires: "nothing" }),
  "catalog-browse": Object.freeze({ tier: "free", requires: "nothing" }),
  "catalog-detail": Object.freeze({ tier: "free", requires: "nothing" }),
  "web-editor": Object.freeze({ tier: "paid", requires: "entitlement" }),
  "hosted-ai": Object.freeze({ tier: "paid", requires: "credits" }),
  "catalog-purchase": Object.freeze({ tier: "paid", requires: "credits-and-tier-6b" }),
  "credit-pack-checkout": Object.freeze({ tier: "paid", requires: "billing" }),
} as const);

export type SiteCapability = keyof typeof SITE_CAPABILITIES;

export const SITE_CAPABILITY_IDS: readonly SiteCapability[] = Object.freeze(
  Object.keys(SITE_CAPABILITIES) as SiteCapability[],
);

export type EntitlementBasis = "admin-unrestricted" | "credit-balance" | "starter-allotment";

export type EditorEntitlementDecision =
  | {
      readonly entitled: true;
      readonly basis: EntitlementBasis;
      /** Credits the starter grant would award, or `null` when not applicable. */
      readonly starterCredits: number | null;
    }
  | {
      readonly entitled: false;
      readonly reason: SiteRefusalReason;
      readonly message: string;
    };

export type EditorEntitlementInput = {
  readonly principal: SitePrincipal | null;
  /**
   * The credits port reading, or `null` when none was taken. A refusal is
   * propagated verbatim so the site shows the plane's own named reason.
   */
  readonly credits: SiteResult<SiteCreditBalance> | null;
};

const denied = (reason: SiteRefusalReason): EditorEntitlementDecision => {
  const { message } = refuse(reason);
  return Object.freeze({ entitled: false as const, reason, message });
};

const granted = (basis: EntitlementBasis, starterCredits: number | null) =>
  Object.freeze({ entitled: true as const, basis, starterCredits });

/**
 * Decide web editor entitlement. Total and pure: admin is unrestricted, then a
 * positive balance, then an unused starter allotment, else a named refusal.
 */
export function decideEditorEntitlement(
  input: EditorEntitlementInput,
): EditorEntitlementDecision {
  const principal = input.principal;
  if (principal === null) return denied("EDITOR_ENTITLEMENT_ANONYMOUS");

  // Admin is unrestricted, and deliberately short-circuits before any credit
  // reading is consulted — an admin must never be gated on a balance.
  if (principal.role === "admin") return granted("admin-unrestricted", null);

  if (input.credits === null) return denied("EDITOR_ENTITLEMENT_UNAVAILABLE");
  if (!input.credits.ok) {
    const propagated: SiteRefusal = input.credits;
    return Object.freeze({
      entitled: false as const,
      reason: propagated.reason,
      message: propagated.message,
    });
  }

  const { balance, starterGrantConsumed } = input.credits.value;
  if (!Number.isSafeInteger(balance) || balance < 0) {
    return denied("EDITOR_ENTITLEMENT_BALANCE_INVALID");
  }
  if (balance > 0) return granted("credit-balance", null);
  if (!starterGrantConsumed) {
    return granted("starter-allotment", SITE_STARTER_CREDIT_ALLOTMENT);
  }
  return denied("EDITOR_ENTITLEMENT_NO_CREDITS");
}

export type SiteAccess = {
  readonly principal: SitePrincipal | null;
  readonly identity: SiteResult<SitePrincipal>;
  readonly credits: SiteResult<SiteCreditBalance> | null;
  readonly entitlement: EditorEntitlementDecision;
};

/**
 * Resolve a request all the way to an entitlement decision.
 *
 * The credits port is consulted **only** for a non-admin principal, which is what
 * makes the admin path independent of the credits plane being wired at all.
 */
export async function resolveEditorAccess(input: {
  readonly identity: SiteIdentityPort;
  readonly credits: SiteCreditsPort;
  readonly request: SiteIdentityRequest;
}): Promise<SiteAccess> {
  const identityResult = await input.identity.resolvePrincipal(input.request);
  if (!identityResult.ok) {
    return Object.freeze({
      principal: null,
      identity: identityResult,
      credits: null,
      entitlement: Object.freeze({
        entitled: false as const,
        reason: identityResult.reason,
        message: identityResult.message,
      }),
    });
  }
  const principal = identityResult.value;
  if (principal.role === "admin") {
    return Object.freeze({
      principal,
      identity: identityResult,
      credits: null,
      entitlement: decideEditorEntitlement({ principal, credits: null }),
    });
  }
  const credits = await input.credits.readBalance({ userId: principal.user.userId });
  return Object.freeze({
    principal,
    identity: identityResult,
    credits,
    entitlement: decideEditorEntitlement({ principal, credits }),
  });
}

export type CapabilityDecision =
  | { readonly allowed: true; readonly capability: SiteCapability; readonly tier: SiteCapabilityTier }
  | {
      readonly allowed: false;
      readonly capability: SiteCapability | null;
      readonly reason: SiteRefusalReason;
      readonly message: string;
    };

const capabilityDenied = (
  capability: SiteCapability | null,
  reason: SiteRefusalReason,
): CapabilityDecision => {
  const { message } = refuse(reason);
  return Object.freeze({ allowed: false as const, capability, reason, message });
};

/**
 * Decide a capability against the published matrix.
 *
 * Free capabilities are always allowed — they are what an anonymous visitor gets.
 * Paid capabilities resolve through the entitlement decision, so an unwired plane
 * surfaces its own named refusal rather than a generic denial.
 */
export function decideCapability(input: {
  readonly capability: string;
  readonly access: SiteAccess | null;
  readonly billingWired?: boolean;
}): CapabilityDecision {
  if (!(SITE_CAPABILITY_IDS as readonly string[]).includes(input.capability)) {
    return capabilityDenied(null, "CAPABILITY_UNKNOWN");
  }
  const capability = input.capability as SiteCapability;
  const spec = SITE_CAPABILITIES[capability];
  if (spec.tier === "free") {
    return Object.freeze({ allowed: true as const, capability, tier: "free" as const });
  }
  if (capability === "catalog-purchase") {
    // Tier-6b marketplace activation keys remain open; commerce is inert.
    return capabilityDenied(capability, "CATALOG_COMMERCE_INERT");
  }
  if (capability === "credit-pack-checkout") {
    return input.billingWired === true
      ? Object.freeze({ allowed: true as const, capability, tier: "paid" as const })
      : capabilityDenied(capability, "BILLING_PLANE_NOT_WIRED");
  }
  const access = input.access;
  if (access === null) return capabilityDenied(capability, "EDITOR_ENTITLEMENT_UNAVAILABLE");
  if (!access.entitlement.entitled) {
    return capabilityDenied(capability, access.entitlement.reason);
  }
  return Object.freeze({ allowed: true as const, capability, tier: "paid" as const });
}

/**
 * The editor preview flag.
 *
 * Server environment only, absent by default. It exists because the identity plane
 * (`sceneaxi-auth-credits-v1`) has not landed, so without it the Minimum E2 surface
 * would be undemonstrable on a production deploy. A client cannot set it — a site
 * reads it from `process.env` and never from a request — and it is removed once
 * entitlement can actually be resolved.
 */
export function readEditorPreviewFlag(
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  return env["SCENEAXI_SITE_EDITOR_PREVIEW"]?.trim() === "1";
}

export type EditorAccessDecision =
  | {
      readonly granted: true;
      /** `preview` is banner-marked in the UI so it is never mistaken for entitlement. */
      readonly mode: "entitled" | "preview";
      readonly basis: EntitlementBasis | "preview-flag";
    }
  | {
      readonly granted: false;
      readonly reason: SiteRefusalReason;
      readonly message: string;
    };

/**
 * Decide whether an editor session may be constructed.
 *
 * Entitlement wins when present; the preview flag is the only other way in, and its
 * absence is a refusal. There is no third path and no client-supplied override.
 */
export function decideEditorAccess(input: {
  readonly entitlement: EditorEntitlementDecision;
  readonly previewEnabled: boolean;
}): EditorAccessDecision {
  if (input.entitlement.entitled) {
    return Object.freeze({
      granted: true as const,
      mode: "entitled" as const,
      basis: input.entitlement.basis,
    });
  }
  if (input.previewEnabled) {
    return Object.freeze({
      granted: true as const,
      mode: "preview" as const,
      basis: "preview-flag" as const,
    });
  }
  return Object.freeze({
    granted: false as const,
    reason: input.entitlement.reason,
    message: input.entitlement.message,
  });
}
