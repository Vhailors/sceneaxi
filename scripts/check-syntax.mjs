#!/usr/bin/env node
/**
 * Syntax check — every source file must parse as a TypeScript/ES module.
 * Originally a `node --check` stand-in; now that tsc is wired it parses with the
 * TypeScript compiler itself, so TS-only syntax (types, interfaces) is covered.
 * Meaning unchanged: fail-closed — zero files found, or any parse error, exits 1.
 */
import { readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

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

const program = ts.createProgram(files, {
  allowJs: true,
  noResolve: true,
  noLib: true,
  target: ts.ScriptTarget.Latest,
});
const format = {
  getCanonicalFileName: (f) => f,
  getCurrentDirectory: () => root,
  getNewLine: () => "\n",
};

let failed = 0;
for (const file of files) {
  const source = program.getSourceFile(file);
  const diagnostics = source ? program.getSyntacticDiagnostics(source) : [];
  if (!source || diagnostics.length > 0) {
    failed++;
    const detail = source
      ? ts.formatDiagnostics(diagnostics, format).trim()
      : "file could not be read";
    console.error(`syntax FAIL ${relative(root, file)}\n${detail}`);
  }
}

if (failed > 0) {
  console.error(`syntax check FAILED — ${failed}/${files.length} file(s) do not parse`);
  process.exit(1);
}
console.log(`syntax check OK — ${files.length} source files parse as TypeScript modules`);
