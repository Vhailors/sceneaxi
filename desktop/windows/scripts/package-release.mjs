import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    throw new Error(`desktop-windows command failed: ${command} ${args.join(" ")}`);
  }
};

export function packageWindowsRelease({ appRoot, publish, env = process.env }) {
  const release = join(appRoot, "release");
  run(process.execPath, [join(appRoot, "scripts/build.mjs")], { cwd: appRoot, env });
  run(
    process.execPath,
    [
      join(appRoot, "node_modules/electron-builder/out/cli/cli.js"),
      "--win",
      "nsis",
      "--x64",
      "--publish",
      publish,
    ],
    { cwd: appRoot, env },
  );

  const manifest = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8"));
  const expected = `SceneAxi-Engine-Desktop-${manifest.version}-windows-x64.exe`;
  const installers = readdirSync(release).filter((name) => name.endsWith(".exe")).sort();
  if (installers.length !== 1 || installers[0] !== expected) {
    throw new Error(
      `desktop-windows packaging refused — expected only '${expected}', found: ${installers.join(", ") || "none"}`,
    );
  }

  if (publish !== "never") {
    const produced = readdirSync(release);
    const metadata = ["latest.yml", `${expected}.blockmap`].filter(
      (name) => !produced.includes(name),
    );
    if (metadata.length > 0) {
      throw new Error(
        `desktop-windows packaging refused — update metadata is absent: ${metadata.join(", ")}`,
      );
    }
  }

  run("signtool.exe", ["verify", "/pa", "/all", "/v", join(release, expected)], {
    cwd: appRoot,
    env,
  });
  const digest = createHash("sha256")
    .update(readFileSync(join(release, expected)))
    .digest("hex");
  const checksum = `${digest}  ${expected}\n`;
  writeFileSync(join(release, "SHA256SUMS"), checksum);
  return Object.freeze({ expected, digest, checksumFile: join(release, "SHA256SUMS") });
}
