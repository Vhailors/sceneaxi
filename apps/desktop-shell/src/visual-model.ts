/**
 * The Engine Desktop visual state model (sceneaxi#158).
 *
 * This is the *whole* decision layer of the desktop editor chrome: which mode
 * is active, which dock tabs that mode has, what the profile switch means, what
 * the assistant is allowed to do, which overlay is up, how far a sculpt run has
 * got, and — the part a mockup cannot answer — what each control actually does.
 * `chrome.ts` renders this and decides nothing.
 *
 * Three properties hold it honest:
 *
 * 1. **Every control declares its kind.** `view` controls change visual state
 *    and genuinely work. `review` controls edit the fixture Change Review queue
 *    and write no document. `live` controls declare a capability that a consumer
 *    runtime must bind. `inert` controls render, take focus, and refuse by a name
 *    from `DESKTOP_VISUAL_REFUSALS` — because the archive draws controls for
 *    behaviour this shell has no contract for, and drawing them as if they worked
 *    would be the lie. Nothing here invokes `authoring-core`, so the chrome cannot
 *    write a document by accident.
 *
 * 2. **Profiles are not restated, they are read.** The profile switch projects
 *    `openPathPolicyView()` from `@sceneaxi/schemas` — the same value
 *    `sceneaxi profile open-path`, `sceneaxi-desktop open-path`, and web-shell's
 *    `createOpenPathView()` report. So Kids is refuse-only here because the
 *    shared policy says so, with the shared code, and parity is a data identity
 *    a test asserts rather than four prose descriptions someone keeps aligned.
 *
 * 3. **Window size is a tier, not a scale factor.** The archive is a fixed
 *    1680x1000 stage scaled with a transform. That is a mockup device. Below a
 *    named minimum this model refuses the editor chrome outright rather than
 *    rendering an unusable one.
 */

import {
  EDITOR_SHELL_ASSISTANT_MODE_IDS,
  EDITOR_SHELL_DOCK_TAB_IDS,
  EDITOR_SHELL_MINIMUM_WINDOW,
  EDITOR_SHELL_MODE_IDS,
  EDITOR_SHELL_VIEWPORT_SOURCES,
  EDITOR_SHELL_WINDOW_TIERS,
  editorShellDockTabsFor,
  editorShellModeRow,
  OPEN_PATH_REFUSE_CODES,
  OPEN_PATH_REFUSE_ONLY_PROFILE,
  openPathPolicyView,
  type EditorShellAssistantState,
  type EditorShellViewportSourceId,
  type OpenPathPolicyViewModel,
  type OpenPathPolicyViewRow,
} from "@sceneaxi/schemas";
import { DESKTOP_COMMANDS } from "./commands.js";
import { METRICS } from "./visual-tokens.js";

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The mode vocabulary is the shared editor-shell model's (sceneaxi#184): one
 * table in `@sceneaxi/schemas` that this chrome and the umbrella's entitled web
 * editor both project, so the two surfaces cannot disagree about what the
 * editor's modes are. Only the glyph geometry below stays local — it is this
 * renderer's drawing detail, not product structure.
 */
export const DESKTOP_MODE_IDS = EDITOR_SHELL_MODE_IDS;

export type DesktopModeId = (typeof DESKTOP_MODE_IDS)[number];

/** Rail entries, with the archive's glyph geometry carried as data. */
export const DESKTOP_MODES: ReadonlyArray<
  Readonly<{
    id: DesktopModeId;
    label: string;
    /** Accessible name; the rail label is a four-letter abbreviation. */
    title: string;
    glyphRadius: string;
    glyphTransform: string;
  }>
> = Object.freeze(
  (
    [
      { id: "build", glyphRadius: "2px", glyphTransform: "none" },
      { id: "sculpt", glyphRadius: "50%", glyphTransform: "none" },
      { id: "compose", glyphRadius: "2px", glyphTransform: "rotate(45deg)" },
      { id: "animate", glyphRadius: "2px 9px 2px 9px", glyphTransform: "none" },
      { id: "run", glyphRadius: "50% 2px 50% 2px", glyphTransform: "none" },
      { id: "ship", glyphRadius: "2px", glyphTransform: "rotate(20deg)" },
      { id: "plugins", glyphRadius: "3px", glyphTransform: "none" },
    ] as const
  ).map((glyph) => {
    const shared = editorShellModeRow(glyph.id);
    return Object.freeze({
      id: glyph.id,
      label: shared.railLabel,
      title: shared.title,
      glyphRadius: glyph.glyphRadius,
      glyphTransform: glyph.glyphTransform,
    });
  }),
);

/**
 * The archive's application menus.
 *
 * Held as ids rather than as labels in the renderer so each menu is a modelled
 * control that goes through the same closed-registry accounting as every other
 * one: this shell has no command behind any of them, so all eight are inert and
 * name the reason a menu is inert, not the viewport's reason.
 */
export const DESKTOP_MENU_IDS = Object.freeze([
  "file",
  "edit",
  "scene",
  "object",
  "sculpt",
  "run",
  "window",
  "help",
] as const);
export type DesktopMenuId = (typeof DESKTOP_MENU_IDS)[number];

const MENU_LABELS: Readonly<Record<DesktopMenuId, string>> = Object.freeze({
  file: "File",
  edit: "Edit",
  scene: "Scene",
  object: "Object",
  sculpt: "Sculpt",
  run: "Run",
  window: "Window",
  help: "Help",
});

export const DESKTOP_PROFILE_IDS = Object.freeze(["game", "web", "kids"] as const);
export type DesktopProfileId = (typeof DESKTOP_PROFILE_IDS)[number];

/** Local profile id to the package name the shared open-path policy uses. */
export const DESKTOP_PROFILE_PACKAGES: Readonly<
  Record<DesktopProfileId, string>
> = Object.freeze({
  game: "@sceneaxi/profile-game",
  web: "@sceneaxi/profile-web",
  kids: "@sceneaxi/profile-kids",
});

export const DESKTOP_DOCK_TAB_IDS = EDITOR_SHELL_DOCK_TAB_IDS;
export type DesktopDockTabId = (typeof DESKTOP_DOCK_TAB_IDS)[number];

export const DESKTOP_OVERLAY_IDS = Object.freeze([
  "palette",
  "refused",
  "conflict",
] as const);
export type DesktopOverlayId = (typeof DESKTOP_OVERLAY_IDS)[number];

/**
 * The buttons that dismiss an overlay.
 *
 * Held as data with one identity each because there are four of them across two
 * dialogs, and a single shared `overlay-close` control cannot be rendered onto
 * four elements: an id is unique or the `aria-describedby` and `getElementById`
 * references in this document stop meaning anything.
 */
export const DESKTOP_OVERLAY_DISMISSALS: ReadonlyArray<
  Readonly<{
    id: string;
    overlay: DesktopOverlayId;
    label: string;
    emphasis: "ghost" | "primary";
  }>
