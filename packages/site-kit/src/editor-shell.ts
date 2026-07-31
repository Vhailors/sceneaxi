/**
 * The entitled web editor's Engine Desktop shell view (sceneaxi#184).
 *
 * `buildEditorShellView()` projects one render of the real bounded Minimum E2
 * session — the same `EditorRender` the page's panels already show — onto the
 * shared editor-shell vocabulary in `@sceneaxi/schemas` (`EDITOR_SHELL_MODES`,
 * dock tabs, viewport sources, assistant states, window tiers). The umbrella's
 * `/editor` route renders this view as the design-faithful Engine Desktop
 * chrome; the desktop shell projects the same vocabulary in
 * `apps/desktop-shell/src/visual-model.ts`. One product model, two surfaces —
 * parity is asserted as a data identity in
 * `tests/parity/editor-shell-parity.test.ts`.
 *
 * Honesty contract, the same one `docs/engine-desktop-surface.md` records for
 * the desktop chrome:
 *
 * - **Every number is a real engine fact.** Scene tree, transforms, kernel
 *   ticks, socket values, digests, the Changes queue, and the console log all
 *   come from the supplied render of a real session. Nothing here invents a
 *   triangle count, a frame rate, a byte size, or a memory figure — the archive
 *   draws those as fixtures, and `EDITOR_SHELL_FABRICATED_FIGURES` pins the
 *   ones that must never ship.
 * - **Every control declares its kind.** `live` controls carry the Minimum E2
 *   operation they drive (a member of `WEB_EDITOR_SESSION_OPERATIONS`) and the
 *   href or form the server round-trip uses; `view` controls change client
 *   visual state only; `inert` controls keep their focus stop and refuse with a
 *   name from `EDITOR_SHELL_WEB_REFUSALS`. The frozen operation set is not
 *   widened here: a control whose behaviour would need general E2 renders inert
 *   and says so (ADR 0003, ADR 0020).
 * - **Kids refuses in the model.** The profile chips project the shared
 *   open-path policy; on the refuse-only profile every control not in the
 *   exempt set is demoted to inert with the policy's own code, decided in the
 *   one mint function rather than per call site.
 *
 * Pure TypeScript: no React, no Next, no DOM. The umbrella's client component
 * renders this data and decides nothing.
 */
import {
  EDITOR_SHELL_ASSISTANT_MODE_IDS,
  EDITOR_SHELL_MINIMUM_WINDOW,
  EDITOR_SHELL_MODES,
  EDITOR_SHELL_SOURCE,
  EDITOR_SHELL_VIEWPORT_SOURCES,
  OPEN_PATH_REFUSE_CODES,
  OPEN_PATH_REFUSE_ONLY_PROFILE,
  REQUIRED_SCULPT_PASSES,
  digestSceneArtifact,
  openPathPolicyView,
  pluginCapabilityRegistrySeed,
  type EditorShellAssistantModeId,
  type EditorShellControlKind,
  type EditorShellDockTabId,
  type EditorShellModeId,
  type OpenPathPolicyViewRow,
  type SculptArtifact,
} from "@sceneaxi/schemas";
import type { SceneDocument } from "@sceneaxi/authoring-core";
import { reviewProposal, type ChangeReview } from "./change-review.js";
import {
  EDITOR_MAX_OBJECTS,
  EDITOR_MIN_OBJECTS,
  editorHref,
  type EditorState,
} from "./editor-state.js";
import type { EditorRender } from "./editor-session.js";
import { WEB_EDITOR_STARTER_SEED } from "./starter-artifact.js";
import {
  WEB_EDITOR_SESSION_OPERATIONS,
  type WebEditorViewportFrame,
} from "./web-editor.js";

export type WebEditorOperation = (typeof WEB_EDITOR_SESSION_OPERATIONS)[number];

/**
 * Every reason a control on this surface declines, as a closed registry. The
 * Kids code comes from the shared open-path policy — the same code the CLI and
 * the desktop shell refuse with — and the local codes name what is true of this
 * surface specifically. `test/editor-shell.test.ts` asserts every code is
 * reachable from some control and that no control refuses with an unlisted one.
 */
export const EDITOR_SHELL_WEB_REFUSALS = Object.freeze({
  kidsRefuseOnly: OPEN_PATH_REFUSE_CODES.kidsRefused,
  /** No model-provider adapter is wired on this surface (no live adapter in core). */
  assistantNoProvider: "EDITOR_ASSISTANT_NO_PROVIDER",
  /** The bounded Minimum E2 operation set does not include this behaviour. */
  operationNotOnSurface: "EDITOR_OPERATION_NOT_ON_THIS_SURFACE",
  /** The control names a CLI verb with no operation on this web surface. */
  verbCliOnly: "EDITOR_VERB_CLI_ONLY",
  /** The viewport draws the session's own composed scene; no other source exists here. */
  viewportSourceFixed: "EDITOR_VIEWPORT_SOURCE_FIXED",
  /** The window is smaller than the shared editor-shell minimum (900×600). */
  windowBelowMinimum: "EDITOR_WINDOW_BELOW_MINIMUM",
} as const);

