/** Actual Node module cache regression, including fresh-process adoption; no Vitest import transform. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { register } from "node:module";

register("../../../scripts/workspace-dist-resolver.mjs", import.meta.url);

const { openPluginHost } = await import("@sceneaxi/plugin-host");

const { pluginCapabilityRegistrySeed, PLUGIN_MANIFEST_SCHEMA_URI, PLUGIN_MANIFEST_SCHEMA_VERSION } = await import("@sceneaxi/schemas");

test("AP-03 real Node: unchanged reloads, edited helper refusal, fresh-process adoption", async () => {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-cache-final-"));

  try {
    const capability = pluginCapabilityRegistrySeed().entries[0].capabilityId;
    const pluginId = "dev.sceneaxi.final.cache";
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "final-cache-fixture", type: "module" }));
    writeFileSync(join(root, "sceneaxi.plugin.manifest.json"), JSON.stringify({ $schema: PLUGIN_MANIFEST_SCHEMA_URI, schemaVersion: PLUGIN_MANIFEST_SCHEMA_VERSION, pluginId, pluginVersion: "0.1.0", hostApi: "^1.0.0", registryVersion: "1.0.0", entrypoint: "./plugin.js", capabilities: [capability] }));
    writeFileSync(join(root, "helper.js"), "export const value = 1;");
    writeFileSync(join(root, "plugin.js"), `import { value } from './helper.js'; export const capabilities = { ${JSON.stringify(capability)}: value };`);
    const host = openPluginHost();
    const first = await host.load([root]);
    assert.equal(first.loaded.length, 1); assert.deepEqual(first.refused, []);

    for (let i = 0; i < 32; i++) assert.deepEqual(await host.load([root]), first);
    assert.equal(host.getImplementation(pluginId, capability).implementation, 1);
    writeFileSync(join(root, "helper.js"), "export const value = 2;");

    for (const next of [host, openPluginHost()]) {
      const result = await next.load([root]);
      assert.deepEqual(result.loaded, []);
      assert.equal(result.refused[0].reason, "isolation-unverifiable");
      assert.equal(result.refused[0].entrypointEvaluated, false);
      assert.equal(next.getImplementation(pluginId, capability).reason, "plugin-not-loaded");
    }

    const resolver = new globalThis.URL("../../../scripts/workspace-dist-resolver.mjs", import.meta.url).href;
    const child = spawnSync(globalThis.process.execPath, ["--input-type=module", "-e", `import { register } from 'node:module'; register(${JSON.stringify(resolver)}, import.meta.url); const { openPluginHost } = await import('@sceneaxi/plugin-host'); const host = openPluginHost(); const result = await host.load([${JSON.stringify(root)}]); if (result.refused.length) throw Error('Fresh process refused'); const implementation = host.getImplementation(${JSON.stringify(pluginId)}, ${JSON.stringify(capability)}); if (!implementation.ok || implementation.implementation !== 2) throw Error('Fresh process did not adopt current bytes'); console.log(JSON.stringify({ implementation: implementation.implementation, loaded: result.loaded.length }));`], { encoding: "utf8", timeout: 10000 });
    assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(JSON.parse(child.stdout), { implementation: 2, loaded: 1 });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("AP-03 real Node: restoring bytes cannot clear a suspect cached evaluation", async () => {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-cache-poison-"));

  try {
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "poison-fixture", type: "module" }));
    writeFileSync(join(root, "sceneaxi.plugin.manifest.json"), JSON.stringify({ $schema: PLUGIN_MANIFEST_SCHEMA_URI, schemaVersion: PLUGIN_MANIFEST_SCHEMA_VERSION, pluginId: "dev.sceneaxi.poison", pluginVersion: "0.1.0", hostApi: "^1.0.0", registryVersion: "1.0.0", entrypoint: "./plugin.js", capabilities: [] }));
    writeFileSync(join(root, "helper.js"), "export const value = 1;");
    writeFileSync(join(root, "plugin.js"), `import './helper.js'; import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(join(root, "helper.js"))}, 'export const value = 2;'); export const capabilities = {};`);
    const host = openPluginHost();
    const first = await host.load([root]);
    assert.deepEqual(first.loaded, []);
    assert.equal(first.refused[0].reason, "isolation-unverifiable");
    assert.equal(first.refused[0].phase, "integrity");
    assert.equal(first.refused[0].entrypointEvaluated, true);
    writeFileSync(join(root, "helper.js"), "export const value = 1;");

    for (const next of [host, openPluginHost()]) {
      const result = await next.load([root]);
      assert.deepEqual(result.loaded, []);
      assert.equal(result.refused[0].reason, "isolation-unverifiable");
      assert.equal(result.refused[0].entrypointEvaluated, false);
      assert.deepEqual(next.list().loaded, []);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
