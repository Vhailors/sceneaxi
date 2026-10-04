import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const siteDir = resolve(process.argv[2] ?? ".");

const root = resolve(siteDir, "../..");

const nextServer = join(siteDir, ".next", "server");

if (!existsSync(nextServer)) {
  console.error("fix-trace-entries: no .next/server; run the site build first");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(siteDir, "package.json"), "utf8"));

const isLinkSpec = (spec) => Object.prototype.toString.call(spec) === "[object String]" && spec.startsWith("link:");

const workspaceNames = new Set(Object.entries(manifest.dependencies ?? {})
  .filter(([, spec]) => isLinkSpec(spec))
  .map(([name]) => name));

const workspacePathByName = new Map();

for (const glob of ["packages", "apps", "sites"]) {
  const dir = join(root, glob);

  if (!existsSync(dir)) continue;

  for (const entry of readdirSync(dir)) {
    const pkg = join(dir, entry, "package.json");

    if (!existsSync(pkg)) continue;
    const name = JSON.parse(readFileSync(pkg, "utf8")).name;

    workspacePathByName.set(name, join(glob, entry));
  }
}

let replaced = 0;

const visit = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      visit(path);
      continue;
    }

    if (!entry.name.endsWith(".nft.json")) continue;
    const trace = JSON.parse(readFileSync(path, "utf8"));

    if (!Array.isArray(trace.files)) continue;
    const files = [];

    for (const file of trace.files) {
      const match = file.match(/node_modules\/(@sceneaxi\/[a-z0-9-]+)$/);

      if (match === null) {
        files.push(file);
        continue;
      }

      const rel = workspacePathByName.get(match[1]);

      if (rel === undefined) {
        files.push(file);
        continue;
      }

      const ups = "../".repeat(file.split("/").length - 1);
      const manifestEntry = `${ups}${rel}/package.json`;

      if (!files.includes(manifestEntry)) files.push(manifestEntry);
      replaced += 1;
    }

    trace.files = files;
    writeFileSync(path, JSON.stringify(trace));
  }
};

visit(join(siteDir, ".next"));

console.log(`fix-trace-entries: ${replaced} directory trace entries rewritten to package manifests`);
