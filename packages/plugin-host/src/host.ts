/**
 * Plugin Host session — load / list / explicit implementation lookup.
 */

import {
  pluginCapabilityRegistrySeed,
  type PluginCapabilityRegistry,
} from "@sceneaxi/schemas";
import {
  loadPluginCandidates,
  type InternalLoadedPlugin,
} from "./pipeline.js";
import type {
  CapabilityContractChecks,
  PluginCapabilityImplementationResult,
  PluginHostListing,
  PluginHostLoadResult,
} from "./types.js";
import { PLUGIN_HOST_API_VERSION } from "./types.js";

export type PluginHostOptions = {
  /**
   * Exact capability registry document. Defaults to the checked-in v1 seed.
   * Host never invents capability IDs.
   */
  readonly registry?: PluginCapabilityRegistry;
  /** Override advertised host API version (tests only). Defaults to 1.0.0. */
  readonly hostApiVersion?: string;
  /**
   * Injected per-capability contract checks, keyed by registered capability ID.
   * An implementation that fails its check refuses with
   * `capability-contract-violation` and exposes nothing.
   */
  readonly capabilityContracts?: CapabilityContractChecks;
};

export type PluginHost = {
  /**
   * Process an explicit set of package-root locators.
   * Replaces any previous load set. No filesystem/environment/dependency scanning.
   */
  readonly load: (
    locators: readonly string[],
  ) => Promise<PluginHostLoadResult>;
  /** Deterministic loaded + refused listings from the last load. */
  readonly list: () => PluginHostListing;
  /**
   * Address one capability implementation by (pluginId, capabilityId).
   * Multiple providers coexist; the host never selects an implicit default.
   */
  readonly getImplementation: (
    pluginId: string,
    capabilityId: string,
  ) => PluginCapabilityImplementationResult;
  /** Host API version advertised for hostApi range checks. */
  readonly hostApiVersion: string;
  /** Bound registry document (exact version). */
  readonly registry: PluginCapabilityRegistry;
};

/**
 * Open a Plugin Host bound to a capability registry.
 * Does not discover plugins; callers pass explicit locators to `load`.
 */
export function openPluginHost(options: PluginHostOptions = {}): PluginHost {
  const registry = options.registry ?? pluginCapabilityRegistrySeed();
  const hostApiVersion = options.hostApiVersion ?? PLUGIN_HOST_API_VERSION;
  const capabilityContracts: CapabilityContractChecks =
    options.capabilityContracts ?? new Map();

  let lastResult: PluginHostLoadResult = {
    loaded: Object.freeze([]),
    refused: Object.freeze([]),
  };
  let internals: readonly InternalLoadedPlugin[] = Object.freeze([]);

  return {
    hostApiVersion,
    registry,
    async load(locators: readonly string[]): Promise<PluginHostLoadResult> {
      const outcome = await loadPluginCandidates({
        locators,
        registry,
        hostApiVersion,
        capabilityContracts,
      });
      lastResult = outcome.result;
      internals = outcome.internals;
      return lastResult;
    },
    list(): PluginHostListing {
      return {
        loaded: lastResult.loaded,
        refused: lastResult.refused,
      };
    },
    getImplementation(
      pluginId: string,
      capabilityId: string,
    ): PluginCapabilityImplementationResult {
      const matches = internals.filter((p) => p.pluginId === pluginId);
      if (matches.length === 0) {
        return {
          ok: false,
          pluginId,
          capabilityId,
          reason: "plugin-not-loaded",
          message: `No loaded plugin with pluginId "${pluginId}".`,
        };
      }
      // Multiple versions of the same pluginId cannot coexist in one load set
      // (duplicate-plugin-id refuses). Still fail closed if state is corrupt.
      if (matches.length !== 1) {
        return {
          ok: false,
          pluginId,
          capabilityId,
          reason: "not-addressable",
          message: `pluginId "${pluginId}" is not uniquely addressable in the load set.`,
        };
      }
      const plugin = matches[0];
      if (plugin === undefined) {
        return {
          ok: false,
          pluginId,
          capabilityId,
          reason: "plugin-not-loaded",
          message: `No loaded plugin with pluginId "${pluginId}".`,
        };
      }
      if (!plugin.implementations.has(capabilityId)) {
        return {
          ok: false,
          pluginId,
          capabilityId,
          reason: "capability-not-implemented",
          message: `Loaded plugin "${pluginId}" does not implement capability "${capabilityId}".`,
        };
      }
      return {
        ok: true,
        pluginId,
        capabilityId,
        implementation: plugin.implementations.get(capabilityId),
      };
    },
  };
}
