import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as pluginHost from "@sceneaxi/plugin-host";

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { name: string; sceneaxi: { releaseGroup: string } };

describe("@sceneaxi/plugin-host public seam", () => {
  it("identifies itself exactly as its manifest does", () => {
    expect(pluginHost.seam.name).toBe(manifest.name);
    expect(pluginHost.seam.releaseGroup).toBe(manifest.sceneaxi.releaseGroup);
    expect(pluginHost.seam.name).toBe("@sceneaxi/plugin-host");
    expect(pluginHost.seam.releaseGroup).toBe("plugin-host");
  });

  it("is immutable", () => {
    expect(typeof pluginHost.seam).toBe("object");
    expect(Object.isFrozen(pluginHost.seam)).toBe(true);
  });

  it("exports the load/list/lookup surface", () => {
    expect(typeof pluginHost.openPluginHost).toBe("function");
    expect(pluginHost.PLUGIN_HOST_API_VERSION).toBe("1.0.0");
    const host = pluginHost.openPluginHost();
    expect(typeof host.load).toBe("function");
    expect(typeof host.list).toBe("function");
    expect(typeof host.getImplementation).toBe("function");
  });
});
