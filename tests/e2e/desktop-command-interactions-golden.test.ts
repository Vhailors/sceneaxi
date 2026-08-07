/** Semantic interaction coverage for the truthful desktop command registry. */
import { afterEach, describe, expect, it } from "vitest";
import {
  Window as HappyWindow,
  type HTMLElement as HappyHTMLElement,
} from "happy-dom";
import {
  DESKTOP_INTERACTION_COMMANDS,
  DESKTOP_PALETTE_SHORTCUT,
  createDesktopVisualState,
  desktopVisualView,
  renderDesktopChrome,
  type DesktopInteractionCommand,
} from "@sceneaxi/desktop-shell";

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

function projectStatus() {
  return {
    active: ACTIVE_PROJECT,
    recents: [ACTIVE_PROJECT],
    recovery: null,
  };
}

function engineResponse(request: Record<string, unknown>) {
  const payload = request["payload"] as Record<string, unknown> | undefined;
  const action = request["action"];
  const op = payload?.["op"];
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
        data: { entities: [] },
      },
    };
  }
  if (action === "authoring" && op === "propose") {
    return {
      ok: true,
      action,
      data: {
        phase: "reviewing",
        diagnostics: null,
        journalRecoveryPending: false,
      },
    };
  }
  if (action === "authoring" && op === "accept") {
    return {
      ok: true,
      action,
      data: {
        phase: "applied",
        diagnostics: null,
        journalRecoveryPending: false,
        appliedPaths: ["scene.json"],
      },
    };
  }
  if (action === "authoring" && op === "undo") {
    return {
      ok: true,
      action,
      data: { ok: true, restoredPaths: ["scene.json"] },
    };
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
    if (turn >= 10 && window.document.querySelector("[data-busy]") === null) return;
  }
  throw new Error("desktop command did not settle");
}

async function harness() {
  const window = new HappyWindow({ width: 1200, height: 800 });
  windows.push(window);
  const calls: HostCall[] = [];
  const clone = <T>(value: T): T => window.eval(`(${JSON.stringify(value)})`) as T;
  Object.defineProperty(window, "structuredClone", { value: clone });
  Object.defineProperty(window, "sceneaxiDesktopLinux", {
    configurable: true,
    value: {
      project: async (request: unknown) => {
        const typed = clone(request) as Record<string, unknown>;
        const action = String(typed["action"]);
        calls.push({ plane: "project", action, op: null });
        if (action === "status") {
          return clone({ ok: true, data: { status: projectStatus() } });
        }
        return clone({
          ok: true,
          data: {
            outcome: action === "choose-new" ? "created" : "opened",
            status: projectStatus(),
          },
        });
      },
      request: async (request: unknown) => {
        const typed = clone(request) as Record<string, unknown>;
        const payload = typed["payload"] as Record<string, unknown> | undefined;
        calls.push({
          plane: "engine",
          action: String(typed["action"]),
          op: typeof payload?.["op"] === "string" ? payload["op"] : null,
        });
        return clone(engineResponse(typed));
      },
    },
  });

  const html = renderDesktopChrome(
    desktopVisualView(createDesktopVisualState({ profile: "web" })),
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
  await settle(window);
  calls.splice(0);
  return { window, calls };
}

function element(window: HappyWindow, selector: string) {
  const found = window.document.querySelector(selector) as HappyHTMLElement | null;
  if (found === null) throw new Error(`missing command control ${selector}`);
  return found;
}

async function click(window: HappyWindow, selector: string) {
  element(window, selector).click();
  await settle(window);
}

function shortcut(window: HappyWindow, key: string, target?: HappyHTMLElement) {
  const event = new window.KeyboardEvent("keydown", {
    key,
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  (target ?? (window.document.body as unknown as HappyHTMLElement)).dispatchEvent(event);
  return event;
}

async function prepare(command: DesktopInteractionCommand, window: HappyWindow) {
  if (command.id === "project-save" || command.id === "edit-undo") {
    await click(window, "#web-stage-html");
  }
  if (command.id === "edit-undo") {
    await click(window, '#project-save[data-command="project-save"]');
  }
}

function expectedEffect(command: DesktopInteractionCommand) {
  switch (command.id) {
    case "project-new":
      return { plane: "project", action: "choose-new", op: null } as const;
    case "project-open":
      return { plane: "project", action: "choose-open", op: null } as const;
    case "project-save":
      return { plane: "engine", action: "authoring", op: "accept" } as const;
    case "edit-undo":
      return { plane: "engine", action: "authoring", op: "undo" } as const;
    case "run-play":
      return { plane: "engine", action: "open-path", op: null } as const;
  }
}

async function invoke(
  path: "menu" | "palette" | "shortcut",
  command: DesktopInteractionCommand,
) {
  const { window, calls } = await harness();
  await prepare(command, window);
  calls.splice(0);

  if (path === "menu") {
    await click(window, `[data-menu-trigger="${command.menu}"]`);
    await click(window, `#menu-command-${command.id}`);
  } else if (path === "palette") {
    shortcut(window, DESKTOP_PALETTE_SHORTCUT.key);
    expect(element(window, '[data-overlay="palette"]').hidden).toBe(false);
    await click(window, `#palette-${command.id}`);
  } else {
    if (command.key === null) throw new Error(`${command.id} has no accelerator`);
    const event = shortcut(window, command.key);
    expect(event.defaultPrevented).toBe(true);
    await settle(window);
  }

  expect(calls).toContainEqual(expectedEffect(command));
  if (command.id === "run-play") {
    expect(element(window, ".shell").dataset.mode).toBe("run");
    expect(element(window, "[data-project-status]").textContent).toContain(
      "Played composed scene",
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
        const { window, calls } = await harness();
        await prepare(command, window);
        calls.splice(0);
        const input = window.document.createElement("input") as unknown as HappyHTMLElement;
        element(window, ".shell").append(input);
        const event = shortcut(window, command.key, input);
        await settle(window);
        expect(event.defaultPrevented).toBe(false);
        expect(calls).not.toContainEqual(expectedEffect(command));
      });
    }
  }

  it("opens the palette with Ctrl/Cmd+K even from text entry", async () => {
    const { window } = await harness();
    const input = window.document.createElement("input") as unknown as HappyHTMLElement;
    element(window, ".shell").append(input);
    const event = shortcut(window, DESKTOP_PALETTE_SHORTCUT.key, input);
    expect(event.defaultPrevented).toBe(true);
    expect(element(window, '[data-overlay="palette"]').hidden).toBe(false);
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
    const outcome = element(window, '[data-overlay="outcome"]');
    expect(outcome.hidden).toBe(false);
    expect(element(window, "[data-outcome-title]").textContent).toBe("Play refused");
    expect(element(window, "[data-outcome-code]").textContent).toBe(
      "DESKTOP_SCENE_NOT_COMPOSABLE",
    );
    expect(element(window, "[data-outcome-message]").textContent).toBe(
      "scene.json has no composition",
    );
    await click(window, "#overlay-close-outcome-dismiss");
    expect(element(window, '[data-overlay="outcome"]').hidden).toBe(true);
  });
});
