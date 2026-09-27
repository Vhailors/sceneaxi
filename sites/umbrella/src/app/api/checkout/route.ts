import { NextResponse, type NextRequest } from "next/server";
import { SITE_REFUSALS, resolveCheckoutRedirectOrigin } from "@sceneaxi/site-kit";
import { umbrellaRequestAuthority } from "../../../lib/request-authority.js";
import { readSessionToken, readSiteMutationRequestSignals } from "../../_session.js";
import { verifyLoginRequestOrigin } from "../../../lib/login-flow.js";
import { serverLog } from "../../../lib/server-logger.js";

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

function refusalResponse(request: NextRequest, reason: string, message: string): Response {
  serverLog("warn", "umbrella.checkout.refused", { reason });
  if (request.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json({ ok: false, reason, message }, { status: 402 });
  }

  // A same-site relative `Location`, as the login flow answers: nothing here is derived
  // from the request's own host.
  const signedOut = reason === "IDENTITY_SESSION_ABSENT";
  const query = new URLSearchParams(signedOut ? { next: "/pricing", reason } : { reason });

  return new Response(null, {
    status: 303,
    headers: { Location: `${signedOut ? "/login" : "/pricing"}?${query.toString()}` },
  });
}

export async function POST(request: NextRequest) {
  // The same same-origin form proof login, logout, and catalog intake require:
  // `SameSite=Lax` still sends the session cookie on a cross-site top-level POST.
  const signals = readSiteMutationRequestSignals(request);
  const requestOrigin = verifyLoginRequestOrigin(process.env, signals.formOrigin);

  if (!requestOrigin.ok) {
    return refusalResponse(
      request,
      requestOrigin.reason,
      SITE_REFUSALS[requestOrigin.reason],
    );
  }

  const form = await request.formData();
  const packIdEntry = form.get("packId");

  const packId =
    packIdEntry === null || packIdEntry instanceof File ? "" : packIdEntry.trim();

  const attemptEntry = form.get("attempt");

  const attempt =
    attemptEntry === null || attemptEntry instanceof File ? "" : attemptEntry.trim();

  if (!/^[A-Za-z0-9_-]{16,128}$/.test(attempt)) {
    return refusalResponse(
      request,
      "BILLING_CHECKOUT_REQUEST_INVALID",
      SITE_REFUSALS.BILLING_CHECKOUT_REQUEST_INVALID,
    );
  }

  // The plane is bound to this request's session credential, so the billing port
  // authorizes the purchase against the session the server verified rather than
  // against the user id this form submitted.
  const sessionToken = await readSessionToken();
  const plane = umbrellaRequestAuthority().plane({ sessionToken });

  if (!plane.wired.billing) {
    return refusalResponse(request, "BILLING_PLANE_NOT_WIRED", SITE_REFUSALS.BILLING_PLANE_NOT_WIRED);
  }

  // Redirect targets come from the deployment's configured umbrella origin, never from
  // this request's `Host`: a forwarded or aliased host must not be able to point the
  // payment provider's post-payment redirect away from SceneAxi. Resolved after the
  // wiring check, so an unwired deployment is not misdiagnosed as a misconfigured origin.
  const origin = resolveCheckoutRedirectOrigin(process.env, new URL(request.url).origin);

  if (!origin.ok) {
    return refusalResponse(request, origin.reason, origin.message);
  }

  const principal = await plane.identity.resolvePrincipal({
    surface: "site",
    sessionToken,
  });

  if (!principal.ok) {
    return refusalResponse(request, principal.reason, principal.message);
  }

  const checkout = await plane.billing.createCheckout({
    userId: principal.value.user.userId,
    packId,
    successUrl: `${origin.value}/account?checkout=success`,
    cancelUrl: `${origin.value}/pricing?checkout=cancelled`,
    idempotencyKey: `pack:${packId}:user:${principal.value.user.userId}:attempt:${attempt}`,
  });

  if (!checkout.ok) {
    return refusalResponse(request, checkout.reason, checkout.message);
  }

  // 303 See Other, never 307: this handler answers a form POST, and a method-preserving
  // redirect would re-issue that POST against the hosted checkout URL instead of
  // navigating the buyer to it. The billing port has already proven the URL is https.
  return NextResponse.redirect(checkout.value.redirectUrl, 303);
}
