/**
 * E1 project propose / apply verbs — thin protocol adapters over authoring-core.
 * No engine imports (matrix-denied).
 */

import { resolve } from "node:path";
import {
  apply,
  propose,
  writeProposalFile,
  type ApplyDiagnostic,
  type Proposal,
} from "@sceneaxi/authoring-core";
import { failure, success, type CliOutcome, type ResultPayload } from "./envelope.js";
import { parseVerbArgs, requireFlag, type VerbArgs } from "./verb-args.js";

const PROPOSE_FLAGS = new Set([
  "--document",
  "--pointer",
  "--value",
  "--out",
  "--cwd",
]);
const APPLY_FLAGS = new Set(["--proposal", "--cwd"]);

function refuseUnknown(
  args: VerbArgs,
  allowed: ReadonlySet<string>,
  path: readonly string[],
): CliOutcome | null {
  for (const name of args.flags.keys()) {
    if (!allowed.has(name)) {
      return failure("UNKNOWN_FLAG", `Unknown flag: ${name}`, {
        path,
        help: [
          `Unknown flag '${name}' refused (fail-closed)`,
          `Allowed: ${[...allowed].join(", ")}`,
          `Run \`sceneaxi ${path.join(" ")} --help\` for usage`,
        ],
      });
    }
  }
  for (const name of args.switches) {
    return failure("UNKNOWN_FLAG", `Unknown flag: ${name}`, {
      path,
      help: [
        `Unknown flag '${name}' refused (fail-closed)`,
        `Allowed: ${[...allowed].join(", ")}`,
        `Run \`sceneaxi ${path.join(" ")} --help\` for usage`,
      ],
    });
  }
  if (args.positionals.length > 0) {
    return failure(
      "AMBIGUOUS_INPUT",
      `Unexpected positional arguments: ${args.positionals.join(" ")}`,
      {
        path,
        help: [
          `Run \`sceneaxi ${path.join(" ")} --help\` for usage`,
          "Inputs are flags only (files and flags in).",
        ],
      },
    );
  }
  return null;
}

function mapDiagnosticsToFailure(
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
    return failure("CONFLICT", message, {
      path,
      help,
      diagnostics,
    });
  }
  if (
    code === "schema-major-mismatch" ||
    code === "invalid-document" ||
    code === "invalid-proposal" ||
    code === "invalid-pointer" ||
    code === "validation-failed" ||
    code === "parse-error"
  ) {
    return failure("VALIDATION", message, {
      path,
      help,
      diagnostics,
    });
  }
  if (code === "document-not-found") {
    return failure("NOT_FOUND", message, {
      path,
      help,
      diagnostics,
    });
  }
  return failure("INTERNAL", message, { path, help, diagnostics });
}

function parseJsonValue(
  raw: string,
): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `--value must be valid JSON: ${message}`,
    };
  }
}

/** `project propose --document --pointer --value [--out] [--cwd]` */
export function runProjectPropose(
  path: readonly string[],
  tokens: readonly string[],
): CliOutcome {
  const args = parseVerbArgs(tokens);
  const unknown = refuseUnknown(args, PROPOSE_FLAGS, path);
  if (unknown) return unknown;

  const document = requireFlag(args, "--document");
  if (!document.ok) {
    return failure("VALIDATION", document.message, {
      path,
      help: [
        "Usage: sceneaxi project propose --document <path> --pointer <json-pointer> --value <json> [--out <proposal.json>] [--cwd <dir>]",
      ],
    });
  }
  // Empty pointer is valid RFC 6901 (whole document).
  const pointer = requireFlag(args, "--pointer", { allowEmpty: true });
  if (!pointer.ok) {
    return failure("VALIDATION", pointer.message, {
      path,
      help: [
        "Usage: sceneaxi project propose --document <path> --pointer <json-pointer> --value <json> [--out <proposal.json>] [--cwd <dir>]",
      ],
    });
  }
  const valueFlag = requireFlag(args, "--value");
  if (!valueFlag.ok) {
    return failure("VALIDATION", valueFlag.message, {
      path,
      help: [
        "Usage: sceneaxi project propose --document <path> --pointer <json-pointer> --value <json> [--out <proposal.json>] [--cwd <dir>]",
      ],
    });
  }

  const parsedValue = parseJsonValue(valueFlag.value);
  if (!parsedValue.ok) {
    return failure("VALIDATION", parsedValue.message, { path });
  }

  const cwd = args.flags.get("--cwd");
  const result = propose({
    documentPath: document.value,
    jsonPointer: pointer.value,
    newValue: parsedValue.value,
    ...(cwd !== undefined ? { cwd } : {}),
  });

  if (!result.ok) {
    return mapDiagnosticsToFailure(result.diagnostics, path);
  }

  const out = args.flags.get("--out");
  if (out !== undefined) {
    const outPath = cwd !== undefined ? resolve(cwd, out) : out;
    writeProposalFile(outPath, result.proposal);
  }

  const payload: ResultPayload = Object.freeze({
    status: "proposed",
    documentPath: document.value,
    jsonPointer: pointer.value,
    unifiedDiff: result.unifiedDiff,
    proposal: result.proposal as unknown as Record<string, unknown>,
    ...(out !== undefined ? { proposalPath: out } : {}),
  });

  return success(payload, [
    out !== undefined
      ? `Run \`sceneaxi project apply --proposal ${out}${cwd ? ` --cwd ${cwd}` : ""}\` to apply`
      : "Pass --out <path> to write the proposal artifact, then project apply --proposal <path>",
    "Run `sceneaxi project propose --help` for usage",
  ]);
}

/** `project apply --proposal <path> [--cwd <dir>]` */
export function runProjectApply(
  path: readonly string[],
  tokens: readonly string[],
): CliOutcome {
  const args = parseVerbArgs(tokens);
  const unknown = refuseUnknown(args, APPLY_FLAGS, path);
  if (unknown) return unknown;

  const proposalFlag = requireFlag(args, "--proposal");
  if (!proposalFlag.ok) {
    return failure("VALIDATION", proposalFlag.message, {
      path,
      help: [
        "Usage: sceneaxi project apply --proposal <path> [--cwd <dir>]",
      ],
    });
  }

  const cwd = args.flags.get("--cwd");
  const result = apply({
    proposal: proposalFlag.value,
    ...(cwd !== undefined ? { cwd } : {}),
  });

  if (!result.ok) {
    return mapDiagnosticsToFailure(result.diagnostics, path);
  }

  return success(
    Object.freeze({
      status: "applied",
      appliedPaths: result.appliedPaths,
    }),
    [
      "Documents updated atomically via tmp-then-rename",
      "Run `sceneaxi project apply --help` for usage",
    ],
  );
}

export function projectProposeHelp(): ResultPayload {
  return Object.freeze({
    command: "project propose",
    description:
      "Propose a JSON Pointer edit to a text-canonical document; emit unified diff + proposal",
    flags: Object.freeze({
      "--document": "Path to the document (required)",
      "--pointer": "RFC 6901 JSON Pointer (required)",
      "--value": "Replacement value as JSON (required)",
      "--out": "Write proposal artifact to this path",
      "--cwd": "Working directory for relative paths",
    }),
  });
}

export function projectApplyHelp(): ResultPayload {
  return Object.freeze({
    command: "project apply",
    description:
      "Apply a proposal all-or-nothing; content-hash conflicts refuse with re-read hint",
    flags: Object.freeze({
      "--proposal": "Path to the proposal artifact (required)",
      "--cwd": "Working directory for relative paths",
    }),
  });
}

// Keep Proposal type referenced for documentation / future narrowing.
export type { Proposal, ApplyDiagnostic };
