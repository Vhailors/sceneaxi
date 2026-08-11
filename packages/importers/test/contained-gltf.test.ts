import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  apply,
  composeScene,
  createDocument,
  reconstructSculpt,
  writeDocumentFile,
} from "@sceneaxi/authoring-core";
import {
  OBJECT_SCULPT_SPEC_KIND,
  SCENE_COMPOSITION_INTAKE_KIND,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  SCULPT_SCHEMA_VERSION,
  identitySculptTransform,
} from "@sceneaxi/schemas";
import {
  CONTAINED_GLTF_REFUSALS,
  PROJECT_ASSET_MANIFEST_KEY,
  PROJECT_ASSET_MAX_BYTES,
  materializeProjectAssetCopies,
  projectAssetManifestFromDocumentData,
  proposeContainedGltfAssetImport,
  stageContainedGltfAssetImport,
} from "@sceneaxi/importers";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function temporary(prefix: string) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

function triangleBytes(offset = 0) {
  const values = new Float32Array([
    -1 + offset, 0, 0,
    1 + offset, 0, 0,
    0 + offset, 1, 0,
  ]);
  return new Uint8Array(values.buffer);
}

function gltfBytes(offset = 0, external = false) {
  const positions = triangleBytes(offset);
  const uri = external
    ? "triangle.bin"
    : `data:application/octet-stream;base64,${Buffer.from(positions).toString("base64")}`;
  return Buffer.from(JSON.stringify({
    asset: { version: "2.0" },
    buffers: [{ byteLength: positions.byteLength, uri }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.2, 0.6, 0.9, 1], metallicFactor: 0, roughnessFactor: 0.7 } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  }));
}

function padded(bytes: Uint8Array, fill: number) {
  const length = Math.ceil(bytes.byteLength / 4) * 4;
  const result = new Uint8Array(length);
  result.fill(fill);
  result.set(bytes);
  return result;
}

