/** Byte integrity only; genuine Authenticode and native pixels are verified separately. */
import { createHash } from "node:crypto";
import { closeSync, lstatSync, openSync, readFileSync, readSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const refuse = (reason) => { throw new Error(`RELEASE_INTEGRITY_${reason}`); };

export function hashReleaseFile(path, algorithm = "sha256", encoding = "hex") {
  const hash = createHash(algorithm);
  const fd = openSync(path, "r");

  try {
    const buffer = Buffer.alloc(65536);
    let bytes;

    while ((bytes = readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, bytes));

    return hash.digest(encoding);
  } finally { closeSync(fd); }
}

export function validateReleaseArtifacts({ release, manifest, version, expectedNames, updateFile, updateArtifact, metadataNames = [], stagedDirectories = [] }) {
  const rootStat = lstatSync(release);

  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) refuse("ROOT_INVALID");
  const safeName = (name) => typeof name === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name);

  if (!Array.isArray(expectedNames) || expectedNames.length === 0 ||
      new Set(expectedNames).size !== expectedNames.length || !expectedNames.every(safeName)) refuse("EXPECTED_SET_INVALID");

  const file = (name) => {
    if (!safeName(name)) refuse("PATH_INVALID");
    const path = join(release, name);
    const stat = lstatSync(path);

    if (stat.isSymbolicLink() || !stat.isFile() || !Number.isSafeInteger(stat.size) || stat.size <= 0) refuse("FILE_INVALID");

    return { path, bytes: stat.size };
  };

  const text = (name) => {
    const item = file(name);

    if (item.bytes > 65536) refuse("METADATA_TOO_LARGE");

    return readFileSync(item.path, "utf8");
  };

  if (!manifest || manifest.schemaVersion !== 1 || manifest.version !== version ||
      !/^[a-f0-9]{40}$/.test(manifest.sourceCommit ?? "") || !Array.isArray(manifest.artifacts)) refuse("MANIFEST_INVALID");
  const names = manifest.artifacts.map((a) => a?.fileName);

  if (names.length !== expectedNames.length || new Set(names).size !== names.length ||
      !names.every((name) => safeName(name) && expectedNames.includes(name))) refuse("MANIFEST_SET_MISMATCH");

  if (![...metadataNames, ...stagedDirectories].every(safeName) ||
      new Set([...expectedNames, "SHA256SUMS", ...metadataNames, ...stagedDirectories]).size !==
        expectedNames.length + 1 + metadataNames.length + stagedDirectories.length) refuse("EXPECTED_SET_INVALID");
  const admitted = new Set([...expectedNames, "SHA256SUMS", updateFile, ...metadataNames, ...stagedDirectories]);

  // Reject invalid artifact objects before reporting unrelated directory entries.
  // In particular, a symlink must never be treated as an admitted regular file.
  for (const name of expectedNames) file(name);

  if (readdirSync(release).some((name) => !admitted.has(name))) refuse("DIRECTORY_SET_MISMATCH");

  for (const name of stagedDirectories) {
    const staged = join(release, name);

    // A staging directory is optional, but never a symlink or an artifact alias.
    if (!readdirSync(release).includes(name)) continue;
    const stat = lstatSync(staged);

    if (stat.isSymbolicLink() || !stat.isDirectory()) refuse("STAGING_INVALID");
  }

  for (const name of metadataNames) {
    if (readdirSync(release).includes(name)) text(name);
  }

  const digests = new Map();

  for (const artifact of manifest.artifacts) {
    const item = file(artifact.fileName);

    if (artifact.bytes !== item.bytes) refuse("SIZE_MISMATCH");
    const actual = hashReleaseFile(item.path);

    if (!/^[a-f0-9]{64}$/.test(artifact.sha256 ?? "") || actual !== artifact.sha256) refuse("HASH_MISMATCH");
    digests.set(artifact.fileName, actual);
  }

  const lines = text("SHA256SUMS").trim().split("\n");

  if (lines.length !== expectedNames.length) refuse("CHECKSUM_SET_MISMATCH");
  const seen = new Set();

  for (const line of lines) {
    const match = /^([a-f0-9]{64}) {2}([A-Za-z0-9][A-Za-z0-9._-]*)$/.exec(line);

    if (!match || !digests.has(match[2]) || seen.has(match[2]) || digests.get(match[2]) !== match[1]) refuse("CHECKSUM_MISMATCH");
    seen.add(match[2]);
  }

  // The packaging roots write this closed single-file update grammar. Unknown/duplicate YAML keys refuse.
  const update = text(updateFile).replace(/\r\n/g, "\n");
  const match = /^version: ([^\n]+)\nfiles:\n {2}- url: ([^\n]+)\n {4}sha512: ([A-Za-z0-9+/]+={0,2})\n {4}size: ([1-9][0-9]*)\npath: ([^\n]+)\nsha512: ([A-Za-z0-9+/]+={0,2})\n(?:releaseDate: [^\n]+\n)?$/.exec(update);

  if (!match || match[1] !== version || match[2] !== encodeURIComponent(updateArtifact) ||
      match[5] !== encodeURIComponent(updateArtifact)) refuse("UPDATE_INVALID");
  const target = file(updateArtifact);
  const sha512 = hashReleaseFile(target.path, "sha512", "base64");

  if (Number(match[4]) !== target.bytes || match[3] !== sha512 || match[6] !== sha512) refuse("UPDATE_MISMATCH");

  return Object.freeze({ artifacts: Object.freeze(manifest.artifacts.map((a) => Object.freeze({ ...a }))), version });
}

