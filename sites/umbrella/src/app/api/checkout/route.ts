import { NextResponse, type NextRequest } from "next/server";
import { SITE_REFUSALS, resolveCheckoutRedirectOrigin } from "@sceneaxi/site-kit";
import { createUmbrellaDeploymentPlane } from "../../../lib/identity-plane.js";
import { readSessionToken } from "../../_session.js";

/**
 * Credit-pack checkout — the request-bound path that reaches `SiteBillingPort`.
 *
 * The pricing page submits the selected `packId` and a per-render attempt token here;
 * this handler resolves the principal from the carried session token, asks the billing
 * port to create a Stripe TEST checkout, and redirects to the handoff URL it returns.
 * Every refusal — an unwired plane, an insecure URL, an unknown pack — is the port's own
 * named reason, never an invented checkout.
 *
 * The billing plane's own refusal is diagnosed first: an all-unwired deployment returns
 * `BILLING_PLANE_NOT_WIRED`, the named reason for the capability being attempted, rather
 * than the identity plane's. Identity is still resolved before a real checkout is created;
 * only the unwired-diagnosis order changes so the reason matches the capability.
 */
export const dynamic = "force-dynamic";

function refusalResponse(reason: string, message: string): Response {
  return NextResponse.json({ ok: false, reason, message }, { status: 402 });
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const packIdEntry = form.get("packId");
  const packId = typeof packIdEntry === "string" ? packIdEntry.trim() : "";
  const attemptEntry = form.get("attempt");
  const attempt =
    typeof attemptEntry === "string" && attemptEntry.trim().length > 0
      ? attemptEntry.trim()
      : crypto.randomUUID();

  // The plane is bound to this request's session credential, so the billing port
  // authorizes the purchase against the session the server verified rather than
  // against the user id this form submitted.
  const sessionToken = await readSessionToken();
  const plane = createUmbrellaDeploymentPlane({ sessionToken });

  if (!plane.wired.billing) {
    return refusalResponse("BILLING_PLANE_NOT_WIRED", SITE_REFUSALS.BILLING_PLANE_NOT_WIRED);
  }

  // Redirect targets come from the deployment's configured umbrella origin, never from
  // this request's `Host`: a forwarded or aliased host must not be able to point the
  // payment provider's post-payment redirect away from SceneAxi. Resolved after the
  // wiring check, so an unwired deployment is not misdiagnosed as a misconfigured origin.
  const origin = resolveCheckoutRedirectOrigin(process.env, new URL(request.url).origin);
  if (!origin.ok) {
    return refusalResponse(origin.reason, origin.message);
  }

  const principal = await plane.identity.resolvePrincipal({
    surface: "site",
    sessionToken,
  });
  if (!principal.ok) {
    return refusalResponse(principal.reason, principal.message);
  }

  const checkout = await plane.billing.createCheckout({
    userId: principal.value.user.userId,
    packId,
    successUrl: `${origin.value}/account`,
    cancelUrl: `${origin.value}/pricing`,
    idempotencyKey: `pack:${packId}:user:${principal.value.user.userId}:attempt:${attempt}`,
  });
  if (!checkout.ok) {
    return refusalResponse(checkout.reason, checkout.message);
  }
  // 303 See Other, never 307: this handler answers a form POST, and a method-preserving
  // redirect would re-issue that POST against the hosted checkout URL instead of
  // navigating the buyer to it. The billing port has already proven the URL is https.
  return NextResponse.redirect(checkout.value.redirectUrl, 303);
}
