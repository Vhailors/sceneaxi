/**
 * Plugin Capability ID registry contract (v1) — ADR 0005 / sceneaxi#21.
 *
 * Schema: contracts/plugin-capability-registry.schema.json
 * Seed artifact: contracts/plugin-capability-registry.1.0.0.json
 *
 * Capability IDs are explicit registry keys only. They are never inferred from
 * exports, filenames, package names, or runtime behavior. The v1 seed starts
 * empty; the first non-empty production capability is a separate reviewed change.
 */

/** Exact registry-document schema version for v1. */
export const PLUGIN_CAPABILITY_REGISTRY_SCHEMA_VERSION = "1.0.0" as const;

/**
 * Exact public seed registry content version for v1.
 * Plugin manifests pin this value via `registryVersion`.
 */
export const PLUGIN_CAPABILITY_REGISTRY_VERSION = "1.0.0" as const;

/** Canonical $schema URI; must agree with PLUGIN_CAPABILITY_REGISTRY_SCHEMA_VERSION. */
export const PLUGIN_CAPABILITY_REGISTRY_SCHEMA_URI =
  "https://sceneaxi.dev/schemas/plugin-capability-registry-1.0.0.json" as const;

/** Package-relative path of the checked-in v1 seed registry artifact. */
export const PLUGIN_CAPABILITY_REGISTRY_SEED_PATH =
  "contracts/plugin-capability-registry.1.0.0.json" as const;

/** Package-relative path of the registry JSON Schema. */
export const PLUGIN_CAPABILITY_REGISTRY_SCHEMA_PATH =
  "contracts/plugin-capability-registry.schema.json" as const;

export type PluginCapabilityRegistryEntry = {
  readonly capabilityId: string;
  readonly contractRef: string;
  readonly contractVersion: string;
  readonly owningPackage: string;
  readonly documentationRef: string;
};

export type PluginCapabilityRegistry = {
  readonly $schema: typeof PLUGIN_CAPABILITY_REGISTRY_SCHEMA_URI;
  readonly schemaVersion: typeof PLUGIN_CAPABILITY_REGISTRY_SCHEMA_VERSION;
  readonly registryVersion: string;
  readonly entries: readonly PluginCapabilityRegistryEntry[];
};

export type PluginCapabilityRegistryDiagnosticCode =
  | "not-object"
  | "parse-error"
  | "missing-field"
  | "unexpected-field"
  | "invalid-field"
  | "schema-version-mismatch"
  | "registry-version-drift"
  | "duplicate-capability-id";

export type PluginCapabilityRegistryDiagnostic = {
  readonly code: PluginCapabilityRegistryDiagnosticCode;
  readonly path: string;
  readonly message: string;
  readonly foundSchemaVersion?: string;
  readonly foundRegistryVersion?: string;
};

export type PluginCapabilityRegistryValidationOk = {
  readonly ok: true;
  readonly registry: PluginCapabilityRegistry;
};

export type PluginCapabilityRegistryValidationRefuse = {
  readonly ok: false;
  readonly diagnostics: readonly PluginCapabilityRegistryDiagnostic[];
};

export type PluginCapabilityRegistryValidationResult =
  | PluginCapabilityRegistryValidationOk
  | PluginCapabilityRegistryValidationRefuse;

export type PluginCapabilityLookupHit = {
  readonly ok: true;
  readonly capabilityId: string;
  readonly entry: PluginCapabilityRegistryEntry;
};

/**
 * Typed miss for exact lookup. Host maps this to fail-closed refusal of an
 * unknown capability claim (ADR 0005).
 */
export type PluginCapabilityLookupMiss = {
  readonly ok: false;
  readonly capabilityId: string;
  readonly reason: "unknown-capability";
};

export type PluginCapabilityLookupResult =
  | PluginCapabilityLookupHit
  | PluginCapabilityLookupMiss;

export type ValidatePluginCapabilityRegistryOptions = {
  /**
   * When set, refuse if the document's registryVersion is not exactly this
   * value (registry-version drift). Seed validation always pins 1.0.0.
   */
  readonly expectedRegistryVersion?: string;
};

const REQUIRED_FIELDS = [
  "$schema",
  "schemaVersion",
  "registryVersion",
  "entries",
] as const;

const ENTRY_REQUIRED_FIELDS = [
  "capabilityId",
  "contractRef",
  "contractVersion",
  "owningPackage",
  "documentationRef",
] as const;

