import { afterEach, expect } from "vitest";
import { validateEditorCommandInvocation, EDITOR_COMMAND_REGISTRY, type InputActionMap, type SceneDocument } from "@sceneaxi/schemas";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDocument, writeDocumentFile } from "@sceneaxi/authoring-core";
import { Window as HappyWindow, type HTMLElement as HappyHTMLElement } from "happy-dom";
import {
  createDesktopVisualState,
  desktopVisualView,
  renderDesktopChrome,
  type DesktopVisualState,
} from "../../apps/desktop-shell/src/index.js";

export const CONTROL_STATES: ReadonlyArray<readonly [string, DesktopVisualState]> = [
  ["default", createDesktopVisualState()],
  ["assistant:runtime", createDesktopVisualState({ assistantRuntime: "local" })],
  [
    "assistant:runtime-kids",
    createDesktopVisualState({ assistantRuntime: "local", profile: "kids" }),
  ],
  ["profile:kids", createDesktopVisualState({ profile: "kids" })],
  ["profile:web", createDesktopVisualState({ profile: "web" })],
  ["mode:run", createDesktopVisualState({ mode: "run" })],
  ["mode:animate", createDesktopVisualState({ mode: "animate" })],
  ["mode:ship", createDesktopVisualState({ mode: "ship" })],
  ["overlay:palette", createDesktopVisualState({ overlay: "palette" })],
  ["assistant:closed", createDesktopVisualState({ assistant: "closed" })],
  ["assistant:thinking", createDesktopVisualState({ assistantThinking: true })],
  ["sculpt:idle", createDesktopVisualState({ mode: "sculpt" })],
  ["sculpt:running", createDesktopVisualState({ mode: "sculpt", sculpt: "running" })],
  ["tier:compact", createDesktopVisualState({ window: { width: 1280, height: 800 } })],
  ["tier:narrow", createDesktopVisualState({ window: { width: 1000, height: 700 } })],
  [
    "kids:narrow",
    createDesktopVisualState({ profile: "kids", window: { width: 1024, height: 700 } }),
  ],
  [
    "kids:wide-but-short",
    createDesktopVisualState({ profile: "kids", window: { width: 1920, height: 620 } }),
  ],
  ["tier:minimum", createDesktopVisualState({ window: { width: 800, height: 560 } })],
];

export const windows: HappyWindow[] = [];
const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  for (const window of windows.splice(0)) window.close();
});

/** Parse the shipped document without executing its client for structural checks. */
export function chromeDocument(state = createDesktopVisualState()) {
  const window = new HappyWindow();
  windows.push(window);
  window.document.write(renderDesktopChrome(desktopVisualView(state)).replace(/<script>[\s\S]*?<\/script>/, ""));
  return window.document;
}

/** A missing region or an unclassified interactive element must fail, not vacuously pass. */
export function regionControls(selector: string, state = createDesktopVisualState()) {
  const document = chromeDocument(state);
  const regions = [...document.querySelectorAll(selector)];
  expect(regions.length, selector).toBeGreaterThan(0);
  const controls = regions.flatMap((region) => [...region.querySelectorAll("button, input, select, textarea")]);
  expect(controls.length, selector).toBeGreaterThan(0);
  for (const control of controls) {
    expect(["view", "live", "inert"], control.id).toContain(control.getAttribute("data-kind"));
  }
  return controls;
}

export function mountInventory(
  state = createDesktopVisualState({ window: { width: 1000, height: 700 } }),
  runtime?: Readonly<{
    request(request: unknown): Promise<unknown>;
    project(request: unknown): Promise<unknown>;
  }>,
) {
  const window = new HappyWindow({ width: 1000, height: 700 });
  windows.push(window);
  if (runtime !== undefined) {
    Object.assign(window, { sceneaxiDesktop: runtime });
  }
  const html = renderDesktopChrome(desktopVisualView(state));
  const match = /<script>([\s\S]*?)<\/script>/.exec(html);
  if (match?.[1] === undefined) throw new Error("desktop chrome script missing");
  window.document.write(html.replace(match[0], ""));
  window.eval(match[1]);
  return window;
}

export function inventoryElement(window: HappyWindow, selector: string) {
  // All queried controls are emitted HTML elements, not SVG or text nodes.
  const found = window.document.querySelector(selector) as HappyHTMLElement | null;
  if (found === null) throw new Error(`missing desktop control ${selector}`);
  return found;
}

