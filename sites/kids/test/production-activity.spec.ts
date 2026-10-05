/** Run with Node against a built loopback Kids server; reuse the installed browser tool. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { test } from "node:test";
import securityPolicy from "../security-headers.json" with { type: "json" };

const requireBrowser = createRequire(new URL("../../umbrella/package.json", import.meta.url));

// SAFETY: createRequire is rooted in umbrella, whose installed @playwright/test module provides the imported Playwright API.
const { chromium, expect } = requireBrowser("@playwright/test") as typeof import("../../umbrella/node_modules/@playwright/test/index.js");

const origin = process.argv[2];

assert.ok(origin, "Supply an already-running loopback production origin as the first argument.");

assert.equal(new URL(origin).hostname, "127.0.0.1", "Only loopback evidence is authorized.");

test("production Kids controls, isolation, ephemeral state and keyboard/reduced motion", async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });

  try {
    const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const requests: { url: string; type: string }[] = [];
    const errors: string[] = [];
    page.on("request", (request) => requests.push({ url: request.url(), type: request.resourceType() }));
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(origin);
    assert.ok(response, "Production navigation must return an HTTP response.");
    assert.equal(response.status(), 200);
    const headers = await response.allHeaders();

    for (const header of securityPolicy.headers) assert.equal(headers[header.key.toLowerCase()], header.value);
    assert.equal(headers["set-cookie"], undefined);
    assert.equal(headers["x-powered-by"], undefined);
    const message = page.locator(".activity-message");
    const pieces = page.locator(".placed-piece");
    const choose = (name: string) => page.getByRole("button", { name, exact: true });
    await choose("Start over").click();
    await expect(message).toHaveText("Your fresh world is already ready.");
    await choose("Sunny meadow").click();
    await expect(message).toHaveText("You are already in this world.");
    await expect(pieces).toHaveCount(0);

    for (const world of ["Moon camp", "Coral cove", "Sunny meadow"]) {
      await choose(world).click();
      await expect(choose(world)).toHaveAttribute("aria-pressed", "true");
    }

    for (const piece of ["Friend", "Tree", "Star", "Rocket", "Friend", "Star"]) await choose(piece).click();
    await expect(pieces).toHaveCount(6);
    await expect(page.locator(".stage")).toBeVisible();
    const pixels = await page.locator(".stage").screenshot();
    assert.ok(pixels.byteLength > 5000, "The populated stage must emit actual rasterized bytes.");
    const screenshot = { bytes: pixels.byteLength, sha256: createHash("sha256").update(pixels).digest("hex") };

    for (const piece of ["Friend", "Tree", "Star", "Rocket"]) await expect(choose(piece)).toBeDisabled();
    await choose("Sunny meadow").click();
    await expect(message).toHaveText("You are already in this world.");
    await expect(pieces).toHaveCount(6);
    await choose("Undo last").click();
    await expect(pieces).toHaveCount(5);
    await expect(choose("Star")).toBeEnabled();
    await choose("Play my world").focus();
    await page.keyboard.press("Enter");
    await expect(choose("Stop")).toHaveAttribute("aria-pressed", "true");

    for (const name of ["Sunny meadow", "Moon camp", "Coral cove", "Friend", "Tree", "Star", "Rocket", "Undo last", "Start over"]) {
      await expect(choose(name)).toBeDisabled();
    }

    const motion = await pieces.first().evaluate((element) => ({
      duration: getComputedStyle(element).animationDuration,
      iterations: getComputedStyle(element).animationIterationCount,
    }));

    assert.equal(motion.iterations, "1");
    assert.ok(parseFloat(motion.duration) <= 0.000001);
    await page.keyboard.press("Space");
    await expect(choose("Play my world")).toHaveAttribute("aria-pressed", "false");
    await choose("Start over").click();
    await expect(pieces).toHaveCount(0);
    await expect(choose("Sunny meadow")).toHaveAttribute("aria-pressed", "true");
    await choose("Start over").click();
    await expect(message).toHaveText("Your fresh world is already ready.");
    await expect(choose("Undo last")).toBeDisabled();
    await page.getByText("For grown-ups", { exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("details")).toHaveAttribute("open", "");

    const storage = await page.evaluate(async () => ({
      cookies: document.cookie,
      local: localStorage.length,
      session: sessionStorage.length,
      databases: (await indexedDB.databases()).length,
      caches: (await caches.keys()).length,
      workers: (await navigator.serviceWorker.getRegistrations()).length,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));

    assert.deepEqual(storage, { cookies: "", local: 0, session: 0, databases: 0, caches: 0, workers: 0, overflow: false });
    assert.deepEqual(await context.cookies(), []);
    await choose("Rocket").click();
    await page.reload();
    await expect(pieces).toHaveCount(0);
    await expect(choose("Sunny meadow")).toHaveAttribute("aria-pressed", "true");
    assert.ok(requests.length >= 3, "Must observe actual application assets, not an empty traffic fixture.");
    assert.deepEqual(requests.filter((request) => new URL(request.url).origin !== origin), []);
    assert.deepEqual(requests.filter((request) => ["fetch", "xhr", "websocket"].includes(request.type)), []);
    assert.deepEqual(errors, []);
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    console.log(JSON.stringify({ screenshot, origin, requestCount: requests.length, requestTypes: [...new Set(requests.map((request) => request.type))], thirdPartyRequests: 0, connectionRequests: 0, errors, storage, keyboard: "Enter/Space controls and details", reducedMotion: motion }));
    await context.close();
  } finally {
    await browser.close();
  }
});
