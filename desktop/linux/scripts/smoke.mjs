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

const cliEntrypoint = resolve(appRoot, "../../packages/cli/bin/sceneaxi.mjs");

for (const required of [cliEntrypoint, resolve(appRoot, "../../packages/cli/dist/src/run.js"), resolve(appRoot, "../../packages/cli/dist/src/desktop-socket-worker.js")]) {
  if (!existsSync(required)) {
    console.error("smoke FAILED — missing built workspace CLI/worker; run the workspace CLI build preflight first: " + required);
    process.exit(1);
  }
}

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
  // Wall-clock allowance for a loaded host; every assertion below is unchanged.
  timeout: 240_000,
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: "0", SCENEAXI_CLI_ENTRYPOINT: cliEntrypoint, XDG_CONFIG_HOME: isolatedConfig, SCENEAXI_LOCAL_CRASH_DUMPS: "0", SCENEAXI_SMOKE_CAPTURE_PATH: resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist-build", packaged ? "smoke-packaged.png" : "smoke-runtime.png") },
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

const features = proof.features;

for (const feature of Array.from({ length: 17 }, (_, index) => `#${index + 254}`)) {
  if (features?.[feature] === undefined) failures.push(`proof.features is missing ${feature}`);
}

for (const [feature, title] of [
  ["#260", "physics-inspect"], ["#262", "package-inspect"],
  ["#265", "workspace-layout-inspect"], ["#269", "extension-inspect"],
]) {
  // #262 and #269 also carry their command-form proofs; the catalog inspection
  // the feature pass performed sits beside them.
  const result = feature === "#262" || feature === "#269" ? features?.[feature]?.catalogInspect : features?.[feature];

  if (result?.gui !== true || result?.completed !== true ||
      result?.title !== title || result?.code !== "COMMAND_COMPLETED") {
    failures.push(`${feature} GUI action did not complete ${title} with COMMAND_COMPLETED`);
  }
}

if (features?.["#263"]?.gui !== true || features["#263"].completed !== true ||
    features["#263"].code !== "PROJECT_GIT_EVIDENCE" ||
    features["#263"].stage?.completed !== true ||
    features["#263"].stage?.code !== "PROJECT_GIT_EVIDENCE" ||
    !smokeText(features["#263"].selectedPath) || features["#263"].selectedPath.length === 0) {
  failures.push("#263 did not complete GUI Git status, diff, and staging of a selected scratch-project path");
}

const stagedGitState = JSON.parse(features?.["#263"]?.stage?.message ?? "{}");

if (stagedGitState.kind !== "sceneaxi.project-git-state" ||
    !stagedGitState.entries?.some((entry) => entry.path === features["#263"].selectedPath && entry.index === "A") ||
    stagedGitState.stagedDiffPresent !== true) {
  failures.push("#263 staged Git evidence does not show the exact GUI-selected scratch path in the index");
}

if (features?.["#266"]?.gui !== true || features["#266"].completed !== true ||
    features["#266"].code !== "PROJECT_BUILD_SIGNING_MISSING") {
  failures.push("#266 did not report the named Linux project-build signing refusal");
}

if (features?.["#270"]?.gui !== true || features["#270"].completed !== true ||
    features["#270"].code !== "COMMAND_COMPLETED") {
  failures.push("#270 profile inspection did not complete through the GUI");
}

const profileEvidence = JSON.parse(features?.["#270"]?.message ?? "{}");

if (features?.["#264"]?.gui !== true || features["#264"].state !== "profile-evidence" ||
    features["#264"].digest !== profileEvidence.digest) {
  failures.push("#264 did not retain the exact digest of GUI-measured profile evidence");
}

const measuredDrawCalls = profileEvidence.metrics?.find((metric) => metric.id === "draw-calls");

if (profileEvidence.kind !== "sceneaxi.profile-evidence" || profileEvidence.savedBytesWritten !== false ||
    profileEvidence.digest !== features?.["#264"]?.digest ||
    profileEvidence.sourceContentHash !== features?.["#270"]?.projectDigestAtProfile ||
    measuredDrawCalls?.status !== "measured" || !smokeNumber(measuredDrawCalls.value) || measuredDrawCalls.value <= 0 ||
    measuredDrawCalls.value !== features?.["#270"]?.drawCallsAtProfile ||
    !smokeText(profileEvidence.digest) || !/^sha256:[0-9a-f]{64}$/.test(profileEvidence.digest)) {
  failures.push("#270 profile evidence lacks the matching source digest and measured presentation draw-call count");
}

