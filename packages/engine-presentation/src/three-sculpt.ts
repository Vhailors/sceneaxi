/**
 * Sculpt Mount backend on the Three presentation core.
 *
 * Given a canvas it draws mounted Sculpt Artifacts as real pixels through a
 * `WebGLRenderer`; with no canvas it uses the deterministic headless surface for
 * node gates. Either way no Three type crosses the Mount API seam.
 */
import {
  Bone,
  Matrix4,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Box3,
  BoxGeometry,
  DataTexture,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  Sphere,
  SphereGeometry,
  SRGBColorSpace,
  Uint32BufferAttribute,
  RGBAFormat,
  UnsignedByteType,
  RepeatWrapping,
  type Material,
  Object3D,
} from "three";
import { SCENE_MAXIMUM_COMPONENT_MAGNITUDE, sceneMatrixFromSculptTransformV2, validateComposedSceneV2, type ComposedSceneV2, isSculptIdentifier, isSculptTransform, validateSculptArtifact, type AssetRenderMesh, type SceneEffectsCatalog, type SceneEffectsEvaluation, type SceneMaterialOverride, type SculptComponent, type SculptMaterial, type SculptTransform } from "@sceneaxi/schemas";
import { resolveScenePresentationV2, resolveSceneRuntimePresentationV2 } from "./scene-transforms.js";
import { evaluateTriangleAnimation, type ThreeTriangleAnimationClip } from "./triangle-animation.js";
import type { OrbitCameraControls } from "./orbit-camera.js";
import {
  createInternalThreePresentationCore,
  disposeSubtree,
  type ThreePresentationCoreOptions,
  type ThreeSceneEnvironment,
} from "./three-core.js";
import type { ThreePresentationSurfaceKind } from "./three-surface.js";
import type {
  SculptMountedInstance,
  SculptPresentationBackend,
} from "./sculpt-mount.js";

/** Sculpt backend plus the browser-facing controls the Mount API does not carry. */
export interface ThreeSculptPresentationBackend extends SculptPresentationBackend {
  readonly surface: ThreePresentationSurfaceKind;
  /** Orbit/zoom control surface for the open-path consumer. */
  readonly camera: OrbitCameraControls;
  resize(width: number, height: number, pixelRatio?: number): void;
  /** PNG bytes of the last drawn frame, or null on a surface that draws no pixels. */
  capture(): Uint8Array | null;
  /** Points the camera at the bounding sphere of everything currently mounted. */
  frameMountedContent(): void;
  /**
   * Replace one validated Sculpt proxy with its contained triangle projection.
   * The same Three core, scene root, camera, surface, and frame counter remain
   * authoritative; this is not a second renderer or a loader side channel.
   */
  mountTriangleAsset(input: ThreeTriangleAssetInput): void;
  playTriangleAnimation(instanceId: string, clip: ThreeTriangleAnimationClip, time: number): void;
  resetTriangleAnimation(instanceId: string): void;
  setEnvironment(environment: ThreeSceneEnvironment): void;
  /** Full validated solver poses; presentation-only, never writes authoring bytes. */
  /** Transactional schema-2 admission; instance roots retain their shear matrices. */
  mountSceneV2(scene: unknown): void;
  /** Read-only kernel snapshot driver; validates all nodes before changing any. */
  presentSceneV2(snapshot: unknown): void;
  setInstancePoses(poses: readonly ThreeInstancePose[]): void;
  setMaterialOverrides(overrides: readonly SceneMaterialOverride[], textures?: readonly ThreeContainedTexture[]): void;
  sampleEffects(catalog: SceneEffectsCatalog, timeMs: number): SceneEffectsEvaluation;
}

/** Decoded contained RGBA; no URLs, loaders, host objects or encoded format assumptions. */
export type ThreeContainedTexture = Readonly<{ assetId: string; width: number; height: number; rgba: readonly number[] }>;

/** glTF joint indices index the joints list, not the node list. Four weights per vertex. */
export type ThreeTrianglePrimitiveInput = AssetRenderMesh & Readonly<{ skin?: Readonly<{
  joints: readonly number[]; inverseBindMatrices: readonly number[];
  jointIndices: readonly number[]; weights: readonly number[];
}> }>;

export type ThreeInstancePose = Readonly<{ instanceId: string; translation: readonly [number, number, number]; rotation: readonly [number, number, number, number] }>;

export type ThreeTriangleNodeInput = Readonly<{ node: number; parent: number | null; matrix: readonly number[]; matrixAuthored: boolean; translation: readonly number[]; rotation: readonly number[]; scale: readonly number[] }>;

export type ThreeTriangleAssetInput = Readonly<{
  instanceId: string;
  transform: SculptTransform;
  meshes: readonly ThreeTrianglePrimitiveInput[];
  nodes?: readonly ThreeTriangleNodeInput[];
}>;