function glbBytes() {
  const positions = padded(triangleBytes(), 0);
  const json = padded(Buffer.from(JSON.stringify({
    asset: { version: "2.0" },
    buffers: [{ byteLength: positions.byteLength }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  })), 0x20);
  const result = new Uint8Array(12 + 8 + json.byteLength + 8 + positions.byteLength);
  const view = new DataView(result.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, result.byteLength, true);
  view.setUint32(12, json.byteLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  result.set(json, 20);
  const binHeader = 20 + json.byteLength;
  view.setUint32(binHeader, positions.byteLength, true);
  view.setUint32(binHeader + 4, 0x004e4942, true);
  result.set(positions, binHeader + 8);
  return result;
}

function project() {
  const root = temporary("sceneaxi-contained-gltf-project-");
  const reconstruction = reconstructSculpt({
    schemaVersion: SCULPT_SCHEMA_VERSION,
    kind: "sceneaxi.sculpt-intake",
    intakeId: "starter",
    mode: "structured-spec",
    structuredSpec: {
      schemaVersion: SCULPT_SCHEMA_VERSION,
      kind: OBJECT_SCULPT_SPEC_KIND,
      id: "starter-spec",
      rootNodeId: "starter-node",
      components: [{ id: "starter-box", primitive: "box", dimensions: [1, 1, 1], materialId: "starter-material" }],
      materials: [{ id: "starter-material", baseColor: "#888888", metallic: 0, roughness: 1 }],
      sockets: [],
      hierarchy: [{ id: "starter-node", parentId: null, componentId: "starter-box", transform: identitySculptTransform() }],
    },
  });
  expect(reconstruction.ok).toBe(true);
  if (!reconstruction.ok) throw new Error(reconstruction.message);
  const composition = composeScene({
    schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
    kind: SCENE_COMPOSITION_INTAKE_KIND,
    sceneId: "import-scene",
    rootInstanceId: "starter-root",
    placements: [
      { instanceId: "starter-root", artifactId: reconstruction.artifact.artifactId, parentInstanceId: null, transform: identitySculptTransform() },
      { instanceId: "starter-child", artifactId: reconstruction.artifact.artifactId, parentInstanceId: "starter-root", transform: { ...identitySculptTransform(), translation: [2, 0, 0] } },
    ],
  }, [reconstruction.artifact]);
  expect(composition.ok).toBe(true);
  if (!composition.ok) throw new Error(composition.message);
  const written = writeDocumentFile(
    "scene.json",
    createDocument({ id: "import-project", data: composition.document.data }),
    { cwd: root },
  );
  expect(written.ok).toBe(true);
  return root;
}

describe("contained GLB/glTF project ingestion", () => {
  it("stages through E1 without writing, then accepts and materializes byte-identical project copies", () => {
    const root = project();
    const sourceRoot = temporary("sceneaxi-contained-gltf-source-");
    const source = join(sourceRoot, "triangle.gltf");
    const bytes = gltfBytes();
    writeFileSync(source, bytes);
    const before = readFileSync(join(root, "scene.json"), "utf8");

    const proposed = proposeContainedGltfAssetImport({
      projectRoot: root,
      documentPath: "scene.json",
      sourcePath: source,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok || proposed.proposal === null) return;
    expect(proposed.replayed).toBe(false);
    expect(proposed.projection.meshes).toHaveLength(1);
    expect(readFileSync(join(root, "scene.json"), "utf8")).toBe(before);
    expect(() => readFileSync(join(root, "assets/triangle.gltf"))).toThrow();

    const accepted = apply({ proposal: proposed.proposal, cwd: root });
    expect(accepted.ok).toBe(true);
    const materialized = materializeProjectAssetCopies({ projectRoot: root, documentPath: "scene.json" });
    expect(materialized).toMatchObject({ ok: true, copiedPaths: ["assets/triangle.gltf"] });
    expect(readFileSync(join(root, "assets/triangle.gltf"))).toEqual(bytes);

    const document = parseDocumentTextForTest(root);
    const acceptedDocumentBytes = readFileSync(join(root, "scene.json"), "utf8");
    expect(acceptedDocumentBytes).not.toContain(sourceRoot);
    expect(acceptedDocumentBytes.toLowerCase()).not.toContain("credential");
    const manifest = projectAssetManifestFromDocumentData(document.data);
    expect(manifest.ok).toBe(true);
    if (!manifest.ok) return;
    expect(manifest.value.assets[0]).toMatchObject({
      assetId: "triangle",
      byteLength: bytes.byteLength,
      copyPolicy: "copy",
      provenance: { importer: "@sceneaxi/importers", formatVersion: "2.0", contained: true },
    });
    const firstAsset = manifest.value.assets[0];
    expect(firstAsset).toBeDefined();
    if (firstAsset === undefined) return;
    expect(Buffer.from(firstAsset.canonicalBytesBase64, "base64")).toEqual(bytes);

    unlinkSync(join(root, "assets/triangle.gltf"));
    expect(materializeProjectAssetCopies({ projectRoot: root, documentPath: "scene.json" })).toMatchObject({
      ok: true,
      copiedPaths: ["assets/triangle.gltf"],
    });
    expect(readFileSync(join(root, "assets/triangle.gltf"))).toEqual(bytes);
  });

  it("accepts the binary GLB form of the same contained triangle profile", () => {
    const root = project();
    const sourceRoot = temporary("sceneaxi-contained-glb-source-");
    const source = join(sourceRoot, "triangle.glb");
    writeFileSync(source, glbBytes());
    const proposed = proposeContainedGltfAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: source });
    expect(proposed).toMatchObject({ ok: true, replayed: false, entry: { mediaType: "model/gltf-binary" } });
  });

  it("refuses unknown manifest entry and provenance fields", () => {
    const root = project();
    const sourceRoot = temporary("sceneaxi-contained-gltf-manifest-keys-");
    const source = join(sourceRoot, "triangle.gltf");
    writeFileSync(source, gltfBytes());
    const proposed = proposeContainedGltfAssetImport({
      projectRoot: root,
      documentPath: "scene.json",
      sourcePath: source,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok || proposed.proposal === null) return;
    expect(apply({ proposal: proposed.proposal, cwd: root }).ok).toBe(true);

    const parsed = parseDocumentTextForTest(root);
    const valid = projectAssetManifestFromDocumentData(parsed.data);
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    const withEntryPath = structuredClone(valid.value) as unknown as {
      assets: Array<Record<string, unknown>>;
    };
    const entry = withEntryPath.assets[0];
    expect(entry).toBeDefined();
    if (entry === undefined) return;
    entry["sourcePath"] = "/private/creator/triangle.gltf";
    expect(projectAssetManifestFromDocumentData({
      [PROJECT_ASSET_MANIFEST_KEY]: withEntryPath,
    })).toMatchObject({
      ok: false,
      reason: CONTAINED_GLTF_REFUSALS.manifestInvalid,
    });

    const withCredential = structuredClone(valid.value) as unknown as {
      assets: Array<Record<string, unknown>>;
    };
    const provenance = withCredential.assets[0]?.["provenance"];
    expect(provenance).toBeTypeOf("object");
    if (provenance === null || typeof provenance !== "object" || Array.isArray(provenance)) return;
    (provenance as Record<string, unknown>)["credential"] = "must-not-persist";
    expect(projectAssetManifestFromDocumentData({
      [PROJECT_ASSET_MANIFEST_KEY]: withCredential,
    })).toMatchObject({
      ok: false,
      reason: CONTAINED_GLTF_REFUSALS.manifestInvalid,
    });
  });

  it("refuses duplicate manifest paths and media types that disagree with canonical bytes", () => {
    const root = project();
    const sourceRoot = temporary("sceneaxi-contained-gltf-manifest-semantics-");
    const firstSource = join(sourceRoot, "first.gltf");
    const secondSource = join(sourceRoot, "second.gltf");
    writeFileSync(firstSource, gltfBytes());
    writeFileSync(secondSource, gltfBytes(0.25));
    const first = proposeContainedGltfAssetImport({
      projectRoot: root,
      documentPath: "scene.json",
      sourcePath: firstSource,
    });
    expect(first.ok).toBe(true);
    if (!first.ok || first.proposal === null) return;
    expect(apply({ proposal: first.proposal, cwd: root }).ok).toBe(true);
    const second = proposeContainedGltfAssetImport({
      projectRoot: root,
      documentPath: "scene.json",
      sourcePath: secondSource,
    });
    expect(second.ok).toBe(true);
    if (!second.ok || second.proposal === null) return;
    expect(apply({ proposal: second.proposal, cwd: root }).ok).toBe(true);

    const parsed = parseDocumentTextForTest(root);
    const valid = projectAssetManifestFromDocumentData(parsed.data);
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    const duplicatePath = structuredClone(valid.value) as unknown as {
      assets: Array<{ relativePath: string }>;
    };
    const firstPath = duplicatePath.assets[0]?.relativePath;
    const secondEntry = duplicatePath.assets[1];
    expect(firstPath).toBeTypeOf("string");
    expect(secondEntry).toBeDefined();
    if (firstPath === undefined || secondEntry === undefined) return;
    secondEntry.relativePath = firstPath;
    expect(projectAssetManifestFromDocumentData({
      [PROJECT_ASSET_MANIFEST_KEY]: duplicatePath,
    })).toMatchObject({
      ok: false,
      reason: CONTAINED_GLTF_REFUSALS.duplicatePath,
    });

    const mediaMismatch = structuredClone(valid.value) as unknown as {
      assets: Array<{ mediaType: string }>;
    };
    const mediaEntry = mediaMismatch.assets[0];
    expect(mediaEntry).toBeDefined();
    if (mediaEntry === undefined) return;
    mediaEntry.mediaType = "model/gltf-binary";
    expect(projectAssetManifestFromDocumentData({
      [PROJECT_ASSET_MANIFEST_KEY]: mediaMismatch,
    })).toMatchObject({
      ok: false,
      reason: CONTAINED_GLTF_REFUSALS.manifestInvalid,
    });
  });

  it("names duplicate replay, duplicate content, and conflicting identity without changing project bytes", () => {
    const root = project();
    const sourceRoot = temporary("sceneaxi-contained-gltf-identity-");
    const source = join(sourceRoot, "triangle.gltf");
    writeFileSync(source, gltfBytes());
    const first = proposeContainedGltfAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: source });
    expect(first.ok).toBe(true);
    if (!first.ok || first.proposal === null) return;
    expect(apply({ proposal: first.proposal, cwd: root }).ok).toBe(true);
    const accepted = readFileSync(join(root, "scene.json"), "utf8");

    expect(proposeContainedGltfAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: source })).toMatchObject({
      ok: true,
      replayed: true,
      proposal: null,
    });
    expect(proposeContainedGltfAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: source, assetId: "same-bytes" })).toMatchObject({
      ok: false,
      reason: CONTAINED_GLTF_REFUSALS.duplicateContent,
    });
    writeFileSync(source, gltfBytes(0.25));
    expect(proposeContainedGltfAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: source })).toMatchObject({
      ok: false,
      reason: CONTAINED_GLTF_REFUSALS.identityConflict,
    });
    expect(readFileSync(join(root, "scene.json"), "utf8")).toBe(accepted);
  });

  it("fails closed on malformed, external, oversize, outside-root, and symlink-escape inputs", () => {
    const root = project();
    const sourceRoot = temporary("sceneaxi-contained-gltf-refuse-");
    const malformed = join(sourceRoot, "bad.gltf");
    const external = join(sourceRoot, "external.gltf");
    writeFileSync(malformed, "{not-json");
    writeFileSync(external, gltfBytes(0, true));
    expect(proposeContainedGltfAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: malformed })).toMatchObject({
      ok: false,
      reason: CONTAINED_GLTF_REFUSALS.malformed,
    });
    expect(proposeContainedGltfAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: external })).toMatchObject({
      ok: false,
      reason: CONTAINED_GLTF_REFUSALS.notContained,
    });
    expect(proposeContainedGltfAssetImport({ projectRoot: root, documentPath: "../outside.json", sourcePath: external })).toMatchObject({
      ok: false,
      reason: CONTAINED_GLTF_REFUSALS.documentOutsideRoot,
    });
    const link = join(sourceRoot, "linked.gltf");
    symlinkSync(malformed, link);
    expect(proposeContainedGltfAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: link })).toMatchObject({
      ok: false,
      reason: CONTAINED_GLTF_REFUSALS.sourceSymlink,
    });
    expect(stageContainedGltfAssetImport({
      sourceName: "huge.glb",
      sourceBytes: new Uint8Array(PROJECT_ASSET_MAX_BYTES + 1),
      documentPath: "scene.json",
      expectedContentHash: `sha256:${"0".repeat(64)}`,
      documentData: parseDocumentTextForTest(root).data,
    })).toMatchObject({ ok: false, reason: CONTAINED_GLTF_REFUSALS.oversize });

    const outside = temporary("sceneaxi-contained-gltf-outside-");
    symlinkSync(outside, join(root, "assets"));
    const valid = join(sourceRoot, "safe.gltf");
    writeFileSync(valid, gltfBytes());
    expect(proposeContainedGltfAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: valid })).toMatchObject({
      ok: false,
      reason: CONTAINED_GLTF_REFUSALS.destinationSymlink,
    });
  });
});

function parseDocumentTextForTest(root: string) {
  const parsed = JSON.parse(readFileSync(join(root, "scene.json"), "utf8")) as {
    data: Record<string, unknown>;
  };
  expect(parsed.data[PROJECT_ASSET_MANIFEST_KEY] === undefined || typeof parsed.data[PROJECT_ASSET_MANIFEST_KEY] === "object").toBe(true);
  return parsed;
}
