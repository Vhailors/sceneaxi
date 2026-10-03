import { isJsonObject } from "@sceneaxi/schemas";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_VIEWPORT_SCENE_OPEN_EVENT,
} from "../../lib/bridge-contract.js";
import { desktopMountablePayload, synchronizeViewportScene } from "../viewport-playback.js";
import type { ViewportServices } from "./services.js";

export function synchronizeScene<Input>(services: ViewportServices, next: Input): boolean {
    if (services.signal?.aborted) return false;

  const synchronized = synchronizeViewportScene({
    mounts: services.mounts,
    frameMountedContent: services.frameMountedContent,
    current: services.scene,
    next,
    triangleBackend: services.backend,
  });

  if (!synchronized.ok) return false;
  services.scene = synchronized.scene;

  return true;
}

export async function refreshViewportScene(services: ViewportServices): Promise<void> {
    if (services.signal?.aborted) return;

  const nextScene = await services.request({
    action: "scene",
    payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
  });

  if (services.signal?.aborted) return;

  if (nextScene.ok) synchronizeScene(services, nextScene.data);
}

export function installSceneSync(
  services: ViewportServices,
  stopAudio: () => void,
  resetAnimation: () => void,
): void {
  document.addEventListener(DESKTOP_VIEWPORT_SCENE_OPEN_EVENT, (event: Event) => {
    if (services.signal?.aborted) return;
    stopAudio();

    if (!(event instanceof CustomEvent)) return;
    services.report.reportNextFrame();

    const detail = event.detail;

    if (
      !isJsonObject(detail) ||
      !isJsonObject(detail.asset) ||
      !isText(detail.asset.instanceId) ||
      !isText(detail.asset.digest) ||
      !desktopMountablePayload(detail.mountable) ||
      !detail.mountable.instances.some((instance) =>
        instance.instanceId === (isJsonObject(detail.asset) ? detail.asset.instanceId : null)) ||
      !detail.mountable.importedAssets?.some((asset) =>
        isJsonObject(detail.asset) && asset.instanceId === detail.asset.instanceId && asset.digest === detail.asset.digest)
    ) return;

    if (!synchronizeScene(services, detail.mountable)) return;
    resetAnimation();
    services.inputContext = "editor";
    const frame = services.mounts.render();
    services.report.updatePixelsMeta(frame);
    Object.defineProperty(detail, "accepted", { value: true, writable: true, configurable: true, enumerable: true });
    Object.defineProperty(detail, "frame", { value: frame.frame, writable: true, configurable: true, enumerable: true });
    services.stage.dataset.assetOpen = detail.asset.instanceId;
    services.stage.dataset.assetDigest = detail.asset.digest;
    services.report.openPathLine(
      `asset ${detail.asset.instanceId} opened through the canonical scene at viewport frame ${frame.frame}`,
    );
  }, services.signal === undefined ? undefined : { signal: services.signal });
}

function isText(value: unknown): value is string { return typeof value === "string"; }
