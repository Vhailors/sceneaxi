#!/usr/bin/env node
/**
 * Boundary check — enforces docs/dependency-matrix.json over every workspace package.
 * Fail-closed: a missing/malformed matrix, an unlisted package, an undeclared or
 * disallowed internal dependency, a cross-package source import, production source
 * reaching a test-only `testing/` seam, a Kids-boundary violation, or a release-group
 * mismatch all exit 1.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const fail = (msg) => errors.push(msg);

// --- load matrix (fail closed) ---
const matrixPath = join(root, "docs", "dependency-matrix.json");
let matrix;
try {
  matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
} catch (e) {
  console.error(`boundary check: cannot load ${relative(root, matrixPath)}: ${e.message}`);
  process.exit(1);
}
if (matrix.schemaVersion !== 1) {
  console.error(`boundary check: unsupported matrix schemaVersion ${matrix.schemaVersion}`);
  process.exit(1);
}
const allowOf = matrix.packages ?? {};
const kids = matrix.kidsBoundary ?? { kidsPackages: [], allowedDependents: [] };
const releaseGroups = matrix.releaseGroups ?? {};

// --- discover packages (packages/*, apps/*) plus the deployable sites/ and desktop/ tiers ---
// `sites/*` and `desktop/*` are separate single-package workspaces outside the
// repository-root workspace, but their @sceneaxi/* edges use the same exhaustive
// allow lists.
const pkgDirs = [];
for (const parent of ["packages", "apps", "sites", "desktop"]) {
  const parentDir = join(root, parent);
  if (!existsSync(parentDir)) continue;
  for (const entry of readdirSync(parentDir)) {
    const dir = join(parentDir, entry);
    if (statSync(dir).isDirectory() && existsSync(join(dir, "package.json"))) {
      pkgDirs.push(dir);
    }
  }
}
if (pkgDirs.length === 0) {
  console.error("boundary check: found zero workspace packages — refusing to pass on an empty surface");
  process.exit(1);
}

const manifests = new Map(); // name -> {dir, json}
for (const dir of pkgDirs) {
  let json;
  try {
    json = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  } catch (e) {
    fail(`${relative(root, dir)}/package.json is malformed: ${e.message}`);
    continue;
  }
  if (!json.name) { fail(`${relative(root, dir)}/package.json has no name`); continue; }
  manifests.set(json.name, { dir, json });
}

// --- coverage both ways: disk <-> matrix ---
for (const [name, { dir }] of manifests) {
  const entry = allowOf[name];
  if (!entry) { fail(`${name} exists on disk but is not listed in the dependency matrix`); continue; }
  if (resolve(root, entry.dir) !== dir) {
    fail(`${name}: matrix dir '${entry.dir}' does not match actual '${relative(root, dir)}'`);
  }
}
for (const name of Object.keys(allowOf)) {
  if (!manifests.has(name)) fail(`${name} is listed in the dependency matrix but missing on disk`);
}

// --- declared dependency edges ---
const DEP_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
for (const [name, { json }] of manifests) {
  const allow = new Set(allowOf[name]?.allow ?? []);
  for (const field of DEP_FIELDS) {
    for (const dep of Object.keys(json[field] ?? {})) {
      if (!dep.startsWith("@sceneaxi/")) continue;
      if (!allowOf[dep]) fail(`${name}: internal dependency ${dep} is not a matrix-listed package`);
      if (!allow.has(dep)) fail(`${name}: dependency ${dep} is DENIED by the matrix`);
    }
  }
}

// --- source imports (import/export-from/require specifiers) ---
const SPEC_RE = /(?:from\s+|require\s*\(\s*|import\s*\(\s*|^\s*import\s+)["']([^"']+)["']/gm;
const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry)) out.push(p);
  }
  return out;
};
// A package may declare a visibly test-only `./testing/*` subpath so that tests in
// another package reach a real fixture seam by public package name instead of a relative
// path into a foreign test directory. That surface exists for tests alone, so it must be
// unreachable from production source, and both ways in are refused below: the public
// subpath specifier, and a relative import that lands in the package's own src/testing
// tree. Only a file already inside src/testing may name a sibling there.
const TESTING_SUBPATH_SEGMENT = "testing";
const isTestingSubpath = (spec) =>
  spec.startsWith("@sceneaxi/") && spec.split("/")[2] === TESTING_SUBPATH_SEGMENT;
// Path-segment containment via relative(), never raw startsWith, so a sibling directory
// whose name merely begins with "testing" is not treated as inside it.
const contains = (parent, candidate) => {
  const rel = relative(parent, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};
for (const [name, { dir }] of manifests) {
  const srcDir = join(dir, "src");
  if (!existsSync(srcDir)) continue;
  const allow = new Set(allowOf[name]?.allow ?? []);
  const testingDir = join(srcDir, TESTING_SUBPATH_SEGMENT);
  for (const file of walk(srcDir)) {
    const fromTesting = contains(testingDir, file);
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(SPEC_RE)) {
      const spec = m[1];
      if (spec.startsWith("@sceneaxi/")) {
        const target = spec.split("/").slice(0, 2).join("/");
        if (!allow.has(target)) {
          fail(`${name}: ${relative(root, file)} imports ${target}, DENIED by the matrix`);
        }
        if (isTestingSubpath(spec)) {
          fail(`${name}: ${relative(root, file)} imports test-only subpath ${spec} — production source may not reach a testing/ seam`);
        }
      } else if (spec.startsWith(".")) {
        const resolved = resolve(dirname(file), spec);
        // Path-segment containment (not raw startsWith): "packages/cli-shadow" must not match "packages/cli"
        const rel = relative(dir, resolved);
        if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
          fail(`${name}: ${relative(root, file)} escapes its package via relative import '${spec}'`);
        } else if (!fromTesting && contains(testingDir, resolved)) {
          fail(`${name}: ${relative(root, file)} imports test-only module '${spec}' — production source may not reach a testing/ seam`);
        }
      }
    }
  }
}

// --- Kids boundary (independent of allow lists) ---
const kidsSet = new Set(kids.kidsPackages ?? []);
const kidsOk = new Set(kids.allowedDependents ?? []);
for (const [name, { json, dir }] of manifests) {
  if (kidsSet.has(name) || kidsOk.has(name)) continue;
  for (const field of DEP_FIELDS) {
    for (const dep of Object.keys(json[field] ?? {})) {
      if (kidsSet.has(dep)) fail(`${name}: depends on Kids package ${dep} — Kids boundary violation`);
    }
  }
  const srcDir = join(dir, "src");
  if (existsSync(srcDir)) {
    for (const file of walk(srcDir)) {
      for (const m of readFileSync(file, "utf8").matchAll(SPEC_RE)) {
        const target = m[1].startsWith("@sceneaxi/") ? m[1].split("/").slice(0, 2).join("/") : null;
        if (target && kidsSet.has(target)) {
          fail(`${name}: ${relative(root, file)} imports Kids package ${target} — Kids boundary violation`);
        }
      }
    }
  }
}

// --- release groups and profile core pins ---
for (const [name, { json }] of manifests) {
  const expected = allowOf[name]?.releaseGroup;
  if (!expected) continue; // coverage failure already recorded above
  const actual = json.sceneaxi?.releaseGroup;
  if (actual !== expected) {
    fail(`${name}: sceneaxi.releaseGroup is '${actual}', matrix says '${expected}'`);
  }
  if (!releaseGroups[expected]) fail(`${name}: release group '${expected}' has no policy in the matrix`);
  if (expected === "profile" && typeof json.sceneaxi?.corePin !== "string") {
    fail(`${name}: profile package must declare sceneaxi.corePin (core-train semver range)`);
  }
}

if (errors.length > 0) {
  console.error(`boundary check FAILED — ${errors.length} violation(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`boundary check OK — ${manifests.size} packages verified against dependency-matrix.json`);
