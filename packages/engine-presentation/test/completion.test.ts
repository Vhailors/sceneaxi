import { describe, expect, it } from "vitest";
import { createThreeSculptPresentationBackend, type ThreeTriangleAnimationClip, type ThreeTriangleAssetInput, type ThreeRenderableHandle } from "@sceneaxi/engine-presentation";
import { Mesh, MeshStandardMaterial, Scene, SkinnedMesh, Vector3 } from "three";

const matrix = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];

const node = { node: 0, parent: null, matrix, matrixAuthored: false, translation: [0,0,0], rotation: [0,0,0,1], scale: [1,1,1] };

const mesh = { meshId: "mesh", nodeIndex: 0, positions: [0,0,0, 1,0,0, 0,1,0], indices: [0,1,2], matrix, baseColor: "#ffffff", metallic: 0, roughness: 1, uvs: [0,0, 1,0, 0,1] };

const input: ThreeTriangleAssetInput = { instanceId: "triangle", transform: { translation: [0,0,0], rotationEulerDegrees: [0,0,0], scale: [1,1,1] }, nodes: [node], meshes: [mesh] };

function capture() {
  let object: Mesh | undefined;

  const surface = { kind: "headless" as const, resize() {}, capture() { return null; }, dispose() {}, draw(scene: ThreeRenderableHandle) {
      if (!(scene instanceof Scene)) throw Error("Expected a Three scene from the backend.");
      const found = scene.getObjectByName("mesh");

      if (!(found instanceof Mesh)) throw Error("Expected the constructed triangle mesh.");
      object = found;

 return { drawCalls: 1, pixelsDrawn: false }; } };

  return { surface, object: () => { if (!object) throw Error("Missing rendered mesh");

 return object; } };
}

describe("completed numeric asset playback", () => {
  it("samples glTF cubic Hermite translation and normalized quaternion, refuses incomplete cubic data transactionally", () => {
    const captured = capture(), b = createThreeSculptPresentationBackend({ surface: captured.surface }); b.mountTriangleAsset(input);
    const clip: ThreeTriangleAnimationClip = { name: "cubic", duration: 2, channels: [{ node: 0, path: "translation" as const, interpolation: "CUBICSPLINE", times: [0,2], values: [0,0,0, 0,0,0, 2,0,0, 0,0,0, 2,0,0, 0,0,0] }] };
    b.playTriangleAnimation("triangle", clip, 1); b.render(["triangle"]);
    expect(captured.object().parent?.position.x).toBe(1.5);
    expect(() => b.playTriangleAnimation("triangle", { ...clip, channels: [{ ...requireValue(clip.channels[0]), values: [0,0,0] }] }, 0)).toThrow();
    b.render(["triangle"]); expect(captured.object().parent?.position.x).toBe(1.5);
    b.resetTriangleAnimation("triangle"); b.render(["triangle"]); expect(captured.object().parent?.position.x).toBe(0); b.dispose();
  });
  it("binds a numeric skeleton and animates weighted vertices without exposing bones publicly", () => {
    const captured = capture(), b = createThreeSculptPresentationBackend({ surface: captured.surface });
    const skin = { joints: [0], inverseBindMatrices: matrix, jointIndices: [0,0,0,0, 0,0,0,0, 0,0,0,0], weights: [1,0,0,0, 1,0,0,0, 1,0,0,0] };
    b.mountTriangleAsset({ ...input, nodes: [node, { ...node, node: 1 }], meshes: [{ ...mesh, nodeIndex: 1, skin }] });
    b.playTriangleAnimation("triangle", { name: "bone", duration: 1, channels: [{ node: 0, path: "translation", interpolation: "LINEAR", times: [0,1], values: [0,0,0, 3,0,0] }] }, 1); b.render(["triangle"]);
    const object = captured.object(); expect(object).toBeInstanceOf(SkinnedMesh);

    if (!(object instanceof SkinnedMesh)) throw Error("Skeleton not bound");
    expect(object.applyBoneTransform(0, new Vector3(0,0,0)).x).toBe(3);
    expect(() => b.mountTriangleAsset({ ...input, meshes: [{ ...mesh, skin: { ...skin, jointIndices: [99,...skin.jointIndices.slice(1)] } }] })).toThrow();
    b.render(["triangle"]); expect(captured.object()).toBe(object); b.dispose();
  });
  it("resolves contained catalog texture slots as a full transaction and restores the original map", () => {
    const captured = capture(), b = createThreeSculptPresentationBackend({ surface: captured.surface }); b.mountTriangleAsset(input);
    const override = { instanceId: "triangle", baseColorMapAssetId: "checker", normalMapAssetId: null, roughnessMapAssetId: null, emissiveColor: "#000000", emissiveIntensity: 1, opacity: 1 };
    const texture = { assetId: "checker", width: 1, height: 1, rgba: [255,0,0,255] };
    b.setMaterialOverrides([override], [texture]); b.render(["triangle"]);
    const material = captured.object().material;

    if (!(material instanceof MeshStandardMaterial)) throw Error("Expected the backend triangle material."); expect(material.map).not.toBeNull(); const before = material.map;
    expect(() => b.setMaterialOverrides([{ ...override, normalMapAssetId: "missing" }], [texture])).toThrow();
    expect(material.map).toBe(before);
    b.setMaterialOverrides([]); expect(material.map).toBeNull(); b.dispose();
  });
});

