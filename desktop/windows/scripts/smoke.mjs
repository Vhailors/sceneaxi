#!/usr/bin/env node
/** Static smoke that is safe on a non-Windows host and never reaches signing. */
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
  releaseScript.includes('publish: "onTagOrDraft"'),
  "release is not pinned to an existing draft path",
);
assert(packageScript.includes('"signtool.exe"'), "packaging does not verify Authenticode");
assert(
  /packageWindowsRelease\(\{[\s\S]*?env:/.test(releaseScript),
  "publishing does not hand the release token to electron-builder",
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
