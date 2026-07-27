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
 *    and write no document. `inert` controls render, take focus, and refuse by
 *    a name from `DESKTOP_VISUAL_REFUSALS` — because the archive draws controls
 *    for behaviour this shell has no contract for, and drawing them as if they
 *    worked would be the lie. There is no fourth kind: nothing here reaches
 *    `authoring-core`, so the chrome cannot write a document by accident.
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
  OPEN_PATH_REFUSE_CODES,
  OPEN_PATH_REFUSE_ONLY_PROFILE,
  openPathPolicyView,
  type OpenPathPolicyViewModel,
  type OpenPathPolicyViewRow,
} from "@sceneaxi/schemas";
import { DESKTOP_COMMANDS } from "./commands.js";
import { METRICS } from "./visual-tokens.js";

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                  */
/* -------------------------------------------------------------------------- */

export const DESKTOP_MODE_IDS = Object.freeze([
  "build",
  "sculpt",
  "compose",
  "animate",
  "run",
  "ship",
  "plugins",
] as const);

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
> = Object.freeze([
  Object.freeze({ id: "build", label: "BUILD", title: "Build", glyphRadius: "2px", glyphTransform: "none" }),
  Object.freeze({ id: "sculpt", label: "SCULPT", title: "Sculpt", glyphRadius: "50%", glyphTransform: "none" }),
  Object.freeze({ id: "compose", label: "SCENE", title: "Scene composition", glyphRadius: "2px", glyphTransform: "rotate(45deg)" }),
  Object.freeze({ id: "animate", label: "ANIM", title: "Animate", glyphRadius: "2px 9px 2px 9px", glyphTransform: "none" }),
  Object.freeze({ id: "run", label: "RUN", title: "Run", glyphRadius: "50% 2px 50% 2px", glyphTransform: "none" }),
  Object.freeze({ id: "ship", label: "SHIP", title: "Ship", glyphRadius: "2px", glyphTransform: "rotate(20deg)" }),
  Object.freeze({ id: "plugins", label: "PLUG", title: "Plugins", glyphRadius: "3px", glyphTransform: "none" }),
]);

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

export const DESKTOP_DOCK_TAB_IDS = Object.freeze([
  "changes",
  "assets",
  "console",
  "evidence",
  "timeline",
] as const);
export type DesktopDockTabId = (typeof DESKTOP_DOCK_TAB_IDS)[number];

export const DESKTOP_OVERLAY_IDS = Object.freeze([
  "palette",
  "refused",
  "conflict",
] as const);
export type DesktopOverlayId = (typeof DESKTOP_OVERLAY_IDS)[number];

export const DESKTOP_ASSISTANT_MODE_IDS = Object.freeze([
  "ask",
  "build",
  "agent",
] as const);
export type DesktopAssistantModeId = (typeof DESKTOP_ASSISTANT_MODE_IDS)[number];

export type DesktopSculptPhase = "idle" | "running";

/**
 * Assistant states, as one closed enumeration rather than a pair of booleans —
 * `denied` is not "closed", and a renderer must not be able to reach the
 * composer by flipping `open`.
 */
export type DesktopAssistantState = "open" | "closed" | "denied";

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
 * somebody liked.
 */
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
    minWidth: 1440,
    minHeight: 720,
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
    minWidth: 1180,
    minHeight: 660,
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
    minWidth: 900,
    minHeight: 600,
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
  width: 900,
  height: 600,
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
  if (mode === "animate") return Object.freeze(["timeline", "changes", "console"] as const);
  if (mode === "run") return Object.freeze(["console", "evidence"] as const);
  if (mode === "ship") return Object.freeze(["evidence", "console"] as const);
  return Object.freeze(["changes", "assets", "console", "evidence"] as const);
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
      Object.freeze({ name: "Sculpt an object from a reference", cli: "sceneaxi project propose", shortcut: "⇧S", mode: "sculpt" as const, desktopCommand: "propose" }),
      Object.freeze({ name: "Re-sculpt selection with changes", cli: "sceneaxi project propose", shortcut: "", mode: "sculpt" as const, desktopCommand: "propose" }),
    ]),
  }),
  Object.freeze({
    title: "SCENE",
    items: Object.freeze([
      Object.freeze({ name: "Compose instances into a scene", cli: "sceneaxi project apply", shortcut: "⇧C", mode: "compose" as const, desktopCommand: "apply" }),
      Object.freeze({ name: "Import an external document", cli: "sceneaxi asset list", shortcut: "", mode: "build" as const, desktopCommand: null }),
    ]),
  }),
  Object.freeze({
    title: "RUN & SHIP",
    items: Object.freeze([
      Object.freeze({ name: "Play the scene", cli: "sceneaxi project dev", shortcut: "⌘P", mode: "run" as const, desktopCommand: null }),
      Object.freeze({ name: "Replay the last run", cli: "sceneaxi evidence list", shortcut: "", mode: "run" as const, desktopCommand: null }),
      Object.freeze({ name: "Export a delivery handoff", cli: "sceneaxi project capture", shortcut: "", mode: "ship" as const, desktopCommand: null }),
    ]),
  }),
]);

