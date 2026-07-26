import { NextResponse, type NextRequest } from "next/server";
import {
  STRIPE_SIGNATURE_HEADER,
  STRIPE_WEBHOOK_SECRET_ENV,
  applyCreditPackWebhook,
} from "../../../../lib/credit-webhook.js";
import { umbrellaPlaneHandles } from "../../../../lib/identity-plane.js";

/**
 * The Stripe credit-pack webhook endpoint.
 *
 * A thin transport adapter: it reads the **raw** body, hands it to
 * `applyCreditPackWebhook`, and turns that outcome into a status. Re-serialising the
 * body would invalidate the signature, which is exactly why `request.text()` is used
 * and no framework body parser is involved.
 *
 * Failures answer non-2xx with the plane's own named reason, so Stripe retries a
 * genuinely unprocessed event and this endpoint never reports success for a body it
 * did not honour. A *replayed* event is a success — the credits are already in the
 * ledger — because Stripe delivers at least once by design.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { creditStore, checkoutEvidence } = umbrellaPlaneHandles();
  if (creditStore === undefined || checkoutEvidence === undefined) {
    return NextResponse.json(
      {
        ok: false,
        reason: "CREDITS_PLANE_NOT_WIRED",
        message:
          "No credit store or checkout evidence is wired on this deployment, so a paid event cannot be settled. Nothing was granted.",
      },
      { status: 503 },
    );
  }

  const outcome = await applyCreditPackWebhook({
    payload: await request.text(),
    signatureHeader: request.headers.get(STRIPE_SIGNATURE_HEADER),
    secret: process.env[STRIPE_WEBHOOK_SECRET_ENV],
    store: creditStore,
    evidence: checkoutEvidence,
    now: Date.now(),
  });

  if (!outcome.ok) {
    return NextResponse.json(
      { ok: false, reason: outcome.reason, message: outcome.message },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, replayed: outcome.replayed }, { status: 200 });
}
