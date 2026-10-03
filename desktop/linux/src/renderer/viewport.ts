/**
 * The renderer-process live viewport: the desktop tier's one renderer-owning module.
 *
 * Presentation values enter only here. Feature installers receive the same backend,
 * mounts and bridge request through ViewportServices; no feature owns a renderer.
 * Pixels and frame reports always come from the real presentation frame.
 * This file may not import Electron; it uses the preload-exposed bridge global.
 */
import {
  createAudioPlaybackPort,
  createSculptMountApi,
  createThreeRenderLoop,
  createThreeSculptPresentationBackend,
  type ThreePresentationCoreOptions, releaseThreeCanvas } from "@sceneaxi/engine-presentation";
import { DEFAULT_INPUT_ACTION_MAP, isJsonObject, validateInputActionMap } from "@sceneaxi/schemas";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
} from "../lib/bridge-contract.js";
import { desktopMountablePayload, mountDesktopScene } from "./viewport-playback.js";
import { installDesktopByoConfigurationSurface } from "./byo-configuration.js";
import { installCameraInput } from "./features/camera-input.js";
import { installPlayInput } from "./features/play-input.js";
import { installSelection } from "./features/selection.js";
import { installGizmo } from "./features/gizmo.js";
import { installSceneSync } from "./features/scene-sync.js";
import {
  installOverlayReport,
  openPathLine,
  reportLine,
  refusalText,
} from "./features/overlay-report.js";
import {
  installAssistantFlow,
  signalAssistantRuntimeUnavailable,
} from "./features/assistant-flow.js";
import { installPlayLoop } from "./features/play-loop.js";
import { installAudioControls, installDesktopAudioProfileBoundary } from "./features/audio-playback.js";
import type { BridgeGlobal, ViewportServices } from "./features/services.js";

export { attachDesktopViewportInputActions } from "./features/camera-input.js";

export { createDesktopGamepadInputPoller, dispatchDesktopPlayInput } from "./features/play-input.js";

export { installAssistantProductFlow } from "./features/assistant-flow.js";

function bridge(): BridgeGlobal | null {
  const candidate = globalThis.sceneaxiDesktopLinux;

  return isBridgeGlobal(candidate) ? candidate : null;
}

/** Refuse both the viewport and the assistant that needs it to mount output. */
function refuseLiveViewport(stage: Element | null, message: string): void {
  if (stage !== null) reportLine(stage, `Live viewport refused: ${message}`);
  signalAssistantRuntimeUnavailable(
    `${message} Assistant Build has no live viewport to mount a typed artifact into.`,
  );
}

