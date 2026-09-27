/**
 * An accepted model import must leave a composition every reader can reproduce.
 * The packaged smoke found the failure: the importer persisted its placements in
 * append order, so an imported instance whose id sorts before an existing sibling
 * produced scene evidence that recomposition (depth/id traversal) never matches,
 * and every later Play refused DESKTOP_SCENE_NOT_COMPOSABLE.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createEditorCommandInvocation,
  type EditorCommandClient,
  type JsonObject,
} from "@sceneaxi/schemas";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  createDesktopBridge,
  desktopSceneFromDocumentData,
  seedDesktopProject,
} from "../../desktop/linux/src/index.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const ENTITY = "desktop-crate-beside";

function gltf(extra: JsonObject = {}): Buffer {
  const positions = Buffer.from(new Float32Array([-1, 0, 0, 1, 0, 0, 0, 1, 0]).buffer);
  return Buffer.from(JSON.stringify({
    asset: { version: "2.0" },
    buffers: [{ byteLength: positions.byteLength, uri: `data:application/octet-stream;base64,${positions.toString("base64")}` }],
    bufferViews: [{ buffer: 0, byteLength: positions.byteLength }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
    ...extra,
  }));
}

function project() {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-import-order-"));
  dirs.push(root);
  expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
  const host = createDesktopBridge({
    cwd: root,
    commandCapabilities: ["scene.compose", "authoring.change-review", "authoring.undo", "authoring.redo", "runtime.play"],
  });
  const contentHash = () => {
    const response = host.handle({ action: "authoring", payload: { op: "status", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH } });
    const hash = response.ok ? (response.data as { contentHash?: unknown }).contentHash : undefined;
    if (typeof hash !== "string") throw new Error("status returned no content hash");
    return hash;
  };
  const accept = () => {
    expect(host.handle({ action: "authoring", payload: { op: "accept" } })).toMatchObject({ ok: true, data: { phase: "applied" } });
  };
  const command = (id: Parameters<typeof createEditorCommandInvocation>[0], input: JsonObject, client: EditorCommandClient = "desktop-control") =>
    host.handle({ action: "command", payload: createEditorCommandInvocation(id, client, input, "game") });
  const playable = () => {
    const document = JSON.parse(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")) as { data: unknown };
    const scene = desktopSceneFromDocumentData(document.data);
    return scene.ok ? "ok" : scene.message;
  };
  const importModel = (name: string, bytes: Buffer) => {
    const source = join(root, name);
    writeFileSync(source, bytes);
    expect(host.handle({
      action: "asset-import",
      payload: { profile: "game", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH, sourcePath: source },
    })).toMatchObject({ ok: true, data: { outcome: "reviewing" } });
    accept();
  };
  const editScene = (operation: JsonObject) => {
    expect(host.handle({
      action: "authoring",
      payload: { op: "edit-scene", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH, expectedContentHash: contentHash(), profile: "game", operation },
    })).toMatchObject({ ok: true, data: { phase: "reviewing" } });
    accept();
  };
  return { host, contentHash, accept, command, playable, importModel, editScene };
}

describe("accepted model import keeps the composition reproducible", () => {
  for (const name of ["aaa-sorts-first.gltf", "zzz-sorts-last.gltf"]) {
    it(`imports ${name} and Play still composes`, () => {
      const p = project();
      expect(p.playable()).toBe("ok");
      p.importModel(name, gltf());
      expect(p.playable()).toBe("ok");
      expect(p.command("run-play", { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH })).toMatchObject({ ok: true });
    });
  }

  it("imports after transform edits and after a second import that sorts first", () => {
    const p = project();
    p.importModel("smoke-source.gltf", gltf());
    p.editScene({ kind: "set-transform-component", instanceId: ENTITY, propertyId: "rotation-y", value: 45 });
    p.editScene({ kind: "set-transform-component", instanceId: ENTITY, propertyId: "scale-z", value: 1.5 });
    p.importModel("smoke-gui-source.gltf", gltf({ extras: { revision: 2 } }));
    expect(p.playable()).toBe("ok");
    expect(p.command("run-play", { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH })).toMatchObject({ ok: true });
  });
});
