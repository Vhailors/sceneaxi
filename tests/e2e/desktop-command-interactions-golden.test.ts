/** Semantic interaction coverage for the truthful desktop command registry. */
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_INPUT_ACTION_MAP,
  reviewInputActionRebind,
  validateEditorCommandInvocation,
  type InputActionMap,
} from "@sceneaxi/schemas";
import {
  Window as HappyWindow,
  type HTMLElement as HappyHTMLElement,
  type HTMLInputElement as HappyHTMLInputElement,
} from "happy-dom";
import {
  DESKTOP_INTERACTION_COMMANDS,
  DESKTOP_OVERLAY_SHORTCUTS,
  DESKTOP_PALETTE_SHORTCUT,
  DESKTOP_PRODUCT_REFUSALS,
  createDesktopVisualState,
  desktopVisualView,
  renderDesktopChrome,
  type DesktopInteractionCommand,
} from "@sceneaxi/desktop-shell";

type JsonValue = string | number | boolean | null | undefined | readonly JsonValue[] | JsonObject;

type JsonObject = { [key: string]: JsonValue };

type HostRequest = { action?: string; payload?: JsonObject | undefined };

type HostReply = JsonObject;

type FixtureHost = {
  inputActions?: () => Promise<{ ok: boolean; data: { map: InputActionMap } }>;
  project: (request: HostRequest) => Promise<HostReply>;
  request: (request: HostRequest) => Promise<HostReply>;
};

type EngineState = {
  undoAvailability: "available" | "unavailable" | "recovery-pending";
  redoAvailability: "available" | "unavailable" | "recovery-pending";
  projectGitResponse?: JsonValue;
};

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isObject(value: JsonValue): value is JsonObject | readonly JsonValue[] | null {
  return typeof value === "object";
}

