import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseDocumentText, runAssistantSculptAction, type AssistantSculptResult } from "@sceneaxi/authoring-core";
import { composedSceneFromDocumentData, digestSceneArtifact, isJsonObject, DESKTOP_SCENE_HIERARCHY_REFUSALS } from "@sceneaxi/schemas";
import { createDesktopBridge } from "../src/lib/bridge.js";
import { DESKTOP_BRIDGE_REFUSALS } from "../src/lib/bridge-contract.js";
import { desktopOpenScene, desktopSceneFromDocumentData, stageDesktopSceneEdit } from "../src/lib/desktop-scene.js";
import { seedDesktopProject } from "../src/lib/project-seed.js";
import type { DesktopAssistantRunRequest } from "../src/lib/bridge/assistant.js";

const hash = "sha256:" + "ab".repeat(32);

const dirs: string[] = [];

afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function directory() {
  const dir = mkdtempSync(join(tmpdir(), "sceneaxi-native-compat-"));
  dirs.push(dir);

  return dir;
}

function sceneData() {
  const opened = desktopOpenScene();

  if (!opened.ok) throw new Error(opened.message);

  return opened.composed.document.data;
}

function stage(documentData: Parameters<typeof stageDesktopSceneEdit>[0]["documentData"], operation: Parameters<typeof stageDesktopSceneEdit>[0]["operation"], profile = "game") {
  return stageDesktopSceneEdit({ documentData, contentHash: hash, profile, operation });
}

function accepted(documentData: Parameters<typeof stageDesktopSceneEdit>[0]["documentData"], operation: Parameters<typeof stageDesktopSceneEdit>[0]["operation"]) {
  const result = stage(documentData, operation);

  if (!result.ok) throw new Error(result.diagnostics[0]?.message);

  if (!isJsonObject(result.edit.newValue)) throw new Error("Scene edit did not produce a JSON object");
  const data = { composedScene: result.edit.newValue };
  const stored = composedSceneFromDocumentData(data);

  if (!stored.ok) throw new Error(stored.diagnostics[0]?.message);
  expect(desktopSceneFromDocumentData(data).ok).toBe(true);

  return { result, data, scene: stored.value };
}

