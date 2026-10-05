#!/usr/bin/env node
/** Prepare a private local compiled CLI archive; never build, install or publish.
 * Closure comes from actual manifests; export mapping reuses the shared walker.
 * Workspace manifests remain source-backed, private and UNLICENSED.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { exportEntries } from "../../../scripts/lib/package-exports.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));

const argv = process.argv.slice(2);

if (argv.length !== 2 || argv[0] !== "--out" || !argv[1]) throw new Error("Usage: node packages/cli/bin/build-archive.mjs --out <new-private.tgz>");

const out = resolve(argv[1]);

if (existsSync(out)) throw new Error("CLI_ARCHIVE_OUTPUT_EXISTS");

const matrix = JSON.parse(readFileSync(join(root, "docs/dependency-matrix.json"), "utf8"));

const stage = mkdtempSync(join(tmpdir(), "sceneaxi-cli-archive-"));

const artifact = join(stage, "sceneaxi-cli");

const paths = {};

const visited = new Set();

const inventory = [];

function copyPackage(name, parentDir) {
  if (visited.has(name)) return;
  visited.add(name);
  const entry = matrix.packages[name];

  if (!entry) {
    const require = createRequire(join(parentDir, "package.json"));
    let directory = dirname(realpathSync(require.resolve(name)));

    while (!existsSync(join(directory, "package.json")) || JSON.parse(readFileSync(join(directory, "package.json"), "utf8")).name !== name) {
      const parent = dirname(directory);

      if (parent === directory) throw new Error(`CLI_ARCHIVE_DEPENDENCY_UNRESOLVED:${name}`);
      directory = parent;
    }

    const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
    cpSync(directory, join(artifact, "node_modules", name), { recursive: true, dereference: true, filter: path => !relative(directory, path).split(sep).includes("node_modules") });
    inventory.push({ name, version: manifest.version, kind: "vendor" });

    for (const dependency of Object.keys(manifest.dependencies ?? {})) copyPackage(dependency, directory);

    return;
  }

  if (name === "@sceneaxi/profile-kids") throw new Error("CLI_ARCHIVE_KIDS_DENIED");
  const directory = join(root, entry.dir);
  const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  const destination = name === "@sceneaxi/cli" ? artifact : join(artifact, "runtime", name);

  if (!existsSync(join(directory, "dist/src/index.js"))) throw new Error(`CLI_ARCHIVE_BUILD_REQUIRED:${name}`);
  mkdirSync(destination, { recursive: true });
  cpSync(join(directory, "dist"), join(destination, "dist"), { recursive: true, filter: path => !relative(join(directory, "dist"), path).split(sep).includes("test") });

  if (existsSync(join(directory, "contracts"))) cpSync(join(directory, "contracts"), join(destination, "contracts"), { recursive: true });
  const exports = {};

  for (const [subpath, target] of exportEntries(manifest.exports)) {
    const compiled = target.startsWith("./src/") ? target.replace("./src/", "./dist/src/").replace(/\.tsx?$/, ".js") : target;
    exports[subpath] = compiled;
    const specifier = subpath === "." ? name : `${name}/${subpath.slice(2)}`;
    paths[specifier] = `./${relative(artifact, join(destination, compiled)).split("\\").join("/")}`;
  }

  writeFileSync(join(destination, "package.json"), `${JSON.stringify({ name, version: manifest.version, private: true, type: "module", exports, license: manifest.license }, null, 2)}\n`);
  inventory.push({ name, version: manifest.version, kind: "workspace-compiled" });

  for (const dependency of Object.keys(manifest.dependencies ?? {})) copyPackage(dependency, directory);
}

try {
  copyPackage("@sceneaxi/cli", join(root, "packages/cli"));
  paths["@sceneaxi-internal/project-git-authority"] = "./runtime/@sceneaxi/authoring-core/dist/internal/project-git-authority.js";
  mkdirSync(join(artifact, "bin"));
  cpSync(join(root, "packages/cli/bin/sceneaxi.mjs"), join(artifact, "bin/sceneaxi.mjs"));
  writeFileSync(join(artifact, "runtime-map.json"), `${JSON.stringify(paths, null, 2)}\n`);
  writeFileSync(join(artifact, "artifact.json"), `${JSON.stringify({ schemaVersion: 1, kind: "sceneaxi.private-compiled-cli", publicationAuthorized: false, supportedNode: "24", packages: inventory }, null, 2)}\n`);
  const packed = spawnSync("tar", ["--sort=name", "--mtime=@0", "--owner=0", "--group=0", "--numeric-owner", "-czf", out, "-C", stage, "sceneaxi-cli"], { encoding: "utf8" });

  if (packed.status !== 0) throw new Error(`CLI_ARCHIVE_TAR_FAILED:${packed.stderr}`);
  const bytes = readFileSync(out);
  process.stdout.write(`${JSON.stringify({ status: "prepared-private", archive: out, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), publicationAuthorized: false, packages: inventory })}\n`);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
