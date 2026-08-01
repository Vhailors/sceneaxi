import type { NextRequest } from "next/server";
import { createUmbrellaDeploymentPlane } from "../../../lib/identity-plane.js";
import {
  loginRefusalOutcome,
  performLogin,
  resolveSessionCookieSecurity,
  verifyLoginRequestOrigin,
} from "../../../lib/login-flow.js";
import { readSiteMutationRequestSignals } from "../../_session.js";

/**
 * The hosted sign-in handler (sceneaxi#185).
 *
 * A thin translation over `performLogin`, which owns the whole decision: the
 * submission must prove it came from this deployment's own pages, the identity
 * plane's login port then authenticates through the deployment-supplied
 * provider, every refusal redirects back to the form carrying the plane's own
 * named reason, and success sets the one HttpOnly session cookie. The redirect
 * `Location` is always a same-site relative path — `performLogin` confines the
 * form's `next` — so no request header can point this handler off-site.
 *
 * 303 See Other on every outcome: this answers a form POST, and the browser
 * must navigate, not re-POST the credentials at the destination.
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

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response(null, {
      status: 303,
      headers: new Headers({
        Location: loginRefusalOutcome("SITE_REQUEST_MALFORMED").location,
      }),
    });
  }

  const plane = createUmbrellaDeploymentPlane();
  const outcome = await performLogin({
    plane,
    requestOrigin,
    fields: {
      email: form.get("email"),
      password: form.get("password"),
      next: form.get("next"),
    },
    secure: resolveSessionCookieSecurity(process.env, signals.cookieSecurity),
  });

  const headers = new Headers({ Location: outcome.location });
  if (outcome.kind === "success") {
    headers.set("Set-Cookie", outcome.setCookie);
  }
  return new Response(null, { status: 303, headers });
}
