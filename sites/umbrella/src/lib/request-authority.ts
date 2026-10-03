/**
 * The request-facing facade over the deployment-owned authority.
 *
 * `identity-plane.ts` resolves the server environment once and holds the issued admin
 * identity, the provider handles, and the secret-closing webhook capability. This module
 * is the only way request code reaches any of it, and it takes no arguments: a route or
 * page may supply a carried session credential, and the webhook route may supply raw
 * bytes plus the signature header — never an environment, issuer, store, clock, or
 * secret. That is what keeps deployment authority unforgeable from a request, and
 * `pnpm check:boundaries` refuses any other importer of the owner modules.
 *
 * The registry is resolved once and memoised, so a deployment's provider clients are
 * built at most once per server process rather than per request.
 *
 * Contract owners: `docs/websites-deploy.md` (wiring mechanics, env names),
 * `docs/production-activation.md` (ordered activation and rollback), and
 * `docs/auth-credits.md` (refusal ordering); the boundary is ADR 0021's 2026-08-01
 * clarification.
 */
import { type SiteFormOriginSignals, type SiteResult } from "@sceneaxi/site-kit";
import {
  IDENTITY_PLANE_DOC,
  IDENTITY_PLANE_PENDING_NOTE,
  BILLING_PLANE_PENDING_NOTE,
  classifyUmbrellaPlane,
  createUmbrellaIdentityPlane,
  umbrellaPlaneHandles,
  verifyUmbrellaDeploymentFormOrigin,
  type UmbrellaIdentityPlane,
  type IdentityPlaneWiring,
} from "./identity-plane.js";
import {
  CREDIT_WEBHOOK_REASONS,
  STRIPE_SIGNATURE_HEADER,
  creditWebhookHttpStatus,
  creditWebhookOutcomeHttpStatus,
  type CreditWebhookOutcome,
} from "./credit-webhook.js";

export {
  BILLING_PLANE_PENDING_NOTE,
  IDENTITY_PLANE_DOC,
  IDENTITY_PLANE_PENDING_NOTE,
  STRIPE_SIGNATURE_HEADER,
  creditWebhookHttpStatus,
  creditWebhookOutcomeHttpStatus,
};

export type UmbrellaRequestEvidence = Readonly<{
  readonly sessionToken?: string | null | undefined;
}>;

export type UmbrellaWebhookRequestEvidence = Readonly<{
  readonly payload: string;
  readonly signatureHeader: string | null;
}>;

export type UmbrellaRequestAuthority = Readonly<{
  plane(request?: UmbrellaRequestEvidence): UmbrellaIdentityPlane;
  verifyFormOrigin(signals: Omit<SiteFormOriginSignals, "configuredOrigin">): SiteResult<string>;
  health(): Readonly<{
    planes: Readonly<{ identity: "wired" | "absent" | "misconfigured"; credits: "wired" | "absent" | "misconfigured"; billing: "wired" | "absent" | "misconfigured" }>;
  }>;
  applyCreditWebhook(request: UmbrellaWebhookRequestEvidence): Promise<CreditWebhookOutcome>;
}>;

type RequestPlaneWiring = { -readonly [Key in keyof IdentityPlaneWiring]: IdentityPlaneWiring[Key] };

let requestAuthority: UmbrellaRequestAuthority | undefined;

export function umbrellaRequestAuthority(): UmbrellaRequestAuthority {
  if (requestAuthority !== undefined) return requestAuthority;

  requestAuthority = Object.freeze({
    verifyFormOrigin(signals) {
      return verifyUmbrellaDeploymentFormOrigin(signals);
    },
    health() {
      const deployment = umbrellaPlaneHandles();
      const configuration = deployment.configuration;

      return Object.freeze({
        planes: Object.freeze({
          identity: classifyUmbrellaPlane(configuration, ["DATABASE_URL", "BETTER_AUTH_ORIGIN", "BETTER_AUTH_SECRET", "SCENEAXI_ADMIN_EMAIL", "SCENEAXI_ADMIN_BOOTSTRAP_SECRET"], deployment.identityPort !== undefined),
          credits: classifyUmbrellaPlane(configuration, ["DATABASE_URL", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], deployment.creditStore !== undefined && deployment.creditWebhook !== undefined),
          billing: classifyUmbrellaPlane(configuration, ["DATABASE_URL", "STRIPE_SECRET_KEY", "SCENEAXI_BILLING_MODE", "NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN"], deployment.checkoutSessions !== undefined),
        }),
      });
    },
    plane(request = {}) {
      const deployment = umbrellaPlaneHandles();

      const options: RequestPlaneWiring = { deployment };

      if (request.sessionToken !== undefined) options.sessionToken = request.sessionToken;

      return createUmbrellaIdentityPlane({}, options);
    },
    async applyCreditWebhook(request) {
      const deployment = umbrellaPlaneHandles();

      if (deployment.creditWebhook === undefined) {
        return Object.freeze({
          ok: false as const,
          reason: CREDIT_WEBHOOK_REASONS.planeNotWired,
          message:
            "No deployment-owned webhook capability is wired, so a paid event cannot be verified or settled. Nothing was granted.",
        });
      }

      return deployment.creditWebhook.apply(request);
    },
  });

  return requestAuthority;
}

export type { UmbrellaIdentityPlane };
