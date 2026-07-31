/**
 * Editor-shell vocabulary parity across the two chrome surfaces (sceneaxi#184).
 *
 * The Engine Desktop chrome exists twice — `apps/desktop-shell`'s visual model
 * and the umbrella web editor's `buildEditorShellView` — and both project the
 * one shared vocabulary in `@sceneaxi/schemas` (`EDITOR_SHELL_MODES`, dock
 * tabs, assistant modes, window tiers). This suite asserts that as a data
 * identity, the same way `open-path-policy-parity.test.ts` does for the policy:
 * a surface that wants a different chrome has to change the shared model, and
 * a second fake state machine cannot drift in by review slip.
 *
 * Imports use relative paths into package sources so the root `tests/` tree
 * does not need hoisted `@sceneaxi/*` links.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EDITOR_SHELL_ASSISTANT_MODE_IDS,
  EDITOR_SHELL_METRICS,
  EDITOR_SHELL_MINIMUM_WINDOW,
  EDITOR_SHELL_MODE_IDS,
  EDITOR_SHELL_MODES,
  EDITOR_SHELL_RETIRED_COPY,
  EDITOR_SHELL_SOURCE,
  EDITOR_SHELL_WINDOW_TIERS,
  editorShellDockTabsFor,
} from "../../packages/schemas/src/index.ts";
import {
  DESKTOP_ASSISTANT_MODE_IDS,
  DESKTOP_MINIMUM_WINDOW,
  DESKTOP_MODES,
  DESKTOP_MODE_IDS,
  WINDOW_TIERS,
  dockTabsFor,
} from "../../apps/desktop-shell/src/visual-model.ts";
import { METRICS, VISUAL_SOURCE } from "../../apps/desktop-shell/src/visual-tokens.ts";
import { buildEditorShellView } from "../../packages/site-kit/src/editor-shell.ts";
import { readEditorState } from "../../packages/site-kit/src/editor-state.ts";
import { renderEditorState } from "../../packages/site-kit/src/editor-session.ts";
import { webEditorStarterArtifact } from "../../packages/site-kit/src/starter-artifact.ts";
import type { EditorShellView } from "../../packages/site-kit/src/editor-shell.ts";

function webShellView(): EditorShellView {
  const state = readEditorState({});
  if (!state.ok) throw new Error(`editor state refused: ${state.reason}`);
  const render = renderEditorState(state.value);
  if (!render.ok) throw new Error(`editor render refused: ${render.reason}`);
  const starter = webEditorStarterArtifact();
  if (!starter.ok) throw new Error(`starter refused: ${starter.reason}`);
  return buildEditorShellView({
    state: state.value,
    render: render.value,
    baseDocument: render.value.baseDocument,
    entitlement: { mode: "entitled", basis: "parity test" },
    starterArtifact: starter.value,
  });
}

describe("editor-shell vocabulary parity", () => {
  it("the desktop model's modes are the shared table, in order", () => {
    expect(DESKTOP_MODE_IDS).toEqual(EDITOR_SHELL_MODE_IDS);
    expect(DESKTOP_MODES.map((mode) => ({ id: mode.id, label: mode.label, title: mode.title }))).toEqual(
      EDITOR_SHELL_MODES.map((mode) => ({
        id: mode.id,
        label: mode.railLabel,
        title: mode.title,
      })),
    );
  });

  it("the desktop dock-tab derivation is the shared derivation, mode by mode", () => {
    for (const mode of EDITOR_SHELL_MODE_IDS) {
      expect(dockTabsFor(mode)).toEqual(editorShellDockTabsFor(mode));
    }
  });

  it("the web shell renders the shared modes and dock tabs verbatim", () => {
    const view = webShellView();
    expect(view.modes.map((mode) => mode.id)).toEqual([...EDITOR_SHELL_MODE_IDS]);
    for (const mode of view.modes) {
      expect(mode.railLabel).toBe(
        EDITOR_SHELL_MODES.find((row) => row.id === mode.id)?.railLabel,
      );
      expect(mode.dockTabs).toEqual(editorShellDockTabsFor(mode.id));
    }
  });

  it("assistant modes are one list on both surfaces", () => {
    expect(DESKTOP_ASSISTANT_MODE_IDS).toEqual(EDITOR_SHELL_ASSISTANT_MODE_IDS);
    const view = webShellView();
    expect(view.assistant.modes.map((control) => control.id)).toEqual(
      EDITOR_SHELL_ASSISTANT_MODE_IDS.map((mode) => `assistant-mode-${mode}`),
    );
  });

  it("window tiers and the refuse-below minimum are the shared numbers", () => {
    expect(DESKTOP_MINIMUM_WINDOW).toEqual(EDITOR_SHELL_MINIMUM_WINDOW);
    for (const shared of EDITOR_SHELL_WINDOW_TIERS) {
      const desktop = WINDOW_TIERS.find((tier) => tier.id === shared.id);
      expect(desktop, `desktop tier ${shared.id}`).toBeDefined();
      expect({
        minWidth: desktop?.minWidth,
        minHeight: desktop?.minHeight,
      }).toEqual({ minWidth: shared.minWidth, minHeight: shared.minHeight });
    }
  });

  it("the web editor stylesheet derives its breakpoints from the shared tiers", () => {
    // The sheet cannot import the table, so the derived media conditions are
    // asserted instead: both axes, one query per undocking tier, and the shared
    // minimum — the same both-axes rule the desktop chrome derives.
    const css = readFileSync(
      new URL("../../sites/umbrella/src/app/globals.css", import.meta.url),
      "utf8",
    );
    const compact = EDITOR_SHELL_WINDOW_TIERS.find((tier) => tier.id === "regular");
    const narrow = EDITOR_SHELL_WINDOW_TIERS.find((tier) => tier.id === "compact");
    expect(css).toContain(
      `@media (max-width: ${(compact?.minWidth ?? 0) - 1}px), (max-height: ${(compact?.minHeight ?? 0) - 1}px)`,
    );
    expect(css).toContain(
      `@media (max-width: ${(narrow?.minWidth ?? 0) - 1}px), (max-height: ${(narrow?.minHeight ?? 0) - 1}px)`,
    );
    expect(css).toContain(
      `@media (max-width: ${EDITOR_SHELL_MINIMUM_WINDOW.width - 1}px), (max-height: ${EDITOR_SHELL_MINIMUM_WINDOW.height - 1}px)`,
    );
  });

  it("both transcriptions anchor the same archive member", () => {
    expect(VISUAL_SOURCE.sha256).toBe(EDITOR_SHELL_SOURCE.archiveSha256);
    expect(VISUAL_SOURCE.member).toBe(EDITOR_SHELL_SOURCE.member);
  });

  it("the structural metrics match the desktop transcription of the archive", () => {
    expect({
      titleBar: EDITOR_SHELL_METRICS.titleBarHeight,
      rail: EDITOR_SHELL_METRICS.modeRailWidth,
      leftDock: EDITOR_SHELL_METRICS.leftDockWidth,
      inspector: EDITOR_SHELL_METRICS.inspectorWidth,
      assistant: EDITOR_SHELL_METRICS.assistantWidth,
      viewTabs: EDITOR_SHELL_METRICS.viewTabsHeight,
      dock: EDITOR_SHELL_METRICS.dockHeight,
      timelineDock: EDITOR_SHELL_METRICS.timelineDockHeight,
      statusBar: EDITOR_SHELL_METRICS.statusBarHeight,
      referenceWidth: EDITOR_SHELL_METRICS.referenceStage.width,
      referenceHeight: EDITOR_SHELL_METRICS.referenceStage.height,
    }).toEqual({
      titleBar: METRICS.titleBarHeight,
      rail: METRICS.railWidth,
      leftDock: METRICS.leftDockWidth,
      inspector: METRICS.inspectorWidth,
      assistant: METRICS.assistantWidth,
      viewTabs: METRICS.viewTabsHeight,
      dock: METRICS.dockHeight,
      timelineDock: METRICS.dockHeightAnimate,
      statusBar: METRICS.statusBarHeight,
      referenceWidth: METRICS.referenceWidth,
      referenceHeight: METRICS.referenceHeight,
    });
  });

  it("the retired presentation copy is absent from the web shell view", () => {
    const serialized = JSON.stringify(webShellView());
    for (const retired of EDITOR_SHELL_RETIRED_COPY) {
      expect(serialized).not.toContain(retired);
    }
  });
});
