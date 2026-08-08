#!/usr/bin/env node
/**
 * Desktop check — structural gate for the `desktop/` tier (ADR 0024).
 *
 * Each desktop application is a separate single-package pnpm workspace and install
 * root with its own lockfile, deliberately outside the repository-root workspace, so
 * Electron, its bundler, and its packaging toolchain never move the hermetic root
 * install, the root lockfile, the `tsc --build` graph, or the gate runtime. That isolation is what this
 * check protects — plus the rule that no secret value is ever committed, and the
 * tier's own split: only `src/electron/**` may import Electron or the concrete
 * provider adapter, so everything under `src/lib/**` stays pure TypeScript the
 * hermetic gate can test from `tests/desktop/`.
 *
 * Fail-closed: an empty `desktop/` tree, a missing required file, an app that is not
 * matrix-listed, any of that toolchain leaking into the hermetic root, an Electron import outside
 * `src/electron/`, a provider adapter import outside that privileged host, or any
 * committed secret value exits 1.
 */
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const fail = (msg) => errors.push(msg);

const REQUIRED_FILES = Object.freeze([
  "package.json",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "electron-builder.yml",
  "README.md",
  "src/index.ts",
]);

const REQUIRED_SCRIPTS = Object.freeze(["build", "dist", "smoke", "typecheck"]);

/**
 * Electron, its bundler, and its packaging toolchain belong in `desktop/`, never in
 * the hermetic root: each of them moves the root lockfile and the gate runtime, which
 * is the whole reason the tier is a separate install root (ADR 0024).
 */
const DESKTOP_DEPENDENCIES = Object.freeze(["electron", "electron-builder", "esbuild"]);

/** Same secret-shaped material the sites check refuses; the desktop tier needs no secret at all. */
const SECRET_VALUE_PATTERNS = Object.freeze([
  /\bsk_(?:test|live)_[A-Za-z0-9]{8,}/,
  /\bwhsec_[A-Za-z0-9]{8,}/,
  /\bpostgres(?:ql)?:\/\/[^\s"'`]*:[^\s"'`@]+@/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
]);

const SKIP_DIRECTORIES = Object.freeze(["node_modules", "dist", "release", "coverage"]);

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir).sort()) {
    if (SKIP_DIRECTORIES.includes(entry)) continue;
    const path = join(dir, entry);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
      fail(`${relative(root, path)} is a symbolic link — desktop apps must be self-contained`);
    } else if (stat.isDirectory()) {
      walk(path, out);
    } else if (stat.isFile()) {
      out.push(path);
    }
  }
  return out;
};

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

// --- the tier must exist and be non-empty ---
const desktopDir = join(root, "desktop");
if (!existsSync(desktopDir)) {
  console.error("desktop check: desktop/ does not exist — refusing to pass on a missing tier");
  process.exit(1);
}
const appDirs = readdirSync(desktopDir)
  .sort()
  .map((entry) => join(desktopDir, entry))
  .filter((dir) => statSync(dir).isDirectory() && existsSync(join(dir, "package.json")));
if (appDirs.length === 0) {
  console.error("desktop check: found zero desktop apps — refusing to pass on an empty surface");
  process.exit(1);
}

// --- the matrix must list every desktop app ---
let matrix;
try {
  matrix = readJson(join(root, "docs", "dependency-matrix.json"));
} catch (error) {
  console.error(`desktop check: cannot load docs/dependency-matrix.json: ${error.message}`);
  process.exit(1);
}
const matrixPackages = matrix.packages ?? {};

// --- the hermetic root must stay hermetic ---
const rootManifest = readJson(join(root, "package.json"));
for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) {
  for (const dep of Object.keys(rootManifest[field] ?? {})) {
    if (DESKTOP_DEPENDENCIES.includes(dep)) {
      fail(
        `root package.json declares '${dep}' in ${field} — Electron, its bundler, and packaging toolchains stay in the desktop/ tier`,
      );
    }
  }
}

