import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_VIEWPORT_SCENE_OPEN_EVENT,
} from "../../lib/bridge-contract.js";
import { desktopMountablePayload, synchronizeViewportScene } from "../viewport-playback.js";
import type { ViewportServices } from "./services.js";

export function synchronizeScene(services: ViewportServices, next: unknown): boolean {
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
  const nextScene = await services.request({
    action: "scene",
    payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
  });
  if (nextScene.ok) synchronizeScene(services, nextScene.data);
}

export function installSceneSync(
  services: ViewportServices,
  stopAudio: () => void,
  resetAnimation: () => void,
): void {
  document.addEventListener(DESKTOP_VIEWPORT_SCENE_OPEN_EVENT, (event: Event) => {
    stopAudio();
    if (!(event instanceof CustomEvent)) return;
    services.report.reportNextFrame();
    const detail = event.detail as {
      mountable?: unknown;
      asset?: { instanceId?: unknown; digest?: unknown };
      accepted?: unknown;
      frame?: unknown;
    } | null;
    if (
      detail === null ||
      typeof detail.asset?.instanceId !== "string" ||
      typeof detail.asset.digest !== "string" ||
      !desktopMountablePayload(detail.mountable) ||
      !detail.mountable.instances.some((instance) =>
        instance.instanceId === detail.asset?.instanceId) ||
      !detail.mountable.importedAssets?.some((asset) =>
        asset.instanceId === detail.asset?.instanceId && asset.digest === detail.asset.digest)
    ) return;
    if (!synchronizeScene(services, detail.mountable)) return;
    resetAnimation();
    services.inputContext = "editor";
    const frame = services.mounts.render();
    services.report.updatePixelsMeta(frame);
    detail.accepted = true;
    detail.frame = frame.frame;
    services.stage.dataset.assetOpen = detail.asset.instanceId;
    services.stage.dataset.assetDigest = detail.asset.digest;
    services.report.openPathLine(
      `asset ${detail.asset.instanceId} opened through the canonical scene at viewport frame ${frame.frame}`,
    );
  });
}