/**
 * The archive's viewport status note, preserved verbatim.
 *
 * It is *not* the retired "Experimental Three preview / non-decision" framing
 * ADR 0017 removed from product presentation copy: this shell mounts no
 * presentation runtime at all — the dependency matrix denies every engine
 * package to this one, presentation included — so the sentence describes a
 * renderer adjudication that is still a captain-held decision rather than
 * labelling a shipped product renderer. `VIEWPORT_INERT_NOTE` sits beside
 * it and says what this surface actually draws, which is nothing.
 */
export const VIEWPORT_RENDERER_NOTE =
  "Preview renderer is experimental — not the final choice";

export const VIEWPORT_INERT_NOTE =
  "No renderer is mounted on this surface — the viewport is inert and draws no pixels.";

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

export type DesktopControlKind = "view" | "review" | "inert";

export type DesktopControl = Readonly<{
  id: string;
  label: string;
  kind: DesktopControlKind;
  /** Present exactly when `kind` is `inert`. */
  refusal: DesktopVisualRefusal | null;
  /** The refusal sentence, or null when the control works. */
  refusalMessage: string | null;
}>;

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
  return Object.freeze({
    id,
    label,
    kind,
    refusal: refusal ?? null,
    refusalMessage: refusal === undefined ? null : DESKTOP_REFUSAL_MESSAGES[refusal],
  });
}

export type DesktopProfileChip = Readonly<{
  id: DesktopProfileId;
  label: string;
  packageName: string;
  active: boolean;
  /** The shared open-path policy row, verbatim. Never restated locally. */
  policy: OpenPathPolicyViewRow | null;
  refuseOnly: boolean;
  refusal: DesktopVisualRefusal | null;
}>;

export type DesktopAssistantView = Readonly<{
  state: DesktopAssistantState;
  mode: DesktopAssistantModeId;
  thinking: boolean;
  /** Model label; `denied` on Kids, never a provider name. */
  modelLabel: string;
  toggle: DesktopControl;
  send: DesktopControl;
  refusal: DesktopVisualRefusal | null;
  refusalMessage: string | null;
  /** The named code the archive prints on the Kids lock screen. */
  refusalCode: string | null;
}>;