function isRecord(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseObject(value: JsonValue): JsonObject | undefined {
  if (value === undefined) return undefined;

  if (!isRecord(value)) throw new Error("expected bridge object");

  return value;
}

const windows: HappyWindow[] = [];

afterEach(() => {
  for (const window of windows.splice(0)) window.close();
});

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
const ENGINE_ANSWERED_COMMANDS = new Set([
  "project-migration-recover", "workspace-layout-apply",
]);

/** Inputs now require a visible form and explicit user submission. */
const INPUT_REQUIRED_COMMANDS = new Set([
  "package-install", "package-remove", "project-migration-commit", "extension-start",
  "input-action-rebind", "input-actions-reset", "scene-prefab-define",
  "scene-prefab-instance", "scene-prefab-override", "scene-prefab-refresh",
  "viewport-source-set", "physics-evaluate",
]);

function engineResponse(
  request: HostRequest,
  state: EngineState,
) {
  const payload = request.payload;
  const action = request["action"];
  const op = payload?.["op"];

  if (action === "command") {
    // The real bridge validates every invocation against the shared registry before
    // routing it; the harness must too, or a malformed input looks like a success.
    const validated = validateEditorCommandInvocation(payload);

    if (!validated.ok) return { ok: false, reason: validated.reason, message: validated.message };
    const commandId = payload?.["commandId"];
    const input = parseObject(payload?.["input"]);

    if (commandId === "input-actions-inspect") {
      return { ok: true, data: { baseVersions: { project: CONTENT_HASH, workspace: CONTENT_HASH } } };
    }

    if (commandId === "project-migration-propose") {
      return { ok: true, data: { proposal: { proposalDigest: CONTENT_HASH } } };
    }

    if (INPUT_REQUIRED_COMMANDS.has(String(commandId))) {
      return { ok: false, reason: "DESKTOP_COMMAND_TEST_ANSWERED", message: `The validated fixture host answered ${String(commandId)}.` };
    }

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

async function settle(window: HappyWindow) {
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

async function harness(
  profile: "game" | "web" | "kids" = "web",
  initialUndoAvailability:
    | "available"
    | "unavailable"
    | "recovery-pending" = "unavailable",
  hasActiveProject = true,
  projectGitResponse?: JsonValue,
  inputActionMap?: InputActionMap,
) {
  const window = new HappyWindow({ width: 1200, height: 800 });
  windows.push(window);
  const calls: HostCall[] = [];
  const requests: HostRequest[] = [];

  const state: EngineState = {
    undoAvailability: initialUndoAvailability,
    redoAvailability: "unavailable",
  };

  if (projectGitResponse !== undefined) state.projectGitResponse = projectGitResponse;

  // SAFETY: All clone callers in this harness supply plain JSON bridge fixtures; JSON serialization preserves their data while evaluation recreates it in the HappyWindow realm.
  const clone = <T>(value: T): T => window.eval(`(${JSON.stringify(value)})`) as T;
  Object.defineProperty(window, "structuredClone", { value: clone });

  const host: FixtureHost = {
      project: async (request: HostRequest) => {
        const typed = clone(request);
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
      request: async (request: HostRequest) => {
        const typed = clone(request);
        requests.push(typed);
        const payload = typed.payload;
        calls.push({
          plane: "engine",
          action: String(typed["action"]),
          op: isString(payload?.["commandId"])
            ? payload["commandId"]
            : isString(payload?.["op"]) ? payload["op"] : null,
        });

        return clone(engineResponse(typed, state));
      },
  };

  if (inputActionMap !== undefined) {
    host.inputActions = async () => clone({ ok: true, data: { map: inputActionMap } });
  }

  Object.defineProperty(window, "sceneaxiDesktopLinux", { configurable: true, value: host });

  const html = renderDesktopChrome(
    desktopVisualView(createDesktopVisualState({ profile })),
  );

  const match = /<script>([\s\S]*?)<\/script>/.exec(html);

  if (match?.[1] === undefined) throw new Error("desktop chrome script missing");
  window.document.write(html.replace(match[0], ""));
  window.document.addEventListener("sceneaxi:desktop-viewport-play", (event) => {
    if (!(event instanceof window.CustomEvent)) throw new Error("expected viewport CustomEvent");
    const detail = parseObject(event.detail);

    if (detail === undefined) throw new Error("expected viewport event detail");
    detail["accepted"] = true;
    detail["frame"] = 9;
  });
  window.eval(match[1]);
  await settle(window);
  calls.splice(0);

  return { window, calls, requests, host };
}

function element(window: HappyWindow, selector: string) {
  const found = window.document.querySelector(selector);

  if (!(found instanceof window.HTMLElement)) throw new Error(`missing command control ${selector}`);

  return found;
}

function textarea(window: HappyWindow, selector: string) {
  const found = element(window, selector);

  if (!(found instanceof window.HTMLTextAreaElement) && !(found instanceof window.HTMLInputElement)) {
    throw new Error(`expected text control ${selector}`);
  }

  return found;
}

async function click(window: HappyWindow, selector: string) {
  element(window, selector).click();
  await settle(window);
}

function shortcut(window: HappyWindow, key: string, target?: HappyHTMLElement, shiftKey = false) {
  const event = new window.KeyboardEvent("keydown", {
    key,
    ctrlKey: true,
    shiftKey,
    bubbles: true,
    cancelable: true,
  });

  // SAFETY: HappyWindow owns this document body, which is an HTML element in the same DOM realm as the keyboard event.
  (target ?? (window.document.body as HappyHTMLElement)).dispatchEvent(event);

  return event;
}

function tab(window: HappyWindow, target: HappyHTMLElement, shiftKey: boolean) {
  const event = new window.KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey,
    bubbles: true,
    cancelable: true,
  });

  target.dispatchEvent(event);

  return event;
}

async function prepare(command: DesktopInteractionCommand, window: HappyWindow) {
  if (command.id === "project-save" || command.id === "edit-undo" || command.id === "edit-redo") {
    await click(window, "#web-stage-html");
  }

  if (command.id === "edit-undo") {
    await click(window, '#project-save[data-command="project-save"]');
  }

  if (command.id === "edit-redo") {
    await click(window, '#project-save[data-command="project-save"]');
    await click(window, '#menu-command-edit-undo');
  }

  if (command.id === "project-git-stage" || command.id === "project-git-commit-prepare") {
    await click(window, '#menu-command-project-git-status');
    // SAFETY: The rendered desktop command form supplies HTML input controls at this selector; this test reads or sets their value/checked fields.
    const path = element(window, '[data-project-git-path][value="scene.json"]') as HappyHTMLInputElement;
    path.checked = true;
  }

  if (command.id === "project-git-commit-prepare") {
    // SAFETY: The rendered desktop command form supplies HTML input controls at this selector; this test reads or sets their value/checked fields.
    const message = element(window, "[data-project-git-message]") as HappyHTMLInputElement;
    message.value = "feat: prepare";
  }
}

function expectedEffect(command: DesktopInteractionCommand) {
  switch (command.id) {
    case "project-new":
      return { plane: "project", action: "choose-new", op: null } as const;
    case "project-open":
      return { plane: "project", action: "choose-open", op: null } as const;
    case "project-save":
      return { plane: "engine", action: "command", op: "project-save" } as const;
    case "project-git-status":
      return { plane: "engine", action: "command", op: "project-git-status" } as const;
    case "project-git-diff":
      return { plane: "engine", action: "command", op: "project-git-diff" } as const;
    case "project-git-stage":
      return { plane: "engine", action: "command", op: "project-git-stage" } as const;
    case "project-git-commit-prepare":
      return { plane: "engine", action: "command", op: "project-git-commit-prepare" } as const;
    case "ship-export-web":
      return { plane: "engine", action: "command", op: "ship-export-web" } as const;
    case "edit-undo":
      return { plane: "engine", action: "command", op: "edit-undo" } as const;
    case "edit-redo":
      return { plane: "engine", action: "command", op: "edit-redo" } as const;
    case "run-play":
      return { plane: "engine", action: "command", op: "run-play" } as const;
    default:
      return { plane: "engine", action: "command", op: command.id } as const;
  }
}

async function invoke(
  path: "menu" | "palette" | "shortcut",
  command: DesktopInteractionCommand,
) {
  const { window, calls, requests } = await harness();
  await prepare(command, window);
  calls.splice(0);

  if (path === "menu") {
    await click(window, `[data-menu-trigger="${command.menu}"]`);
    await click(window, `#menu-command-${command.id}`);
  } else if (path === "palette") {
    shortcut(window, DESKTOP_PALETTE_SHORTCUT.key);
    expect(element(window, '.overlay[data-overlay="palette"]').hidden).toBe(false);
    await click(window, `#palette-${command.id}`);
  } else {
    if (command.key === null) throw new Error(`${command.id} has no accelerator`);
    const event = shortcut(window, command.key, undefined, command.id === "edit-redo");
    expect(event.defaultPrevented).toBe(true);
    await settle(window);
  }

  if (INPUT_REQUIRED_COMMANDS.has(command.id)) {
    const form = element(window, `[data-command-input="${command.id}"]`);
    expect(form.closest('[role="dialog"]')?.getAttribute("aria-modal")).toBe("true");
    expect(calls).not.toContainEqual(expectedEffect(command));

    const values = {
      documentPath: "scene.json", expectedContentHash: CONTENT_HASH, profile: "web",
      expectedBaseVersion: CONTENT_HASH, proposalDigest: CONTENT_HASH,
      scope: "project", actionId: "play.primary", binding: { device: "keyboard", key: "p", modifiers: [] },
      reviewDigest: null, approved: true, definitionId: "fixture-prefab",
      instanceIds: ["root"], parentInstanceId: "root", instanceId: "root", sourceInstanceId: "root",
      instanceKey: "fixture-copy", propertyId: "translation-x", newValue: 2,
      steps: 1, source: "scene", locator: "packages/fixture", manifest: {},
      digest: CONTENT_HASH, packageId: "fixture-package", seamId: "networking",
    };

    for (const field of form.querySelectorAll("[data-command-field]")) {
      const name = field.getAttribute("data-command-field");

      if (name === null || !(name in values)) continue;

      if (!(field instanceof window.HTMLInputElement) && !(field instanceof window.HTMLTextAreaElement) && !(field instanceof window.HTMLSelectElement)) {
        throw new Error("expected command form control");
      }

      const input = field;
      // SAFETY: The preceding membership check established that name is a key of the locally constructed command-field fixture.
      const value = values[name as keyof typeof values];

      if (input instanceof window.HTMLInputElement && input.type === "checkbox") input.checked = Boolean(value);
      else input.value = isObject(value) ? JSON.stringify(value) : String(value);
    }

    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await settle(window);
    const submitted = requests.find((request) => request.payload?.commandId === command.id);
    expect(submitted).toBeDefined();
    expect(validateEditorCommandInvocation(submitted?.payload).ok).toBe(true);
  }

  expect(calls).toContainEqual(expectedEffect(command));

  if (command.id === "project-build") {
    expect(requests.find((request) => request.payload?.commandId === command.id))
      .toMatchObject({ payload: { input: { profile: "web", target: "linux" } } });
    expect(element(window, "[data-outcome-code]").textContent).toBe("PROJECT_BUILD_SIGNING_MISSING");
  }

  if (INPUT_REQUIRED_COMMANDS.has(command.id)) {
    expect(element(window, "[data-command-evidence]").textContent + element(window, "[data-project-status]").textContent).toContain("DESKTOP_COMMAND_TEST_ANSWERED");
  }

  if (command.id === "workspace-layout-apply") {
    expect(requests.find((request) => request.payload?.commandId === command.id))
      .toMatchObject({ payload: { input: { profile: expect.any(String), leftVisible: expect.any(Boolean), inspectorVisible: expect.any(Boolean) } } });
  }

  if (ENGINE_ANSWERED_COMMANDS.has(command.id)) {
    expect(requests.some((request) => request.payload?.commandId === command.id)).toBe(true);
    expect(element(window, "[data-outcome-code]").textContent).toBe("DESKTOP_COMMAND_TEST_ANSWERED");
  }

  if (command.id === "run-play") {
    expect(element(window, ".shell").dataset.mode).toBe("run");
    expect(element(window, "[data-project-status]").textContent).toContain(
      "Played composed scene",
    );
  }

  if (command.id === "ship-export-web") {
    expect(element(window, ".shell").dataset.mode).toBe("ship");
    expect(element(window, "[data-project-status]").textContent).toContain(
      "Exported Web bundle",
    );
    expect(element(window, "[data-ship-bundle-digest]").textContent).toBe(
      `sha256:${"c".repeat(64)}`,
    );
  }

  if (
    command.id === "project-git-status" || command.id === "project-git-diff" ||
    command.id === "project-git-stage" || command.id === "project-git-commit-prepare"
  ) {
    expect(element(window, ".shell").dataset.mode).toBe("ship");
    expect(element(window, "[data-project-git-evidence]").textContent).toContain(
      '"kind": "sceneaxi.project-git-state"',
    );
  }
}

describe("desktop command menu, palette, and accelerator parity", () => {
  for (const command of DESKTOP_INTERACTION_COMMANDS) {
    it(`invokes ${command.id} from its menu`, async () => {
      await invoke("menu", command);
    });

    it(`invokes ${command.id} from the palette`, async () => {
      await invoke("palette", command);
    });

    if (command.key !== null) {
      it(`invokes ${command.id} from ${command.accelerator}`, async () => {
        await invoke("shortcut", command);
      });

      it(`does not invoke ${command.id} from text entry`, async () => {
        const commandKey = command.key;

        if (commandKey === null) throw new Error(`${command.id} has no accelerator`);
        const { window, calls } = await harness();
        await prepare(command, window);
        calls.splice(0);
        const shell = element(window, ".shell");
        // SAFETY: HappyWindow.document created this HTML element from the literal tag here; the assertion only exposes HappyDOM HTML methods.
        const input = window.document.createElement("input") as HappyHTMLElement;
        // SAFETY: HappyWindow.document created this HTML element from the literal tag here; the assertion only exposes HappyDOM HTML methods.
        const editable = window.document.createElement("div") as HappyHTMLElement;
        editable.setAttribute("contenteditable", "");
        // SAFETY: HappyWindow.document created this HTML element from the literal tag here; the assertion only exposes HappyDOM HTML methods.
        const plaintext = window.document.createElement("div") as HappyHTMLElement;
        plaintext.setAttribute("contenteditable", "plaintext-only");
        // SAFETY: HappyWindow.document created this HTML element from the literal tag here; the assertion only exposes HappyDOM HTML methods.
        const inherited = window.document.createElement("span") as HappyHTMLElement;
        editable.append(inherited);
        shell.append(input, editable, plaintext);

        for (const target of [input, editable, plaintext, inherited]) {
          const event = shortcut(window, commandKey, target, command.id === "edit-redo");
          await settle(window);
          expect(event.defaultPrevented).toBe(false);
          expect(calls).not.toContainEqual(expectedEffect(command));
        }
      });
    }
  }

  it("dispatches Stop and Reset from the Run inspector", async () => {
    const { window, calls, requests } = await harness();
    await click(window, "#mode-run");
    calls.splice(0);
    await click(window, "#run-stop");
    expect(calls).toContainEqual({ plane: "engine", action: "command", op: "run-stop" });
    expect(requests.find((request) => request.payload?.commandId === "run-stop"))
      .toMatchObject({ payload: { input: {} } });
    expect(element(window, "[data-project-status]").textContent).toContain("run-stop");
    await click(window, "#run-reset");
    expect(calls).toContainEqual({ plane: "engine", action: "command", op: "run-reset" });
    expect(requests.find((request) => request.payload?.commandId === "run-reset"))
      .toMatchObject({ payload: { input: {} } });
    expect(element(window, "[data-project-status]").textContent).toContain("run-reset");
  });

  it("stages an inspector mutation through the shared Change Review proposal", async () => {
    const { window, requests } = await harness();
    await click(window, "#mode-build");
    const mutation = textarea(window, '[data-catalog-mutation="physics"]');
    mutation.value = JSON.stringify({ kind: "world-set", gravityY: -9.81, stepMs: 16, seed: 1 });
    await click(window, "#physics-stage");

    const request = requests.find((candidate) => {
      const payload = candidate.payload;

      return payload?.["commandId"] === "physics-apply";
    });

    expect(request).toMatchObject({ payload: { input: { mutation: { kind: "world-set" } } } });
    expect(element(window, "[data-change-proposal]").hidden).toBe(false);
    expect(element(window, "[data-change-diff]").textContent).toContain("Physics change staged");
  });

  it("stages all four inspector mutation types through Change Review", async () => {
    for (const kind of ["physics", "environment", "material", "effect"] as const) {
      const { window, requests } = await harness();
      await click(window, "#mode-build");
      const mutation = textarea(window, `[data-catalog-mutation="${kind}"]`);
      mutation.value = JSON.stringify({ kind: "set" });
      await click(window, `#${kind}-stage`);

      const request = requests.find((candidate) => {
        const payload = candidate.payload;

        return payload?.["commandId"] === `${kind}-apply`;
      });

      expect(request, `${kind} GUI apply command`).toMatchObject({
        payload: { input: { mutation: { kind: "set" } } },
      });
      expect(element(window, "[data-change-proposal]").hidden).toBe(false);
    }
  });

  it("names malformed inspector JSON and refuses before host dispatch", async () => {
    const { window, calls } = await harness();
    await click(window, "#mode-build");
    const mutation = textarea(window, '[data-catalog-mutation="physics"]');
    mutation.value = "[]";
    calls.splice(0);
    await click(window, "#physics-stage");
    expect(calls.some((call) => call.op === "physics-apply")).toBe(false);
    expect(element(window, "[data-outcome-code]").textContent).toBe("EDITOR_COMMAND_INPUT_INVALID");
  });

  it("dispatches inspector reads for all four registered catalogs", async () => {
    const { window, calls } = await harness();
    await click(window, "#mode-build");

    for (const kind of ["physics", "environment", "material", "effect"] as const) {
      await click(window, `#${kind}-inspect`);
      expect(calls).toContainEqual({ plane: "engine", action: "command", op: `${kind}-inspect` });
      expect(element(window, `[data-catalog-report="${kind}"]`).textContent).toContain("sceneaxi.test-catalog");
    }
  });

  it("opens the palette with Ctrl/Cmd+K even from text entry", async () => {
    const { window } = await harness();
    // SAFETY: HappyWindow.document created this HTML element from the literal tag here; the assertion only exposes HappyDOM HTML methods.
    const input = window.document.createElement("input") as HappyHTMLElement;
    element(window, ".shell").append(input);
    const event = shortcut(window, DESKTOP_PALETTE_SHORTCUT.key, input);
    expect(event.defaultPrevented).toBe(true);
    expect(element(window, '.overlay[data-overlay="palette"]').hidden).toBe(false);
  });

  it("restores a rebind into the emitted accelerator resolver and labels", async () => {
    const reviewed = reviewInputActionRebind(
      DEFAULT_INPUT_ACTION_MAP,
      "editor.project.save",
      { device: "keyboard", code: "KeyB", modifiers: ["primary"] },
    );

    if (!reviewed.ok || !("map" in reviewed)) throw new Error("rebind fixture refused");
    const { window, calls } = await harness("web", "unavailable", true, undefined, reviewed.map);
    await click(window, "#web-stage-html");
    calls.splice(0);
    const oldEvent = shortcut(window, "s");
    await settle(window);
    expect(oldEvent.defaultPrevented).toBe(false);
    expect(calls).toHaveLength(0);
    const reboundEvent = shortcut(window, "b");
    await settle(window);
    expect(reboundEvent.defaultPrevented).toBe(true);
    expect(calls).toContainEqual({ plane: "engine", action: "command", op: "project-save" });
    expect(element(window, "#menu-command-project-save kbd").textContent).toBe("Ctrl/Cmd+B");
  });

  it("keeps command accelerators active from the recent-project chooser", async () => {
    const { window, calls } = await harness();
    const event = shortcut(window, "o", element(window, "#project-recent-select"));
    await settle(window);
    expect(event.defaultPrevented).toBe(true);
    expect(calls).toContainEqual({ plane: "project", action: "choose-open", op: null });
  });

  it("refuses Export Web by name when no project is open", async () => {
    const { window, calls } = await harness("web", "unavailable", false);
    await click(window, "#mode-ship");
    calls.splice(0);
    await click(window, "#ship-export-web");
    expect(calls).toEqual([]);
    expect(element(window, "[data-project-status]").textContent).toContain(
      DESKTOP_PRODUCT_REFUSALS.projectRequired,
    );
    expect(element(window, "[data-outcome-code]").textContent).toContain(
      DESKTOP_PRODUCT_REFUSALS.projectRequired,
    );
  });

  it("refuses incomplete contained Git evidence without rendering it", async () => {
    const { window } = await harness("web", "unavailable", true, {
      schemaVersion: 1,
      kind: "sceneaxi.project-git-state",
      projectId: "project-command-test",
      branch: "main",
      head: "a".repeat(40),
      detached: false,
      canonicalFiles: ["scene.json", "sceneaxi.project.json"],
      entries: [],
      canonicalChanges: [],
      unrelatedChanges: [],
      workingTreeDiff: "",
      stagedDiff: "",
      clean: true,
      undoScope: "sceneaxi-document-only",
    });

    await click(window, '[data-menu-trigger="file"]');
    await click(window, "#menu-command-project-git-status");
    expect(element(window, "[data-project-status]").textContent).toContain(
      DESKTOP_PRODUCT_REFUSALS.runtimeRequestRefused,
    );
    expect(element(window, "[data-outcome-code]").textContent).toBe(
      DESKTOP_PRODUCT_REFUSALS.runtimeRequestRefused,
    );
    expect(element(window, "[data-project-git-evidence]").hidden).toBe(true);
  });

  it("stages exact evidence paths without lossy text parsing", async () => {
    const exactPath = " notes,2026.txt";

    const repositoryState = {
      schemaVersion: 1,
      kind: "sceneaxi.project-git-state",
      projectId: "project-command-test",
      branch: "main",
      head: "a".repeat(40),
      detached: false,
      canonicalFiles: ["scene.json", "sceneaxi.project.json"],
      entries: [{ path: exactPath, index: "?", worktree: "?", canonical: false, conflict: false }],
      canonicalChanges: [],
      unrelatedChanges: [{ path: exactPath, index: "?", worktree: "?", canonical: false, conflict: false }],
      conflicts: [],
      workingTreeDiff: "",
      stagedDiff: "",
      clean: false,
      undoScope: "sceneaxi-document-only",
    };

    const { window, requests } = await harness("web", "unavailable", true, repositoryState);
    await click(window, '#menu-command-project-git-status');

    // SAFETY: The rendered desktop command form supplies HTML input controls at this selector; this test reads or sets their value/checked fields.
    const path = [...window.document.querySelectorAll('[data-project-git-path]')]
      .find((candidate) => (candidate as HappyHTMLInputElement).value === exactPath) as HappyHTMLInputElement | undefined;

    expect(path).toBeDefined();

    if (path === undefined) return;
    path.checked = true;
    await click(window, '#menu-command-project-git-stage');

    const invocation = requests.find((request) => {
      const payload = request.payload;

      return payload?.["commandId"] === "project-git-stage";
    });

    expect(invocation).toMatchObject({
      payload: { input: { paths: [exactPath] } },
    });
  });

  it("retires Ship evidence when the project becomes dirty", async () => {
    const { window } = await harness();
    await click(window, "#ship-export-web");
    expect(element(window, "[data-ship-export-evidence]").hidden).toBe(false);
    await click(window, "#web-stage-html");
    expect(element(window, "[data-ship-export-evidence]").hidden).toBe(true);
    expect(element(window, "[data-ship-export-status]").textContent).toContain(
      "No export has run for the current saved project bytes",
    );
  });

  it("contains focus in the palette even when every row is inert", async () => {
    // The refuse-only profile demotes every operation row, so a trap built from
    // the actionable rows alone would contain nothing at all and let Tab walk
    // the document behind an `aria-modal` dialog.
    const { window } = await harness("kids");
    shortcut(window, DESKTOP_PALETTE_SHORTCUT.key);
    const palette = element(window, '.overlay[data-overlay="palette"]');
    expect(palette.hidden).toBe(false);
    // SAFETY: These selectors read HTML buttons/menu items from renderDesktopChrome in the HappyWindow document, not SVG or foreign-realm nodes.
    const stops = [...palette.querySelectorAll("button")] as HappyHTMLElement[];
    expect(stops.length).toBeGreaterThan(0);
    expect(stops.every((el) => el.getAttribute("aria-disabled") === "true")).toBe(true);
    expect(palette.contains(window.document.activeElement)).toBe(true);

    const last = stops[stops.length - 1];

    if (last === undefined) throw new Error("palette rendered no rows");
    last.focus();
    const wrap = tab(window, last, false);
    expect(wrap.defaultPrevented).toBe(true);
    expect(window.document.activeElement).toBe(stops[0]);
  });

  it("keeps the rows after an inert palette row reachable by Tab", async () => {
    const { window } = await harness();
    shortcut(window, DESKTOP_PALETTE_SHORTCUT.key);
    const palette = element(window, '.overlay[data-overlay="palette"]');
    const undo = element(window, "#palette-edit-undo");
    expect(undo.getAttribute("aria-disabled")).toBe("true");
    // SAFETY: These selectors read HTML buttons/menu items from renderDesktopChrome in the HappyWindow document, not SVG or foreign-realm nodes.
    const stops = [...palette.querySelectorAll("button")] as HappyHTMLElement[];
    expect(stops.indexOf(undo)).toBeGreaterThan(-1);
    expect(stops.indexOf(undo)).toBeLessThan(stops.length - 1);
    undo.focus();
    // An inert row is a member of the trap, so Tab off it is the browser's own
    // move to the next stop, not a wrap back to the first.
    const forward = tab(window, undo, false);
    expect(forward.defaultPrevented).toBe(false);
  });

  it("names the in-flight refusal when a command is re-invoked mid-request", async () => {
    const { window } = await harness();
    Object.defineProperty(window, "sceneaxiDesktopLinux", {
      configurable: true,
      value: { request: () => new Promise(() => {}) },
    });
    shortcut(window, "p");

    for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
    expect(element(window, "#project-save").getAttribute("aria-disabled")).toBe("true");
    expect(element(window, "#menu-command-project-save").getAttribute("aria-disabled")).toBe(
      "true",
    );
    const running = element(window, "[data-project-status]").textContent;
    const pill = element(window, "[data-project-state]").dataset.projectState;

    shortcut(window, "s");

    for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
    expect(element(window, '.overlay[data-overlay="outcome"]').hidden).toBe(false);
    expect(element(window, "[data-outcome-code]").textContent).toBe(
      DESKTOP_PRODUCT_REFUSALS.requestInFlight,
    );
    // The collided-with operation is still running, so the project channel must
    // keep reporting the project rather than the refused command.
    expect(element(window, "[data-project-status]").textContent).toBe(running);
    expect(element(window, "[data-project-state]").dataset.projectState).toBe(pill);
  });

  it("keeps Undo refused when availability refreshes during a request", async () => {
    const { window, host } = await harness();
    await click(window, "#web-stage-html");
    await click(window, '#project-save[data-command="project-save"]');



    Object.defineProperty(window, "sceneaxiDesktopLinux", {
      configurable: true,
      value: {
        project: host.project,
        request: async (request: HostRequest) => {
          const typed = request;

          if (typed.action === "command" && typed.payload?.commandId === "run-play") {
            return new Promise(() => {});
          }

          return host.request(request);
        },
      },
    });

    shortcut(window, "p");

    for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();

    for (const selector of ["#menu-command-edit-undo", "#palette-edit-undo"]) {
      const undo = element(window, selector);
      expect(undo.getAttribute("aria-disabled")).toBe("true");
      expect(undo.dataset.refusal).toBe(DESKTOP_PRODUCT_REFUSALS.requestInFlight);
      expect(undo.hasAttribute("data-busy")).toBe(true);
    }
  });

  it("refuses Undo rather than dropping a staged proposal with the Save it reverses", async () => {
    const { window, calls } = await harness();
    await click(window, "#web-stage-html");
    await click(window, '#project-save[data-command="project-save"]');
    // Stage a second edit the host is still holding for review.
    await click(window, "#web-inject-asset");
    expect(calls.filter((call) => call.op === "propose")).toHaveLength(2);
    calls.splice(0);

    const event = shortcut(window, "z");
    await settle(window);
    expect(event.defaultPrevented).toBe(true);
    expect(calls.some((call) => call.op === "undo")).toBe(false);
    expect(element(window, '.overlay[data-overlay="outcome"]').hidden).toBe(false);
    expect(element(window, "[data-outcome-code]").textContent).toBe(
      DESKTOP_PRODUCT_REFUSALS.undoStagedProposal,
    );
    expect(element(window, "[data-project-status]").textContent).toContain(
      DESKTOP_PRODUCT_REFUSALS.undoStagedProposal,
    );

    // The staged proposal survives: saving it still reaches the host's accept.
    await click(window, "#overlay-close-outcome-dismiss");
    await click(window, '#project-save[data-command="project-save"]');
    expect(calls).toContainEqual({ plane: "engine", action: "command", op: "project-save" });
  });

  it("closes an open menu when focus leaves it by keyboard", async () => {
    const { window } = await harness();
    await click(window, '[data-menu-trigger="file"]');
    const panel = element(window, "#menu-panel-file");
    expect(panel.hidden).toBe(false);
    // SAFETY: These selectors read HTML buttons/menu items from renderDesktopChrome in the HappyWindow document, not SVG or foreign-realm nodes.
    const items = [...panel.querySelectorAll('[role="menuitem"]')] as HappyHTMLElement[];
    const last = items[items.length - 1];

    if (last === undefined) throw new Error("File menu rendered no items");
    last.focus();

    const outside = element(window, "#project-open");
    last.dispatchEvent(
      new window.FocusEvent("focusout", { bubbles: true, relatedTarget: outside }),
    );
    expect(panel.hidden).toBe(true);
    expect(element(window, '[data-menu-trigger="file"]').getAttribute("aria-expanded")).toBe(
      "false",
    );
    // Focus went where the browser sent it; the menu must not pull it back.
    expect(window.document.activeElement).not.toBe(
      element(window, '[data-menu-trigger="file"]'),
    );
  });

  it("keeps a menu within its root and closes after the trigger loses focus", async () => {
    const { window } = await harness();
    await click(window, '[data-menu-trigger="file"]');
    const panel = element(window, "#menu-panel-file");
    // SAFETY: These selectors read HTML buttons/menu items from renderDesktopChrome in the HappyWindow document, not SVG or foreign-realm nodes.
    const items = [...panel.querySelectorAll('[role="menuitem"]')] as HappyHTMLElement[];
    const first = items[0];
    const second = items[1];

    if (first === undefined || second === undefined) {
      throw new Error("File menu rendered too few items");
    }

    first.dispatchEvent(
      new window.FocusEvent("focusout", { bubbles: true, relatedTarget: second }),
    );
    expect(panel.hidden).toBe(false);
    // And back to the trigger that owns it, which is still part of the menu.
    second.dispatchEvent(
      new window.FocusEvent("focusout", {
        bubbles: true,
        relatedTarget: element(window, '[data-menu-trigger="file"]'),
      }),
    );
    expect(panel.hidden).toBe(false);
    const trigger = element(window, '[data-menu-trigger="file"]');
    trigger.dispatchEvent(
      new window.FocusEvent("focusout", {
        bubbles: true,
        relatedTarget: element(window, "#project-open"),
      }),
    );
    expect(panel.hidden).toBe(true);
  });

  it("exposes persisted Undo availability after a renderer relaunch", async () => {
    const { window, calls } = await harness("web", "available");
    const undo = element(window, "#menu-command-edit-undo");
    expect(undo.getAttribute("aria-disabled")).toBeNull();

    const event = shortcut(window, "z");
    await settle(window);
    expect(event.defaultPrevented).toBe(true);
    expect(calls).toContainEqual({
      plane: "engine",
      action: "command",
      op: "edit-undo",
    });
    expect(undo.getAttribute("aria-disabled")).toBe("true");
  });

  it("keeps Undo inert while journal recovery is pending", async () => {
    const { window, calls } = await harness("web", "recovery-pending");
    const undo = element(window, "#menu-command-edit-undo");
    expect(undo.getAttribute("aria-disabled")).toBe("true");
    expect(undo.dataset.refusal).toBe(DESKTOP_PRODUCT_REFUSALS.recoveryPending);

    const event = shortcut(window, "z");
    await settle(window);
    expect(event.defaultPrevented).toBe(true);
    expect(calls).toHaveLength(0);
    expect(element(window, "[data-outcome-code]").textContent).toBe(
      DESKTOP_PRODUCT_REFUSALS.recoveryPending,
    );
  });

  it("names the refusal when an accelerator reaches an unavailable command", async () => {
    const { window, calls } = await harness();
    const undo = element(window, "#menu-command-edit-undo");
    expect(undo.getAttribute("aria-disabled")).toBe("true");
    const before = element(window, "[data-project-status]").textContent;

    const event = shortcut(window, "z");
    await settle(window);
    expect(event.defaultPrevented).toBe(true);
    expect(calls).toHaveLength(0);
    expect(element(window, '.overlay[data-overlay="outcome"]').hidden).toBe(false);
    expect(element(window, "[data-outcome-code]").textContent).toBe(
      undo.dataset.refusal,
    );
    // Its reason is the sentence the refusal disclosure prints for that code.
    expect(element(window, "[data-outcome-message]").textContent).toBe(
      element(window, `#refusal-${undo.dataset.refusal}`).textContent?.replace(
        String(undo.dataset.refusal),
        "",
      ).trim(),
    );
    expect(element(window, "[data-project-status]").textContent).toBe(before);

    await click(window, "#overlay-close-outcome-dismiss");
    expect(element(window, '.overlay[data-overlay="outcome"]').hidden).toBe(true);
  });

  it("names the Kids refusal when an accelerator is pressed on that profile", async () => {
    const { window, calls } = await harness("kids");
    const save = element(window, "#menu-command-project-save");
    expect(save.getAttribute("aria-disabled")).toBe("true");
    shortcut(window, "s");
    await settle(window);
    expect(calls).toHaveLength(0);
    expect(element(window, '.overlay[data-overlay="outcome"]').hidden).toBe(false);
    expect(element(window, "[data-outcome-code]").textContent).toBe(save.dataset.refusal);
  });

  it("ignores a Shift-modified chord that no menu advertises", async () => {
    const { window, calls } = await harness();

    const event = new window.KeyboardEvent("keydown", {
      key: "o",
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    // SAFETY: HappyWindow owns this document body, which is an HTML element in the same DOM realm as the keyboard event.
    (window.document.body as HappyHTMLElement).dispatchEvent(event);
    await settle(window);
    expect(event.defaultPrevented).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("closes an open menu when the click lands outside it", async () => {
    const { window } = await harness();
    await click(window, '[data-menu-trigger="file"]');
    const panel = element(window, "#menu-panel-file");
    expect(panel.hidden).toBe(false);
    element(window, ".viewport-column").click();
    expect(panel.hidden).toBe(true);
    expect(element(window, '[data-menu-trigger="file"]').getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("returns focus to the menu trigger when Escape closes the menu", async () => {
    const { window } = await harness();
    await click(window, '[data-menu-trigger="file"]');
    const trigger = element(window, '[data-menu-trigger="file"]');
    expect(element(window, "#menu-panel-file").contains(window.document.activeElement)).toBe(
      true,
    );

    const escape = new window.KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });

    // SAFETY: The immediately preceding focus assertion establishes the focused HTML dialog control before the Escape event is dispatched.
    (window.document.activeElement as HappyHTMLElement).dispatchEvent(escape);
    expect(element(window, "#menu-panel-file").hidden).toBe(true);
    expect(window.document.activeElement).toBe(trigger);
  });

  it("returns focus to the menu trigger when a menu item is invoked", async () => {
    const { window } = await harness();
    await click(window, '[data-menu-trigger="run"]');
    const trigger = element(window, '[data-menu-trigger="run"]');
    await click(window, "#menu-command-run-play");
    expect(element(window, "#menu-panel-run").hidden).toBe(true);
    expect(window.document.activeElement).toBe(trigger);
  });

  it("moves between menu items with the arrow keys its role advertises", async () => {
    const { window } = await harness();
    await click(window, '[data-menu-trigger="file"]');

    // SAFETY: These selectors read HTML buttons/menu items from renderDesktopChrome in the HappyWindow document, not SVG or foreign-realm nodes.
    const items = [
      ...element(window, "#menu-panel-file").querySelectorAll('[role="menuitem"]'),
    ] as HappyHTMLElement[];

    expect(items.length).toBeGreaterThan(1);
    const first = items[0];
    const second = items[1];
    const last = items[items.length - 1];

    if (first === undefined || second === undefined || last === undefined) {
      throw new Error("File menu rendered no items");
    }

    first.focus();

    const down = new window.KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });

    first.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(window.document.activeElement).toBe(second);

    const up = new window.KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    });

    second.dispatchEvent(up);
    expect(window.document.activeElement).toBe(first);

    const end = new window.KeyboardEvent("keydown", {
      key: "End",
      bubbles: true,
      cancelable: true,
    });

    first.dispatchEvent(end);
    expect(window.document.activeElement).toBe(last);
  });

  it("opens the overlay each status shortcut declares", async () => {
    for (const declared of DESKTOP_OVERLAY_SHORTCUTS) {
      const { window } = await harness();
      await click(window, `#status-overlay-${declared.overlay}`);
      expect(element(window, ".shell").dataset.overlay).toBe(declared.overlay);
      expect(
        element(window, `.overlay[data-overlay="${declared.overlay}"]`).hidden,
      ).toBe(false);
    }
  });

  it("shows and dismisses the real refusal returned by a command", async () => {
    const { window } = await harness();
    Object.defineProperty(window, "sceneaxiDesktopLinux", {
      configurable: true,
      value: {
        request: async () => ({
          ok: false,
          reason: "DESKTOP_SCENE_NOT_COMPOSABLE",
          message: "The active composition is invalid.",
          detail: "scene.json has no composition",
        }),
      },
    });
    shortcut(window, "p");
    await settle(window);
    const outcome = element(window, '.overlay[data-overlay="outcome"]');
    expect(outcome.hidden).toBe(false);
    expect(element(window, "[data-outcome-title]").textContent).toBe("Play refused");
    expect(element(window, "[data-outcome-code]").textContent).toBe(
      "DESKTOP_SCENE_NOT_COMPOSABLE",
    );
    expect(element(window, "[data-outcome-message]").textContent).toBe(
      "scene.json has no composition",
    );
    await click(window, "#overlay-close-outcome-dismiss");
    expect(element(window, '.overlay[data-overlay="outcome"]').hidden).toBe(true);
  });
});
