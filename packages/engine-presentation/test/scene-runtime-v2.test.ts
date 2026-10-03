import { BufferGeometry, Matrix4, Object3D } from "three";
import { describe, expect, it, vi } from "vitest";
import * as kernel from "@sceneaxi/engine-kernel";
import { composeSceneV2 } from "@sceneaxi/authoring-core";
import { createThreeSculptPresentationBackend, type ThreePresentationSurface, type ThreeRenderableHandle } from "@sceneaxi/engine-presentation";
import { SCENE_MAXIMUM_COMPONENT_MAGNITUDE, multiplySceneMatricesV2, sceneMatrixFromSculptTransformV2 } from "@sceneaxi/schemas";
import { sceneCompositionArtifactFixture, sceneCompositionTransformFixture as transform } from "@sceneaxi/schemas/testing/scene-composition";

function fixture() {
  const artifact = sceneCompositionArtifactFixture("crate");

  const result = composeSceneV2({ schemaVersion: 2, kind: "sceneaxi.scene-composition-intake", sceneId: "matrix-runtime", rootInstanceId: "root", placements: [
    { instanceId: "root", artifactId: "crate", parentInstanceId: null, transform: transform([1, 2, 3], [2, 3, 4], [0, 0, 90]) },
    { instanceId: "child", artifactId: "crate", parentInstanceId: "root", transform: transform([1, 0, 0], [1, 2, 1], [20, 30, 40]) },
  ] }, [artifact]);

  if (!result.ok) throw Error(result.message);

  return result.scene;
}

describe("public v2 scene runtime compatibility", () => {
  it("has actual kernel and Three consumers for public composition", () => {
    expect(kernel).toMatchObject({ openSceneKernelSessionV2: expect.any(Function), replaySceneKernelSessionV2: expect.any(Function) });
    const backend = createThreeSculptPresentationBackend();

    try { expect(backend).toMatchObject({ mountSceneV2: expect.any(Function), presentSceneV2: expect.any(Function) }); }
    finally { backend.dispose(); }

    expect(fixture().schemaVersion).toBe(2);
  });
});

function required<T>(value: T | undefined): T { if (value === undefined) throw Error("fixture entry missing");

 return value; }

function recorder() {
  let scene: Object3D | null = null;
  let disposed = false;

  const surface: ThreePresentationSurface = {
    kind: "headless", resize() {},
    draw(value: ThreeRenderableHandle) { if (!(value instanceof Object3D)) throw Error("not a Three object"); scene = value;

 return { drawCalls: 0, pixelsDrawn: false }; },
    capture() { return null; }, dispose() { disposed = true; },
  };

  return { surface, scene() { if (!scene) throw Error("draw not recorded");

 return scene; }, disposed() { return disposed; } };
}

function matrices(scene: Object3D) {
  const result: Record<string, number[]> = {};
  scene.traverse(object => { if (object.name === "root" || object.name === "child") {
    result[object.name] = [...object.matrixWorld.elements];

    for (const node of object.children) result[`${object.name}/${node.name}`] = [...node.matrixWorld.elements];
  } });

  return result;
}

