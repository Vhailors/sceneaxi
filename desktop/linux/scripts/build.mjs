#!/usr/bin/env node
/**
 * Build the desktop application's runtime files into `dist/`.
 *
 * Four outputs, all derived from `src/` and the linked workspace packages:
 * - `dist/main.cjs`     — Electron main process (bundled, only `electron` external)
 * - `dist/preload.cjs`  — the context-isolated bridge preload
 * - `dist/renderer.js`  — the live viewport bundle (Three core included)
 * - `dist/index.html`   — the Engine Desktop chrome document with the renderer
 *                         script injected, emitted by `desktopLinuxIndexHtml()`
 *
 * The workspace keeps source-backed package exports, so esbuild resolves the
 * `link:` dependencies straight to their TypeScript sources — the same resolution
 * strategy the sites tier uses through Next `transpilePackages` (ADR 0018/0024).
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { build } from "esbuild";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(appRoot, "dist");
const distBuild = join(appRoot, "dist-build");

rmSync(dist, { recursive: true, force: true });
rmSync(distBuild, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const common = {
  bundle: true,
  logLevel: "info",
  absWorkingDir: appRoot,
};

// Main process: node platform, CJS entry, Electron itself stays external.
await build({
  ...common,
  entryPoints: [join(appRoot, "src/electron/main.ts")],
  outfile: join(dist, "main.cjs"),
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
});

// Preload: runs sandboxed, so everything except `electron` must be inlined.
await build({
  ...common,
  entryPoints: [join(appRoot, "src/electron/preload.ts")],
  outfile: join(dist, "preload.cjs"),
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
});

// Renderer: browser platform; the Three presentation core bundles in.
await build({
  ...common,
  entryPoints: [join(appRoot, "src/renderer/viewport.ts")],
  outfile: join(dist, "renderer.js"),
  platform: "browser",
  format: "iife",
  target: "es2022",
});

// The chrome document: bundle the emitter, import it, write the bytes.
await build({
  ...common,
  entryPoints: [join(appRoot, "src/lib/chrome-document.ts")],
  outfile: join(distBuild, "chrome-document.mjs"),
  platform: "node",
  format: "esm",
  target: "node22",
});
const { desktopLinuxIndexHtml } = await import(
  pathToFileURL(join(distBuild, "chrome-document.mjs")).href
);
writeFileSync(join(dist, "index.html"), desktopLinuxIndexHtml());
rmSync(distBuild, { recursive: true, force: true });

console.log("desktop-linux build OK — dist/main.cjs, dist/preload.cjs, dist/renderer.js, dist/index.html");
