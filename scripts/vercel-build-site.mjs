import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const site = process.argv[2];

if (site === undefined || !existsSync(join("sites", site, "package.json"))) {
  console.error("usage: node scripts/vercel-build-site.mjs <site>");
  process.exit(1);
}

const root = process.cwd();

const siteDir = join(root, "sites", site);

const manifest = JSON.parse(readFileSync(join(siteDir, "package.json"), "utf8"));

const run = (command, args, options = {}) => {
  execFileSync(command, args, { stdio: "inherit", cwd: root, ...options });
};

run("pnpm", ["run", "build"]);

run("node", ["scripts/hoist-site-deploy.mjs", siteDir]);

run("node", ["scripts/restore-workspace-links.mjs", siteDir]);

if (manifest.name === "@sceneaxi/site-umbrella") {
  run("node", ["scripts/build-engine-sdk.mjs", "--out", join("sites", site, "public", "engine-sdk")]);
}

run(process.execPath, [join(siteDir, "node_modules", "next", "dist", "bin", "next"), "build"], { cwd: siteDir });

run("node", ["scripts/materialize-site-links.mjs", siteDir]);

run("node", [join(root, "scripts", "check-vercel-package.mjs"), "."], { cwd: siteDir });
