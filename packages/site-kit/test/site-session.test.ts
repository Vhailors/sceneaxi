import { describe, expect, it } from "vitest";
import {
  SITE_SESSION_COOKIE,
  SITE_SESSION_HEADER,
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
