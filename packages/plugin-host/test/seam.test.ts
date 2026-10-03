import { tmpdir } from "node:os";
import { join } from "node:path";
import { pluginCapabilityRegistrySeed, PLUGIN_MANIFEST_SCHEMA_URI, PLUGIN_MANIFEST_SCHEMA_VERSION } from "@sceneaxi/schemas";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as pluginHost from "@sceneaxi/plugin-host";

// SAFETY: this package-owned manifest defines its name and sceneaxi releaseGroup; the seam assertions below verify those exact fields.
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
    expect(isSeamObject(pluginHost.seam)).toBe(true);
    expect(Object.isFrozen(pluginHost.seam)).toBe(true);
  });

  it("exports the load/list/lookup surface", () => {
    expect(isHostCallable(pluginHost.openPluginHost)).toBe(true);
    expect(pluginHost.PLUGIN_HOST_API_VERSION).toBe("1.0.0");
    const host = pluginHost.openPluginHost();
    expect(isHostCallable(host.load)).toBe(true);
    expect(isHostCallable(host.list)).toBe(true);
    expect(isHostCallable(host.getImplementation)).toBe(true);
  });
});

describe("AP-03 inspected bytes versus process module cache", () => {
  it("refuses changed entry and local transitive helper across hosts, clears addressable old state", async () => {
    for (const changed of ["plugin.js", "helper.js", "package.json"]) {
      const root = mkdtempSync(join(tmpdir(), "sceneaxi-cache-identity-"));

      try {
        const capability = pluginCapabilityRegistrySeed().entries[0]?.capabilityId;

        if (capability === undefined) throw new Error("Seed missing capability");
        const id = "dev.sceneaxi.cache.example";
        writeFileSync(join(root, "package.json"), JSON.stringify({ name: "cache-fixture", type: "module" }));
        writeFileSync(join(root, "sceneaxi.plugin.manifest.json"), JSON.stringify({ $schema: PLUGIN_MANIFEST_SCHEMA_URI, schemaVersion: PLUGIN_MANIFEST_SCHEMA_VERSION, pluginId: id, pluginVersion: "0.1.0", hostApi: "^1.0.0", registryVersion: "1.0.0", entrypoint: "./plugin.js", capabilities: [capability] }));
        writeFileSync(join(root, "helper.js"), 'export const value = 1;');
        writeFileSync(join(root, "plugin.js"), `import { value } from "./helper.js"; export const capabilities = { ${JSON.stringify(capability)}: value };`);
        const host = pluginHost.openPluginHost();
        const first = await host.load([root]);
        expect(first.refused).toEqual([]);
        expect(first.loaded).toHaveLength(1);

        for (let reload = 0; reload < 32; reload += 1) {
          expect(await host.load([root])).toEqual(first);
        }

        expect(host.getImplementation(id, capability)).toMatchObject({ ok: true, implementation: 1 });
        writeFileSync(join(root, changed), changed === "plugin.js" ? `export const capabilities = { ${JSON.stringify(capability)}: 2 };` : changed === "helper.js" ? 'export const value = 2;' : JSON.stringify({ name: "changed", type: "module" }));

        for (const nextHost of [host, pluginHost.openPluginHost()]) {
          const refused = await nextHost.load([root]);
          expect(refused.loaded).toEqual([]);
          expect(refused.refused).toMatchObject([{ reason: "isolation-unverifiable", entrypointEvaluated: false }]);
          expect(nextHost.getImplementation(id, capability)).toMatchObject({ ok: false, reason: "plugin-not-loaded" });
        }
      } finally { rmSync(root, { recursive: true, force: true }); }
    }
  });
});

it("AP-03 exposes nothing when trusted code changes its inspected graph during evaluation", async () => {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-evaluation-change-"));

  try {
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "evaluation-change", type: "module" }));
    writeFileSync(join(root, "sceneaxi.plugin.manifest.json"), JSON.stringify({ $schema: PLUGIN_MANIFEST_SCHEMA_URI, schemaVersion: PLUGIN_MANIFEST_SCHEMA_VERSION, pluginId: "dev.sceneaxi.evaluation.change", pluginVersion: "0.1.0", hostApi: "^1.0.0", registryVersion: "1.0.0", entrypoint: "./plugin.js", capabilities: [] }));
    writeFileSync(join(root, "helper.js"), "export const value = 1;");
    writeFileSync(join(root, "plugin.js"), `import "./helper.js"; import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(join(root, "helper.js"))}, "export const value = 2;"); export const capabilities = {};`);
    const host = pluginHost.openPluginHost();
    const result = await host.load([root]);
    expect(result.loaded).toEqual([]);
    expect(result.refused).toMatchObject([{ reason: "isolation-unverifiable", phase: "integrity", entrypointEvaluated: true }]);
    expect(host.list().loaded).toEqual([]);
    expect((await host.load([root])).refused).toMatchObject([{ reason: "isolation-unverifiable", entrypointEvaluated: false }]);
    // Restoring bytes cannot undo Node's already-cached suspect evaluation.
    writeFileSync(join(root, "helper.js"), "export const value = 1;");

    for (const nextHost of [host, pluginHost.openPluginHost()]) {
      const restored = await nextHost.load([root]);
      expect(restored.loaded).toEqual([]);
      expect(restored.refused).toMatchObject([{ reason: "isolation-unverifiable", entrypointEvaluated: false }]);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

type HostCallable = typeof pluginHost.openPluginHost | ReturnType<typeof pluginHost.openPluginHost>["load"] | ReturnType<typeof pluginHost.openPluginHost>["list"] | ReturnType<typeof pluginHost.openPluginHost>["getImplementation"];

function isHostCallable(value: HostCallable): value is HostCallable {
  return isBoundaryCallableValue(value);
}

function isSeamObject(value: typeof pluginHost.seam): value is typeof pluginHost.seam {
  return isBoundaryObjectValue(value);
}

type BoundaryObjectValue = object | null;

type BoundaryCallableValue = (...args: never[]) => void;

function isBoundaryCallableValue<Input>(value: Input): value is Input & BoundaryCallableValue & object {
  return typeof value === "function";
}

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}
