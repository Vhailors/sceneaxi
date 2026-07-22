import { describe, expect, it } from "vitest";
import {
  WEB_EXPERIENCE_REFUSED_SCOPES,
  WEB_EXPERIENCE_SCOPES,
  evaluateWebExperienceScope,
  policy,
} from "@sceneaxi/profile-web";

describe("@sceneaxi/profile-web compiled policy", () => {
  it.each(WEB_EXPERIENCE_SCOPES)("allows locked scope %s", (scope) => {
    expect(evaluateWebExperienceScope(scope)).toEqual({ ok: true, scope });
  });

  it.each(WEB_EXPERIENCE_REFUSED_SCOPES)(
    "refuses neighboring product scope %s",
    (scope) => {
      expect(evaluateWebExperienceScope(scope)).toMatchObject({
        ok: false,
        requestedScope: scope,
        reason: "OUTSIDE_WEB_EXPERIENCE_SCOPE",
      });
    },
  );

  it("refuses unknown and malformed scopes fail-closed", () => {
    expect(evaluateWebExperienceScope("website-builder")).toMatchObject({
      ok: false,
      reason: "UNKNOWN_WEB_EXPERIENCE_SCOPE",
    });
    expect(evaluateWebExperienceScope(undefined)).toMatchObject({
      ok: false,
      requestedScope: null,
      reason: "UNKNOWN_WEB_EXPERIENCE_SCOPE",
    });
  });

  it("exposes an immutable, refuse-by-default policy", () => {
    expect(policy.defaultDecision).toBe("refuse");
    expect(Object.isFrozen(policy)).toBe(true);
    expect(Object.isFrozen(policy.scopes)).toBe(true);
    expect(Object.isFrozen(policy.refusedScopes)).toBe(true);
  });
});
