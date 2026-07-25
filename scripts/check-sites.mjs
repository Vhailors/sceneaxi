#!/usr/bin/env node
/**
 * Sites check — structural gate for the `sites/` tier.
 *
 * The three deployable sites are separate install roots with their own lockfiles,
 * deliberately **not** `pnpm-workspace` members, so the hermetic root install, root
 * lockfile, `tsc --build` graph, and gate runtime stay untouched and no other lane's
 * `pnpm install --frozen-lockfile` moves. That isolation is exactly what this check
 * protects — plus the rule that no secret value is ever committed.
 *
 * Fail-closed: an empty `sites/` tree, a missing required file, a site that is not
 * matrix-listed, a framework dependency leaking into the hermetic root, or any
 * committed secret value exits 1.
 */
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const fail = (msg) => errors.push(msg);

const REQUIRED_FILES = Object.freeze([
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  ".env.example",
  "README.md",
  "src/index.ts",
]);

const REQUIRED_SCRIPTS = Object.freeze(["dev", "build", "typecheck"]);

/** Framework and provider SDKs belong in `sites/`, never in the hermetic root. */
const FRAMEWORK_DEPENDENCIES = Object.freeze([
  "next",
  "react",
  "react-dom",
  "better-auth",
  "stripe",
  "@neondatabase/serverless",
  "pg",
]);

/**
 * Secret-shaped material. Names alone are fine (that is what `.env.example` is
 * for); a name assigned a value is not.
 */
const SECRET_NAMES = Object.freeze([
  "DATABASE_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SCENEAXI_ADMIN_BOOTSTRAP_SECRET",
  "BETTER_AUTH_SECRET",
]);

const SECRET_VALUE_PATTERNS = Object.freeze([
  /\bsk_(?:test|live)_[A-Za-z0-9]{8,}/,
  /\bwhsec_[A-Za-z0-9]{8,}/,
  /\bpostgres(?:ql)?:\/\/[^\s"'`]*:[^\s"'`@]+@/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
]);

const SKIP_DIRECTORIES = Object.freeze(["node_modules", ".next", "dist", "coverage"]);

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir).sort()) {
    if (SKIP_DIRECTORIES.includes(entry)) continue;
    const path = join(dir, entry);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
      fail(`${relative(root, path)} is a symbolic link — sites must be self-contained`);
    } else if (stat.isDirectory()) {
      walk(path, out);
    } else if (stat.isFile()) {
      out.push(path);
    }
  }
  return out;
};

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const assignsSecretValue = (text, name) => {
  const assignment = new RegExp(
    `(?:"${name}"|'${name}'|\`${name}\`|\\b${name}\\b)\\s*(?::|=(?!=))\\s*("([^"\\n]+)"|'([^'\\n]+)'|\`([^\`\\n]+)\`|([^\\s#,;\\]}]+))`,
    "g",
  );
  for (const match of text.matchAll(assignment)) {
    const value = match[2] ?? match[3] ?? match[4] ?? match[5] ?? "";
    if (!/^(?:process\.env|env|environment)(?:\.|\[)/.test(value)) return true;
  }
  return false;
};

// --- the tier must exist and be non-empty ---
const sitesDir = join(root, "sites");
if (!existsSync(sitesDir)) {
  console.error("sites check: sites/ does not exist — refusing to pass on a missing tier");
  process.exit(1);
}
const siteDirs = readdirSync(sitesDir)
  .sort()
  .map((entry) => join(sitesDir, entry))
  .filter((dir) => statSync(dir).isDirectory() && existsSync(join(dir, "package.json")));
if (siteDirs.length === 0) {
  console.error("sites check: found zero sites — refusing to pass on an empty surface");
  process.exit(1);
}

// --- the matrix must list every site, and vice versa ---
let matrix;
try {
  matrix = readJson(join(root, "docs", "dependency-matrix.json"));
} catch (error) {
  console.error(`sites check: cannot load docs/dependency-matrix.json: ${error.message}`);
  process.exit(1);
}
const matrixPackages = matrix.packages ?? {};

// --- the hermetic root must stay hermetic ---
const rootManifest = readJson(join(root, "package.json"));
for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) {
  for (const dep of Object.keys(rootManifest[field] ?? {})) {
    if (FRAMEWORK_DEPENDENCIES.includes(dep)) {
      fail(
        `root package.json declares '${dep}' in ${field} — framework and provider SDKs stay in the sites/ tier`,
      );
    }
  }
}

const workspaceFile = join(root, "pnpm-workspace.yaml");
if (existsSync(workspaceFile)) {
  const workspace = readFileSync(workspaceFile, "utf8");
  if (/^\s*-\s*["']?sites\//m.test(workspace)) {
    fail(
      "pnpm-workspace.yaml globs sites/ — sites are separate install roots so the hermetic root lockfile never moves",
    );
  }
}

// --- per-site structure ---
for (const dir of siteDirs) {
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
  if (manifest.sceneaxi?.releaseGroup !== "sites") {
    fail(
      `${manifest.name}: sceneaxi.releaseGroup is '${manifest.sceneaxi?.releaseGroup}', must be 'sites'`,
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

  const siteKit = manifest.dependencies?.["@sceneaxi/site-kit"];
  if (typeof siteKit !== "string") {
    fail(`${manifest.name} must depend on @sceneaxi/site-kit`);
  } else if (!siteKit.startsWith("link:")) {
    fail(
      `${manifest.name}: @sceneaxi/site-kit must use a 'link:' specifier (found '${siteKit}') because sites are not workspace members`,
    );
  }
  for (const framework of ["next", "react", "react-dom"]) {
    if (manifest.dependencies?.[framework] === undefined) {
      fail(`${manifest.name} must declare '${framework}' — a site is a deployable Next app`);
    }
  }

  // `.env.example` documents names, never values.
  const envExample = join(dir, ".env.example");
  if (existsSync(envExample)) {
    for (const [index, line] of readFileSync(envExample, "utf8").split("\n").entries()) {
      const trimmed = line.trim();
      if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(trimmed);
      if (match === null) {
        fail(`${rel}/.env.example:${index + 1} is neither a comment nor a NAME= line`);
      } else if (match[2].trim().length > 0) {
        fail(`${rel}/.env.example:${index + 1} assigns a value to '${match[1]}' — names only`);
      }
    }
  }
}

// --- no committed secret value anywhere under sites/ ---
for (const file of walk(sitesDir)) {
  const rel = relative(root, file);
  const text = readFileSync(file, "utf8");
  for (const pattern of SECRET_VALUE_PATTERNS) {
    if (pattern.test(text)) fail(`${rel} contains secret-shaped material (${pattern})`);
  }
  if (rel.endsWith(".env.example")) continue;
  for (const name of SECRET_NAMES) {
    if (assignsSecretValue(text, name)) {
      fail(`${rel} assigns a literal value to '${name}' — secrets are env-only, never committed`);
    }
  }
}

if (errors.length > 0) {
  console.error(`sites check FAILED — ${errors.length} problem(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(
  `sites check OK — ${siteDirs.length} deployable sites verified (separate install roots, matrix-listed, no committed secrets)`,
);
