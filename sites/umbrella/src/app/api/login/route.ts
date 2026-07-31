import type { NextRequest } from "next/server";
import { createUmbrellaIdentityPlane } from "../../../lib/identity-plane.js";
import { performLogin, resolveSessionCookieSecurity } from "../../../lib/login-flow.js";

/**
 * The hosted sign-in handler (sceneaxi#185).
 *
 * A thin translation over `performLogin`, which owns the whole decision: the
 * identity plane's login port authenticates through the deployment-supplied
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
  const form = await request.formData();
  const plane = createUmbrellaIdentityPlane(process.env, {});
  const outcome = await performLogin({
    plane,
    fields: {
      email: form.get("email"),
      password: form.get("password"),
      next: form.get("next"),
    },
    secure: resolveSessionCookieSecurity(process.env, {
      forwardedProto: request.headers.get("x-forwarded-proto"),
      requestUrl: request.url,
    }),
  });

  const headers = new Headers({ Location: outcome.location });
  if (outcome.kind === "success") {
    headers.set("Set-Cookie", outcome.setCookie);
  }
  return new Response(null, { status: 303, headers });
}
