/**
 * The desktop bridge: the real engine stack behind one synchronous `handle()`.
 *
 * Mirrors web-shell's inspector app deliberately — a transport-free request handler
 * the Electron main process adapts onto `ipcMain.handle` in a few lines — so every
 * decision here is provable in `pnpm gate` with no Electron install and no window.
 *
 * What each action reaches, and reaches only through the public seams:
 *
 * - `scene`        → `composeScene()` via `desktopOpenScene()` — the shared
 *                    `MountableScene` browser payload the renderer viewport mounts.
 * - `open-path`    → `bootstrapOpenPath()` from `@sceneaxi/engine-orchestrator`
 *                    over the same composition: a real kernel scene session is
 *                    opened, advanced, observed, and closed, and the deterministic
 *                    bootstrap record plus observed digests are what come back.
 * - `authoring`    → `createDesktopSession()` from `@sceneaxi/desktop-shell` — the
 *                    same propose/accept protocol layer as the CLI and web-shell,
 *                    never a second editor state machine.
 * - `frame-report` → accepts the renderer's real presentation frame report so the
 *                    main process (and the packaged-app smoke test) can see what the
 *                    viewport actually claimed. The bridge never invents one.
 *
 * The bridge holds no session across calls: `open-path` closes what it opens, and
 * the authoring session is the one long-lived piece of state, exactly as in the
 * desktop shell it wraps. Kids has no path here: the bridge names no profile, and
 * the chrome's refuse-only Kids projection stays owned by `@sceneaxi/desktop-shell`.
 */
import {
  createDesktopSession,
  type DesktopSession,
  type DesktopSnapshot,
} from "@sceneaxi/desktop-shell";
import { bootstrapOpenPath } from "@sceneaxi/engine-orchestrator";
import {
  DESKTOP_BRIDGE_ACTIONS,
  DESKTOP_BRIDGE_AUTHORING_OPS,
  DESKTOP_BRIDGE_REFUSALS,
  bridgeOk,
  bridgeRefuse,
  type DesktopBridgeAction,
  type DesktopBridgeAuthoringOp,
  type DesktopBridgeHandshake,
  type DesktopBridgeResponse,
  type DesktopFrameReport,
} from "./bridge-contract.js";
import { desktopOpenScene } from "./desktop-scene.js";

export type DesktopBridgeOptions = {
  /** Working directory the authoring session binds to. */
  readonly cwd: string;
  /** Integer-millisecond clock for the orchestrator host. Injectable for goldens. */
  readonly nowMs?: () => number;
  /** Observer for renderer frame reports (the smoke path listens here). */
  readonly onFrameReport?: (report: DesktopFrameReport) => void;
};

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
  readonly closed: true;
};

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

  const openPathExercise = (): DesktopBridgeResponse => {
    const scene = desktopOpenScene();
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

    const initial = live.value.observe();
    const tickDigests: string[] = [];
    for (let tick = 1; tick <= OPEN_PATH_EXERCISE_TICKS; tick += 1) {
      live.value.advance({ tick, deltaMs: 100 });
      tickDigests.push(live.value.observe().digest);
    }
    const instanceCount = initial.instances.length;
    handle.close();

    const exercise: OpenPathExercise = Object.freeze({
      bootstrap: handle.bootstrap,
      initialDigest: initial.digest,
      tickDigests: Object.freeze(tickDigests),
      instanceCount,
      closed: true as const,
    });
    return bridgeOk("open-path", exercise);
  };

  const authoring = (payload: unknown): DesktopBridgeResponse => {
    const op = field(payload, "op");
    if (!isAuthoringOp(op)) {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.authoringOpUnknown,
        `Unknown authoring operation ${JSON.stringify(op)}. Known: ${DESKTOP_BRIDGE_AUTHORING_OPS.join(", ")}.`,
      );
    }
    const live = authoringSession();
    if (op === "status") {
      const documentPath = field(payload, "documentPath");
      if (typeof documentPath !== "string" || documentPath.length === 0) {
        return bridgeRefuse(
          DESKTOP_BRIDGE_REFUSALS.requestMalformed,
          "authoring status requires a documentPath string.",
        );
      }
      return bridgeOk("authoring", live.status(documentPath));
    }
    if (op === "propose") {
      const documentPath = field(payload, "documentPath");
      const jsonPointer = field(payload, "jsonPointer");
      if (typeof documentPath !== "string" || typeof jsonPointer !== "string") {
        return bridgeRefuse(
          DESKTOP_BRIDGE_REFUSALS.requestMalformed,
          "authoring propose requires documentPath and jsonPointer strings.",
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
    return bridgeOk("authoring", live.undo());
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
        const scene = desktopOpenScene();
        if (!scene.ok) return bridgeRefuse(scene.reason, scene.message);
        return bridgeOk("scene", scene.mountable);
      }
      case "open-path":
        return openPathExercise();
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
