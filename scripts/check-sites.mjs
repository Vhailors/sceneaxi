#!/usr/bin/env node
/**
 * Sites check — structural gate for the `sites/` tier.
 *
 * The deployable sites are separate single-package pnpm workspaces and install
 * roots with their own lockfiles, deliberately outside the repository-root workspace,
 * so the hermetic root install, root lockfile, `tsc --build` graph, and gate runtime
 * stay untouched and no other lane's `pnpm install --frozen-lockfile` moves. That
 * isolation is exactly what this check protects — plus the rule that no secret value
 * is ever committed.
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
const KIDS_SITE_PACKAGE = "@sceneaxi/site-kids";
const KIDS_SITE_RUNTIME_DEPENDENCIES = Object.freeze(["next", "react", "react-dom"]);
const KIDS_SITE_DEVELOPMENT_DEPENDENCIES = Object.freeze([
  "@types/node",
  "@types/react",
  "@types/react-dom",
  "typescript",
]);
const KIDS_SITE_FORBIDDEN_SOURCE_APIS = Object.freeze([
  { label: "fetch", pattern: /\bfetch\s*\(/ },
  { label: "XMLHttpRequest", pattern: /\bXMLHttpRequest\b/ },
  { label: "WebSocket", pattern: /\bWebSocket\b/ },
  { label: "EventSource", pattern: /\bEventSource\b/ },
  { label: "sendBeacon", pattern: /\bsendBeacon\b/ },
  { label: "environment access", pattern: /\bprocess\.env\b/ },
  { label: "form", pattern: /<form\b/i },
  { label: "link", pattern: /<a\b/i },
  { label: "external URL", pattern: /https?:\/\//i },
]);

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

const SKIP_DIRECTORIES = Object.freeze([
  "node_modules",
  ".next",
  "dist",
  "coverage",
  "test-results",
  "playwright-report",
]);

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

const ENV_REFERENCE_SOURCE =
  String.raw`(?:process\.env|env|environment)(?:\.[A-Za-z_$][\w$]*|\[(?:"[^"\r\n]+"|'[^'\r\n]+')\])`;
const ENV_OPERAND = new RegExp(`^${ENV_REFERENCE_SOURCE}`);

/**
 * Whether the value of an assignment starting at `start` is a committed secret.
 *
 * A complete assignment expression is inspected, including a value continued onto the
 * following line — for example `STRIPE_SECRET_KEY = process.env.X` with `?? "committed"`
 * on the next line. The assignment is safe only while every operand is a `process.env`
 * reference; the moment a coalesce/fallback chain introduces a literal or any non-env
 * operand, the assignment carries a committed value and is refused. Bracket env keys
 * such as `process.env["NAME"]` are consumed as part of the operand, so their string key
 * never reads as a committed literal. A TypeScript non-null assertion
 * (`process.env.X!`) is a postfix on the operand and is consumed rather than treated as
 * trailing syntax; any other trailing syntax that is neither an expression terminator
 * nor a recognized binary operator is treated as a committed value, because the scanner
 * cannot prove it does not introduce one.
 */
function rhsIsCommittedSecret(text, start) {
  const len = text.length;
  let i = start;
  const skipTrivia = () => {
    while (i < len) {
      const ch = text[i];
      if (ch === "/" && text[i + 1] === "/") {
        while (i < len && text[i] !== "\n") i += 1;
        continue;
      }
      if (ch === "#") {
        while (i < len && text[i] !== "\n") i += 1;
        continue;
      }
      if (ch === "/" && text[i + 1] === "*") {
        i += 2;
        while (i < len && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
        i += 2;
        continue;
      }
      if (/\s/.test(ch)) {
        i += 1;
        continue;
      }
      break;
    }
  };
  const readEnvOperand = () => {
    const match = ENV_OPERAND.exec(text.slice(i));
    if (match === null) return false;
    i += match[0].length;
    return true;
  };
  skipTrivia();
  if (!readEnvOperand()) return true;
  const readPostfixAssertions = () => {
    for (;;) {
      skipTrivia();
      if (text[i] === "!") {
        i += 1;
        continue;
      }
      break;
    }
  };
  for (;;) {
    readPostfixAssertions();
    skipTrivia();
    const rest = text.slice(i);
    if (rest === "" || /^[;),}\]].?/.test(rest)) return false;
    const operator = /^(?:\?\?|\|\||&&|\?|:|\+)/.exec(rest);
    if (operator === null) return true;
    i += operator[0].length;
    skipTrivia();
    if (!readEnvOperand()) return true;
  }
}

