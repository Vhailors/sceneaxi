/** Isolated immutable HEAD comparison: never restores or edits live source. Run explicitly after pnpm build. */
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { createRequire, register } from "node:module";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

register("../../../scripts/workspace-dist-resolver.mjs", import.meta.url);

const current = await import("@sceneaxi/importers");

const { composeScene, reconstructSculpt } = await import("@sceneaxi/authoring-core");

const { identitySculptTransform } = await import("@sceneaxi/schemas");

const reconstruction = reconstructSculpt({ schemaVersion: 1, kind: "sceneaxi.sculpt-intake", intakeId: "starter", mode: "structured-spec", structuredSpec: { schemaVersion: 1, kind: "sceneaxi.object-sculpt-spec", id: "starter-spec", rootNodeId: "starter-node", components: [{ id: "starter-box", primitive: "box", dimensions: [1,1,1], materialId: "starter-material" }], materials: [{ id: "starter-material", baseColor: "#888888", metallic: 0, roughness: 1 }], sockets: [], hierarchy: [{ id: "starter-node", parentId: null, componentId: "starter-box", transform: identitySculptTransform() }] } });

assert.equal(reconstruction.ok, true, JSON.stringify(reconstruction));

const composition = composeScene({ schemaVersion: 1, kind: "sceneaxi.scene-composition-intake", sceneId: "import-scene", rootInstanceId: "starter-root", placements: [{ instanceId: "starter-root", artifactId: reconstruction.artifact.artifactId, parentInstanceId: null, transform: identitySculptTransform() }, { instanceId: "starter-child", artifactId: reconstruction.artifact.artifactId, parentInstanceId: "starter-root", transform: { ...identitySculptTransform(), translation: [2, 0, 0] } }] }, [reconstruction.artifact]);

assert.equal(composition.ok, true, JSON.stringify(composition));

const { build } = createRequire(new globalThis.URL("../../../desktop/linux/package.json", import.meta.url))("esbuild");

function gltf(square = false) {
  const positions = Buffer.from(new Float32Array(square ? [0,0,0,1,0,0,1,1,0,0,1,0] : [0,0,0,1,0,0,0,1,0]).buffer);
  const indices = Buffer.from(new Uint16Array(square ? [0,1,2,0,2,3] : [0,1,2]).buffer);
  const bytes = Buffer.concat([positions, indices]);

  return { asset: { version: "2.0" }, buffers: [{ byteLength: bytes.length, uri: "data:application/octet-stream;base64," + bytes.toString("base64") }], bufferViews: [{ buffer: 0, byteLength: positions.length }, { buffer: 0, byteOffset: positions.length, byteLength: indices.length }], accessors: [{ bufferView: 0, componentType: 5126, count: positions.length / 12, type: "VEC3" }, { bufferView: 1, componentType: 5123, count: indices.length / 2, type: "SCALAR" }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }] };
}

const input = value => ({ sourceName: "fixture.gltf", sourceBytes: Buffer.from(JSON.stringify(value)), documentPath: "scene.json", expectedContentHash: "sha256:" + "0".repeat(64), documentData: composition.document.data });

test("AP-01/02/08 immutable baseline is red; current graph, square and maximum binary contracts are green", async () => {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-importer-before-"));

  try {
    const source = execFileSync("git", ["show", "4e532e2fbf43e9948741578ab6208a3277870405:packages/importers/src/contained-gltf.ts"], { encoding: "utf8" });
    const compiled = await build({ stdin: { contents: source, loader: "ts", resolveDir: new globalThis.URL("../src", import.meta.url).pathname }, bundle: true, platform: "node", format: "esm", packages: "external", write: false });
    const path = join(root, "baseline.mjs"); writeFileSync(path, compiled.outputFiles[0].text);
    const before = await import(pathToFileURL(path).href);
    const graph = gltf(); graph.nodes = Array.from({ length: 2500 }, (_value, i) => i === 2499 ? { mesh: 0 } : { children: [i + 1] });
    assert.throws(() => before.stageContainedGltfAssetImport(input(graph)), { name: "RangeError" });
    assert.equal(current.stageContainedGltfAssetImport(input(graph)).reason, "ASSET_IMPORT_MALFORMED");
    const square = gltf(true);
    assert.equal(before.stageContainedGltfAssetImport(input(square)).ok, false);
    const squareResult = current.stageContainedGltfAssetImport(input(square));
    assert.equal(squareResult.ok, true, JSON.stringify(squareResult));
    const maximum = Buffer.alloc(current.PROJECT_ASSET_MAX_BYTES);
    maximum.write("wOF2"); maximum.writeUInt32BE(maximum.length, 8); maximum.writeUInt16BE(1, 12);
    const staged = current.stageProjectAssetImport({ ...input(square), sourceName: "maximum.woff2", sourceBytes: maximum });
    assert.equal(staged.ok, true);
    assert.throws(() => before.projectAssetManifestFromDocumentData(staged.edit.newValue), { name: "RangeError" });
    assert.equal(current.projectAssetManifestFromDocumentData(staged.edit.newValue).ok, true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
