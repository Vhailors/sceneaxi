#!/usr/bin/env node
import { spawnSync } from "node:child_process";

export const WINDOWS_SIGNING_ENV = Object.freeze([
  "WIN_CSC_LINK",
  "WIN_CSC_KEY_PASSWORD",
]);

export const WINDOWS_RELEASE_ENV = Object.freeze([
  "GITHUB_RELEASE_TOKEN",
  "SCENEAXI_WINDOWS_RELEASE_TAG",
]);

const present = (value) => typeof value === "string" && value.trim().length > 0;

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

export function requireWindowsReleaseEnvironment(options) {
  const result = windowsReleasePreflight(options);
  if (!result.ok) {
    throw new Error(`desktop-windows release preflight refused:\n${result.reasons.join("\n")}`);
  }
}
