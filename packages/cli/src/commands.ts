/**
 * Umbrella command tree: project | scene | asset | profile | catalog | evidence | protocol.
 *
 * Every verb below has a real body. The tree itself is the protocol surface the
 * shared dispatcher enforces at every depth, and every verb path must also be
 * declared in SHIPPED_COMMAND_MAP or it refuses at dispatch.
 */

import { EXIT_CODE_TABLE } from "./exit-codes.js";
import {
  desktopBridgeCallHelp,
  desktopBridgeStatusHelp,
  runDesktopBridgeCall,
  runDesktopBridgeStatus,
  runDesktopBridgeTools,
} from "./desktop-verbs.js";
import type { DesktopLocalBridgeClient } from "./desktop-client.js";
import type { CliOutcome, ResultPayload } from "./envelope.js";
import {
  projectCaptureHelp,
  projectDevHelp,
  projectNewHelp,
  projectReportHelp,
  projectTestHelp,
  runProjectCapture,
  runProjectDev,
  runProjectNew,
  runProjectReport,
  runProjectTest,
} from "./project-lifecycle.js";
import {
  projectApplyHelp,
  projectProposeHelp,
  runProjectApply,
  runProjectPropose,
} from "./project-verbs.js";
import {
  assetListHelp,
  catalogListHelp,
  evidenceListHelp,
  profileListHelp,
  profileOpenPathHelp,
  runAssetList,
  runCatalogList,
  runEvidenceList,
  runProfileList,
  runProfileOpenPath,
} from "./registry-verbs.js";
import { runSceneCompose, sceneComposeHelp } from "./scene-verbs.js";
import { CLI_VERSION, PROTOCOL_SCHEMA_VERSION } from "./version.js";
import { assetImportHelp, runAssetImport } from "./asset-verbs.js";

export interface VerbContext {
  readonly path: readonly string[];
  readonly tokens: readonly string[];
  readonly desktopBridge?: DesktopLocalBridgeClient;
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
  /** Optional custom help payload (otherwise a description-only payload). */
  readonly helpPayload?: () => ResultPayload;
  /**
   * True when the verb parses its own flags and is responsible for refusing
   * unknown ones. Argument-less verbs leave this unset and the dispatcher
   * refuses every leftover token on their behalf — fail-closed either way.
   */
  readonly takesArgs?: true;
}

export interface GroupNode {
  readonly kind: "group";
  readonly name: string;
  readonly description: string;
  readonly children: Readonly<Record<string, CommandNode>>;
}

export type CommandNode = GroupNode | VerbNode;

/** An argument-less verb: the dispatcher refuses any leftover token for it. */
function verb(
  name: string,
  description: string,
  run: (ctx: VerbContext) => ResultPayload | CliOutcome,
): VerbNode {
  return { kind: "verb", name, description, run };
}

/** A verb that parses its own flags and owns its unknown-flag refusals. */
function argVerb(
  name: string,
  description: string,
  run: (ctx: VerbContext) => ResultPayload | CliOutcome,
  helpPayload: () => ResultPayload,
): VerbNode {
  return { kind: "verb", name, description, run, helpPayload, takesArgs: true };
}

function group(
  name: string,
  description: string,
  children: Record<string, CommandNode>,
): GroupNode {
  return { kind: "group", name, description, children: Object.freeze(children) };
}

