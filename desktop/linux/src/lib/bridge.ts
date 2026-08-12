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
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import {
  ASSISTANT_SCULPT_REFUSALS,
  commitProjectMigration,
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
  DESKTOP_PRODUCT_REFUSALS,
  type DesktopDocumentStatus,
  type DesktopSession,
  type DesktopSnapshot,
} from "@sceneaxi/desktop-shell";
import {
  materializeProjectAssetCopies,
  proposeContainedGltfAssetImport,
  type ProjectAssetManifestEntry,
} from "@sceneaxi/importers";
import { bootstrapOpenPath, resumeOpenPath } from "@sceneaxi/engine-orchestrator";
import {
  DESKTOP_SCENE_HIERARCHY_REFUSALS,
  EDITOR_COMMAND_REFUSALS,
  EDITOR_COMMAND_REGISTRY,
  EDITOR_COMMAND_SCHEMA_VERSION,
  RARITY_PROVIDER_REQUEST_MAX_CHARS,
  RARITY_REFUSE_CODES,
  digestRarityNamespace,
  editorCommand,
  editorCommandTerminalResult,
  editorCommandTransactionResult,
  isDesktopSceneEditOperation,
  isDesktopSceneEditProfile,
  isDesktopSceneReparentPolicy,
  validateEditorCommandInvocation,
  validateRarityNamespace,
  type EditorCommandId,
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
  inspectDesktopSceneProperties,
  stageDesktopSceneEdit,
  stageDesktopScenePropertyEdit,
  type DesktopSceneResult,
} from "./desktop-scene.js";
import { DesktopByoRunnerRefusal } from "./byo-configuration.js";
import {
  DESKTOP_WEB_EXPORT_REFUSALS,
  exportDesktopWebProject,
} from "./web-export.js";
import {
  DESKTOP_PROJECT_BROWSER_REFUSALS,
  type DesktopProjectBrowserResponse,
} from "./project-browser-contract.js";

export type DesktopBridgeOptions = {
  /** Working directory the authoring session binds to. */
  readonly cwd: string;
  /** Already-authorized context, checked before project or journal I/O. */
  readonly commandProfile?: "game" | "web" | "kids";
  readonly commandCapabilities?: readonly string[];
  /** Integer-millisecond clock for the orchestrator host. Injectable for goldens. */
  readonly nowMs?: () => number;
  /** Observer for renderer frame reports (the smoke path listens here). */
  readonly onFrameReport?: (report: DesktopFrameReport) => void;
  /** Optional privileged BYOK runner. Credentials never enter this bridge. */
  readonly runByoAssistant?: (request: DesktopAssistantRunRequest) => Promise<AssistantSculptResult>;
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
    handle(request: unknown): DesktopProjectBrowserResponse;
  }>;
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

export type DesktopBridge = {
  handle(request: unknown): DesktopBridgeResponse;
  /** The most recent renderer frame report, or null before the first one. */
  lastFrameReport(): DesktopFrameReport | null;
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

function isAction(value: unknown): value is DesktopBridgeAction {
  return (
    typeof value === "string" &&
    (DESKTOP_BRIDGE_ACTIONS as readonly string[]).includes(value)
  );
}

function isAuthoringOp(value: unknown): value is DesktopBridgeAuthoringOp {
  return (
    typeof value === "string" &&
    (DESKTOP_BRIDGE_AUTHORING_OPS as readonly string[]).includes(value)
  );
}

function isAssistantOp(value: unknown): value is DesktopBridgeAssistantOp {
  return (
    typeof value === "string" &&
    (DESKTOP_BRIDGE_ASSISTANT_OPS as readonly string[]).includes(value)
  );
}

function isAssistantProfile(value: unknown): value is DesktopAssistantProfile {
  return (
    value === "@sceneaxi/profile-game" ||
    value === "@sceneaxi/profile-web" ||
    value === "@sceneaxi/profile-kids"
  );
}

function field(value: unknown, name: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

function hasExactFields(value: unknown, fields: readonly string[]): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === fields.length && fields.every((name) => Object.hasOwn(value, name));
}

const SCENE_HIERARCHY_POINTER = "/data/composedScene";

function touchesSceneHierarchy(pointer: unknown): pointer is string {
  return typeof pointer === "string" && (
    pointer === "" ||
    pointer === SCENE_HIERARCHY_POINTER ||
    pointer.startsWith(`${SCENE_HIERARCHY_POINTER}/`) ||
    SCENE_HIERARCHY_POINTER.startsWith(`${pointer}/`)
  );
}

function frameReportOf(payload: unknown): DesktopFrameReport | null {
  const backend = field(payload, "backend");
  const label = field(payload, "label");
  const frame = field(payload, "frame");
  const instanceIds = field(payload, "instanceIds");
  const drawCalls = field(payload, "drawCalls");
  if (
    typeof backend !== "string" ||
    typeof label !== "string" ||
    typeof frame !== "number" ||
    typeof drawCalls !== "number" ||
    !Array.isArray(instanceIds) ||
    !instanceIds.every((id) => typeof id === "string")
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
    surface: typeof surface === "string" ? surface : null,
    pixelsDrawn: typeof pixelsDrawn === "boolean" ? pixelsDrawn : null,
  });
}

