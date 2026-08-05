import { describe, expect, it } from "vitest";
import {
  WEB_EXPERIENCE_AUTHORING_OPERATIONS,
  WEB_EXPERIENCE_DESKTOP_ONLY_OPERATIONS,
  WEB_EXPERIENCE_SANDBOX_POLICY,
  evaluateWebExperienceAuthoringOperation,
  webExperienceAuthoring,
} from "@sceneaxi/profile-web";

describe("the Web Experience authoring subset", () => {
  it("exposes only page, HTML, site-canvas, asset, and safe Three operations", () => {
    expect(WEB_EXPERIENCE_AUTHORING_OPERATIONS).toEqual([
      "page.set-html",
      "site-canvas.configure",
      "asset.inject",
      "three.embed",
    ]);
    expect(webExperienceAuthoring.operations).toBe(WEB_EXPERIENCE_AUTHORING_OPERATIONS);
    expect(Object.isFrozen(WEB_EXPERIENCE_AUTHORING_OPERATIONS)).toBe(true);
    expect(Object.isFrozen(webExperienceAuthoring)).toBe(true);
  });

  it.each(WEB_EXPERIENCE_DESKTOP_ONLY_OPERATIONS)(
    "refuses desktop-only operation %s by name",
    (operation) => {
      expect(evaluateWebExperienceAuthoringOperation(operation)).toEqual({
        ok: false,
        operation,
        reason: "WEB_EXPERIENCE_DESKTOP_ONLY_OPERATION",
        message: `Operation '${operation}' belongs to the desktop authoring surface.`,
      });
    },
  );

  it("fails closed for an unknown authoring operation", () => {
    expect(evaluateWebExperienceAuthoringOperation("provider.install")).toMatchObject({
      ok: false,
      operation: "provider.install",
      reason: "WEB_EXPERIENCE_OPERATION_UNKNOWN",
    });
  });

  it("pins an opaque sandbox with no parent, network, navigation, or script authority", () => {
    expect(WEB_EXPERIENCE_SANDBOX_POLICY).toMatchObject({
      iframeSandbox: "",
      allowsParentDom: false,
      allowsNetwork: false,
      allowsNavigation: false,
      allowsScripts: false,
    });
    expect(WEB_EXPERIENCE_SANDBOX_POLICY.contentSecurityPolicy).toContain(
      "default-src 'none'",
    );
    expect(Object.isFrozen(WEB_EXPERIENCE_SANDBOX_POLICY)).toBe(true);
  });
});
