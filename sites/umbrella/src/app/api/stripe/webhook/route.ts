import { NextResponse, type NextRequest } from "next/server";
import {
  STRIPE_SIGNATURE_HEADER,
  creditWebhookOutcomeHttpStatus,
  umbrellaRequestAuthority,
} from "../../../../lib/request-authority.js";

/**
 * The Stripe credit-pack webhook endpoint.
 *
 * A thin transport adapter: it reads the **raw** body, hands it to the deployment-owned
 * webhook capability, and turns that outcome into a status. Re-serialising the body
 * would invalidate the signature, which is exactly why `request.text()` is used and no
 * framework body parser is involved. The signing secret never enters this route.
 *
 * Failures answer non-2xx with the plane's own named reason, so Stripe retries a
 * genuinely unprocessed event and this endpoint never reports success for a body it
 * did not honour. A *replayed* event is a success — the credits are already in the
 * ledger — because Stripe delivers at least once by design. An event this endpoint is
 * not built to act on is also a success, carrying `ignored: true` and its reason: no
 * grant is owed, and retrying it forever would only wear down the endpoint's health.
 *
 * Which non-2xx is a diagnostic, not a retry decision: `creditWebhookOutcomeHttpStatus` answers
 * 503 for the refusals this deployment owns — an unwired webhook capability included —
 * and 400 for the ones the request owns, so a forged signature and an unreachable
 * database are distinguishable in the provider dashboard and in status-code alerting.
 * That decision has exactly one owner; this route classifies no reason itself.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const outcome = await umbrellaRequestAuthority().applyCreditWebhook({
    payload: await request.text(),
    signatureHeader: request.headers.get(STRIPE_SIGNATURE_HEADER),
  });

  if (!outcome.ok) {
    return NextResponse.json(
      { ok: false, reason: outcome.reason, message: outcome.message },
      { status: creditWebhookOutcomeHttpStatus(outcome) },
    );
  }
  if (outcome.ignored) {
    return NextResponse.json(
      { ok: true, ignored: true, reason: outcome.reason, message: outcome.message },
      { status: creditWebhookOutcomeHttpStatus(outcome) },
    );
  }
  return NextResponse.json(
    { ok: true, ignored: false, replayed: outcome.replayed },
    { status: creditWebhookOutcomeHttpStatus(outcome) },
  );
}
