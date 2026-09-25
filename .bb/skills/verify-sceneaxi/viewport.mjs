#!/usr/bin/env node
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [url, outputDir, name, idleFlag] = process.argv.slice(2);
if (!/^http:\/\/127\.0\.0\.1:\d+\/open$/.test(url ?? "") || !outputDir || !/^[a-z0-9-]+$/.test(name ?? "") || (idleFlag !== undefined && idleFlag !== "--idle")) {
  console.error("Usage: node .bb/skills/verify-sceneaxi/viewport.mjs http://127.0.0.1:<port>/open <evidence-dir> <name> [--idle]");
  process.exit(2);
}

const require = createRequire(resolve("sites/umbrella/package.json"));
const { chromium } = require("@playwright/test");
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? "/usr/bin/google-chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  const canvas = page.locator("canvas.viewport-canvas");
  await canvas.waitFor();
  await page.waitForFunction(() => {
    const rows = [...document.querySelectorAll("dt")];
    return rows.some((row) => row.textContent === "Pixels drawn" && row.nextElementSibling?.textContent === "true");
  }, undefined, { timeout: 30000 });
  const measurements = await page.evaluate(async () => {
    const canvas = document.querySelector("canvas.viewport-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("WebGL canvas missing");
    const rows = [...document.querySelectorAll("dt")];
    const read = (label) => rows.find((row) => row.textContent === label)?.nextElementSibling?.textContent?.trim() ?? null;
    const startFrame = Number(read("Frame"));
    const start = performance.now();
    const intervals = [];
    let previous = 0;
    await new Promise((done) => {
      const tick = (now) => {
        if (previous) intervals.push(now - previous);
        previous = now;
        if (intervals.length < 120) requestAnimationFrame(tick);
        else done();
      };
      requestAnimationFrame(tick);
    });
    const elapsedMs = performance.now() - start;
    intervals.sort((a, b) => a - b);
    return {
      surface: read("Draw surface"), pixelsDrawn: read("Pixels drawn"), drawCalls: Number(read("Draw calls")),
      canvasWidth: canvas.width, canvasHeight: canvas.height,
      pngBytes: Math.round((canvas.toDataURL("image/png").length - 22) * 3 / 4),
      reportedFramesPerSecond: (Number(read("Frame")) - startFrame) * 1000 / elapsedMs,
      requestAnimationFrameP50Ms: intervals[60], requestAnimationFrameP95Ms: intervals[114],
      sampleCount: intervals.length,
    };
  });
  if (measurements.surface !== "webgl-canvas" || measurements.pixelsDrawn !== "true" || measurements.drawCalls <= 0 || measurements.pngBytes < 1000 || errors.length) {
    throw new Error(JSON.stringify({ measurements, errors }));
  }
  if (idleFlag === "--idle" && measurements.reportedFramesPerSecond > 1) {
    throw new Error(`Static viewport kept drawing at ${measurements.reportedFramesPerSecond} reported frames/s`);
  }
  await mkdir(outputDir, { recursive: true });
  await canvas.screenshot({ path: resolve(outputDir, `${name}-canvas.png`) });
  await page.screenshot({ path: resolve(outputDir, `${name}-page.png`), fullPage: true });
  const startingImage = await canvas.evaluate((element) => element.toDataURL());
  const frame = async () => Number(await page.locator("dt").filter({ hasText: "Frame" }).first().locator("xpath=following-sibling::dd[1]").innerText());
  const startingFrame = await frame();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Canvas has no bounds");
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 80, bounds.y + bounds.height / 2 + 40, { steps: 5 });
  await page.mouse.up();
  await page.waitForFunction((previous) => {
    const row = [...document.querySelectorAll("dt")].find((item) => item.textContent === "Frame");
    return Number(row?.nextElementSibling?.textContent) > previous;
  }, startingFrame);
  const movedImage = await canvas.evaluate((element) => element.toDataURL());
  if (movedImage === startingImage) throw new Error("Orbit did not change canvas pixels");
  const beforeReset = await frame();
  await page.getByRole("button", { name: "Reset view" }).click();
  await page.waitForFunction((previous) => {
    const row = [...document.querySelectorAll("dt")].find((item) => item.textContent === "Frame");
    return Number(row?.nextElementSibling?.textContent) > previous;
  }, beforeReset);
  const resetImage = await canvas.evaluate((element) => element.toDataURL());
  if (resetImage !== startingImage) throw new Error("Reset did not restore opening pixels");
  const beforeZoom = await frame();
  await canvas.hover();
  await page.mouse.wheel(0, -200);
  await page.waitForFunction((previous) => {
    const row = [...document.querySelectorAll("dt")].find((item) => item.textContent === "Frame");
    return Number(row?.nextElementSibling?.textContent) > previous;
  }, beforeZoom);
  const zoomedImage = await canvas.evaluate((element) => element.toDataURL());
  if (zoomedImage === startingImage) throw new Error("Wheel zoom did not change canvas pixels");
  await page.getByRole("button", { name: "Reset view" }).click();
  await page.getByRole("button", { name: "Mount the root instance only" }).click();
  await page.waitForFunction((original) => {
    const row = [...document.querySelectorAll("dt")].find((item) => item.textContent === "Draw calls");
    return Number(row?.nextElementSibling?.textContent) < original;
  }, measurements.drawCalls);
  const rootOnlyDrawCalls = Number(await page.locator("dt").filter({ hasText: "Draw calls" }).locator("xpath=following-sibling::dd[1]").innerText());
  const beforeResize = await frame();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForFunction(({ previousHeight, previousFrame }) => {
    const surface = document.querySelector("canvas.viewport-canvas");
    const row = [...document.querySelectorAll("dt")].find((item) => item.textContent === "Frame");
    return surface?.height !== previousHeight && Number(row?.nextElementSibling?.textContent) > previousFrame;
  }, { previousHeight: measurements.canvasHeight, previousFrame: beforeResize });
  const resizedHeight = await canvas.evaluate((element) => element.height);
  const beforeRestore = await frame();
  const contextLossSupported = await canvas.evaluate((element) => {
    const extension = element.getContext("webgl2")?.getExtension("WEBGL_lose_context");
    if (!extension) return false;
    extension.loseContext();
    setTimeout(() => extension.restoreContext(), 250);
    return true;
  });
  if (contextLossSupported) {
    await page.waitForFunction((previous) => {
      const row = [...document.querySelectorAll("dt")].find((item) => item.textContent === "Frame");
      return Number(row?.nextElementSibling?.textContent) > previous;
    }, beforeRestore);
  }
  await writeFile(resolve(outputDir, `${name}.json`), JSON.stringify({ url, measurements, rootOnlyDrawCalls, resizedHeight, contextLossSupported, orbitChangedPixels: true, zoomChangedPixels: true, resetRestoredPixels: true, errors }, null, 2) + "\n");
  console.log(JSON.stringify(measurements));
} finally {
  await browser.close();
}
