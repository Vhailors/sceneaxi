#!/usr/bin/env node
/** Static smoke that is safe on a non-Windows host and never reaches signing. */
import { spawnSync } from "node:child_process";
import { validateWindowsCandidate } from "./package-release.mjs";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WINDOWS_RELEASE_ENV,
  WINDOWS_SIGNING_ENV,
  windowsReleasePreflight,
} from "./release-preflight.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const repositoryRoot = resolve(appRoot, "../..");

const read = (path) => readFileSync(path, "utf8");

const assert = (condition, message) => {
  if (!condition) throw new Error(`desktop-windows smoke FAILED — ${message}`);
};

try {
const flags = process.argv.slice(2);
assert(flags.length <= 1 && flags.every((flag) => flag === "--packaged"), "WINDOWS_SMOKE_ARGUMENT_INVALID");

if (flags.includes("--packaged")) {
  assert(process.platform === "win32", "WINDOWS_RELEASE_HOST_REQUIRED");
  const candidate = validateWindowsCandidate(appRoot);
  const executable = join(appRoot, "release/win-unpacked/sceneaxi-engine-desktop.exe");

  for (const path of [join(appRoot, "release", candidate.expected), executable]) {
    const verified = spawnSync("signtool.exe", ["verify", "/pa", "/all", "/v", path], { cwd: appRoot, stdio: "inherit", timeout: 120000 });
    assert(!verified.error && verified.status === 0, "WINDOWS_RELEASE_SIGNATURE_INVALID");
  }

  const result = spawnSync(executable, ["--smoke", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"], {
    cwd: appRoot, encoding: "utf8", timeout: 120000,
  });

  assert(!result.error && result.status === 0, "WINDOWS_PACKAGED_RUNTIME_FAILED");
  const proofLine = (result.stdout ?? "").split("\n").filter((line) => line.startsWith("{")).at(-1);
  assert(proofLine !== undefined, "WINDOWS_PACKAGED_PROOF_MISSING");
  const proof = JSON.parse(proofLine);
  assert(proof.ok === true && proof.frameReport?.pixelsDrawn === true && proof.frameReport?.surface === "webgl-canvas", "WINDOWS_PACKAGED_PIXELS_MISSING");
  console.log("desktop-windows smoke OK — signed checksummed NSIS candidate and signed unpacked runtime proved real pixels; installed clean-host acceptance remains separate");
  process.exit(0);
}

const builder = read(join(appRoot, "electron-builder.yml"));
assert(/target:\s*nsis/.test(builder), "NSIS target is absent");
assert(/forceCodeSigning:\s*true/.test(builder), "forceCodeSigning is not enabled");
assert(
  /verifyUpdateCodeSignature:\s*true/.test(builder),
  "update signature verification is not enabled",
);
assert(
  builder.includes("SceneAxi-Engine-Desktop-${version}-windows-${arch}.${ext}"),
  "deterministic artifact name is absent",
);
assert(/provider:\s*github/.test(builder), "GitHub update provider is absent");

const emptyEnvironment = windowsReleasePreflight({
  env: {},
  platform: "win32",
  commandAvailable: () => false,
  publishing: true,
});

assert(!emptyEnvironment.ok, "empty release environment unexpectedly passed");

for (const name of [...WINDOWS_SIGNING_ENV, ...WINDOWS_RELEASE_ENV]) {
  assert(
    emptyEnvironment.reasons.includes(`WINDOWS_RELEASE_ENV_MISSING:${name}`),
    `missing ${name} was not refused`,
  );
}

for (const tool of ["signtool.exe", "gh.exe"]) {
  assert(
    emptyEnvironment.reasons.includes(`WINDOWS_RELEASE_TOOL_MISSING:${tool}`),
    `missing ${tool} was not refused`,
  );
}

const distScript = read(join(appRoot, "scripts/dist.mjs"));
const packageScript = read(join(appRoot, "scripts/package-release.mjs"));
const releaseScript = read(join(appRoot, "scripts/release.mjs"));
assert(distScript.includes('publish: "never"'), "dist is not pinned to never publish");
assert(
  releaseScript.includes('"release", "upload"') && !releaseScript.includes("packageWindowsRelease("),
  "release must only upload already independently verified bytes",
);
assert(packageScript.includes('"signtool.exe"'), "packaging does not verify Authenticode");
assert(
  releaseScript.includes('"--packaged"') && releaseScript.indexOf('"--packaged"') < releaseScript.indexOf('"release", "upload"'),
  "native acceptance must precede uploader",
);
assert(
  packageScript.includes('"latest.yml"'),
  "packaging does not require published update metadata",
);

const downloadTable = read(join(repositoryRoot, "sites/umbrella/src/lib/download-platform.ts"));
assert(
  /id:\s*"windows"[\s\S]*?availability:\s*"coming-soon"/.test(downloadTable),
  "download IA must remain coming-soon until a release record exists",
);

console.log(
  "desktop-windows smoke OK — config is signed/update-ready; missing authority refuses; no public artifact is claimed",
);

} catch (error) {
  const message = error instanceof Error ? error.message : "WINDOWS_SMOKE_PROOF_UNAVAILABLE";
  console.error(message.startsWith("desktop-windows smoke FAILED") || /^(WINDOWS_|RELEASE_INTEGRITY_)/.test(message)
    ? message : "desktop-windows smoke FAILED — WINDOWS_SMOKE_PROOF_UNAVAILABLE");
  process.exit(1);
}
