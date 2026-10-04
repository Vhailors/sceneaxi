import { cpSync, existsSync, lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const siteDir = resolve(process.argv[2] ?? ".");

const root = resolve(siteDir, "../..");

const modules = join(siteDir, "node_modules");

const workspace = new Map();

for (const glob of ["packages", "apps", "sites"]) {
  const dir = join(root, glob);

  if (!existsSync(dir)) continue;

  for (const entry of readdirSync(dir)) {
    const manifest = join(dir, entry, "package.json");

    if (!existsSync(manifest)) continue;
    const parsed = JSON.parse(readFileSync(manifest, "utf8")).name;

    /**
     * @param {unknown} value
     * @returns {value is string}
     */
    const isWorkspaceName = (value) => Object.prototype.toString.call(value) === "[object String]";

    if (isWorkspaceName(parsed)) workspace.set(parsed, join(glob, entry));
  }
}

let restored = 0;

for (const [name, relPath] of workspace) {
  if (!name.startsWith("@")) continue;
  const scope = name.slice(0, name.indexOf("/"));
  const pkg = name.slice(name.indexOf("/") + 1);
  const linkPath = join(modules, scope, pkg);

  if (!existsSync(linkPath)) continue;
  const target = relative(join(modules, scope), join(root, relPath));
  rmSync(linkPath, { recursive: true, force: true });
  symlinkSync(target, linkPath, "dir");
  restored += 1;
}

let flattened = 0;

const materializePackageLinks = (pkgDir) => {
  const nested = join(pkgDir, "node_modules");

  if (!existsSync(nested)) return;

  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      let stat;

      try { stat = lstatSync(path); } catch { continue; }

      if (stat.isSymbolicLink()) {
        const target = readlinkSync(path);

        if (target.includes("node_modules")) {
          const real = realpathSync(path);
          rmSync(path, { recursive: true, force: true });
          cpSync(real, path, { recursive: true, dereference: true });
          flattened += 1;
        }

        continue;
      }

      if (stat.isDirectory() && !name.startsWith(".")) walk(path);
    }
  };

  walk(nested);
};

for (const [, relPath] of workspace) {
  materializePackageLinks(join(root, relPath));
}

console.log(`restore-workspace-links: ${restored} workspace symlinks repointed, ${flattened} package-internal links flattened`);
