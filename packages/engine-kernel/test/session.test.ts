import { describe, expect, it } from "vitest";
import {
  KERNEL_SESSION_SCHEMA_VERSION,
  type KernelCommand,
  type ProductManifest,
} from "@sceneaxi/schemas";
import {
  BOM_VERSION,
  KERNEL_VERSION,
  open,
  replay,
  type KernelHost,
} from "@sceneaxi/engine-kernel";

const manifest: ProductManifest = Object.freeze({
  productId: "tracer-bullet",
  seed: 42,
  entities: Object.freeze([
    Object.freeze({ id: "player", x: 0, y: 0 }),
  ]),
});

function fixedHost(startMs = 1_000): KernelHost {
  let t = startMs;
  return {
    nowMs: () => {
      const v = t;
      t += 1;
      return v;
    },
  };
}

function runSequence(host: KernelHost = fixedHost()): string {
  const session = open(manifest, host);
  session.dispatch({ type: "move", actor: "player", axis: [2, 0] });
  session.advance({ tick: 1, deltaMs: 16 });
  session.dispatch({ type: "move", actor: "player", axis: [0, 3] });
  session.advance({ tick: 2, deltaMs: 16 });
  session.dispatch({ type: "spawn", actor: "npc", position: [5, 5] });
  session.advance({ tick: 3, deltaMs: 16 });
  return session.observe().digest;
}

