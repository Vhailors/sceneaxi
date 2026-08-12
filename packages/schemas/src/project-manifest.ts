/**
 * SceneAxi-native project manifest v1.
 *
 * The manifest is project-relative and browser-safe. Filesystem containment is
 * enforced by the authoring-core host after this structural contract succeeds.
 */
import { canonicalSculptJson, digestSculptJson } from "./sculpt-json.js";
import type { JsonObject, JsonValue, SceneDocument } from "./document.js";

export const PROJECT_MANIFEST_KIND = "sceneaxi.project-manifest" as const;
export const PROJECT_MANIFEST_SCHEMA_VERSION = 1 as const;
export const PROJECT_MANIFEST_PATH = "sceneaxi.project.json" as const;
export const PROJECT_FORMAT_VERSION = Object.freeze({ major: 1 as const, minor: 0 as const });
export const LEGACY_PROJECT_FORMAT_VERSION = Object.freeze({ major: 0 as const, minor: 0 as const });
export const PROJECT_MIGRATION_ID = "legacy-contained-v0-to-native-v1" as const;

export const PROJECT_CAPABILITIES = Object.freeze([
  "project.lifecycle",
  "project.inspect",
  "project.migrate",
  "authoring.change-review",
  "authoring.undo",
  "runtime.play",
  "delivery.export-web",
  "assistant.build.local",
  "assistant.build.byo",
  "assistant.agent.bounded",
  "assistant.progress",
  "assistant.cancel",
  "scene.compose",
  "asset.contained-gltf",
] as const);

export type ProjectCapability = (typeof PROJECT_CAPABILITIES)[number];

export const PROJECT_MANIFEST_DIAGNOSTICS = Object.freeze({
  malformed: "PROJECT_MANIFEST_MALFORMED",
  versionUnsupported: "PROJECT_MANIFEST_VERSION_UNSUPPORTED",
  migrationChainInvalid: "PROJECT_MIGRATION_CHAIN_INVALID",
  identityDuplicate: "PROJECT_IDENTITY_DUPLICATE",
  capabilityUndeclared: "PROJECT_CAPABILITY_UNDECLARED",
  pathTraversal: "PROJECT_PATH_TRAVERSAL",
  canonicalPathEscape: "PROJECT_CANONICAL_PATH_ESCAPE",
  sourceChanged: "PROJECT_MIGRATION_SOURCE_CHANGED",
  proposalRequired: "PROJECT_MIGRATION_PROPOSAL_REQUIRED",
  approvalRequired: "PROJECT_MIGRATION_APPROVAL_REQUIRED",
  approvalMismatch: "PROJECT_MIGRATION_APPROVAL_MISMATCH",
  recoveryInvalid: "PROJECT_MIGRATION_RECOVERY_INVALID",
  mutationConflict: "PROJECT_MIGRATION_MUTATION_CONFLICT",
  writeFailed: "PROJECT_MIGRATION_WRITE_FAILED",
} as const);

export type ProjectManifestDiagnosticCode =
  (typeof PROJECT_MANIFEST_DIAGNOSTICS)[keyof typeof PROJECT_MANIFEST_DIAGNOSTICS];

export type ProjectFormatVersion = Readonly<{ major: number; minor: number }>;

export type ProjectCapabilityGrant = Readonly<{
  id: ProjectCapability;
  version: 1;
}>;

export type ProjectObjectIdentity = Readonly<{
  id: string;
  kind: "scene-document";
  path: "scene.json";
  sourceId: string;
  capability: "authoring.change-review";
}>;

export type ProjectAssetIdentity = Readonly<{
  id: string;
  sourceId: string;
  path: string;
  mediaType: string;
  digest: string;
  capability: "asset.contained-gltf";
}>;

export type ProjectMigrationRecord = Readonly<{
  id: typeof PROJECT_MIGRATION_ID;
  fromVersion: Readonly<{ major: 0; minor: 0 }>;
  toVersion: Readonly<{ major: 1; minor: 0 }>;
  sourceDigest: string;
}>;

export type ProjectManifest = Readonly<{
  schemaVersion: typeof PROJECT_MANIFEST_SCHEMA_VERSION;
  kind: typeof PROJECT_MANIFEST_KIND;
  formatVersion: Readonly<{ major: 1; minor: 0 }>;
  projectId: string;
  capabilities: readonly ProjectCapabilityGrant[];
  objects: readonly ProjectObjectIdentity[];
  assets: readonly ProjectAssetIdentity[];
  migrations: readonly ProjectMigrationRecord[];
}>;

export type ProjectManifestDiagnostic = Readonly<{
  code: ProjectManifestDiagnosticCode;
  path: string;
  message: string;
}>;

export type ProjectManifestValidation =
  | Readonly<{ ok: true; manifest: ProjectManifest }>
  | Readonly<{ ok: false; diagnostic: ProjectManifestDiagnostic }>;