> = Object.freeze([
  Object.freeze({ id: "refused-keep-draft", overlay: "refused" as const, label: "Keep draft", emphasis: "ghost" as const }),
  Object.freeze({ id: "refused-edit-brief", overlay: "refused" as const, label: "Edit the brief", emphasis: "primary" as const }),
  Object.freeze({ id: "conflict-discard", overlay: "conflict" as const, label: "Discard them", emphasis: "ghost" as const }),
  Object.freeze({ id: "conflict-review", overlay: "conflict" as const, label: "Review against current", emphasis: "primary" as const }),
]);

/** The status bar's overlay shortcuts, in the order the archive draws them. */
export const DESKTOP_OVERLAY_SHORTCUTS: ReadonlyArray<
  Readonly<{ overlay: DesktopOverlayId; label: string }>
> = Object.freeze([
  Object.freeze({ overlay: "refused" as const, label: "REFUSED" }),
  Object.freeze({ overlay: "conflict" as const, label: "CONFLICT" }),
  Object.freeze({ overlay: "palette" as const, label: "⌘K" }),
]);

/**
 * The two columns that get a title-bar opener once they undock.
 *
 * The assistant is not here: it undocks too, but its opener is the assistant
 * toggle it already has at every tier.
 */
export const DESKTOP_DRAWER_IDS = Object.freeze(["left", "inspector"] as const);
export type DesktopDrawerId = (typeof DESKTOP_DRAWER_IDS)[number];

const DRAWER_LABELS: Readonly<Record<DesktopDrawerId, string>> = Object.freeze({
  left: "Panels",
  inspector: "Inspector",
});

/** The region id each drawer toggle controls. */
const DRAWER_TARGETS: Readonly<Record<DesktopDrawerId, string>> = Object.freeze({
  left: "left-dock",
  inspector: "inspector",
});

export const DESKTOP_ASSISTANT_MODE_IDS = EDITOR_SHELL_ASSISTANT_MODE_IDS;
export type DesktopAssistantModeId = (typeof DESKTOP_ASSISTANT_MODE_IDS)[number];

export type DesktopSculptPhase = "idle" | "running";

/**
 * Assistant states, as one closed enumeration rather than a pair of booleans —
 * `denied` is not "closed", and a renderer must not be able to reach the
 * composer by flipping `open`. The enumeration is the shared editor-shell
 * model's, so the two chrome surfaces cannot disagree about what states exist.
 */
export type DesktopAssistantState = EditorShellAssistantState;
export type DesktopAssistantRuntime = "none" | "local";
export type DesktopAssistantRoute = "local" | "byo" | "hosted";

export const DESKTOP_ASSISTANT_RUNTIME_EVENT =
  "sceneaxi:desktop-assistant-runtime";

export const DESKTOP_ASSISTANT_MANIPULATORS = Object.freeze([
  Object.freeze({ id: "move-x", label: "Move +X" }),
  Object.freeze({ id: "move-y", label: "Move +Y" }),
  Object.freeze({ id: "rotate-y", label: "Rotate Y" }),
  Object.freeze({ id: "scale-up", label: "Scale +" }),
] as const);

export type DesktopAssistantManipulatorId =
  (typeof DESKTOP_ASSISTANT_MANIPULATORS)[number]["id"];

/* -------------------------------------------------------------------------- */
/* Refusals                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Every reason this surface declines to do something, as a closed registry.
 * A control may only be inert for a reason named here, and every reason must be
 * reachable — `test/visual-model.test.ts` asserts both directions.
 */
export const DESKTOP_VISUAL_REFUSALS = Object.freeze({
  /** Kids is refuse-only; the code comes from the shared open-path policy. */
  kidsRefuseOnly: OPEN_PATH_REFUSE_CODES.kidsRefused,
  kidsAssistantDenied: "DESKTOP_KIDS_ASSISTANT_DENIED",
  /** The viewport draws nothing: no presentation dependency exists here. */
  noPresentationRuntime: "DESKTOP_NO_PRESENTATION_RUNTIME",
  /** No kernel session: the dependency matrix denies the kernel to this package. */
  noKernelSession: "DESKTOP_NO_KERNEL_SESSION",
  /** The chrome is not bound to a document, so nothing may be authored. */
  noDocumentBound: "DESKTOP_NO_DOCUMENT_BOUND",
  /** The control names a CLI verb this shell has no command for. */
  verbNotOnDesktop: "DESKTOP_VERB_NOT_ON_THIS_SURFACE",
  /** The window is smaller than the editor chrome's declared minimum. */
  windowBelowMinimum: "DESKTOP_WINDOW_BELOW_MINIMUM",
} as const);

export type DesktopVisualRefusal =
  (typeof DESKTOP_VISUAL_REFUSALS)[keyof typeof DESKTOP_VISUAL_REFUSALS];

/** Sentence a renderer may print verbatim for each refusal. */
export const DESKTOP_REFUSAL_MESSAGES: Readonly<
  Record<DesktopVisualRefusal, string>
> = Object.freeze({
  [DESKTOP_VISUAL_REFUSALS.kidsRefuseOnly]:
    `${OPEN_PATH_REFUSE_ONLY_PROFILE} is refuse-only: no open path, no UI, no commerce.`,
  [DESKTOP_VISUAL_REFUSALS.kidsAssistantDenied]:
    "Kids denies third-party model routes by default. Nothing crosses over from Game or Website.",
  [DESKTOP_VISUAL_REFUSALS.noPresentationRuntime]:
    "No presentation runtime is mounted on this surface, so the viewport draws no pixels.",
  [DESKTOP_VISUAL_REFUSALS.noKernelSession]:
    "This shell opens no kernel session, so nothing simulates, advances, or replays here.",
  [DESKTOP_VISUAL_REFUSALS.noDocumentBound]:
    "The chrome is not bound to a document, so this control writes nothing.",
  [DESKTOP_VISUAL_REFUSALS.verbNotOnDesktop]:
    "That verb exists on the CLI and has no desktop command; run it with `sceneaxi`.",
  [DESKTOP_VISUAL_REFUSALS.windowBelowMinimum]:
    "The editor chrome refuses below its minimum window size rather than rendering an unusable layout.",
});

/* -------------------------------------------------------------------------- */
/* Window tiers                                                                */
/* -------------------------------------------------------------------------- */

export type DesktopWindowTierId = "regular" | "compact" | "narrow" | "minimum";

export type DesktopWindowSize = Readonly<{ width: number; height: number }>;

/**
 * The documented responsive strategy. Each tier names which of the five columns
 * stay docked; anything not docked either becomes an overlay drawer or is
 * dropped, and the model says which.
 *
 * Widths are the sum of the archive's own column metrics plus a workable centre,
 * so a tier boundary is derived from the layout rather than a round number
 * somebody liked. The thresholds themselves come from the shared editor-shell
 * model, so this chrome and the web editor undock at the same sizes; the tier
 * shape — docked columns, drawers, summaries — stays this chrome's own.
 */
const sharedTier = (
  id: "regular" | "compact" | "narrow",
): Readonly<{ minWidth: number; minHeight: number }> => {
  const tier = EDITOR_SHELL_WINDOW_TIERS.find((row) => row.id === id);
  if (tier === undefined) {
    throw new Error(`editor-shell model names no ${id} window tier`);
  }
  return tier;
};

