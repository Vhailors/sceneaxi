/** Native-dialog adapter for the contained asset import bridge action. */
import { bridgeOk, type DesktopBridgeResponse } from "./bridge-contract.js";

export type DesktopAssetPickerSelection = Readonly<{
  canceled: boolean;
  filePaths: readonly string[];
}>;

export type DesktopAssetPickerHost = Readonly<{
  chooseAndStage(profile: unknown): Promise<DesktopBridgeResponse>;
}>;

export function createDesktopAssetPickerHost(options: Readonly<{
  chooseFile: () => Promise<DesktopAssetPickerSelection>;
  stage: (request: Readonly<{
    action: "asset-import";
    payload: Readonly<{ profile: unknown; documentPath: "scene.json"; sourcePath: string }>;
  }>) => DesktopBridgeResponse;
}>): DesktopAssetPickerHost {
  return Object.freeze({
    async chooseAndStage(profile: unknown) {
      const selected = await options.chooseFile();
      const sourcePath = selected.filePaths[0];
      if (selected.canceled || sourcePath === undefined) {
        return bridgeOk("asset-import", Object.freeze({ outcome: "cancelled" as const }));
      }
      return options.stage(Object.freeze({
        action: "asset-import" as const,
        payload: Object.freeze({ profile, documentPath: "scene.json" as const, sourcePath }),
      }));
    },
  });
}
