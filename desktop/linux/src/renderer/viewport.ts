/**
 * The renderer-process live viewport: the desktop tier's one renderer-owning module.
 *
 * Runs inside the Engine Desktop chrome document in the packaged window. It asks
 * the main-process bridge for the composed `MountableScene` payload, mounts it on
 * the one Three presentation core through the ADR 0002 seam — exactly the calls the
 * umbrella's `sculpt-viewport.tsx` makes — and reports the real frame back over the
 * bridge so the packaged-app smoke test can see what was actually claimed.
 *
 * Honesty rules carried from the rest of the product:
 * - The chrome's `sceneaxi-pixels-drawn` meta is updated only from a real
 *   presentation frame's `pixelsDrawn`; nothing here asserts pixels it never drew.
 * - The frame report line prints the frame's own `surface`/`pixelsDrawn` fields.
 * - On any refusal the viewport names it in the report line and draws nothing.
 *
 * This file may not import Electron (enforced by `pnpm check:desktop`); it reaches
 * the main process only through the preload-exposed bridge global.
 */
import {
  createSculptMountApi,
  createThreeRenderLoop,
  createThreeSculptPresentationBackend,
  type SculptPresentationFrame,
} from "@sceneaxi/engine-presentation";
import { createDesktopAssistantViewportController } from "../lib/assistant-viewport.js";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_BRIDGE_GLOBAL,
  DESKTOP_BRIDGE_REFUSALS,
  DESKTOP_VIEWPORT_PLAY_EVENT,
  PIXELS_META_NAME,
  type DesktopAssistantJobSnapshot,
  type DesktopBridgeResponse,
} from "../lib/bridge-contract.js";
import {
  desktopMountablePayload,
  mountDesktopScene,
  synchronizeViewportScene,
} from "./viewport-playback.js";

type BridgeGlobal = {
  request(request: unknown): Promise<DesktopBridgeResponse>;
};

// A rejected bridge call is worth retrying — the next frame is milliseconds away —
// but a structural rejection (no handler on the channel, a payload that cannot be
// cloned) never recovers, and retrying it per frame would burn IPC for the life of
// the session. A few attempts, then the refusal stands on its own line.
const FRAME_REPORT_MAX_ATTEMPTS = 3;

const REPORT_ID = "desktop-live-viewport-report";
const OPEN_PATH_ID = "desktop-live-viewport-open-path";
const FRAME_REPORT_ID = "desktop-live-viewport-frame-report";

function bridge(): BridgeGlobal | null {
  const candidate = (globalThis as Record<string, unknown>)[DESKTOP_BRIDGE_GLOBAL];
  if (typeof candidate !== "object" || candidate === null) return null;
  const request = (candidate as Record<string, unknown>)["request"];
  return typeof request === "function" ? (candidate as BridgeGlobal) : null;
}

function overlayLine(host: Element, id: string, kind: string, bottom: string, text: string): void {
  let line = document.getElementById(id);
  if (line === null) {
    line = document.createElement("p");
    line.id = id;
    line.className = "viewport-note";
    line.setAttribute("data-live-viewport", kind);
    // An overlay above the canvas: absolute siblings paint in DOM order, and the
    // note must stay readable over whatever the frame drew.
    line.style.position = "absolute";
    line.style.left = "12px";
    line.style.right = "12px";
    line.style.bottom = bottom;
    line.style.margin = "0";
    line.style.textAlign = "left";
    line.style.maxWidth = "none";
    line.style.pointerEvents = "none";
    host.append(line);
  }
  line.textContent = text;
}

function reportLine(host: Element, text: string): void {
  overlayLine(host, REPORT_ID, "report", "8px", text);
}

// The frame report rewrites itself every 15 frames, so anything that happens after
// the render loop starts needs its own line or it is erased within ~250ms.
function openPathLine(host: Element, text: string): void {
  overlayLine(host, OPEN_PATH_ID, "open-path", "52px", text);
}

