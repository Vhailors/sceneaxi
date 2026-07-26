import { cookies, headers } from "next/headers";

/**
 * Read the opaque session token a signed-in browser carries.
 *
 * Request plumbing only, and identical to the umbrella's: it reads the cookie or header
 * the identity plane issues and forwards it verbatim as `sessionToken`. It implements no
 * authentication and no role logic. A storefront is a reader of identity, so this is the
 * only place it touches a session credential at all.
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
