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

function containedTriangle(offset = 0) {
  const positions = new Float32Array([
    -1 + offset, 0, 0,
    1 + offset, 0, 0,
    offset, 1, 0,
  ]);
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
  return { root, stateDirectory, sourceBytes, bridge };
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

    const restarted = createDesktopProjectBrowser({
      root,
      stateDirectory,
    });
    expect(statusOf(restarted.handle({ action: "status", profile: "game" })).selectedPath)
      .toBe("assets/triangle.gltf");
    expect(restarted.handle({
      action: "open",
      profile: "game",
      path: "assets/triangle.gltf",
    })).toMatchObject({
      ok: true,
      data: {
        outcome: "validated",
        status: { activeDocumentPath: "scene.json", selectedPath: "assets/triangle.gltf" },
      },
    });
    expect(readFileSync(join(root, "scene.json"), "utf8")).toBe(documentBytes);

  });

  it("confirmation-gates immutable rename/delete and names dirty, duplicate, traversal, and outside-root refusals", () => {
    const { root, stateDirectory, bridge } = admittedProject();
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
    expect(dirty.handle({ action: "open", profile: "web", path: "scene.json" }))
      .toMatchObject({ ok: false, reason: DESKTOP_PROJECT_BROWSER_REFUSALS.dirty });

    const stagedSource = join(temporary("staged-source"), "staged.gltf");
    writeFileSync(stagedSource, containedTriangle(0.75));
    expect(bridge.handle({
      action: "asset-import",
      payload: { profile: "web", documentPath: "scene.json", sourcePath: stagedSource },
    })).toMatchObject({ ok: true, data: { outcome: "reviewing" } });
    const reviewing = createDesktopProjectBrowser({
      root,
      stateDirectory: temporary("reviewing-state"),
      isDirty: () => {
        const response = bridge.handle({
          action: "authoring",
          payload: { op: "status", documentPath: "scene.json" },
        });
        if (!response.ok) return true;
        return (response.data as { authoringSnapshot?: { phase?: unknown } })
          .authoringSnapshot?.phase === "reviewing";
      },
    });
    expect(reviewing.handle({ action: "open", profile: "web", path: "scene.json" }))
      .toMatchObject({ ok: false, reason: DESKTOP_PROJECT_BROWSER_REFUSALS.dirty });
    expect(bridge.handle({
      action: "authoring",
      payload: { op: "status", documentPath: "scene.json" },
    })).toMatchObject({ data: { authoringSnapshot: { phase: "reviewing" } } });
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
      reason: DESKTOP_PROJECT_BROWSER_REFUSALS.duplicatePath,
    });
  });

  it("refuses distinct manifest identities that alias one path and mismatched media metadata", () => {
    const duplicated = admittedProject();
    const secondSource = join(temporary("second-source"), "second.gltf");
    writeFileSync(secondSource, containedTriangle(0.25));
    expect(duplicated.bridge.handle({
      action: "asset-import",
      payload: {
        profile: "web",
        documentPath: "scene.json",
        sourcePath: secondSource,
      },
    })).toMatchObject({ ok: true, data: { outcome: "reviewing" } });
    expect(duplicated.bridge.handle({
      action: "authoring",
      payload: { op: "accept" },
    })).toMatchObject({ ok: true, data: { phase: "applied" } });
    const duplicateDocumentPath = join(duplicated.root, "scene.json");
    const duplicateDocument = JSON.parse(readFileSync(duplicateDocumentPath, "utf8")) as {
      data: { assetManifest: { assets: Array<{ relativePath: string }> } };
    };
    expect(duplicateDocument.data.assetManifest.assets).toHaveLength(2);
    const firstPath = duplicateDocument.data.assetManifest.assets[0]?.relativePath;
    const second = duplicateDocument.data.assetManifest.assets[1];
    expect(firstPath).toBeTypeOf("string");
    expect(second).toBeDefined();
    if (firstPath === undefined || second === undefined) return;
    second.relativePath = firstPath;
    writeFileSync(duplicateDocumentPath, `${JSON.stringify(duplicateDocument)}\n`, "utf8");
    expect(createDesktopProjectBrowser({
      root: duplicated.root,
      stateDirectory: temporary("duplicate-path-state"),
    }).handle({ action: "status", profile: "web" })).toMatchObject({
      ok: false,
      reason: DESKTOP_PROJECT_BROWSER_REFUSALS.duplicatePath,
    });

    const mismatched = admittedProject();
    const mismatchDocumentPath = join(mismatched.root, "scene.json");
    const mismatchDocument = JSON.parse(readFileSync(mismatchDocumentPath, "utf8")) as {
      data: { assetManifest: { assets: Array<{ mediaType: string }> } };
    };
    const asset = mismatchDocument.data.assetManifest.assets[0];
    expect(asset).toBeDefined();
    if (asset === undefined) return;
    asset.mediaType = "model/gltf-binary";
    writeFileSync(mismatchDocumentPath, `${JSON.stringify(mismatchDocument)}\n`, "utf8");
    expect(createDesktopProjectBrowser({
      root: mismatched.root,
      stateDirectory: temporary("media-mismatch-state"),
    }).handle({ action: "status", profile: "web" })).toMatchObject({
      ok: false,
      reason: DESKTOP_PROJECT_BROWSER_REFUSALS.manifestInvalid,
    });
  });

  it("refreshes changed asset validation without reparsing an unchanged document", () => {
    const admitted = admittedProject();
    const secondSource = join(temporary("refresh-source"), "second.gltf");
    writeFileSync(secondSource, containedTriangle(0.5));
    expect(admitted.bridge.handle({
      action: "asset-import",
      payload: { profile: "web", documentPath: "scene.json", sourcePath: secondSource },
    }).ok).toBe(true);
    expect(admitted.bridge.handle({ action: "authoring", payload: { op: "accept" } }).ok)
      .toBe(true);
    const browser = createDesktopProjectBrowser({
      root: admitted.root,
      stateDirectory: admitted.stateDirectory,
    });
    expect(browser.handle({ action: "status", profile: "web" })).toMatchObject({ ok: true });
    writeFileSync(join(admitted.root, "assets/triangle.gltf"), "changed", "utf8");

    const selected = browser.handle({
      action: "select",
      profile: "web",
      path: "assets/second.gltf",
    });
    expect(selected).toMatchObject({
      ok: true,
      data: {
        outcome: "selected",
        status: {
          files: expect.arrayContaining([
            expect.objectContaining({
              path: "assets/triangle.gltf",
              validation: expect.objectContaining({
                state: "invalid",
                reason: DESKTOP_PROJECT_BROWSER_REFUSALS.fileInvalid,
              }),
            }),
          ]),
        },
      },
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
