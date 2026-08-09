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
 * It also protects the renderer's bundling contract. `scripts/build.mjs` bundles
 * `src/renderer/*` for `platform: "browser"`, so a Node builtin anywhere in that
 * module graph — the renderer's own files or any workspace entry point they reach
 * — is an unresolvable import that breaks `build`, `dist`, and the packaged smoke.
 * The root `build` stage is `tsc --build`, which type-checks that import happily,
 * so nothing else in the gate can see it. This check walks the graph instead of
 * trusting the tier split, because a package's root barrel is Node-bearing far more
 * often than its individual modules are.
 *
 * Fail-closed: an empty `desktop/` tree, a missing required file, an app that is not
 * matrix-listed, any of that toolchain leaking into the hermetic root, an Electron import outside
 * `src/electron/`, a provider adapter import outside that privileged host, an import
 * that reaches into that privileged host from outside it, a Node builtin reachable
 * from the browser-bundled renderer, or any committed secret value exits 1.
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
const DESKTOP_RENDERER_OWNER = "src/renderer/viewport.ts";

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
/**
 * Confining the adapter by its own specifier alone would only move the leak: a
 * `src/lib/` or `src/renderer/` module re-exporting the privileged host pulls the
 * same adapter into the same bundle while naming neither Electron nor the adapter.
 * Any module specifier resolving into `src/electron/` from outside it is refused —
 * relative or through the package's own `exports` map, since Node, TypeScript, and
 * esbuild all resolve a self-reference that way and a published privileged subpath
 * is otherwise the one specifier that reaches the host without naming a path.
 */
