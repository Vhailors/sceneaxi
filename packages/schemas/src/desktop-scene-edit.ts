/**
 * Canonical selected-instance edit vocabulary shared by desktop presentation
 * and the privileged authoring host.
 *
 * The operation describes intent only. It never carries a Sculpt Artifact:
 * add-instance may therefore select only an artifact already validated inside
 * the open ComposedScene, and every operation is projected into an ordinary E1
 * proposal before any document bytes can change.
 */
import {
  SCENE_MAXIMUM_COMPONENT_MAGNITUDE,
  SCENE_MINIMUM_SCALE,
} from "./scene-composition.js";
import { isSculptIdentifier } from "./sculpt.js";

export const DESKTOP_SCENE_EDIT_PROFILES = Object.freeze(["game", "web"] as const);
export type DesktopSceneEditProfile = (typeof DESKTOP_SCENE_EDIT_PROFILES)[number];

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
  return false;
}
