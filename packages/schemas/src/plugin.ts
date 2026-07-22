/**
 * Plugin Manifest contract (v1) — ADR 0005 capability-manifest descriptor.
 *
 * Fixed package-root path: sceneaxi.plugin.manifest.json
 * Schema: contracts/plugin-manifest.schema.json
 *
 * This module validates shape only. Host load, isolation, and registry
 * membership checks are separate contracts (#21+).
 */

/** Exact plugin-manifest schema version for v1. */
export const PLUGIN_MANIFEST_SCHEMA_VERSION = "1.0.0" as const;

/** Canonical $schema URI; must agree with PLUGIN_MANIFEST_SCHEMA_VERSION. */
export const PLUGIN_MANIFEST_SCHEMA_URI =
  "https://sceneaxi.dev/schemas/plugin-manifest-1.0.0.json" as const;

/** Fixed package-root-relative descriptor path (ADR 0005). */
export const PLUGIN_MANIFEST_PATH = "sceneaxi.plugin.manifest.json" as const;

/**
 * V1 hostApi grammar: comparator terms use full, partial, or x-range versions,
 * terms use single-space separators, OR uses " || ", and simple hyphen ranges
 * use full or partial versions in the form "A - B".
 */
export const PLUGIN_MANIFEST_HOST_API_DIALECT =
  "space-separated comparator terms with optional ^, ~, >=, <=, >, <, or = prefixes and full semver, partial, or x-range versions; OR uses \" || \"; simple hyphen ranges use full or partial versions as \"A - B\"" as const;

export type PluginManifest = {
  readonly $schema: typeof PLUGIN_MANIFEST_SCHEMA_URI;
  readonly schemaVersion: typeof PLUGIN_MANIFEST_SCHEMA_VERSION;
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly hostApi: string;
  readonly registryVersion: string;
  readonly entrypoint: string;
  readonly capabilities: readonly string[];
};

export type PluginManifestDiagnosticCode =
  | "not-object"
  | "parse-error"
  | "missing-field"
  | "unexpected-field"
  | "invalid-field"
  | "schema-version-mismatch"
  | "duplicate-capability";

export type PluginManifestDiagnostic = {
  readonly code: PluginManifestDiagnosticCode;
  readonly path: string;
  readonly message: string;
  readonly foundSchemaVersion?: string;
};

export type PluginManifestValidationOk = {
  readonly ok: true;
  readonly manifest: PluginManifest;
};

export type PluginManifestValidationRefuse = {
  readonly ok: false;
  readonly diagnostics: readonly PluginManifestDiagnostic[];
};

export type PluginManifestValidationResult =
  | PluginManifestValidationOk
  | PluginManifestValidationRefuse;

const REQUIRED_FIELDS = [
  "$schema",
  "schemaVersion",
  "pluginId",
  "pluginVersion",
  "hostApi",
  "registryVersion",
  "entrypoint",
  "capabilities",
] as const;

const ALLOWED_FIELDS = REQUIRED_FIELDS;

