import { DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS } from "@sceneaxi/schemas";
import type { DesktopControlMint, DesktopVisualView } from "./core.js";

export function inspectorProperties(control: DesktopControlMint) {
  return Object.freeze(
    DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS.map((definition) =>
      control(`scene-property-${definition.id}`, definition.label, "live"),
    ),
  );
}

export function inspectorStageControl(control: DesktopControlMint) {
  return control("scene-property-stage", "Stage selected transform", "live");
}

export function inspectorCatalogs(control: DesktopControlMint): DesktopVisualView["product"]["inspectors"] {
  return Object.freeze(([
    ["physics", "physics-inspect", "physics-apply", "Physics"],
    ["environment", "environment-inspect", "environment-apply", "Environment"],
    ["material", "material-inspect", "material-apply", "Materials"],
    ["effect", "effect-inspect", "effect-apply", "Effects"],
  ] as const).map(([kind, inspectCommand, applyCommand, label]) => Object.freeze({
    kind,
    inspectCommand,
    applyCommand,
    inspect: control(`${kind}-inspect`, `Inspect ${label}`, "live"),
    mutation: control(`${kind}-mutation`, `${label} mutation JSON`, "live"),
    stage: control(`${kind}-stage`, `Stage ${label} change`, "live"),
  })));
}

export function inspectorTransformControls(control: DesktopControlMint) {
  return {
    transformModeTranslate: control("scene-transform-mode-translate", "Move gizmo", "live"),
    transformModeRotate: control("scene-transform-mode-rotate", "Rotate gizmo", "live"),
    transformModeScale: control("scene-transform-mode-scale", "Scale gizmo", "live"),
    transformSpace: control("scene-transform-space", "Transform space", "live"),
    transformPivot: control("scene-transform-pivot", "Transform pivot", "live"),
    transformSnap: control("scene-transform-snap", "Snap increment", "live"),
    transformNudgeXPlus: control("scene-transform-nudge-x-plus", "Nudge +X", "live"),
    transformNudgeXMinus: control("scene-transform-nudge-x-minus", "Nudge -X", "live"),
    transformNudgeYPlus: control("scene-transform-nudge-y-plus", "Nudge +Y", "live"),
    transformNudgeYMinus: control("scene-transform-nudge-y-minus", "Nudge -Y", "live"),
    transformNudgeZPlus: control("scene-transform-nudge-z-plus", "Nudge +Z", "live"),
    transformNudgeZMinus: control("scene-transform-nudge-z-minus", "Nudge -Z", "live"),
  };
}
