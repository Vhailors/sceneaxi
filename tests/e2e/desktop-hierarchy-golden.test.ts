import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { composeScene } from "@sceneaxi/authoring-core";
import {
  DESKTOP_SCENE_HIERARCHY_REFUSALS,
  EDITOR_COMMAND_REFUSALS,
  SCENE_COMPOSITION_INTAKE_KIND,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  composedSceneFromDocumentData,
  createEditorCommandInvocation,
  type EditorCommandClient,
  type JsonObject,
} from "@sceneaxi/schemas";
import { createDesktopSession, shellApply } from "@sceneaxi/desktop-shell";
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
  it("keeps hierarchy data out of generic project status", () => {
    const root = fixture();
    for (const bridge of [
      hierarchyBridge(root),
      hierarchyBridge(root, { commandProfile: "kids" }),
      createDesktopBridge({ cwd: root }),
    ]) {
      const status = bridge.handle({
        action: "authoring",
        payload: { op: "status", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
      });
      expect(status).toMatchObject({ ok: true, data: { ok: true } });
      if (!status.ok) continue;
      const genericStatus = status.data as {
        data?: Readonly<Record<string, unknown>>;
        dataKeys?: readonly string[];
      };
      expect(genericStatus).not.toHaveProperty("editableScene");
      expect(genericStatus.data).not.toHaveProperty("composedScene");
      expect(genericStatus.dataKeys).not.toContain("composedScene");

      const restarted = bridge.handle({
        action: "authoring",
        payload: { op: "restart", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
      });
      expect(restarted).toMatchObject({ ok: true, data: { ok: true } });
      if (!restarted.ok) continue;
      const restartedStatus = restarted.data as {
        data?: Readonly<Record<string, unknown>>;
        dataKeys?: readonly string[];
      };
      expect(restartedStatus).not.toHaveProperty("editableScene");
      expect(restartedStatus.data).not.toHaveProperty("composedScene");
      expect(restartedStatus.dataKeys).not.toContain("composedScene");
    }

    const reviewingBridge = hierarchyBridge(root);
    const staged = reviewingBridge.handle({
      action: "authoring",
      payload: {
        op: "edit-scene",
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: contentHash(reviewingBridge),
        profile: "game",
        operation: {
          kind: "reparent-object",
          instanceId: "desktop-crate-beside",
          parentInstanceId: "desktop-crate-stacked",
          transformPolicy: "preserve-local",
        },
      },
    });
    expect(staged).toMatchObject({
      ok: true,
      data: {
        phase: "reviewing",
        unifiedDiff: null,
        renderedDiff: null,
        proposal: null,
      },
    });
    expect(JSON.stringify(staged)).not.toContain("composedScene");
    const reviewingStatus = reviewingBridge.handle({
      action: "authoring",
      payload: { op: "status", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    expect(reviewingStatus).toMatchObject({
      ok: true,
      data: {
        authoringSnapshot: {
          phase: "reviewing",
          unifiedDiff: null,
          renderedDiff: null,
          proposal: null,
        },
      },
    });
    if (reviewingStatus.ok) {
      expect(JSON.stringify(reviewingStatus.data)).not.toContain("composedScene");
    }
    expect(command(reviewingBridge, "scene-hierarchy-inspect", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    })).toMatchObject({
      ok: true,
      data: {
        authoringSnapshot: {
          phase: "reviewing",
          proposal: { edits: [{ jsonPointer: "/data/composedScene" }] },
        },
      },
    });
    const recovered = reviewingBridge.handle({
      action: "authoring",
      payload: { op: "recover" },
    });
    expect(recovered).toMatchObject({
      ok: true,
      data: { unifiedDiff: null, renderedDiff: null, proposal: null },
    });
    expect(JSON.stringify(recovered)).not.toContain("composedScene");
    const accepted = reviewingBridge.handle({
      action: "authoring",
      payload: { op: "accept" },
    });
    expect(accepted).toMatchObject({ ok: true, data: { phase: "applied" } });
    expect(JSON.stringify(accepted)).not.toContain("composedScene");
  });

  it("normalizes desktop, CLI, and assistant selections and inspections identically", () => {
    const root = fixture();
    const clients = ["desktop-control", "cli", "local-agent"] as const;
    const results = clients.map((client) => {
      const bridge = hierarchyBridge(root);
      const selected = command(bridge, "scene-selection-set", client, {
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        profile: "game",
        instanceIds: ["desktop-crate-stacked", "desktop-crate-beside"],
      });
      const inspected = command(bridge, "scene-hierarchy-inspect", client, {
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        profile: "game",
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
        transaction: {
          schemaVersion: 1,
          commandId: "scene-object-reparent",
          transactionId: null,
          status: "reviewing",
          progress: { phase: "reviewing", percent: 50, terminal: false },
          evidence: {
            kind: "scene-hierarchy",
            target: "change-review",
            documentPaths: [DESKTOP_ACTIVE_DOCUMENT_PATH],
          },
          refusal: null,
          undo: { kind: "none", commandId: null },
        },
        sceneEditOperation: { kind: "reparent-object", transformPolicy: "preserve-world" },
        editableScene: {
          entities: expect.arrayContaining([
            expect.objectContaining({
              id: "desktop-crate-beside",
              label: expect.stringContaining("Instance desktop-crate-beside"),
            }),
          ]),
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
    expect(JSON.stringify(staged)).not.toContain("Placed beside the root");
    expect(JSON.stringify(staged)).not.toContain("Stacked on the root");
    expect(readFileSync(path, "utf8")).toBe(before);

    const accepted = command(bridge, "change-review-accept", "desktop-control", {});
    expect(accepted).toMatchObject({
      ok: true,
      data: { transaction: { status: "completed", transactionId: expect.any(String) } },
    });
    const after = readFileSync(path, "utf8");
    expect(after).not.toBe(before);

    const reopened = hierarchyBridge(root);
    const reopenedInspection = command(reopened, "scene-hierarchy-inspect", "local-agent", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    });
    expect(reopenedInspection).toMatchObject({
      ok: true,
      data: {
        entities: expect.arrayContaining([
          expect.objectContaining({
            id: "desktop-crate-beside",
            label: expect.stringContaining("Instance desktop-crate-beside"),
            parentInstanceId: "desktop-crate-stacked",
          }),
        ]),
        hierarchy: {
          objects: expect.arrayContaining([
            expect.objectContaining({ id: "desktop-crate-beside", parentId: "desktop-crate-stacked" }),
          ]),
        },
      },
    });
    expect(JSON.stringify(reopenedInspection)).not.toContain("Placed beside the root");
    expect(JSON.stringify(reopenedInspection)).not.toContain("Stacked on the root");
    const played = command(reopened, "run-play", "cli", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
    });
    if (!played.ok) throw new Error(JSON.stringify(played));
    expect(played).toMatchObject({
      ok: true,
      data: {
        mountable: {
          instances: expect.arrayContaining([
            expect.objectContaining({
              instanceId: "desktop-crate-beside",
              label: "desktop-crate-beside",
              parentInstanceId: "desktop-crate-stacked",
            }),
          ]),
        },
      },
    });
    expect(JSON.stringify(played)).not.toContain("Placed beside the root");
    expect(JSON.stringify(played)).not.toContain("Stacked on the root");

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
      expect(staged).toMatchObject({
        ok: true,
        data: {
          phase: "reviewing",
          transaction: {
            commandId: "scene-object-reparent",
            status: "reviewing",
            evidence: { kind: "scene-hierarchy", target: "change-review" },
            refusal: null,
            undo: { kind: "none", commandId: null },
          },
        },
      });
      expect(command(bridge, "change-review-accept", client, {})).toMatchObject({ ok: true });
      return readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
    });

    expect(new Set(bytes).size).toBe(1);
  });

  it("returns reviewing transaction results for property clients", () => {
    for (const client of ["desktop-control", "cli", "local-agent"] as const) {
      const root = fixture();
      const bridge = hierarchyBridge(root);
      const staged = command(bridge, "scene-property-set", client, {
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: contentHash(bridge),
        profile: "game",
        instanceId: "desktop-crate-beside",
        propertyId: "translation-x",
        newValue: -3.25,
      });
      expect(staged).toMatchObject({
        ok: true,
        data: {
          phase: "reviewing",
          transaction: {
            commandId: "scene-property-set",
            status: "reviewing",
            progress: { phase: "reviewing", terminal: false },
            evidence: { kind: "scene-hierarchy", target: "change-review" },
            refusal: null,
            undo: { kind: "none", commandId: null },
          },
        },
      });
    }
  });

  it("keeps explicit selection newer than a staged proposal", () => {
    const root = fixture();
    const bridge = hierarchyBridge(root);
    expect(command(bridge, "scene-object-create", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: contentHash(bridge),
      profile: "game",
      sourceInstanceId: "desktop-crate-beside",
      parentInstanceId: "desktop-crate-root",
    })).toMatchObject({
      ok: true,
      data: { phase: "reviewing", selectedInstanceIds: ["desktop-crate-beside-copy-1"] },
    });
    expect(command(bridge, "scene-selection-set", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
      instanceIds: ["desktop-crate-stacked"],
    })).toMatchObject({ ok: true });
    expect(command(bridge, "change-review-accept", "desktop-control", {}))
      .toMatchObject({ ok: true, data: { phase: "applied" } });
    expect(command(bridge, "scene-hierarchy-inspect", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    })).toMatchObject({
      ok: true,
      data: { selection: { instanceIds: ["desktop-crate-stacked"] } },
    });
  });

  it("settles the matching staged selection after completed recovery", () => {
    const root = fixture();
    const applyProposal: typeof shellApply = (input) => {
      const applied = shellApply(input);
      if (!applied.ok) return applied;
      return {
        ok: false,
        proposal: applied.proposal,
        unifiedDiff: applied.unifiedDiff,
        renderedDiff: applied.renderedDiff,
        applicationState: "indeterminate",
        journalRecoveryPending: true,
        transactionId: applied.transactionId,
        diagnostics: [{ code: "apply-in-progress", message: "Apply recovery is pending." }],
      };
    };
    const bridge = hierarchyBridge(root, {
      createAuthoringSession: () => createDesktopSession({
        cwd: root,
        operations: { applyProposal },
      }),
    });

    expect(command(bridge, "scene-object-create", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: contentHash(bridge),
      profile: "game",
      sourceInstanceId: "desktop-crate-beside",
      parentInstanceId: "desktop-crate-root",
    })).toMatchObject({
      ok: true,
      data: { phase: "reviewing", selectedInstanceIds: ["desktop-crate-beside-copy-1"] },
    });
    expect(command(bridge, "change-review-accept", "desktop-control", {})).toMatchObject({
      ok: true,
      data: { phase: "pending", journalRecoveryPending: true },
    });
    expect(bridge.handle({ action: "authoring", payload: { op: "recover" } })).toMatchObject({
      ok: true,
      data: { phase: "applied", journalRecoveryPending: false },
    });
    expect(command(bridge, "scene-hierarchy-inspect", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    })).toMatchObject({
      ok: true,
      data: {
        ok: true,
        selection: { instanceIds: ["desktop-crate-beside-copy-1"] },
      },
    });
  });

  it("invalidates staged selection when its proposal is discarded", () => {
    const root = fixture();
    const bridge = hierarchyBridge(root);
    expect(command(bridge, "scene-selection-set", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
      instanceIds: ["desktop-crate-beside"],
    })).toMatchObject({ ok: true });
    expect(command(bridge, "scene-object-create", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: contentHash(bridge),
      profile: "game",
      sourceInstanceId: "desktop-crate-beside",
      parentInstanceId: "desktop-crate-root",
    })).toMatchObject({ ok: true, data: { phase: "reviewing" } });
    expect(bridge.handle({
      action: "authoring",
      payload: {
        op: "propose",
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: `sha256:${"0".repeat(64)}`,
        jsonPointer: "/data/material/roughness",
        newValue: 0.7,
      },
    })).toMatchObject({
      ok: true,
      data: { phase: "idle", diagnostics: [{ code: "content-hash-conflict" }] },
    });
    expect(bridge.handle({
      action: "authoring",
      payload: {
        op: "propose",
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: contentHash(bridge),
        jsonPointer: "/data/material/roughness",
        newValue: 0.8,
      },
    })).toMatchObject({ ok: true, data: { phase: "reviewing" } });
    expect(bridge.handle({ action: "authoring", payload: { op: "accept" } }))
      .toMatchObject({ ok: true, data: { phase: "applied" } });
    expect(command(bridge, "scene-hierarchy-inspect", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    })).toMatchObject({
      ok: true,
      data: { selection: { instanceIds: ["desktop-crate-beside"] } },
    });
  });

  it("names legacy root and stale remove refusals before proposal", () => {
    const root = fixture();
    const bridge = hierarchyBridge(root);
    const remove = (instanceId: string) => bridge.handle({
      action: "authoring",
      payload: {
        op: "edit-scene",
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: contentHash(bridge),
        profile: "game",
        operation: { kind: "remove-instance", instanceId },
      },
    });
    expect(remove("desktop-crate-root")).toMatchObject({
      ok: true,
      data: {
        ok: false,
        reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.protectedRoot,
        diagnostics: [{ code: DESKTOP_SCENE_HIERARCHY_REFUSALS.protectedRoot }],
      },
    });
    expect(remove("missing-instance")).toMatchObject({
      ok: true,
      data: {
        ok: false,
        reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
        diagnostics: [{ code: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale }],
        hierarchy: { rootInstanceId: "desktop-crate-root" },
        entities: expect.arrayContaining([
          expect.objectContaining({ id: "desktop-crate-beside" }),
        ]),
      },
    });
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
      data: {
        phase: "reviewing",
        selectedInstanceIds: ["desktop-crate-beside-copy-1"],
        transaction: {
          commandId: "scene-object-create",
          status: "reviewing",
          progress: { phase: "reviewing", terminal: false },
          evidence: { kind: "scene-hierarchy", target: "change-review" },
          refusal: null,
          undo: { kind: "none", commandId: null },
        },
      },
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
        transaction: {
          commandId: "scene-object-remove",
          status: "reviewing",
          progress: { phase: "reviewing", terminal: false },
          evidence: { kind: "scene-hierarchy", target: "change-review" },
          refusal: null,
          undo: { kind: "none", commandId: null },
        },
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
      profile: "game",
    })).toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.kidsDenied });
    const missing = createDesktopBridge({ cwd: root, createAuthoringSession });
    expect(command(missing, "scene-hierarchy-inspect", "cli", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    })).toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.capabilityMissing });
    expect(createAuthoringSession).not.toHaveBeenCalled();

    const bridge = hierarchyBridge(root);
    expect(command(bridge, "scene-selection-set", "local-agent", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
      instanceIds: ["missing-object"],
    })).toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale });
    expect(command(bridge, "scene-property-set", "cli", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: contentHash(bridge),
      profile: "game",
      instanceId: "missing-object",
      propertyId: "translation-x",
      newValue: 1,
    })).toMatchObject({
      ok: true,
      data: {
        ok: false,
        reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
        transaction: { refusal: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale },
      },
    });
    expect(bridge.handle({
      action: "command",
      payload: {
        schemaVersion: 1,
        commandId: "scene-object-reparent",
        client: "cli",
        permission: "project:write",
        profile: "game",
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

    const invalidPolicyInput = {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: contentHash(bridge),
      profile: "game",
      instanceId: "desktop-crate-beside",
      parentInstanceId: "desktop-crate-root",
      transformPolicy: "implicit",
    };
    for (const [payload, reason] of [
      [{
        schemaVersion: 2,
        commandId: "scene-object-reparent",
        client: "cli",
        permission: "project:write",
        profile: "game",
        input: invalidPolicyInput,
      }, EDITOR_COMMAND_REFUSALS.schemaUnsupported],
      [{
        schemaVersion: 1,
        commandId: "scene-object-reparent",
        client: "unknown",
        permission: "project:write",
        profile: "game",
        input: invalidPolicyInput,
      }, EDITOR_COMMAND_REFUSALS.clientDenied],
      [{
        schemaVersion: 1,
        commandId: "scene-object-reparent",
        client: "cli",
        permission: "project:read",
        profile: "game",
        input: invalidPolicyInput,
      }, EDITOR_COMMAND_REFUSALS.permissionDenied],
    ] as const) {
      expect(bridge.handle({ action: "command", payload })).toMatchObject({
        ok: false,
        reason,
      });
    }
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
    const raw = (
      bridge: ReturnType<typeof createDesktopBridge>,
      profile: unknown,
      value: unknown,
      overrides: Readonly<Record<string, unknown>> = {},
    ) =>
      bridge.handle({
        action: "authoring",
        payload: {
          op: "edit-scene",
          documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
          expectedContentHash: `sha256:${"1".repeat(64)}`,
          profile,
          operation: value,
          ...overrides,
        },
      });
    const rawProperty = (
      bridge: ReturnType<typeof createDesktopBridge>,
      profile: unknown,
      overrides: Readonly<Record<string, unknown>> = {},
    ) => bridge.handle({
      action: "authoring",
      payload: {
        op: "edit-property",
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: `sha256:${"1".repeat(64)}`,
        profile,
        entityId: "desktop-crate-beside",
        propertyId: "translation-x",
        newValue: 2,
        ...overrides,
      },
    });

    expect(raw(createDesktopBridge({ cwd: root, createAuthoringSession }), "game", operation))
      .toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.capabilityMissing });
    expect(raw(hierarchyBridge(root, { commandProfile: "kids", createAuthoringSession }), "game", operation))
      .toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.kidsDenied });
    expect(raw(hierarchyBridge(root, { commandProfile: "game", createAuthoringSession }), "web", operation))
      .toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported });
    expect(raw(hierarchyBridge(root, { createAuthoringSession }), "game", { kind: "unknown" }))
      .toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported });
    expect(raw(hierarchyBridge(root, { createAuthoringSession }), "profile-game", operation))
      .toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported });
    expect(rawProperty(createDesktopBridge({ cwd: root, createAuthoringSession }), "game"))
      .toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.capabilityMissing });
    expect(rawProperty(
      hierarchyBridge(root, { commandProfile: "kids", createAuthoringSession }),
      "game",
    )).toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.kidsDenied });
    expect(rawProperty(hierarchyBridge(root, { createAuthoringSession }), undefined))
      .toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported });
    expect(raw(hierarchyBridge(root, { createAuthoringSession }), "game", {
      kind: "reparent-object",
      instanceId: "desktop-crate-beside",
      parentInstanceId: "desktop-crate-root",
      transformPolicy: "implicit",
    })).toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.policyInvalid });
    const authorized = hierarchyBridge(root, { createAuthoringSession });
    for (const response of [
      raw(authorized, "game", operation, { documentPath: "../scene.json" }),
      raw(authorized, "game", operation, { expectedContentHash: `sha256:${"A".repeat(64)}` }),
      raw(authorized, "game", operation, { unexpected: true }),
      rawProperty(authorized, "game", { documentPath: "/tmp/scene.json" }),
      rawProperty(authorized, "game", { expectedContentHash: "sha256:not-canonical" }),
      rawProperty(authorized, "game", { entityId: "../crate" }),
      rawProperty(authorized, "game", { propertyId: "unknown-property" }),
      rawProperty(authorized, "game", { newValue: Number.POSITIVE_INFINITY }),
      rawProperty(authorized, "game", { unexpected: true }),
      authorized.handle({
        action: "authoring",
        payload: {
          op: "propose",
          documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
          jsonPointer: "",
          newValue: {},
        },
      }),
      authorized.handle({
        action: "authoring",
        payload: {
          op: "propose",
          documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
          jsonPointer: "/data",
          newValue: {},
        },
      }),
      authorized.handle({
        action: "authoring",
        payload: {
          op: "propose",
          documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
          jsonPointer: "/data/composedScene",
          newValue: {},
        },
      }),
      authorized.handle({
        action: "authoring",
        payload: {
          op: "propose",
          documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
          jsonPointer: "/data/composedScene/instances/1/localTransform/translation/0",
          newValue: 4,
        },
      }),
    ]) {
      expect(response).toMatchObject({
        ok: false,
        reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
      });
    }
    expect(command(
      hierarchyBridge(root, { commandProfile: "game", createAuthoringSession }),
      "scene-hierarchy-inspect",
      "desktop-control",
      { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH, profile: "web" },
    )).toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported });
    expect(createAuthoringSession).not.toHaveBeenCalled();
  });

  it("preserves stale refusal until an explicit current selection recovers it", () => {
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
    expect(command(bridge, "edit-redo", "desktop-control", {})).toMatchObject({ ok: true });
    const bytesBeforeRefusal = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
    const statusBeforeRefusal = bridge.handle({
      action: "authoring",
      payload: { op: "status", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    const stagedWhileStale = command(bridge, "scene-object-reparent", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: contentHash(bridge),
      profile: "game",
      instanceId: "desktop-crate-beside",
      parentInstanceId: "desktop-crate-stacked",
      transformPolicy: "preserve-local",
    });
    expect(stagedWhileStale).toMatchObject({
      ok: true,
      data: {
        ok: false,
        reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
        diagnostics: [{ code: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale }],
        transaction: {
          commandId: "scene-object-reparent",
          status: "refused",
          refusal: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
        },
        hierarchy: { rootInstanceId: "desktop-crate-root" },
        entities: expect.arrayContaining([
          expect.objectContaining({ id: "desktop-crate-beside" }),
        ]),
      },
    });
    for (const client of ["cli", "local-agent"] as const) {
      expect(command(bridge, "scene-object-reparent", client, {
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: contentHash(bridge),
        profile: "game",
        instanceId: "desktop-crate-beside",
        parentInstanceId: "desktop-crate-stacked",
        transformPolicy: "preserve-local",
      })).toMatchObject({
        ok: true,
        data: {
          ok: false,
          reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
          diagnostics: [{ code: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale }],
          transaction: {
            commandId: "scene-object-reparent",
            status: "refused",
            refusal: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
          },
        },
      });
    }
    expect(command(bridge, "scene-hierarchy-inspect", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    })).toMatchObject({
      ok: true,
      data: {
        ok: false,
        reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
        diagnostics: [{ code: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale }],
        hierarchy: { rootInstanceId: "desktop-crate-root" },
        entities: expect.arrayContaining([
          expect.objectContaining({ id: "desktop-crate-beside-copy-1" }),
        ]),
      },
    });
    expect(command(bridge, "scene-selection-set", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
      instanceIds: ["missing-instance"],
    })).toMatchObject({
      ok: false,
      reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
    });
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).toBe(bytesBeforeRefusal);
    expect(bridge.handle({
      action: "authoring",
      payload: { op: "status", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    })).toEqual(statusBeforeRefusal);
    expect(command(bridge, "scene-hierarchy-inspect", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    })).toMatchObject({
      ok: true,
      data: { ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale },
    });
    expect(command(bridge, "scene-selection-set", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
      instanceIds: ["desktop-crate-beside"],
    })).toMatchObject({
      ok: true,
      data: {
        ok: true,
        contentHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
        hierarchy: { rootInstanceId: "desktop-crate-root" },
        entities: expect.arrayContaining([
          expect.objectContaining({ id: "desktop-crate-beside" }),
        ]),
        selection: { instanceIds: ["desktop-crate-beside"] },
      },
    });
    expect(command(bridge, "scene-object-reparent", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: contentHash(bridge),
      profile: "game",
      instanceId: "desktop-crate-beside",
      parentInstanceId: "desktop-crate-stacked",
      transformPolicy: "preserve-local",
    })).toMatchObject({ ok: true, data: { phase: "reviewing" } });
    expect(command(bridge, "change-review-reject", "desktop-control", {}))
      .toMatchObject({ ok: true });
    expect(command(bridge, "scene-hierarchy-inspect", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    })).toMatchObject({
      ok: true,
      data: { selection: { instanceIds: ["desktop-crate-beside"] } },
    });
  });

  it("defers created-object selection until review acceptance", () => {
    const root = fixture();
    const bridge = hierarchyBridge(root);
    expect(command(bridge, "scene-selection-set", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
      instanceIds: ["desktop-crate-beside"],
    })).toMatchObject({ ok: true });

    expect(command(bridge, "scene-object-create", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: contentHash(bridge),
      profile: "game",
      sourceInstanceId: "desktop-crate-beside",
      parentInstanceId: "desktop-crate-root",
    })).toMatchObject({
      ok: true,
      data: {
        phase: "reviewing",
        selectedInstanceIds: ["desktop-crate-beside-copy-1"],
      },
    });
    expect(command(bridge, "scene-hierarchy-inspect", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    })).toMatchObject({
      ok: true,
      data: {
        ok: true,
        selection: { instanceIds: ["desktop-crate-beside"] },
        authoringSnapshot: { phase: "reviewing" },
      },
    });
    expect(command(bridge, "change-review-accept", "desktop-control", {}))
      .toMatchObject({ ok: true, data: { phase: "applied" } });
    expect(command(bridge, "scene-hierarchy-inspect", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    })).toMatchObject({
      ok: true,
      data: {
        ok: true,
        selection: { instanceIds: ["desktop-crate-beside-copy-1"] },
      },
    });
  });

  it("keeps selection unchanged when hierarchy proposal settlement refuses", () => {
    const root = fixture();
    const bridge = hierarchyBridge(root);
    expect(command(bridge, "scene-selection-set", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
      instanceIds: ["desktop-crate-beside"],
    })).toMatchObject({ ok: true });

    expect(command(bridge, "scene-object-create", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: `sha256:${"0".repeat(64)}`,
      profile: "game",
      sourceInstanceId: "desktop-crate-beside",
      parentInstanceId: "desktop-crate-root",
    })).toMatchObject({
      ok: true,
      data: { diagnostics: [{ code: "content-hash-conflict" }] },
    });
    expect(command(bridge, "scene-hierarchy-inspect", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    })).toMatchObject({
      ok: true,
      data: { selection: { instanceIds: ["desktop-crate-beside"] } },
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

  it("refuses inconsistent asset manifests across hierarchy and Play before copy recovery", () => {
    const root = fixture();
    const sourceRoot = mkdtempSync(
      join(tmpdir(), "sceneaxi-hierarchy-inconsistent-source-"),
    );
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

    const documentPath = join(root, DESKTOP_ACTIVE_DOCUMENT_PATH);
    const document = JSON.parse(readFileSync(documentPath, "utf8")) as {
      data: {
        assetManifest: { assets: Array<{ instanceId: string; relativePath: string }> };
        composedScene: unknown;
      };
    };
    const manifestEntry = document.data.assetManifest.assets[0];
    if (manifestEntry === undefined) throw new Error("accepted asset manifest is empty");
    const stored = composedSceneFromDocumentData(document.data as JsonObject);
    if (!stored.ok) throw new Error("accepted composition is invalid");
    const remaining = stored.value.instances.filter(
      (instance) => instance.instanceId !== manifestEntry.instanceId,
    );
    const artifacts = new Map(remaining.map((instance) => [instance.artifactId, instance.artifact]));
    const recomposed = composeScene({
      schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
      kind: SCENE_COMPOSITION_INTAKE_KIND,
      sceneId: stored.value.sceneId,
      rootInstanceId: stored.value.rootInstanceId,
      placements: remaining.map((instance) => ({
        instanceId: instance.instanceId,
        artifactId: instance.artifactId,
        parentInstanceId: instance.parentInstanceId,
        transform: instance.localTransform,
      })),
    }, [...artifacts.values()]);
    if (!recomposed.ok) throw new Error("inconsistent-manifest fixture could not recompose");
    document.data.composedScene = recomposed.document.data.composedScene;
    writeFileSync(documentPath, `${JSON.stringify(document, null, 2)}\n`);
    const assetPath = join(root, manifestEntry.relativePath);
    unlinkSync(assetPath);
    const inconsistentBytes = readFileSync(documentPath, "utf8");
    const reopened = hierarchyBridge(root);

    expect(command(reopened, "scene-hierarchy-inspect", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    })).toMatchObject({
      ok: true,
      data: { ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.manifestInconsistent },
    });
    expect(command(reopened, "scene-selection-set", "cli", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
      instanceIds: ["desktop-crate-root"],
    })).toMatchObject({
      ok: false,
      reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.manifestInconsistent,
    });
    expect(command(reopened, "scene-property-set", "local-agent", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: contentHash(reopened),
      profile: "web",
      instanceId: "desktop-crate-beside",
      propertyId: "translation-x",
      newValue: -3,
    })).toMatchObject({
      ok: true,
      data: { ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.manifestInconsistent },
    });
    expect(command(reopened, "scene-object-reparent", "cli", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: contentHash(reopened),
      profile: "game",
      instanceId: "desktop-crate-beside",
      parentInstanceId: "desktop-crate-stacked",
      transformPolicy: "preserve-local",
    })).toMatchObject({
      ok: false,
      reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.manifestInconsistent,
    });
    expect(command(reopened, "run-play", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
    })).toMatchObject({
      ok: false,
      reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.manifestInconsistent,
    });
    expect(() => readFileSync(assetPath)).toThrow();
    expect(readFileSync(documentPath, "utf8")).toBe(inconsistentBytes);
  });
});