const prefabProof = features?.["#255"];

if (prefabProof?.gui !== true || prefabProof.state !== "prefab-define-instance-override-refresh-accepted" ||
    prefabProof.define?.result?.code !== "COMMAND_COMPLETED" || prefabProof.define?.unchangedBeforeAccept !== true ||
    prefabProof.define?.changed !== true || prefabProof.define?.definitionId !== "smoke-prefab" ||
    !/^sha256:[0-9a-f]{64}$/.test(prefabProof.define?.digestBefore ?? "") ||
    !/^sha256:[0-9a-f]{64}$/.test(prefabProof.define?.digestAfter ?? "") || prefabProof.define.digestBefore === prefabProof.define.digestAfter ||
    prefabProof.inspect?.code !== "COMMAND_COMPLETED" || prefabProof.inspect?.definitionId !== "smoke-prefab" ||
    prefabProof.instance?.result?.code !== "COMMAND_COMPLETED" || prefabProof.instance?.unchangedBeforeAccept !== true ||
    prefabProof.instance?.changed !== true || prefabProof.instance?.instanceKey !== "smoke-copy" ||
    !/^sha256:[0-9a-f]{64}$/.test(prefabProof.instance?.digestBefore ?? "") ||
    !/^sha256:[0-9a-f]{64}$/.test(prefabProof.instance?.digestAfter ?? "") || prefabProof.instance.digestBefore === prefabProof.instance.digestAfter ||
    prefabProof.override?.result?.code !== "COMMAND_COMPLETED" || prefabProof.override?.unchangedBeforeAccept !== true ||
    prefabProof.override?.changed !== true || prefabProof.override?.value !== 2.75 ||
    !/^sha256:[0-9a-f]{64}$/.test(prefabProof.override?.digestBefore ?? "") ||
    !/^sha256:[0-9a-f]{64}$/.test(prefabProof.override?.digestAfter ?? "") || prefabProof.override.digestBefore === prefabProof.override.digestAfter ||
    prefabProof.refresh?.result?.code !== "COMMAND_COMPLETED" || prefabProof.refresh?.unchangedBeforeAccept !== true ||
    prefabProof.refresh?.changed !== true || prefabProof.refresh?.stale !== false ||
    !/^sha256:[0-9a-f]{64}$/.test(prefabProof.refresh?.digestAfter ?? "")) {
  failures.push("#255 GUI prefab define/inspect/instance/override/refresh did not preserve review boundaries and persist the expected catalog");
}

const inputActionProof = features?.["#257"];

if (inputActionProof?.gui !== true || inputActionProof.state !== "input-actions-inspected-rebound-and-reset" ||
    inputActionProof.inspectCode !== "COMMAND_COMPLETED" || inputActionProof.actionId !== "editor.project.save" ||
    inputActionProof.reviewCode !== "COMMAND_COMPLETED" || inputActionProof.bindingPersisted !== true ||
    inputActionProof.unchangedBeforeReview !== true || inputActionProof.resetReviewCode !== "COMMAND_COMPLETED" ||
    inputActionProof.resetUnchangedBeforeReview !== true || inputActionProof.resetPersistedChangedBytes !== true ||
    !/^sha256:[0-9a-f]{64}$/.test(inputActionProof.resetDigestBefore ?? "") ||
    !/^sha256:[0-9a-f]{64}$/.test(inputActionProof.finalDigest ?? "") || inputActionProof.resetDigestBefore === inputActionProof.finalDigest) {
  failures.push("#257 GUI input-action inspect/rebind/reset did not persist only after explicit form review");
}

for (const [feature, state] of [["#267", "unsupported-host-macos"], ["#268", "unsupported-host-windows"]]) {
  if (features?.[feature]?.gui !== false || features?.[feature]?.state !== state) {
    failures.push(`${feature} did not record the expected host artifact absence`);
  }
}

const animationEvaluation = features?.["#259"]?.evaluation ?? "";

if (features?.["#259"]?.gui !== true || features["#259"].state !== "animation-applied-and-evaluated" ||
    features["#259"].staged !== true || features["#259"].unchangedBeforeAccept !== true ||
    JSON.stringify(features["#259"].mutation) !== JSON.stringify({ clipId: "smoke-idle", name: "Smoke Idle", durationMs: 1200 }) ||
    !/^sha256:[0-9a-f]{64}$/.test(features["#259"].digestAfterAccept ?? "") ||
    !animationEvaluation.includes('"kind": "sceneaxi.scene-animation-evaluation"') ||
    !animationEvaluation.includes(`"sourceContentHash": "${features?.["#259"]?.digestAfterAccept}"`) ||
    animationEvaluation.includes("ANIMATION_STALE_VERSION")) {
  failures.push("#259 GUI animation apply did not persist changed bytes and evaluate the new content version");
}

