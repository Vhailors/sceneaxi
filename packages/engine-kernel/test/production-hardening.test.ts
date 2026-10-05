import { describe, expect, it } from "vitest";
import { open, replay, openSculptKernelSession, replaySculptKernelSession } from "@sceneaxi/engine-kernel";
import { sceneCompositionArtifactFixture } from "@sceneaxi/schemas/testing/scene-composition";

const host = { nowMs: () => 1000 };

describe("numeric and replay capacity refusal at public boundaries", () => {
  it("refuses unsafe coordinates/seed/clock and finite coordinate overflow without consuming a pending batch", () => {
    for (const value of [1e308, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) {
      expect(() => open({ productId: "invalid", seed: value }, host)).toThrow();
      expect(() => open({ productId: "invalid", seed: 1, entities: [{ id: "player", x: value, y: 0 }] }, host)).toThrow();
    }

    const session = open({ productId: "limit", seed: 1, entities: [{ id: "player", x: 1000000, y: 0 }] }, host);
    session.dispatch({ type: "move", actor: "player", axis: [1, 0] });
    const before = session.observe();

    for (let retry = 0; retry < 2; retry++) {
      expect(() => session.advance({ tick: 1, deltaMs: 16 })).toThrow(/coordinate/);
      expect(session.observe()).toEqual(before);
      expect(() => session.save()).toThrow(/pending/);
    }
  });
  it("allows the declared limits and rejects limit+1; commands survive a refused clock", () => {
    const s = open({ productId: "bounded", seed: Number.MAX_SAFE_INTEGER }, host);
    s.dispatch({ type: "move", actor: "player", axis: [1000000, -1000000] });
    expect(() => s.advance({ tick: Number.MAX_SAFE_INTEGER + 1, deltaMs: 0 })).toThrow();
    expect(() => s.advance({ tick: 1, deltaMs: 60001 })).toThrow();
    s.advance({ tick: Number.MAX_SAFE_INTEGER, deltaMs: 60000 });
    expect(replay(JSON.parse(JSON.stringify(s.save())), host).observe()).toEqual(s.observe());
    const entities = Array.from({ length: 4096 }, (_, i) => ({ id: `e-${i}`, x: 0, y: 0 }));
    expect(open({ productId: "entities", seed: 1, entities }, host).observe().entities).toHaveLength(4096);
    expect(() => open({ productId: "entities", seed: 1, entities: [...entities, { id: "excess", x: 0, y: 0 }] }, host)).toThrow();
    const queued = open({ productId: "queue", seed: 1 }, host);

    for (let i = 0; i < 4096; i++) queued.dispatch({ type: "move", actor: "player", axis: [0, 0] });
    expect(() => queued.dispatch({ type: "move", actor: "player", axis: [0, 0] })).toThrow(/capacity/);
    queued.advance({ tick: 1, deltaMs: 0 });
    expect(queued.save().events).toHaveLength(4097);
    expect(replay(queued.save(), host).observe()).toEqual(queued.observe());
  });
  it("enforces an explicit same-major compatibility table without altering supported save digests", () => {
    const s = open({ productId: "versions", seed: 1 }, host); s.advance({ tick: 1, deltaMs: 0 });
    const save = s.save();

    for (const field of ["kernelVersion", "bomVersion"] as const) {
      for (const v of ["0.0.0", "0.1.9", "0.999.999"]) expect(replay({ ...save, [field]: v }, host).observe()).toEqual(s.observe());

      for (const v of ["1.0.0", "99.0.0", "latest"]) expect(() => replay({ ...save, [field]: v }, host)).toThrow();
    }
  });
  it("sculpt refusal preserves state and save history, and the supported retry round trips", () => {
    const s = openSculptKernelSession(sceneCompositionArtifactFixture("numeric-artifact"), { seed: 1, gravity: -1000000 });
    const before = s.observe();
    expect(() => s.advance({ tick: 1, deltaMs: 60000 })).toThrow(/numeric range/);
    expect(s.observe()).toEqual(before);
    expect(s.save().advances).toHaveLength(0);
    expect(() => s.advance({ tick: 1, deltaMs: 1e308 })).toThrow();
    s.advance({ tick: 1, deltaMs: 16 });
    expect(replaySculptKernelSession(JSON.parse(JSON.stringify(s.save()))).observe()).toEqual(s.observe());
  });
});
