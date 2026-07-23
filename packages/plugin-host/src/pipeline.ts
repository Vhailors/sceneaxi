/**
 * Deterministic Plugin Host load pipeline (ADR 0005).
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  PLUGIN_MANIFEST_PATH,
  PLUGIN_MANIFEST_SCHEMA_VERSION,
  lookupPluginCapability,
  parsePluginManifestText,
  type PluginCapabilityRegistry,
  type PluginManifest,
} from "@sceneaxi/schemas";
import { hostApiSatisfied } from "./host-api-range.js";
import {
  checkPackageIsolation,
  resolveEntrypointPath,
} from "./isolation.js";
import type {
  LoadedPlugin,
  PluginHostLoadResult,
  PluginRefusalReason,
  RefusedPlugin,
} from "./types.js";
import { PLUGIN_HOST_API_VERSION } from "./types.js";

export type InternalLoadedPlugin = LoadedPlugin & {
  readonly implementations: ReadonlyMap<string, unknown>;
};

function sortLocators(locators: readonly string[]): string[] {
  return [...locators].map((l) => resolve(l)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function sortLoaded(loaded: readonly LoadedPlugin[]): LoadedPlugin[] {
  return [...loaded].sort((a, b) => {
    if (a.pluginId !== b.pluginId) {
      return a.pluginId < b.pluginId ? -1 : 1;
    }
    if (a.pluginVersion !== b.pluginVersion) {
      return a.pluginVersion < b.pluginVersion ? -1 : 1;
    }
    const aCaps = a.capabilities.join("\0");
    const bCaps = b.capabilities.join("\0");
    return aCaps < bCaps ? -1 : aCaps > bCaps ? 1 : 0;
  });
}

function sortRefused(refused: readonly RefusedPlugin[]): RefusedPlugin[] {
  return [...refused].sort((a, b) =>
    a.locator < b.locator ? -1 : a.locator > b.locator ? 1 : 0,
  );
}

function refuse(partial: {
  locator: string;
  reason: PluginRefusalReason;
  phase: RefusedPlugin["phase"];
  message: string;
  pluginId?: string;
  pluginVersion?: string;
  capabilityId?: string;
  entrypointEvaluated: boolean;
}): RefusedPlugin {
  return {
    locator: partial.locator,
    reason: partial.reason,
    phase: partial.phase,
    message: partial.message,
    entrypointEvaluated: partial.entrypointEvaluated,
    ...(partial.pluginId !== undefined ? { pluginId: partial.pluginId } : {}),
    ...(partial.pluginVersion !== undefined
      ? { pluginVersion: partial.pluginVersion }
      : {}),
    ...(partial.capabilityId !== undefined
      ? { capabilityId: partial.capabilityId }
      : {}),
  };
}

function authorizedPackagesFor(
  manifest: PluginManifest,
  registry: PluginCapabilityRegistry,
): { ok: true; packages: Set<string> } | { ok: false; capabilityId: string } {
  const packages = new Set<string>();
  for (const capabilityId of manifest.capabilities) {
    const hit = lookupPluginCapability(registry, capabilityId);
    if (!hit.ok) {
      return { ok: false, capabilityId };
    }
    packages.add(hit.entry.owningPackage);
  }
  return { ok: true, packages };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function extractCapabilityTable(
  moduleNamespace: unknown,
):
  | { ok: true; table: Readonly<Record<string, unknown>> }
  | { ok: false; message: string } {
  if (!isRecord(moduleNamespace)) {
    return { ok: false, message: "Entrypoint module namespace is not an object." };
  }
  const direct = moduleNamespace["capabilities"];
  if (isRecord(direct)) {
    return { ok: true, table: direct };
  }
  const defaultExport = moduleNamespace["default"];
  if (isRecord(defaultExport) && isRecord(defaultExport["capabilities"])) {
    return { ok: true, table: defaultExport["capabilities"] };
  }
  return {
    ok: false,
    message:
      'Entrypoint must export a declarative "capabilities" table keyed by declared capability IDs.',
  };
}

function implementationKeysMatch(
  declared: readonly string[],
  table: Readonly<Record<string, unknown>>,
): boolean {
  const declaredSet = new Set(declared);
  const exportedKeys = Object.keys(table);
  if (exportedKeys.length !== declaredSet.size) return false;
  for (const key of exportedKeys) {
    if (!declaredSet.has(key)) return false;
  }
  for (const id of declaredSet) {
    if (!Object.hasOwn(table, id)) return false;
  }
  return true;
}

async function processCandidate(options: {
  readonly locator: string;
  readonly registry: PluginCapabilityRegistry;
  readonly hostApiVersion: string;
  readonly seenPluginIds: Set<string>;
}): Promise<
  | { ok: true; loaded: InternalLoadedPlugin }
  | { ok: false; refused: RefusedPlugin }
> {
  const { locator, registry, hostApiVersion, seenPluginIds } = options;
  const packageRoot = resolve(locator);

  if (!existsSync(packageRoot) || !statSync(packageRoot).isDirectory()) {
    return {
      ok: false,
      refused: refuse({
        locator: packageRoot,
        reason: "descriptor-missing",
        phase: "descriptor",
        message: `Plugin package root does not exist or is not a directory: ${packageRoot}`,
        entrypointEvaluated: false,
      }),
    };
  }

  const descriptorPath = join(packageRoot, PLUGIN_MANIFEST_PATH);
  if (!existsSync(descriptorPath) || !statSync(descriptorPath).isFile()) {
    return {
      ok: false,
      refused: refuse({
        locator: packageRoot,
        reason: "descriptor-missing",
        phase: "descriptor",
        message: `Missing descriptor at ${PLUGIN_MANIFEST_PATH}.`,
        entrypointEvaluated: false,
      }),
    };
  }

  let text: string;
  try {
    text = readFileSync(descriptorPath, "utf8");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "descriptor read failed";
    return {
      ok: false,
      refused: refuse({
        locator: packageRoot,
        reason: "descriptor-unreadable",
        phase: "descriptor",
        message: `Cannot read ${PLUGIN_MANIFEST_PATH}: ${message}`,
        entrypointEvaluated: false,
      }),
    };
  }

  const parsed = parsePluginManifestText(text);
  if (!parsed.ok) {
    const first = parsed.diagnostics[0];
    const schemaMismatch = parsed.diagnostics.some(
      (d) => d.code === "schema-version-mismatch",
    );
    return {
      ok: false,
      refused: refuse({
        locator: packageRoot,
        reason: schemaMismatch
          ? "schema-version-unsupported"
          : "descriptor-invalid",
        phase: "descriptor",
        message: first?.message ?? "Plugin manifest validation failed.",
        entrypointEvaluated: false,
      }),
    };
  }

  const manifest = parsed.manifest;

  // Defensive: parser already pins schemaVersion, but keep an explicit host gate.
  if (manifest.schemaVersion !== PLUGIN_MANIFEST_SCHEMA_VERSION) {
    return {
      ok: false,
      refused: refuse({
        locator: packageRoot,
        reason: "schema-version-unsupported",
        phase: "descriptor",
        message: `Unsupported schemaVersion ${manifest.schemaVersion}; host supports ${PLUGIN_MANIFEST_SCHEMA_VERSION}.`,
        pluginId: manifest.pluginId,
        pluginVersion: manifest.pluginVersion,
        entrypointEvaluated: false,
      }),
    };
  }

  if (!hostApiSatisfied(manifest.hostApi, hostApiVersion)) {
    return {
      ok: false,
      refused: refuse({
        locator: packageRoot,
        reason: "host-api-incompatible",
        phase: "descriptor",
        message: `hostApi range "${manifest.hostApi}" is not satisfied by host API ${hostApiVersion}.`,
        pluginId: manifest.pluginId,
        pluginVersion: manifest.pluginVersion,
        entrypointEvaluated: false,
      }),
    };
  }

  if (manifest.registryVersion !== registry.registryVersion) {
    return {
      ok: false,
      refused: refuse({
        locator: packageRoot,
        reason: "registry-version-mismatch",
        phase: "descriptor",
        message: `registryVersion ${manifest.registryVersion} does not match loaded registry ${registry.registryVersion}.`,
        pluginId: manifest.pluginId,
        pluginVersion: manifest.pluginVersion,
        entrypointEvaluated: false,
      }),
    };
  }

  if (seenPluginIds.has(manifest.pluginId)) {
    return {
      ok: false,
      refused: refuse({
        locator: packageRoot,
        reason: "duplicate-plugin-id",
        phase: "descriptor",
        message: `pluginId "${manifest.pluginId}" is repeated in the host load set.`,
        pluginId: manifest.pluginId,
        pluginVersion: manifest.pluginVersion,
        entrypointEvaluated: false,
      }),
    };
  }
  // Reserve identity for the remainder of this load set (even if later phases refuse).
  seenPluginIds.add(manifest.pluginId);

  for (const capabilityId of manifest.capabilities) {
    const lookup = lookupPluginCapability(registry, capabilityId);
    if (!lookup.ok) {
      return {
        ok: false,
        refused: refuse({
          locator: packageRoot,
          reason: "unknown-capability",
          phase: "descriptor",
          message: `Capability "${capabilityId}" is absent from registry ${registry.registryVersion}.`,
          pluginId: manifest.pluginId,
          pluginVersion: manifest.pluginVersion,
          capabilityId,
          entrypointEvaluated: false,
        }),
      };
    }
  }

  const entrypointResolved = resolveEntrypointPath(
    packageRoot,
    manifest.entrypoint,
  );
  if (!entrypointResolved.ok || entrypointResolved.absolutePath === undefined) {
    const failed =
      !entrypointResolved.ok
        ? entrypointResolved
        : {
            reason: "entrypoint-missing" as const,
            message: "Entrypoint path could not be resolved.",
          };
    return {
      ok: false,
      refused: refuse({
        locator: packageRoot,
        reason: failed.reason,
        phase: "isolation",
        message: failed.message,
        pluginId: manifest.pluginId,
        pluginVersion: manifest.pluginVersion,
        entrypointEvaluated: false,
      }),
    };
  }
  const entrypointAbsolute = entrypointResolved.absolutePath;

  const authorized = authorizedPackagesFor(manifest, registry);
  if (!authorized.ok) {
    return {
      ok: false,
      refused: refuse({
        locator: packageRoot,
        reason: "unknown-capability",
        phase: "descriptor",
        message: `Capability "${authorized.capabilityId}" is absent from registry ${registry.registryVersion}.`,
        pluginId: manifest.pluginId,
        pluginVersion: manifest.pluginVersion,
        capabilityId: authorized.capabilityId,
        entrypointEvaluated: false,
      }),
    };
  }

  const isolation = checkPackageIsolation({
    packageRoot,
    entrypointAbsolute,
    authorizedSceneaxiPackages: authorized.packages,
  });
  if (!isolation.ok) {
    return {
      ok: false,
      refused: refuse({
        locator: packageRoot,
        reason: isolation.reason,
        phase: "isolation",
        message: isolation.message,
        pluginId: manifest.pluginId,
        pluginVersion: manifest.pluginVersion,
        entrypointEvaluated: false,
      }),
    };
  }

  // Post-isolation: intentional evaluation.
  let moduleNamespace: unknown;
  try {
    const href = pathToFileURL(entrypointAbsolute).href;
    moduleNamespace = await import(href);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "entrypoint evaluation failed";
    return {
      ok: false,
      refused: refuse({
        locator: packageRoot,
        reason: "entrypoint-evaluation-failed",
        phase: "evaluation",
        message: `Entrypoint evaluation failed: ${message}`,
        pluginId: manifest.pluginId,
        pluginVersion: manifest.pluginVersion,
        entrypointEvaluated: true,
      }),
    };
  }

  const implementations = new Map<string, unknown>();
  try {
    const tableResult = extractCapabilityTable(moduleNamespace);
    if (!tableResult.ok) {
      return {
        ok: false,
        refused: refuse({
          locator: packageRoot,
          reason: "implementation-table-mismatch",
          phase: "integrity",
          message: tableResult.message,
          pluginId: manifest.pluginId,
          pluginVersion: manifest.pluginVersion,
          entrypointEvaluated: true,
        }),
      };
    }

    if (!implementationKeysMatch(manifest.capabilities, tableResult.table)) {
      return {
        ok: false,
        refused: refuse({
          locator: packageRoot,
          reason: "implementation-table-mismatch",
          phase: "integrity",
          message:
            "Exported capability implementation keys must equal the manifest capabilities set exactly.",
          pluginId: manifest.pluginId,
          pluginVersion: manifest.pluginVersion,
          entrypointEvaluated: true,
        }),
      };
    }

    for (const id of manifest.capabilities) {
      implementations.set(id, tableResult.table[id]);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "integrity inspection failed";
    return {
      ok: false,
      refused: refuse({
        locator: packageRoot,
        reason: "implementation-table-mismatch",
        phase: "integrity",
        message: `Capability implementation table inspection failed: ${message}`,
        pluginId: manifest.pluginId,
        pluginVersion: manifest.pluginVersion,
        entrypointEvaluated: true,
      }),
    };
  }

  const sortedCaps = [...manifest.capabilities].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );

  return {
    ok: true,
    loaded: {
      locator: packageRoot,
      pluginId: manifest.pluginId,
      pluginVersion: manifest.pluginVersion,
      capabilities: Object.freeze(sortedCaps),
      manifest,
      implementations,
    },
  };
}

export async function loadPluginCandidates(options: {
  readonly locators: readonly string[];
  readonly registry: PluginCapabilityRegistry;
  readonly hostApiVersion?: string;
}): Promise<{
  readonly result: PluginHostLoadResult;
  readonly internals: readonly InternalLoadedPlugin[];
}> {
  const hostApiVersion = options.hostApiVersion ?? PLUGIN_HOST_API_VERSION;
  const ordered = sortLocators(options.locators);
  const loaded: InternalLoadedPlugin[] = [];
  const refused: RefusedPlugin[] = [];
  const seenPluginIds = new Set<string>();

  for (const locator of ordered) {
    const outcome = await processCandidate({
      locator,
      registry: options.registry,
      hostApiVersion,
      seenPluginIds,
    });
    if (outcome.ok) {
      loaded.push(outcome.loaded);
    } else {
      refused.push(outcome.refused);
    }
  }

  const publicLoaded: LoadedPlugin[] = sortLoaded(
    loaded.map(
      ({ locator, pluginId, pluginVersion, capabilities, manifest }) => ({
        locator,
        pluginId,
        pluginVersion,
        capabilities,
        manifest,
      }),
    ),
  );

  return {
    result: {
      loaded: Object.freeze(publicLoaded),
      refused: Object.freeze(sortRefused(refused)),
    },
    internals: Object.freeze(sortLoaded(loaded) as InternalLoadedPlugin[]),
  };
}
