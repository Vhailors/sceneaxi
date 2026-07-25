#!/usr/bin/env node
/**
 * `sceneaxi` — the agent-native CLI entrypoint.
 *
 * Registers the shared workspace resolver (see
 * scripts/workspace-dist-resolver.mjs for why), then hands argv to the same
 * pure `main()` the tests drive. Exit codes come from the protocol's exit-code
 * map; this file adds no policy of its own.
 *
 * The CLI is free and BYO-AI: no verb it dispatches requires auth, credits, or
 * a network call.
 */

import { existsSync } from "node:fs";
import { register, registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

import {
  builtEntrypointFor,
  RESOLVER_URL,
  resolve,
} from "../../../scripts/workspace-dist-resolver.mjs";

const CLI_ENTRYPOINT = builtEntrypointFor("@sceneaxi/cli");

if (CLI_ENTRYPOINT === undefined || !existsSync(fileURLToPath(CLI_ENTRYPOINT))) {
  process.stderr.write(
    [
      "sceneaxi: build output not found.",
      "",
      "The workspace keeps source-backed package exports, so the binary runs the",
      "`tsc --build` output. Build it once, then re-run:",
      "",
      "  pnpm install",
      "  pnpm build",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

// `registerHooks` is the synchronous in-thread API (Node >= 22.15); older
// supported runtimes still have the off-thread `register`. Either resolves the
// same specifiers, so prefer the current one and fall back rather than pinning.
if (typeof registerHooks === "function") {
  registerHooks({ resolve });
} else {
  register(RESOLVER_URL);
}

const { main } = await import(CLI_ENTRYPOINT);
main(process.argv.slice(2));
