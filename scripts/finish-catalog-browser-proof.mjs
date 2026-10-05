/** Current production artifacts, bounded loopback-only GET browse proof. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { setTimeout } from "node:timers/promises";

const { chromium } = createRequire(new globalThis.URL("../sites/umbrella/package.json", import.meta.url))("@playwright/test");

const children = [];

let browser;

let assertions = 0;

try {
  browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });

  for (const [index, site] of ["catalog-game", "catalog-web"].entries()) {
    const port = 46320 + index;
    const origin = `http://127.0.0.1:${port}`;
    const child = spawn("pnpm", ["exec", "next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: new globalThis.URL(`../sites/${site}/`, import.meta.url), stdio: "ignore" });
    children.push(child);
    let ready = false;

    for (let attempt = 0; attempt < 200; attempt++) {
      assert.equal(child.exitCode, null, "site exited before readiness");

      try { if ((await globalThis.fetch(origin)).ok) { ready = true; break; } } catch { /* Loopback startup only. */ }

      await setTimeout(100);
    }

    assert(ready);
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin);
    const initial = await page.locator("ul.cards > li").count();
    assert(initial > 0);
    await page.getByLabel("Title, item ID or creator").fill("no-matching-item-xyz");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await page.waitForURL(/q=no-matching-item-xyz/);
    assert.equal(await page.getByRole("status").getByRole("heading").textContent(), "No matching listings"); assertions++;
    assert.equal(await page.locator("ul.cards > li").count(), 0); assertions++;
    await page.getByRole("status").getByRole("link", { name: "Clear filters" }).click();
    await page.waitForURL(origin + "/");
    assert.equal(await page.locator("ul.cards > li").count(), initial); assertions++;
    await page.goto(`${origin}/?q=${"x".repeat(101)}`);
    assert.equal(await page.getByRole("heading", { name: "Browse query refused" }).count(), 1); assertions++;
    await page.goto(`${origin}/?q=one&q=two`);
    assert.equal(await page.getByRole("heading", { name: "Browse query refused" }).count(), 1); assertions++;
    await page.goto(`${origin}/?sort=title&price=credits`);
    assert.equal(await page.getByLabel("Price mode", { exact: true }).inputValue(), "credits"); assertions++;
    assert.equal(await page.getByLabel("Sort", { exact: true }).inputValue(), "title"); assertions++;
    assert.deepEqual(errors, []); assertions++;
    await page.close(); child.kill("SIGTERM");
  }

  globalThis.console.log(`catalog-browser-proof: ${assertions} passed (two production storefronts, GET submit/reset/bounds/duplicates/empty-state/selection/no page errors)`);
} finally { await browser?.close();

 for (const child of children) child.kill("SIGTERM"); }
