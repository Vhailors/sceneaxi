import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createDesktopVisualState,
  desktopVisualView,
  renderDesktopChrome,
} from "@sceneaxi/desktop-shell";

const driver = new URL("./visual-postpr-evidence/retry/capture.mjs", import.meta.url);

function cssRule(html: string, selector: string): string {
  const start = html.indexOf(`${selector}{`);
  expect(start, `Missing layout rule ${selector}`).toBeGreaterThanOrEqual(0);

  return html.slice(start, html.indexOf("}", start) + 1);
}

describe("desktop catalogue keyboard geometry contract (browser acceptance separate)", () => {
  for (const window of [
    { width: 900, height: 640 },
    { width: 1100, height: 800 },
    { width: 1280, height: 900 },
  ]) {
    const html = renderDesktopChrome(desktopVisualView(createDesktopVisualState({ window })));
    it(`keeps catalogue controls on separate intrinsic rows at ${window.width}`, () => {
      expect(cssRule(html, ".scene-catalog-editor")).toContain("display:grid");
      expect(cssRule(html, ".scene-catalog-editor label")).toContain("display:grid");
      expect(cssRule(html, ".scene-catalog-editor textarea")).toContain("width:100%");
      expect(cssRule(html, ".scene-catalog-editor textarea")).toContain("min-width:0");
      expect(cssRule(html, ".inspector > section")).toContain("flex-shrink:0");
      expect(cssRule(html, ".left-dock,.inspector")).toContain("overflow-y:auto");
      expect(html).toMatch(/<textarea[^>]*id="effect-mutation"[^>]*>[\s\S]*?<\/textarea>/);
      expect(html).toMatch(/<button[^>]*id="effect-stage"[^>]*>/);
    });
    it(`preserves unavailable stops and real outcome diagnostics at ${window.width}`, () => {
      const inert = [...html.matchAll(/<(?:button|textarea|input|select)\b[^>]*aria-disabled="true"[^>]*>/g)];
      expect(inert.length).toBeGreaterThan(0);

      for (const [tag] of inert) {
        expect(tag).not.toMatch(/\sdisabled(?:[\s=>])/);
        const description = /aria-describedby="([^"]+)"/.exec(tag)?.[1];
        expect(description).toBeTruthy();

        for (const id of description?.split(/\s+/) ?? []) {
          expect(html.split(`id="${id}"`).length - 1).toBe(1);
          expect(html).toMatch(new RegExp(`id="${id}"[^>]*><code>[^<]+</code> \\S`));
        }
      }

      expect(html).toContain("data-outcome-code");
      expect(html).toContain("data-outcome-message");
      expect(html).toContain("Project lifecycle refused");
      expect(html).toContain("data-action=\"overlay\" data-value=\"none\"");
    });
  }

  it("executes the browser driver's positive and hostile geometry oracle without a browser", () => {
    expect(readFileSync(driver, "utf8")).toContain("--oracle-self-test");
    const output = execFileSync(process.execPath, [fileURLToPath(driver), "--oracle-self-test"], { encoding: "utf8" });
    expect(JSON.parse(output)).toEqual({ status: "PASS", positive: 1, rejected: 18, diagnosticPositive: 1, diagnosticRejected: 4, browser: "NOT_RUN" });
  });

  it("requires real bidirectional effect traversal and nonblank refusal geometry in the driver", () => {
    const source = readFileSync(driver, "utf8");
    expect(source).toContain("assertKeyboardGeometry(sample");
    expect(source).toContain("effect-mutation");
    expect(source).toContain("effect-stage");
    expect(source).toContain("width:1100");
    expect(source).toContain("['Tab','Shift+Tab']");
    expect(source).toContain("assertDiagnosticGeometry");
    expect(source).toContain("Inert activation must not invoke the host");
  });
});