export const WINDOW_TIERS: ReadonlyArray<
  Readonly<{
    id: DesktopWindowTierId;
    minWidth: number;
    minHeight: number;
    /** Columns that stay docked at this tier, outside-in. */
    dockedColumns: ReadonlyArray<
      "rail" | "leftDock" | "viewport" | "inspector" | "assistant"
    >;
    /** Columns that become an overlay drawer instead of a column. */
    drawerColumns: ReadonlyArray<"leftDock" | "inspector" | "assistant">;
    summary: string;
  }>
> = Object.freeze([
  Object.freeze({
    id: "regular",
    minWidth: sharedTier("regular").minWidth,
    minHeight: sharedTier("regular").minHeight,
    dockedColumns: Object.freeze([
      "rail",
      "leftDock",
      "viewport",
      "inspector",
      "assistant",
    ] as const),
    drawerColumns: Object.freeze([] as const),
    summary:
      "Every column docked, as the archive draws it: rail, left dock, viewport, inspector, assistant.",
  }),
  Object.freeze({
    id: "compact",
    minWidth: sharedTier("compact").minWidth,
    minHeight: sharedTier("compact").minHeight,
    dockedColumns: Object.freeze([
      "rail",
      "leftDock",
      "viewport",
      "inspector",
    ] as const),
    drawerColumns: Object.freeze(["assistant"] as const),
    summary:
      "The assistant becomes an overlay drawer; its toggle still reports the same open/closed/denied state.",
  }),
  Object.freeze({
    id: "narrow",
    minWidth: sharedTier("narrow").minWidth,
    minHeight: sharedTier("narrow").minHeight,
    dockedColumns: Object.freeze(["rail", "viewport"] as const),
    drawerColumns: Object.freeze([
      "leftDock",
      "inspector",
      "assistant",
    ] as const),
    summary:
      "Only the rail and the viewport stay docked; left dock, inspector, and assistant are drawers over the viewport.",
  }),
  Object.freeze({
    id: "minimum",
    minWidth: 0,
    minHeight: 0,
    dockedColumns: Object.freeze([] as const),
    drawerColumns: Object.freeze([] as const),
    summary:
      "Below 900x600 the editor chrome refuses by name instead of rendering a layout it cannot lay out.",
  }),
]);

/** The smallest window the editor chrome will render. */
export const DESKTOP_MINIMUM_WINDOW: DesktopWindowSize = Object.freeze({
  width: EDITOR_SHELL_MINIMUM_WINDOW.width,
  height: EDITOR_SHELL_MINIMUM_WINDOW.height,
});


/** The window size the archive was drawn at, used as the evidence reference. */
export const DESKTOP_REFERENCE_WINDOW: DesktopWindowSize = Object.freeze({
  width: METRICS.referenceWidth,
  height: METRICS.referenceHeight,
});

export function resolveWindowTier(size: DesktopWindowSize): DesktopWindowTierId {
  for (const tier of WINDOW_TIERS) {
    if (size.width >= tier.minWidth && size.height >= tier.minHeight) {
      return tier.id;
    }
  }
  return "minimum";
}

/* -------------------------------------------------------------------------- */
/* State                                                                       */
/* -------------------------------------------------------------------------- */

export type DesktopVisualState = Readonly<{
  mode: DesktopModeId;
  profile: DesktopProfileId;
  dockTab: DesktopDockTabId;
  overlay: DesktopOverlayId | null;
  assistant: DesktopAssistantState;
  assistantMode: DesktopAssistantModeId;
  assistantThinking: boolean;
  /** Runtime capability bound by the consumer; the standalone chrome has none. */
  assistantRuntime: DesktopAssistantRuntime;
  assistantRoute: DesktopAssistantRoute;
  sculpt: DesktopSculptPhase;
  /** 0-based pass index, clamped to the five-pass plan. */
  sculptPass: number;
  /** Fraction of the current pass, 0..1. */
  sculptPassFraction: number;
  /** Change Review rows the operator has already decided on, by index. */
  decidedChanges: ReadonlyArray<number>;
  selection: string;
  window: DesktopWindowSize;
}>;

/**
 * The dock tabs each mode has. Mode-dependent by design: `run` has no Changes
 * tab because nothing may be authored while a scene runs, and `animate` gains a
 * Timeline. Deriving it here means a renderer cannot show a tab the mode does
 * not have.
 */
export function dockTabsFor(
  mode: DesktopModeId,
): ReadonlyArray<DesktopDockTabId> {
  return editorShellDockTabsFor(mode);
}

/** The tab a mode opens on when it is entered. */
export function defaultDockTabFor(mode: DesktopModeId): DesktopDockTabId {
  const tabs = dockTabsFor(mode);
  return tabs[0] ?? "console";
}

const INITIAL_STATE: DesktopVisualState = Object.freeze({
  mode: "build",
  profile: "game",
  dockTab: "changes",
  overlay: null,
  assistant: "open",
  assistantMode: "build",
  assistantThinking: false,
  assistantRuntime: "none",
  assistantRoute: "local",
  sculpt: "idle",
  sculptPass: 2,
  sculptPassFraction: 0.64,
  decidedChanges: Object.freeze([] as number[]),
  selection: "crate_service_a",
  window: DESKTOP_REFERENCE_WINDOW,
});

/**
 * Build a state.
 *
 * Constructing a state for a mode opens that mode's own default dock tab, the
 * same as entering the mode does — otherwise `{ mode: "animate" }` would keep
 * the seed's Changes tab, which animate happens to have, and a caller would get
 * a different tab depending on which mode they asked for. Pass `dockTab`
 * explicitly to choose one.
 */
export function createDesktopVisualState(
  overrides: Partial<DesktopVisualState> = {},
): DesktopVisualState {
  const mode = overrides.mode ?? INITIAL_STATE.mode;
  return normalize({
    ...INITIAL_STATE,
    dockTab: defaultDockTabFor(mode),
    ...overrides,
  });
}

/**
 * Bring a state back onto its own invariants: the dock tab must exist in the
 * active mode, and Kids may not hold an open assistant. Applied after every
 * action so no caller can construct a state the renderer would have to guess at.
 */
function normalize(state: DesktopVisualState): DesktopVisualState {
  const tabs = dockTabsFor(state.mode);
  const dockTab = tabs.includes(state.dockTab)
    ? state.dockTab
    : defaultDockTabFor(state.mode);
  const assistant: DesktopAssistantState =
    state.profile === "kids" ? "denied" : state.assistant === "denied" ? "open" : state.assistant;
  return Object.freeze({
    ...state,
    dockTab,
    assistant,
    assistantThinking: assistant === "open" ? state.assistantThinking : false,
    sculptPass: Math.min(Math.max(Math.trunc(state.sculptPass), 0), 4),
    sculptPassFraction: Math.min(Math.max(state.sculptPassFraction, 0), 1),
    decidedChanges: Object.freeze([...new Set(state.decidedChanges)].sort((a, b) => a - b)),
  });
}

