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
 * Contract owners: `docs/websites-deploy.md` (activation, env names) and
 * `docs/auth-credits.md` (refusal ordering); the boundary is ADR 0021's 2026-08-01
 * clarification.
 */
import {
  IDENTITY_PLANE_DOC,
  IDENTITY_PLANE_PENDING_NOTE,
  BILLING_PLANE_PENDING_NOTE,
  createUmbrellaIdentityPlane,
  umbrellaPlaneHandles,
  type UmbrellaIdentityPlane,
} from "./identity-plane.js";
import {
  CREDIT_WEBHOOK_REASONS,
  STRIPE_SIGNATURE_HEADER,
  creditWebhookHttpStatus,
  type CreditWebhookOutcome,
} from "./credit-webhook.js";

export {
  BILLING_PLANE_PENDING_NOTE,
  IDENTITY_PLANE_DOC,
  IDENTITY_PLANE_PENDING_NOTE,
  STRIPE_SIGNATURE_HEADER,
  creditWebhookHttpStatus,
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
  applyCreditWebhook(request: UmbrellaWebhookRequestEvidence): Promise<CreditWebhookOutcome>;
}>;

let requestAuthority: UmbrellaRequestAuthority | undefined;

export function umbrellaRequestAuthority(): UmbrellaRequestAuthority {
  if (requestAuthority !== undefined) return requestAuthority;
  const deployment = umbrellaPlaneHandles();
  requestAuthority = Object.freeze({
    plane(request = {}) {
      return createUmbrellaIdentityPlane(
        {},
        {
          deployment,
          ...(request.sessionToken === undefined
            ? {}
            : { sessionToken: request.sessionToken }),
        },
      );
    },
    async applyCreditWebhook(request) {
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
