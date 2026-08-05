#!/usr/bin/env node
/**
 * Publish to an operator-created draft release only. This script never creates a
 * release or invents a tag, and it refuses before building when authority is absent.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packageWindowsRelease } from "./package-release.mjs";
import { requireWindowsReleaseEnvironment } from "./release-preflight.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: appRoot, encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `command failed: ${command} ${args.join(" ")}`);
  }
  return result.stdout;
};

try {
  requireWindowsReleaseEnvironment({ publishing: true });
  const tag = process.env.SCENEAXI_WINDOWS_RELEASE_TAG.trim();
  const manifest = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8"));
  if (tag !== `v${manifest.version}`) {
    throw new Error(
      `desktop-windows release refused — SCENEAXI_WINDOWS_RELEASE_TAG must equal v${manifest.version}`,
    );
  }
  const release = JSON.parse(
    run(
      "gh.exe",
      [
        "release",
        "view",
        tag,
        "--repo",
        "Vhailors/sceneaxi",
        "--json",
        "isDraft,tagName",
      ],
      { env: { ...process.env, GH_TOKEN: process.env.GITHUB_RELEASE_TOKEN } },
    ),
  );
  if (release.tagName !== tag || release.isDraft !== true) {
    throw new Error(
      "desktop-windows release refused — the matching GitHub release must already exist as a draft",
    );
  }

  rmSync(join(appRoot, "release"), { recursive: true, force: true });
  const artifact = packageWindowsRelease({ appRoot, publish: "onTagOrDraft" });
  run(
    "gh.exe",
    [
      "release",
      "upload",
      tag,
      artifact.checksumFile,
      "--repo",
      "Vhailors/sceneaxi",
    ],
    { env: { ...process.env, GH_TOKEN: process.env.GITHUB_RELEASE_TOKEN }, stdio: "inherit" },
  );
  console.log(
    `desktop-windows release upload OK — draft ${tag}; operator must publish it explicitly`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
