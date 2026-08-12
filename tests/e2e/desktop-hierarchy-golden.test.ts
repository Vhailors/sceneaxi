import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DESKTOP_SCENE_HIERARCHY_REFUSALS,
  createEditorCommandInvocation,
  type EditorCommandClient,
  type JsonObject,
} from "@sceneaxi/schemas";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  createDesktopBridge,
  seedDesktopProject,
  type DesktopBridgeOptions,
} from "../../desktop/linux/src/index.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-hierarchy-golden-"));
  dirs.push(root);
  expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
  return root;
}

const HIERARCHY_CAPABILITIES = Object.freeze([
  "scene.compose",
  "authoring.change-review",
  "authoring.undo",
  "authoring.redo",
  "runtime.play",
]);

function hierarchyBridge(
  root: string,
  options: Omit<DesktopBridgeOptions, "cwd"> = {},
) {
  return createDesktopBridge({
    cwd: root,
    commandCapabilities: HIERARCHY_CAPABILITIES,
    ...options,
  });
}

function containedTriangle() {
  const positions = new Float32Array([-1, 0, 0, 1, 0, 0, 0, 1, 0]);
  const bytes = Buffer.from(positions.buffer);
  return Buffer.from(JSON.stringify({
    asset: { version: "2.0" },
    buffers: [{ byteLength: bytes.byteLength, uri: `data:application/octet-stream;base64,${bytes.toString("base64")}` }],
    bufferViews: [{ buffer: 0, byteLength: bytes.byteLength }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  }));
}

function command(
  bridge: ReturnType<typeof createDesktopBridge>,
  commandId: Parameters<typeof createEditorCommandInvocation>[0],
  client: EditorCommandClient,
  input: JsonObject,
) {
  return bridge.handle({
    action: "command",
    payload: createEditorCommandInvocation(commandId, client, input),
  });
}

function contentHash(bridge: ReturnType<typeof createDesktopBridge>) {
  const response = bridge.handle({
    action: "authoring",
    payload: { op: "status", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
  });
  if (!response.ok || typeof (response.data as { contentHash?: unknown }).contentHash !== "string") {
    throw new Error("fixture status did not return a content hash");
  }
  return (response.data as { contentHash: string }).contentHash;
}

describe("full-editor hierarchy vertical", () => {
  it("normalizes desktop, CLI, and assistant selections and inspections identically", () => {
    const root = fixture();
    const clients = ["desktop-control", "cli", "local-agent"] as const;
    const results = clients.map((client) => {
      const bridge = hierarchyBridge(root);
      const selected = command(bridge, "scene-selection-set", client, {
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        instanceIds: ["desktop-crate-stacked", "desktop-crate-beside"],
      });
      const inspected = command(bridge, "scene-hierarchy-inspect", client, {
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      });
      return { selected, inspected };
    });

    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
    expect(results[0]?.selected).toMatchObject({
      ok: true,
      data: {
        selection: {
          schemaVersion: 1,
          instanceIds: ["desktop-crate-beside", "desktop-crate-stacked"],
          primaryInstanceId: "desktop-crate-beside",
        },
      },
    });
    expect(results[0]?.inspected).toMatchObject({
      ok: true,
      data: {
        hierarchy: {
          kind: "sceneaxi.desktop-scene-hierarchy",
          rootInstanceId: "desktop-crate-root",
          objects: [
            { id: "desktop-crate-root", parentId: null, depth: 0 },
            { id: "desktop-crate-beside", parentId: "desktop-crate-root", depth: 1 },
            { id: "desktop-crate-stacked", parentId: "desktop-crate-root", depth: 1 },
          ],
        },
        selection: { instanceIds: ["desktop-crate-beside", "desktop-crate-stacked"] },
      },
    });
  });

  it("stages one deterministic reparent transaction, then survives save, reopen, Play, undo, and redo", () => {
    const root = fixture();
    const path = join(root, DESKTOP_ACTIVE_DOCUMENT_PATH);
    const before = readFileSync(path, "utf8");
    const bridge = hierarchyBridge(root, { nowMs: () => 1_753_920_000_000 });
    const staged = command(bridge, "scene-object-reparent", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: contentHash(bridge),
      profile: "game",
      instanceId: "desktop-crate-beside",
      parentInstanceId: "desktop-crate-stacked",
      transformPolicy: "preserve-world",
    });
    expect(staged).toMatchObject({
      ok: true,
      data: {
        phase: "reviewing",
        sceneEditOperation: { kind: "reparent-object", transformPolicy: "preserve-world" },
        editableScene: {
          hierarchy: {
            objects: expect.arrayContaining([
              expect.objectContaining({
                id: "desktop-crate-beside",
                parentId: "desktop-crate-stacked",
                worldTransform: expect.objectContaining({ translation: [-4.4, 0, 0] }),
              }),
            ]),
          },
        },
      },
    });
    expect(readFileSync(path, "utf8")).toBe(before);

    const accepted = command(bridge, "change-review-accept", "desktop-control", {});
    expect(accepted).toMatchObject({
      ok: true,
      data: { transaction: { status: "completed", transactionId: expect.any(String) } },
    });
    const after = readFileSync(path, "utf8");
    expect(after).not.toBe(before);

    const reopened = hierarchyBridge(root);
    expect(command(reopened, "scene-hierarchy-inspect", "local-agent", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
    })).toMatchObject({
      ok: true,
      data: {
        hierarchy: {
          objects: expect.arrayContaining([
            expect.objectContaining({ id: "desktop-crate-beside", parentId: "desktop-crate-stacked" }),
          ]),
        },
      },
    });
    const played = command(reopened, "run-play", "cli", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
    });
    if (!played.ok) throw new Error(JSON.stringify(played));
    expect(played).toMatchObject({ ok: true });

    expect(command(reopened, "edit-undo", "cli", {})).toMatchObject({ ok: true });
    expect(readFileSync(path, "utf8")).toBe(before);
    expect(command(reopened, "edit-redo", "local-agent", {})).toMatchObject({ ok: true });
    expect(readFileSync(path, "utf8")).toBe(after);
  });

  it("commits byte-identical reparent results for desktop, CLI, and assistant clients", () => {
    const bytes = (["desktop-control", "cli", "local-agent"] as const).map((client) => {
      const root = fixture();
      const bridge = hierarchyBridge(root, { nowMs: () => 1_753_920_000_000 });
      const staged = command(bridge, "scene-object-reparent", client, {
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: contentHash(bridge),
        profile: "game",
        instanceId: "desktop-crate-beside",
        parentInstanceId: "desktop-crate-stacked",
        transformPolicy: "preserve-local",
      });
      expect(staged).toMatchObject({ ok: true, data: { phase: "reviewing" } });
      expect(command(bridge, "change-review-accept", client, {})).toMatchObject({ ok: true });
      return readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
    });

    expect(new Set(bytes).size).toBe(1);
  });

  it("creates and multi-removes only validated local objects through review", () => {
    const root = fixture();
    const bridge = hierarchyBridge(root);
    const create = command(bridge, "scene-object-create", "cli", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: contentHash(bridge),
      profile: "web",
      sourceInstanceId: "desktop-crate-beside",
      parentInstanceId: "desktop-crate-root",
    });
    expect(create).toMatchObject({
      ok: true,
      data: { phase: "reviewing", selectedInstanceIds: ["desktop-crate-beside-copy-1"] },
    });
    expect(command(bridge, "change-review-accept", "cli", {})).toMatchObject({ ok: true });

    const remove = command(bridge, "scene-object-remove", "local-agent", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: contentHash(bridge),
      profile: "game",
      instanceIds: ["desktop-crate-stacked", "desktop-crate-beside"],
    });
    expect(remove).toMatchObject({
      ok: true,
      data: {
        phase: "reviewing",
        editableScene: {
          hierarchy: {
            objects: [
              { id: "desktop-crate-root" },
              { id: "desktop-crate-beside-copy-1" },
            ],
          },
        },
      },
    });
  });

  it("refuses stale, policy, Kids, and missing-capability requests before writes", () => {
    const root = fixture();
    const path = join(root, DESKTOP_ACTIVE_DOCUMENT_PATH);
    const before = readFileSync(path, "utf8");
    const createAuthoringSession = vi.fn(() => {
      throw new Error("must not reach project authority");
    });
    const kids = hierarchyBridge(root, { commandProfile: "kids", createAuthoringSession });
    expect(command(kids, "scene-hierarchy-inspect", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
    })).toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.kidsDenied });
    const missing = createDesktopBridge({ cwd: root, createAuthoringSession });
    expect(command(missing, "scene-hierarchy-inspect", "cli", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
    })).toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.capabilityMissing });
    expect(createAuthoringSession).not.toHaveBeenCalled();

    const bridge = hierarchyBridge(root);
    expect(command(bridge, "scene-selection-set", "local-agent", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      instanceIds: ["missing-object"],
    })).toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale });
    expect(bridge.handle({
      action: "command",
      payload: {
        schemaVersion: 1,
        commandId: "scene-object-reparent",
        client: "cli",
        permission: "project:write",
        input: {
          documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
          expectedContentHash: contentHash(bridge),
          profile: "game",
          instanceId: "desktop-crate-beside",
          parentInstanceId: "desktop-crate-root",
          transformPolicy: "implicit",
        },
      },
    })).toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.policyInvalid });
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  it("fails closed before session access for raw and registered hierarchy requests", () => {
    const root = fixture();
    const createAuthoringSession = vi.fn(() => {
      throw new Error("must not reach project authority");
    });
    const operation = {
      kind: "create-object",
      sourceInstanceId: "desktop-crate-beside",
      parentInstanceId: "desktop-crate-root",
    };
    const raw = (bridge: ReturnType<typeof createDesktopBridge>, profile: unknown, value: unknown) =>
      bridge.handle({
        action: "authoring",
        payload: {
          op: "edit-scene",
          documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
          expectedContentHash: `sha256:${"1".repeat(64)}`,
          profile,
          operation: value,
        },
      });

    expect(raw(createDesktopBridge({ cwd: root, createAuthoringSession }), "game", operation))
      .toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.capabilityMissing });
    expect(raw(hierarchyBridge(root, { commandProfile: "kids", createAuthoringSession }), "game", operation))
      .toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.kidsDenied });
    expect(raw(hierarchyBridge(root, { createAuthoringSession }), "game", { kind: "unknown" }))
      .toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported });
    expect(raw(hierarchyBridge(root, { createAuthoringSession }), "profile-game", operation))
      .toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported });
    expect(raw(hierarchyBridge(root, { createAuthoringSession }), "game", {
      kind: "reparent-object",
      instanceId: "desktop-crate-beside",
      parentInstanceId: "desktop-crate-root",
      transformPolicy: "implicit",
    })).toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.policyInvalid });
    expect(createAuthoringSession).not.toHaveBeenCalled();
  });

  it("preserves stale selection refusal after undo removes the selected copy", () => {
    const root = fixture();
    const bridge = hierarchyBridge(root);
    expect(command(bridge, "scene-object-create", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: contentHash(bridge),
      profile: "game",
      sourceInstanceId: "desktop-crate-beside",
      parentInstanceId: "desktop-crate-root",
    })).toMatchObject({ ok: true, data: { selectedInstanceIds: ["desktop-crate-beside-copy-1"] } });
    expect(command(bridge, "change-review-accept", "desktop-control", {})).toMatchObject({ ok: true });
    expect(command(bridge, "edit-undo", "desktop-control", {})).toMatchObject({ ok: true });
    expect(command(bridge, "scene-hierarchy-inspect", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
    })).toMatchObject({
      ok: false,
      reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
    });
  });

  it("refuses manifest-backed create and remove without staging or rewriting bytes", () => {
    const root = fixture();
    const sourceRoot = mkdtempSync(join(tmpdir(), "sceneaxi-hierarchy-asset-source-"));
    dirs.push(sourceRoot);
    const source = join(sourceRoot, "triangle.gltf");
    writeFileSync(source, containedTriangle());
    const bridge = hierarchyBridge(root);
    expect(bridge.handle({
      action: "asset-import",
      payload: { profile: "web", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH, sourcePath: source },
    })).toMatchObject({ ok: true, data: { outcome: "reviewing" } });
    expect(bridge.handle({ action: "authoring", payload: { op: "accept" } }))
      .toMatchObject({ ok: true, data: { phase: "applied" } });

    const path = join(root, DESKTOP_ACTIVE_DOCUMENT_PATH);
    const acceptedBytes = readFileSync(path, "utf8");
    const acceptedStatus = bridge.handle({
      action: "authoring",
      payload: { op: "status", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    const document = JSON.parse(acceptedBytes) as {
      data: { assetManifest: { assets: Array<{ instanceId: string }> } };
    };
    const importedInstanceId = document.data.assetManifest.assets[0]?.instanceId;
    if (importedInstanceId === undefined) throw new Error("accepted asset manifest is empty");

    expect(command(bridge, "scene-object-create", "cli", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: contentHash(bridge),
      profile: "game",
      sourceInstanceId: importedInstanceId,
      parentInstanceId: "desktop-crate-root",
    })).toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported });
    expect(command(bridge, "scene-object-remove", "local-agent", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: contentHash(bridge),
      profile: "web",
      instanceIds: [importedInstanceId],
    })).toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported });
    expect(bridge.handle({
      action: "authoring",
      payload: {
        op: "edit-scene",
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: contentHash(bridge),
        profile: "game",
        operation: { kind: "add-instance", sourceInstanceId: importedInstanceId },
      },
    })).toMatchObject({
      ok: true,
      data: { ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported },
    });
    expect(bridge.handle({
      action: "authoring",
      payload: {
        op: "edit-scene",
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: contentHash(bridge),
        profile: "web",
        operation: { kind: "remove-instance", instanceId: importedInstanceId },
      },
    })).toMatchObject({
      ok: true,
      data: { ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported },
    });
    expect(readFileSync(path, "utf8")).toBe(acceptedBytes);
    expect(bridge.handle({
      action: "authoring",
      payload: { op: "status", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    })).toEqual(acceptedStatus);
  });
});
