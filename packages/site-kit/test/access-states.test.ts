/**
 * Named access states: the projection from refusal reasons to designed outcomes.
 *
 * The property that matters is totality — every reason in the registry renders
 * as a named state with real copy, so no guarded surface can regress into an
 * unexplained refusal wall — plus the specific states the login mandate names:
 * signed-out, expired, disabled, Kids, and provider-unavailable each read as
 * themselves, not as each other.
 */
import { describe, expect, it } from "vitest";
import {
  SITE_LOGIN_HREF_MAX_LENGTH,
  SITE_LOGIN_PATH,
  SITE_REFUSALS,
  SITE_REFUSAL_REASONS,
  WEB_EXPERIENCE_REQUEST_TARGET_MAX_LENGTH,
  confineSiteRelativePath,
  describeSiteAccessState,
  siteLoginHref,
} from "@sceneaxi/site-kit";

const HOSTILE_DESTINATIONS = [
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
  "/nul\u0000byte",
  "/bell\u0007ring",
  "/shift\u000eout",
  "/unit\u001fseparator",
  "/delete\u007fchar",
];

describe("describeSiteAccessState", () => {
  it("is total over the refusal registry, with real copy for every reason", () => {
    for (const reason of SITE_REFUSAL_REASONS) {
      const state = describeSiteAccessState(reason);
      expect(state.reason).toBe(reason);
      expect(state.title.length).toBeGreaterThan(0);
      expect(state.body.length).toBeGreaterThan(0);
      expect(Object.isFrozen(state)).toBe(true);
    }
  });

  it("names the mandated access outcomes distinctly", () => {
    expect(describeSiteAccessState("IDENTITY_SESSION_ABSENT").key).toBe("signed-out");
    expect(describeSiteAccessState("EDITOR_ENTITLEMENT_ANONYMOUS").key).toBe("signed-out");
    expect(describeSiteAccessState("IDENTITY_SESSION_EXPIRED").key).toBe("session-expired");
    expect(describeSiteAccessState("IDENTITY_USER_DISABLED").key).toBe("user-disabled");
    expect(describeSiteAccessState("KIDS_SURFACE_DENIED").key).toBe("kids-denied");
    expect(describeSiteAccessState("IDENTITY_PLANE_UNAVAILABLE").key).toBe(
      "identity-unavailable",
    );
    expect(describeSiteAccessState("IDENTITY_PLANE_NOT_WIRED").key).toBe(
      "identity-not-wired",
    );
    expect(describeSiteAccessState("EDITOR_ENTITLEMENT_NO_CREDITS").key).toBe("no-credits");
    expect(describeSiteAccessState("LOGIN_CREDENTIALS_REJECTED").key).toBe(
      "credentials-rejected",
    );
  });

  it("separates an issuance fault from an untrusted browser credential", () => {
    const issuance = describeSiteAccessState("LOGIN_SESSION_NOT_ISSUED");
    const presented = describeSiteAccessState("IDENTITY_ADAPTER_OUTPUT_INVALID");
    expect(issuance.key).toBe("sign-in-not-issued");
    expect(presented.key).toBe("session-invalid");
    expect(issuance.title).not.toBe(presented.title);
    expect(issuance.body).not.toBe(presented.body);
    // Nothing the visitor can do resolves a provider that returns an unusable
    // session, so the issuance state must not dangle a sign-in action.
    expect(issuance.action).toBeNull();
  });

  it("names a submission from another site as one, with nothing to retry", () => {
    const state = describeSiteAccessState("SITE_REQUEST_CROSS_ORIGIN");
    expect(state.key).toBe("cross-origin");
    // The visitor did not do this, so the copy must not read as their mistake,
    // and there is no action here that would repeat the attempt.
    expect(state.key).not.toBe("credentials-rejected");
    expect(state.action).toBeNull();
  });

  it("offers sign-in exactly where signing in can change the outcome", () => {
    for (const reason of [
      "IDENTITY_SESSION_ABSENT",
      "IDENTITY_SESSION_EXPIRED",
      "IDENTITY_SESSION_SURFACE_MISMATCH",
    ] as const) {
      expect(describeSiteAccessState(reason).action).toEqual({
        label: "Sign in",
        href: SITE_LOGIN_PATH,
      });
    }
    // Signing in again cannot un-disable an account, un-deny Kids, or wire a
    // deployment, so none of these may dangle a sign-in action.
    for (const reason of [
      "IDENTITY_USER_DISABLED",
      "KIDS_SURFACE_DENIED",
      "IDENTITY_PLANE_NOT_WIRED",
      "IDENTITY_PLANE_UNAVAILABLE",
    ] as const) {
      expect(describeSiteAccessState(reason).action).toBeNull();
    }
    expect(describeSiteAccessState("EDITOR_ENTITLEMENT_NO_CREDITS").action).toEqual({
      label: "Buy credits",
      href: "/pricing",
    });
  });

  it("carries the refused surface as the sign-in destination", () => {
    // The whole point of the confined `next` machinery: a visitor bounced off a
    // guarded surface signs in and comes back to it, not to the generic default.
    expect(describeSiteAccessState("EDITOR_ENTITLEMENT_ANONYMOUS", { next: "/editor" }).action)
      .toEqual({ label: "Sign in", href: `${SITE_LOGIN_PATH}?next=%2Feditor` });
    expect(describeSiteAccessState("IDENTITY_SESSION_EXPIRED", { next: "/editor" }).action?.href)
      .toBe(`${SITE_LOGIN_PATH}?next=%2Feditor`);
    // A destination cannot resurrect an action the state does not offer.
    expect(describeSiteAccessState("IDENTITY_USER_DISABLED", { next: "/editor" }).action)
      .toBeNull();
  });

  it("drops a destination that could leave this site", () => {
    for (const hostile of HOSTILE_DESTINATIONS) {
      expect(siteLoginHref(hostile)).toBe(SITE_LOGIN_PATH);
      expect(describeSiteAccessState("IDENTITY_SESSION_ABSENT", { next: hostile }).action)
        .toEqual({ label: "Sign in", href: SITE_LOGIN_PATH });
    }
  });

  it("does not point the sign-in link back at the login page", () => {
    expect(siteLoginHref(SITE_LOGIN_PATH)).toBe(SITE_LOGIN_PATH);
    expect(siteLoginHref(`${SITE_LOGIN_PATH}?next=%2Feditor`)).toBe(SITE_LOGIN_PATH);
  });

  it("confines a destination to a same-site relative path", () => {
    expect(confineSiteRelativePath("/editor")).toBe("/editor");
    expect(confineSiteRelativePath("  /pricing  ")).toBe("/pricing");
    expect(confineSiteRelativePath("/editor?objects=3")).toBe("/editor?objects=3");
    expect(confineSiteRelativePath("/editor?html=%3Ch1%3EA+%26+B%3C%2Fh1%3E")).toBe(
      "/editor?html=%3Ch1%3EA+%26+B%3C%2Fh1%3E",
    );
    expect(confineSiteRelativePath("/café/💥")).toBe("/caf%C3%A9/%F0%9F%92%A5");
    expect(confineSiteRelativePath("/broken\ud800")).toBeNull();
    for (const hostile of HOSTILE_DESTINATIONS) {
      expect(confineSiteRelativePath(hostile)).toBeNull();
    }
  });

  it("confines an already-confined destination to itself", () => {
    for (const destination of [
      "/editor",
      "/editor?objects=3",
      "/café/💥",
      "/percent%sign",
      "/a%2Fb",
      "/editor?html=%3Ch1%3EA+%26+B%3C%2Fh1%3E",
    ]) {
      const once = confineSiteRelativePath(destination);
      expect(once).not.toBeNull();
      expect(confineSiteRelativePath(once)).toBe(once);
    }
  });

  it("judges an escaped destination by what its path decodes to", () => {
    expect(confineSiteRelativePath("/%2F%2Fevil.example")).toBeNull();
    expect(confineSiteRelativePath("/line%0Abreak")).toBeNull();
    expect(confineSiteRelativePath("/path%5Csegment")).toBeNull();
    expect(confineSiteRelativePath("%2Fevil.example")).toBeNull();
  });

  it("drops a continuation that would emit a link an edge answers instead of us", () => {
    // The sign-in link is the longest URL any guarded surface emits: the
    // destination is escaped a second time to ride as query data, so a target
    // near its own budget lands far larger here.
    expect(SITE_LOGIN_HREF_MAX_LENGTH).toBe(WEB_EXPERIENCE_REQUEST_TARGET_MAX_LENGTH);

    const target = `/editor?profile=web&web-html=${"%3Cp%3E".repeat(400)}`;
    expect(target.length).toBeLessThanOrEqual(SITE_LOGIN_HREF_MAX_LENGTH);
    expect(confineSiteRelativePath(target)).toBe(target);
    expect(
      `${SITE_LOGIN_PATH}?next=${encodeURIComponent(target)}`.length,
    ).toBeGreaterThan(SITE_LOGIN_HREF_MAX_LENGTH);
    expect(siteLoginHref(target)).toBe(SITE_LOGIN_PATH);

    // A destination that fits still carries, and every link this emits is bounded.
    const modest = "/editor?profile=web&web-html=%3Ch1%3EHello%3C%2Fh1%3E";
    expect(siteLoginHref(modest)).toBe(
      `${SITE_LOGIN_PATH}?next=${encodeURIComponent(modest)}`,
    );
    for (const candidate of [target, modest, `/editor?objects=${"9".repeat(9_000)}`]) {
      expect(siteLoginHref(candidate).length).toBeLessThanOrEqual(
        SITE_LOGIN_HREF_MAX_LENGTH,
      );
    }
  });

  it("carries an encoded multi-line document without ever emitting a raw break", () => {
    const destination = "/editor?profile=web&web-html=%3Ch1%3EA%3C%2Fh1%3E%0D%0A%3Cp%3EB%3C%2Fp%3E";
    expect(confineSiteRelativePath(destination)).toBe(destination);
    expect(siteLoginHref(destination)).toBe(
      `${SITE_LOGIN_PATH}?next=${encodeURIComponent(destination)}`,
    );
    // The emitted value keeps every break percent-encoded, so no header sees one.
    expect(confineSiteRelativePath(destination)).not.toMatch(/[\r\n\t\s]/);
    // A literal break is still not a destination, wherever it appears.
    expect(confineSiteRelativePath("/editor?web-html=a\r\nb")).toBeNull();
    expect(confineSiteRelativePath("/editor\r\nSet-Cookie: x=1")).toBeNull();
  });

  it("falls back to a named state carrying the registry's own message", () => {
    const state = describeSiteAccessState("CATALOG_ITEM_NOT_FOUND");
    expect(state.key).toBe("refused");
    expect(state.body).toBe(SITE_REFUSALS.CATALOG_ITEM_NOT_FOUND);
  });
});
