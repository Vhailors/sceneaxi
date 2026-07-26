#!/usr/bin/env node
/**
 * Build the public engine SDK archive: a versioned zip, its SHA-256 checksum, and a
 * manifest.
 *
 * Free and public per the captain decision, and deliberately **not** an npm publish —
 * the packages are private `0.0.0` bootstrap packages and this repo holds no
 * registry publish authority.
 *
 * Deterministic by construction (see `scripts/lib/zip.mjs`), so the archive the
 * umbrella serves and the archive CI builds are byte-identical and the published
 * checksum means something. Fail-closed: a missing required package, a missing
 * required file, an empty file set, or a public surface that has drifted from its
 * pinned declaration refuses rather than shipping a partial or accidental SDK.
 *
 * The public surface is pinned by a checked-in exact list
 * (`scripts/engine-sdk-files.json`). The archive contains exactly those files — there is
 * no implicit tree-walking that could quietly publish an internal source file — and a
 * guard asserts the list still matches the eligible public surface, so adding a file
 * fails the gate until the list is deliberately widened.
 *
 * Usage: node scripts/build-engine-sdk.mjs [--out <dir>]
 */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildZip } from "./lib/zip.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The public engine SDK surface. Profiles and contracts are the documented
 * consumer entry points (`docs/web-consumer.md`); the engine packages are their
 * implementation train.
 *
 * `packages/profile-kids` is deliberately absent: the locked Kids isolation
 * boundary keeps Kids out of every shared artifact.
 */
export const SDK_PACKAGES = Object.freeze([
  "packages/schemas",
  "packages/engine-kernel",
  "packages/engine-presentation",
  "packages/engine-orchestrator",
  "packages/authoring-core",
  "packages/profile-game",
  "packages/profile-web",
]);

/**
 * Repo-level docs shipped with the SDK: the consumption contract, the pinning matrix,
 * and the publish-readiness checklist that states what `0.0.0` means and why there is
 * no registry install.
 */
export const SDK_DOCS = Object.freeze([
  "docs/web-consumer.md",
  "docs/DEPENDENCY-MATRIX.md",
  "docs/publish-readiness.md",
]);

/** Never shipped, at any depth. */
const EXCLUDED_DIRECTORIES = Object.freeze(["node_modules", "dist", ".git", ".turbo", "coverage"]);
const EXCLUDED_NAME_PATTERN = /(^\.env)|(\.tsbuildinfo$)|(^\.DS_Store$)/;
const INCLUDED_EXTENSIONS = Object.freeze([".ts", ".json", ".md", ".mjs"]);

/** The checked-in, exact declaration of every file the public archive ships. */
const SDK_FILE_LIST_URL = new URL("./engine-sdk-files.json", import.meta.url);

const readVersion = () => {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const version = manifest.version ?? "0.0.0";
  return typeof version === "string" && version.length > 0 ? version : "0.0.0";
};

const containsPath = (parent, child) => {
  const rel = relative(parent, child);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
};

const toForwardSlash = (value) => value.split("\\").join("/");

/**
 * Walk a directory without ever following symlinks.
 *
 * This computes the *eligible* public surface only — the archive itself is built from
 * the pinned file list, not from this walk. A symlink under `src/` (for example one
 * pointed at the checkout's `.git/config`) is refused outright so it can never reach the
 * guard that compares the eligible surface to the pinned list.
 */
function walk(dir, packageRoot, repoRoot, out = []) {
  for (const entry of readdirSync(dir).sort()) {
    if (EXCLUDED_DIRECTORIES.includes(entry) || EXCLUDED_NAME_PATTERN.test(entry)) continue;
    const path = join(dir, entry);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
      throw new Error(
        `engine SDK: '${relative(repoRoot, path)}' is a symlink — the public archive refuses to follow symlinks so nothing outside the package can be pulled in`,
      );
    }
    if (!containsPath(packageRoot, path)) {
      throw new Error(
        `engine SDK: '${relative(repoRoot, path)}' escapes its package root — refusing to pull outside files into the public archive`,
      );
    }
    if (stat.isDirectory()) walk(path, packageRoot, repoRoot, out);
    else if (INCLUDED_EXTENSIONS.some((extension) => entry.endsWith(extension))) out.push(path);
  }
  return out;
}

/**
 * The eligible public surface as it exists on disk, relative to `repoRoot`. This is the
 * ground truth the pinned list is guarded against, so a newly added source file under a
 * public package fails the gate until the list is widened deliberately.
 */
