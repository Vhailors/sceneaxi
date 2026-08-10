#!/usr/bin/env node
/**
 * Build the desktop application's runtime files into `dist/`.
 *
 * Five outputs, all derived from `src/` and the linked workspace packages:
 * - `dist/main.cjs`     — Electron main process (bundled, only `electron` external)
 * - `dist/preload.cjs`  — the context-isolated bridge preload
 * - `dist/renderer.js`  — the live viewport bundle (Three core included)
 * - `dist/index.html`   — the Engine Desktop chrome document with the renderer
 *                         script injected, emitted by `desktopLinuxIndexHtml()`
 * - `dist/sceneaxi-publish-no-replace` — the Linux atomic publisher
 *
 * The workspace keeps source-backed package exports, so esbuild resolves the
 * `link:` dependencies straight to their TypeScript sources — the same resolution
 * strategy the sites tier uses through Next `transpilePackages` (ADR 0018/0024).
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { build } from "esbuild";
import { bundleDesktopRenderer } from "./renderer-bundle.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(appRoot, "dist");
const distBuild = join(appRoot, "dist-build");

rmSync(dist, { recursive: true, force: true });
rmSync(distBuild, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const publisherExecutable = join(dist, "sceneaxi-publish-no-replace");
const publisherBuild = spawnSync(
  process.env["CC"] ?? "cc",
  [
    "-std=c11",
    "-O2",
    "-Wall",
    "-Wextra",
    "-Werror",
    join(appRoot, "src/native/publish-no-replace.c"),
    "-o",
    publisherExecutable,
  ],
  { stdio: "inherit" },
);
if (publisherBuild.status !== 0) {
  throw new Error("desktop-linux no-replace publisher failed to compile");
}

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

await bundleDesktopRenderer({ appRoot, outfile: join(dist, "renderer.js") });

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

// The recorded-build offer must stay out of the build it describes. This tier bundles
// site-kit for its scene payload, so that record is reachable from `main.ts`, and a
// digest shipped inside the artifact it identifies invalidates itself the moment a
// fresh one is recorded. `desktop-app-offer.ts` is annotated `@__PURE__` so esbuild
// drops it; the annotation is checked in the repository gate, but the property is
// only true of emitted bytes, so it is checked here on the bundles esbuild wrote.
const offerEntry = join(distBuild, "recorded-offer.mjs");
await build({
  ...common,
  stdin: {
    contents: 'export { DESKTOP_LINUX_APP_OFFER } from "@sceneaxi/site-kit";\n',
    resolveDir: appRoot,
    loader: "js",
  },
  outfile: offerEntry,
  platform: "node",
  format: "esm",
  target: "node22",
});
const { DESKTOP_LINUX_APP_OFFER } = await import(pathToFileURL(offerEntry).href);
const leaked = [];
for (const file of ["main.cjs", "preload.cjs", "renderer.js"]) {
  const bytes = readFileSync(join(dist, file), "utf8");
  for (const artifact of DESKTOP_LINUX_APP_OFFER.artifacts) {
    if (bytes.includes(artifact.sha256)) leaked.push(`${file} carries the recorded ${artifact.kind} digest`);
    if (bytes.includes(artifact.fileName)) leaked.push(`${file} carries the recorded ${artifact.kind} file name`);
  }
}

rmSync(distBuild, { recursive: true, force: true });

if (leaked.length > 0) {
  console.error(
    `desktop-linux build FAILED — the recorded build record reached the build it describes: ${leaked.join("; ")}`,
  );
  process.exit(1);
}

console.log("desktop-linux build OK — dist/main.cjs, dist/preload.cjs, dist/renderer.js, dist/index.html, dist/sceneaxi-publish-no-replace");
