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
import {
  CANONICAL_REPOSITORY,
  isPositiveGitHubRunId,
  resolveReleaseProvenance,
} from "./release-provenance.mjs";

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
const builderConfig = readFileSync(join(appRoot, "electron-builder.yml"), "utf8");
const buildVersionMatches = [
  ...builderConfig.matchAll(/^buildVersion:\s*["']([^"']+)["']\s*$/gm),
];
const buildVersion = buildVersionMatches.length === 1 ? buildVersionMatches[0][1] : undefined;

const provenanceValidators = Object.freeze({
  GITHUB_REPOSITORY: (value) => /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value),
  GITHUB_SHA: (value) => /^[0-9a-f]{40}$/.test(value),
  GITHUB_RUN_ID: isPositiveGitHubRunId,
});
const releaseProvenance = resolveReleaseProvenance(process.env);
const actionsRelease = releaseProvenance.iaLinkable;
const repositoryRoot = resolve(appRoot, "../..");
const git = (args) =>
  spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

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
if (existsSync(release)) {
  try {
    if (!statSync(release).isDirectory()) {
      refusals.push("MACOS_RELEASE_OUTPUT_INVALID");
    } else if (readdirSync(release).length > 0) {
      refusals.push("MACOS_RELEASE_OUTPUT_NOT_EMPTY");
    }
  } catch {
    refusals.push("MACOS_RELEASE_OUTPUT_UNREADABLE");
  }
}
if (process.platform !== "darwin") refusals.push("MACOS_HOST_REQUIRED");
if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)*$/.test(version)) {
  refusals.push("MACOS_RELEASE_VERSION_INVALID");
}
if (
  typeof buildVersion !== "string" ||
  !/^[1-9]\d{0,3}(?:\.(?:0|[1-9]\d?)){0,2}$/.test(buildVersion)
) {
  refusals.push("MACOS_BUILD_VERSION_INVALID");
}
for (const name of requiredEnvironment) {
  if (process.env[name] === undefined || process.env[name]?.trim() === "") {
    refusals.push(`MACOS_ENV_REQUIRED:${name}`);
  }
}
const requiredProvenance = releaseProvenance.canonicalReleaseContext
  ? Object.entries(provenanceValidators)
  : [["GITHUB_SHA", provenanceValidators.GITHUB_SHA]];
for (const [name, isValid] of requiredProvenance) {
  const value = process.env[name]?.trim();
  if (value === undefined || value === "") {
    refusals.push(`MACOS_PROVENANCE_REQUIRED:${name}`);
  } else if (!isValid(value)) {
    refusals.push(`MACOS_PROVENANCE_INVALID:${name}`);
  }
}
const declaredCommit = process.env.GITHUB_SHA?.trim();
if (declaredCommit !== undefined && provenanceValidators.GITHUB_SHA(declaredCommit)) {
  if (!executableExists("git")) {
    refusals.push("MACOS_PROVENANCE_UNVERIFIABLE:git");
  } else {
    const head = git(["rev-parse", "--verify", "HEAD"]);
    const worktree = git(["status", "--porcelain"]);
    if (head.status !== 0 || worktree.status !== 0) {
      refusals.push("MACOS_PROVENANCE_UNVERIFIABLE:checkout");
    } else {
      if (head.stdout.trim() !== declaredCommit) {
        refusals.push("MACOS_PROVENANCE_COMMIT_MISMATCH");
      }
      if (worktree.stdout.trim() !== "") refusals.push("MACOS_PROVENANCE_WORKTREE_DIRTY");
    }
  }
}
if (releaseProvenance.canonicalReleaseContext) {
  if (!releaseProvenance.serverValid) {
    refusals.push("MACOS_ACTIONS_SERVER_REQUIRED");
  }
  if (!releaseProvenance.workflowValid) {
    refusals.push("MACOS_ACTIONS_WORKFLOW_REQUIRED");
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
const sourceCommit = process.env.GITHUB_SHA.trim();
const repository = actionsRelease ? CANONICAL_REPOSITORY : undefined;
const workflowRunId = actionsRelease ? Number(process.env.GITHUB_RUN_ID.trim()) : undefined;
const verifiedOn = new Date().toISOString().slice(0, 10);
const hash = (algorithm, name, encoding) =>
  createHash(algorithm).update(readFileSync(join(release, name))).digest(encoding);
const artifactRecords = artifacts.map((name) => ({
  fileName: name,
  bytes: statSync(join(release, name)).size,
  sha256: hash("sha256", name, "hex"),
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
  join(
    release,
    actionsRelease ? "desktop-macos-release.json" : "desktop-macos-local-build.json",
  ),
  `${JSON.stringify(
    actionsRelease
      ? {
          schemaVersion: 1,
          recordKind: "github-actions-release",
          iaLinkable: true,
          platform: "macOS universal",
          version,
          buildVersion,
          sourceApplication: "desktop/linux",
          repository,
          sourceCommit,
          workflowRunId,
          downloadHref: `https://github.com/${repository}/actions/runs/${workflowRunId}`,
          verifiedOn,
          signed: true,
          notarized: true,
          updateMetadataUrl: new URL("latest-mac.yml", releaseBase).href,
          artifacts: artifactRecords.map((artifact) => ({
            ...artifact,
            url: new URL(encodeURIComponent(artifact.fileName), releaseBase).href,
          })),
        }
      : {
          schemaVersion: 1,
          recordKind: "local-build",
          iaLinkable: false,
          platform: "macOS universal",
          version,
          buildVersion,
          sourceApplication: "desktop/linux",
          sourceCommit,
          verifiedOn,
          signed: true,
          notarized: true,
          artifacts: artifactRecords,
        },
    null,
    2,
  )}\n`,
);

console.log("desktop-macos dist OK — signed, notarized, stapled, checksummed, update metadata ready");
