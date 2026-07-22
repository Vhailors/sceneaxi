/**
 * Public, delivery-neutral export handoff contract (v1).
 *
 * The payload describes portable product artifacts for an independent store or
 * CI adapter. It deliberately carries no adapter configuration or credentials.
 */

export const DELIVERY_HANDOFF_SCHEMA_VERSION = 1 as const;

export const DELIVERY_HANDOFF_KIND = "sceneaxi.delivery-handoff" as const;

export const DELIVERY_TARGET_PLATFORMS = Object.freeze([
  "android",
  "ios",
  "desktop",
  "web",
] as const);

export type DeliveryTargetPlatform =
  (typeof DELIVERY_TARGET_PLATFORMS)[number];

export const DELIVERY_ARTIFACT_ROLES = Object.freeze([
  "application",
  "asset-bundle",
  "metadata",
  "debug-symbols",
  "other",
] as const);

export type DeliveryArtifactRole = (typeof DELIVERY_ARTIFACT_ROLES)[number];

export type DeliveryHandoffProduct = {
  readonly id: string;
  readonly displayName: string;
  readonly version: string;
};

export type DeliveryHandoffArtifact = {
  /** Relative POSIX path inside the portable export package. */
  readonly path: string;
  readonly role: DeliveryArtifactRole;
  readonly contentType: string;
  readonly digest: string;
};

export type DeliveryBuildMetadata = {
  readonly id: string;
  readonly tool?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
};

export type DeliveryHandoffProvenance = {
  readonly createdAt: string;
  readonly sourceCommit?: string;
  readonly build?: DeliveryBuildMetadata;
};

export type DeliveryHandoff = {
  readonly schemaVersion: typeof DELIVERY_HANDOFF_SCHEMA_VERSION;
  readonly kind: typeof DELIVERY_HANDOFF_KIND;
  readonly product: DeliveryHandoffProduct;
  readonly targets: readonly DeliveryTargetPlatform[];
  readonly artifacts: readonly DeliveryHandoffArtifact[];
  /** sha256 of the RFC 8785 canonical JSON representation of artifacts. */
  readonly artifactSetDigest: string;
  readonly provenance: DeliveryHandoffProvenance;
  readonly notes?: string;
};

export type DeliveryHandoffDiagnosticCode =
  | "not-object"
  | "parse-error"
  | "schema-major-mismatch"
  | "missing-field"
  | "unexpected-field"
  | "invalid-field"
  | "invalid-digest"
  | "duplicate-target"
  | "duplicate-artifact-path";

export type DeliveryHandoffDiagnostic = {
  readonly code: DeliveryHandoffDiagnosticCode;
  readonly path: string;
  readonly message: string;
  readonly foundSchemaVersion?: number;
};

export type DeliveryHandoffValidationOk = {
  readonly ok: true;
  readonly handoff: DeliveryHandoff;
};

export type DeliveryHandoffValidationRefuse = {
  readonly ok: false;
  readonly diagnostics: readonly DeliveryHandoffDiagnostic[];
};

export type DeliveryHandoffValidationResult =
  | DeliveryHandoffValidationOk
  | DeliveryHandoffValidationRefuse;

const PRODUCT_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const SHA256_RE = /^sha256:[0-9a-f]{64}$/;
const SOURCE_COMMIT_RE = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const CONTENT_TYPE_RE =
  /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;
const DATE_TIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const TARGETS = new Set<string>(DELIVERY_TARGET_PLATFORMS);
const ROLES = new Set<string>(DELIVERY_ARTIFACT_ROLES);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function refuse(
  code: DeliveryHandoffDiagnosticCode,
  path: string,
  message: string,
  foundSchemaVersion?: number,
): DeliveryHandoffValidationRefuse {
  const diagnostic: DeliveryHandoffDiagnostic =
    foundSchemaVersion === undefined
      ? { code, path, message }
      : { code, path, message, foundSchemaVersion };
  return { ok: false, diagnostics: [diagnostic] };
}

function requireFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  path: string,
): DeliveryHandoffValidationRefuse | null {
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) {
      return refuse(
        "missing-field",
        `${path}.${field}`,
        `Missing required field "${field}".`,
      );
    }
  }
  return null;
}

function refuseUnexpectedFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): DeliveryHandoffValidationRefuse | null {
  const allowedFields = new Set(allowed);
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      return refuse(
        "unexpected-field",
        `${path}.${field}`,
        `Unexpected field "${field}"; adapter-private configuration is outside the public handoff contract.`,
      );
    }
  }
  return null;
}

function isDateTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    DATE_TIME_RE.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isPortableRelativePath(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 1024) {
    return false;
  }
  if (value.startsWith("/") || value.includes("\\") || value.includes("\0")) {
    return false;
  }
  const segments = value.split("/");
  return segments.every(
    (segment) => segment.length > 0 && segment !== "." && segment !== "..",
  );
}

function validateProduct(
  value: unknown,
):
  | { readonly ok: true; readonly product: DeliveryHandoffProduct }
  | DeliveryHandoffValidationRefuse {
  if (!isPlainObject(value)) {
    return refuse("invalid-field", "$.product", "product must be an object.");
  }
  const missing = requireFields(value, ["id", "displayName", "version"], "$.product");
  if (missing !== null) return missing;
  const unexpected = refuseUnexpectedFields(
    value,
    ["id", "displayName", "version"],
    "$.product",
  );
  if (unexpected !== null) return unexpected;

  const id = value["id"];
  if (typeof id !== "string" || !PRODUCT_ID_RE.test(id)) {
    return refuse(
      "invalid-field",
      "$.product.id",
      "product.id must match ^[a-z0-9][a-z0-9-]*$.",
    );
  }
  const displayName = value["displayName"];
  if (
    typeof displayName !== "string" ||
    displayName.trim().length === 0 ||
    displayName.length > 200
  ) {
    return refuse(
      "invalid-field",
      "$.product.displayName",
      "product.displayName must be a non-empty string of at most 200 characters.",
    );
  }
  const version = value["version"];
  if (
    typeof version !== "string" ||
    version.trim().length === 0 ||
    version.length > 100
  ) {
    return refuse(
      "invalid-field",
      "$.product.version",
      "product.version must be a non-empty string of at most 100 characters.",
    );
  }

  return { ok: true, product: { id, displayName, version } };
}

function validateTargets(
  value: unknown,
):
  | { readonly ok: true; readonly targets: DeliveryTargetPlatform[] }
  | DeliveryHandoffValidationRefuse {
  if (!Array.isArray(value) || value.length === 0) {
    return refuse(
      "invalid-field",
      "$.targets",
      "targets must be a non-empty array.",
    );
  }

  const targets: DeliveryTargetPlatform[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const target = value[index];
    if (typeof target !== "string" || !TARGETS.has(target)) {
      return refuse(
        "invalid-field",
        `$.targets[${index}]`,
        `target must be one of ${DELIVERY_TARGET_PLATFORMS.join(", ")}.`,
      );
    }
    if (seen.has(target)) {
      return refuse(
        "duplicate-target",
        `$.targets[${index}]`,
        `Duplicate target "${target}" is refused.`,
      );
    }
    seen.add(target);
    targets.push(target as DeliveryTargetPlatform);
  }
  return { ok: true, targets };
}

function validateArtifacts(
  value: unknown,
):
  | { readonly ok: true; readonly artifacts: DeliveryHandoffArtifact[] }
  | DeliveryHandoffValidationRefuse {
  if (!Array.isArray(value) || value.length === 0) {
    return refuse(
      "invalid-field",
      "$.artifacts",
      "artifacts must be a non-empty array.",
    );
  }

  const artifacts: DeliveryHandoffArtifact[] = [];
  const seenPaths = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const artifact = value[index];
    const path = `$.artifacts[${index}]`;
    if (!isPlainObject(artifact)) {
      return refuse("invalid-field", path, "artifact must be an object.");
    }
    const missing = requireFields(
      artifact,
      ["path", "role", "contentType", "digest"],
      path,
    );
    if (missing !== null) return missing;
    const unexpected = refuseUnexpectedFields(
      artifact,
      ["path", "role", "contentType", "digest"],
      path,
    );
    if (unexpected !== null) return unexpected;

    const artifactPath = artifact["path"];
    if (!isPortableRelativePath(artifactPath)) {
      return refuse(
        "invalid-field",
        `${path}.path`,
        "artifact.path must be a portable relative POSIX path without empty, dot, or parent segments.",
      );
    }
    if (seenPaths.has(artifactPath)) {
      return refuse(
        "duplicate-artifact-path",
        `${path}.path`,
        `Duplicate artifact path "${artifactPath}" is refused.`,
      );
    }
    seenPaths.add(artifactPath);

    const role = artifact["role"];
    if (typeof role !== "string" || !ROLES.has(role)) {
      return refuse(
        "invalid-field",
        `${path}.role`,
        `artifact.role must be one of ${DELIVERY_ARTIFACT_ROLES.join(", ")}.`,
      );
    }
    const contentType = artifact["contentType"];
    if (typeof contentType !== "string" || !CONTENT_TYPE_RE.test(contentType)) {
      return refuse(
        "invalid-field",
        `${path}.contentType`,
        "artifact.contentType must be a media type such as application/zip.",
      );
    }
    const digest = artifact["digest"];
    if (typeof digest !== "string" || !SHA256_RE.test(digest)) {
      return refuse(
        "invalid-digest",
        `${path}.digest`,
        "artifact.digest must match ^sha256:[0-9a-f]{64}$.",
      );
    }

    artifacts.push({
      path: artifactPath,
      role: role as DeliveryArtifactRole,
      contentType,
      digest,
    });
  }
  return { ok: true, artifacts };
}

