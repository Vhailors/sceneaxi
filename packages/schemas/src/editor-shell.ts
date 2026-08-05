/**
 * The Engine Desktop editor-shell vocabulary (v1) — one shared answer to "what
 * *is* the editor's chrome?" (sceneaxi#184).
 *
 * The accepted design (`Engine Desktop.dc.html`, archive
 * `SceneAxi Design System.zip`, SHA-256 below) draws one stateful editor: a
 * seven-mode rail, a mode-dependent dock, three viewport sources, a command
 * palette, an assistant column, a profile switch, and a status bar. Two shipped
 * surfaces implement that chrome — the desktop shell
 * (`apps/desktop-shell`, sceneaxi#158) and the umbrella's entitled web editor
 * (`sites/umbrella` `/editor` through `@sceneaxi/site-kit`) — and before this
 * module each carried its own copy of the tables, so "the desktop's Run dock
 * and the web editor's Run dock disagree" was a review problem rather than a
 * failing test.
 *
 * The vocabulary lives in `@sceneaxi/schemas` because that is the only package
 * `docs/dependency-matrix.json` lets both consumers name: `desktop-shell` is
 * allowed exactly `schemas` + `authoring-core`, and `site-kit` the same pair.
 * Putting it anywhere else would require widening the matrix, so sharing would
 * have cost a boundary — the same reasoning that placed the open-path policy
 * here (`docs/open-path-policy.md`).
 *
 * What this module deliberately is **not**:
 *
 * - It is not a state machine. The one live editor state machine is
 *   `createMinimumE2Editor` in `@sceneaxi/authoring-core`; surface state
 *   (`DesktopVisualState`, the web editor's URL state) stays owned by each
 *   surface, projected over these tables rather than restating them.
 * - It is not a style sheet. Colours and typography stay owned by the
 *   Foundations v2 layer (`packages/site-kit/src/design-tokens.ts`, duplicated
 *   into `apps/desktop-shell/src/visual-tokens.ts` for the recorded
 *   matrix reason). Only structural metrics the archive fixes — region sizes a
 *   layout cannot disagree about — are carried here.
 * - It is not authority for what a control *does*. A surface still declares
 *   every control's kind, and an operation is real only where a real seam backs
 *   it (`WEB_EDITOR_SESSION_OPERATIONS` on the web, `DESKTOP_COMMANDS` on the
 *   desktop). Sharing the chrome must not smuggle an operation onto a surface
 *   whose contracts refuse it.
 *
 * Parity is asserted as a data identity in
 * `tests/parity/editor-shell-parity.test.ts`: the desktop model derives its
 * tables from these rows, and the web shell view is built over the same rows,
 * so a surface that wants a different chrome has to change the shared model.
 */

/** Contract major version. */
export const EDITOR_SHELL_SCHEMA_VERSION = 1 as const;

/**
 * The canonical design source these tables transcribe. The archive is a design
 * input, not a build input: nothing reads it at build time, and this constant
 * exists so a reviewer can re-derive any value from the named member of the
 * named archive — the same anchor `apps/desktop-shell/src/visual-tokens.ts`
 * records.
 */
export const EDITOR_SHELL_SOURCE = Object.freeze({
  archive: "SceneAxi Design System.zip",
  archiveSha256:
    "ad5d6e39215a4aee9c81b827308fc944784719168d3fba2db5d9e5ef8fc15159",
  member: "Engine Desktop.dc.html",
  syncedAt: "2026-07-25T12:40:00Z",
} as const);

/** The seven editor modes, in the archive's rail order. */
export const EDITOR_SHELL_MODE_IDS = Object.freeze([
  "build",
  "sculpt",
  "compose",
  "animate",
  "run",
  "ship",
  "plugins",
] as const);
export type EditorShellModeId = (typeof EDITOR_SHELL_MODE_IDS)[number];

/** The dock strip's tab identities across every mode. */
export const EDITOR_SHELL_DOCK_TAB_IDS = Object.freeze([
  "changes",
  "assets",
  "console",
  "evidence",
  "timeline",
] as const);
export type EditorShellDockTabId = (typeof EDITOR_SHELL_DOCK_TAB_IDS)[number];

