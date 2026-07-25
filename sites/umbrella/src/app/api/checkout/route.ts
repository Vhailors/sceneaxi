import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { SITE_REFUSALS } from "@sceneaxi/site-kit";
import { createUmbrellaIdentityPlane } from "../../../lib/identity-plane.js";
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

  const origin = new URL(request.url).origin;
  const plane = createUmbrellaIdentityPlane(process.env);

  if (!plane.wired.billing) {
    return refusalResponse("BILLING_PLANE_NOT_WIRED", SITE_REFUSALS.BILLING_PLANE_NOT_WIRED);
  }

  const sessionToken = await readSessionToken();
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
    successUrl: `${origin}/account`,
    cancelUrl: `${origin}/pricing`,
    idempotencyKey: `pack:${packId}:user:${principal.value.user.userId}:attempt:${attempt}`,
  });
  if (!checkout.ok) {
    return refusalResponse(checkout.reason, checkout.message);
  }
  redirect(checkout.value.redirectUrl);
}