export function createDesktopBridge(options: DesktopBridgeOptions): DesktopBridge {
  const nowMs = options.nowMs ?? ((): number => Date.now());
  const rarityRefusalReason = (detail: unknown): string | null => {
    if (typeof detail !== "string") return null;
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
  let sceneSelectionStale = false;
  let pendingSceneSelection: Readonly<{
    documentPath: string;
    baseContentHash: string;
    instanceIds: readonly string[];
    proposal: NonNullable<DesktopSnapshot["proposal"]>;
    transactionId: string | null;
  }> | null = null;

  const authoringSession = (): DesktopSession => {
    session ??= options.createAuthoringSession?.() ?? createDesktopSession({ cwd: options.cwd });
    return session;
  };

  const currentSceneSelection = (
    documentData: Readonly<Record<string, unknown>>,
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

  const settlePendingSceneSelection = (snapshot: DesktopSnapshot) => {
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
      typeof snapshot.transactionId === "string"
    ) {
      pendingSceneSelection = Object.freeze({
        ...pending,
        transactionId: snapshot.transactionId,
      });
      return snapshot;
    }
    const transactionMatches = pending.transactionId === null ||
      snapshot.transactionId === pending.transactionId;
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

  const withoutSceneHierarchy = (pointer: string, value: unknown): unknown => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
    if (pointer === "/data") {
      return Object.freeze(Object.fromEntries(
        Object.entries(value).filter(([key]) => key !== "composedScene"),
      ));
    }
    if (pointer === "") {
      const data = field(value, "data");
      if (typeof data !== "object" || data === null || Array.isArray(data)) return value;
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

  const genericAuthoringData = (value: unknown): unknown => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
    let sanitized = value as Readonly<Record<string, unknown>>;
    if (typeof field(value, "phase") === "string" && Object.hasOwn(value, "proposal")) {
      sanitized = genericAuthoringSnapshot(value as DesktopSnapshot);
    }
    const documentData = field(sanitized, "data");
    const authoringSnapshot = field(sanitized, "authoringSnapshot");
    if (
      typeof documentData !== "object" &&
      (typeof authoringSnapshot !== "object" || authoringSnapshot === null)
    ) return sanitized;
    const dataKeys = field(sanitized, "dataKeys");
    return Object.freeze({
      ...sanitized,
      ...(typeof documentData === "object" && documentData !== null && !Array.isArray(documentData)
        ? {
            data: Object.freeze(Object.fromEntries(
              Object.entries(documentData).filter(([key]) => key !== "composedScene"),
            )),
            ...(Array.isArray(dataKeys)
              ? { dataKeys: Object.freeze(dataKeys.filter((key) => key !== "composedScene")) }
              : {}),
          }
        : {}),
      ...(typeof authoringSnapshot === "object" && authoringSnapshot !== null
        ? { authoringSnapshot: genericAuthoringSnapshot(authoringSnapshot as DesktopSnapshot) }
        : {}),
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
    } catch (error) {
      const reason = field(error, "code") ?? field(error, "reason");
      return Object.freeze({
        ok: false as const,
        reason: typeof reason === "string" ? reason : RARITY_REFUSE_CODES.outcomeMismatch,
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
  const rarityProductExercise = (
    documentData: Readonly<Record<string, unknown>>,
    rarityValue: unknown,
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
    if (typeof productId !== "string" || !Number.isSafeInteger(seed)) {
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
          seed: seed as number,
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
        ...(roll.providerEvidence === undefined
          ? {}
          : { providerEvidence: roll.providerEvidence }),
      });
      for (let tick = 1; tick <= OPEN_PATH_EXERCISE_TICKS; tick += 1) {
        live.value.advance({ tick, deltaMs: 100 });
        tickDigests.push(live.value.observe().digest);
      }
      save = live.value.save();
    } catch (error) {
      const reason = field(error, "code") ?? field(error, "reason");
      return {
        ok: false,
        reason: typeof reason === "string" ? reason : RARITY_REFUSE_CODES.provenanceMismatch,
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
      ...(roll.providerEvidence === undefined
        ? {}
        : { evidence: safeRarityEvidenceFromNamespace(rarity.value, roll.eventId, seed as number) }),
    };
  };

  const openPathExercise = (payload: unknown): DesktopBridgeResponse => {
    const recoveryDocumentPath = containedDocumentPath(field(payload, "documentPath"));
    if (recoveryDocumentPath !== null) {
      const recovered = materializeProjectAssetCopies({ projectRoot: options.cwd, documentPath: recoveryDocumentPath });
      if (!recovered.ok) return bridgeRefuse(recovered.reason, recovered.message);
    }
    const read = readActiveDocument(payload, SCENE_DOCUMENT_REFUSALS);
    if (!read.ok) return bridgeRefuse(read.reason, read.message);
    const status = read.status;
    const scene = desktopSceneFromDocumentData(status.data);
    if (!scene.ok) return bridgeRefuse(scene.reason, scene.message);

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
      ...(rarityEvidence === undefined ? {} : { rarity: rarityEvidence }),
      ...(raritySession === undefined ? {} : { raritySession }),
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
  const lexicalDocumentPath = (value: unknown): string | null => {
    if (typeof value !== "string" || value.length === 0) return null;
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

  const containedDocumentPath = (value: unknown): string | null => {
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
  const readActiveDocument = (
    payload: unknown,
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

  const activeScene = (payload: unknown): DesktopSceneResult => {
    const documentPath = containedDocumentPath(field(payload, "documentPath"));
    if (documentPath !== null) {
      const recovered = materializeProjectAssetCopies({ projectRoot: options.cwd, documentPath });
      if (!recovered.ok) return { ok: false, reason: recovered.reason, message: recovered.message };
    }
    const read = readActiveDocument(payload, SCENE_DOCUMENT_REFUSALS);
    if (!read.ok) return { ok: false, reason: read.reason, message: read.message };
    return desktopSceneFromDocumentData(read.status.data);
  };

  const recoverAssetCopies = (documentPath: string) =>
    materializeProjectAssetCopies({ projectRoot: options.cwd, documentPath });

  /** Stage one native selection through the existing all-or-nothing E1 session. */
  const assetImport = (payload: unknown): DesktopBridgeResponse => {
    const profile = field(payload, "profile");
    const sourcePath = field(payload, "sourcePath");
    const documentPath = containedDocumentPath(field(payload, "documentPath"));
    const requestedAssetId = field(payload, "assetId");
    if (profile !== "web") {
      return bridgeRefuse(
        DESKTOP_PRODUCT_REFUSALS.webCapabilityRequired,
        "Contained GLB/glTF import is available only on the Web Experience creator surface in this release.",
      );
    }
    if (
      typeof sourcePath !== "string" ||
      documentPath === null ||
      (requestedAssetId !== undefined && typeof requestedAssetId !== "string")
    ) {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.requestMalformed,
        "asset-import requires a native absolute sourcePath and a documentPath inside the selected project.",
      );
    }
    const proposed = proposeContainedGltfAssetImport({
      projectRoot: options.cwd,
      documentPath,
      sourcePath,
      ...(typeof requestedAssetId === "string" ? { assetId: requestedAssetId } : {}),
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
      authoring,
      unifiedDiff: proposed.unifiedDiff,
    }));
  };

  const authoring = (
    payload: unknown,
    hierarchyCommandResponse = false,
    preloadedStatus?: DesktopDocumentStatus,
  ): DesktopBridgeResponse => {
    const op = field(payload, "op");
    const authoringOk = (data: unknown) => bridgeOk(
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
        typeof expectedContentHash !== "string" ||
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
    const rarityStatus = (data: Readonly<Record<string, unknown>>) => {
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
      if (typeof data.productId !== "string" || !Number.isSafeInteger(data.seed)) {
        return Object.freeze({
          ok: false as const,
          reason: RARITY_REFUSE_CODES.seedInvalid,
          message: "The accepted rarity namespace has no valid ProductManifest identity.",
        });
      }
      const verified = resolveRarityWithKernel({
        productId: data.productId,
        seed: data.seed as number,
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
          data.seed as number,
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
      const documentPath = containedDocumentPath(field(payload, "documentPath"));
      if (documentPath === null) {
        return bridgeRefuse(
          DESKTOP_BRIDGE_REFUSALS.requestMalformed,
          "authoring restart requires a documentPath string inside the project directory.",
        );
      }
      session = options.createAuthoringSession?.() ?? createDesktopSession({ cwd: options.cwd });
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
      if (documentPath === null || typeof expectedContentHash !== "string") {
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
      if (documentPath === null || typeof expectedContentHash !== "string") {
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
        typeof jsonPointer !== "string" ||
        (expectedContentHash !== undefined &&
          (typeof expectedContentHash !== "string" ||
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
        ...(expectedContentHash !== undefined ? { expectedContentHash } : {}),
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
      const rejected = reconcilePendingAssetImport(
        settleRarityProposalEvidence(live.reject()),
      );
      if (rejected.phase === "rejected") pendingSceneSelection = null;
      return authoringOk(rejected);
    }
    if (op === "recover") {
      const recovered = settlePendingSceneSelection(reconcilePendingAssetImport(
        settleRarityProposalEvidence(live.refreshRecovery()),
      ));
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

  const projectBrowserOpen = (payload: unknown): DesktopBridgeResponse => {
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
        typeof path === "string" ? path : null,
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
        typeof reason === "string" ? reason : DESKTOP_PROJECT_BROWSER_REFUSALS.documentInvalid,
        typeof message === "string"
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

  const ship = (payload: unknown): DesktopBridgeResponse => {
    const op = field(payload, "op");
    const documentPath = field(payload, "documentPath");
    const expectedContentHash = field(payload, "expectedContentHash");
    if (
      op !== "export-web" ||
      documentPath !== DESKTOP_ACTIVE_DOCUMENT_PATH ||
      typeof expectedContentHash !== "string" ||
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
          ...(assistantJob.refusal === undefined
            ? {}
            : { refusal: assistantJob.refusal.reason }),
        });
    return Object.freeze({
      jobId: assistantJob.jobId,
      commandId: assistantJob.commandId,
      route: assistantJob.route,
      status: assistantJob.status,
      latestProgress: assistantJob.latestProgress,
      progressCount: assistantJob.progressCount,
      terminal,
      ...(assistantJob.result === undefined ? {} : { result: assistantJob.result }),
      ...(assistantJob.refusal === undefined ? {} : { refusal: assistantJob.refusal }),
    });
  };

  const assistant = (payload: unknown): DesktopBridgeResponse => {
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
      if (typeof acknowledgedJobId !== "string" || acknowledgedJobId.length === 0) {
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
      typeof prompt !== "string" ||
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
    if (route === "hosted") {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.assistantHostedMeteringUnavailable,
        "Hosted AI is metered through the web-shell assistant panel; the desktop has no identity or credit plane and cannot bypass that gate.",
      );
    }
    const rarityMode = startMode === "agent";
    if (rarityMode && (route !== "local" || options.runRarityProvider === undefined)) {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.rarityProviderUnavailable,
        "The checked-in rarity fixture provider is available only through the local privileged host path.",
      );
    }
    if (!rarityMode && route === "byo" && options.runByoAssistant === undefined) {
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
      | Readonly<{ documentPath: string; contentHash: string; data: Readonly<Record<string, unknown>> }>
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
    const commandId = rarityMode
      ? "assistant-local-agent"
      : route === "byo"
        ? "assistant-byo-build"
        : "assistant-local-build";
    assistantJob = {
      jobId: `desktop-assistant-${String(assistantSequence)}`,
      commandId,
      route,
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
    const detailIsOurs = route === "local" && !rarityMode;
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
        ...(detailIsOurs && refusal.detail !== undefined
          ? { detail: refusal.detail }
          : {}),
      });
    };
    const settleRuntimeFailure = (error: unknown): void => {
      const byoRefusal = route === "byo" && error instanceof DesktopByoRunnerRefusal
        ? error
        : null;
      settleRefusal({
        reason: byoRefusal?.reason ?? DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed,
        message: byoRefusal?.message ?? "The configured assistant runner failed.",
        recoverable: true,
        detail: error instanceof Error ? error.message : String(error),
      });
    };
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
          evidence: staged.evidence,
          authoring: Object.freeze({ ...snapshot, rarityEvidence: staged.evidence }),
        });
      };
      try {
        void options.runRarityProvider({ profile, prompt: request.prompt })
          .then(stageRarity)
          .catch(settleRuntimeFailure);
      } catch (error) {
        settleRuntimeFailure(error);
      }
      return bridgeOk("assistant", assistantSnapshot());
    }
    let running: Promise<AssistantSculptResult> | undefined;
    try {
      running = route === "local"
        ? runAssistantSculptAction({
            route: "local",
            prompt: request.prompt,
            profile: request.profile,
            onProgress,
          })
        : options.runByoAssistant?.(request);
    } catch (error) {
      settleRuntimeFailure(error);
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
          activeJob.status = "ready";
          activeJob.result = Object.freeze({
            ok: true as const,
            route: result.route,
            artifactBytes: result.artifactBytes,
            artifactDigest: result.artifactDigest,
            inspection: result.inspection,
            mountable: desktopAssistantScene(result.artifact),
            ...(result.providerEvidence === undefined
              ? {}
              : { providerEvidence: result.providerEvidence }),
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
    const refusal = typeof responseReason === "string"
      ? responseReason
      : diagnosticCode === "content-hash-conflict"
        ? EDITOR_COMMAND_REFUSALS.staleBase
        : diagnosticCode === "invalid-transaction-phase"
          ? EDITOR_COMMAND_REFUSALS.invalidPhase
          : diagnosticCode;
    const refused = typeof refusal === "string";
    const phase = field(data, "phase");
    const reviewing = !refused && phase === "reviewing";
    const appliedPaths = field(data, "appliedPaths");
    const restoredPaths = field(data, "restoredPaths");
    const proposal = field(data, "proposal");
    const proposalEdits = field(proposal, "edits");
    const documentPaths = Array.isArray(appliedPaths)
      ? appliedPaths.filter((value): value is string => typeof value === "string")
      : Array.isArray(restoredPaths)
        ? restoredPaths.filter((value): value is string => typeof value === "string")
        : Array.isArray(proposalEdits)
          ? proposalEdits
              .map((edit) => field(edit, "documentPath"))
              .filter((value): value is string => typeof value === "string")
          : [];
    const transaction = editorCommandTransactionResult({
      commandId,
      ...(typeof transactionId === "string" ? { transactionId } : {}),
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
      ...(typeof refusal === "string" ? { refusal } : {}),
    });
    return bridgeOk("command", Object.freeze({
      ...(typeof data === "object" && data !== null ? data : { value: data }),
      transaction,
    }));
  };

  const command = (payload: unknown): DesktopBridgeResponse => {
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
    if (options.commandProfile === "kids" || validated.invocation.profile === "kids") {
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
        options.commandProfile === "kids"
          ? DESKTOP_SCENE_HIERARCHY_REFUSALS.kidsDenied
          : DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
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
        const recovered = recoverProjectMigration(options.cwd);
        return recovered.ok
          ? bridgeOk("command", recovered)
          : bridgeRefuse(recovered.diagnostic.code, recovered.diagnostic.message, recovered.diagnostic.path);
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
      case "run-play":
        return openPathExercise({ documentPath: input["documentPath"] });
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

  const handle = (request: unknown): DesktopBridgeResponse => {
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
  };

  return Object.freeze({
    handle,
    lastFrameReport: (): DesktopFrameReport | null => lastReport,
  });
}