it("evaluates cubic quaternion value keys without treating derivative tangents as unit rotations", () => {
  const captured = capture(), b = createThreeSculptPresentationBackend({ surface: captured.surface }); b.mountTriangleAsset(input);
  const rotation: ThreeTriangleAnimationClip = { name: "rotation", duration: 1, channels: [{ node: 0, path: "rotation" as const, interpolation: "CUBICSPLINE", times: [0,1], values: [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0] }] };
  b.playTriangleAnimation("triangle", rotation, 0.5); b.render(["triangle"]);
  expect(captured.object().parent?.quaternion.z).toBeCloseTo(Math.SQRT1_2);
  expect(captured.object().parent?.quaternion.w).toBeCloseTo(Math.SQRT1_2);
  b.dispose();
});

it("prevalidates full solver pose batches before changing any mounted instance", () => {
  const captured = capture(), b = createThreeSculptPresentationBackend({ surface: captured.surface }); b.mountTriangleAsset(input); b.mountTriangleAsset({ ...input, instanceId: "other" });
  b.setInstancePoses([{ instanceId: "triangle", translation: [3,2,1], rotation: [0,0,0,1] }]); b.render(["triangle"]);
  const object = captured.object().parent?.parent;
  expect(object?.position.toArray()).toEqual([3,2,1]);
  expect(() => b.setInstancePoses([{ instanceId: "triangle", translation: [4,2,1], rotation: [0,0,0,1] }, { instanceId: "missing", translation: [0,0,0], rotation: [0,0,0,1] }])).toThrow();
  b.render(["triangle"]); expect(object?.position.toArray()).toEqual([3,2,1]); b.dispose();
  expect(() => b.setInstancePoses([])).toThrow(/disposed/);
});

it("rejects malformed node rotations and catalog maps on missing UVs before replacing visible data", () => {
  const captured=capture(), b=createThreeSculptPresentationBackend({surface:captured.surface});b.mountTriangleAsset(input);b.render(["triangle"]);const object=captured.object();
  expect(() => b.mountTriangleAsset({...input,nodes:[{...node,rotation:[0,0,0,0]}]})).toThrow();
  const noUV={...mesh,uvs:undefined};

    // SAFETY: this fixture deliberately supplies an undefined optional UV member; the backend treats it as absent and validates all required triangle fields.
    b.mountTriangleAsset({...input,meshes:[noUV]} as never);
  const override={instanceId:"triangle",baseColorMapAssetId:"texture",normalMapAssetId:null,roughnessMapAssetId:null,emissiveColor:"#000000",emissiveIntensity:1,opacity:1};
  expect(() => b.setMaterialOverrides([override],[{assetId:"texture",width:1,height:1,rgba:[255,0,0,255]}])).toThrow(/UV/);
  b.render(["triangle"]);expect(captured.object().material).toHaveProperty("map",null);expect(captured.object()).not.toBe(object);b.dispose();
});

function requireValue<T>(value: T | undefined): T {
  if (value === undefined) throw Error("Required constructed fixture value is absent.");

  return value;
}
