/** Serial-only loopback proof of current production builds. Never builds or publishes. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import process from 'node:process';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const destination = join(root, 'sites/catalog-game/test/visual-evidence/repair');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const { chromium } = createRequire(join(root, 'sites/umbrella/package.json'))('@playwright/test');
const sources = () => {
  const rows = [];
  const walk = path => {
    for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (['node_modules', '.next', 'dist', 'test', 'visual-evidence'].includes(entry.name)) continue;
      const full = join(path, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(?:ts|tsx|css|json|yaml|mjs)$/.test(entry.name)) rows.push({ path: relative(root, full), sha256: sha256(readFileSync(full)) });
    }
  };
  for (const directory of ['packages', 'sites', 'apps']) walk(join(root, directory));
  return rows;
};
const before = sources();
const report = { artifact: 'LOCAL_WORKTREE_ONLY', publishedSha: null, capturedAt: new Date().toISOString(), sourceFingerprint: sha256(JSON.stringify(before)), sources: before, builds: [], routes: [], focus: [], contrasts: [], screenshots: [], checkpoints: [], liveOpen: [], renderer: "Chromium SwiftShader software WebGL; not physical GPU proof", providerBrowserBranch: "NOT_EXECUTED_PREVIEW_IS_NOT_AUTHENTICATED_PROVIDER", failures: [], cleanup: [] };
mkdirSync(destination, { recursive: true });
let browser;
let child;
const check = (condition, message, details = null) => { if (!condition) report.failures.push({ message, details }); };

// Actual cascade compositing; report unsupported images rather than inventing a ratio.
function contrastMetrics() {
  const parse = value => { const values = value.match(/[\d.]+/g)?.map(Number); if (!values || values.length < 3) throw new Error('COLOR_PARSE_FAILED'); return [...values.slice(0, 3), values[3] ?? 1]; };
  const over = (fg, bg) => { const a = fg[3] + bg[3] * (1 - fg[3]); return a === 0 ? [0, 0, 0, 0] : [...fg.slice(0, 3).map((v, i) => (v * fg[3] + bg[i] * bg[3] * (1 - fg[3])) / a), a]; };
  const luminance = color => color.slice(0, 3).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  return [...globalThis.document.querySelectorAll('main *')].filter(element => [...element.childNodes].some(node => node.nodeType === globalThis.Node.TEXT_NODE && node.textContent.trim()) && element.getBoundingClientRect().width > 1 && globalThis.getComputedStyle(element).visibility === 'visible').map(element => {
    const chain = []; for (let node = element; node; node = node.parentElement) chain.unshift(node);
    let background = [255, 255, 255, 1]; let unsupported = null;
    for (const node of chain) { const style = globalThis.getComputedStyle(node); if (style.backgroundImage !== 'none') unsupported = 'background-image'; if (Number(style.opacity) !== 1) unsupported = 'group-opacity'; background = over(parse(style.backgroundColor), background); }
    const style = globalThis.getComputedStyle(element); const fg = over(parse(style.color), background); const a = luminance(fg); const b = luminance(background);
    return { element: element.tagName, className: element.className, text: element.textContent.trim().slice(0, 100), foreground: fg, background, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), unsupported, normalText: parseFloat(style.fontSize) < 24 && !(parseFloat(style.fontSize) >= 18.67 && Number(style.fontWeight) >= 700) };
  });
}

// Tab, not programmatic focus. Check the ring against clipping ancestors and occlusion.
function focusMetrics() {
  const element = globalThis.document.activeElement;
  if (!element || element === globalThis.document.body) return null;
  const style = globalThis.getComputedStyle(element); const r = element.getBoundingClientRect();
  const ring = Math.max(0, parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset));
  const bounds = { left: r.left - ring, right: r.right + ring, top: r.top - ring, bottom: r.bottom + ring };
  const clips = [];
  for (let node = element.parentElement; node; node = node.parentElement) {
    const css = globalThis.getComputedStyle(node); const box = node.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(css.overflowX) && (bounds.left < box.left - 1 || bounds.right > box.right + 1)) clips.push('horizontal:' + node.className);
    if (/(auto|scroll|hidden|clip)/.test(css.overflowY) && (bounds.top < box.top - 1 || bounds.bottom > box.bottom + 1)) clips.push('vertical:' + node.className);
  }
  const points = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 1, r.top + 1], [r.right - 1, r.bottom - 1]];
  const occluded = points.some(([x, y]) => { const top = globalThis.document.elementFromPoint(x, y); return !top || !(element.contains(top)); });
  const describedBy = (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
  const path = []; for (let node = element; node?.parentElement; node = node.parentElement) path.unshift(node.tagName + ':' + [...node.parentElement.children].indexOf(node));
  return { path: path.join('/'), id: element.id, tag: element.tagName, label: element.textContent.trim().slice(0, 80), outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth), bounds, clips, occluded, disabled: element.getAttribute('aria-disabled'), describedBy, missingDescriptions: describedBy.filter(id => !globalThis.document.getElementById(id)), viewport: { width: globalThis.innerWidth, height: globalThis.innerHeight } };
}

try {
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  for (const [index, site] of ['catalog-game', 'catalog-web', 'kids', 'umbrella'].entries()) {
    const buildPath = join(root, `sites/${site}/.next/BUILD_ID`);
    assert(existsSync(buildPath), `${site}: serial integrator must provide a current production build`);
    report.builds.push({ site, buildId: readFileSync(buildPath, 'utf8').trim() });
    const origin = `http://127.0.0.1:${46630 + index}`;
    child = spawn('pnpm', ['exec', 'next', 'start', '--hostname', '127.0.0.1', '--port', String(46630 + index)], { cwd: join(root, 'sites', site), env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', SCENEAXI_SITE_EDITOR_PREVIEW: '1' }, stdio: 'ignore', detached: true });
    let ready = false;
    for (let attempt = 0; attempt < 150; attempt++) { assert.equal(child.exitCode, null, `${site} server exited`); try { if ((await globalThis.fetch(origin)).ok) { ready = true; break; } } catch { /* bounded local startup */ } await delay(100); }
    assert(ready, `${site} startup timeout`);
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    if (site === 'kids') await context.addInitScript(() => {
      const calls = []; globalThis.__kidsNetworkCalls = calls;
      for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource']) {
        const original = globalThis[name]; if (typeof original !== 'function') continue;
        globalThis[name] = new Proxy(original, { apply: (target, receiver, args) => { calls.push(name); return Reflect.apply(target, receiver, args); }, construct: (target, args) => { calls.push(name); return Reflect.construct(target, args); } });
      }
    });
    const page = await context.newPage();
    const errors = []; const requests = []; page.on('pageerror', error => errors.push(error.message)); page.on('request', request => requests.push(request.url()));
    let routes;
    if (site === 'umbrella') routes = ['/open', '/docs', '/account', '/login', '/engine', '/editor', '/editor?profile=web', '/not-a-real-page'];
    else if (site === 'kids') routes = ['/'];
    else { await page.goto(origin); const detail = await page.locator('.cards a.card-link').first().getAttribute('href'); assert(detail, 'real inventory detail'); routes = ['/', detail, '/publish', '/?q=no-match-repair-oracle', '/?sort=unsupported', '/?q=one&q=two', '/?q=' + 'x'.repeat(101), '/not-a-real-page']; }
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      for (const route of routes) {
        const response = await page.goto(origin + route, { waitUntil: 'networkidle' });
        await page.evaluate(() => globalThis.document.fonts.ready);
        const routeReceipt = { site, route, width, status: response.status(), pageErrors: [...errors], headers: { csp: response.headers()['content-security-policy'], contentType: response.headers()['content-type'] }, document: await page.evaluate(() => ({ client: globalThis.document.documentElement.clientWidth, scroll: globalThis.document.documentElement.scrollWidth })) };
        report.routes.push(routeReceipt); check(routeReceipt.document.scroll <= width + 1, 'globalThis.document-overflow', routeReceipt); check(errors.length === 0, 'page-error', routeReceipt); check(response.status() === (route === '/not-a-real-page' ? 404 : 200), 'HTTP-status', routeReceipt);
        if (route.includes('sort=unsupported') || route.includes('q=one') || route.includes('x'.repeat(101))) check(await page.locator('.reason').filter({ hasText: 'CATALOG_BROWSE_QUERY_INVALID' }).count() === 1, 'invalid-query-refusal', routeReceipt);
        if (route.includes('no-match')) check(await page.getByRole('heading', { name: 'No matching listings', exact: true }).count() === 1, 'empty-state', routeReceipt);
        for (const metric of await page.evaluate(contrastMetrics)) { report.contrasts.push({ site, route, width, ...metric }); if (!metric.unsupported && metric.normalText) check(metric.ratio >= 4.5, 'normal-text-contrast', { site, route, width, ...metric }); }
        for (const forcedColors of ['none', 'active']) {
          await page.emulateMedia({ forcedColors }); await page.goto(origin + route, { waitUntil: 'networkidle' }); await page.evaluate(() => { globalThis.document.activeElement?.blur(); globalThis.window.scrollTo(0, 0); });
          const seen = new Set();
          for (let step = 0; step < 100; step++) {
            await page.keyboard.press('Tab'); const metric = await page.evaluate(focusMetrics); if (!metric) break;
            const key = metric.path; if (seen.has(key)) break; seen.add(key);
            report.focus.push({ site, route, width, forcedColors, step, ...metric });
            check(metric.outlineStyle !== 'none' && metric.outlineWidth >= 2, 'focus-ring', metric); check(metric.clips.length === 0, 'focus-clipped', metric); check(!metric.occluded, 'focus-occluded', metric); check(metric.missingDescriptions.length === 0, 'focus-description-missing', metric);
          }
        }
        await page.emulateMedia({ forcedColors: 'none' });
        const path = `${site}-${routes.indexOf(route)}-${width}.png`; await page.screenshot({ path: join(destination, path), fullPage: true }); const bytes = readFileSync(join(destination, path)); report.screenshots.push({ path: relative(root, join(destination, path)), sha256: sha256(bytes), bytes: bytes.length });
      }
    }
    if (site === 'umbrella') {
      await page.goto(origin + '/open', { waitUntil: 'networkidle' });
      const drawn = () => page.waitForFunction(() => [...globalThis.document.querySelectorAll('dt')].find(node => node.textContent === 'Pixels drawn')?.nextElementSibling?.textContent.trim() === 'true');
      await drawn();
      const mounted = () => page.locator('dt').filter({ hasText: /^Mounted$/ }).locator('xpath=following-sibling::dd[1]').textContent();
      const allMounted = await mounted(); const canvas = page.locator('canvas').first(); const allPng = await canvas.screenshot();
      await page.getByRole('button', { name: 'Mount the root instance only', exact: true }).click();
      await page.waitForFunction(previous => [...globalThis.document.querySelectorAll('dt')].find(node => node.textContent === 'Mounted')?.nextElementSibling?.textContent !== previous, allMounted);
      await drawn(); const rootMounted = await mounted(); const rootPng = await canvas.screenshot();
      check(allMounted.split(',').length > rootMounted.split(',').length, 'live-open-real-mount-transition');
      check(sha256(allPng) !== sha256(rootPng), 'live-open-real-canvas-change');
      await page.getByRole('button', { name: 'Mount every instance', exact: true }).click(); await page.waitForFunction(previous => [...globalThis.document.querySelectorAll('dt')].find(node => node.textContent === 'Mounted')?.nextElementSibling?.textContent === previous, allMounted); await drawn();
      await page.getByRole('button', { name: 'Reset view', exact: true }).click(); await drawn();
      report.liveOpen.push({ allMounted, rootMounted, allCanvasSha256: sha256(allPng), rootCanvasSha256: sha256(rootPng), changedCanvasBytes: sha256(allPng) !== sha256(rootPng), mountAndReset: true });
      await page.setViewportSize({ width: 1440, height: 1000 });
      const savedRoute = '/editor?profile=web&web-html=%3Cp%3Echeckpoint%20repair%3C%2Fp%3E';
      await page.goto(origin + savedRoute, { waitUntil: 'networkidle' });
      await page.getByText('Local project', { exact: true }).click();
      await page.getByRole('button', { name: 'Save locally', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Saved locally, revision 1' }).waitFor();
      const saved = await page.evaluate(() => { const key = Object.keys(globalThis.localStorage).find(key => key.startsWith('sceneaxi.editor-project.v1.') && key.endsWith('.web')); return { key, text: globalThis.localStorage.getItem(key) }; });
      const record = JSON.parse(saved.text);
      const digest = await page.locator('[data-editor-project-digest]').getAttribute('data-editor-project-digest');
      check(record.documentDigest === digest, 'checkpoint-real-source-digest');
      const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export canonical document', exact: true }).click();
      const download = await downloadPromise; const documentBytes = readFileSync(await download.path());
      check(sha256(documentBytes) === digest, 'checkpoint-canonical-document-bytes');
      await page.getByRole('button', { name: 'Reopen local', exact: true }).click();
      await page.waitForURL(origin + record.href);
      check(await page.locator('[data-editor-project-digest]').getAttribute('data-editor-project-digest') === digest, 'checkpoint-actual-reconstruction');
      await page.getByText('Local project', { exact: true }).click();
      const signed = changes => { const payload = { version: record.version, owner: changes.owner ?? record.owner, revision: record.revision, href: changes.href ?? record.href, documentDigest: changes.documentDigest ?? record.documentDigest }; return JSON.stringify({ ...payload, checksum: sha256(JSON.stringify(payload)) }); };
      const cases = [
        ['foreign-owner', signed({ owner: 'foreign-local-owner' }), 'PROJECT_RECORD_INVALID'],
        ['forged-digest-valid-checksum', signed({ documentDigest: '0'.repeat(64) }), 'PROJECT_RECONSTRUCTION_REFUSED'],
        ['changed-route-stale-digest', signed({ href: '/editor?profile=web&web-html=changed' }), 'PROJECT_RECONSTRUCTION_REFUSED'],
        ['Kids-link', signed({ href: '/editor?profile=kids' }), 'PROJECT_KIDS_REFUSED'],
        ['malformed', '{', 'PROJECT_RECORD_INVALID'],
        ['oversized', 'x'.repeat(16385), 'PROJECT_RECORD_TOO_LARGE'],
      ];
      for (const [name, text, code] of cases) {
        const priorUrl = page.url();
        await page.locator('input[type="file"]').setInputFiles({ name: 'checkpoint.json', mimeType: 'application/json', buffer: Buffer.from(text) });
        await page.getByRole('status').filter({ hasText: code }).waitFor();
        const unchanged = await page.evaluate(key => globalThis.localStorage.getItem(key), saved.key);
        check(unchanged === saved.text && page.url() === priorUrl, 'checkpoint-no-partial-change:' + name);
        report.checkpoints.push({ name, expected: code, urlUnchanged: page.url() === priorUrl, bytesUnchanged: unchanged === saved.text });
      }
    }
    if (site.startsWith('catalog-')) {
      await page.goto(origin); const target = await page.locator('.cards a.card-link').first().getAttribute('href'); const item = target.split('/').at(-1);
      await page.getByLabel('Title, item ID or creator').fill(item); await page.getByRole('button', { name: 'Apply filters', exact: true }).click(); await page.waitForURL(/q=/);
      check(await page.locator('.cards a.card-link').count() === 1, 'actual-search-submit'); await page.getByRole('link', { name: 'Clear filters', exact: true }).first().click(); check(await page.locator('.cards a.card-link').count() > 0, 'actual-clear-submit');
    }
    if (site === 'kids') { await page.getByRole('button', { name: 'Tree', exact: true }).click(); await page.getByRole('button', { name: 'Play my world', exact: true }).click(); check(await page.locator('.mode-badge').textContent() === 'Playing', 'kids-actual-play'); check(requests.every(url => url.startsWith(origin)), 'kids-external-request'); check(await page.evaluate(() => globalThis.__kidsNetworkCalls.length) === 0, 'kids-network-api'); check((await context.cookies()).length === 0, 'kids-cookie'); check(await page.evaluate(() => globalThis.localStorage.length + globalThis.sessionStorage.length) === 0, 'kids-storage'); }
    await context.close(); process.kill(-child.pid, 'SIGTERM'); await delay(200); report.cleanup.push({ site, terminatedProcessGroup: child.pid }); child = null;
  }
  assert.deepEqual(sources(), before, 'SOURCE_DRIFT_DURING_BROWSER_PROOF');
} catch (error) { report.failures.push({ message: error.message }); }
finally {
  if (child) { try { process.kill(-child.pid, 'SIGTERM'); report.cleanup.push({ abortedProcessGroup: child.pid }); } catch { /* already exited */ } }
  await browser?.close();
  report.finishedAt = new Date().toISOString(); report.unsupportedContrastSamples = report.contrasts.filter(row => row.unsupported).length;
  writeFileSync(join(destination, 'receipt.json'), JSON.stringify(report, null, 2) + '\n');
}
globalThis.console.log(JSON.stringify({ routes: report.routes.length, focusSamples: report.focus.length, contrastSamples: report.contrasts.length, unsupportedContrastSamples: report.unsupportedContrastSamples, failures: report.failures.length, receipt: relative(root, join(destination, 'receipt.json')) }));
assert.equal(report.failures.length, 0, 'Current rendered accessibility proof failed; exact failures retained in receipt.json');
