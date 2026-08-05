/**
 * The umbrella login flow's pure pieces (sceneaxi#185).
 *
 * `performLogin` / `performLogout` are proven end-to-end against the real
 * identity port in `identity-plane-wiring.test.ts`; this file pins the small
 * pure functions the route handlers and the login page lean on — destination
 * confinement, refusal-reason validation, and the refusal-redirect shape.
 */
import { describe, expect, it } from "vitest";
import {
  LOGIN_DEFAULT_DESTINATION,
  LOGIN_PATH,
  loginRefusalHref,
  loginRefusalOutcome,
  readLoginRefusalReason,
  resolveLoginDestination,
  verifyLoginRequestOrigin,
} from "../../sites/umbrella/src/index.ts";

describe("resolveLoginDestination", () => {
  it("keeps a same-site relative path", () => {
    expect(resolveLoginDestination("/editor")).toBe("/editor");
    expect(resolveLoginDestination("  /pricing  ")).toBe("/pricing");
    expect(resolveLoginDestination("/editor?objects=3")).toBe("/editor?objects=3");
    expect(
      resolveLoginDestination("/editor?html=%3Ch1%3EA+%26+B%3C%2Fh1%3E"),
    ).toBe("/editor?html=%3Ch1%3EA+%26+B%3C%2Fh1%3E");
    expect(resolveLoginDestination("/café/💥")).toBe("/caf%C3%A9/%F0%9F%92%A5");
  });

  it("survives the form round trip, which confines the same value twice", () => {
    for (const requested of [
      "/editor",
      "/editor?objects=3",
      "/editor?html=%3Ch1%3EA+%26+B%3C%2Fh1%3E",
      "/café/💥",
    ]) {
      const carried = resolveLoginDestination(requested);
      expect(resolveLoginDestination(carried)).toBe(carried);
    }
  });

  it("falls back to the default for anything that could leave this site", () => {
    for (const hostile of [
      undefined,
      null,
      42,
      "",
      "editor",
      "https://evil.example",
      "http://evil.example/",
      "//evil.example",
      "/\\evil.example",
      "/path\\segment",
      "/a/..//evil.example",
      "/%2e%2e//evil.example",
      "javascript:alert(1)",
      "/has space",
      "/line\nbreak",
    ]) {
      expect(resolveLoginDestination(hostile)).toBe(LOGIN_DEFAULT_DESTINATION);
    }
  });
});

describe("readLoginRefusalReason", () => {
  it("accepts only keys from the refusal registry", () => {
    expect(readLoginRefusalReason("LOGIN_CREDENTIALS_REJECTED")).toBe(
      "LOGIN_CREDENTIALS_REJECTED",
    );
    expect(readLoginRefusalReason("IDENTITY_PLANE_UNAVAILABLE")).toBe(
      "IDENTITY_PLANE_UNAVAILABLE",
    );
  });

  it("returns null for anything else, so a query value never becomes page copy", () => {
    for (const value of [undefined, null, 7, "", "NOT_A_REASON", "<script>", ["a"]]) {
      expect(readLoginRefusalReason(value)).toBeNull();
    }
  });
});

describe("loginRefusalHref", () => {
  it("sends a refused attempt back to the form with the named reason", () => {
    expect(loginRefusalHref("LOGIN_CREDENTIALS_REJECTED", LOGIN_DEFAULT_DESTINATION)).toBe(
      `${LOGIN_PATH}?reason=LOGIN_CREDENTIALS_REJECTED`,
    );
  });

  it("carries a non-default destination through the retry", () => {
    const href = loginRefusalHref("LOGIN_CREDENTIALS_REJECTED", "/editor");
    expect(href).toBe(`${LOGIN_PATH}?reason=LOGIN_CREDENTIALS_REJECTED&next=%2Feditor`);
  });
});

describe("loginRefusalOutcome", () => {
  it("shapes a refusal decided before the plane is reached, like a body that would not parse", () => {
    expect(loginRefusalOutcome("SITE_REQUEST_MALFORMED")).toEqual({
      kind: "refused",
      reason: "SITE_REQUEST_MALFORMED",
      location: `${LOGIN_PATH}?reason=SITE_REQUEST_MALFORMED`,
    });
  });

  it("confines the carried destination like every other refusal does", () => {
    expect(loginRefusalOutcome("SITE_REQUEST_MALFORMED", "https://evil.example").location).toBe(
      `${LOGIN_PATH}?reason=SITE_REQUEST_MALFORMED`,
    );
    expect(loginRefusalOutcome("SITE_REQUEST_MALFORMED", "/editor").location).toBe(
      `${LOGIN_PATH}?reason=SITE_REQUEST_MALFORMED&next=%2Feditor`,
    );
  });
});

describe("verifyLoginRequestOrigin", () => {
  const ENV = { NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN: "https://sceneaxi.example" };

  it("accepts the deployment's own pages", () => {
    expect(
      verifyLoginRequestOrigin(ENV, {
        origin: "https://sceneaxi.example",
        fetchSite: "same-origin",
        requestUrl: "https://sceneaxi.example/api/login",
      }),
    ).toEqual({ ok: true, value: "https://sceneaxi.example" });
  });

  it("refuses a cross-site submission, including one aimed at an alias host", () => {
    expect(
      verifyLoginRequestOrigin(ENV, {
        origin: "https://attacker.example",
        fetchSite: "cross-site",
        requestUrl: "https://sceneaxi.example/api/login",
      }),
    ).toMatchObject({ ok: false, reason: "SITE_REQUEST_CROSS_ORIGIN" });
    expect(
      verifyLoginRequestOrigin(ENV, {
        origin: "https://alias.vercel.app",
        requestUrl: "https://alias.vercel.app/api/login",
      }),
    ).toMatchObject({ ok: false, reason: "SITE_REQUEST_CROSS_ORIGIN" });
  });

  it("refuses a submission that proves nothing about where it came from", () => {
    expect(
      verifyLoginRequestOrigin(ENV, { requestUrl: "https://sceneaxi.example/api/logout" }),
    ).toMatchObject({ ok: false, reason: "SITE_REQUEST_CROSS_ORIGIN" });
    expect(verifyLoginRequestOrigin(ENV)).toMatchObject({
      ok: false,
      reason: "SITE_REQUEST_CROSS_ORIGIN",
    });
  });

  it("falls back to the request's own origin only on an unconfigured deployment", () => {
    for (const env of [{}, { NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN: "" }]) {
      expect(
        verifyLoginRequestOrigin(env, {
          origin: "http://localhost:3000",
          requestUrl: "http://localhost:3000/api/login",
        }),
      ).toEqual({ ok: true, value: "http://localhost:3000" });
    }
    expect(
      verifyLoginRequestOrigin(
        {},
        { origin: "https://attacker.example", requestUrl: "http://localhost:3000/api/login" },
      ),
    ).toMatchObject({ ok: false, reason: "SITE_REQUEST_CROSS_ORIGIN" });
  });

  it("refuses instead of falling back when a configured origin is invalid", () => {
    for (const configured of ["not-a-url", "http://sceneaxi.example", " ", "\t\n"]) {
      expect(
        verifyLoginRequestOrigin(
          { NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN: configured },
          {
            origin: "https://alias.vercel.app",
            requestUrl: "https://alias.vercel.app/api/login",
          },
        ),
      ).toMatchObject({ ok: false, reason: "SITE_REQUEST_CROSS_ORIGIN" });
    }
  });
});