function frameReportLine(host: Element, text: string): void {
  overlayLine(host, FRAME_REPORT_ID, "frame-report", "96px", text);
}

function refusalText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function updatePixelsMeta(frame: SculptPresentationFrame): void {
  const meta = document.querySelector(`meta[name="${PIXELS_META_NAME}"]`);
  if (meta !== null && typeof frame.pixelsDrawn === "boolean") {
    meta.setAttribute("content", String(frame.pixelsDrawn));
  }
}

function frameText(frame: SculptPresentationFrame): string {
  return [
    `backend ${frame.backend}`,
    `label ${frame.label}`,
    `surface ${frame.surface ?? "unreported"}`,
    `pixelsDrawn ${frame.pixelsDrawn ?? "unreported"}`,
    `drawCalls ${frame.drawCalls}`,
    `mounted ${frame.instanceIds.join(", ") || "none"}`,
  ].join(" · ");
}

function signalAssistantRuntime(
  runtime: "none" | "local",
  message?: string,
): void {
  const shell = document.querySelector<HTMLElement>(".shell");
  const eventName = shell?.dataset.assistantRuntimeEvent;
  if (eventName === undefined) return;
  document.dispatchEvent(
    new CustomEvent(eventName, {
      detail: Object.freeze({
        runtime,
        ...(message === undefined ? {} : { message }),
      }),
    }),
  );
}

function signalAssistantRuntimeUnavailable(message: string): void {
  signalAssistantRuntime("none", message);
}

/**
 * One refusal, said in both places it has to be said: the viewport's own report
 * line, and the assistant composer that would otherwise still invite a prompt it
 * has no runtime to answer.
 */
function refuseLiveViewport(stage: Element | null, message: string): void {
  if (stage !== null) reportLine(stage, `Live viewport refused: ${message}`);
  signalAssistantRuntimeUnavailable(
    `${message} Assistant Build has no live viewport to mount a typed artifact into.`,
  );
}

function assistantProfile(shell: HTMLElement): `@sceneaxi/profile-${string}` {
  const id = shell.dataset.profile;
  return `@sceneaxi/profile-${id === "web" ? "web" : id === "kids" ? "kids" : "game"}`;
}

function inspectionText(job: DesktopAssistantJobSnapshot): string {
  const inspection = job.result?.inspection;
  if (inspection === undefined) return "";
  const materials = inspection.materials.values
    .map(
      (material) =>
        `${material.id}: ${material.baseColor}, metal ${material.metallic}, rough ${material.roughness}`,
    )
    .join("\n");
  const physics = inspection.physics.supported
    ? inspection.physics.colliders
        .map((collider) => `${collider.id}: ${collider.shape} collider`)
        .join("\n")
    : `${inspection.physics.reason}: ${inspection.physics.message}`;
  const settings = inspection.settings.proceduralModule;
  return [
    "MATERIALS (read-only)",
    materials || "none",
    "",
    "PHYSICS (read-only)",
    physics || "none",
    "",
    "SETTINGS (read-only)",
    `${settings.moduleId} · ${settings.exportName}`,
    inspection.settings.edit.refusal,
  ].join("\n");
}

