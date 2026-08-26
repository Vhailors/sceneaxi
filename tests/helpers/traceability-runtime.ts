import { ASSISTANT_SCULPT_REFUSALS } from "../../packages/authoring-core/src/assistant-sculpt.js";
import { AUTH_REFUSE_REASONS } from "../../packages/auth/src/refusals.js";
import { BILLING_REFUSE_REASONS } from "../../packages/billing/src/refusals.js";
import {
  ROOT_COMMANDS,
  SHIPPED_COMMAND_MAP,
  type CommandNode,
} from "../../packages/cli/src/index.js";
import { HELD_KEY_REFUSAL_REASONS } from "../../packages/cli/src/held-keys/gate.js";
import {
  DESKTOP_PRODUCT_REFUSALS,
  createDesktopVisualState,
  desktopVisualView,
} from "../../apps/desktop-shell/src/index.js";
import {
  DESKTOP_LOCAL_BRIDGE_TOOLS,
  EDITOR_COMMAND_REFUSALS,
  EDITOR_COMMAND_REGISTRY,
} from "../../packages/schemas/src/index.js";
import {
  DESKTOP_BRIDGE_ACTIONS,
  DESKTOP_BRIDGE_ASSISTANT_OPS,
  DESKTOP_BRIDGE_AUTHORING_OPS,
  DESKTOP_BRIDGE_REFUSALS,
} from "../../desktop/linux/src/lib/bridge-contract.js";

export type TraceabilityRuntimeSurfaces = Readonly<{
  schemaVersion: 1;
  cliVerbs: readonly string[];
  heldKeyEntries: readonly Readonly<{ command: string; heldKeys: readonly string[] }>[];
  editorCommands: readonly string[];
  desktopControls: readonly string[];
  bridgeActions: readonly string[];
  authoringOperations: readonly string[];
  assistantOperations: readonly string[];
  localAgentTools: readonly string[];
  refusalRegistries: readonly Readonly<{ path: string; symbol: string }>[];
}>;

function cliVerbPaths(): string[] {
  const paths: string[] = [];
  const visit = (
    children: Readonly<Record<string, CommandNode>>,
    prefix: readonly string[],
  ): void => {
    for (const [name, node] of Object.entries(children)) {
      if (node.kind === "verb") paths.push([...prefix, name].join(" "));
      else visit(node.children, [...prefix, name]);
    }
  };
  visit(ROOT_COMMANDS, []);
  return paths;
}

function desktopControlIds(): string[] {
  const states = [
    createDesktopVisualState(),
    createDesktopVisualState({ assistantRuntime: "local" }),
    createDesktopVisualState({ profile: "kids" }),
    createDesktopVisualState({ profile: "web" }),
    createDesktopVisualState({ mode: "run" }),
    createDesktopVisualState({ mode: "animate" }),
    createDesktopVisualState({ mode: "ship" }),
    createDesktopVisualState({ overlay: "palette" }),
  ];
  return [...new Set(states.flatMap((state) => desktopVisualView(state).controls.map((control) => control.id)))].sort();
}

function assertRegistry(values: readonly string[], symbol: string): void {
  if (values.length === 0 || values.some((value) => value.length === 0)) {
    throw new Error(`${symbol} is empty or contains an empty refusal value`);
  }
}

export function traceabilityRuntimeSurfaces(): TraceabilityRuntimeSurfaces {
  const registries = [
    ["packages/auth/src/refusals.ts", "AUTH_REFUSE_REASONS", Object.values(AUTH_REFUSE_REASONS)],
    ["packages/billing/src/refusals.ts", "BILLING_REFUSE_REASONS", Object.values(BILLING_REFUSE_REASONS)],
    ["packages/authoring-core/src/assistant-sculpt.ts", "ASSISTANT_SCULPT_REFUSALS", Object.values(ASSISTANT_SCULPT_REFUSALS)],
    ["packages/schemas/src/editor-command-registry.ts", "EDITOR_COMMAND_REFUSALS", Object.values(EDITOR_COMMAND_REFUSALS)],
    ["desktop/linux/src/lib/bridge-contract.ts", "DESKTOP_BRIDGE_REFUSALS", Object.values(DESKTOP_BRIDGE_REFUSALS)],
    ["apps/desktop-shell/src/product-loop.ts", "DESKTOP_PRODUCT_REFUSALS", Object.values(DESKTOP_PRODUCT_REFUSALS)],
    ["packages/cli/src/held-keys/gate.ts", "HELD_KEY_REFUSAL_REASONS", HELD_KEY_REFUSAL_REASONS],
  ] as const;
  for (const [, symbol, values] of registries) assertRegistry(values, symbol);

  return {
    schemaVersion: 1,
    cliVerbs: cliVerbPaths(),
    heldKeyEntries: SHIPPED_COMMAND_MAP.commands.map((entry) => ({
      command: entry.command,
      heldKeys: [...entry.heldKeys],
    })),
    editorCommands: EDITOR_COMMAND_REGISTRY.map((command) => command.id),
    desktopControls: desktopControlIds(),
    bridgeActions: [...DESKTOP_BRIDGE_ACTIONS],
    authoringOperations: [...DESKTOP_BRIDGE_AUTHORING_OPS],
    assistantOperations: [...DESKTOP_BRIDGE_ASSISTANT_OPS],
    localAgentTools: DESKTOP_LOCAL_BRIDGE_TOOLS.map((tool) => tool.name),
    refusalRegistries: registries.map(([path, symbol]) => ({ path, symbol })),
  };
}
