#!/usr/bin/env node
/**
 * Packaged-app smoke: launch the real application with `--smoke` and assert the
 * proof line it prints — handshake, kernel open path with moving digests, the
 * authoring propose/accept/undo round trip, and the renderer's real frame report.
 *
 * Two launch modes:
 * - default: `electron dist/main.cjs --smoke` (the built runtime, dev install)
 * - `--packaged`: the unpacked electron-builder output in `release/linux-unpacked`,
 *   which is the same binary the AppImage wraps.
 *
 * Headless hosts (CI) run this under `xvfb-run -a`; without a display server the
 * launcher falls back to Chromium's headless ozone platform so the run still
 * exercises the full main-process path and the renderer bundle.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packaged = process.argv.includes("--packaged");

// SwiftShader keeps WebGL real (a software rasterizer, not a stub) on hosts
// without a usable GPU — the same fallback the recorded umbrella browser
// verification ran on. `pnpm start` is untouched and uses the real GPU.
const args = [
  "--smoke",
  "--no-sandbox",
  "--disable-gpu-sandbox",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
];
if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
  args.push("--ozone-platform=headless");
}

let command;
if (packaged) {
  command = join(appRoot, "release/linux-unpacked/sceneaxi-engine-desktop");
  if (!existsSync(command)) {
    console.error("smoke FAILED — no packaged binary; run `pnpm dist` first");
    process.exit(1);
  }
} else {
  command = join(appRoot, "node_modules/.bin/electron");
  args.unshift(join(appRoot, "dist/main.cjs"));
  if (!existsSync(join(appRoot, "dist/main.cjs"))) {
    console.error("smoke FAILED — no dist/main.cjs; run `pnpm build` first");
    process.exit(1);
  }
}

const result = spawnSync(command, args, {
  cwd: appRoot,
  encoding: "utf8",
  timeout: 120_000,
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: "0" },
});

const stdout = result.stdout ?? "";
const jsonLine = stdout
  .split("\n")
  .filter((line) => line.startsWith("{"))
  .at(-1);

if (result.status !== 0 || jsonLine === undefined) {
  console.error("smoke FAILED — the packaged app did not print its proof line");
  console.error(stdout);
  console.error(result.stderr ?? "");
  process.exit(1);
}

const proof = JSON.parse(jsonLine);
const failures = [];
if (proof.ok !== true) failures.push("proof.ok is not true");
if (proof.handshake?.app !== "@sceneaxi/desktop-linux") failures.push("handshake app wrong");
if (proof.handshake?.runtime !== "electron") failures.push("handshake runtime wrong");
if (!Array.isArray(proof.openPath?.tickDigests) || proof.openPath.tickDigests.length === 0) {
  failures.push("open-path advanced no ticks");
}
if (proof.openPath?.initialDigest === proof.openPath?.tickDigests?.at(-1)) {
  failures.push("open-path digests never moved — kernel session did not advance");
}
if (proof.frameReport?.backend !== "three") failures.push("frame report is not the Three core");
if (typeof proof.frameReport?.drawCalls !== "number") failures.push("frame report has no drawCalls");
if (proof.viewportDom?.canvases !== 1) failures.push("window DOM does not hold exactly one live canvas");
if (proof.viewportDom?.inertNotePresent !== false) {
  failures.push("inert viewport note still present after a live mount");
}

if (failures.length > 0) {
  console.error(`smoke FAILED — ${failures.join("; ")}`);
  console.error(jsonLine);
  process.exit(1);
}

console.log("desktop-linux smoke OK —");
console.log(`  mode: ${packaged ? "packaged (linux-unpacked)" : "built runtime (dist/main.cjs)"}`);
console.log(
  `  open path: ${proof.openPath.tickDigests.length} ticks, digest ${String(proof.openPath.initialDigest).slice(0, 18)}… → ${String(proof.openPath.tickDigests.at(-1)).slice(0, 18)}…`,
);
console.log(
  `  frame: backend ${proof.frameReport.backend} · surface ${proof.frameReport.surface ?? "unreported"} · pixelsDrawn ${proof.frameReport.pixelsDrawn ?? "unreported"} · drawCalls ${proof.frameReport.drawCalls}`,
);
