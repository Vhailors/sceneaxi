/**
 * Sculpt Mount backend on the Three presentation core.
 *
 * Given a canvas it draws mounted Sculpt Artifacts as real pixels through a
 * `WebGLRenderer`; with no canvas it uses the deterministic headless surface for
 * node gates. Either way no Three type crosses the Mount API seam.
 */
import {
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
  type Object3D,
} from "three";
import { evaluateGltfAnimation, isSculptIdentifier, type AssetRenderMesh, type GltfAnimationClip, type SceneEffectsCatalog, type SceneEffectsEvaluation, type SceneMaterialOverride, type SculptComponent, type SculptMaterial, type SculptTransform } from "@sceneaxi/schemas";
import type { OrbitCameraControls } from "./orbit-camera.js";
import {
  createThreePresentationCore,
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
  playTriangleAnimation(instanceId: string, clip: GltfAnimationClip, time: number): void;
  resetTriangleAnimation(instanceId: string): void;
  setEnvironment(environment: ThreeSceneEnvironment): void;
  setMaterialOverrides(overrides: readonly SceneMaterialOverride[]): void;
  sampleEffects(catalog: SceneEffectsCatalog, timeMs: number): SceneEffectsEvaluation;
}

export type ThreeTrianglePrimitiveInput = AssetRenderMesh;

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

function buildInstance(instance: SculptMountedInstance) {
  const root = new Group();
  root.name = instance.instanceId;
  applyTransform(root, instance.transform);
  const components = new Map(instance.artifact.spec.components.map((component) => [component.id, component]));
  const materials = new Map(instance.artifact.spec.materials.map((material) => [material.id, material]));
  const nodes = new Map<string, Object3D>();
  for (const node of instance.artifact.runtimeHierarchy.nodes) {
    const component = components.get(node.componentId);
    if (component === undefined) throw new Error(`Validated sculpt component "${node.componentId}" disappeared.`);
    const material = materials.get(component.materialId);
    if (material === undefined) throw new Error(`Validated sculpt material "${component.materialId}" disappeared.`);
    const mesh = new Mesh(geometryFor(component), materialFor(material));
    mesh.name = node.id;
    applyTransform(mesh, node.transform);
    nodes.set(node.id, mesh);
  }
  for (const node of instance.artifact.runtimeHierarchy.nodes) {
    const object = nodes.get(node.id);
    if (object === undefined) continue;
    if (node.parentId === null) root.add(object);
    else nodes.get(node.parentId)?.add(object);
  }
  return root;
}

function finiteArray(value: readonly number[], multiple: number) {
  return value.length > 0 && value.length % multiple === 0 && value.every(Number.isFinite);
}

