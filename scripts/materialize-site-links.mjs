import { cpSync, existsSync, lstatSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const siteDir = resolve(process.argv[2] ?? ".");

const modules = join(siteDir, "node_modules");

let materialized = 0;

const replace = (path) => {
  let real;

  try {
    real = realpathSync(path);
  } catch {
    rmSync(path, { recursive: true, force: true });

    return;
  }

  rmSync(path, { recursive: true, force: true });
  cpSync(real, path, { recursive: true, dereference: true });
  materialized += 1;
};

for (const entry of readdirSync(modules)) {
  if (entry.startsWith(".")) continue;
  const path = join(modules, entry);

  if (lstatSync(path).isSymbolicLink()) {
    replace(path);
    continue;
  }

  if (!entry.startsWith("@")) continue;

  for (const inner of readdirSync(path)) {
    const innerPath = join(path, inner);

    if (lstatSync(innerPath).isSymbolicLink()) replace(innerPath);
  }
}

for (const dup of ["next", "react", "react-dom", "styled-jsx"]) {
  const pnpmDir = join(modules, ".pnpm");

  if (!existsSync(pnpmDir)) break;

  for (const entry of readdirSync(pnpmDir)) {
    if (!entry.startsWith(`${dup}@`)) continue;
    rmSync(join(pnpmDir, entry), { recursive: true, force: true });
  }
}

console.log(`materialize-site-links: ${materialized} package links materialized`);