/** E1 project verbs (authoring-contracts.md). */
const projectGroup = group("project", "E1 authoring surface (source-first)", {
  new: argVerb(
    "new",
    "Create a new project document (refuses to overwrite without --force)",
    (ctx) => runProjectNew(ctx.path, ctx.tokens),
    projectNewHelp,
  ),
  dev: argVerb(
    "dev",
    "One-shot project status (no hot-reload loop; --watch refuses)",
    (ctx) => runProjectDev(ctx.path, ctx.tokens),
    projectDevHelp,
  ),
  test: argVerb(
    "test",
    "Validate a document and report deterministic checks",
    (ctx) => runProjectTest(ctx.path, ctx.tokens),
    projectTestHelp,
  ),
  capture: argVerb(
    "capture",
    "Write a deterministic evidence packet for a document",
    (ctx) => runProjectCapture(ctx.path, ctx.tokens),
    projectCaptureHelp,
  ),
  report: argVerb(
    "report",
    "Summarize a captured evidence packet",
    (ctx) => runProjectReport(ctx.path, ctx.tokens),
    projectReportHelp,
  ),
  propose: argVerb(
    "propose",
    "Propose a JSON Pointer edit; emit unified diff + proposal",
    (ctx) => runProjectPropose(ctx.path, ctx.tokens),
    projectProposeHelp,
  ),
  apply: argVerb(
    "apply",
    "Apply a proposal all-or-nothing (content-hash conflicts refuse)",
    (ctx) => runProjectApply(ctx.path, ctx.tokens),
    projectApplyHelp,
  ),
});

const sceneGroup = group(
  "scene",
  "Deterministic multi-object scene composition (offline; no provider, no seed)",
  {
    compose: argVerb(
      "compose",
      "Compose Sculpt Artifacts into one openable scene + projected document",
      (ctx) => runSceneCompose(ctx.path, ctx.tokens),
      sceneComposeHelp,
    ),
  },
);

const assetGroup = group("asset", "Offline asset ingestion and package inspection", {
  import: argVerb(
    "import",
    "Stage a contained GLB/glTF project copy through E1 Change Review",
    (ctx) => runAssetImport(ctx.path, ctx.tokens),
    assetImportHelp,
  ),
  list: argVerb(
    "list",
    "List Asset Package refs declared by catalog items",
    (ctx) => runAssetList(ctx.path, ctx.tokens),
    assetListHelp,
  ),
});

const profileGroup = group("profile", "Profile operations (read-only)", {
  list: argVerb(
    "list",
    "List the versioned Profile Conformance registry",
    (ctx) => runProfileList(ctx.path, ctx.tokens),
    profileListHelp,
  ),
  "open-path": argVerb(
    "open-path",
    "Report the shared open-path demo policy, or evaluate one demo operation against it (demo only; never a shipping claim)",
    (ctx) => runProfileOpenPath(ctx.path, ctx.tokens),
    profileOpenPathHelp,
  ),
});

const catalogGroup = group(
  "catalog",
  "Dormant catalog operations (commerce inert; never activated here)",
  {
    list: argVerb(
      "list",
      "List catalog items with pipeline state and commerce activation",
      (ctx) => runCatalogList(ctx.path, ctx.tokens),
      catalogListHelp,
    ),
  },
);

const evidenceGroup = group("evidence", "Evidence packet operations (read-only)", {
  list: argVerb(
    "list",
    "List evidence packets written by `project capture`",
    (ctx) => runEvidenceList(ctx.path, ctx.tokens),
    evidenceListHelp,
  ),
});

const desktopGroup = group("desktop", "Local Engine Desktop bridge", {
  bridge: group("bridge", "Versioned same-user Unix-socket agent bridge", {
    call: argVerb(
      "call",
      "Invoke one permission-bound checked-in agent tool",
      (ctx) => runDesktopBridgeCall(ctx.path, ctx.tokens, ctx.desktopBridge),
      desktopBridgeCallHelp,
    ),
    status: argVerb(
      "status",
      "Discover, authenticate, and handshake with the running local desktop",
      (ctx) => runDesktopBridgeStatus(ctx.path, ctx.tokens, ctx.desktopBridge),
      desktopBridgeStatusHelp,
    ),
    tools: verb(
      "tools",
      "Print the versioned local agent tool schemas (no connection required)",
      runDesktopBridgeTools,
    ),
  }),
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
    scene: sceneGroup,
    asset: assetGroup,
    profile: profileGroup,
    catalog: catalogGroup,
    evidence: evidenceGroup,
    desktop: desktopGroup,
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
    flags: Object.freeze({}),
  });
}
