import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  SCENE_PREFAB_REFUSALS,
  createEditorCommandInvocation,
  type EditorCommandClient,
  type JsonObject,
} from "@sceneaxi/schemas";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  createDesktopBridge,
  seedDesktopProject,
} from "../../desktop/linux/src/index.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-prefab-golden-"));
  dirs.push(root);
  expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
  return root;
}

function bridge(root: string) {
  return createDesktopBridge({
    cwd: root,
    commandCapabilities: [
      "scene.compose",
      "authoring.change-review",
      "authoring.undo",
      "authoring.redo",
    ],
  });
}

function hash(host: ReturnType<typeof createDesktopBridge>) {
  const response = host.handle({
    action: "authoring",
    payload: { op: "status", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
  });
  if (!response.ok || typeof (response.data as { contentHash?: unknown }).contentHash !== "string") {
    throw new Error("fixture status did not return a content hash");
  }
  return (response.data as { contentHash: string }).contentHash;
}

function command(
  host: ReturnType<typeof createDesktopBridge>,
  commandId: Parameters<typeof createEditorCommandInvocation>[0],
  client: EditorCommandClient,
  input: JsonObject,
) {
  return host.handle({
    action: "command",
    payload: createEditorCommandInvocation(commandId, client, input, "game"),
  });
}

describe("full-editor reusable content vertical", () => {
  it("defines, instances, overrides, and inspects the same resolved graph across clients", () => {
    const root = fixture();
    const host = bridge(root);
    const defined = command(host, "scene-prefab-define", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      definitionId: "crate-pair",
      instanceIds: ["desktop-crate-root", "desktop-crate-beside"],
    });
    expect(defined).toMatchObject({ ok: true });
    expect(command(host, "change-review-accept", "desktop-control", {})).toMatchObject({ ok: true });
    const instanced = command(host, "scene-prefab-instance", "cli", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      definitionId: "crate-pair",
      parentInstanceId: "desktop-crate-root",
      instanceKey: "alpha",
    });
    expect(instanced).toMatchObject({ ok: true });
    expect(command(host, "change-review-accept", "cli", {})).toMatchObject({ ok: true });
    const overridden = command(host, "scene-prefab-override", "local-agent", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      instanceId: "pf-crate-pair-alpha",
      sourceInstanceId: "desktop-crate-beside",
      propertyId: "translation-x",
      newValue: 4,
    });
    expect(overridden).toMatchObject({ ok: true });
    expect(command(host, "change-review-accept", "local-agent", {})).toMatchObject({ ok: true });
    const inspected = ["desktop-control", "cli", "local-agent"].map((client) =>
      command(host, "scene-prefab-inspect", client as EditorCommandClient, {
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        profile: "game",
      }),
    );
    expect(inspected[0]).toEqual(inspected[1]);
    expect(inspected[1]).toEqual(inspected[2]);
    expect(inspected[0]).toMatchObject({
      ok: true,
      data: {
        kind: "sceneaxi.scene-prefab-inspection",
        resolved: [{
          instanceId: "pf-crate-pair-alpha",
          stale: false,
          overrides: [{ sourceInstanceId: "desktop-crate-beside", propertyId: "translation-x", value: 4 }],
        }],
      },
    });
    const document = JSON.parse(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")) as {
      data: { composedScene: { instances: readonly { instanceId: string }[] } };
    };
    expect(document.data.composedScene.instances.some((instance) =>
      instance.instanceId === "pf-crate-pair-alpha"
    )).toBe(true);
  });

  it("refuses a source refresh that would silently drop overrides", () => {
    const root = fixture();
    const host = bridge(root);
    expect(command(host, "scene-prefab-define", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      definitionId: "crate-pair",
      instanceIds: ["desktop-crate-root", "desktop-crate-beside"],
    })).toMatchObject({ ok: true });
    expect(command(host, "change-review-accept", "desktop-control", {})).toMatchObject({ ok: true });
    expect(command(host, "scene-prefab-instance", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      definitionId: "crate-pair",
      parentInstanceId: "desktop-crate-root",
      instanceKey: "alpha",
    })).toMatchObject({ ok: true });
    expect(command(host, "change-review-accept", "desktop-control", {})).toMatchObject({ ok: true });
    expect(command(host, "scene-prefab-override", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      instanceId: "pf-crate-pair-alpha",
      sourceInstanceId: "desktop-crate-beside",
      propertyId: "translation-x",
      newValue: 4,
    })).toMatchObject({ ok: true });
    expect(command(host, "change-review-accept", "desktop-control", {})).toMatchObject({ ok: true });
    expect(command(host, "scene-prefab-define", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      definitionId: "crate-pair",
      instanceIds: ["desktop-crate-root"],
    })).toMatchObject({ ok: true });
    expect(command(host, "change-review-accept", "desktop-control", {})).toMatchObject({ ok: true });
    expect(command(host, "scene-prefab-refresh", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      definitionId: "crate-pair",
    })).toMatchObject({
      ok: false,
      reason: SCENE_PREFAB_REFUSALS.sourceConflict,
    });
  });
});