export type ProjectVersionCapabilityResult = Readonly<{
  schemaVersion: 1;
  kind: "sceneaxi.project-inspection";
  state: "legacy" | "native";
  formatVersion: ProjectFormatVersion;
  projectId: string | null;
  manifestPath: typeof PROJECT_MANIFEST_PATH;
  manifestDigest: string | null;
  capabilities: readonly ProjectCapabilityGrant[];
  migration: Readonly<{
    required: boolean;
    available: boolean;
    nextMigrationId: typeof PROJECT_MIGRATION_ID | null;
  }>;
}>;

const ID_RE = /^[a-z0-9][a-z0-9-]{0,95}$/;
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

function diagnostic(
  code: ProjectManifestDiagnosticCode,
  path: string,
  message: string,
): ProjectManifestValidation {
  return Object.freeze({
    ok: false as const,
    diagnostic: Object.freeze({ code, path, message }),
  });
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length &&
    [...keys].sort().every((key, index) => actual[index] === key);
}

export function isCanonicalProjectPath(path: string): boolean {
  if (path.length === 0 || path.includes("\0") || path.includes("\\") || path.startsWith("/")) {
    return false;
  }
  if (/^[a-zA-Z]:/.test(path)) return false;
  const segments = path.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function identity(prefix: "project" | "object" | "asset", input: JsonValue): string {
  return `${prefix}-${digestSculptJson(input).slice("sha256:".length, "sha256:".length + 24)}`;
}

export function deterministicProjectId(documentId: string): string {
  return identity("project", { kind: PROJECT_MANIFEST_KIND, documentId });
}

export function deterministicProjectObjectId(projectId: string, sourceId: string): string {
  return identity("object", { projectId, kind: "scene-document", sourceId });
}

export function deterministicProjectAssetId(projectId: string, sourceId: string): string {
  return identity("asset", { projectId, kind: "contained-asset", sourceId });
}

export function serializeProjectManifest(manifest: ProjectManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function projectManifestDigest(manifest: ProjectManifest): string {
  return digestSculptJson(manifest as unknown as JsonObject);
}

export function createProjectManifest(input: Readonly<{
  document: SceneDocument;
  assets?: readonly Readonly<{
    sourceId: string;
    path: string;
    mediaType: string;
    digest: string;
  }>[];
  migrationSourceDigest?: string;
}>): ProjectManifest {
  const projectId = deterministicProjectId(input.document.id);
  const capabilities = PROJECT_CAPABILITIES.map((id) => Object.freeze({ id, version: 1 as const }));
  const manifest: ProjectManifest = {
    schemaVersion: PROJECT_MANIFEST_SCHEMA_VERSION,
    kind: PROJECT_MANIFEST_KIND,
    formatVersion: PROJECT_FORMAT_VERSION,
    projectId,
    capabilities: Object.freeze(capabilities),
    objects: Object.freeze([Object.freeze({
      id: deterministicProjectObjectId(projectId, input.document.id),
      kind: "scene-document" as const,
      path: "scene.json" as const,
      sourceId: input.document.id,
      capability: "authoring.change-review" as const,
    })]),
    assets: Object.freeze((input.assets ?? []).map((asset) => Object.freeze({
      id: deterministicProjectAssetId(projectId, asset.sourceId),
      sourceId: asset.sourceId,
      path: asset.path,
      mediaType: asset.mediaType,
      digest: asset.digest,
      capability: "asset.contained-gltf" as const,
    })).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)),
    migrations: Object.freeze(input.migrationSourceDigest === undefined ? [] : [Object.freeze({
      id: PROJECT_MIGRATION_ID,
      fromVersion: LEGACY_PROJECT_FORMAT_VERSION,
      toVersion: PROJECT_FORMAT_VERSION,
      sourceDigest: input.migrationSourceDigest,
    })]),
  };
  const validated = validateProjectManifest(manifest);
  if (!validated.ok) throw new Error(`${validated.diagnostic.code}: ${validated.diagnostic.message}`);
  return validated.manifest;
}

export function validateProjectManifest(value: unknown): ProjectManifestValidation {
  if (!record(value) || !exactKeys(value, [
    "schemaVersion", "kind", "formatVersion", "projectId", "capabilities", "objects", "assets", "migrations",
  ])) {
    return diagnostic(PROJECT_MANIFEST_DIAGNOSTICS.malformed, "$", "Project manifest fields are invalid.");
  }
  if (value["schemaVersion"] !== PROJECT_MANIFEST_SCHEMA_VERSION || value["kind"] !== PROJECT_MANIFEST_KIND) {
    return diagnostic(PROJECT_MANIFEST_DIAGNOSTICS.malformed, "$", "Project manifest header is invalid.");
  }
  const version = value["formatVersion"];
  if (!record(version) || !exactKeys(version, ["major", "minor"]) ||
    !Number.isInteger(version["major"]) || !Number.isInteger(version["minor"])) {
    return diagnostic(PROJECT_MANIFEST_DIAGNOSTICS.malformed, "$.formatVersion", "Project format version is invalid.");
  }
  if (version["major"] !== PROJECT_FORMAT_VERSION.major) {
    return diagnostic(
      PROJECT_MANIFEST_DIAGNOSTICS.versionUnsupported,
      "$.formatVersion.major",
      `Project format major ${String(version["major"])} is unsupported.`,
    );
  }
  if (version["minor"] !== PROJECT_FORMAT_VERSION.minor ||
    typeof value["projectId"] !== "string" || !ID_RE.test(value["projectId"])) {
    return diagnostic(PROJECT_MANIFEST_DIAGNOSTICS.malformed, "$.formatVersion", "Project format minor or project identity is invalid.");
  }

  const rawCapabilities = value["capabilities"];
  if (!Array.isArray(rawCapabilities)) {
    return diagnostic(PROJECT_MANIFEST_DIAGNOSTICS.malformed, "$.capabilities", "Capability grants must be an array.");
  }
  const capabilities: ProjectCapabilityGrant[] = [];
  const capabilityIds = new Set<string>();
  for (let index = 0; index < rawCapabilities.length; index += 1) {
    const grant = rawCapabilities[index];
    if (!record(grant) || !exactKeys(grant, ["id", "version"]) || grant["version"] !== 1 ||
      typeof grant["id"] !== "string" || !(PROJECT_CAPABILITIES as readonly string[]).includes(grant["id"])) {
      return diagnostic(PROJECT_MANIFEST_DIAGNOSTICS.capabilityUndeclared, `$.capabilities[${index}]`, "The manifest grants an undeclared capability.");
    }
    if (capabilityIds.has(grant["id"])) {
      return diagnostic(PROJECT_MANIFEST_DIAGNOSTICS.identityDuplicate, `$.capabilities[${index}].id`, "Capability identities must be unique.");
    }
    capabilityIds.add(grant["id"]);
    capabilities.push(Object.freeze({ id: grant["id"] as ProjectCapability, version: 1 }));
  }

  const projectId = value["projectId"];
  const identities = new Set<string>();
  const paths = new Set<string>();
  const rawObjects = value["objects"];
  if (!Array.isArray(rawObjects) || rawObjects.length === 0) {
    return diagnostic(PROJECT_MANIFEST_DIAGNOSTICS.malformed, "$.objects", "At least one project object is required.");
  }
  const objects: ProjectObjectIdentity[] = [];
  for (let index = 0; index < rawObjects.length; index += 1) {
    const object = rawObjects[index];
    if (!record(object) || !exactKeys(object, ["id", "kind", "path", "sourceId", "capability"]) ||
      object["kind"] !== "scene-document" || object["path"] !== "scene.json" ||
      object["capability"] !== "authoring.change-review" ||
      typeof object["sourceId"] !== "string" || !ID_RE.test(object["sourceId"]) ||
      typeof object["id"] !== "string" || object["id"] !== deterministicProjectObjectId(projectId, object["sourceId"])) {
      return diagnostic(PROJECT_MANIFEST_DIAGNOSTICS.malformed, `$.objects[${index}]`, "Project object identity is invalid or non-deterministic.");
    }
    if (!capabilityIds.has(object["capability"])) {
      return diagnostic(PROJECT_MANIFEST_DIAGNOSTICS.capabilityUndeclared, `$.objects[${index}].capability`, "Project object capability is not granted.");
    }
    if (identities.has(object["id"]) || paths.has(object["path"])) {
      return diagnostic(PROJECT_MANIFEST_DIAGNOSTICS.identityDuplicate, `$.objects[${index}]`, "Project object identities and paths must be unique.");
    }
    identities.add(object["id"]);
    paths.add(object["path"]);
    objects.push(Object.freeze(object as unknown as ProjectObjectIdentity));
  }

  const rawAssets = value["assets"];
  if (!Array.isArray(rawAssets)) {
    return diagnostic(PROJECT_MANIFEST_DIAGNOSTICS.malformed, "$.assets", "Project assets must be an array.");
  }
  const assets: ProjectAssetIdentity[] = [];
  for (let index = 0; index < rawAssets.length; index += 1) {
    const asset = rawAssets[index];
    if (!record(asset) || !exactKeys(asset, ["id", "sourceId", "path", "mediaType", "digest", "capability"]) ||
      typeof asset["sourceId"] !== "string" || !ID_RE.test(asset["sourceId"]) ||
      typeof asset["id"] !== "string" || asset["id"] !== deterministicProjectAssetId(projectId, asset["sourceId"]) ||
      typeof asset["path"] !== "string" || typeof asset["mediaType"] !== "string" || asset["mediaType"].length === 0 ||
      typeof asset["digest"] !== "string" || !DIGEST_RE.test(asset["digest"]) ||
      asset["capability"] !== "asset.contained-gltf") {
      return diagnostic(PROJECT_MANIFEST_DIAGNOSTICS.malformed, `$.assets[${index}]`, "Project asset identity is invalid or non-deterministic.");
    }
    if (!isCanonicalProjectPath(asset["path"])) {
      return diagnostic(PROJECT_MANIFEST_DIAGNOSTICS.pathTraversal, `$.assets[${index}].path`, "Project asset path is not canonical and contained.");
    }
    if (!capabilityIds.has(asset["capability"])) {
      return diagnostic(PROJECT_MANIFEST_DIAGNOSTICS.capabilityUndeclared, `$.assets[${index}].capability`, "Project asset capability is not granted.");
    }
    if (identities.has(asset["id"]) || paths.has(asset["path"])) {
      return diagnostic(PROJECT_MANIFEST_DIAGNOSTICS.identityDuplicate, `$.assets[${index}]`, "Project identities and paths must be unique.");
    }
    identities.add(asset["id"]);
    paths.add(asset["path"]);
    assets.push(Object.freeze(asset as unknown as ProjectAssetIdentity));
  }

  const rawMigrations = value["migrations"];
  if (!Array.isArray(rawMigrations) || rawMigrations.length > 1) {
    return diagnostic(PROJECT_MANIFEST_DIAGNOSTICS.migrationChainInvalid, "$.migrations", "Project migration history is not a replayable v1 chain.");
  }
  const migrations: ProjectMigrationRecord[] = [];
  if (rawMigrations.length === 1) {
    const migration = rawMigrations[0];
    const from = record(migration) ? migration["fromVersion"] : null;
    const to = record(migration) ? migration["toVersion"] : null;
    if (!record(migration) || !exactKeys(migration, ["id", "fromVersion", "toVersion", "sourceDigest"]) ||
      migration["id"] !== PROJECT_MIGRATION_ID || !record(from) || !record(to) ||
      !exactKeys(from, ["major", "minor"]) || !exactKeys(to, ["major", "minor"]) ||
      from["major"] !== 0 || from["minor"] !== 0 || to["major"] !== 1 || to["minor"] !== 0 ||
      typeof migration["sourceDigest"] !== "string" || !DIGEST_RE.test(migration["sourceDigest"])) {
      return diagnostic(PROJECT_MANIFEST_DIAGNOSTICS.migrationChainInvalid, "$.migrations[0]", "Project migration history is not the declared 0.0 to 1.0 chain.");
    }
    migrations.push(Object.freeze(migration as unknown as ProjectMigrationRecord));
  }

  return Object.freeze({
    ok: true as const,
    manifest: Object.freeze({
      schemaVersion: PROJECT_MANIFEST_SCHEMA_VERSION,
      kind: PROJECT_MANIFEST_KIND,
      formatVersion: PROJECT_FORMAT_VERSION,
      projectId,
      capabilities: Object.freeze(capabilities),
      objects: Object.freeze(objects),
      assets: Object.freeze(assets),
      migrations: Object.freeze(migrations),
    }),
  });
}

export function parseProjectManifestText(text: string): ProjectManifestValidation {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    return diagnostic(PROJECT_MANIFEST_DIAGNOSTICS.malformed, "$", "Project manifest JSON is invalid.");
  }
  return validateProjectManifest(value);
}