export type EditorShellModeRow = Readonly<{
  id: EditorShellModeId;
  /** The rail's abbreviated label, uppercase in the archive. */
  railLabel: string;
  /** Accessible name for the mode. */
  title: string;
  /**
   * The dock tabs this mode offers, first entry being the tab the mode opens
   * on. `run` has no Changes tab because nothing is authored while running;
   * `ship` opens on Evidence because a handoff is judged by its digests.
   */
  dockTabs: ReadonlyArray<EditorShellDockTabId>;
}>;

/**
 * The mode table. Rail labels and order are the archive's; the dock mapping is
 * the accepted implemented one (`docs/engine-desktop-surface.md` records where
 * it deviates from the archive's fixture tabs and why — the archive's Run mode
 * prints a "Frames" tab of fabricated recordings, and a real surface shows its
 * evidence instead of inventing frame history).
 */
export const EDITOR_SHELL_MODES: ReadonlyArray<EditorShellModeRow> =
  Object.freeze([
    Object.freeze({
      id: "build",
      railLabel: "BUILD",
      title: "Build",
      dockTabs: Object.freeze(["changes", "assets", "console", "evidence"] as const),
    }),
    Object.freeze({
      id: "sculpt",
      railLabel: "SCULPT",
      title: "Sculpt",
      dockTabs: Object.freeze(["changes", "assets", "console", "evidence"] as const),
    }),
    Object.freeze({
      id: "compose",
      railLabel: "SCENE",
      title: "Scene composition",
      dockTabs: Object.freeze(["changes", "assets", "console", "evidence"] as const),
    }),
    Object.freeze({
      id: "animate",
      railLabel: "ANIM",
      title: "Animate",
      dockTabs: Object.freeze(["timeline", "changes", "console"] as const),
    }),
    Object.freeze({
      id: "run",
      railLabel: "RUN",
      title: "Run",
      dockTabs: Object.freeze(["console", "evidence"] as const),
    }),
    Object.freeze({
      id: "ship",
      railLabel: "SHIP",
      title: "Ship",
      dockTabs: Object.freeze(["evidence", "console"] as const),
    }),
    Object.freeze({
      id: "plugins",
      railLabel: "PLUG",
      title: "Plugins",
      dockTabs: Object.freeze(["changes", "assets", "console", "evidence"] as const),
    }),
  ]);

/** The mode row for an id — total, so a projection cannot miss a mode. */
export function editorShellModeRow(id: EditorShellModeId): EditorShellModeRow {
  const row = EDITOR_SHELL_MODES.find((mode) => mode.id === id);
  if (row === undefined) {
    throw new Error(`editor-shell: unknown mode ${JSON.stringify(id)}`);
  }
  return row;
}

/** The dock tabs a mode offers; first entry is the tab the mode opens on. */
export function editorShellDockTabsFor(
  mode: EditorShellModeId,
): ReadonlyArray<EditorShellDockTabId> {
  return editorShellModeRow(mode).dockTabs;
}

/**
 * The three viewport sources the archive's view-tab strip names. Switching one
 * requires a mounted presentation runtime, so a surface without one renders
 * them inert with its own named refusal.
 */
export const EDITOR_SHELL_VIEWPORT_SOURCES = Object.freeze([
  Object.freeze({ id: "scene", label: "Scene" } as const),
  Object.freeze({ id: "game", label: "Game" } as const),
  Object.freeze({ id: "sculpt-preview", label: "Sculpt preview" } as const),
]);
export type EditorShellViewportSourceId =
  (typeof EDITOR_SHELL_VIEWPORT_SOURCES)[number]["id"];

/** The assistant composer's three modes, in the archive's order. */
export const EDITOR_SHELL_ASSISTANT_MODE_IDS = Object.freeze([
  "ask",
  "build",
  "agent",
] as const);
export type EditorShellAssistantModeId =
  (typeof EDITOR_SHELL_ASSISTANT_MODE_IDS)[number];

