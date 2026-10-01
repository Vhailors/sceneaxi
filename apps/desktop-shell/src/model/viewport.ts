import { EDITOR_SHELL_VIEWPORT_SOURCES } from "@sceneaxi/schemas";
import {
  DESKTOP_ASSISTANT_MANIPULATORS,
  DESKTOP_VIEWPORT_SOURCE_IDS,
  DESKTOP_VISUAL_REFUSALS,
  SCULPT_PASSES,
  VIEWPORT_INERT_NOTE,
  type DesktopControlMint,
  type DesktopSculptView,
  type DesktopViewportSourceId,
  type DesktopVisualState,
  type DesktopVisualView,
} from "./core.js";

/** The shared row's own label, so a projection cannot miss a source. */
function viewportSourceLabel(id: DesktopViewportSourceId): string {
  const row = EDITOR_SHELL_VIEWPORT_SOURCES.find((source) => source.id === id);

  if (row === undefined) {
    throw new Error(`editor-shell names no viewport source ${JSON.stringify(id)}`);
  }

  return row.label;
}

/** The source the viewport shows; the other two cannot be entered. */
const VIEWPORT_SHOWN_SOURCE: DesktopViewportSourceId = "scene";

export function sculptView(state: DesktopVisualState, control: DesktopControlMint): DesktopSculptView {
  const passLabel = SCULPT_PASSES[state.sculptPass]?.runningLabel ?? "Finishing";

  return Object.freeze({
    phase: state.sculpt,
    passIndex: state.sculptPass,
    passCount: SCULPT_PASSES.length,
    percent: Math.round(state.sculptPassFraction * 100),
    label: passLabel,
    start: state.assistantRuntime === "local"
      ? control("sculpt-start", "Sculpt object", "live")
      : control(
          "sculpt-start",
          "Sculpt object",
          "inert",
          DESKTOP_VISUAL_REFUSALS.noPresentationRuntime,
        ),
    cancel: control(
      "sculpt-cancel",
      "Cancel after this pass",
      "inert",
      state.assistantRuntime === "local"
        ? DESKTOP_VISUAL_REFUSALS.noActiveCommand
        : DESKTOP_VISUAL_REFUSALS.noPresentationRuntime,
    ),
  });
}

export function viewportView(state: DesktopVisualState, control: DesktopControlMint): DesktopVisualView["viewport"] {
  return Object.freeze({
    inertNote: VIEWPORT_INERT_NOTE,
    refusal: DESKTOP_VISUAL_REFUSALS.noPresentationRuntime,
    pixelsDrawn: false as const,
    sources: Object.freeze(
      DESKTOP_VIEWPORT_SOURCE_IDS.map((id) =>
        Object.freeze({
          id,
          label: viewportSourceLabel(id),
          active: id === VIEWPORT_SHOWN_SOURCE,
          control: control(
            `viewport-source-${id}`,
            viewportSourceLabel(id),
            "inert",
            DESKTOP_VISUAL_REFUSALS.noPresentationRuntime,
          ),
        }),
      ),
    ),
    manipulators: Object.freeze(
      DESKTOP_ASSISTANT_MANIPULATORS.map((row) =>
        Object.freeze({
          ...row,
          control:
            state.assistantRuntime === "local"
              ? control(`assistant-manipulator-${row.id}`, row.label, "live")
              : control(
                  `assistant-manipulator-${row.id}`,
                  row.label,
                  "inert",
                  DESKTOP_VISUAL_REFUSALS.noPresentationRuntime,
                ),
        }),
      ),
    ),
  });
}

export function viewportRunControls(control: DesktopControlMint) {
  return {
    play: control("scene-play", "Play composed scene", "live"),
    runStop: control("run-stop", "Stop run", "live"),
    runReset: control("run-reset", "Reset run", "live"),
  };
}

export function viewportWebControls(state: DesktopVisualState, control: DesktopControlMint) {
  return {
    stageHtml:
      state.profile === "web"
        ? control("web-stage-html", "Stage starter HTML", "live")
        : control(
            "web-stage-html",
            "Stage starter HTML",
            "inert",
            DESKTOP_VISUAL_REFUSALS.webCapabilityRequired,
          ),
    injectAsset:
      state.profile === "web"
        ? control("web-inject-asset", "Import GLB/glTF", "live")
        : control(
            "web-inject-asset",
            "Import GLB/glTF",
            "inert",
            DESKTOP_VISUAL_REFUSALS.webCapabilityRequired,
          ),
  };
}
