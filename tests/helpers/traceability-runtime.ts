import * as auth from "../../packages/auth/src/index.js";
import * as authBetterAuthAdapter from "../../packages/auth/src/better-auth-adapter.js";
import * as authoringCore from "../../packages/authoring-core/src/index.js";
import * as authoringModelProvider from "../../packages/authoring-core/src/model-provider-port.js";
import * as billing from "../../packages/billing/src/index.js";
import * as cli from "../../packages/cli/src/index.js";
import type { CommandNode } from "../../packages/cli/src/commands.js";
import * as engineKernel from "../../packages/engine-kernel/src/index.js";
import * as engineOrchestrator from "../../packages/engine-orchestrator/src/index.js";
import * as enginePresentation from "../../packages/engine-presentation/src/index.js";
import * as importers from "../../packages/importers/src/index.js";
import * as pluginHost from "../../packages/plugin-host/src/index.js";
import * as profileGame from "../../packages/profile-game/src/index.js";
import * as profileKids from "../../packages/profile-kids/src/index.js";
import * as profileWeb from "../../packages/profile-web/src/index.js";
import * as providerOpenrouter from "../../packages/provider-openrouter/src/index.js";
import * as schemas from "../../packages/schemas/src/index.js";
import * as siteKit from "../../packages/site-kit/src/index.js";
import * as catalogGame from "../../apps/catalog-game/src/index.js";
import * as catalogWeb from "../../apps/catalog-web/src/index.js";
import * as desktopShell from "../../apps/desktop-shell/src/index.js";
import * as webShell from "../../apps/web-shell/src/index.js";
import * as desktopLinux from "../../desktop/linux/src/index.js";
import * as desktopElectronProviderKeyStore from "../../desktop/linux/src/electron/provider-key-store.js";
import * as desktopProviderRuntime from "../../desktop/linux/src/electron/provider-runtime.js";
import * as desktopProviderKeyStore from "../../desktop/linux/src/lib/provider-key-store.js";
import * as desktopMacos from "../../desktop/macos/src/index.js";
import * as desktopWindows from "../../desktop/windows/src/index.js";
import * as siteCatalogGame from "../../sites/catalog-game/src/index.js";
import * as siteCatalogWeb from "../../sites/catalog-web/src/index.js";
import * as siteKids from "../../sites/kids/src/index.js";
import * as siteUmbrella from "../../sites/umbrella/src/index.js";
import * as siteProviderAdapters from "../../sites/umbrella/src/lib/provider-adapters.js";
import * as betterAuthProviderRefusals from "../../sites/umbrella/src/provider/better-auth-provider-refusals.js";

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
  providerEntrypoints: readonly string[];
  refusalRegistries: readonly Readonly<{ path: string; symbol: string }>[];
}>;

const PUBLIC_MODULES = Object.freeze([
  { path: "packages/schemas/src/index.ts", exports: schemas },
  { path: "packages/engine-kernel/src/index.ts", exports: engineKernel },
  { path: "packages/engine-presentation/src/index.ts", exports: enginePresentation },
  { path: "packages/engine-orchestrator/src/index.ts", exports: engineOrchestrator },
  { path: "packages/authoring-core/src/index.ts", exports: authoringCore },
  { path: "packages/profile-game/src/index.ts", exports: profileGame },
  { path: "packages/profile-web/src/index.ts", exports: profileWeb },
  { path: "packages/profile-kids/src/index.ts", exports: profileKids },
  { path: "packages/cli/src/index.ts", exports: cli },
  { path: "packages/importers/src/index.ts", exports: importers },
  { path: "packages/provider-openrouter/src/index.ts", exports: providerOpenrouter },
  { path: "packages/plugin-host/src/index.ts", exports: pluginHost },
  { path: "packages/auth/src/index.ts", exports: auth },
  { path: "packages/billing/src/index.ts", exports: billing },
  { path: "apps/web-shell/src/index.ts", exports: webShell },
  { path: "apps/desktop-shell/src/index.ts", exports: desktopShell },
  { path: "apps/catalog-game/src/index.ts", exports: catalogGame },
  { path: "apps/catalog-web/src/index.ts", exports: catalogWeb },
  { path: "packages/site-kit/src/index.ts", exports: siteKit },
  { path: "sites/umbrella/src/index.ts", exports: siteUmbrella },
  { path: "sites/catalog-game/src/index.ts", exports: siteCatalogGame },
  { path: "sites/catalog-web/src/index.ts", exports: siteCatalogWeb },
  { path: "sites/kids/src/index.ts", exports: siteKids },
  { path: "desktop/linux/src/index.ts", exports: desktopLinux },
  { path: "desktop/windows/src/index.ts", exports: desktopWindows },
  { path: "desktop/macos/src/index.ts", exports: desktopMacos },
] as const);

const PROVIDER_SAFE_MODULES = Object.freeze([
  {
    path: "sites/umbrella/src/provider/better-auth-provider-refusals.ts",
    exports: betterAuthProviderRefusals,
  },
] as const);

const REFUSAL_REGISTRY_NAME = /(?:_REFUSALS|_REFUSE_REASONS|_REFUSAL_REASONS|_REFUSE_CODES|_ERROR_CODES)$/;
const REFUSAL_REGISTRY_CATALOG = "SCENEAXI_REFUSAL_REGISTRY_CATALOG";
const PROVIDER_ENTRYPOINT_CATALOG = "SCENEAXI_PROVIDER_ENTRYPOINT_CATALOG";