export type EditorShellWebRefusal =
  (typeof EDITOR_SHELL_WEB_REFUSALS)[keyof typeof EDITOR_SHELL_WEB_REFUSALS];

/** One sentence per refusal, printed verbatim by the renderer's legend. */
export const EDITOR_SHELL_WEB_REFUSAL_MESSAGES: Readonly<
  Record<EditorShellWebRefusal, string>
> = Object.freeze({
  [EDITOR_SHELL_WEB_REFUSALS.kidsRefuseOnly]:
    `${OPEN_PATH_REFUSE_ONLY_PROFILE} is refuse-only: no open path, no UI, no commerce.`,
  [EDITOR_SHELL_WEB_REFUSALS.assistantNoProvider]:
    "No model provider adapter is configured on this surface, so the assistant composes nothing and sends nothing.",
  [EDITOR_SHELL_WEB_REFUSALS.operationNotOnSurface]:
    "The bounded Minimum E2 session does not include this operation; general E2 stays specified-not-built (ADR 0003).",
  [EDITOR_SHELL_WEB_REFUSALS.verbCliOnly]:
    "That verb exists on the CLI and has no operation on this web surface; run it with `sceneaxi`.",
  [EDITOR_SHELL_WEB_REFUSALS.viewportSourceFixed]:
    "This viewport draws the editor session's own composed scene; the other sources have no session on this surface.",
  [EDITOR_SHELL_WEB_REFUSALS.windowBelowMinimum]:
    "The editor chrome refuses below its minimum window size rather than rendering an unusable layout.",
});

/**
 * The one place an assistant mode's control id is spelled, so the composer's
 * default and the minted controls cannot drift apart.
 */
const assistantModeControlId = (mode: EditorShellAssistantModeId): string =>
  `assistant-mode-${mode}`;

/** The mode the composer starts on, named from the shared vocabulary. */
const EDITOR_SHELL_ASSISTANT_DEFAULT_MODE: EditorShellAssistantModeId = "build";

/**
 * Archive fixture figures that must never ship from this model. The design
 * comp prints them as set dressing; a real surface either measures a value or
 * does not show one. Asserted absent from every serialized view in
 * `test/editor-shell.test.ts` and from the shipped page source in
 * `tests/sites/umbrella-visual.test.ts`.
 */
export const EDITOR_SHELL_FABRICATED_FIGURES = Object.freeze([
  "18 412",
  "412 MB",
  "20 fps",
  "saved 10:26",
  "qwen3-30b",
  "Harbour Depot",
  "depot_scene",
] as const);

/** A control's binding to the real world, when it has one. */
export type EditorShellControlBinding =
  | Readonly<{
      /** A server round-trip that drives the named session operations. */
      kind: "href";
      href: string;
      operations: ReadonlyArray<WebEditorOperation>;
    }>
  | Readonly<{
      /** A form field whose submit drives the named session operations. */
      kind: "form-field";
      field: string;
      operations: ReadonlyArray<WebEditorOperation>;
    }>
  | Readonly<{ kind: "client-view" }>;

export type EditorShellControl = Readonly<{
  id: string;
  label: string;
  kind: EditorShellControlKind;
  refusal: EditorShellWebRefusal | null;
  refusalMessage: string | null;
  binding: EditorShellControlBinding | null;
}>;

export type EditorShellTreeRow = Readonly<{
  id: string;
  depth: number;
  label: string;
  kindLabel: string;
  instanceId: string | null;
  selected: boolean;
  /** Href that selects this instance, for rows that are instances. */
  selectHref: string | null;
}>;

export type EditorShellInspectorField = Readonly<{
  id: string;
  label: string;
  value: string;
  mono: boolean;
}>;

export type EditorShellInspectorSection = Readonly<{
  id: string;
  title: string;
  hint: string | null;
  fields: ReadonlyArray<EditorShellInspectorField>;
}>;

export type EditorShellConsoleRow = Readonly<{
  level: "ok" | "info" | "refuse";
  text: string;
}>;

export type EditorShellEvidenceRow = Readonly<{
  id: string;
  label: string;
  digest: string;
  boundTo: string;
}>;

export type EditorShellSocketRow = Readonly<{
  id: string;
  value: string;
  kindLabel: string;
}>;

export type EditorShellRegistryRow = Readonly<{
  id: string;
  version: string;
  summary: string;
}>;

export type EditorShellPaletteRow = Readonly<{
  control: EditorShellControl;
  /** The CLI verb the archive prints beside the row, when one exists. */
  cliVerb: string | null;
  group: string;
}>;

