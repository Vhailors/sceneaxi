import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { createSculptMountApi, createThreeSculptPresentationBackend } from "@sceneaxi/engine-presentation";
import { createDesktopBridge, seedDesktopProject } from "../../desktop/linux/src/index.ts";
import { mountDesktopScene } from "../../desktop/linux/src/renderer/viewport-playback.ts";
import { runAssetImport } from "../../packages/cli/src/asset-verbs.ts";
import { runProjectApply } from "../../packages/cli/src/project-verbs.ts";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

function temporary(prefix: string) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  return root;
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

function containedTriangle(alphaMode?: string, baseColorFactor?: readonly number[]) {
  const positions = Buffer.from(new Float32Array([-1, 0, 0, 1, 0, 0, 0, 1, 0]).buffer);
  const uvs = Buffer.from(new Float32Array([0, 0, 1, 0, 0.5, 1]).buffer);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(Buffer.from([0, 255, 32, 8, 255]))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  const bytes = Buffer.concat([positions, uvs, png]);
  return Buffer.from(JSON.stringify({
    asset: { version: "2.0" },
    buffers: [{ byteLength: bytes.byteLength, uri: `data:application/octet-stream;base64,${bytes.toString("base64")}` }],
    bufferViews: [
      { buffer: 0, byteLength: positions.byteLength },
      { buffer: 0, byteOffset: positions.byteLength, byteLength: uvs.byteLength },
      { buffer: 0, byteOffset: positions.byteLength + uvs.byteLength, byteLength: png.byteLength },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
      { bufferView: 1, componentType: 5126, count: 3, type: "VEC2" },
    ],
    images: [{ bufferView: 2, mimeType: "image/png" }],
    textures: [{ source: 0 }],
    materials: [{ alphaMode, alphaCutoff: 0.7, pbrMetallicRoughness: { baseColorFactor, roughnessFactor: 0.7, baseColorTexture: { index: 0 } } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, material: 0 }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  }));
}

function seededRoot(prefix: string) {
  const root = temporary(prefix);
  expect(seedDesktopProject(root).ok).toBe(true);
  return root;
}

describe("offline asset ingestion vertical", () => {
  it.each([
    { alphaMode: undefined, baseColorFactor: undefined, expectedColor: "#ffffff" },
    { alphaMode: "OPAQUE", baseColorFactor: undefined, expectedColor: "#ffffff" },
    { alphaMode: "OPAQUE", baseColorFactor: [0.2, 0.6, 0.9, 1], expectedColor: "#3399e6" },
  ])("keeps Reject byte-clean, accepts atomically, and reopens $alphaMode triangles with $expectedColor", ({ alphaMode, baseColorFactor, expectedColor }) => {
    const root = seededRoot("sceneaxi-desktop-asset-");
    const sourceRoot = temporary("sceneaxi-desktop-asset-source-");
    const source = join(sourceRoot, "triangle.gltf");
    const sourceBytes = containedTriangle(alphaMode, baseColorFactor);
    writeFileSync(source, sourceBytes);
    const before = readFileSync(join(root, "scene.json"), "utf8");
    const bridge = createDesktopBridge({ cwd: root, nowMs: () => 1_753_920_000_000 });

    const staged = bridge.handle({ action: "asset-import", payload: { profile: "web", documentPath: "scene.json", sourcePath: source } });
    expect(staged).toMatchObject({ ok: true, action: "asset-import", data: { outcome: "reviewing", authoring: { phase: "reviewing" } } });
    expect(readFileSync(join(root, "scene.json"), "utf8")).toBe(before);
    expect(() => readFileSync(join(root, "assets/triangle.gltf"))).toThrow();
    expect(bridge.handle({ action: "authoring", payload: { op: "reject" } })).toMatchObject({ ok: true, data: { phase: "rejected" } });
    expect(readFileSync(join(root, "scene.json"), "utf8")).toBe(before);

    expect(bridge.handle({ action: "asset-import", payload: { profile: "web", documentPath: "scene.json", sourcePath: source } })).toMatchObject({ ok: true, data: { outcome: "reviewing" } });
    expect(bridge.handle({ action: "authoring", payload: { op: "accept" } })).toMatchObject({ ok: true, data: { phase: "applied", assetImport: { sourceName: "triangle.gltf" } } });
    expect(readFileSync(join(root, "assets/triangle.gltf"))).toEqual(sourceBytes);

    unlinkSync(join(root, "assets/triangle.gltf"));
    const reopened = createDesktopBridge({ cwd: root, nowMs: () => 1_753_920_000_000 });
    const played = reopened.handle({ action: "open-path", payload: { documentPath: "scene.json" } });
    expect(played).toMatchObject({ ok: true, data: { instanceCount: 4, closed: true } });
    expect(readFileSync(join(root, "assets/triangle.gltf"))).toEqual(sourceBytes);
    if (!played.ok) return;
    const mountable = (played.data as { mountable: Parameters<typeof mountDesktopScene>[1] }).mountable;
    expect(mountable.importedAssets).toHaveLength(1);
    expect(mountable.importedAssets?.[0]?.meshes[0]).toMatchObject({
      baseColor: expectedColor,
      uvs: [0, 0, 1, 0, 0.5, 1],
      baseColorTexture: { width: 1, height: 1, rgba: [255, 32, 8, 255] },
    });
    const backend = createThreeSculptPresentationBackend();
    const mounts = createSculptMountApi(backend);
    mountDesktopScene(mounts, mountable, backend);
    const frame = mounts.render();
    expect(frame).toMatchObject({ surface: "headless", pixelsDrawn: false, drawCalls: 16 });
    mounts.dispose();
  });

  it.each(["BLEND", "MASK", "UNKNOWN"])("refuses %s materials through desktop and CLI without writing project bytes", (alphaMode) => {
    const root = seededRoot("sceneaxi-alpha-refusal-");
    const sourceRoot = temporary("sceneaxi-alpha-source-");
    const source = join(sourceRoot, "triangle.gltf");
    writeFileSync(source, containedTriangle(alphaMode));
    const before = readFileSync(join(root, "scene.json"));
    const bridge = createDesktopBridge({ cwd: root });
    expect(bridge.handle({
      action: "asset-import",
      payload: { profile: "web", documentPath: "scene.json", sourcePath: source },
    })).toMatchObject({
      ok: false,
      reason: "ASSET_IMPORT_FORMAT_UNSUPPORTED",
      message: expect.stringContaining("alphaMode"),
    });
    const proposed = runAssetImport(["asset", "import"], ["--source", source, "--document", "scene.json", "--cwd", root, "--out", "asset-proposal.json"]);
    expect(proposed.envelope).toMatchObject({
      ok: false,
      error: {
        code: "VALIDATION",
        message: expect.stringContaining("ASSET_IMPORT_FORMAT_UNSUPPORTED"),
      },
    });
    expect(readFileSync(join(root, "scene.json"))).toEqual(before);
    expect(() => readFileSync(join(root, "assets/triangle.gltf"))).toThrow();
    expect(() => readFileSync(join(root, "asset-proposal.json"))).toThrow();
  });

  it("produces byte-identical accepted desktop and CLI projects", () => {
    const desktopRoot = seededRoot("sceneaxi-desktop-parity-");
    const cliRoot = seededRoot("sceneaxi-cli-parity-");
    const sourceRoot = temporary("sceneaxi-asset-parity-source-");
    const source = join(sourceRoot, "triangle.gltf");
    const sourceBytes = containedTriangle();
    writeFileSync(source, sourceBytes);
    const desktop = createDesktopBridge({ cwd: desktopRoot });
    expect(desktop.handle({ action: "asset-import", payload: { profile: "web", documentPath: "scene.json", sourcePath: source } }).ok).toBe(true);
    expect(desktop.handle({ action: "authoring", payload: { op: "accept" } }).ok).toBe(true);

    const proposed = runAssetImport(["asset", "import"], ["--source", source, "--document", "scene.json", "--cwd", cliRoot, "--out", "asset-proposal.json"]);
    expect(proposed.envelope).toMatchObject({ ok: true, result: { status: "asset-import-proposed" } });
    const applied = runProjectApply(["project", "apply"], ["--proposal", "asset-proposal.json", "--cwd", cliRoot]);
    expect(applied.envelope).toMatchObject({ ok: true, result: { status: "applied" } });
    expect(readFileSync(join(cliRoot, "scene.json"))).toEqual(readFileSync(join(desktopRoot, "scene.json")));
    expect(readFileSync(join(cliRoot, "assets/triangle.gltf"))).toEqual(sourceBytes);
    expect(readFileSync(join(desktopRoot, "assets/triangle.gltf"))).toEqual(sourceBytes);
  });

  it("never applies stale asset metadata to a replacement proposal", () => {
    const root = seededRoot("sceneaxi-desktop-stale-asset-");
    const sourceRoot = temporary("sceneaxi-desktop-stale-asset-source-");
    const source = join(sourceRoot, "triangle.gltf");
    writeFileSync(source, containedTriangle());
    const before = JSON.parse(readFileSync(join(root, "scene.json"), "utf8")) as {
      data: unknown;
    };
    const bridge = createDesktopBridge({ cwd: root });

    expect(bridge.handle({
      action: "asset-import",
      payload: { profile: "web", documentPath: "scene.json", sourcePath: source },
    })).toMatchObject({ ok: true, data: { outcome: "reviewing" } });
    expect(bridge.handle({
      action: "authoring",
      payload: {
        op: "propose",
        documentPath: "scene.json",
        jsonPointer: "/id",
        newValue: "stale-request",
        expectedContentHash: `sha256:${"0".repeat(64)}`,
      },
    })).toMatchObject({
      ok: true,
      data: { phase: "idle", diagnostics: [{ code: "content-hash-conflict" }] },
    });
    expect(bridge.handle({
      action: "authoring",
      payload: {
        op: "propose",
        documentPath: "scene.json",
        jsonPointer: "/id",
        newValue: "replacement-review",
      },
    })).toMatchObject({ ok: true, data: { phase: "reviewing" } });

    const accepted = bridge.handle({ action: "authoring", payload: { op: "accept" } });
    expect(accepted).toMatchObject({ ok: true, data: { phase: "applied" } });
    if (!accepted.ok) return;
    expect(accepted.data).not.toHaveProperty("assetImport");
    expect(() => readFileSync(join(root, "assets/triangle.gltf"))).toThrow();
    const after = JSON.parse(readFileSync(join(root, "scene.json"), "utf8")) as {
      id: string;
      data: unknown;
    };
    expect(after.id).toBe("replacement-review");
    expect(after.data).toEqual(before.data);
  });
});