export async function settleInventory() {
  for (let turn = 0; turn < 60; turn += 1) await Promise.resolve();
}

export async function clickInventory(window: HappyWindow, selector: string) {
  inventoryElement(window, selector).click();
  await settleInventory();
}

export async function escapeInventory(window: HappyWindow) {
  window.document.dispatchEvent(
    new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );
  await settleInventory();
}

type HostCall = Readonly<{
  plane: "project" | "engine";
  action: string;
  op: string | null;
}>;

const ACTIVE_PROJECT = Object.freeze({
  name: "Command test",
  root: "/tmp/sceneaxi-command-test",
  documentPath: "scene.json",
  source: "opened",
});

const CONTENT_HASH = `sha256:${"a".repeat(64)}`;

function projectStatus(hasActiveProject: boolean) {
  return {
    active: hasActiveProject ? ACTIVE_PROJECT : null,
    recents: [ACTIVE_PROJECT],
    recovery: null,
  };
}

/** Commands whose outcome dialog must show the engine's own answer, not a chrome-side refusal. */
export const ENGINE_ANSWERED_COMMANDS = new Set([
  "project-migration-propose", "project-migration-recover", "workspace-layout-apply",
]);

function engineResponse(
  request: Record<string, unknown>,
  state: {
    undoAvailability: "available" | "unavailable" | "recovery-pending";
    redoAvailability: "available" | "unavailable" | "recovery-pending";
    projectGitResponse?: unknown;
  },
) {
  const payload = request["payload"] as Record<string, unknown> | undefined;
  const action = request["action"];
  const op = payload?.["op"];
  if (action === "command") {
    // The real bridge validates every invocation against the shared registry before
    // routing it; the harness must too, or a malformed input looks like a success.
    const validated = validateEditorCommandInvocation(payload);
    if (!validated.ok) return { ok: false, reason: validated.reason, message: validated.message };
    const commandId = payload?.["commandId"];
    const input = payload?.["input"] as Record<string, unknown> | undefined;
    if (commandId === "project-build") {
      return { ok: false, reason: "PROJECT_BUILD_SIGNING_MISSING", message: "Linux signing is not configured." };
    }
    if (ENGINE_ANSWERED_COMMANDS.has(String(commandId))) {
      return { ok: false, reason: "DESKTOP_COMMAND_TEST_ANSWERED", message: `The engine answered ${String(commandId)}.` };
    }
    const translated = commandId === "project-save" || commandId === "change-review-accept"
      ? { action: "authoring", payload: { op: "accept" } }
      : commandId === "change-review-reject"
        ? { action: "authoring", payload: { op: "reject" } }
        : commandId === "edit-undo"
          ? { action: "authoring", payload: { op: "undo" } }
          : commandId === "edit-redo"
            ? { action: "authoring", payload: { op: "redo" } }
          : commandId === "run-play"
            ? { action: "open-path", payload: input }
            : commandId === "run-stop" || commandId === "run-reset"
              ? { action: "run-control", payload: { commandId } }
              : commandId === "physics-inspect" || commandId === "environment-inspect" ||
                  commandId === "material-inspect" || commandId === "effect-inspect"
                ? { action: "catalog-inspect", payload: { commandId } }
            : commandId === "ship-export-web"
              ? { action: "ship", payload: { op: "export-web", ...input } }
              : commandId === "project-git-status" || commandId === "project-git-diff" ||
                  commandId === "project-git-stage" || commandId === "project-git-commit-prepare"
                ? { action: "project-git", payload: { op: commandId, input } }
              : null;
    if (["physics-apply", "environment-apply", "material-apply", "effect-apply"].includes(String(commandId))) {
      return {
        ok: true,
        action: "command",
        data: {
          authoringSnapshot: {
            phase: "reviewing",
            ok: true,
            unifiedDiff: "--- scene.json\n+++ scene.json\n",
            renderedDiff: "Physics change staged for review.",
            appliedPaths: null,
            transactionId: null,
            diagnostics: null,
            journalRecoveryPending: false,
            proposal: {
              edits: [{
                documentPath: "scene.json",
                baseContentHash: CONTENT_HASH,
                jsonPointer: "/data",
                newValue: { entities: [] },
              }],
            },
          },
        },
      };
    }
    if (translated !== null) return engineResponse(translated, state);
  }
  if (action === "authoring" && op === "status") {
    return {
      ok: true,
      action,
      data: {
        ok: true,
        documentPath: "scene.json",
        documentId: "command-test",
        contentHash: CONTENT_HASH,
        dataKeys: ["entities"],
        undoAvailability: state.undoAvailability,
        redoAvailability: state.redoAvailability,
        data: { entities: [] },
      },
    };
  }
  // A whole `DesktopSnapshot`, the shape the real session returns: the surface
  // refuses a snapshot it cannot validate rather than projecting a partial one.
  if (action === "authoring" && op === "propose") {
    return {
      ok: true,
      action,
      data: {
        phase: "reviewing",
        unifiedDiff: "--- scene.json\n+++ scene.json\n",
        renderedDiff: "=== SceneAxi inspector — proposed change\n",
        proposal: {
          edits: [{ documentPath: "scene.json", baseContentHash: CONTENT_HASH }],
        },
        appliedPaths: null,
        transactionId: null,
        diagnostics: null,
        journalRecoveryPending: false,
      },
    };
  }
  if (action === "authoring" && op === "accept") {
    state.undoAvailability = "available";
    return {
      ok: true,
      action,
      data: {
        phase: "applied",
        unifiedDiff: null,
        renderedDiff: null,
        proposal: null,
        appliedPaths: ["scene.json"],
        transactionId: null,
        diagnostics: null,
        journalRecoveryPending: false,
      },
    };
  }
  if (action === "authoring" && op === "undo") {
    state.undoAvailability = "unavailable";
    state.redoAvailability = "available";
    return {
      ok: true,
      action,
      data: { ok: true, restoredPaths: ["scene.json"] },
    };
  }
  if (action === "authoring" && op === "redo") {
    state.undoAvailability = "available";
    state.redoAvailability = "unavailable";
    return {
      ok: true,
      action,
      data: { ok: true, transactionId: "1700000000000-0123456789abcdef", restoredPaths: ["scene.json"] },
    };
  }
  if (action === "run-control") {
    return { ok: true, action: "command", data: { completed: true } };
  }
  if (action === "catalog-inspect") {
    return { ok: true, action: "command", data: { kind: "sceneaxi.test-catalog", catalog: {} } };
  }
  if (action === "open-path") {
    return {
      ok: true,
      action,
      data: {
        closed: true,
        tickDigests: ["sha256:tick"],
        mountable: { sceneId: "command-test-scene" },
      },
    };
  }
  if (action === "ship" && op === "export-web") {
    return {
      ok: true,
      action,
      data: {
        replayed: false,
        outputDirectory: "/tmp/sceneaxi-command-test/exports/web/aaaaaaaa",
        handoffPath:
          "/tmp/sceneaxi-command-test/exports/web/aaaaaaaa/delivery-handoff.json",
        sourceProject: {
          documentId: "command-test",
          contentHash: CONTENT_HASH,
          sceneDigest: `sha256:${"b".repeat(64)}`,
        },
        bundleDigest: `sha256:${"c".repeat(64)}`,
        artifactPaths: ["index.html", "source/scene.json"],
      },
    };
  }
  if (action === "project-git") {
    if (state.projectGitResponse !== undefined) {
      return { ok: true, action: "command", data: state.projectGitResponse };
    }
    const repositoryState = {
      schemaVersion: 1,
      kind: "sceneaxi.project-git-state",
      projectId: "project-command-test",
      branch: "main",
      head: "a".repeat(40),
      detached: false,
      canonicalFiles: ["scene.json", "sceneaxi.project.json"],
      entries: [{ path: "scene.json", index: " ", worktree: "M", canonical: true, conflict: false }],
      canonicalChanges: [{ path: "scene.json", index: " ", worktree: "M", canonical: true, conflict: false }],
      unrelatedChanges: [],
      conflicts: [],
      workingTreeDiff: "",
      stagedDiff: "",
      clean: false,
      undoScope: "sceneaxi-document-only",
    };
    return {
      ok: true,
      action: "command",
      data: op === "project-git-commit-prepare"
        ? {
            schemaVersion: 1,
            kind: "sceneaxi.project-git-commit-preparation",
            message: "feat: prepare",
            selectedPaths: ["scene.json"],
            stagedDiff: "",
            state: repositoryState,
            commitCreated: false,
            hooksBypassed: false,
            undoScope: "sceneaxi-document-only",
          }
        : repositoryState,
    };
  }
  if (action === "profile") {
    return { ok: true, action, data: payload };
  }
  return {
    ok: false,
    reason: "DESKTOP_COMMAND_TEST_UNEXPECTED",
    message: `Unexpected request ${String(action)}:${String(op)}`,
    detail: null,
  };
}

