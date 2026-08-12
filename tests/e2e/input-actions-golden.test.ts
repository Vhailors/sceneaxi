import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  EDITOR_COMMAND_REFUSALS,
  INPUT_ACTION_REFUSALS,
  createEditorCommandInvocation,
  resolveInputAction,
  type JsonObject,
} from "@sceneaxi/schemas";
import { createDesktopBridge } from "../../desktop/linux/src/lib/bridge.js";
import {
  PROJECT_INPUT_ACTIONS_PATH,
  createDesktopInputActionHost,
} from "../../desktop/linux/src/lib/input-action-host.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function root(prefix: string) {
  const path = mkdtempSync(join(tmpdir(), prefix));
  roots.push(path);
  return path;
}

function command(
  bridge: ReturnType<typeof createDesktopBridge>,
  id: "input-actions-inspect" | "input-action-rebind" | "input-actions-reset",
  input: JsonObject,
  profile: "game" | "kids" = "game",
) {
  return bridge.handle({
    action: "command",
    payload: createEditorCommandInvocation(id, "local-agent", input, profile),
  });
}

describe("unified input actions golden", () => {
  it("layers project overrides over restart-durable workspace overrides", () => {
    const projectRoot = root("sceneaxi-input-layer-project-");
    const workspaceRoot = root("sceneaxi-input-layer-workspace-");
    const host = createDesktopInputActionHost({ projectRoot, workspaceDirectory: workspaceRoot });
    const initial = host.inspect();
    if (!initial.ok) throw new Error(initial.message);
    const workspaceReview = host.rebind({
      scope: "workspace",
      expectedBaseVersion: initial.data.baseVersions.workspace,
      actionId: "editor.run.play",
      binding: { device: "keyboard", code: "KeyL", modifiers: ["primary"] },
      approved: false,
      reviewDigest: null,
    });
    if (!workspaceReview.ok) throw new Error(workspaceReview.message);
    expect(host.rebind({
      scope: "workspace",
      expectedBaseVersion: initial.data.baseVersions.workspace,
      actionId: "editor.run.play",
      binding: { device: "keyboard", code: "KeyL", modifiers: ["primary"] },
      approved: true,
      reviewDigest: workspaceReview.data.reviewDigest,
    })).toMatchObject({ ok: true, data: { status: "committed" } });
    const restarted = createDesktopInputActionHost({ projectRoot, workspaceDirectory: workspaceRoot });
    const workspaceMap = restarted.inspect();
    if (!workspaceMap.ok) throw new Error(workspaceMap.message);
    expect(resolveInputAction(workspaceMap.data.map, "editor", {
      device: "keyboard", code: "KeyL", modifiers: ["primary"],
    })).toMatchObject({ ok: true, action: { id: "editor.run.play" } });

    const projectReview = restarted.rebind({
      scope: "project",
      expectedBaseVersion: workspaceMap.data.baseVersions.project,
      actionId: "editor.run.play",
      binding: { device: "keyboard", code: "KeyJ", modifiers: ["primary"] },
      approved: false,
      reviewDigest: null,
    });
    if (!projectReview.ok) throw new Error(projectReview.message);
    expect(restarted.rebind({
      scope: "project",
      expectedBaseVersion: workspaceMap.data.baseVersions.project,
      actionId: "editor.run.play",
      binding: { device: "keyboard", code: "KeyJ", modifiers: ["primary"] },
      approved: true,
      reviewDigest: projectReview.data.reviewDigest,
    })).toMatchObject({ ok: true });
    const layered = restarted.inspect();
    if (!layered.ok) throw new Error(layered.message);
    expect(resolveInputAction(layered.data.map, "editor", {
      device: "keyboard", code: "KeyJ", modifiers: ["primary"],
    })).toMatchObject({ ok: true, action: { id: "editor.run.play" } });
    expect(resolveInputAction(layered.data.map, "editor", {
      device: "keyboard", code: "KeyL", modifiers: ["primary"],
    })).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.unbound });
  });

  it("reviews, commits, restores, and explicitly resets a project binding outside document history", () => {
    const projectRoot = root("sceneaxi-input-project-");
    const workspaceRoot = root("sceneaxi-input-workspace-");
    const host = createDesktopInputActionHost({ projectRoot, workspaceDirectory: workspaceRoot });
    const bridge = createDesktopBridge({
      cwd: projectRoot,
      commandCapabilities: ["input.actions"],
      inputActions: host,
    });
    const inspected = command(bridge, "input-actions-inspect", {});
    expect(inspected).toMatchObject({
      ok: true,
      data: { documentUndoAffected: false, layoutStateAffected: false },
    });
    if (!inspected.ok) throw new Error(inspected.message);
    const base = (inspected.data as { baseVersions: { project: string } }).baseVersions.project;
    const binding = { device: "keyboard", code: "KeyB", modifiers: ["primary"] };
    const review = command(bridge, "input-action-rebind", {
      scope: "project",
      expectedBaseVersion: base,
      actionId: "editor.project.save",
      binding,
      approved: false,
      reviewDigest: null,
    });
    expect(review).toMatchObject({ ok: true, data: { status: "review" } });
    if (!review.ok) throw new Error(review.message);
    const reviewDigest = (review.data as { reviewDigest: string }).reviewDigest;
    expect(existsSync(join(projectRoot, PROJECT_INPUT_ACTIONS_PATH))).toBe(false);

    const committed = command(bridge, "input-action-rebind", {
      scope: "project",
      expectedBaseVersion: base,
      actionId: "editor.project.save",
      binding,
      approved: true,
      reviewDigest,
    });
    expect(committed).toMatchObject({
      ok: true,
      data: { status: "committed", documentUndoAffected: false, layoutStateAffected: false },
    });
    expect(readFileSync(join(projectRoot, PROJECT_INPUT_ACTIONS_PATH), "utf8")).toContain(
      '"editor.project.save"',
    );

    const restartedHost = createDesktopInputActionHost({ projectRoot, workspaceDirectory: workspaceRoot });
    const restored = restartedHost.inspect();
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error(restored.message);
    expect(resolveInputAction(restored.data.map, "editor", binding)).toMatchObject({
      ok: true,
      action: { id: "editor.project.save" },
    });
    expect(resolveInputAction(restored.data.map, "editor", {
      device: "keyboard", code: "KeyS", modifiers: ["primary"],
    })).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.unbound });

    const resetReview = restartedHost.reset({
      scope: "project",
      expectedBaseVersion: restored.data.baseVersions.project,
      approved: false,
      reviewDigest: null,
    });
    if (!resetReview.ok) throw new Error(resetReview.message);
    const reset = restartedHost.reset({
      scope: "project",
      expectedBaseVersion: restored.data.baseVersions.project,
      approved: true,
      reviewDigest: resetReview.data.reviewDigest,
    });
    expect(reset).toMatchObject({ ok: true, data: { operation: "reset", status: "committed" } });
    const defaults = createDesktopInputActionHost({ projectRoot, workspaceDirectory: workspaceRoot }).inspect();
    expect(defaults.ok).toBe(true);
    if (!defaults.ok) throw new Error(defaults.message);
    expect(resolveInputAction(defaults.data.map, "editor", {
      device: "keyboard", code: "KeyS", modifiers: ["primary"],
    })).toMatchObject({ ok: true, action: { id: "editor.project.save" } });
  });

  it("refuses conflicts, stale bases, Kids, and missing capabilities before mutation", () => {
    const projectRoot = root("sceneaxi-input-refuse-project-");
    const workspaceRoot = root("sceneaxi-input-refuse-workspace-");
    const host = createDesktopInputActionHost({ projectRoot, workspaceDirectory: workspaceRoot });
    const bridge = createDesktopBridge({
      cwd: projectRoot,
      commandCapabilities: ["input.actions"],
      inputActions: host,
    });
    const inspected = host.inspect();
    if (!inspected.ok) throw new Error(inspected.message);
    const base = inspected.data.baseVersions.project;
    expect(command(bridge, "input-action-rebind", {
      scope: "project",
      expectedBaseVersion: base,
      actionId: "editor.project.save",
      binding: { device: "controller", controller: 9, input: "button", control: 0, direction: "any" },
      approved: false,
      reviewDigest: null,
    })).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.deviceInputInvalid });
    expect(command(bridge, "input-action-rebind", {
      scope: "project",
      expectedBaseVersion: base,
      actionId: "editor.focus.next",
      binding: { device: "keyboard", code: "KeyB", modifiers: ["primary"] },
      approved: false,
      reviewDigest: null,
    })).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.reservedAction });
    expect(command(bridge, "input-action-rebind", {
      scope: "project",
      expectedBaseVersion: base,
      actionId: "editor.project.save",
      binding: { device: "keyboard", code: "KeyB", modifiers: ["primary"] },
      approved: true,
      reviewDigest: `sha256:${"1".repeat(64)}`,
    })).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.reviewMismatch });
    expect(command(bridge, "input-action-rebind", {
      scope: "project",
      expectedBaseVersion: base,
      actionId: "editor.project.save",
      binding: { device: "keyboard", code: "KeyO", modifiers: ["primary"] },
      approved: true,
      reviewDigest: `sha256:${"1".repeat(64)}`,
    })).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.bindingConflict });
    expect(command(bridge, "input-actions-reset", {
      scope: "project",
      expectedBaseVersion: `sha256:${"0".repeat(64)}`,
      approved: true,
      reviewDigest: `sha256:${"1".repeat(64)}`,
    })).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.staleBase });
    expect(command(bridge, "input-actions-reset", {
      scope: "project",
      expectedBaseVersion: base,
      approved: true,
      reviewDigest: `sha256:${"1".repeat(64)}`,
    }, "kids")).toMatchObject({ ok: false, reason: EDITOR_COMMAND_REFUSALS.kidsDenied });
    const withoutCapability = createDesktopBridge({
      cwd: projectRoot,
      commandCapabilities: [],
      inputActions: host,
    });
    expect(command(withoutCapability, "input-actions-reset", {
      scope: "project",
      expectedBaseVersion: base,
      approved: true,
      reviewDigest: `sha256:${"1".repeat(64)}`,
    })).toMatchObject({ ok: false, reason: EDITOR_COMMAND_REFUSALS.capabilityDenied });
    expect(existsSync(join(projectRoot, PROJECT_INPUT_ACTIONS_PATH))).toBe(false);
  });
});
