#!/usr/bin/env node
/**
 * Produce the distributable Linux artifacts (AppImage + .deb) and their checksums.
 *
 * Runs the runtime build, invokes electron-builder for the Linux targets, then
 * writes `release/SHA256SUMS` in `sha256sum -c` format over every artifact. The
 * checksum file is the documented build result the umbrella `/engine` page and
 * `docs/desktop-linux.md` reference.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const release = join(appRoot, "release");

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: appRoot, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`desktop-linux dist FAILED at: ${command} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
};

run(process.execPath, [join(appRoot, "scripts/build-linux.mjs")]);
run(join(appRoot, "node_modules/.bin/electron-builder"), ["--linux"]);

const artifacts = readdirSync(release)
  .filter((name) => name.endsWith(".AppImage") || name.endsWith(".deb"))
  .sort();
if (artifacts.length === 0) {
  console.error("desktop-linux dist FAILED — electron-builder produced no AppImage or .deb");
  process.exit(1);
}

const lines = artifacts.map((name) => {
  const digest = createHash("sha256").update(readFileSync(join(release, name))).digest("hex");
  return `${digest}  ${name}`;
});
writeFileSync(join(release, "SHA256SUMS"), `${lines.join("\n")}\n`);

console.log("desktop-linux dist OK —");
for (const line of lines) console.log(`  ${line}`);
console.log(`  verify: (cd desktop/linux/release && sha256sum -c SHA256SUMS)`);
