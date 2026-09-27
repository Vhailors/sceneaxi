import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  EDITOR_COMMAND_REGISTRY,
  EXTENSION_SEAM_REFUSALS,
  PROJECT_MANIFEST_PATH,
  createEditorCommandInvocation,
} from "@sceneaxi/schemas";
import { Window as HappyWindow, type HTMLElement as HappyElement } from "happy-dom";
import { DESKTOP_VIEWPORT_PLAY_EVENT, createDesktopVisualState, desktopVisualView, renderDesktopChrome } from "@sceneaxi/desktop-shell";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  createDesktopBridge,
  seedDesktopProject,
} from "../../desktop/linux/src/index.ts";
import { PROJECT_INPUT_ACTIONS_PATH, createDesktopInputActionHost } from "../../desktop/linux/src/lib/input-action-host.js";
import { initializeDesktopScenePhysics } from "../../desktop/linux/src/lib/desktop-scene.ts";

const roots: string[] = [];
const windows: HappyWindow[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  for (const window of windows.splice(0)) window.close();
});

function fixture(prefix: string, physicsWorldHost?: Parameters<typeof createDesktopBridge>[0]["physicsWorldHost"]) {
  const root = mkdtempSync(join(tmpdir(), `sceneaxi-command-form-${prefix}-`));
  roots.push(root);
  expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
  const workspace = mkdtempSync(join(tmpdir(), "sceneaxi-command-form-workspace-"));
  roots.push(workspace);
  const inputActions = createDesktopInputActionHost({ projectRoot: root, workspaceDirectory: workspace });
  const bridge = createDesktopBridge({
    cwd: root,
    inputActions,
    ...(physicsWorldHost === undefined ? {} : { physicsWorldHost }),
    commandCapabilities: [...new Set(EDITOR_COMMAND_REGISTRY.map((command) => command.capability.id))],
  });
  const window = new HappyWindow({ width: 1200, height: 800 });
  windows.push(window);
  const clone = <T>(value: T): T => window.eval(`(${JSON.stringify(value)})`) as T;
  Object.defineProperty(window, "structuredClone", { value: clone });
  const active = { name: "Command form", root, documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH, source: "opened" };
  Object.defineProperty(window, "sceneaxiDesktop", {
    value: {
      request: async (request: unknown) => clone(bridge.handle(clone(request))),
      project: async () => clone({ ok: true, data: { status: { active, recents: [active], recovery: null } } }),
      inputActions: async () => {
        const inspected = inputActions.inspect();
        return clone(inspected.ok ? { ok: true, data: inspected.data } : { ok: false, reason: inspected.reason });
      },
    },
  });
  const html = renderDesktopChrome(desktopVisualView(createDesktopVisualState({ profile: "game" })));
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (script === undefined) throw new Error("desktop chrome script missing");
  window.document.write(html.replace(/<script>[\s\S]*?<\/script>/, ""));
  window.document.addEventListener(DESKTOP_VIEWPORT_PLAY_EVENT, (event) => {
    const detail = (event as unknown as { detail: { accepted: boolean; frame: number | null } }).detail;
    detail.accepted = true;
    detail.frame = 1;
  });
  window.eval(script);
  return { root, bridge, window };
}

function element(window: HappyWindow, selector: string) {
  const found = window.document.querySelector(selector) as HappyElement | null;
  if (found === null) throw new Error(`missing control ${selector}`);
  return found;
}

function field(window: HappyWindow, id: string, name: string) {
  const selector = id === "viewport-source-set"
    ? `[data-command-field="${name}"]`
    : `[data-editor-command-form="${id}"] [data-command-field="${name}"]`;
  return element(window, selector) as HappyElement & { value: string };
}

function fill(window: HappyWindow, id: string, name: string, value: string) {
  const control = field(window, id, name);
  control.value = value;
  control.dispatchEvent(new window.Event("input", { bubbles: true }));
  control.dispatchEvent(new window.Event("change", { bubbles: true }));
}

async function settle(window: HappyWindow) {
  for (let i = 0; i < 80; i += 1) {
    await Promise.resolve();
    if (i >= 10 && window.document.querySelector("[data-busy]") === null) return;
  }
  throw new Error("desktop command form did not settle");
}

async function click(window: HappyWindow, selector: string) {
  element(window, selector).click();
  await settle(window);
}

