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
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Native valueOf rejects the wrong primitive without invoking user coercion.
// Identity rejects boxed values; Object.is also preserves the numeric NaN contract.
function smokeText(value) {
  try {
    return Object.is(String.prototype.valueOf.call(value), value);
  } catch {
    return false;
  }
}

function smokeNumber(value) {
  try {
    return Object.is(Number.prototype.valueOf.call(value), value);
  } catch {
    return false;
  }
}

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
  // An explicit local staging directory lets a retry preserve a prior candidate.
  const unpacked = resolve(appRoot, process.env.SCENEAXI_SMOKE_PACKAGED_ROOT ?? "release/linux-unpacked");

  if (!unpacked.startsWith(`${appRoot}${sep}`)) {
    console.error("smoke FAILED — packaged staging directory must remain inside the app root");
    process.exit(1);
  }

  command = join(unpacked, "sceneaxi-engine-desktop");

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

mkdirSync(join(appRoot, "dist-build"), { recursive: true });

const isolatedConfig = mkdtempSync(join(tmpdir(), "sceneaxi-smoke-config-"));

const result = spawnSync(command, args, {
  cwd: appRoot,
  encoding: "utf8",
  timeout: 120_000,
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: "0", XDG_CONFIG_HOME: isolatedConfig, SCENEAXI_LOCAL_CRASH_DUMPS: "0", SCENEAXI_SMOKE_CAPTURE_PATH: resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist-build", packaged ? "smoke-packaged.png" : "smoke-runtime.png") },
});

rmSync(isolatedConfig, { recursive: true, force: true });

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

const capturePath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist-build", packaged ? "smoke-packaged.png" : "smoke-runtime.png");

if (!existsSync(capturePath) || !readFileSync(capturePath).subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
  failures.push("native GUI screenshot is missing or is not a PNG");
}

for (const key of ["newProject", "openProject", "recentProject", "assetImport", "documentReload", "cancel", "timeout", "lateWorkRetired", "hierarchySelection", "save", "undo", "redo", "localAsk", "localBuild", "approvedApply", "play", "exportWeb", "bridgeRebind"]) {
  if (proof.nativeGui?.[key] !== true) failures.push(`native GUI did not prove ${key}`);
}

if (proof.nativeGui?.transform !== -3.5 || proof.nativeGui?.dialogTransport !== "isolated-typed-fixture" || proof.nativeGui?.providerTransport !== "offline-local") failures.push("native GUI proof lacks exact typed input / fixture distinction");

if (proof.security?.cspEnforced !== true || proof.security?.permissionDenied !== true || proof.security?.foreignSenderChannelsDenied !== 6 || proof.security?.rawDumpConsent !== false) failures.push("native security/IPC/privacy predicates missing");

if (proof.performance?.samples?.length !== 12 || proof.performance?.canvases !== 1 || proof.performance?.latencyMs?.some(ms => !Number.isFinite(ms) || ms > 4000)) failures.push("bounded repeated native resource/latency proof absent");

if (proof.performance?.maximumAssetBytes !== 8 * 1024 * 1024 || proof.performance?.oversizeRefusal !== "ASSET_IMPORT_OVERSIZE" || proof.performance?.importReloadCycles !== 12) failures.push("maximum-byte admission / oversize refusal / repeated import-reload proof absent");

if (proof.performance?.teardown?.canvases !== 0 || !(proof.performance?.teardown?.deleted?.Buffer > 0) || !(proof.performance?.teardown?.deleted?.Program > 0) || proof.performance?.teardown?.contextLost !== true) failures.push("native viewport/GPU teardown proof absent (WebGL context must be lost)");

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
} else if (!smokeText(project) || !project.startsWith(`${tmpdir()}${sep}`)) {
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
  !smokeText(proof.projectBrowser?.assetDigest) ||
  !/^sha256:[0-9a-f]{64}$/.test(proof.projectBrowser.assetDigest) ||
  !smokeNumber(proof.projectBrowser?.assetFrame) ||
  !smokeText(proof.projectBrowser?.assetPath) ||
  !/^assets\/[a-z0-9][a-z0-9-]{0,63}\.gltf$/.test(proof.projectBrowser.assetPath) ||
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
  !smokeText(proof.ship?.bundleDigest) ||
  !/^sha256:[0-9a-f]{64}$/.test(proof.ship.bundleDigest) ||
  !smokeText(proof.ship?.sourceDigest) ||
  !/^sha256:[0-9a-f]{64}$/.test(proof.ship.sourceDigest)
) {
  failures.push("Ship did not produce deterministic bundle and Delivery Handoff digests");
}

if (
  !smokeText(proof.ship?.outputDirectory) ||
  !proof.ship.outputDirectory.startsWith(`${project}${sep}exports${sep}web${sep}`) ||
  !smokeText(proof.ship?.bundleDigest) ||
  !proof.ship.outputDirectory.endsWith(
    `${sep}${proof.ship.bundleDigest.slice("sha256:".length)}`,
  )
) {
  failures.push("Ship wrote outside the isolated smoke project's content-addressed Web export root");
}

if (
  proof.playbackDom?.accepted !== true ||
  proof.playbackDom?.state !== "acknowledged" ||
  !smokeNumber(proof.playbackDom?.frame)
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

if (!smokeNumber(proof.frameReport?.drawCalls) || proof.frameReport.drawCalls <= 0) {
  failures.push("frame report drew no draw calls");
}

if (proof.viewportDom?.canvases !== 1) failures.push("window DOM does not hold exactly one live canvas");

if (proof.viewportDom?.inertNotePresent !== false) {
  failures.push("inert viewport note still present after a live mount");
}

// The on-surface report line must print the same frame the bridge received —
// otherwise the window could show nothing, or a refusal, while the proof reads clean.
const reportText = proof.viewportDom?.reportText;

if (!smokeText(reportText) || reportText.length === 0) {
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

writeFileSync(join(appRoot, "dist-build", packaged ? "smoke-packaged-proof.json" : "smoke-runtime-proof.json"), `${JSON.stringify(proof, null, 2)}\n`);

console.log("desktop-linux smoke OK —");

console.log(`  mode: ${packaged ? "packaged (linux-unpacked)" : "built runtime (dist/main.cjs)"}`);

console.log(
  `  open path: ${proof.openPath.tickDigests.length} ticks, digest ${String(proof.openPath.initialDigest).slice(0, 18)}… → ${String(proof.openPath.tickDigests.at(-1)).slice(0, 18)}…`,
);

console.log(
  `  authoring: selected transform → ${proof.authoring.proposedPhase} → ${proof.authoring.acceptedPhase}; add/remove Reject+Undo; reopened translation ${proof.authoring.reopenedValue}, rotation ${proof.authoring.playedRotationY}, scale ${proof.authoring.playedScaleZ} → redrawn at frame ${proof.playbackDom.frame}`,
);

console.log(
  `  project browser: list/select/open/restart ${proof.projectBrowser.assetPath} · ${proof.projectBrowser.confirmationRefusal} · ${proof.projectBrowser.protectedRefusal}`,
);

console.log(
  `  ship: static Web bundle ${proof.ship.bundleDigest} · source ${proof.ship.sourceDigest} · Delivery Handoff present`,
);

console.log(
  `  frame: backend ${proof.frameReport.backend} · surface ${proof.frameReport.surface ?? "unreported"} · pixelsDrawn ${proof.frameReport.pixelsDrawn ?? "unreported"} · drawCalls ${proof.frameReport.drawCalls}`,
);
