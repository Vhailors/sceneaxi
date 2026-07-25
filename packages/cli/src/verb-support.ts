/**
 * Shared verb plumbing: fail-closed flag checking, filesystem reads that refuse
 * instead of throwing, and the authoring-core diagnostic → failure-class map.
 *
 * Every verb body in this package routes its refusals through here so the
 * exit-code map stays one table rather than one table per verb.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  canonicalPath,
  parseDocumentText,
  type ApplyDiagnostic,
  type SceneDocument,
} from "@sceneaxi/authoring-core";
import { failure, type CliOutcome } from "./envelope.js";
import type { VerbArgs } from "./verb-args.js";

/**
 * Refuse any flag, switch, or positional the verb did not declare.
 * `allowedSwitches` carries boolean flags (e.g. `--force`), which arrive in
 * `args.switches` rather than `args.flags`.
 */
export function refuseUnknownArgs(
  args: VerbArgs,
  allowed: ReadonlySet<string>,
  path: readonly string[],
  allowedSwitches: ReadonlySet<string> = new Set(),
): CliOutcome | null {
  const usage = `Run \`sceneaxi ${path.join(" ")} --help\` for usage`;

  for (const name of args.flags.keys()) {
    if (!allowed.has(name) && !allowedSwitches.has(name)) {
      return failure("UNKNOWN_FLAG", `Unknown flag: ${name}`, {
        path,
        help: [
          `Unknown flag '${name}' refused (fail-closed)`,
          `Allowed: ${[...allowed, ...allowedSwitches].join(", ")}`,
          usage,
        ],
      });
    }
  }

  for (const name of args.switches) {
    if (allowedSwitches.has(name)) continue;
    return failure("UNKNOWN_FLAG", `Unknown flag: ${name}`, {
      path,
      help: [
        `Unknown flag '${name}' refused (fail-closed)`,
        `Allowed: ${[...allowed, ...allowedSwitches].join(", ")}`,
        usage,
      ],
    });
  }

  if (args.positionals.length > 0) {
    return failure(
      "AMBIGUOUS_INPUT",
      `Unexpected positional arguments: ${args.positionals.join(" ")}`,
      {
        path,
        help: [usage, "Inputs are flags only (files and flags in)."],
      },
    );
  }

  return null;
}

/** Map an authoring-core diagnostic set onto the CLI failure classes. */
export function diagnosticsToFailure(
  diagnostics: readonly ApplyDiagnostic[],
  path: readonly string[],
): CliOutcome {
  const primary = diagnostics[0];
  const message =
    primary?.message ?? "Proposal rejected with typed diagnostics.";
  const help = [
    ...diagnostics
      .map((d) => d.reReadHint)
      .filter((h): h is string => typeof h === "string" && h.length > 0),
    `Run \`sceneaxi ${path.join(" ")} --help\` for usage`,
    "Run `sceneaxi protocol inspect` for the exit-code map",
  ];

  const code = primary?.code;
  if (code === "content-hash-conflict") {
    return failure("CONFLICT", message, { path, help, diagnostics });
  }
  if (
    code === "schema-major-mismatch" ||
    code === "invalid-document" ||
    code === "invalid-proposal" ||
    code === "invalid-pointer" ||
    code === "validation-failed" ||
    code === "parse-error"
  ) {
    return failure("VALIDATION", message, { path, help, diagnostics });
  }
  if (code === "document-not-found") {
    return failure("NOT_FOUND", message, { path, help, diagnostics });
  }
  return failure("INTERNAL", message, { path, help, diagnostics });
}

/** Resolve a verb path argument against `--cwd` (default: process cwd). */
export function resolveUnderCwd(
  path: string,
  cwd: string | undefined,
): string {
  return cwd === undefined ? resolve(path) : resolve(cwd, path);
}

export type FileReadResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly outcome: CliOutcome };

export type DocumentReadResult =
  | {
      readonly ok: true;
      readonly document: SceneDocument;
      readonly text: string;
    }
  | { readonly ok: false; readonly outcome: CliOutcome };

export type PathArgument = {
  readonly absolutePath: string;
  readonly displayPath: string;
};

/**
 * Read a UTF-8 file, converting a missing path into a NOT_FOUND refusal and
 * any other I/O error into INTERNAL. Verbs never throw raw fs errors at agents.
 */
export function readTextOrRefuse(
  absolutePath: string,
  displayPath: string,
  verbPath: readonly string[],
): FileReadResult {
  try {
    return { ok: true, text: readFileSync(absolutePath, "utf8") };
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    if (code === "ENOENT") {
      return {
        ok: false,
        outcome: failure("NOT_FOUND", `File not found: ${displayPath}`, {
          path: verbPath,
          help: [
            "Check the path relative to --cwd (default: process cwd)",
            `Run \`sceneaxi ${verbPath.join(" ")} --help\` for usage`,
          ],
        }),
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      outcome: failure("INTERNAL", `Could not read ${displayPath}: ${message}`, {
        path: verbPath,
      }),
    };
  }
}

export function readDocumentOrRefuse(
  absolutePath: string,
  displayPath: string,
  verbPath: readonly string[],
): DocumentReadResult {
  const read = readTextOrRefuse(absolutePath, displayPath, verbPath);
  if (!read.ok) return read;

  const validation = parseDocumentText(read.text);
  if (!validation.ok) {
    return {
      ok: false,
      outcome: diagnosticsToFailure(
        [
          {
            code:
              validation.code === "not-object"
                ? "invalid-document"
                : validation.code,
            message: `${displayPath}: ${validation.message}`,
          },
        ],
        verbPath,
      ),
    };
  }

  return {
    ok: true,
    document: validation.document,
    text: read.text,
  };
}

export function refusePathAliases(
  inputs: readonly PathArgument[],
  outputs: readonly PathArgument[],
  verbPath: readonly string[],
): CliOutcome | null {
  try {
    const inputByPath = new Map<string, string>();
    for (const input of inputs) {
      inputByPath.set(canonicalPath(input.absolutePath), input.displayPath);
    }
    const outputByPath = new Map<string, string>();
    for (const output of outputs) {
      const outputPath = canonicalPath(output.absolutePath);
      const input = inputByPath.get(outputPath);
      if (input !== undefined) {
        return failure(
          "CONFLICT",
          `Refusing output '${output.displayPath}' because it aliases input '${input}'.`,
          {
            path: verbPath,
            help: ["Choose an output path distinct from every source path"],
          },
        );
      }
      const priorOutput = outputByPath.get(outputPath);
      if (priorOutput !== undefined) {
        return failure(
          "CONFLICT",
          `Refusing output '${output.displayPath}' because it aliases output '${priorOutput}'.`,
          {
            path: verbPath,
            help: ["Choose distinct paths for each output"],
          },
        );
      }
      outputByPath.set(outputPath, output.displayPath);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failure(
      "VALIDATION",
      `Could not resolve input/output paths: ${message}`,
      { path: verbPath },
    );
  }
  return null;
}

/** Parse JSON, refusing with VALIDATION rather than throwing. */
export function parseJsonOrRefuse(
  text: string,
  displayPath: string,
  verbPath: readonly string[],
): { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly outcome: CliOutcome } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      outcome: failure(
        "VALIDATION",
        `${displayPath} is not valid JSON: ${message}`,
        { path: verbPath },
      ),
    };
  }
}

/** Missing-required-flag refusal with a single usage line. */
export function missingFlag(
  message: string,
  usage: string,
  path: readonly string[],
): CliOutcome {
  return failure("VALIDATION", message, { path, help: [usage] });
}