const ALLOWED_FIELDS = REQUIRED_FIELDS;
const ENTRY_ALLOWED_FIELDS = ENTRY_REQUIRED_FIELDS;

/** Full semver (core + optional pre-release + optional build). */
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?(?![\s\S])/;

/**
 * Public contract reference: package export path, contracts/*.schema.json path,
 * or https URI. Whitespace and other forms refuse as malformed.
 */
const CONTRACT_REF_RE =
  /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._/-]*|contracts\/[a-z0-9][a-z0-9._/-]*\.schema\.json|https:\/\/[A-Za-z0-9][^\s]*)(?![\s\S])/;

/** Owning package: scoped npm package name. */
const OWNING_PACKAGE_RE =
  /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*(?![\s\S])/;

/** Documentation: repo docs/*.md path or https URI. */
const DOCUMENTATION_REF_RE =
  /^(?:docs\/[A-Za-z0-9][A-Za-z0-9._/-]*\.md|https:\/\/[A-Za-z0-9][^\s]*)(?![\s\S])/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function refuse(
  code: PluginCapabilityRegistryDiagnosticCode,
  path: string,
  message: string,
  extras?: {
    readonly foundSchemaVersion?: string;
    readonly foundRegistryVersion?: string;
  },
): PluginCapabilityRegistryValidationRefuse {
  const diagnostic: PluginCapabilityRegistryDiagnostic = {
    code,
    path,
    message,
    ...(extras?.foundSchemaVersion !== undefined
      ? { foundSchemaVersion: extras.foundSchemaVersion }
      : {}),
    ...(extras?.foundRegistryVersion !== undefined
      ? { foundRegistryVersion: extras.foundRegistryVersion }
      : {}),
  };
  return { ok: false, diagnostics: [diagnostic] };
}

/**
 * Validate unknown data as a v1 Plugin Capability ID registry document.
 * Does not invent capability IDs or host load behavior.
 */
