/** Explicit test-only Web demo shell: real browser controls/kernel/pixels, not a shipped site or CMS. */
import assert from "node:assert/strict";
import { createRequire, register } from "node:module";
import { test } from "node:test";

register("../../../scripts/workspace-dist-resolver.mjs", import.meta.url);

const { evaluateWebExperienceScope, evaluateOpenPath, mvpGoldenPath } = await import("@sceneaxi/profile-web");

const desktop = createRequire(new globalThis.URL("../../../desktop/linux/package.json", import.meta.url));

const site = createRequire(new globalThis.URL("../../../sites/umbrella/package.json", import.meta.url));

const { build } = desktop("esbuild");

const { chromium, expect } = site("@playwright/test");

const bundle = await build({ stdin: { contents: 'import * as K from "@sceneaxi/engine-kernel"; import * as P from "@sceneaxi/engine-presentation"; globalThis.demo = { K, P };', resolveDir: new globalThis.URL("../../../desktop/linux", import.meta.url).pathname }, bundle: true, platform: "browser", format: "iife", write: false });

const scenarios = [
  { name: "hero-scene", scope: "interactive-experience", control: "Explore", initial: "Welcome", terminal: "Exploring the hero scene", axis: [2, 0] },
  { name: "configurator", scope: "interactive-experience", control: "Choose wide layout", initial: "Compact layout", terminal: "Wide layout selected", axis: [-2, 1] },
  { name: "storytelling", scope: "interactive-site-shell", control: "Next chapter", initial: "Chapter one", terminal: "Chapter two: the journey", axis: [1, 2] },
  { name: "microsite", scope: "interactive-site-chrome", control: "Visit gallery", initial: "Home section", terminal: "Gallery section", axis: [-1, -2] },
];

for (const scenario of scenarios) {
  test(`PK-004 ${scenario.name}: accessible control, actual pixels and deterministic replay`, async () => {
    assert.equal(evaluateWebExperienceScope(scenario.scope).ok, true);
    assert.equal(evaluateOpenPath("open").ok, true);
    const browser = await chromium.launch({ executablePath: globalThis.process.argv[2] ?? "/usr/bin/chromium", headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

    try {
      const page = await browser.newPage();
      const errors = [], requests = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("request", request => requests.push(request.url()));
      await page.setContent('<main><h1></h1><button></button><output aria-live="polite"></output><canvas width="256" height="256" aria-label="Interactive scene"></canvas></main>');
      await page.locator("h1").evaluate((element, name) => { element.textContent = name; }, scenario.name);
      await page.locator("button").evaluate((element, label) => { element.textContent = label; }, scenario.control);
      await page.locator("output").evaluate((element, label) => { element.textContent = label; }, scenario.initial);
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.evaluate(scenario => {
        const { K, P } = globalThis.demo;
        const canvas = globalThis.document.querySelector("canvas");
        const gl = canvas.getContext("webgl2");

        if (!gl) throw Error("WebGL2 unavailable");
        const host = { nowMs: () => 0 };
        const session = K.open({ productId: "web-browser-demo", seed: 51, entities: [{ id: "hero", x: 0, y: 0 }] }, host);
        const runtime = P.createThreePresentationRuntime({ canvas, viewport: { width: 256, height: 256 } });
        runtime.mount(); runtime.present(session.observe(), [], 1);
        const pixels = () => { const bytes = new Uint8Array(256 * 256 * 4); gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, bytes);

 return bytes; };

        const before = pixels();
        globalThis.result = null;
        globalThis.document.querySelector("button").onclick = event => {
          const original = session.observe();
          session.dispatch({ type: "move", actor: "hero", axis: scenario.axis });
          const queueDoesNotMutate = JSON.stringify(session.observe()) === JSON.stringify(original);
          session.advance({ tick: 1, deltaMs: 16 });
          const snapshot = session.observe();
          runtime.present(snapshot, [], 1);
          const after = pixels();
          let changedPixels = 0;

          for (let i = 0; i < before.length; i += 4) if (before[i] !== after[i] || before[i + 1] !== after[i + 1] || before[i + 2] !== after[i + 2]) changedPixels++;
          const replay = K.replay(session.save(), host).observe();
          runtime.present(replay, [], 1);
          const replayPixels = pixels();
          const capture = runtime.capture();
          globalThis.result = { trusted: event.isTrusted, queueDoesNotMutate, snapshot, replay, changedPixels, exactReplayPixels: after.every((byte, i) => byte === replayPixels[i]), frame: runtime.lastFrame(), pngBytes: capture?.bytes.length ?? 0 };
          globalThis.document.querySelector("output").textContent = scenario.terminal;
        };

        globalThis.closeDemo = () => { runtime.dispose(); P.releaseThreeCanvas(canvas);

 return gl.isContextLost(); };
      }, scenario);
      await expect(page.getByRole("button", { name: scenario.control, exact: true })).toBeVisible();
      await page.getByRole("button", { name: scenario.control, exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("output")).toHaveText(scenario.terminal);
      const result = await page.evaluate(() => globalThis.result);
      assert.equal(result.trusted, true);
      assert.equal(result.queueDoesNotMutate, true);
      assert.deepEqual(result.snapshot.entities, [{ id: "hero", x: scenario.axis[0], y: scenario.axis[1] }]);
      assert.deepEqual(result.replay, result.snapshot);
      assert.ok(result.changedPixels > 20, "Interaction must change actual drawing-buffer pixels");
      assert.equal(result.exactReplayPixels, true);
      assert.equal(result.frame.pixelsDrawn, true);
      assert.equal(result.frame.surface, "webgl-canvas");
      assert.ok(result.pngBytes > 1000);
      assert.equal(await page.evaluate(() => globalThis.closeDemo()), true);
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      globalThis.console.log(JSON.stringify({ scenario: scenario.name, changedPixels: result.changedPixels, pngBytes: result.pngBytes, digest: result.snapshot.digest, replayPixelsIdentical: true, networkRequests: 0, terminalContextLost: true }));
    } finally { await browser.close(); }
  });
}

test("PK-003/004: demonstrations grant no shipping, CMS or unreviewed live-data authority", () => {
  assert.equal(mvpGoldenPath.status.shippingClaim, false);

  for (const scope of ["cms", "form-builder", "data-driven-real-time"]) assert.equal(evaluateWebExperienceScope(scope).ok, false);
  assert.equal(evaluateOpenPath("open", true).ok, false);
});
