#!/usr/bin/env node
/**
 * `sceneaxi-desktop` — the desktop shell entrypoint.
 *
 * Same shape as the CLI binary: register the shared workspace resolver (see
 * scripts/workspace-dist-resolver.mjs), then hand argv to the pure `main()`
 * the tests drive. Protocol-thin by design — no native packaging, no installer.
 */

import { existsSync } from "node:fs";
import { register, registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

import {
  builtEntrypointFor,
  RESOLVER_URL,
  resolve,
} from "../../../scripts/workspace-dist-resolver.mjs";

const ENTRYPOINT = builtEntrypointFor("@sceneaxi/desktop-shell");

if (ENTRYPOINT === undefined || !existsSync(fileURLToPath(ENTRYPOINT))) {
  process.stderr.write(
    [
      "sceneaxi-desktop: build output not found.",
      "",
      "The workspace keeps source-backed package exports, so the shell runs the",
      "`tsc --build` output. Build it once, then re-run:",
      "",
      "  pnpm install",
      "  pnpm build",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

if (typeof registerHooks === "function") {
  registerHooks({ resolve });
} else {
  register(RESOLVER_URL);
}

const { main } = await import(ENTRYPOINT);
main(process.argv.slice(2));
