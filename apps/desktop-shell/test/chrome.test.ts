import { describe, expect, it } from "vitest";
import {
  DESKTOP_MENU_IDS,
  DESKTOP_MINIMUM_WINDOW,
  DESKTOP_MODE_IDS,
  DESKTOP_REFUSAL_MESSAGES,
  DESKTOP_VISUAL_REFUSALS,
  applyDesktopVisualAction,
  createDesktopVisualState,
  desktopVisualView,
  dockTabsFor,
  escapeHtml,
  renderDesktopChrome,
  type DesktopVisualState,
} from "@sceneaxi/desktop-shell";

/**
 * The emitted Engine Desktop document (sceneaxi#158).
 *
 * The document is the evidence artifact — a browser opens exactly these bytes —
 * so what is asserted here is what a screenshot cannot show: that it is
 * self-contained, that its controls are reachable and labelled, that an inert
 * control still announces why, and that no state can render a claim the model
 * refused.
 */

const render = (state: DesktopVisualState = createDesktopVisualState()): string =>
  renderDesktopChrome(desktopVisualView(state));

const ALL_STATES: ReadonlyArray<readonly [string, DesktopVisualState]> = [
  ...DESKTOP_MODE_IDS.map(
    (mode) => [`mode:${mode}`, createDesktopVisualState({ mode })] as const,
  ),
  ["profile:web", createDesktopVisualState({ profile: "web" })],
  ["profile:kids", createDesktopVisualState({ profile: "kids" })],
  ["overlay:palette", createDesktopVisualState({ overlay: "palette" })],
  ["overlay:refused", createDesktopVisualState({ overlay: "refused" })],
  ["overlay:conflict", createDesktopVisualState({ overlay: "conflict" })],
  ["assistant:closed", createDesktopVisualState({ assistant: "closed" })],
  [
    "sculpt:running",
    createDesktopVisualState({ mode: "sculpt", sculpt: "running" }),
  ],
  [
    "window:minimum",
    createDesktopVisualState({ window: { width: 800, height: 560 } }),
  ],
];

