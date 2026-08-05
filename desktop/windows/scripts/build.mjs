#!/usr/bin/env node
/**
 * Stage the existing desktop application and add the Windows-only updater wrapper.
 * The Linux source tree remains untouched and is still the sole implementation of
 * the chrome, bridge, renderer, authoring session, and smoke path.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const existingRoot = resolve(appRoot, "../linux");
const existingDist = join(existingRoot, "dist");
const dist = join(appRoot, "dist");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const built = spawnSync(pnpm, ["--dir", existingRoot, "build"], {
  cwd: appRoot,
  stdio: "inherit",
});
if (built.status !== 0) {
  console.error("desktop-windows build FAILED — existing desktop application build failed");
  process.exit(built.status ?? 1);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
for (const file of ["main.cjs", "preload.cjs", "renderer.js", "index.html"]) {
  copyFileSync(
    join(existingDist, file),
    join(dist, file === "main.cjs" ? "desktop-main.cjs" : file),
  );
}

await build({
  absWorkingDir: appRoot,
  entryPoints: [join(appRoot, "src/electron/main.ts")],
  outfile: join(dist, "main.cjs"),
  bundle: true,
  logLevel: "info",
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron", "electron-updater"],
});

console.log(
  "desktop-windows build OK — existing desktop runtime staged with Windows updater wrapper",
);
