/**
 * The desktop bridge: the real engine stack behind one synchronous `handle()`.
 *
 * Mirrors web-shell's inspector app deliberately — a transport-free request handler
 * the Electron main process adapts onto `ipcMain.handle` in a few lines — so every
 * decision here is provable in `pnpm gate` with no Electron install and no window.
 *
 * What each action reaches, and reaches only through the public seams:
 *
 * - `scene`        → the active Scene Document composition reproduced through
 *                    `composeScene()` and projected to the renderer payload.
 * - `open-path`    → `bootstrapOpenPath()` from `@sceneaxi/engine-orchestrator`
 *                    over the same composition: a real kernel scene session is
 *                    opened, advanced, observed, and closed, and the deterministic
 *                    bootstrap record plus observed digests are what come back.
 * - `authoring`    → `createDesktopSession()` from `@sceneaxi/desktop-shell` — the
 *                    same propose/accept protocol layer as the CLI and web-shell,
 *                    never a second editor state machine.
 * - `ship`         → deterministic local static Web files plus a validated
 *                    Delivery Handoff; no adapter, credential, or deploy path.
 * - `assistant`    → the deterministic local compiler by default, or one
 *                    explicitly injected BYOK runner. Hosted refuses here
 *                    because this tier has no identity or credit authority.
 * - `frame-report` → accepts the renderer's real presentation frame report so the
 *                    main process (and the packaged-app smoke test) can see what the
 *                    viewport actually claimed. The bridge never invents one.
 *
 * The bridge holds no kernel session across calls: `open-path` closes what it
 * opens. The authoring session and most recent assistant job are the only
 * long-lived state. Assistant profile is carried across the seam solely so the
 * authoring core can enforce its own compiled Kids denial before work starts.
 */
import { realpathSync } from "node:fs";
import { types } from "node:util";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import {
  ASSISTANT_SCULPT_REFUSALS,
  commitProjectMigration,
  inspectProjectGit,
  inspectProjectModel,
  proposeProjectMigration,
  recoverProjectMigration,
  runAssistantSculptAction,
  safeRarityEvidenceFromNamespace,
  stageRarityProviderProposal,
  type AssistantSculptProgress,
  type AssistantSculptResult,
  type RarityKernelResolutionInput,
  type RarityProviderContributionResult,
} from "@sceneaxi/authoring-core";
import {
  createDesktopSession,
  type DesktopDocumentStatus,
  type DesktopSession,
  type DesktopSnapshot,
} from "@sceneaxi/desktop-shell";
import {
  DesktopProjectMutationOwnerError,
  bindDesktopSessionProjectGitAuthority,
  prepareDesktopSessionProjectGitCommit,
  releaseDesktopSessionProjectGitAuthority,
  stageDesktopSessionProjectGitPaths,
} from "@sceneaxi-internal/desktop-session-project-git";
import {
  ASSET_PREPARATION_REFUSALS,
  PROJECT_ASSET_MANIFEST_KEY,
  startProjectAssetPreparation,
  type ProjectAssetPreparationInput,
  materializeProjectAssetCopies,
  projectAssetManifestFromDocumentData,
  proposeProjectAssetImport,
  type ProjectAssetManifestEntry,
} from "@sceneaxi/importers";
import { bootstrapOpenPath, resumeOpenPath } from "@sceneaxi/engine-orchestrator";
import {
  DESKTOP_SCENE_HIERARCHY_REFUSALS,
  EDITOR_COMMAND_REFUSALS,
  EDITOR_COMMAND_REGISTRY,
  EDITOR_COMMAND_SCHEMA_VERSION,
  PROJECT_GIT_DIAGNOSTICS,
  RARITY_PROVIDER_REQUEST_MAX_CHARS,
  RARITY_REFUSE_CODES,
  digestRarityNamespace,
  editorCommand,
  editorCommandTerminalResult,
  editorCommandTransactionResult,
  isDesktopSceneEditOperation,
  isDesktopSceneEditProfile,
  isDesktopSceneReparentPolicy,
  resolveDesktopSceneTransform,
  resetPlaySession,
  setPlayViewportSource,
  startPlaySession,
  stopPlaySession,
  validateEditorCommandInvocation,
  type PlaySession,
  type PhysicsWorldHost,
  validateRarityNamespace,
  type EditorCommandId,
  ASSISTANT_ASK_REFUSALS,
  captureProfileEvidence,
  detectProjectBuildHost,
  evaluateProjectBuild,
  inspectExtensionSeams,
  isFixtureProviderDescriptor,
  startExtensionSeam,
  isJsonObject,
  type SceneAssistantBuildEntry,
  type SculptArtifact,
  type ModelProviderCallEvidence,
  type JsonObject,
} from "@sceneaxi/schemas";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_BRIDGE_ACTIONS,
  DESKTOP_BRIDGE_ASSISTANT_OPS,
  DESKTOP_BRIDGE_AUTHORING_OPS,
  DESKTOP_BRIDGE_REFUSALS,
  DESKTOP_ASSISTANT_START_MODE_REFUSAL_MESSAGE,
  DESKTOP_RARITY_EVENT_ID,
  bridgeOk,
  bridgeRefuse,
  desktopAssistantStartMode,
  type DesktopBridgeAction,
  type DesktopBridgeAssistantOp,
  type DesktopAssistantJobSnapshot,
  type DesktopBridgeAuthoringOp,
  type DesktopBridgeHandshake,
  type DesktopBridgeResponse,
  type DesktopFrameReport,
  type DesktopRarityEvidence,
  type DesktopRarityRetirementReason,
} from "./bridge-contract.js";
import {
  DESKTOP_SCENE_NOT_COMPOSABLE,
  desktopAssistantScene,
  desktopSceneFromDocumentData,
  evaluateDesktopSceneAnimation,
  evaluateDesktopScenePhysics,
  inspectDesktopSceneAnimation,
  inspectDesktopSceneEffects,
  inspectDesktopSceneEnvironment,
  inspectDesktopSceneMaterials,
  inspectDesktopScenePhysics,
  inspectDesktopScenePrefabs,
  inspectDesktopSceneProperties,
  stageDesktopSceneAnimation,
  stageDesktopSceneEffects,
  stageDesktopSceneEnvironment,
  stageDesktopSceneMaterials,
  stageDesktopScenePhysics,
  answerDesktopAssistantAsk,
  stageDesktopAssistantBuild,
  discoverDesktopScenePackage,
  inspectDesktopScenePackages,
  stageDesktopScenePackage,
  stageDesktopSceneEdit,
  stageDesktopScenePrefab,
  stageDesktopScenePropertyEdit,
  type DesktopSceneResult,
} from "./desktop-scene.js";
import { DesktopByoRunnerRefusal } from "./byo-configuration.js";
import {
  applyDesktopWorkspaceLayout,
  inspectDesktopWorkspaceLayout,
  resetDesktopWorkspaceLayout,
} from "./workspace-layout-host.js";
import {
  DESKTOP_WEB_EXPORT_REFUSALS,
  exportDesktopWebProject,
} from "./web-export.js";
import {
  DESKTOP_PROJECT_BROWSER_REFUSALS,
  type DesktopProjectBrowserResponse,
} from "./project-browser-contract.js";
import type { DesktopInputActionHost } from "./input-action-host.js";

/** Mutable, presence-sensitive fields retain their owner types without present undefined values. */
type DesktopOptionalFields<Value> = { -readonly [Key in keyof Value]?: Exclude<Value[Key], undefined> };

/** Values crossing desktop IPC, event, and exception boundaries before field validation. */
type DesktopDocumentData = Extract<DesktopDocumentStatus, { ok: true }>["data"];

type DesktopBoundaryValue = string | number | boolean | null | undefined | bigint | symbol
  | DesktopBoundaryObject | readonly DesktopBoundaryValue[] | Error | DesktopBoundaryMethod;

interface DesktopBoundaryObject { readonly [key: string]: DesktopBoundaryValue }

type DesktopBoundaryMethod = (...args: never[]) => DesktopBoundaryValue;

function isDesktopText<Value>(value: Value): value is Value & string {
  return typeof value === "string";
}

function isDesktopObject<Value>(value: Value): value is Value & (object | null) {
  return typeof value === "object";
}

function isDesktopSafeInteger<Value>(value: Value): value is Value & number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isDesktopNumber<Value>(value: Value): value is Value & number {
  return typeof value === "number";
}

function isDesktopBoolean<Value>(value: Value): value is Value & boolean {
  return typeof value === "boolean";
}

export type DesktopBridgeOptions = {
  /** Working directory the authoring session binds to. */
  readonly cwd: string;
  /** Already-authorized context, checked before project or journal I/O. */
  readonly commandProfile?: "game" | "web" | "kids";
  readonly commandCapabilities?: readonly string[];
  /** Integer-millisecond clock for the orchestrator host. Injectable for goldens. */
  readonly nowMs?: () => number;
  /** Initialized at the tier boundary; an absent Rapier host refuses rather than using toy. */
  readonly physicsWorldHost?: PhysicsWorldHost;
  /** Observer for renderer frame reports (the smoke path listens here). */
  readonly onFrameReport?: (report: DesktopFrameReport) => void;
  /** Optional privileged BYOK runner. Credentials never enter this bridge. */
  readonly runByoAssistant?: (request: DesktopAssistantRunRequest) => Promise<AssistantSculptResult>;
  /** Host-injected offline local executor for controlled fault/lifecycle acceptance. */
  readonly runLocalAssistant?: (request: DesktopAssistantRunRequest) => Promise<AssistantSculptResult>;
  /** Privileged fixture provider. It returns validated input/evidence, never raw output. */
  readonly runRarityProvider?: (
    request: DesktopRarityProviderRunRequest,
  ) => Promise<RarityProviderContributionResult>;
  readonly createAuthoringSession?: () => DesktopSession;
  /** The already-built sole renderer owner copied into static Web exports. */
  readonly webExportRuntime?: Uint8Array;
  readonly webExportPublisherExecutable?: string;
  readonly webExportPlatform?: NodeJS.Platform;
  readonly projectBrowser?: Readonly<{
    handle<DesktopRequest>(request: DesktopRequest): DesktopProjectBrowserResponse;
  }>;
  /** Separate settings transaction authority; never part of document history. */
  readonly inputActions?: DesktopInputActionHost;
};

export type DesktopAssistantProfile =
  | "@sceneaxi/profile-game"
  | "@sceneaxi/profile-web"
  | "@sceneaxi/profile-kids";

export type DesktopAssistantRunRequest = Readonly<{
  prompt: string;
  profile: DesktopAssistantProfile;
  onProgress: (snapshot: AssistantSculptProgress) => void;
}>;

export type DesktopRarityProviderRunRequest = Readonly<{
  profile: DesktopAssistantProfile;
  /**
   * The operator's own request text, carried to the Model Provider Port beside
   * the bounded rarity instruction rather than dropped at this boundary. It
   * reaches the provider only: nothing on this path lets prompt text choose a
   * tier, a candidate, a weight, or an outcome, and the checked-in fixture
   * answers the same bytes whatever it says.
   */
  prompt: string;
}>;

export type DesktopPreparedAssetJob = Readonly<{
  generation: number;
  result: Promise<DesktopBridgeResponse>;
  cancel(): Promise<DesktopBridgeResponse>;
}>;

export type DesktopBridge = {
  /** Host-only factory: raw worker responses never cross renderer IPC. */
  prepareAssetImport(input: Omit<ProjectAssetPreparationInput, "projectRoot">): DesktopPreparedAssetJob;
  handle<DesktopRequest>(request: DesktopRequest): DesktopBridgeResponse;
  activeProfile(): "game" | "web" | "kids";
  /** The most recent renderer frame report, or null before the first one. */
  lastFrameReport(): DesktopFrameReport | null;
  close(): boolean;
};

/** Ticks the open-path exercise advances: enough to prove digests move. */
export const OPEN_PATH_EXERCISE_TICKS = 4;

/**
 * The accepted rarity namespace's own kernel evidence.
 *
 * It is reported beside the composed scene's, never in place of it: the product
 * session that verifies a rarity event carries the manifest's rarity namespace
 * and no entities, so its digests describe a different session from the one the
 * viewport draws. Folding them into the scene fields would make the Run report
 * claim the drawn scene advanced through digests it never produced.
 */
export type OpenPathRaritySession = {
  readonly bootstrap: unknown;
  readonly initialDigest: string;
  readonly tickDigests: readonly string[];
  readonly replayDigest: string;
};

export type OpenPathExercise = {
  readonly bootstrap: unknown;
  readonly initialDigest: string;
  readonly tickDigests: readonly string[];
  readonly instanceCount: number;
  readonly mountable: Extract<DesktopSceneResult, { readonly ok: true }>["mountable"];
  readonly closed: true;
  readonly rarity?: DesktopRarityEvidence;
  readonly raritySession?: OpenPathRaritySession;
};

/**
 * The canonical form of `target`: every symlink on the part of the path that exists
 * is resolved, and a not-yet-created tail is re-appended to that real ancestry. A
 * lexical comparison alone answers the wrong question — the authoring core follows
 * links when it reads and writes, so containment has to be judged where the bytes
 * actually land. Returns null when nothing about the path can be resolved.
 */
function canonicalPath(target: string): string | null {
  const missing: string[] = [];
  let current = target;

  for (;;) {
    try {
      const real = realpathSync(current);

      return missing.length === 0 ? real : join(real, ...missing);
    } catch {
      const parent = dirname(current);

      if (parent === current) return null;
      missing.unshift(basename(current));
      current = parent;
    }
  }
}

function isAction(value: DesktopBoundaryValue): value is DesktopBridgeAction {
  return (
    isDesktopText(value) &&
    new Set<string>(DESKTOP_BRIDGE_ACTIONS).has(value)
  );
}

function isAuthoringOp<Value>(value: Value): value is Value & DesktopBridgeAuthoringOp {
  return (
    isDesktopText(value) &&
    new Set<string>(DESKTOP_BRIDGE_AUTHORING_OPS).has(value)
  );
}

function isAssistantOp<Value>(value: Value): value is Value & DesktopBridgeAssistantOp {
  return (
    isDesktopText(value) &&
    new Set<string>(DESKTOP_BRIDGE_ASSISTANT_OPS).has(value)
  );
}

function isAssistantProfile<Value>(value: Value): value is Value & (DesktopAssistantProfile ) {
  return (
    value === "@sceneaxi/profile-game" ||
    value === "@sceneaxi/profile-web" ||
    value === "@sceneaxi/profile-kids"
  );
}

