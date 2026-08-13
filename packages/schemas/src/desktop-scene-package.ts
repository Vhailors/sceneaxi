/**
 * Contained package lock: discovery reads declared metadata only.
 * Install and removal are reviewable catalog mutations. Unapproved packages
 * are never executed.
 */
import { digestSculptJson } from "./sculpt-json.js";

export const SCENE_PACKAGE_SCHEMA_VERSION = 1 as const;
export const SCENE_PACKAGE_CATALOG_KIND = "sceneaxi.scene-package-catalog" as const;
export const SCENE_PACKAGE_CATALOG_KEY = "scenePackages" as const;

export const SCENE_PACKAGE_REFUSALS = Object.freeze({
  catalogInvalid: "PACKAGE_CATALOG_INVALID",
  compatibility: "PACKAGE_COMPATIBILITY",
  capabilityMissing: "PACKAGE_CAPABILITY_MISSING",
  integrity: "PACKAGE_INTEGRITY",
  dependencyCycle: "PACKAGE_DEPENDENCY_CYCLE",
  sourceUnavailable: "PACKAGE_SOURCE_UNAVAILABLE",
  kidsDenied: "PACKAGE_KIDS_DENIED",
  staleVersion: "PACKAGE_STALE_VERSION",
  inputUnsupported: "PACKAGE_INPUT_UNSUPPORTED",
  notInstalled: "PACKAGE_NOT_INSTALLED",
} as const);

export type ScenePackageRefusal =
  (typeof SCENE_PACKAGE_REFUSALS)[keyof typeof SCENE_PACKAGE_REFUSALS];

export type ScenePackageDiscovery = Readonly<{
  packageId: string;
  version: string;
  digest: string;
  sourceLocator: string;
  capabilities: readonly string[];
  executed: false;
}>;

export type ScenePackageLockEntry = Readonly<{
  packageId: string;
  version: string;
  digest: string;
  sourceLocator: string;
  capabilities: readonly string[];
}>;

export type ScenePackageCatalog = Readonly<{
  schemaVersion: typeof SCENE_PACKAGE_SCHEMA_VERSION;
  kind: typeof SCENE_PACKAGE_CATALOG_KIND;
  lock: readonly ScenePackageLockEntry[];
}>;

export type ScenePackageInspection = Readonly<{
  schemaVersion: typeof SCENE_PACKAGE_SCHEMA_VERSION;
  kind: "sceneaxi.scene-package-inspection";
  catalog: ScenePackageCatalog;
  discovered: readonly ScenePackageDiscovery[];
  savedBytesWritten: false;
  marketplace: false;
  networking: false;
}>;

type Failure = Readonly<{ ok: false; reason: ScenePackageRefusal; message: string }>;
const fail = (reason: ScenePackageRefusal, message: string): Failure =>
  Object.freeze({ ok: false as const, reason, message });

export function emptyScenePackageCatalog(): ScenePackageCatalog {
  return Object.freeze({
    schemaVersion: 1,
    kind: SCENE_PACKAGE_CATALOG_KIND,
    lock: Object.freeze([]),
  });
}

export function parseScenePackageCatalog(value: unknown): ScenePackageCatalog | null {
  if (value === undefined || value === null) return emptyScenePackageCatalog();
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record["schemaVersion"] !== 1 || record["kind"] !== SCENE_PACKAGE_CATALOG_KIND) {
    return null;
  }
  return value as ScenePackageCatalog;
}

