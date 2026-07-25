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
 * required file, or an empty file set refuses rather than shipping a partial SDK.
 *
 * Usage: node scripts/build-engine-sdk.mjs [--out <dir>]
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

/** Repo-level docs shipped with the SDK. */
export const SDK_DOCS = Object.freeze(["docs/web-consumer.md", "docs/DEPENDENCY-MATRIX.md"]);

/** Never shipped, at any depth. */
const EXCLUDED_DIRECTORIES = Object.freeze(["node_modules", "dist", ".git", ".turbo", "coverage"]);
const EXCLUDED_NAME_PATTERN = /(^\.env)|(\.tsbuildinfo$)|(^\.DS_Store$)/;
const INCLUDED_EXTENSIONS = Object.freeze([".ts", ".json", ".md", ".mjs"]);

const readVersion = () => {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const version = manifest.version ?? "0.0.0";
  return typeof version === "string" && version.length > 0 ? version : "0.0.0";
};

function walk(dir, out = []) {
  for (const entry of readdirSync(dir).sort()) {
    if (EXCLUDED_DIRECTORIES.includes(entry) || EXCLUDED_NAME_PATTERN.test(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (INCLUDED_EXTENSIONS.some((extension) => entry.endsWith(extension))) out.push(path);
  }
  return out;
}

/**
 * Collect the SDK's file entries.
 *
 * @param {{ readonly repoRoot?: string }} [options]
 * @returns {{ entries: Array<{ name: string, data: Buffer }>, packages: string[] }}
 */
export function collectSdkEntries(options = {}) {
  const repoRoot = options.repoRoot ?? root;
  const entries = [];
  const packages = [];

  for (const pkgDir of SDK_PACKAGES) {
    const absolute = join(repoRoot, pkgDir);
    if (!existsSync(absolute)) {
      throw new Error(
        `engine SDK: required package '${pkgDir}' is missing — refusing to emit a partial SDK`,
      );
    }
    const manifestPath = join(absolute, "package.json");
    if (!existsSync(manifestPath)) {
      throw new Error(`engine SDK: '${pkgDir}' has no package.json — refusing to emit`);
    }
    const srcDir = join(absolute, "src");
    if (!existsSync(srcDir)) {
      throw new Error(`engine SDK: '${pkgDir}' has no src/ — refusing to emit`);
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    packages.push(manifest.name ?? pkgDir);

    for (const file of [manifestPath, ...walk(srcDir)]) {
      entries.push({
        name: `sceneaxi-engine-sdk/${relative(repoRoot, file).split("\\").join("/")}`,
        data: readFileSync(file),
      });
    }
    for (const optional of ["README.md", "LICENSE", "LICENSE.md"]) {
      const path = join(absolute, optional);
      if (existsSync(path)) {
        entries.push({
          name: `sceneaxi-engine-sdk/${relative(repoRoot, path).split("\\").join("/")}`,
          data: readFileSync(path),
        });
      }
    }
    // Shipped JSON Schema contracts travel with the contracts package.
    const contractsDir = join(absolute, "contracts");
    if (existsSync(contractsDir)) {
      for (const file of walk(contractsDir)) {
        entries.push({
          name: `sceneaxi-engine-sdk/${relative(repoRoot, file).split("\\").join("/")}`,
          data: readFileSync(file),
        });
      }
    }
  }

  for (const doc of SDK_DOCS) {
    const path = join(repoRoot, doc);
    if (!existsSync(path)) {
      throw new Error(`engine SDK: required doc '${doc}' is missing — refusing to emit`);
    }
    entries.push({ name: `sceneaxi-engine-sdk/${doc}`, data: readFileSync(path) });
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

Public, free source archive of the SceneAxi engine SDK. This is **not** an npm
publish and not a dump of the monorepo — it is the public package surface plus the
consumer contract docs.

## Contents

${packages.map((name) => `- \`${name}\``).join("\n")}

Plus \`docs/web-consumer.md\` (the supported consumption and pinning contract) and
\`docs/DEPENDENCY-MATRIX.md\`.

## Verify this archive

    sha256sum -c sceneaxi-engine-sdk-${version}.zip.sha256

The archive is built deterministically, so an independent rebuild from the same
sources produces the same checksum.

## Support status

These are private \`0.0.0\` bootstrap packages. There is no supported external
install until matching versions are published to a registry; \`docs/web-consumer.md\`
is authoritative on that. Reading and building against this source is free, as is
CLI use and bringing your own AI provider.
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

if (process.argv[1] !== undefined && import.meta.url === `file://${resolve(process.argv[1])}`) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`engine SDK FAILED — ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
