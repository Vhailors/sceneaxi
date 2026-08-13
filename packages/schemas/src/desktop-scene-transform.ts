/**
 * Shared transform-authoring vocabulary for gizmos, numeric inspector, and
 * command clients. The resolver never writes project bytes; it only produces
 * canonical local-component operations for one preview/commit command.
 */
import {
  SCENE_MAXIMUM_COMPONENT_MAGNITUDE,
  SCENE_MINIMUM_SCALE,
} from "./scene-composition.js";
import { isSculptIdentifier } from "./sculpt.js";
import {
  DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS,
  isDesktopSceneSelectionInput,
  type DesktopSceneTransformPropertyId,
} from "./desktop-scene-edit.js";

export const DESKTOP_SCENE_TRANSFORM_SCHEMA_VERSION = 1 as const;

export const DESKTOP_SCENE_TRANSFORM_MODES = Object.freeze([
  "translate",
  "rotate",
  "scale",
] as const);
export type DesktopSceneTransformMode = (typeof DESKTOP_SCENE_TRANSFORM_MODES)[number];

export const DESKTOP_SCENE_TRANSFORM_SPACES = Object.freeze([
  "local",
  "world",
] as const);
export type DesktopSceneTransformSpace = (typeof DESKTOP_SCENE_TRANSFORM_SPACES)[number];

export const DESKTOP_SCENE_TRANSFORM_PIVOTS = Object.freeze([
  "individual",
  "selection",
  "origin",
] as const);
export type DesktopSceneTransformPivot = (typeof DESKTOP_SCENE_TRANSFORM_PIVOTS)[number];

export const DESKTOP_SCENE_TRANSFORM_AXES = Object.freeze([
  "x",
  "y",
  "z",
  "xy",
  "xz",
  "yz",
  "xyz",
] as const);
export type DesktopSceneTransformAxis = (typeof DESKTOP_SCENE_TRANSFORM_AXES)[number];

export const DESKTOP_SCENE_TRANSFORM_VALUE_KINDS = Object.freeze([
  "absolute",
  "delta",
] as const);
export type DesktopSceneTransformValueKind =
  (typeof DESKTOP_SCENE_TRANSFORM_VALUE_KINDS)[number];

export const DESKTOP_SCENE_TRANSFORM_REFUSALS = Object.freeze({
  spaceInvalid: "SCENE_TRANSFORM_SPACE_INVALID",
  pivotInvalid: "SCENE_TRANSFORM_PIVOT_INVALID",
  axisInvalid: "SCENE_TRANSFORM_AXIS_INVALID",
  snapInvalid: "SCENE_TRANSFORM_SNAP_INVALID",
  selectionEmpty: "SCENE_TRANSFORM_SELECTION_EMPTY",
  inputUnsupported: "SCENE_TRANSFORM_INPUT_UNSUPPORTED",
} as const);

export type DesktopSceneTransformRefusal =
  (typeof DESKTOP_SCENE_TRANSFORM_REFUSALS)[keyof typeof DESKTOP_SCENE_TRANSFORM_REFUSALS];

export type DesktopSceneTransformVector = readonly [number, number, number];

export type DesktopSceneTransformInstance = Readonly<{
  instanceId: string;
  local: Readonly<{
    translation: DesktopSceneTransformVector;
    rotationEulerDegrees: DesktopSceneTransformVector;
    scale: DesktopSceneTransformVector;
  }>;
  world: Readonly<{
    translation: DesktopSceneTransformVector;
  }>;
}>;

export type DesktopSceneTransformRequest = Readonly<{
  instanceIds: readonly string[];
  instances: readonly DesktopSceneTransformInstance[];
  mode: DesktopSceneTransformMode;
  space: DesktopSceneTransformSpace;
  pivot: DesktopSceneTransformPivot;
  axes: DesktopSceneTransformAxis;
  snapIncrement: number | null;
  valueKind: DesktopSceneTransformValueKind;
  values: DesktopSceneTransformVector;
}>;

export type DesktopSceneTransformComponent = Readonly<{
  instanceId: string;
  propertyId: DesktopSceneTransformPropertyId;
  value: number;
}>;

