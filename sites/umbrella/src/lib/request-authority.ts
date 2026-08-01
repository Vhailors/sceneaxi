import {
  IDENTITY_PLANE_DOC,
  IDENTITY_PLANE_PENDING_NOTE,
  BILLING_PLANE_PENDING_NOTE,
  createUmbrellaIdentityPlane,
  umbrellaPlaneHandles,
  type UmbrellaIdentityPlane,
} from "./identity-plane.js";
import {
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
          reason: "CREDITS_PLANE_NOT_WIRED",
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