if (features?.["#261"]?.gui !== true || features["#261"].completed !== true ||
    features["#261"].state !== "Rarity proposal staged · review the canonical diff before Accept or Reject.") {
  failures.push("#261 did not stage the fixture-provider proposal through the GUI");
}

const physicsCatalog = JSON.parse(features?.["#260"]?.message ?? "{}");

if (physicsCatalog.kind !== "sceneaxi.scene-physics-inspection" ||
    physicsCatalog.catalog?.world?.gravityY !== -10.25 || physicsCatalog.savedBytesWritten !== false ||
    features?.["#260"]?.applied !== true || features["#260"].unchangedBeforeAccept !== true ||
    !/^sha256:[0-9a-f]{64}$/.test(features["#260"].digestAfterAccept ?? "")) {
  failures.push("#260 physics inspection did not prove GUI staging and accepted world gravity in changed scratch bytes");
}

const packageCatalog = JSON.parse(features?.["#262"]?.catalogInspect?.message ?? "{}");

if (packageCatalog.kind !== "sceneaxi.scene-package-inspection" ||
    packageCatalog.catalog?.lock?.length !== 0 || packageCatalog.marketplace !== false ||
    packageCatalog.networking !== false || packageCatalog.lockDigest !== "sha256:4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945") {
  failures.push("#262 package inspection did not report the empty offline lock and stable digest");
}

if (features?.["#265"]?.apply?.completed !== true ||
    features["#265"].apply.title !== "workspace-layout-apply" ||
    features["#265"].apply.code !== "COMMAND_COMPLETED" ||
    features["#265"].reset?.completed !== true ||
    features["#265"].reset.title !== "workspace-layout-reset" ||
    features["#265"].reset.code !== "COMMAND_COMPLETED" ||
    !features["#265"].apply.message.includes('"digest": "sha256:f3f0de7196e1157ed2412ca87ef74c496ff0efeaa62ecf1c14d0e0ff4af8e544"') ||
    !features["#265"].reset.message.includes('"digest": "sha256:5636d88918f6eb20650a18388061eed50c5bd030bfd305d9ade5ffd8d8ebd361"')) {
  failures.push("#265 workspace layout apply/reset did not persist and restore the expected scratch-project digests");
}

if (features?.["#256"]?.gui !== true || features["#256"].state !== "gui-import-source-edit-reload-reimport" ||
    features["#256"].importedPath !== "assets/smoke-gui-source.gltf" ||
    features["#256"].importedRevisionPath !== "assets/smoke-gui-source-revision-2.gltf" ||
    features["#256"].reloadCompleted !== true || features["#256"].unchangedBeforeAccept !== true ||
    !/^sha256:[0-9a-f]{64}$/.test(features["#256"].initialDigest ?? "") ||
    !/^sha256:[0-9a-f]{64}$/.test(features["#256"].editedDigest ?? "") ||
    features["#256"].initialDigest === features["#256"].editedDigest ||
    proof.projectBrowser?.selected !== true || proof.projectBrowser?.opened !== true) {
  failures.push("#256 GUI import/reload did not preserve pre-Accept bytes and change the selected asset manifest digest after source revision");
}

if (features?.["#254"]?.gui !== true || features["#254"].state !== "scene-property-staged-and-accepted" ||
    features["#254"].selectedEntity !== "desktop-crate-beside" || features["#254"].transformMode !== "rotate" ||
    features["#254"].snapIncrement !== "0.1" ||
    features["#254"].staged !== true || features["#254"].unchangedBeforeAccept !== true ||
    features["#254"].valueBefore !== -3.25 || features["#254"].valueAfter !== -3.05 ||
    !/^sha256:[0-9a-f]{64}$/.test(features["#254"].digestBeforeAccept ?? "") ||
    !/^sha256:[0-9a-f]{64}$/.test(features["#254"].digestAfterAccept ?? "") ||
    features["#254"].digestBeforeAccept === features["#254"].digestAfterAccept) {
  failures.push("#254 GUI entity selection, inspector stage, pre-Accept immutability, or persisted transform digest was wrong");
}

