/**
 * Plugin Host public result types — machine-readable refusals (ADR 0005).
 */

import type { PluginManifest } from "@sceneaxi/schemas";

/** Exact Plugin Host API version advertised to manifests via hostApi ranges. */
export const PLUGIN_HOST_API_VERSION = "1.0.0" as const;

/**
 * Stable refusal reason codes. Callers branch on `reason`, never free text.
 * Message text is diagnostic only.
 */
export type PluginRefusalReason =
  | "descriptor-missing"
  | "descriptor-unreadable"
  | "descriptor-invalid"
  | "schema-version-unsupported"
  | "host-api-incompatible"
  | "registry-version-mismatch"
  | "duplicate-plugin-id"
  | "unknown-capability"
  | "entrypoint-escape"
  | "entrypoint-missing"
  | "forbidden-sceneaxi-import"
  | "isolation-unverifiable"
  | "entrypoint-evaluation-failed"
  | "implementation-table-mismatch"
  | "capability-contract-violation";

export type PluginHostLoadPhase =
  | "descriptor"
  | "isolation"
  | "evaluation"
  | "integrity";

export type RefusedPlugin = {
  readonly locator: string;
  readonly reason: PluginRefusalReason;
  readonly phase: PluginHostLoadPhase;
  readonly message: string;
  readonly pluginId?: string;
  readonly pluginVersion?: string;
  readonly capabilityId?: string;
  /** True when the entrypoint module was intentionally evaluated. */
  readonly entrypointEvaluated: boolean;
};

export type LoadedPlugin = {
  readonly locator: string;
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly capabilities: readonly string[];
  readonly manifest: PluginManifest;
};

export type PluginHostLoadResult = {
  readonly loaded: readonly LoadedPlugin[];
  readonly refused: readonly RefusedPlugin[];
};

export type PluginHostListing = {
  readonly loaded: readonly LoadedPlugin[];
  readonly refused: readonly RefusedPlugin[];
};

export type PluginCapabilityImplementationHit = {
  readonly ok: true;
  readonly pluginId: string;
  readonly capabilityId: string;
  readonly implementation: unknown;
};

export type PluginCapabilityImplementationMiss = {
  readonly ok: false;
  readonly pluginId: string;
  readonly capabilityId: string;
  readonly reason:
    | "plugin-not-loaded"
    | "capability-not-implemented"
    | "not-addressable";
  readonly message: string;
};

export type PluginCapabilityImplementationResult =
  | PluginCapabilityImplementationHit
  | PluginCapabilityImplementationMiss;

/** Module shape required from a plugin package entrypoint. */
export type PluginEntrypointModule = {
  readonly capabilities: Readonly<Record<string, unknown>>;
};

export type CapabilityContractCheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/**
 * Structural check of one capability implementation against the public contract
 * that owns its registered ID.
 *
 * Checks are injected, never discovered: the host holds no domain knowledge and
 * imports no contract-owning module beyond `@sceneaxi/schemas` vocabulary. A
 * capability with no injected check still loads — the check narrows what is
 * accepted, it never widens what may run.
 */
export type CapabilityContractCheck = (
  implementation: unknown,
) => CapabilityContractCheckResult;

/** Injected checks keyed by registered capability ID. */
export type CapabilityContractChecks = ReadonlyMap<
  string,
  CapabilityContractCheck
>;
