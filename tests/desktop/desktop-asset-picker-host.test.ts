import { describe, expect, it, vi } from "vitest";
import { bridgeOk, createDesktopAssetPickerHost } from "../../desktop/linux/src/index.ts";

describe("desktop native asset picker host", () => {
  it("treats cancellation as a successful no-op without reaching the importer", async () => {
    const stage = vi.fn();
    const host = createDesktopAssetPickerHost({
      chooseFile: async () => ({ canceled: true, filePaths: [] }),
      stage,
    });
    await expect(host.chooseAndStage("web")).resolves.toMatchObject({
      ok: true,
      action: "asset-import",
      data: { outcome: "cancelled" },
    });
    expect(stage).not.toHaveBeenCalled();
  });

  it("passes exactly the native selected path and active profile to the bridge", async () => {
    const stage = vi.fn(() => bridgeOk("asset-import", { outcome: "reviewing" }));
    const host = createDesktopAssetPickerHost({
      chooseFile: async () => ({ canceled: false, filePaths: ["/tmp/fixtures/triangle.glb"] }),
      stage,
    });
    await host.chooseAndStage("web");
    expect(stage).toHaveBeenCalledWith({
      action: "asset-import",
      payload: { profile: "web", documentPath: "scene.json", sourcePath: "/tmp/fixtures/triangle.glb" },
    });
  });
});
