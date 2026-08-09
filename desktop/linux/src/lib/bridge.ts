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
  type DesktopDocumentStatus,
  type DesktopSession,
  type DesktopSnapshot,
} from "@sceneaxi/desktop-shell";
import { bootstrapOpenPath, resumeOpenPath } from "@sceneaxi/engine-orchestrator";
import {
  RARITY_REFUSE_CODES,
  digestRarityNamespace,
  validateRarityNamespace,
} from "@sceneaxi/schemas";
import {
  DESKTOP_BRIDGE_ACTIONS,
  DESKTOP_BRIDGE_ASSISTANT_OPS,
  DESKTOP_BRIDGE_AUTHORING_OPS,
  DESKTOP_BRIDGE_REFUSALS,
  DESKTOP_RARITY_EVENT_ID,
  bridgeOk,
  bridgeRefuse,
  type DesktopBridgeAction,
  type DesktopBridgeAssistantOp,
  type DesktopAssistantJobSnapshot,
  type DesktopBridgeAuthoringOp,
  type DesktopBridgeHandshake,
  type DesktopBridgeResponse,
  type DesktopFrameReport,
  type DesktopRarityEvidence,
} from "./bridge-contract.js";
import {
  DESKTOP_SCENE_NOT_COMPOSABLE,
  desktopAssistantScene,
  desktopSceneFromDocumentData,
  desktopScenePropertyInspection,
  inspectDesktopSceneProperties,
  stageDesktopScenePropertyEdit,
  type DesktopSceneResult,
} from "./desktop-scene.js";
import { DesktopByoRunnerRefusal } from "./byo-configuration.js";

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
}>;

export type DesktopBridge = {
  handle(request: unknown): DesktopBridgeResponse;
  /** The most recent renderer frame report, or null before the first one. */
  lastFrameReport(): DesktopFrameReport | null;
};

/** Ticks the open-path exercise advances: enough to prove digests move. */
export const OPEN_PATH_EXERCISE_TICKS = 4;

