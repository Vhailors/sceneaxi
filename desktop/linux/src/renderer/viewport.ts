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
  type ThreePresentationCoreOptions,
} from "@sceneaxi/engine-presentation";
import { DEFAULT_INPUT_ACTION_MAP, type InputActionMap } from "@sceneaxi/schemas";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_BRIDGE_GLOBAL,
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
import { installAudioControls } from "./features/audio-controls.js";
import type { BridgeGlobal, ViewportServices } from "./features/services.js";

export { attachDesktopViewportInputActions } from "./features/camera-input.js";
export { createDesktopGamepadInputPoller, dispatchDesktopPlayInput } from "./features/play-input.js";
export { installAssistantProductFlow } from "./features/assistant-flow.js";

function bridge(): BridgeGlobal | null {
  const candidate = (globalThis as Record<string, unknown>)[DESKTOP_BRIDGE_GLOBAL];
  if (typeof candidate !== "object" || candidate === null) return null;
  const request = (candidate as Record<string, unknown>)["request"];
  return typeof request === "function" ? (candidate as BridgeGlobal) : null;
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
  let inputActionMap = DEFAULT_INPUT_ACTION_MAP;
  if (port.inputActions !== undefined) {
    const inspection = await port.inputActions();
    if (typeof inspection !== "object" || inspection === null ||
      !("ok" in inspection) || inspection.ok !== true || !("data" in inspection) ||
      typeof inspection.data !== "object" || inspection.data === null ||
      !("map" in inspection.data)) {
      refuseLiveViewport(stage, "the persisted input-action map was refused.");
      return;
    }
    inputActionMap = inspection.data.map as InputActionMap;
  }
  const byoConfigurationBound = installDesktopByoConfigurationSurface(port);
  if (!byoConfigurationBound) {
    openPathLine(
      stage,
      "BYOK configuration refused: the chrome document did not expose the assistant route controls the configuration surface binds to.",
    );
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
  // Painted above the decorative backdrop, below the notes and sculpt progress.
  const backdrop = stage.querySelector(".viewport-backdrop");
  if (backdrop !== null) backdrop.insertAdjacentElement("afterend", canvas);
  else stage.prepend(canvas);

  let backend: ReturnType<typeof createThreeSculptPresentationBackend>;
  try {
    backend = createDesktopPresentationBackend({
      canvas,
      // Keep the chrome's viewport gradient visible behind the mounted scene.
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
  const frameCallbacks: Array<() => void> = [];
  const services: ViewportServices = {
    stage,
    canvas,
    backend,
    mounts,
    request: (request) => port.request(request),
    inputActionMap,
    inputContext: "editor",
    scene: sceneResponse.data,
    onFrame: (callback) => { frameCallbacks.push(callback); },
    frameMountedContent: () => backend.frameMountedContent(),
    report: installOverlayReport(stage, (request) => port.request(request)),
    createAudioPlaybackPort,
    createSculptMountApi,
    createThreeRenderLoop,
  };
  installPlayInput(services);
  try {
    const mounted = mountDesktopScene(mounts, services.scene, backend);
    for (const instanceId of mounted.refusedMaterialOverrides) {
      services.report.reportLine(`Material override refused for "${instanceId}": texture asset binding is unresolved (ADR 0026).`);
    }
    services.frameMountedContent();
    installCameraInput(services);
    installSelection(services);
    installGizmo(services);
  } catch (error) {
    mounts.dispose();
    canvas.remove();
    refuseLiveViewport(stage, `could not mount the composed scene — ${refusalText(error)}`);
    return;
  }

  // Resize the drawing buffer as well as the CSS-stretched canvas.
  const applyViewport = (): void => {
    backend.resize(
      Math.max(1, stage.clientWidth),
      Math.max(1, stage.clientHeight),
      Math.min(globalThis.devicePixelRatio || 1, 2),
    );
  };
  if (typeof ResizeObserver === "function") new ResizeObserver(applyViewport).observe(stage);

  // Only remove the inert note once a real backend owns the canvas.
  stage.querySelector(".viewport-note-inert")?.remove();

  const loop = createThreeRenderLoop({
    onFrame: () => {
      for (const callback of frameCallbacks) callback();
      if (services.scene.effects !== undefined) backend.sampleEffects(services.scene.effects, performance.now());
      const frame = mounts.render();
      services.report.reportFrame(frame, services.scene.sceneId);
    },
  });
  loop.start();
  installAssistantFlow(services);
  const audio = installAudioControls(services);
  const play = installPlayLoop(services, audio);
  installSceneSync(services, audio.stop, play.resetAnimation);
  await play.openPath();
}

// A thrown bridge call must leave a named refusal, not an unhandled rejection.
function startLiveViewport(): void {
  void mountLiveViewport().catch((error: unknown) => {
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
