import { cookies, headers } from "next/headers";
import {
  SITE_SESSION_COOKIE,
  SITE_SESSION_HEADER,
  resolveSiteSessionToken,
  type SiteFormOriginSignals,
  type SiteSessionCookieSecuritySignals,
} from "@sceneaxi/site-kit/site-session";

type RequestSignalSource = Readonly<{
  headers: Readonly<{ get(name: string): string | null }>;
  url: string;
}>;

export type SiteMutationRequestSignals = Readonly<{
  formOrigin: Omit<SiteFormOriginSignals, "configuredOrigin">;
  cookieSecurity: Omit<SiteSessionCookieSecuritySignals, "configuredOrigin">;
}>;

export function readSiteMutationRequestSignals(
  request: RequestSignalSource,
): SiteMutationRequestSignals {
  return Object.freeze({
    formOrigin: Object.freeze({
      origin: request.headers.get("origin"),
      fetchSite: request.headers.get("sec-fetch-site"),
      requestUrl: request.url,
    }),
    cookieSecurity: Object.freeze({
      forwardedProto: request.headers.get("x-forwarded-proto"),
      requestUrl: request.url,
    }),
  });
}

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
export async function readSessionToken(): Promise<string | null> {
  const headerStore = await headers();
  const cookieStore = await cookies();
  return resolveSiteSessionToken({
    header: headerStore.get(SITE_SESSION_HEADER),
    cookie: cookieStore.get(SITE_SESSION_COOKIE)?.value,
  });
}
