/** Implementation-private Three scene adapter for the explicitly experimental preview. */
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Scene,
  SphereGeometry,
  type BufferGeometry,
  type Material,
  type Object3D,
} from "three";
import type { SculptComponent, SculptMaterial, SculptTransform } from "@sceneaxi/schemas";
import {
  EXPERIMENTAL_THREE_NON_DECISION_LABEL,
  type SculptMountedInstance,
  type SculptPresentationBackend,
} from "./sculpt-mount.js";

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

function disposeObject(root: Object3D) {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) material.dispose();
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
 * Experimental Three preview adapter. It builds and updates an actual Three
 * scene graph but makes no Stage 1 selection or production renderer claim.
 */
export function createExperimentalThreeSculptPresentationBackend(): SculptPresentationBackend {
  const scene = new Scene();
  const roots = new Map<string, Group>();
  let frame = 0;

  function replace(instance: SculptMountedInstance) {
    const previous = roots.get(instance.instanceId);
    if (previous !== undefined) {
      scene.remove(previous);
      disposeObject(previous);
    }
    const next = buildInstance(instance);
    roots.set(instance.instanceId, next);
    scene.add(next);
  }

  function updateTransform(instance: SculptMountedInstance) {
    const root = roots.get(instance.instanceId);
    if (root === undefined) {
      throw new Error(`Mounted sculpt instance "${instance.instanceId}" disappeared.`);
    }
    applyTransform(root, instance.transform);
  }

  return {
    id: "experimental-three",
    label: EXPERIMENTAL_THREE_NON_DECISION_LABEL,
    mount: replace,
    update: updateTransform,
    unmount(instanceId) {
      const root = roots.get(instanceId);
      if (root === undefined) return;
      scene.remove(root);
      disposeObject(root);
      roots.delete(instanceId);
    },
    render(instanceIds) {
      frame += 1;
      scene.updateMatrixWorld(true);
      let drawCalls = 0;
      scene.traverse((object) => {
        if (object instanceof Mesh) drawCalls += 1;
      });
      return Object.freeze({
        backend: "experimental-three",
        label: EXPERIMENTAL_THREE_NON_DECISION_LABEL,
        frame,
        instanceIds: Object.freeze([...instanceIds]),
        drawCalls,
      });
    },
    dispose() {
      for (const root of roots.values()) disposeObject(root);
      roots.clear();
      scene.clear();
    },
  };
}
