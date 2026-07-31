import type { NextRequest } from "next/server";
import { createUmbrellaIdentityPlane } from "../../../lib/identity-plane.js";
import { performLogout } from "../../../lib/login-flow.js";
import { readSessionToken } from "../../_session.js";

/**
 * Sign the carried session out.
 *
 * The browser's cookie is cleared unconditionally; the stored session is
 * deleted through the identity port when the plane can reach it, and an
 * unreachable store still signs the browser out rather than holding it
 * hostage to a server-side fault. 303 because this answers a form POST.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const sessionToken = await readSessionToken();
  const plane = createUmbrellaIdentityPlane(process.env, { sessionToken });
  const outcome = await performLogout({
    plane,
    secure: new URL(request.url).protocol === "https:",
  });

  return new Response(null, {
    status: 303,
    headers: new Headers({
      Location: outcome.location,
      "Set-Cookie": outcome.clearCookie,
    }),
  });
}