export type DesktopVisualAction =
  | Readonly<{ type: "select-mode"; mode: DesktopModeId }>
  | Readonly<{ type: "select-profile"; profile: DesktopProfileId }>
  | Readonly<{ type: "select-dock-tab"; tab: DesktopDockTabId }>
  | Readonly<{ type: "open-overlay"; overlay: DesktopOverlayId }>
  | Readonly<{ type: "close-overlay" }>
  | Readonly<{ type: "toggle-assistant" }>
  | Readonly<{ type: "select-assistant-mode"; mode: DesktopAssistantModeId }>
  | Readonly<{ type: "toggle-assistant-thinking" }>
  | Readonly<{ type: "start-sculpt" }>
  | Readonly<{ type: "cancel-sculpt" }>
  | Readonly<{ type: "advance-sculpt"; by: number }>
  | Readonly<{ type: "decide-change"; index: number }>
  | Readonly<{ type: "decide-all-changes" }>
  | Readonly<{ type: "select-object"; name: string }>
  | Readonly<{ type: "resize"; size: DesktopWindowSize }>;

/**
 * Apply one action. Total and pure: an action that cannot apply (toggling a
 * denied assistant) returns the state unchanged rather than throwing, because
 * the corresponding control is already rendered inert and a renderer that
 * dispatches anyway must not be able to crash the shell.
 */
export function applyDesktopVisualAction(
  state: DesktopVisualState,
  action: DesktopVisualAction,
): DesktopVisualState {
  switch (action.type) {
    case "select-mode":
      return normalize({
        ...state,
        mode: action.mode,
        overlay: null,
        dockTab: defaultDockTabFor(action.mode),
      });
    case "select-profile":
      return normalize({ ...state, profile: action.profile, overlay: null });
    case "select-dock-tab":
      return dockTabsFor(state.mode).includes(action.tab)
        ? normalize({ ...state, dockTab: action.tab })
        : state;
    case "open-overlay":
      return normalize({ ...state, overlay: action.overlay });
    case "close-overlay":
      return normalize({ ...state, overlay: null });
    case "toggle-assistant":
      return state.assistant === "denied"
        ? state
        : normalize({
            ...state,
            assistant: state.assistant === "open" ? "closed" : "open",
          });
    case "select-assistant-mode":
      return state.assistant === "open"
        ? normalize({ ...state, assistantMode: action.mode })
        : state;
    case "toggle-assistant-thinking":
      return state.assistant === "open"
        ? normalize({ ...state, assistantThinking: !state.assistantThinking })
        : state;
    case "start-sculpt":
      return normalize({
        ...state,
        mode: "sculpt",
        dockTab: defaultDockTabFor("sculpt"),
        sculpt: "running",
        sculptPass: 0,
        sculptPassFraction: 0,
      });
    case "cancel-sculpt":
      return normalize({ ...state, sculpt: "idle" });
    case "advance-sculpt": {
      if (state.sculpt !== "running") return state;
      const next = state.sculptPassFraction + action.by;
      if (next < 1) return normalize({ ...state, sculptPassFraction: next });
      return normalize({
        ...state,
        sculptPass: state.sculptPass + 1,
        sculptPassFraction: 0,
      });
    }
    case "decide-change":
      return normalize({
        ...state,
        decidedChanges: [...state.decidedChanges, action.index],
      });
    case "decide-all-changes":
      return normalize({
        ...state,
        decidedChanges: CHANGE_REVIEW_ROWS.map((_row, index) => index),
      });
    case "select-object":
      return normalize({ ...state, selection: action.name });
    case "resize":
      return normalize({ ...state, window: action.size });
  }
}

/* -------------------------------------------------------------------------- */
/* Fixture content                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The Change Review queue. Fixture rows from the archive, held here so the
 * dock's badge count, its empty state, and its accept/reject arithmetic are one
 * thing a test can drive — not three numbers a renderer keeps in step.
 */
export const CHANGE_REVIEW_ROWS: ReadonlyArray<
  Readonly<{
    badge: string;
    kind: "modified" | "added";
    path: string;
    directory: string;
    leaf: string;
    before: string;
    after: string;
  }>
> = Object.freeze([
  Object.freeze({
    badge: "M",
    kind: "modified" as const,
    path: "/scene/objects/field_drone/position",
    directory: "objects/field_drone",
    leaf: "/position",
    before: "0, 0, 0",
    after: "0, 1.85, -2.30",
  }),
  Object.freeze({
    badge: "+",
    kind: "added" as const,
    path: "/scene/objects/field_drone/sockets/rotor_fl",
    directory: "objects/field_drone/sockets",
    leaf: "/rotor_fl",
    before: "—",
    after: "spin 0 → 360°",
  }),
  Object.freeze({
    badge: "+",
    kind: "added" as const,
    path: "/scene/materials/matte_polymer",
    directory: "materials",
    leaf: "/matte_polymer",
    before: "—",
    after: "rough 0.74",
  }),
]);

/** The five-pass sculpt plan the archive shows, and its progress copy. */
export const SCULPT_PASSES: ReadonlyArray<
  Readonly<{ name: string; description: string; runningLabel: string }>
> = Object.freeze([
  Object.freeze({ name: "Blockout", description: "Overall silhouette and proportions", runningLabel: "Blocking out the shape" }),
  Object.freeze({ name: "Structure", description: "Parts, seams, how it comes apart", runningLabel: "Building the structure" }),
  Object.freeze({ name: "Surface detail", description: "Wear, stencils, raised geometry", runningLabel: "Adding surface detail" }),
  Object.freeze({ name: "Materials", description: "Paint, metal, rubber and finish", runningLabel: "Assigning materials" }),
  Object.freeze({ name: "Sockets & pivots", description: "Where it hinges and animates", runningLabel: "Placing sockets" }),
]);

/**
 * The command palette. Each row names the CLI verb the archive names, and — the
 * part that keeps it honest — whether *this* surface can drive it. A row whose
 * `desktopCommand` is a `DESKTOP_COMMANDS` key is real; every other row renders
 * inert with `verbNotOnDesktop`, because `sceneaxi project dev` is a CLI verb
 * and this shell has no command for it.
 */
export const PALETTE_GROUPS: ReadonlyArray<
  Readonly<{
    title: string;
    items: ReadonlyArray<
      Readonly<{
        /**
         * Stable row identity, and the only thing a rendered element id is
         * derived from. Display text is not an identity: two rows may name the
         * same CLI verb in the same mode, and a verb contains spaces, which is
         * not permitted in an HTML id.
         */
        id: string;
        name: string;
        cli: string;
        shortcut: string;
        mode: DesktopModeId;
        /** A key of `DESKTOP_COMMANDS`, or null when this surface has none. */
        desktopCommand: string | null;
      }>
    >;
  }>
