#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const executable = join(root, "node_modules/.bin/electron");

const main = join(root, "dist/main.cjs");

if (!existsSync(main)) throw new Error("Build desktop/linux before running the diagnostics smoke.");

const scratch = mkdtempSync(join(tmpdir(), "sceneaxi-diagnostics-smoke-"));

try {
  const result = spawnSync(executable, [main, "--diagnostics-smoke", "--no-sandbox", "--disable-gpu-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"], {
    cwd: root,
    encoding: "utf8",
    timeout: 45_000,
    env: { ...process.env, XDG_CONFIG_HOME: scratch },
  });

  const proof = '{"ok":true,"diagnostics":"renderer reloaded; local event recorded"}';

  if (result.error || result.status !== 0 || !result.stdout?.includes(proof)) {
    throw new Error(`Diagnostics smoke failed (exit ${result.status ?? "unknown"}).`);
  }

  process.stdout.write(`${proof}\n`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
