#!/usr/bin/env node
/**
 * Packaged-app smoke: launch the real application with `--smoke` and assert the
 * proof line it prints — handshake, kernel open path with moving digests, the
 * typed edit/review/save/reopen/play round trip, the static Web export, and the
 * renderer's real frame report.
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
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
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
// The authoring round trip is proven by the session's own phases and the document
// bytes, on a scratch project this run created — not by the bridge envelope, which
// carries a refused proposal or failed apply inside `{ok: true}` just the same.
// The app compares the project it bound against its own persistent one (the only
// process that knows that path); the launcher independently checks the directory
// it reports is a temporary one, so neither side can assert isolation alone.
const project = proof.authoring?.project;
if (proof.authoring?.scratchProject !== true) {
  failures.push("authoring proof did not run on a scratch project");
} else if (typeof project !== "string" || !project.startsWith(`${tmpdir()}${sep}`)) {
  failures.push(`authoring proof ran outside the temporary directory: '${project}'`);
}
if (proof.authoring?.proposedPhase !== "reviewing") {
  failures.push(`authoring propose reached phase '${proof.authoring?.proposedPhase}', not 'reviewing'`);
}
if (proof.authoring?.acceptedPhase !== "applied") {
  failures.push(`authoring accept reached phase '${proof.authoring?.acceptedPhase}', not 'applied'`);
}
if (
  proof.authoring?.selected !== true ||
  proof.authoring?.reopened !== true ||
  proof.authoring?.played !== true ||
  proof.authoring?.persisted !== true
) {
  failures.push("authoring did not prove select, save, fresh-session reopen, and Play");
}
if (
  proof.authoring?.initialPropertyValue !== -4.4 ||
  proof.authoring?.reopenedValue !== -3.25 ||
  proof.authoring?.playedTranslation !== -3.25 ||
  proof.authoring?.playedRotationY !== 45 ||
  proof.authoring?.playedScaleZ !== 1.5
) {
  failures.push("the saved transform was not preserved through reopen and Play");
}
if (
  proof.authoring?.addedInstance !== true ||
  proof.authoring?.removeRejected !== true ||
  proof.authoring?.removeApplied !== true ||
  proof.authoring?.undoRestored !== true ||
  proof.authoring?.malformedRefused !== true
) {
  failures.push("add/remove, Reject, Undo, or malformed-input evidence is incomplete");
}
if (
  proof.projectBrowser?.listed !== true ||
  proof.projectBrowser?.selected !== true ||
  proof.projectBrowser?.opened !== true ||
  proof.projectBrowser?.restored !== true ||
  proof.projectBrowser?.activeDocumentPath !== "scene.json" ||
  proof.projectBrowser?.confirmationRefusal !== "DESKTOP_PROJECT_BROWSER_CONFIRMATION_REQUIRED" ||
  proof.projectBrowser?.protectedRefusal !== "DESKTOP_PROJECT_BROWSER_OPERATION_NOT_PERMITTED"
) {
  failures.push("project browser did not prove list/select/open/restart and protected mutation refusals");
}
if (
  proof.ship?.exported !== true ||
  proof.ship?.handoffPresent !== true ||
  typeof proof.ship?.bundleDigest !== "string" ||
  !/^sha256:[0-9a-f]{64}$/.test(proof.ship.bundleDigest) ||
  typeof proof.ship?.sourceDigest !== "string" ||
  !/^sha256:[0-9a-f]{64}$/.test(proof.ship.sourceDigest)
) {
  failures.push("Ship did not produce deterministic bundle and Delivery Handoff digests");
}
if (
  typeof proof.ship?.outputDirectory !== "string" ||
  !proof.ship.outputDirectory.startsWith(`${project}${sep}exports${sep}web${sep}`) ||
  typeof proof.ship?.bundleDigest !== "string" ||
  !proof.ship.outputDirectory.endsWith(
    `${sep}${proof.ship.bundleDigest.slice("sha256:".length)}`,
  )
) {
  failures.push("Ship wrote outside the isolated smoke project's content-addressed Web export root");
}
if (
  proof.playbackDom?.accepted !== true ||
  proof.playbackDom?.state !== "acknowledged" ||
  typeof proof.playbackDom?.frame !== "number"
) {
  failures.push("the packaged viewport did not acknowledge the saved-composition redraw");
}
if (proof.frameReport?.backend !== "three") failures.push("frame report is not the Three core");
// The pixel claim the docs and the site-kit offer carry is only ever this
// observation: a WebGL canvas surface that reported drawing something.
if (proof.frameReport?.surface !== "webgl-canvas") {
  failures.push(`frame report surface is '${proof.frameReport?.surface}', not the webgl-canvas surface`);
}
if (proof.frameReport?.pixelsDrawn !== true) failures.push("frame report does not claim pixelsDrawn");
if (typeof proof.frameReport?.drawCalls !== "number" || proof.frameReport.drawCalls <= 0) {
  failures.push("frame report drew no draw calls");
}
if (proof.viewportDom?.canvases !== 1) failures.push("window DOM does not hold exactly one live canvas");
if (proof.viewportDom?.inertNotePresent !== false) {
  failures.push("inert viewport note still present after a live mount");
}
// The on-surface report line must print the same frame the bridge received —
// otherwise the window could show nothing, or a refusal, while the proof reads clean.
const reportText = proof.viewportDom?.reportText;
if (typeof reportText !== "string" || reportText.length === 0) {
  failures.push("window DOM printed no live viewport report line");
} else if (
  !reportText.includes(`backend ${proof.frameReport?.backend}`) ||
  !reportText.includes(`surface ${proof.frameReport?.surface}`)
) {
  failures.push(`report line does not print the reported frame: '${reportText}'`);
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
  `  authoring: selected transform → ${proof.authoring.proposedPhase} → ${proof.authoring.acceptedPhase}; add/remove Reject+Undo; reopened translation ${proof.authoring.reopenedValue}, rotation ${proof.authoring.playedRotationY}, scale ${proof.authoring.playedScaleZ} → redrawn at frame ${proof.playbackDom.frame}`,
);
console.log(
  `  project browser: list/select/open/restart · ${proof.projectBrowser.confirmationRefusal} · ${proof.projectBrowser.protectedRefusal}`,
);
console.log(
  `  ship: static Web bundle ${proof.ship.bundleDigest} · source ${proof.ship.sourceDigest} · Delivery Handoff present`,
);
console.log(
  `  frame: backend ${proof.frameReport.backend} · surface ${proof.frameReport.surface ?? "unreported"} · pixelsDrawn ${proof.frameReport.pixelsDrawn ?? "unreported"} · drawCalls ${proof.frameReport.drawCalls}`,
);