export function eligibleSdkFiles(repoRoot = root) {
  const files = [];
  for (const pkgDir of SDK_PACKAGES) {
    const absolute = join(repoRoot, pkgDir);
    if (existsSync(join(absolute, "package.json"))) files.push(join(absolute, "package.json"));
    const srcDir = join(absolute, "src");
    if (existsSync(srcDir)) files.push(...walk(srcDir, absolute, repoRoot));
    for (const optional of ["README.md", "LICENSE", "LICENSE.md"]) {
      const path = join(absolute, optional);
      if (existsSync(path)) files.push(path);
    }
    const contractsDir = join(absolute, "contracts");
    if (existsSync(contractsDir)) files.push(...walk(contractsDir, absolute, repoRoot));
  }
  for (const doc of SDK_DOCS) {
    const path = join(repoRoot, doc);
    if (existsSync(path)) files.push(path);
  }
  return files.map((file) => toForwardSlash(relative(repoRoot, file))).sort();
}

/** The allowed root a pinned file must stay inside (its package, or the repo for docs). */
function allowedRootFor(repoRoot, relPath) {
  for (const pkg of SDK_PACKAGES) {
    if (relPath === pkg || relPath.startsWith(`${pkg}/`)) return resolve(repoRoot, pkg);
  }
  if (SDK_DOCS.includes(relPath)) return resolve(repoRoot);
  throw new Error(`engine SDK: '${relPath}' is not under any allowed root — refusing to emit`);
}

/**
 * Read one pinned archive file through a single symlink/canonical-containment boundary.
 *
 * Every candidate — manifest, package source, contracts, README/LICENSE, docs — passes
 * through here. A symlink is refused outright (`lstat`, never `stat`), the entry must be a
 * regular file, and its canonicalized target must stay inside its allowed root, so nothing
 * outside the public surface can be pulled into the archive regardless of how it was found.
 */
function safeArchiveEntry(repoRoot, relPath) {
  const abs = resolve(repoRoot, relPath);
  let stat;
  try {
    stat = lstatSync(abs);
  } catch {
    throw new Error(`engine SDK: '${relPath}' is missing — refusing to emit a partial archive`);
  }
  if (stat.isSymbolicLink()) {
    throw new Error(
      `engine SDK: '${relPath}' is a symlink — the public archive refuses to follow symlinks so nothing outside the package can be pulled in`,
    );
  }
  if (!stat.isFile()) {
    throw new Error(`engine SDK: '${relPath}' is not a regular file — refusing to archive it`);
  }
  const canonicalFile = realpathSync(abs);
  const canonicalRoot = realpathSync(allowedRootFor(repoRoot, relPath));
  if (!containsPath(canonicalRoot, canonicalFile)) {
    throw new Error(
      `engine SDK: '${relPath}' resolves outside its allowed root — refusing to pull outside files into the public archive`,
    );
  }
  return { name: `sceneaxi-engine-sdk/${toForwardSlash(relPath)}`, data: readFileSync(canonicalFile) };
}

/**
 * Collect the SDK's file entries from the pinned list.
 *
 * @param {{ readonly repoRoot?: string }} [options]
 * @returns {{ entries: Array<{ name: string, data: Buffer }>, packages: string[] }}
 */
