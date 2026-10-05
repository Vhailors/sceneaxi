#!/usr/bin/env node
/** Build every independent site install root with the repository's pinned pnpm. */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sites = ["umbrella", "catalog-game", "catalog-web", "kids"];
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const expected = /^pnpm@([\d.]+)$/.exec(manifest.packageManager)?.[1];
const version = spawnSync("pnpm", ["--version"], { cwd: root, encoding: "utf8" });

if (!expected || version.error || version.status !== 0 || version.stdout.trim() !== expected) {
  throw new Error(`site builds require ${manifest.packageManager}; pnpm reported ${version.stdout?.trim() ?? version.error}`);
}

for (const site of sites) {
  const siteRoot = join(root, "sites", site);
  for (const file of ["package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml"]) {
    if (!existsSync(join(siteRoot, file))) throw new Error(`${site}: missing independent install-root ${file}`);
  }
}

for (const site of sites) {
  const cwd = join(root, "sites", site);
  for (const args of [["install", "--frozen-lockfile"], ["run", "build"]]) {
    console.log(`site builds: ${site} — pnpm@${expected} ${args.join(" ")} (cwd=${cwd})`);
    const result = spawnSync("pnpm", args, {
      cwd,
      stdio: "inherit",
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    });
    if (result.error || result.status !== 0) {
      throw new Error(`${site}: pnpm ${args.join(" ")} failed (exit=${result.status}, signal=${result.signal}, error=${result.error ?? "none"})`);
    }
  }
}
console.log("site builds OK — all four independent frozen install roots built");
