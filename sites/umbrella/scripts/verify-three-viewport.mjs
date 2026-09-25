import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [url, directory, label] = process.argv.slice(2);

if (!url?.startsWith('http://127.0.0.1:') || !directory || !label) {
  throw new Error('Usage: node scripts/verify-three-viewport.mjs <loopback-origin> <output-dir> <label>');
}

const output = resolve(directory);

await mkdir(output, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.SCENEAXI_CHROME_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(`${url}/open`, { waitUntil: 'domcontentloaded' });
  const canvas = page.locator('canvas').first();
  await canvas.waitFor();
  const frame = () => page.locator('dt', { hasText: /^Frame$/ }).locator('xpath=following-sibling::dd[1]').textContent();
  await page.waitForFunction(() => document.querySelector('dt')?.parentElement?.textContent?.includes('webgl-canvas'));
  await page.waitForTimeout(1800);
  const startingFrame = Number(await frame());

  const stats = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    const gl = canvas.getContext('webgl2');

    if (!gl) throw new Error('No WebGL2 context');
    const deltas = []; let previous = 0;
    await new Promise((done) => {
      const step = (time) => {
        if (previous) deltas.push(time - previous);
        previous = time;

        if (deltas.length < 120) requestAnimationFrame(step);
        else done();
      };

      requestAnimationFrame(step);
    });
    const sorted = [...deltas].sort((a, b) => a - b);

    return {
      webgl: gl.getParameter(gl.VERSION), canvas: [canvas.width, canvas.height],
      medianRafMs: sorted[60], p95RafMs: sorted[114],
      meanRafMs: deltas.reduce((a, b) => a + b, 0) / deltas.length,
    };
  });

  const idleFrame = Number(await frame());
  await canvas.screenshot({ path: `${output}/${label}-canvas.png` });
  await page.screenshot({ path: `${output}/${label}-page.png` });
  const beforeDrag = await canvas.evaluate((node) => node.toDataURL());
  const box = await canvas.boundingBox();

  if (!box) throw new Error('Canvas has no box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 5 });
  await page.mouse.up();
  await page.waitForFunction((previous) => Number([...document.querySelectorAll('dt')].find((dt) => dt.textContent === 'Frame')?.nextElementSibling?.textContent) > previous, idleFrame);
  const draggedFrame = Number(await frame());
  const afterDrag = await canvas.evaluate((node) => node.toDataURL());
  await page.getByRole('button', { name: 'Reset view' }).click();
  await page.waitForFunction((previous) => Number([...document.querySelectorAll('dt')].find((dt) => dt.textContent === 'Frame')?.nextElementSibling?.textContent) > previous, draggedFrame);
  const resetFrame = Number(await frame());
  const afterReset = await canvas.evaluate((node) => node.toDataURL());

  if (idleFrame !== startingFrame || beforeDrag === afterDrag || beforeDrag !== afterReset) {
    throw new Error(`Viewport redraw failed: ${JSON.stringify({ startingFrame, idleFrame, draggedFrame, resetFrame, changed: beforeDrag !== afterDrag, restored: beforeDrag === afterReset })}`);
  }

  await canvas.hover();
  await page.mouse.wheel(0, 120);
  await page.waitForFunction((previous) => Number([...document.querySelectorAll('dt')].find((dt) => dt.textContent === 'Frame')?.nextElementSibling?.textContent) > previous, resetFrame);
  const zoomedFrame = Number(await frame());

  if ((await canvas.evaluate((node) => node.toDataURL())) === afterReset) {
    throw new Error('Wheel zoom did not change the pixels');
  }

  await page.getByRole('button', { name: 'Mount the root instance only' }).click();
  await page.waitForFunction((previous) => Number([...document.querySelectorAll('dt')].find((dt) => dt.textContent === 'Frame')?.nextElementSibling?.textContent) > previous, zoomedFrame);
  const isolatedFrame = Number(await frame());
  const isolatedPixels = await canvas.evaluate((node) => node.toDataURL());

  const contextRestored = await canvas.evaluate((node) => {
    const extension = node.getContext('webgl2')?.getExtension('WEBGL_lose_context');
    extension?.loseContext();
    setTimeout(() => extension?.restoreContext(), 150);

    return extension !== null;
  });

  if (contextRestored) {
    await page.waitForFunction((previous) => Number([...document.querySelectorAll('dt')].find((dt) => dt.textContent === 'Frame')?.nextElementSibling?.textContent) > previous, isolatedFrame);

    if ((await canvas.evaluate((node) => node.toDataURL())) !== isolatedPixels) {
      await canvas.screenshot({ path: `${output}/${label}-restore-failed.png` });
      throw new Error('Context restore changed the isolated scene pixels');
    }
  }

  const result = { ...stats, startingFrame, idleFrame, draggedFrame, resetFrame, zoomedFrame, isolatedFrame, contextRestored };
  await writeFile(`${output}/${label}-metrics.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
