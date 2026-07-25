/**
 * Shared CLI dispatcher — enforces the protocol at every nesting level.
 *
 * Anti-pattern (gh-axi wart): unknown sub-subcommands must never exit 0.
 * This dispatcher walks the command tree; any unknown or incomplete path
 * returns USAGE (exit 2) with a versioned envelope and help[].
 *
 * Global flags (--json, --help, --version) may appear anywhere. Verb-local
 * flags (e.g. --document) are forwarded to the verb after the command path.
 * Every verb invocation passes the held-key gate first (sceneaxi#7).
 */

import {
  ROOT_COMMANDS,
  ROOT_GROUP_NAMES,
  childNames,
  groupHelpPayload,
  topLevelHelpPayload,
  verbHelpPayload,
  type CommandNode,
  type GroupNode,
  type VerbNode,
} from "./commands.js";
import { failure, success, type CliOutcome } from "./envelope.js";
import type { OutputFormat } from "./format.js";
import {
  defaultHeldKeyRuntime,
  evaluateHeldKeyGate,
  type GateRefusal,
  type HeldKeyRuntime,
} from "./held-keys/gate.js";
import { CLI_VERSION } from "./version.js";

const GLOBAL_FLAGS = new Set([
  "--json",
  "--help",
  "-h",
  "--version",
  "-v",
  "-V",
]);

export interface ParsedArgv {
  /** Non-global tokens in order (command path + verb-local flags/args). */
  readonly tokens: readonly string[];
  readonly flags: ReadonlySet<string>;
  readonly valuedGlobalSwitch: string | null;
  readonly format: OutputFormat;
  readonly wantsHelp: boolean;
  readonly wantsVersion: boolean;
}

/**
 * Parse argv into global flags + remaining tokens.
 * Unknown *global-shaped* flags that are not verb-local are still forwarded
 * as tokens so the verb (or path walker) can refuse them; only the six
 * global protocol flags are stripped here.
 */
export function parseArgv(argv: readonly string[]): ParsedArgv {
  const tokens: string[] = [];
  const flags = new Set<string>();
  let valuedGlobalSwitch: string | null = null;

  for (const token of argv) {
    if (token.startsWith("-")) {
      const flag = token.includes("=") ? token.slice(0, token.indexOf("=")) : token;
      if (GLOBAL_FLAGS.has(flag)) {
        if (token.includes("=")) {
          valuedGlobalSwitch ??= flag;
          continue;
        }
        flags.add(flag);
        continue;
      }
    }
    tokens.push(token);
  }

  const wantsHelp = flags.has("--help") || flags.has("-h");
  const wantsVersion =
    flags.has("--version") || flags.has("-v") || flags.has("-V");
  const format: OutputFormat = flags.has("--json") ? "json" : "text";

  return {
    tokens: Object.freeze(tokens),
    flags,
    valuedGlobalSwitch,
    format,
    wantsHelp,
    wantsVersion,
  };
}

export interface DispatchOptions {
  /**
   * Held-key runtime (command map, registry snapshot, epoch authority, clock).
   * Defaults to the shipped fail-closed runtime: no snapshot, no sentinel —
   * every gated verb refuses. Injectable so tests are fixture-driven.
   */
  readonly heldKeys?: HeldKeyRuntime;
}

/**
 * Dispatch a command-line argv (without the binary name) to a protocol outcome.
 * Pure: no process.exit, no stdout — the runner formats and exits.
 */