function installAssistantProductFlow(
  stage: Element,
  port: BridgeGlobal,
  mounts: ReturnType<typeof createSculptMountApi>,
  backend: ReturnType<typeof createThreeSculptPresentationBackend>,
): boolean {
  const shell = document.querySelector<HTMLElement>(".shell");
  const prompt = document.querySelector<HTMLTextAreaElement>("#assistant-prompt");
  const send = document.querySelector<HTMLElement>("#assistant-send");
  const status = document.querySelector<HTMLElement>("[data-assistant-status]");
  const resultView = document.querySelector<HTMLElement>("[data-assistant-result]");
  const retry = document.querySelector<HTMLButtonElement>("#assistant-retry");
  const manipulatorBar = stage.querySelector<HTMLElement>("[data-assistant-manipulators]");
  const sendControls = Array.from(
    document.querySelectorAll<HTMLElement>("[data-action='assistant-send']"),
  );
  const manipulatorControls = Array.from(
    manipulatorBar?.querySelectorAll<HTMLButtonElement>(
      "[data-action='assistant-manipulator']",
    ) ?? [],
  );
  if (
    shell === null ||
    prompt === null ||
    send === null ||
    status === null ||
    resultView === null ||
    retry === null ||
    manipulatorBar === null ||
    sendControls.length === 0 ||
    !sendControls.includes(send) ||
    !sendControls.includes(retry) ||
    manipulatorControls.length === 0
  ) {
    return false;
  }
  let running = false;
  const assistantViewport = createDesktopAssistantViewportController(mounts);

  manipulatorControls.forEach((control) => {
    control.addEventListener("click", () => {
      if (control.getAttribute("aria-disabled") === "true") return;
      assistantViewport.manipulate(control.dataset.value);
    });
  });

  const refused = (reason: string, message: string): void => {
    running = false;
    status.textContent = `${reason} — ${message}`;
    retry?.removeAttribute("hidden");
  };

  const poll = async (): Promise<void> => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const response = await port.request({ action: "assistant", payload: { op: "status" } });
      if (!response.ok) {
        refused(response.reason, response.message);
        return;
      }
      const job = response.data as DesktopAssistantJobSnapshot | null;
      if (job === null) {
        refused(
          DESKTOP_BRIDGE_REFUSALS.assistantJobMissing,
          "The assistant job disappeared; retry the prompt.",
        );
        return;
      }
      const latest = job.latestProgress;
      if (latest !== null) status.textContent = `${latest.percent}% · ${latest.message}`;
      if (job.status === "refused") {
        refused(
          job.refusal?.reason ?? DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed,
          job.refusal === undefined
            ? "The assistant action refused."
            : `${job.refusal.message}${job.refusal.detail === undefined ? "" : ` — ${job.refusal.detail}`}`,
        );
        return;
      }
      if (job.status === "ready" && job.result !== undefined) {
        assistantViewport.replace(job.result.mountable);
        backend.frameMountedContent();
        manipulatorBar?.removeAttribute("hidden");
        resultView.textContent = inspectionText(job);
        resultView.removeAttribute("hidden");
        retry?.setAttribute("hidden", "");
        status.textContent =
          "Mounted in the live center viewport · translate/rotate/scale manipulators active · drag to orbit, wheel to zoom.";
        running = false;
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await port.request({ action: "assistant", payload: { op: "abandon" } });
    refused(
      DESKTOP_BRIDGE_REFUSALS.assistantStatusTimeout,
      "The assistant job did not finish in time; it was abandoned and Retry may start a fresh job.",
    );
  };

  const start = async (): Promise<void> => {
    if (running) return;
    if (shell.dataset.assistantMode !== "build") {
      refused(
        DESKTOP_BRIDGE_REFUSALS.assistantBuildModeRequired,
        "Choose Build mode to produce and mount a typed Sculpt Artifact; Ask and Agent are not implemented by this first-release flow.",
      );
      return;
    }
    const value = prompt.value.trim();
    if (value.length === 0) {
      refused("ASSISTANT_SCULPT_PROMPT_INVALID", "Enter a prompt before sending.");
      return;
    }
    running = true;
    retry?.setAttribute("hidden", "");
    resultView.setAttribute("hidden", "");
    status.textContent = "Starting assistant action…";
    const response = await port.request({
      action: "assistant",
      payload: {
        op: "start",
        route: shell.dataset.assistantRoute ?? "local",
        profile: assistantProfile(shell),
        prompt: value,
      },
    });
    if (!response.ok) {
      refused(response.reason, response.message);
      return;
    }
    await poll();
  };

  sendControls.forEach((control) => {
    control.addEventListener("click", () => {
      if (control.getAttribute("aria-disabled") === "true") return;
      void start().catch((error: unknown) =>
        refused(DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed, refusalText(error)),
      );
    });
  });
  return true;
}