function radians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function applyTransform(object: Object3D, transform: SculptTransform) {
  object.position.set(...transform.translation);
  const [x, y, z] = transform.rotationEulerDegrees;
  object.rotation.set(radians(x), radians(y), radians(z));
  object.scale.set(...transform.scale);
}

function geometryFor(component: SculptComponent): BufferGeometry {
  const [x, y, z] = component.dimensions;

  switch (component.primitive) {
    case "box":
      return new BoxGeometry(x, y, z);
    case "cylinder":
      return new CylinderGeometry(x / 2, z / 2, y, 16);
    case "sphere":
      return new SphereGeometry(Math.max(x, y, z) / 2, 16, 12);
  }
}

function materialFor(material: SculptMaterial): Material {
  return new MeshStandardMaterial({
    color: material.baseColor,
    metalness: material.metallic,
    roughness: material.roughness,
  });
}

function buildInstance(instance: SculptMountedInstance, matrixScene = false) {
  if (!instance || !isSculptIdentifier(instance.instanceId) || !isSculptTransform(instance.transform) || ![instance.transform.translation, instance.transform.rotationEulerDegrees, instance.transform.scale].every(v => finiteArray(v, 3) && v.length === 3)) throw new Error("Invalid sculpt instance transform.");
    const validated = validateSculptArtifact(instance.artifact);

    if (!validated.ok || validated.value.artifactId !== instance.artifactId) throw new Error("Invalid sculpt instance artifact.");
    instance = { ...instance, artifact: validated.value };

    if (instance.artifact.runtimeHierarchy.nodes.length > 4096 || instance.artifact.spec.components.length > 4096 || instance.artifact.spec.materials.length > 4096) throw new Error("Sculpt instance capacity exceeded.");

    for (const node of instance.artifact.runtimeHierarchy.nodes) {
      if (![node.transform.translation, node.transform.rotationEulerDegrees, node.transform.scale].every(v => finiteArray(v, 3, matrixScene ? SCENE_MAXIMUM_COMPONENT_MAGNITUDE : 1_000_000) && v.length === 3)) throw new Error("Invalid sculpt node transform.");
    }

    for (const component of instance.artifact.spec.components) {
      if (!finiteArray(component.dimensions, 3, matrixScene ? SCENE_MAXIMUM_COMPONENT_MAGNITUDE : 1_000_000) || component.dimensions.length !== 3) throw new Error("Invalid sculpt component dimensions.");
    }

    const root = new Group();
  root.name = instance.instanceId;
  applyTransform(root, instance.transform);
  const components = new Map(instance.artifact.spec.components.map((component) => [component.id, component]));
  const materials = new Map(instance.artifact.spec.materials.map((material) => [material.id, material]));
  const nodes = new Map<string, Object3D>();
    const cleanup: Array<() => void> = [];

    try {
  for (const node of instance.artifact.runtimeHierarchy.nodes) {
    const component = components.get(node.componentId);

    if (component === undefined) throw new Error(`Validated sculpt component "${node.componentId}" disappeared.`);
    const material = materials.get(component.materialId);

    if (material === undefined) throw new Error(`Validated sculpt material "${component.materialId}" disappeared.`);
    const geometry = geometryFor(component);
      cleanup.push(() => geometry.dispose());
      const surfaceMaterial = materialFor(material);
      cleanup.push(() => surfaceMaterial.dispose());
      const mesh = new Mesh(geometry, surfaceMaterial);
    mesh.name = node.id;
    if (matrixScene) {
      mesh.matrix.fromArray([...sceneMatrixFromSculptTransformV2(node.transform)]);
      mesh.matrixAutoUpdate = false;
    } else applyTransform(mesh, node.transform);
    nodes.set(node.id, mesh);
  }

  for (const node of instance.artifact.runtimeHierarchy.nodes) {
    const object = nodes.get(node.id);

    if (object === undefined) continue;

    if (node.parentId === null) root.add(object);
    else nodes.get(node.parentId)?.add(object);
  }

  return root;
    } catch (error) {
      for (const dispose of cleanup) dispose();
      root.clear();
      throw error;
    }
}

function finiteArray(value: readonly number[], multiple: number, maximum = 1_000_000) {
  return Array.isArray(value) && value.length > 0 && value.length <= 3_000_000 && value.length % multiple === 0 && Array.from(value).every((n) => Number.isFinite(n) && Math.abs(n) <= maximum);
}

