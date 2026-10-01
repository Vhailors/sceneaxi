import { describe, expect, it } from "vitest";
import { type HTMLElement as HappyHTMLElement } from "happy-dom";
import { DESKTOP_OVERLAY_SHORTCUTS } from "@sceneaxi/desktop-shell";
import {
  commandHarness as harness,
  commandElement as element,
  clickCommand as click,
} from "../helpers/desktop-chrome-golden.js";

describe("desktop command menus and status shortcuts", () => {
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
});