export async function settleCommands(window: HappyWindow) {
  for (let turn = 0; turn < 40; turn += 1) {
    await Promise.resolve();
    const projectState = window.document.querySelector("[data-project-state]")
      ?.getAttribute("data-project-state");
    const projectTransitionPending =
      projectState === "opening" ||
      projectState === "recovering" ||
      projectState === "undoing" ||
      projectState === "redoing";
    if (
      turn >= 10 &&
      window.document.querySelector("[data-busy]") === null &&
      !projectTransitionPending
    ) return;
  }
  throw new Error("desktop command did not settle");
}

export async function commandHarness(
  profile: "game" | "web" | "kids" = "web",
  initialUndoAvailability:
    | "available"
    | "unavailable"
    | "recovery-pending" = "unavailable",
  hasActiveProject = true,
  projectGitResponse?: unknown,
  inputActionMap?: InputActionMap,
) {
  const window = new HappyWindow({ width: 1200, height: 800 });
  windows.push(window);
  const calls: HostCall[] = [];
  const requests: Record<string, unknown>[] = [];
  const state: {
    undoAvailability: "available" | "unavailable" | "recovery-pending";
    redoAvailability: "available" | "unavailable" | "recovery-pending";
    projectGitResponse?: unknown;
  } = {
    undoAvailability: initialUndoAvailability,
    redoAvailability: "unavailable",
    ...(projectGitResponse === undefined ? {} : { projectGitResponse }),
  };
  const clone = <T>(value: T): T => window.eval(`(${JSON.stringify(value)})`) as T;
  Object.defineProperty(window, "structuredClone", { value: clone });
  Object.defineProperty(window, "sceneaxiDesktopLinux", {
    configurable: true,
    value: {
      ...(inputActionMap === undefined
        ? {}
        : { inputActions: async () => clone({ ok: true, data: { map: inputActionMap } }) }),
      project: async (request: unknown) => {
        const typed = clone(request) as Record<string, unknown>;
        const action = String(typed["action"]);
        calls.push({ plane: "project", action, op: null });
        if (action === "status") {
          return clone({ ok: true, data: { status: projectStatus(hasActiveProject) } });
        }
        return clone({
          ok: true,
          data: {
            outcome: action === "choose-new" ? "created" : "opened",
            status: projectStatus(hasActiveProject),
          },
        });
      },
      request: async (request: unknown) => {
        const typed = clone(request) as Record<string, unknown>;
        requests.push(typed);
        const payload = typed["payload"] as Record<string, unknown> | undefined;
        calls.push({
          plane: "engine",
          action: String(typed["action"]),
          op: typeof payload?.["commandId"] === "string"
            ? payload["commandId"]
            : typeof payload?.["op"] === "string" ? payload["op"] : null,
        });
        return clone(engineResponse(typed, state));
      },
    },
  });

  const html = renderDesktopChrome(
    desktopVisualView(createDesktopVisualState({ profile })),
  );
  const match = /<script>([\s\S]*?)<\/script>/.exec(html);
  if (match?.[1] === undefined) throw new Error("desktop chrome script missing");
  window.document.write(html.replace(match[0], ""));
  window.document.addEventListener("sceneaxi:desktop-viewport-play", (event) => {
    const detail = (event as unknown as { detail: Record<string, unknown> }).detail;
    detail["accepted"] = true;
    detail["frame"] = 9;
  });
  window.eval(match[1]);
  await settleCommands(window);
  calls.splice(0);
  return { window, calls, requests };
}

