import { createHash } from "node:crypto";
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
import { deflateSync } from "node:zlib";
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

function pngChunk(type: string, data: Uint8Array) {
  const chunk = Buffer.alloc(data.byteLength + 12);
  chunk.writeUInt32BE(data.byteLength, 0);
  chunk.write(type, 4, "ascii");
  chunk.set(data, 8);
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, data.byteLength + 8)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0);
  }
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.byteLength + 8);
  return chunk;
}

function pngBytes(interleavedIdat = false) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const compressed = deflateSync(Buffer.from([0, 255, 32, 8, 255]));
  const dataChunks = interleavedIdat
    ? [pngChunk("IDAT", compressed.subarray(0, 1)), pngChunk("tEXt", Buffer.from([120, 0, 121])), pngChunk("IDAT", compressed.subarray(1))]
    : [pngChunk("IDAT", compressed)];
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    ...dataChunks,
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function texturedGltfBytes(imageSource: string) {
  const positionBytes = Buffer.from(new Float32Array([-1, 0, 0, 1, 0, 0, 0, 1, 0]).buffer);
  const uvBytes = Buffer.from(new Float32Array([0, 0, 1, 0, 0.5, 1]).buffer);
  const embeddedImage = imageSource === "bufferView" ? pngBytes() : Buffer.alloc(0);
  const geometryBytes = Buffer.concat([positionBytes, uvBytes, embeddedImage]);
  const image = imageSource === "bufferView"
    ? { bufferView: 2, mimeType: "image/png" }
    : { uri: imageSource };
  return Buffer.from(JSON.stringify({
    asset: { version: "2.0" },
    buffers: [{ byteLength: geometryBytes.byteLength, uri: `data:application/octet-stream;base64,${geometryBytes.toString("base64")}` }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positionBytes.byteLength },
      { buffer: 0, byteOffset: positionBytes.byteLength, byteLength: uvBytes.byteLength },
      ...(embeddedImage.byteLength === 0 ? [] : [{ buffer: 0, byteOffset: positionBytes.byteLength + uvBytes.byteLength, byteLength: embeddedImage.byteLength }]),
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
      { bufferView: 1, componentType: 5126, count: 3, type: "VEC2" },
    ],
    images: [image],
    textures: [{ source: 0 }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, material: 0 }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  }));
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

