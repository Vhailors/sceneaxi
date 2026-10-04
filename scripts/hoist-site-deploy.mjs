import { cpSync, existsSync, lstatSync, mkdtempSync, readdirSync, readlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const siteDir = resolve(process.argv[2] ?? ".");

const require = createRequire(join(siteDir, "package.json"));

const manifest = require("./package.json");

const stage = mkdtempSync(join(tmpdir(), "sceneaxi-hoist-"));

function materialize(path) {
  const destination = readlinkSync(path);
  const source = destination.startsWith("/") ? destination : resolve(dirname(path.replace(siteDir, stage)), destination);
  rmSync(path, { recursive: true, force: true });
  cpSync(source, path, { recursive: true, dereference: true });
}

try {
  execFileSync("pnpm", ["--filter", manifest.name, "deploy", stage], {
    cwd: resolve(siteDir, "../.."),
    stdio: "inherit",
  });
  const stagedModules = join(stage, "node_modules");

  if (!existsSync(stagedModules)) throw new Error("pnpm deploy produced no node_modules");
  const target = join(siteDir, "node_modules");
  rmSync(target, { recursive: true, force: true });
  cpSync(stagedModules, target, { recursive: true });

  const materializeUnder = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);

      if (lstatSync(path).isSymbolicLink()) materialize(path);
    }
  };

  materializeUnder(target);
  const pnpmDir = join(target, ".pnpm");

  if (existsSync(pnpmDir)) {
    for (const entryDir of readdirSync(pnpmDir)) {
      const pkgDir = join(pnpmDir, entryDir, "node_modules");

      if (!existsSync(pkgDir)) continue;

      for (const name of readdirSync(pkgDir)) {
        if (name.startsWith(".")) continue;
        const source = join(pkgDir, name);

        if (name.startsWith("@") && lstatSync(source).isDirectory()) {
          for (const inner of readdirSync(source)) {
            const innerSource = join(source, inner);
            const innerDestination = join(target, name, inner);

            if (existsSync(innerDestination)) continue;
            cpSync(innerSource, innerDestination, { recursive: true, dereference: true });
          }

          continue;
        }

        const destination = join(target, name);

        if (existsSync(destination)) continue;
        cpSync(source, destination, { recursive: true, dereference: true });
      }
    }

    for (const scope of readdirSync(target)) {
      if (!scope.startsWith("@")) continue;
      const scopeDir = join(target, scope);

      if (!lstatSync(scopeDir).isDirectory()) continue;

      for (const entry of readdirSync(scopeDir)) {
        if (lstatSync(join(scopeDir, entry)).isSymbolicLink()) materialize(join(scopeDir, entry));
      }
    }
  }

  for (const scope of readdirSync(target)) {
    if (!scope.startsWith("@")) continue;
    const scopeDir = join(target, scope);

    if (lstatSync(scopeDir).isDirectory()) materializeUnder(scopeDir);
  }

  const sweep = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      let stat;

      try { stat = lstatSync(path); } catch { continue; }

      if (stat.isSymbolicLink()) {
        const destination = readlinkSync(path);

        if (destination.startsWith(stage)) materialize(path);
        continue;
      }

      if (stat.isDirectory() && entry !== ".bin" && !(entry === ".pnpm" && dir === target)) sweep(path);
    }
  };

  sweep(target);
  console.log(`hoist-site-deploy: real node_modules installed for ${manifest.name}`);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
