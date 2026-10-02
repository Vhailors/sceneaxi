import { describe, expect, it } from "vitest";
import { type HTMLElement as HappyHTMLElement } from "happy-dom";
import { DESKTOP_PALETTE_SHORTCUT } from "@sceneaxi/desktop-shell";
import {
  commandHarness as harness,
  commandElement as element,
  shortcut,
  tab,
} from "../helpers/desktop-chrome-golden.js";

describe("desktop command palette", () => {
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
});