const assignsSecretValue = (text, name) => {
  const header = new RegExp(
    `(?:"${name}"|'${name}'|\`${name}\`|\\b${name}\\b)\\s*(?::|=(?!=))\\s*`,
    "g",
  );
  for (const match of text.matchAll(header)) {
    const valueStart = (match.index ?? 0) + match[0].length;
    if (rhsIsCommittedSecret(text, valueStart)) return true;
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

  const dependencies = manifest.dependencies ?? {};
  if (manifest.name === KIDS_SITE_PACKAGE) {
    const runtimeNames = Object.keys(dependencies).sort();
    if (JSON.stringify(runtimeNames) !== JSON.stringify(KIDS_SITE_RUNTIME_DEPENDENCIES)) {
      fail(
        `${manifest.name}: the isolated Kids runtime may declare only next, react, and react-dom (found ${runtimeNames.join(", ") || "none"})`,
      );
    }
    const developmentNames = Object.keys(manifest.devDependencies ?? {}).sort();
    if (
      developmentNames.some(
        (dependency) => !KIDS_SITE_DEVELOPMENT_DEPENDENCIES.includes(dependency),
      )
    ) {
      fail(
        `${manifest.name}: the isolated Kids development toolchain contains an undeclared dependency`,
      );
    }
    for (const field of ["optionalDependencies", "peerDependencies"]) {
      if (Object.keys(manifest[field] ?? {}).length > 0) {
        fail(`${manifest.name}: ${field} must stay empty under the isolated Kids build`);
      }
    }
    const kidsWorkspacePolicy = readFileSync(join(dir, "pnpm-workspace.yaml"), "utf8").trim();
    const expectedKidsWorkspacePolicy = [
      "packages:",
      '  - "."',
      "allowBuilds:",
      "  sharp: true",
    ].join("\n");
    if (kidsWorkspacePolicy !== expectedKidsWorkspacePolicy) {
      fail(
        `${manifest.name}: pnpm build approval must allow only sharp in the isolated site workspace`,
      );
    }
  } else {
    const siteKit = dependencies["@sceneaxi/site-kit"];
    if (typeof siteKit !== "string") {
      fail(`${manifest.name} must depend on @sceneaxi/site-kit`);
    } else if (!siteKit.startsWith("link:")) {
      fail(
        `${manifest.name}: @sceneaxi/site-kit must use a 'link:' specifier (found '${siteKit}') because sites are not workspace members`,
      );
    }
  }
  for (const framework of ["next", "react", "react-dom"]) {
    if (dependencies[framework] === undefined) {
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
      } else if (manifest.name === KIDS_SITE_PACKAGE) {
        fail(
          `${rel}/.env.example:${index + 1} declares '${match[1]}' — the first-release Kids site accepts no environment inputs`,
        );
      }
    }
  }
}

// --- no committed secret value anywhere under sites/ ---
for (const file of walk(sitesDir)) {
  const rel = relative(root, file);
  const text = readFileSync(file, "utf8");
  if (rel.startsWith("sites/kids/src/")) {
    for (const forbidden of KIDS_SITE_FORBIDDEN_SOURCE_APIS) {
      if (forbidden.pattern.test(text)) {
        fail(
          `${rel} names ${forbidden.label} — the first-release Kids source has no external data path`,
        );
      }
    }
  }
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
