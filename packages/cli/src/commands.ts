/**
 * Umbrella command tree: project | asset | profile | catalog | evidence | protocol.
 *
 * Most verb bodies are skeleton stubs — real work lands in later tickets.
 * `project propose` / `project apply` are live (sceneaxi#9 / E1).
 * The tree itself is the protocol surface the shared dispatcher enforces at every depth.
 */

import { EXIT_CODE_TABLE } from "./exit-codes.js";
import type { CliOutcome, ResultPayload } from "./envelope.js";
import {
  projectApplyHelp,
  projectProposeHelp,
  runProjectApply,
  runProjectPropose,
} from "./project-verbs.js";
import { CLI_VERSION, PROTOCOL_SCHEMA_VERSION } from "./version.js";

export interface VerbContext {
  readonly path: readonly string[];
  readonly tokens: readonly string[];
}

export interface VerbNode {
  readonly kind: "verb";
  readonly name: string;
  readonly description: string;
  /**
   * Run the verb. May return a plain success payload or a full CliOutcome
   * (for typed failures from propose/apply).
   */
  readonly run: (ctx: VerbContext) => ResultPayload | CliOutcome;
  /** Optional custom help payload (otherwise skeleton help). */
  readonly helpPayload?: () => ResultPayload;
}

export interface GroupNode {
  readonly kind: "group";
  readonly name: string;
  readonly description: string;
  readonly children: Readonly<Record<string, CommandNode>>;
}

export type CommandNode = GroupNode | VerbNode;

function verb(
  name: string,
  description: string,
  run: (ctx: VerbContext) => ResultPayload | CliOutcome = () =>
    skeletonResult(name),
  helpPayload?: () => ResultPayload,
): VerbNode {
  return helpPayload === undefined
    ? { kind: "verb", name, description, run }
    : { kind: "verb", name, description, run, helpPayload };
}

function group(
  name: string,
  description: string,
  children: Record<string, CommandNode>,
): GroupNode {
  return { kind: "group", name, description, children: Object.freeze(children) };
}

function skeletonResult(verbPath: string): ResultPayload {
  return Object.freeze({
    status: "skeleton",
    verb: verbPath,
    message:
      "Command path is registered; verb body arrives in a later ticket. Protocol dispatch succeeded.",
  });
}

/** E1 project verbs (authoring-contracts.md). propose/apply live; rest skeleton. */
const projectGroup = group("project", "E1 authoring surface (source-first)", {
  new: verb("new", "Create a new project (skeleton)"),
  dev: verb("dev", "Dev / hot-reload loop (skeleton)"),
  test: verb("test", "Run project tests; emit evidence (skeleton)"),
  capture: verb("capture", "Capture evidence artifacts (skeleton)"),
  report: verb("report", "Report / summarize evidence (skeleton)"),
  propose: verb(
    "propose",
    "Propose a JSON Pointer edit; emit unified diff + proposal",
    (ctx) => runProjectPropose(ctx.path, ctx.tokens),
    projectProposeHelp,
  ),
  apply: verb(
    "apply",
    "Apply a proposal all-or-nothing (content-hash conflicts refuse)",
    (ctx) => runProjectApply(ctx.path, ctx.tokens),
    projectApplyHelp,
  ),
});

const assetGroup = group("asset", "Asset package operations (skeleton)", {
  list: verb("list", "List assets (skeleton)"),
});

const profileGroup = group("profile", "Profile operations (skeleton)", {
  list: verb("list", "List profiles (skeleton)"),
});

const catalogGroup = group("catalog", "Catalog operations (skeleton)", {
  list: verb("list", "List catalog items (skeleton)"),
});

const evidenceGroup = group("evidence", "Evidence packet operations (skeleton)", {
  list: verb("list", "List evidence packets (skeleton)"),
});

/**
 * Held-key protocol demo (sceneaxi#7): gated by SYNTHETIC fixture keys only.
 * With the shipped fail-closed runtime (no snapshot, no sentinel) this verb
 * always refuses; tests inject fixture runtimes to exercise the full table.
 */
const demoGroup = group(
  "demo",
  "Held-key protocol demo (synthetic keys; fails closed)",
  {
    gated: verb(
      "gated",
      "Demo verb gated by synthetic captain holds — allowed only when every gating key is resolved and registry currency is established",
      () =>
        Object.freeze({
          status: "held-keys-cleared",
          verb: "demo gated",
          message:
            "Every gating key is resolved and the registry snapshot is current; the gated verb body ran.",
        }),
    ),
  },
);

const protocolGroup = group(
  "protocol",
  "Protocol introspection (ungated; no product policy)",
  {
    version: verb("version", "Show CLI and envelope schema versions", () =>
      Object.freeze({
        cliVersion: CLI_VERSION,
        schemaVersion: PROTOCOL_SCHEMA_VERSION,
        releaseGroup: "cli-protocol",
      }),
    ),
    inspect: verb(
      "inspect",
      "Show exit-code map and envelope contract summary",
      () =>
        Object.freeze({
          schemaVersion: PROTOCOL_SCHEMA_VERSION,
          cliVersion: CLI_VERSION,
          exitCodes: EXIT_CODE_TABLE.map((row) =>
            Object.freeze({ ...row }),
          ),
          commandGroups: ROOT_GROUP_NAMES.slice(),
          globalFlags: GLOBAL_FLAGS_HELP.slice(),
        }),
    ),
  },
);

/** Top-level groups exposed by the umbrella CLI. */
export const ROOT_COMMANDS: Readonly<Record<string, CommandNode>> =
  Object.freeze({
    project: projectGroup,
    asset: assetGroup,
    profile: profileGroup,
    catalog: catalogGroup,
    evidence: evidenceGroup,
    demo: demoGroup,
    protocol: protocolGroup,
  });

export const ROOT_GROUP_NAMES: readonly string[] = Object.freeze(
  Object.keys(ROOT_COMMANDS),
);

export const GLOBAL_FLAGS_HELP: readonly string[] = Object.freeze([
  "--json",
  "--help / -h",
  "--version / -v / -V",
]);

export function childNames(node: GroupNode): string[] {
  return Object.keys(node.children);
}

export function topLevelHelpPayload(): ResultPayload {
  return Object.freeze({
    bin: "sceneaxi",
    description:
      "SceneAxi agent-native CLI — umbrella dispatcher over authoring-core",
    commands: Object.freeze(
      Object.fromEntries(
        Object.entries(ROOT_COMMANDS).map(([name, node]) => [
          name,
          node.description,
        ]),
      ),
    ),
    flags: Object.freeze({
      "--json": "Emit the versioned envelope as JSON (same data as text)",
      "--help": "Show help at the current path",
      "--version": "Print CLI version",
    }),
  });
}

export function groupHelpPayload(node: GroupNode): ResultPayload {
  return Object.freeze({
    group: node.name,
    description: node.description,
    commands: Object.freeze(
      Object.fromEntries(
        Object.entries(node.children).map(([name, child]) => [
          name,
          child.description,
        ]),
      ),
    ),
  });
}

export function verbHelpPayload(
  path: readonly string[],
  node: VerbNode,
): ResultPayload {
  if (node.helpPayload !== undefined) {
    return node.helpPayload();
  }
  return Object.freeze({
    command: path.join(" "),
    description: node.description,
    status: "skeleton",
  });
}