const viewportSource = features?.["#258"]?.sourceSet;

if (viewportSource?.gui !== true || viewportSource.state !== "viewport-source-set-completed" ||
    viewportSource.source !== "scene" || viewportSource.code !== "COMMAND_COMPLETED" ||
    viewportSource.authoringBytesUnchanged !== true || !/^sha256:[0-9a-f]{64}$/.test(viewportSource.digest ?? "")) {
  failures.push("#258 viewport-source-set did not complete through the GUI without changing authoring bytes");
}

const physicsEvaluation = features?.["#260"]?.evaluate;

if (physicsEvaluation?.gui !== true || physicsEvaluation.code !== "COMMAND_COMPLETED" ||
    physicsEvaluation.kind !== "sceneaxi.scene-physics-evaluation" || physicsEvaluation.steps !== 1 || physicsEvaluation.finalStep !== 1 ||
    physicsEvaluation.authoringBytesUnchanged !== true || !/^sha256:[0-9a-f]{64}$/.test(physicsEvaluation.digest ?? "")) {
  failures.push("#260 physics-evaluate did not return the one-step GUI evaluation without writing project bytes");
}

const packageProof = features?.["#262"];

if (packageProof?.gui !== true || packageProof.state !== "package-installed-inspected-and-removed" ||
    packageProof.install?.result?.code !== "COMMAND_COMPLETED" || packageProof.install?.unchangedBeforeAccept !== true ||
    packageProof.install?.changed !== true || packageProof.install?.pluginId !== "dev.sceneaxi.sample.intake-source" ||
    !/^sha256:[0-9a-f]{64}$/.test(packageProof.install?.digestBefore ?? "") ||
    !/^sha256:[0-9a-f]{64}$/.test(packageProof.install?.digestAfter ?? "") || packageProof.install.digestBefore === packageProof.install.digestAfter ||
    packageProof.install?.persisted !== true || packageProof.inspect?.code !== "COMMAND_COMPLETED" ||
    packageProof.inspect?.packageId !== "dev.sceneaxi.sample.intake-source" ||
    packageProof.remove?.result?.code !== "COMMAND_COMPLETED" || packageProof.remove?.unchangedBeforeAccept !== true ||
    packageProof.remove?.changed !== true || packageProof.remove?.persistedRemoved !== true ||
    !/^sha256:[0-9a-f]{64}$/.test(packageProof.remove?.digestBefore ?? "") ||
    !/^sha256:[0-9a-f]{64}$/.test(packageProof.remove?.digestAfter ?? "") || packageProof.remove.digestBefore === packageProof.remove.digestAfter) {
  failures.push("#262 GUI package install/inspect/remove did not persist the reviewed package lifecycle");
}

const migrationProof = features?.["#263"]?.migration;

if (migrationProof?.gui !== true || migrationProof.state !== "legacy-project-migrated" ||
    migrationProof.proposalCode !== "COMMAND_COMPLETED" || migrationProof.commitCode !== "COMMAND_COMPLETED" ||
    migrationProof.sourceBytesUnchanged !== true || migrationProof.manifestPersisted !== true ||
    !/^sha256:[0-9a-f]{64}$/.test(migrationProof.digest ?? "")) {
  failures.push("#263 project-migration-commit did not migrate a GUI-opened legacy scratch project");
}

const extensionProof = features?.["#269"];

if (extensionProof?.gui !== true || extensionProof.state !== "inspected-seam-refused-without-adapter" ||
    extensionProof.inspectCode !== "COMMAND_COMPLETED" || extensionProof.seamId !== "networking" ||
    extensionProof.code !== "EXTENSION_ADAPTER_ABSENT" || extensionProof.authoringBytesUnchanged !== true ||
    !/^sha256:[0-9a-f]{64}$/.test(extensionProof.digest ?? "")) {
  failures.push("#269 extension-start did not report the named absent-adapter refusal for the inspected seam");
}

if (features?.["#258"]?.state !== "acknowledged" || !smokeNumber(features["#258"]?.frame) ||
    !features["#258"].stop.startsWith("Stopped ·") || !features["#258"].reset.startsWith("Reset ·") ||
    !features["#258"].stop.includes('"state":"stopped"') ||
    !features["#258"].reset.includes('"state":"playing"') ||
    !features["#258"].reset.includes('"authoringBytesUnchanged":true')) {
  failures.push("#258 GUI Play/Stop/Reset did not produce viewport acknowledgement and named run statuses");
}


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

