import { DESKTOP_VISUAL_REFUSALS, type DesktopModeId } from "../../visual-model.js";

/** Per-mode panel copy. Structure and contract notes only, never inventory. */
export const MODE_PANELS: Readonly<
  Record<
    DesktopModeId,
    Readonly<{
      leftTitle: string;
      leftEmpty: string;
      inspectorTitle: string;
      inspectorEmpty: string;
      note: string;
      noteTone: "info" | "scene" | "accent";
    }>
  >
> = Object.freeze({
  build: Object.freeze({
    leftTitle: "SCENE",
    leftEmpty: "The active Scene Document is listed above; Play sends its composed scene to the live viewport.",
    inspectorTitle: "Object",
    inspectorEmpty: "Select an object to move it.",
    note: "Generated edits arrive as proposals and land in Change Review before they touch a document.",
    noteTone: "info" as const,
  }),
  sculpt: Object.freeze({
    leftTitle: "SCULPT LIBRARY",
    leftEmpty: "Sculpt authoring is not available on this surface; use packaged Assistant Build for a supported artifact path.",
    inspectorTitle: "SCULPT OBJECT",
    inspectorEmpty: "No bound Sculpt job. Build passes are shown only as a static reference.",
    note: `Standalone Sculpt authoring writes nothing on this surface. ${DESKTOP_VISUAL_REFUSALS.noDocumentBound}`,
    noteTone: "accent" as const,
  }),
  compose: Object.freeze({
    leftTitle: "SCENE INSTANCES",
    leftEmpty: "Scene composition is consumed by Run; no composition editor is bound here.",
    inspectorTitle: "INSTANCE",
    inspectorEmpty: "No bound composition editor; Run validates the stored composed scene.",
    note: `This surface does not author placement transforms. ${DESKTOP_VISUAL_REFUSALS.noDocumentBound}`,
    noteTone: "scene" as const,
  }),
  animate: Object.freeze({
    leftTitle: "CLIPS",
    leftEmpty: "Animation authoring is not available on this surface.",
    inspectorTitle: "KEY",
    inspectorEmpty: "No bound timeline authoring job.",
    note: `No timeline edits are staged here. ${DESKTOP_VISUAL_REFUSALS.noDocumentBound}`,
    noteTone: "info" as const,
  }),
  run: Object.freeze({
    leftTitle: "RUNTIME",
    leftEmpty: "No kernel session is open on this surface, so there is no tick, frame, or body to report.",
    inspectorTitle: "LIVE VALUES",
    inspectorEmpty: "Live values need a running session.",
    note: "Every run records frames and ends with a digest. Replay plays the exact sequence back; a differing digest is reported as an error, never smoothed over.",
    noteTone: "info" as const,
  }),
  ship: Object.freeze({
    leftTitle: "TARGETS",
    leftEmpty: "Static Web · contained project files · Delivery Handoff v1.",
    inspectorTitle: "DELIVERY HANDOFF",
    inspectorEmpty: "No export has run for the current saved project bytes.",
    note: "Export writes a local content-addressed bundle. It never signs, uploads, deploys, approves, or releases it.",
    noteTone: "accent" as const,
  }),
  plugins: Object.freeze({
    leftTitle: "LOCKED",
    leftEmpty: "No contained packages are locked in this project.",
    inspectorTitle: "PACKAGE",
    inspectorEmpty: "Inspect the project lock. Marketplace and network sources stay disabled.",
    note: `Inspect the project lock; marketplace and network stay disabled. ${DESKTOP_VISUAL_REFUSALS.noDocumentBound}`,
    noteTone: "accent" as const,
  }),
});