export type EditorShellProfileChip = Readonly<{
  id: "game" | "web" | "kids";
  label: string;
  control: EditorShellControl;
  policy: OpenPathPolicyViewRow;
  /** What the status bar pins while this profile is projected. */
  statusPin: string;
}>;

export type EditorShellModeView = Readonly<{
  id: EditorShellModeId;
  railLabel: string;
  title: string;
  dockTabs: ReadonlyArray<EditorShellDockTabId>;
  control: EditorShellControl;
}>;

export type EditorShellView = Readonly<{
  schemaSource: typeof EDITOR_SHELL_SOURCE;
  /** Entitlement facts the page resolved before this session existed. */
  entitlement: Readonly<{ mode: "entitled" | "preview"; basis: string }>;
  menus: ReadonlyArray<EditorShellControl>;
  modes: ReadonlyArray<EditorShellModeView>;
  profiles: ReadonlyArray<EditorShellProfileChip>;
  /** The shared policy payload, verbatim, for the Kids lock and the legend. */
  policyNote: string;
  /** The refuse-only projection, from the shared policy — never restated. */
  kidsLock: Readonly<{ code: string; summary: string }>;
  project: Readonly<{
    name: string;
    documentPath: string;
    /** Short form of the composed scene digest, or null when not composable. */
    sceneDigestShort: string | null;
  }>;
  tree: ReadonlyArray<EditorShellTreeRow>;
  layers: ReadonlyArray<Readonly<{ id: string; label: string; detail: string }>>;
  inspector: ReadonlyArray<EditorShellInspectorSection>;
  sculpt: Readonly<{
    seed: number;
    passes: ReadonlyArray<Readonly<{ id: string; position: number }>>;
    evidence: ReadonlyArray<EditorShellInspectorField>;
    library: ReadonlyArray<Readonly<{ artifactId: string; digestShort: string; mountCount: number }>>;
    runOutcome: string;
    sculptObject: EditorShellControl;
  }>;
  compose: Readonly<{
    ok: boolean;
    refusalCode: string | null;
    refusalMessage: string | null;
    instances: ReadonlyArray<
      Readonly<{
        instanceId: string;
        parentInstanceId: string | null;
        depth: number;
        worldTranslation: string;
      }>
    >;
  }>;
  animate: Readonly<{
    sockets: ReadonlyArray<EditorShellSocketRow>;
    authoring: EditorShellControl;
  }>;
  run: Readonly<{
    playState: string;
    tick: number;
    objectCount: number;
    collisionCount: number | null;
    frameDigestShort: string | null;
    playPause: EditorShellControl;
    reset: EditorShellControl;
    bodies: ReadonlyArray<
      Readonly<{ instanceId: string; translation: string; state: string }>
    >;
  }>;
  ship: Readonly<{
    targets: ReadonlyArray<Readonly<{ id: string; state: string }>>;
    exportHandoff: EditorShellControl;
  }>;
  plugins: Readonly<{
    registry: ReadonlyArray<EditorShellRegistryRow>;
    loaded: ReadonlyArray<never>;
    loadPlugin: EditorShellControl;
  }>;
  viewport: Readonly<{
    frame: WebEditorViewportFrame;
    sources: ReadonlyArray<EditorShellControl>;
  }>;
  changes: Readonly<{
    review: ChangeReview | null;
    reviewRefusal: string | null;
    /** Apply on this surface is E1 all-or-nothing and already happened. */
    appliedPaths: ReadonlyArray<string>;
    acceptAll: EditorShellControl;
    rejectAll: EditorShellControl;
  }>;
  console: ReadonlyArray<EditorShellConsoleRow>;
  evidence: ReadonlyArray<EditorShellEvidenceRow>;
  assistant: Readonly<{
    state: "open" | "closed" | "denied";
    modelLabel: string;
    toggle: EditorShellControl;
    modes: ReadonlyArray<EditorShellControl>;
    /**
     * The mode control the composer starts on, as a control id rather than a
     * label, so a renderer keys its pressed state on identity the view owns.
     */
    defaultModeId: string;
    send: EditorShellControl;
    sees: ReadonlyArray<string>;
  }>;
  palette: ReadonlyArray<EditorShellPaletteRow>;
  /** The control that opens the palette; it lives in the chrome, not in a row. */
  paletteOpener: EditorShellControl;
  statusBar: Readonly<{
    readiness: string;
    profilePin: string;
    docLabel: string;
  }>;
  /**
   * The refusal the chrome prints instead of rendering below the shared minimum
   * window. It is carried by a block rather than a control, so the view owns its
   * code and its wording — the numbers come from `EDITOR_SHELL_MINIMUM_WINDOW`.
   */
  windowMinimum: Readonly<{ code: EditorShellWebRefusal; message: string }>;
  edit: Readonly<{
    selection: EditorShellControl;
    translation: EditorShellControl;
    objects: EditorShellControl;
    apply: EditorShellControl;
    /** The same bounds `readEditorState` clamps `objects` to, so the input agrees. */
    objectBounds: Readonly<{ min: number; max: number }>;
  }>;
  /** Every minted control, in mint order — the control-accounting index. */
  controls: ReadonlyArray<EditorShellControl>;
  refusalLegend: ReadonlyArray<Readonly<{ code: string; message: string }>>;
}>;