/**
 * Assistant column states, one closed enumeration rather than a pair of
 * booleans: `denied` is not "closed", and a renderer must not be able to reach
 * the composer by flipping `open`. The deny is the Kids seat
 * (`THIRD_PARTY_LLM_DENIED_BY_DEFAULT`) and is not reopenable from the chrome.
 */
export const EDITOR_SHELL_ASSISTANT_STATES = Object.freeze([
  "open",
  "closed",
  "denied",
] as const);
export type EditorShellAssistantState =
  (typeof EDITOR_SHELL_ASSISTANT_STATES)[number];

/**
 * What an editor-shell control declares itself to be. This is the product
 * model's honesty contract, shared with the desktop chrome's own kinds
 * (`docs/engine-desktop-surface.md`):
 *
 * - `view` — changes visual state only, and genuinely works.
 * - `review` — edits a Change Review queue; writes no document.
 * - `live` — operates a real engine seam (a Minimum E2 session operation, a
 *   real save through propose/apply). Only a surface with a real session may
 *   mint one, and each maps to a named operation of that surface's own frozen
 *   operation set. The desktop chrome mints its own `live` controls only for
 *   the assistant product actions a consumer runtime binds, which is why the
 *   standalone `chrome` render keeps them inert (`docs/desktop-linux.md`).
 * - `inert` — renders, keeps its focus stop, and refuses by name.
 *
 * There is no fifth kind, and a control with no kind cannot exist: both
 * surfaces render controls only through helpers that require one.
 */
export const EDITOR_SHELL_CONTROL_KINDS = Object.freeze([
  "view",
  "review",
  "live",
  "inert",
] as const);
export type EditorShellControlKind =
  (typeof EDITOR_SHELL_CONTROL_KINDS)[number];

/**
 * Window tiers, shared so the desktop's `WINDOW_TIERS` and the web shell's
 * responsive breakpoints derive from one table. Columns undock outside-in;
 * below `minimum` a surface refuses rather than rendering an unusable layout.
 * Both axes are load-bearing: a 1920×700 window is `compact` on height alone.
 */
export const EDITOR_SHELL_WINDOW_TIERS = Object.freeze([
  Object.freeze({
    id: "regular",
    minWidth: 1440,
    minHeight: 720,
    undocked: Object.freeze([] as const),
  } as const),
  Object.freeze({
    id: "compact",
    minWidth: 1180,
    minHeight: 660,
    undocked: Object.freeze(["assistant"] as const),
  } as const),
  Object.freeze({
    id: "narrow",
    minWidth: 900,
    minHeight: 600,
    undocked: Object.freeze(["left-dock", "inspector", "assistant"] as const),
  } as const),
]);
export type EditorShellWindowTierId =
  (typeof EDITOR_SHELL_WINDOW_TIERS)[number]["id"] | "minimum";

/** The smallest window the editor chrome accepts. */
export const EDITOR_SHELL_MINIMUM_WINDOW = Object.freeze({
  width: 900,
  height: 600,
} as const);

/**
 * Structural metrics the archive fixes at its 1680×1000 reference stage, in CSS
 * pixels. These are layout facts both implementations draw — carried once so a
 * region cannot quietly change size on one surface. Colours are deliberately
 * absent: the Foundations v2 layer owns them.
 */
export const EDITOR_SHELL_METRICS = Object.freeze({
  referenceStage: Object.freeze({ width: 1680, height: 1000 } as const),
  titleBarHeight: 36,
  modeRailWidth: 56,
  leftDockWidth: 274,
  inspectorWidth: 326,
  assistantWidth: 344,
  viewTabsHeight: 32,
  dockHeight: 228,
  timelineDockHeight: 252,
  statusBarHeight: 27,
} as const);

/**
 * Retired presentation copy that must not return on any product surface
 * (ADR 0017 settled the presentation core; the archive predates it). Surfaces
 * assert these absent from everything they emit.
 */
export const EDITOR_SHELL_RETIRED_COPY = Object.freeze([
  "Preview renderer is experimental — not the final choice",
  "Experimental Three preview",
  "non-decision",
] as const);