describe("matrix-preserving live scene driver", () => {
  it("opens, advances, saves/reopens/replays and presents without decomposing shear", () => {
    const scene = fixture();
    const before = JSON.stringify(scene);
    const session = kernel.openSceneKernelSessionV2(scene, { seed: 42 });
    const original = session.observe();
    const recorded = recorder();
    const backend = createThreeSculptPresentationBackend({ surface: recorded.surface });

    try {
      backend.mountSceneV2(scene);
      backend.presentSceneV2(original);
      const initial = backend.render(["root", "child"]);
      expect(initial.pixelsDrawn).toBe(false);
      expect(backend.capture()).toBeNull();
      const child = required(scene.instances.find(instance => instance.instanceId === "child"));
      expect(matrices(recorded.scene())["child"]).toEqual(child.worldMatrix);
      expect(child.worldMatrix[0] * child.worldMatrix[4] + child.worldMatrix[1] * child.worldMatrix[5] + child.worldMatrix[2] * child.worldMatrix[6]).not.toBeCloseTo(0, 6);

      for (let tick = 1; tick <= 12; tick++) session.advance({ tick, deltaMs: 16 });
      const snapshot = session.observe();
      expect(snapshot.digest).not.toBe(original.digest);
      const save = JSON.parse(JSON.stringify(session.save()));
      const replay = kernel.replaySceneKernelSessionV2(save);
      expect(replay.observe()).toEqual(snapshot);
      expect(kernel.openSceneKernelSessionV2(save.scene, save.options).observe()).toEqual(original);
      backend.presentSceneV2(snapshot);
      backend.render(["root", "child"]);
      const drawn = matrices(recorded.scene());

      for (const instance of snapshot.instances) {
        const rootNode = required(instance.snapshot.nodes.find(node => node.parentId === null));
        expect(drawn[`${instance.instanceId}/${rootNode.id}`]).toEqual(rootNode.worldMatrix);
        expect(rootNode.worldMatrix).toEqual(multiplySceneMatricesV2(instance.worldMatrix, sceneMatrixFromSculptTransformV2(rootNode.transform)));
        const rootObject = recorded.scene().getObjectByName(instance.instanceId);

        if (!rootObject) throw Error("missing root");
        expect(rootObject.matrixAutoUpdate).toBe(false);

        for (const node of instance.snapshot.nodes) {
          const object = rootObject.getObjectByName(node.id);

          if (!object) throw Error("missing node");
          object.matrixWorld.elements.forEach((value, i) => expect(value).toBeCloseTo(required(node.worldMatrix[i]), 11));
        }
      }

      expect(JSON.stringify(scene)).toBe(before);
      expect(() => kernel.replaySceneKernelSessionV2({ ...save, terminalDigest: `sha256:${"a".repeat(64)}` })).toThrow("digest mismatch");
      expect(() => kernel.replaySceneKernelSessionV2({ ...save, schemaVersion: 1 })).toThrow("major mismatch");
      expect(() => kernel.replaySceneKernelSessionV2({ ...save, advances: [{ tick: 1, deltaMs: Infinity }] })).toThrow();
    } finally { backend.dispose(); }

    expect(recorded.disposed()).toBe(true);
  });

  it("refuses late world-bound overflow without changing any local instance or history", () => {
    const initial = kernel.openSceneKernelSessionV2(fixture(), { seed: 42, gravity: 0 });
    const root = required(initial.observe().instances.find(instance => instance.instanceId === "root"));
    const rootNode = required(root.snapshot.nodes.find(node => node.parentId === null));
    const direction = rootNode.velocity[0] > 0 ? 1 : -1;
    const artifact = sceneCompositionArtifactFixture("crate");

    const result = composeSceneV2({ schemaVersion: 2, kind: "sceneaxi.scene-composition-intake", sceneId: "bounds", rootInstanceId: "root", placements: [
      { instanceId: "root", artifactId: "crate", parentInstanceId: null, transform: transform([direction * (SCENE_MAXIMUM_COMPONENT_MAGNITUDE - 1), 0, 0]) },
      { instanceId: "child", artifactId: "crate", parentInstanceId: "root", transform: transform([-direction * 5, 0, 0]) },
    ] }, [artifact]);

    if (!result.ok) throw Error(result.message);
    const session = kernel.openSceneKernelSessionV2(result.scene, { seed: 42, gravity: 0 });
    const before = session.save();
    expect(() => session.advance({ tick: 1, deltaMs: 1000 })).toThrow("scene-v2 advance refused");
    expect(session.save()).toEqual(before);
    expect(session.observe().tick).toBe(0);
  });

  it("refuses malformed/cyclic/nonfinite scenes and accessor options without getter reads", () => {
    const scene = fixture();
    const first = required(scene.instances[0]);
    expect(() => kernel.openSceneKernelSessionV2({ ...scene, instances: [{ ...first, parentInstanceId: first.instanceId }, ...scene.instances.slice(1)] }, { seed: 1 })).toThrow("admission refused");
    expect(() => kernel.openSceneKernelSessionV2({ ...scene, instances: [{ ...first, worldMatrix: first.worldMatrix.map((value, i) => i === 12 ? NaN : value) }, ...scene.instances.slice(1)] }, { seed: 1 })).toThrow("admission refused");
    let reads = 0;

    const options = { get seed() { reads++;

 return 1; } };

    expect(() => kernel.openSceneKernelSessionV2(scene, options)).toThrow("descriptor");
    const session = kernel.openSceneKernelSessionV2(scene, { seed: 42 });
    const before = session.save();

    const clock = { get tick() { reads++;

 return 1; }, deltaMs: 16 };

    expect(() => session.advance(clock)).toThrow("descriptor");
    expect(session.save()).toEqual(before);
    expect(reads).toBe(0);
  });

  it.each(["duplicate", "matrix", "finite", "bounds", "cycle", "accessor"])("validates entire %s snapshot batch before changing any renderable", mode => {
    const scene = fixture();
    const session = kernel.openSceneKernelSessionV2(scene, { seed: 42 });
    const recorded = recorder();
    const backend = createThreeSculptPresentationBackend({ surface: recorded.surface });

    try {
      backend.mountSceneV2(scene); backend.presentSceneV2(session.observe()); backend.render(["root", "child"]);
      const before = matrices(recorded.scene());
      session.advance({ tick: 1, deltaMs: 16 });
      const value = JSON.parse(JSON.stringify(session.observe()));
      let reads = 0;
      const last = value.instances[1];

      if (mode === "duplicate") last.instanceId = value.instances[0].instanceId;

      if (mode === "matrix") last.snapshot.nodes[1].worldMatrix[12] += 1;

      if (mode === "finite") last.snapshot.nodes[1].transform.translation[0] = Infinity;

      if (mode === "bounds") last.bounds.max[0] += 1;

      if (mode === "cycle") {
        const root = last.snapshot.nodes.find((node: { parentId: string | null }) => node.parentId === null);
        const child = last.snapshot.nodes.find((node: { parentId: string | null }) => node.parentId !== null);

        if (!root || !child) throw Error("cycle fixture missing nodes");
        root.parentId = child.id;
      }

      if (mode === "accessor") Object.defineProperty(last.snapshot.nodes[1], "transform", { enumerable: true, get() { reads++; throw Error("getter read"); } });
      expect(() => backend.presentSceneV2(value)).toThrow("scene-v2 runtime presentation refused");
      backend.render(["root", "child"]);
      expect(matrices(recorded.scene())).toEqual(before);
      expect(reads).toBe(0);
      expect(() => backend.setInstancePoses([])).toThrow("matrix snapshots");
    } finally { backend.dispose(); }
  });

  it("cleans every candidate allocation on a late mount failure, preserving previous scene", () => {
    const recorded = recorder();
    const backend = createThreeSculptPresentationBackend({ surface: recorded.surface });

    try {
      backend.mountSceneV2(fixture()); backend.render(["root", "child"]);
      const before = matrices(recorded.scene());
      const dispose = vi.spyOn(BufferGeometry.prototype, "dispose");
      const original = Matrix4.prototype.fromArray;
      let count = 0;

      const failure = vi.spyOn(Matrix4.prototype, "fromArray").mockImplementation(function (this: Matrix4, array, offset) {
        count++;

        if (count === 6) throw Error("controlled final-instance matrix failure");

        return original.call(this, array, offset);
      });

      try { expect(() => backend.mountSceneV2(fixture())).toThrow("controlled final-instance"); }
      finally { failure.mockRestore(); }

      expect(dispose).toHaveBeenCalledTimes(4);
      dispose.mockRestore();
      backend.render(["root", "child"]);
      expect(matrices(recorded.scene())).toEqual(before);
      expect(() => backend.mountSceneV2({ schemaVersion: 99 })).toThrow("mount refused");
      backend.render(["root", "child"]); expect(matrices(recorded.scene())).toEqual(before);
    } finally { vi.restoreAllMocks(); backend.dispose(); }

    expect(() => backend.mountSceneV2(fixture())).toThrow("disposed");
    expect(() => backend.presentSceneV2({})).toThrow("disposed");
  });
});
