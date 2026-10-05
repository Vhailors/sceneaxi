import { describe, expect, it } from "vitest";
import { open, replay, type ProductManifest } from "@sceneaxi/engine-kernel";

const host = { nowMs: () => 1000 };

const manifest: ProductManifest = { productId: "gameplay", seed: 7, gameplay: {
  profile: "game", initialState: { score: 0 },
  actions: [{ id: "play.primary", effects: [{ kind: "add-state", key: "score", value: 1 }, { kind: "move", actor: "player", axis: [1, 0] }] }],
  timers: [{ id: "bonus", afterMs: 100, repeatMs: 100, effects: [{ kind: "add-state", key: "score", value: 2 }] }],
} };

describe("bounded gameplay through the actual public session", () => {
  it("consumes input only on advance and JSON save/replay reproduces timers, state and entities", () => {
    const session = open(manifest, host);
    const before = session.observe();
    session.dispatch({ type: "action", actionId: "play.primary" });
    expect(session.observe()).toEqual(before);
    session.advance({ tick: 1, deltaMs: 100 });
    expect(session.observe().gameplay?.state).toEqual({ score: 3 });
    expect(session.observe().entities).toEqual([{ id: "player", x: 1, y: 0 }]);
    session.advance({ tick: 2, deltaMs: 200 });
    expect(session.observe().gameplay?.state).toEqual({ score: 7 });
    const restored = replay(JSON.parse(JSON.stringify(session.save())), host);
    expect(restored.observe()).toEqual(session.observe());
    session.advance({ tick: 3, deltaMs: 100 });
    restored.advance({ tick: 3, deltaMs: 100 });
    expect(restored.observe()).toEqual(session.observe());
    expect(Object.isFrozen(restored.observe().gameplay?.state)).toBe(true);
  });
  it("refuses unknown actions and Kids/eval definitions without consuming a valid input", () => {
    const session = open(manifest, host);
    session.dispatch({ type: "action", actionId: "play.primary" });
    expect(() => session.dispatch({ type: "action", actionId: "unknown" })).toThrow(/unknown/);
    // SAFETY: The unsupported Kids profile is passed only inside the asserted runtime refusal, not exposed as admitted gameplay.
    expect(() => open({ ...manifest, gameplay: { ...requireValue(manifest.gameplay), profile: "kids" as never } }, host)).toThrow(/unsupported/);
    // SAFETY: The unsupported eval effect is confined to this refusal assertion; no returned session is retained.
    expect(() => open({ ...manifest, gameplay: { ...requireValue(manifest.gameplay), actions: [{ id: "eval", effects: [{ kind: "eval" } as never] }] } }, host)).toThrow(/unsupported/);
    session.advance({ tick: 1, deltaMs: 0 });
    expect(session.observe().gameplay?.state).toEqual({ score: 1 });
  });
  it("refuses timer work overflow atomically and permits retrying a smaller clock", () => {
    const session = open({ ...manifest, gameplay: { ...requireValue(manifest.gameplay), timers: [{ id: "fast", afterMs: 1, repeatMs: 1, effects: [{ kind: "add-state", key: "score", value: 1 }] }] } }, host);
    session.dispatch({ type: "action", actionId: "play.primary" });
    const before = session.observe();
    expect(() => session.advance({ tick: 1, deltaMs: 60000 })).toThrow(/capacity/);
    expect(session.observe()).toEqual(before);
    expect(() => session.save()).toThrow(/pending/);
    session.advance({ tick: 1, deltaMs: 10 });
    expect(session.observe().gameplay?.state).toEqual({ score: 11 });
    expect(replay(session.save(), host).observe()).toEqual(session.observe());
  });
});

function requireValue<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) throw new Error("Required fixture value is absent.");

  return value;
}
