import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import process from "node:process";
import { log } from "node:console";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const require = createRequire(resolve(root, "desktop/linux/package.json"));
const esbuild = require("esbuild");
const { chromium } = createRequire(resolve(root, "sites/umbrella/package.json"))("@playwright/test");
const bundle = await esbuild.build({
  stdin: { contents: `export {renderDesktopChrome} from "${root}/apps/desktop-shell/src/chrome.ts"; export {createDesktopVisualState,desktopVisualView} from "${root}/apps/desktop-shell/src/visual-model.ts";`, resolveDir: root },
  bundle: true, platform: "node", format: "esm", write: false,
});
const { renderDesktopChrome, createDesktopVisualState, desktopVisualView } = await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64"));
const directory = resolve(root, "apps/desktop-shell/test/visual-repair-evidence");
mkdirSync(directory, { recursive: true });
const receipts = { artifact: "current source bundled in memory; not published PR or native GPU", source: {}, assertions: [], failures: [], scenarios: [], cleanup: [] };
for (const path of ["apps/desktop-shell/src/chrome.ts", "apps/desktop-shell/src/visual-model.ts", "apps/desktop-shell/src/visual-tokens.ts", "packages/schemas/src/editor-shell.ts"]) receipts.source[path] = createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
receipts.bundleSha256 = createHash("sha256").update(bundle.outputFiles[0].text).digest("hex");
const check = (condition, assertion, details) => {
  receipts.assertions.push({ assertion, pass: !!condition, details });
  if (!condition) receipts.failures.push({ assertion, details });
};

// This inspects the browser's actual sequential focus target, never locator.focus().
const focusGeometry = () => {
  const el = globalThis.document.activeElement;
  if (!(el instanceof globalThis.HTMLElement) || el === globalThis.document.body) return null;
  const style = globalThis.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const expansion = Math.max(0, parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset));
  const ring = { left: rect.left - expansion, right: rect.right + expansion, top: rect.top - expansion, bottom: rect.bottom + expansion };
  const clippedBy = [];
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    const css = globalThis.getComputedStyle(parent); const box = parent.getBoundingClientRect();
    const left = box.left + parent.clientLeft; const top = box.top + parent.clientTop;
    const right = left + parent.clientWidth; const bottom = top + parent.clientHeight;
    if ((/^(hidden|clip|auto|scroll)$/.test(css.overflowX) && (ring.left < left - 1 || ring.right > right + 1)) ||
        (/^(hidden|clip|auto|scroll)$/.test(css.overflowY) && (ring.top < top - 1 || ring.bottom > bottom + 1))) clippedBy.push(parent.id || parent.className || parent.tagName);
  }
  const points = [[rect.left + 3, rect.top + 3], [rect.right - 3, rect.top + 3], [rect.left + 3, rect.bottom - 3], [rect.right - 3, rect.bottom - 3], [(rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2]];
  const occluded = points.filter(([x,y]) => { const hit = globalThis.document.elementFromPoint(x,y); return hit === null || !(hit === el || el.contains(hit)); });
  const descriptions = (el.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean).map(id => ({ id, text: globalThis.document.getElementById(id)?.textContent?.trim() || "" }));
  return { id: el.id, tag: el.tagName, className: el.className, focusVisible: el.matches(":focus-visible"), outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth,
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, ring, clippedBy, occluded,
    inViewport: ring.left >= -1 && ring.top >= -1 && ring.right <= globalThis.innerWidth + 1 && ring.bottom <= globalThis.innerHeight + 1,
    ariaDisabled: el.getAttribute("aria-disabled"), descriptions, inModal: !!el.closest('.overlay:not([hidden])'), overlay: globalThis.document.querySelector(".shell")?.dataset.overlay };
};

