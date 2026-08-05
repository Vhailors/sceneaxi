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
  openPathSurfaceNotes,
  resolveOpenPathSurfaceRequest,
} from "@sceneaxi/schemas";
import { renderDesktopChrome } from "./chrome.js";
import { DESKTOP_COMMANDS } from "./commands.js";
import {
  createDesktopSession,
  type DesktopSession,
  type DesktopSnapshot,
} from "./session.js";
import {
  DESKTOP_ASSISTANT_MODE_IDS,
  DESKTOP_MODE_IDS,
  DESKTOP_OVERLAY_IDS,
  DESKTOP_PROFILE_IDS,
  createDesktopVisualState,
  desktopVisualView,
  type DesktopAssistantModeId,
  type DesktopModeId,
  type DesktopOverlayId,
  type DesktopProfileId,
} from "./visual-model.js";

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

export { DESKTOP_COMMANDS } from "./commands.js";

const USAGE_LINES: readonly string[] = Object.freeze([
  "Usage: sceneaxi-desktop <command> [flags]",
  "",
  ...Object.entries(DESKTOP_COMMANDS).map(
    ([name, description]) => `  ${name.padEnd(9)} ${description}`,
  ),
  "",
  "Flags: --document <path> --pointer <json-pointer> --value <json> --cwd <dir> --json",
  "open-path flags: --profile <@sceneaxi/profile-name> --operation <open|dispatch|advance|observe|save|replay>",
  "chrome flags: --mode <build|sculpt|compose|animate|run|ship|plugins> --profile <game|web|kids>",
  "              --overlay <palette|refused|conflict> --assistant-mode <ask|build|agent>",
  "              --sculpt <idle|running> --width <px> --height <px>",
]);