async function inspectCommand(window: HappyWindow, id: string) {
  await click(window, '[data-menu-trigger="file"]');
  await click(window, `#menu-command-${id}`);
}

async function openScene(window: HappyWindow) {
  await settle(window);
  await click(window, "[data-action='document-reload']");
}

async function acceptReview(window: HappyWindow) {
  await click(window, '[data-action="change-accept"]');
}

function bridgeCommand(bridge: ReturnType<typeof createDesktopBridge>, commandId: Parameters<typeof createEditorCommandInvocation>[0], input: Parameters<typeof createEditorCommandInvocation>[2]) {
  const command = EDITOR_COMMAND_REGISTRY.find((entry) => entry.id === commandId);
  if (!command) throw new Error(`unknown fixture command ${commandId}`);
  return bridge.handle({ action: "command", payload: createEditorCommandInvocation(commandId, "desktop-control", input, "game") });
}

function sceneHash(bridge: ReturnType<typeof createDesktopBridge>) {
  const response = bridge.handle({ action: "authoring", payload: { op: "status", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH } });
  if (!response.ok || typeof response.data !== "object" || response.data === null ||
      !("contentHash" in response.data) || typeof response.data.contentHash !== "string") throw new Error("scene status has no content hash");
  return response.data.contentHash;
}

function sceneEntityIds(bridge: ReturnType<typeof createDesktopBridge>) {
  const response = bridgeCommand(bridge, "scene-hierarchy-inspect", { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH, profile: "game" });
  if (!response.ok || typeof response.data !== "object" || response.data === null ||
      !("entities" in response.data) || !Array.isArray(response.data.entities)) throw new Error("scene hierarchy unavailable");
  return response.data.entities.map((entity) => entity.id).filter((id): id is string => typeof id === "string");
}

function acceptBridgeReview(bridge: ReturnType<typeof createDesktopBridge>) {
  return bridgeCommand(bridge, "change-review-accept", {});
}

async function inspectPrefabs(window: HappyWindow) {
  await click(window, '[data-editor-command-submit="scene-prefab-inspect"]');
}

function preparePrefab(bridge: ReturnType<typeof createDesktopBridge>, definitionId: string) {
  const ids = sceneEntityIds(bridge);
  const proposed = bridgeCommand(bridge, "scene-prefab-define", {
    documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
    expectedContentHash: sceneHash(bridge),
    profile: "game",
    definitionId,
    instanceIds: ids.slice(0, 1),
  });
  expect(proposed).toMatchObject({ ok: true });
  expect(acceptBridgeReview(bridge)).toMatchObject({ ok: true });
  return ids;
}

function preparePrefabInstance(bridge: ReturnType<typeof createDesktopBridge>, definitionId: string) {
  const ids = preparePrefab(bridge, definitionId);
  const [parentInstanceId] = ids;
  if (!parentInstanceId) throw new Error("seed scene has no parent instance");
  const proposed = bridgeCommand(bridge, "scene-prefab-instance", {
    documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
    expectedContentHash: sceneHash(bridge),
    profile: "game",
    definitionId,
    parentInstanceId,
    instanceKey: "copy-one",
  });
  expect(proposed).toMatchObject({ ok: true });
  expect(acceptBridgeReview(bridge)).toMatchObject({ ok: true });
  return ids;
}

const GUI_WORKING_COMMANDS = new Set([
  "package-install", "package-remove", "project-migration-commit", "extension-start",
  "input-action-rebind", "input-actions-reset", "input-actions-inspect", "physics-evaluate",
  "scene-prefab-define", "scene-prefab-inspect", "scene-prefab-instance", "scene-prefab-override",
  "scene-prefab-refresh", "viewport-source-set",
]);

const packageManifest = {
  pluginId: "dev.sceneaxi.sample.intake-source",
  pluginVersion: "0.1.0",
  capabilities: ["sceneaxi.sculpt.intake-source.v1"],
};
const packageDigest = `sha256:${createHash("sha256").update("contained-package-lock").digest("hex")}`;

