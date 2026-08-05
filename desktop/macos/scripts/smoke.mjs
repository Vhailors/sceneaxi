#!/usr/bin/env node
/**
 * Configuration smoke on every host; packaged application smoke on macOS.
 *
 * The default mode deliberately removes all operator inputs and proves the release
 * command refuses them by name before electron-builder can run. `--packaged`
 * verifies the already signed/stapled bundle, its checksums, its build-record
 * provenance, and its real runtime.
 *
 * The packaged launch passes SwiftShader, exactly as the Linux smoke does: an Apple
 * Silicon or Intel CI runner is a GPU-less VM, and a software rasterizer keeps WebGL
 * real rather than stubbed, so the pixel proof fails only for the package. An
 * operator running this on a real Mac still exercises the same code path.
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
const provenanceInputs = [
  "GITHUB_ACTIONS",
  "GITHUB_EVENT_NAME",
  "GITHUB_REPOSITORY",
  "GITHUB_RUN_ID",
  "GITHUB_SERVER_URL",
  "GITHUB_SHA",
  "GITHUB_WORKFLOW_REF",
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
  const buildVersionMatches = [
    ...config.matchAll(/^buildVersion:\s*["']([^"']+)["']\s*$/gm),
  ];
  const buildVersion = buildVersionMatches.length === 1 ? buildVersionMatches[0][1] : undefined;
  if (!/^[1-9]\d{0,3}(?:\.(?:0|[1-9]\d?)){0,2}$/.test(buildVersion ?? "")) {
    fail("packaging config carries no valid Apple build version");
  }
  if (/^publish:/m.test(config)) fail("packaging config can publish implicitly");
  if (!existsSync(join(appRoot, "entitlements.mac.plist"))) {
    fail("packaging config references no tracked entitlements file");
  }

  const removed = [...releaseInputs, ...provenanceInputs];
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !removed.includes(name)),
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
  if (!result.stderr.includes("MACOS_PROVENANCE_REQUIRED:GITHUB_SHA")) {
    fail("missing-input preflight did not refuse absent source provenance");
  }
  const actionsResult = spawnSync(
    process.execPath,
    [join(appRoot, "scripts/dist.mjs"), "--preflight-only"],
    {
      cwd: appRoot,
      encoding: "utf8",
      env: {
        ...env,
        GITHUB_ACTIONS: "true",
        GITHUB_EVENT_NAME: "workflow_dispatch",
        GITHUB_REPOSITORY: "Vhailors/sceneaxi",
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_WORKFLOW_REF:
          "Vhailors/sceneaxi/.github/workflows/desktop-macos.yml@refs/heads/main",
      },
    },
  );
  if (actionsResult.status !== 1) {
    fail(`missing Actions provenance preflight exited ${actionsResult.status}, not 1`);
  }
  for (const name of ["GITHUB_SHA", "GITHUB_RUN_ID"]) {
    if (!actionsResult.stderr.includes(`MACOS_PROVENANCE_REQUIRED:${name}`)) {
      fail(`Actions preflight did not refuse absent provenance ${name}`);
    }
  }

  console.log(
    "desktop-macos smoke OK — packaging config valid; missing signing/notarization/update inputs refused; local and Actions provenance refusals proven",
  );
  process.exit(0);
}

if (process.platform !== "darwin") fail("--packaged requires macOS");
const release = join(appRoot, "release");
const checksumsPath = join(release, "SHA256SUMS");
const actionsManifestPath = join(release, "desktop-macos-release.json");
const localManifestPath = join(release, "desktop-macos-local-build.json");
const manifestPaths = [actionsManifestPath, localManifestPath].filter((path) => existsSync(path));
if (manifestPaths.length !== 1) fail("release must carry exactly one provenance record");
const manifestPath = manifestPaths[0];
const updatePath = join(release, "latest-mac.yml");
for (const path of [checksumsPath, manifestPath, updatePath]) {
  if (!existsSync(path)) fail(`release proof file is absent: ${path}`);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const { repository, sourceCommit, workflowRunId, verifiedOn } = manifest;
if (
  typeof sourceCommit !== "string" ||
  !/^[0-9a-f]{40}$/.test(sourceCommit) ||
  typeof manifest.buildVersion !== "string" ||
  !/^[1-9]\d{0,3}(?:\.(?:0|[1-9]\d?)){0,2}$/.test(manifest.buildVersion) ||
  typeof verifiedOn !== "string" ||
  !/^\d{4}-\d{2}-\d{2}$/.test(verifiedOn) ||
  !Array.isArray(manifest.artifacts)
) {
  fail("build record carries no complete source provenance");
}
if (manifestPath === actionsManifestPath) {
  if (
    manifest.recordKind !== "github-actions-release" ||
    manifest.iaLinkable !== true ||
    repository !== "Vhailors/sceneaxi" ||
    !Number.isSafeInteger(workflowRunId) ||
    workflowRunId <= 0 ||
    manifest.downloadHref !== `https://github.com/${repository}/actions/runs/${workflowRunId}`
  ) {
    fail("release record carries no complete provenance the download IA can consume");
  }
} else {
  const forbidden = ["repository", "workflowRunId", "downloadHref", "updateMetadataUrl"];
  if (
    manifest.recordKind !== "local-build" ||
    manifest.iaLinkable !== false ||
    forbidden.some((field) => Object.hasOwn(manifest, field)) ||
    manifest.artifacts?.some((artifact) => Object.hasOwn(artifact, "url"))
  ) {
    fail("local build record is not explicitly non-linkable");
  }
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
const result = spawnSync(executable, ["--smoke", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"], {
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
