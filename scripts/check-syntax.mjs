#!/usr/bin/env node
/**
 * Syntax check — every source stub must parse as an ES module.
 * Bootstrap-only stand-in until tsc is wired; stubs are TS-extension files with
 * plain-JS bodies, so `node --check` is a valid parser for them.
 * Fail-closed: zero files found, or any parse error, exits 1.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|mjs)$/.test(entry)) files.push(p);
  }
};
for (const parent of ["packages", "apps"]) {
  const parentDir = join(root, parent);
  if (!existsSync(parentDir)) continue;
  for (const entry of readdirSync(parentDir)) {
    const srcDir = join(parentDir, entry, "src");
    if (existsSync(srcDir)) walk(srcDir);
  }
}

if (files.length === 0) {
  console.error("syntax check: found zero source files — refusing to pass on an empty surface");
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const res = spawnSync(process.execPath, ["--input-type=module", "--check"], {
    input: readFileSync(file, "utf8"),
    encoding: "utf8",
  });
  if (res.status !== 0) {
    failed++;
    console.error(`syntax FAIL ${relative(root, file)}\n${(res.stderr || "").trim()}`);
  }
}

if (failed > 0) {
  console.error(`syntax check FAILED — ${failed}/${files.length} file(s) do not parse`);
  process.exit(1);
}
console.log(`syntax check OK — ${files.length} source files parse as ES modules`);