function field<Value>(value: Value, name: string): DesktopBoundaryValue {
  if (!isDesktopObject(value) || value === null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, name);

  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

function hasExactFields<Value>(value: Value, fields: readonly string[]): boolean {
  if (!isDesktopObject(value) || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);

  return keys.length === fields.length && fields.every((name) => Object.hasOwn(value, name));
}

const SCENE_HIERARCHY_POINTER = "/data/composedScene";

function touchesSceneHierarchy<Value>(pointer: Value): pointer is Value & string {
  return isDesktopText(pointer) && (
    pointer === "" ||
    pointer === SCENE_HIERARCHY_POINTER ||
    pointer.startsWith(`${SCENE_HIERARCHY_POINTER}/`) ||
    SCENE_HIERARCHY_POINTER.startsWith(`${pointer}/`)
  );
}

function frameReportOf<Input>(payload: Input): DesktopFrameReport | null {
  const backend = field(payload, "backend");
  const label = field(payload, "label");
  const frame = field(payload, "frame");
  const instanceIds = field(payload, "instanceIds");
  const drawCalls = field(payload, "drawCalls");

  if (
    !isDesktopText(backend) ||
    !isDesktopText(label) ||
    !isDesktopNumber(frame) ||
    !isDesktopNumber(drawCalls) ||
    !Array.isArray(instanceIds) ||
    !instanceIds.every((id) => isDesktopText(id))
  ) {
    return null;
  }

  const surface = field(payload, "surface");
  const pixelsDrawn = field(payload, "pixelsDrawn");

  return Object.freeze({
    backend,
    label,
    frame,
    instanceIds: Object.freeze([...instanceIds]),
    drawCalls,
    surface: isDesktopText(surface) ? surface : null,
    pixelsDrawn: isDesktopBoolean(pixelsDrawn) ? pixelsDrawn : null,
  });
}

export function createDesktopBridge(options: DesktopBridgeOptions): DesktopBridge {
  const nowMs = options.nowMs ?? ((): number => Date.now());
  let activeCommandProfile: "game" | "web" | "kids" = options.commandProfile ?? "game";

  const rarityRefusalReason = <Input>(detail: Input): string | null => {
    if (!isDesktopText(detail)) return null;

    return Object.values(RARITY_REFUSE_CODES).find(
      (code) => detail === code || detail.startsWith(`${code} `),
    ) ?? null;
  };

  let session: DesktopSession | null = null;
  let rarityProposalEvidence: DesktopRarityEvidence | null = null;
  let lastReport: DesktopFrameReport | null = null;
  let assistantSequence = 0;

  let assistantJob: {
    jobId: string;
    commandId: Extract<EditorCommandId,
      | "assistant-ask"
      | "assistant-local-build"
      | "assistant-byo-build"
      | "assistant-local-agent">;
    route: "local" | "byo";
    status: "running" | "ready" | "refused";
    latestProgress: AssistantSculptProgress | null;
    progressCount: number;
    result?: NonNullable<DesktopAssistantJobSnapshot["result"]>;
    refusal?: NonNullable<DesktopAssistantJobSnapshot["refusal"]>;
  } | null = null;

  let lastReadyBuild: SceneAssistantBuildEntry | null = null;
  let lastReadyArtifact: SculptArtifact | null = null;

  let preparationGeneration = 0;
  let preparationClosed = false;
  let currentPreparation: Readonly<{ retire(): void }> | null = null;
  let preparedAssetReview: Readonly<{
    proposal: NonNullable<DesktopSnapshot["proposal"]>;
    entry: ProjectAssetManifestEntry;
    summary: string;
  }> | null = null;
  const retirePreparation = () => {
    preparationGeneration += 1;
    currentPreparation?.retire();
    currentPreparation = null;
  };
  const compactEntry = (entry: ProjectAssetManifestEntry) => {
    const { canonicalBytesBase64, ...evidence } = entry;
    return Object.freeze({ ...evidence, canonicalBase64ByteLength: canonicalBytesBase64.length });
  };
  const compactAssetSnapshot = (snapshot: DesktopSnapshot) => {
    if (preparedAssetReview === null || snapshot.proposal !== preparedAssetReview.proposal) return snapshot;
    return Object.freeze({ ...snapshot, proposal: null, unifiedDiff: null,
      renderedDiff: preparedAssetReview.summary, preparedAsset: compactEntry(preparedAssetReview.entry),
      preparedReview: Object.freeze({ documentPath: preparedAssetReview.proposal.edits[0]?.documentPath,
        baseContentHash: preparedAssetReview.proposal.edits[0]?.baseContentHash }),
      ...(field(snapshot, "assetImport") === preparedAssetReview.entry
        ? { assetImport: compactEntry(preparedAssetReview.entry) } : {}) });
  };

  let pendingAssetImport: Readonly<{
    documentPath: string;
    entry: ProjectAssetManifestEntry;
    proposal: NonNullable<DesktopSnapshot["proposal"]>;
  }> | null = null;

  let documentStatusIdentity: Readonly<{
    documentPath: string;
    contentHash: string;
    contentByteLength: number;
  }> | null = null;

  let selectedSceneInstanceIds: readonly string[] = Object.freeze([]);
  let playSession: PlaySession | null = null;
  let sceneSelectionStale = false;

  let pendingSceneSelection: Readonly<{
    documentPath: string;
    baseContentHash: string;
    instanceIds: readonly string[];
    proposal: NonNullable<DesktopSnapshot["proposal"]>;
    transactionId: string | null;
  }> | null = null;

  const createBoundAuthoringSession = (): DesktopSession => {
    const created = options.createAuthoringSession?.() ?? createDesktopSession({ cwd: options.cwd });

    try {
      bindDesktopSessionProjectGitAuthority(created, options.cwd, () => activeCommandProfile);
    } catch (cause) {
      if (
        cause instanceof DesktopProjectMutationOwnerError &&
        cause.diagnostic.code === PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable
      ) {
        return created;
      }

      throw cause;
    }

    return created;
  };

  const authoringSession = (): DesktopSession => {
    session ??= createBoundAuthoringSession();

    return session;
  };

  const currentSceneSelection = (
    documentData: DesktopDocumentData,
    contentHash: string,
    documentPath: string,
  ) => {
    if (selectedSceneInstanceIds.length === 0) return null;

    const inspected = inspectDesktopSceneProperties({
      documentData,
      contentHash,
      documentPath,
      selection: selectedSceneInstanceIds,
    });

    if (
      !inspected.ok &&
      inspected.reason === DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale
    ) {
      sceneSelectionStale = true;
    }

    if (!sceneSelectionStale) return inspected;

    const recovery = inspectDesktopSceneProperties({
      documentData,
      contentHash,
      documentPath,
    });

    if (!recovery.ok) return recovery;

    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
      diagnostics: Object.freeze([
        Object.freeze({
          code: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
          message: "The retained scene selection is stale and requires an explicit replacement.",
          documentPath,
        }),
      ]),
      contentHash: recovery.contentHash,
      entities: recovery.entities,
      hierarchy: recovery.hierarchy,
    });
  };

  const latchInvalidSceneSelection = (
    documentPath: string,
    status: DesktopDocumentStatus,
  ) => {
    if (sceneSelectionStale || selectedSceneInstanceIds.length === 0 || !status.ok) return;

    const inspected = inspectDesktopSceneProperties({
      documentData: status.data,
      contentHash: status.contentHash,
      documentPath,
      selection: selectedSceneInstanceIds,
    });

    if (
      !inspected.ok &&
      inspected.reason === DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale
    ) {
      sceneSelectionStale = true;
    }
  };

  const settlePendingSceneSelection = (
    snapshot: DesktopSnapshot,
    completedTransactionId: string | null = snapshot.transactionId,
  ) => {
    const pending = pendingSceneSelection;

    if (pending === null) return snapshot;

    const proposalMatches = snapshot.proposal === pending.proposal &&
      pending.proposal.edits.some((edit) =>
        edit.documentPath === pending.documentPath &&
        edit.baseContentHash === pending.baseContentHash
      );

    if (
      snapshot.phase === "pending" &&
      proposalMatches &&
      isDesktopText(snapshot.transactionId)
    ) {
      pendingSceneSelection = Object.freeze({
        ...pending,
        transactionId: snapshot.transactionId,
      });

      return snapshot;
    }

    const transactionMatches = pending.transactionId === null ||
      completedTransactionId === pending.transactionId;

    if (
      snapshot.phase === "applied" &&
      proposalMatches &&
      transactionMatches &&
      snapshot.appliedPaths?.includes(pending.documentPath) === true &&
      !snapshot.journalRecoveryPending &&
      (snapshot.diagnostics?.length ?? 0) === 0
    ) {
      selectedSceneInstanceIds = pending.instanceIds;
    }

    if (
      snapshot.phase !== "reviewing" ||
      !proposalMatches ||
      (snapshot.diagnostics?.length ?? 0) > 0
    ) {
      pendingSceneSelection = null;
    }

    return snapshot;
  };

  const withRarityProposalEvidence = (snapshot: DesktopSnapshot) =>
    rarityProposalEvidence === null
      ? snapshot
      : Object.freeze({ ...snapshot, rarityEvidence: rarityProposalEvidence });

  const withoutSceneHierarchy = <Value>(pointer: string, value: Value) => {
    if (!isDesktopObject(value) || value === null || Array.isArray(value)) return value;

    if (pointer === "/data") {
      return Object.freeze(Object.fromEntries(
        Object.entries(value).filter(([key]) => key !== "composedScene"),
      ));
    }

    if (pointer === "") {
      const data = field(value, "data");

      if (!isDesktopObject(data) || data === null || Array.isArray(data)) return value;

      return Object.freeze({
        ...value,
        data: Object.freeze(Object.fromEntries(
          Object.entries(data).filter(([key]) => key !== "composedScene"),
        )),
      });
    }

    return value;
  };

  const genericAuthoringSnapshot = (snapshot: DesktopSnapshot) => {
    const compact = compactAssetSnapshot(snapshot);
    if (compact !== snapshot) return compact;
    const decorated = withRarityProposalEvidence(snapshot);

    const hierarchyEdits = decorated.proposal?.edits.filter((edit) =>
      touchesSceneHierarchy(edit.jsonPointer)
    ) ?? [];

    if (hierarchyEdits.length === 0) {
      return decorated;
    }

    if (hierarchyEdits.some((edit) =>
      edit.jsonPointer === SCENE_HIERARCHY_POINTER ||
      edit.jsonPointer.startsWith(`${SCENE_HIERARCHY_POINTER}/`)
    )) {
      return Object.freeze({
        ...decorated,
        unifiedDiff: null,
        renderedDiff: null,
        proposal: null,
      });
    }

    const proposal = decorated.proposal;

    if (proposal === null) return decorated;

    const edits = Object.freeze(proposal.edits.map((edit) => Object.freeze({
      ...edit,
      oldValue: withoutSceneHierarchy(edit.jsonPointer, edit.oldValue),
      newValue: withoutSceneHierarchy(edit.jsonPointer, edit.newValue),
    })));

    const renderedDiff = [
      "=== SceneAxi inspector — proposed change (review before accept) ===",
      ...edits.flatMap((edit) => [
        `--- a/${edit.documentPath}`,
        `+++ b/${edit.documentPath}`,
        `- ${JSON.stringify(edit.oldValue, null, 2)}`,
        `+ ${JSON.stringify(edit.newValue, null, 2)}`,
      ]),
      "=== end proposed change ===",
    ].join("\n");

    return Object.freeze({
      ...decorated,
      unifiedDiff: null,
      renderedDiff,
      proposal: Object.freeze({ ...proposal, edits }),
    });
  };

  const genericAuthoringData = <Input>(value: Input) => {
    if (!isDesktopObject(value) || value === null || Array.isArray(value)) return value;
    // SAFETY: The authoring response was produced by this bridge; the preceding guard establishes an object before optional own-field projection.
    let sanitized = value as DesktopBoundaryObject;

    if (isDesktopText(field(value, "phase")) && Object.hasOwn(value, "proposal")) {
      // SAFETY: this private projection only receives authoring session results produced by the bridge; phase/proposal identify a snapshot, and authoringSnapshot is the same session's snapshot.
      sanitized = genericAuthoringSnapshot(sanitized as DesktopSnapshot);
    }

    const documentData = field(sanitized, "data");
    const authoringSnapshot = field(sanitized, "authoringSnapshot");

    if (
      !isDesktopObject(documentData) &&
      (!isDesktopObject(authoringSnapshot) || authoringSnapshot === null)
    ) return sanitized;
    const dataKeys = field(sanitized, "dataKeys");
    const assetImportEvidence = field(sanitized, "assetImport");

    return Object.freeze({
      ...sanitized,
      ...(preparedAssetReview !== null && assetImportEvidence === preparedAssetReview.entry
        ? { assetImport: compactEntry(preparedAssetReview.entry) } : {}),
      ...(() => {
        const optional: DesktopOptionalFields<{ data?: DesktopDocumentData; dataKeys?: readonly string[] }> = {};

        if (isDesktopObject(documentData) && documentData !== null && !Array.isArray(documentData)) {
          Object.assign(optional, {
            data: Object.freeze(Object.fromEntries(
              Object.entries(documentData).filter(([key]) => key !== "composedScene" &&
                (preparedAssetReview === null || key !== PROJECT_ASSET_MANIFEST_KEY)),
            )),
            ...(() => {
              const keys: DesktopOptionalFields<{ dataKeys: readonly string[] }> = {};

              if (Array.isArray(dataKeys)) keys.dataKeys = Object.freeze(dataKeys.filter((key) => key !== "composedScene"));

              return keys;
            })(),
          });
        }

        return optional;
      })(),
      ...(() => {
        const optional: DesktopOptionalFields<{ authoringSnapshot?: ReturnType<typeof genericAuthoringSnapshot> }> = {};

        if (isDesktopObject(authoringSnapshot) && authoringSnapshot !== null) {
          // SAFETY: this private projection only receives authoring session results produced by the bridge; phase/proposal identify a snapshot, and authoringSnapshot is the same session's snapshot.
          optional.authoringSnapshot = genericAuthoringSnapshot(authoringSnapshot as DesktopSnapshot);
        }

        return optional;
      })(),
    });
  };

  const reconcilePendingAssetImport = <T extends DesktopSnapshot>(snapshot: T): T => {
    if (
      pendingAssetImport !== null &&
      snapshot.proposal !== pendingAssetImport.proposal
    ) {
      pendingAssetImport = null;
    }

    return snapshot;
  };

  const currentRarityAssistantResult = () => {
    const result = assistantJob?.result;

    return result !== undefined && "kind" in result && result.kind === "rarity-proposal"
      ? result
      : null;
  };

  const updateRarityAssistantAuthoring = (
    snapshot: DesktopSnapshot,
    evidence: DesktopRarityEvidence,
  ) => {
    const result = currentRarityAssistantResult();

    if (
      assistantJob === null ||
      result === null ||
      result.evidence.namespaceDigest !== evidence.namespaceDigest
    ) return;
    assistantJob = {
      ...assistantJob,
      result: Object.freeze({
        ...result,
        authoring: Object.freeze({ ...snapshot, rarityEvidence: evidence }),
      }),
    };
  };

  const retireRarityAssistantResult = (
    evidence: DesktopRarityEvidence,
    reason: DesktopRarityRetirementReason,
  ) => {
    const result = currentRarityAssistantResult();

    if (
      assistantJob === null ||
      result === null ||
      result.evidence.namespaceDigest !== evidence.namespaceDigest
    ) return;
    assistantJob = {
      ...assistantJob,
      result: Object.freeze({
        ...result,
        retirement: Object.freeze({ reason }),
      }),
    };
  };

  const handshake = (): DesktopBridgeHandshake =>
    Object.freeze({
      app: "@sceneaxi/desktop-linux" as const,
      runtime: "electron" as const,
      bridgeVersion: 1 as const,
      actions: DESKTOP_BRIDGE_ACTIONS,
      commandSchemaVersion: EDITOR_COMMAND_SCHEMA_VERSION,
      commands: EDITOR_COMMAND_REGISTRY,
    });

  const resolveRarityWithKernel = (input: RarityKernelResolutionInput) => {
    const bootstrapped = bootstrapOpenPath(
      {
        kind: "product",
        productManifest: {
          productId: input.productId,
          seed: input.seed,
          rarity: input.namespace,
        },
      },
      { nowMs },
    );

    if (!bootstrapped.ok) {
      const reason = rarityRefusalReason(bootstrapped.detail);

      return Object.freeze({
        ok: false as const,
        reason: reason ?? bootstrapped.reason,
        message: reason === null
          ? bootstrapped.message
          : bootstrapped.detail ?? bootstrapped.message,
      });
    }

    const handle = bootstrapped.value;
    const live = handle.session();

    if (!live.ok) {
      handle.close();

      return Object.freeze({ ok: false as const, reason: live.reason, message: live.message });
    }

    try {
      live.value.dispatch({
        type: "rarity-roll",
        eventId: input.eventId,
        request: input.request,
        providerEvidence: input.providerEvidence,
      });
      live.value.advance({ tick: 1, deltaMs: 0 });
      const rarity = live.value.observe().rarity;

      if (rarity === undefined) {
        return Object.freeze({
          ok: false as const,
          reason: RARITY_REFUSE_CODES.outcomeMismatch,
          message: "The authoritative kernel did not expose the resolved rarity namespace.",
        });
      }

      return Object.freeze({ ok: true as const, value: rarity });
    } catch (cause) {
      const reason = field(cause, "code") ?? field(cause, "reason");

      return Object.freeze({
        ok: false as const,
        reason: isDesktopText(reason) ? reason : RARITY_REFUSE_CODES.outcomeMismatch,
        message: "The authoritative kernel refused the rarity resolution.",
      });
    } finally {
      handle.close();
    }
  };

  /**
   * Exercise the accepted rarity namespace through its own product session.
   *
   * This is additional to the composed scene's open path, never a replacement
   * for it, so its digests stay in their own record.
   */
  const rarityProductExercise = <RarityInput>(
    documentData: DesktopDocumentData,
    rarityValue: RarityInput,
  ):
    | Readonly<{
        ok: true;
        session?: OpenPathRaritySession;
        evidence?: DesktopRarityEvidence;
      }>
    | Readonly<{ ok: false; reason: string; message: string; detail?: string | null }> => {
    const rarity = validateRarityNamespace(rarityValue);

    if (!rarity.ok) {
      return { ok: false, reason: rarity.code, message: rarity.message, detail: rarity.path };
    }

    const roll = rarity.value.rolls.at(-1);

    if (roll === undefined) {
      return { ok: true };
    }

    const productId = documentData.productId;
    const seed = documentData.seed;

    if (!isDesktopText(productId) || !isDesktopSafeInteger(seed)) {
      return {
        ok: false,
        reason: DESKTOP_BRIDGE_REFUSALS.requestMalformed,
        message: "The active rarity project has no valid ProductManifest identity.",
      };
    }

    const bootstrapped = bootstrapOpenPath(
      {
        kind: "product",
        productManifest: {
          productId,
          seed: seed,
          rarity: rarity.value,
        },
      },
      { nowMs },
    );

    if (!bootstrapped.ok) {
      const reason = rarityRefusalReason(bootstrapped.detail);

      return {
        ok: false,
        reason: reason ?? bootstrapped.reason,
        message: reason === null
          ? bootstrapped.message
          : bootstrapped.detail ?? bootstrapped.message,
        detail: bootstrapped.detail,
      };
    }

    const handle = bootstrapped.value;
    const live = handle.session();

    if (!live.ok) {
      handle.close();
      const reason = rarityRefusalReason(live.detail);

      return {
        ok: false,
        reason: reason ?? live.reason,
        message: reason === null ? live.message : live.detail ?? live.message,
        detail: live.detail,
      };
    }

    let initialDigest: string;
    let save: ReturnType<typeof live.value.save>;
    const tickDigests: string[] = [];

    try {
      const initial = live.value.observe();
      initialDigest = initial.digest;
      live.value.dispatch({
        type: "rarity-roll",
        eventId: roll.eventId,
        request: roll.request,
        ...(() => {
          const optional: DesktopOptionalFields<{ providerEvidence?: ModelProviderCallEvidence }> = {};

          if (!(roll.providerEvidence === undefined)) {
            optional.providerEvidence = roll.providerEvidence;
          }

          return optional;
        })(),
      });

      for (let tick = 1; tick <= OPEN_PATH_EXERCISE_TICKS; tick += 1) {
        live.value.advance({ tick, deltaMs: 100 });
        tickDigests.push(live.value.observe().digest);
      }

      save = live.value.save();
    } catch (cause) {
      const reason = field(cause, "code") ?? field(cause, "reason");

      return {
        ok: false,
        reason: isDesktopText(reason) ? reason : RARITY_REFUSE_CODES.provenanceMismatch,
        message: "The accepted rarity session could not be replayed exactly.",
      };
    } finally {
      handle.close();
    }

    const resumed = resumeOpenPath({ kind: "product", save }, { nowMs });

    if (!resumed.ok) {
      const reason = rarityRefusalReason(resumed.detail);

      return {
        ok: false,
        reason: reason ?? resumed.reason,
        message: reason === null ? resumed.message : resumed.detail ?? resumed.message,
        detail: resumed.detail,
      };
    }

    const replay = resumed.value.session();

    if (!replay.ok) {
      resumed.value.close();
      const reason = rarityRefusalReason(replay.detail);

      return {
        ok: false,
        reason: reason ?? replay.reason,
        message: reason === null ? replay.message : replay.detail ?? replay.message,
        detail: replay.detail,
      };
    }

    let replayDigest: string;

    try {
      const snapshot = replay.value.observe();
      replayDigest = snapshot.digest;

      if (
        replayDigest !== save.terminalDigest ||
        snapshot.rarity === undefined ||
        digestRarityNamespace(snapshot.rarity) !== digestRarityNamespace(rarity.value)
      ) {
        return {
          ok: false,
          reason: RARITY_REFUSE_CODES.provenanceMismatch,
          message:
            "The resumed rarity session did not reproduce the accepted namespace and terminal digest.",
        };
      }
    } finally {
      resumed.value.close();
    }

    return {
      ok: true,
      session: Object.freeze({
        bootstrap: handle.bootstrap,
        initialDigest,
        tickDigests: Object.freeze(tickDigests),
        replayDigest,
      }),
      ...(() => {
        const optional: DesktopOptionalFields<{ evidence?: ReturnType<typeof safeRarityEvidenceFromNamespace> }> = {};

        if (!(roll.providerEvidence === undefined)) {
          optional.evidence = safeRarityEvidenceFromNamespace(rarity.value, roll.eventId, seed);
        }

        return optional;
      })(),
    };
  };

  const openPathExercise = <Input>(payload: Input): DesktopBridgeResponse => {
    const read = readActiveDocument(payload, SCENE_DOCUMENT_REFUSALS);

    if (!read.ok) return bridgeRefuse(read.reason, read.message);
    const status = read.status;
    const scene = desktopSceneFromDocumentData(status.data);

    if (!scene.ok) return bridgeRefuse(scene.reason, scene.message);
    const recoveryDocumentPath = containedDocumentPath(field(payload, "documentPath"));

    if (recoveryDocumentPath !== null) {
      const recovered = materializeProjectAssetCopies({ projectRoot: options.cwd, documentPath: recoveryDocumentPath });

      if (!recovered.ok) return bridgeRefuse(recovered.reason, recovered.message);
    }

    let raritySession: OpenPathRaritySession | undefined;
    let rarityEvidence: DesktopRarityEvidence | undefined;

    if (status.data.rarity !== undefined) {
      const exercised = rarityProductExercise(status.data, status.data.rarity);

      if (!exercised.ok) {
        return bridgeRefuse(exercised.reason, exercised.message, exercised.detail);
      }

      raritySession = exercised.session;

      if (exercised.evidence !== undefined) rarityEvidence = exercised.evidence;
    }

    const bootstrapped = bootstrapOpenPath(
      { kind: "scene", scene: scene.composed.scene, options: { seed: 20260731 } },
      { nowMs },
    );

    if (!bootstrapped.ok) {
      return bridgeRefuse(bootstrapped.reason, bootstrapped.message, bootstrapped.detail);
    }

    const handle = bootstrapped.value;
    const live = handle.session();

    if (!live.ok) {
      handle.close();

      return bridgeRefuse(live.reason, live.message, live.detail);
    }

    let initialDigest: string;
    let instanceCount: number;
    const tickDigests: string[] = [];

    try {
      const initial = live.value.observe();
      initialDigest = initial.digest;
      instanceCount = initial.instances.length;

      for (let tick = 1; tick <= OPEN_PATH_EXERCISE_TICKS; tick += 1) {
        live.value.advance({ tick, deltaMs: 100 });
        tickDigests.push(live.value.observe().digest);
      }
    } finally {
      handle.close();
    }

    const exercise: OpenPathExercise = Object.freeze({
      bootstrap: handle.bootstrap,
      initialDigest,
      tickDigests: Object.freeze(tickDigests),
      instanceCount,
      mountable: scene.mountable,
      closed: true as const,
      ...(() => {
        const optional: DesktopOptionalFields<{ rarity?: DesktopRarityEvidence }> = {};

        if (!(rarityEvidence === undefined)) {
          optional.rarity = rarityEvidence;
        }

        return optional;
      })(),
      ...(() => {
        const optional: DesktopOptionalFields<{ raritySession?: OpenPathRaritySession }> = {};

        if (!(raritySession === undefined)) {
          optional.raritySession = raritySession;
        }

        return optional;
      })(),
    });

    return bridgeOk("open-path", exercise);
  };

  /**
   * A document path arrives from the renderer process across IPC, and the authoring
   * core resolves it against `cwd` without a containment check of its own. The bridge
   * owns that constraint: a project-relative path, never an absolute one and never an
   * escape out of the project directory — lexically, and again after every symlink on
   * it has been resolved, since a link inside the project is an escape the text of the
   * path does not show.
   */
  const lexicalDocumentPath = <Input>(value: Input): string | null => {
    if (!isDesktopText(value) || value.length === 0) return null;

    if (
      isAbsolute(value) ||
      /^[a-zA-Z]:[\\/]/.test(value) ||
      value.includes("\0") ||
      value.split(/[\\/]+/).includes("..")
    ) return null;
    const root = resolve(options.cwd);
    const target = resolve(root, value);

    if (target !== root && !target.startsWith(`${root}${sep}`)) return null;

    return value;
  };

  const containedDocumentPath = <Input>(value: Input): string | null => {
    const documentPath = lexicalDocumentPath(value);

    if (documentPath === null) return null;
    const root = resolve(options.cwd);
    const target = resolve(root, documentPath);
    const realRoot = canonicalPath(root);
    const realTarget = canonicalPath(target);

    if (realRoot === null || realTarget === null) return null;

    if (realTarget !== realRoot && !realTarget.startsWith(`${realRoot}${sep}`)) return null;

    return documentPath;
  };

  /**
   * The one owner of "which document does this payload name, and may this
   * process read it": containment first, then the session's own diagnostic
   * mapping. Every action that names a document starts here, so a caller cannot
   * end up enforcing containment a second, divergent way; a caller supplies only
   * the vocabulary its own surface refuses in, never the rule.
   */
  const readActiveDocument = <Input>(
    payload: Input,
    refusals: Readonly<{ missingMessage: string; unreadableReason: string }>,
  ):
    | Readonly<{ ok: true; status: Extract<DesktopDocumentStatus, { ok: true }> }>
    | Readonly<{ ok: false; reason: string; message: string }> => {
    const documentPath = containedDocumentPath(field(payload, "documentPath"));

    if (documentPath === null) {
      return {
        ok: false,
        reason: DESKTOP_BRIDGE_REFUSALS.requestMalformed,
        message: refusals.missingMessage,
      };
    }

    const status = authoringSession().status(documentPath);

    if (!status.ok) {
      const diagnostic = status.diagnostics[0];

      return {
        ok: false,
        reason: diagnostic?.code ?? refusals.unreadableReason,
        message: diagnostic?.message ?? "The active Scene Document could not be read.",
      };
    }

    return { ok: true, status };
  };

  const SCENE_DOCUMENT_REFUSALS = Object.freeze({
    missingMessage: "scene playback requires a documentPath string inside the project directory.",
    unreadableReason: DESKTOP_SCENE_NOT_COMPOSABLE,
  });

  const RARITY_DOCUMENT_REFUSALS = Object.freeze({
    missingMessage: "A rarity assistant action requires a documentPath inside the project directory.",
    unreadableReason: DESKTOP_BRIDGE_REFUSALS.requestMalformed,
  });

  const activeScene = <Input>(payload: Input): DesktopSceneResult => {
    const read = readActiveDocument(payload, SCENE_DOCUMENT_REFUSALS);

    if (!read.ok) return { ok: false, reason: read.reason, message: read.message };
    const scene = desktopSceneFromDocumentData(read.status.data);

    if (!scene.ok) return scene;
    const documentPath = containedDocumentPath(field(payload, "documentPath"));

    if (documentPath !== null) {
      const recovered = materializeProjectAssetCopies({ projectRoot: options.cwd, documentPath });

      if (!recovered.ok) return { ok: false, reason: recovered.reason, message: recovered.message };
    }

    return scene;
  };

  const recoverAssetCopies = (documentPath: string) =>
    materializeProjectAssetCopies({ projectRoot: options.cwd, documentPath });

  /** Own the request and worker result together: no renderer can submit a fabricated prepared result. */
  const prepareAssetImport = (input: Omit<ProjectAssetPreparationInput, "projectRoot">): DesktopPreparedAssetJob => {
    const refused = (reason: string, message: string) => bridgeRefuse(reason, message);
    const immediate = (response: DesktopBridgeResponse): DesktopPreparedAssetJob => {
      const result = Promise.resolve(response);
      return Object.freeze({ generation: preparationGeneration, result, cancel: () => result });
    };
    if (preparationClosed) return immediate(refused(ASSET_PREPARATION_REFUSALS.cancelled, "This project bridge was closed."));
    if (input === null || typeof input !== "object" || types.isProxy(input) || Array.isArray(input)) {
      return immediate(refused(ASSET_PREPARATION_REFUSALS.inputInvalid, "Invalid native asset preparation request."));
    }
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (Object.hasOwn(descriptors, "projectRoot") || Object.values(descriptors).some(d => !("value" in d))) {
      return immediate(refused(ASSET_PREPARATION_REFUSALS.inputInvalid, "Asset preparation cannot replace root authority or invoke accessors."));
    }
    if (activeCommandProfile === "kids" || descriptors["profile"]?.value === "kids") {
      return immediate(refused(ASSET_PREPARATION_REFUSALS.kidsDenied, "Kids asset preparation is denied before project access."));
    }
    if (descriptors["profile"]?.value !== activeCommandProfile) {
      return immediate(refused(ASSET_PREPARATION_REFUSALS.inputInvalid, "Asset preparation cannot override the active project profile."));
    }
    if (currentPreparation !== null) return immediate(refused(ASSET_PREPARATION_REFUSALS.busy, "One native asset preparation is pending."));
    const documentPath = containedDocumentPath(descriptors["documentPath"]?.value);
    if (documentPath === null) return immediate(refused(ASSET_PREPARATION_REFUSALS.inputInvalid, "Asset preparation requires a contained document."));
    let live: DesktopSession;
    try { live = authoringSession(); }
    catch (cause) {
      if (!(cause instanceof DesktopProjectMutationOwnerError)) throw cause;
      return immediate(refused(cause.diagnostic.code, cause.diagnostic.message));
    }
    const existing = live.snapshot();
    if (existing.phase === "reviewing" || existing.journalRecoveryPending) {
      return immediate(refused(ASSET_PREPARATION_REFUSALS.busy, "Accept, reject, or recover the existing review first."));
    }
    // Preserve property descriptors until the worker's actual admission schema accepts them.
    const request = Object.defineProperties({ projectRoot: options.cwd }, descriptors);
    const worker = startProjectAssetPreparation(request);
    const token = ++preparationGeneration;
    const publication = new AbortController();
    let terminal = false;
    const pending = Object.freeze({ retire: () => {
      publication.abort();
      void worker.cancel();
    } });
    currentPreparation = pending;
    const result = worker.result.then(async outcome => {
      if (publication.signal.aborted || token !== preparationGeneration || currentPreparation !== pending || session !== live) {
        return refused(ASSET_PREPARATION_REFUSALS.cancelled, "Prepared asset generation was retired.");
      }
      if (!outcome.ok) return refused(outcome.reason, "Asset preparation refused without applying bytes.");
      const prepared = outcome.prepared;
      if (prepared.replayed) {
        const copies = recoverAssetCopies(documentPath);
        return copies.ok ? bridgeOk("asset-import", Object.freeze({ outcome: "replayed" as const,
          entry: compactEntry(prepared.entry), assetCopies: copies })) : refused(copies.reason, copies.message);
      }
      if (prepared.proposal === null) return refused(ASSET_PREPARATION_REFUSALS.inputInvalid, "Prepared asset has no E1 proposal.");
      const staged = await live.stagePreparedProposal({ proposal: prepared.proposal,
        unifiedDiff: prepared.unifiedDiff, signal: publication.signal });
      if (publication.signal.aborted || token !== preparationGeneration || session !== live) {
        return refused(ASSET_PREPARATION_REFUSALS.cancelled, "Prepared asset generation was retired.");
      }
      if (staged.phase !== "reviewing" || staged.proposal !== prepared.proposal || (staged.diagnostics?.length ?? 0) > 0) {
        return refused(staged.diagnostics?.[0]?.code ?? ASSET_PREPARATION_REFUSALS.inputInvalid,
          staged.diagnostics?.[0]?.message ?? "Prepared E1 could not be staged for review.");
      }
      const entry = prepared.entry;
      const summary = ["=== SceneAxi asset import — review before accept ===",
        `Document: ${documentPath}`, `Base: ${prepared.proposal.edits[0]?.baseContentHash ?? ""}`,
        `Asset: ${entry.assetId} (${entry.sourceName})`, `Original bytes: ${String(entry.byteLength)}`,
        `Source digest: ${entry.provenance.sourceDigest}`, `Project copy: ${entry.relativePath}`,
        `Replaces: ${entry.validation.replacesDigest ?? "none"}`,
        "The exact validated E1 proposal and original source evidence are retained by the session.",
        "=== end proposed change ==="].join("\n");
      preparedAssetReview = Object.freeze({ proposal: prepared.proposal, entry, summary });
      pendingAssetImport = Object.freeze({ documentPath, entry, proposal: prepared.proposal });
      return bridgeOk("asset-import", Object.freeze({ outcome: "reviewing" as const,
        entry: compactEntry(entry), hotReload: prepared.hotReload, authoring: compactAssetSnapshot(staged),
        unifiedDiff: summary }));
    }).catch(() => refused(ASSET_PREPARATION_REFUSALS.unavailable, "Prepared asset admission failed without applying bytes.")).finally(() => {
      terminal = true;
      if (currentPreparation === pending) currentPreparation = null;
    });
    return Object.freeze({ generation: worker.generation, result, async cancel() {
      if (!terminal) {
        if (currentPreparation === pending) retirePreparation();
        else publication.abort();
        await worker.cancel();
      }
      return result;
    } });
  };

  /** Stage one native selection through the existing all-or-nothing E1 session. */
  const assetImport = <Input>(payload: Input): DesktopBridgeResponse => {
    const profile = field(payload, "profile");
    const sourcePath = field(payload, "sourcePath");
    const documentPath = containedDocumentPath(field(payload, "documentPath"));
    const requestedAssetId = field(payload, "assetId");
    const hotReload = field(payload, "hotReload");

    if (profile !== "web" && profile !== "game") {
      return bridgeRefuse(
        DESKTOP_PROJECT_BROWSER_REFUSALS.kidsDenied,
        "The first-class asset pipeline supports Game and Web projects; Kids remains refuse-only.",
      );
    }

    if (
      !isDesktopText(sourcePath) ||
      documentPath === null ||
      (requestedAssetId !== undefined && !isDesktopText(requestedAssetId)) ||
      (hotReload !== undefined && !isDesktopBoolean(hotReload))
    ) {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.requestMalformed,
        "asset-import requires a native absolute sourcePath, a documentPath inside the selected project, and an optional hotReload boolean.",
      );
    }

    const proposed = proposeProjectAssetImport({
      projectRoot: options.cwd,
      documentPath,
      sourcePath,
      ...(() => {
        const optional: DesktopOptionalFields<{ assetId?: string }> = {};

        if (isDesktopText(requestedAssetId)) {
          optional.assetId = requestedAssetId;
        }

        return optional;
      })(),
      ...(() => {
        const optional: DesktopOptionalFields<{ hotReload?: true }> = {};

        if (hotReload === true) {
          optional.hotReload = true;
        }

        return optional;
      })(),
    });

    if (!proposed.ok) return bridgeRefuse(proposed.reason, proposed.message);

    if (proposed.replayed) {
      const copies = recoverAssetCopies(documentPath);

      if (!copies.ok) return bridgeRefuse(copies.reason, copies.message);

      return bridgeOk("asset-import", Object.freeze({
        outcome: "replayed" as const,
        entry: proposed.entry,
        assetCopies: copies,
      }));
    }

    const edit = proposed.proposal?.edits[0];

    if (edit === undefined) {
      return bridgeRefuse(DESKTOP_BRIDGE_REFUSALS.requestMalformed, "The importer produced no E1 proposal edit.");
    }

    const authoring = reconcilePendingAssetImport(authoringSession().proposeEdit({
      documentPath: edit.documentPath,
      jsonPointer: edit.jsonPointer,
      newValue: edit.newValue,
      expectedContentHash: edit.baseContentHash,
    }));

    if (authoring.phase !== "reviewing" || (authoring.diagnostics?.length ?? 0) > 0) {
      return bridgeOk("asset-import", Object.freeze({ outcome: "refused" as const, authoring }));
    }

    if (authoring.proposal === null) {
      return bridgeRefuse(DESKTOP_BRIDGE_REFUSALS.requestMalformed, "The authoring session retained no asset proposal for review.");
    }

    pendingAssetImport = Object.freeze({
      documentPath,
      entry: proposed.entry,
      proposal: authoring.proposal,
    });

    return bridgeOk("asset-import", Object.freeze({
      outcome: "reviewing" as const,
      entry: proposed.entry,
      hotReload: proposed.hotReload,
      authoring,
      unifiedDiff: proposed.unifiedDiff,
    }));
  };

  const authoring = <Input>(
    payload: Input,
    hierarchyCommandResponse = false,
    preloadedStatus?: DesktopDocumentStatus,
  ): DesktopBridgeResponse => {
    const op = field(payload, "op");

    const authoringOk = <Input>(data: Input) => bridgeOk(
      "authoring",
      hierarchyCommandResponse ? data : genericAuthoringData(data),
    );

    let hierarchyDocumentPath: string | null = null;

    if (!isAuthoringOp(op)) {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.authoringOpUnknown,
        `Unknown authoring operation ${JSON.stringify(op)}. Known: ${DESKTOP_BRIDGE_AUTHORING_OPS.join(", ")}.`,
      );
    }

    if (op === "propose") {
      const jsonPointer = field(payload, "jsonPointer");

      if (touchesSceneHierarchy(jsonPointer)) {
        return bridgeRefuse(
          DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
          "Generic authoring proposals cannot supply or target scene hierarchy data.",
        );
      }
    }

    if (op === "edit-scene" || op === "edit-property") {
      const profile = field(payload, "profile");

      if (options.commandProfile === "kids" || profile === "kids") {
        return bridgeRefuse(
          DESKTOP_SCENE_HIERARCHY_REFUSALS.kidsDenied,
          "Scene hierarchy editing is denied for Kids before project access.",
        );
      }

      if (options.commandProfile !== undefined && options.commandProfile !== profile) {
        return bridgeRefuse(
          DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
          `Scene hierarchy editing cannot override the active ${options.commandProfile} profile.`,
        );
      }

      if (!isDesktopSceneEditProfile(profile)) {
        return bridgeRefuse(
          DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
          "Scene hierarchy editing requires a Game or Web profile.",
        );
      }

      if (options.commandCapabilities?.includes("scene.compose") !== true) {
        return bridgeRefuse(
          DESKTOP_SCENE_HIERARCHY_REFUSALS.capabilityMissing,
          "Scene hierarchy editing requires missing capability scene.compose.",
        );
      }

      const expectedFields = op === "edit-scene"
        ? ["op", "documentPath", "expectedContentHash", "profile", "operation"]
        : ["op", "documentPath", "expectedContentHash", "profile", "entityId", "propertyId", "newValue"];

      const documentPath = lexicalDocumentPath(field(payload, "documentPath"));
      const expectedContentHash = field(payload, "expectedContentHash");

      if (
        !hasExactFields(payload, expectedFields) ||
        documentPath === null ||
        !isDesktopText(expectedContentHash) ||
        !/^sha256:[0-9a-f]{64}$/.test(expectedContentHash)
      ) {
        return bridgeRefuse(
          DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
          "Scene hierarchy editing requires one exact contained mutation envelope.",
        );
      }

      if (op === "edit-scene") {
        const operation = field(payload, "operation");
        const transformPolicy = field(operation, "transformPolicy");

        if (
          field(operation, "kind") === "reparent-object" &&
          !isDesktopSceneReparentPolicy(transformPolicy)
        ) {
          return bridgeRefuse(
            DESKTOP_SCENE_HIERARCHY_REFUSALS.policyInvalid,
            "Reparenting requires transformPolicy preserve-world or preserve-local.",
          );
        }

        if (!isDesktopSceneEditOperation(operation)) {
          return bridgeRefuse(
            DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
            "Scene hierarchy editing requires one supported operation.",
          );
        }
      } else if (!isDesktopSceneEditOperation({
        kind: "set-transform-component",
        instanceId: field(payload, "entityId"),
        propertyId: field(payload, "propertyId"),
        value: field(payload, "newValue"),
      })) {
        return bridgeRefuse(
          DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
          "Scene property editing requires one supported instance, property, and finite bounded value.",
        );
      }

      hierarchyDocumentPath = containedDocumentPath(documentPath);

      if (hierarchyDocumentPath === null) {
        return bridgeRefuse(
          DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
          "Scene hierarchy editing requires a contained project document path.",
        );
      }
    }

    const rarityStatus = (data: DesktopDocumentData) => {
      if (data.rarity === undefined) {
        return Object.freeze({
          ok: true as const,
          value: Object.freeze({ rarityNamespaceDigest: null, acceptedRarityEvidence: null }),
        });
      }

      const rarity = validateRarityNamespace(data.rarity);

      if (!rarity.ok) {
        return Object.freeze({
          ok: false as const,
          reason: rarity.code,
          message: rarity.message,
        });
      }

      const rarityNamespaceDigest = digestRarityNamespace(rarity.value);
      const roll = rarity.value.rolls.at(-1);

      if (roll === undefined || roll.providerEvidence === undefined) {
        return Object.freeze({
          ok: true as const,
          value: Object.freeze({ rarityNamespaceDigest, acceptedRarityEvidence: null }),
        });
      }

      if (!isDesktopText(data.productId) || !isDesktopSafeInteger(data.seed)) {
        return Object.freeze({
          ok: false as const,
          reason: RARITY_REFUSE_CODES.seedInvalid,
          message: "The accepted rarity namespace has no valid ProductManifest identity.",
        });
      }

      const verified = resolveRarityWithKernel({
        productId: data.productId,
        seed: data.seed,
        eventId: roll.eventId,
        namespace: rarity.value,
        request: roll.request,
        providerEvidence: roll.providerEvidence,
      });

      if (!verified.ok) {
        return Object.freeze({
          ok: false as const,
          reason: verified.reason,
          message: verified.message,
        });
      }

      if (digestRarityNamespace(verified.value) !== rarityNamespaceDigest) {
        return Object.freeze({
          ok: false as const,
          reason: RARITY_REFUSE_CODES.outcomeMismatch,
          message: "The accepted rarity namespace does not match authoritative kernel replay.",
        });
      }

      const acceptedRarityEvidence = safeRarityEvidenceFromNamespace(
          rarity.value,
          roll.eventId,
          data.seed,
        );

      if (acceptedRarityEvidence === null) {
        return Object.freeze({
          ok: false as const,
          reason: RARITY_REFUSE_CODES.provenanceMismatch,
          message: "The accepted rarity namespace has malformed display provenance.",
        });
      }

      return Object.freeze({
        ok: true as const,
        value: Object.freeze({
          rarityNamespaceDigest,
          acceptedRarityEvidence,
        }),
      });
    };

    const reconcileRarityAssistantDocument = (
      status: Readonly<{
        ok: boolean;
        diagnostics?: readonly Readonly<{ code: string }>[];
        rarityNamespaceDigest?: string | null;
      }>,
      reason?: DesktopRarityRetirementReason,
    ) => {
      const result = currentRarityAssistantResult();

      if (
        result?.authoring?.phase !== "applied" ||
        result.retirement !== undefined
      ) return;

      if (!status.ok) {
        const code = status.diagnostics?.[0]?.code;

        if (code === "document-not-found") {
          retireRarityAssistantResult(result.evidence, reason ?? "document-missing");
        } else if (code?.startsWith("RARITY_")) {
          retireRarityAssistantResult(result.evidence, reason ?? "namespace-replaced");
        }

        return;
      }

      if (status.rarityNamespaceDigest !== result.evidence.namespaceDigest) {
        retireRarityAssistantResult(result.evidence, reason ?? "namespace-replaced");
      }
    };

    const statusWithEvidence = (
      live: DesktopSession,
      documentPath: string,
      retirementReason?: DesktopRarityRetirementReason,
      privateStatus?: DesktopDocumentStatus,
    ) => {
      const status = privateStatus ?? live.status(documentPath);

      if (!status.ok) {
        documentStatusIdentity = null;
        reconcileRarityAssistantDocument(status, retirementReason);

        return status;
      }

      documentStatusIdentity = Object.freeze({
        documentPath,
        contentHash: status.contentHash,
        contentByteLength: status.contentByteLength,
      });
      const rarity = rarityStatus(status.data);

      if (!rarity.ok) {
        const refused = Object.freeze({
          ok: false as const,
          documentPath,
          authoringSnapshot: withRarityProposalEvidence(live.snapshot()),
          diagnostics: Object.freeze([
            Object.freeze({
              code: rarity.reason,
              message: rarity.message,
              documentPath,
            }),
          ]),
        });

        reconcileRarityAssistantDocument(refused, retirementReason);

        return refused;
      }

      const enriched = Object.freeze({
        ...status,
        ...rarity.value,
        authoringSnapshot: withRarityProposalEvidence(live.snapshot()),
      });

      reconcileRarityAssistantDocument(enriched, retirementReason);

      return enriched;
    };

    const settleRarityProposalEvidence = (snapshot: DesktopSnapshot) => {
      const decorated = withRarityProposalEvidence(snapshot);

      if (
        (snapshot.phase === "applied" || snapshot.phase === "rejected") &&
        !snapshot.journalRecoveryPending
      ) {
        if (rarityProposalEvidence !== null) {
          updateRarityAssistantAuthoring(snapshot, rarityProposalEvidence);
        }

        rarityProposalEvidence = null;
      }

      return decorated;
    };

    if (op === "restart") {
      retirePreparation();
      const documentPath = containedDocumentPath(field(payload, "documentPath"));

      if (documentPath === null) {
        return bridgeRefuse(
          DESKTOP_BRIDGE_REFUSALS.requestMalformed,
          "authoring restart requires a documentPath string inside the project directory.",
        );
      }

      if (session !== null && !releaseDesktopSessionProjectGitAuthority(session)) {
        return bridgeRefuse(
          PROJECT_GIT_DIAGNOSTICS.transactionDirty,
          "The desktop mutation-owner lease could not be released; retry restart after cleanup succeeds.",
          ".sceneaxi-desktop-mutation-owner",
        );
      }

      session = createBoundAuthoringSession();
      const restartedEvidence = rarityProposalEvidence;
      rarityProposalEvidence = null;
      pendingAssetImport = null;
      pendingSceneSelection = null;
      const restartedPrivate = session.status(documentPath);
      latchInvalidSceneSelection(documentPath, restartedPrivate);
      const restarted = statusWithEvidence(session, documentPath, undefined, restartedPrivate);

      if (restartedEvidence !== null) {
        if (
          restarted.ok &&
          restarted.rarityNamespaceDigest === restartedEvidence.namespaceDigest
        ) {
          const result = currentRarityAssistantResult();
          const snapshot = result?.authoring;

          if (snapshot !== undefined) {
            updateRarityAssistantAuthoring(
              Object.freeze({
                ...snapshot,
                phase: "applied" as const,
                appliedPaths: Object.freeze(
                  snapshot.proposal?.edits.map((edit) => edit.documentPath) ?? [documentPath],
                ),
                journalRecoveryPending: false,
                transactionId: null,
                diagnostics: Object.freeze([]),
              }),
              restartedEvidence,
            );
          }
        } else {
          retireRarityAssistantResult(restartedEvidence, "session-restarted");
        }
      }

      return authoringOk(restarted);
    }

    const live = authoringSession();

    if (op === "status") {
      const documentPath = containedDocumentPath(field(payload, "documentPath"));

      if (documentPath === null) {
        return bridgeRefuse(
          DESKTOP_BRIDGE_REFUSALS.requestMalformed,
          "authoring status requires a documentPath string inside the project directory.",
        );
      }

      return authoringOk(statusWithEvidence(live, documentPath, undefined, preloadedStatus));
    }

    if (op === "edit-scene") {
      const documentPath = hierarchyDocumentPath;
      const expectedContentHash = field(payload, "expectedContentHash");

      if (documentPath === null || !isDesktopText(expectedContentHash)) {
        return bridgeRefuse(
          DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
          "Scene hierarchy editing requires one exact contained mutation envelope.",
        );
      }

      const status = live.status(documentPath);

      if (!status.ok) return authoringOk(status);

      const priorSelection = currentSceneSelection(
        status.data,
        status.contentHash,
        documentPath,
      );

      const selectionWasStale = priorSelection?.ok === false &&
        priorSelection.reason === DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale;

      if (selectionWasStale) {
        return hierarchyCommandResponse
          ? authoringOk(priorSelection)
          : bridgeRefuse(
              DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
              priorSelection.diagnostics[0]?.message ?? "The retained scene selection is stale.",
            );
      }

      const staged = stageDesktopSceneEdit({
        documentData: status.data,
        contentHash: expectedContentHash,
        documentPath,
        profile: field(payload, "profile"),
        operation: field(payload, "operation"),
      });

      if (!staged.ok) {
        const diagnostic = staged.diagnostics[0];

        return authoringOk(staged.reason === undefined
          ? staged
          : Object.freeze({
              ...staged,
              diagnostics: Object.freeze([
                Object.freeze({
                  code: staged.reason,
                  message: diagnostic?.message ?? "The hierarchy operation was refused.",
                  documentPath,
                }),
              ]),
            }));
      }

      const snapshot = live.proposeEdit(staged.edit);

      if (snapshot.phase !== "reviewing" || (snapshot.diagnostics?.length ?? 0) > 0) {
        if (snapshot.phase !== "reviewing") pendingSceneSelection = null;

        return authoringOk(hierarchyCommandResponse
          ? withRarityProposalEvidence(snapshot)
          : genericAuthoringSnapshot(snapshot));
      }

      if (snapshot.proposal !== null) {
        pendingSceneSelection = Object.freeze({
          documentPath,
          baseContentHash: expectedContentHash,
          instanceIds: staged.selectedInstanceIds,
          proposal: snapshot.proposal,
          transactionId: null,
        });
      }

      return authoringOk(hierarchyCommandResponse
        ? Object.freeze({
            ...snapshot,
            editableScene: staged.inspection,
            selectedInstanceId: staged.selectedInstanceId,
            selectedInstanceIds: staged.selectedInstanceIds,
            sceneEditOperation: staged.operation,
          })
        : genericAuthoringSnapshot(snapshot));
    }

    if (op === "edit-property") {
      const documentPath = hierarchyDocumentPath;
      const expectedContentHash = field(payload, "expectedContentHash");

      if (documentPath === null || !isDesktopText(expectedContentHash)) {
        return bridgeRefuse(
          DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
          "Scene hierarchy editing requires one exact contained mutation envelope.",
        );
      }

      const status = live.status(documentPath);

      if (!status.ok) return authoringOk(status);

      const priorSelection = currentSceneSelection(
        status.data,
        status.contentHash,
        documentPath,
      );

      const selectionWasStale = priorSelection?.ok === false &&
        priorSelection.reason === DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale;

      if (selectionWasStale) {
        return hierarchyCommandResponse
          ? authoringOk(priorSelection)
          : bridgeRefuse(
              DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
              priorSelection.diagnostics[0]?.message ?? "The retained scene selection is stale.",
            );
      }

      const staged = stageDesktopScenePropertyEdit({
        documentData: status.data,
        contentHash: expectedContentHash,
        documentPath,
        entityId: field(payload, "entityId"),
        propertyId: field(payload, "propertyId"),
        newValue: field(payload, "newValue"),
      });

      if (!staged.ok) return authoringOk(staged);
      const snapshot = reconcilePendingAssetImport(live.proposeEdit(staged.edit));

      if (snapshot.phase !== "reviewing" || (snapshot.diagnostics?.length ?? 0) > 0) {
        if (snapshot.phase !== "reviewing") pendingSceneSelection = null;

        return authoringOk(hierarchyCommandResponse
          ? withRarityProposalEvidence(snapshot)
          : genericAuthoringSnapshot(snapshot));
      }

      if (snapshot.proposal !== null) {
        pendingSceneSelection = Object.freeze({
          documentPath,
          baseContentHash: expectedContentHash,
          instanceIds: staged.inspection.selection.instanceIds,
          proposal: snapshot.proposal,
          transactionId: null,
        });
      }

      return authoringOk(hierarchyCommandResponse
        ? Object.freeze({ ...snapshot, editableScene: staged.inspection })
        : genericAuthoringSnapshot(snapshot));
    }

    if (op === "propose") {
      const documentPath = containedDocumentPath(field(payload, "documentPath"));
      const jsonPointer = field(payload, "jsonPointer");
      const expectedContentHash = field(payload, "expectedContentHash");

      if (
        documentPath === null ||
        !isDesktopText(jsonPointer) ||
        (expectedContentHash !== undefined &&
          (!isDesktopText(expectedContentHash) ||
            !/^sha256:[0-9a-f]{64}$/.test(expectedContentHash)))
      ) {
        return bridgeRefuse(
          DESKTOP_BRIDGE_REFUSALS.requestMalformed,
          "authoring propose requires a jsonPointer string, an optional SHA-256 expectedContentHash, and a documentPath inside the project directory.",
        );
      }

      let proposalPointer = jsonPointer;
      let proposalValue = field(payload, "newValue");

      if (jsonPointer === "/data/webExperience") {
        const privateStatus = live.status(documentPath);

        if (!privateStatus.ok) return authoringOk(privateStatus);
        proposalPointer = "/data";
        proposalValue = Object.freeze({
          ...privateStatus.data,
          webExperience: proposalValue,
        });
      }

      const snapshot: DesktopSnapshot = reconcilePendingAssetImport(live.proposeEdit({
        documentPath,
        jsonPointer: proposalPointer,
        newValue: proposalValue,
        ...(() => {
          const optional: DesktopOptionalFields<{ expectedContentHash?: string }> = {};

          if (expectedContentHash !== undefined) {
            optional.expectedContentHash = expectedContentHash;
          }

          return optional;
        })(),
      }));

      if (pendingSceneSelection?.proposal !== snapshot.proposal) {
        pendingSceneSelection = null;
      }

      return authoringOk(snapshot);
    }

    if (op === "accept") {
      const accepted = settlePendingSceneSelection(reconcilePendingAssetImport(
        settleRarityProposalEvidence(live.accept()),
      ));

      if (
        pendingAssetImport === null ||
        accepted.phase !== "applied" ||
        accepted.journalRecoveryPending ||
        (accepted.diagnostics?.length ?? 0) > 0
      ) {
        return authoringOk(accepted);
      }

      const pending = pendingAssetImport;
      pendingAssetImport = null;
      const copies = recoverAssetCopies(pending.documentPath);

      return copies.ok
        ? authoringOk(Object.freeze({ ...accepted, assetImport: pending.entry, assetCopies: copies }))
        : bridgeRefuse(copies.reason, copies.message);
    }

    if (op === "reject") {
      retirePreparation();
      const rejected = reconcilePendingAssetImport(
        settleRarityProposalEvidence(live.reject()),
      );

      if (rejected.phase === "rejected") pendingSceneSelection = null;

      return authoringOk(rejected);
    }

    if (op === "recover") {
      const recoveryTransactionId = live.snapshot().transactionId;

      const recovered = settlePendingSceneSelection(reconcilePendingAssetImport(
        settleRarityProposalEvidence(live.refreshRecovery()),
      ), recoveryTransactionId);

      if (
        pendingAssetImport === null ||
        recovered.phase !== "applied" ||
        recovered.journalRecoveryPending ||
        (recovered.diagnostics?.length ?? 0) > 0
      ) {
        return authoringOk(recovered);
      }

      const pending = pendingAssetImport;
      pendingAssetImport = null;
      const copies = recoverAssetCopies(pending.documentPath);

      return copies.ok
        ? authoringOk(Object.freeze({ ...recovered, assetImport: pending.entry, assetCopies: copies }))
        : bridgeRefuse(copies.reason, copies.message);
    }

    const result = op === "redo" ? live.redo() : live.undo();

    if (result.ok) {
      if (rarityProposalEvidence !== null) {
        retireRarityAssistantResult(rarityProposalEvidence, op === "redo" ? "namespace-replaced" : "undo");
      }

      const assistantResult = currentRarityAssistantResult();

      const appliedDocumentPath = containedDocumentPath(
        assistantResult?.authoring?.proposal?.edits[0]?.documentPath,
      );

      if (
        assistantResult?.authoring?.phase === "applied" &&
        appliedDocumentPath !== null &&
        result.restoredPaths.includes(appliedDocumentPath)
      ) {
        statusWithEvidence(live, appliedDocumentPath, op === "redo" ? "namespace-replaced" : "undo");
      }

      rarityProposalEvidence = null;
      pendingAssetImport = null;
      pendingSceneSelection = null;

      if (op === "undo") {
        for (const documentPath of result.restoredPaths) {
          const containedPath = containedDocumentPath(documentPath);

          if (containedPath !== null) {
            latchInvalidSceneSelection(containedPath, live.status(containedPath));
          }
        }
      }
    }

    return authoringOk(result);
  };

  const projectBrowserOpen = <Input>(payload: Input): DesktopBridgeResponse => {
    if (options.projectBrowser === undefined) {
      return bridgeRefuse(
        DESKTOP_PROJECT_BROWSER_REFUSALS.projectRequired,
        "Choose a validated project before opening a project-browser file.",
      );
    }

    const profile = field(payload, "profile");
    const path = field(payload, "path");
    const opened = options.projectBrowser.handle({ action: "open", profile, path });

    if (!opened.ok) return bridgeRefuse(opened.reason, opened.message, opened.detail);
    const browserStatus = opened.data.status;
    const file = browserStatus.files.find((candidate) => candidate.path === path);

    if (file === undefined || browserStatus.activeDocumentPath !== DESKTOP_ACTIVE_DOCUMENT_PATH) {
      return bridgeRefuse(
        DESKTOP_PROJECT_BROWSER_REFUSALS.fileMissing,
        "The validated browser response did not retain the requested canonical file identity.",
        isDesktopText(path) ? path : null,
      );
    }

    const live = authoringSession();
    const privateStatus = live.status(browserStatus.activeDocumentPath);
    latchInvalidSceneSelection(browserStatus.activeDocumentPath, privateStatus);

    const authoringResponse = authoring({
      op: "status",
      documentPath: browserStatus.activeDocumentPath,
    }, false, privateStatus);

    if (!authoringResponse.ok) return authoringResponse;
    const authoringStatus = authoringResponse.data;

    if (field(authoringStatus, "ok") !== true) {
      const diagnostics = field(authoringStatus, "diagnostics");
      const diagnostic = Array.isArray(diagnostics) ? diagnostics[0] : undefined;
      const reason = field(diagnostic, "code");
      const message = field(diagnostic, "message");

      return bridgeRefuse(
        isDesktopText(reason) ? reason : DESKTOP_PROJECT_BROWSER_REFUSALS.documentInvalid,
        isDesktopText(message)
          ? message
          : "The active Scene Document could not be opened through the authoring session.",
        file.path,
      );
    }

    const authoringSnapshot = field(authoringStatus, "authoringSnapshot");
    const phase = field(authoringSnapshot, "phase");

    if (
      (phase !== "idle" && phase !== "applied" && phase !== "rejected") ||
      field(authoringSnapshot, "journalRecoveryPending") === true
    ) {
      return bridgeRefuse(
        DESKTOP_PROJECT_BROWSER_REFUSALS.dirty,
        "Open refuses while Change Review, recovery, or another unsaved authoring change is active.",
        file.path,
      );
    }

    const documentFile = browserStatus.files.find((candidate) => candidate.kind === "document");

    if (
      documentFile === undefined ||
      field(authoringStatus, "contentHash") !== documentFile.digest
    ) {
      return bridgeRefuse(
        DESKTOP_PROJECT_BROWSER_REFUSALS.documentInvalid,
        "The active Scene Document changed while the project-browser Open snapshot was being validated.",
        browserStatus.activeDocumentPath,
      );
    }

    if (file.kind === "document") {
      return bridgeOk("project-browser-open", Object.freeze({
        ...opened.data,
        authoringStatus,
      }));
    }

    if (file.family !== "model") {
      return bridgeOk("project-browser-open", Object.freeze({
        ...opened.data,
        authoringStatus,
        asset: Object.freeze({
          assetId: file.assetId,
          family: file.family,
          digest: file.digest,
          preview: file.preview,
        }),
      }));
    }

    if (file.instanceId === null) {
      return bridgeRefuse(
        DESKTOP_PROJECT_BROWSER_REFUSALS.fileInvalid,
        "The validated model entry has no stable scene instance identity.",
        file.path,
      );
    }

    const scene = desktopSceneFromDocumentData(privateStatus.ok ? privateStatus.data : undefined);

    if (!scene.ok) return bridgeRefuse(scene.reason, scene.message);
    const asset = Object.freeze({ instanceId: file.instanceId, digest: file.digest });

    if (!(scene.mountable.importedAssets ?? []).some((candidate) =>
      candidate.instanceId === asset.instanceId && candidate.digest === asset.digest
    )) {
      return bridgeRefuse(
        DESKTOP_PROJECT_BROWSER_REFUSALS.fileInvalid,
        "The canonical scene does not contain the validated asset identity and digest.",
        file.path,
      );
    }

    return bridgeOk("project-browser-open", Object.freeze({
      ...opened.data,
      authoringStatus,
      mountable: scene.mountable,
      asset,
    }));
  };

  const ship = <Input>(payload: Input): DesktopBridgeResponse => {
    const op = field(payload, "op");
    const documentPath = field(payload, "documentPath");
    const expectedContentHash = field(payload, "expectedContentHash");

    if (
      op !== "export-web" ||
      documentPath !== DESKTOP_ACTIVE_DOCUMENT_PATH ||
      !isDesktopText(expectedContentHash) ||
      !/^sha256:[0-9a-f]{64}$/.test(expectedContentHash)
    ) {
      return bridgeRefuse(
        DESKTOP_WEB_EXPORT_REFUSALS.requestMalformed,
        "ship export-web requires scene.json and the exact current SHA-256 content hash.",
      );
    }

    if ((options.webExportPlatform ?? process.platform) !== "linux") {
      return bridgeRefuse(
        DESKTOP_WEB_EXPORT_REFUSALS.platformUnsupported,
        "Export Web is available only in the Linux desktop runtime.",
      );
    }

    const live = authoringSession();
    const snapshot = live.snapshot();

    if (
      snapshot.phase === "reviewing" ||
      snapshot.phase === "pending" ||
      snapshot.journalRecoveryPending
    ) {
      return bridgeRefuse(
        DESKTOP_WEB_EXPORT_REFUSALS.projectDirty,
        "Save or reject the staged proposal and resolve durable recovery before exporting.",
      );
    }

    if (
      documentStatusIdentity === null ||
      documentStatusIdentity.documentPath !== documentPath ||
      documentStatusIdentity.contentHash !== expectedContentHash
    ) {
      return bridgeRefuse(
        DESKTOP_WEB_EXPORT_REFUSALS.projectChanged,
        "Reopen scene.json before exporting so Ship can verify its exact byte identity.",
      );
    }

    const runtimeJavaScript = options.webExportRuntime;

    if (runtimeJavaScript === undefined || runtimeJavaScript.byteLength === 0) {
      return bridgeRefuse(
        DESKTOP_WEB_EXPORT_REFUSALS.runtimeMissing,
        "The packaged static Web renderer bytes are unavailable.",
      );
    }

    const publisherExecutable = options.webExportPublisherExecutable;

    if (publisherExecutable === undefined) {
      return bridgeRefuse(
        DESKTOP_WEB_EXPORT_REFUSALS.writeFailed,
        "The packaged no-replace Web export publisher is unavailable.",
      );
    }

    const exported = exportDesktopWebProject({
      projectRoot: options.cwd,
      documentPath,
      expectedContentHash,
      expectedContentByteLength: documentStatusIdentity.contentByteLength,
      runtimeJavaScript,
      publisherExecutable,
    });

    return exported.ok
      ? bridgeOk("ship", exported)
      : bridgeRefuse(exported.reason, exported.message);
  };

  /**
   * What crosses the seam is bounded: the newest progress entry and how many
   * have accrued, never the accumulated log. The renderer polls this every 50ms
   * and renders only the latest entry, while a streaming BYOK route can report one
   * entry per provider chunk.
   */
  const assistantSnapshot = (): DesktopAssistantJobSnapshot | null => {
    if (assistantJob === null) return null;

    const terminal = assistantJob.status === "running"
      ? null
      : editorCommandTerminalResult({
          commandId: assistantJob.commandId,
          jobId: assistantJob.jobId,
          status: assistantJob.status === "ready"
            ? "completed"
            : assistantJob.refusal?.reason === DESKTOP_BRIDGE_REFUSALS.assistantAbandoned
              ? "cancelled"
              : "refused",
          phase: assistantJob.status === "ready"
            ? "ready"
            : assistantJob.refusal?.reason === DESKTOP_BRIDGE_REFUSALS.assistantAbandoned
              ? "cancelled"
              : "refused",
          message: assistantJob.status === "ready"
            ? (assistantJob.latestProgress?.message ?? "The registered assistant command completed.")
            : (assistantJob.refusal?.message ?? "The registered assistant command refused."),
        ...(() => {
          const optional: DesktopOptionalFields<{ refusal?: string }> = {};

          if (!(assistantJob.refusal === undefined)) {
            optional.refusal = assistantJob.refusal.reason;
          }

          return optional;
        })(),
        });

    return Object.freeze({
      jobId: assistantJob.jobId,
      commandId: assistantJob.commandId,
      route: assistantJob.route,
      status: assistantJob.status,
      latestProgress: assistantJob.latestProgress,
      progressCount: assistantJob.progressCount,
      terminal,
      ...(() => {
        const optional: DesktopOptionalFields<{ result?: DesktopAssistantJobSnapshot["result"] }> = {};

        if (!(assistantJob.result === undefined)) {
          optional.result = assistantJob.result;
        }

        return optional;
      })(),
      ...(() => {
        const optional: DesktopOptionalFields<{ refusal?: NonNullable<DesktopAssistantJobSnapshot["refusal"]> }> = {};

        if (!(assistantJob.refusal === undefined)) {
          optional.refusal = assistantJob.refusal;
        }

        return optional;
      })(),
    });
  };

  const assistant = <Input>(payload: Input): DesktopBridgeResponse => {
    const op = field(payload, "op");

    if (!isAssistantOp(op)) {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.assistantOpUnknown,
        `Unknown assistant operation ${JSON.stringify(op)}. Known: ${DESKTOP_BRIDGE_ASSISTANT_OPS.join(", ")}.`,
      );
    }

    if (op === "status") {
      return bridgeOk("assistant", assistantSnapshot());
    }

    if (op === "abandon") {
      const acknowledgedJobId = field(payload, "jobId");

      if (!isDesktopText(acknowledgedJobId) || acknowledgedJobId.length === 0) {
        return bridgeRefuse(
          DESKTOP_BRIDGE_REFUSALS.requestMalformed,
          "assistant abandon requires the exact non-empty jobId returned by start.",
        );
      }

      if (assistantJob?.jobId !== acknowledgedJobId) {
        return bridgeRefuse(
          EDITOR_COMMAND_REFUSALS.activeJobMismatch,
          "Cancel refused because the supplied jobId does not identify the exact active assistant command.",
        );
      }

      const result = currentRarityAssistantResult();

      if (
        result !== null &&
        (result.retirement !== undefined ||
          result.authoring?.phase === "applied" ||
          result.authoring?.phase === "rejected")
      ) {
        const acknowledged = assistantSnapshot();
        assistantJob = null;

        return bridgeOk("assistant", acknowledged);
      }

      if (assistantJob.status === "running") {
        assistantJob.status = "refused";
        assistantJob.refusal = Object.freeze({
          ok: false as const,
          reason: DESKTOP_BRIDGE_REFUSALS.assistantAbandoned,
          message: "The unresolved assistant job was abandoned; Retry may start a fresh job.",
          recoverable: true,
        });
      }

      return bridgeOk("assistant", assistantSnapshot());
    }

    const prompt = field(payload, "prompt");
    const profile = field(payload, "profile");
    const route = field(payload, "route");
    const mode = field(payload, "mode");
    const startMode = mode === undefined ? "build" : desktopAssistantStartMode(mode);

    if (startMode === null) {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.assistantBuildModeRequired,
        DESKTOP_ASSISTANT_START_MODE_REFUSAL_MESSAGE,
      );
    }

    if (
      !isDesktopText(prompt) ||
      prompt.trim().length === 0 ||
      !isAssistantProfile(profile) ||
      (route !== "local" && route !== "byo" && route !== "hosted")
    ) {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.requestMalformed,
        "assistant start requires a non-empty prompt, a SceneAxi profile, and route local, byo, or hosted.",
      );
    }

    if (profile === "@sceneaxi/profile-kids") {
      return bridgeRefuse(
        ASSISTANT_SCULPT_REFUSALS.kidsDenied,
        "The desktop assistant is denied for Kids before local generation, BYOK dispatch, or hosted routing.",
      );
    }

    if (route === "hosted" && startMode !== "ask") {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.assistantHostedMeteringUnavailable,
        "Hosted AI is metered through the web-shell assistant panel; the desktop has no identity or credit plane and cannot bypass that gate.",
      );
    }

    const rarityMode = startMode === "agent";
    const askMode = startMode === "ask";

    if (rarityMode && (route !== "local" || options.runRarityProvider === undefined)) {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.rarityProviderUnavailable,
        "The checked-in rarity fixture provider is available only through the local privileged host path.",
      );
    }

    if (!rarityMode && !askMode && route === "byo" && options.runByoAssistant === undefined) {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.assistantByoUnavailable,
        "No BYOK Model Provider Port is configured for this desktop session. Local remains free and available.",
      );
    }

    const currentRarityResult = currentRarityAssistantResult();

    const raritySettlementPending = currentRarityResult !== null &&
      (currentRarityResult.retirement !== undefined ||
        currentRarityResult.authoring?.phase === "applied" ||
        currentRarityResult.authoring?.phase === "rejected");

    if (
      assistantJob?.status === "running" ||
      rarityProposalEvidence !== null ||
      raritySettlementPending
    ) {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.assistantBusy,
        rarityProposalEvidence !== null
          ? "A rarity proposal is still waiting for Accept or Reject; settle it before starting another assistant job."
          : raritySettlementPending
            ? "The settled rarity job has not been acknowledged; read and acknowledge it before starting another assistant job."
            : "An assistant job is already running; poll its status before retrying.",
      );
    }

    let rarityDocument:
      | Readonly<{ documentPath: string; contentHash: string; data: DesktopDocumentData }>
      | undefined;

    if (rarityMode) {
      const read = readActiveDocument(payload, RARITY_DOCUMENT_REFUSALS);

      if (!read.ok) return bridgeRefuse(read.reason, read.message);
      rarityDocument = Object.freeze({
        documentPath: read.status.documentPath,
        contentHash: read.status.contentHash,
        data: read.status.data,
      });
    }

    // Kept so a runner that never dispatches can be rolled back to it. The job
    // has to be installed before the runner is called — a local or streaming
    // runner may report progress synchronously, and `onProgress` only accepts
    // entries for the installed job — so "running" is claimed one call before
    // dispatch is known. Without the rollback that claim is permanent: every
    // later `start` would refuse DESKTOP_ASSISTANT_BUSY for a job that never
    // ran, and the renderer only abandons from its own poll timeout.
    const previousJob = assistantJob;
    assistantSequence += 1;

    const commandId = askMode
      ? "assistant-ask"
      : rarityMode
        ? "assistant-local-agent"
        : route === "byo"
          ? "assistant-byo-build"
          : "assistant-local-build";

    assistantJob = {
      jobId: `desktop-assistant-${String(assistantSequence)}`,
      commandId,
      route: route === "byo" && !askMode ? "byo" : "local",
      status: "running",
      latestProgress: null,
      progressCount: 0,
    };
    const activeJob = assistantJob;

    const onProgress = (snapshot: AssistantSculptProgress): void => {
      if (assistantJob !== activeJob || activeJob.status !== "running") return;
      activeJob.latestProgress = snapshot;
      activeJob.progressCount += 1;
    };

    const trimmedPrompt = prompt.trim();

    const request: DesktopAssistantRunRequest = {
      prompt: rarityMode
        ? trimmedPrompt.slice(0, RARITY_PROVIDER_REQUEST_MAX_CHARS)
        : trimmedPrompt,
      profile,
      onProgress,
    };

    // The one owner of this job's detail policy, for a refusal a runner threw and
    // one it returned alike. Provider-backed work is deliberately detail-free: an
    // upstream error may include request headers or credential material, and only
    // an in-process local run's detail is ours to begin with. The route alone does
    // not answer that — Agent mode dispatches a Model Provider Port under route
    // `local` — so this job's own work decides. The renderer and local bridge get
    // only the named, redacted refusal.
    const detailIsOurs = route === "local" && !rarityMode && !askMode;

    const settleRefusal = (refusal: Readonly<{
      reason: string;
      message: string;
      recoverable: boolean;
      detail?: string;
    }>): void => {
      if (assistantJob !== activeJob || activeJob.status !== "running") return;
      activeJob.status = "refused";
      activeJob.refusal = Object.freeze({
        ok: false as const,
        reason: refusal.reason,
        message: refusal.message,
        recoverable: refusal.recoverable,
        ...(() => {
          const optional: DesktopOptionalFields<{ detail?: string }> = {};

          if (detailIsOurs && refusal.detail !== undefined) {
            optional.detail = refusal.detail;
          }

          return optional;
        })(),
      });
    };

    const settleRuntimeFailure = (cause: unknown): void => {
      const byoRefusal = route === "byo" && cause instanceof DesktopByoRunnerRefusal
        ? cause
        : null;

      settleRefusal({
        reason: byoRefusal?.reason ?? DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed,
        message: byoRefusal?.message ?? "The configured assistant runner failed.",
        recoverable: true,
        detail: cause instanceof Error ? cause.message : String(cause),
      });
    };

    if (askMode) {
      const read = readActiveDocument(
        { documentPath: field(payload, "documentPath") ?? DESKTOP_ACTIVE_DOCUMENT_PATH },
        {
          missingMessage: "Ask requires a documentPath inside the project directory.",
          unreadableReason: ASSISTANT_ASK_REFUSALS.staleVersion,
        },
      );

      if (!read.ok) {
        settleRefusal({
          reason: read.reason,
          message: read.message,
          recoverable: true,
        });

        return bridgeOk("assistant", assistantSnapshot());
      }

      const asked = answerDesktopAssistantAsk({
        documentData: read.status.data,
        sourceContentHash: read.status.contentHash,
        profile,
        prompt: trimmedPrompt,
        scope: field(payload, "scope") ?? "document",
        playActive: playSession !== null,
      });

      if (!asked.ok) {
        settleRefusal({
          reason: asked.reason,
          message: asked.message,
          recoverable: true,
        });

        return bridgeOk("assistant", assistantSnapshot());
      }

      onProgress(Object.freeze({
        phase: "ready",
        percent: 100,
        message: "Ask answered from the explicit project inspection scope.",
      }));
      activeJob.status = "ready";
      activeJob.result = Object.freeze({
        ok: true as const,
        ...asked.answer,
      });

      return bridgeOk("assistant", assistantSnapshot());
    }

    if (rarityMode && rarityDocument !== undefined && options.runRarityProvider !== undefined) {
      onProgress(Object.freeze({
        phase: "waiting-provider",
        percent: 20,
        message:
          "Requesting bounded rarity policy and candidate input from the fixture provider. Your request is carried to the provider, but the checked-in fixture answers the same bounded input whatever it says.",
      }));

      const stageRarity = (contribution: RarityProviderContributionResult): void => {
        if (assistantJob !== activeJob || activeJob.status !== "running") return;

        if (!contribution.ok) {
          settleRefusal({
            reason: contribution.reason,
            message: contribution.message,
            recoverable: true,
          });

          return;
        }

        onProgress(Object.freeze({
          phase: "validating-artifact",
          percent: 70,
          message: "Validating canonical rarity bytes and authoritative kernel resolution.",
        }));
        const current = authoringSession().status(rarityDocument.documentPath);

        if (!current.ok || current.contentHash !== rarityDocument.contentHash) {
          settleRefusal({
            reason: "content-hash-conflict",
            message: "The Scene Document changed while rarity input was being prepared; reopen and retry.",
            recoverable: true,
          });

          return;
        }

        const staged = stageRarityProviderProposal({
          documentData: current.data,
          documentPath: rarityDocument.documentPath,
          expectedContentHash: rarityDocument.contentHash,
          profile,
          eventId: DESKTOP_RARITY_EVENT_ID,
          contribution: contribution.value,
          resolve: resolveRarityWithKernel,
        });

        if (!staged.ok) {
          settleRefusal({
            reason: staged.reason,
            message: staged.message,
            recoverable: true,
          });

          return;
        }

        if (staged.replayed) {
          onProgress(Object.freeze({
            phase: "ready",
            percent: 100,
            message: "The identical rarity event replayed without changing project bytes.",
          }));
          activeJob.status = "ready";
          activeJob.result = Object.freeze({
            ok: true as const,
            kind: "rarity-proposal" as const,
            replayed: true as const,
            providerClass: "fixture" as const,
            evidence: staged.evidence,
          });

          return;
        }

        const snapshot = authoringSession().proposeEdit(staged.edit);

        if (snapshot.phase !== "reviewing" || (snapshot.diagnostics?.length ?? 0) > 0) {
          const diagnostic = snapshot.diagnostics?.[0];
          settleRefusal({
            reason: diagnostic?.code ?? "RARITY_PROPOSAL_NOT_REVIEWING",
            message: diagnostic?.message ?? "The rarity proposal did not reach Change Review.",
            recoverable: true,
          });

          return;
        }

        rarityProposalEvidence = staged.evidence;
        onProgress(Object.freeze({
          phase: "ready",
          percent: 100,
          message: "The canonical rarity proposal is waiting in Change Review.",
        }));
        activeJob.status = "ready";
        activeJob.result = Object.freeze({
          ok: true as const,
          kind: "rarity-proposal" as const,
          replayed: false as const,
          providerClass: "fixture" as const,
          evidence: staged.evidence,
          authoring: Object.freeze({ ...snapshot, rarityEvidence: staged.evidence }),
        });
      };

      try {
        void options.runRarityProvider({ profile, prompt: request.prompt })
          .then(stageRarity)
          .catch(settleRuntimeFailure);
      } catch (cause) {
        settleRuntimeFailure(cause);
      }

      return bridgeOk("assistant", assistantSnapshot());
    }

    let running: Promise<AssistantSculptResult> | undefined;

    try {
      running = route === "local"
        ? (options.runLocalAssistant ?? ((local: DesktopAssistantRunRequest) => runAssistantSculptAction({ ...local, route: "local" })) )({
            prompt: request.prompt,
            profile: request.profile,
            onProgress,
          })
        : options.runByoAssistant?.(request);
    } catch (cause) {
      settleRuntimeFailure(cause);

      return bridgeOk("assistant", assistantSnapshot());
    }

    if (running === undefined) {
      assistantJob = previousJob;

      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.assistantByoUnavailable,
        "No BYOK Model Provider Port dispatched this desktop assistant job, so no work started. Local remains free and available.",
      );
    }

    void running.then(
      (result) => {
        if (assistantJob !== activeJob || activeJob.status !== "running") return;

        if (result.ok) {
          if (isFixtureProviderDescriptor(result.providerEvidence?.model ?? {})) {
            settleRefusal({
              reason: ASSISTANT_ASK_REFUSALS.fixtureNotCloud,
              message: "The checked-in rarity fixture cannot stand in for a configured cloud provider.",
              recoverable: false,
            });

            return;
          }

          const providerModel = result.providerEvidence?.model;
          lastReadyBuild = Object.freeze({
            buildId: activeJob.jobId,
            artifactDigest: result.artifactDigest,
            providerClass: result.route === "byo" ? "configured" as const : "none" as const,
            model: providerModel?.model ?? "sceneaxi-local-compiler",
            provider: providerModel?.provider ?? "sceneaxi-local",
            version: providerModel?.version ?? "local",
            fallbackPolicy: "none" as const,
          });
          lastReadyArtifact = result.artifact;
          activeJob.status = "ready";
          activeJob.result = Object.freeze({
            ok: true as const,
            route: result.route,
            artifactBytes: result.artifactBytes,
            artifactDigest: result.artifactDigest,
            inspection: result.inspection,
            mountable: desktopAssistantScene(result.artifact),
            providerClass: lastReadyBuild.providerClass === "configured" ? "configured" as const : "none" as const,
            fallbackPolicy: "none" as const,
            ...(() => {
              const optional: DesktopOptionalFields<{ providerEvidence?: ModelProviderCallEvidence }> = {};

              if (!(result.providerEvidence === undefined)) {
                optional.providerEvidence = result.providerEvidence;
              }

              return optional;
            })(),
          });
        } else {
          settleRefusal(result);
        }
      },
      settleRuntimeFailure,
    );

    return bridgeOk("assistant", assistantSnapshot());
  };

  const commandTransaction = (
    commandId: EditorCommandId,
    response: DesktopBridgeResponse,
  ): DesktopBridgeResponse => {
    if (!response.ok) {
      return Object.freeze({
        ...response,
        transaction: editorCommandTransactionResult({
          commandId,
          status: "refused",
          phase: "refused",
          percent: 100,
          message: response.message,
          terminal: true,
          refusal: response.reason,
        }),
      });
    }

    const data = response.data;
    const transactionId = field(data, "transactionId");
    const recoveryPending = field(data, "journalRecoveryPending") === true;
    const diagnostics = field(data, "diagnostics");
    const firstDiagnostic = Array.isArray(diagnostics) ? diagnostics[0] : undefined;
    const diagnosticCode = field(firstDiagnostic, "code");
    const responseReason = field(data, "reason");

    const refusal = isDesktopText(responseReason)
      ? responseReason
      : diagnosticCode === "content-hash-conflict"
        ? EDITOR_COMMAND_REFUSALS.staleBase
        : diagnosticCode === "invalid-transaction-phase"
          ? EDITOR_COMMAND_REFUSALS.invalidPhase
          : diagnosticCode;

    const refused = isDesktopText(refusal);
    const phase = field(data, "phase");
    const reviewing = !refused && phase === "reviewing";
    const appliedPaths = field(data, "appliedPaths");
    const restoredPaths = field(data, "restoredPaths");
    const proposal = field(data, "proposal");
    const proposalEdits = field(proposal, "edits");

    const documentPaths = Array.isArray(appliedPaths)
      ? appliedPaths.filter((value): value is string => isDesktopText(value))
      : Array.isArray(restoredPaths)
        ? restoredPaths.filter((value): value is string => isDesktopText(value))
        : Array.isArray(proposalEdits)
          ? proposalEdits
              .map((edit) => field(edit, "documentPath"))
              .filter((value): value is string => isDesktopText(value))
          : [];

    const transaction = editorCommandTransactionResult({
      commandId,
      ...(() => {
        const optional: DesktopOptionalFields<{ transactionId?: string }> = {};

        if (isDesktopText(transactionId)) {
          optional.transactionId = transactionId;
        }

        return optional;
      })(),
      status: refused
        ? "refused"
        : reviewing
          ? "reviewing"
          : recoveryPending
            ? "recovery-pending"
            : "completed",
      phase: refused
        ? "refused"
        : reviewing
          ? "reviewing"
          : recoveryPending
            ? "recovering"
            : "completed",
      percent: reviewing ? 50 : recoveryPending ? 75 : 100,
      message: refused
        ? String(field(firstDiagnostic, "message") ?? "The transaction was refused.")
        : reviewing
          ? "The registered command staged a reviewable hierarchy transaction."
          : recoveryPending
            ? "Canonical bytes are durable; journal finalization is pending."
            : "The registered command transaction completed.",
      terminal: !reviewing && !recoveryPending,
      documentPaths,
      ...(() => {
        const optional: DesktopOptionalFields<{ refusal?: string }> = {};

        if (isDesktopText(refusal)) {
          optional.refusal = refusal;
        }

        return optional;
      })(),
    });

    return bridgeOk("command", Object.freeze({
      ...(isDesktopObject(data) && data !== null ? data : { value: data }),
      transaction,
    }));
  };

  const command = <Input>(payload: Input): DesktopBridgeResponse => {
    const validated = validateEditorCommandInvocation(payload);

    if (!validated.ok) {
      const declared = editorCommand(field(payload, "commandId"));
      const hierarchyCommand = declared?.id.startsWith("scene-") === true;
      const rawInput = field(payload, "input");
      const rawPolicy = field(rawInput, "transformPolicy");

      const policyProbe = declared?.id === "scene-object-reparent" &&
          hasExactFields(payload, ["schemaVersion", "commandId", "client", "permission", "profile", "input"]) &&
          hasExactFields(rawInput, [
            "documentPath",
            "expectedContentHash",
            "profile",
            "instanceId",
            "parentInstanceId",
            "transformPolicy",
          ])
        ? validateEditorCommandInvocation({
            schemaVersion: field(payload, "schemaVersion"),
            commandId: field(payload, "commandId"),
            client: field(payload, "client"),
            permission: field(payload, "permission"),
            profile: field(payload, "profile"),
            input: {
              documentPath: field(rawInput, "documentPath"),
              expectedContentHash: field(rawInput, "expectedContentHash"),
              profile: field(rawInput, "profile"),
              instanceId: field(rawInput, "instanceId"),
              parentInstanceId: field(rawInput, "parentInstanceId"),
              transformPolicy: "preserve-local",
            },
          })
        : null;

      const policyOnlyInvalid =
        validated.reason === DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported &&
        policyProbe?.ok === true &&
        !isDesktopSceneReparentPolicy(rawPolicy);

      const mappedReason = hierarchyCommand && validated.reason === EDITOR_COMMAND_REFUSALS.kidsDenied
        ? DESKTOP_SCENE_HIERARCHY_REFUSALS.kidsDenied
        : policyOnlyInvalid
          ? DESKTOP_SCENE_HIERARCHY_REFUSALS.policyInvalid
          : hierarchyCommand && validated.reason === EDITOR_COMMAND_REFUSALS.inputInvalid
            ? DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported
            : validated.reason;

      const transaction = declared === undefined
        ? undefined
        : editorCommandTransactionResult({
            commandId: declared.id,
            status: "refused",
            phase: "refused",
            percent: 100,
            message: validated.message,
            terminal: true,
            refusal: mappedReason,
          });

      return bridgeRefuse(mappedReason, validated.message, null, transaction);
    }

    if (activeCommandProfile === "kids" || validated.invocation.profile === "kids") {
      const reason = validated.command.id.startsWith("scene-")
        ? DESKTOP_SCENE_HIERARCHY_REFUSALS.kidsDenied
        : EDITOR_COMMAND_REFUSALS.kidsDenied;

      return commandTransaction(validated.command.id, bridgeRefuse(
        reason,
        `${validated.command.id} is denied for Kids before execution.`,
      ));
    }

    const hierarchyCommand = validated.command.id.startsWith("scene-");
    const hierarchyInputProfile = field(validated.invocation.input, "profile");

    if (
      hierarchyCommand &&
      options.commandProfile !== undefined &&
      options.commandProfile !== hierarchyInputProfile
    ) {
      return commandTransaction(validated.command.id, bridgeRefuse(
        DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
        `${validated.command.id} cannot override the active ${options.commandProfile} profile.`,
      ));
    }

    const capabilityMissing = hierarchyCommand
      ? options.commandCapabilities?.includes(validated.command.capability.id) !== true
      : options.commandCapabilities !== undefined &&
        !options.commandCapabilities.includes(validated.command.capability.id);

    if (capabilityMissing) {
      const reason = hierarchyCommand
        ? DESKTOP_SCENE_HIERARCHY_REFUSALS.capabilityMissing
        : EDITOR_COMMAND_REFUSALS.capabilityDenied;

      return commandTransaction(validated.command.id, bridgeRefuse(
        reason,
        `${validated.command.id} requires missing capability ${validated.command.capability.id}.`,
      ));
    }

    const input = validated.invocation.input;

    switch (validated.command.id) {
      case "project-new":
      case "project-open":
        return bridgeRefuse(
          EDITOR_COMMAND_REFUSALS.capabilityDenied,
          `${validated.command.id} requires the native project lifecycle host rather than the engine bridge.`,
        );
      case "project-inspect": {
        const inspected = inspectProjectModel(options.cwd);

        return inspected.ok
          ? bridgeOk("command", inspected.inspection)
          : bridgeRefuse(inspected.diagnostic.code, inspected.diagnostic.message, inspected.diagnostic.path);
      }

      case "project-migration-propose": {
        const proposed = proposeProjectMigration(options.cwd);

        return proposed.ok
          ? bridgeOk("command", proposed)
          : bridgeRefuse(proposed.diagnostic.code, proposed.diagnostic.message, proposed.diagnostic.path);
      }

      case "project-migration-commit": {
        authoringSession();

        const committed = commitProjectMigration({
          root: options.cwd,
          approved: input["approved"] === true,
          proposalDigest: String(input["proposalDigest"]),
        });

        return committed.ok
          ? bridgeOk("command", committed)
          : bridgeRefuse(committed.diagnostic.code, committed.diagnostic.message, committed.diagnostic.path);
      }

      case "project-migration-recover": {
        authoringSession();
        const recovered = recoverProjectMigration(options.cwd);

        return recovered.ok
          ? bridgeOk("command", recovered)
          : bridgeRefuse(recovered.diagnostic.code, recovered.diagnostic.message, recovered.diagnostic.path);
      }

      case "project-git-status":
      case "project-git-diff": {
        const inspected = inspectProjectGit(
          { root: options.cwd, profile: activeCommandProfile },
          validated.command.id === "project-git-diff" ? "diff" : "status",
        );

        return inspected.ok
          ? bridgeOk("command", inspected.state)
          : bridgeRefuse(inspected.diagnostic.code, inspected.diagnostic.message, inspected.diagnostic.path);
      }

      case "project-git-stage": {
        // SAFETY: validateEditorCommandInvocation above accepted this command and its schema-checked input fields; the registry fixes these enum, tuple, and path contracts.
        const staged = stageDesktopSessionProjectGitPaths(
          authoringSession(),
          input["paths"] as readonly string[],
        );

        return staged.ok
          ? bridgeOk("command", staged.state)
          : bridgeRefuse(staged.diagnostic.code, staged.diagnostic.message, staged.diagnostic.path);
      }

      case "project-git-commit-prepare": {
        // SAFETY: validateEditorCommandInvocation above accepted this command and its schema-checked input fields; the registry fixes these enum, tuple, and path contracts.
        const prepared = prepareDesktopSessionProjectGitCommit(
          authoringSession(),
          input["paths"] as readonly string[],
          String(input["message"]),
        );

        return prepared.ok
          ? bridgeOk("command", prepared.preparation)
          : bridgeRefuse(prepared.diagnostic.code, prepared.diagnostic.message, prepared.diagnostic.path);
      }

      case "input-actions-inspect": {
        const inspected = options.inputActions?.inspect();

        if (inspected === undefined) {
          return bridgeRefuse(
            EDITOR_COMMAND_REFUSALS.capabilityDenied,
            "The input-action settings host is unavailable.",
          );
        }

        return inspected.ok
          ? bridgeOk("command", inspected.data)
          : bridgeRefuse(inspected.reason, inspected.message, inspected.detail);
      }

      case "input-action-rebind": {
        // SAFETY: validateEditorCommandInvocation above accepted this command and its schema-checked input fields; the registry fixes these enum, tuple, and path contracts.
        const rebound = options.inputActions?.rebind({
          scope: input["scope"] as "workspace" | "project",
          expectedBaseVersion: String(input["expectedBaseVersion"]),
          actionId: input["actionId"],
          binding: input["binding"],
          approved: input["approved"] === true,
          reviewDigest: isDesktopText(input["reviewDigest"]) ? input["reviewDigest"] : null,
        });

        if (rebound === undefined) {
          return bridgeRefuse(
            EDITOR_COMMAND_REFUSALS.capabilityDenied,
            "The input-action settings host is unavailable.",
          );
        }

        return rebound.ok
          ? bridgeOk("command", rebound.data)
          : bridgeRefuse(rebound.reason, rebound.message, rebound.detail);
      }

      case "input-actions-reset": {
        // SAFETY: validateEditorCommandInvocation above accepted this command and its schema-checked input fields; the registry fixes these enum, tuple, and path contracts.
        const reset = options.inputActions?.reset({
          scope: input["scope"] as "workspace" | "project",
          expectedBaseVersion: String(input["expectedBaseVersion"]),
          approved: input["approved"] === true,
          reviewDigest: isDesktopText(input["reviewDigest"]) ? input["reviewDigest"] : null,
        });

        if (reset === undefined) {
          return bridgeRefuse(
            EDITOR_COMMAND_REFUSALS.capabilityDenied,
            "The input-action settings host is unavailable.",
          );
        }

        return reset.ok
          ? bridgeOk("command", reset.data)
          : bridgeRefuse(reset.reason, reset.message, reset.detail);
      }

      case "ship-export-web":
        return ship({
          op: "export-web",
          documentPath: input["documentPath"],
          expectedContentHash: input["expectedContentHash"],
        });
      case "project-save":
      case "change-review-accept":
        return commandTransaction(validated.command.id, authoring({ op: "accept" }));
      case "change-review-reject":
        return authoring({ op: "reject" });
      case "edit-undo":
        return commandTransaction(validated.command.id, authoring({ op: "undo" }));
      case "edit-redo":
        return commandTransaction(validated.command.id, authoring({ op: "redo" }));
      case "scene-hierarchy-inspect": {
        const documentPath = input["documentPath"];

        const read = readActiveDocument(
          { documentPath },
          SCENE_DOCUMENT_REFUSALS,
        );

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        const inspected = selectedSceneInstanceIds.length === 0
          ? inspectDesktopSceneProperties({
              documentData: read.status.data,
              contentHash: read.status.contentHash,
              documentPath: String(documentPath),
            })
          : currentSceneSelection(
              read.status.data,
              read.status.contentHash,
              String(documentPath),
            );

        if (inspected === null) {
          return bridgeRefuse(
            DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
            "The scene hierarchy inspection could not resolve a current selection.",
          );
        }

        if (inspected.ok && !sceneSelectionStale) {
          selectedSceneInstanceIds = inspected.selection.instanceIds;
        }

        return bridgeOk("command", Object.freeze({
          ...inspected,
          authoringSnapshot: withRarityProposalEvidence(authoringSession().snapshot()),
        }));
      }

      case "scene-selection-set": {
        const documentPath = input["documentPath"];

        const read = readActiveDocument(
          { documentPath },
          SCENE_DOCUMENT_REFUSALS,
        );

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        const inspected = inspectDesktopSceneProperties({
          documentData: read.status.data,
          contentHash: read.status.contentHash,
          documentPath: String(documentPath),
          selection: input["instanceIds"],
        });

        if (!inspected.ok) {
          const diagnostic = inspected.diagnostics[0];

          return bridgeRefuse(
            inspected.reason ?? diagnostic?.code ?? DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
            diagnostic?.message ?? "The ordered scene selection was refused.",
          );
        }

        selectedSceneInstanceIds = inspected.selection.instanceIds;
        sceneSelectionStale = false;
        pendingSceneSelection = null;

        return bridgeOk("command", inspected);
      }

      case "scene-property-set": {
        const staged = authoring({
          op: "edit-property",
          documentPath: input["documentPath"],
          expectedContentHash: input["expectedContentHash"],
          profile: input["profile"],
          entityId: input["instanceId"],
          propertyId: input["propertyId"],
          newValue: input["newValue"],
        }, true);

        if (!staged.ok) return commandTransaction(validated.command.id, staged);

        if (field(staged.data, "ok") === false) {
          if (isDesktopText(field(staged.data, "reason"))) {
            return commandTransaction(
              validated.command.id,
              bridgeOk("command", staged.data),
            );
          }

          const diagnostics = field(staged.data, "diagnostics");
          const diagnostic = Array.isArray(diagnostics) ? diagnostics[0] : undefined;

          return commandTransaction(
            validated.command.id,
            bridgeRefuse(
              DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
              String(field(diagnostic, "message") ?? "The scene property command was refused before review."),
            ),
          );
        }

        return commandTransaction(
          validated.command.id,
          bridgeOk("command", staged.data),
        );
      }

      case "scene-transform-apply": {
        const documentPath = input["documentPath"];

        const read = readActiveDocument(
          { documentPath },
          SCENE_DOCUMENT_REFUSALS,
        );

        if (!read.ok) return commandTransaction(validated.command.id, bridgeRefuse(read.reason, read.message));

        const inspected = inspectDesktopSceneProperties({
          documentData: read.status.data,
          contentHash: read.status.contentHash,
          documentPath: String(documentPath),
          selection: input["instanceIds"],
        });

        if (!inspected.ok) {
          const diagnostic = inspected.diagnostics[0];

          return commandTransaction(
            validated.command.id,
            bridgeRefuse(
              inspected.reason ?? diagnostic?.code ?? DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
              diagnostic?.message ?? "The transform selection was refused.",
            ),
          );
        }

        // SAFETY: validateEditorCommandInvocation above accepted this command and its schema-checked input fields; the registry fixes these enum, tuple, and path contracts.
        const resolved = resolveDesktopSceneTransform({
          instanceIds: inspected.selection.instanceIds,
          instances: inspected.entities.map((entity) => Object.freeze({
            instanceId: entity.id,
            local: Object.freeze({
              translation: entity.localTransform.translation,
              rotationEulerDegrees: entity.localTransform.rotationEulerDegrees,
              scale: entity.localTransform.scale,
            }),
            world: Object.freeze({
              translation: entity.worldTransform.translation,
            }),
          })),
          mode: input["mode"] as "translate" | "rotate" | "scale",
          space: input["space"] as "local" | "world",
          pivot: input["pivot"] as "individual" | "selection" | "origin",
          axes: input["axes"] as "x" | "y" | "z" | "xy" | "xz" | "yz" | "xyz",
          snapIncrement: input["snapIncrement"] as number | null,
          valueKind: input["valueKind"] as "absolute" | "delta",
          values: input["values"] as readonly [number, number, number],
        });

        if (!resolved.ok) {
          return commandTransaction(
            validated.command.id,
            bridgeRefuse(resolved.reason, resolved.message),
          );
        }

        const staged = authoring({
          op: "edit-scene",
          documentPath,
          expectedContentHash: input["expectedContentHash"],
          profile: input["profile"],
          operation: {
            kind: "apply-transform",
            instanceIds: resolved.affectedIds,
            components: resolved.components,
          },
        }, true);

        if (!staged.ok) return commandTransaction(validated.command.id, staged);

        if (field(staged.data, "ok") === false) {
          const diagnostics = field(staged.data, "diagnostics");
          const diagnostic = Array.isArray(diagnostics) ? diagnostics[0] : undefined;

          return commandTransaction(
            validated.command.id,
            bridgeRefuse(
              String(field(staged.data, "reason") ?? DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported),
              String(field(diagnostic, "message") ?? "The transform command was refused before review."),
            ),
          );
        }

        if (!isDesktopObject(staged.data) || staged.data === null) {
          return bridgeRefuse(DESKTOP_BRIDGE_REFUSALS.requestMalformed, "The staged transform returned no authoring snapshot.");
        }

        return commandTransaction(
          validated.command.id,
          bridgeOk("command", {
            ...staged.data,
            affectedIds: resolved.affectedIds,
            components: resolved.components,
          }),
        );
      }

      case "scene-prefab-inspect": {
        const documentPath = input["documentPath"];
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        return bridgeOk("command", inspectDesktopScenePrefabs(read.status.data));
      }

      case "scene-prefab-define":
      case "scene-prefab-instance":
      case "scene-prefab-override":
      case "scene-prefab-refresh": {
        const documentPath = String(input["documentPath"]);
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        // SAFETY: validateEditorCommandInvocation above accepted this command and its schema-checked input fields; the registry fixes these enum, tuple, and path contracts.
        const operation = validated.command.id === "scene-prefab-define"
          ? {
              kind: "define" as const,
              definitionId: String(input["definitionId"]),
              instanceIds: input["instanceIds"] as readonly string[],
            }
          : validated.command.id === "scene-prefab-instance"
            ? {
                kind: "instance" as const,
                definitionId: String(input["definitionId"]),
                parentInstanceId: String(input["parentInstanceId"]),
                instanceKey: String(input["instanceKey"]),
              }
            : validated.command.id === "scene-prefab-override"
              ? {
                  kind: "override" as const,
                  instanceId: String(input["instanceId"]),
                  sourceInstanceId: String(input["sourceInstanceId"]),
                  propertyId: String(input["propertyId"]),
                  value: Number(input["newValue"]),
                }
              : {
                  kind: "refresh" as const,
                  definitionId: String(input["definitionId"]),
                };

        const staged = stageDesktopScenePrefab({
          documentData: read.status.data,
          contentHash: String(input["expectedContentHash"]),
          documentPath,
          operation,
        });

        if (!staged.ok) {
          return commandTransaction(
            validated.command.id,
            bridgeRefuse(staged.reason, staged.message),
          );
        }

        const proposed = reconcilePendingAssetImport(authoringSession().proposeEdit({
          documentPath,
          jsonPointer: "/data",
          expectedContentHash: String(input["expectedContentHash"]),
          newValue: staged.documentData,
        }));

        return commandTransaction(validated.command.id, bridgeOk("command", {
          ...staged.inspection,
          authoringSnapshot: proposed,
        }));
      }

      case "scene-object-create":
      case "scene-object-remove":
      case "scene-object-reparent": {
        const operation = validated.command.id === "scene-object-create"
          ? {
              kind: "create-object",
              sourceInstanceId: input["sourceInstanceId"],
              parentInstanceId: input["parentInstanceId"],
            }
          : validated.command.id === "scene-object-remove"
            ? { kind: "remove-objects", instanceIds: input["instanceIds"] }
            : {
                kind: "reparent-object",
                instanceId: input["instanceId"],
                parentInstanceId: input["parentInstanceId"],
                transformPolicy: input["transformPolicy"],
              };

        const staged = authoring({
          op: "edit-scene",
          documentPath: input["documentPath"],
          expectedContentHash: input["expectedContentHash"],
          profile: input["profile"],
          operation,
        }, true);

        if (!staged.ok) return commandTransaction(validated.command.id, staged);

        if (field(staged.data, "ok") === false) {
          if (field(staged.data, "reason") === DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale) {
            return commandTransaction(
              validated.command.id,
              bridgeOk("command", staged.data),
            );
          }

          const diagnostics = field(staged.data, "diagnostics");
          const diagnostic = Array.isArray(diagnostics) ? diagnostics[0] : undefined;

          return commandTransaction(
            validated.command.id,
            bridgeRefuse(
              String(field(staged.data, "reason") ?? field(diagnostic, "code") ?? DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported),
              String(field(diagnostic, "message") ?? "The hierarchy command was refused before review."),
            ),
          );
        }

        return commandTransaction(
          validated.command.id,
          bridgeOk("command", staged.data),
        );
      }

      case "run-play": {
        const documentPath = String(input["documentPath"] ?? DESKTOP_ACTIVE_DOCUMENT_PATH);
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        // SAFETY: readActiveDocument returned the authoring owner's parsed canonical document data; successful document validation establishes a JSON object.
        const started = startPlaySession({
          sourceDocumentPath: documentPath,
          sourceContentHash: read.status.contentHash,
          document: read.status.data as JsonObject,
        });

        if (!started.ok) return bridgeRefuse(started.reason, started.message);
        const exercised = openPathExercise({ documentPath });

        if (!exercised.ok) return exercised;
        playSession = started.session;

        return bridgeOk("command", Object.freeze({
          ...(() => {
            const optional: DesktopOptionalFields<DesktopBoundaryObject> = {};

            if (isDesktopObject(exercised.data) && exercised.data !== null) {
              Object.assign(optional, exercised.data);
            }

            return optional;
          })(),
          playSession: started.session,
        }));
      }

      case "run-stop": {
        const stopped = stopPlaySession(playSession);

        if (!stopped.ok) return bridgeRefuse(stopped.reason, stopped.message);
        playSession = stopped.session;

        return bridgeOk("command", stopped.session);
      }

      case "run-reset": {
        if (playSession === null) {
          return bridgeRefuse("PLAY_SESSION_MISSING", "No Play session is active.");
        }

        const read = readActiveDocument(
          { documentPath: playSession.sourceDocumentPath },
          SCENE_DOCUMENT_REFUSALS,
        );

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        if (read.status.contentHash !== playSession.sourceContentHash) {
          return bridgeRefuse(
            "PLAY_SESSION_SOURCE_HASH_MISMATCH",
            "Reset uses the recorded source version; authoring bytes changed after Play started.",
          );
        }

        // SAFETY: readActiveDocument returned the authoring owner's parsed canonical document data; successful document validation establishes a JSON object.
        const reset = resetPlaySession(playSession, read.status.data as JsonObject);

        if (!reset.ok) return bridgeRefuse(reset.reason, reset.message);
        playSession = reset.session;

        return bridgeOk("command", reset.session);
      }

      case "play-inspect":
        if (playSession === null) {
          return bridgeRefuse("PLAY_SESSION_MISSING", "No Play session is active.");
        }

        return bridgeOk("command", playSession);
      case "viewport-source-set": {
        const switched = setPlayViewportSource(playSession, String(input["source"]));

        if (!switched.ok) return bridgeRefuse(switched.reason, switched.message);
        playSession = switched.session;

        return bridgeOk("command", switched.session);
      }

      case "animation-inspect": {
        const documentPath = input["documentPath"];
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        return bridgeOk("command", inspectDesktopSceneAnimation(read.status.data));
      }

      case "animation-apply": {
        const documentPath = String(input["documentPath"]);
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        const staged = stageDesktopSceneAnimation({
          documentData: read.status.data,
          contentHash: String(input["expectedContentHash"]),
          documentPath,
          mutation: input["mutation"],
        });

        if (!staged.ok) {
          return commandTransaction(validated.command.id, bridgeRefuse(staged.reason, staged.message));
        }

        const proposed = reconcilePendingAssetImport(authoringSession().proposeEdit({
          documentPath,
          jsonPointer: "/data",
          expectedContentHash: String(input["expectedContentHash"]),
          newValue: staged.documentData,
        }));

        return commandTransaction(validated.command.id, bridgeOk("command", {
          ...staged.inspection,
          authoringSnapshot: proposed,
        }));
      }

      case "animation-scrub":
      case "animation-evaluate": {
        const documentPath = String(input["documentPath"]);
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        if (read.status.contentHash !== String(input["expectedContentHash"])) {
          return bridgeRefuse(
            "ANIMATION_STALE_VERSION",
            "Scrub and Play evaluation name the exact project version being previewed.",
          );
        }

        const evaluated = evaluateDesktopSceneAnimation({
          documentData: read.status.data,
          sourceContentHash: read.status.contentHash,
          timeMs: Number(input["timeMs"]),
          requireBoundAsset: validated.command.id === "animation-evaluate" && input["requireBoundAsset"] === true,
        });

        if (!evaluated.ok) return bridgeRefuse(evaluated.reason, evaluated.message);

        return bridgeOk("command", evaluated.evaluation);
      }

      case "physics-inspect": {
        const documentPath = input["documentPath"];
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        return bridgeOk("command", inspectDesktopScenePhysics(read.status.data));
      }

      case "physics-apply": {
        const documentPath = String(input["documentPath"]);
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        const staged = stageDesktopScenePhysics({
          documentData: read.status.data,
          contentHash: String(input["expectedContentHash"]),
          documentPath,
          mutation: input["mutation"],
        });

        if (!staged.ok) {
          return commandTransaction(validated.command.id, bridgeRefuse(staged.reason, staged.message));
        }

        const proposed = reconcilePendingAssetImport(authoringSession().proposeEdit({
          documentPath,
          jsonPointer: "/data",
          expectedContentHash: String(input["expectedContentHash"]),
          newValue: staged.documentData,
        }));

        return commandTransaction(validated.command.id, bridgeOk("command", {
          ...staged.inspection,
          authoringSnapshot: proposed,
        }));
      }

      case "physics-evaluate": {
        const documentPath = String(input["documentPath"]);
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        if (read.status.contentHash !== String(input["expectedContentHash"])) {
          return bridgeRefuse("PHYSICS_STALE_VERSION", "Physics replay names the exact project version being evaluated.");
        }

        const evaluated = evaluateDesktopScenePhysics({
          documentData: read.status.data,
          sourceContentHash: read.status.contentHash,
          steps: Number(input["steps"]),
          ...(() => {
            const optional: DesktopOptionalFields<{ physicsWorldHost?: PhysicsWorldHost }> = {};

            if (!(options.physicsWorldHost === undefined)) {
              optional.physicsWorldHost = options.physicsWorldHost;
            }

            return optional;
          })(),
          ...(() => {
            const optional: DesktopOptionalFields<{ animationOffsetY?: number }> = {};

            if (isDesktopNumber(input["animationOffsetY"])) {
              optional.animationOffsetY = input["animationOffsetY"];
            }

            return optional;
          })(),
        });

        if (!evaluated.ok) return bridgeRefuse(evaluated.reason, evaluated.message);

        return bridgeOk("command", evaluated.evaluation);
      }

      case "environment-inspect": {
        const documentPath = input["documentPath"];
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        return bridgeOk("command", inspectDesktopSceneEnvironment(read.status.data));
      }

      case "environment-apply": {
        const documentPath = String(input["documentPath"]);
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        const staged = stageDesktopSceneEnvironment({
          documentData: read.status.data,
          contentHash: String(input["expectedContentHash"]),
          documentPath,
          mutation: input["mutation"],
        });

        if (!staged.ok) {
          return commandTransaction(validated.command.id, bridgeRefuse(staged.reason, staged.message));
        }

        const proposed = reconcilePendingAssetImport(authoringSession().proposeEdit({
          documentPath,
          jsonPointer: "/data",
          expectedContentHash: String(input["expectedContentHash"]),
          newValue: staged.documentData,
        }));

        return commandTransaction(validated.command.id, bridgeOk("command", {
          ...staged.inspection,
          authoringSnapshot: proposed,
        }));
      }

      case "material-inspect": {
        const documentPath = input["documentPath"];
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        return bridgeOk("command", inspectDesktopSceneMaterials(read.status.data));
      }

      case "material-apply": {
        const documentPath = String(input["documentPath"]);
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        const staged = stageDesktopSceneMaterials({
          documentData: read.status.data,
          contentHash: String(input["expectedContentHash"]),
          documentPath,
          mutation: input["mutation"],
        });

        if (!staged.ok) {
          return commandTransaction(validated.command.id, bridgeRefuse(staged.reason, staged.message));
        }

        const proposed = reconcilePendingAssetImport(authoringSession().proposeEdit({
          documentPath,
          jsonPointer: "/data",
          expectedContentHash: String(input["expectedContentHash"]),
          newValue: staged.documentData,
        }));

        return commandTransaction(validated.command.id, bridgeOk("command", {
          ...staged.inspection,
          authoringSnapshot: proposed,
        }));
      }

      case "effect-inspect": {
        const documentPath = input["documentPath"];
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        return bridgeOk("command", inspectDesktopSceneEffects(read.status.data));
      }

      case "effect-apply": {
        const documentPath = String(input["documentPath"]);
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        const staged = stageDesktopSceneEffects({
          documentData: read.status.data,
          contentHash: String(input["expectedContentHash"]),
          documentPath,
          mutation: input["mutation"],
        });

        if (!staged.ok) {
          return commandTransaction(validated.command.id, bridgeRefuse(staged.reason, staged.message));
        }

        const proposed = reconcilePendingAssetImport(authoringSession().proposeEdit({
          documentPath,
          jsonPointer: "/data",
          expectedContentHash: String(input["expectedContentHash"]),
          newValue: staged.documentData,
        }));

        return commandTransaction(validated.command.id, bridgeOk("command", {
          ...staged.inspection,
          authoringSnapshot: proposed,
        }));
      }

      case "package-inspect": {
        const documentPath = input["documentPath"];
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        return bridgeOk("command", inspectDesktopScenePackages(read.status.data));
      }

      case "package-install": {
        const documentPath = String(input["documentPath"]);
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        const discovered = discoverDesktopScenePackage({
          locator: String(input["locator"]),
          manifest: input["manifest"],
          digest: String(input["digest"]),
        });

        if (!discovered.ok) {
          return commandTransaction(validated.command.id, bridgeRefuse(discovered.reason, discovered.message));
        }

        const staged = stageDesktopScenePackage({
          documentData: read.status.data,
          contentHash: String(input["expectedContentHash"]),
          documentPath,
          profile: input["profile"],
          mutation: { kind: "install", discovery: discovered.discovery },
        });

        if (!staged.ok) {
          return commandTransaction(validated.command.id, bridgeRefuse(staged.reason, staged.message));
        }

        const proposed = reconcilePendingAssetImport(authoringSession().proposeEdit({
          documentPath,
          jsonPointer: "/data",
          expectedContentHash: String(input["expectedContentHash"]),
          newValue: staged.documentData,
        }));

        return commandTransaction(validated.command.id, bridgeOk("command", {
          ...staged.inspection,
          authoringSnapshot: proposed,
        }));
      }

      case "package-remove": {
        const documentPath = String(input["documentPath"]);
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        const staged = stageDesktopScenePackage({
          documentData: read.status.data,
          contentHash: String(input["expectedContentHash"]),
          documentPath,
          profile: input["profile"],
          mutation: { kind: "remove", packageId: String(input["packageId"]) },
        });

        if (!staged.ok) {
          return commandTransaction(validated.command.id, bridgeRefuse(staged.reason, staged.message));
        }

        const proposed = reconcilePendingAssetImport(authoringSession().proposeEdit({
          documentPath,
          jsonPointer: "/data",
          expectedContentHash: String(input["expectedContentHash"]),
          newValue: staged.documentData,
        }));

        return commandTransaction(validated.command.id, bridgeOk("command", {
          ...staged.inspection,
          authoringSnapshot: proposed,
        }));
      }

      case "profile-inspect": {
        const documentPath = input["documentPath"];
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        const assets = isJsonObject(read.status.data)
          ? projectAssetManifestFromDocumentData(read.status.data)
          : null;

        const captured = captureProfileEvidence({
          sourceContentHash: read.status.contentHash,
          playSessionId: playSession?.sessionId ?? null,
          cloneDigest: playSession?.cloneDigest ?? null,
          profile: input["profile"],
          ...(() => {
            const optional: DesktopOptionalFields<{ frame?: { frame: number; drawCalls: number; pixelsDrawn: boolean | null; } }> = {};

            if (!(lastReport === null)) {
              optional.frame = {
                frame: lastReport.frame,
                drawCalls: lastReport.drawCalls,
                pixelsDrawn: lastReport.pixelsDrawn,
              };
            }

            return optional;
          })(),
          ...(() => {
            const optional: DesktopOptionalFields<{ assetCount?: number }> = {};

            if (assets !== null && assets.ok) {
              optional.assetCount = assets.value.assets.length;
            }

            return optional;
          })(),
        });

        if (!captured.ok) return bridgeRefuse(captured.reason, captured.message);

        return bridgeOk("command", captured.evidence);
      }

      case "workspace-layout-inspect": {
        const inspected = inspectDesktopWorkspaceLayout(options.cwd);

        if (!inspected.ok) return bridgeRefuse(inspected.reason, inspected.message);

        return bridgeOk("command", inspected.inspection);
      }

      case "workspace-layout-apply": {
        const applied = applyDesktopWorkspaceLayout({
          cwd: options.cwd,
          profile: input["profile"],
          next: {
            ...(() => {
              const optional: DesktopOptionalFields<{ layoutId?: string }> = {};

              if (isDesktopText(input["layoutId"])) {
                optional.layoutId = input["layoutId"];
              }

              return optional;
            })(),
            ...(() => {
              const optional: DesktopOptionalFields<{ leftVisible?: boolean }> = {};

              if (isDesktopBoolean(input["leftVisible"])) {
                optional.leftVisible = input["leftVisible"];
              }

              return optional;
            })(),
            ...(() => {
              const optional: DesktopOptionalFields<{ inspectorVisible?: boolean }> = {};

              if (isDesktopBoolean(input["inspectorVisible"])) {
                optional.inspectorVisible = input["inspectorVisible"];
              }

              return optional;
            })(),
            ...(() => {
              const optional: DesktopOptionalFields<{ assistantVisible?: boolean }> = {};

              if (isDesktopBoolean(input["assistantVisible"])) {
                optional.assistantVisible = input["assistantVisible"];
              }

              return optional;
            })(),
            ...(() => {
              const optional: DesktopOptionalFields<{ dockHeight?: number }> = {};

              if (isDesktopNumber(input["dockHeight"])) {
                optional.dockHeight = input["dockHeight"];
              }

              return optional;
            })(),
          },
        });

        if (!applied.ok) return commandTransaction(validated.command.id, bridgeRefuse(applied.reason, applied.message));

        return commandTransaction(validated.command.id, bridgeOk("command", applied.inspection));
      }

      case "workspace-layout-reset": {
        const reset = resetDesktopWorkspaceLayout({ cwd: options.cwd, profile: "game" });

        if (!reset.ok) return commandTransaction(validated.command.id, bridgeRefuse(reset.reason, reset.message));

        return commandTransaction(validated.command.id, bridgeOk("command", reset.inspection));
      }

      case "extension-inspect": {
        const inspected = inspectExtensionSeams({ profile: input["profile"] });

        if (!inspected.ok) return bridgeRefuse(inspected.reason, inspected.message);

        return bridgeOk("command", inspected);
      }

      case "extension-start": {
        const started = startExtensionSeam({
          profile: input["profile"],
          seamId: input["seamId"],
        });

        return commandTransaction(validated.command.id, bridgeRefuse(started.reason, started.message));
      }

      case "project-build": {
        const evaluated = evaluateProjectBuild({
          target: input["target"],
          profile: input["profile"],
          host: {
            platform: detectProjectBuildHost(),
            signingReady: false,
            notarizationReady: false,
            releaseAuthority: false,
          },
        });

        return commandTransaction(validated.command.id, bridgeRefuse(evaluated.reason, evaluated.message));
      }

      case "assistant-ask": {
        const documentPath = String(input["documentPath"]);

        const read = readActiveDocument({ documentPath }, {
          missingMessage: "Ask requires a documentPath inside the project directory.",
          unreadableReason: ASSISTANT_ASK_REFUSALS.staleVersion,
        });

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        if (read.status.contentHash !== String(input["expectedContentHash"])) {
          return bridgeRefuse(
            ASSISTANT_ASK_REFUSALS.staleVersion,
            "Ask names the exact project version being inspected.",
          );
        }

        const asked = answerDesktopAssistantAsk({
          documentData: read.status.data,
          sourceContentHash: read.status.contentHash,
          profile: input["profile"],
          prompt: String(input["prompt"]),
          scope: input["scope"],
          playActive: playSession !== null,
        });

        if (!asked.ok) return commandTransaction(validated.command.id, bridgeRefuse(asked.reason, asked.message));

        return bridgeOk("command", asked.answer);
      }

      case "assistant-apply-build": {
        const documentPath = String(input["documentPath"]);
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        if (lastReadyBuild === null) {
          return commandTransaction(validated.command.id, bridgeRefuse(
            DESKTOP_BRIDGE_REFUSALS.assistantJobMissing,
            "Apply Build requires a validated assistant Build artifact from this session.",
          ));
        }

        if (isFixtureProviderDescriptor(lastReadyBuild)) {
          return commandTransaction(validated.command.id, bridgeRefuse(
            ASSISTANT_ASK_REFUSALS.fixtureNotCloud,
            "The checked-in rarity fixture cannot stand in for a configured cloud provider or a Build artifact.",
          ));
        }

        const staged = stageDesktopAssistantBuild({
          documentData: read.status.data,
          contentHash: String(input["expectedContentHash"]),
          documentPath,
          entry: lastReadyBuild,
          ...(() => {
            const optional: DesktopOptionalFields<{ artifact?: SculptArtifact }> = {};

            if (!(lastReadyArtifact === null)) {
              optional.artifact = lastReadyArtifact;
            }

            return optional;
          })(),
        });

        if (!staged.ok) {
          return commandTransaction(validated.command.id, bridgeRefuse(staged.reason, staged.message));
        }

        const proposed = reconcilePendingAssetImport(authoringSession().proposeEdit({
          documentPath,
          jsonPointer: "/data",
          expectedContentHash: String(input["expectedContentHash"]),
          newValue: staged.documentData,
        }));

        return commandTransaction(validated.command.id, bridgeOk("command", {
          catalog: staged.catalog,
          authoringSnapshot: proposed,
        }));
      }

      case "assistant-local-build":
        return assistant({ op: "start", route: "local", mode: "build", ...input });
      case "assistant-byo-build":
        return assistant({ op: "start", route: "byo", mode: "build", ...input });
      case "assistant-local-agent":
        return assistant({ op: "start", route: "local", mode: "agent", ...input });
      case "assistant-status":
        return assistant({ op: "status" });
      case "assistant-cancel":
        return assistant({ op: "abandon", jobId: input["jobId"] });
    }
  };

  const handle = <DesktopRequest>(request: DesktopRequest): DesktopBridgeResponse => {
    try {
      const action = field(request, "action");

      if (action === undefined) {
        return bridgeRefuse(
          DESKTOP_BRIDGE_REFUSALS.requestMalformed,
          "A bridge request is an object with an `action` string.",
        );
      }

      if (!isAction(action)) {
        return bridgeRefuse(
          DESKTOP_BRIDGE_REFUSALS.actionUnknown,
          `Unknown bridge action ${JSON.stringify(action)}. Known: ${DESKTOP_BRIDGE_ACTIONS.join(", ")}.`,
        );
      }

      const payload = field(request, "payload");

      switch (action) {
      case "handshake":
        return bridgeOk("handshake", handshake());
      case "profile": {
        const profile = field(payload, "profile");

        if (profile !== "game" && profile !== "web" && profile !== "kids") {
          return bridgeRefuse(
            DESKTOP_BRIDGE_REFUSALS.requestMalformed,
            "profile requires game, web, or kids.",
          );
        }

        if (options.commandProfile !== undefined && profile !== options.commandProfile) {
          return bridgeRefuse(
            EDITOR_COMMAND_REFUSALS.capabilityDenied,
            "The desktop host profile is fixed for this bridge.",
          );
        }

        if (activeCommandProfile !== profile) retirePreparation();
        activeCommandProfile = profile;

        return bridgeOk("profile", { profile });
      }

      case "command":
        return command(payload);
      case "scene": {
        const scene = activeScene(payload);

        if (!scene.ok) return bridgeRefuse(scene.reason, scene.message);

        return bridgeOk("scene", scene.mountable);
      }

      case "project-browser-open":
        return projectBrowserOpen(payload);
      case "open-path":
        return openPathExercise(payload);
      case "asset-import":
        return assetImport(payload);
      case "ship":
        return ship(payload);
      case "assistant":
        return assistant(payload);
      case "authoring":
        return authoring(payload);
      case "frame-report": {
        const report = frameReportOf(payload);

        if (report === null) {
          return bridgeRefuse(
            DESKTOP_BRIDGE_REFUSALS.requestMalformed,
            "frame-report requires the presentation frame shape (backend, label, frame, instanceIds, drawCalls).",
          );
        }

        lastReport = report;
        options.onFrameReport?.(report);

        return bridgeOk("frame-report", { received: true });
      }
      }
    } catch (cause) {
      if (cause instanceof DesktopProjectMutationOwnerError) {
        return bridgeRefuse(
          cause.diagnostic.code,
          cause.diagnostic.message,
          cause.diagnostic.path,
        );
      }

      throw cause;
    }
  };

  const close = (): boolean => {
    retirePreparation();
    if (session === null) { preparationClosed = true; return true; }

    if (!releaseDesktopSessionProjectGitAuthority(session)) return false;
    session = null;
    preparationClosed = true;

    return true;
  };

  return Object.freeze({
    handle,
    prepareAssetImport,
    activeProfile: (): "game" | "web" | "kids" => activeCommandProfile,
    lastFrameReport: (): DesktopFrameReport | null => lastReport,
    close,
  });
}
