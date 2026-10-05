import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createDesktopVisualState,
  desktopVisualView,
  renderDesktopChrome,
} from "@sceneaxi/desktop-shell";
import { SPACING } from "../src/visual-tokens.js";

const html = renderDesktopChrome(desktopVisualView(createDesktopVisualState()));

// The renderer is a runtime-only peer: read its CSS without a production import.
const byoSource = readFileSync(
  new URL("../../../desktop/linux/src/renderer/byo-configuration.ts", import.meta.url),
  "utf8",
);

function rule(document: string, selector: string): string {
  const start = document.indexOf(`${selector}{`);

  expect(start, selector).toBeGreaterThanOrEqual(0);

  return document.slice(start, document.indexOf("}", start) + 1);
}

describe("desktop visual refinement invariants", () => {
  it("uses one four-pixel content rhythm without changing structural metrics", () => {
    for (const value of Object.values(SPACING)) {
      expect(value % 4).toBe(0);
    }

    expect(html).toContain("--space-3:12px");
    expect(html).toContain("--rail:56px;--left:274px");
    expect(rule(html, ".panel-head")).toContain("font-size:11px");
    expect(rule(html, ".panel-head")).toContain("height:32px");
  });

  it("makes long identities readable without losing their full text", () => {
    const identity = rule(html, ".scene-entity-identity code");

    expect(identity).toContain("font-size:10px");
    expect(identity).toContain("line-height:1.6");
    expect(identity).toContain("overflow-wrap:anywhere");
    expect(identity).toContain("white-space:normal");
    expect(rule(html, ".scene-entity-identity")).toContain("border-left:2px solid var(--line-card)");
    expect(rule(html, ".scene-entity-identity.is-selected")).toContain("border-color:var(--accent)");
  });

  it("keeps keyboard rings inside clipped rows and clear of filled controls", () => {
    expect(rule(html, ":focus-visible")).toContain("outline:2px solid var(--accent)");
    expect(rule(html, ":focus-visible")).toContain("box-shadow:0 0 0 4px var(--well)");
    expect(rule(html, ".scene-entity-identity:focus-visible")).toContain("outline-offset:-3px");
    expect(rule(html, "\n.palette-item:focus-visible")).toContain("outline-offset:-3px");
    expect(rule(html, ".scene-property-input:focus-visible")).toContain("outline:2px solid var(--accent)");
  });

  it("contains tall assistant controls and wraps unbroken result evidence", () => {
    expect(rule(html, ".assistant-composer")).toContain("max-height:65%");
    expect(rule(html, ".assistant-composer")).toContain("overflow-y:auto");
    expect(rule(html, ".assistant-result")).toContain("overflow-wrap:anywhere");
    expect(rule(html, ".assistant-prompt")).toContain("min-height:72px");
    expect(rule(html, ".assistant-prompt::placeholder")).toContain("color:var(--faint)");
  });

  it("confirms work without painting an animated wash over the viewport", () => {
    expect(html).not.toContain('.shell[data-assistant-busy="true"] .viewport::after');
    expect(rule(html, '.shell[data-assistant-busy="true"] .assistant-progress')).not.toContain("animation");
    expect(rule(html, ".assistant-live i")).toContain("animation:assistant-bars");
    expect(html).toContain("@media (prefers-reduced-motion:reduce)");
  });

  it("keeps disabled BYOK labels readable rather than compositing their opacity", () => {
    const disabled = rule(byoSource, ".desktop-byo-config select:disabled");

    expect(disabled).toContain("color:var(--inert)");
    expect(disabled).not.toContain("opacity");
    expect(rule(byoSource, ".desktop-byo-config button")).toContain("min-height:32px");
    expect(rule(byoSource, ".desktop-byo-config-actions")).toContain("grid-template-columns:minmax(0,1fr) minmax(0,1fr)");
  });

  it("keeps popover rings inset and scroll targets clear of clipped edges", () => {
    expect(rule(html, ":is(.menu-command,.project-files select,.project-recent-select,.assistant-route,.assistant-manipulator):focus-visible")).toContain("outline-offset:-3px");
    expect(html).toContain("scrollbar-gutter:stable;scroll-padding:var(--space-3)");
    expect(html).toContain(':is(button,input,select,textarea,a[href],[tabindex]):focus-visible');
    expect(html).toContain('@media (forced-colors:active){:focus-visible{outline:2px solid Highlight');
    expect(html).toContain('button[aria-pressed="true"],button[aria-selected="true"]{border:1px solid Highlight}');
  });

  it("separates dense evidence rows without abbreviating hashes", () => {
    expect(rule(html, ".scene-entity-identity dl div")).toContain("border-top:1px solid var(--line-row)");
    expect(rule(html, ".scene-entity-identity code")).toContain("user-select:text");
    expect(rule(html, "\n.asset-browser-card span")).toContain("font-size:10px");
    expect(rule(html, ".pass-row:nth-child(even)")).toContain("background:var(--well)");
  });

  it("distinguishes empty guidance, stable work status and returned evidence", () => {
    expect(rule(html, ".panel-empty")).toContain("border:1px dashed var(--line-control)");
    expect(rule(html, ".panel-empty[aria-live]")).toContain("border-style:solid");
    expect(rule(byoSource, ".desktop-byo-config-message:empty")).toContain("display:none");
    expect(rule(byoSource, '.desktop-byo-config-message[role="alert"]')).toContain("border-left-color:var(--refuse)");
    expect(rule(html, ".assistant-empty")).toContain("border:1px dashed var(--line-card)");
    expect(rule(html, ".assistant-progress")).toContain("min-height:44px");
    expect(rule(html, ".assistant-progress")).toContain("overflow-wrap:anywhere");
    expect(rule(html, ".assistant-result")).toContain("border-left:2px solid var(--line-hover)");
    expect(rule(html, ".overlay-refused .overlay-body")).toContain("border-left:2px solid var(--refuse)");
  });

  it("confirms pressed controls without changing inert controls or moving glyphs", () => {
    expect(rule(html, 'button:not(.is-inert):not(:disabled):not([aria-disabled="true"]):active')).toContain("box-shadow:inset");
    expect(rule(html, ".icon-button")).toContain("flex:none");
    expect(rule(html, ".icon-button")).toContain("line-height:1");
    expect(rule(html, ".palette-item kbd")).toContain("white-space:nowrap");
  });

  it("frames BYOK refusal details and keeps reduced-motion feedback still", () => {
    expect(rule(byoSource, ".desktop-byo-config-message")).toContain("border-left:2px solid var(--line-hover)");
    expect(byoSource).toContain(".desktop-byo-config button{transition:none}");
    expect(rule(byoSource, ".desktop-byo-config button:not(:disabled):active")).toContain("box-shadow:inset");
  });
});
