/** Semantic interaction coverage for the truthful desktop command registry. */
import { afterEach, describe, expect, it } from "vitest";
import {
  Window as HappyWindow,
  type HTMLElement as HappyHTMLElement,
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

function engineResponse(
  request: Record<string, unknown>,
  state: { undoAvailable: boolean },
) {
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
        undoAvailable: state.undoAvailable,
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
    state.undoAvailable = true;
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
    state.undoAvailable = false;
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

async function harness(
  profile: "game" | "web" | "kids" = "web",
  initialUndoAvailable = false,
) {
  const window = new HappyWindow({ width: 1200, height: 800 });
  windows.push(window);
  const calls: HostCall[] = [];
  const state = { undoAvailable: initialUndoAvailable };
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
    expect(element(window, '.overlay[data-overlay="palette"]').hidden).toBe(false);
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
    expect(element(window, '.overlay[data-overlay="palette"]').hidden).toBe(false);
  });

  it("contains focus in the palette even when every row is inert", async () => {
    // The refuse-only profile demotes every operation row, so a trap built from
    // the actionable rows alone would contain nothing at all and let Tab walk
    // the document behind an `aria-modal` dialog.
    const { window } = await harness("kids");
    shortcut(window, DESKTOP_PALETTE_SHORTCUT.key);
    const palette = element(window, '.overlay[data-overlay="palette"]');
    expect(palette.hidden).toBe(false);
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
    expect(calls).toContainEqual({ plane: "engine", action: "authoring", op: "accept" });
  });

  it("closes an open menu when focus leaves it by keyboard", async () => {
    const { window } = await harness();
    await click(window, '[data-menu-trigger="file"]');
    const panel = element(window, "#menu-panel-file");
    expect(panel.hidden).toBe(false);
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
    const { window, calls } = await harness("web", true);
    const undo = element(window, "#menu-command-edit-undo");
    expect(undo.getAttribute("aria-disabled")).toBeNull();

    const event = shortcut(window, "z");
    await settle(window);
    expect(event.defaultPrevented).toBe(true);
    expect(calls).toContainEqual({
      plane: "engine",
      action: "authoring",
      op: "undo",
    });
    expect(undo.getAttribute("aria-disabled")).toBe("true");
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
      key: "z",
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    (window.document.body as unknown as HappyHTMLElement).dispatchEvent(event);
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
    (window.document.activeElement as unknown as HappyHTMLElement).dispatchEvent(escape);
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
