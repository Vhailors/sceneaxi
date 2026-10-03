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

import { existsSync, readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { fileURLToPath } from "node:url";

// Private local archives carry a generated runtime map, never repository scripts.
const mapUrl = new URL("../runtime-map.json", import.meta.url);

let CLI_ENTRYPOINT;

let resolveHook;

let resolverUrl;

if (existsSync(fileURLToPath(mapUrl))) {
  const paths = JSON.parse(readFileSync(mapUrl, "utf8"));
  CLI_ENTRYPOINT = new URL("../dist/src/run.js", import.meta.url).href;
  resolveHook = (specifier, context, nextResolve) => {
    if (Object.hasOwn(paths, specifier)) {
      return { url: new URL(paths[specifier], mapUrl).href, shortCircuit: true };
    }

    return nextResolve(specifier, context);
  };
} else {
  const workspace = await import("../../../scripts/workspace-dist-resolver.mjs");
  CLI_ENTRYPOINT = workspace.builtEntrypointFor("@sceneaxi/cli");
  resolveHook = workspace.resolve;
  resolverUrl = workspace.RESOLVER_URL;
}

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
if ("registerHooks" in nodeModule) {
  nodeModule.registerHooks({ resolve: resolveHook });
} else {
  if (resolverUrl === undefined) {
    process.stderr.write("sceneaxi: private compiled archive requires Node >= 22.15 (supported baseline: Node 24).\n");
    process.exit(1);
  }

  nodeModule.register(resolverUrl);
}

const { main } = await import(CLI_ENTRYPOINT);

main(process.argv.slice(2));