const PROVIDER_MODULES = Object.freeze([
  authBetterAuthAdapter,
  authoringModelProvider,
  providerOpenrouter,
  siteProviderAdapters,
  desktopProviderRuntime,
  desktopElectronProviderKeyStore,
  desktopProviderKeyStore,
] as const);

export function traceabilityPublicModulePaths(): string[] {
  return PUBLIC_MODULES.map((module) => module.path).sort();
}

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
  visit(cli.ROOT_COMMANDS, []);
  return paths;
}

function desktopControlIds(): string[] {
  const ids = new Set<string>();
  for (const mode of desktopShell.DESKTOP_MODE_IDS) {
    for (const profile of desktopShell.DESKTOP_PROFILE_IDS) {
      const states = [
        desktopShell.createDesktopVisualState({ mode, profile }),
        desktopShell.createDesktopVisualState({ mode, profile, assistantRuntime: "local" }),
        desktopShell.createDesktopVisualState({ mode, profile, overlay: "palette" }),
      ];
      for (const state of states) {
        for (const control of desktopShell.desktopVisualView(state).controls) ids.add(control.id);
      }
    }
  }
  return [...ids].sort();
}

function assertRegistry(value: unknown, symbol: string): void {
  const values = Array.isArray(value)
    ? value
    : typeof value === "object" && value !== null
      ? Object.values(value)
      : [];
  if (values.length === 0 || values.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    throw new Error(`${symbol} is not a non-empty string refusal registry`);
  }
}

function providerEntrypoints(): string[] {
  const paths = new Set<string>();
  for (const module of PROVIDER_MODULES) {
    const catalog = (module as Record<string, unknown>)[PROVIDER_ENTRYPOINT_CATALOG];
    if (typeof catalog !== "object" || catalog === null || Array.isArray(catalog)) {
      throw new Error("provider module has no executable entrypoint catalog");
    }
    for (const [path, witness] of Object.entries(catalog)) {
      if (typeof witness !== "function" && (typeof witness !== "object" || witness === null)) {
        throw new Error(`${path} has no executable provider witness`);
      }
      if (paths.has(path)) throw new Error(`duplicate executable provider entrypoint ${path}`);
      paths.add(path);
    }
  }
  return [...paths].sort();
}

function catalogRegistry(value: unknown):
  | Readonly<{ registry: unknown; values: unknown }>
  | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !Object.hasOwn(value, "registry") ||
    !Object.hasOwn(value, "values")
  ) return undefined;
  const descriptor = value as Readonly<{ registry: unknown; values: unknown }>;
  return descriptor;
}

function moduleRefusalRegistries(module: {
  path: string;
  exports: object;
}): Array<{ path: string; symbol: string }> {
  const exported = module.exports as Record<string, unknown>;
  const symbols = new Set(
    Object.keys(exported).filter((symbol) => REFUSAL_REGISTRY_NAME.test(symbol)),
  );
  const catalogValues = new Map<string, unknown>();
  const catalog = exported[REFUSAL_REGISTRY_CATALOG];
  if (catalog !== undefined) {
    if (typeof catalog !== "object" || catalog === null || Array.isArray(catalog)) {
      throw new Error(`${module.path} has an invalid refusal registry catalog`);
    }
    for (const [symbol, value] of Object.entries(catalog)) {
      const descriptor = catalogRegistry(value);
      const registry = descriptor?.registry ?? value;
      const values = descriptor?.values ?? value;
      if (exported[symbol] !== registry) {
        throw new Error(`${module.path} catalog entry ${symbol} is not its live public export`);
      }
      assertRegistry(values, symbol);
      catalogValues.set(symbol, values);
      symbols.add(symbol);
    }
  }
  return [...symbols].map((symbol) => {
    if (!catalogValues.has(symbol)) assertRegistry(exported[symbol], symbol);
    return { path: module.path, symbol };
  });
}

function refusalRegistries(): Array<{ path: string; symbol: string }> {
  return [...PUBLIC_MODULES, ...PROVIDER_SAFE_MODULES].flatMap(
    moduleRefusalRegistries,
  ).sort((left, right) =>
    `${left.path}#${left.symbol}`.localeCompare(`${right.path}#${right.symbol}`),
  );
}

export function traceabilityRuntimeSurfaces(): TraceabilityRuntimeSurfaces {
  return {
    schemaVersion: 1,
    cliVerbs: cliVerbPaths(),
    heldKeyEntries: cli.SHIPPED_COMMAND_MAP.commands.map((entry) => ({
      command: entry.command,
      heldKeys: [...entry.heldKeys],
    })),
    editorCommands: schemas.EDITOR_COMMAND_REGISTRY.map((command) => command.id),
    desktopControls: desktopControlIds(),
    bridgeActions: [...desktopLinux.DESKTOP_BRIDGE_ACTIONS],
    authoringOperations: [...desktopLinux.DESKTOP_BRIDGE_AUTHORING_OPS],
    assistantOperations: [...desktopLinux.DESKTOP_BRIDGE_ASSISTANT_OPS],
    localAgentTools: schemas.DESKTOP_LOCAL_BRIDGE_TOOLS.map((tool) => tool.name),
    providerEntrypoints: providerEntrypoints(),
    refusalRegistries: refusalRegistries(),
  };
}