function animatedGltfBytes(interpolation = "LINEAR", skinned = false) {
  const buffer = Buffer.concat([
    Buffer.from(triangleBytes()),
    Buffer.from(new Float32Array([0, 2]).buffer),
    Buffer.from(new Float32Array([0, 0, 0, 2, 4, 6]).buffer),
  ]);
  return Buffer.from(JSON.stringify({
    asset: { version: "2.0" },
    buffers: [{ byteLength: buffer.byteLength, uri: `data:application/octet-stream;base64,${buffer.toString("base64")}` }],
    bufferViews: [
      { buffer: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 8 },
      { buffer: 0, byteOffset: 44, byteLength: 24 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
      { bufferView: 1, componentType: 5126, count: 2, type: "SCALAR" },
      { bufferView: 2, componentType: 5126, count: 2, type: "VEC3" },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes: [{ mesh: 0 }],
    ...(skinned ? { skins: [{}] } : {}),
    scenes: [{ nodes: [0] }],
    animations: [{ name: "move", samplers: [{ input: 1, output: 2, interpolation }], channels: [{ sampler: 0, target: { node: 0, path: "translation" } }] }],
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
  it("ingests node TRS channels and refuses CUBICSPLINE and skinning by name", () => {
    const root = project();
    const documentData = parseDocumentTextForTest(root).data;
    const staged = stageContainedGltfAssetImport({ sourceName: "animated.gltf", sourceBytes: animatedGltfBytes(), documentPath: "scene.json", expectedContentHash: `sha256:${"0".repeat(64)}`, documentData });
    expect(staged).toMatchObject({ ok: true, projection: { animations: [{ name: "move", duration: 2, channels: [{ node: 0, path: "translation", interpolation: "LINEAR", times: [0, 2], values: [0, 0, 0, 2, 4, 6] }] }] } });
    const cubic = stageContainedGltfAssetImport({ sourceName: "cubic.gltf", sourceBytes: animatedGltfBytes("CUBICSPLINE"), documentPath: "scene.json", expectedContentHash: `sha256:${"0".repeat(64)}`, documentData });
    expect(cubic).toMatchObject({ ok: false, reason: CONTAINED_GLTF_REFUSALS.unsupportedFormat, message: expect.stringContaining("CUBICSPLINE") });
    const skin = stageContainedGltfAssetImport({ sourceName: "skin.gltf", sourceBytes: animatedGltfBytes("LINEAR", true), documentPath: "scene.json", expectedContentHash: `sha256:${"0".repeat(64)}`, documentData });
    expect(skin).toMatchObject({ ok: false, reason: CONTAINED_GLTF_REFUSALS.unsupportedFormat, message: expect.stringContaining("Skinning") });
    const joints = JSON.parse(animatedGltfBytes().toString("utf8")) as { meshes: { primitives: { attributes: Record<string, number> }[] }[] };
    const attributes = joints.meshes[0]?.primitives[0]?.attributes;
    if (attributes === undefined) throw new Error("Fixture primitive has no attributes.");
    attributes["JOINTS_0"] = 0;
    const jointRefusal = stageContainedGltfAssetImport({ sourceName: "joints.gltf", sourceBytes: Buffer.from(JSON.stringify(joints)), documentPath: "scene.json", expectedContentHash: `sha256:${"0".repeat(64)}`, documentData });
    expect(jointRefusal).toMatchObject({ ok: false, reason: CONTAINED_GLTF_REFUSALS.unsupportedFormat, message: expect.stringContaining("JOINTS_0") });
  });

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

  it("projects matching UVs and an embedded PNG as a decoded shared mesh payload", () => {
    const root = project();
    const png = pngBytes();
    const bytes = texturedGltfBytes(`data:image/png;base64,${png.toString("base64")}`);
    const staged = stageContainedGltfAssetImport({
      sourceName: "textured.gltf",
      sourceBytes: bytes,
      documentPath: "scene.json",
      expectedContentHash: `sha256:${"0".repeat(64)}`,
      documentData: parseDocumentTextForTest(root).data,
    });
    expect(staged).toMatchObject({ ok: true });
    if (!staged.ok) return;
    expect(staged.projection.meshes[0]?.uvs).toEqual([0, 0, 1, 0, 0.5, 1]);
    expect(staged.projection.meshes[0]?.baseColorTexture).toMatchObject({ width: 1, height: 1 });
    expect(staged.projection.meshes[0]?.baseColorTexture?.rgba).toEqual([255, 32, 8, 255]);
    expect(staged.entry.digest).toBe(`sha256:${createHash("sha256").update(bytes).digest("hex")}`);
    expect(Buffer.from(staged.entry.canonicalBytesBase64, "base64")).toEqual(bytes);
    const bufferView = stageContainedGltfAssetImport({
      sourceName: "buffer-view.gltf",
      sourceBytes: texturedGltfBytes("bufferView"),
      documentPath: "scene.json",
      expectedContentHash: `sha256:${"0".repeat(64)}`,
      documentData: parseDocumentTextForTest(root).data,
    });
    expect(bufferView).toMatchObject({ ok: true, projection: { meshes: [{ baseColorTexture: { width: 1, height: 1 } }] } });
  });

  it("refuses external and non-PNG embedded glTF texture sources by name", () => {
    const root = project();
    const documentData = parseDocumentTextForTest(root).data;
    for (const [uri, reason] of [
      ["texture.png", CONTAINED_GLTF_REFUSALS.notContained],
      ["data:image/jpeg;base64,AA==", CONTAINED_GLTF_REFUSALS.unsupportedFormat],
      ["data:image/webp;base64,AA==", CONTAINED_GLTF_REFUSALS.unsupportedFormat],
    ] as const) {
      expect(stageContainedGltfAssetImport({
        sourceName: "textured.gltf",
        sourceBytes: texturedGltfBytes(uri),
        documentPath: "scene.json",
        expectedContentHash: `sha256:${"0".repeat(64)}`,
        documentData,
      })).toMatchObject({ ok: false, reason });
    }
    expect(stageContainedGltfAssetImport({
      sourceName: "interleaved-idat.gltf",
      sourceBytes: texturedGltfBytes(`data:image/png;base64,${pngBytes(true).toString("base64")}`),
      documentPath: "scene.json",
      expectedContentHash: `sha256:${"0".repeat(64)}`,
      documentData,
    })).toMatchObject({
      ok: false,
      reason: CONTAINED_GLTF_REFUSALS.malformed,
      message: expect.stringContaining("consecutive"),
    });
    const png = pngBytes();
    const truncatedChunk = Buffer.alloc(12);
    truncatedChunk.writeUInt32BE(100, 0);
    truncatedChunk.write("tEXt", 4, "ascii");
    const malformedPng = Buffer.concat([png.subarray(0, -12), truncatedChunk, png.subarray(-12)]);
    expect(stageContainedGltfAssetImport({
      sourceName: "truncated-chunk.gltf",
      sourceBytes: texturedGltfBytes(`data:image/png;base64,${malformedPng.toString("base64")}`),
      documentPath: "scene.json",
      expectedContentHash: `sha256:${"0".repeat(64)}`,
      documentData,
    })).toMatchObject({
      ok: false,
      reason: CONTAINED_GLTF_REFUSALS.malformed,
      message: expect.stringContaining("chunk exceeds"),
    });
    const samplerBytes = Buffer.from(
      texturedGltfBytes(`data:image/png;base64,${png.toString("base64")}`)
        .toString()
        .replace('"buffers":', '"samplers":[{}],"buffers":'),
    );
    const transparentPng = Buffer.concat([
      png.subarray(0, 33),
      pngChunk("tRNS", Buffer.from([0, 255, 0, 32, 0, 8])),
      png.subarray(33),
    ]);
    expect(stageContainedGltfAssetImport({
      sourceName: "transparent-png.gltf",
      sourceBytes: texturedGltfBytes(`data:image/png;base64,${transparentPng.toString("base64")}`),
      documentPath: "scene.json",
      expectedContentHash: `sha256:${"0".repeat(64)}`,
      documentData,
    })).toMatchObject({
      ok: false,
      reason: CONTAINED_GLTF_REFUSALS.unsupportedFormat,
      message: expect.stringContaining("tRNS"),
    });
    const unsupportedPbrTexture = Buffer.from(
      texturedGltfBytes(`data:image/png;base64,${png.toString("base64")}`)
        .toString()
        .replace('"baseColorTexture":{"index":0}', '"baseColorTexture":{"index":0},"metallicRoughnessTexture":{"index":0}'),
    );
    expect(stageContainedGltfAssetImport({
      sourceName: "unsupported-pbr-texture.gltf",
      sourceBytes: unsupportedPbrTexture,
      documentPath: "scene.json",
      expectedContentHash: `sha256:${"0".repeat(64)}`,
      documentData,
    })).toMatchObject({
      ok: false,
      reason: CONTAINED_GLTF_REFUSALS.unsupportedFormat,
      message: expect.stringContaining("metallicRoughnessTexture"),
    });
    expect(stageContainedGltfAssetImport({
      sourceName: "sampler.gltf",
      sourceBytes: samplerBytes,
      documentPath: "scene.json",
      expectedContentHash: `sha256:${"0".repeat(64)}`,
      documentData,
    })).toMatchObject({ ok: false, reason: CONTAINED_GLTF_REFUSALS.unsupportedFormat, message: expect.stringContaining("samplers") });
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

    for (const field of ["artifactId", "instanceId"] as const) {
      const aliased = structuredClone(valid.value) as unknown as {
        assets: Array<Record<typeof field, string>>;
      };
      const firstIdentity = aliased.assets[0]?.[field];
      const aliasedEntry = aliased.assets[1];
      expect(firstIdentity).toBeTypeOf("string");
      expect(aliasedEntry).toBeDefined();
      if (firstIdentity === undefined || aliasedEntry === undefined) return;
      aliasedEntry[field] = firstIdentity;
      expect(projectAssetManifestFromDocumentData({
        [PROJECT_ASSET_MANIFEST_KEY]: aliased,
      })).toMatchObject({
        ok: false,
        reason: CONTAINED_GLTF_REFUSALS.manifestInvalid,
      });
    }

    for (const relativePath of ["assets/not-first.gltf", "assets/first.glb"]) {
      const mismatchedPath = structuredClone(valid.value) as unknown as {
        assets: Array<{ relativePath: string }>;
      };
      const pathEntry = mismatchedPath.assets[0];
      expect(pathEntry).toBeDefined();
      if (pathEntry === undefined) return;
      pathEntry.relativePath = relativePath;
      expect(projectAssetManifestFromDocumentData({
        [PROJECT_ASSET_MANIFEST_KEY]: mismatchedPath,
      })).toMatchObject({
        ok: false,
        reason: CONTAINED_GLTF_REFUSALS.manifestInvalid,
      });
    }
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