describe("KernelSession — command/snapshot seam", () => {
  it("opens from a product manifest and exposes the initial snapshot", () => {
    const session = open(manifest, fixedHost());
    const snap = session.observe();
    expect(snap.tick).toBe(0);
    expect(snap.seed).toBe(42);
    expect(snap.entities).toEqual([{ id: "player", x: 0, y: 0 }]);
    expect(snap.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("only advance mutates authoritative state; dispatch is queue-only", () => {
    const session = open(manifest, fixedHost());
    const before = session.observe();

    session.dispatch({ type: "move", actor: "player", axis: [1, 0] });
    const afterDispatch = session.observe();
    expect(afterDispatch.digest).toBe(before.digest);
    expect(afterDispatch.entities).toEqual(before.entities);
    expect(afterDispatch.tick).toBe(0);

    session.advance({ tick: 1, deltaMs: 16 });
    const afterAdvance = session.observe();
    expect(afterAdvance.digest).not.toBe(before.digest);
    expect(afterAdvance.tick).toBe(1);
    expect(afterAdvance.entities).toEqual([{ id: "player", x: 1, y: 0 }]);
  });

  it("observe returns a deeply frozen read-only snapshot", () => {
    const session = open(manifest, fixedHost());
    session.dispatch({ type: "move", actor: "player", axis: [1, 1] });
    session.advance({ tick: 1, deltaMs: 16 });

    const snap = session.observe();
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.entities)).toBe(true);
    expect(Object.isFrozen(snap.entities[0])).toBe(true);

    expect(() => {
      (snap as { tick: number }).tick = 99;
    }).toThrow();
    expect(() => {
      (snap.entities as SnapshotEntityMutable[]).push({ id: "x", x: 0, y: 0 });
    }).toThrow();
    expect(() => {
      (snap.entities[0] as { x: number }).x = 999;
    }).toThrow();

    // Mutation attempts must not leak into the session.
    expect(session.observe().entities).toEqual([{ id: "player", x: 1, y: 1 }]);
    expect(session.observe().tick).toBe(1);
  });

  it("rejects invalid commands on dispatch without mutating state", () => {
    const session = open(manifest, fixedHost());
    const before = session.observe().digest;

    expect(() =>
      session.dispatch({ type: "teleport" } as unknown as KernelCommand),
    ).toThrow(/unknown|invalid|command/i);
    expect(() =>
      session.dispatch({ type: "move", actor: "", axis: [1, 0] }),
    ).toThrow();
    expect(() =>
      session.dispatch({
        type: "move",
        actor: "player",
        axis: [1.5, 0] as unknown as [number, number],
      }),
    ).toThrow();

    expect(session.observe().digest).toBe(before);
  });

  it("refuses spawn actor IDs outside the manifest entity vocabulary", () => {
    const session = open(manifest, fixedHost());

    expect(() =>
      session.dispatch({
        type: "spawn",
        actor: "Invalid Actor",
        position: [0, 0],
      }),
    ).toThrow(/spawn\.actor/i);
    session.advance({ tick: 1, deltaMs: 16 });
    expect(session.observe().entities).toEqual([{ id: "player", x: 0, y: 0 }]);
  });

  it("validates actor state across the pending batch at dispatch", () => {
    const session = open(manifest, fixedHost());
    const before = session.observe();

    expect(() =>
      session.dispatch({ type: "move", actor: "missing", axis: [1, 0] }),
    ).toThrow(/does not exist/i);
    session.dispatch({ type: "spawn", actor: "npc", position: [2, 3] });
    session.dispatch({ type: "move", actor: "npc", axis: [1, 0] });
    expect(() =>
      session.dispatch({ type: "spawn", actor: "npc", position: [9, 9] }),
    ).toThrow(/already exists/i);
    expect(session.observe()).toEqual(before);

    session.advance({ tick: 1, deltaMs: 16 });
    expect(session.observe().entities).toEqual([
      { id: "npc", x: 3, y: 3 },
      { id: "player", x: 0, y: 0 },
    ]);
  });

  it("produces identical digests across independent runs of the same sequence", () => {
    const a = runSequence(fixedHost(500));
    const b = runSequence(fixedHost(9000));
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("save stamps schema + kernel/BOM versions and terminal digest", () => {
    const session = open(manifest, fixedHost());
    session.dispatch({ type: "move", actor: "player", axis: [4, -1] });
    session.advance({ tick: 1, deltaMs: 16 });
    const snap = session.observe();
    const artifact = session.save();

    expect(artifact.schemaVersion).toBe(KERNEL_SESSION_SCHEMA_VERSION);
    expect(artifact.kernelVersion).toBe(KERNEL_VERSION);
    expect(artifact.bomVersion).toBe(BOM_VERSION);
    expect(artifact.terminalDigest).toBe(snap.digest);
    expect(artifact.productManifest.productId).toBe("tracer-bullet");
    expect(artifact.events.length).toBeGreaterThan(0);
  });

  it("save → replay yields an identical terminal digest", () => {
    const session = open(manifest, fixedHost());
    session.dispatch({ type: "move", actor: "player", axis: [2, 0] });
    session.advance({ tick: 1, deltaMs: 16 });
    session.dispatch({ type: "spawn", actor: "npc", position: [3, 4] });
    session.advance({ tick: 2, deltaMs: 16 });
    session.dispatch({ type: "move", actor: "npc", axis: [-1, 1] });
    session.advance({ tick: 3, deltaMs: 16 });

    const terminal = session.observe().digest;
    const artifact = session.save();
    expect(artifact.terminalDigest).toBe(terminal);

    const restored = replay(artifact, fixedHost());
    expect(restored.observe().digest).toBe(terminal);
    expect(restored.observe().entities).toEqual([
      { id: "npc", x: 2, y: 5 },
      { id: "player", x: 2, y: 0 },
    ]);
  });

  it("refuses save artifacts with a schema major mismatch", () => {
    const session = open(manifest, fixedHost());
    session.advance({ tick: 1, deltaMs: 0 });
    const artifact = session.save();

    expect(() =>
      replay({ ...artifact, schemaVersion: KERNEL_SESSION_SCHEMA_VERSION + 1 }, fixedHost()),
    ).toThrow(/schema|mismatch|version/i);

    expect(() =>
      replay({ ...artifact, schemaVersion: 0 }, fixedHost()),
    ).toThrow(/schema|mismatch|version/i);
  });

  it("refuses replay artifacts with invalid required integrity fields", () => {
    const session = open(manifest, fixedHost());
    session.advance({ tick: 1, deltaMs: 0 });
    const artifact = session.save();

    expect(() =>
      replay(
        { ...artifact, terminalDigest: undefined as unknown as string },
        fixedHost(),
      ),
    ).toThrow(/terminalDigest/i);
    expect(() =>
      replay({ ...artifact, terminalDigest: "not-a-digest" }, fixedHost()),
    ).toThrow(/terminalDigest/i);
    expect(() =>
      replay({ ...artifact, kernelVersion: "latest" }, fixedHost()),
    ).toThrow(/kernelVersion|bomVersion/i);

    const dispatching = open(manifest, fixedHost());
    dispatching.dispatch({ type: "move", actor: "player", axis: [1, 0] });
    dispatching.advance({ tick: 1, deltaMs: 1 });
    const withDispatch = dispatching.save();
    const events = withDispatch.events.map((event) =>
      event.kind === "dispatch"
        ? { ...event, timestampMs: Number.NaN }
        : event,
    );
    expect(() => replay({ ...withDispatch, events }, fixedHost())).toThrow(
      /timestampMs/i,
    );
  });

  it("refuses replay artifacts with unadvanced dispatch commands", () => {
    const session = open(manifest, fixedHost());
    session.advance({ tick: 1, deltaMs: 0 });
    const artifact = session.save();

    expect(() =>
      replay(
        {
          ...artifact,
          events: [
            ...artifact.events,
            {
              kind: "dispatch",
              command: { type: "move", actor: "player", axis: [1, 0] },
              timestampMs: 1_001,
            },
          ],
        },
        fixedHost(),
      ),
    ).toThrow(/unadvanced dispatch/i);
  });

  it("digest is a canonical sha256 over sorted entity state", () => {
    const session = open(manifest, fixedHost());
    session.dispatch({ type: "spawn", actor: "b-entity", position: [1, 2] });
    session.dispatch({ type: "spawn", actor: "a-entity", position: [3, 4] });
    session.advance({ tick: 1, deltaMs: 16 });

    const snap = session.observe();
    expect(snap.digest).toBe(
      "sha256:a721c4fbbbc333921cd5bba28b3949cae5b9a6ec6dd9f8f97416e5a0a3b9eded",
    );
  });
});

interface SnapshotEntityMutable {
  id: string;
  x: number;
  y: number;
}
