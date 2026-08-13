import { describe, expect, it } from "vitest";
import {
  SCENE_PACKAGE_REFUSALS,
  applyScenePackageMutation,
  discoverScenePackage,
  emptyScenePackageCatalog,
} from "@sceneaxi/schemas";

const digest = `sha256:${"11".repeat(32)}`;
const manifest = Object.freeze({
  pluginId: "dev.sceneaxi.sample.intake-source",
  pluginVersion: "0.1.0",
  capabilities: Object.freeze(["sceneaxi.sculpt.intake-source.v1"]),
});

describe("desktop scene package catalog", () => {
  it("discovers declared metadata without executing the package", () => {
    const discovered = discoverScenePackage({
      locator: "fixtures/plugin-host/sculpt-intake-source",
      manifest,
      digest,
      admittedCapabilities: ["sceneaxi.sculpt.intake-source.v1"],
    });
    expect(discovered).toMatchObject({
      ok: true,
      discovery: { executed: false, packageId: "dev.sceneaxi.sample.intake-source" },
    });
  });

  it("refuses unknown capabilities, cycles, unavailable sources, and Kids", () => {
    expect(discoverScenePackage({
      locator: "https://example.invalid/plugin",
      manifest,
      digest,
      admittedCapabilities: ["sceneaxi.sculpt.intake-source.v1"],
    })).toMatchObject({ ok: false, reason: SCENE_PACKAGE_REFUSALS.sourceUnavailable });
    expect(discoverScenePackage({
      locator: "fixtures/plugin-host/sculpt-intake-source",
      manifest,
      digest,
      admittedCapabilities: [],
    })).toMatchObject({ ok: false, reason: SCENE_PACKAGE_REFUSALS.capabilityMissing });
    const discovered = discoverScenePackage({
      locator: "fixtures/plugin-host/sculpt-intake-source",
      manifest,
      digest,
      admittedCapabilities: ["sceneaxi.sculpt.intake-source.v1"],
    });
    if (!discovered.ok) throw new Error(discovered.message);
    expect(applyScenePackageMutation({
      catalog: emptyScenePackageCatalog(),
      profile: "@sceneaxi/profile-kids",
      mutation: { kind: "install", discovery: discovered.discovery },
    })).toMatchObject({ ok: false, reason: SCENE_PACKAGE_REFUSALS.kidsDenied });
    expect(applyScenePackageMutation({
      catalog: emptyScenePackageCatalog(),
      profile: "@sceneaxi/profile-game",
      mutation: { kind: "install", discovery: discovered.discovery, dependsOn: [discovered.discovery.packageId] },
    })).toMatchObject({ ok: false, reason: SCENE_PACKAGE_REFUSALS.dependencyCycle });
  });

  it("locks an install and removes it from the same catalog", () => {
    const discovered = discoverScenePackage({
      locator: "fixtures/plugin-host/sculpt-intake-source",
      manifest,
      digest,
      admittedCapabilities: ["sceneaxi.sculpt.intake-source.v1"],
    });
    if (!discovered.ok) throw new Error(discovered.message);
    const installed = applyScenePackageMutation({
      catalog: emptyScenePackageCatalog(),
      profile: "@sceneaxi/profile-game",
      mutation: { kind: "install", discovery: discovered.discovery },
    });
    if (!installed.ok) throw new Error(installed.message);
    expect(installed.catalog.lock).toEqual([
      {
        packageId: "dev.sceneaxi.sample.intake-source",
        version: "0.1.0",
        digest,
        sourceLocator: "fixtures/plugin-host/sculpt-intake-source",
        capabilities: ["sceneaxi.sculpt.intake-source.v1"],
      },
    ]);
    const removed = applyScenePackageMutation({
      catalog: installed.catalog,
      profile: "@sceneaxi/profile-web",
      mutation: { kind: "remove", packageId: "dev.sceneaxi.sample.intake-source" },
    });
    expect(removed).toMatchObject({ ok: true, catalog: { lock: [] } });
  });
});