/** Reverse-DNS plugin identity (at least two segments). */
const PLUGIN_ID_RE =
  /^[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+(?![\s\S])/;

/** Full semver (core + optional pre-release + optional build). */
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?(?![\s\S])/;

const NUMERIC_IDENTIFIER_PATTERN = String.raw`(?:0|[1-9]\d*)`;
const PRERELEASE_IDENTIFIER_PATTERN =
  String.raw`(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)`;
const FULL_VERSION_PATTERN =
  String.raw`${NUMERIC_IDENTIFIER_PATTERN}\.${NUMERIC_IDENTIFIER_PATTERN}\.${NUMERIC_IDENTIFIER_PATTERN}(?:-${PRERELEASE_IDENTIFIER_PATTERN}(?:\.${PRERELEASE_IDENTIFIER_PATTERN})*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?`;
const PARTIAL_OR_X_RANGE_PATTERN =
  String.raw`(?:[xX*]|${NUMERIC_IDENTIFIER_PATTERN}(?:\.(?:[xX*]|${NUMERIC_IDENTIFIER_PATTERN}(?:\.[xX*])?))?)`;
const HOST_API_VERSION_PATTERN =
  String.raw`(?:${FULL_VERSION_PATTERN}|${PARTIAL_OR_X_RANGE_PATTERN})`;
const HOST_API_HYPHEN_ENDPOINT_PATTERN =
  String.raw`(?:${FULL_VERSION_PATTERN}|${NUMERIC_IDENTIFIER_PATTERN}(?:\.${NUMERIC_IDENTIFIER_PATTERN})?)`;
const HOST_API_TERM_PATTERN =
  String.raw`(?:\^|~|>=|<=|>|<|=)?${HOST_API_VERSION_PATTERN}`;
const HOST_API_COMPARATOR_SET_PATTERN =
  String.raw`${HOST_API_TERM_PATTERN}(?: ${HOST_API_TERM_PATTERN})*`;
const HOST_API_HYPHEN_RANGE_PATTERN =
  String.raw`${HOST_API_HYPHEN_ENDPOINT_PATTERN} - ${HOST_API_HYPHEN_ENDPOINT_PATTERN}`;
const HOST_API_RANGE_ARM_PATTERN =
  String.raw`(?:${HOST_API_COMPARATOR_SET_PATTERN}|${HOST_API_HYPHEN_RANGE_PATTERN})`;
const HOST_API_RANGE_RE = new RegExp(
  String.raw`^${HOST_API_RANGE_ARM_PATTERN}(?: \|\| ${HOST_API_RANGE_ARM_PATTERN})*(?![\s\S])`,
);

/** Single path segment for package-relative entrypoints. */
const ENTRYPOINT_SEGMENT_RE = /^[A-Za-z0-9._-]+(?![\s\S])/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function refuse(
  code: PluginManifestDiagnosticCode,
  path: string,
  message: string,
  foundSchemaVersion?: string,
): PluginManifestValidationRefuse {
  const diagnostic: PluginManifestDiagnostic =
    foundSchemaVersion === undefined
      ? { code, path, message }
      : { code, path, message, foundSchemaVersion };
  return { ok: false, diagnostics: [diagnostic] };
}

function isPackageRelativeEntrypoint(value: string): boolean {
  if (value.length === 0) return false;
  if (value.includes("\\") || value.includes("\0")) return false;
  if (value.startsWith("/") || /^[A-Za-z]:/.test(value)) return false;

  const normalized = value.startsWith("./") ? value.slice(2) : value;
  if (normalized.length === 0 || normalized.startsWith("/")) return false;
  if (normalized.includes("//")) return false;

  const segments = normalized.split("/");
  return segments.every(
    (segment) =>
      segment.length > 0 &&
      segment !== "." &&
      segment !== ".." &&
      ENTRYPOINT_SEGMENT_RE.test(segment),
  );
}

/**
 * Validate unknown data as a v1 Plugin Manifest, refusing closed on shape errors.
 * Does not check registry membership or package isolation (host concerns).
 */
export function validatePluginManifest(
  value: unknown,
): PluginManifestValidationResult {
  if (!isPlainObject(value)) {
    return refuse("not-object", "$", "Plugin manifest must be an object.");
  }

  for (const field of REQUIRED_FIELDS) {
    if (!Object.hasOwn(value, field)) {
      return refuse(
        "missing-field",
        `$.${field}`,
        `Missing required field "${field}".`,
      );
    }
  }

  const allowed = new Set<string>(ALLOWED_FIELDS);
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) {
      return refuse(
        "unexpected-field",
        `$.${field}`,
        `Unexpected field "${field}"; unknown properties refuse under ADR 0005.`,
      );
    }
  }

  const schemaUri = value["$schema"];
  if (schemaUri !== PLUGIN_MANIFEST_SCHEMA_URI) {
    return refuse(
      "invalid-field",
      "$.$schema",
      `$schema must be "${PLUGIN_MANIFEST_SCHEMA_URI}".`,
    );
  }

  const schemaVersion = value["schemaVersion"];
  if (typeof schemaVersion !== "string") {
    return refuse(
      "invalid-field",
      "$.schemaVersion",
      "schemaVersion must be a string.",
    );
  }
  if (schemaVersion !== PLUGIN_MANIFEST_SCHEMA_VERSION) {
    return refuse(
      "schema-version-mismatch",
      "$.schemaVersion",
      `Plugin manifest schema version mismatch: found ${schemaVersion}, expected ${PLUGIN_MANIFEST_SCHEMA_VERSION}. Silent migration is refused.`,
      schemaVersion,
    );
  }

  const pluginId = value["pluginId"];
  if (typeof pluginId !== "string" || !PLUGIN_ID_RE.test(pluginId)) {
    return refuse(
      "invalid-field",
      "$.pluginId",
      "pluginId must be a reverse-DNS identity matching ^[a-z][a-z0-9-]*(\\.[a-z0-9][a-z0-9-]*)+$.",
    );
  }

  const pluginVersion = value["pluginVersion"];
  if (typeof pluginVersion !== "string" || !SEMVER_RE.test(pluginVersion)) {
    return refuse(
      "invalid-field",
      "$.pluginVersion",
      "pluginVersion must be a valid semver string.",
    );
  }

  const hostApi = value["hostApi"];
  if (
    typeof hostApi !== "string" ||
    hostApi.length === 0 ||
    !HOST_API_RANGE_RE.test(hostApi)
  ) {
    return refuse(
      "invalid-field",
      "$.hostApi",
      `hostApi must use the v1 dialect: ${PLUGIN_MANIFEST_HOST_API_DIALECT}.`,
    );
  }

  const registryVersion = value["registryVersion"];
  if (
    typeof registryVersion !== "string" ||
    !SEMVER_RE.test(registryVersion)
  ) {
    return refuse(
      "invalid-field",
      "$.registryVersion",
      "registryVersion must be a valid exact semver string.",
    );
  }

  const entrypoint = value["entrypoint"];
  if (typeof entrypoint !== "string" || !isPackageRelativeEntrypoint(entrypoint)) {
    return refuse(
      "invalid-field",
      "$.entrypoint",
      "entrypoint must be a package-relative path without absolute roots or parent-segment escapes.",
    );
  }

  const capabilities = value["capabilities"];
  if (!Array.isArray(capabilities)) {
    return refuse(
      "invalid-field",
      "$.capabilities",
      "capabilities must be an array of unique capability ID strings.",
    );
  }

  const seen = new Set<string>();
  const normalizedCapabilities: string[] = [];
  for (let index = 0; index < capabilities.length; index += 1) {
    const capability = capabilities[index];
    const path = `$.capabilities[${index}]`;
    if (typeof capability !== "string" || capability.length === 0) {
      return refuse(
        "invalid-field",
        path,
        "capability ID must be a non-empty string.",
      );
    }
    if (seen.has(capability)) {
      return refuse(
        "duplicate-capability",
        path,
        `Duplicate capability ID "${capability}"; capability claims must be unique within one manifest.`,
      );
    }
    seen.add(capability);
    normalizedCapabilities.push(capability);
  }

  return {
    ok: true,
    manifest: {
      $schema: PLUGIN_MANIFEST_SCHEMA_URI,
      schemaVersion: PLUGIN_MANIFEST_SCHEMA_VERSION,
      pluginId,
      pluginVersion,
      hostApi,
      registryVersion,
      entrypoint,
      capabilities: Object.freeze([...normalizedCapabilities]),
    },
  };
}

/**
 * Parse and validate plugin-manifest JSON text. Duplicate JSON object members
 * are not specially detected (shape validation is structural after JSON.parse).
 */
export function parsePluginManifestText(
  text: string,
): PluginManifestValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "JSON parse failed.";
    return refuse("parse-error", "$", `Plugin manifest JSON parse failed: ${message}`);
  }
  return validatePluginManifest(parsed);
}

/** Inert fixture matching docs/plugins.md (empty capabilities; no ports invented). */
export function inertPluginManifestFixture(): PluginManifest {
  return {
    $schema: PLUGIN_MANIFEST_SCHEMA_URI,
    schemaVersion: PLUGIN_MANIFEST_SCHEMA_VERSION,
    pluginId: "dev.sceneaxi.example.noop",
    pluginVersion: "0.1.0",
    hostApi: "^1.0.0",
    registryVersion: "1.0.0",
    entrypoint: "./dist/plugin.js",
    capabilities: Object.freeze([]),
  };
}
