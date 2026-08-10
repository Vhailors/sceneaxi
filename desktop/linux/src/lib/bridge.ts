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
  RARITY_PROVIDER_REQUEST_MAX_CHARS,
  RARITY_REFUSE_CODES,
  digestRarityNamespace,
  validateRarityNamespace,
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
  desktopScenePropertyInspection,
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

export type DesktopBridgeOptions = {
  /** Working directory the authoring session binds to. */
  readonly cwd: string;
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

  const authoringSession = (): DesktopSession => {
    session ??= options.createAuthoringSession?.() ?? createDesktopSession({ cwd: options.cwd });
    return session;
  };

  const withRarityProposalEvidence = (snapshot: DesktopSnapshot) =>
    rarityProposalEvidence === null
      ? snapshot
      : Object.freeze({ ...snapshot, rarityEvidence: rarityProposalEvidence });

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
  const containedDocumentPath = (value: unknown): string | null => {
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
    const realRoot = canonicalPath(root);
    const realTarget = canonicalPath(target);
    if (realRoot === null || realTarget === null) return null;
    if (realTarget !== realRoot && !realTarget.startsWith(`${realRoot}${sep}`)) return null;
    return value;
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

  const authoring = (payload: unknown): DesktopBridgeResponse => {
    const op = field(payload, "op");
    if (!isAuthoringOp(op)) {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.authoringOpUnknown,
        `Unknown authoring operation ${JSON.stringify(op)}. Known: ${DESKTOP_BRIDGE_AUTHORING_OPS.join(", ")}.`,
      );
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
    const statusWithProperties = (
      live: DesktopSession,
      documentPath: string,
      retirementReason?: DesktopRarityRetirementReason,
    ) => {
      const status = live.status(documentPath);
      if (!status.ok) {
        reconcileRarityAssistantDocument(status, retirementReason);
        return status;
      }
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
        editableScene: inspectDesktopSceneProperties({
          documentData: status.data,
          contentHash: status.contentHash,
          documentPath,
        }),
      });
      reconcileRarityAssistantDocument(enriched, retirementReason);
      return enriched;
    };
    /**
     * A snapshot the surface can re-read its property panel from.
     *
     * Stage and Save both move the edited value past the inspection the last
     * `status` produced, so a snapshot that carries none leaves the surface
     * holding a value the session no longer agrees with. An applied proposal is
     * re-read from the document it wrote; anything else answers unchanged.
     */
    const appliedWithProperties = (
      live: DesktopSession,
      snapshot: DesktopSnapshot,
    ) => {
      if (
        snapshot.phase !== "applied" ||
        snapshot.journalRecoveryPending ||
        (snapshot.diagnostics?.length ?? 0) > 0
      ) return snapshot;
      const edited = snapshot.proposal?.edits[0]?.documentPath;
      const documentPath = containedDocumentPath(edited);
      if (documentPath === null) return snapshot;
      const status = live.status(documentPath);
      if (!status.ok) return snapshot;
      const rarity = rarityStatus(status.data);
      if (!rarity.ok) return snapshot;
      return Object.freeze({
        ...snapshot,
        ...rarity.value,
        editableScene: inspectDesktopSceneProperties({
          documentData: status.data,
          contentHash: status.contentHash,
          documentPath,
        }),
      });
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
      const restarted = statusWithProperties(session, documentPath);
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
      return bridgeOk("authoring", restarted);
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
      return bridgeOk("authoring", statusWithProperties(live, documentPath));
    }
    if (op === "edit-scene") {
      const documentPath = containedDocumentPath(field(payload, "documentPath"));
      const expectedContentHash = field(payload, "expectedContentHash");
      if (
        documentPath === null ||
        typeof expectedContentHash !== "string" ||
        !/^sha256:[0-9a-f]{64}$/.test(expectedContentHash)
      ) {
        return bridgeRefuse(
          DESKTOP_BRIDGE_REFUSALS.requestMalformed,
          "authoring edit-scene requires a SHA-256 expectedContentHash and a documentPath inside the project directory.",
        );
      }
      const status = live.status(documentPath);
      if (!status.ok) return bridgeOk("authoring", status);
      const staged = stageDesktopSceneEdit({
        documentData: status.data,
        contentHash: expectedContentHash,
        documentPath,
        profile: field(payload, "profile"),
        operation: field(payload, "operation"),
      });
      if (!staged.ok) return bridgeOk("authoring", staged);
      const snapshot = live.proposeEdit(staged.edit);
      if (snapshot.phase !== "reviewing" || (snapshot.diagnostics?.length ?? 0) > 0) {
        return bridgeOk("authoring", withRarityProposalEvidence(snapshot));
      }
      return bridgeOk(
        "authoring",
        Object.freeze({
          ...snapshot,
          editableScene: staged.inspection,
          selectedInstanceId: staged.selectedInstanceId,
          sceneEditOperation: staged.operation,
        }),
      );
    }
    if (op === "edit-property") {
      const documentPath = containedDocumentPath(field(payload, "documentPath"));
      const expectedContentHash = field(payload, "expectedContentHash");
      if (
        documentPath === null ||
        typeof expectedContentHash !== "string" ||
        !/^sha256:[0-9a-f]{64}$/.test(expectedContentHash)
      ) {
        return bridgeRefuse(
          DESKTOP_BRIDGE_REFUSALS.requestMalformed,
          "authoring edit-property requires a SHA-256 expectedContentHash and a documentPath inside the project directory.",
        );
      }
      const status = live.status(documentPath);
      if (!status.ok) return bridgeOk("authoring", status);
      const staged = stageDesktopScenePropertyEdit({
        documentData: status.data,
        contentHash: expectedContentHash,
        documentPath,
        entityId: field(payload, "entityId"),
        propertyId: field(payload, "propertyId"),
        newValue: field(payload, "newValue"),
      });
      if (!staged.ok) return bridgeOk("authoring", staged);
      const snapshot = reconcilePendingAssetImport(live.proposeEdit(staged.edit));
      if (snapshot.phase !== "reviewing" || (snapshot.diagnostics?.length ?? 0) > 0) {
        return bridgeOk("authoring", withRarityProposalEvidence(snapshot));
      }
      return bridgeOk(
        "authoring",
        Object.freeze({
          ...snapshot,
          editableScene: desktopScenePropertyInspection(
            expectedContentHash,
            staged.entity,
          ),
        }),
      );
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
      const snapshot: DesktopSnapshot = reconcilePendingAssetImport(live.proposeEdit({
        documentPath,
        jsonPointer,
        newValue: field(payload, "newValue"),
        ...(expectedContentHash !== undefined ? { expectedContentHash } : {}),
      }));
      return bridgeOk("authoring", withRarityProposalEvidence(snapshot));
    }
    if (op === "accept") {
      const accepted = reconcilePendingAssetImport(
        settleRarityProposalEvidence(appliedWithProperties(live, live.accept())),
      );
      if (
        pendingAssetImport === null ||
        accepted.phase !== "applied" ||
        accepted.journalRecoveryPending ||
        (accepted.diagnostics?.length ?? 0) > 0
      ) {
        return bridgeOk("authoring", accepted);
      }
      const pending = pendingAssetImport;
      pendingAssetImport = null;
      const copies = recoverAssetCopies(pending.documentPath);
      return copies.ok
        ? bridgeOk("authoring", Object.freeze({ ...accepted, assetImport: pending.entry, assetCopies: copies }))
        : bridgeRefuse(copies.reason, copies.message);
    }
    if (op === "reject") {
      const rejected = reconcilePendingAssetImport(
        settleRarityProposalEvidence(live.reject()),
      );
      return bridgeOk("authoring", rejected);
    }
    if (op === "recover") {
      const recovered = reconcilePendingAssetImport(
        settleRarityProposalEvidence(
          appliedWithProperties(live, live.refreshRecovery()),
        ),
      );
      if (
        pendingAssetImport === null ||
        recovered.phase !== "applied" ||
        recovered.journalRecoveryPending ||
        (recovered.diagnostics?.length ?? 0) > 0
      ) {
        return bridgeOk("authoring", recovered);
      }
      const pending = pendingAssetImport;
      pendingAssetImport = null;
      const copies = recoverAssetCopies(pending.documentPath);
      return copies.ok
        ? bridgeOk("authoring", Object.freeze({ ...recovered, assetImport: pending.entry, assetCopies: copies }))
        : bridgeRefuse(copies.reason, copies.message);
    }
    const result = live.undo();
    if (result.ok) {
      if (rarityProposalEvidence !== null) {
        retireRarityAssistantResult(rarityProposalEvidence, "undo");
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
        statusWithProperties(live, appliedDocumentPath, "undo");
      }
      rarityProposalEvidence = null;
      pendingAssetImport = null;
    }
    return bridgeOk("authoring", result);
  };

  const ship = (payload: unknown): DesktopBridgeResponse => {
    const op = field(payload, "op");
    const documentPath = containedDocumentPath(field(payload, "documentPath"));
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
    const status = live.status(documentPath);
    if (!status.ok) {
      return bridgeRefuse(
        DESKTOP_WEB_EXPORT_REFUSALS.sceneInvalid,
        status.diagnostics[0]?.message ?? "The active Scene Document is invalid.",
      );
    }
    if (status.contentHash !== expectedContentHash) {
      return bridgeRefuse(
        DESKTOP_WEB_EXPORT_REFUSALS.projectChanged,
        "scene.json changed after the renderer read it; reopen before exporting.",
      );
    }
    const runtimeJavaScript = options.webExportRuntime;
    if (runtimeJavaScript === undefined || runtimeJavaScript.byteLength === 0) {
      return bridgeRefuse(
        DESKTOP_WEB_EXPORT_REFUSALS.runtimeMissing,
        "The packaged static Web renderer bytes are unavailable.",
      );
    }
    const exported = exportDesktopWebProject({
      projectRoot: options.cwd,
      documentPath,
      expectedContentHash,
      runtimeJavaScript,
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
    return Object.freeze({
      jobId: assistantJob.jobId,
      route: assistantJob.route,
      status: assistantJob.status,
      latestProgress: assistantJob.latestProgress,
      progressCount: assistantJob.progressCount,
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
        return bridgeOk("assistant", null);
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
    assistantJob = {
      jobId: `desktop-assistant-${String(assistantSequence)}`,
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
      case "scene": {
        const scene = activeScene(payload);
        if (!scene.ok) return bridgeRefuse(scene.reason, scene.message);
        return bridgeOk("scene", scene.mountable);
      }
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
