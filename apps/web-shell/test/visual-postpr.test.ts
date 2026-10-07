import { describe, expect, it } from "vitest";
import { inspectorPageHtml } from "@sceneaxi/web-shell";

const html = inspectorPageHtml("/workspace/" + "long-identity-".repeat(16));

describe("post-PR inspector presentation", () => {
  it("wraps complete paths and diff evidence at narrow widths", () => {
    expect(html).toContain("white-space: pre-wrap; overflow-wrap: anywhere");
    expect(html).toContain("font-variant-numeric: tabular-nums");
    expect(html).toContain("long-identity-".repeat(16));
    expect(html).toContain("min-width: 0");
  });

  it("uses keyboard and pressed feedback while keeping disabled labels readable", () => {
    expect(html).toContain(":is(button,input,select,textarea,a[href],summary,[tabindex]):focus-visible");
    expect(html).toContain("@media (forced-colors: active) { :focus-visible { outline-color: Highlight; } }");
    expect(html).toContain("outline: 2px solid currentColor");
    expect(html).toContain("button:not(:disabled):active");
    expect(html).toContain("button[disabled] { cursor: not-allowed; border-style: dashed; }");
    expect(html).not.toContain("opacity: .45");
  });

  it("separates refusal details with dark-preference danger paint", () => {
    expect(html).toContain("#note:not(:empty)");
    expect(html).toContain("@media (prefers-color-scheme: dark) { .refused { color: #FF4D5E; } }");
    expect(html).toContain("background: Canvas; color: CanvasText");
    expect(html).toContain('id="note" role="status" aria-live="polite"');
  });

  it("keeps empty diff wells visible without inventing a result", () => {
    expect(html).toContain("pre:empty { min-height: 3rem; border-style: dashed; }");
    expect(html).toContain('pre[aria-busy="true"] { border-inline-start-width: 3px; }');
    expect(html).toContain("tab-size: 2; line-height: 1.65");
    expect(html).toContain("code { overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }");
    expect(html).toContain(":user-invalid { border-color: #FF4D5E; }");
  });

  it("ships every commit-yellow fill together with its commit-edge line (pending plate contract)", () => {
    expect(html.match(/[^{}]+\{[^{}]*background: var\(--commit\)[^{}]*\}/g)?.filter((rule) => !rule.includes("var(--commit-edge)")) ?? ["no commit fill rule"]).toEqual([]);
  });
});