function validateTriangleAsset(input: ThreeTriangleAssetInput) {
  if (!input || !isSculptIdentifier(input.instanceId) || !Array.isArray(input.meshes) || input.meshes.length === 0 || input.meshes.length > 4096) throw new Error("Invalid triangle asset batch.");
  const transform = input.transform;

  if (!transform || !isSculptTransform(transform) || ![transform.translation, transform.rotationEulerDegrees, transform.scale].every((v) => finiteArray(v, 3) && v.length === 3)) throw new Error("Invalid triangle asset transform.");

  if (input.nodes !== undefined && (!Array.isArray(input.nodes) || input.nodes.length > 4096)) throw new Error("Invalid triangle nodes.");
  const nodes = new Map<number, ThreeTriangleNodeInput>();

  for (const node of input.nodes ?? []) {
    if (!node || !Number.isSafeInteger(node.node) || node.node < 0 || nodes.has(node.node) ||
        (node.parent !== null && (!Number.isSafeInteger(node.parent) || node.parent < 0)) ||
        !isMatrixFlag(node.matrixAuthored) || !finiteArray(node.matrix, 16) || node.matrix.length !== 16 ||
        !finiteArray(node.translation, 3) || node.translation.length !== 3 || !finiteArray(node.rotation, 4) || node.rotation.length !== 4 || !finiteArray(node.scale, 3) || node.scale.length !== 3 || Math.abs(Math.hypot(...node.rotation)-1) > 0.00001) throw new Error("Invalid triangle node.");
    nodes.set(node.node, node);
  }

  for (const node of nodes.values()) {
    const seen = new Set<number>();
    let current: ThreeTriangleNodeInput | undefined = node;

    while (current !== undefined) {
      if (seen.has(current.node)) throw new Error("Cyclic triangle nodes.");
      seen.add(current.node);

      if (seen.size > 256) throw Error("Triangle node depth capacity exceeded.");

      if (current.parent === null) break;
      current = nodes.get(current.parent);

      if (current === undefined) throw new Error("Disconnected triangle node.");
    }
  }

  const ids = new Set<string>();
  let values = 0;

  for (const mesh of input.meshes) {
    if (!mesh || !isMeshName(mesh.meshId) || mesh.meshId.length === 0 || mesh.meshId.length > 128 || ids.has(mesh.meshId) || !finiteArray(mesh.positions, 3) ||
        !Array.isArray(mesh.indices) || mesh.indices.length > 3_000_000 || !Array.isArray(mesh.matrix) ||
        (nodes.size > 0 && (mesh.nodeIndex === undefined || !nodes.has(mesh.nodeIndex)))) throw new Error("Invalid triangle mesh.");
    ids.add(mesh.meshId);
    values += mesh.positions.length + mesh.indices.length + (mesh.normals?.length ?? 0) + (mesh.uvs?.length ?? 0) + (mesh.baseColorTexture?.rgba.length ?? 0);

    if (values > 8_000_000) throw new Error("Triangle asset resource capacity exceeded.");
    validateTriangleMesh(mesh);

    if (mesh.skin !== undefined) {
      const skin = mesh.skin, count = mesh.positions.length / 3;

      if (!Array.isArray(skin.joints) || skin.joints.length === 0 || skin.joints.length > 256 || new Set(skin.joints).size !== skin.joints.length || !Array.from(skin.joints).every(id => isNumericIndex(id) && nodes.has(id)) || !finiteArray(skin.inverseBindMatrices, 16) || skin.inverseBindMatrices.length !== skin.joints.length * 16 || !Array.isArray(skin.jointIndices) || skin.jointIndices.length !== count * 4 || !Array.from(skin.jointIndices).every(id => isNumericIndex(id) && Number.isSafeInteger(id) && id >= 0 && id < skin.joints.length) || !finiteArray(skin.weights, 4) || skin.weights.length !== count * 4 || skin.weights.some((w: number) => w < 0 || w > 1)) throw Error("Invalid bounded triangle skin.");

      for (let i = 0; i < skin.weights.length; i += 4) if (Math.abs(skin.weights.slice(i,i+4).reduce((sum: number,w: number) => sum+w,0)-1) > 0.00001) throw Error("Skin weights must sum to one.");
      values += skin.jointIndices.length + skin.weights.length + skin.inverseBindMatrices.length;

      if (values > 8_000_000) throw Error("Triangle skin capacity exceeded.");
    }
  }
}

