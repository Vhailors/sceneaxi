import type { NextRequest } from "next/server";
import { umbrellaRequestAuthority } from "../../../lib/request-authority.js";
import {
  loginRefusalOutcome,
  performLogout,
  resolveSessionCookieSecurity,
  verifyLoginRequestOrigin,
} from "../../../lib/login-flow.js";
import {
  readSessionToken,
  readSiteMutationRequestSignals,
} from "../../_session.js";

/**
 * Sign the carried session out.
 *
 * The browser's cookie is cleared unconditionally; the stored session is
 * deleted through the identity port when the plane can reach it, and an
 * unreachable store still signs the browser out rather than holding it
 * hostage to a server-side fault. 303 because this answers a form POST.
 *
 * A submission that cannot prove it came from this deployment's own pages is
 * refused by `performLogout` before the port is reached, so another site cannot
 * force a visitor's session out; that outcome carries no clearing cookie.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const signals = readSiteMutationRequestSignals(request);
  const requestOrigin = verifyLoginRequestOrigin(process.env, signals.formOrigin);
  if (!requestOrigin.ok) {
    return new Response(null, {
      status: 303,
      headers: new Headers({
        Location: loginRefusalOutcome(requestOrigin.reason).location,
      }),
    });
  }

  const sessionToken = await readSessionToken();
  const plane = umbrellaRequestAuthority().plane({ sessionToken });
  const outcome = await performLogout({
    plane,
    requestOrigin,
    secure: resolveSessionCookieSecurity(process.env, signals.cookieSecurity),
  });

  const headers = new Headers({ Location: outcome.location });
  if (outcome.kind === "signed-out") headers.set("Set-Cookie", outcome.clearCookie);
  return new Response(null, { status: 303, headers });
}
