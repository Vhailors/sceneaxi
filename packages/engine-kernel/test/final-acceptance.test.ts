import { describe, expect, it } from "vitest";
import { open, replay, createGamepadActionSampler } from "@sceneaxi/engine-kernel";

const host = { nowMs: () => 1 };

describe("final kernel contract boundaries", () => {
  it("has a stable named unsupported engine/BOM version refusal", () => {
    const save = open({ productId: "major", seed: 0 }, host).save();

    for (const field of ["kernelVersion", "bomVersion"]) {
      try { replay({ ...save, [field]: "1.0.0" }, host); throw Error("accepted incompatible major"); }
      catch (error) { expect(error).toMatchObject({ code: "KERNEL_VERSION_UNSUPPORTED" }); }
    }
  });
  it("bounds product IDs as well as entity IDs before allocating a session", () => {
    expect(() => open({ productId: "a".repeat(129), seed: 1 }, host)).toThrow();
    expect(open({ productId: "a".repeat(128), seed: 1 }, host).observe().seed).toBe(1);
  });
});

it("samples standard gamepad deadzones and rising edges into queue-only gameplay with exact replay", () => {
  const sampler = createGamepadActionSampler();
  const options = { profile: "game" as const, active: true };
  const pad = { index: 0, connected: true, mapping: "standard", axes: [0], buttons: [{ value: 0, pressed: false }] };
  const session = open({ productId: "input", seed: 1, gameplay: { profile: "game", initialState: { score: 0 }, actions: [{ id: "play.primary", effects: [{ kind: "add-state", key: "score", value: 1 }] }], timers: [] } }, host);
  const sample = (value: number) => sampler.sample([{ ...pad, buttons: [{ value, pressed: value > 0.5 }] }], options);
  expect(sample(0.2)).toEqual([]);
  const commands = sample(0.21); expect(commands).toEqual([{ type: "action", actionId: "play.primary" }]);

  for (const command of commands) session.dispatch(command);
  expect(session.observe().gameplay?.state.score).toBe(0);
  expect(sample(1)).toEqual([]);
  expect(() => sample(NaN)).toThrow(); expect(sample(1)).toEqual([]);
  expect(sample(0)).toEqual([]); expect(sample(1)).toHaveLength(1);
  expect(sampler.sample([], options)).toEqual([]);
  expect(sampler.sample([pad], { ...options, profile: "kids" })).toEqual([]);
  expect(sampler.sample([{ ...pad, buttons: [{ value: 1, pressed: true }] }], { ...options, active: false })).toEqual([]);
  const axis = { device: "gamepad" as const, gamepad: 0, input: "axis" as const, control: 0, direction: "negative" as const, deadzone: 0.25 };
  expect(sampler.sample([{ ...pad, axes: [-0.25] }], { ...options, binding: axis })).toEqual([]);
  expect(sampler.sample([{ ...pad, axes: [-0.26] }], { ...options, binding: axis })).toHaveLength(1);
  expect(sampler.sample([{ ...pad, mapping: "unknown", axes: [-1] }], { ...options, binding: axis })).toEqual([]);
  session.advance({ tick: 1, deltaMs: 0 }); expect(session.observe().gameplay?.state.score).toBe(1);
  expect(replay(JSON.parse(JSON.stringify(session.save())), host).observe()).toEqual(session.observe());
});

it("sustains combined maximum entity/queue/history loads and refuses the next event without drift", () => {
  const timings: number[] = [];

  for (let run = 0; run < 3; run++) {
    const start = performance.now();
    const entities = Array.from({ length: 4096 }, (_, i) => ({ id: `e-${i}`, x: 0, y: 0 }));
    const session = open({ productId: "capacity", seed: 1, entities }, host);
    let events = 0, tick = 0;

    while (events < 100000) {
      const count = Math.min(4096, 100000 - events - 1);

      for (let i = 0; i < count; i++) session.dispatch({ type: "move", actor: `e-${i % 4096}`, axis: [0,0] });
      session.advance({ tick: ++tick, deltaMs: 16 }); events += count + 1;
    }

    const before = session.observe(), save = session.save();
    expect(save.events).toHaveLength(100000); expect(before.entities).toHaveLength(4096);
    expect(() => session.dispatch({ type: "move", actor: "e-0", axis: [0,0] })).toThrow(/capacity/);
    expect(() => session.advance({ tick: tick+1, deltaMs: 0 })).toThrow(/capacity/);
    expect(session.observe()).toEqual(before); expect(session.save()).toEqual(save);
    expect(replay(JSON.parse(JSON.stringify(save)), host).observe()).toEqual(before);
    timings.push(Math.round(performance.now() - start));
  }

  console.info("combined maximum capacity, three complete runs (ms)", timings);
}, 30000);

it("refuses unknown gameplay/command fields rather than silently changing their persisted meaning", () => {
  const gameplay = { profile: "game" as const, initialState: { score: 0 }, actions: [{ id: "play.primary", effects: [{ kind: "add-state" as const, key: "score", value: 1 }] }], timers: [] };
  // SAFETY: The extra script field is confined to a call whose runtime rejection is asserted; it is never used as accepted gameplay.
  expect(() => open({ productId: "unknown", seed: 1, gameplay: { ...gameplay, script: "not-executed" } } as never,host)).toThrow();
  const session=open({productId:"unknown",seed:1,gameplay},host);
  const before=session.observe();
  // SAFETY: This move with an extra actionId is confined to the rejection assertion; the following snapshot check verifies no mutation.
  expect(() => session.dispatch({type:"move",actor:"player",axis:[0,0],actionId:"play.primary"} as never)).toThrow();
  // SAFETY: This spawn with an extra axis is confined to the rejection assertion; the following save check verifies no event was accepted.
  expect(() => session.dispatch({type:"spawn",actor:"other",position:[0,0],axis:[0,0]} as never)).toThrow();
  expect(session.observe()).toEqual(before); expect(session.save().events).toHaveLength(0);
});
