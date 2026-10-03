/** Platform-neutral byte integrity only. This never substitutes for native signatures or launch. */
import { createHash } from "node:crypto";
import { closeSync, lstatSync, openSync, readFileSync, readSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Decode primitive text without coercing objects or admitting boxed strings.
function parseReleaseText(value) {
  try {
    const text = String.prototype.valueOf.call(value);

    return text === value ? text : undefined;
  } catch {
    return undefined;
  }
}

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

  const safeName = (name) => {
    const text = parseReleaseText(name);

    return text !== undefined && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(text);
  };

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