> = Object.freeze([
  Object.freeze({
    title: "SCULPT",
    items: Object.freeze([
      Object.freeze({ id: "sculpt-from-reference", name: "Sculpt an object from a reference", cli: "sceneaxi project propose", shortcut: "⇧S", mode: "sculpt" as const, desktopCommand: "propose" }),
      Object.freeze({ id: "resculpt-selection", name: "Re-sculpt selection with changes", cli: "sceneaxi project propose", shortcut: "", mode: "sculpt" as const, desktopCommand: "propose" }),
    ]),
  }),
  Object.freeze({
    title: "SCENE",
    items: Object.freeze([
      Object.freeze({ id: "compose-instances", name: "Compose instances into a scene", cli: "sceneaxi project apply", shortcut: "⇧C", mode: "compose" as const, desktopCommand: "apply" }),
      Object.freeze({ id: "import-document", name: "Import an external document", cli: "sceneaxi asset list", shortcut: "", mode: "build" as const, desktopCommand: null }),
    ]),
  }),
  Object.freeze({
    title: "RUN & SHIP",
    items: Object.freeze([
      Object.freeze({ id: "play-scene", name: "Play the scene", cli: "sceneaxi project dev", shortcut: "⌘P", mode: "run" as const, desktopCommand: null }),
      Object.freeze({ id: "replay-last-run", name: "Replay the last run", cli: "sceneaxi evidence list", shortcut: "", mode: "run" as const, desktopCommand: null }),
      Object.freeze({ id: "export-handoff", name: "Export a delivery handoff", cli: "sceneaxi project capture", shortcut: "", mode: "ship" as const, desktopCommand: null }),
    ]),
  }),
]);

/**
 * What this surface's viewport says about itself.
 *
 * The archive also draws a second line calling the preview renderer
 * experimental and not the final choice. That sentence is not carried: the
 * captain settled Three as the product presentation core (ADR 0017), so a
 * product surface asserting the renderer choice is still open would be stale
 * copy, and the archive is authority for purely visual facts rather than for
 * product ones. The retired labels ADR 0017 names stay asserted absent.
 */
export const VIEWPORT_INERT_NOTE =
  "No renderer is mounted on this surface — the viewport is inert and draws no pixels.";

/**
 * The viewport's source tabs.
 *
 * The archive draws three, and none of them can be honoured here: switching
 * what a viewport shows needs a presentation runtime, and this surface mounts
 * none. They are modelled as controls so all three declare a kind and name that
 * reason, rather than being three tab-shaped elements nothing accounts for.
 */
export const DESKTOP_VIEWPORT_SOURCE_IDS = Object.freeze(
  EDITOR_SHELL_VIEWPORT_SOURCES.map((source) => source.id),
);
export type DesktopViewportSourceId = EditorShellViewportSourceId;

/** The shared row's own label — total, so a projection cannot miss a source. */
function viewportSourceLabel(id: DesktopViewportSourceId): string {
  const row = EDITOR_SHELL_VIEWPORT_SOURCES.find((source) => source.id === id);
  if (row === undefined) {
    throw new Error(`editor-shell names no viewport source ${JSON.stringify(id)}`);
  }
  return row.label;
}

/** The source the viewport shows; the other two cannot be entered. */
const VIEWPORT_SHOWN_SOURCE: DesktopViewportSourceId = "scene";

/** The named code the archive prints on the Kids assistant lock screen. */
export const KIDS_ASSISTANT_LOCK_CODE = "THIRD_PARTY_LLM_DENIED_BY_DEFAULT";

/**
 * The refuse-only profile's assistant denial, independent of any state.
 *
 * Exported for the same reason as `kidsProfileRefusal()`: the renderer emits the
 * lock screen in every document and shows it with a CSS rule, so a browser-side
 * profile switch reaches the same named refusal the model reports instead of a
 * client toggle walking around a server-side branch.
 */
export function kidsAssistantDenial(): Readonly<{
  code: DesktopVisualRefusal;
  message: string;
  lockCode: typeof KIDS_ASSISTANT_LOCK_CODE;
}> {
  return Object.freeze({
    code: DESKTOP_VISUAL_REFUSALS.kidsAssistantDenied,
    message:
      DESKTOP_REFUSAL_MESSAGES[DESKTOP_VISUAL_REFUSALS.kidsAssistantDenied],
    lockCode: KIDS_ASSISTANT_LOCK_CODE,
  });
}

const ASSISTANT_MODEL_LABELS = Object.freeze({
  denied: "denied",
  noProvider: "no provider configured",
});

/* -------------------------------------------------------------------------- */
/* View projection                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The refuse-only profile's refusal, independent of any state.
 *
 * Exported so the renderer can emit the refusal region unconditionally and show
 * it with a CSS rule: a browser-side profile switch then reaches the same
 * refusal the model reports, instead of a client toggle walking around a
 * server-side branch.
 */
export function kidsProfileRefusal(): Readonly<{
  code: DesktopVisualRefusal;
  message: string;
  summary: string;
  profile: typeof OPEN_PATH_REFUSE_ONLY_PROFILE;
}> {
  const row = openPathPolicyView().rows.find(
    (candidate) => candidate.profile === OPEN_PATH_REFUSE_ONLY_PROFILE,
  );
  return Object.freeze({
    code: DESKTOP_VISUAL_REFUSALS.kidsRefuseOnly,
    message: DESKTOP_REFUSAL_MESSAGES[DESKTOP_VISUAL_REFUSALS.kidsRefuseOnly],
    summary: row?.summary ?? "",
    profile: OPEN_PATH_REFUSE_ONLY_PROFILE,
  });
}

export type DesktopControlKind = "view" | "review" | "live" | "inert";

export type DesktopControl = Readonly<{
  id: string;
  label: string;
  kind: DesktopControlKind;
  /** Present exactly when `kind` is `inert`. */
  refusal: DesktopVisualRefusal | null;
  /** The refusal sentence, or null when the control works. */
  refusalMessage: string | null;
}>;

function buildControl(
  id: string,
  label: string,
  kind: DesktopControlKind,
  refusal: DesktopVisualRefusal | null,
): DesktopControl {
  return Object.freeze({
    id,
    label,
    kind,
    refusal,
    refusalMessage: refusal === null ? null : DESKTOP_REFUSAL_MESSAGES[refusal],
  });
}

function liveControl(
  id: string,
  label: string,
  kind: Exclude<DesktopControlKind, "inert">,
): DesktopControl;
function liveControl(
  id: string,
  label: string,
  kind: "inert",
  refusal: DesktopVisualRefusal,
): DesktopControl;
function liveControl(
  id: string,
  label: string,
  kind: DesktopControlKind,
  refusal?: DesktopVisualRefusal,
): DesktopControl {
  return buildControl(id, label, kind, refusal ?? null);
}

/** The mint every control in one projection is made through. */
type DesktopControlMint = typeof liveControl;

/**
 * What the refuse-only profile does to one control.
 *
 * A control that is already inert keeps its own, more specific reason — the
 * assistant's denial and the menus' "not a verb here" say more than
 * `OPEN_PATH_KIDS_REFUSED` would, and one control must not carry two refusals.
 * Everything else becomes inert and names the profile refusal.
 */
function refuseOnlyControl(built: DesktopControl): DesktopControl {
  return built.kind === "inert"
    ? built
    : buildControl(
        built.id,
        built.label,
        "inert",
        DESKTOP_VISUAL_REFUSALS.kidsRefuseOnly,
      );
}

