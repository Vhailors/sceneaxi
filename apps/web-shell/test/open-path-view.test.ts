/**
 * The web shell's open-path view model (sceneaxi#137).
 *
 * `web-shell` has no UI framework in this repo, so the contract under test is
 * the view model a renderer would read: it must report the shared policy
 * verbatim and surface the Kids refusal as a *named* refusal, never as an empty
 * list a renderer could style as "nothing to show here".
 */
import { describe, expect, it } from "vitest";
import {
  OPEN_PATH_REFUSE_CODES,
  OPEN_PATH_REFUSE_ONLY_PROFILE,
  openPathPolicyView,
} from "@sceneaxi/schemas";
import { createOpenPathView } from "@sceneaxi/web-shell";

describe("web shell open-path view", () => {
  it("reports the shared policy view verbatim", () => {
    expect(createOpenPathView().policy).toEqual(openPathPolicyView());
  });

  it("names the refuse-only profile for the renderer", () => {
    const view = createOpenPathView();
    expect(view.refuseOnlyProfile).toBe(OPEN_PATH_REFUSE_ONLY_PROFILE);
    const kids = view.rowFor(OPEN_PATH_REFUSE_ONLY_PROFILE);
    expect(kids?.demoLevel).toBe("refuse-only");
    expect(kids?.operations).toEqual([]);
  });

  it("resolves a row by profile, and undefined for an unknown one", () => {
    const view = createOpenPathView();
    expect(view.rowFor("@sceneaxi/profile-game")?.sessionKind).toBe(
      "scene-kernel-session",
    );
    expect(view.rowFor("@sceneaxi/profile-imaginary")).toBeUndefined();
  });

  it("evaluates through the shared policy, refusing Kids by name", () => {
    const view = createOpenPathView();
    const allowed = view.evaluate("@sceneaxi/profile-web", "save");
    expect(allowed.ok).toBe(true);
    if (allowed.ok) expect(allowed.shippingClaim).toBe(false);

    const kids = view.evaluate(OPEN_PATH_REFUSE_ONLY_PROFILE, "open");
    expect(kids.ok).toBe(false);
    if (!kids.ok) expect(kids.code).toBe(OPEN_PATH_REFUSE_CODES.kidsRefused);
  });

  it("is frozen, so a renderer cannot mutate the policy it was handed", () => {
    expect(Object.isFrozen(createOpenPathView())).toBe(true);
  });
});
