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
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Sphere,
  SphereGeometry,
  type BufferGeometry,
  type Material,
  type Object3D,
} from "three";
import type { SculptComponent, SculptMaterial, SculptTransform } from "@sceneaxi/schemas";
import type { OrbitCameraControls } from "./orbit-camera.js";
import {
  createThreePresentationCore,
  disposeSubtree,
  type ThreePresentationCoreOptions,
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
}

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

  function replace(instance: SculptMountedInstance) {
    const previous = roots.get(instance.instanceId);
    if (previous !== undefined) {
      core.content.remove(previous);
      disposeSubtree(previous);
    }
    const next = buildInstance(instance);
    roots.set(instance.instanceId, next);
    core.content.add(next);
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
    mount: replace,
    update: updateTransform,

    unmount(instanceId) {
      const root = roots.get(instanceId);
      if (root === undefined) return;
      core.content.remove(root);
      disposeSubtree(root);
      roots.delete(instanceId);
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

    dispose() {
      roots.clear();
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
