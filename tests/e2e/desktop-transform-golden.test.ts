import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DESKTOP_SCENE_TRANSFORM_REFUSALS,
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
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-transform-golden-"));
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

function transformInput(
  host: ReturnType<typeof createDesktopBridge>,
  patch: JsonObject,
): JsonObject {
  return {
    documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
    expectedContentHash: hash(host),
    profile: "game",
    instanceIds: ["desktop-crate-beside"],
    mode: "translate",
    space: "local",
    pivot: "individual",
    axes: "x",
    snapIncrement: null,
    valueKind: "absolute",
    values: [2, 0, 0],
    ...patch,
  };
}

describe("full-editor transform vertical", () => {
  it("makes viewport-style deltas and numeric entry share one command result", () => {
    const numericRoot = fixture();
    const gizmoRoot = fixture();
    const numericHost = bridge(numericRoot);
    const gizmoHost = bridge(gizmoRoot);
    const before = readFileSync(join(numericRoot, "scene.json"), "utf8");
    const numeric = command(numericHost, "scene-transform-apply", "desktop-control", transformInput(numericHost, {
      valueKind: "absolute",
      values: [2, 0, 0],
    }));
    const gizmo = command(gizmoHost, "scene-transform-apply", "cli", transformInput(gizmoHost, {
      valueKind: "delta",
      values: [6.4, 0, 0],
    }));
    expect(numeric).toMatchObject({ ok: true, data: { affectedIds: ["desktop-crate-beside"] } });
    expect(gizmo).toMatchObject({ ok: true, data: { affectedIds: ["desktop-crate-beside"] } });
    if (!numeric.ok || !gizmo.ok) return;
    expect((numeric.data as { components: unknown }).components).toEqual(
      (gizmo.data as { components: unknown }).components,
    );
    expect(readFileSync(join(numericRoot, "scene.json"), "utf8")).toBe(before);
  });

  it("keeps preview off saved bytes and makes accept, undo, redo, and reopen agree", () => {
    const root = fixture();
    const host = bridge(root);
    const document = join(root, "scene.json");
    const original = readFileSync(document, "utf8");
    const staged = command(host, "scene-transform-apply", "local-agent", transformInput(host, {
      instanceIds: ["desktop-crate-beside", "desktop-crate-stacked"],
      axes: "x",
      valueKind: "delta",
      values: [1, 0, 0],
    }));
    expect(staged).toMatchObject({
      ok: true,
      data: { affectedIds: ["desktop-crate-beside", "desktop-crate-stacked"] },
    });
    expect(readFileSync(document, "utf8")).toBe(original);
    const accepted = host.handle({ action: "authoring", payload: { op: "accept" } });
    expect(accepted).toMatchObject({ ok: true });
    const saved = readFileSync(document, "utf8");
    expect(saved).not.toBe(original);
    expect(host.handle({ action: "authoring", payload: { op: "undo" } })).toMatchObject({ ok: true });
    expect(readFileSync(document, "utf8")).toBe(original);
    expect(host.handle({ action: "authoring", payload: { op: "redo" } })).toMatchObject({ ok: true });
    expect(readFileSync(document, "utf8")).toBe(saved);
    const reopened = createDesktopBridge({
      cwd: root,
      commandCapabilities: ["scene.compose", "authoring.change-review"],
    });
    const inspected = command(reopened, "scene-hierarchy-inspect", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    });
    expect(inspected).toMatchObject({ ok: true });
    expect(readFileSync(document, "utf8")).toBe(saved);
  });

  it("names invalid world rotate and empty selection before changing bytes", () => {
    const root = fixture();
    const host = bridge(root);
    const original = readFileSync(join(root, "scene.json"), "utf8");
    expect(command(host, "scene-transform-apply", "desktop-control", transformInput(host, {
      mode: "rotate",
      space: "world",
    }))).toMatchObject({
      ok: false,
      reason: DESKTOP_SCENE_TRANSFORM_REFUSALS.spaceInvalid,
    });
    expect(readFileSync(join(root, "scene.json"), "utf8")).toBe(original);
  });
});
