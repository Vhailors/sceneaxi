/** Numeric, renderer-neutral scene v2 placement. No Three type crosses the seam. */
import {
  projectSceneInstanceHierarchyV2,
  multiplySceneMatricesV2,
  SCENE_MAXIMUM_COMPONENT_MAGNITUDE,
  sceneMatrixFromSculptTransformV2,
  snapshotPlainRecord,
  snapshotPlainArray,
  type SceneMatrixV2,
  type SculptTransform,
  type Vector3,
  validateComposedSceneV2,
  type ComposedSceneV2,
  type PlacedSceneInstanceHierarchyV2,
  type SceneCompositionValidationResult,
} from "@sceneaxi/schemas";

/** Validate at the boundary before a renderer allocates or changes any objects. */
export function resolveScenePresentationV2(value: unknown): SceneCompositionValidationResult<readonly PlacedSceneInstanceHierarchyV2[]> {
  const scene = validateComposedSceneV2(value);
  if (!scene.ok) return scene;
  return { ok: true, value: Object.freeze(scene.value.instances.map(projectSceneInstanceHierarchyV2)) };
}

/** Validated scene source remains unmodified; matrices retain nonuniform-scale shear. */
export type ScenePresentationSourceV2 = ComposedSceneV2;


export type SceneRuntimePresentationV2 = {
  readonly tick: number;
  readonly instances: readonly { readonly instanceId: string; readonly worldMatrix: SceneMatrixV2;
    readonly nodes: readonly { readonly id: string; readonly localMatrix: SceneMatrixV2; readonly worldMatrix: SceneMatrixV2 }[] }[];
};

function boundedArrayV2(value: unknown, maximum: number): unknown[] {
  let length: unknown;
  try { length = value !== null && typeof value === "object" ? Object.getOwnPropertyDescriptor(value, "length")?.value : undefined; }
  catch { throw Error("invalid array descriptor"); }
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0 || length > maximum) throw Error("array capacity exceeded");
  const values = snapshotPlainArray(value);
  if (!values) throw Error("invalid array descriptors");
  return [...values];
}
function runtimeVectorV2(value: unknown): Vector3 {
  const values = boundedArrayV2(value, 3);
  const [x, y, z] = values;
  if (values.length !== 3 || typeof x !== "number" || typeof y !== "number" || typeof z !== "number" || ![x,y,z].every(Number.isFinite)) throw Error("invalid finite vector");
  return Object.freeze([x,y,z]);
}
function runtimeTransformV2(value: unknown): SculptTransform {
  const transform = snapshotPlainRecord(value);
  if (!transform || Object.keys(transform).some(key => !["translation", "rotationEulerDegrees", "scale"].includes(key))) throw Error("invalid transform descriptors");
  return Object.freeze({ translation: runtimeVectorV2(transform["translation"]), rotationEulerDegrees: runtimeVectorV2(transform["rotationEulerDegrees"]), scale: runtimeVectorV2(transform["scale"]) });
}
function equalRuntimeMatrixV2(value: unknown, expected: SceneMatrixV2) {
  const matrix = boundedArrayV2(value, 16);
  if (matrix.length !== 16 || matrix.some((v, i) => typeof v !== "number" || !Number.isFinite(v) || v !== expected[i])) throw Error("declared matrix does not match local hierarchy");
}

