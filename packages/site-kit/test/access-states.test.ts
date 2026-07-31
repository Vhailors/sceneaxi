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
  SITE_LOGIN_PATH,
  SITE_REFUSALS,
  SITE_REFUSAL_REASONS,
  describeSiteAccessState,
} from "@sceneaxi/site-kit";

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

  it("falls back to a named state carrying the registry's own message", () => {
    const state = describeSiteAccessState("CATALOG_ITEM_NOT_FOUND");
    expect(state.key).toBe("refused");
    expect(state.body).toBe(SITE_REFUSALS.CATALOG_ITEM_NOT_FOUND);
  });
});