export function discoverScenePackage(input: Readonly<{
  locator: string;
  manifest: unknown;
  digest: string;
  admittedCapabilities: readonly string[];
}>):
  | Readonly<{ ok: true; discovery: ScenePackageDiscovery }>
  | Failure {
  if (typeof input.locator !== "string" || input.locator.length === 0 || input.locator.includes("://")) {
    return fail(SCENE_PACKAGE_REFUSALS.sourceUnavailable, "Package discovery accepts only a contained locator.");
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(input.digest)) {
    return fail(SCENE_PACKAGE_REFUSALS.integrity, "Discovered package metadata must name a sha256 digest.");
  }
  if (typeof input.manifest !== "object" || input.manifest === null || Array.isArray(input.manifest)) {
    return fail(SCENE_PACKAGE_REFUSALS.sourceUnavailable, "Package discovery reads declared metadata only.");
  }
  const manifest = input.manifest as Record<string, unknown>;
  if (
    typeof manifest["pluginId"] !== "string" ||
    manifest["pluginId"].length === 0 ||
    manifest["pluginId"].includes("/") ||
    manifest["pluginId"].includes("\\")
  ) {
    return fail(SCENE_PACKAGE_REFUSALS.compatibility, "A discovered package requires a declared pluginId.");
  }
  if (typeof manifest["pluginVersion"] !== "string" || manifest["pluginVersion"].length === 0) {
    return fail(SCENE_PACKAGE_REFUSALS.compatibility, "A discovered package requires a pinned pluginVersion.");
  }
  const capabilities = Array.isArray(manifest["capabilities"])
    ? manifest["capabilities"].filter((capability): capability is string => typeof capability === "string")
    : [];
  const unknown = capabilities.filter((capability) => !input.admittedCapabilities.includes(capability));
  if (unknown.length > 0) {
    return fail(
      SCENE_PACKAGE_REFUSALS.capabilityMissing,
      `Capability "${unknown[0] ?? ""}" is not in the reviewed registry.`,
    );
  }
  return Object.freeze({
    ok: true as const,
    discovery: Object.freeze({
      packageId: String(manifest["pluginId"]),
      version: String(manifest["pluginVersion"]),
      digest: input.digest,
      sourceLocator: input.locator,
      capabilities: Object.freeze(capabilities),
      executed: false as const,
    }),
  });
}

export type ScenePackageMutation =
  | Readonly<{ kind: "install"; discovery: ScenePackageDiscovery; dependsOn?: readonly string[] }>
  | Readonly<{ kind: "remove"; packageId: string }>;

export function applyScenePackageMutation(input: Readonly<{
  catalog: ScenePackageCatalog;
  mutation: ScenePackageMutation;
  profile: unknown;
}>):
  | Readonly<{ ok: true; catalog: ScenePackageCatalog }>
  | Failure {
  if (input.profile === "@sceneaxi/profile-kids" || input.profile === "kids") {
    return fail(SCENE_PACKAGE_REFUSALS.kidsDenied, "Package install and removal are denied for Kids before project I/O.");
  }
  const mutation = input.mutation;
  if (mutation.kind === "remove") {
    if (!input.catalog.lock.some((entry) => entry.packageId === mutation.packageId)) {
      return fail(SCENE_PACKAGE_REFUSALS.notInstalled, `Package "${mutation.packageId}" is not in the lock.`);
    }
    return Object.freeze({
      ok: true as const,
      catalog: Object.freeze({
        ...input.catalog,
        lock: Object.freeze(input.catalog.lock.filter((entry) => entry.packageId !== mutation.packageId)),
      }),
    });
  }
  const discovery = mutation.discovery;
  if (discovery.executed !== false) {
    return fail(SCENE_PACKAGE_REFUSALS.integrity, "An unapproved package cannot be executed during install.");
  }
  if (mutation.dependsOn?.includes(discovery.packageId)) {
    return fail(SCENE_PACKAGE_REFUSALS.dependencyCycle, "A package cannot depend on itself.");
  }
  if ((mutation.dependsOn ?? []).some((dependency) => !input.catalog.lock.some((entry) => entry.packageId === dependency))) {
    return fail(SCENE_PACKAGE_REFUSALS.dependencyCycle, "Install requires every declared dependency to already be locked.");
  }
  const entry: ScenePackageLockEntry = Object.freeze({
    packageId: discovery.packageId,
    version: discovery.version,
    digest: discovery.digest,
    sourceLocator: discovery.sourceLocator,
    capabilities: discovery.capabilities,
  });
  return Object.freeze({
    ok: true as const,
    catalog: Object.freeze({
      ...input.catalog,
      lock: Object.freeze([
        ...input.catalog.lock.filter((candidate) => candidate.packageId !== entry.packageId),
        entry,
      ]),
    }),
  });
}

export function inspectScenePackages(input: Readonly<{
  catalog: ScenePackageCatalog;
  discovered?: readonly ScenePackageDiscovery[];
}>) {
  return Object.freeze({
    schemaVersion: 1,
    kind: "sceneaxi.scene-package-inspection" as const,
    catalog: input.catalog,
    discovered: Object.freeze([...(input.discovered ?? [])]),
    savedBytesWritten: false as const,
    marketplace: false as const,
    networking: false as const,
    lockDigest: digestSculptJson(input.catalog.lock),
  });
}
