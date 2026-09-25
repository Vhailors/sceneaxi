#!/usr/bin/env node
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(new URL("../../../sites/umbrella/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const [url, image] = process.argv.slice(2);
if (!/^http:\/\/127\.0\.0\.1:\d+\/open$/.test(url ?? "") || !image?.endsWith(".png") || existsSync(image)) {
  console.error("Usage: node .bb/skills/verify-sceneaxi/viewport.mjs http://127.0.0.1:<port>/open <new.png>");
  process.exit(2);
}
const browser = await chromium.launch({
  executablePath: process.env.SCENEAXI_CHROME_PATH ?? "/usr/bin/google-chrome",
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    ...(process.env.SCENEAXI_CHROME_NO_SANDBOX === "1" ? ["--no-sandbox"] : []),
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector("canvas");
    return canvas?.getContext("webgl2")?.drawingBufferWidth > 0 &&
      document.body.textContent?.includes("webgl-canvas");
  }, undefined, { timeout: 120_000 });
  const metrics = await page.evaluate(async () => {
    const canvas = document.querySelector("canvas");
    const gl = canvas?.getContext("webgl2");
    if (!canvas || !gl) throw new Error("Live viewport did not open WebGL2");
    const stamps = [];
    await new Promise((done) => {
      const sample = (now) => {
        stamps.push(now);
        if (stamps.length < 121) requestAnimationFrame(sample);
        else done();
      };
      requestAnimationFrame(sample);
    });
    const intervals = stamps.slice(1).map((time, index) => time - stamps[index]).sort((a, b) => a - b);
    return {
      cssPixels: Math.round(canvas.clientWidth * canvas.clientHeight),
      bufferPixels: gl.drawingBufferWidth * gl.drawingBufferHeight,
      buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      medianFrameMs: Number(intervals[60].toFixed(2)),
      p95FrameMs: Number(intervals[114].toFixed(2)),
      frameReport: [...document.querySelectorAll("dt")].find((term) => term.textContent === "Draw calls")?.nextElementSibling?.textContent ?? null,
    };
  });
  await page.locator("canvas").screenshot({ path: resolve(image) });
  console.log(JSON.stringify({ url, image: resolve(image), ...metrics }));
  if (!metrics.frameReport || Number(metrics.frameReport) <= 0) process.exitCode = 1;
} finally {
  await browser.close();
}