describe("desktop editor command forms against the real bridge", () => {
  it("pins every GUI-proven command to the desktop-control registry", () => {
    expect(GUI_WORKING_COMMANDS.size).toBe(14);
    for (const id of GUI_WORKING_COMMANDS) {
      expect(EDITOR_COMMAND_REGISTRY.find((command) => command.id === id)?.acceptedClients).toContain("desktop-control");
    }
  });
  it("installs a user-supplied contained package through Change Review", async () => {
    const { root, window } = fixture("package-install");
    await openScene(window);
    const installButton = element(window, '[data-editor-command-submit="package-install"]') as HappyElement & { disabled: boolean };
    expect(installButton.disabled).toBe(true);
    expect(installButton.dataset.refusal).toBe("EDITOR_COMMAND_INPUT_INVALID");
    fill(window, "package-install", "locator", "fixtures/plugin-host/sculpt-intake-source");
    fill(window, "package-install", "manifest", JSON.stringify(packageManifest));
    fill(window, "package-install", "digest", packageDigest);
    await click(window, '[data-editor-command-submit="package-install"]');
    expect(element(window, "[data-change-proposal]").hidden).toBe(false);
    expect(element(window, "[data-outcome-code]").textContent).not.toBe("EDITOR_COMMAND_INPUT_INVALID");
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).not.toContain(packageManifest.pluginId);
    await acceptReview(window);
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).toContain(packageManifest.pluginId);
  });

  it("removes only a package returned by the preceding package inspection", async () => {
    const { root, bridge, window } = fixture("package-remove");
    await openScene(window);
    const before = bridge.handle({ action: "authoring", payload: { op: "status", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH } });
    if (!before.ok || typeof before.data !== "object" || before.data === null ||
        !("contentHash" in before.data) || typeof before.data.contentHash !== "string") {
      throw new Error("seed status unavailable");
    }
    const installed = bridge.handle({ action: "command", payload: {
      schemaVersion: 1, commandId: "package-install", client: "desktop-control", permission: "project:write", profile: "game",
      input: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH, expectedContentHash: before.data.contentHash, profile: "game", locator: "fixtures/plugin-host/sculpt-intake-source", manifest: packageManifest, digest: packageDigest },
    } });
    expect(installed).toMatchObject({ ok: true });
    expect(bridge.handle({ action: "command", payload: { schemaVersion: 1, commandId: "change-review-accept", client: "desktop-control", permission: "project:write", profile: "game", input: {} } })).toMatchObject({ ok: true });
    const preparedCatalog = bridge.handle({ action: "command", payload: { schemaVersion: 1, commandId: "package-inspect", client: "desktop-control", permission: "project:read", profile: "game", input: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH, profile: "game" } } });
    expect(preparedCatalog).toMatchObject({ ok: true, data: { catalog: { lock: [{ packageId: packageManifest.pluginId }] } } });
    await openScene(window);
    const removeButton = element(window, '[data-editor-command-submit="package-remove"]') as HappyElement & { disabled: boolean };
    expect(removeButton.disabled).toBe(true);
    expect(removeButton.dataset.refusal).toBe("EDITOR_COMMAND_PREREQUISITE_MISSING");
    await inspectCommand(window, "package-inspect");
    expect(element(window, "[data-outcome-code]").textContent).toBe("COMMAND_COMPLETED");
    expect(element(window, "[data-outcome-message]").textContent).toContain(packageManifest.pluginId);
    const selection = field(window, "package-remove", "packageId");
    expect(selection.children.length).toBeGreaterThan(1);
    fill(window, "package-remove", "packageId", packageManifest.pluginId);
    const original = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
    await click(window, '[data-editor-command-submit="package-remove"]');
    expect(element(window, "[data-change-proposal]").hidden).toBe(false);
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).toBe(original);
    await acceptReview(window);
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).not.toContain(packageManifest.pluginId);
  });

  it("commits only the digest returned by the preceding migration proposal", async () => {
    const { root, window } = fixture("migration");
    unlinkSync(join(root, PROJECT_MANIFEST_PATH));
    await openScene(window);
    const commitButton = element(window, '[data-editor-command-submit="project-migration-commit"]') as HappyElement & { disabled: boolean };
    expect(commitButton.disabled).toBe(true);
    expect(commitButton.dataset.refusal).toBe("EDITOR_COMMAND_PREREQUISITE_MISSING");
    await inspectCommand(window, "project-migration-propose");
    const button = element(window, '[data-editor-command-submit="project-migration-commit"]') as HappyElement & { disabled: boolean };
    expect(button.disabled).toBe(false);
    const original = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
    await click(window, '[data-editor-command-submit="project-migration-commit"]');
    expect(element(window, "[data-outcome-code]").textContent).toBe("COMMAND_COMPLETED");
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).toBe(original);
    expect(readFileSync(join(root, PROJECT_MANIFEST_PATH), "utf8")).toContain('"schemaVersion"');
  });

  it("uses the inspected extension seam and displays its named refusal", async () => {
    const { window } = fixture("extension");
    await openScene(window);
    const startButton = element(window, '[data-editor-command-submit="extension-start"]') as HappyElement & { disabled: boolean };
    expect(startButton.disabled).toBe(true);
    expect(startButton.dataset.refusal).toBe("EDITOR_COMMAND_PREREQUISITE_MISSING");
    await inspectCommand(window, "extension-inspect");
    expect(element(window, "[data-outcome-code]").textContent).toBe("COMMAND_COMPLETED");
    expect(element(window, "[data-outcome-message]").textContent).toContain("networking");
    expect(field(window, "extension-start", "seamId").children.length).toBeGreaterThan(1);
    fill(window, "extension-start", "seamId", "networking");
    await click(window, '[data-editor-command-submit="extension-start"]');
    expect(element(window, "[data-outcome-code]").textContent).toBe(EXTENSION_SEAM_REFUSALS.adapterAbsent);
  });

  it("reviews and commits an input-action rebind with the inspected base version", async () => {
    const { root, window } = fixture("input-rebind");
    await openScene(window);
    await click(window, '[data-editor-command-submit="input-actions-inspect"]');
    expect(element(window, "[data-outcome-code]").textContent).toBe("COMMAND_COMPLETED");
    expect(element(window, "[data-outcome-message]").textContent).toContain("baseVersions");
    fill(window, "input-action-rebind", "scope", "project");
    fill(window, "input-action-rebind", "binding", JSON.stringify({ device: "keyboard", code: "KeyB", modifiers: ["primary"] }));
    fill(window, "input-action-rebind", "actionId", "editor.project.save");
    const settingPath = join(root, PROJECT_INPUT_ACTIONS_PATH);
    await click(window, '[data-editor-command-submit="input-action-rebind"]');
    expect(element(window, '[data-editor-command-review="input-action-rebind"]').hidden).toBe(false);
    expect(existsSync(settingPath)).toBe(false);
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).toContain('"entities"');
    await click(window, '[data-editor-command-review="input-action-rebind"]');
    const persisted = readFileSync(settingPath, "utf8");
    expect(persisted).toContain('"editor.project.save"');
    expect(persisted).toContain('"KeyB"');
  });

  it("never commits a reviewed rebind from Submit alone", async () => {
    const { root, window } = fixture("input-rebind-submit-twice");
    await openScene(window);
    await click(window, '[data-editor-command-submit="input-actions-inspect"]');
    fill(window, "input-action-rebind", "scope", "project");
    fill(window, "input-action-rebind", "binding", JSON.stringify({ device: "keyboard", code: "KeyB", modifiers: ["primary"] }));
    fill(window, "input-action-rebind", "actionId", "editor.project.save");
    const settingPath = join(root, PROJECT_INPUT_ACTIONS_PATH);
    await click(window, '[data-editor-command-submit="input-action-rebind"]');
    await click(window, '[data-editor-command-submit="input-action-rebind"]');
    expect(element(window, "[data-outcome-code]").textContent).toBe("INPUT_ACTION_REVIEW_REQUIRED");
    expect(existsSync(settingPath)).toBe(false);
  });

  it("withdraws Approve when the reviewed rebind is edited", async () => {
    const { root, window } = fixture("input-rebind-edited");
    await openScene(window);
    await click(window, '[data-editor-command-submit="input-actions-inspect"]');
    fill(window, "input-action-rebind", "scope", "project");
    fill(window, "input-action-rebind", "binding", JSON.stringify({ device: "keyboard", code: "KeyB", modifiers: ["primary"] }));
    fill(window, "input-action-rebind", "actionId", "editor.project.save");
    await click(window, '[data-editor-command-submit="input-action-rebind"]');
    const approve = element(window, '[data-editor-command-review="input-action-rebind"]');
    expect(approve.hidden).toBe(false);
    fill(window, "input-action-rebind", "binding", JSON.stringify({ device: "keyboard", code: "KeyJ", modifiers: ["primary"] }));
    expect(approve.hidden).toBe(true);
    expect(existsSync(join(root, PROJECT_INPUT_ACTIONS_PATH))).toBe(false);
  });

  it("reviews and commits a reset against the inspected settings version", async () => {
    const { root, window } = fixture("input-reset");
    await openScene(window);
    await click(window, '[data-editor-command-submit="input-actions-inspect"]');
    expect(element(window, "[data-outcome-code]").textContent).toBe("COMMAND_COMPLETED");
    fill(window, "input-actions-reset", "scope", "project");
    await click(window, '[data-editor-command-submit="input-actions-reset"]');
    expect(element(window, '[data-editor-command-review="input-actions-reset"]').hidden).toBe(false);
    expect(existsSync(join(root, PROJECT_INPUT_ACTIONS_PATH))).toBe(false);
    await click(window, '[data-editor-command-review="input-actions-reset"]');
    expect(readFileSync(join(root, PROJECT_INPUT_ACTIONS_PATH), "utf8")).toContain('"schemaVersion"');
  });

  it("inspects input actions through the command form and refuses rebind until inspected", async () => {
    const { window } = fixture("input-inspect");
    await openScene(window);
    const rebind = element(window, '[data-editor-command-submit="input-action-rebind"]') as HappyElement & { disabled: boolean };
    const reset = element(window, '[data-editor-command-submit="input-actions-reset"]') as HappyElement & { disabled: boolean };
    expect(reset.disabled).toBe(true);
    expect(reset.dataset.refusal).toBe("EDITOR_COMMAND_PREREQUISITE_MISSING");
    expect(rebind.disabled).toBe(true);
    expect(rebind.dataset.refusal).toBe("EDITOR_COMMAND_PREREQUISITE_MISSING");
    await click(window, '[data-editor-command-submit="input-actions-inspect"]');
    expect(element(window, "[data-outcome-code]").textContent).toBe("COMMAND_COMPLETED");
    expect(field(window, "input-action-rebind", "actionId").children.length).toBeGreaterThan(1);
  });

  it("evaluates physics with user-selected steps without changing project bytes", async () => {
    const physics = await initializeDesktopScenePhysics();
    const { root, window } = fixture("physics-evaluate", physics);
    await openScene(window);
    const evaluate = element(window, '[data-editor-command-submit="physics-evaluate"]') as HappyElement & { disabled: boolean };
    expect(evaluate.disabled).toBe(true);
    expect(evaluate.dataset.refusal).toBe("PHYSICS_WORLD_NOT_READY");
    await click(window, '[data-command="physics-inspect"]');
    expect(element(window, '[data-catalog-report="physics"]').textContent).toContain('"physicsHostReady": true');
    const before = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH));
    fill(window, "physics-evaluate", "steps", "3");
    await click(window, '[data-editor-command-submit="physics-evaluate"]');
    expect(element(window, "[data-outcome-code]").textContent).toBe("COMMAND_COMPLETED");
    const evaluation = JSON.parse(element(window, "[data-outcome-message]").textContent ?? "{}") as { snapshots?: { step: number }[] };
    expect(evaluation.snapshots?.map((snapshot) => snapshot.step)).toEqual([1, 2, 3]);
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH))).toEqual(before);
  });

  it("inspects prefabs and disables instance, override, and refresh until a definition exists", async () => {
    const { window } = fixture("prefab-inspect");
    await openScene(window);
    for (const id of ["scene-prefab-instance", "scene-prefab-override", "scene-prefab-refresh"]) {
      const submit = element(window, `[data-editor-command-submit="${id}"]`) as HappyElement & { disabled: boolean };
      expect(submit.disabled).toBe(true);
      expect(submit.dataset.refusal).toBe("EDITOR_COMMAND_PREREQUISITE_MISSING");
    }
    await inspectPrefabs(window);
    expect(element(window, "[data-outcome-code]").textContent).toBe("COMMAND_COMPLETED");
  });

  it("defines selected scene entities through review and persists only after acceptance", async () => {
    const { root, window } = fixture("prefab-define");
    await openScene(window);
    const before = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH));
    fill(window, "scene-prefab-define", "definitionId", "selected-pair");
    await click(window, '[data-editor-command-submit="scene-prefab-define"]');
    expect(element(window, "[data-change-proposal]").hidden).toBe(false);
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH))).toEqual(before);
    await acceptReview(window);
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH))).not.toEqual(before);
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).toContain('"selected-pair"');
  });

  it("instances an inspected prefab under a selected scene entity", async () => {
    const { root, bridge, window } = fixture("prefab-instance");
    const ids = preparePrefab(bridge, "panel-kit");
    await openScene(window);
    await inspectPrefabs(window);
    const definitionId = field(window, "scene-prefab-instance", "definitionId").querySelectorAll("option")[1]?.getAttribute("value");
    const parentId = element(window, "[data-scene-identities] [data-scene-identity]").getAttribute("data-scene-identity");
    if (!definitionId || !parentId || ids.length === 0) throw new Error("inspected prefab or selected hierarchy is missing");
    fill(window, "scene-prefab-instance", "definitionId", definitionId);
    fill(window, "scene-prefab-instance", "parentInstanceId", parentId);
    fill(window, "scene-prefab-instance", "instanceKey", "gui-copy");
    const before = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH));
    await click(window, '[data-editor-command-submit="scene-prefab-instance"]');
    expect(element(window, "[data-change-proposal]").hidden).toBe(false);
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH))).toEqual(before);
    await acceptReview(window);
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH))).not.toEqual(before);
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).toContain("gui-copy");
  });

  it("overrides an inspected prefab instance through the shared review flow", async () => {
    const { root, bridge, window } = fixture("prefab-override");
    const sourceIds = preparePrefabInstance(bridge, "wall-kit");
    await openScene(window);
    await inspectPrefabs(window);
    const instanceId = field(window, "scene-prefab-override", "instanceId").querySelectorAll("option")[1]?.getAttribute("value");
    const sourceInstanceId = sourceIds[0];
    if (!instanceId || !sourceInstanceId) throw new Error("prefab instance or source entity missing from inspection");
    fill(window, "scene-prefab-override", "instanceId", instanceId);
    fill(window, "scene-prefab-override", "sourceInstanceId", sourceInstanceId);
    fill(window, "scene-prefab-override", "propertyId", "translation-x");
    fill(window, "scene-prefab-override", "newValue", "4");
    const before = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH));
    await click(window, '[data-editor-command-submit="scene-prefab-override"]');
    expect(element(window, "[data-change-proposal]").hidden).toBe(false);
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH))).toEqual(before);
    await acceptReview(window);
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH))).not.toEqual(before);
  });

  it("refreshes an inspected stale prefab definition through review", async () => {
    const { root, bridge, window } = fixture("prefab-refresh");
    const [sourceInstanceId] = preparePrefabInstance(bridge, "stale-kit");
    if (!sourceInstanceId) throw new Error("seed scene has no prefab source");
    const staged = bridgeCommand(bridge, "scene-property-set", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: sceneHash(bridge),
      profile: "game",
      instanceId: sourceInstanceId,
      propertyId: "translation-x",
      newValue: 3,
    });
    expect(staged).toMatchObject({ ok: true });
    expect(acceptBridgeReview(bridge)).toMatchObject({ ok: true });
    await openScene(window);
    await inspectPrefabs(window);
    const definitionId = field(window, "scene-prefab-refresh", "definitionId").querySelectorAll("option")[1]?.getAttribute("value");
    if (!definitionId) throw new Error("prefab definition missing from inspection");
    fill(window, "scene-prefab-refresh", "definitionId", definitionId);
    const before = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH));
    await click(window, '[data-editor-command-submit="scene-prefab-refresh"]');
    expect(element(window, "[data-change-proposal]").hidden).toBe(false);
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH))).toEqual(before);
    await acceptReview(window);
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH))).not.toEqual(before);
  });

  it("changes the viewport source only after Play creates a session", async () => {
    const { root, window } = fixture("viewport-source");
    await openScene(window);
    const changeSource = element(window, '[data-editor-command-submit="viewport-source-set"]') as HappyElement & { disabled: boolean };
    expect(changeSource.disabled).toBe(true);
    expect(changeSource.dataset.refusal).toBe("PLAY_SESSION_MISSING");
    const before = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH));
    await click(window, ".profile-runtime-actions [data-command='run-play']");
    fill(window, "viewport-source-set", "source", "scene");
    await click(window, '[data-editor-command-submit="viewport-source-set"]');
    expect(element(window, "[data-outcome-code]").textContent).toBe("COMMAND_COMPLETED");
    expect(element(window, "[data-outcome-message]").textContent).toContain('"scene"');
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH))).toEqual(before);
    await click(window, "[data-command='run-stop']");
    expect(changeSource.disabled).toBe(true);
    expect(changeSource.dataset.refusal).toBe("PLAY_SESSION_MISSING");
  });
});