export type DesktopProfileChip = Readonly<{
  id: DesktopProfileId;
  label: string;
  packageName: string;
  active: boolean;
  /**
   * The chip itself. Live on every profile including the refuse-only one: the
   * switch is how an operator leaves the refusal, so making it inert would turn
   * a state you can exit into a dead end.
   */
  control: DesktopControl;
  /** The shared open-path policy row, verbatim. Never restated locally. */
  policy: OpenPathPolicyViewRow | null;
  refuseOnly: boolean;
  refusal: DesktopVisualRefusal | null;
  /**
   * What the assistant becomes on this profile, decided here rather than by the
   * renderer, so a browser-side profile switch applies the model's own answer to
   * the column instead of only relabelling it.
   */
  assistant: DesktopAssistantProjection;
}>;

/** Everything about the assistant that a profile alone decides. */
export type DesktopAssistantProjection = Readonly<{
  state: DesktopAssistantState;
  /** Model label; `denied` on Kids, never a provider name. */
  modelLabel: string;
  toggle: DesktopControl;
  /** Closes the column from inside it; inert wherever the toggle is. */
  close: DesktopControl;
  prompt: DesktopControl;
  send: DesktopControl;
  retry: DesktopControl;
  routes: ReadonlyArray<
    Readonly<{
      id: DesktopAssistantRoute;
      label: string;
      control: DesktopControl;
    }>
  >;
  /** Ask / Build / Agent. Inert wherever the composer is denied. */
  modes: ReadonlyArray<
    Readonly<{ id: DesktopAssistantModeId; label: string; control: DesktopControl }>
  >;
  refusal: DesktopVisualRefusal | null;
  refusalMessage: string | null;
  /** The named code the archive prints on the Kids lock screen. */
  refusalCode: string | null;
}>;

export type DesktopAssistantView = Omit<DesktopAssistantProjection, "modes"> &
  Readonly<{
    mode: DesktopAssistantModeId;
    thinking: boolean;
    /**
     * What the toggle may claim. In a tier where the assistant is a drawer the
     * drawer starts closed, so an `open` state alone would have the toggle
     * announce itself pressed over a column the document does not show.
     */
    togglePressed: boolean;
    modes: ReadonlyArray<
      Readonly<{
        id: DesktopAssistantModeId;
        label: string;
        active: boolean;
        control: DesktopControl;
      }>
    >;
  }>;

/**
 * The assistant a profile gets. One function, so the column the renderer shows
 * for the active profile and the column a profile switch moves to are the same
 * decision — `send` refuses for the profile's own reason rather than keeping the
 * one the document happened to be rendered with.
 *
 * `refuseOnly` is the profile being projected, not the active one, so this
 * branch is not the per-call-site "is it Kids" the projection below removed: it
 * is what every profile chip carries for the browser-side switch. The active
 * column passes the projection's own mint, which is what puts its controls in
 * `view.controls`; a chip's column is data, not markup, and keeps the default.
 */
function assistantProjection(
  refuseOnly: boolean,
  mint: DesktopControlMint = liveControl,
  runtime: DesktopAssistantRuntime = "none",
): DesktopAssistantProjection {
  const denial = kidsAssistantDenial();
  const runtimeAvailable = runtime === "local";
  const runtimeControl = (id: string, label: string): DesktopControl =>
    refuseOnly
      ? mint(id, label, "inert", denial.code)
      : runtimeAvailable
        ? mint(id, label, "live")
        : mint(id, label, "inert", DESKTOP_VISUAL_REFUSALS.noPresentationRuntime);
  return Object.freeze({
    state: refuseOnly ? "denied" : "open",
    modelLabel: refuseOnly
      ? ASSISTANT_MODEL_LABELS.denied
      : runtimeAvailable
        ? "local · free / BYOK"
        : ASSISTANT_MODEL_LABELS.noProvider,
    toggle: refuseOnly
      ? mint("assistant-toggle", "Assistant", "inert", denial.code)
      : mint("assistant-toggle", "Assistant", "view"),
    close: refuseOnly
      ? mint("assistant-close", "Close assistant", "inert", denial.code)
      : mint("assistant-close", "Close assistant", "view"),
    prompt: runtimeControl("assistant-prompt", "Assistant prompt"),
    send: runtimeControl("assistant-send", "Send"),
    retry: runtimeControl("assistant-retry", "Retry"),
    routes: Object.freeze(
      ([
        ["local", "Local · free"],
        ["byo", "BYOK · free"],
        ["hosted", "Hosted · metered"],
      ] as const).map(([id, label]) =>
        Object.freeze({
          id,
          label,
          control: refuseOnly
            ? mint(`assistant-route-${id}`, label, "inert", denial.code)
            : mint(`assistant-route-${id}`, label, "view"),
        }),
      ),
    ),
    modes: Object.freeze(
      DESKTOP_ASSISTANT_MODE_IDS.map((id) => {
        const label = id.charAt(0).toUpperCase() + id.slice(1);
        return Object.freeze({
          id,
          label,
          control: refuseOnly
            ? mint(`assistant-mode-${id}`, label, "inert", denial.code)
            : mint(`assistant-mode-${id}`, label, "view"),
        });
      }),
    ),
    refusal: refuseOnly ? denial.code : null,
    refusalMessage: refuseOnly ? denial.message : null,
    refusalCode: refuseOnly ? denial.lockCode : null,
  });
}

export type DesktopChangeReviewRow = Readonly<{
  index: number;
  badge: string;
  kind: "modified" | "added";
  path: string;
  directory: string;
  leaf: string;
  before: string;
  after: string;
  /** False once the operator has decided this row. */
  pending: boolean;
  accept: DesktopControl;
  reject: DesktopControl;
}>;

export type DesktopChangeReviewView = Readonly<{
  /**
   * Every fixture row, decided or not, each carrying its own pair of controls.
   *
   * The renderer draws the whole queue and hides the decided rows, so a row that
   * exists in the document has to exist in the model too — otherwise its two
   * buttons would be markup no control kind accounts for.
   */
  rows: ReadonlyArray<DesktopChangeReviewRow>;
  /** The subset of `rows` still awaiting a decision, in queue order. */
  pending: ReadonlyArray<DesktopChangeReviewRow>;
  count: number;
  empty: boolean;
  acceptAll: DesktopControl;
  rejectAll: DesktopControl;
  /** Stated on the surface: deciding here writes no document. */
  writesDocuments: false;
}>;

export type DesktopSculptView = Readonly<{
  phase: DesktopSculptPhase;
  passIndex: number;
  passCount: number;
  /** 0..100, integer, so the rendered width is not a float in the DOM. */
  percent: number;
  label: string;
  start: DesktopControl;
  cancel: DesktopControl;
}>;

