import { cookies, headers } from "next/headers";
import {
  SITE_SESSION_COOKIE,
  SITE_SESSION_HEADER,
  resolveSiteSessionToken,
} from "@sceneaxi/site-kit/site-session";

/**
 * Read the opaque session token a signed-in browser carries.
 *
 * Request plumbing only, and identical to the umbrella's: it reads the cookie or header
 * the identity plane issues and forwards it verbatim as `sessionToken`. It implements no
 * authentication and no role logic. A storefront is a reader of identity, so this is the
 * only place it touches a session credential at all.
 */
export async function readSessionToken(): Promise<string | null> {
  const headerStore = await headers();
  const cookieStore = await cookies();
  return resolveSiteSessionToken({
    header: headerStore.get(SITE_SESSION_HEADER),
    cookie: cookieStore.get(SITE_SESSION_COOKIE)?.value,
  });
}