function buildTriangleAsset(input: ThreeTriangleAssetInput) {
  if (input.meshes.length === 0) {
    throw new Error("A contained triangle asset must carry at least one mesh.");
  }
  const root = new Group();
  root.name = input.instanceId;
  applyTransform(root, input.transform);
  const nodeGroups = new Map<number, Group>();
  for (const node of input.nodes ?? []) {
    const group = new Group();
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
    const vertexCount = mesh.positions.length / 3;
    if (
      !finiteArray(mesh.positions, 3) ||
      (mesh.normals !== undefined &&
        (!finiteArray(mesh.normals, 3) || mesh.normals.length !== mesh.positions.length)) ||
      (mesh.uvs !== undefined &&
        (!Array.isArray(mesh.uvs) || !finiteArray(mesh.uvs, 2) || mesh.uvs.length !== vertexCount * 2)) ||
      (mesh.baseColorTexture !== undefined &&
        (mesh.baseColorTexture === null ||
          !Number.isSafeInteger(mesh.baseColorTexture.width) || mesh.baseColorTexture.width <= 0 ||
          !Number.isSafeInteger(mesh.baseColorTexture.height) || mesh.baseColorTexture.height <= 0 ||
          mesh.baseColorTexture.width * mesh.baseColorTexture.height * 4 > 4 * 1024 * 1024 ||
          !Array.isArray(mesh.baseColorTexture.rgba) ||
          mesh.baseColorTexture.rgba.length !== mesh.baseColorTexture.width * mesh.baseColorTexture.height * 4 ||
          !mesh.baseColorTexture.rgba.every((value) => Number.isInteger(value) && value >= 0 && value <= 255) ||
          mesh.uvs === undefined)) ||
      mesh.indices.length === 0 ||
      mesh.indices.length % 3 !== 0 ||
      mesh.indices.some(
        (index) => !Number.isSafeInteger(index) || index < 0 || index >= vertexCount,
      ) ||
      mesh.matrix.length !== 16 ||
      !mesh.matrix.every(Number.isFinite) ||
      !/^#[0-9a-f]{6}$/i.test(mesh.baseColor) ||
      !Number.isFinite(mesh.metallic) || mesh.metallic < 0 || mesh.metallic > 1 ||
      !Number.isFinite(mesh.roughness) || mesh.roughness < 0 || mesh.roughness > 1
    ) {
      throw new Error(`Contained triangle mesh "${mesh.meshId}" is invalid.`);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(mesh.positions, 3));
    if (mesh.normals === undefined) geometry.computeVertexNormals();
    else geometry.setAttribute("normal", new Float32BufferAttribute(mesh.normals, 3));
    if (mesh.uvs !== undefined) geometry.setAttribute("uv", new Float32BufferAttribute(mesh.uvs, 2));
    geometry.setIndex(new Uint32BufferAttribute(mesh.indices, 1));
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
    if (texture !== undefined) material.map = texture;
    const object = new Mesh(geometry, material);
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
  const core = createThreePresentationCore(options);
  const roots = new Map<string, Group>();
  const importedNodes = new Map<string, ReadonlyMap<number, Group>>();
  const importedNodeDefaults = new Map<string, ReadonlyMap<number, ThreeTriangleNodeInput>>();
  let overrides = new Map<string, SceneMaterialOverride>();
  let disposed = false;

  function applyMaterialOverride(root: Group, override: SceneMaterialOverride | undefined) {
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];

      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial)) continue;
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

  function replace(instance: SculptMountedInstance) {
    const previous = roots.get(instance.instanceId);
    if (previous !== undefined) {
      core.content.remove(previous);
      disposeSubtree(previous);
    }
    const next = buildInstance(instance);
    applyMaterialOverride(next, overrides.get(instance.instanceId));
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
    const root = roots.get(instance.instanceId);
    if (root === undefined) {
      throw new Error(`Mounted sculpt instance "${instance.instanceId}" disappeared.`);
    }
    applyTransform(root, instance.transform);
  }

  return {
    id: "three",
    label: core.label,
    surface: core.surfaceKind,
    camera: core.camera,
    setEnvironment: core.setEnvironment,
    sampleEffects: core.sampleEffects,

    setMaterialOverrides(input) {
      if (disposed) throw new Error("Three sculpt backend is disposed.");
      const next = new Map<string, SceneMaterialOverride>();

      for (const override of input) {
        if (override.baseColorMapAssetId !== null || override.normalMapAssetId !== null || override.roughnessMapAssetId !== null) {
          throw new Error(`Material texture asset binding is unresolved for "${override.instanceId}" (ADR 0026).`);
        }

        if (next.has(override.instanceId) || !isSculptIdentifier(override.instanceId) || !/^#[0-9a-f]{6}$/i.test(override.emissiveColor) ||
          !Number.isFinite(override.emissiveIntensity) || override.emissiveIntensity < 0 || override.emissiveIntensity > 16 ||
          !Number.isFinite(override.opacity) || override.opacity < 0 || override.opacity > 1) {
          throw new Error(`Invalid material override for "${override.instanceId}".`);
        }

        next.set(override.instanceId, Object.freeze({ ...override }));
      }

      overrides = next;

      for (const [id, root] of roots) applyMaterialOverride(root, overrides.get(id));
    },

    mount: replace,
    update: updateTransform,

    unmount(instanceId) {
      const root = roots.get(instanceId);
      if (root === undefined) return;
      core.content.remove(root);
      disposeSubtree(root);
      roots.delete(instanceId);
      importedNodes.delete(instanceId);
      importedNodeDefaults.delete(instanceId);
    },

    render(instanceIds) {
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
      const bounds = boundingSphereOf(core.content);
      if (bounds === null) return;
      core.camera.frameSphere(bounds.center, bounds.radius);
    },

    mountTriangleAsset(input) {
      const next = buildTriangleAsset(input);
      applyMaterialOverride(next, overrides.get(input.instanceId));
      const previous = roots.get(input.instanceId);
      if (previous !== undefined) {
        core.content.remove(previous);
        disposeSubtree(previous);
      }
      roots.set(input.instanceId, next);
      importedNodes.set(input.instanceId, new Map((input.nodes ?? []).flatMap((node) => { const group = next.getObjectByName(`gltf-node-${String(node.node)}`); return group instanceof Group ? [[node.node, group] as const] : []; })));
      importedNodeDefaults.set(input.instanceId, new Map((input.nodes ?? []).map((node) => [node.node, node])));
      core.content.add(next);
    },

    playTriangleAnimation(instanceId, clip, time) {
      const nodes = importedNodes.get(instanceId);
      const defaults = importedNodeDefaults.get(instanceId);
      if (nodes === undefined || defaults === undefined) throw new Error(`Imported animation target "${instanceId}" is not mounted.`);
      resetImportedNodes(instanceId);
      for (const pose of evaluateGltfAnimation(clip, time).poses) {
        const group = nodes.get(pose.node);
        if (group === undefined) throw new Error(`Imported animation node "${String(pose.node)}" is not mounted.`);
        if (pose.translation !== undefined) group.position.set(...pose.translation);
        if (pose.rotation !== undefined) group.quaternion.set(...pose.rotation);
        if (pose.scale !== undefined) group.scale.set(...pose.scale);
      }
    },

    resetTriangleAnimation(instanceId) {
      resetImportedNodes(instanceId);
    },

    dispose() {
      disposed = true;
      overrides.clear();
      roots.clear();
      importedNodes.clear();
      importedNodeDefaults.clear();
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