async function mountLiveViewport(): Promise<void> {
  const stage = document.querySelector<HTMLElement>(".viewport");
  if (stage === null) {
    refuseLiveViewport(null, "the chrome document has no viewport stage.");
    return;
  }

  const port = bridge();
  if (port === null) {
    refuseLiveViewport(stage, "the desktop bridge is not exposed.");
    return;
  }

  const sceneResponse = await port.request({
    action: "scene",
    payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
  });
  if (!sceneResponse.ok) {
    refuseLiveViewport(stage, `${sceneResponse.reason} — ${sceneResponse.message}`);
    return;
  }
  if (!desktopMountablePayload(sceneResponse.data)) {
    refuseLiveViewport(stage, "the active Scene Document payload is invalid.");
    return;
  }
  let scene = sceneResponse.data;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("data-live-viewport", "canvas");
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  const width = Math.max(1, stage.clientWidth);
  const height = Math.max(1, stage.clientHeight);
  canvas.width = width;
  canvas.height = height;
  // Painted above the decorative backdrop, below the notes and the sculpt
  // progress region — absolute siblings stack in DOM order, so position matters.
  const backdrop = stage.querySelector(".viewport-backdrop");
  if (backdrop !== null) backdrop.insertAdjacentElement("afterend", canvas);
  else stage.prepend(canvas);

  let backend: ReturnType<typeof createThreeSculptPresentationBackend>;
  try {
    backend = createThreeSculptPresentationBackend({
      canvas,
      // Transparent clear: the chrome's own viewport gradient stays visible
      // behind the mounted scene instead of a second background fighting it.
      background: null,
      viewport: {
        width,
        height,
        pixelRatio: Math.min(globalThis.devicePixelRatio || 1, 2),
      },
    });
  } catch (error) {
    canvas.remove();
    refuseLiveViewport(stage, `no WebGL surface — ${refusalText(error)}`);
    return;
  }

  const mounts = createSculptMountApi(backend);
  try {
    mountDesktopScene(mounts, scene);
    backend.frameMountedContent();
    backend.camera.attach(canvas);
  } catch (error) {
    mounts.dispose();
    canvas.remove();
    refuseLiveViewport(stage, `could not mount the composed scene — ${refusalText(error)}`);
    return;
  }

  // The drawing buffer was sized once from the stage; the window is resizable and
  // the canvas is CSS-stretched, so without this a resize scales a stale buffer.
  const applyViewport = (): void => {
    backend.resize(
      Math.max(1, stage.clientWidth),
      Math.max(1, stage.clientHeight),
      Math.min(globalThis.devicePixelRatio || 1, 2),
    );
  };
  if (typeof ResizeObserver === "function") new ResizeObserver(applyViewport).observe(stage);

  // The chrome's inert note says no renderer is mounted on this surface. That
  // was true until this line, so leaving it visible would be the lie — remove it
  // only now that a real backend owns the canvas. On any refusal above, it stays.
  stage.querySelector(".viewport-note-inert")?.remove();

  let printed = false;
  let frameReportSettled = false;
  let frameReportInFlight = false;
  let frameReportAttempts = 0;
  const loop = createThreeRenderLoop({
    onFrame: () => {
      const frame = mounts.render();
      updatePixelsMeta(frame);
      if (!printed || frame.frame % 15 === 0) {
        printed = true;
        reportLine(stage, `${frameText(frame)} · scene ${scene.sceneId}`);
      }
      if (!frameReportSettled && !frameReportInFlight) {
        frameReportInFlight = true;
        frameReportAttempts += 1;
        port.request({ action: "frame-report", payload: frame }).then(
          (response) => {
            frameReportInFlight = false;
            frameReportSettled = true;
            if (!response.ok) {
              frameReportLine(
                stage,
                `frame report refused: ${response.reason} — ${response.message}`,
              );
            }
          },
          (error: unknown) => {
            frameReportInFlight = false;
            const exhausted = frameReportAttempts >= FRAME_REPORT_MAX_ATTEMPTS;
            frameReportSettled = exhausted;
            frameReportLine(
              stage,
              `frame report refused: ${refusalText(error)} — ${
                exhausted
                  ? `giving up after ${frameReportAttempts} attempts`
                  : `retrying (attempt ${frameReportAttempts} of ${FRAME_REPORT_MAX_ATTEMPTS})`
              }`,
            );
          },
        );
      }
    },
  });
  loop.start();
  const assistantBound = installAssistantProductFlow(stage, port, mounts, backend);
  if (assistantBound) {
    signalAssistantRuntime("local");
  } else {
    signalAssistantRuntimeUnavailable(
      "the assistant controls could not be bound to the mounted presentation runtime.",
    );
  }

  document.addEventListener(DESKTOP_VIEWPORT_PLAY_EVENT, (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as {
      accepted?: unknown;
      exercise?: {
        closed?: unknown;
        initialDigest?: unknown;
        tickDigests?: unknown;
        mountable?: unknown;
      };
      frame?: unknown;
    } | null;
    const exercise = detail?.exercise;
    if (
      detail === null ||
      exercise?.closed !== true ||
      typeof exercise.initialDigest !== "string" ||
      !Array.isArray(exercise.tickDigests) ||
      exercise.tickDigests.length === 0 ||
      !exercise.tickDigests.every((digest) => typeof digest === "string") ||
      !desktopMountablePayload(exercise.mountable)
    ) {
      return;
    }
    const synchronized = synchronizeViewportScene({
      mounts,
      frameMountedContent: () => backend.frameMountedContent(),
      current: scene,
      next: exercise.mountable,
    });
    if (!synchronized.ok) return;
    scene = synchronized.scene;
    const frame = mounts.render();
    updatePixelsMeta(frame);
    detail.accepted = true;
    detail.frame = frame.frame;
    stage.dataset.playback = "acknowledged";
    openPathLine(
      stage,
      `kernel playback acknowledged: ${exercise.tickDigests.length} ticks advanced · digest ${exercise.initialDigest.slice(0, 18)}… → ${exercise.tickDigests.at(-1)?.slice(0, 18)}… · composed scene redrawn at viewport frame ${frame.frame}`,
    );
  });

  // Everything below runs after `loop.start()`, so it names itself on its own line
  // — a refusal written to the frame report would be overwritten by the next frame.
  try {
    const openPath = await port.request({
      action: "open-path",
      payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    if (openPath.ok) {
      const exercise = openPath.data as { initialDigest: string; tickDigests: string[] };
      openPathLine(
        stage,
        `kernel open path: ${exercise.tickDigests.length} ticks advanced · digest ${exercise.initialDigest.slice(0, 18)}… → ${exercise.tickDigests[exercise.tickDigests.length - 1]?.slice(0, 18)}… · session closed`,
      );
    } else {
      openPathLine(stage, `kernel open path refused: ${openPath.reason} — ${openPath.message}`);
    }
  } catch (error) {
    openPathLine(stage, `kernel open path refused: ${refusalText(error)}`);
  }
}

// A bridge call rejects whenever the main-process handler throws rather than
// refusing by name; without this the canvas would already be in the DOM and the
// only trace would be an unhandled rejection, so the surface names it instead.
function startLiveViewport(): void {
  void mountLiveViewport().catch((error: unknown) => {
    refuseLiveViewport(document.querySelector(".viewport"), refusalText(error));
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startLiveViewport);
} else {
  startLiveViewport();
}
