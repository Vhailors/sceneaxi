/**
 * Canonical hierarchy-edit vocabulary shared by desktop presentation and the
 * privileged authoring host.
 *
 * The operation describes intent only. It never carries a Sculpt Artifact:
 * create-object and the compatible add-instance form may therefore select only
 * an artifact already validated inside the open ComposedScene, and every
 * operation is projected into an ordinary E1 proposal before document bytes can
 * change.
 */
import {
  SCENE_MAXIMUM_COMPONENT_MAGNITUDE,
  SCENE_MINIMUM_SCALE,
} from "./scene-composition.js";
import { isSculptIdentifier } from "./sculpt.js";

export const DESKTOP_SCENE_EDIT_PROFILES = Object.freeze(["game", "web"] as const);
export type DesktopSceneEditProfile = (typeof DESKTOP_SCENE_EDIT_PROFILES)[number];

export const DESKTOP_SCENE_HIERARCHY_SCHEMA_VERSION = 1 as const;
export const DESKTOP_SCENE_HIERARCHY_KIND = "sceneaxi.desktop-scene-hierarchy" as const;

export const DESKTOP_SCENE_REPARENT_POLICIES = Object.freeze([
  "preserve-world",
  "preserve-local",
] as const);
export type DesktopSceneReparentPolicy =
  (typeof DESKTOP_SCENE_REPARENT_POLICIES)[number];

/** Stable refusals shared by desktop controls, CLI, and assistant tools. */
export const DESKTOP_SCENE_HIERARCHY_REFUSALS = Object.freeze({
  cycle: "SCENE_HIERARCHY_CYCLE",
  parentMissing: "SCENE_HIERARCHY_PARENT_MISSING",
  protectedRoot: "SCENE_HIERARCHY_PROTECTED_ROOT",
  selectionStale: "SCENE_HIERARCHY_SELECTION_STALE",
  policyInvalid: "SCENE_HIERARCHY_POLICY_INVALID",
  capabilityMissing: "SCENE_HIERARCHY_CAPABILITY_MISSING",
  kidsDenied: "SCENE_HIERARCHY_KIDS_DENIED",
  manifestInconsistent: "SCENE_HIERARCHY_MANIFEST_INCONSISTENT",
  inputUnsupported: "SCENE_HIERARCHY_INPUT_UNSUPPORTED",
} as const);

export type DesktopSceneHierarchyRefusal =
  (typeof DESKTOP_SCENE_HIERARCHY_REFUSALS)[keyof typeof DESKTOP_SCENE_HIERARCHY_REFUSALS];

export const DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS = Object.freeze([
  Object.freeze({ id: "translation-x", label: "Translation X", field: "translation", axis: 0, step: 0.1, min: -SCENE_MAXIMUM_COMPONENT_MAGNITUDE, max: SCENE_MAXIMUM_COMPONENT_MAGNITUDE }),
  Object.freeze({ id: "translation-y", label: "Translation Y", field: "translation", axis: 1, step: 0.1, min: -SCENE_MAXIMUM_COMPONENT_MAGNITUDE, max: SCENE_MAXIMUM_COMPONENT_MAGNITUDE }),
  Object.freeze({ id: "translation-z", label: "Translation Z", field: "translation", axis: 2, step: 0.1, min: -SCENE_MAXIMUM_COMPONENT_MAGNITUDE, max: SCENE_MAXIMUM_COMPONENT_MAGNITUDE }),
  Object.freeze({ id: "rotation-x", label: "Rotation X", field: "rotationEulerDegrees", axis: 0, step: 1, min: -SCENE_MAXIMUM_COMPONENT_MAGNITUDE, max: SCENE_MAXIMUM_COMPONENT_MAGNITUDE }),
  Object.freeze({ id: "rotation-y", label: "Rotation Y", field: "rotationEulerDegrees", axis: 1, step: 1, min: -SCENE_MAXIMUM_COMPONENT_MAGNITUDE, max: SCENE_MAXIMUM_COMPONENT_MAGNITUDE }),
  Object.freeze({ id: "rotation-z", label: "Rotation Z", field: "rotationEulerDegrees", axis: 2, step: 1, min: -SCENE_MAXIMUM_COMPONENT_MAGNITUDE, max: SCENE_MAXIMUM_COMPONENT_MAGNITUDE }),
  Object.freeze({ id: "scale-x", label: "Scale X", field: "scale", axis: 0, step: 0.1, min: SCENE_MINIMUM_SCALE, max: SCENE_MAXIMUM_COMPONENT_MAGNITUDE }),
  Object.freeze({ id: "scale-y", label: "Scale Y", field: "scale", axis: 1, step: 0.1, min: SCENE_MINIMUM_SCALE, max: SCENE_MAXIMUM_COMPONENT_MAGNITUDE }),
  Object.freeze({ id: "scale-z", label: "Scale Z", field: "scale", axis: 2, step: 0.1, min: SCENE_MINIMUM_SCALE, max: SCENE_MAXIMUM_COMPONENT_MAGNITUDE }),
] as const);

export type DesktopSceneTransformPropertyDefinition =
  (typeof DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS)[number];
export type DesktopSceneTransformPropertyId =
  DesktopSceneTransformPropertyDefinition["id"];

