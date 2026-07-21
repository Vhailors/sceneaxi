/**
 * Shared CLI dispatcher — enforces the protocol at every nesting level.
 *
 * Anti-pattern (gh-axi wart): unknown sub-subcommands must never exit 0.
 * This dispatcher walks the command tree; any unknown or incomplete path
 * returns USAGE (exit 2) with a versioned envelope and help[].
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
  readonly positionals: readonly string[];
  readonly flags: ReadonlySet<string>;
  readonly format: OutputFormat;
  readonly wantsHelp: boolean;
  readonly wantsVersion: boolean;
}

/**
 * Parse argv into positionals + known global flags.
 * Unknown flags refuse (returned as a failure outcome by the caller).
 */
export function parseArgv(argv: readonly string[]): ParsedArgv | CliOutcome {
  const positionals: string[] = [];
  const flags = new Set<string>();

  for (const token of argv) {
    if (token.startsWith("-")) {
      // Support --flag=value form only for unknown detection (no values yet).
      const flag = token.includes("=") ? token.slice(0, token.indexOf("=")) : token;
      if (!GLOBAL_FLAGS.has(flag)) {
        return failure("UNKNOWN_FLAG", `Unknown flag: ${flag}`, {
          path: positionals,
          help: [
            `Unknown flag '${flag}' refused (fail-closed)`,
            "Global flags: --json, --help, -h, -v, -V, --version",
            positionals.length > 0
              ? `Run \`sceneaxi ${positionals.join(" ")} --help\` for path help`
              : "Run `sceneaxi --help` for usage",
          ],
        });
      }
      flags.add(flag);
      continue;
    }
    positionals.push(token);
  }

  const wantsHelp = flags.has("--help") || flags.has("-h");
  const wantsVersion =
    flags.has("--version") || flags.has("-v") || flags.has("-V");
  const format: OutputFormat = flags.has("--json") ? "json" : "text";

  return {
    positionals: Object.freeze(positionals),
    flags,
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
  if (isOutcome(parsed)) {
    return { outcome: parsed, format: detectFormat(argv) };
  }

  const { positionals, format, wantsHelp, wantsVersion } = parsed;

  // Bare version flags (with or without --json).
  if (wantsVersion && positionals.length === 0) {
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
  if (wantsVersion && positionals.length > 0) {
    return {
      outcome: failure(
        "AMBIGUOUS_INPUT",
        "Do not combine --version with a command path",
        {
          path: positionals,
          help: [
            "Run `sceneaxi --version` or `sceneaxi protocol version`",
            `Run \`sceneaxi ${positionals.join(" ")} --help\` for path help`,
          ],
        },
      ),
      format,
    };
  }

  // Top-level home: bare argv, --help, and/or --json with no command path.
  if (positionals.length === 0) {
    return {
      outcome: success(topLevelHelpPayload(), [
        "Run `sceneaxi <group> --help` for group verbs",
        "Run `sceneaxi protocol inspect` for the exit-code map and envelope contract",
        `Groups: ${ROOT_GROUP_NAMES.join(", ")}`,
      ]),
      format,
    };
  }

  return { outcome: walk(positionals, wantsHelp, heldKeys), format };
}

function walk(
  positionals: readonly string[],
  wantsHelp: boolean,
  heldKeys: HeldKeyRuntime,
): CliOutcome {
  let node: CommandNode | undefined;
  let children: Readonly<Record<string, CommandNode>> = ROOT_COMMANDS;
  const walked: string[] = [];

  for (let i = 0; i < positionals.length; i++) {
    const segment = positionals[i];
    if (segment === undefined) {
      return failure("INTERNAL", "Empty positional segment", {
        path: walked,
      });
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

    if (next.kind === "verb") {
      const rest = positionals.slice(i + 1);
      if (rest.length > 0) {
        // Extra segments under a leaf verb → unknown path at this depth (non-zero).
        return failure(
          "UNKNOWN_COMMAND",
          `Unknown command path: ${[...walked, ...rest].join(" ")}`,
          {
            path: [...walked, ...rest],
            help: [
              `'${walked.join(" ")}' takes no subcommands`,
              `Run \`sceneaxi ${walked.join(" ")} --help\` for usage`,
            ],
          },
        );
      }
      if (wantsHelp) {
        return success(verbHelpPayload(walked, next), [
          `Run \`sceneaxi ${walked.join(" ")}\` to invoke this verb (skeleton)`,
          "Run `sceneaxi protocol inspect` for protocol details",
        ]);
      }
      return invokeVerb(walked, next, heldKeys);
    }

    // group
    children = next.children;
  }

  // Exhausted positionals on a group node.
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
  return invokeVerb(walked, node, heldKeys);
}

/**
 * Every verb invocation passes the held-key gate first (sceneaxi#7).
 * Explicitly ungated verbs (`heldKeys: []`) pass without a currency check;
 * everything else fails closed per docs/held-key-enforcement.md.
 */
function invokeVerb(
  path: readonly string[],
  node: VerbNode,
  heldKeys: HeldKeyRuntime,
): CliOutcome {
  const decision = evaluateHeldKeyGate(path.join(" "), heldKeys);
  if (!decision.allow) {
    return heldKeyRefusal(path, decision);
  }
  return runVerb(path, node);
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

function runVerb(path: readonly string[], node: VerbNode): CliOutcome {
  try {
    const result = node.run();
    return success(result, [
      `Run \`sceneaxi ${path.join(" ")} --help\` for this verb`,
      "Run `sceneaxi protocol inspect` for the exit-code map",
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failure("INTERNAL", message, { path });
  }
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

function isOutcome(value: ParsedArgv | CliOutcome): value is CliOutcome {
  return "exitCode" in value && "envelope" in value;
}

function detectFormat(argv: readonly string[]): OutputFormat {
  return argv.some((t) => t === "--json" || t.startsWith("--json="))
    ? "json"
    : "text";
}