export function dispatch(
  argv: readonly string[],
  options: DispatchOptions = {},
): {
  outcome: CliOutcome;
  format: OutputFormat;
} {
  const heldKeys = options.heldKeys ?? defaultHeldKeyRuntime();
  const parsed = parseArgv(argv);
  const { tokens, format, wantsHelp, wantsVersion, valuedGlobalSwitch } = parsed;

  if (valuedGlobalSwitch !== null) {
    return {
      outcome: failure(
        "AMBIGUOUS_INPUT",
        `Boolean switch ${valuedGlobalSwitch} does not accept a value.`,
        {
          path: leadingPath(tokens),
          help: [
            `Pass '${valuedGlobalSwitch}' without '=value'`,
            "Global switches: --json, --help, -h, -v, -V, --version",
          ],
        },
      ),
      format,
    };
  }

  // Bare version flags (with or without --json).
  if (wantsVersion && commandPathLength(tokens) === 0) {
    return {
      outcome: success(
        {
          cliVersion: CLI_VERSION,
        },
        [
          "Run `sceneaxi protocol version` for schema + package versions",
          "Run `sceneaxi --help` for command groups",
        ],
      ),
      format,
    };
  }

  // Version flag combined with a path is ambiguous / invalid.
  if (wantsVersion && commandPathLength(tokens) > 0) {
    const pathOnly = leadingPath(tokens);
    return {
      outcome: failure(
        "AMBIGUOUS_INPUT",
        "Do not combine --version with a command path",
        {
          path: pathOnly,
          help: [
            "Run `sceneaxi --version` or `sceneaxi protocol version`",
            pathOnly.length > 0
              ? `Run \`sceneaxi ${pathOnly.join(" ")} --help\` for path help`
              : "Run `sceneaxi --help` for usage",
          ],
        },
      ),
      format,
    };
  }

  // Top-level home: bare argv, --help, and/or --json with no command path.
  // Unknown non-global flags with no path refuse (fail-closed).
  if (commandPathLength(tokens) === 0) {
    const stray = tokens.find((t) => t.startsWith("-"));
    if (stray !== undefined) {
      const flag = stray.includes("=") ? stray.slice(0, stray.indexOf("=")) : stray;
      return {
        outcome: failure("UNKNOWN_FLAG", `Unknown flag: ${flag}`, {
          path: [],
          help: [
            `Unknown flag '${flag}' refused (fail-closed)`,
            "Global flags: --json, --help, -h, -v, -V, --version",
            "Run `sceneaxi --help` for usage",
          ],
        }),
        format,
      };
    }
    return {
      outcome: success(topLevelHelpPayload(), [
        "Run `sceneaxi <group> --help` for group verbs",
        "Run `sceneaxi protocol inspect` for the exit-code map and envelope contract",
        `Groups: ${ROOT_GROUP_NAMES.join(", ")}`,
      ]),
      format,
    };
  }

  return { outcome: walk(tokens, wantsHelp, heldKeys), format };
}

/** Count leading non-flag tokens (the command path prefix). */
function commandPathLength(tokens: readonly string[]): number {
  let n = 0;
  for (const t of tokens) {
    if (t.startsWith("-")) break;
    n += 1;
  }
  return n;
}

function leadingPath(tokens: readonly string[]): string[] {
  const path: string[] = [];
  for (const t of tokens) {
    if (t.startsWith("-")) break;
    path.push(t);
  }
  return path;
}

function walk(
  tokens: readonly string[],
  wantsHelp: boolean,
  heldKeys: HeldKeyRuntime,
): CliOutcome {
  let node: CommandNode | undefined;
  let children: Readonly<Record<string, CommandNode>> = ROOT_COMMANDS;
  const walked: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    const segment = tokens[i];
    if (segment === undefined) {
      return failure("INTERNAL", "Empty token segment", { path: walked });
    }

    // Flag before completing the command path → unknown at this depth
    // (except we only get here when there is still path to walk).
    if (segment.startsWith("-")) {
      if (walked.length === 0) {
        return failure("UNKNOWN_FLAG", `Unknown flag: ${segment}`, {
          path: [],
          help: [
            `Unknown flag '${segment}' refused (fail-closed)`,
            "Global flags: --json, --help, -h, -v, -V, --version",
            "Run `sceneaxi --help` for usage",
          ],
        });
      }
      // Incomplete group path followed by flags.
      return failure(
        "AMBIGUOUS_INPUT",
        `Incomplete command path: '${walked.join(" ")}' requires a verb`,
        {
          path: walked,
          help: groupHelpLines(
            // node must be the group we stopped on
            node as GroupNode,
            walked,
          ),
        },
      );
    }

    const next: CommandNode | undefined = children[segment];
    if (next === undefined) {
      const atRoot = walked.length === 0;
      return failure(
        "UNKNOWN_COMMAND",
        atRoot
          ? `Unknown command: ${segment}`
          : `Unknown command path: ${[...walked, segment].join(" ")}`,
        {
          path: [...walked, segment],
          help: unknownCommandHelp(walked, children),
        },
      );
    }

    walked.push(segment);
    node = next;
    i += 1;

    if (next.kind === "verb") {
      const rest = tokens.slice(i);
      // Extra non-flag path segments under a leaf without allowing subcommands.
      // Flags are OK and go to the verb; bare positionals that look like
      // subcommands are still refused by the verb (or as unknown path if no flags).
      if (wantsHelp) {
        // Help ignores verb-local tokens.
        return success(verbHelpPayload(walked, next), [
          next.takesArgs === true
            ? `Run \`sceneaxi ${walked.join(" ")}\` with the documented flags`
            : `Run \`sceneaxi ${walked.join(" ")}\` — this verb takes no flags`,
          "Run `sceneaxi protocol inspect` for protocol details",
        ]);
      }
      return invokeVerb(walked, next, rest, heldKeys);
    }

    // group
    children = next.children;
  }

  // Exhausted tokens on a group node.
  if (node === undefined) {
    return failure("INTERNAL", "Dispatcher walked an empty path", { path: [] });
  }

  if (node.kind === "group") {
    if (wantsHelp) {
      return success(groupHelpPayload(node), groupHelpLines(node, walked));
    }
    // Incomplete path: group without verb → USAGE (fail-closed, not exit 0).
    return failure(
      "AMBIGUOUS_INPUT",
      `Incomplete command path: '${walked.join(" ")}' requires a verb`,
      {
        path: walked,
        help: groupHelpLines(node, walked),
      },
    );
  }

  // Leaf reached exactly (shouldn't hit — loop returns on verb).
  return invokeVerb(walked, node, [], heldKeys);
}

