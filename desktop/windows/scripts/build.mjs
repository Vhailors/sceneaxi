#!/usr/bin/env node
/**
 * Stage the existing desktop application and add the Windows-only updater wrapper.
 * The Linux source tree remains untouched and is still the sole implementation of
 * the chrome, bridge, renderer, authoring session, and smoke path.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const existingRoot = resolve(appRoot, "../linux");
const existingDist = join(existingRoot, "dist");
const dist = join(appRoot, "dist");
const stagedEntry = "desktop-main.cjs";

// Run the existing build through this same node binary rather than a pnpm shim:
// on Windows `spawnSync` refuses a `.cmd` target without a shell, so the only
// supported packaging host would fail before esbuild ran.
const built = spawnSync(process.execPath, [join(existingRoot, "scripts/build.mjs")], {
  cwd: existingRoot,
  stdio: "inherit",
});
if (built.error || built.status !== 0) {
  console.error(
    `desktop-windows build FAILED — existing desktop application build failed${
      built.error ? `: ${built.error.message}` : ""
    }`,
  );
  process.exit(built.status ?? 1);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(existingDist, dist, { recursive: true });
if (!existsSync(join(dist, "main.cjs"))) {
  console.error(
    "desktop-windows build FAILED — the existing desktop application produced no dist/main.cjs to stage",
  );
  process.exit(1);
}
renameSync(join(dist, "main.cjs"), join(dist, stagedEntry));

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
