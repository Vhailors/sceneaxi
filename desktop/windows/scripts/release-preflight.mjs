#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const repositoryRoot = resolve(appRoot, "../..");

export function requireEmptyWindowsOutput(directory = join(appRoot, "release")) {
  if (!existsSync(directory)) return;
  const stat = lstatSync(directory);

  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("WINDOWS_RELEASE_OUTPUT_INVALID");

  if (readdirSync(directory).length !== 0) throw new Error("WINDOWS_RELEASE_OUTPUT_NOT_EMPTY");
}

export function windowsCheckoutProvenance(env = process.env) {
  const declared = env.GITHUB_SHA?.trim();

  if (!declared) throw new Error("WINDOWS_PROVENANCE_REQUIRED:GITHUB_SHA");

  if (!/^[a-f0-9]{40}$/.test(declared)) throw new Error("WINDOWS_PROVENANCE_INVALID:GITHUB_SHA");
  const git = (args) => spawnSync("git", args, { cwd: repositoryRoot, encoding: "utf8", timeout: 10000 });
  const head = git(["rev-parse", "--verify", "HEAD"]);
  const status = git(["status", "--porcelain"]);

  if (head.status !== 0 || status.status !== 0) throw new Error("WINDOWS_PROVENANCE_UNVERIFIABLE:checkout");

  if (head.stdout.trim() !== declared) throw new Error("WINDOWS_PROVENANCE_COMMIT_MISMATCH");

  if (status.stdout.trim() !== "") throw new Error("WINDOWS_PROVENANCE_WORKTREE_DIRTY");

  return declared;
}

export const WINDOWS_SIGNING_ENV = Object.freeze([
  "WIN_CSC_LINK",
  "WIN_CSC_KEY_PASSWORD",
]);

export const WINDOWS_RELEASE_ENV = Object.freeze([
  "GITHUB_RELEASE_TOKEN",
  "SCENEAXI_WINDOWS_RELEASE_TAG",
]);

// Decode primitive text without coercing objects or admitting boxed strings.
function parseReleaseText(value) {
  try {
    const text = String.prototype.valueOf.call(value);

    return text === value ? text : undefined;
  } catch {
    return undefined;
  }
}

const present = (value) => {
  const text = parseReleaseText(value);

  return text !== undefined && text.trim().length > 0;
};

export function windowsReleasePreflight({
  env = process.env,
  platform = process.platform,
  commandAvailable = (command) =>
    spawnSync("where.exe", [command], { stdio: "ignore" }).status === 0,
  publishing = false,
} = {}) {
  const reasons = [];

  if (platform !== "win32") reasons.push("WINDOWS_RELEASE_HOST_REQUIRED");

  for (const name of WINDOWS_SIGNING_ENV) {
    if (!present(env[name])) reasons.push(`WINDOWS_RELEASE_ENV_MISSING:${name}`);
  }

  if (!commandAvailable("signtool.exe")) {
    reasons.push("WINDOWS_RELEASE_TOOL_MISSING:signtool.exe");
  }

  if (publishing) {
    for (const name of WINDOWS_RELEASE_ENV) {
      if (!present(env[name])) reasons.push(`WINDOWS_RELEASE_ENV_MISSING:${name}`);
    }

    if (!commandAvailable("gh.exe")) reasons.push("WINDOWS_RELEASE_TOOL_MISSING:gh.exe");
  }

  return Object.freeze({ ok: reasons.length === 0, reasons: Object.freeze(reasons) });
}

export function requireWindowsReleaseEnvironment(options = {}) {
  const result = windowsReleasePreflight(options);

  if (!result.ok) {
    throw new Error(`desktop-windows release preflight refused:\n${result.reasons.join("\n")}`);
  }

  windowsCheckoutProvenance(options.env ?? process.env);
}
