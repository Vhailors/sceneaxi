import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { createUmbrellaIdentityPlane } from "../../../lib/identity-plane.js";
import { readSessionToken } from "../../_session.js";

/**
 * Credit-pack checkout — the request-bound path that reaches `SiteBillingPort`.
 *
 * The pricing page submits the selected `packId` here; this handler resolves the
 * principal from the carried session token, asks the billing port to create a Stripe
 * TEST checkout, and redirects to the handoff URL it returns. Every refusal — an
 * unwired plane, an insecure URL, an unknown pack — is the port's own named reason,
 * never an invented checkout. While the billing plane is unwired this returns
 * `BILLING_PLANE_NOT_WIRED` (or the identity plane's own reason, whichever refuses
 * first), which needs no Stripe key to be correct.
 */
export const dynamic = "force-dynamic";

function refusalResponse(reason: string, message: string): Response {
  return NextResponse.json({ ok: false, reason, message }, { status: 402 });
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const packIdEntry = form.get("packId");
  const packId = typeof packIdEntry === "string" ? packIdEntry.trim() : "";

  const origin = new URL(request.url).origin;
  const plane = createUmbrellaIdentityPlane(process.env);
  const sessionToken = await readSessionToken();

  const principal = await plane.identity.resolvePrincipal({
    surface: "umbrella",
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
    idempotencyKey: `pack:${packId}:user:${principal.value.user.userId}`,
  });
  if (!checkout.ok) {
    return refusalResponse(checkout.reason, checkout.message);
  }
  redirect(checkout.value.redirectUrl);
}