function validateTriangleMesh(mesh: ThreeTrianglePrimitiveInput) {
  const vertexCount = mesh.positions.length / 3;

  if (!finiteArray(mesh.positions, 3) ||
      (mesh.normals !== undefined && (!finiteArray(mesh.normals, 3) || mesh.normals.length !== mesh.positions.length)) ||
      (mesh.uvs !== undefined && (!finiteArray(mesh.uvs, 2) || mesh.uvs.length !== vertexCount * 2)) ||
      (mesh.baseColorTexture !== undefined && (!mesh.baseColorTexture || !Number.isSafeInteger(mesh.baseColorTexture.width) || mesh.baseColorTexture.width <= 0 || mesh.baseColorTexture.width > 4096 || !Number.isSafeInteger(mesh.baseColorTexture.height) || mesh.baseColorTexture.height <= 0 || mesh.baseColorTexture.height > 4096 || mesh.baseColorTexture.width * mesh.baseColorTexture.height * 4 > 4 * 1024 * 1024 || !Array.isArray(mesh.baseColorTexture.rgba) || mesh.baseColorTexture.rgba.length !== mesh.baseColorTexture.width * mesh.baseColorTexture.height * 4 || !Array.from(mesh.baseColorTexture.rgba).every((v) => Number.isInteger(v) && v >= 0 && v <= 255) || mesh.uvs === undefined)) ||
      mesh.indices.length === 0 || mesh.indices.length % 3 !== 0 || Array.from(mesh.indices).some((v) => !Number.isSafeInteger(v) || v < 0 || v >= vertexCount) || !finiteArray(mesh.matrix, 16) || mesh.matrix.length !== 16 || !/^#[0-9a-f]{6}$/i.test(mesh.baseColor) || !Number.isFinite(mesh.metallic) || mesh.metallic < 0 || mesh.metallic > 1 || !Number.isFinite(mesh.roughness) || mesh.roughness < 0 || mesh.roughness > 1) throw new Error(`Contained triangle mesh "${mesh.meshId}" is invalid.`);
}

function buildTriangleAsset(input: ThreeTriangleAssetInput) {
  validateTriangleAsset(input);

  if (input.meshes.length === 0) {
    throw new Error("A contained triangle asset must carry at least one mesh.");
  }

  const root = new Group();
  root.name = input.instanceId;
  applyTransform(root, input.transform);
  const cleanup: Array<() => void> = [];

    try {
    const nodeGroups = new Map<number, Bone>();

  for (const node of input.nodes ?? []) {
    const group = new Bone();
    group.name = `gltf-node-${String(node.node)}`;

    if (node.matrixAuthored) {
      group.matrix.fromArray([...node.matrix]);
      group.matrixAutoUpdate = false;
    } else {
      group.position.set(node.translation[0] ?? 0, node.translation[1] ?? 0, node.translation[2] ?? 0);
      group.quaternion.set(node.rotation[0] ?? 0, node.rotation[1] ?? 0, node.rotation[2] ?? 0, node.rotation[3] ?? 1);
      group.scale.set(node.scale[0] ?? 1, node.scale[1] ?? 1, node.scale[2] ?? 1);
    }

    nodeGroups.set(node.node, group);
  }

  for (const node of input.nodes ?? []) {
    const group = nodeGroups.get(node.node);

    if (group === undefined) continue;
    const parent = node.parent === null ? root : nodeGroups.get(node.parent);
    parent?.add(group);
  }

  for (const mesh of input.meshes) {
    const geometry = new BufferGeometry();
      cleanup.push(() => geometry.dispose());
    geometry.setAttribute("position", new Float32BufferAttribute(mesh.positions, 3));
    geometry.setIndex(new Uint32BufferAttribute(mesh.indices, 1));

    if (mesh.normals === undefined) geometry.computeVertexNormals();
    else geometry.setAttribute("normal", new Float32BufferAttribute(mesh.normals, 3));

    if (mesh.uvs !== undefined) geometry.setAttribute("uv", new Float32BufferAttribute(mesh.uvs, 2));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const texture = mesh.baseColorTexture === undefined ? undefined : new DataTexture(
      new Uint8Array(mesh.baseColorTexture.rgba),
      mesh.baseColorTexture.width,
      mesh.baseColorTexture.height,
      RGBAFormat,
      UnsignedByteType,
    );

    if (texture !== undefined) {
      cleanup.push(() => texture.dispose());
      texture.colorSpace = SRGBColorSpace;
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.magFilter = LinearFilter;
      texture.minFilter = LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.needsUpdate = true;
    }

    const material = new MeshStandardMaterial({
      color: mesh.baseColor,
      metalness: mesh.metallic,
      roughness: mesh.roughness,
    });

    cleanup.push(() => material.dispose());

      if (texture !== undefined) material.map = texture;
    const object = mesh.skin === undefined ? new Mesh(geometry, material) : new SkinnedMesh(geometry, material);

    if (object instanceof SkinnedMesh && mesh.skin !== undefined) {
      geometry.setAttribute("skinIndex", new Uint16BufferAttribute(mesh.skin.jointIndices, 4));
      geometry.setAttribute("skinWeight", new Float32BufferAttribute(mesh.skin.weights, 4));

      const bones = mesh.skin.joints.map(id => { const bone = nodeGroups.get(id);

 if (!bone) throw Error("Validated skin joint disappeared");

 return bone; });

      const inverses = bones.map((_, i) => new Matrix4().fromArray(mesh.skin?.inverseBindMatrices.slice(i*16,i*16+16) ?? []));
      const skeleton = new Skeleton(bones, inverses);
      cleanup.push(() => skeleton.dispose());
      object.bind(skeleton, new Matrix4());
      // Animated bounds must not be cached from the rest pose.
      object.frustumCulled = false;
    }

    object.name = mesh.meshId;

    if ((input.nodes?.length ?? 0) > 0 && mesh.nodeIndex !== undefined) {
      object.matrix.identity();
      object.matrixAutoUpdate = false;
      nodeGroups.get(mesh.nodeIndex)?.add(object);
    } else {
      object.matrix.fromArray([...mesh.matrix]);
      object.matrixAutoUpdate = false;
      root.add(object);
    }
  }

  root.updateMatrixWorld(true);

  return root;
    } catch (error) {
      for (const dispose of cleanup) dispose();
      root.clear();
      throw error;
    }
}

/**
 * Creates the Three Sculpt Mount backend.
 *
 * Pass `canvas` for the real browser path (`WebGLRenderer`, perspective camera,
 * orbit/zoom controls, PNG capture). Pass nothing for the headless gate surface,
 * which flushes matrices and reports the meshes a renderer would draw without
 * claiming pixels.
 */
export function createThreeSculptPresentationBackend(
  options: ThreePresentationCoreOptions = {},
): ThreeSculptPresentationBackend {
  const core = createInternalThreePresentationCore(options);
  const roots = new Map<string, Group>();
  const importedNodes = new Map<string, ReadonlyMap<number, Object3D>>();
  const importedNodeDefaults = new Map<string, ReadonlyMap<number, ThreeTriangleNodeInput>>();
  let overrides = new Map<string, SceneMaterialOverride>();
  let resolvedTextures = new Map<string, DataTexture>();
  const originalMaps = new WeakMap<MeshStandardMaterial, { map: MeshStandardMaterial["map"]; normalMap: MeshStandardMaterial["normalMap"]; roughnessMap: MeshStandardMaterial["roughnessMap"] }>();
  let disposed = false;

  function requireLive() {
    if (disposed) throw new Error("Three sculpt backend is disposed.");
  }

  function validateRootTextures(root: Group, override: SceneMaterialOverride | undefined) {
    if (override && [override.baseColorMapAssetId,override.normalMapAssetId,override.roughnessMapAssetId].some(id => id !== null)) root.traverse(object => {
      if (object instanceof Mesh && !object.geometry.hasAttribute("uv")) throw Error("Catalog texture requires UV coordinates.");
    });
  }

  function applyMaterialOverride(root: Group, override: SceneMaterialOverride | undefined) {
    validateRootTextures(root, override);
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];

      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        let original = originalMaps.get(material);

        if (!original) { original = { map: material.map, normalMap: material.normalMap, roughnessMap: material.roughnessMap }; originalMaps.set(material, original); }

        const map = override?.baseColorMapAssetId == null ? original.map : resolvedTextures.get(override.baseColorMapAssetId) ?? null;
        const normalMap = override?.normalMapAssetId == null ? original.normalMap : resolvedTextures.get(override.normalMapAssetId) ?? null;
        const roughnessMap = override?.roughnessMapAssetId == null ? original.roughnessMap : resolvedTextures.get(override.roughnessMapAssetId) ?? null;

        if (material.map !== map || material.normalMap !== normalMap || material.roughnessMap !== roughnessMap) material.needsUpdate = true;
        material.map = map; material.normalMap = normalMap; material.roughnessMap = roughnessMap;
        material.emissive.set(override?.emissiveColor ?? "#000000");
        material.emissiveIntensity = override?.emissiveIntensity ?? 1;
        material.opacity = override?.opacity ?? 1;
        const transparent = material.opacity < 1;

        if (material.transparent !== transparent) material.needsUpdate = true;
        material.transparent = transparent;
        material.depthWrite = !transparent;
      }
    });
  }

  function disposeRoot(root: Group) { applyMaterialOverride(root, undefined); disposeSubtree(root); }

  let sceneSourceV2: ComposedSceneV2 | null = null;

  function replace(instance: SculptMountedInstance) {
    requireLive();

    if (!roots.has(instance.instanceId) && roots.size >= 4096) throw new Error("Sculpt mount capacity exceeded.");
      if (sceneSourceV2 !== null) throw Error("scene-v2 mount requires whole-scene replacement");
    const next = buildInstance(instance);

    try { applyMaterialOverride(next, overrides.get(instance.instanceId)); } catch (error) { disposeRoot(next); throw error; }

    const previous = roots.get(instance.instanceId);

    if (!roots.has(instance.instanceId) && roots.size >= 4096) { disposeSubtree(next); throw new Error("Sculpt mount capacity exceeded."); }

    if (previous !== undefined) {
      core.content.remove(previous);
      disposeRoot(previous);
    }

    importedNodes.delete(instance.instanceId);
      importedNodeDefaults.delete(instance.instanceId);
      roots.set(instance.instanceId, next);
    core.content.add(next);
  }

  function resetImportedNodes(instanceId: string) {
    const nodes = importedNodes.get(instanceId);
    const defaults = importedNodeDefaults.get(instanceId);

    if (nodes === undefined || defaults === undefined) return;

    for (const [node, group] of nodes) {
      const base = defaults.get(node);

      if (base === undefined || base.matrixAuthored) continue;
      group.position.set(base.translation[0] ?? 0, base.translation[1] ?? 0, base.translation[2] ?? 0);
      group.quaternion.set(base.rotation[0] ?? 0, base.rotation[1] ?? 0, base.rotation[2] ?? 0, base.rotation[3] ?? 1);
      group.scale.set(base.scale[0] ?? 1, base.scale[1] ?? 1, base.scale[2] ?? 1);
    }
  }

  function updateTransform(instance: SculptMountedInstance) {
    requireLive();
    if (sceneSourceV2 !== null) throw Error("scene-v2 updates require matrix snapshots");
    const root = roots.get(instance.instanceId);

    if (root === undefined) {
      throw new Error(`Mounted sculpt instance "${instance.instanceId}" disappeared.`);
    }

    if (!isSculptTransform(instance.transform) || ![instance.transform.translation, instance.transform.rotationEulerDegrees, instance.transform.scale].every(v => finiteArray(v, 3) && v.length === 3)) throw new Error("Invalid sculpt update transform.");
      applyTransform(root, instance.transform);
  }

  return {
    id: "three",
    label: core.label,
    surface: core.surfaceKind,
    camera: core.camera,
    setEnvironment: core.setEnvironment,
    mountSceneV2(value) {
      requireLive();
      const placement = resolveScenePresentationV2(value);
      const source = validateComposedSceneV2(value);
      if (!placement.ok || !source.ok) throw Error(`scene-v2 mount refused: ${!source.ok ? source.diagnostics[0]?.message : !placement.ok ? placement.diagnostics[0]?.message : "invalid scene"}`);
      const candidate = new Map<string, Group>();
      try {
        for (const instance of source.value.instances) {
          const identity: SculptTransform = { translation: [0,0,0], rotationEulerDegrees: [0,0,0], scale: [1,1,1] };
          const root = buildInstance({ instanceId: instance.instanceId, artifactId: instance.artifactId, artifact: instance.artifact, transform: identity }, true);
          candidate.set(instance.instanceId, root);
          root.matrix.fromArray([...instance.worldMatrix]); root.matrixAutoUpdate = false;
          applyMaterialOverride(root, overrides.get(instance.instanceId));
        }
      } catch (error) {
        for (const root of candidate.values()) disposeRoot(root);
        throw Error(`scene-v2 mount refused: ${error instanceof Error ? error.message : "allocation failure"}`, { cause: error });
      }
      for (const root of roots.values()) { core.content.remove(root); disposeRoot(root); }
      roots.clear(); importedNodes.clear(); importedNodeDefaults.clear();
      for (const [id, root] of candidate) { roots.set(id, root); core.content.add(root); }
      sceneSourceV2 = source.value;
      core.content.updateMatrixWorld(true);
    },
    presentSceneV2(value) {
      requireLive();
      if (sceneSourceV2 === null) throw Error("scene-v2 presentation requires an admitted scene");
      const resolved = resolveSceneRuntimePresentationV2(sceneSourceV2, value);
      if (!resolved.ok) throw Error(resolved.diagnostics[0]?.message ?? "scene-v2 invalid runtime snapshot");
      const plan = resolved.value.instances.map(instance => {
        const root = roots.get(instance.instanceId);
        if (!root) throw Error("scene-v2 mounted instance disappeared");
        const targets = new Map<string, Object3D>();
        root.traverse(object => { if (object !== root) targets.set(object.name, object); });
        const nodes = instance.nodes.map(node => {
          const target = targets.get(node.id);
          if (!target) throw Error("scene-v2 mounted node disappeared");
          return { target, localMatrix: node.localMatrix };
        });
        return { root, matrix: instance.worldMatrix, nodes };
      });
      for (const instance of plan) {
        instance.root.matrix.fromArray([...instance.matrix]); instance.root.matrixAutoUpdate = false;
        for (const node of instance.nodes) { node.target.matrix.fromArray([...node.localMatrix]); node.target.matrixAutoUpdate = false; }
      }
      core.content.updateMatrixWorld(true);
    },
    setInstancePoses(poses) {
      requireLive();
      if (sceneSourceV2 !== null) throw Error("scene-v2 poses require matrix snapshots");

      if (!isPoseBatch(poses) || poses.length > 4096) throw Error("Invalid instance pose batch.");
      const seen = new Set<string>();

      for (const pose of poses) {
        if (!pose || !roots.has(pose.instanceId) || seen.has(pose.instanceId) || !finiteArray(pose.translation,3) || pose.translation.length !== 3 || !finiteArray(pose.rotation,4) || pose.rotation.length !== 4 || Math.abs(Math.hypot(...pose.rotation)-1) > 0.00001) throw Error("Invalid instance pose.");
        seen.add(pose.instanceId);
      }

      for (const pose of poses) {
        const root = roots.get(pose.instanceId);

 if (!root) throw Error("Validated pose target disappeared.");
        root.position.set(...pose.translation); root.quaternion.set(...pose.rotation);
      }
    },
    sampleEffects: core.sampleEffects,

    setMaterialOverrides(input, textures = []) {
      if (disposed) throw new Error("Three sculpt backend is disposed.");

      if (!Array.isArray(input) || input.length > 4096) throw new Error("Invalid bounded material override list.");
      const next = new Map<string, SceneMaterialOverride>();

      if (!Array.isArray(textures) || textures.length > 256) throw Error("Texture catalog capacity exceeded.");
      const admitted = new Map<string, ThreeContainedTexture>();
      let bytes = 0;

      for (const texture of textures) {
        if (!texture || !isSculptIdentifier(texture.assetId) || admitted.has(texture.assetId) || !Number.isSafeInteger(texture.width) || !Number.isSafeInteger(texture.height) || texture.width < 1 || texture.height < 1 || texture.width > 4096 || texture.height > 4096 || !Array.isArray(texture.rgba) || texture.rgba.length !== texture.width * texture.height * 4 || !Array.from(texture.rgba).every(v => isNumericIndex(v) && Number.isInteger(v) && v >= 0 && v <= 255)) throw Error("Invalid contained texture catalog.");
        bytes += texture.rgba.length;

        if (bytes > 4 * 1024 * 1024) throw Error("Texture catalog byte capacity exceeded.");
        admitted.set(texture.assetId, texture);
      }

      for (const override of input) {
        if ([override.baseColorMapAssetId, override.normalMapAssetId, override.roughnessMapAssetId].some(id => id !== null && !admitted.has(id))) {
          throw new Error(`Material texture asset binding is unresolved for "${override.instanceId}" (ADR 0026).`);
        }

        if (next.has(override.instanceId) || !isSculptIdentifier(override.instanceId) || !/^#[0-9a-f]{6}$/i.test(override.emissiveColor) ||
          !Number.isFinite(override.emissiveIntensity) || override.emissiveIntensity < 0 || override.emissiveIntensity > 16 ||
          !Number.isFinite(override.opacity) || override.opacity < 0 || override.opacity > 1) {
          throw new Error(`Invalid material override for "${override.instanceId}".`);
        }

        next.set(override.instanceId, Object.freeze({ ...override }));
      }

      for (const [id, root] of roots) validateRootTextures(root, next.get(id));

      // Allocate all maps before replacing the last admitted catalog.
      const candidate = new Map<string, DataTexture>();

      try {
        for (const [id, texture] of admitted) {
          const color = [...next.values()].some(o => o.baseColorMapAssetId === id);
          const data = new DataTexture(new Uint8Array(texture.rgba), texture.width, texture.height, RGBAFormat, UnsignedByteType);
          candidate.set(id, data);
          data.userData["sceneaxiCatalogTexture"] = true;

          // Sharing a texture between color and data slots would mix color spaces.
          if (color && [...next.values()].some(o => o.normalMapAssetId === id || o.roughnessMapAssetId === id)) throw Error("Texture color/data role conflict.");

          if (color) data.colorSpace = SRGBColorSpace;
          data.wrapS = RepeatWrapping; data.wrapT = RepeatWrapping; data.magFilter = LinearFilter; data.minFilter = LinearMipmapLinearFilter; data.generateMipmaps = true; data.needsUpdate = true;
        }
      } catch (error) { for (const texture of candidate.values()) texture.dispose(); throw error; }

      const previous = resolvedTextures;
      resolvedTextures = candidate; overrides = next;

      for (const [id, root] of roots) applyMaterialOverride(root, overrides.get(id));

      for (const texture of previous.values()) texture.dispose();
    },

    mount: replace,
    update: updateTransform,

    unmount(instanceId) {
      requireLive();
      if (sceneSourceV2 !== null) throw Error("scene-v2 unmount requires whole-scene replacement or disposal");
      const root = roots.get(instanceId);

      if (root === undefined) return;
      core.content.remove(root);
      disposeRoot(root);
      roots.delete(instanceId);
      importedNodes.delete(instanceId);
      importedNodeDefaults.delete(instanceId);
    },

    render(instanceIds) {
      requireLive();
      core.content.updateMatrixWorld(true);
      const drawn = core.draw();

      return Object.freeze({
        backend: "three",
        label: core.label,
        frame: drawn.frame,
        instanceIds: Object.freeze([...instanceIds]),
        drawCalls: drawn.drawCalls,
        surface: drawn.surface,
        pixelsDrawn: drawn.pixelsDrawn,
      });
    },

    resize(width, height, pixelRatio) {
      core.resize(width, height, pixelRatio);
    },

    capture() {
      return core.capture();
    },

    frameMountedContent() {
      requireLive();
      const bounds = boundingSphereOf(core.content);

      if (bounds === null) return;
      core.camera.frameSphere(bounds.center, bounds.radius);
    },

    mountTriangleAsset(input) {
      requireLive();
      if (sceneSourceV2 !== null) throw Error("scene-v2 triangle replacement is not supported");

      if (!roots.has(input.instanceId) && roots.size >= 4096) throw new Error("Sculpt mount capacity exceeded.");
      const next = buildTriangleAsset(input);

      try { applyMaterialOverride(next, overrides.get(input.instanceId)); } catch (error) { disposeRoot(next); throw error; }

      const previous = roots.get(input.instanceId);

      if (previous !== undefined) {
        core.content.remove(previous);
        disposeRoot(previous);
      }

      roots.set(input.instanceId, next);
      importedNodes.set(input.instanceId, new Map((input.nodes ?? []).flatMap((node) => { const group = next.getObjectByName(`gltf-node-${String(node.node)}`);

 return group instanceof Object3D ? [[node.node, group] as const] : []; })));
      importedNodeDefaults.set(input.instanceId, new Map((input.nodes ?? []).map((node) => [node.node, node])));
      core.content.add(next);
    },

    playTriangleAnimation(instanceId, clip, time) {
      requireLive();
      const nodes = importedNodes.get(instanceId);
      const defaults = importedNodeDefaults.get(instanceId);

      if (nodes === undefined || defaults === undefined) throw new Error(`Imported animation target "${instanceId}" is not mounted.`);

      // Validate the complete candidate before resetting even one visible node.
      if (!clip || !Number.isFinite(time) || time < 0 || time > 1_000_000 || !Number.isFinite(clip.duration) || clip.duration < 0 || clip.duration > 1_000_000 || !Array.isArray(clip.channels) || clip.channels.length > 4096) throw new Error("Invalid bounded animation clip or time.");
      let values = 0;
      const targets = new Set<string>();

      for (const channel of clip.channels) {
        if (!channel) throw new Error("Invalid animation channel.");
        const width = channel.path === "rotation" ? 4 : 3;
        const target = channel.node + ":" + channel.path;

        if (!channel || !nodes.has(channel.node) || defaults.get(channel.node)?.matrixAuthored || targets.has(target) || !["translation", "rotation", "scale"].includes(channel.path) || !["STEP", "LINEAR", "CUBICSPLINE"].includes(channel.interpolation) || !finiteArray(channel.times, 1) || !finiteArray(channel.values, width) || channel.values.length !== channel.times.length * width * (channel.interpolation === "CUBICSPLINE" ? 3 : 1) || channel.times.some((t: number, i: number) => t < 0 || t > clip.duration || (i > 0 && t <= (channel.times[i - 1] ?? -1)))) throw new Error("Invalid or unsupported animation channel.");
        targets.add(target);
        values += channel.times.length + channel.values.length;

        if (values > 8_000_000) throw new Error("Animation resource capacity exceeded.");

        if (channel.path === "rotation") {
          for (let i = channel.interpolation === "CUBICSPLINE" ? 4 : 0; i < channel.values.length; i += channel.interpolation === "CUBICSPLINE" ? 12 : 4) {
            if (Math.abs(Math.hypot(...channel.values.slice(i, i + 4)) - 1) > 0.00001) throw new Error("Invalid animation quaternion.");
          }
        }
      }

      const poses = evaluateTriangleAnimation(clip, time).poses;

      for (const pose of poses) {
        if ([pose.translation, pose.rotation, pose.scale].some(value => value !== undefined && !finiteArray(value, value.length))) throw new Error("Invalid animation pose.");
      }

      resetImportedNodes(instanceId);

      for (const pose of poses) {
        const group = nodes.get(pose.node);

        if (group === undefined) throw new Error("Validated animation node disappeared.");

        if (pose.translation !== undefined) group.position.set(...pose.translation);

        if (pose.rotation !== undefined) group.quaternion.set(...pose.rotation);

        if (pose.scale !== undefined) group.scale.set(...pose.scale);
      }
    },

    resetTriangleAnimation(instanceId) {
      requireLive();
      resetImportedNodes(instanceId);
    },

    dispose() {
      disposed = true;
      overrides.clear();
      roots.clear();
      importedNodes.clear();
      importedNodeDefaults.clear();

      // Restore original maps so disposeSubtree owns every geometry-created texture.
      for (const root of core.content.children) if (root instanceof Group) applyMaterialOverride(root, undefined);

      for (const texture of resolvedTextures.values()) texture.dispose();
      resolvedTextures.clear();
      core.dispose();
    },
  };
}

function boundingSphereOf(root: Group) {
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(root);

  if (box.isEmpty()) return null;
  const sphere = box.getBoundingSphere(new Sphere());

  return {
    center: [sphere.center.x, sphere.center.y, sphere.center.z] as const,
    radius: Math.max(sphere.radius, 0.001),
  };
}

function isMatrixFlag(value: boolean): value is boolean {
  return typeof value === "boolean";
}

function isMeshName(value: string): value is string {
  return typeof value === "string";
}

function isNumericIndex(value: unknown): value is number {
  return typeof value === "number";
}

function isPoseBatch(value: readonly ThreeInstancePose[]): value is readonly ThreeInstancePose[] {
  return Array.isArray(value);
}