export function projectVersionCapabilityResult(
  manifest: ProjectManifest | null,
): ProjectVersionCapabilityResult {
  if (manifest === null) {
    return Object.freeze({
      schemaVersion: 1 as const,
      kind: "sceneaxi.project-inspection" as const,
      state: "legacy" as const,
      formatVersion: LEGACY_PROJECT_FORMAT_VERSION,
      projectId: null,
      manifestPath: PROJECT_MANIFEST_PATH,
      manifestDigest: null,
      capabilities: Object.freeze([]),
      migration: Object.freeze({ required: true, available: true, nextMigrationId: PROJECT_MIGRATION_ID }),
    });
  }
  return Object.freeze({
    schemaVersion: 1 as const,
    kind: "sceneaxi.project-inspection" as const,
    state: "native" as const,
    formatVersion: PROJECT_FORMAT_VERSION,
    projectId: manifest.projectId,
    manifestPath: PROJECT_MANIFEST_PATH,
    manifestDigest: projectManifestDigest(manifest),
    capabilities: manifest.capabilities,
    migration: Object.freeze({ required: false, available: false, nextMigrationId: null }),
  });
}

export function canonicalProjectManifestJson(manifest: ProjectManifest): string {
  return canonicalSculptJson(manifest as unknown as JsonObject);
}