const COMMAND_FLAGS: Readonly<Record<string, ReadonlySet<string>>> =
  Object.freeze({
    status: new Set(["--document", "--cwd"]),
    propose: new Set(["--document", "--pointer", "--value", "--cwd"]),
    apply: new Set(["--document", "--pointer", "--value", "--cwd"]),
    undo: new Set(["--cwd"]),
    "open-path": new Set(["--profile", "--operation"]),
    chrome: new Set([
      "--mode",
      "--profile",
      "--overlay",
      "--assistant-mode",
      "--sculpt",
      "--width",
      "--height",
    ]),
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
 *
 * The branch selection is shared too (`resolveOpenPathSurfaceRequest`), as are
 * the sentences printed beside it (`openPathSurfaceNotes`), so this command only
 * renders a tagged outcome; an explicitly empty `--profile=` or `--operation=`
 * refuses there rather than reading as an absent flag here.
 */
function openPathResult(args: ParsedArgs): DesktopResult {
  const command = "open-path";
  const outcome = resolveOpenPathSurfaceRequest({
    profile: args.flags.get("--profile"),
    operation: args.flags.get("--operation"),
  });
  const notes = openPathSurfaceNotes(outcome);

  if (outcome.kind === "policy" || outcome.kind === "projection") {
    return ok(command, { policy: outcome.policy }, [...notes]);
  }

  if (outcome.kind === "decision") {
    return ok(command, { decision: outcome.decision }, [...notes]);
  }

  return refuse(
    command,
    DesktopExit.USAGE,
    outcome.refusal.message,
    {
      reason: outcome.refusal.code,
      profile: outcome.refusal.profile,
      ...(outcome.operation === null ? {} : { operation: outcome.operation }),
    },
    [...notes, ...USAGE_LINES],
  );
}

/**
 * Read one enumerated flag, refusing an unknown value by naming the whole set.
 * A silent fallback to a default would make a typo look like a rendered state.
 */
function pick<Value extends string>(
  args: ParsedArgs,
  flag: string,
  allowed: ReadonlyArray<Value>,
  fallback: Value,
): { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly message: string } {
  const raw = args.flags.get(flag);
  if (raw === undefined) return { ok: true, value: fallback };
  const match = allowed.find((candidate) => candidate === raw);
  if (match === undefined) {
    return {
      ok: false,
      message: `${flag} must be one of: ${allowed.join(", ")} (got ${JSON.stringify(raw)})`,
    };
  }
  return { ok: true, value: match };
}

function pickSize(
  args: ParsedArgs,
  flag: string,
  fallback: number,
): { readonly ok: true; readonly value: number } | { readonly ok: false; readonly message: string } {
  const raw = args.flags.get(flag);
  if (raw === undefined) return { ok: true, value: fallback };
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    return { ok: false, message: `${flag} must be a positive integer number of CSS pixels` };
  }
  return { ok: true, value: parsed };
}

/**
 * `chrome` — render the Engine Desktop editor chrome for one visual state.
 *
 * The document is the evidence artifact: a browser opens exactly the bytes the
 * gate asserts. Its optional host port is the only route to project state and
 * composed-scene playback; without that injected authority, every product-loop
 * action refuses by name. Emitting the document itself draws no pixel.
 */
function chromeResult(args: ParsedArgs): DesktopResult {
  const command = "chrome";
  const mode = pick<DesktopModeId>(args, "--mode", DESKTOP_MODE_IDS, "build");
  if (!mode.ok) return refuse(command, DesktopExit.USAGE, mode.message);
  const profile = pick<DesktopProfileId>(args, "--profile", DESKTOP_PROFILE_IDS, "game");
  if (!profile.ok) return refuse(command, DesktopExit.USAGE, profile.message);
  const overlay = pick<DesktopOverlayId | "none">(
    args,
    "--overlay",
    [...DESKTOP_OVERLAY_IDS, "none"],
    "none",
  );
  if (!overlay.ok) return refuse(command, DesktopExit.USAGE, overlay.message);
  const assistantMode = pick<DesktopAssistantModeId>(
    args,
    "--assistant-mode",
    DESKTOP_ASSISTANT_MODE_IDS,
    "build",
  );
  if (!assistantMode.ok) return refuse(command, DesktopExit.USAGE, assistantMode.message);
  const sculpt = pick<"idle" | "running">(args, "--sculpt", ["idle", "running"], "idle");
  if (!sculpt.ok) return refuse(command, DesktopExit.USAGE, sculpt.message);
  const width = pickSize(args, "--width", 1680);
  if (!width.ok) return refuse(command, DesktopExit.USAGE, width.message);
  const height = pickSize(args, "--height", 1000);
  if (!height.ok) return refuse(command, DesktopExit.USAGE, height.message);

  const state = createDesktopVisualState({
    mode: mode.value,
    profile: profile.value,
    overlay: overlay.value === "none" ? null : overlay.value,
    assistantMode: assistantMode.value,
    sculpt: sculpt.value,
    ...(sculpt.value === "running" ? { sculptPass: 2, sculptPassFraction: 0.64 } : {}),
    window: { width: width.value, height: height.value },
  });
  const view = desktopVisualView(state);

  return ok(
    command,
    {
      mode: view.state.mode,
      profile: view.state.profile,
      tier: view.tier,
      dockTab: view.state.dockTab,
      assistant: view.assistant.state,
      overlay: view.state.overlay ?? "none",
      pendingChanges: view.changeReview.count,
      pixelsDrawn: view.viewport.pixelsDrawn,
      ...(view.refusal === null ? {} : { refusal: view.refusal.code }),
      html: renderDesktopChrome(view),
    },
    [
      "Text output is the HTML document itself — redirect it to a file and open that file",
      "The standalone document draws no pixels; a packaged host may supply project and play results",
    ],
  );
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
  // Neither does the chrome: it is a projection of the visual model.
  if (command === "chrome") return chromeResult(args);

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
        data: status.data,
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

  // `chrome` renders a document, not a report: in text mode its stdout is the
  // document itself, so `sceneaxi-desktop chrome > shell.html` opens directly.
  // `--json` still gets the envelope, with the same bytes under `html`.
  if (result.ok && result.command === "chrome") {
    const html = result.result["html"];
    if (typeof html === "string") return html;
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
