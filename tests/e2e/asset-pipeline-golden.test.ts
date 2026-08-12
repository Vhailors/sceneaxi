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
import { apply } from "../../packages/authoring-core/src/index.ts";
import {
  CONTAINED_GLTF_REFUSALS,
  PROJECT_ASSET_MAX_BYTES,
  materializeProjectAssetCopies,
  projectAssetManifestFromDocumentData,
  proposeProjectAssetImport,
  stageProjectAssetImport,
} from "../../packages/importers/src/index.ts";
import { createDesktopBridge, createDesktopProjectBrowser, seedDesktopProject } from "../../desktop/linux/src/index.ts";
import { assistantAssetInspectionText } from "../../desktop/linux/src/renderer/assistant-inspection.ts";
import { runAssetHotReload, runAssetImport } from "../../packages/cli/src/asset-verbs.ts";
import { runProjectApply } from "../../packages/cli/src/project-verbs.ts";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

function temporary(prefix: string) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

function project(prefix: string) {
  const root = temporary(prefix);
  expect(seedDesktopProject(root).ok).toBe(true);
  return root;
}

function uint32(bytes: Buffer, offset: number, value: number, little = false) {
  little ? bytes.writeUInt32LE(value, offset) : bytes.writeUInt32BE(value, offset);
  return bytes;
}

function uint16(bytes: Buffer, offset: number, value: number, little = false) {
  little ? bytes.writeUInt16LE(value, offset) : bytes.writeUInt16BE(value, offset);
  return bytes;
}

function png(width = 1, height = 1) {
  const bytes = Buffer.alloc(45);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  uint32(bytes, 8, 13);
  bytes.write("IHDR", 12, "ascii");
  uint32(bytes, 16, width);
  uint32(bytes, 20, height);
  bytes.set([8, 6, 0, 0, 0], 24);
  bytes.write("IEND", 37, "ascii");
  return bytes;
}

function jpeg() {
  return Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 0, 1, 0, 2, 1, 1, 0x11, 0, 0xff, 0xd9]);
}

function webp() {
  const bytes = Buffer.alloc(30);
  bytes.write("RIFF", 0, "ascii");
  uint32(bytes, 4, 22, true);
  bytes.write("WEBPVP8X", 8, "ascii");
  uint32(bytes, 16, 10, true);
  return bytes;
}

function wav() {
  const bytes = Buffer.alloc(44);
  bytes.write("RIFF", 0, "ascii");
  uint32(bytes, 4, 36, true);
  bytes.write("WAVEfmt ", 8, "ascii");
  uint32(bytes, 16, 16, true);
  uint16(bytes, 20, 1, true);
  uint16(bytes, 22, 1, true);
  uint32(bytes, 24, 8_000, true);
  uint32(bytes, 28, 8_000, true);
  uint16(bytes, 32, 1, true);
  uint16(bytes, 34, 8, true);
  bytes.write("data", 36, "ascii");
  return bytes;
}

function ogg() {
  const bytes = Buffer.alloc(27);
  bytes.write("OggS", 0, "ascii");
  return bytes;
}

function font(tag: "wOF2" | "wOFF" | "ttf" | "otf") {
  if (tag === "wOF2" || tag === "wOFF") {
    const bytes = Buffer.alloc(tag === "wOF2" ? 48 : 44);
    bytes.write(tag, 0, "ascii");
    uint32(bytes, 8, bytes.byteLength);
    uint16(bytes, 12, 1);
    return bytes;
  }
  const bytes = Buffer.alloc(28);
  if (tag === "otf") bytes.write("OTTO", 0, "ascii");
  else uint32(bytes, 0, 0x00010000);
  uint16(bytes, 4, 1);
  return bytes;
}

