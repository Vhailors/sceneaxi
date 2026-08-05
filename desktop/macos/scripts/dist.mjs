#!/usr/bin/env node
/**
 * Build the macOS release candidate from the existing desktop application.
 *
 * This is deliberately a release command, not an unsigned packaging shortcut:
 * it refuses before building unless the operator supplies signing, notarization,
 * and HTTPS update-location inputs and the macOS tools exist. electron-builder is
 * always invoked with `--publish never`; this repository never creates a release.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  accessSync,
  constants,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const release = join(appRoot, "release");
const requiredEnvironment = Object.freeze([
  "CSC_LINK",
  "CSC_KEY_PASSWORD",
  "APPLE_ID",
  "APPLE_APP_SPECIFIC_PASSWORD",
  "APPLE_TEAM_ID",
  "SCENEAXI_MACOS_RELEASE_BASE_URL",
]);
const requiredTools = Object.freeze(["codesign", "hdiutil", "security", "spctl", "xcrun"]);
const { version } = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8"));

const executableExists = (name) => {
  for (const entry of (process.env.PATH ?? "").split(delimiter)) {
    if (entry.length === 0) continue;
    try {
      accessSync(join(entry, name), constants.X_OK);
      return true;
    } catch {
      // Continue through PATH without exposing it in refusal output.
    }
  }
  return false;
};

const refusals = [];
if (process.platform !== "darwin") refusals.push("MACOS_HOST_REQUIRED");
if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)*$/.test(version)) {
  refusals.push("MACOS_RELEASE_VERSION_INVALID");
}
for (const name of requiredEnvironment) {
  if (process.env[name] === undefined || process.env[name]?.trim() === "") {
    refusals.push(`MACOS_ENV_REQUIRED:${name}`);
  }
}
const baseUrl = process.env.SCENEAXI_MACOS_RELEASE_BASE_URL;
if (baseUrl !== undefined && baseUrl.trim() !== "") {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "https:") refusals.push("MACOS_UPDATE_HTTPS_REQUIRED");
  } catch {
    refusals.push("MACOS_UPDATE_URL_INVALID");
  }
}
for (const tool of requiredTools) {
  if (!executableExists(tool)) refusals.push(`MACOS_TOOL_REQUIRED:${tool}`);
}
if (process.platform === "darwin" && executableExists("xcrun")) {
  for (const tool of ["notarytool", "stapler"]) {
    const found = spawnSync("xcrun", ["--find", tool], { stdio: "ignore" });
    if (found.status !== 0) refusals.push(`MACOS_XCRUN_TOOL_REQUIRED:${tool}`);
  }
}

if (refusals.length > 0) {
  console.error("desktop-macos dist REFUSED");
  for (const refusal of refusals.sort()) console.error(`  ${refusal}`);
  process.exit(1);
}
if (process.argv.includes("--preflight-only")) {
  console.log("desktop-macos release preflight OK");
  process.exit(0);
}

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: appRoot,
    stdio: "inherit",
    env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "true" },
  });
  if (result.status !== 0) {
    console.error(`desktop-macos dist FAILED at: ${command} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
};

run(process.execPath, [join(appRoot, "scripts/build.mjs")]);
run(join(appRoot, "node_modules/.bin/electron-builder"), ["--mac", "--publish", "never"]);

const artifacts = readdirSync(release)
  .filter((name) => name.endsWith(".dmg") || name.endsWith(".zip"))
  .sort();
const artifactStem = `SceneAxi-Engine-Desktop-${version}-macos-universal`;
const expected = [`${artifactStem}.dmg`, `${artifactStem}.zip`];
if (JSON.stringify(artifacts) !== JSON.stringify(expected)) {
  console.error(
    `desktop-macos dist FAILED — expected ${expected.join(", ")} but artifacts are ${artifacts.join(", ")}`,
  );
  process.exit(1);
}

const appBundle = join(release, "mac-universal", "SceneAxi Engine Desktop.app");
if (!existsSync(appBundle)) {
  console.error("desktop-macos dist FAILED — universal app bundle is absent");
  process.exit(1);
}
run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appBundle]);
run("spctl", ["--assess", "--type", "execute", "--verbose=2", appBundle]);
run("xcrun", ["stapler", "validate", appBundle]);

const releaseBase = `${baseUrl.trim().replace(/\/$/, "")}/`;
const hash = (algorithm, name, encoding) =>
  createHash(algorithm).update(readFileSync(join(release, name))).digest(encoding);
const artifactRecords = artifacts.map((name) => ({
  fileName: name,
  bytes: statSync(join(release, name)).size,
  sha256: hash("sha256", name, "hex"),
  url: new URL(encodeURIComponent(name), releaseBase).href,
}));
writeFileSync(
  join(release, "SHA256SUMS"),
  `${artifactRecords.map(({ fileName, sha256 }) => `${sha256}  ${fileName}`).join("\n")}\n`,
);

const updateZip = artifactRecords.find(({ fileName }) => fileName.endsWith(".zip"));
if (updateZip === undefined) {
  console.error("desktop-macos dist FAILED — update zip is absent");
  process.exit(1);
}
const updateSha512 = hash("sha512", updateZip.fileName, "base64");
writeFileSync(
  join(release, "latest-mac.yml"),
  [
    `version: ${version}`,
    "files:",
    `  - url: ${encodeURIComponent(updateZip.fileName)}`,
    `    sha512: ${updateSha512}`,
    `    size: ${updateZip.bytes}`,
    `path: ${encodeURIComponent(updateZip.fileName)}`,
    `sha512: ${updateSha512}`,
    "",
  ].join("\n"),
);

writeFileSync(
  join(release, "desktop-macos-release.json"),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      platform: "macOS universal",
      version,
      sourceApplication: "desktop/linux",
      signed: true,
      notarized: true,
      updateMetadataUrl: new URL("latest-mac.yml", releaseBase).href,
      artifacts: artifactRecords,
    },
    null,
    2,
  )}\n`,
);

console.log("desktop-macos dist OK — signed, notarized, stapled, checksummed, update metadata ready");