const workspaceFile = join(root, "pnpm-workspace.yaml");
if (existsSync(workspaceFile)) {
  const workspace = readFileSync(workspaceFile, "utf8");
  if (/^\s*-\s*["']?desktop\//m.test(workspace)) {
    fail(
      "pnpm-workspace.yaml globs desktop/ — desktop apps are separate install roots so the hermetic root lockfile never moves",
    );
  }
}

// --- per-app structure ---
const ELECTRON_SPEC = /(?:from\s+|require\s*\(\s*|import\s*\(\s*|^\s*import\s+)["'](electron(?:\/[^"']*)?)["']/gm;
const PRIVILEGED_PROVIDER_SPEC = /(?:from\s+|require\s*\(\s*|import\s*\(\s*|^\s*import\s+)["'](@sceneaxi\/provider-openrouter(?:\/[^"']*)?)["']/gm;
const contains = (parent, candidate) => {
  const rel = relative(parent, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !rel.startsWith("/"));
};

for (const dir of appDirs) {
  const rel = relative(root, dir);
  for (const required of REQUIRED_FILES) {
    if (!existsSync(join(dir, required))) fail(`${rel} is missing required file '${required}'`);
  }

  let manifest;
  try {
    manifest = readJson(join(dir, "package.json"));
  } catch (error) {
    fail(`${rel}/package.json is malformed: ${error.message}`);
    continue;
  }

  if (typeof manifest.name !== "string" || manifest.name.length === 0) {
    fail(`${rel}/package.json has no name`);
    continue;
  }
  if (manifest.private !== true) fail(`${manifest.name} must be private`);
  if (manifest.sceneaxi?.releaseGroup !== "desktop") {
    fail(
      `${manifest.name}: sceneaxi.releaseGroup is '${manifest.sceneaxi?.releaseGroup}', must be 'desktop'`,
    );
  }

  const entry = matrixPackages[manifest.name];
  if (entry === undefined) {
    fail(`${manifest.name} exists on disk but is not listed in the dependency matrix`);
  } else if (resolve(root, entry.dir) !== resolve(dir)) {
    fail(`${manifest.name}: matrix dir '${entry.dir}' does not match actual '${rel}'`);
  }

  for (const script of REQUIRED_SCRIPTS) {
    if (typeof manifest.scripts?.[script] !== "string") {
      fail(`${manifest.name} is missing the '${script}' script`);
    }
  }

  // Workspace edges cross install roots, so they must be link: specifiers.
  for (const [dep, spec] of Object.entries(manifest.dependencies ?? {})) {
    if (dep.startsWith("@sceneaxi/") && !String(spec).startsWith("link:")) {
      fail(
        `${manifest.name}: ${dep} must use a 'link:' specifier (found '${spec}') because desktop apps are not workspace members`,
      );
    }
  }
  if (manifest.devDependencies?.electron === undefined) {
    fail(`${manifest.name} must declare 'electron' — a desktop app is a packaged Electron application`);
  }

  // Only src/electron/** may import Electron: everything else stays pure TypeScript
  // that the hermetic gate can exercise from tests/desktop/ without an Electron install.
  const srcDir = join(dir, "src");
  const electronDir = join(srcDir, "electron");
  if (existsSync(srcDir)) {
    for (const file of walk(srcDir)) {
      if (!/\.(ts|tsx|mts|cts|js|mjs|cjs)$/.test(file)) continue;
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(ELECTRON_SPEC)) {
        if (!contains(electronDir, file)) {
          fail(
            `${relative(root, file)} imports '${match[1]}' — only ${relative(root, electronDir)}/ may import Electron`,
          );
        }
      }
      for (const match of text.matchAll(PRIVILEGED_PROVIDER_SPEC)) {
        if (!contains(electronDir, file)) {
          fail(
            `${relative(root, file)} imports '${match[1]}' — only ${relative(root, electronDir)}/ may import a desktop provider adapter`,
          );
        }
      }
    }
  }
}

// --- no committed secret value anywhere under desktop/ ---
for (const file of walk(desktopDir)) {
  const rel = relative(root, file);
  const text = readFileSync(file, "utf8");
  for (const pattern of SECRET_VALUE_PATTERNS) {
    if (pattern.test(text)) fail(`${rel} contains secret-shaped material (${pattern})`);
  }
}

if (errors.length > 0) {
  console.error(`desktop check FAILED — ${errors.length} problem(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(
  `desktop check OK — ${appDirs.length} desktop app(s) verified (separate install roots, matrix-listed, privileged imports confined, no committed secrets)`,
);
