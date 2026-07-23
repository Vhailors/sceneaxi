/**
 * @sceneaxi/plugin-host — deterministic capability-manifest Plugin Host (ADR 0005).
 *
 * Public seam: open / load / list / getImplementation.
 * Consumes only public contracts from @sceneaxi/schemas.
 * Never imports engine packages or receives an engine service locator.
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/plugin-host",
  releaseGroup: "plugin-host",
});

export {
  openPluginHost,
  type PluginHost,
  type PluginHostOptions,
} from "./host.js";

export {
  PLUGIN_HOST_API_VERSION,
  type LoadedPlugin,
  type PluginCapabilityImplementationHit,
  type PluginCapabilityImplementationMiss,
  type PluginCapabilityImplementationResult,
  type PluginEntrypointModule,
  type PluginHostListing,
  type PluginHostLoadPhase,
  type PluginHostLoadResult,
  type PluginRefusalReason,
  type RefusedPlugin,
} from "./types.js";

export { hostApiSatisfied } from "./host-api-range.js";