export type DesktopChangeReviewView = Readonly<{
  pending: ReadonlyArray<
    Readonly<{
      index: number;
      badge: string;
      kind: "modified" | "added";
      path: string;
      directory: string;
      leaf: string;
      before: string;
      after: string;
      accept: DesktopControl;
      reject: DesktopControl;
    }>
  >;
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
  close: DesktopControl;
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
  dockHeight: number;
  modes: ReadonlyArray<Readonly<{ id: DesktopModeId; label: string; title: string; active: boolean; control: DesktopControl }>>;
  profiles: ReadonlyArray<DesktopProfileChip>;
  policy: OpenPathPolicyViewModel;
  dockTabs: ReadonlyArray<Readonly<{ id: DesktopDockTabId; label: string; active: boolean; badge: number; control: DesktopControl }>>;
  assistant: DesktopAssistantView;
  changeReview: DesktopChangeReviewView;
  sculpt: DesktopSculptView;
  overlay: DesktopOverlayView;
  viewport: Readonly<{
    rendererNote: typeof VIEWPORT_RENDERER_NOTE;
    inertNote: typeof VIEWPORT_INERT_NOTE;
    refusal: DesktopVisualRefusal;
    pixelsDrawn: false;
  }>;
  statusText: string;
  profilePin: string;
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

  const changeReview: DesktopChangeReviewView = Object.freeze({
    pending: Object.freeze(
      pendingIndexes.map((index) => {
        const row = CHANGE_REVIEW_ROWS[index];
        // `pendingIndexes` is derived from the same array, so this cannot miss.
        if (row === undefined) throw new Error(`unreachable change row ${index}`);
        return Object.freeze({
          index,
          ...row,
          accept: control(`change-accept-${index}`, `Accept ${row.leaf}`, "review"),
          reject: control(`change-reject-${index}`, `Reject ${row.leaf}`, "review"),
        });
      }),
    ),
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

  const assistant: DesktopAssistantView = Object.freeze({
    state: state.assistant,
    mode: state.assistantMode,
    thinking: state.assistantThinking,
    modelLabel: kids ? "denied" : "no provider configured",
    toggle: kids
      ? control(
          "assistant-toggle",
          "Assistant",
          "inert",
          DESKTOP_VISUAL_REFUSALS.kidsAssistantDenied,
        )
      : control("assistant-toggle", "Assistant", "view"),
    send: kids
      ? control(
          "assistant-send",
          "Send",
          "inert",
          DESKTOP_VISUAL_REFUSALS.kidsAssistantDenied,
        )
      : control(
          "assistant-send",
          "Send",
          "inert",
          DESKTOP_VISUAL_REFUSALS.noDocumentBound,
        ),
    refusal: kids ? DESKTOP_VISUAL_REFUSALS.kidsAssistantDenied : null,
    refusalMessage: kids
      ? DESKTOP_REFUSAL_MESSAGES[DESKTOP_VISUAL_REFUSALS.kidsAssistantDenied]
      : null,
    refusalCode: kids ? "THIRD_PARTY_LLM_DENIED_BY_DEFAULT" : null,
  });

  return Object.freeze({
    state,
    source: VISUAL_SOURCE_REF,
    tier,
    refusal,
    profileRefusal: kids ? kidsProfileRefusal() : null,
    dockedColumns: Object.freeze([...(tierRow?.dockedColumns ?? [])]),
    drawerColumns: Object.freeze([...(tierRow?.drawerColumns ?? [])]),
    dockHeight:
      state.mode === "animate" ? METRICS.dockHeightAnimate : METRICS.dockHeight,

    modes: Object.freeze(
      DESKTOP_MODES.map((mode) =>
        Object.freeze({
          id: mode.id,
          label: mode.label,
          title: mode.title,
          active: mode.id === state.mode,
          control: kids
            ? control(
                `mode-${mode.id}`,
                mode.title,
                "inert",
                DESKTOP_VISUAL_REFUSALS.kidsRefuseOnly,
              )
            : control(`mode-${mode.id}`, mode.title, "view"),
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
          policy: row,
          refuseOnly,
          refusal: refuseOnly ? DESKTOP_VISUAL_REFUSALS.kidsRefuseOnly : null,
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
      close: control("overlay-close", "Close", "view"),
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
                      ? control(`palette-${item.mode}-${item.cli}`, item.name, "view")
                      : control(
                          `palette-${item.mode}-${item.cli}`,
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
      rendererNote: VIEWPORT_RENDERER_NOTE,
      inertNote: VIEWPORT_INERT_NOTE,
      refusal: DESKTOP_VISUAL_REFUSALS.noPresentationRuntime,
      pixelsDrawn: false as const,
    }),

    statusText: running
      ? `Sculpting — pass ${state.sculptPass + 1} of ${SCULPT_PASSES.length}`
      : state.mode === "run"
        ? DESKTOP_REFUSAL_MESSAGES[DESKTOP_VISUAL_REFUSALS.noKernelSession]
        : "Ready",

    profilePin: kids
      ? "kids profile · refuse-only · separate origin"
      : `${state.profile} profile · core 0.0.0`,
  });
}
