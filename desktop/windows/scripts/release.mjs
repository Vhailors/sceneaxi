#!/usr/bin/env node
/** Upload already verified local bytes to an operator-created draft only. No build/publish occurs here. */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { uploadVerifiedWindowsDraft } from "./package-release.mjs";
import { requireWindowsReleaseEnvironment, windowsCheckoutProvenance } from "./release-preflight.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const githubEnv = () => ({ ...process.env, GH_TOKEN: process.env.GITHUB_RELEASE_TOKEN });

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: appRoot, encoding: "utf8", timeout: 120000, ...options });

  if (result.error || result.status !== 0) throw new Error(`WINDOWS_RELEASE_COMMAND_FAILED:${command}`);

  return result.stdout;
};

try {
  requireWindowsReleaseEnvironment({ publishing: true });
  const tag = process.env.SCENEAXI_WINDOWS_RELEASE_TAG.trim();
  const { version } = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8"));

  if (tag !== `v${version}`) throw new Error(`desktop-windows release refused — SCENEAXI_WINDOWS_RELEASE_TAG must equal v${version}`);
  // All integrity, real signature and native pixel acceptance precede remote lookup/upload.
  uploadVerifiedWindowsDraft({
    appRoot, tag, sourceCommit: windowsCheckoutProvenance(),
    verifyNative: () => run(process.execPath, [join(appRoot, "scripts/smoke.mjs"), "--packaged"], { stdio: "inherit" }),
    readDraft: () => JSON.parse(run("gh.exe", ["release", "view", tag, "--repo", "Vhailors/sceneaxi", "--json", "isDraft,tagName,targetCommitish"], { env: githubEnv() })),
    // No --clobber, release creation, tag creation or publish.
    upload: (files) => run("gh.exe", ["release", "upload", tag, ...files, "--repo", "Vhailors/sceneaxi"], { env: githubEnv(), stdio: "inherit" }),
  });
  console.log(`desktop-windows release upload OK — draft ${tag}; operator must publish it explicitly`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "WINDOWS_RELEASE_FAILED");
  process.exit(1);
}
