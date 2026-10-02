import { describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import { icon, iconSprite, type IconId } from "@sceneaxi/desktop-shell";

const IDS = [
  "select", "move", "rotate", "scale", "local", "world", "pivot", "center", "snap",
  "play", "pause", "step", "stop",
  "save", "undo", "redo", "duplicate", "delete", "rename",
  "chevron-right", "chevron-down", "eye", "eye-off", "lock", "unlock", "plus", "more", "search", "filter", "close", "drag-handle",
  "object", "group", "light-directional", "light-point", "light-spot", "camera", "audio", "effect", "behaviour", "prefab",
  "model", "texture", "audio-file", "font", "animation",
  "info", "warning", "error", "ok", "spinner",
  "mark", "send", "attach", "history", "new-chat",
  "grid", "stats", "shading", "perspective", "orthographic", "layout", "settings", "help", "export",
] as const satisfies readonly IconId[];

describe("desktop inline icons", () => {
  it("emits every specified symbol once on a 16-pixel currentColor grid", () => {
    const window = new Window();
    window.document.body.innerHTML = iconSprite();
    const sprite = window.document.querySelector("svg");
    expect(sprite?.hasAttribute("hidden")).toBe(true);
    // SVG does not inherit the HTML user-agent [hidden] display rule.
    expect(sprite?.style.display).toBe("none");
    expect(sprite?.getAttribute("aria-hidden")).toBe("true");
    const symbols = [...window.document.querySelectorAll("symbol")];
    expect(symbols.map((symbol) => symbol.id).sort()).toEqual(IDS.map((id) => `i-${id}`).sort());
    expect(new Set(symbols.map((symbol) => symbol.id)).size).toBe(IDS.length);
    for (const symbol of symbols) {
      expect(symbol.getAttribute("viewBox")).toBe("0 0 16 16");
      expect(symbol.getAttribute("fill")).toBe("none");
      expect(symbol.getAttribute("stroke")).toBe("currentColor");
      expect(symbol.getAttribute("stroke-width")).toBe("1.5");
      expect(symbol.getAttribute("stroke-linecap")).toBe("round");
      expect(symbol.getAttribute("stroke-linejoin")).toBe("round");
      expect(symbol.children.length).toBeGreaterThan(0);
      for (const path of symbol.children) {
        expect(path.tagName).toBe("path");
        expect(path.getAttributeNames()).toEqual(["d"]);
        expect(path.getAttribute("d")).toMatch(/^M[\d .]/);
      }
    }
    window.close();
  });

  it("references local symbols with decorative, non-focusable 16-pixel SVGs", () => {
    const window = new Window();
    window.document.body.innerHTML = iconSprite() + IDS.map((id) => icon(id)).join("");
    const icons = [...window.document.querySelectorAll("svg.icon")];
    expect(icons).toHaveLength(IDS.length);
    for (const [index, svg] of icons.entries()) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
      expect(svg.getAttribute("viewBox")).toBe("0 0 16 16");
      expect(svg.getAttribute("width")).toBe("16");
      expect(svg.getAttribute("height")).toBe("16");
      const href = svg.querySelector("use")?.getAttribute("href");
      expect(href).toBe(`#i-${IDS[index]}`);
      expect(window.document.querySelector(href ?? "missing")?.tagName).toBe("symbol");
    }
    window.close();
  });

  it("ships only self-contained SVG markup with no remote asset or icon font", () => {
    const markup = iconSprite() + IDS.map((id) => icon(id)).join("");
    expect(markup).not.toMatch(/https?:|\/\/|data:|url\(|@font-face|<style|<script|<image|foreignObject|\son\w+=/i);
    const references = [...markup.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
    expect(references).toHaveLength(IDS.length);
    for (const reference of references) expect(reference).toMatch(/^#i-[a-z-]+$/);
    expect(iconSprite()).toBe(iconSprite());
  });
});