export type EditorShellInput = Readonly<{
  state: EditorState;
  render: EditorRender;
  /** The pre-save document, so the Changes tab reviews the real proposal. */
  baseDocument: SceneDocument | null;
  entitlement: Readonly<{ mode: "entitled" | "preview"; basis: string }>;
  /** The mounted starter artifact, for real sculpt evidence. */
  starterArtifact: SculptArtifact;
}>;

const shortDigestValue = (digest: string): string => {
  const hex = digest.startsWith("sha256:") ? digest.slice("sha256:".length) : digest;
  return hex.length <= 12 ? hex : `${hex.slice(0, 4)}…${hex.slice(-4)}`;
};

const vec = (translation: readonly number[]): string =>
  translation.map((component) => String(component)).join(", ");

/**
 * Build the shell view for one rendered editor state.
 *
 * Deterministic: same state and render, same view. The mint function records
 * every control into the accounting index, and the Kids demotion — applied by
 * the client-side profile switch — is projected per profile here rather than
 * decided in the browser.
 */
export function buildEditorShellView(input: EditorShellInput): EditorShellView {
  const { state, render, entitlement } = input;
  const controls: EditorShellControl[] = [];

  const mint = (control: {
    id: string;
    label: string;
    kind: EditorShellControlKind;
    refusal?: EditorShellWebRefusal;
    binding?: EditorShellControlBinding;
  }): EditorShellControl => {
    const refusal = control.kind === "inert" ? (control.refusal ?? null) : null;
    if (control.kind === "inert" && refusal === null) {
      throw new Error(`inert control ${control.id} must carry a refusal`);
    }
    if (control.kind !== "inert" && control.refusal !== undefined) {
      throw new Error(`non-inert control ${control.id} must not carry a refusal`);
    }
    const minted: EditorShellControl = Object.freeze({
      id: control.id,
      label: control.label,
      kind: control.kind,
      refusal,
      refusalMessage: refusal === null ? null : EDITOR_SHELL_WEB_REFUSAL_MESSAGES[refusal],
      binding: control.binding ?? (control.kind === "view" ? Object.freeze({ kind: "client-view" as const }) : null),
    });
    controls.push(minted);
    return minted;
  };

  // --- menu bar: the archive's eight menus; no command exists behind any ---
  const menus = Object.freeze(
    (["File", "Edit", "Scene", "Object", "Sculpt", "Run", "Window", "Help"] as const).map(
      (label) =>
        mint({
          id: `menu-${label.toLowerCase()}`,
          label,
          kind: "inert",
          refusal: EDITOR_SHELL_WEB_REFUSALS.operationNotOnSurface,
        }),
    ),
  );

  // --- modes: client-side view switches over one server-rendered state ---
  const modes = EDITOR_SHELL_MODES.map((mode) =>
    Object.freeze({
      id: mode.id,
      railLabel: mode.railLabel,
      title: mode.title,
      dockTabs: mode.dockTabs,
      control: mint({ id: `mode-${mode.id}`, label: mode.railLabel, kind: "view" }),
    }),
  );

  // --- profiles: the shared policy, projected — never restated ---
  const policy = openPathPolicyView();
  const statusPinFor = (profile: "game" | "web" | "kids"): string =>
    profile === "kids"
      ? `${profile} profile · refuse-only · separate origin`
      : `${profile} profile · core 0.0.0`;
  const chipFor = (profile: "game" | "web" | "kids", label: string): EditorShellProfileChip => {
    const row = policy.rows.find((candidate) => candidate.profile.includes(profile));
    if (row === undefined) {
      throw new Error(`open-path policy names no ${profile} profile row`);
    }
    return Object.freeze({
      id: profile,
      label,
      control: mint({ id: `profile-${profile}`, label, kind: "view" }),
      policy: row,
      statusPin: statusPinFor(profile),
    });
  };
  const profiles = Object.freeze([
    chipFor("game", "Game"),
    chipFor("web", "Website"),
    chipFor("kids", "Kids"),
  ]);

  // --- project pill: real document identity, no invented save time ---
  const sceneDigest = render.composition.ok ? render.composition.sceneDigest : null;

  // --- scene tree: the session's own snapshot rows ---
  const tree = render.snapshot.sceneTree.map((node, index) => {
    const isInstance = node.kind === "sculpt-instance";
    const selected = isInstance && node.instanceId === render.snapshot.selectedInstanceId;
    const selectable = isInstance && !selected;
    return Object.freeze({
      id: `tree-${index}-${node.id}`,
      depth: node.parentId === null ? 0 : 1,
      label: node.label,
      kindLabel: isInstance ? "sculpt" : "node",
      instanceId: isInstance ? node.instanceId : null,
      selected,
      selectHref: selectable
        ? editorHref({ ...state, selectedInstanceId: node.instanceId }, {})
        : null,
    });
  });

  // --- layers: real aggregates of the mounted scene, no fixture counts ---
  const socketRows: EditorShellSocketRow[] =
    render.snapshot.inspector === null
      ? []
      : render.snapshot.inspector.kernel.sockets.map((socket) =>
          Object.freeze({
            id: socket.id,
            value: socket.value.toFixed(1),
            kindLabel: socket.nodeId,
          }),
        );
  const layers = Object.freeze([
    Object.freeze({
      id: "geometry",
      label: "Geometry",
      detail: `${state.instances.length} objects`,
    }),
    Object.freeze({
      id: "sockets",
      label: "Sockets",
      detail:
        render.snapshot.inspector === null
          ? "none selected"
          : `${render.snapshot.inspector.socketCount} on selection`,
    }),
  ]);

  // --- inspector: transform + kernel facts of the selected instance ---
  const inspector: EditorShellInspectorSection[] = [];
  if (render.snapshot.inspector !== null) {
    const selected = render.snapshot.inspector;
    inspector.push(
      Object.freeze({
        id: "instance",
        title: "INSTANCE",
        hint: null,
        fields: Object.freeze([
          Object.freeze({ id: "instance-id", label: "Instance", value: selected.instanceId, mono: true }),
          Object.freeze({ id: "artifact-id", label: "Artifact", value: selected.artifactId, mono: true }),
          Object.freeze({
            id: "components",
            label: "Components",
            value: String(selected.componentCount),
            mono: false,
          }),
          Object.freeze({
            id: "sockets",
            label: "Sockets",
            value: String(selected.socketCount),
            mono: false,
          }),
        ]),
      }),
      Object.freeze({
        id: "transform",
        title: "TRANSFORM",
        hint: "local",
        fields: Object.freeze([
          Object.freeze({
            id: "position",
            label: "Position",
            value: vec(selected.transform.translation),
            mono: true,
          }),
          Object.freeze({
            id: "rotation",
            label: "Rotation",
            value: vec(selected.transform.rotationEulerDegrees),
            mono: true,
          }),
          Object.freeze({
            id: "scale",
            label: "Scale",
            value: vec(selected.transform.scale),
            mono: true,
          }),
        ]),
      }),
      Object.freeze({
        id: "kernel",
        title: "SESSION",
        hint: "kernel",
        fields: Object.freeze([
          Object.freeze({
            id: "kernel-tick",
            label: "Tick",
            value: String(selected.kernel.tick),
            mono: true,
          }),
          Object.freeze({
            id: "kernel-collisions",
            label: "Collisions",
            value: String(selected.kernel.collisionCount),
            mono: true,
          }),
          Object.freeze({
            id: "kernel-digest",
            label: "Digest",
            value: shortDigestValue(selected.kernel.digest),
            mono: true,
          }),
        ]),
      }),
    );
  }

  // --- sculpt: the starter reconstruction's real facts ---
  const starter = input.starterArtifact;
  const starterDigest = digestSceneArtifact(starter);
  const sculpt = Object.freeze({
    seed: WEB_EDITOR_STARTER_SEED,
    passes: Object.freeze(
      REQUIRED_SCULPT_PASSES.map((pass, index) =>
        Object.freeze({ id: pass, position: index + 1 }),
      ),
    ),
    evidence: Object.freeze([
      Object.freeze({
        id: "sculpt-method",
        label: "Method",
        value: starter.evidence.method,
        mono: true,
      }),
      Object.freeze({
        id: "sculpt-intake-digest",
        label: "Intake digest",
        value: shortDigestValue(starter.evidence.intakeDigest),
        mono: true,
      }),
      Object.freeze({
        id: "sculpt-spec-digest",
        label: "Spec digest",
        value: shortDigestValue(starter.evidence.specDigest),
        mono: true,
      }),
    ]),
    library: Object.freeze([
      Object.freeze({
        artifactId: starter.artifactId,
        digestShort: shortDigestValue(starterDigest),
        mountCount: state.instances.length,
      }),
    ]),
    runOutcome: `${REQUIRED_SCULPT_PASSES.length} passes · deterministic · seed ${WEB_EDITOR_STARTER_SEED}`,
    sculptObject: mint({
      id: "sculpt-object",
      label: "Sculpt object",
      kind: "inert",
      refusal: EDITOR_SHELL_WEB_REFUSALS.operationNotOnSurface,
    }),
  });

  // --- compose: the real composition projection, refusal and all ---
  const compose = render.composition.ok
    ? Object.freeze({
        ok: true,
        refusalCode: null,
        refusalMessage: null,
        instances: Object.freeze(
          render.composition.scene.instances.map((instance) =>
            Object.freeze({
              instanceId: instance.instanceId,
              parentInstanceId: instance.parentInstanceId,
              depth: instance.depth,
              worldTranslation: vec(instance.worldTransform.translation),
            }),
          ),
        ),
      })
    : Object.freeze({
        ok: false,
        refusalCode: render.composition.code,
        refusalMessage: render.composition.message,
        instances: Object.freeze([]),
      });

  // --- animate: kernel-driven sockets are real; authoring is not on this surface ---
  const animate = Object.freeze({
    sockets: Object.freeze(socketRows),
    authoring: mint({
      id: "timeline-authoring",
      label: "Add key",
      kind: "inert",
      refusal: EDITOR_SHELL_WEB_REFUSALS.operationNotOnSurface,
    }),
  });

  // --- run: the session's own play state and kernel facts ---
  const playPause = mint({
    id: "run-play-pause",
    label: state.playing ? "Pause" : "Play one step",
    kind: "live",
    binding: Object.freeze({
      kind: "href" as const,
      href: editorHref(state, { play: !state.playing }),
      operations: Object.freeze(
        state.playing ? (["pause"] as const) : (["play", "step"] as const),
      ),
    }),
  });
  const reset = mint({
    id: "run-reset",
    label: "Reset",
    kind: "live",
    binding: Object.freeze({
      kind: "href" as const,
      href: "/editor",
      operations: Object.freeze(["dispose"] as const),
    }),
  });
  const run = Object.freeze({
    playState: render.snapshot.playState,
    tick: render.snapshot.tick,
    objectCount: state.instances.length,
    collisionCount: render.snapshot.inspector?.kernel.collisionCount ?? null,
    frameDigestShort:
      render.snapshot.inspector === null
        ? null
        : shortDigestValue(render.snapshot.inspector.kernel.digest),
    playPause,
    reset,
    bodies: Object.freeze(
      state.instances.map((instance) =>
        Object.freeze({
          instanceId: instance.instanceId,
          translation: vec(instance.transform.translation),
          state:
            instance.instanceId === render.snapshot.selectedInstanceId
              ? "selected"
              : "rest",
        }),
      ),
    ),
  });

  // --- ship: the delivery-handoff boundary is data, not authority — and not here ---
  const ship = Object.freeze({
    targets: Object.freeze([
      Object.freeze({ id: "web", state: "contract only" }),
      Object.freeze({ id: "desktop", state: "contract only" }),
    ]),
    exportHandoff: mint({
      id: "ship-export-handoff",
      label: "Export handoff",
      kind: "inert",
      refusal: EDITOR_SHELL_WEB_REFUSALS.operationNotOnSurface,
    }),
  });

  // --- plugins: the seeded capability registry is real; loading is not here ---
  const plugins = Object.freeze({
    registry: Object.freeze(
      pluginCapabilityRegistrySeed().entries.map((entry) =>
        Object.freeze({
          id: entry.capabilityId,
          version: entry.contractVersion,
          summary: entry.contractRef,
        }),
      ),
    ),
    loaded: Object.freeze([] as never[]),
    loadPlugin: mint({
      id: "plugins-load",
      label: "Load plugin",
      kind: "inert",
      refusal: EDITOR_SHELL_WEB_REFUSALS.operationNotOnSurface,
    }),
  });

  // --- viewport: one real source; the other tabs refuse by name ---
  const viewportSources = EDITOR_SHELL_VIEWPORT_SOURCES.map((source, index) =>
    index === 0
      ? mint({ id: `viewport-source-${source.id}`, label: source.label, kind: "view" })
      : mint({
          id: `viewport-source-${source.id}`,
          label: source.label,
          kind: "inert",
          refusal: EDITOR_SHELL_WEB_REFUSALS.viewportSourceFixed,
        }),
  );

  // --- changes: the real proposal this render saved through propose/apply ---
  let review: ChangeReview | null = null;
  let reviewRefusal: string | null = null;
  if (render.save.ok && input.baseDocument !== null) {
    const built = reviewProposal({
      proposal: render.save.proposal,
      documents: new Map([["scene.sceneaxi.json", input.baseDocument]]),
      origin: "Minimum E2 session · propose/apply",
    });
    if (built.ok) review = built.value;
    else reviewRefusal = built.reason;
  } else if (!render.save.ok) {
    reviewRefusal = render.save.diagnostics
      .map((diagnostic) => diagnostic.code)
      .join(" · ");
  }
  const changes = Object.freeze({
    review,
    reviewRefusal,
    appliedPaths: render.save.ok ? render.save.appliedPaths : Object.freeze([]),
    acceptAll: mint({
      id: "changes-accept-all",
      label: "Accept all",
      kind: "inert",
      refusal: EDITOR_SHELL_WEB_REFUSALS.operationNotOnSurface,
    }),
    rejectAll: mint({
      id: "changes-reject-all",
      label: "Reject all",
      kind: "inert",
      refusal: EDITOR_SHELL_WEB_REFUSALS.operationNotOnSurface,
    }),
  });

  // --- console: what this render actually did, in order ---
  const consoleRows: EditorShellConsoleRow[] = [];
  for (const instance of state.instances) {
    consoleRows.push(
      Object.freeze({
        level: "ok" as const,
        text: `addSculpt ${instance.instanceId} · ${starter.artifactId}`,
      }),
    );
  }
  consoleRows.push(
    Object.freeze({
      level: "ok" as const,
      text: `select ${render.snapshot.selectedInstanceId ?? "none"}`,
    }),
  );
  if (state.playing) {
    consoleRows.push(
      Object.freeze({
        level: "ok" as const,
        text: `play · step 16ms · tick ${render.snapshot.tick}`,
      }),
    );
  }
  consoleRows.push(
    render.save.ok
      ? Object.freeze({
          level: "ok" as const,
          text: `save applied · ${render.save.appliedPaths.join(", ")}`,
        })
      : Object.freeze({
          level: "refuse" as const,
          text: `save refused · ${render.save.diagnostics.map((diagnostic) => diagnostic.code).join(", ")}`,
        }),
  );
  consoleRows.push(
    render.composition.ok
      ? Object.freeze({
          level: "ok" as const,
          text: `scene composed · ${render.composition.scene.instances.length} instances · digest ${shortDigestValue(render.composition.sceneDigest)}`,
        })
      : Object.freeze({
          level: "refuse" as const,
          text: `compose refused · ${render.composition.code}`,
        }),
  );

  // --- evidence: every digest this render produced ---
  const evidence: EditorShellEvidenceRow[] = [
    Object.freeze({
      id: "evidence-starter",
      label: "starter artifact",
      digest: shortDigestValue(starterDigest),
      boundTo: starter.artifactId,
    }),
    Object.freeze({
      id: "evidence-spec",
      label: "sculpt spec",
      digest: shortDigestValue(starter.evidence.specDigest),
      boundTo: `seed ${WEB_EDITOR_STARTER_SEED}`,
    }),
  ];
  if (render.composition.ok) {
    evidence.push(
      Object.freeze({
        id: "evidence-scene",
        label: "scene composition",
        digest: shortDigestValue(render.composition.sceneDigest),
        boundTo: render.composition.scene.sceneId,
      }),
    );
  }
  if (render.snapshot.inspector !== null) {
    evidence.push(
      Object.freeze({
        id: "evidence-kernel",
        label: "kernel session",
        digest: shortDigestValue(render.snapshot.inspector.kernel.digest),
        boundTo: `tick ${render.snapshot.inspector.kernel.tick}`,
      }),
    );
  }

  // --- assistant: honest seat — no provider is wired on this surface ---
  const assistant = Object.freeze({
    state: "open" as const,
    modelLabel: "no provider configured",
    toggle: mint({ id: "assistant-toggle", label: "Assistant", kind: "view" }),
    modes: Object.freeze(
      EDITOR_SHELL_ASSISTANT_MODE_IDS.map((mode) =>
        mint({
          id: assistantModeControlId(mode),
          label: mode.charAt(0).toUpperCase() + mode.slice(1),
          kind: "view",
        }),
      ),
    ),
    defaultModeId: assistantModeControlId(EDITOR_SHELL_ASSISTANT_DEFAULT_MODE),
    send: mint({
      id: "assistant-send",
      label: "Send",
      kind: "inert",
      refusal: EDITOR_SHELL_WEB_REFUSALS.assistantNoProvider,
    }),
    sees: Object.freeze([
      "umbrella-web-editor",
      `${state.instances.length} objects`,
      render.snapshot.selectedInstanceId === null
        ? "no selection"
        : "1 selection",
    ]),
  });

  // --- edit form controls: the live Minimum E2 transport ---
  const edit = Object.freeze({
    selection: mint({
      id: "edit-selection",
      label: "Selection",
      kind: "live",
      binding: Object.freeze({
        kind: "form-field" as const,
        field: "sel",
        operations: Object.freeze(["select"] as const),
      }),
    }),
    translation: mint({
      id: "edit-translation",
      label: "Translation",
      kind: "live",
      binding: Object.freeze({
        kind: "form-field" as const,
        field: `tx-${state.selectedInstanceId}`,
        operations: Object.freeze(["setSelectedTransform"] as const),
      }),
    }),
    objects: mint({
      id: "edit-objects",
      label: "Objects",
      kind: "live",
      binding: Object.freeze({
        kind: "form-field" as const,
        field: "objects",
        operations: Object.freeze(["addSculpt", "removeSculpt"] as const),
      }),
    }),
    apply: mint({
      id: "edit-apply",
      label: "Apply",
      kind: "live",
      binding: Object.freeze({
        kind: "form-field" as const,
        field: "submit",
        operations: Object.freeze(["setSelectedTransform", "select"] as const),
      }),
    }),
    objectBounds: Object.freeze({ min: EDITOR_MIN_OBJECTS, max: EDITOR_MAX_OBJECTS }),
  });

  // --- palette: rows bind to this surface's real controls or refuse by name ---
  const paletteRows: EditorShellPaletteRow[] = [
    Object.freeze({
      control: mint({
        id: "palette-play-scene",
        label: state.playing ? "Pause the scene" : "Play the scene",
        kind: "live",
        binding: Object.freeze({
          kind: "href" as const,
          href: editorHref(state, { play: !state.playing }),
          operations: Object.freeze(
            state.playing ? (["pause"] as const) : (["play", "step"] as const),
          ),
        }),
      }),
      cliVerb: null,
      group: "RUN",
    }),
    Object.freeze({
      control: mint({
        id: "palette-open-compose",
        label: "Show the composed scene",
        kind: "view",
      }),
      cliVerb: null,
      group: "SCENE",
    }),
    Object.freeze({
      control: mint({
        id: "palette-sculpt-from-reference",
        label: "Sculpt an object from a reference",
        kind: "inert",
        refusal: EDITOR_SHELL_WEB_REFUSALS.operationNotOnSurface,
      }),
      cliVerb: "sceneaxi project propose",
      group: "SCULPT",
    }),
    Object.freeze({
      control: mint({
        id: "palette-project-dev",
        label: "Run the authoring loop",
        kind: "inert",
        refusal: EDITOR_SHELL_WEB_REFUSALS.verbCliOnly,
      }),
      cliVerb: "sceneaxi project dev",
      group: "RUN",
    }),
    Object.freeze({
      control: mint({
        id: "palette-export-handoff",
        label: "Export a delivery handoff",
        kind: "inert",
        refusal: EDITOR_SHELL_WEB_REFUSALS.operationNotOnSurface,
      }),
      cliVerb: "sceneaxi project capture",
      group: "RUN & SHIP",
    }),
  ];

  /**
   * The opener is chrome, not a command: it lives in the title bar and opens the
   * overlay the rows live in. Minting it outside `paletteRows` is what keeps it
   * from being drawn inside the surface it opens.
   */
  const paletteOpener = mint({
    id: "overlay-open-palette",
    label: "Search",
    kind: "view",
  });

  const statusBar = Object.freeze({
    readiness: state.playing ? "Running — deterministic" : "Ready",
    profilePin: statusPinFor("game"),
    docLabel: `doc ${sceneDigest === null ? "—" : shortDigestValue(sceneDigest)}`,
  });

  const windowMinimum = Object.freeze({
    code: EDITOR_SHELL_WEB_REFUSALS.windowBelowMinimum,
    message: `The editor chrome refuses below ${EDITOR_SHELL_MINIMUM_WINDOW.width}×${EDITOR_SHELL_MINIMUM_WINDOW.height} rather than rendering an unusable layout. Enlarge the window to continue.`,
  });

  const refusalLegend = Object.freeze(
    (Object.values(EDITOR_SHELL_WEB_REFUSALS) as EditorShellWebRefusal[]).map((code) =>
      Object.freeze({ code, message: EDITOR_SHELL_WEB_REFUSAL_MESSAGES[code] }),
    ),
  );

  return Object.freeze({
    schemaSource: EDITOR_SHELL_SOURCE,
    entitlement,
    menus,
    modes: Object.freeze(modes),
    profiles,
    policyNote: policy.notes.join(" "),
    kidsLock: Object.freeze({
      code: EDITOR_SHELL_WEB_REFUSALS.kidsRefuseOnly,
      summary:
        profiles.find((chip) => chip.id === "kids")?.policy.summary ??
        EDITOR_SHELL_WEB_REFUSAL_MESSAGES[EDITOR_SHELL_WEB_REFUSALS.kidsRefuseOnly],
    }),
    project: Object.freeze({
      name: "umbrella-web-editor",
      documentPath: "scene.sceneaxi.json",
      sceneDigestShort: sceneDigest === null ? null : shortDigestValue(sceneDigest),
    }),
    tree: Object.freeze(tree),
    layers,
    inspector: Object.freeze(inspector),
    sculpt,
    compose,
    animate,
    run,
    ship,
    plugins,
    viewport: Object.freeze({
      frame: render.viewport,
      sources: Object.freeze(viewportSources),
    }),
    changes,
    console: Object.freeze(consoleRows),
    evidence: Object.freeze(evidence),
    assistant,
    palette: Object.freeze([...paletteRows]),
    paletteOpener,
    statusBar,
    windowMinimum,
    edit,
    controls: Object.freeze([...controls]),
    refusalLegend,
  });
}
