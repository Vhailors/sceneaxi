import { describe, expect, it } from "vitest";
import {
  DESKTOP_MENU_IDS,
  DESKTOP_MINIMUM_WINDOW,
  DESKTOP_MODE_IDS,
  DESKTOP_REFUSAL_MESSAGES,
  DESKTOP_VISUAL_REFUSALS,
  applyDesktopVisualAction,
  createDesktopVisualState,
  defaultDockTabFor,
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

  it("leaves exactly the panel the selected tab controls visible", () => {
    // The tab strip is built from the model, so the panels must be too: a
    // hardcoded visible panel shows Change Review in `run`, the one mode that
    // has no Changes tab at all.
    for (const mode of DESKTOP_MODE_IDS) {
      const html = render(createDesktopVisualState({ mode }));
      const visible = [...html.matchAll(/data-dock-panel="(\w+)"( hidden)?>/g)]
        .filter((match) => match[2] === undefined)
        .map((match) => match[1]);
      expect(visible, mode).toEqual([defaultDockTabFor(mode)]);
      expect(html, mode).toContain(
        `aria-selected="true" aria-controls="dock-panel-${defaultDockTabFor(mode)}"`,
      );
    }
  });

  it("offers a bulk decision only in a mode that has the Changes tab", () => {
    for (const mode of DESKTOP_MODE_IDS) {
      const html = render(createDesktopVisualState({ mode }));
      const hidden = /data-change-bulk hidden>/.test(html);
      // `run` and `ship` have no Changes tab, so accepting or rejecting the whole
      // queue from their tab strip would decide a queue the mode cannot show.
      expect(hidden, mode).toBe(!dockTabsFor(mode).includes("changes"));
    }
    // Empty still hides it in a mode that does have the tab.
    const decided = applyDesktopVisualAction(createDesktopVisualState(), {
      type: "decide-all-changes",
    });
    expect(render(decided)).toContain("data-change-bulk hidden>");
    // And the script re-applies both conditions when the mode switches.
    const script = /<script>(.*)<\/script>/s.exec(render())?.[1] ?? "";
    expect(script).toContain(`shell.querySelector('.dock-tab[data-value="changes"]')`);
    expect(script).toContain("bulk.hidden = n === 0 || changes === null");
  });

  it("hides what it marks hidden, whatever the layout class says", () => {
    // `.change-row` and `.dock-bulk` declare a display, which outranks the UA
    // sheet's `[hidden]` rule — so every model-driven `hidden` needs this one.
    expect(render()).toContain("[hidden]{display:none !important}");
  });

  it("follows an explicit dock tab rather than the mode default", () => {
    const html = render(createDesktopVisualState({ mode: "build", dockTab: "console" }));
    expect(html).toContain(`data-dock-panel="console">`);
    expect(html).toContain(`data-dock-panel="changes" hidden>`);
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

  it("backs roving tabindex with arrow keys, so a tab is reachable at all", () => {
    // Roving tabindex takes every non-active tab out of the Tab order, so without
    // an arrow-key handler a keyboard-only operator can never select another dock
    // panel — the attributes alone are not the pattern.
    const script = /<script>(.*)<\/script>/s.exec(render())?.[1] ?? "";
    for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
      expect(script).toContain(`'${key}'`);
    }
    expect(script).toContain("moveTab(event)");
    expect(script).toContain(`list.querySelectorAll('[role="tab"]')`);
  });

  it("renders every change decision through a modelled control", () => {
    const view = desktopVisualView(createDesktopVisualState());
    const html = render();
    for (const row of view.changeReview.rows) {
      for (const control of [row.accept, row.reject]) {
        expect(html).toContain(`id="${control.id}" data-kind="${control.kind}"`);
      }
    }
  });

  it("marks the active mode and profile with aria-pressed", () => {
    const html = render(createDesktopVisualState({ mode: "compose", profile: "web" }));
    expect(html).toContain(
      'id="mode-compose" data-kind="view" data-action="mode" data-value="compose" aria-pressed="true"',
    );
    expect(html).toContain(
      '<button type="button" class="profile-chip" data-action="profile" data-value="web" aria-pressed="true"',
    );
  });

  it("renders the mode rail through its modelled controls", () => {
    // The rail was the last group to read `id`/`label`/`active` off the model
    // and drop the control kind with it, which is what let a Kids document
    // render seven live-looking buttons.
    const view = desktopVisualView(createDesktopVisualState());
    const html = render();
    for (const mode of view.modes) {
      expect(html).toContain(
        `id="${mode.control.id}" data-kind="${mode.control.kind}"`,
      );
    }
  });

  it("renders every dock tab and viewport source through its modelled control", () => {
    const view = desktopVisualView(createDesktopVisualState());
    const html = render();
    for (const control of [
      ...view.dockTabs.map((tab) => tab.control),
      ...view.viewport.sources.map((source) => source.control),
    ]) {
      expect(html).toContain(`id="${control.id}" data-kind="${control.kind}"`);
    }
  });

  it("declares the viewport sources inert and names why they cannot switch", () => {
    // They sit in a tablist that controls nothing, because switching what a
    // viewport shows needs a renderer and this surface mounts none.
    const html = render();
    for (const id of ["scene", "game", "sculpt-preview"]) {
      expect(html).toContain(
        `id="viewport-source-${id}" data-kind="inert" aria-disabled="true" data-refusal="${DESKTOP_VISUAL_REFUSALS.noPresentationRuntime}"`,
      );
    }
    expect(html).toContain('aria-selected="true"');
  });

  it("keeps every tablist owning nothing but its tabs", () => {
    // ARIA restricts a tablist's children to tabs, and `moveTab()` enumerates
    // them, so the bulk accept/reject and the spacer stay outside it.
    const html = render();
    for (const [, inner] of html.matchAll(
      /<div class="(?:dock|view)-tablist" role="tablist"[^>]*>(.*?)<\/div>/gs,
    )) {
      const tags = [...(inner ?? "").matchAll(/<button\b[^>]*>/g)].map(([tag]) => tag);
      expect(tags.length).toBeGreaterThan(0);
      for (const tag of tags) expect(tag).toContain('role="tab"');
      expect(inner).not.toContain("dock-bulk");
      expect(inner).not.toContain("spacer");
    }
    expect(html).toContain('<div class="dock-tablist" role="tablist" aria-label="Dock panel">');
    expect(html).toContain('<div class="view-tablist" role="tablist" aria-label="Viewport source">');
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

  it("keeps the viewport's image role off the progress and note subtree", () => {
    // `role="img"` is Children Presentational: anything under it is pruned from
    // the accessibility tree. It belongs on an empty backdrop, not on the box
    // that also holds the live progress region and the two notes.
    const html = render(createDesktopVisualState({ mode: "sculpt", sculpt: "running" }));
    expect(html).toContain('<div class="viewport-backdrop" role="img"');
    expect(html).not.toMatch(/<div class="viewport" [^>]*role="img"/);
    expect(html).toMatch(/<div class="viewport">/);
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
  it("states that nothing is drawn and claims nothing about renderer finality", () => {
    for (const [label, state] of ALL_STATES) {
      const html = render(state);
      expect(html, label).toContain("the viewport is inert and draws no pixels");
      // The archive's "not the final choice" line is stale product copy now that
      // the captain has settled Three as the product presentation core, and the
      // two labels ADR 0017 retired by name never appear either.
      expect(html, label).not.toContain("not the final choice");
      expect(html, label).not.toContain("Experimental Three preview");
      expect(html, label).not.toContain("non-decision");
    }
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

  it("cannot enter a mode from behind the Kids refusal, in the bytes", () => {
    const html = render(createDesktopVisualState({ profile: "kids" }));
    for (const mode of DESKTOP_MODE_IDS) {
      expect(html).toContain(
        `id="mode-${mode}" data-kind="inert" aria-disabled="true" data-refusal="${DESKTOP_VISUAL_REFUSALS.kidsRefuseOnly}"`,
      );
      expect(html).toContain(
        `aria-describedby="refusal-${DESKTOP_VISUAL_REFUSALS.kidsRefuseOnly}"`,
      );
    }
    // The click handler's only guard is `aria-disabled`, so the attribute is what
    // stops a server-rendered Kids document from switching mode.
    const script = /<script>(.*)<\/script>/s.exec(html)?.[1] ?? "";
    expect(script).toContain(`el.getAttribute('aria-disabled') === 'true'`);
    // And the reason resolves: the legend prints the whole closed registry.
    expect(html).toContain(`id="refusal-${DESKTOP_VISUAL_REFUSALS.kidsRefuseOnly}"`);
  });

  it("locks the assistant on Kids and can be reached by a client switch", () => {
    const kids = render(createDesktopVisualState({ profile: "kids" }));
    expect(kids).toContain("The assistant is off on Kids");
    expect(kids).toContain(
      `id="assistant-toggle" data-kind="inert" aria-disabled="true" data-refusal="${DESKTOP_VISUAL_REFUSALS.kidsAssistantDenied}"`,
    );
    // Both bodies ship in every document and the state chooses, so switching
    // profile in the browser cannot leave a live composer under a Kids badge —
    // nor strand the column once the operator switches back.
    for (const [label, state] of ALL_STATES) {
      const html = render(state);
      expect(html, label).toContain("THIRD_PARTY_LLM_DENIED_BY_DEFAULT");
      expect(html, label).toContain('class="assistant-denied"');
      expect(html, label).toContain('class="composer-placeholder"');
      expect(html, label).toContain('id="assistant-close"');
      expect(html, label).toContain(
        '.shell[data-assistant="denied"] .assistant-denied{display:flex}',
      );
      expect(html, label).toContain(
        '.shell[data-assistant="denied"] .assistant-body,\n.shell[data-assistant="denied"] .assistant-composer{display:none}',
      );
    }
    // The switch applies the model's own projection for the profile it lands on.
    const view = desktopVisualView(createDesktopVisualState());
    const script = /<script>(.*)<\/script>/s.exec(render())?.[1] ?? "";
    const tables = JSON.parse(/const T = (\{.*?\});\n/s.exec(render())?.[1] ?? "{}") as {
      assistantByProfile: Record<string, Record<string, string | null>>;
      modeRefusalByProfile: Record<string, string | null>;
    };
    for (const chip of view.profiles) {
      expect(tables.assistantByProfile[chip.id]).toEqual({
        state: chip.assistant.state,
        modelLabel: chip.assistant.modelLabel,
        toggle: chip.assistant.toggle.refusal,
        close: chip.assistant.close.refusal,
        send: chip.assistant.send.refusal,
      });
      expect(tables.modeRefusalByProfile[chip.id]).toBe(chip.refusal);
    }
    expect(script).toContain("setProfile(value)");
    expect(script).toContain("setRefusal(shell.querySelector('#assistant-toggle')");
  });

  it("prints the closed refusal registry, one sentence per code", () => {
    // The legend is the accounting surface for the registry, and it is what every
    // `aria-describedby` resolves to — including one a client switch adds.
    const html = render();
    for (const code of Object.values(DESKTOP_VISUAL_REFUSALS)) {
      expect(html).toContain(
        `id="refusal-${code}"><code>${code}</code> ${DESKTOP_REFUSAL_MESSAGES[code]}`,
      );
    }
    // One code, one sentence: the viewport's own note is not a second wording
    // of DESKTOP_NO_PRESENTATION_RUNTIME in the legend.
    expect(
      html.split(`id="refusal-${DESKTOP_VISUAL_REFUSALS.noPresentationRuntime}"`),
    ).toHaveLength(2);
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
