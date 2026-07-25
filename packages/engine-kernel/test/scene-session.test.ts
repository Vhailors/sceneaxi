import { describe, expect, it } from "vitest";
import {
  SCENE_KERNEL_SAVE_KIND,
  deriveSceneInstanceSeed,
  openSceneKernelSession,
  replaySceneKernelSession,
} from "@sceneaxi/engine-kernel";
import {
  COMPOSED_SCENE_KIND,
  OBJECT_SCULPT_SPEC_KIND,
  SCENE_COMPOSITION_INTAKE_KIND,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  SCULPT_ARTIFACT_KIND,
  SCULPT_SCHEMA_VERSION,
  digestComposedScene,
  digestSceneArtifact,
  digestScenePlacements,
  resolveScenePlacements,
  type ComposedScene,
  type ComposedSceneInstance,
  type SculptArtifact,
  type SculptTransform,
} from "@sceneaxi/schemas";

const digest = (character: string) => `sha256:${character.repeat(64)}`;

const identity: SculptTransform = {
  translation: [0, 0, 0],
  rotationEulerDegrees: [0, 0, 0],
  scale: [1, 1, 1],
};

function transform(
  translation: readonly [number, number, number],
  scale: readonly [number, number, number] = [1, 1, 1],
): SculptTransform {
  return { translation, rotationEulerDegrees: [0, 0, 0], scale };
}

function artifactFixture(artifactId: string): SculptArtifact {
  const rootNodeId = `${artifactId}-root`;
  const childNodeId = `${artifactId}-child`;
  const hierarchy = [
    { id: rootNodeId, parentId: null, componentId: "body", transform: identity },
    {
      id: childNodeId,
      parentId: rootNodeId,
      componentId: "cap",
      transform: transform([0, 1.5, 0]),
    },
  ] as const;
  const spec = {
    schemaVersion: SCULPT_SCHEMA_VERSION,
    kind: OBJECT_SCULPT_SPEC_KIND,
    id: `${artifactId}-spec`,
    rootNodeId,
    materials: [
      { id: "primary", baseColor: "#8899aa", metallic: 0.1, roughness: 0.7 },
    ],
    components: [
      { id: "body", primitive: "box", dimensions: [2, 2, 2], materialId: "primary" },
      {
        id: "cap",
        primitive: "cylinder",
        dimensions: [0.5, 1, 0.5],
        materialId: "primary",
      },
    ],
    hierarchy,
    sockets: [
      {
        id: `${artifactId}-bob`,
        nodeId: childNodeId,
        kind: "animation",
        axis: "y",
        amplitude: 0.25,
        frequencyHz: 1,
      },
    ],
  } as const;
  return {
    schemaVersion: SCULPT_SCHEMA_VERSION,
    kind: SCULPT_ARTIFACT_KIND,
    artifactId,
    spec,
    proceduralModule: {
      moduleId: "sceneaxi/scene-session-test-fixture",
      exportName: "buildFixture",
      sourceDigest: digest("b"),
    },
    runtimeHierarchy: { rootNodeId, nodes: hierarchy },
    evidence: {
      method: "structured-fixture",
      intakeDigest: digest("a"),
      specDigest: digest("c"),
      proceduralModuleDigest: digest("b"),
      qualityGates: [{ id: "contract", status: "passed", digest: digest("d") }],
    },
  } as SculptArtifact;
}

const crateArtifact = artifactFixture("crate-artifact");
const droneArtifact = artifactFixture("drone-artifact");

function sceneFixture(sceneId = "bay"): ComposedScene {
  const resolved = resolveScenePlacements({
    schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
    kind: SCENE_COMPOSITION_INTAKE_KIND,
    sceneId,
    rootInstanceId: "bay-floor-crate",
    placements: [
      {
        instanceId: "bay-floor-crate",
        artifactId: "crate-artifact",
        parentInstanceId: null,
        transform: transform([1, 0, 2], [2, 2, 2]),
      },
      {
        instanceId: "bay-stacked-crate",
        artifactId: "crate-artifact",
        parentInstanceId: "bay-floor-crate",
        transform: transform([0, 1, 0]),
      },
      {
        instanceId: "bay-drone",
        artifactId: "drone-artifact",
        parentInstanceId: "bay-floor-crate",
        transform: transform([0, 3, 0]),
      },
    ],
  });
  if (!resolved.ok) throw new Error("scene fixture refused");
  const artifacts = new Map([
    ["crate-artifact", crateArtifact],
    ["drone-artifact", droneArtifact],
  ]);
  const instances = resolved.value.map((placement): ComposedSceneInstance => {
    const artifact = artifacts.get(placement.artifactId);
    if (artifact === undefined) throw new Error("fixture artifact missing");
    return { ...placement, artifact };
  });
  const draft = {
    schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
    kind: COMPOSED_SCENE_KIND,
    sceneId,
    rootInstanceId: "bay-floor-crate",
    instances,
    evidence: {
      intakeDigest: digest("e"),
      placementDigest: digestScenePlacements(resolved.value),
      artifactDigests: instances.map((instance) => ({
        instanceId: instance.instanceId,
        artifactDigest: digestSceneArtifact(instance.artifact),
      })),
      sceneDigest: digest("0"),
    },
  } satisfies ComposedScene;
  return {
    ...draft,
    evidence: { ...draft.evidence, sceneDigest: digestComposedScene(draft) },
  };
}

function advanced(seed = 4242, ticks = 8) {
  const session = openSceneKernelSession(sceneFixture(), { seed });
  const initial = session.observe();
  for (let tick = 1; tick <= ticks; tick += 1) {
    session.advance({ tick, deltaMs: 100 });
  }
  return { session, initial, terminal: session.observe() };
}

