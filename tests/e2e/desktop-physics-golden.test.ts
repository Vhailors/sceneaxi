import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  SCENE_PHYSICS_REFUSALS,
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
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-physics-golden-"));
  dirs.push(root);
  expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
  return root;
}

function bridge(root: string) {
  return createDesktopBridge({
    cwd: root,
    commandCapabilities: ["scene.compose", "authoring.change-review", "authoring.undo", "authoring.redo", "runtime.play"],
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

describe("full-editor physics vertical", () => {
  it("authors bodies through review and replays identical Play snapshots without writing", () => {
    const root = fixture();
    const host = bridge(root);
    expect(command(host, "physics-apply", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      mutation: { kind: "body-upsert", bodyId: "falling", instanceId: "desktop-crate-beside", bodyKind: "dynamic", mass: 1 },
    })).toMatchObject({ ok: true });
    expect(command(host, "change-review-accept", "desktop-control", {})).toMatchObject({ ok: true });
    expect(command(host, "physics-apply", "cli", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      mutation: { kind: "shape-upsert", shapeId: "ball", bodyId: "falling", shapeKind: "sphere", size: 0.5 },
    })).toMatchObject({ ok: true });
    expect(command(host, "change-review-accept", "cli", {})).toMatchObject({ ok: true });
    const saved = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH));
    const version = hash(host);
    const first = command(host, "physics-evaluate", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: version,
      profile: "game",
      steps: 4,
      animationOffsetY: 0,
    });
    const second = command(host, "physics-evaluate", "local-agent", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: version,
      profile: "game",
      steps: 4,
      animationOffsetY: 0,
    });
    expect(first).toMatchObject({
      ok: true,
      data: { kind: "sceneaxi.scene-physics-evaluation", order: "animation-then-physics", savedBytesWritten: false },
    });
    expect(second).toEqual(first);
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH))).toEqual(saved);
    expect(command(host, "physics-inspect", "cli", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    })).toMatchObject({
      ok: true,
      data: { kind: "sceneaxi.scene-physics-inspection", catalog: { bodies: [{ bodyId: "falling" }] } },
    });
  });

  it("names missing targets, invalid shapes, unsupported constraints, and unstable steps", () => {
    const root = fixture();
    const host = bridge(root);
    expect(command(host, "physics-apply", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      mutation: { kind: "body-upsert", bodyId: "b1", instanceId: "missing", bodyKind: "dynamic", mass: 1 },
    })).toMatchObject({ ok: false, reason: SCENE_PHYSICS_REFUSALS.targetMissing });
    expect(command(host, "physics-apply", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      mutation: { kind: "body-upsert", bodyId: "b1", instanceId: "desktop-crate-beside", bodyKind: "dynamic", mass: 1 },
    })).toMatchObject({ ok: true });
    expect(command(host, "change-review-accept", "desktop-control", {})).toMatchObject({ ok: true });
    expect(command(host, "physics-apply", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      mutation: { kind: "shape-upsert", shapeId: "s1", bodyId: "b1", shapeKind: "mesh", size: 1 },
    })).toMatchObject({ ok: false, reason: SCENE_PHYSICS_REFUSALS.shapeInvalid });
    expect(command(host, "physics-apply", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      mutation: { kind: "constraint-upsert", constraintId: "c1", constraintKind: "spring", bodyA: "b1", bodyB: "b1" },
    })).toMatchObject({ ok: false, reason: SCENE_PHYSICS_REFUSALS.constraintUnsupported });
    expect(command(host, "physics-apply", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      mutation: { kind: "world-set", gravityY: -9.81, stepMs: 80, seed: 1 },
    })).toMatchObject({ ok: false, reason: SCENE_PHYSICS_REFUSALS.stepUnstable });
  });

  it("undoes a reviewed body without writing evaluate snapshots back to the catalog", () => {
    const root = fixture();
    const host = bridge(root);
    const before = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH));
    expect(command(host, "physics-apply", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      mutation: { kind: "body-upsert", bodyId: "falling", instanceId: "desktop-crate-beside", bodyKind: "dynamic", mass: 1 },
    })).toMatchObject({ ok: true });
    expect(command(host, "change-review-accept", "desktop-control", {})).toMatchObject({ ok: true });
    const version = hash(host);
    expect(command(host, "physics-evaluate", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: version,
      profile: "game",
      steps: 2,
    })).toMatchObject({ ok: true, data: { savedBytesWritten: false } });
    expect(command(host, "edit-undo", "desktop-control", {})).toMatchObject({ ok: true });
    expect(command(host, "physics-inspect", "cli", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    })).toMatchObject({
      ok: true,
      data: { catalog: { bodies: [] } },
    });
    expect(command(host, "edit-redo", "desktop-control", {})).toMatchObject({ ok: true });
    expect(command(host, "physics-inspect", "local-agent", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    })).toMatchObject({
      ok: true,
      data: { catalog: { bodies: [{ bodyId: "falling" }] } },
    });
    expect(before.equals(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH)))).toBe(false);
  });
});
