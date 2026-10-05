import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { buildOfflineWebExport } from "@sceneaxi/site-kit";

const require = createRequire(new globalThis.URL("../../../sites/umbrella/package.json", import.meta.url));

const { chromium } = require("@playwright/test");

const bundle = buildOfflineWebExport({ title: "Contained offline", html: '<p>Offline retained</p><script>parent.hacked=true</script><img src="https://hostile.invalid/leak">', layout: "hero", embedThree: false, injectStarterAsset: false });

const dir = await mkdtemp(join(tmpdir(), "sceneaxi-offline-proof-"));

const types = { html: "text/html", js: "text/javascript", css: "text/css", json: "application/json", webmanifest: "application/manifest+json" };

const server = createServer((req, res) => {
  const name = req.url?.startsWith("/contained/") ? req.url.slice("/contained/".length) : "";
  const text = bundle.files[name];

  if (text === undefined) { res.writeHead(404); res.end();

 return; }

  res.writeHead(200, { "content-type": types[name.split(".").at(-1)] ?? "text/plain", "cache-control": "no-store" });res.end(text);
});

let browser;

try {
  await writeFile(join(dir,"export.zip"), bundle.archive);
  execFileSync("unzip", ["-t", join(dir,"export.zip")], { stdio: "ignore" });
  await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext();const page = await context.newPage();
  const external = [];const errors = [];
  page.on("request", req => { if (!req.url().startsWith(origin)) external.push(req.url()); });
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${origin}/contained/index.html`);
  await page.evaluate(async () => { await globalThis.navigator.serviceWorker.ready;

 if (!globalThis.navigator.serviceWorker.controller) await new Promise(resolve => globalThis.navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true })); });
  assert.equal(await page.locator("iframe").getAttribute("sandbox"), "");
  assert.equal(await page.frameLocator("iframe").locator("p").textContent(), "Offline retained");
  await context.setOffline(true);
  await page.reload();
  assert.equal(await page.frameLocator("iframe").locator("p").textContent(), "Offline retained");
  assert.equal(await page.evaluate(() => globalThis.hacked), undefined);
  const cache = await page.evaluate(async () => { const cache = await globalThis.caches.open((await globalThis.caches.keys())[0]);

 return (await cache.keys()).map(req => new globalThis.URL(req.url).pathname); });
  assert.equal(cache.length, 6);assert(cache.every(path => path.startsWith("/contained/")));
  assert.deepEqual(external, []);assert.deepEqual(errors, []);
  globalThis.console.log("offline-web-browser-proof: 5 passed (ZIP CRC, sandbox, offline reload, no external requests, contained cache)");
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); }
