#!/usr/bin/env node
/**
 * `sceneaxi-web-shell` — the web shell's dev command.
 *
 * Same shape as the CLI and desktop binaries: register the shared workspace
 * resolver (see scripts/workspace-dist-resolver.mjs), then hand argv to the
 * `main()` the tests drive. It starts a loopback HTTP server that serves the
 * inspector; it does not deploy, host, or publish anything.
 */

import { existsSync } from "node:fs";
import * as nodeModule from "node:module";
import { fileURLToPath } from "node:url";

import {
  builtEntrypointFor,
  RESOLVER_URL,
  resolve,
} from "../../../scripts/workspace-dist-resolver.mjs";

const ENTRYPOINT = builtEntrypointFor("@sceneaxi/web-shell");

if (ENTRYPOINT === undefined || !existsSync(fileURLToPath(ENTRYPOINT))) {
  process.stderr.write(
    [
      "sceneaxi-web-shell: build output not found.",
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

if (typeof nodeModule.registerHooks === "function") {
  nodeModule.registerHooks({ resolve });
} else {
  nodeModule.register(RESOLVER_URL);
}

const { main } = await import(ENTRYPOINT);
await main(process.argv.slice(2));
