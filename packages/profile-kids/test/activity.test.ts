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

  it("reaches every reason in the closed refusal table, and mutates nothing when it refuses", () => {
    const built = (() => {
      let state = createKidsActivityState();
      const decision = applyKidsActivityAction(state, { action: "piece.add", pieceId: "star" });
      if (decision.ok) state = decision.state;
      return state;
    })();
    const playing = (() => {
      const decision = applyKidsActivityAction(built, { action: "play.start" });
      if (!decision.ok) throw new Error("play.start must be allowed from a built scene.");
      return decision.state;
    })();
    const full = (() => {
      let state = createKidsActivityState();
      for (let index = 0; index < KIDS_ACTIVITY_PIECE_LIMIT; index += 1) {
        const decision = applyKidsActivityAction(state, {
          action: "piece.add",
          pieceId: "friend",
        });
        if (decision.ok) state = decision.state;
      }
      return state;
    })();

    const cases = [
      { reason: KIDS_ACTIVITY_REFUSE_REASONS.stateInvalid, state: { ...built }, request: { action: "play.start" } },
      { reason: KIDS_ACTIVITY_REFUSE_REASONS.requestInvalid, state: built, request: "play.start" },
      { reason: KIDS_ACTIVITY_REFUSE_REASONS.actionUnsupported, state: built, request: { action: "scene.export" } },
      {
        reason: KIDS_ACTIVITY_REFUSE_REASONS.curatedChoiceRequired,
        state: built,
        request: { action: "piece.add", pieceId: "uploaded" },
      },
      { reason: KIDS_ACTIVITY_REFUSE_REASONS.sceneFull, state: full, request: { action: "piece.add", pieceId: "tree" } },
      {
        reason: KIDS_ACTIVITY_REFUSE_REASONS.sceneEmpty,
        state: createKidsActivityState(),
        request: { action: "piece.undo" },
      },
      {
        reason: KIDS_ACTIVITY_REFUSE_REASONS.buildPaused,
        state: playing,
        request: { action: "piece.add", pieceId: "tree" },
      },
      { reason: KIDS_ACTIVITY_REFUSE_REASONS.alreadyPlaying, state: playing, request: { action: "play.start" } },
      { reason: KIDS_ACTIVITY_REFUSE_REASONS.alreadyStopped, state: built, request: { action: "play.stop" } },
    ] as const;

    for (const testCase of cases) {
      const before = JSON.stringify(testCase.state);
      const decision = applyKidsActivityAction(testCase.state, testCase.request);
      expect(decision, JSON.stringify(testCase.request)).toMatchObject({
        ok: false,
        reason: testCase.reason,
      });
      expect(decision).not.toHaveProperty("state");
      expect(JSON.stringify(testCase.state)).toBe(before);
      expect(JSON.stringify(decision)).not.toMatch(
        /account|balance|billing|catalog|checkout|credit|identity|model|provider|session/i,
      );
    }

    expect([...new Set(cases.map((testCase) => testCase.reason))].sort()).toEqual(
      Object.values(KIDS_ACTIVITY_REFUSE_REASONS).sort(),
    );
  });

  it("keeps play a read-only mode for every editing action", () => {
    let state = createKidsActivityState();
    for (const request of [
      { action: "piece.add", pieceId: "rocket" },
      { action: "play.start" },
    ] as const) {
      const decision = applyKidsActivityAction(state, request);
      if (decision.ok) state = decision.state;
    }
    expect(state).toMatchObject({ mode: "play", pieceIds: ["rocket"], revision: 2 });

    for (const request of [
      { action: "world.choose", worldId: "ocean" },
      { action: "piece.add", pieceId: "tree" },
      { action: "piece.undo" },
      { action: "scene.reset" },
    ] as const) {
      expect(applyKidsActivityAction(state, request), JSON.stringify(request)).toEqual({
        ok: false,
        action: request.action,
        reason: KIDS_ACTIVITY_REFUSE_REASONS.buildPaused,
        message: "Stop play before changing your world.",
      });
    }
    expect(state).toMatchObject({ mode: "play", pieceIds: ["rocket"], revision: 2 });
  });

  it("refuses an undo with nothing to undo instead of advancing the revision", () => {
    const state = createKidsActivityState();
    expect(applyKidsActivityAction(state, { action: "piece.undo" })).toEqual({
      ok: false,
      action: "piece.undo",
      reason: KIDS_ACTIVITY_REFUSE_REASONS.sceneEmpty,
      message: "Your world is already clear. Add a piece first.",
    });
    expect(state.revision).toBe(0);
    expect(applyKidsActivityAction(state, { action: "piece.undo" })).toEqual(
      applyKidsActivityAction(state, { action: "piece.undo" }),
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