const newer = proof.newerEditor;

for (const key of ["hierarchyCreated", "hierarchyReparented", "transformApplied", "playStarted", "playStopped", "playReset", "physicsReviewed", "animationReviewed", "cliHandshake"]) {
  if (newer?.[key] !== true) failures.push("historical editor smoke did not prove " + key);
}

if (newer?.hierarchySourceId !== "desktop-crate-beside" || newer?.hierarchyCopyId !== "desktop-crate-beside-copy-1" ||
    newer?.persistedParent !== "desktop-crate-stacked" || !Number.isFinite(newer?.initialY) ||
    newer?.reopenedY !== newer.initialY + 0.5 || newer?.physicsBodyId !== "smoke-body") {
  failures.push("historical nonroot reparent/persisted parent/Y/named-body proof is incomplete");
}

if (newer?.cli?.connected !== true || newer?.cli?.tool !== "sceneaxi.bridge.handshake" ||
    newer?.cli?.response?.app !== "@sceneaxi/desktop-linux" || newer?.cli?.response?.localProtocolVersion !== 1 ||
    newer?.cli?.response?.creditRoute !== "none") failures.push("actual child CLI handshake envelope is incomplete");

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

if (
  proof.audioProof?.duration !== 2 ||
  proof.audioProof?.sampleRate !== 44100 ||
  proof.audioProof?.channels !== 1 ||
  !smokeNumber(proof.audioProof?.volume) || proof.audioProof.volume < 0.3 || proof.audioProof.volume > 0.4 ||
  !smokeNumber(proof.audioProof?.gain) || proof.audioProof.gain < 0.3 || proof.audioProof.gain > 0.4 ||
  proof.audioProof?.pointerTargets?.volume !== true || proof.audioProof?.pointerTargets?.play !== true ||
  proof.audioProof?.sourceStarted !== true ||
  !smokeNumber(proof.audioProof?.offlineRms) || proof.audioProof.offlineRms <= 0.01 ||
  !smokeNumber(proof.audioProof?.liveRms) || proof.audioProof.liveRms < 0.07 || proof.audioProof.liveRms > 0.11 ||
  // The live level must follow the pointer-set gain: within 25% of gain × the clip's full-scale RMS.
  Math.abs(proof.audioProof.liveRms - proof.audioProof.gain * proof.audioProof.offlineRms) >
    0.25 * proof.audioProof.gain * proof.audioProof.offlineRms ||
  !smokeNumber(proof.audioProof?.stoppedRms) || proof.audioProof.stoppedRms > 0.01 ||
  proof.audioProof?.stopped !== true ||
  proof.audioProof?.contextDisposed !== true ||
  proof.audioProof?.resetStopped !== true ||
  proof.audioProof?.decodeRefused !== true ||
  proof.audioProof?.kidsSwitchStopped !== true ||
  proof.audioProof?.projectSwitchStopped !== true
) {
  failures.push("renderer audio proof did not decode, start, render non-silence, and stop the ingested WAV");
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
  console.error(`feature proof: ${JSON.stringify(features)}`);
  console.error(jsonLine);
  process.exit(1);
}

writeFileSync(join(appRoot, "dist-build", packaged ? "smoke-packaged-proof.json" : "smoke-runtime-proof.json"), `${JSON.stringify(proof, null, 2)}\n`);

console.log("desktop-linux smoke OK —");

console.log(`  mode: ${packaged ? "packaged (linux-unpacked)" : "built runtime (dist/main.cjs)"}`);

const hostAbsent = Object.entries(features).filter(([, entry]) => entry?.gui === false).map(([feature]) => feature);

console.log(`  features: ${Object.keys(features).length} issue entries asserted through the GUI; host-absent: ${hostAbsent.join(", ") || "none"}`);

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
  `  audio: ${proof.audioProof.duration}s · ${proof.audioProof.sampleRate} Hz · ${proof.audioProof.channels} channel · source started · live RMS ${proof.audioProof.liveRms.toFixed(4)} → ${proof.audioProof.stoppedRms.toFixed(4)} after Stop · real pointer hit-tested controls · decode refusal named · Stop/Reset/Kids/project switch stopped and disposed the context`,
);

console.log(
  `  frame: backend ${proof.frameReport.backend} · surface ${proof.frameReport.surface ?? "unreported"} · pixelsDrawn ${proof.frameReport.pixelsDrawn ?? "unreported"} · drawCalls ${proof.frameReport.drawCalls}`,
);