function validateBuild(
  value: unknown,
):
  | { readonly ok: true; readonly build: DeliveryBuildMetadata }
  | DeliveryHandoffValidationRefuse {
  if (!isPlainObject(value)) {
    return refuse(
      "invalid-field",
      "$.provenance.build",
      "provenance.build must be an object.",
    );
  }
  const missing = requireFields(value, ["id"], "$.provenance.build");
  if (missing !== null) return missing;
  const unexpected = refuseUnexpectedFields(
    value,
    ["id", "tool", "startedAt", "completedAt"],
    "$.provenance.build",
  );
  if (unexpected !== null) return unexpected;

  const id = value["id"];
  if (typeof id !== "string" || id.trim().length === 0 || id.length > 200) {
    return refuse(
      "invalid-field",
      "$.provenance.build.id",
      "provenance.build.id must be a non-empty string of at most 200 characters.",
    );
  }
  const tool = value["tool"];
  if (
    Object.hasOwn(value, "tool") &&
    (typeof tool !== "string" || tool.trim().length === 0 || tool.length > 200)
  ) {
    return refuse(
      "invalid-field",
      "$.provenance.build.tool",
      "provenance.build.tool must be a non-empty string of at most 200 characters when present.",
    );
  }
  const startedAt = value["startedAt"];
  if (Object.hasOwn(value, "startedAt") && !isDateTime(startedAt)) {
    return refuse(
      "invalid-field",
      "$.provenance.build.startedAt",
      "provenance.build.startedAt must be an RFC 3339 date-time when present.",
    );
  }
  const completedAt = value["completedAt"];
  if (Object.hasOwn(value, "completedAt") && !isDateTime(completedAt)) {
    return refuse(
      "invalid-field",
      "$.provenance.build.completedAt",
      "provenance.build.completedAt must be an RFC 3339 date-time when present.",
    );
  }
  if (
    typeof startedAt === "string" &&
    typeof completedAt === "string" &&
    Date.parse(completedAt) < Date.parse(startedAt)
  ) {
    return refuse(
      "invalid-field",
      "$.provenance.build.completedAt",
      "provenance.build.completedAt must not precede startedAt.",
    );
  }

  const build: DeliveryBuildMetadata = {
    id,
    ...(typeof tool === "string" ? { tool } : {}),
    ...(typeof startedAt === "string" ? { startedAt } : {}),
    ...(typeof completedAt === "string" ? { completedAt } : {}),
  };
  return { ok: true, build };
}

function validateProvenance(
  value: unknown,
):
  | { readonly ok: true; readonly provenance: DeliveryHandoffProvenance }
  | DeliveryHandoffValidationRefuse {
  if (!isPlainObject(value)) {
    return refuse(
      "invalid-field",
      "$.provenance",
      "provenance must be an object.",
    );
  }
  const missing = requireFields(value, ["createdAt"], "$.provenance");
  if (missing !== null) return missing;
  const unexpected = refuseUnexpectedFields(
    value,
    ["createdAt", "sourceCommit", "build"],
    "$.provenance",
  );
  if (unexpected !== null) return unexpected;

  const createdAt = value["createdAt"];
  if (!isDateTime(createdAt)) {
    return refuse(
      "invalid-field",
      "$.provenance.createdAt",
      "provenance.createdAt must be an RFC 3339 date-time.",
    );
  }
  const sourceCommit = value["sourceCommit"];
  if (
    Object.hasOwn(value, "sourceCommit") &&
    (typeof sourceCommit !== "string" || !SOURCE_COMMIT_RE.test(sourceCommit))
  ) {
    return refuse(
      "invalid-field",
      "$.provenance.sourceCommit",
      "provenance.sourceCommit must be a lowercase 40- or 64-character hexadecimal commit id when present.",
    );
  }

  let build: DeliveryBuildMetadata | undefined;
  if (Object.hasOwn(value, "build")) {
    const checked = validateBuild(value["build"]);
    if (!checked.ok) return checked;
    build = checked.build;
  }

  const provenance: DeliveryHandoffProvenance = {
    createdAt,
    ...(typeof sourceCommit === "string" ? { sourceCommit } : {}),
    ...(build === undefined ? {} : { build }),
  };
  return { ok: true, provenance };
}

