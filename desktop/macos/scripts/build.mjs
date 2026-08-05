#!/usr/bin/env node
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(appRoot, "../..");
const existingApplication = join(repositoryRoot, "desktop/linux");
const result = spawnSync(process.execPath, [join(existingApplication, "scripts/build.mjs")], {
  cwd: existingApplication,
  stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);

const dist = join(appRoot, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
const runtime = join(dist, "runtime");
cpSync(join(existingApplication, "dist"), runtime, { recursive: true });

const runtimeFiles = ["index.html", "main.cjs", "preload.cjs", "renderer.js"];
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const copied = readdirSync(runtime).sort();
if (JSON.stringify(copied) !== JSON.stringify(runtimeFiles)) {
  console.error(`desktop-macos build FAILED — staged runtime files are ${copied.join(", ")}`);
  process.exit(1);
}
for (const file of runtimeFiles) {
  if (digest(join(existingApplication, "dist", file)) !== digest(join(runtime, file))) {
    console.error(`desktop-macos build FAILED — staged ${file} differs from desktop/linux`);
    process.exit(1);
  }
}

const releaseBaseUrl = process.env.SCENEAXI_MACOS_RELEASE_BASE_URL?.trim();
const updateEnabled = releaseBaseUrl !== undefined && releaseBaseUrl.length > 0;
let updateOrigin;
if (updateEnabled) {
  let parsed;
  try {
    parsed = new URL(releaseBaseUrl);
  } catch {
    console.error("desktop-macos build FAILED — MACOS_UPDATE_URL_INVALID");
    process.exit(1);
  }
  if (parsed.protocol !== "https:") {
    console.error("desktop-macos build FAILED — MACOS_UPDATE_HTTPS_REQUIRED");
    process.exit(1);
  }
  updateOrigin = releaseBaseUrl.replace(/\/$/, "");
  const preflight = spawnSync(
    process.execPath,
    [join(appRoot, "scripts/dist.mjs"), "--preflight-only"],
    { cwd: appRoot, stdio: "inherit", env: process.env },
  );
  if (preflight.status !== 0) {
    console.error("desktop-macos build FAILED — update enablement requires the release preflight");
    process.exit(preflight.status ?? 1);
  }
}
writeFileSync(
  join(dist, "update-policy.json"),
  `${JSON.stringify(
    updateEnabled
      ? { enabled: true }
      : { enabled: false, refusal: "MACOS_UPDATE_RELEASE_NOT_CONFIGURED" },
    null,
    2,
  )}\n`,
);
if (updateEnabled) {
  writeFileSync(
    join(dist, "app-update.yml"),
    `provider: generic\nurl: ${updateOrigin}\nupdaterCacheDirName: sceneaxi-engine-desktop-updater\n`,
  );
}

await build({
  bundle: true,
  absWorkingDir: appRoot,
  entryPoints: [join(appRoot, "src/electron/main.ts")],
  outfile: join(dist, "main.cjs"),
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron", "./runtime/main.cjs"],
  logLevel: "info",
});

console.log(
  `desktop-macos build OK — staged the exact desktop/linux runtime; updates ${updateEnabled ? "configured" : "refused"}`,
);