function start(bridge: ReturnType<typeof createDesktopBridge>, extra = {}) {
  return bridge.handle({ action: "assistant", payload: { op: "start", route: "local", profile: "@sceneaxi/profile-game", prompt: "  blue box  ", ...extra } });
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("private injected local assistant execution", () => {
  it("dispatches the real injected compiler with trimmed prompt/profile/progress and publishes its result", async () => {
    const runLocalAssistant = vi.fn((request: DesktopAssistantRunRequest) => {
      request.onProgress({ phase: "ready", percent: 99, message: "private compiler progress" });

      return runAssistantSculptAction({ ...request, route: "local" });
    });

    const bridge = createDesktopBridge({ cwd: directory(), runLocalAssistant });
    expect(start(bridge)).toMatchObject({ ok: true, data: { status: "running", commandId: "assistant-local-build" } });
    expect(runLocalAssistant).toHaveBeenCalledOnce();
    expect(runLocalAssistant.mock.calls[0]?.[0]).toMatchObject({ prompt: "blue box", profile: "@sceneaxi/profile-game", onProgress: expect.any(Function) });
    await flush();
    expect(bridge.handle({ action: "assistant", payload: { op: "status" } })).toMatchObject({ ok: true, data: { status: "ready", progressCount: expect.any(Number), result: { ok: true, route: "local", artifactDigest: expect.stringMatching(/^sha256:/), mountable: { instances: expect.any(Array), artifacts: expect.any(Object) } } } });
  });

  it("keeps default local compilation when no executor is injected", async () => {
    const bridge = createDesktopBridge({ cwd: directory() });
    expect(start(bridge).ok).toBe(true);
    await flush();
    expect(bridge.handle({ action: "assistant", payload: { op: "status" } })).toMatchObject({ ok: true, data: { status: "ready", result: { route: "local" } } });
  });

  it("refuses Kids/hosted/BYO before calling a private local executor", () => {
    const executor = vi.fn((request: DesktopAssistantRunRequest) => runAssistantSculptAction({ ...request, route: "local" }));
    const bridge = createDesktopBridge({ cwd: directory(), runLocalAssistant: executor });
    expect(start(bridge, { profile: "@sceneaxi/profile-kids" })).toMatchObject({ ok: false, reason: "ASSISTANT_SCULPT_KIDS_DENIED" });
    expect(start(bridge, { route: "hosted" })).toMatchObject({ ok: false, reason: DESKTOP_BRIDGE_REFUSALS.assistantHostedMeteringUnavailable });
    expect(start(bridge, { route: "byo" })).toMatchObject({ ok: false, reason: DESKTOP_BRIDGE_REFUSALS.assistantByoUnavailable });
    expect(executor).not.toHaveBeenCalled();
  });

  it.each([false, true])("settles %s async/sync injected failures as runtime refusals", async (synchronous) => {
    const bridge = createDesktopBridge({ cwd: directory(), runLocalAssistant: () => {
      if (synchronous) throw new Error("local compiler failed");

      return Promise.reject(new Error("local compiler failed"));
    } });

    expect(start(bridge).ok).toBe(true);
    await flush();
    expect(bridge.handle({ action: "assistant", payload: { op: "status" } })).toMatchObject({ ok: true, data: { status: "refused", refusal: { reason: DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed } } });
  });

  it("fences progress and completion from an abandoned injected job", async () => {
    let complete: ((result: AssistantSculptResult) => void) | undefined;
    let progress: DesktopAssistantRunRequest["onProgress"] | undefined;

    const bridge = createDesktopBridge({ cwd: directory(), runLocalAssistant: (request) => {
      progress = request.onProgress;

      return new Promise((resolve) => { complete = resolve; });
    } });

    expect(start(bridge)).toMatchObject({ ok: true, data: { jobId: "desktop-assistant-1", status: "running" } });
    expect(start(bridge)).toMatchObject({ ok: false, reason: DESKTOP_BRIDGE_REFUSALS.assistantBusy });
    expect(bridge.handle({ action: "assistant", payload: { op: "abandon", jobId: "desktop-assistant-1" } }).ok).toBe(true);
    progress?.({ phase: "ready", percent: 100, message: "late progress" });
    complete?.(await runAssistantSculptAction({ route: "local", prompt: "box", profile: "@sceneaxi/profile-game" }));
    await flush();
    expect(bridge.handle({ action: "assistant", payload: { op: "status" } })).toMatchObject({ ok: true, data: { status: "refused", progressCount: 0, refusal: { reason: DESKTOP_BRIDGE_REFUSALS.assistantAbandoned } } });
  });
});

describe("complete current scene-operation compatibility", () => {
  it("runs create/rename through real E1 review, accept and fresh bridge reopen", () => {
    const dir = directory();
    expect(seedDesktopProject(dir)).toEqual({ ok: true, migrated: false });
    let bridge = createDesktopBridge({ cwd: dir, commandCapabilities: ["scene.compose"] });

    for (const operation of [
      { kind: "create-node", parentInstanceId: "desktop-crate-root", name: "E1 Node" },
      { kind: "create-primitive", primitive: "sphere", parentInstanceId: "desktop-crate-root", name: "E1 Sphere" },
      { kind: "rename-object", instanceId: "desktop-crate-beside", name: "E1 Renamed" },
    ]) {
      const status = bridge.handle({ action: "authoring", payload: { op: "status", documentPath: "scene.json" } });

      if (!status.ok || !isJsonObject(status.data) || !isProtocolText(status.data["contentHash"])) throw new Error("status missing content hash");
      const before = readFileSync(join(dir, "scene.json"), "utf8");
      expect(bridge.handle({ action: "authoring", payload: { op: "edit-scene", documentPath: "scene.json", expectedContentHash: status.data["contentHash"], profile: "game", operation } })).toMatchObject({ ok: true, data: { phase: "reviewing" } });
      expect(readFileSync(join(dir, "scene.json"), "utf8")).toBe(before);
      expect(bridge.handle({ action: "authoring", payload: { op: "accept" } })).toMatchObject({ ok: true, data: { phase: "applied" } });
      const parsed = parseDocumentText(readFileSync(join(dir, "scene.json"), "utf8"));

      if (!parsed.ok) throw new Error(parsed.message);
      const stored = composedSceneFromDocumentData(parsed.document.data);

      if (!stored.ok) throw new Error(stored.diagnostics[0]?.message);
      expect(stored.value.instances.some((instance) => instance.name === operation.name)).toBe(true);
      expect(desktopSceneFromDocumentData(parsed.document.data).ok).toBe(true);
      bridge = createDesktopBridge({ cwd: dir, commandCapabilities: ["scene.compose"] });
      expect(bridge.handle({ action: "scene", payload: { documentPath: "scene.json" } }).ok).toBe(true);
    }
  });

  it("stages a named empty node and reproduces the digest without changing source bytes", () => {
    const original = sceneData();
    const before = JSON.stringify(original);
    const created = accepted(original, { kind: "create-node", parentInstanceId: "desktop-crate-root", name: "Empty Node" });
    const node = created.scene.instances.find((instance) => instance.instanceId === created.result.selectedInstanceId);
    expect(node).toMatchObject({ kind: "node", name: "Empty Node", parentInstanceId: "desktop-crate-root" });
    expect(node?.artifact.spec.components).toEqual([]);
    expect(created.scene.instances).toHaveLength(4);
    expect(JSON.stringify(original)).toBe(before);
    expect(created.result.inspection).toMatchObject({ ok: true, entities: expect.arrayContaining([expect.objectContaining({ label: "Empty Node" })]) });
  });

  it.each(["box", "cylinder", "sphere"])("reconstructs and stages exactly one real %s primitive", (primitive) => {
    const original = sceneData();
    const created = accepted(original, { kind: "create-primitive", primitive, parentInstanceId: "desktop-crate-root", name: "My Primitive" });
    const instance = created.scene.instances.find((item) => item.instanceId === created.result.selectedInstanceId);
    expect(instance).toMatchObject({ name: "My Primitive", parentInstanceId: "desktop-crate-root" });
    expect(instance?.artifact.spec.components).toHaveLength(1);
    expect(instance?.artifact.spec.components[0]).toMatchObject({ primitive });
    expect(instance?.localTransform).toEqual({ translation: [0, 0, 0], rotationEulerDegrees: [0, 0, 0], scale: [1, 1, 1] });
    expect(created.scene.instances).toHaveLength(4);
  });

  it("renames an existing artifact without changing artifact bytes, placement or selection", () => {
    const original = sceneData();
    const stored = composedSceneFromDocumentData(original);

    if (!stored.ok) throw new Error("fixture");
    const source = stored.value.instances[1];

    if (!source) throw new Error("fixture");
    const renamed = accepted(original, { kind: "rename-object", instanceId: source.instanceId, name: "New Label" });
    const target = renamed.scene.instances.find((item) => item.instanceId === source.instanceId);
    expect(target?.name).toBe("New Label");
    expect(target?.localTransform).toEqual(source.localTransform);
    expect(target?.parentInstanceId).toBe(source.parentInstanceId);

    if (!target) throw new Error("missing renamed object");
    expect(digestSceneArtifact(target.artifact)).toBe(digestSceneArtifact(source.artifact));
    expect(renamed.result.selectedInstanceId).toBe(source.instanceId);
  });

  it("preserves node kind/name through rename, legacy reparent, transform edits and reopen", () => {
    const created = accepted(sceneData(), { kind: "create-node", parentInstanceId: "desktop-crate-root", name: "Node" });
    const id = created.result.selectedInstanceId;
    const renamed = accepted(created.data, { kind: "rename-object", instanceId: id, name: "Renamed Node" });
    const reparented = accepted(renamed.data, { kind: "reparent-object", instanceId: id, parentInstanceId: "desktop-crate-beside", transformPolicy: "preserve-world" });
    expect(reparented.scene.instances.find((instance) => instance.instanceId === id)?.worldTransform).toEqual(created.scene.instances.find((instance) => instance.instanceId === id)?.worldTransform);
    const edited = accepted(reparented.data, { kind: "set-transform-component", instanceId: id, propertyId: "translation-y", value: 2 });
    expect(edited.scene.instances.find((instance) => instance.instanceId === id)).toMatchObject({ kind: "node", name: "Renamed Node", parentInstanceId: "desktop-crate-beside", localTransform: { translation: [4.4, 2, 0] } });
    const twice = accepted(created.data, { kind: "create-node", parentInstanceId: id, name: "Child" });
    expect(twice.result.selectedInstanceId).not.toBe(id);
  });

  it("keeps document/profile/policy refusal precedence and distinguishes absent creation parent from stale rename target", () => {
    expect(stage(sceneData(), { kind: "create-node", parentInstanceId: "missing", name: "Node" })).toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.parentMissing });
    expect(stage(sceneData(), { kind: "rename-object", instanceId: "missing", name: "Name" })).toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale });
    expect(stage(null, { kind: "create-node", parentInstanceId: "missing", name: "Node" })).toMatchObject({ ok: false, diagnostics: [{ code: "validation-failed" }] });
    expect(stage(null, { kind: "reparent-object", instanceId: "missing", parentInstanceId: "missing" })).toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.policyInvalid });
    expect(stage(null, { kind: "create-node", parentInstanceId: "missing", name: "Node" }, "kids").ok).toBe(false);

    for (const name of ["", " ", "bad\nname", "x".repeat(65)]) {
      expect(stage(sceneData(), { kind: "create-node", parentInstanceId: "desktop-crate-root", name }).ok).toBe(false);
    }

    expect(stage(sceneData(), { kind: "create-primitive", primitive: "mesh", parentInstanceId: "desktop-crate-root", name: "Mesh" }).ok).toBe(false);
  });
});

function isProtocolText<Value>(value: Value): value is Value & (string) {
  return typeof value === "string";
}
