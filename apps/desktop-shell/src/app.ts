/**
 * Runnable desktop-shell application layer.
 *
 * Turns a command line into one session operation and one rendered result.
 * The desktop surface is deliberately protocol-thin: it drives the same
 * `@sceneaxi/authoring-core` operations the CLI drives, so the two produce
 * byte-identical documents (proven by tests/parity/shell-cli-parity.test.ts).
 *
 * Not in scope here, by design: native packaging, an installer, an offline
 * store, hosting, or a design system.
 */

import type { ApplyDiagnostic } from "@sceneaxi/authoring-core";
import {
  OPEN_PATH_REFUSE_ONLY_PROFILE,
  evaluateOpenPathDemo,
  openPathPolicyView,
} from "@sceneaxi/schemas";
import {
  createDesktopSession,
  type DesktopSession,
  type DesktopSnapshot,
} from "./session.js";

/** Exit codes, matching the CLI protocol's map so scripts branch identically. */
export const DesktopExit = {
  OK: 0,
  ERROR: 1,
  USAGE: 2,
} as const;

export type DesktopExitCode = (typeof DesktopExit)[keyof typeof DesktopExit];

export type DesktopResult = {
  readonly exitCode: DesktopExitCode;
  readonly ok: boolean;
  readonly command: string;
  readonly result: Readonly<Record<string, unknown>>;
  readonly help: readonly string[];
};

export type DesktopRunResult = DesktopResult & {
  readonly stdout: string;
  readonly format: "text" | "json";
};

export const DESKTOP_COMMANDS = Object.freeze({
  status: "Report a document's id, content hash, and top-level data keys",
  propose: "Propose a JSON Pointer edit and render the diff for review",
  apply: "Propose and accept an edit in one non-interactive step",
  undo: "Undo the last completed apply",
  "open-path":
    "Report the shared open-path demo policy, or evaluate one demo operation against it (demo only; never a shipping claim)",
});

const USAGE_LINES: readonly string[] = Object.freeze([
  "Usage: sceneaxi-desktop <command> [flags]",
  "",
  ...Object.entries(DESKTOP_COMMANDS).map(
    ([name, description]) => `  ${name.padEnd(8)} ${description}`,
  ),
  "",
  "Flags: --document <path> --pointer <json-pointer> --value <json> --cwd <dir> --json",
  "open-path flags: --profile <@sceneaxi/profile-name> --operation <open|dispatch|advance|observe|save|replay>",
]);

const COMMAND_FLAGS: Readonly<Record<string, ReadonlySet<string>>> =
  Object.freeze({
    status: new Set(["--document", "--cwd"]),
    propose: new Set(["--document", "--pointer", "--value", "--cwd"]),
    apply: new Set(["--document", "--pointer", "--value", "--cwd"]),
    undo: new Set(["--cwd"]),
    "open-path": new Set(["--profile", "--operation"]),
  });

const VALIDATION_DIAGNOSTICS: ReadonlySet<ApplyDiagnostic["code"]> = new Set([
  "schema-major-mismatch",
  "invalid-document",
  "invalid-proposal",
  "invalid-pointer",
  "validation-failed",
  "parse-error",
]);

type ParsedArgs = {
  readonly command: string | null;
  readonly flags: ReadonlyMap<string, string>;
  readonly switches: ReadonlySet<string>;
  readonly positionals: readonly string[];
};

function parseArgs(argv: readonly string[]): ParsedArgs {
  const flags = new Map<string, string>();
  const switches = new Set<string>();
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === undefined) continue;
    if (token.startsWith("--")) {
      if (token.includes("=")) {
        const eq = token.indexOf("=");
        flags.set(token.slice(0, eq), token.slice(eq + 1));
        continue;
      }
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags.set(token, next);
        i += 1;
      } else {
        switches.add(token);
      }
      continue;
    }
    positionals.push(token);
  }

  return {
    command: positionals[0] ?? null,
    flags,
    switches,
    positionals: Object.freeze(positionals.slice(1)),
  };
}

function ok(
  command: string,
  result: Readonly<Record<string, unknown>>,
  help: readonly string[],
): DesktopResult {
  return {
    exitCode: DesktopExit.OK,
    ok: true,
    command,
    result: Object.freeze(result),
    help: Object.freeze([...help]),
  };
}

function refuse(
  command: string,
  exitCode: DesktopExitCode,
  message: string,
  extra: Readonly<Record<string, unknown>> = {},
  help: readonly string[] = USAGE_LINES,
): DesktopResult {
  return {
    exitCode,
    ok: false,
    command,
    result: Object.freeze({ message, ...extra }),
    help: Object.freeze([...help]),
  };
}