export type DesktopOverlayView = Readonly<{
  id: DesktopOverlayId | null;
  /** The title bar's palette opener. */
  search: DesktopControl;
  /** The status bar's three overlay shortcuts. */
  shortcuts: ReadonlyArray<
    Readonly<{ overlay: DesktopOverlayId; label: string; control: DesktopControl }>
  >;
  /**
   * One control per dismiss button, so the four buttons that close the two
   * dialogs each carry their own identity instead of sharing one that could
   * only ever be rendered once.
   */
  dismissals: ReadonlyArray<
    Readonly<{
      overlay: DesktopOverlayId;
      label: string;
      emphasis: "ghost" | "primary";
      control: DesktopControl;
    }>
  >;
  paletteGroups: ReadonlyArray<
    Readonly<{
      title: string;
      items: ReadonlyArray<
        Readonly<{
          name: string;
          cli: string;
          shortcut: string;
          control: DesktopControl;
        }>
      >;
    }>
  >;
}>;

export type DesktopVisualView = Readonly<{
  state: DesktopVisualState;
  source: typeof VISUAL_SOURCE_REF;
  tier: DesktopWindowTierId;
  /** Non-null exactly when the tier is `minimum`. */
  refusal: Readonly<{
    code: DesktopVisualRefusal;
    message: string;
    minimum: DesktopWindowSize;
  }> | null;
  /**
   * Non-null exactly on the refuse-only profile.
   *
   * The archive draws the Kids profile as a working editor with only the
   * assistant locked. The repository contract is stronger and wins: the Kids
   * product is an isolation boundary with **no** UI, so the editor body refuses
   * as a whole rather than authoring under a Kids badge. The profile switch
   * stays live so the refusal is a state you can leave, not a dead end.
   */
  profileRefusal: Readonly<{
    code: DesktopVisualRefusal;
    message: string;
    /** The shared policy's own sentence, printed verbatim. */
    summary: string;
    profile: typeof OPEN_PATH_REFUSE_ONLY_PROFILE;
  }> | null;
  dockedColumns: ReadonlyArray<string>;
  drawerColumns: ReadonlyArray<string>;
  /**
   * The title-bar openers for the two columns that undock into drawers. They
   * exist at every tier — hidden by the stylesheet while their column is still
   * docked — so the control accounting does not change with the window size.
   */
  drawers: ReadonlyArray<
    Readonly<{
      id: DesktopDrawerId;
      label: string;
      /** The id of the region this opener controls. */
      target: string;
      control: DesktopControl;
    }>
  >;
  dockHeight: number;
  /**
   * The application menu bar. Every entry is inert: this surface has no command
   * behind any of the archive's menus, and saying so with the menus' own reason
   * is what keeps eight controls from borrowing the viewport's.
   */
  menus: ReadonlyArray<Readonly<{ id: DesktopMenuId; label: string; control: DesktopControl }>>;
  modes: ReadonlyArray<Readonly<{ id: DesktopModeId; label: string; title: string; active: boolean; control: DesktopControl }>>;
  profiles: ReadonlyArray<DesktopProfileChip>;
  policy: OpenPathPolicyViewModel;
  dockTabs: ReadonlyArray<Readonly<{ id: DesktopDockTabId; label: string; active: boolean; badge: number; control: DesktopControl }>>;
  assistant: DesktopAssistantView;
  changeReview: DesktopChangeReviewView;
  sculpt: DesktopSculptView;
  overlay: DesktopOverlayView;
  viewport: Readonly<{
    inertNote: typeof VIEWPORT_INERT_NOTE;
    refusal: DesktopVisualRefusal;
    pixelsDrawn: false;
    sources: ReadonlyArray<
      Readonly<{
        id: DesktopViewportSourceId;
        label: string;
        active: boolean;
        control: DesktopControl;
      }>
    >;
    manipulators: ReadonlyArray<
      Readonly<{
        id: DesktopAssistantManipulatorId;
        label: string;
        control: DesktopControl;
      }>
    >;
  }>;
  statusText: string;
  profilePin: string;
  /**
   * Every control this projection contains, in mint order.
   *
   * Recorded by the mint itself rather than assembled by hand, so it cannot be
   * a subset of what the view holds. It is what lets the renderer apply a
   * profile's own answer to each rendered control by id instead of to a
   * selector list — the list that omitted the drawer toggles and left them live
   * over regions the Kids refusal had already removed.
   */
  controls: ReadonlyArray<DesktopControl>;
}>;

const VISUAL_SOURCE_REF = Object.freeze({
  member: "Engine Desktop.dc.html",
  supersedes: "Engine Desktop v1.dc.html",
});

const DOCK_TAB_LABELS: Readonly<Record<DesktopDockTabId, string>> = Object.freeze({
  changes: "Changes",
  assets: "Assets",
  console: "Console",
  evidence: "Evidence",
  timeline: "Timeline",
});

const PROFILE_LABELS: Readonly<Record<DesktopProfileId, string>> = Object.freeze({
  game: "Game",
  web: "Website",
  kids: "Kids",
});

/**
 * Project the whole chrome for one state. Deterministic and total: the same
 * state always yields the same view, which is what makes the golden evidence
 * reproducible without a browser.
 */
