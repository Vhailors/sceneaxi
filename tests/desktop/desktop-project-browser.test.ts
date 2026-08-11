import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { contentHash } from "@sceneaxi/authoring-core";
import {
  DESKTOP_PROJECT_BROWSER_REFUSALS,
  DESKTOP_PROJECT_BROWSER_STATE_FILE,
  createDesktopBridge,
  createDesktopProjectBrowser,
  seedDesktopProject,
} from "../../desktop/linux/src/index.ts";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function temporary(label: string) {
  const root = mkdtempSync(join(tmpdir(), `sceneaxi-project-browser-${label}-`));
  roots.push(root);
  return root;
}

function containedTriangle() {
  const positions = new Float32Array([-1, 0, 0, 1, 0, 0, 0, 1, 0]);
  const bytes = Buffer.from(positions.buffer);
  return Buffer.from(JSON.stringify({
    asset: { version: "2.0" },
    buffers: [{
      byteLength: bytes.byteLength,
      uri: `data:application/octet-stream;base64,${bytes.toString("base64")}`,
    }],
    bufferViews: [{ buffer: 0, byteLength: bytes.byteLength }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  }));
}

function admittedProject() {
  const root = temporary("project");
  const stateDirectory = temporary("state");
  const sourceRoot = temporary("source");
  const source = join(sourceRoot, "triangle.gltf");
  const sourceBytes = containedTriangle();
  writeFileSync(source, sourceBytes);
  expect(seedDesktopProject(root).ok).toBe(true);
  const bridge = createDesktopBridge({ cwd: root });
  expect(bridge.handle({
    action: "asset-import",
    payload: { profile: "web", documentPath: "scene.json", sourcePath: source },
  })).toMatchObject({ ok: true, data: { outcome: "reviewing" } });
  expect(bridge.handle({ action: "authoring", payload: { op: "accept" } })).toMatchObject({
    ok: true,
    data: { phase: "applied" },
  });
  return { root, stateDirectory, sourceBytes };
}

function statusOf(response: ReturnType<ReturnType<typeof createDesktopProjectBrowser>["handle"]>) {
  if (!response.ok) throw new Error(`${response.reason}: ${response.message}`);
  return response.data.status;
}

describe("contained desktop project and asset browser", () => {
  it("lists only canonical project identities and restores selection without persisting contents", () => {
    const { root, stateDirectory, sourceBytes } = admittedProject();
    const documentBytes = readFileSync(join(root, "scene.json"), "utf8");
    const browser = createDesktopProjectBrowser({ root, stateDirectory });

    const first = statusOf(browser.handle({ action: "status", profile: "web" }));
    expect(first).toMatchObject({
      root: resolve(root),
      activeDocumentPath: "scene.json",
      selectedPath: "scene.json",
      files: [
        {
          kind: "document",
          path: "scene.json",
          fileType: "scene-document",
          digest: contentHash(documentBytes),
          provenance: { authority: "scene-document", documentId: "scene" },
          validation: { state: "valid", reason: null },
          mutable: false,
        },
        {
          kind: "asset",
          path: "assets/triangle.gltf",
          fileType: "contained-gltf",
          byteLength: sourceBytes.byteLength,
          provenance: {
            importer: "@sceneaxi/importers",
            importerVersion: 1,
            formatVersion: "2.0",
            contained: true,
          },
          validation: { state: "valid", reason: null },
          mutable: false,
        },
      ],
    });
    expect(first.files[1]).not.toHaveProperty("canonicalBytesBase64");

    const selected = browser.handle({
      action: "select",
      profile: "web",
      path: "assets/triangle.gltf",
    });
    expect(selected).toMatchObject({
      ok: true,
      data: { outcome: "selected", status: { selectedPath: "assets/triangle.gltf" } },
    });
    const stateText = readFileSync(join(stateDirectory, DESKTOP_PROJECT_BROWSER_STATE_FILE), "utf8");
    expect(JSON.parse(stateText)).toEqual({
      schemaVersion: 1,
      root: resolve(root),
      selectedPath: "assets/triangle.gltf",
    });
    expect(stateText).not.toContain(sourceBytes.toString("base64"));
    expect(stateText.toLowerCase()).not.toMatch(/credential|secret|password/);

    const restarted = createDesktopProjectBrowser({ root, stateDirectory });
    expect(statusOf(restarted.handle({ action: "status", profile: "game" })).selectedPath)
      .toBe("assets/triangle.gltf");
    expect(restarted.handle({
      action: "open",
      profile: "game",
      path: "assets/triangle.gltf",
    })).toMatchObject({
      ok: true,
      data: {
        outcome: "opened",
        status: { activeDocumentPath: "scene.json", selectedPath: "assets/triangle.gltf" },
      },
    });
    expect(readFileSync(join(root, "scene.json"), "utf8")).toBe(documentBytes);
  });

  it("confirmation-gates immutable rename/delete and names dirty, duplicate, traversal, and outside-root refusals", () => {
    const { root, stateDirectory } = admittedProject();
    const clean = createDesktopProjectBrowser({ root, stateDirectory });
    const request = { profile: "web" as const, path: "assets/triangle.gltf" };

    expect(clean.handle({ action: "delete", ...request })).toMatchObject({
      ok: false,
      reason: DESKTOP_PROJECT_BROWSER_REFUSALS.confirmationRequired,
    });
    expect(clean.handle({ action: "delete", ...request, confirmed: true })).toMatchObject({
      ok: false,
      reason: DESKTOP_PROJECT_BROWSER_REFUSALS.operationNotPermitted,
    });
    expect(clean.handle({
      action: "rename",
      ...request,
      confirmed: true,
      targetPath: "scene.json",
    })).toMatchObject({ ok: false, reason: DESKTOP_PROJECT_BROWSER_REFUSALS.duplicatePath });
    expect(clean.handle({
      action: "rename",
      ...request,
      confirmed: true,
      targetPath: "assets/../scene.json",
    })).toMatchObject({ ok: false, reason: DESKTOP_PROJECT_BROWSER_REFUSALS.pathTraversal });
    expect(clean.handle({
      action: "rename",
      ...request,
      confirmed: true,
      targetPath: join(root, "renamed.gltf"),
    })).toMatchObject({ ok: false, reason: DESKTOP_PROJECT_BROWSER_REFUSALS.pathOutsideRoot });
    expect(clean.handle({
      action: "delete",
      profile: "web",
      path: "scene.json",
      confirmed: true,
    })).toMatchObject({ ok: false, reason: DESKTOP_PROJECT_BROWSER_REFUSALS.operationNotPermitted });

    const dirty = createDesktopProjectBrowser({
      root,
      stateDirectory: temporary("dirty-state"),
      isDirty: () => true,
    });
    expect(dirty.handle({ action: "delete", ...request, confirmed: true })).toMatchObject({
      ok: false,
      reason: DESKTOP_PROJECT_BROWSER_REFUSALS.dirty,
    });
  });

  it("reports admitted-copy missing, invalid, symlink, and malformed-manifest states without scanning", () => {
    const { root } = admittedProject();
    const asset = join(root, "assets/triangle.gltf");
    const outside = join(temporary("outside"), "triangle.gltf");
    writeFileSync(outside, containedTriangle());
    unlinkSync(asset);

    const missing = createDesktopProjectBrowser({ root, stateDirectory: temporary("missing-state") });
    expect(statusOf(missing.handle({ action: "status", profile: "web" })).files[1])
      .toMatchObject({ validation: { state: "missing", reason: DESKTOP_PROJECT_BROWSER_REFUSALS.fileMissing } });
    expect(missing.handle({ action: "select", profile: "web", path: "assets/triangle.gltf" }))
      .toMatchObject({ ok: false, reason: DESKTOP_PROJECT_BROWSER_REFUSALS.fileMissing });

    symlinkSync(outside, asset, "file");
    const linked = createDesktopProjectBrowser({ root, stateDirectory: temporary("linked-state") });
    expect(statusOf(linked.handle({ action: "status", profile: "web" })).files[1])
      .toMatchObject({ validation: { state: "refused", reason: DESKTOP_PROJECT_BROWSER_REFUSALS.symlinkEscape } });

    unlinkSync(asset);
    writeFileSync(asset, "different bytes", "utf8");
    const invalid = createDesktopProjectBrowser({ root, stateDirectory: temporary("invalid-state") });
    expect(statusOf(invalid.handle({ action: "status", profile: "web" })).files[1])
      .toMatchObject({ validation: { state: "invalid", reason: DESKTOP_PROJECT_BROWSER_REFUSALS.fileInvalid } });

    const documentPath = join(root, "scene.json");
    const document = JSON.parse(readFileSync(documentPath, "utf8")) as {
      data: { assetManifest: { assets: unknown[] } };
    };
    document.data.assetManifest.assets.push(document.data.assetManifest.assets[0]);
    writeFileSync(documentPath, `${JSON.stringify(document)}\n`, "utf8");
    const malformed = createDesktopProjectBrowser({ root, stateDirectory: temporary("manifest-state") });
    expect(malformed.handle({ action: "status", profile: "web" })).toMatchObject({
      ok: false,
      reason: DESKTOP_PROJECT_BROWSER_REFUSALS.manifestInvalid,
    });
  });

  it("refuses Kids before consulting invalid persisted browser state", () => {
    const { root, stateDirectory } = admittedProject();
    writeFileSync(join(stateDirectory, DESKTOP_PROJECT_BROWSER_STATE_FILE), "not-json", "utf8");
    const browser = createDesktopProjectBrowser({ root, stateDirectory });
    const before = readFileSync(join(stateDirectory, DESKTOP_PROJECT_BROWSER_STATE_FILE), "utf8");

    expect(browser.handle({ action: "status", profile: "kids" })).toMatchObject({
      ok: false,
      reason: DESKTOP_PROJECT_BROWSER_REFUSALS.kidsDenied,
    });
    expect(readFileSync(join(stateDirectory, DESKTOP_PROJECT_BROWSER_STATE_FILE), "utf8"))
      .toBe(before);
    expect(browser.handle({ action: "status", profile: "web" })).toMatchObject({
      ok: false,
      reason: DESKTOP_PROJECT_BROWSER_REFUSALS.stateInvalid,
    });
  });
});