/**
 * Every verb invocation passes the held-key gate first (sceneaxi#7).
 * Explicitly ungated verbs (`heldKeys: []`) pass without a currency check;
 * everything else fails closed per docs/held-key-enforcement.md.
 */
function invokeVerb(
  path: readonly string[],
  node: VerbNode,
  tokens: readonly string[],
  heldKeys: HeldKeyRuntime,
): CliOutcome {
  const decision = evaluateHeldKeyGate(path.join(" "), heldKeys);
  if (!decision.allow) {
    return heldKeyRefusal(path, decision);
  }
  return runVerb(path, node, tokens);
}

function heldKeyRefusal(
  path: readonly string[],
  decision: GateRefusal,
): CliOutcome {
  return failure("HELD_KEY", decision.message, {
    path,
    ...(decision.heldKey === undefined ? {} : { heldKey: decision.heldKey }),
    heldKeyReason: decision.reason,
    help: [
      `Refusal reason '${decision.reason}' — see the refusal table in docs/held-key-enforcement.md`,
      "Held-key enforcement fails closed: no offline exception and no env-flag override for gated verbs",
    ],
  });
}

function runVerb(
  path: readonly string[],
  node: VerbNode,
  tokens: readonly string[],
): CliOutcome {
  try {
    // Argument-less verbs refuse any leftover token (flag or positional);
    // verbs that parse their own flags refuse unknown ones themselves.
    if (node.takesArgs !== true && tokens.length > 0) {
      const first = tokens[0];
      if (first !== undefined && first.startsWith("-")) {
        return failure("UNKNOWN_FLAG", `Unknown flag: ${first}`, {
          path,
          help: [
            `Unknown flag '${first}' refused (fail-closed)`,
            "Global flags: --json, --help, -h, -v, -V, --version",
            `Run \`sceneaxi ${path.join(" ")} --help\` for path help`,
          ],
        });
      }
      return failure(
        "UNKNOWN_COMMAND",
        `Unknown command path: ${[...path, ...tokens.filter((t) => !t.startsWith("-"))].join(" ")}`,
        {
          path: [...path, ...tokens.filter((t) => !t.startsWith("-"))],
          help: [
            `'${path.join(" ")}' takes no subcommands`,
            `Run \`sceneaxi ${path.join(" ")} --help\` for usage`,
          ],
        },
      );
    }

    const result = node.run({ path, tokens });
    if (isOutcome(result)) {
      return result;
    }
    return success(result, [
      `Run \`sceneaxi ${path.join(" ")} --help\` for this verb`,
      "Run `sceneaxi protocol inspect` for the exit-code map",
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failure("INTERNAL", message, { path });
  }
}

function isOutcome(value: unknown): value is CliOutcome {
  return (
    typeof value === "object" &&
    value !== null &&
    "exitCode" in value &&
    "envelope" in value
  );
}

function unknownCommandHelp(
  walked: readonly string[],
  children: Readonly<Record<string, CommandNode>>,
): string[] {
  const known = Object.keys(children);
  if (walked.length === 0) {
    return [
      `Known groups: ${known.join(", ")}`,
      "Run `sceneaxi --help` for usage",
      "Run `sceneaxi protocol inspect` for the exit-code map",
    ];
  }
  return [
    `Known under '${walked.join(" ")}': ${known.join(", ") || "(none)"}`,
    `Run \`sceneaxi ${walked.join(" ")} --help\` for usage`,
  ];
}

function groupHelpLines(node: GroupNode, walked: readonly string[]): string[] {
  const names = childNames(node);
  return [
    `Verbs: ${names.join(", ")}`,
    `Run \`sceneaxi ${walked.join(" ")} <verb>\` to invoke a verb`,
    "Run `sceneaxi protocol inspect` for the exit-code map",
  ];
}