/** Validate unknown data as a public delivery handoff, refusing closed. */
export function validateDeliveryHandoff(
  value: unknown,
): DeliveryHandoffValidationResult {
  if (!isPlainObject(value)) {
    return refuse("not-object", "$", "Delivery handoff must be an object.");
  }

  const missing = requireFields(
    value,
    [
      "schemaVersion",
      "kind",
      "product",
      "targets",
      "artifacts",
      "artifactSetDigest",
      "provenance",
    ],
    "$",
  );
  if (missing !== null) return missing;
  const unexpected = refuseUnexpectedFields(
    value,
    [
      "schemaVersion",
      "kind",
      "product",
      "targets",
      "artifacts",
      "artifactSetDigest",
      "provenance",
      "notes",
    ],
    "$",
  );
  if (unexpected !== null) return unexpected;

  const schemaVersion = value["schemaVersion"];
  if (typeof schemaVersion !== "number" || !Number.isInteger(schemaVersion)) {
    return refuse(
      "invalid-field",
      "$.schemaVersion",
      "schemaVersion must be an integer.",
    );
  }
  if (schemaVersion !== DELIVERY_HANDOFF_SCHEMA_VERSION) {
    return refuse(
      "schema-major-mismatch",
      "$.schemaVersion",
      `Delivery handoff schema major mismatch: found ${schemaVersion}, expected ${DELIVERY_HANDOFF_SCHEMA_VERSION}. Silent migration is refused.`,
      schemaVersion,
    );
  }
  if (value["kind"] !== DELIVERY_HANDOFF_KIND) {
    return refuse(
      "invalid-field",
      "$.kind",
      `kind must be "${DELIVERY_HANDOFF_KIND}".`,
    );
  }

  const product = validateProduct(value["product"]);
  if (!product.ok) return product;
  const targets = validateTargets(value["targets"]);
  if (!targets.ok) return targets;
  const artifacts = validateArtifacts(value["artifacts"]);
  if (!artifacts.ok) return artifacts;

  const artifactSetDigest = value["artifactSetDigest"];
  if (
    typeof artifactSetDigest !== "string" ||
    !SHA256_RE.test(artifactSetDigest)
  ) {
    return refuse(
      "invalid-digest",
      "$.artifactSetDigest",
      "artifactSetDigest must match ^sha256:[0-9a-f]{64}$.",
    );
  }

  const provenance = validateProvenance(value["provenance"]);
  if (!provenance.ok) return provenance;

  const notes = value["notes"];
  if (
    Object.hasOwn(value, "notes") &&
    (typeof notes !== "string" || notes.trim().length === 0 || notes.length > 10_000)
  ) {
    return refuse(
      "invalid-field",
      "$.notes",
      "notes must be a non-empty string of at most 10000 characters when present.",
    );
  }

  return {
    ok: true,
    handoff: {
      schemaVersion: DELIVERY_HANDOFF_SCHEMA_VERSION,
      kind: DELIVERY_HANDOFF_KIND,
      product: product.product,
      targets: targets.targets,
      artifacts: artifacts.artifacts,
      artifactSetDigest,
      provenance: provenance.provenance,
      ...(typeof notes === "string" ? { notes } : {}),
    },
  };
}

/** Parse JSON text then validate it as a public delivery handoff. */
export function parseDeliveryHandoffText(
  text: string,
): DeliveryHandoffValidationResult {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return refuse(
      "parse-error",
      "$",
      `Delivery handoff JSON parse failed: ${message}`,
    );
  }
  return validateDeliveryHandoff(value);
}