import { spawnSync } from "node:child_process";
import { requireWindowsReleaseEnvironment, requireEmptyWindowsOutput, windowsCheckoutProvenance } from "./release-preflight.mjs";

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });

  if (result.error || result.status !== 0) throw new Error(`WINDOWS_RELEASE_COMMAND_FAILED:${command}`);
};

export function validateWindowsCandidate(appRoot) {
  const release = join(appRoot, "release");
  const { version } = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8"));
  const expected = `SceneAxi-Engine-Desktop-${version}-windows-x64.exe`;
  const manifest = JSON.parse(readFileSync(join(release, "desktop-windows-local-build.json"), "utf8"));

  if (manifest.recordKind !== "local-build" || manifest.iaLinkable !== false || manifest.signed !== true ||
      typeof manifest.verifiedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.verifiedOn) ||
      manifest.platform !== "windows-x64" || manifest.sourceApplication !== "desktop/linux" ||
      ["repository", "workflowRunId", "downloadHref", "updateMetadataUrl"].some((key) => Object.hasOwn(manifest, key)) ||
      manifest.artifacts?.some((a) => Object.hasOwn(a, "url"))) throw new Error("WINDOWS_RELEASE_RECORD_INVALID");
  const names = [expected, `${expected}.blockmap`, "latest.yml"];
  const installers = readdirSync(release).filter((name) => name.endsWith(".exe"));

  if (installers.length !== 1 || installers[0] !== expected) throw new Error("WINDOWS_RELEASE_INSTALLER_SET_INVALID");
  validateReleaseArtifacts({ release, manifest, version, expectedNames: names, updateFile: "latest.yml", updateArtifact: expected,
    metadataNames: ["desktop-windows-local-build.json", "builder-debug.yml", "builder-effective-config.yaml"], stagedDirectories: ["win-unpacked"] });

  return Object.freeze({ expected, digest: manifest.artifacts.find((a) => a.fileName === expected).sha256,
    manifest, files: Object.freeze([...names, "SHA256SUMS", "desktop-windows-local-build.json"].map((name) => join(release, name))),
    checksumFile: join(release, "SHA256SUMS") });
}

export function packageWindowsRelease({ appRoot, publish = "never", env = process.env }) {
  if (publish !== "never") throw new Error("WINDOWS_RELEASE_IMPLICIT_PUBLISH_DENIED");
  const release = join(appRoot, "release");
  requireEmptyWindowsOutput(release);
  requireWindowsReleaseEnvironment({ env });
  const sourceCommit = windowsCheckoutProvenance(env);
  run(process.execPath, [join(appRoot, "scripts/build.mjs")], { cwd: appRoot, env });
  run(process.execPath, [join(appRoot, "node_modules/electron-builder/out/cli/cli.js"),
    "--win", "nsis", "--x64", "--publish", "never"], { cwd: appRoot, env });
  const { version } = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8"));
  const expected = `SceneAxi-Engine-Desktop-${version}-windows-x64.exe`;
  const installers = readdirSync(release).filter((name) => name.endsWith(".exe"));

  if (installers.length !== 1 || installers[0] !== expected) throw new Error("WINDOWS_RELEASE_INSTALLER_SET_INVALID");
  // Never emit a signed claim until the real OS signature verifier accepts the exact bytes.
  run("signtool.exe", ["verify", "/pa", "/all", "/v", join(release, expected)], { cwd: appRoot, env });
  const installer = join(release, expected);
  const sha512 = hashReleaseFile(installer, "sha512", "base64");
  // Normalize builder metadata into the same closed, independently checked single-artifact grammar.
  writeFileSync(join(release, "latest.yml"), `version: ${version}\nfiles:\n {2}- url: ${encodeURIComponent(expected)}\n {4}sha512: ${sha512}\n {4}size: ${statSync(installer).size}\npath: ${encodeURIComponent(expected)}\nsha512: ${sha512}\n`);
  const names = [expected, `${expected}.blockmap`, "latest.yml"];
  const artifacts = names.map((fileName) => ({ fileName, bytes: statSync(join(release, fileName)).size, sha256: hashReleaseFile(join(release, fileName)) }));
  writeFileSync(join(release, "SHA256SUMS"), `${artifacts.map((a) => `${a.sha256}  ${a.fileName}`).join("\n")}\n`);
  writeFileSync(join(release, "desktop-windows-local-build.json"), `${JSON.stringify({
    schemaVersion: 1, recordKind: "local-build", iaLinkable: false, platform: "windows-x64", version,
    sourceApplication: "desktop/linux", sourceCommit, verifiedOn: new Date().toISOString().slice(0, 10),
    signed: true, artifacts,
  }, null, 2)}\n`);

  return validateWindowsCandidate(appRoot);
}

/** Ordered release ports; tests can inject refusals without simulating signing or publication. */
export function uploadVerifiedWindowsDraft({ appRoot, sourceCommit, tag, verifyCandidate = () => validateWindowsCandidate(appRoot), verifyNative, readDraft, upload }) {
  const artifact = verifyCandidate();

  if (artifact.manifest.sourceCommit !== sourceCommit) throw new Error("WINDOWS_PROVENANCE_COMMIT_MISMATCH");
  verifyNative();
  const release = readDraft();

  if (release.tagName !== tag || release.isDraft !== true) {
    throw new Error("desktop-windows release refused — the matching GitHub release must already exist as a draft");
  }

  if (release.targetCommitish !== sourceCommit) throw new Error("WINDOWS_RELEASE_DRAFT_SOURCE_MISMATCH");
  const verified = verifyCandidate();

  if (verified.manifest.sourceCommit !== sourceCommit || verified.digest !== artifact.digest ||
      JSON.stringify(verified.manifest) !== JSON.stringify(artifact.manifest)) throw new Error("WINDOWS_RELEASE_CANDIDATE_CHANGED");
  upload(verified.files);
}
