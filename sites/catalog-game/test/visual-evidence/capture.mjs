/** Loopback-only production visual receipt; no provider or production mutation. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import process from 'node:process';
import { setTimeout } from 'node:timers/promises';

const root = '/home/devuser/Documents/Projects/sceneaxi';

const phase = process.argv[2];

assert(['before', 'after'].includes(phase));

const { chromium } = createRequire(`${root}/sites/umbrella/package.json`)('@playwright/test');

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });

const servers = [];

const receipts = [];

let assertions = 0;

try {
  for (const [index, site] of ['catalog-game', 'catalog-web', 'kids'].entries()) {
    const origin = `http://127.0.0.1:${46540 + index}`;
    const server = spawn('pnpm', ['exec', 'next', 'start', '--hostname', '127.0.0.1', '--port', String(46540 + index)], { cwd: `${root}/sites/${site}`, stdio: 'ignore', detached: true });
    servers.push(server);
    let ready = false;

    for (let attempt = 0; attempt < 150; attempt++) {
      assert.equal(server.exitCode, null);

      try {
        if ((await globalThis.fetch(origin)).ok) { ready = true; break; }
      } catch { /* Bounded startup retry on the loopback origin. */ }

      await setTimeout(100);
    }

    assert(ready, `${site} ready`);
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    const connections = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith(origin)) connections.push(request.url()); });
    await page.goto(origin);
    const item = site === 'kids' ? '/' : await page.locator('.cards a.card-link').first().getAttribute('href');
    const surfaces = site === 'kids' ? [['activity', '/'], ['playing', '/']] : [['home', '/'], ['detail', item], ['publish', '/publish'], ['empty', '/?q=no-match-visual-loop'], ['refused', '/?sort=unsupported']];

    for (const [viewport, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
      await page.setViewportSize({ width, height });

      for (const [surface, route] of surfaces) {
        await page.goto(origin + route, { waitUntil: 'networkidle' });
        await page.evaluate(() => globalThis.document.fonts.ready);

        if (site === 'kids' && surface === 'playing') {
          await page.getByRole('button', { name: 'Tree', exact: true }).click();
          await page.getByRole('button', { name: 'Play my world', exact: true }).click();
          assert.equal(await page.locator('.mode-badge').textContent(), 'Playing'); assertions++;
          assert.equal(await page.locator('.placed-piece').count(), 1); assertions++;
        }

        const metrics = await page.evaluate(() => ({
          width: globalThis.innerWidth,
          scrollWidth: globalThis.document.documentElement.scrollWidth,
          headingCount: globalThis.document.querySelectorAll('h1').length,
          headingSize: globalThis.getComputedStyle(globalThis.document.querySelector('h1, h2, h3')).fontSize,
          controls: [...globalThis.document.querySelectorAll('input, select, form button')].map(element => ({ tag: element.tagName, height: element.getBoundingClientRect().height, color: globalThis.getComputedStyle(element).color, background: globalThis.getComputedStyle(element).backgroundColor })),
        }));

        assert.equal(metrics.scrollWidth, width, `${site}/${surface}/${viewport} overflow`); assertions++;
        assert.equal(metrics.headingCount, surface === 'refused' ? 0 : 1); assertions++;
        assert.deepEqual(errors, []); assertions++;

        if (phase === 'after' && site !== 'kids' && surface === 'home') {
          assert(metrics.controls.every(control => control.height >= 44)); assertions++;
          const input = page.getByLabel('Title, item ID or creator');
          await input.focus();
          assert.equal(await input.evaluate(element => globalThis.getComputedStyle(element).outlineStyle), 'solid'); assertions++;
        }

        const path = `sites/${site}/test/visual-evidence/${phase}-${surface}-${viewport}.png`;
        await page.screenshot({ path: `${root}/${path}`, fullPage: true });
        const bytes = readFileSync(`${root}/${path}`);
        receipts.push({ site, surface, viewport, path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), metrics });
      }
    }

    if (site === 'kids') {
      assert.deepEqual(connections, []); assertions++;
      assert.equal((await context.cookies()).length, 0); assertions++;
      assert.equal(await page.evaluate(() => globalThis.localStorage.length + globalThis.sessionStorage.length), 0); assertions++;
    }

    await context.close();
  }

  writeFileSync(`${root}/sites/catalog-game/test/visual-evidence/${phase}.json`, JSON.stringify({ phase, assertions, screenshots: receipts }, null, 2) + '\n');
  globalThis.console.log(`${phase}: ${assertions} browser assertions passed; ${receipts.length} full-page screenshots`);
} finally {
  await browser.close();

  for (const server of servers) {
    try { process.kill(-server.pid, 'SIGTERM'); } catch { /* Process already exited; no live child to clean. */ }
  }
}