/** Descriptor-only, complete-batch admission before any renderable changes. */
export function resolveSceneRuntimePresentationV2(scene: ComposedSceneV2, value: unknown): SceneCompositionValidationResult<SceneRuntimePresentationV2> {
  try {
    const snapshot = snapshotPlainRecord(value);
    if (!snapshot || snapshot["schemaVersion"] !== 2 || snapshot["sceneId"] !== scene.sceneId || typeof snapshot["tick"] !== "number" || !Number.isSafeInteger(snapshot["tick"]) || snapshot["tick"] < 0) throw Error("scene snapshot major, id or tick mismatch");
    const instances = boundedArrayV2(snapshot["instances"], 32);
    if (instances.length !== scene.instances.length) throw Error("scene instance count mismatch");
    const seen = new Set<string>();
    const prepared = instances.map(value => {
      const instance = snapshotPlainRecord(value);
      if (!instance || typeof instance["instanceId"] !== "string" || seen.has(instance["instanceId"])) throw Error("invalid duplicate instance");
      const instanceId = instance["instanceId"];
      seen.add(instanceId);
      const source = scene.instances.find(source => source.instanceId === instanceId);
      if (!source || instance["artifactId"] !== source.artifactId) throw Error("unknown instance or artifact");
      const placementMatrix = source.worldMatrix;
      equalRuntimeMatrixV2(instance["worldMatrix"], placementMatrix);
      const local = snapshotPlainRecord(instance["snapshot"]);
      if (!local || local["tick"] !== snapshot["tick"]) throw Error("local snapshot tick mismatch");
      const nodes = boundedArrayV2(local["nodes"], 4096);
      if (nodes.length !== source.artifact.runtimeHierarchy.nodes.length) throw Error("node count mismatch");
      const originalNodes = new Map(source.artifact.runtimeHierarchy.nodes.map(node => [node.id, node]));
      const components = new Map(source.artifact.spec.components.map(component => [component.id, component]));
      const captured = new Map<string, { id: string; parentId: string | null; localMatrix: SceneMatrixV2; declaredMatrix: unknown }>();
      for (const value of nodes) {
        const node = snapshotPlainRecord(value);
        if (!node || typeof node["id"] !== "string" || captured.has(node["id"])) throw Error("invalid duplicate node");
        const id = node["id"];
        const original = originalNodes.get(id);
        if (!original || node["parentId"] !== original.parentId || node["componentId"] !== original.componentId) throw Error("runtime hierarchy mismatch");
        const localMatrix = sceneMatrixFromSculptTransformV2(runtimeTransformV2(node["transform"]));
        captured.set(id, { id, parentId: original.parentId, localMatrix, declaredMatrix: node["worldMatrix"] });
      }
      const resolved = new Map<string, SceneMatrixV2>();
      const visiting = new Set<string>();
      function resolve(id: string): SceneMatrixV2 {
        const previous = resolved.get(id);
        if (previous) return previous;
        const node = captured.get(id);
        if (!node || visiting.has(id)) throw Error("cyclic or disconnected runtime hierarchy");
        if (visiting.size >= 256) throw Error("runtime hierarchy depth capacity exceeded");
        visiting.add(id);
        const world = multiplySceneMatricesV2(node.parentId === null ? placementMatrix : resolve(node.parentId), node.localMatrix);
        equalRuntimeMatrixV2(node.declaredMatrix, world);
        visiting.delete(id); resolved.set(id, world);
        return world;
      }
      const min: [number, number, number] = [Infinity, Infinity, Infinity];
      const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
      const projectedNodes = [...captured.values()].map(node => {
        const worldMatrix = resolve(node.id);
        const original = originalNodes.get(node.id);
        const component = original ? components.get(original.componentId) : undefined;
        if (!component) throw Error("missing runtime component");
        const radius = Math.max(...component.dimensions) / 2;
        const cylinderRadius = Math.max(component.dimensions[0], component.dimensions[2]) / 2;
        const half: Vector3 = component.primitive === "sphere" ? [radius, radius, radius]
          : component.primitive === "cylinder" ? [cylinderRadius, component.dimensions[1] / 2, cylinderRadius]
          : [component.dimensions[0] / 2, component.dimensions[1] / 2, component.dimensions[2] / 2];
        for (const x of [-half[0], half[0]]) for (const y of [-half[1], half[1]]) for (const z of [-half[2], half[2]]) {
          for (const axis of [0,1,2] as const) {
            const a = worldMatrix[4 + axis], b = worldMatrix[8 + axis], c = worldMatrix[12 + axis];
            if (a === undefined || b === undefined || c === undefined) throw Error("missing matrix component");
            const v = worldMatrix[axis] * x + a * y + b * z + c;
            if (!Number.isFinite(v) || Math.abs(v) > SCENE_MAXIMUM_COMPONENT_MAGNITUDE) throw Error("runtime world bounds capacity exceeded");
            min[axis] = Math.min(min[axis],v); max[axis] = Math.max(max[axis],v);
          }
        }
        return Object.freeze({ id: node.id, localMatrix: node.localMatrix, worldMatrix });
      });
      const bounds = snapshotPlainRecord(instance["bounds"]);
      if (!bounds) throw Error("invalid bounds descriptors");
      const declaredMin = runtimeVectorV2(bounds["min"]), declaredMax = runtimeVectorV2(bounds["max"]);
      if (min.some((v,i) => v !== declaredMin[i]) || max.some((v,i) => v !== declaredMax[i])) throw Error("runtime world bounds mismatch");
      return Object.freeze({ instanceId, worldMatrix: source.worldMatrix, nodes: Object.freeze(projectedNodes) });
    });
    return { ok: true, value: Object.freeze({ tick: snapshot["tick"], instances: Object.freeze(prepared) }) };
  } catch (error) {
    return { ok: false, diagnostics: [{ code: "invalid-field", path: "$", message: `scene-v2 runtime presentation refused: ${error instanceof Error ? error.message : "invalid snapshot"}` }] };
  }
}