export type OpenPathExercise = {
  readonly bootstrap: unknown;
  readonly initialDigest: string;
  readonly tickDigests: readonly string[];
  readonly instanceCount: number;
  readonly mountable: Extract<DesktopSceneResult, { readonly ok: true }>["mountable"];
  readonly closed: true;
  readonly replayDigest?: string;
  readonly rarity?: DesktopRarityEvidence;
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
  let session: DesktopSession | null = null;
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

  const authoringSession = (): DesktopSession => {
    session ??= createDesktopSession({ cwd: options.cwd });
    return session;
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
      return Object.freeze({
        ok: false as const,
        reason: bootstrapped.reason,
        message: bootstrapped.message,
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
      const reason = field(error, "reason");
      return Object.freeze({
        ok: false as const,
        reason: typeof reason === "string" ? reason : RARITY_REFUSE_CODES.outcomeMismatch,
        message: "The authoritative kernel refused the rarity resolution.",
      });
    } finally {
      handle.close();
    }
  };

  const openPathExercise = (payload: unknown): DesktopBridgeResponse => {
    const read = readActiveDocument(payload);
    if (!read.ok) return bridgeRefuse(read.reason, read.message);
    const status = read.status;
    const scene = desktopSceneFromDocumentData(status.data);
    if (!scene.ok) return bridgeRefuse(scene.reason, scene.message);

    const rarityValue = status.data.rarity;
    if (rarityValue !== undefined) {
      const rarity = validateRarityNamespace(rarityValue);
      const productId = status.data.productId;
      const seed = status.data.seed;
      if (!rarity.ok) return bridgeRefuse(rarity.code, rarity.message, rarity.path);
      if (typeof productId !== "string" || !Number.isSafeInteger(seed)) {
        return bridgeRefuse(
          DESKTOP_BRIDGE_REFUSALS.requestMalformed,
          "The active rarity project has no valid ProductManifest identity.",
        );
      }
      const roll = rarity.value.rolls.at(-1);
      if (roll === undefined || rarity.value.providerEvidence === undefined) {
        return bridgeRefuse(
          RARITY_REFUSE_CODES.outcomeMismatch,
          "The active rarity namespace has no accepted outcome and provider evidence.",
        );
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
        return bridgeRefuse(bootstrapped.reason, bootstrapped.message, bootstrapped.detail);
      }
      const handle = bootstrapped.value;
      const live = handle.session();
      if (!live.ok) {
        handle.close();
        return bridgeRefuse(live.reason, live.message, live.detail);
      }
      let initialDigest: string;
      let save: ReturnType<typeof live.value.save>;
      const tickDigests: string[] = [];
      try {
        const initial = live.value.observe();
        initialDigest = initial.digest;
        live.value.dispatch({ type: "rarity-roll", eventId: roll.eventId, request: roll.request });
        for (let tick = 1; tick <= OPEN_PATH_EXERCISE_TICKS; tick += 1) {
          live.value.advance({ tick, deltaMs: 100 });
          tickDigests.push(live.value.observe().digest);
        }
        save = live.value.save();
      } catch (error) {
        const reason = field(error, "reason");
        return bridgeRefuse(
          typeof reason === "string" ? reason : RARITY_REFUSE_CODES.provenanceMismatch,
          "The accepted rarity session could not be replayed exactly.",
        );
      } finally {
        handle.close();
      }
      const resumed = resumeOpenPath({ kind: "product", save }, { nowMs });
      if (!resumed.ok) return bridgeRefuse(resumed.reason, resumed.message, resumed.detail);
      const replay = resumed.value.session();
      if (!replay.ok) {
        resumed.value.close();
        return bridgeRefuse(replay.reason, replay.message, replay.detail);
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
          return bridgeRefuse(
            RARITY_REFUSE_CODES.provenanceMismatch,
            "The resumed rarity session did not reproduce the accepted namespace and terminal digest.",
          );
        }
      } finally {
        resumed.value.close();
      }
      const exercise: OpenPathExercise = Object.freeze({
        bootstrap: handle.bootstrap,
        initialDigest,
        tickDigests: Object.freeze(tickDigests),
        instanceCount: scene.mountable.instances.length,
        mountable: scene.mountable,
        closed: true as const,
        replayDigest,
        rarity: safeRarityEvidenceFromNamespace(rarity.value, roll.eventId, seed as number),
      });
      return bridgeOk("open-path", exercise);
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
   * mapping. Scene playback and the rarity open path both start here, so a
   * caller that needs the raw status alongside the composed scene cannot end up
   * enforcing containment a second, divergent way.
   */
  const readActiveDocument = (payload: unknown):
    | Readonly<{ ok: true; status: Extract<DesktopDocumentStatus, { ok: true }> }>
    | Readonly<{ ok: false; reason: string; message: string }> => {
    const documentPath = containedDocumentPath(field(payload, "documentPath"));
    if (documentPath === null) {
      return {
        ok: false,
        reason: DESKTOP_BRIDGE_REFUSALS.requestMalformed,
        message: "scene playback requires a documentPath string inside the project directory.",
      };
    }
    const status = authoringSession().status(documentPath);
    if (!status.ok) {
      const diagnostic = status.diagnostics[0];
      return {
        ok: false,
        reason: diagnostic?.code ?? DESKTOP_SCENE_NOT_COMPOSABLE,
        message: diagnostic?.message ?? "The active Scene Document could not be read.",
      };
    }
    return { ok: true, status };
  };

  const activeScene = (payload: unknown): DesktopSceneResult => {
    const read = readActiveDocument(payload);
    if (!read.ok) return { ok: false, reason: read.reason, message: read.message };
    return desktopSceneFromDocumentData(read.status.data);
  };

  const authoring = (payload: unknown): DesktopBridgeResponse => {
    const op = field(payload, "op");
    if (!isAuthoringOp(op)) {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.authoringOpUnknown,
        `Unknown authoring operation ${JSON.stringify(op)}. Known: ${DESKTOP_BRIDGE_AUTHORING_OPS.join(", ")}.`,
      );
    }
    const statusWithProperties = (live: DesktopSession, documentPath: string) => {
      const status = live.status(documentPath);
      if (!status.ok) return status;
      return Object.freeze({
        ...status,
        editableScene: inspectDesktopSceneProperties({
          documentData: status.data,
          contentHash: status.contentHash,
          documentPath,
        }),
      });
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
      return Object.freeze({
        ...snapshot,
        editableScene: inspectDesktopSceneProperties({
          documentData: status.data,
          contentHash: status.contentHash,
          documentPath,
        }),
      });
    };
    if (op === "restart") {
      const documentPath = containedDocumentPath(field(payload, "documentPath"));
      if (documentPath === null) {
        return bridgeRefuse(
          DESKTOP_BRIDGE_REFUSALS.requestMalformed,
          "authoring restart requires a documentPath string inside the project directory.",
        );
      }
      session = createDesktopSession({ cwd: options.cwd });
      return bridgeOk("authoring", statusWithProperties(session, documentPath));
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
      const snapshot = live.proposeEdit(staged.edit);
      if (snapshot.phase !== "reviewing") return bridgeOk("authoring", snapshot);
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
      const snapshot: DesktopSnapshot = live.proposeEdit({
        documentPath,
        jsonPointer,
        newValue: field(payload, "newValue"),
        ...(expectedContentHash !== undefined ? { expectedContentHash } : {}),
      });
      return bridgeOk("authoring", snapshot);
    }
    if (op === "accept") {
      return bridgeOk("authoring", appliedWithProperties(live, live.accept()));
    }
    if (op === "reject") return bridgeOk("authoring", live.reject());
    if (op === "recover") {
      return bridgeOk(
        "authoring",
        appliedWithProperties(live, live.refreshRecovery()),
      );
    }
    return bridgeOk("authoring", live.undo());
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
      if (assistantJob?.status === "running") {
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
    if (
      typeof prompt !== "string" ||
      prompt.trim().length === 0 ||
      !isAssistantProfile(profile) ||
      (route !== "local" && route !== "byo" && route !== "hosted") ||
      (mode !== undefined && mode !== "build" && mode !== "agent")
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
    const rarityMode = mode === "agent";
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
    if (assistantJob?.status === "running") {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.assistantBusy,
        "An assistant job is already running; poll its status before retrying.",
      );
    }

    let rarityDocument:
      | Readonly<{ documentPath: string; contentHash: string; data: Readonly<Record<string, unknown>> }>
      | undefined;
    if (rarityMode) {
      const documentPath = containedDocumentPath(field(payload, "documentPath"));
      if (documentPath === null) {
        return bridgeRefuse(
          DESKTOP_BRIDGE_REFUSALS.requestMalformed,
          "A rarity assistant action requires a documentPath inside the project directory.",
        );
      }
      const status = authoringSession().status(documentPath);
      if (!status.ok) {
        const diagnostic = status.diagnostics[0];
        return bridgeRefuse(
          diagnostic?.code ?? DESKTOP_BRIDGE_REFUSALS.requestMalformed,
          diagnostic?.message ?? "The active Scene Document could not be read.",
        );
      }
      rarityDocument = Object.freeze({
        documentPath,
        contentHash: status.contentHash,
        data: status.data,
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
    const request: DesktopAssistantRunRequest = {
      prompt: prompt.trim(),
      profile,
      onProgress,
    };
    // The one owner of this job's detail policy, for a refusal a runner threw and
    // one it returned alike. BYOK provider errors are deliberately detail-free: an
    // upstream error may include request headers or credential material, and only a
    // local run's detail is ours to begin with. The renderer and local bridge get
    // only the named, redacted refusal.
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
        ...(route === "local" && refusal.detail !== undefined
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
        message: "Requesting bounded rarity policy and candidate input from the fixture provider.",
      }));
      void options.runRarityProvider({ profile })
        .then((contribution) => {
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
          const live = authoringSession();
          const snapshot = staged.replayed
            ? live.snapshot()
            : live.proposeEdit(staged.edit);
          if (!staged.replayed && snapshot.phase !== "reviewing") {
            const diagnostic = snapshot.diagnostics?.[0];
            settleRefusal({
              reason: diagnostic?.code ?? "RARITY_PROPOSAL_NOT_REVIEWING",
              message: diagnostic?.message ?? "The rarity proposal did not reach Change Review.",
              recoverable: true,
            });
            return;
          }
          onProgress(Object.freeze({
            phase: "ready",
            percent: 100,
            message: staged.replayed
              ? "The identical rarity event replayed without changing project bytes."
              : "The canonical rarity proposal is waiting in Change Review.",
          }));
          activeJob.status = "ready";
          activeJob.result = Object.freeze({
            ok: true as const,
            kind: "rarity-proposal" as const,
            evidence: staged.evidence,
            authoring: Object.freeze({ ...snapshot, rarityEvidence: staged.evidence }),
          });
        })
        .catch(settleRuntimeFailure);
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
