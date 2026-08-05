#!/usr/bin/env node
/**
 * Configuration smoke on every host; packaged application smoke on macOS.
 *
 * The default mode deliberately removes all operator inputs and proves the release
 * command refuses them by name before electron-builder can run. `--packaged`
 * verifies the already signed/stapled bundle, its checksums, and its real runtime.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packaged = process.argv.includes("--packaged");
const releaseInputs = [
  "CSC_LINK",
  "CSC_KEY_PASSWORD",
  "APPLE_ID",
  "APPLE_APP_SPECIFIC_PASSWORD",
  "APPLE_TEAM_ID",
  "SCENEAXI_MACOS_RELEASE_BASE_URL",
];

const fail = (message) => {
  console.error(`desktop-macos smoke FAILED — ${message}`);
  process.exit(1);
};

if (!packaged) {
  const config = readFileSync(join(appRoot, "electron-builder.yml"), "utf8");
  for (const required of [
    "hardenedRuntime: true",
    "notarize: true",
    "target: dmg",
    "target: zip",
    "universal",
  ]) {
    if (!config.includes(required)) fail(`packaging config lacks '${required}'`);
  }
  if (/^publish:/m.test(config)) fail("packaging config can publish implicitly");
  if (!existsSync(join(appRoot, "entitlements.mac.plist"))) {
    fail("packaging config references no tracked entitlements file");
  }

  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !releaseInputs.includes(name)),
  );
  const result = spawnSync(process.execPath, [join(appRoot, "scripts/dist.mjs"), "--preflight-only"], {
    cwd: appRoot,
    encoding: "utf8",
    env,
  });
  if (result.status !== 1) fail(`missing-input preflight exited ${result.status}, not 1`);
  for (const name of releaseInputs) {
    if (!result.stderr.includes(`MACOS_ENV_REQUIRED:${name}`)) {
      fail(`missing-input preflight did not refuse ${name}`);
    }
  }

  console.log("desktop-macos smoke OK — packaging config valid; missing signing/notarization/update inputs refused");
  process.exit(0);
}

if (process.platform !== "darwin") fail("--packaged requires macOS");
const release = join(appRoot, "release");
const checksumsPath = join(release, "SHA256SUMS");
const manifestPath = join(release, "desktop-macos-release.json");
const updatePath = join(release, "latest-mac.yml");
for (const path of [checksumsPath, manifestPath, updatePath]) {
  if (!existsSync(path)) fail(`release proof file is absent: ${path}`);
}
for (const line of readFileSync(checksumsPath, "utf8").trim().split("\n")) {
  const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(line);
  if (match === null) fail(`invalid SHA256SUMS line: ${line}`);
  const actual = createHash("sha256").update(readFileSync(join(release, match[2]))).digest("hex");
  if (actual !== match[1]) fail(`checksum mismatch for ${match[2]}`);
}

const appBundle = join(release, "mac-universal", "SceneAxi Engine Desktop.app");
for (const [command, args] of [
  ["codesign", ["--verify", "--deep", "--strict", "--verbose=2", appBundle]],
  ["spctl", ["--assess", "--type", "execute", "--verbose=2", appBundle]],
  ["xcrun", ["stapler", "validate", appBundle]],
]) {
  const result = spawnSync(command, args, { cwd: appRoot, stdio: "inherit" });
  if (result.status !== 0) fail(`${command} verification failed`);
}

const executable = join(appBundle, "Contents/MacOS/sceneaxi-engine-desktop");
const result = spawnSync(executable, ["--smoke"], {
  cwd: appRoot,
  encoding: "utf8",
  timeout: 120_000,
});
const proofLine = (result.stdout ?? "")
  .split("\n")
  .filter((line) => line.startsWith("{"))
  .at(-1);
if (result.status !== 0 || proofLine === undefined) {
  fail(`packaged application emitted no successful proof line\n${result.stderr ?? ""}`);
}
const proof = JSON.parse(proofLine);
if (proof.ok !== true || proof.frameReport?.pixelsDrawn !== true) {
  fail("packaged application did not prove its real desktop runtime and pixel surface");
}

console.log("desktop-macos smoke OK — signed/stapled universal package launched the existing desktop runtime");