export function createDesktopPresentationBackend(
  options: ThreePresentationCoreOptions = {},
) {
  return createThreeSculptPresentationBackend(options);
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

  const lifetime = new AbortController();
  const cleanup: Array<() => void> = [];
  let mounted = false;

  const dispose = (): void => {
    if (lifetime.signal.aborted) return;
    lifetime.abort();
    const failures: unknown[] = [];

    for (const release of cleanup.reverse()) {
      try { release(); } catch (cause) { failures.push(cause); }
    }

    if (failures.length > 0) throw new AggregateError(failures, "Viewport cleanup failed");
  };

  const pagehide = (): void => {
    try { dispose(); } catch (cause) { refuseLiveViewport(stage, refusalText(cause)); }
  };

  window.addEventListener("pagehide", pagehide, { once: true });
  cleanup.push(() => window.removeEventListener("pagehide", pagehide));
  let stopAudio: () => void = () => undefined;
  const audioBoundary = installDesktopAudioProfileBoundary(document, () => stopAudio());
  cleanup.push(() => audioBoundary.dispose());

  try {
    let inputActionMap = DEFAULT_INPUT_ACTION_MAP;

    if (port.inputActions !== undefined) {
      const inspection = await port.inputActions();

      if (lifetime.signal.aborted) return;

      if (inspection.ok !== true || !isJsonObject(inspection.data) || !("map" in inspection.data)) {
        refuseLiveViewport(stage, "the persisted input-action map was refused.");

        return;
      }

      const parsedMap = validateInputActionMap(inspection.data.map);

        if (parsedMap === null) {
          refuseLiveViewport(stage, "the persisted input-action map is malformed.");

          return;
        }

        inputActionMap = parsedMap;
    }

    if (!installDesktopByoConfigurationSurface(port, { signal: lifetime.signal })) {
      openPathLine(stage, "BYOK configuration refused: the chrome document did not expose the assistant route controls the configuration surface binds to.");
    }

    const sceneResponse = await port.request({ action: "scene", payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH } });

    if (lifetime.signal.aborted) return;

    if (!sceneResponse.ok) {
      refuseLiveViewport(stage, `${sceneResponse.reason} — ${sceneResponse.message}`);

      return;
    }

    if (!desktopMountablePayload(sceneResponse.data)) {
      refuseLiveViewport(stage, "the active Scene Document payload is invalid.");

      return;
    }

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
    const backdrop = stage.querySelector(".viewport-backdrop");

    if (backdrop !== null) backdrop.insertAdjacentElement("afterend", canvas);
    else stage.prepend(canvas);
    cleanup.push(() => canvas.remove());
    cleanup.push(() => releaseThreeCanvas(canvas));
    let backend: ReturnType<typeof createThreeSculptPresentationBackend>;

    try {
      backend = createDesktopPresentationBackend({ canvas, background: null, viewport: { width, height, pixelRatio: Math.min(globalThis.devicePixelRatio || 1, 2) } });
    } catch (cause) {
      refuseLiveViewport(stage, `no WebGL surface — ${refusalText(cause)}`);

      return;
    }

    const mounts = createSculptMountApi(backend);
    cleanup.push(() => mounts.dispose());
    const frameCallbacks: Array<() => void> = [];
    cleanup.push(() => { frameCallbacks.length = 0; });

    const request: BridgeGlobal["request"] = async (input) => {
      if (lifetime.signal.aborted) throw new Error("DESKTOP_VIEWPORT_DISPOSED");
      const result = await port.request(input);

      if (lifetime.signal.aborted) throw new Error("DESKTOP_VIEWPORT_DISPOSED");

      return result;
    };

    const services: ViewportServices = {
      stage, canvas, backend, mounts,
      signal: lifetime.signal,
      request,
      inputActionMap,
      inputContext: "editor",
      scene: sceneResponse.data,
      onFrame: (callback) => { if (!lifetime.signal.aborted) frameCallbacks.push(callback); },
      frameMountedContent: () => { if (!lifetime.signal.aborted) backend.frameMountedContent(); },
      report: installOverlayReport(stage, request, lifetime.signal),
      createAudioPlaybackPort, createSculptMountApi, createThreeRenderLoop,
    };

    installPlayInput(services);

    try {
      const scene = mountDesktopScene(mounts, services.scene, backend);

      for (const id of scene.refusedMaterialOverrides) services.report.reportLine(`Material override refused for "${id}": texture asset binding is unresolved (ADR 0026).`);
      services.frameMountedContent();
      cleanup.push(installCameraInput(services));
      installSelection(services);
      installGizmo(services);
    } catch (cause) {
      refuseLiveViewport(stage, `could not mount the composed scene — ${refusalText(cause)}`);

      return;
    }

    const applyViewport = (): void => {
      if (lifetime.signal.aborted) return;
      backend.resize(Math.max(1, stage.clientWidth), Math.max(1, stage.clientHeight), Math.min(globalThis.devicePixelRatio || 1, 2));
    };

    if (isCallable(globalThis.ResizeObserver)) {
      const observer = new ResizeObserver(applyViewport);
      cleanup.push(() => observer.disconnect());
      observer.observe(stage);
    }

    stage.querySelector(".viewport-note-inert")?.remove();

    const loop = createThreeRenderLoop({ onFrame: () => {
      if (lifetime.signal.aborted) return;

      for (const callback of frameCallbacks) callback();

      if (services.scene.effects !== undefined) backend.sampleEffects(services.scene.effects, performance.now());
      const frame = mounts.render();
      services.report.reportFrame(frame, services.scene.sceneId);
    } });

    cleanup.push(() => loop.stop());
    loop.start();
    installAssistantFlow(services);
    const audio = installAudioControls(services, { getProfile: audioBoundary.getProfile });
    stopAudio = audio.stop;
    cleanup.push(() => audio.stop());
    const play = installPlayLoop(services, audio);
    installSceneSync(services, audio.stop, play.resetAnimation);
    await play.openPath();

    if (!lifetime.signal.aborted) mounted = true;
  } catch (cause) {
    // Readiness IPC can reject after pagehide, before services.request exists.
    // It is cancellation, not a refusal to paint into a dead viewport.
    if (!lifetime.signal.aborted) throw cause;
  } finally {
    if (!mounted) dispose();
  }
}

// A thrown bridge call must leave a named refusal, not an unhandled rejection.
function startLiveViewport(): void {
  void mountLiveViewport().catch((error) => {
    refuseLiveViewport(document.querySelector(".viewport"), refusalText(error));
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startLiveViewport);
  } else {
    startLiveViewport();
  }
}

export { createDesktopAudioLifecycle, type DesktopAudioLifecycleOptions, type DesktopAudioClip } from "./features/audio-playback.js";

function isCallable<Input>(value: Input): value is Input & ((...args: never[]) => void) {
  try {
    Function.prototype.toString.call(value);

    return true;
  } catch {
    return false;
  }
}

function isBridgeGlobal(value: BridgeGlobal | undefined): value is BridgeGlobal {
  return isJsonObject(value) && isCallable(value.request) && (value.inputActions === undefined || isCallable(value.inputActions)) && (value.configureByo === undefined || isCallable(value.configureByo));
}

declare global { var sceneaxiDesktopLinux: BridgeGlobal | undefined; }