function diagnosticsResult(
  command: string,
  diagnostics: readonly ApplyDiagnostic[],
  extra: Readonly<Record<string, unknown>> = {},
): DesktopResult {
  const primary = diagnostics[0];
  return refuse(
    command,
    primary !== undefined && VALIDATION_DIAGNOSTICS.has(primary.code)
      ? DesktopExit.USAGE
      : DesktopExit.ERROR,
    primary?.message ?? "Operation refused with typed diagnostics.",
    { ...extra, diagnostics },
    ["The operation refused; no document was written."],
  );
}

function snapshotPayload(
  snapshot: DesktopSnapshot,
): Readonly<Record<string, unknown>> {
  return {
    phase: snapshot.phase,
    journalRecoveryPending: snapshot.journalRecoveryPending,
    ...(snapshot.transactionId === null
      ? {}
      : { transactionId: snapshot.transactionId }),
    ...(snapshot.renderedDiff === null
      ? {}
      : { renderedDiff: snapshot.renderedDiff }),
    ...(snapshot.appliedPaths === null
      ? {}
      : { appliedPaths: snapshot.appliedPaths }),
  };
}

/** Require a valued flag, or return the refusal. */
function need(
  args: ParsedArgs,
  name: string,
  command: string,
): { readonly ok: true; readonly value: string } | { readonly ok: false; readonly refusal: DesktopResult } {
  const value = args.flags.get(name);
  if (value === undefined || value.length === 0) {
    return {
      ok: false,
      refusal: refuse(
        command,
        DesktopExit.USAGE,
        `Missing required flag ${name}`,
      ),
    };
  }
  return { ok: true, value };
}

function unknownArgs(
  args: ParsedArgs,
  command: string,
  allowedFlags: ReadonlySet<string>,
): DesktopResult | null {
  for (const name of args.flags.keys()) {
    if (!allowedFlags.has(name)) {
      return refuse(
        command,
        DesktopExit.USAGE,
        `Unknown flag: ${name}`,
      );
    }
  }
  for (const name of args.switches) {
    if (name !== "--help") {
      return refuse(
        command,
        DesktopExit.USAGE,
        `Unknown flag: ${name}`,
      );
    }
  }
  return null;
}

/**
 * `open-path` — the shared open-path demo policy (sceneaxi#137).
 *
 * The reported payload is `openPathPolicyView()` verbatim, which is the same
 * value the CLI verb reports, because parity between the surfaces should be a
 * data identity a test can assert rather than two prose descriptions a reviewer
 * has to keep aligned. Evaluation calls the same shared decision function, so
 * the Kids refusal is the shell's refusal too — a non-zero exit, not an
 * omission.
 */
function openPathResult(args: ParsedArgs): DesktopResult {
  const command = "open-path";
  const profile = args.flags.get("--profile");
  const operation = args.flags.get("--operation");

  if (operation !== undefined && (profile === undefined || profile.length === 0)) {
    return refuse(
      command,
      DesktopExit.USAGE,
      "--operation requires --profile: an operation is only meaningful against one profile's policy row.",
    );
  }

  const view = openPathPolicyView();

  if (profile === undefined || profile.length === 0) {
    return ok(command, { policy: view }, [
      "Demo levels are demonstrations, never a shipping or production-readiness claim",
      `${OPEN_PATH_REFUSE_ONLY_PROFILE} is refuse-only and stays that way`,
    ]);
  }

  const row = view.rows.find((entry) => entry.profile === profile);
  if (row === undefined) {
    return refuse(
      command,
      DesktopExit.USAGE,
      `Profile ${JSON.stringify(profile)} is not in the open-path demo policy.`,
    );
  }

  if (operation === undefined || operation.length === 0) {
    return ok(
      command,
      { policy: { ...view, policyCount: 1, rows: [row] } },
      [`Evidence for this row: ${row.evidence}`],
    );
  }

  const decision = evaluateOpenPathDemo({ profile, operation });
  if (!decision.ok) {
    return refuse(command, DesktopExit.USAGE, decision.message, {
      reason: decision.code,
      profile: decision.profile,
      operation,
    });
  }

  return ok(command, { decision }, [
    "The decision is a demo permission only; shippingClaim is false by contract",
    `Evidence for this level: ${decision.evidence}`,
  ]);
}

/**
 * Execute one desktop command against a session.
 * Pure of process I/O so tests and the binary share one code path.
 */