function gltf(offset = 0) {
  const positions = Buffer.from(new Float32Array([-1 + offset, 0, 0, 1 + offset, 0, 0, offset, 1, 0]).buffer);
  return Buffer.from(JSON.stringify({
    asset: { version: "2.0" },
    buffers: [{ byteLength: positions.byteLength, uri: `data:application/octet-stream;base64,${positions.toString("base64")}` }],
    bufferViews: [{ buffer: 0, byteLength: positions.byteLength }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  }));
}

const validFixtures = Object.freeze([
  ["artifact.sceneaxi.json", Buffer.from(JSON.stringify({ schemaVersion: 1, kind: "sceneaxi.document", id: "asset-document", data: {} })), "sceneaxi"],
  ["triangle.gltf", gltf(), "model"],
  ["pixel.png", png(), "image"],
  ["photo.jpg", jpeg(), "image"],
  ["texture.webp", webp(), "image"],
  ["tone.wav", wav(), "audio"],
  ["voice.ogg", ogg(), "audio"],
  ["music.mp3", Buffer.from([0xff, 0xfb, 0x90, 0x64]), "audio"],
  ["display.woff2", font("wOF2"), "font"],
  ["legacy.woff", font("wOFF"), "font"],
  ["ui.ttf", font("ttf"), "font"],
  ["serif.otf", font("otf"), "font"],
  ["walk.anim.json", Buffer.from(JSON.stringify({ schemaVersion: 1, kind: "sceneaxi.animation-data", clips: [{ id: "walk", durationMs: 500, tracks: [] }] })), "animation"],
] as const);

describe("first-class manifest-backed asset pipeline", () => {
  it("admits every required family with deterministic validation, preview, provenance, and contained copies", () => {
    const root = project("sceneaxi-assets-all-");
    const sources = temporary("sceneaxi-assets-sources-");
    for (const [name, bytes, family] of validFixtures) {
      const source = join(sources, name);
      writeFileSync(source, bytes);
      const proposed = proposeProjectAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: source });
      expect(proposed).toMatchObject({ ok: true, replayed: false, hotReload: false, entry: { family, supportedProfiles: ["game", "web"], validation: { status: "validated", replacesDigest: null }, preview: { kind: "metadata" }, provenance: { importerVersion: 2, contained: true } } });
      if (!proposed.ok || proposed.proposal === null) continue;
      expect(readFileSync(join(root, "scene.json"), "utf8")).not.toContain(bytes.toString("base64"));
      expect(apply({ cwd: root, proposal: proposed.proposal }).ok).toBe(true);
      const copies = materializeProjectAssetCopies({ projectRoot: root, documentPath: "scene.json" });
      expect(copies.ok).toBe(true);
      expect(readFileSync(join(root, proposed.entry.relativePath))).toEqual(bytes);
    }
    const document = JSON.parse(readFileSync(join(root, "scene.json"), "utf8")) as { data: unknown };
    const manifest = projectAssetManifestFromDocumentData(document.data);
    expect(manifest.ok).toBe(true);
    if (!manifest.ok) return;
    expect(new Set(manifest.value.assets.map((entry) => entry.family))).toEqual(new Set(["sceneaxi", "model", "image", "audio", "font", "animation"]));
    expect(assistantAssetInspectionText(manifest.value.assets)).toContain("pixel · image · 1 × 1");

    const browser = createDesktopProjectBrowser({ root, stateDirectory: join(root, ".browser"), isDirty: () => false });
    const status = browser.handle({ action: "status", profile: "game" });
    expect(status.ok).toBe(true);
    if (status.ok) {
      expect(status.data.status.files.find((file) => file.kind === "asset" && file.assetId === "pixel")).toMatchObject({ family: "image", preview: { label: "1 × 1" } });
    }
    expect(browser.handle({ action: "open", profile: "game", path: "assets/pixel.png" })).toMatchObject({ ok: true, data: { outcome: "validated", status: { selectedPath: "assets/pixel.png" } } });
  });

  it("refuses malformed, oversized, missing, unsupported, duplicate, traversal, and symlink inputs before mutation", () => {
    const root = project("sceneaxi-assets-refuse-");
    const sources = temporary("sceneaxi-assets-refuse-sources-");
    const before = readFileSync(join(root, "scene.json"));
    for (const name of ["bad.sceneaxi.json", "bad.gltf", "bad.png", "bad.wav", "bad.woff2", "bad.anim.json"]) {
      const source = join(sources, name);
      writeFileSync(source, Buffer.from([1, 2, 3]));
      expect(proposeProjectAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: source })).toMatchObject({ ok: false, reason: CONTAINED_GLTF_REFUSALS.malformed });
    }
    for (const name of ["huge.sceneaxi.json", "huge.glb", "huge.png", "huge.wav", "huge.woff2", "huge.anim.json"]) {
      expect(stageProjectAssetImport({ sourceName: name, sourceBytes: new Uint8Array(PROJECT_ASSET_MAX_BYTES + 1), documentPath: "scene.json", expectedContentHash: `sha256:${"0".repeat(64)}`, documentData: {} })).toMatchObject({ ok: false, reason: CONTAINED_GLTF_REFUSALS.oversize });
      expect(proposeProjectAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: join(sources, `missing-${name}`) })).toMatchObject({ ok: false, reason: CONTAINED_GLTF_REFUSALS.sourceUnreadable });
    }
    for (const name of ["markup.svg", "sound.flac", "font.eot", "model.fbx", "code.js"]) {
      const source = join(sources, name);
      writeFileSync(source, Buffer.from("<script>never()</script>"));
      expect(proposeProjectAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: source })).toMatchObject({ ok: false, reason: CONTAINED_GLTF_REFUSALS.unsupportedFormat });
    }
    const valid = join(sources, "same.png");
    writeFileSync(valid, png());
    const first = proposeProjectAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: valid });
    expect(first.ok).toBe(true);
    if (first.ok && first.proposal !== null) {
      expect(apply({ cwd: root, proposal: first.proposal }).ok).toBe(true);
      expect(materializeProjectAssetCopies({ projectRoot: root, documentPath: "scene.json" }).ok).toBe(true);
    }
    expect(proposeProjectAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: valid, assetId: "duplicate" })).toMatchObject({ ok: false, reason: CONTAINED_GLTF_REFUSALS.duplicateContent });
    expect(proposeProjectAssetImport({ projectRoot: root, documentPath: "../scene.json", sourcePath: valid })).toMatchObject({ ok: false, reason: CONTAINED_GLTF_REFUSALS.documentOutsideRoot });
    const link = join(sources, "link.png");
    symlinkSync(valid, link);
    expect(proposeProjectAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: link })).toMatchObject({ ok: false, reason: CONTAINED_GLTF_REFUSALS.sourceSymlink });
    expect(readFileSync(join(root, "scene.json"))).not.toEqual(before);
  });

  it("stages digest hot reload by stable identity and keeps accepted bytes untouched until approval", () => {
    const root = project("sceneaxi-assets-reload-");
    const sources = temporary("sceneaxi-assets-reload-source-");
    const source = join(sources, "first-name.png");
    writeFileSync(source, png(1, 1));
    const imported = proposeProjectAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: source, assetId: "stable-texture" });
    expect(imported.ok).toBe(true);
    if (!imported.ok || imported.proposal === null) return;
    expect(apply({ cwd: root, proposal: imported.proposal }).ok).toBe(true);
    expect(materializeProjectAssetCopies({ projectRoot: root, documentPath: "scene.json" }).ok).toBe(true);
    const acceptedDocument = readFileSync(join(root, "scene.json"));
    const acceptedCopy = readFileSync(join(root, imported.entry.relativePath));

    const renamedSource = join(sources, "renamed-source.png");
    writeFileSync(renamedSource, png(2, 1));
    unlinkSync(join(root, imported.entry.relativePath));
    expect(proposeProjectAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: renamedSource, assetId: "stable-texture", hotReload: true })).toMatchObject({ ok: false, reason: CONTAINED_GLTF_REFUSALS.projectCopyChanged });
    writeFileSync(join(root, imported.entry.relativePath), acceptedCopy);
    writeFileSync(join(root, imported.entry.relativePath), png(4, 1));
    expect(proposeProjectAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: renamedSource, assetId: "stable-texture", hotReload: true })).toMatchObject({ ok: false, reason: CONTAINED_GLTF_REFUSALS.projectCopyChanged });
    writeFileSync(join(root, imported.entry.relativePath), acceptedCopy);
    const reload = proposeProjectAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: renamedSource, assetId: "stable-texture", hotReload: true });
    expect(reload).toMatchObject({ ok: true, hotReload: true, entry: { assetId: "stable-texture", relativePath: imported.entry.relativePath, sourceName: "renamed-source.png", preview: { label: "2 × 1" }, validation: { replacesDigest: imported.entry.digest } } });
    expect(readFileSync(join(root, "scene.json"))).toEqual(acceptedDocument);
    expect(readFileSync(join(root, imported.entry.relativePath))).toEqual(acceptedCopy);
    if (!reload.ok || reload.proposal === null) return;
    expect(apply({ cwd: root, proposal: reload.proposal }).ok).toBe(true);
    expect(readFileSync(join(root, imported.entry.relativePath))).toEqual(acceptedCopy);
    expect(materializeProjectAssetCopies({ projectRoot: root, documentPath: "scene.json" })).toMatchObject({ ok: true, copiedPaths: [imported.entry.relativePath] });
    expect(readFileSync(join(root, imported.entry.relativePath))).toEqual(png(2, 1));
    expect(proposeProjectAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: renamedSource, assetId: "stable-texture", hotReload: true })).toMatchObject({ ok: false, reason: CONTAINED_GLTF_REFUSALS.sourceUnchanged });
  });

  it("exposes import and hot reload through the CLI without using ambient paths as identity", () => {
    const root = project("sceneaxi-assets-cli-");
    const sources = temporary("sceneaxi-assets-cli-source-");
    const source = join(sources, "cli.png");
    writeFileSync(source, png());
    expect(runAssetImport(["asset", "import"], ["--source", source, "--document", "scene.json", "--cwd", root, "--asset-id", "cli-texture", "--out", "import.json"]).envelope).toMatchObject({ ok: true, result: { status: "asset-import-proposed", entry: { family: "image" } } });
    expect(runProjectApply(["project", "apply"], ["--proposal", "import.json", "--cwd", root]).envelope).toMatchObject({ ok: true, result: { status: "applied" } });
    writeFileSync(source, png(3, 1));
    expect(runAssetHotReload(["asset", "reload"], ["--source", source, "--document", "scene.json", "--cwd", root]).envelope).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(runAssetHotReload(["asset", "reload"], ["--source", source, "--document", "scene.json", "--cwd", root, "--asset-id", "cli-texture", "--out", "reload.json"]).envelope).toMatchObject({ ok: true, result: { status: "asset-hot-reload-proposed", entry: { assetId: "cli-texture", preview: { label: "3 × 1" } } } });
    expect(readFileSync(join(root, "assets/cli-texture.png"))).toEqual(png());
    expect(runProjectApply(["project", "apply"], ["--proposal", "reload.json", "--cwd", root]).envelope).toMatchObject({ ok: true, result: { status: "applied" } });
    expect(readFileSync(join(root, "assets/cli-texture.png"))).toEqual(png(3, 1));
  });

  it("keeps model identity and canonical-byte Play loading intact across an approved reload", () => {
    const root = project("sceneaxi-assets-model-reload-");
    const sources = temporary("sceneaxi-assets-model-reload-source-");
    const source = join(sources, "mesh.gltf");
    writeFileSync(source, gltf());
    const imported = proposeProjectAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: source });
    expect(imported.ok).toBe(true);
    if (!imported.ok || imported.proposal === null) return;
    expect(apply({ cwd: root, proposal: imported.proposal }).ok).toBe(true);
    expect(materializeProjectAssetCopies({ projectRoot: root, documentPath: "scene.json" }).ok).toBe(true);
    writeFileSync(source, gltf(0.5));
    const reload = proposeProjectAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: source, assetId: imported.entry.assetId, hotReload: true });
    expect(reload).toMatchObject({ ok: true, entry: { assetId: imported.entry.assetId, artifactId: imported.entry.artifactId, instanceId: imported.entry.instanceId } });
    if (!reload.ok || reload.proposal === null) return;
    expect(apply({ cwd: root, proposal: reload.proposal }).ok).toBe(true);
    expect(materializeProjectAssetCopies({ projectRoot: root, documentPath: "scene.json" }).ok).toBe(true);
    expect(readFileSync(join(root, reload.entry.relativePath))).toEqual(gltf(0.5));
    const played = createDesktopBridge({ cwd: root }).handle({ action: "open-path", payload: { profile: "game", documentPath: "scene.json" } });
    expect(played).toMatchObject({ ok: true, data: { mountable: { importedAssets: [{ instanceId: imported.entry.instanceId, digest: reload.entry.digest }] }, closed: true } });
  });
});
