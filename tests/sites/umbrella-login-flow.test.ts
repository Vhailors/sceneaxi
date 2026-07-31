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
  readLoginRefusalReason,
  resolveLoginDestination,
} from "../../sites/umbrella/src/index.ts";

describe("resolveLoginDestination", () => {
  it("keeps a same-site relative path", () => {
    expect(resolveLoginDestination("/editor")).toBe("/editor");
    expect(resolveLoginDestination("  /pricing  ")).toBe("/pricing");
    expect(resolveLoginDestination("/editor?objects=3")).toBe("/editor?objects=3");
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