export function runDesktopCommand(
  argv: readonly string[],
  sessionFor: (cwd: string | undefined) => DesktopSession = (cwd) =>
    createDesktopSession(cwd === undefined ? {} : { cwd }),
): DesktopResult {
  const args = parseArgs(argv);

  if (args.command === null) {
    const unknown = unknownArgs(args, "help", new Set());
    if (unknown !== null) return unknown;
    return ok(
      "help",
      {
        app: "sceneaxi-desktop",
        description:
          "SceneAxi desktop shell — protocol client of authoring-core (same operations as the CLI)",
        commands: DESKTOP_COMMANDS,
      },
      USAGE_LINES,
    );
  }

  if (!Object.hasOwn(DESKTOP_COMMANDS, args.command)) {
    return refuse(
      args.command,
      DesktopExit.USAGE,
      `Unknown command: ${args.command}`,
    );
  }

  const command = args.command;
  const allowedFlags = COMMAND_FLAGS[command];
  if (allowedFlags === undefined) {
    return refuse(command, DesktopExit.USAGE, `Unknown command: ${command}`);
  }
  const unknown = unknownArgs(args, command, allowedFlags);
  if (unknown !== null) return unknown;

  if (args.switches.has("--help")) {
    return ok(
      "help",
      {
        app: "sceneaxi-desktop",
        command,
        description: DESKTOP_COMMANDS[command as keyof typeof DESKTOP_COMMANDS],
      },
      USAGE_LINES,
    );
  }

  if (args.positionals.length > 0) {
    return refuse(
      args.command,
      DesktopExit.USAGE,
      `Unexpected arguments: ${args.positionals.join(" ")}`,
    );
  }

  // Policy is contracts, not documents: this command opens no session at all.
  if (command === "open-path") return openPathResult(args);

  const session = sessionFor(args.flags.get("--cwd"));

  if (command === "undo") {
    const result = session.undo();
    if (!result.ok) return diagnosticsResult(command, result.diagnostics);
    return ok(command, { restoredPaths: result.restoredPaths }, [
      "The last completed apply was reverted",
    ]);
  }

  const document = need(args, "--document", command);
  if (!document.ok) return document.refusal;

  if (command === "status") {
    const status = session.status(document.value);
    if (!status.ok) return diagnosticsResult(command, status.diagnostics);
    return ok(
      command,
      {
        documentPath: status.documentPath,
        documentId: status.documentId,
        contentHash: status.contentHash,
        dataKeys: status.dataKeys,
      },
      ["Run `sceneaxi-desktop propose --document ... --pointer ... --value ...` to edit"],
    );
  }

  const pointer = args.flags.get("--pointer");
  if (pointer === undefined) {
    return refuse(command, DesktopExit.USAGE, "Missing required flag --pointer");
  }
  const rawValue = need(args, "--value", command);
  if (!rawValue.ok) return rawValue.refusal;

  let newValue: unknown;
  try {
    newValue = JSON.parse(rawValue.value) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return refuse(
      command,
      DesktopExit.USAGE,
      `--value must be valid JSON: ${message}`,
    );
  }

  const proposed = session.proposeEdit({
    documentPath: document.value,
    jsonPointer: pointer,
    newValue,
  });
  if (proposed.phase !== "reviewing") {
    return diagnosticsResult(command, proposed.diagnostics ?? []);
  }

  if (command === "propose") {
    return ok(command, snapshotPayload(proposed), [
      "Nothing was written — this is a review surface",
      "Re-run with `apply` to accept the same edit",
    ]);
  }

  const accepted = session.accept();
  if (accepted.phase !== "applied") {
    return diagnosticsResult(
      command,
      accepted.diagnostics ?? [],
      snapshotPayload(accepted),
    );
  }
  return ok(command, snapshotPayload(accepted), [
    "Documents updated atomically via tmp-then-rename",
    "Run `sceneaxi-desktop undo` to revert this apply",
  ]);
}

/** Render a result for a terminal (text) or a machine (`--json`). */
export function renderDesktopResult(
  result: DesktopResult,
  format: "text" | "json",
): string {
  if (format === "json") {
    return `${JSON.stringify(
      {
        app: "sceneaxi-desktop",
        ok: result.ok,
        command: result.command,
        result: result.result,
        help: result.help,
      },
      null,
      2,
    )}\n`;
  }

  const lines: string[] = [
    `${result.ok ? "ok" : "refused"}: ${result.command}`,
  ];
  for (const [key, value] of Object.entries(result.result)) {
    lines.push(
      typeof value === "string" && !value.includes("\n")
        ? `  ${key}: ${value}`
        : `  ${key}: ${JSON.stringify(value)}`,
    );
  }
  for (const line of result.help) lines.push(line.length === 0 ? "" : `  ${line}`);
  return `${lines.join("\n")}\n`;
}

/** Run argv and produce the exact stdout the binary writes. Pure. */
export function runDesktopShell(
  argv: readonly string[] = [],
  sessionFor?: (cwd: string | undefined) => DesktopSession,
): DesktopRunResult {
  const format = argv.includes("--json") ? "json" : "text";
  const result =
    sessionFor === undefined
      ? runDesktopCommand(argv.filter((token) => token !== "--json"))
      : runDesktopCommand(
          argv.filter((token) => token !== "--json"),
          sessionFor,
        );
  return { ...result, format, stdout: renderDesktopResult(result, format) };
}

/**
 * Process entry: write stdout and set `process.exitCode` (never calls
 * `process.exit`, so embedders and tests can observe the code).
 */
export function main(argv: readonly string[] = process.argv.slice(2)): number {
  const run = runDesktopShell(argv);
  process.stdout.write(run.stdout);
  process.exitCode = run.exitCode;
  return run.exitCode;
}