describe("scene kernel sessions", () => {
  it("opens one sub-session per instance in the scene's deterministic order", () => {
    const snapshot = openSceneKernelSession(sceneFixture(), { seed: 7 }).observe();
    expect(snapshot.sceneId).toBe("bay");
    expect(snapshot.instances.map((instance) => instance.instanceId)).toEqual([
      "bay-floor-crate",
      "bay-drone",
      "bay-stacked-crate",
    ]);
    expect(snapshot.instances.map((instance) => instance.artifactId)).toEqual([
      "crate-artifact",
      "drone-artifact",
      "crate-artifact",
    ]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.instances)).toBe(true);
  });

  it("places every instance at its scene world transform, not the artifact origin", () => {
    const snapshot = openSceneKernelSession(sceneFixture(), { seed: 7 }).observe();
    const rootTranslationOf = (instanceId: string) => {
      const instance = snapshot.instances.find(
        (candidate) => candidate.instanceId === instanceId,
      );
      const rootNode = instance?.snapshot.nodes.find(
        (node) => node.parentId === null,
      );
      return rootNode?.transform.translation;
    };
    expect(rootTranslationOf("bay-floor-crate")).toEqual([1, 0, 2]);
    expect(rootTranslationOf("bay-stacked-crate")).toEqual([1, 2, 2]);
    expect(rootTranslationOf("bay-drone")).toEqual([1, 6, 2]);

    // Child nodes keep their artifact-local transforms.
    const child = snapshot.instances[0]?.snapshot.nodes.find(
      (node) => node.parentId !== null,
    );
    expect(child?.transform.translation).toEqual([0, 1.5, 0]);

    // The embedded artifacts are untouched.
    expect(crateArtifact.runtimeHierarchy.nodes[0]?.transform).toEqual(identity);
  });

  it("advances every instance and accumulates scene-wide collisions", () => {
    const { initial, terminal } = advanced();
    expect(terminal.tick).toBe(8);
    expect(terminal.elapsedMs).toBe(800);
    expect(terminal.digest).not.toBe(initial.digest);
    expect(terminal.collisionCount).toBeGreaterThan(0);
    expect(terminal.collisionCount).toBe(
      terminal.instances.reduce(
        (total, instance) => total + instance.snapshot.collisionCount,
        0,
      ),
    );
    for (const instance of terminal.instances) {
      const before = initial.instances.find(
        (candidate) => candidate.instanceId === instance.instanceId,
      );
      const socket = instance.snapshot.sockets[0];
      const socketBefore = before?.snapshot.sockets[0];
      expect(socket).toBeDefined();
      expect(socket?.value).not.toBe(socketBefore?.value);
    }
  });

  it("gives instances of the same artifact independent derived seeds", () => {
    const { terminal } = advanced();
    const floor = terminal.instances.find(
      (instance) => instance.instanceId === "bay-floor-crate",
    );
    const stacked = terminal.instances.find(
      (instance) => instance.instanceId === "bay-stacked-crate",
    );
    expect(floor?.artifactId).toBe(stacked?.artifactId);
    expect(floor?.snapshot.seed).not.toBe(stacked?.snapshot.seed);
    expect(deriveSceneInstanceSeed(4242, "bay-floor-crate")).toBe(
      floor?.snapshot.seed,
    );
    expect(Number.isSafeInteger(deriveSceneInstanceSeed(0, "bay-drone"))).toBe(true);
  });

  it("is seed-deterministic and seed-sensitive", () => {
    expect(advanced(4242).terminal.digest).toBe(advanced(4242).terminal.digest);
    expect(advanced(4242).terminal.digest).not.toBe(advanced(99).terminal.digest);
  });

  it("saves and replays to the exact terminal digest", () => {
    const { session, terminal } = advanced();
    const save = session.save();
    expect(save).toMatchObject({
      schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
      kind: SCENE_KERNEL_SAVE_KIND,
    });
    expect(save.advances).toHaveLength(8);
    expect(replaySceneKernelSession(save).observe().digest).toBe(terminal.digest);

    expect(() =>
      replaySceneKernelSession({ ...save, terminalDigest: digest("f") }),
    ).toThrow(/scene replay digest mismatch/);
    expect(() =>
      replaySceneKernelSession({ ...save, kind: "sceneaxi.other" as never }),
    ).toThrow(/invalid scene save artifact kind/);
    expect(() =>
      replaySceneKernelSession({ ...save, schemaVersion: 2 as never }),
    ).toThrow(/scene save schema major mismatch/);
    expect(() =>
      replaySceneKernelSession({ ...save, terminalDigest: "not-a-digest" }),
    ).toThrow(/invalid scene save advances or terminal digest/);
  });

  it("refuses invalid scenes, seeds, and clocks", () => {
    expect(() => openSceneKernelSession({}, { seed: 1 })).toThrow(/Missing required field/);

    const scene = sceneFixture();
    expect(() =>
      openSceneKernelSession(
        { ...scene, evidence: { ...scene.evidence, sceneDigest: digest("f") } },
        { seed: 1 },
      ),
    ).toThrow(/sceneDigest does not bind/);

    expect(() => openSceneKernelSession(scene, { seed: 1.5 })).toThrow(
      /seed must be an integer/,
    );
    expect(() => openSceneKernelSession(scene, { seed: 1, gravity: 4 })).toThrow(
      /gravity must be a finite non-positive number/,
    );

    const session = openSceneKernelSession(scene, { seed: 1 });
    session.advance({ tick: 5, deltaMs: 10 });
    expect(() => session.advance({ tick: 5, deltaMs: 10 })).toThrow(
      /must be an integer greater than current tick 5/,
    );
    expect(() => session.advance({ tick: 6, deltaMs: -1 })).toThrow(
      /deltaMs must be a non-negative integer/,
    );
  });
});
