import { describe, expect, it } from "vitest";
import { DESKTOP_MINIMUM_WINDOW } from "../src/visual-model.js";
import { Window } from "happy-dom";
import { createDesktopVisualState, desktopVisualView, renderDesktopChrome } from "../src/index.js";
import { inventoryElement, windows } from "./helpers/desktop-chrome-golden.js";

// Executes the shipped client in a DOM emulator: no browser pixels/native claim.
function harness(size = { width: 1000, height: 700 }) {
  const window = new Window(size);
  windows.push(window);
  const matchMedia = window.matchMedia.bind(window);
  window.matchMedia = (query: string) => {
    const result = matchMedia(query);

    // Happy DOM incorrectly ANDs comma-separated media queries. Supply browser
    // OR semantics from its real single-query evaluator, not a forced result.
    if (query.includes(",")) Object.defineProperty(result, "matches", {
      get: () => query.split(",").some((term) => matchMedia(term.trim()).matches),
    });

    return result;
  };

  const html = renderDesktopChrome(desktopVisualView(createDesktopVisualState()));
  const script = /<script>([\s\S]*?)<\/script>/.exec(html);

  if (!script?.[1]) throw new Error("Missing shipped chrome client");
  window.document.write(html.replace(script[0], ""));
  window.eval(script[1]);
  // Seed Happy DOM's listener state: it initializes previous matches to false
  // even when a listener is first attached at an already-matching viewport.
  window.dispatchEvent(new window.Event("resize"));
  const shell = inventoryElement(window, ".shell");
  const refusal = inventoryElement(window, ".window-refusal");
  const trigger = inventoryElement(window, '[data-menu-trigger="file"]');
  // Happy DOM has no layout. Only the restored trigger's layout port is supplied;
  // the retained control-accounting test independently resolves the actual CSS.
  Object.defineProperty(trigger, "getClientRects", { value: () => [window.document.body.getBoundingClientRect()] });

  const resize = (width: number, height: number) => {
    window.happyDOM.setWindowSize({ width, height });
    // Happy DOM's size setter changes metrics but does not emit a resize event.
    window.dispatchEvent(new window.Event("resize"));
  };

  const refuse = () => resize(DESKTOP_MINIMUM_WINDOW.width - 1, DESKTOP_MINIMUM_WINDOW.height);
  const restore = () => resize(1000, 700);

  return { window, shell, refusal, trigger, resize, refuse, restore };
}

describe("minimum-window refusal client lifecycle (DOM, not pixels)", () => {
  it("focuses the real named refusal when opened below minimum and falls back safely on restore", () => {
    const h = harness({ width: DESKTOP_MINIMUM_WINDOW.width - 1, height: 700 });
    expect(h.shell.dataset["window"]).toBe("refused");
    expect(h.shell.inert).toBe(true);
    expect(h.refusal.textContent).toContain("DESKTOP_WINDOW_BELOW_MINIMUM");
    expect(h.refusal.hidden).toBe(false);
    expect(h.refusal.dataset["window"]).toBe("refused");
    expect(h.window.getComputedStyle(h.refusal).display).toBe("block");
    expect(h.window.document.activeElement).toBe(h.refusal);
    h.restore();
    expect(h.shell.inert).toBe(false);
    expect(h.refusal.hidden).toBe(true);
    expect(h.refusal.dataset["window"]).toBe("ready");
    expect(h.window.getComputedStyle(h.refusal).display).toBe("none");
    expect(h.window.document.activeElement).toBe(h.shell);
  });

  it("does not return focus to a removed opener", () => {
    const h = harness();
    h.trigger.focus(); h.refuse(); h.trigger.remove(); h.restore();
    expect(h.window.document.activeElement).toBe(h.shell);
    expect(h.shell.dataset["overlay"]).toBe("none");
  });

  it("dismisses a menu on refusal and returns to its trigger only after resizing", () => {
    const h = harness();
    h.trigger.focus(); h.trigger.click();
    const panel = inventoryElement(h.window, "#menu-panel-file");
    expect(panel.hidden).toBe(false);
    expect(panel.contains(h.window.document.activeElement)).toBe(true);
    h.refuse();
    expect(h.shell.dataset["window"]).toBe("refused");
    expect(h.shell.inert).toBe(true);
    expect(panel.hidden).toBe(true);
    expect(h.trigger.getAttribute("aria-expanded")).toBe("false");
    expect(h.window.document.activeElement).toBe(h.refusal);
    h.restore();
    expect(h.shell.dataset["window"]).toBe("ready");
    expect(h.shell.inert).toBe(false);
    expect(h.window.document.activeElement).toBe(h.trigger);
    expect(panel.hidden).toBe(true);
  });

  it("dismisses dialogs without reopening them and restores their original opener", () => {
    const h = harness();
    h.trigger.focus();
    h.window.document.dispatchEvent(new h.window.KeyboardEvent("keydown", { key: "k", code: "KeyK", ctrlKey: true, bubbles: true }));
    expect(h.shell.dataset["overlay"]).toBe("palette");
    h.refuse();
    expect(h.shell.dataset["overlay"]).toBe("none");
    expect([...h.shell.querySelectorAll(".overlay")].every((el) => el.hasAttribute("hidden"))).toBe(true);
    expect(h.window.document.activeElement).toBe(h.refusal);

    // Escape cannot dismiss a size refusal; accelerators cannot open a hidden dialog.
    for (const key of ["Escape", "k"]) h.window.document.dispatchEvent(new h.window.KeyboardEvent("keydown", { key, code: key === "k" ? "KeyK" : "Escape", ctrlKey: key === "k", bubbles: true }));
    expect(h.shell.dataset["overlay"]).toBe("none");
    expect(h.window.document.activeElement).toBe(h.refusal);
    h.restore();
    expect(h.window.document.activeElement).toBe(h.trigger);
    expect(h.shell.dataset["overlay"]).toBe("none");
  });

  it("uses either dimension, allows the exact minimum and does not steal moved focus", () => {
    const h = harness();
    h.trigger.focus();
    h.resize(DESKTOP_MINIMUM_WINDOW.width, DESKTOP_MINIMUM_WINDOW.height - 1);
    expect(h.window.document.activeElement).toBe(h.refusal);
    h.resize(DESKTOP_MINIMUM_WINDOW.width, DESKTOP_MINIMUM_WINDOW.height);
    expect(h.shell.dataset["window"]).toBe("ready");
    expect(h.window.document.activeElement).toBe(h.trigger);
    h.refuse();
    const elsewhere = h.window.document.createElement("button");
    h.window.document.body.append(elsewhere); elsewhere.focus();
    h.restore();
    expect(h.window.document.activeElement).toBe(elsewhere);
  });
});