const ANY_MODULE_SPEC = /(?:from\s+|require\s*\(\s*|import\s*\(\s*|^\s*import\s+)["']([^"']+)["']/gm;
const contains = (parent, candidate) => {
  const rel = relative(parent, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !rel.startsWith("/"));
};

/** Every string target in an `exports` map, keyed by its subpath. */
const exportTargets = (exportsField) => {
  const targets = new Map();
  const leaves = (value, out = []) => {
    if (typeof value === "string") out.push(value);
    else if (value !== null && typeof value === "object") {
      for (const nested of Object.values(value)) leaves(nested, out);
    }
    return out;
  };
  if (typeof exportsField === "string") {
    targets.set(".", leaves(exportsField));
  } else if (exportsField !== null && typeof exportsField === "object") {
    for (const [subpath, value] of Object.entries(exportsField)) {
      targets.set(subpath.startsWith(".") ? subpath : ".", leaves(value));
    }
  }
  return targets;
};

/**
 * Resolve a specifier to the file paths it can reach inside `dir`, or `null` when it
 * names something outside this package. A self-reference goes through `exports` when
 * the manifest declares one, because that map is the only resolution Node performs.
 */
const resolveWithinApp = (spec, file, dir, manifestName, exportsMap) => {
  if (spec.startsWith(".")) return [resolve(dirname(file), spec)];
  if (spec !== manifestName && !spec.startsWith(`${manifestName}/`)) return null;
  const subpath = spec === manifestName ? "." : `.${spec.slice(manifestName.length)}`;
  if (exportsMap.size === 0) return [resolve(dir, subpath)];
  const declared = exportsMap.get(subpath);
  if (declared === undefined) return [];
  return declared.map((target) => resolve(dir, target));
};

/**
 * Every Node builtin the browser-bundled module graph rooted at `entry` can reach.
 *
 * Resolution mirrors what esbuild does for this tier: relative specifiers directly
 * (with the repository's `.js`-specifier-for-a-`.ts`-file convention), and workspace
 * specifiers through the target package's own `exports` map, since that map is the
 * only thing that decides which file a subpath is. A type-only import is skipped —
 * it is erased before the bundler sees it, which is exactly why a Node-bearing type
 * edge is not a bundling problem and a value edge is.
 */
const NODE_BUILTIN_SPEC =
  /(?:from\s+|require\s*\(\s*|import\s*\(\s*|^\s*import\s+)["'](node:[a-z_/]+)["']/gm;
const VALUE_MODULE_SPEC =
  /(?:^\s*import\s+(?!type\s)[^;]*?from\s+|^\s*import\s+|^\s*export\s+(?!type\s)[^;]*?from\s+|require\s*\(\s*|import\s*\(\s*)["']([^"']+)["']/gm;

const sourceFileFor = (target) => {
  const candidates = target.endsWith(".js")
    ? [`${target.slice(0, -3)}.ts`, `${target.slice(0, -3)}.tsx`, target]
    : [target, `${target}.ts`, `${target}.tsx`, join(target, "index.ts")];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
};

const workspaceEntryFor = (spec, matrixEntries) => {
  const parts = spec.split("/");
  const name = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  const declared = matrixEntries[name];
  if (declared === undefined) return null;
  const pkgDir = resolve(root, declared.dir);
  let json;
  try {
    json = readJson(join(pkgDir, "package.json"));
  } catch {
    return null;
  }
  const subpath = spec === name ? "." : `.${spec.slice(name.length)}`;
  const targets = exportTargets(json.exports).get(subpath) ?? [];
  return targets
    .map((target) => sourceFileFor(resolve(pkgDir, target)))
    .filter((file) => file !== null);
};

function nodeBuiltinsReachableFrom(entry, matrixEntries) {
  const offences = [];
  const seen = new Set();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const match of text.matchAll(NODE_BUILTIN_SPEC)) {
      offences.push({ builtin: match[1], via: relative(root, file) });
    }
    for (const match of text.matchAll(VALUE_MODULE_SPEC)) {
      const spec = match[1];
      if (spec.startsWith("node:")) continue;
      const next = spec.startsWith(".")
        ? [sourceFileFor(resolve(dirname(file), spec))].filter((candidate) => candidate !== null)
        : (workspaceEntryFor(spec, matrixEntries) ?? []);
      queue.push(...next);
    }
  }
  return offences;
}

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
  const appExports = exportTargets(manifest.exports);
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
  const presentationOwners = [];
  if (existsSync(srcDir)) {
    for (const file of walk(srcDir)) {
      if (!/\.(ts|tsx|mts|cts|js|mjs|cjs)$/.test(file)) continue;
      const text = readFileSync(file, "utf8");
      if (
        [...text.matchAll(VALUE_MODULE_SPEC)].some(
          (match) => match[1] === "@sceneaxi/engine-presentation",
        )
      ) {
        presentationOwners.push(relative(dir, file));
      }
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
      if (contains(electronDir, file)) continue;
      for (const match of text.matchAll(ANY_MODULE_SPEC)) {
        const spec = match[1];
        const resolved = resolveWithinApp(spec, file, dir, manifest.name, appExports);
        if (resolved === null) continue;
        if (!resolved.some((target) => contains(electronDir, target))) continue;
        fail(
          `${relative(root, file)} imports '${spec}' — nothing outside ${relative(root, electronDir)}/ may reach the privileged host, which would launder the provider adapter into an unprivileged bundle`,
        );
      }
    }
  }
  if (
    manifest.dependencies?.["@sceneaxi/engine-presentation"] !== undefined &&
    (presentationOwners.length !== 1 ||
      presentationOwners[0] !== DESKTOP_RENDERER_OWNER)
  ) {
    fail(
      `${manifest.name}: presentation runtime ownership must be exactly '${DESKTOP_RENDERER_OWNER}' (found ${presentationOwners.join(", ") || "none"})`,
    );
  }

  const rendererDir = join(srcDir, "renderer");
  if (existsSync(rendererDir)) {
    for (const entry of walk(rendererDir)) {
      if (!/\.(ts|tsx|mts|js|mjs)$/.test(entry)) continue;
      for (const offence of nodeBuiltinsReachableFrom(entry, matrixPackages)) {
        fail(
          `${relative(root, entry)} reaches '${offence.builtin}' through ${offence.via} — ${relative(root, rendererDir)}/ is bundled for the browser, so a Node builtin anywhere in its module graph cannot resolve`,
        );
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
