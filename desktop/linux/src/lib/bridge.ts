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
  type AssistantSculptProgress,
  type AssistantSculptResult,
} from "@sceneaxi/authoring-core";
import {
  createDesktopSession,
  type DesktopSession,
  type DesktopSnapshot,
} from "@sceneaxi/desktop-shell";
import { bootstrapOpenPath } from "@sceneaxi/engine-orchestrator";
import {
  DESKTOP_BRIDGE_ACTIONS,
  DESKTOP_BRIDGE_ASSISTANT_OPS,
  DESKTOP_BRIDGE_AUTHORING_OPS,
  DESKTOP_BRIDGE_REFUSALS,
  bridgeOk,
  bridgeRefuse,
  type DesktopBridgeAction,
  type DesktopBridgeAssistantOp,
  type DesktopAssistantJobSnapshot,
  type DesktopBridgeAuthoringOp,
  type DesktopBridgeHandshake,
  type DesktopBridgeResponse,
  type DesktopFrameReport,
} from "./bridge-contract.js";
import {
  DESKTOP_SCENE_NOT_COMPOSABLE,
  desktopAssistantScene,
  desktopSceneFromDocumentData,
  type DesktopSceneResult,
} from "./desktop-scene.js";

export type DesktopBridgeOptions = {
  /** Working directory the authoring session binds to. */
  readonly cwd: string;
  /** Integer-millisecond clock for the orchestrator host. Injectable for goldens. */
  readonly nowMs?: () => number;
  /** Observer for renderer frame reports (the smoke path listens here). */
  readonly onFrameReport?: (report: DesktopFrameReport) => void;
  /** Optional BYOK runner. The default desktop owns only the free local path. */
  readonly runByoAssistant?: (request: DesktopAssistantRunRequest) => Promise<AssistantSculptResult>;
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

  const openPathExercise = (payload: unknown): DesktopBridgeResponse => {
    const scene = activeScene(payload);
    if (!scene.ok) return bridgeRefuse(scene.reason, scene.message);

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
    if (isAbsolute(value) || /^[a-zA-Z]:[\\/]/.test(value) || value.includes("\0")) return null;
    const root = resolve(options.cwd);
    const target = resolve(root, value);
    if (target !== root && !target.startsWith(`${root}${sep}`)) return null;
    const realRoot = canonicalPath(root);
    const realTarget = canonicalPath(target);
    if (realRoot === null || realTarget === null) return null;
    if (realTarget !== realRoot && !realTarget.startsWith(`${realRoot}${sep}`)) return null;
    return value;
  };

  const activeScene = (payload: unknown): DesktopSceneResult => {
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
    return desktopSceneFromDocumentData(status.data);
  };

  const authoring = (payload: unknown): DesktopBridgeResponse => {
    const op = field(payload, "op");
    if (!isAuthoringOp(op)) {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.authoringOpUnknown,
        `Unknown authoring operation ${JSON.stringify(op)}. Known: ${DESKTOP_BRIDGE_AUTHORING_OPS.join(", ")}.`,
      );
    }
    if (op === "restart") {
      const documentPath = containedDocumentPath(field(payload, "documentPath"));
      if (documentPath === null) {
        return bridgeRefuse(
          DESKTOP_BRIDGE_REFUSALS.requestMalformed,
          "authoring restart requires a documentPath string inside the project directory.",
        );
      }
      session = createDesktopSession({ cwd: options.cwd });
      return bridgeOk("authoring", session.status(documentPath));
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
      return bridgeOk("authoring", live.status(documentPath));
    }
    if (op === "propose") {
      const documentPath = containedDocumentPath(field(payload, "documentPath"));
      const jsonPointer = field(payload, "jsonPointer");
      if (documentPath === null || typeof jsonPointer !== "string") {
        return bridgeRefuse(
          DESKTOP_BRIDGE_REFUSALS.requestMalformed,
          "authoring propose requires a jsonPointer string and a documentPath inside the project directory.",
        );
      }
      const snapshot: DesktopSnapshot = live.proposeEdit({
        documentPath,
        jsonPointer,
        newValue: field(payload, "newValue"),
      });
      return bridgeOk("authoring", snapshot);
    }
    if (op === "accept") return bridgeOk("authoring", live.accept());
    if (op === "reject") return bridgeOk("authoring", live.reject());
    if (op === "recover") return bridgeOk("authoring", live.refreshRecovery());
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
    if (route === "byo" && options.runByoAssistant === undefined) {
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
    const settleRuntimeFailure = (error: unknown): void => {
      if (assistantJob !== activeJob || activeJob.status !== "running") return;
      activeJob.status = "refused";
      activeJob.refusal = Object.freeze({
        ok: false as const,
        reason: DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed,
        message: "The configured assistant runner failed.",
        recoverable: true,
        detail: error instanceof Error ? error.message : String(error),
      });
    };
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
          activeJob.status = "refused";
          activeJob.refusal = result;
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