export function validatePluginCapabilityRegistry(
  value: unknown,
  options: ValidatePluginCapabilityRegistryOptions = {},
): PluginCapabilityRegistryValidationResult {
  if (!isPlainObject(value)) {
    return refuse(
      "not-object",
      "$",
      "Plugin capability registry must be an object.",
    );
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
  if (schemaUri !== PLUGIN_CAPABILITY_REGISTRY_SCHEMA_URI) {
    return refuse(
      "invalid-field",
      "$.$schema",
      `$schema must be "${PLUGIN_CAPABILITY_REGISTRY_SCHEMA_URI}".`,
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
  if (schemaVersion !== PLUGIN_CAPABILITY_REGISTRY_SCHEMA_VERSION) {
    return refuse(
      "schema-version-mismatch",
      "$.schemaVersion",
      `Plugin capability registry schema version mismatch: found ${schemaVersion}, expected ${PLUGIN_CAPABILITY_REGISTRY_SCHEMA_VERSION}. Silent migration is refused.`,
      { foundSchemaVersion: schemaVersion },
    );
  }

  const registryVersion = value["registryVersion"];
  if (typeof registryVersion !== "string" || !SEMVER_RE.test(registryVersion)) {
    return refuse(
      "invalid-field",
      "$.registryVersion",
      "registryVersion must be a valid exact semver string.",
    );
  }

  if (
    options.expectedRegistryVersion !== undefined &&
    registryVersion !== options.expectedRegistryVersion
  ) {
    return refuse(
      "registry-version-drift",
      "$.registryVersion",
      `Registry version drift: found ${registryVersion}, expected ${options.expectedRegistryVersion}.`,
      { foundRegistryVersion: registryVersion },
    );
  }

  const entries = value["entries"];
  if (!Array.isArray(entries)) {
    return refuse(
      "invalid-field",
      "$.entries",
      "entries must be an array of capability registry rows.",
    );
  }

  const seenIds = new Set<string>();
  const normalizedEntries: PluginCapabilityRegistryEntry[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const entryPath = `$.entries[${index}]`;

    if (!isPlainObject(entry)) {
      return refuse(
        "invalid-field",
        entryPath,
        "Each registry entry must be an object.",
      );
    }

    for (const field of ENTRY_REQUIRED_FIELDS) {
      if (!Object.hasOwn(entry, field)) {
        return refuse(
          "missing-field",
          `${entryPath}.${field}`,
          `Missing required field "${field}".`,
        );
      }
    }

    const entryAllowed = new Set<string>(ENTRY_ALLOWED_FIELDS);
    for (const field of Object.keys(entry)) {
      if (!entryAllowed.has(field)) {
        return refuse(
          "unexpected-field",
          `${entryPath}.${field}`,
          `Unexpected field "${field}"; unknown properties refuse under ADR 0005.`,
        );
      }
    }

    const capabilityId = entry["capabilityId"];
    if (typeof capabilityId !== "string" || capabilityId.length === 0) {
      return refuse(
        "invalid-field",
        `${entryPath}.capabilityId`,
        "capabilityId must be a non-empty opaque string.",
      );
    }
    if (seenIds.has(capabilityId)) {
      return refuse(
        "duplicate-capability-id",
        `${entryPath}.capabilityId`,
        `Duplicate capability ID "${capabilityId}"; registry keys must be unique within one registryVersion.`,
      );
    }
    seenIds.add(capabilityId);

    const contractRef = entry["contractRef"];
    if (typeof contractRef !== "string" || !CONTRACT_REF_RE.test(contractRef)) {
      return refuse(
        "invalid-field",
        `${entryPath}.contractRef`,
        "contractRef must be a package export path, contracts/*.schema.json path, or https URI.",
      );
    }

    const contractVersion = entry["contractVersion"];
    if (
      typeof contractVersion !== "string" ||
      !SEMVER_RE.test(contractVersion)
    ) {
      return refuse(
        "invalid-field",
        `${entryPath}.contractVersion`,
        "contractVersion must be a valid exact semver string.",
      );
    }

    const owningPackage = entry["owningPackage"];
    if (
      typeof owningPackage !== "string" ||
      !OWNING_PACKAGE_RE.test(owningPackage)
    ) {
      return refuse(
        "invalid-field",
        `${entryPath}.owningPackage`,
        "owningPackage must be a scoped package name (e.g. @sceneaxi/example).",
      );
    }

    const documentationRef = entry["documentationRef"];
    if (
      typeof documentationRef !== "string" ||
      !DOCUMENTATION_REF_RE.test(documentationRef)
    ) {
      return refuse(
        "invalid-field",
        `${entryPath}.documentationRef`,
        "documentationRef must be a docs/*.md path or https URI.",
      );
    }

    normalizedEntries.push({
      capabilityId,
      contractRef,
      contractVersion,
      owningPackage,
      documentationRef,
    });
  }

  return {
    ok: true,
    registry: {
      $schema: PLUGIN_CAPABILITY_REGISTRY_SCHEMA_URI,
      schemaVersion: PLUGIN_CAPABILITY_REGISTRY_SCHEMA_VERSION,
      registryVersion,
      entries: Object.freeze([...normalizedEntries]),
    },
  };
}

/**
 * Parse and validate capability-registry JSON text.
 */
export function parsePluginCapabilityRegistryText(
  text: string,
  options: ValidatePluginCapabilityRegistryOptions = {},
): PluginCapabilityRegistryValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "JSON parse failed.";
    return refuse(
      "parse-error",
      "$",
      `Plugin capability registry JSON parse failed: ${message}`,
    );
  }
  return validatePluginCapabilityRegistry(parsed, options);
}

/**
 * Exact, deterministic lookup by capability ID against a validated registry.
 * Unknown IDs return a typed miss the host maps to fail-closed refusal.
 */
export function lookupPluginCapability(
  registry: PluginCapabilityRegistry,
  capabilityId: string,
): PluginCapabilityLookupResult {
  for (const entry of registry.entries) {
    if (entry.capabilityId === capabilityId) {
      return { ok: true, capabilityId, entry };
    }
  }
  return { ok: false, capabilityId, reason: "unknown-capability" };
}

/**
 * Checked-in empty v1 seed registry (no demonstration or engine-internal ports).
 */
export function emptyPluginCapabilityRegistrySeed(): PluginCapabilityRegistry {
  return {
    $schema: PLUGIN_CAPABILITY_REGISTRY_SCHEMA_URI,
    schemaVersion: PLUGIN_CAPABILITY_REGISTRY_SCHEMA_VERSION,
    registryVersion: PLUGIN_CAPABILITY_REGISTRY_VERSION,
    entries: Object.freeze([]),
  };
}