export function commandElement(window: HappyWindow, selector: string) {
  const found = window.document.querySelector(selector) as HappyHTMLElement | null;
  if (found === null) throw new Error(`missing command control ${selector}`);
  return found;
}

export async function clickCommand(window: HappyWindow, selector: string) {
  commandElement(window, selector).click();
  await settleCommands(window);
}

export function shortcut(window: HappyWindow, key: string, target?: HappyHTMLElement, shiftKey = false) {
  const event = new window.KeyboardEvent("keydown", {
    key,
    ctrlKey: true,
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  (target ?? (window.document.body as unknown as HappyHTMLElement)).dispatchEvent(event);
  return event;
}

export function tab(window: HappyWindow, target: HappyHTMLElement, shiftKey: boolean) {
  const event = new window.KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

/** The tests project uses happy-dom's element types, not global DOM types. */
export function query(window: HappyWindow, selector: string) {
  return window.document.querySelector(selector) as HappyHTMLElement | null;
}

export function queryAll(window: HappyWindow, selector: string) {
  return [...window.document.querySelectorAll(selector)] as HappyHTMLElement[];
}

export async function clickProduct(window: HappyWindow, selector: string) {
  const element = query(window, selector);
  if (element === null) throw new Error(`missing product-loop control ${selector}`);
  element.click();
  for (let turn = 0; turn < 60; turn += 1) {
    await Promise.resolve();
    if (window.document.querySelector("[data-busy]") === null) return;
  }
  throw new Error(`product-loop control did not settle ${selector}`);
}

export function requestOperation(request: unknown): string | null {
  const typed = request as {
    action?: unknown;
    payload?: { op?: unknown; commandId?: unknown };
  };
  if (typed.action === "authoring" && typeof typed.payload?.op === "string") {
    return typed.payload.op;
  }
  if (typed.action !== "command") return null;
  switch (typed.payload?.commandId) {
    case "project-save":
    case "change-review-accept":
      return "accept";
    case "change-review-reject":
      return "reject";
    case "edit-undo":
      return "undo";
    case "run-play":
      return "open-path";
    default:
      return typeof typed.payload?.commandId === "string" ? typed.payload.commandId : null;
  }
}

/** The real bridge factories are supplied by goldens, keeping desktop-tier imports out of unit compilation. */
export function productHarness<Bridge extends { handle(request: unknown): unknown }>(
  createDesktopBridge: (options: { cwd: string; nowMs: () => number; commandCapabilities: string[] }) => Bridge,
  desktopOpenScene: () => { ok: true; composed: { document: SceneDocument } } | { ok: false; reason: string },
) {
  function projectDir() {
    const dir = mkdtempSync(join(tmpdir(), "sceneaxi-product-loop-"));
    dirs.push(dir);
    const starter = desktopOpenScene();
    if (!starter.ok) throw new Error(`desktop scene refused: ${starter.reason}`);
    const result = writeDocumentFile(
      join(dir, "scene.json"),
      createDocument({
        id: "desktop-first-release",
        data: {
          ...starter.composed.document.data,
          title: "First release",
          entities: [{ id: "hero" }],
        },
      }),
      { cwd: dir },
    );
    if (!result.ok) throw new Error("desktop product-loop fixture refused");
    return dir;
  }

  /** Mount the real bridge across the same structured-clone boundary as Electron IPC. */
  function mountChrome(
    dir: string,
    intercept?: (port: { readonly bridge: Bridge; readonly ipcClone: <T>(value: T) => T }) => (request: unknown) => Promise<unknown>,
  ) {
    const bridge = createDesktopBridge({
      cwd: dir,
      nowMs: () => 1_753_920_000_000,
      commandCapabilities: [...new Set(
        EDITOR_COMMAND_REGISTRY.map((command) => command.capability.id),
      )],
    });
    const window = new HappyWindow({ width: 1000, height: 700 });
    windows.push(window);
    const ipcClone = <T>(value: T): T => window.eval(`(${JSON.stringify(value)})`) as T;
    const request =
      intercept?.({ bridge, ipcClone }) ??
      (async (value: unknown) => ipcClone(bridge.handle(ipcClone(value))));
    Object.defineProperty(window, "structuredClone", { value: ipcClone });
    Object.defineProperty(window, "sceneaxiDesktop", { value: { request } });
    const html = renderDesktopChrome(
      desktopVisualView(
        createDesktopVisualState({
          profile: "game",
          window: { width: 1000, height: 700 },
        }),
      ),
    );
    const match = /<script>([\s\S]*?)<\/script>/.exec(html);
    if (match === null) throw new Error("desktop chrome lost its emitted script");
    const script = match[1];
    if (script === undefined) throw new Error("desktop chrome emitted an empty script");
    window.document.write(html.replace(match[0], ""));
    return {
      window,
      start: () => {
        window.eval(script);
      },
    };
  }

  return { projectDir, mountChrome };
}
