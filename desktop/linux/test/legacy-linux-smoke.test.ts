import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Window as HappyWindow } from 'happy-dom';
import { renderDesktopChrome, desktopVisualView, createDesktopVisualState, DESKTOP_INTERACTION_COMMANDS } from '@sceneaxi/desktop-shell';
import { createEditorCommandInvocation } from '@sceneaxi/schemas';
import { startDesktopLocalBridgeServer } from '@sceneaxi/desktop-linux';
import { INPUT_ACTION_REGISTRY } from '@sceneaxi/schemas';
import { createDesktopBridge, seedDesktopProject, DESKTOP_ACTIVE_DOCUMENT_PATH } from '@sceneaxi/desktop-linux';
import { createDesktopInputActionHost } from '../src/lib/input-action-host.js';

describe("private modal migration to canonical Submit/Approve forms through the real host", () => {
  async function mount(profile: "game" | "kids" = "game") {
    const root = mkdtempSync(join(tmpdir(), "sceneaxi-shell-controls-"));
    expect(seedDesktopProject(root).ok).toBe(true);
    const inputActions = createDesktopInputActionHost({ projectRoot: root, workspaceDirectory: join(root, "workspace") });

    const host = createDesktopBridge({ cwd: root, inputActions, commandCapabilities: [
      "scene.compose", "authoring.change-review", "authoring.undo", "authoring.redo",
      "input.actions", "physics.authoring", "play.session", "viewport.source",
    ] });

    const window = new HappyWindow({ width: 1200, height: 800, settings: { enableJavaScriptEvaluation: true } });
    const calls: string[] = [];

    const clone = <T>(value: T): T => {
      // SAFETY: these native JSON replies contain only serializable data; JSON serialization and realm evaluation preserve their fields and values.
      return window.eval(`(${JSON.stringify(value)})`) as T;
    };

    Object.defineProperty(window, "structuredClone", { value: clone });
    Object.defineProperty(window, "sceneaxiDesktopLinux", { value: {
      project: async () => clone({ ok: true, data: { status: {
        active: { name: "Owned regression", root, documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH, source: "opened" },
        recents: [], recovery: null,
      } } }),
      inputActions: async () => clone(inputActions.inspect()),
      request: async (request: Parameters<ReturnType<typeof createDesktopBridge>["handle"]>[0]) => {
        const value: unknown = JSON.parse(JSON.stringify(request));

        if (isProtocolObject(value) && value !== null && "action" in value && value.action === "command" && "payload" in value && isProtocolObject(value.payload) && value.payload !== null && "commandId" in value.payload) calls.push(String(value.payload.commandId));

        return clone(host.handle(value));
      },
    } });
    window.document.write(renderDesktopChrome(desktopVisualView(createDesktopVisualState({ profile }))));

    const settle = async () => {
      await window.happyDOM.waitUntilComplete();

      for (let tick = 0; tick < 60; tick += 1) await Promise.resolve();
    };

    await settle();

    let activeCommand = '';

    const command = async (id: string) => {
      activeCommand = id;

      if (id === 'input-action-rebind' || id === 'input-actions-reset' || id.startsWith('scene-prefab-')) {
        const inspection = id.startsWith('scene-prefab-') ? 'scene-prefab-inspect' : 'input-actions-inspect';
        const inspect = window.document.querySelector('[data-command="' + inspection + '"]');

        if (inspect instanceof window.HTMLElement) inspect.click();
        await settle();
      }

      const button = window.document.querySelector(`[data-command="${id}"]`);
      expect(button, id).not.toBeNull();

      if (!(button instanceof window.HTMLElement)) throw new TypeError("Command control is not an HTML element.");

      button.click();
      await settle();
    };

    const field = (name: string) => {
      const input = window.document.querySelector(`[data-editor-command-form="${activeCommand}"] [data-command-field="${name}"]`);
      expect(input, name).not.toBeNull();

      if (!(input instanceof window.HTMLInputElement) && !(input instanceof window.HTMLTextAreaElement) && !(input instanceof window.HTMLSelectElement)) {
        throw new TypeError("Command field is not a form control.");
      }

      return input;
    };

    const submit = async (approve = false) => {
      const section = window.document.querySelector('[data-editor-command-form="' + activeCommand + '"]');

      if (!(section instanceof window.HTMLElement)) throw new Error('Canonical command form missing');

      if (!approve) section.dispatchEvent(new window.Event('input', { bubbles: true }));
      await settle();
      const control = section.querySelector(approve ? '[data-editor-command-review]' : '[data-editor-command-submit]');

      if (!(control instanceof window.HTMLButtonElement)) throw new Error('Explicit submission control missing');
      expect(control.disabled).toBe(false);
      expect(control.hidden).toBe(false);
      control.click();
      await settle();
    };

    const selectInstances = async (ids: string[]) => {
      const select = window.document.querySelector('[data-scene-entities] select');

      if (!(select instanceof window.HTMLSelectElement)) throw new Error('Hierarchy selection missing');

      for (const option of Array.from(select.options)) option.selected = ids.includes(option.value);
      select.dispatchEvent(new window.Event('change', { bubbles: true }));
      await settle();
    };

    const cleanup = () => { host.close(); window.close(); rmSync(root, { recursive: true, force: true }); };

    return { root, window, calls, host, command, field, submit, selectInstances, settle, cleanup };
  }

  it("defines real prefab content via fields, writes only on Save and rejects invalid references", async () => {
    const h = await mount();

    try {
      const path = join(h.root, DESKTOP_ACTIVE_DOCUMENT_PATH);
      const before = readFileSync(path);
      await h.command("scene-prefab-define");
      h.field("definitionId").value = "shell-pair";
      await h.selectInstances(["desktop-crate-root", "desktop-crate-beside"]);

      await h.submit();
      expect(h.calls).toContain("scene-prefab-define");
      expect(readFileSync(path)).toEqual(before);
      expect(h.window.document.querySelector("[data-project-state]")?.getAttribute("data-project-state")).toBe("dirty");
      await h.command("project-save");
      expect(readFileSync(path, "utf8")).toContain("shell-pair");
      const after = readFileSync(path);
      await h.command("scene-prefab-instance");
      h.field("definitionId").value = "shell-pair";
      h.field("parentInstanceId").value = "desktop-crate-root";
      h.field("instanceKey").value = "first";

      await h.submit();
      expect(readFileSync(path)).toEqual(after);
      const reject = h.window.document.querySelector('[data-action="change-reject"]');

      if (!(reject instanceof h.window.HTMLElement)) throw new TypeError("Change rejection control is missing.");

      reject.click();
      await h.settle();
      expect(readFileSync(path)).toEqual(after);
      await h.command("scene-prefab-refresh");
      const invalidDefinition = h.field("definitionId");

        if (!(invalidDefinition instanceof h.window.HTMLSelectElement)) throw new Error('Definition selector missing');
        const injected = h.window.document.createElement('option'); injected.value = 'unknown-definition';
        invalidDefinition.append(injected); invalidDefinition.value = 'unknown-definition';

      await h.submit();
      expect(readFileSync(path)).toEqual(after);
      expect(h.window.document.querySelector("[data-project-state]")?.getAttribute("data-project-state")).not.toBe("dirty");
    } finally { h.cleanup(); }
  });

  it("reviews and commits persisted bindings, updates keyboard dispatch, then reviews reset", async () => {
    const h = await mount();

    try {
      await h.command("input-action-rebind");
      const action = INPUT_ACTION_REGISTRY.find((row) => row.commandId === "project-save");
      expect(action).toBeDefined();
      h.field("scope").value = "project";
        h.field("actionId").value = action?.id ?? "";
      h.field("binding").value = JSON.stringify({ device: "keyboard", code: "F12", modifiers: ["alt", "control", "shift"] });

      await h.submit();
      expect(existsSync(join(h.root, ".sceneaxi/input-actions.v1.json"))).toBe(false);
      expect(h.window.document.querySelector("[data-outcome-message]")?.textContent).toContain('"status": "review"');
      

      await h.submit(true);
      expect(readFileSync(join(h.root, ".sceneaxi/input-actions.v1.json"), "utf8")).toContain("F12");
      h.window.document.dispatchEvent(new h.window.KeyboardEvent("keydown", { key: "Escape" }));
      await h.command("scene-prefab-define");
      h.field("definitionId").value = "keyboard-save";
      await h.selectInstances(["desktop-crate-root"]);

      await h.submit();
      expect(readFileSync(join(h.root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).not.toContain("keyboard-save");
      const before = h.calls.filter((id) => id === "project-save").length;
      h.window.document.body.focus();
      h.window.document.dispatchEvent(new h.window.KeyboardEvent("keydown", { key: "F12", code: "F12", ctrlKey: true, altKey: true, shiftKey: true }));
      await h.settle();
      expect(h.calls.filter((id) => id === "project-save").length).toBe(before + 1);
      expect(readFileSync(join(h.root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).toContain("keyboard-save");
      await h.command("input-actions-reset");
        h.field("scope").value = "project";

      await h.submit();
      

      await h.submit(true);
      expect(readFileSync(join(h.root, ".sceneaxi/input-actions.v1.json"), "utf8")).not.toContain("F12");
    } finally { h.cleanup(); }
  });

  it("refuses empty scope, malformed JSON and edited/stale approvals without writing settings", async () => {
    const h = await mount();

    try {
      await h.command('input-action-rebind');
      const action = INPUT_ACTION_REGISTRY.find(row => row.commandId === 'project-save');
      h.field('actionId').value = action?.id ?? '';
      h.field('binding').value = JSON.stringify({ device: 'keyboard', code: 'F12', modifiers: ['control'] });
      const section = h.window.document.querySelector('[data-editor-command-form="input-action-rebind"]');
      const submit = section?.querySelector('[data-editor-command-submit]');
      const approve = section?.querySelector('[data-editor-command-review]');

      if (!(submit instanceof h.window.HTMLButtonElement) || !(approve instanceof h.window.HTMLButtonElement)) throw new Error('Missing canonical controls');
      section?.dispatchEvent(new h.window.Event('input', { bubbles: true })); await h.settle();
      expect(submit.disabled).toBe(true); submit.click(); await h.settle();
      expect(h.calls).not.toContain('input-action-rebind');
      h.field('scope').value = 'project'; h.field('binding').value = '{';
      section?.dispatchEvent(new h.window.Event('input', { bubbles: true })); await h.settle();
      expect(submit.disabled).toBe(true); submit.click(); await h.settle();
      expect(h.calls).not.toContain('input-action-rebind');
      h.field('binding').value = JSON.stringify({ device: 'keyboard', code: 'F12', modifiers: ['control'] });
      await h.submit(); expect(approve.hidden).toBe(false);
      expect(existsSync(join(h.root, '.sceneaxi/input-actions.v1.json'))).toBe(false);
      h.field('binding').value = JSON.stringify({ device: 'keyboard', code: 'F11', modifiers: ['control'] });
      h.field('binding').dispatchEvent(new h.window.Event('input', { bubbles: true })); await h.settle();
      expect(approve.hidden).toBe(true);
      const calls = h.calls.length; approve.click(); await h.settle();
      expect(h.calls.length).toBe(calls);
      expect(h.window.document.querySelector('[data-outcome-code]')?.textContent).toBe('INPUT_ACTION_REVIEW_REQUIRED');
      expect(existsSync(join(h.root, '.sceneaxi/input-actions.v1.json'))).toBe(false);
      await h.submit(); await h.submit(true);
      const persisted = readFileSync(join(h.root, '.sceneaxi/input-actions.v1.json'), 'utf8');
      expect(persisted).toContain('F11'); expect(persisted).not.toContain('F12');
    } finally { h.cleanup(); }
  });

  it("exposes all eight missing commands and keeps Kids mutation controls refused", async () => {
    const ids = ["input-actions-inspect", "scene-prefab-inspect", "scene-prefab-define", "scene-prefab-instance", "scene-prefab-override", "scene-prefab-refresh", "viewport-source-set", "physics-evaluate"];
    expect(DESKTOP_INTERACTION_COMMANDS.map((row) => row.id)).toEqual(expect.arrayContaining(ids));
    const h = await mount("kids");

    try {
      for (const id of ids) {
        await h.command(id);
        expect(h.window.document.querySelector("[data-command-input]")).toBeNull();
      }

      expect(h.calls.some((id) => ids.includes(id))).toBe(false);
    } finally { h.cleanup(); }
  });
});


describe('historical Linux smoke obligations through actual owning bridge', () => {
  type HostReplyFields = { contentHash?: string };

  const record = (value: Parameters<ReturnType<typeof createDesktopBridge>["handle"]>[0]): HostReplyFields => {
    if (!isProtocolObject(value) || value === null || Array.isArray(value)) throw new Error('Expected host record');

    // SAFETY: this is a non-null record returned by the real owning host, and individual fields are checked below.
    return value as HostReplyFields;
  };

  it('persists nonroot create/reparent, Y transform and named smoke-body across a fresh session without premature writes', () => {
    const root = mkdtempSync(join(tmpdir(), 'sceneaxi-linux-history-'));
    expect(seedDesktopProject(root).ok).toBe(true);
    const host = createDesktopBridge({ cwd: root, commandCapabilities: ['scene.compose', 'authoring.change-review', 'physics.authoring'] });
    const path = join(root, DESKTOP_ACTIVE_DOCUMENT_PATH);
    const invoke = (id: Parameters<typeof createEditorCommandInvocation>[0], input: Parameters<typeof createEditorCommandInvocation>[2] = {}) => host.handle({ action: 'command', payload: createEditorCommandInvocation(id, 'desktop-control', { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH, profile: 'game', ...input }) });

    const hash = () => {
      const status = host.handle({ action: 'authoring', payload: { op: 'status', documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH } });
      expect(status.ok).toBe(true);

 if (!status.ok) throw new Error(status.reason);
      const value = record(status.data)['contentHash'];

 if (!isProtocolText(value)) throw new Error('Missing digest');

 return value;
    };

    const accept = () => expect(host.handle({ action: 'authoring', payload: { op: 'accept' } })).toMatchObject({ ok: true, data: { phase: 'applied' } });

    try {
      let before = readFileSync(path);
      expect(invoke('scene-object-create', { expectedContentHash: hash(), sourceInstanceId: 'desktop-crate-beside', parentInstanceId: 'desktop-crate-root' })).toMatchObject({ ok: true, data: { phase: 'reviewing' } });
      expect(readFileSync(path)).toEqual(before); accept(); expect(readFileSync(path)).not.toEqual(before);
      before = readFileSync(path);
      expect(invoke('scene-object-reparent', { expectedContentHash: hash(), instanceId: 'desktop-crate-beside-copy-1', parentInstanceId: 'desktop-crate-stacked', transformPolicy: 'preserve-local' })).toMatchObject({ ok: true, data: { phase: 'reviewing' } });
      expect(readFileSync(path)).toEqual(before); accept(); expect(readFileSync(path)).not.toEqual(before);
      before = readFileSync(path);
      expect(invoke('scene-transform-apply', { expectedContentHash: hash(), instanceIds: ['desktop-crate-root'], mode: 'translate', space: 'local', pivot: 'individual', axes: 'y', snapIncrement: null, valueKind: 'delta', values: [0, 0.5, 0] })).toMatchObject({ ok: true });
      expect(readFileSync(path)).toEqual(before); accept();
      before = readFileSync(path);
      expect(invoke('physics-apply', { expectedContentHash: hash(), mutation: { kind: 'body-upsert', bodyId: 'smoke-body', instanceId: 'desktop-crate-root', bodyKind: 'dynamic', mass: 1 } })).toMatchObject({ ok: true, data: { authoringSnapshot: { phase: 'reviewing' } } });
      expect(readFileSync(path)).toEqual(before); accept();
      const saved = readFileSync(path);
      expect(host.handle({ action: 'authoring', payload: { op: 'restart', documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH } })).toMatchObject({ ok: true });
      expect(invoke('scene-hierarchy-inspect')).toMatchObject({ ok: true, data: { hierarchy: { objects: expect.arrayContaining([expect.objectContaining({ id: 'desktop-crate-beside-copy-1', parentId: 'desktop-crate-stacked' })]) }, entities: expect.arrayContaining([expect.objectContaining({ id: 'desktop-crate-root', properties: expect.arrayContaining([expect.objectContaining({ id: 'translation-y', value: 0.5 })]) })]) } });
      expect(invoke('physics-inspect')).toMatchObject({ ok: true, data: { catalog: { bodies: expect.arrayContaining([expect.objectContaining({ bodyId: 'smoke-body', instanceId: 'desktop-crate-root' })]) } } });
      expect(host.handle({ action: 'authoring', payload: { op: 'edit-scene', documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH, expectedContentHash: hash(), profile: 'game', operation: { kind: 'set-transform-component', instanceId: 'desktop-crate-root', propertyId: 'scale-x', value: 0 } } })).toMatchObject({ ok: false, reason: 'SCENE_HIERARCHY_INPUT_UNSUPPORTED' });
      expect(readFileSync(path)).toEqual(saved);
      expect(invoke('physics-apply', { expectedContentHash: hash(), mutation: { kind: 'body-upsert', bodyId: 'invalid-body', instanceId: 'missing-instance', bodyKind: 'dynamic', mass: 1 } })).toMatchObject({ ok: false, reason: 'PHYSICS_TARGET_MISSING' });
      expect(readFileSync(path)).toEqual(saved);
    } finally { host.close(); rmSync(root, { recursive: true, force: true }); }
  });
  it('executes the actual built child CLI handshake and rejects a missing descriptor, without skips', async () => {
    const bin = fileURLToPath(new URL('../../../packages/cli/bin/sceneaxi.mjs', import.meta.url));
    const worker = fileURLToPath(new URL('../../../packages/cli/dist/src/desktop-socket-worker.js', import.meta.url));
    expect(existsSync(worker), 'workspace CLI preflight must build the matching worker').toBe(true);
    const root = mkdtempSync(join(tmpdir(), 'sceneaxi-linux-cli-proof-'));
    expect(seedDesktopProject(root).ok).toBe(true);
    const host = createDesktopBridge({ cwd: root });
    const descriptor = join(root, '.sceneaxi-config', 'desktop-bridge-v1.json');
    const server = await startDesktopLocalBridgeServer({ bridge: host, projectRoot: root, discoveryPath: descriptor, socketPath: join(root, 'desktop.sock') });

    const child = (path: string) => new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      const process = spawn(globalThis.process.execPath, [bin, 'desktop', 'bridge', 'status', '--descriptor', path, '--json'], { cwd: root });
      const timer = setTimeout(() => process.kill('SIGKILL'), 10_000); let stdout = ''; let stderr = '';
      process.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
      process.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
      process.on('error', (error) => { clearTimeout(timer); reject(error); });
      process.on('close', (status) => { clearTimeout(timer); resolve({ status, stdout, stderr }); });
    });

    try {
      const connected = await child(descriptor);
      expect(connected.status, connected.stdout + connected.stderr).toBe(0); expect(connected.stderr).toBe('');
      expect(JSON.parse(connected.stdout)).toMatchObject({ ok: true, result: { connected: true, tool: 'sceneaxi.bridge.handshake', response: { app: '@sceneaxi/desktop-linux', localProtocolVersion: 1, creditRoute: 'none' } } });
      expect(connected.stdout).not.toContain(server.discovery.capability);
      const missing = await child(join(root, 'missing.json'));
      expect(missing.status).not.toBe(0); expect(JSON.parse(missing.stdout)).toMatchObject({ ok: false });
    } finally { await server.close(); host.close(); rmSync(root, { recursive: true, force: true }); }
  });
});

function isProtocolObject<Value>(value: Value): value is Value & (object | null) {
  return isBoundaryObjectValue(value);
}

function isProtocolText<Value>(value: Value): value is Value & (string) {
  return typeof value === "string";
}

type BoundaryObjectValue = object | null;

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}
