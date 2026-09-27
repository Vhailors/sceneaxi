import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  EDITOR_COMMAND_REGISTRY,
  EXTENSION_SEAM_REFUSALS,
  PROJECT_MANIFEST_PATH,
} from "@sceneaxi/schemas";
import { Window as HappyWindow, type HTMLElement as HappyElement } from "happy-dom";
import { createDesktopVisualState, desktopVisualView, renderDesktopChrome } from "@sceneaxi/desktop-shell";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  createDesktopBridge,
  seedDesktopProject,
} from "../../desktop/linux/src/index.ts";
import { PROJECT_INPUT_ACTIONS_PATH, createDesktopInputActionHost } from "../../desktop/linux/src/lib/input-action-host.js";

const roots: string[] = [];
const windows: HappyWindow[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  for (const window of windows.splice(0)) window.close();
});

function fixture(prefix: string) {
  const root = mkdtempSync(join(tmpdir(), `sceneaxi-command-form-${prefix}-`));
  roots.push(root);
  expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
  const workspace = mkdtempSync(join(tmpdir(), "sceneaxi-command-form-workspace-"));
  roots.push(workspace);
  const inputActions = createDesktopInputActionHost({ projectRoot: root, workspaceDirectory: workspace });
  const bridge = createDesktopBridge({
    cwd: root,
    inputActions,
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
  window.eval(script);
  return { root, bridge, window };
}

function element(window: HappyWindow, selector: string) {
  const found = window.document.querySelector(selector) as HappyElement | null;
  if (found === null) throw new Error(`missing control ${selector}`);
  return found;
}

function field(window: HappyWindow, id: string, name: string) {
  return element(window, `[data-editor-command-form="${id}"] [data-command-field="${name}"]`) as HappyElement & { value: string };
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

const packageManifest = {
  pluginId: "dev.sceneaxi.sample.intake-source",
  pluginVersion: "0.1.0",
  capabilities: ["sceneaxi.sculpt.intake-source.v1"],
};
const packageDigest = `sha256:${createHash("sha256").update("contained-package-lock").digest("hex")}`;

describe("desktop editor command forms against the real bridge", () => {
  it("installs a user-supplied contained package through Change Review", async () => {
    const { root, window } = fixture("package-install");
    await openScene(window);
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
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).toContain('"entities"');
    await click(window, '[data-editor-command-review="input-action-rebind"]');
    expect(readFileSync(settingPath, "utf8")).toContain('"editor.project.save"');
  });

  it("reviews and commits a reset against the inspected settings version", async () => {
    const { root, window } = fixture("input-reset");
    await openScene(window);
    await click(window, '[data-editor-command-submit="input-actions-inspect"]');
    expect(element(window, "[data-outcome-code]").textContent).toBe("COMMAND_COMPLETED");
    fill(window, "input-actions-reset", "scope", "project");
    await click(window, '[data-editor-command-submit="input-actions-reset"]');
    expect(element(window, '[data-editor-command-review="input-actions-reset"]').hidden).toBe(false);
    await click(window, '[data-editor-command-review="input-actions-reset"]');
    expect(readFileSync(join(root, PROJECT_INPUT_ACTIONS_PATH), "utf8")).toContain('"schemaVersion"');
  });
});
