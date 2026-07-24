import { describe, expect, it } from "vitest";
import {
  KernelSessionError,
  openSculptKernelSession,
  replaySculptKernelSession,
} from "@sceneaxi/engine-kernel";
import {
  OBJECT_SCULPT_SPEC_KIND,
  SCULPT_PROCEDURAL_EXPORT_NAME,
  SCULPT_PROCEDURAL_MODULE_ID,
  SCULPT_PROCEDURAL_SOURCE_DIGEST,
  SCULPT_ARTIFACT_KIND,
  SCULPT_SCHEMA_VERSION,
  digestObjectSculptSpec,
  projectAnimationReadyHierarchy,
  type SculptQualityArtifact,
} from "@sceneaxi/schemas";

const digest = (character: string) => `sha256:${character.repeat(64)}`;
const identity = {
  translation: [0, 0, 0],
  rotationEulerDegrees: [0, 0, 0],
  scale: [1, 1, 1],
} as const;

function artifact(): SculptQualityArtifact {
  const hierarchy = [
    {
      id: "body-node",
      parentId: null,
      componentId: "body",
      transform: { ...identity, translation: [0, 3, 0] },
    },
    {
      id: "cap-node",
      parentId: "body-node",
      componentId: "cap",
      transform: { ...identity, translation: [0, 1.25, 0] },
    },
  ] as const;
  const spec = {
    schemaVersion: SCULPT_SCHEMA_VERSION,
    kind: OBJECT_SCULPT_SPEC_KIND,
    id: "kernel-fixture",
    rootNodeId: "body-node",
    complexityClass: "simple" as const,
    passes: [
      { id: "blockout", deterministic: true as const, steps: ["establish-volume"] },
      { id: "structure", deterministic: true as const, steps: ["place-components"] },
      { id: "materials", deterministic: true as const, steps: ["assign-materials"] },
      { id: "sockets", deterministic: true as const, steps: ["bind-sockets"] },
    ],
    materials: [
      { id: "main", baseColor: "#4488cc", metallic: 0.1, roughness: 0.6 },
    ],
    components: [
      { id: "body", primitive: "box" as const, dimensions: [2, 2, 2] as const, materialId: "main" },
      { id: "cap", primitive: "sphere" as const, dimensions: [1, 1, 1] as const, materialId: "main" },
    ],
    hierarchy,
    sockets: [
      {
        id: "cap-bob",
        nodeId: "cap-node",
        kind: "animation" as const,
        axis: "y" as const,
        amplitude: 0.25,
        frequencyHz: 1,
      },
      {
        id: "cap-attachment",
        nodeId: "cap-node",
        kind: "attachment" as const,
        axis: "y" as const,
        amplitude: 0,
        frequencyHz: 0,
      },
    ],
  };
  const emitDigest =
    "sha256:85bf6c1b59cf9f3e45649caf3cdb68bd0d46b933b47a515cfe5dedb69d783f00";
  return {
    schemaVersion: SCULPT_SCHEMA_VERSION,
    kind: SCULPT_ARTIFACT_KIND,
    artifactId: "kernel-fixture-artifact",
    spec,
    proceduralModule: {
      moduleId: SCULPT_PROCEDURAL_MODULE_ID,
      exportName: SCULPT_PROCEDURAL_EXPORT_NAME,
      sourceDigest: SCULPT_PROCEDURAL_SOURCE_DIGEST,
      seed: 0,
      emitDigest,
    },
    runtimeHierarchy: projectAnimationReadyHierarchy(spec),
    evidence: {
      method: "structured-fixture",
      intakeDigest: digest("a"),
      specDigest: digestObjectSculptSpec(spec),
      proceduralModuleDigest: SCULPT_PROCEDURAL_SOURCE_DIGEST,
      qualityGates: [
        { id: "contract", status: "passed", digest: digest("d") },
        { id: "procedural-emit", status: "passed", digest: emitDigest },
      ],
    },
  };
}

describe("kernel sculpt session", () => {
  it("projects the runtime hierarchy into frozen kernel observations", () => {
    const session = openSculptKernelSession(artifact(), { seed: 73 });
    const snapshot = session.observe();
    expect(snapshot.nodes.map((node) => [node.id, node.parentId])).toEqual([
      ["body-node", null],
      ["cap-node", "body-node"],
    ]);
    expect(snapshot.nodes[0]?.transform.translation).toEqual([0, 3, 0]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.nodes)).toBe(true);
    expect(Object.isFrozen(snapshot.nodes[0]?.transform)).toBe(true);
    expect(Object.isFrozen(snapshot.nodes[0]?.transform.translation)).toBe(true);
  });

  it("advances animation sockets only with kernel advance", () => {
    const session = openSculptKernelSession(artifact(), { seed: 73 });
    const before = session.observe();
    const repeatedObserve = session.observe();
    expect(repeatedObserve).toEqual(before);

    session.advance({ tick: 1, deltaMs: 250 });
    const after = session.observe();
    expect(after.sockets.find((socket) => socket.id === "cap-bob")?.value).not.toBe(
      before.sockets.find((socket) => socket.id === "cap-bob")?.value,
    );
    expect(after.tick).toBe(1);
    expect(after.elapsedMs).toBe(250);
  });

  it("resolves toy ground collision deterministically for a fixed seed", () => {
    const first = openSculptKernelSession(artifact(), { seed: 71 });
    const second = openSculptKernelSession(artifact(), { seed: 71 });
    for (let tick = 1; tick <= 12; tick += 1) {
      const clock = { tick, deltaMs: 100 };
      first.advance(clock);
      second.advance(clock);
    }
    expect(first.observe()).toEqual(second.observe());
    expect(first.observe().collisionCount).toBeGreaterThan(0);
    expect(first.observe().nodes[0]?.transform.translation[1]).toBeGreaterThanOrEqual(1);

    const otherSeed = openSculptKernelSession(artifact(), { seed: 72 });
    otherSeed.advance({ tick: 1, deltaMs: 100 });
    expect(otherSeed.observe().nodes[0]?.velocity[0]).not.toBe(
      openSculptKernelSession(artifact(), { seed: 71 }).observe().nodes[0]?.velocity[0],
    );
  });

  it("round-trips save/replay to the exact terminal digest", () => {
    const session = openSculptKernelSession(artifact(), { seed: 99 });
    session.advance({ tick: 1, deltaMs: 16 });
    session.advance({ tick: 2, deltaMs: 16 });
    const save = session.save();
    const replayed = replaySculptKernelSession(save);
    expect(replayed.observe()).toEqual(session.observe());
    expect(replayed.save().terminalDigest).toBe(save.terminalDigest);
  });

  it("fails closed on invalid clocks and replay digest drift", () => {
    const session = openSculptKernelSession(artifact(), { seed: 1 });
    session.advance({ tick: 1, deltaMs: 16 });
    expect(() => session.advance({ tick: 1, deltaMs: 16 })).toThrow(KernelSessionError);

    const save = session.save();
    expect(() =>
      replaySculptKernelSession({ ...save, terminalDigest: digest("f") }),
    ).toThrow(/sculpt replay digest mismatch/);
  });
});
