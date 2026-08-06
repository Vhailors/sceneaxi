import { describe, expect, it } from "vitest";
import {
  KIDS_ACTIVITY_ACTIONS,
  KIDS_ACTIVITY_PIECE_LIMIT,
  KIDS_ACTIVITY_REFUSE_REASONS,
  applyKidsActivityAction,
  createKidsActivityState,
} from "@sceneaxi/profile-kids";

describe("@sceneaxi/profile-kids curated first-release activity", () => {
  it("builds and plays a tiny world through only the closed action table", () => {
    let state = createKidsActivityState();

    for (const request of [
      { action: "world.choose", worldId: "moon" },
      { action: "piece.add", pieceId: "rocket" },
      { action: "piece.add", pieceId: "star" },
      { action: "play.start" },
    ] as const) {
      const decision = applyKidsActivityAction(state, request);
      expect(decision.ok, JSON.stringify(request)).toBe(true);
      if (decision.ok) state = decision.state;
    }

    expect(state).toMatchObject({
      worldId: "moon",
      pieceIds: ["rocket", "star"],
      mode: "play",
      revision: 4,
    });
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.pieceIds)).toBe(true);
    expect(KIDS_ACTIVITY_ACTIONS).toEqual([
      "world.choose",
      "piece.add",
      "piece.undo",
      "scene.reset",
      "play.start",
      "play.stop",
    ]);
  });

  it("keeps every choice curated and bounds scene size", () => {
    let state = createKidsActivityState();
    expect(
      applyKidsActivityAction(state, { action: "world.choose", worldId: "uploaded" }),
    ).toMatchObject({
      ok: false,
      reason: KIDS_ACTIVITY_REFUSE_REASONS.curatedChoiceRequired,
    });

    for (let index = 0; index < KIDS_ACTIVITY_PIECE_LIMIT; index += 1) {
      const decision = applyKidsActivityAction(state, {
        action: "piece.add",
        pieceId: "friend",
      });
      expect(decision.ok).toBe(true);
      if (decision.ok) state = decision.state;
    }
    expect(applyKidsActivityAction(state, { action: "piece.add", pieceId: "tree" })).toEqual({
      ok: false,
      action: "piece.add",
      reason: KIDS_ACTIVITY_REFUSE_REASONS.sceneFull,
      message: "Your world is full. Undo one thing to add another.",
    });
  });

  it.each([
    "catalog.open",
    "checkout.start",
    "identity.login",
    "model.prompt",
    "network.fetch",
    "upload.asset",
  ])("refuses unsupported action %s without capability or state details", (action) => {
    const decision = applyKidsActivityAction(createKidsActivityState(), { action });
    expect(decision).toEqual({
      ok: false,
      action: null,
      reason: KIDS_ACTIVITY_REFUSE_REASONS.actionUnsupported,
      message: "That tool is not part of this play space.",
    });
    expect(JSON.stringify(decision)).not.toMatch(
      /account|balance|billing|catalog|checkout|credit|identity|model|provider|session/i,
    );
  });

  it("refuses forged state and accessor-backed requests without executing them", () => {
    const accessor = Object.defineProperty({}, "action", {
      get() {
        throw new Error("must not execute");
      },
    });
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();

    expect(
      applyKidsActivityAction(
        {
          version: 1,
          worldId: "meadow",
          pieceIds: [],
          mode: "build",
          revision: 0,
        },
        { action: "play.start" },
      ),
    ).toMatchObject({
      ok: false,
      reason: KIDS_ACTIVITY_REFUSE_REASONS.stateInvalid,
    });
    for (const request of [accessor, revocable.proxy]) {
      expect(() => applyKidsActivityAction(createKidsActivityState(), request)).not.toThrow();
      expect(applyKidsActivityAction(createKidsActivityState(), request)).toMatchObject({
        ok: false,
        reason: KIDS_ACTIVITY_REFUSE_REASONS.requestInvalid,
      });
    }
  });
});