const browser = await chromium.launch({ headless: true, executablePath: process.env.SCENEAXI_CHROMIUM_PATH || "/home/devuser/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome" });
try {
  for (const viewport of [{width:1280,height:900}, {width:900,height:640}, {width:1100,height:720}]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    try {
      const page = await context.newPage(); const errors = []; page.on("pageerror", e => errors.push(e.message));
      const html = renderDesktopChrome(desktopVisualView(createDesktopVisualState({window: viewport, profile: "game", overlay: "none"})));
      await page.setContent(html);
      const row = { viewport, errors, traversal: [], palette: [], refusal: null };
      receipts.scenarios.push(row);
      // Replay the old invalid fixture and prove why its blank PNG was vacuous.
      if (viewport.width === 1280) {
        await page.keyboard.press("Control+k");
        await page.evaluate(() => { globalThis.document.querySelector('[data-overlay="palette"]').hidden = true; globalThis.document.querySelector('[data-overlay="outcome"]').hidden = false; globalThis.document.querySelector('[data-outcome-title]').textContent = "Refusal layout visual fixture"; });
        const invalid = await page.evaluate(() => ({ text: globalThis.document.body.innerText, visible: Array.from(globalThis.document.querySelectorAll("button")).filter(el => {const r=el.getBoundingClientRect();return r.width>0&&r.height>0;}).length }));
        row.invalidHistoricalFixture = invalid;
        check(invalid.text.trim() === "" && invalid.visible === 0, "VD-03 historical direct-DOM fixture independently reproduces blank state", invalid);
        await page.setContent(html);
      }
      const seen = new Set();
      for (let step = 0; step < 240; step++) {
        await page.keyboard.press("Tab");
        const sample = await page.evaluate(focusGeometry);
        if (!sample) continue;
        const key = sample.id || sample.tag + sample.className;
        if (seen.has(key)) break;
        seen.add(key); row.traversal.push(sample);
        check(sample.focusVisible && sample.outlineStyle === "solid" && parseFloat(sample.outlineWidth) >= 2, "VD-04 actual Tab visible focus " + key, sample);
        check(sample.inViewport && sample.clippedBy.length === 0 && sample.occluded.length === 0, "VD-04 Tab focus viewport/clipping/occlusion " + key, sample);
        if (sample.ariaDisabled === "true") {
          check(sample.descriptions.length > 0 && sample.descriptions.every(d => d.text.length > 0), "VD-05 inert describedby resolves " + key, sample.descriptions);
          const before = await page.evaluate(() => globalThis.document.querySelector(".shell").dataset.overlay);
          await page.keyboard.press("Enter"); await page.keyboard.press("Space");
          check(await page.evaluate(() => globalThis.document.querySelector(".shell").dataset.overlay) === before, "VD-05 inert keyboard activation suppressed " + key);
        }
      }
      check(row.traversal.length > 10, "VD-04 nonvacuous sequential traversal", row.traversal.length);
      // Actual accelerator enters renderer refusal state. No synthetic outcome attributes.
      await page.keyboard.press("Control+s");
      await page.locator('[data-overlay="outcome"]').waitFor({state:"visible"});
      row.refusal = await page.locator('[data-overlay="outcome"]').evaluate(el => ({text:el.innerText,rect:el.getBoundingClientRect().toJSON(),code:el.querySelector('[data-outcome-code]').textContent, message:el.querySelector('[data-outcome-message]').textContent, buttons:Array.from(el.querySelectorAll("button")).filter(button => {const r=button.getBoundingClientRect();return r.width>0&&r.height>0&&!button.disabled&&button.getAttribute("aria-disabled")!=="true";}).length}));
      check(row.refusal.text.includes("Command refused") && row.refusal.code.length > 0 && row.refusal.message.length > 0 && row.refusal.rect.width > 0 && row.refusal.rect.height > 0 && row.refusal.buttons > 0, "VD-03 actual renderer refusal diagnostic, nonzero geometry, reachable dismissal", row.refusal);
      const screenshot = resolve(directory, `refusal-${viewport.width}.png`); await page.screenshot({path:screenshot});
      row.capture = {path:screenshot.slice(root.length+1),bytes:readFileSync(screenshot).length,sha256:createHash("sha256").update(readFileSync(screenshot)).digest("hex")};
      for (let step=0;step<6;step++) { await page.keyboard.press(step % 2 ? "Shift+Tab" : "Tab"); const sample=await page.evaluate(focusGeometry);check(sample?.inModal && sample.inViewport && sample.clippedBy.length===0 && sample.occluded.length===0,"VD-05 refusal modal contains forward/backward Tab",sample); }
      await page.keyboard.press("Escape");
      check(await page.locator('[data-overlay="outcome"]').isHidden(), "VD-03 Escape dismisses actual refusal");
      await page.keyboard.press("Control+k");
      await page.locator('[data-overlay="palette"]').waitFor({state:"visible"});
      const paletteSeen = new Set();
      for(let step=0;step<240;step++) {
        await page.keyboard.press("Tab"); const sample=await page.evaluate(focusGeometry); if (!sample) break;
        if(paletteSeen.has(sample.id))break;paletteSeen.add(sample.id);row.palette.push(sample);
        check(sample.inModal && sample.focusVisible && sample.inViewport && sample.clippedBy.length===0 && sample.occluded.length===0, "VD-04/05 sequential palette modal focus "+sample.id,sample);
        if(sample.ariaDisabled==="true")check(sample.descriptions.length>0&&sample.descriptions.every(d=>d.text.length>0),"VD-05 palette inert description "+sample.id,sample.descriptions);
      }
      check(row.palette.length>5 && row.palette.some(s=>s.ariaDisabled==="true"), "VD-05 palette includes explanatory inert sequential stops",row.palette.length);
      await page.keyboard.press("Escape");
      check(await page.locator('[data-overlay="palette"]').isHidden(), "VD-05 Escape dismisses palette");
      check(errors.length===0,"VD-03/04/05 zero page errors",errors);
      check(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth),"VD-04 no horizontal globalThis.document overflow");
    } finally { await context.close(); receipts.cleanup.push(`context ${viewport.width} closed`); }
  }
} finally {
  await browser.close(); receipts.cleanup.push("browser closed");
  writeFileSync(resolve(directory,"results.json"),JSON.stringify(receipts,null,2)+"\n");
}
log(JSON.stringify({assertions:receipts.assertions.length,failures:receipts.failures.length,contexts:receipts.scenarios.length,cleanup:receipts.cleanup,firstFailures:receipts.failures.slice(0,12)},null,2));
assert.equal(receipts.failures.length,0,"actual keyboard geometry/behavior acceptance failures; see visual-repair-evidence/results.json");