export type DesktopSceneTransformResult =
  | Readonly<{
      ok: true;
      affectedIds: readonly string[];
      components: readonly DesktopSceneTransformComponent[];
    }>
  | Readonly<{
      ok: false;
      reason: DesktopSceneTransformRefusal;
      message: string;
    }>;

const AXIS_MASK: Readonly<Record<DesktopSceneTransformAxis, readonly [boolean, boolean, boolean]>> =
  Object.freeze({
    x: Object.freeze([true, false, false] as const),
    y: Object.freeze([false, true, false] as const),
    z: Object.freeze([false, false, true] as const),
    xy: Object.freeze([true, true, false] as const),
    xz: Object.freeze([true, false, true] as const),
    yz: Object.freeze([false, true, true] as const),
    xyz: Object.freeze([true, true, true] as const),
  });

const FIELD_FOR_MODE: Readonly<Record<
  DesktopSceneTransformMode,
  "translation" | "rotationEulerDegrees" | "scale"
>> = Object.freeze({
  translate: "translation",
  rotate: "rotationEulerDegrees",
  scale: "scale",
});

function finiteVector(value: unknown): value is DesktopSceneTransformVector {
  return Array.isArray(value) &&
    value.length === 3 &&
    value.every((component) => typeof component === "number" && Number.isFinite(component));
}

function snapValue(value: number, increment: number | null): number {
  if (increment === null) return value;
  return Math.round(value / increment) * increment;
}

function clampComponent(
  mode: DesktopSceneTransformMode,
  value: number,
): number | null {
  if (mode === "scale") {
    if (value < SCENE_MINIMUM_SCALE || value > SCENE_MAXIMUM_COMPONENT_MAGNITUDE) return null;
    return value;
  }
  if (Math.abs(value) > SCENE_MAXIMUM_COMPONENT_MAGNITUDE) return null;
  return value;
}

function centroid(instances: readonly DesktopSceneTransformInstance[]): DesktopSceneTransformVector {
  const sum: [number, number, number] = [0, 0, 0];
  for (const instance of instances) {
    sum[0] += instance.world.translation[0];
    sum[1] += instance.world.translation[1];
    sum[2] += instance.world.translation[2];
  }
  const count = instances.length;
  return Object.freeze([sum[0] / count, sum[1] / count, sum[2] / count]);
}

export function isDesktopSceneTransformRequest(value: unknown): value is DesktopSceneTransformRequest {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).sort().join(",") ===
      "axes,instanceIds,instances,mode,pivot,snapIncrement,space,valueKind,values" &&
    isDesktopSceneSelectionInput(record["instanceIds"]) &&
    Array.isArray(record["instances"]) &&
    DESKTOP_SCENE_TRANSFORM_MODES.some((mode) => mode === record["mode"]) &&
    DESKTOP_SCENE_TRANSFORM_SPACES.some((space) => space === record["space"]) &&
    DESKTOP_SCENE_TRANSFORM_PIVOTS.some((pivot) => pivot === record["pivot"]) &&
    DESKTOP_SCENE_TRANSFORM_AXES.some((axes) => axes === record["axes"]) &&
    DESKTOP_SCENE_TRANSFORM_VALUE_KINDS.some((kind) => kind === record["valueKind"]) &&
    finiteVector(record["values"]) &&
    (record["snapIncrement"] === null ||
      (typeof record["snapIncrement"] === "number" &&
        Number.isFinite(record["snapIncrement"]) &&
        record["snapIncrement"] > 0)) &&
    record["instances"].every((instance) => {
      if (instance === null || typeof instance !== "object" || Array.isArray(instance)) return false;
      const row = instance as Record<string, unknown>;
      const local = row["local"];
      const world = row["world"];
      return isSculptIdentifier(row["instanceId"]) &&
        local !== null && typeof local === "object" && !Array.isArray(local) &&
        world !== null && typeof world === "object" && !Array.isArray(world) &&
        finiteVector((local as Record<string, unknown>)["translation"]) &&
        finiteVector((local as Record<string, unknown>)["rotationEulerDegrees"]) &&
        finiteVector((local as Record<string, unknown>)["scale"]) &&
        finiteVector((world as Record<string, unknown>)["translation"]);
    });
}

