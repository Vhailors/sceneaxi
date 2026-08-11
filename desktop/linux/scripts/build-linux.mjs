#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: appRoot,
    stdio: "inherit",
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `desktop-linux build failed: ${command} ${args.join(" ")}${
        result.error ? `: ${result.error.message}` : ""
      }`,
    );
  }
};

run(process.execPath, [join(appRoot, "scripts/build.mjs")]);
run(process.env["CC"] ?? "cc", [
  "-std=c11",
  "-O2",
  "-Wall",
  "-Wextra",
  "-Werror",
  join(appRoot, "src/native/publish-no-replace.c"),
  "-o",
  join(appRoot, "dist/sceneaxi-publish-no-replace"),
]);

console.log("desktop-linux publisher build OK — dist/sceneaxi-publish-no-replace");