export function desktopVisualView(state: DesktopVisualState): DesktopVisualView {
  const tier = resolveWindowTier(state.window);
  const tierRow = WINDOW_TIERS.find((row) => row.id === tier) ?? WINDOW_TIERS[WINDOW_TIERS.length - 1];
  const policy = openPathPolicyView();
  const kids = state.profile === "kids";
  const minted: DesktopControl[] = [];

  /**
   * Every control below is minted here, and on the refuse-only profile this is
   * the single place the demotion happens. A control added anywhere in this
   * projection is therefore behind the refusal by default: forgetting fails
   * closed, which is the opposite of the per-call-site `kids ?` branch that let
   * the drawer toggles stay live over panels the refusal had removed.
   */
  function control(
    id: string,
    label: string,
    kind: Exclude<DesktopControlKind, "inert">,
  ): DesktopControl;
  function control(
    id: string,
    label: string,
    kind: "inert",
    refusal: DesktopVisualRefusal,
  ): DesktopControl;
  function control(
    id: string,
    label: string,
    kind: DesktopControlKind,
    refusal?: DesktopVisualRefusal,
  ): DesktopControl {
    const built = buildControl(id, label, kind, refusal ?? null);
    const final = kids ? refuseOnlyControl(built) : built;
    minted.push(final);
    return final;
  }

  /**
   * The controls that are *not* behind the refusal, so the demotion above must
   * not reach them: the profile switch is how an operator leaves the Kids
   * state, and the overlays this chrome opens and dismisses work on every
   * profile. Marking a control that works as refusing is the same dishonesty in
   * the other direction.
   */
  function outsideRefusal(id: string, label: string): DesktopControl {
    const built = liveControl(id, label, "view");
    minted.push(built);
    return built;
  }

  const refusal =
    tier === "minimum"
      ? Object.freeze({
          code: DESKTOP_VISUAL_REFUSALS.windowBelowMinimum,
          message: DESKTOP_REFUSAL_MESSAGES[DESKTOP_VISUAL_REFUSALS.windowBelowMinimum],
          minimum: DESKTOP_MINIMUM_WINDOW,
        })
      : null;

  const pendingIndexes = CHANGE_REVIEW_ROWS.map((_row, index) => index).filter(
    (index) => !state.decidedChanges.includes(index),
  );

  const changeRows: ReadonlyArray<DesktopChangeReviewRow> = Object.freeze(
    CHANGE_REVIEW_ROWS.map((row, index) =>
      Object.freeze({
        index,
        ...row,
        pending: pendingIndexes.includes(index),
        accept: control(`change-accept-${index}`, `Accept ${row.leaf}`, "review"),
        reject: control(`change-reject-${index}`, `Reject ${row.leaf}`, "review"),
      }),
    ),
  );

  const changeReview: DesktopChangeReviewView = Object.freeze({
    rows: changeRows,
    pending: Object.freeze(changeRows.filter((row) => row.pending)),
    count: pendingIndexes.length,
    empty: pendingIndexes.length === 0,
    acceptAll: control("change-accept-all", "Accept all", "review"),
    rejectAll: control("change-reject-all", "Reject all", "review"),
    writesDocuments: false as const,
  });

  const running = state.sculpt === "running";
  const passLabel =
    SCULPT_PASSES[state.sculptPass]?.runningLabel ?? "Finishing";

  const sculpt: DesktopSculptView = Object.freeze({
    phase: state.sculpt,
    passIndex: state.sculptPass,
    passCount: SCULPT_PASSES.length,
    percent: Math.round(state.sculptPassFraction * 100),
    label: passLabel,
    start: control(
      "sculpt-start",
      "Sculpt object",
      "inert",
      DESKTOP_VISUAL_REFUSALS.noDocumentBound,
    ),
    cancel: control("sculpt-cancel", "Cancel after this pass", "view"),
  });

  const projection = assistantProjection(kids, control, state.assistantRuntime);
  const assistantIsDrawer = (tierRow?.drawerColumns ?? []).includes("assistant");

  const assistant: DesktopAssistantView = Object.freeze({
    ...projection,
    state: state.assistant,
    mode: state.assistantMode,
    thinking: state.assistantThinking,
    togglePressed: state.assistant === "open" && !assistantIsDrawer,
    modes: Object.freeze(
      projection.modes.map((row) =>
        Object.freeze({ ...row, active: row.id === state.assistantMode }),
      ),
    ),
  });

  return Object.freeze({
    state,
    source: VISUAL_SOURCE_REF,
    tier,
    refusal,
    profileRefusal: kids ? kidsProfileRefusal() : null,
    dockedColumns: Object.freeze([...(tierRow?.dockedColumns ?? [])]),
    drawerColumns: Object.freeze([...(tierRow?.drawerColumns ?? [])]),
    drawers: Object.freeze(
      DESKTOP_DRAWER_IDS.map((id) =>
        Object.freeze({
          id,
          label: DRAWER_LABELS[id],
          target: DRAWER_TARGETS[id],
          control: control(`drawer-${id}`, DRAWER_LABELS[id], "view"),
        }),
      ),
    ),
    dockHeight:
      state.mode === "animate" ? METRICS.dockHeightAnimate : METRICS.dockHeight,

    menus: Object.freeze(
      DESKTOP_MENU_IDS.map((id) =>
        Object.freeze({
          id,
          label: MENU_LABELS[id],
          control: control(
            `menu-${id}`,
            MENU_LABELS[id],
            "inert",
            DESKTOP_VISUAL_REFUSALS.verbNotOnDesktop,
          ),
        }),
      ),
    ),

    modes: Object.freeze(
      DESKTOP_MODES.map((mode) =>
        Object.freeze({
          id: mode.id,
          label: mode.label,
          title: mode.title,
          active: mode.id === state.mode,
          control: control(`mode-${mode.id}`, mode.title, "view"),
        }),
      ),
    ),

    profiles: Object.freeze(
      DESKTOP_PROFILE_IDS.map((id) => {
        const packageName = DESKTOP_PROFILE_PACKAGES[id];
        const row = policy.rows.find((candidate) => candidate.profile === packageName) ?? null;
        const refuseOnly = packageName === OPEN_PATH_REFUSE_ONLY_PROFILE;
        return Object.freeze({
          id,
          label: PROFILE_LABELS[id],
          packageName,
          active: id === state.profile,
          control: outsideRefusal(`profile-${id}`, PROFILE_LABELS[id]),
          policy: row,
          refuseOnly,
          refusal: refuseOnly ? DESKTOP_VISUAL_REFUSALS.kidsRefuseOnly : null,
          assistant: assistantProjection(
            refuseOnly,
            liveControl,
            state.assistantRuntime,
          ),
        });
      }),
    ),
    policy,

    dockTabs: Object.freeze(
      dockTabsFor(state.mode).map((id) =>
        Object.freeze({
          id,
          label: DOCK_TAB_LABELS[id],
          active: id === state.dockTab,
          badge: id === "changes" ? changeReview.count : 0,
          control: control(`dock-${id}`, DOCK_TAB_LABELS[id], "view"),
        }),
      ),
    ),

    assistant,
    changeReview,
    sculpt,

    overlay: Object.freeze({
      id: state.overlay,
      search: outsideRefusal("overlay-open-palette", "Search"),
      shortcuts: Object.freeze(
        DESKTOP_OVERLAY_SHORTCUTS.map((shortcut) =>
          Object.freeze({
            ...shortcut,
            control: outsideRefusal(
              `status-overlay-${shortcut.overlay}`,
              shortcut.label,
            ),
          }),
        ),
      ),
      dismissals: Object.freeze(
        DESKTOP_OVERLAY_DISMISSALS.map((dismissal) =>
          Object.freeze({
            overlay: dismissal.overlay,
            label: dismissal.label,
            emphasis: dismissal.emphasis,
            control: outsideRefusal(
              `overlay-close-${dismissal.id}`,
              dismissal.label,
            ),
          }),
        ),
      ),
      paletteGroups: Object.freeze(
        PALETTE_GROUPS.map((group) =>
          Object.freeze({
            title: group.title,
            items: Object.freeze(
              group.items.map((item) =>
                Object.freeze({
                  name: item.name,
                  cli: item.cli,
                  shortcut: item.shortcut,
                  control:
                    item.desktopCommand !== null &&
                    Object.hasOwn(DESKTOP_COMMANDS, item.desktopCommand)
                      ? control(`palette-${item.id}`, item.name, "view")
                      : control(
                          `palette-${item.id}`,
                          item.name,
                          "inert",
                          DESKTOP_VISUAL_REFUSALS.verbNotOnDesktop,
                        ),
                }),
              ),
            ),
          }),
        ),
      ),
    }),

    viewport: Object.freeze({
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
    }),

    statusText: running
      ? `Sculpting — pass ${state.sculptPass + 1} of ${SCULPT_PASSES.length}`
      : state.mode === "run"
        ? DESKTOP_REFUSAL_MESSAGES[DESKTOP_VISUAL_REFUSALS.noKernelSession]
        : "Ready",

    profilePin: kids
      ? "kids profile · refuse-only · separate origin"
      : `${state.profile} profile · core 0.0.0`,

    controls: Object.freeze([...minted]),
  });
}