/** Deterministic local-component resolution for one gizmo drag or numeric entry. */
export function resolveDesktopSceneTransform(
  input: DesktopSceneTransformRequest,
): DesktopSceneTransformResult {
  const ordered = [...input.instanceIds];
  if (ordered.length === 0 || new Set(ordered).size !== ordered.length) {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_SCENE_TRANSFORM_REFUSALS.selectionEmpty,
      message: "A transform command requires one explicit ordered selection.",
    });
  }
  const byId = new Map(input.instances.map((instance) => [instance.instanceId, instance]));
  const selected: DesktopSceneTransformInstance[] = [];
  for (const instanceId of ordered) {
    const instance = byId.get(instanceId);
    if (instance === undefined) {
      return Object.freeze({
        ok: false as const,
        reason: DESKTOP_SCENE_TRANSFORM_REFUSALS.selectionEmpty,
        message: `The transform selection is stale: ${instanceId}.`,
      });
    }
    selected.push(instance);
  }
  if (input.space === "world" && input.mode !== "translate") {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_SCENE_TRANSFORM_REFUSALS.spaceInvalid,
      message: "World space currently admits translation only; rotate and scale remain local.",
    });
  }
  if (input.pivot === "origin" && input.mode !== "translate") {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_SCENE_TRANSFORM_REFUSALS.pivotInvalid,
      message: "Origin pivot currently admits translation only.",
    });
  }
  if (input.snapIncrement !== null && !(input.snapIncrement > 0 && Number.isFinite(input.snapIncrement))) {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_SCENE_TRANSFORM_REFUSALS.snapInvalid,
      message: "A snap increment must be a finite positive number or null.",
    });
  }
  const mask = AXIS_MASK[input.axes];
  const field = FIELD_FOR_MODE[input.mode];
  const pivotPoint = input.pivot === "selection" ? centroid(selected) : input.pivot === "origin"
    ? Object.freeze([0, 0, 0] as const)
    : null;
  const components: DesktopSceneTransformComponent[] = [];
  for (const instance of selected) {
    const currentLocal = instance.local[field];
    const next: [number, number, number] = [
      currentLocal[0],
      currentLocal[1],
      currentLocal[2],
    ];
    for (let axis = 0; axis < 3; axis += 1) {
      if (!mask[axis]) continue;
      const incoming = input.values[axis];
      let candidate = input.valueKind === "absolute" ? incoming : currentLocal[axis] + incoming;
      if (input.space === "world" && input.mode === "translate") {
        const world = instance.world.translation[axis];
        const nextWorld = input.valueKind === "absolute" ? incoming : world + incoming;
        const snappedWorld = snapValue(nextWorld, input.snapIncrement);
        const parentWorld = world - currentLocal[axis];
        candidate = snappedWorld - parentWorld;
        if (pivotPoint !== null) {
          const offset = world - pivotPoint[axis];
          candidate = snapValue(pivotPoint[axis] + offset + (input.valueKind === "delta" ? incoming : incoming - world), input.snapIncrement) - parentWorld;
        }
      } else {
        candidate = snapValue(candidate, input.snapIncrement);
        if (pivotPoint !== null && input.mode === "translate") {
          const world = instance.world.translation[axis];
          const parentWorld = world - currentLocal[axis];
          const offset = world - pivotPoint[axis];
          const nextWorld = input.valueKind === "delta"
            ? pivotPoint[axis] + offset + incoming
            : incoming + offset;
          candidate = snapValue(nextWorld, input.snapIncrement) - parentWorld;
        }
      }
      const clamped = clampComponent(input.mode, candidate);
      if (clamped === null) {
        return Object.freeze({
          ok: false as const,
          reason: DESKTOP_SCENE_TRANSFORM_REFUSALS.inputUnsupported,
          message: `Resolved ${field} component is outside the v1 numeric range.`,
        });
      }
      next[axis] = clamped;
    }
    for (const definition of DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS) {
      if (definition.field !== field) continue;
      const value = next[definition.axis];
      if (value === currentLocal[definition.axis]) continue;
      components.push(Object.freeze({
        instanceId: instance.instanceId,
        propertyId: definition.id,
        value,
      }));
    }
  }
  return Object.freeze({
    ok: true as const,
    affectedIds: Object.freeze([...ordered]),
    components: Object.freeze(components),
  });
}
