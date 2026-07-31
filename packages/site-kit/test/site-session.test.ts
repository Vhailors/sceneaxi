import { describe, expect, it } from "vitest";
import {
  SITE_SESSION_COOKIE,
  SITE_SESSION_HEADER,
  buildSiteSessionCookie,
  clearSiteSessionCookie,
  resolveSiteSessionCookieSecurity,
  resolveSiteSessionToken,
} from "@sceneaxi/site-kit/site-session";

describe("shared site session token", () => {
  it("publishes the one header and cookie vocabulary", () => {
    expect(SITE_SESSION_HEADER).toBe("x-sceneaxi-session");
    expect(SITE_SESSION_COOKIE).toBe("sceneaxi.session");
  });

  it("prefers and trims the header token", () => {
    expect(resolveSiteSessionToken({ header: "  header-token  ", cookie: "cookie-token" })).toBe(
      "header-token",
    );
  });

  it("falls back to the cookie when the header is absent or empty", () => {
    expect(resolveSiteSessionToken({ cookie: " cookie-token " })).toBe("cookie-token");
    expect(resolveSiteSessionToken({ header: "  ", cookie: "cookie-token" })).toBe(
      "cookie-token",
    );
  });

  it("returns null when neither source carries a token", () => {
    expect(resolveSiteSessionToken({})).toBeNull();
    expect(resolveSiteSessionToken({ header: "", cookie: "  " })).toBeNull();
  });
});

describe("session cookie construction", () => {
  const EXPIRES = "2026-07-25T13:00:00.000Z";

  it("builds an HttpOnly, Lax cookie bound to the session's own expiry", () => {
    const header = buildSiteSessionCookie({
      credential: "session-1.tok-crew",
      expiresAt: EXPIRES,
      secure: true,
    });
    expect(header).toBe(
      "sceneaxi.session=session-1.tok-crew; Path=/; HttpOnly; SameSite=Lax; " +
        "Expires=Sat, 25 Jul 2026 13:00:00 GMT; Secure",
    );
  });

  it("omits Secure only when the response is not https", () => {
    const header = buildSiteSessionCookie({
      credential: "session-1.tok-crew",
      expiresAt: EXPIRES,
      secure: false,
    });
    expect(header).not.toContain("Secure");
    expect(header).toContain("HttpOnly");
  });

  it("refuses a credential or expiry a cookie cannot faithfully carry", () => {
    for (const credential of ["", "has space", "semi;colon", 'quo"te', "back\\slash"]) {
      expect(
        buildSiteSessionCookie({ credential, expiresAt: EXPIRES, secure: true }),
      ).toBeNull();
    }
    expect(
      buildSiteSessionCookie({
        credential: "session-1.tok",
        expiresAt: "not a date",
        secure: true,
      }),
    ).toBeNull();
  });

  it("reads Secure from the configured origin, not from the request the app sees", () => {
    // The proxy terminated TLS, so the app's own request is plain http.
    expect(
      resolveSiteSessionCookieSecurity({
        configuredOrigin: "https://sceneaxi.example",
        forwardedProto: "http",
        requestUrl: "http://10.0.0.4:3000/api/login",
      }),
    ).toBe(true);
    expect(
      resolveSiteSessionCookieSecurity({
        configuredOrigin: "http://localhost:3000",
        requestUrl: "https://sceneaxi.example/api/login",
      }),
    ).toBe(false);
  });

  it("falls back to the forwarded protocol, then to the request, when no origin is configured", () => {
    expect(
      resolveSiteSessionCookieSecurity({
        forwardedProto: "https,http",
        requestUrl: "http://10.0.0.4:3000/api/login",
      }),
    ).toBe(true);
    expect(
      resolveSiteSessionCookieSecurity({
        configuredOrigin: "not a url",
        forwardedProto: "  ",
        requestUrl: "https://sceneaxi.example/api/login",
      }),
    ).toBe(true);
    expect(
      resolveSiteSessionCookieSecurity({ requestUrl: "http://localhost:3000/api/login" }),
    ).toBe(false);
    expect(resolveSiteSessionCookieSecurity({})).toBe(false);
  });

  it("clears with an expired empty value on the same name and path", () => {
    const header = clearSiteSessionCookie({ secure: true });
    expect(header).toContain(`${SITE_SESSION_COOKIE}=;`);
    expect(header).toContain("Max-Age=0");
    expect(header).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    expect(header).toContain("Secure");
    expect(clearSiteSessionCookie({ secure: false })).not.toContain("Secure");
  });
});