describe("engine desktop chrome — document shape", () => {
  it("emits one complete, dark, generator-labelled document", () => {
    const html = render();
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
    expect(html).toContain('<html lang="en"');
    expect(html).toContain('name="color-scheme" content="dark"');
    expect(html).toContain('content="@sceneaxi/desktop-shell chrome"');
  });

  it("requests nothing over the network from any state", () => {
    for (const [label, state] of ALL_STATES) {
      const html = render(state);
      // No remote asset of any kind: the document opens offline, from a file.
      expect(html, label).not.toMatch(/https?:\/\//);
      expect(html, label).not.toMatch(/<link\b/);
      expect(html, label).not.toMatch(/\bsrc=/);
      expect(html, label).not.toMatch(/@import/);
      expect(html, label).not.toMatch(/url\(/);
    }
  });

  it("is byte-identical for the same state", () => {
    const state = createDesktopVisualState({ mode: "ship", profile: "web" });
    expect(render(state)).toBe(render(state));
  });

  it("declares its archive provenance and that it drew nothing", () => {
    const html = render();
    expect(html).toContain(
      "ad5d6e39215a4aee9c81b827308fc944784719168d3fba2db5d9e5ef8fc15159",
    );
    expect(html).toContain('name="sceneaxi-pixels-drawn" content="false"');
  });
});

describe("engine desktop chrome — escaping", () => {
  it("escapes every HTML metacharacter", () => {
    expect(escapeHtml(`<script>"x" & 'y'</script>`)).toBe(
      "&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;",
    );
  });

  it("cannot be closed early by a hostile selection name", () => {
    const html = render(
      createDesktopVisualState({ selection: `</script><img onerror=1>` }),
    );
    expect(html).not.toContain("<img onerror");
    expect(html.match(/<script>/g)).toHaveLength(1);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });
});

describe("engine desktop chrome — regions and modes", () => {
  it("carries all seven mode panels so the rail can switch without a reload", () => {
    const html = render();
    for (const mode of DESKTOP_MODE_IDS) {
      expect(html).toContain(`data-mode-panel="${mode}"`);
      expect(html).toContain(`data-action="mode" data-value="${mode}"`);
    }
  });

  it("shows only the active mode's panels in the emitted bytes", () => {
    const html = render(createDesktopVisualState({ mode: "ship" }));
    // The active panel is not hidden; the others are.
    expect(html).toContain(`data-mode-panel="ship" aria-label="TARGETS">`);
    expect(html).toMatch(/data-mode-panel="run"[^>]*hidden/);
  });

  it("renders the dock tabs the active mode has, and no others", () => {
    for (const mode of DESKTOP_MODE_IDS) {
      const html = render(createDesktopVisualState({ mode }));
      const rendered = [...html.matchAll(/data-action="dock-tab" data-value="(\w+)"/g)]
        .map((match) => match[1]);
      expect(rendered, mode).toEqual([...dockTabsFor(mode)]);
    }
  });

  it("serializes the dock-tab table the script reads, matching the model", () => {
    const html = render();
    const match = /const T = (\{.*?\});\n/s.exec(html);
    expect(match).not.toBeNull();
    const tables = JSON.parse(match?.[1] ?? "{}") as {
      dockTabsByMode: Record<string, string[]>;
      dockHeightByMode: Record<string, number>;
    };
    for (const mode of DESKTOP_MODE_IDS) {
      expect(tables.dockTabsByMode[mode]).toEqual([...dockTabsFor(mode)]);
    }
    expect(tables.dockHeightByMode["animate"]).toBe(252);
    expect(tables.dockHeightByMode["build"]).toBe(228);
  });

  it("opens the requested overlay in the bytes, so a screenshot needs no script", () => {
    const palette = render(createDesktopVisualState({ overlay: "palette" }));
    expect(palette).toContain(`data-overlay="palette" role="dialog" aria-modal="true" aria-label="Command palette">`);
    expect(palette).toMatch(/data-overlay="conflict"[^>]*hidden/);
    const none = render();
    expect(none).toMatch(/data-overlay="palette"[^>]*hidden/);
  });
});

describe("engine desktop chrome — accessibility", () => {
  it("uses landmarks rather than anonymous divs for every region", () => {
    const html = render();
    for (const landmark of [
      "<header class=\"title-bar\">",
      "<nav class=\"menu-bar\"",
      "<nav class=\"mode-rail\"",
      "<aside class=\"left-dock\"",
      "<aside class=\"inspector\"",
      "<aside class=\"assistant\"",
      "<footer class=\"status-bar\">",
    ]) {
      expect(html).toContain(landmark);
    }
  });

  it("labels every landmark", () => {
    const html = render();
    for (const label of [
      'aria-label="Application menu"',
      'aria-label="Profile"',
      'aria-label="Editor mode"',
      'aria-label="Scene and library"',
      'aria-label="Inspector"',
      'aria-label="Assistant"',
      'aria-label="Dock"',
    ]) {
      expect(html).toContain(label);
    }
  });

  it("makes every control a real button, so keyboard order is the DOM order", () => {
    for (const [label, state] of ALL_STATES) {
      const html = render(state);
      // Nothing is a clickable div: no interactive element outside <button>.
      expect(html, label).not.toMatch(/<div[^>]*onclick/i);
      expect(html, label).not.toMatch(/<span[^>]*onclick/i);
      // Every button declares its type, so none submits a form by accident.
      const buttons = html.match(/<button\b[^>]*>/g) ?? [];
      expect(buttons.length, label).toBeGreaterThan(0);
      for (const button of buttons) {
        expect(button, `${label} ${button}`).toContain('type="button"');
      }
    }
  });

  it("keeps an inert control focusable and pointed at its reason", () => {
    const html = render();
    // `disabled` would remove the focus stop; `aria-disabled` keeps it.
    expect(html).not.toMatch(/<button[^>]*\sdisabled[\s>]/);
    const inert = [...html.matchAll(/<button[^>]*aria-disabled="true"[^>]*>/g)];
    expect(inert.length).toBeGreaterThan(0);
    for (const [tag] of inert) {
      expect(tag).toMatch(/aria-describedby="refusal-[A-Z_]+"/);
    }
    // Every referenced reason exists as an element in the same document.
    for (const [, code] of html.matchAll(/aria-describedby="refusal-([A-Z_]+)"/g)) {
      expect(html).toContain(`id="refusal-${code}"`);
    }
  });

  it("gives every element a unique, well-formed id", () => {
    // An `aria-describedby` / `getElementById` reference is only meaningful if
    // the id is unique and contains no whitespace, so the id has to come from a
    // declared identity rather than from display text.
    for (const [label, state] of ALL_STATES) {
      const ids = [...render(state).matchAll(/\sid="([^"]*)"/g)].map(
        ([, id]) => id ?? "",
      );
      expect(ids.length, label).toBeGreaterThan(0);
      expect(ids.filter((id) => /[\s"']/.test(id) || id.length === 0), label).toEqual([]);
      expect(new Set(ids).size, label).toBe(ids.length);
    }
  });

  it("gives the menu bar its own reason, not the viewport's", () => {
    const html = render();
    for (const id of DESKTOP_MENU_IDS) {
      expect(html).toContain(
        `id="menu-${id}" data-kind="inert" aria-disabled="true" data-refusal="${DESKTOP_VISUAL_REFUSALS.verbNotOnDesktop}"`,
      );
    }
    // The viewport's reason describes the viewport; a menu must not borrow it.
    expect(html).not.toContain(
      `id="menu-file" data-kind="inert" aria-disabled="true" data-refusal="${DESKTOP_VISUAL_REFUSALS.noPresentationRuntime}"`,
    );
  });

  it("gives every tablist a selected tab and roving tabindex", () => {
    const html = render();
    expect(html).toContain('role="tablist"');
    const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map(([tag]) => tag);
    expect(tabs.length).toBeGreaterThan(0);
    expect(tabs.filter((tag) => tag.includes('aria-selected="true"')).length)
      .toBeGreaterThanOrEqual(2);
    for (const tag of tabs) {
      expect(tag).toMatch(/tabindex="(0|-1)"/);
    }
  });

  it("marks the active mode and profile with aria-pressed", () => {
    const html = render(createDesktopVisualState({ mode: "compose", profile: "web" }));
    expect(html).toContain(
      '<button type="button" class="rail-mode" data-action="mode" data-value="compose" aria-pressed="true"',
    );
    expect(html).toContain(
      '<button type="button" class="profile-chip" data-action="profile" data-value="web" aria-pressed="true"',
    );
  });

  it("gives every decision button an accessible name naming its pointer", () => {
    const html = render();
    expect(html).toContain(
      'aria-label="Accept /scene/objects/field_drone/position"',
    );
    expect(html).toContain(
      'aria-label="Reject /scene/objects/field_drone/position"',
    );
  });

  it("backs aria-modal with a real focus trap and a focus restore", () => {
    const html = render(createDesktopVisualState({ overlay: "palette" }));
    expect(html).toContain('aria-modal="true"');
    const script = /<script>(.*)<\/script>/s.exec(html)?.[1] ?? "";
    // aria-modal tells assistive tech the rest of the document is inert, so Tab
    // must not walk out of the dialog and the opener must get focus back.
    expect(script).toContain("event.key !== 'Tab'");
    expect(script).toContain("event.preventDefault()");
    expect(script).toContain("overlayReturn");
    // Escape still closes, and the handler is on the document so a lost focus
    // cannot swallow it.
    expect(script).toContain("document.addEventListener('keydown'");
    expect(script).toContain("event.key === 'Escape'");
  });

  it("respects prefers-reduced-motion", () => {
    const html = render();
    expect(html).toContain("@media (prefers-reduced-motion:reduce)");
    expect(html).toMatch(/prefers-reduced-motion:reduce\)\{[^}]*animation-duration:\.001ms/);
  });

  it("shows a visible focus ring on the accent", () => {
    expect(render()).toContain(":focus-visible{outline:2px solid var(--accent)");
  });

  it("announces live regions for progress and refusals", () => {
    expect(render(createDesktopVisualState({ mode: "sculpt", sculpt: "running" })))
      .toContain('role="progressbar"');
    expect(render(createDesktopVisualState({ profile: "kids" })))
      .toContain('class="profile-refusal" role="alert"');
    expect(render(createDesktopVisualState({ window: { width: 800, height: 560 } })))
      .toContain('class="window-refusal" role="alert"');
  });
});

describe("engine desktop chrome — responsive strategy", () => {
  it("declares one breakpoint per undocking tier", () => {
    const html = render();
    expect(html).toContain("@media (max-width:1439px)");
    expect(html).toContain("@media (max-width:1179px)");
    // The refusal breakpoint is derived from the model's own minimum, so raising
    // DESKTOP_MINIMUM_WINDOW moves the stylesheet with it rather than leaving a
    // literal behind.
    expect(html).toContain(
      `@media (max-width:${DESKTOP_MINIMUM_WINDOW.width - 1}px),(max-height:${DESKTOP_MINIMUM_WINDOW.height - 1}px)`,
    );
  });

  it("gives every undocked column an opener", () => {
    const html = render();
    for (const drawer of ["left", "inspector"]) {
      expect(html).toContain(`data-action="drawer" data-value="${drawer}"`);
      expect(html).toContain(`aria-controls="${drawer === "left" ? "left-dock" : "inspector"}"`);
    }
    // The assistant's opener is the toggle it already had.
    expect(html).toContain('data-action="assistant"');
    expect(html).toContain('id="left-dock"');
    expect(html).toContain('id="inspector"');
  });

  it("scales nothing with a transform — the archive's fixed stage is gone", () => {
    const html = render();
    expect(html).not.toContain("transform:scale(");
    expect(html).not.toContain("width:1680px");
  });
});

describe("engine desktop chrome — honesty", () => {
  it("prints the held renderer note beside a statement that nothing is drawn", () => {
    const html = render();
    expect(html).toContain("Preview renderer is experimental — not the final choice");
    expect(html).toContain("the viewport is inert and draws no pixels");
    // The labels ADR 0017 retired for product presentation copy never appear.
    expect(html).not.toContain("Experimental Three preview");
    expect(html).not.toContain("non-decision");
  });

  it("never invents a digest, a byte size, a frame rate, or a timing", () => {
    for (const [label, state] of ALL_STATES) {
      const html = render(state);
      expect(html, label).not.toMatch(/\b[0-9a-f]{4}…[0-9a-f]{4}\b/);
      expect(html, label).not.toMatch(/\b\d+(\.\d+)?\s?(MB|KB|GB)\b/);
      expect(html, label).not.toMatch(/\b\d+\s?fps\b/i);
      expect(html, label).not.toMatch(/\b\d+\s?(tris|triangles|draws)\b/i);
      // The archive's fabricated evidence rows and artifact list stay out.
      expect(html, label).not.toContain("artifacts/depot.zip");
      expect(html, label).not.toContain("harbour-depot");
    }
  });

  it("says on the Change Review surface that a decision writes nothing", () => {
    const html = render();
    expect(html).toContain("no document is written and nothing reaches");
    expect(html).toContain("authoring-core");
  });

  it("replaces the whole editor body on the refuse-only profile", () => {
    const html = render(createDesktopVisualState({ profile: "kids" }));
    expect(html).toContain("No editor on the Kids profile");
    expect(html).toContain(DESKTOP_VISUAL_REFUSALS.kidsRefuseOnly);
    expect(html).toContain("@sceneaxi/profile-kids");
    expect(html).toContain("THIRD_PARTY_LLM_DENIED_BY_DEFAULT");
    // The refusal region is emitted in every document and shown by a CSS rule,
    // so a browser-side profile switch cannot walk around it.
    expect(render()).toContain('class="profile-refusal"');
    expect(html).toContain('.shell[data-profile="kids"] .profile-refusal{display:grid}');
  });

  it("renders the window refusal in the same document, at the same size", () => {
    const minimum = `${DESKTOP_MINIMUM_WINDOW.width}×${DESKTOP_MINIMUM_WINDOW.height}`;
    const html = render(createDesktopVisualState({ window: { width: 800, height: 560 } }));
    expect(html).toContain("Window below the minimum size");
    expect(html).toContain(minimum);
    expect(html).toContain(DESKTOP_VISUAL_REFUSALS.windowBelowMinimum);
  });

  it("prints the model's own minimum and sentence in every render, not a copy", () => {
    // The block is always emitted but the view's refusal is null above the
    // breakpoint, so the common case is exactly where a hardcoded fallback
    // would go stale against DESKTOP_MINIMUM_WINDOW.
    const html = render();
    expect(html).toContain(
      `${DESKTOP_MINIMUM_WINDOW.width}×${DESKTOP_MINIMUM_WINDOW.height}`,
    );
    expect(html).toContain(
      DESKTOP_REFUSAL_MESSAGES[DESKTOP_VISUAL_REFUSALS.windowBelowMinimum],
    );
    expect(html).toContain(DESKTOP_VISUAL_REFUSALS.windowBelowMinimum);
  });

  it("keeps the palette honest about which rows this surface can drive", () => {
    const html = render(createDesktopVisualState({ overlay: "palette" }));
    expect(html).toContain("sceneaxi project dev");
    expect(html).toContain("Rows this shell has no command for stay inert and say so.");
    expect(html).toContain(DESKTOP_VISUAL_REFUSALS.verbNotOnDesktop);
  });

  it("never renders a control kind the model did not assign", () => {
    for (const [label, state] of ALL_STATES) {
      for (const [, kind] of render(state).matchAll(/data-kind="(\w+)"/g)) {
        expect(["view", "review", "inert"], label).toContain(kind);
      }
    }
  });

  it("keeps the same decisions after a state transition", () => {
    const decided = applyDesktopVisualAction(createDesktopVisualState(), {
      type: "decide-all-changes",
    });
    const html = render(decided);
    expect(html).toContain("Nothing waiting for review");
    // Every fixture row is present but hidden, so the script can re-show none of
    // them without the model saying so.
    expect((html.match(/class="change-row"/g) ?? []).length).toBe(3);
    expect((html.match(/class="change-row" data-change-index="\d+" hidden/g) ?? []).length)
      .toBe(3);
  });
});
