#!/usr/bin/env node
/** Build a signed local artifact without publishing or creating a release. */
import { rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packageWindowsRelease } from "./package-release.mjs";
import { requireWindowsReleaseEnvironment } from "./release-preflight.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

try {
  requireWindowsReleaseEnvironment();
  rmSync(join(appRoot, "release"), { recursive: true, force: true });
  const artifact = packageWindowsRelease({ appRoot, publish: "never" });
  console.log(`desktop-windows dist OK — ${artifact.digest}  ${artifact.expected}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
