/*
 * Public CLI runner: dispatch + format. Process I/O is optional so golden
 * tests can assert on outcomes without spawning a subprocess.
 */

import { readFileSync, watch, type FSWatcher } from "node:fs";
import { parseDocumentText } from "@sceneaxi/authoring-core";
import { projectAssetManifestFromDocumentData } from "@sceneaxi/importers";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { dispatch, parseArgv, type DispatchOptions } from "./dispatcher.js";
import { failure, success, type CliOutcome } from "./envelope.js";
import type { CliOutcome as Outcome } from "./envelope.js";
import { formatOutcome, type OutputFormat } from "./format.js";
import { parseVerbArgs } from "./verb-args.js";

export interface RunCliResult {
  readonly exitCode: CliOutcome["exitCode"];
  readonly envelope: CliOutcome["envelope"];
  readonly format: OutputFormat;
  readonly stdout: string;
}

/** Run the umbrella CLI against argv (no binary name). Pure of process.exit. */
export function runCli(
  argv: readonly string[] = [],
  options: DispatchOptions = {},
): RunCliResult {
  const { outcome, format } = dispatch(argv, options);

  return {
    exitCode: outcome.exitCode,
    envelope: outcome.envelope,
    format,
    stdout: formatOutcome(outcome, format),
  };
}

function watchArguments(argv: readonly string[]):
  | Readonly<{ args: readonly string[]; format: OutputFormat }>
  | null {
  const parsed = parseArgv(argv);

  if (parsed.wantsHelp || parsed.wantsVersion || parsed.valuedGlobalSwitch !== null) return null;

  if (parsed.tokens[0] !== "project" || parsed.tokens[1] !== "dev") return null;
  const verbArgs = parseVerbArgs(parsed.tokens.slice(2));

  if (!verbArgs.switches.has("--watch")) return null;

  return {
    args: Object.freeze(argv.filter((token) => token !== "--watch")),
    format: parsed.format,
  };
}

function watchedFiles(documentPath: string, cwd: string): readonly string[] {
  const absoluteDocument = resolve(cwd, documentPath);
  let assetPaths: readonly string[] = [];

  try {
    const parsed = parseDocumentText(
      readFileSync(absoluteDocument, "utf8"),
    );

    if (parsed.ok) {
      const assets = projectAssetManifestFromDocumentData(parsed.document.data);

      if (assets.ok) {
        assetPaths = assets.value.assets.map((asset) => {
          const path = resolve(cwd, ...asset.relativePath.split("/"));
          const relativePath = relative(resolve(cwd), path);

          if (
            relativePath === ".." ||
            relativePath.startsWith(`..${sep}`) ||
            isAbsolute(relativePath)
          ) {
            throw new Error("PROJECT_ASSET_PATH_OUTSIDE_CWD");
          }

          return path;
        });
      }
    }
  } catch {
    assetPaths = [];
  }

  return Object.freeze([absoluteDocument, ...assetPaths]);
}


/**
 * Process entry: watch mode streams one ordinary versioned envelope per line.
 * The synchronous API remains available to embedders and one-shot callers.
 */
export function main(argv: readonly string[] = process.argv.slice(2)): number {
  const watchRequest = watchArguments(argv);

  if (watchRequest !== null) {
    runWatch(watchRequest.args, watchRequest.format);

    return 0;
  }

  const result = runCli(argv);
  process.stdout.write(result.stdout);
  process.exitCode = result.exitCode;

  return result.exitCode;
}

function runWatch(argv: readonly string[], format: OutputFormat): void {
  const parsed = parseArgv(argv);
  const args = parseVerbArgs(parsed.tokens.slice(2));
  const document = args.flags.get("--document");

  if (document === undefined || document.length === 0) {
    const result = runCli(argv);
    process.stdout.write(format === "json" ? `${JSON.stringify(result.envelope)}\n` : result.stdout);
    process.exitCode = result.exitCode;

    return;
  }

  const cwd = resolve(args.flags.get("--cwd") ?? process.cwd());
  let cycle = 0;
  let closed = false;
  let debounce: NodeJS.Timeout | undefined;
  const watchers = new Map<string, FSWatcher>();
  const watchedNames = new Map<string, Set<string>>();
  let finalizing = false;
  // A watch that ends on a refused cycle reports that refusal, not success.
  let lastExitCode = 0;

  const emit = (outcome: Outcome): void => {
    const text = format === "json"
      ? `${JSON.stringify(outcome.envelope)}\n`
      : formatOutcome(outcome, format);

    process.stdout.write(text);
  };

  const runCycle = (): Outcome => {
    const result = runCli(argv);
    cycle += 1;
    lastExitCode = result.exitCode;

    if (!result.envelope.ok) return result;

    return success(
      Object.freeze({ ...result.envelope.result, mode: "watch", cycle }),
      result.envelope.help,
    );
  };

  const syncWatchers = (): void => {
    const paths = watchedFiles(document, cwd);
    const directories = new Map<string, Set<string>>();

    for (const path of paths) {
      const directory = dirname(path);
      const names = directories.get(directory) ?? new Set<string>();
      names.add(basename(path));
      directories.set(directory, names);
    }

    watchedNames.clear();

    for (const [directory, names] of directories) watchedNames.set(directory, names);

    for (const [directory, watcher] of watchers) {
      if (!directories.has(directory)) {
        watcher.close();
        watchers.delete(directory);
      }
    }

    for (const directory of directories.keys()) {
      if (watchers.has(directory)) continue;

      try {
        watchers.set(directory, watch(directory, (_event, filename) => {
          const currentNames = watchedNames.get(directory);

          if (filename !== null && !currentNames?.has(filename.toString())) return;

          if (debounce !== undefined) clearTimeout(debounce);
          debounce = setTimeout(() => {
            if (closed) return;

            try {
              emit(runCycle());
              syncWatchers();
            } catch (error) {
              fail(error);
            }
          }, 75);
        }));
      } catch {
        throw new Error(`PROJECT_DEV_WATCH_UNAVAILABLE: ${directory}`);
      }
    }
  };

  const fail = (error: unknown): void => {
    if (finalizing) return;
    finalizing = true;
    closed = true;

    if (debounce !== undefined) clearTimeout(debounce);
    process.removeListener("SIGINT", stop);

    for (const watcher of watchers.values()) watcher.close();
    watchers.clear();
    const reason = error instanceof Error ? error.message : String(error);
    emit(failure("INTERNAL", reason, {
      path: ["project", "dev"],
      help: ["Check that the document and admitted asset directories are readable"],
    }));
    process.exitCode = 1;
  };

  const stop = (): void => {
    if (finalizing) return;
    finalizing = true;
    closed = true;

    if (debounce !== undefined) clearTimeout(debounce);

    for (const watcher of watchers.values()) watcher.close();
    watchers.clear();
    process.removeListener("SIGINT", stop);
    emit(success(
      Object.freeze({ status: "stopped", mode: "watch", cycle }),
      ["Watch stopped after SIGINT"],
    ));
    process.exitCode = lastExitCode;
  };

  process.once("SIGINT", stop);

  try {
    const initial = runCycle();

    if (
      !initial.envelope.ok &&
      (initial.envelope.error.code === "UNKNOWN_FLAG" ||
        initial.envelope.error.code === "AMBIGUOUS_INPUT")
    ) {
      emit(initial);
      process.removeListener("SIGINT", stop);
      process.exitCode = initial.exitCode;

      return;
    }

    // Watchers attach before the first envelope, so a client that sees cycle 1 never loses an edit.
    syncWatchers();
    emit(initial);
  } catch (error) {
    fail(error);
  }
}
