import "./source-extension-resolver.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
// The root intentionally does not install every workspace package. Use a clean
// consumer node_modules populated only by symlinks to the actual package roots.
// Node resolves each real package.json export map; no invented export namespace.
const consumer = mkdtempSync(join(tmpdir(), "sceneaxi-public-consumer-"));
let modules;
try {
  mkdirSync(join(consumer, "node_modules/@sceneaxi"), { recursive: true });
  for (const name of ["schemas", "authoring-core", "engine-presentation", "site-kit"]) {
    symlinkSync(fileURLToPath(new URL(`../../../../../packages/${name}/`, import.meta.url)), join(consumer, "node_modules/@sceneaxi", name), "dir");
  }
  const entry = join(consumer, "consumer.mjs");
  writeFileSync(entry, 'export default await Promise.all([import("@sceneaxi/schemas"), import("@sceneaxi/authoring-core"), import("@sceneaxi/engine-presentation"), import("@sceneaxi/site-kit/catalog-server-fetch"), import("@sceneaxi/schemas/testing/scene-composition")]);');
  modules = (await import(pathToFileURL(entry).href)).default;
} finally { rmSync(consumer, { recursive: true, force: true }); }
const [schemas, authoring, presentation, catalog, fixtures] = modules;
const requests = JSON.parse(readFileSync(new URL("verified-symbols.json", import.meta.url), "utf8"));
const namespaces = new Map([
  ["packages/schemas/src/index.ts", schemas],
  ["packages/authoring-core/src/index.ts", authoring],
  ["packages/engine-presentation/src/index.ts", presentation],
]);
test("real public package manifests expose every verified runtime value", () => {
  for (const value of requests.filter(entry => entry.kind === "value")) {
    const target = value.source.replace(/[^/]+$/, "index.ts");
    assert.ok(Object.hasOwn(namespaces.get(target), value.name), value.name);
  }
  assert.equal(typeof catalog.createCatalogServerFetchAdapter, "function");
  assert.equal(typeof catalog.createCatalogServerIdentityPlane, "function");
  assert.equal(catalog.CATALOG_SESSION_TIMEOUT_MS, 2000);
  assert.equal(catalog.CATALOG_SESSION_MAX_RESPONSE_BYTES, 16384);
});
test("explicit public v2 composition preserves matrices and v1 refusal", () => {
  const transform = fixtures.sceneCompositionTransformFixture;
  const intake = { schemaVersion: 2, kind: "sceneaxi.scene-composition-intake", sceneId: "public-v2", rootInstanceId: "root", placements: [
    { instanceId: "root", artifactId: "crate", parentInstanceId: null, transform: transform([1, 2, 3], [2, 3, 4], [0, 0, 90]) },
    { instanceId: "child", artifactId: "crate", parentInstanceId: "root", transform: transform([1, 0, 0], [1, 2, 1], [20, 30, 40]) },
  ] };
  assert.equal(schemas.validateSceneCompositionIntake(intake).ok, false);
  const result = authoring.composeSceneV2(intake, [fixtures.sceneCompositionArtifactFixture("crate")]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.scene.instances[1].worldMatrix.slice(12, 15), [1, 4, 3]);
  assert.equal(schemas.validateComposedSceneV2(result.scene).ok, true);
  assert.equal(authoring.serializeComposedSceneV2(result.scene), result.sceneBytes);
  assert.deepEqual(schemas.composedSceneV2FromDocumentData(result.document.data), { ok: true, value: result.scene });
  assert.equal(presentation.resolveScenePresentationV2(result.scene).ok, true);
  assert.equal(schemas.validateComposedScene(result.scene).ok, false);
});
test("public local purpose never authorizes signed release or Kids", () => {
  assert.deepEqual(schemas.evaluateLocalProjectBuild({ profile: "game", purpose: "local-unsigned", target: "linux", host: "linux" }),
    { ok: true, purpose: "local-unsigned", target: "linux", signed: false, releaseReady: false });
  assert.equal(schemas.evaluateLocalProjectBuild({ profile: "kids", purpose: "local-unsigned", target: "linux", host: "linux" }).ok, false);
  assert.equal(schemas.evaluateProjectBuild({ profile: "game", target: "linux", host: "linux" }).ok, false);
  assert.equal(typeof authoring.buildLocalProject, "function");
  assert.equal(typeof authoring.verifyLocalProjectBuild, "function");
  assert.equal(typeof authoring.launchLocalProjectBuild, "function");
});
test("SDK inventory retains new barrel dependency closure without Kids", () => {
  const root = new URL("../../../../../", import.meta.url);
  const entries = JSON.parse(readFileSync(new URL("scripts/engine-sdk-files.json", root), "utf8"));
  assert.equal(new Set(entries).size, entries.length);
  assert.ok(entries.every(path => !path.includes("profile-kids")));
  for (const path of ["packages/authoring-core/src/local-project-build.ts", "packages/engine-presentation/src/scene-transforms.ts"]) {
    assert.ok(entries.includes(path), path);
    assert.ok(createHash("sha256").update(readFileSync(new URL(path, root))).digest("hex"));
  }
});
