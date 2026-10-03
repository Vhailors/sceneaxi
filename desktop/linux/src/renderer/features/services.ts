import type {
  createAudioPlaybackPort,
  createSculptMountApi,
  createThreeRenderLoop,
  SculptMountApi,
  ThreeSculptPresentationBackend,
} from "@sceneaxi/engine-presentation";
import type { InputActionContext, InputActionMap, isJsonObject } from "@sceneaxi/schemas";
import type { DesktopBridgeResponse } from "../../lib/bridge-contract.js";
import type {
  DesktopByoConfigurationRequest,
  DesktopByoConfigurationResponse,
} from "../../lib/byo-configuration-contract.js";
import type { DesktopMountablePayload } from "../viewport-playback.js";
import type { installOverlayReport } from "./overlay-report.js";

export type BridgeGlobal = {
  request(request: Parameters<typeof isJsonObject>[0]): Promise<DesktopBridgeResponse>;
  inputActions?(): Promise<DesktopBridgeResponse>;
  configureByo?: (
    request: DesktopByoConfigurationRequest,
  ) => Promise<DesktopByoConfigurationResponse>;
};

/** Values enter presentation only at viewport.ts; features receive its factories. */
export type ViewportServices = {
  readonly signal?: AbortSignal;
  readonly stage: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly backend: ThreeSculptPresentationBackend;
  readonly mounts: SculptMountApi;
  readonly request: BridgeGlobal["request"];
  readonly inputActionMap: InputActionMap;
  inputContext: InputActionContext;
  scene: DesktopMountablePayload;
  readonly onFrame: (callback: () => void) => void;
  readonly frameMountedContent: () => void;
  readonly report: ReturnType<typeof installOverlayReport>;
  readonly createAudioPlaybackPort: typeof createAudioPlaybackPort;
  readonly createSculptMountApi: typeof createSculptMountApi;
  readonly createThreeRenderLoop: typeof createThreeRenderLoop;
};