export function collectSdkEntries(options = {}) {
  const repoRoot = options.repoRoot ?? root;

  for (const pkgDir of SDK_PACKAGES) {
    if (!existsSync(join(repoRoot, pkgDir))) {
      throw new Error(
        `engine SDK: required package '${pkgDir}' is missing — refusing to emit a partial SDK`,
      );
    }
  }
  for (const doc of SDK_DOCS) {
    if (!existsSync(join(repoRoot, doc))) {
      throw new Error(`engine SDK: required doc '${doc}' is missing — refusing to emit`);
    }
  }

  const list = JSON.parse(readFileSync(SDK_FILE_LIST_URL, "utf8"));
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("engine SDK: the pinned public file list is missing or empty");
  }
  for (const pkg of SDK_PACKAGES) {
    if (!list.includes(`${pkg}/package.json`)) {
      throw new Error(`engine SDK: '${pkg}/package.json' is missing from the pinned public file list`);
    }
  }
  for (const doc of SDK_DOCS) {
    if (!list.includes(doc)) {
      throw new Error(`engine SDK: required doc '${doc}' is missing from the pinned public file list`);
    }
  }

  const entries = list.map((relPath) => safeArchiveEntry(repoRoot, relPath));

  // The archive ships exactly the pinned list, but the list must stay complete: the
  // eligible public surface on disk has to match it, so an added (or removed) source file
  // fails the gate until the list is deliberately widened.
  const eligible = eligibleSdkFiles(repoRoot);
  const extra = eligible.filter((file) => !list.includes(file));
  const missing = list.filter((file) => !eligible.includes(file));
  if (extra.length > 0 || missing.length > 0) {
    const detail = [
      extra.length > 0 ? `eligible but not pinned: ${extra.join(", ")}` : "",
      missing.length > 0 ? `pinned but not eligible: ${missing.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("; ");
    throw new Error(
      `engine SDK: the pinned public surface does not match the eligible surface (${detail}) — update scripts/engine-sdk-files.json deliberately to change the public SDK surface`,
    );
  }

  if (entries.length === 0) {
    throw new Error("engine SDK: collected zero files — refusing to emit an empty archive");
  }

  const kids = entries.filter((entry) => entry.name.includes("profile-kids"));
  if (kids.length > 0) {
    throw new Error(
      `engine SDK: ${kids.length} Kids file(s) reached the archive — Kids isolation violation`,
    );
  }

  const packages = SDK_PACKAGES.map((pkg) => {
    const manifestEntry = entries.find((entry) => entry.name === `sceneaxi-engine-sdk/${pkg}/package.json`);
    if (manifestEntry === undefined) {
      throw new Error(`engine SDK: '${pkg}' has no package.json in the pinned public file list`);
    }
    const manifest = JSON.parse(manifestEntry.data.toString("utf8"));
    return manifest.name ?? pkg;
  });

  return { entries, packages };
}

/**
 * Build the archive and its side artifacts in memory.
 *
 * @param {{ readonly repoRoot?: string, readonly version?: string }} [options]
 */
export function buildEngineSdk(options = {}) {
  const version = options.version ?? readVersion();
  const { entries, packages } = collectSdkEntries(options);
  const readme = sdkReadme(version, packages);
  const all = [...entries, { name: "sceneaxi-engine-sdk/SDK-README.md", data: Buffer.from(readme, "utf8") }];
  const archive = buildZip(all);
  const sha256 = createHash("sha256").update(archive).digest("hex");
  const fileName = `sceneaxi-engine-sdk-${version}.zip`;
  const manifest = {
    schemaVersion: 1,
    kind: "sceneaxi.engine-sdk-manifest",
    sdkVersion: version,
    generatedFrom: "Vhailors/sceneaxi",
    archiveFileName: fileName,
    entryCount: all.length,
    byteSize: archive.length,
    sha256,
    packages: [...packages].sort(),
    notes:
      "Public engine SDK source archive. Not an npm publish; not a monorepo dump. Deterministic: rebuilding from the same sources yields the same sha256.",
  };
  return { version, fileName, archive, sha256, manifest, entryNames: all.map((entry) => entry.name) };
}

function sdkReadme(version, packages) {
  return `# SceneAxi engine SDK ${version}

Public, free **source-available** archive of the SceneAxi engine SDK, provided for
evaluation. This is **not** an npm publish and not a dump of the monorepo — it is the
public package surface plus the consumer contract docs.

## Contents

${packages.map((name) => `- \`${name}\``).join("\n")}

Plus \`docs/web-consumer.md\` (the supported consumption and pinning contract),
\`docs/DEPENDENCY-MATRIX.md\`, and \`docs/publish-readiness.md\` (what \`0.0.0\` means,
the version plan, and the checklist that keeps those docs equal to the real exports).

## Verify this archive

    sha256sum -c sceneaxi-engine-sdk-${version}.zip.sha256

The archive is built deterministically, so an independent rebuild from the same
sources produces the same checksum.

## Support status

These are private \`0.0.0\` bootstrap packages. There is no supported external
install until matching versions are published to a registry; \`docs/web-consumer.md\`
is authoritative on that. Reading and building against this source is free, as is
CLI use and bringing your own AI provider.

## Licence

This archive is **source-available for evaluation, not open-source**. The packages
are \`UNLICENSED\`, no licence file is included, and **no licence is granted** to use,
modify, copy, or redistribute this source beyond reading and evaluating it here. It
is not redistributable under MIT, Apache-2.0, BSL, or any other public licence. A
grant of rights is a separate decision that has not been made; until then, treat this
as evaluation-only source.
`;
}

function main(argv) {
  const outIndex = argv.indexOf("--out");
  // Resolved against the caller's cwd, not the repo root, so a site can write into its
  // own `public/` with a relative path.
  const outDir = resolve(process.cwd(), outIndex >= 0 ? (argv[outIndex + 1] ?? "dist-sdk") : "dist-sdk");
  const built = buildEngineSdk();
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, built.fileName), built.archive);
  writeFileSync(join(outDir, `${built.fileName}.sha256`), `${built.sha256}  ${built.fileName}\n`);
  writeFileSync(join(outDir, "sdk-manifest.json"), `${JSON.stringify(built.manifest, null, 2)}\n`);
  process.stdout.write(
    `engine SDK OK — ${built.fileName} (${built.archive.length} bytes, ${built.manifest.entryCount} entries)\n` +
      `  sha256 ${built.sha256}\n  out    ${outDir}\n`,
  );
}

// `pathToFileURL` percent-encodes exactly like `import.meta.url`, so a repository path
// containing a space or a non-ASCII character cannot silently build nothing.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`engine SDK FAILED — ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