export type DesktopSceneEditOperation =
  | Readonly<{
      kind: "set-transform-component";
      instanceId: string;
      propertyId: DesktopSceneTransformPropertyId;
      value: number;
    }>
  | Readonly<{
      kind: "add-instance";
      sourceInstanceId: string;
    }>
  | Readonly<{
      kind: "remove-instance";
      instanceId: string;
    }>
  | Readonly<{
      kind: "create-object";
      sourceInstanceId: string;
      parentInstanceId: string;
    }>
  | Readonly<{
      kind: "remove-objects";
      instanceIds: readonly string[];
    }>
  | Readonly<{
      kind: "reparent-object";
      instanceId: string;
      parentInstanceId: string;
      transformPolicy: DesktopSceneReparentPolicy;
    }>
  | Readonly<{
      kind: "apply-transform";
      instanceIds: readonly string[];
      components: readonly Readonly<{
        instanceId: string;
        propertyId: DesktopSceneTransformPropertyId;
        value: number;
      }>[];
    }>;

export type DesktopSceneSelection = Readonly<{
  schemaVersion: typeof DESKTOP_SCENE_HIERARCHY_SCHEMA_VERSION;
  instanceIds: readonly string[];
  primaryInstanceId: string;
}>;

export type DesktopSceneSelectionResult =
  | Readonly<{ ok: true; selection: DesktopSceneSelection }>
  | Readonly<{
      ok: false;
      reason: typeof DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale |
        typeof DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported;
      message: string;
    }>;

export function desktopSceneTransformProperty(
  value: unknown,
): DesktopSceneTransformPropertyDefinition | null {
  return DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS.find(
    (definition) => definition.id === value,
  ) ?? null;
}

export function isDesktopSceneEditProfile(
  value: unknown,
): value is DesktopSceneEditProfile {
  return DESKTOP_SCENE_EDIT_PROFILES.some((profile) => profile === value);
}

export function isDesktopSceneReparentPolicy(
  value: unknown,
): value is DesktopSceneReparentPolicy {
  return DESKTOP_SCENE_REPARENT_POLICIES.some((policy) => policy === value);
}

export function isDesktopSceneSelectionInput(
  value: unknown,
): value is readonly string[] {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 32 &&
    value.every((id) => isSculptIdentifier(id)) &&
    new Set(value).size === value.length;
}

/** Canonicalize every client selection to the hierarchy's stable traversal order. */
export function resolveDesktopSceneSelection(
  value: unknown,
  hierarchyOrder: readonly string[],
): DesktopSceneSelectionResult {
  if (!isDesktopSceneSelectionInput(value)) {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
      message: "A selection must contain one to 32 unique canonical instance identifiers.",
    });
  }
  const requested = new Set(value);
  const canonical = hierarchyOrder.filter((id) => requested.has(id));
  if (canonical.length !== value.length) {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
      message: "The ordered selection names an instance absent from the current project hierarchy.",
    });
  }
  return Object.freeze({
    ok: true as const,
    selection: Object.freeze({
      schemaVersion: DESKTOP_SCENE_HIERARCHY_SCHEMA_VERSION,
      instanceIds: Object.freeze(canonical),
      primaryInstanceId: canonical[0] as string,
    }),
  });
}

/** Exact, side-effect-free validation at every transport boundary. */
export function isDesktopSceneEditOperation(
  value: unknown,
): value is DesktopSceneEditOperation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (typeof record["kind"] !== "string") return false;
  const keys = Object.keys(record).sort().join(",");
  if (record["kind"] === "set-transform-component") {
    const definition = desktopSceneTransformProperty(record["propertyId"]);
    const component = record["value"];
    return (
      keys === "instanceId,kind,propertyId,value" &&
      isSculptIdentifier(record["instanceId"]) &&
      definition !== null &&
      typeof component === "number" &&
      Number.isFinite(component) &&
      component >= definition.min &&
      component <= definition.max
    );
  }
  if (record["kind"] === "add-instance") {
    return keys === "kind,sourceInstanceId" && isSculptIdentifier(record["sourceInstanceId"]);
  }
  if (record["kind"] === "remove-instance") {
    return keys === "instanceId,kind" && isSculptIdentifier(record["instanceId"]);
  }
  if (record["kind"] === "create-object") {
    return keys === "kind,parentInstanceId,sourceInstanceId" &&
      isSculptIdentifier(record["sourceInstanceId"]) &&
      isSculptIdentifier(record["parentInstanceId"]);
  }
  if (record["kind"] === "remove-objects") {
    return keys === "instanceIds,kind" &&
      isDesktopSceneSelectionInput(record["instanceIds"]);
  }
  if (record["kind"] === "reparent-object") {
    return keys === "instanceId,kind,parentInstanceId,transformPolicy" &&
      isSculptIdentifier(record["instanceId"]) &&
      isSculptIdentifier(record["parentInstanceId"]) &&
      isDesktopSceneReparentPolicy(record["transformPolicy"]);
  }
  if (record["kind"] === "apply-transform") {
    const components = record["components"];
    return keys === "components,instanceIds,kind" &&
      isDesktopSceneSelectionInput(record["instanceIds"]) &&
      Array.isArray(components) &&
      components.length > 0 &&
      components.every((component) => {
        if (component === null || typeof component !== "object" || Array.isArray(component)) {
          return false;
        }
        const row = component as Record<string, unknown>;
        const definition = desktopSceneTransformProperty(row["propertyId"]);
        return Object.keys(row).sort().join(",") === "instanceId,propertyId,value" &&
          isSculptIdentifier(row["instanceId"]) &&
          definition !== null &&
          typeof row["value"] === "number" &&
          Number.isFinite(row["value"]) &&
          row["value"] >= definition.min &&
          row["value"] <= definition.max;
      });
  }
  return false;
}
