import { cookies, headers } from "next/headers";

/**
 * Read the opaque session token a signed-in browser carries.
 *
 * This is request plumbing only: it reads the cookie or header the identity plane
 * (sceneaxi-auth-credits-v1) issues and forwards it verbatim as `sessionToken` on the
 * `SiteIdentityRequest`. It implements no authentication and no role logic — the port
 * still refuses while unwired. Carrying the token here is what lets the documented
 * single-file identity activation (`src/lib/identity-plane.ts`) actually see a session
 * once an adapter is wired, without any other route change.
 */
const SESSION_COOKIE = "sceneaxi.session";
const SESSION_HEADER = "x-sceneaxi-session";

export async function readSessionToken(): Promise<string | null> {
  const headerStore = await headers();
  const fromHeader = headerStore.get(SESSION_HEADER);
  if (fromHeader !== null && fromHeader.trim().length > 0) return fromHeader.trim();
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (fromCookie !== undefined && fromCookie.trim().length > 0) return fromCookie.trim();
  return null;
}
