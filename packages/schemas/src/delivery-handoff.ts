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
  readonly role: DeliveryArtifactRole;
  readonly contentType: string;
  readonly digest: string;
};

export type DeliveryHandoffArtifacts = Readonly<
  Record<string, DeliveryHandoffArtifact>
>;

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
  readonly target: DeliveryTargetPlatform;
  readonly artifacts: DeliveryHandoffArtifacts;
  /** sha256 of the RFC 8785 canonical JSON representation of the artifacts object. */
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
  | "artifact-set-digest-mismatch";

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
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([Zz]|[+-]\d{2}:\d{2})$/;
const PATH_CONTROL_RE = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/;

const SHA256_INITIAL_STATE = Uint32Array.from([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
  0x1f83d9ab, 0x5be0cd19,
]);

const SHA256_ROUND_CONSTANTS = Uint32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

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

type Rfc3339Instant = {
  readonly value: string;
  readonly wholeSeconds: number;
  readonly fraction: string;
};

function daysInMonth(year: number, month: number) {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function daysFromCivil(year: number, month: number, day: number) {
  const adjustedYear = month <= 2 ? year - 1 : year;
  const era = Math.floor(adjustedYear / 400);
  const yearOfEra = adjustedYear - era * 400;
  const adjustedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * adjustedMonth + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) +
    dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}

function parseRfc3339Instant(value: unknown): Rfc3339Instant | null {
  if (typeof value !== "string") return null;
  const match = DATE_TIME_RE.exec(value);
  if (match === null) return null;

  const yearText = match[1];
  const monthText = match[2];
  const dayText = match[3];
  const hourText = match[4];
  const minuteText = match[5];
  const secondText = match[6];
  const fraction = match[7] ?? "";
  const offsetText = match[8];
  if (
    yearText === undefined ||
    monthText === undefined ||
    dayText === undefined ||
    hourText === undefined ||
    minuteText === undefined ||
    secondText === undefined ||
    offsetText === undefined
  ) {
    return null;
  }

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 60 ||
    (second === 60 && minute !== 59)
  ) {
    return null;
  }

  let offsetSeconds = 0;
  if (offsetText !== "Z" && offsetText !== "z") {
    const offsetHour = Number(offsetText.slice(1, 3));
    const offsetMinute = Number(offsetText.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) return null;
    const direction = offsetText.startsWith("+") ? 1 : -1;
    offsetSeconds = direction * (offsetHour * 3_600 + offsetMinute * 60);
  }

  return {
    value,
    wholeSeconds:
      daysFromCivil(year, month, day) * 86_400 +
      hour * 3_600 +
      minute * 60 +
      second -
      offsetSeconds,
    fraction,
  };
}

function compareRfc3339Instants(left: Rfc3339Instant, right: Rfc3339Instant) {
  if (left.wholeSeconds !== right.wholeSeconds) {
    return left.wholeSeconds - right.wholeSeconds;
  }
  const width = Math.max(left.fraction.length, right.fraction.length);
  const leftFraction = left.fraction.padEnd(width, "0");
  const rightFraction = right.fraction.padEnd(width, "0");
  if (leftFraction < rightFraction) return -1;
  if (leftFraction > rightFraction) return 1;
  return 0;
}

function hasUnpairedSurrogate(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function isPortableRelativePath(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    [...value].length > 1024
  ) {
    return false;
  }
  if (
    value.startsWith("/") ||
    value.includes("\\") ||
    PATH_CONTROL_RE.test(value) ||
    hasUnpairedSurrogate(value)
  ) {
    return false;
  }
  const segments = value.split("/");
  return segments.every(
    (segment) => segment.length > 0 && segment !== "." && segment !== "..",
  );
}

function quoteCanonicalString(value: string) {
  const quoted = JSON.stringify(value);
  if (quoted === undefined) throw new TypeError("Value is not a JSON string.");
  return quoted;
}

function canonicalizeArtifactSet(artifacts: DeliveryHandoffArtifacts) {
  const entries = Object.keys(artifacts)
    .sort()
    .map((path) => {
      const artifact = artifacts[path];
      if (artifact === undefined) {
        throw new TypeError(`Missing artifact descriptor for ${path}.`);
      }
      return `${quoteCanonicalString(path)}:{"contentType":${quoteCanonicalString(artifact.contentType)},"digest":${quoteCanonicalString(artifact.digest)},"role":${quoteCanonicalString(artifact.role)}}`;
    });
  return `{${entries.join(",")}}`;
}

function rotateRight(value: number, bits: number) {
  return (value >>> bits) | (value << (32 - bits));
}

function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bitLength = bytes.length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  const state = SHA256_INITIAL_STATE.slice();
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4);
    }
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15] ?? 0;
      const previous2 = words[index - 2] ?? 0;
      const sigma0 =
        rotateRight(previous15, 7) ^
        rotateRight(previous15, 18) ^
        (previous15 >>> 3);
      const sigma1 =
        rotateRight(previous2, 17) ^
        rotateRight(previous2, 19) ^
        (previous2 >>> 10);
      words[index] =
        (words[index - 16] ?? 0) +
        sigma0 +
        (words[index - 7] ?? 0) +
        sigma1;
    }

    let a = state[0] ?? 0;
    let b = state[1] ?? 0;
    let c = state[2] ?? 0;
    let d = state[3] ?? 0;
    let e = state[4] ?? 0;
    let f = state[5] ?? 0;
    let g = state[6] ?? 0;
    let h = state[7] ?? 0;

    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temporary1 =
        (h +
          sum1 +
          choose +
          (SHA256_ROUND_CONSTANTS[index] ?? 0) +
          (words[index] ?? 0)) >>>
        0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }

    state[0] = ((state[0] ?? 0) + a) >>> 0;
    state[1] = ((state[1] ?? 0) + b) >>> 0;
    state[2] = ((state[2] ?? 0) + c) >>> 0;
    state[3] = ((state[3] ?? 0) + d) >>> 0;
    state[4] = ((state[4] ?? 0) + e) >>> 0;
    state[5] = ((state[5] ?? 0) + f) >>> 0;
    state[6] = ((state[6] ?? 0) + g) >>> 0;
    state[7] = ((state[7] ?? 0) + h) >>> 0;
  }

  return Array.from(state, (word) => word.toString(16).padStart(8, "0")).join(
    "",
  );
}

/** Compute the aggregate binding digest for a validated artifacts record. */
export function computeDeliveryArtifactSetDigest(
  artifacts: DeliveryHandoffArtifacts,
) {
  return `sha256:${sha256Hex(canonicalizeArtifactSet(artifacts))}`;
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

function validateTarget(
  value: unknown,
):
  | { readonly ok: true; readonly target: DeliveryTargetPlatform }
  | DeliveryHandoffValidationRefuse {
  if (typeof value !== "string" || !TARGETS.has(value)) {
    return refuse(
      "invalid-field",
      "$.target",
      `target must be one of ${DELIVERY_TARGET_PLATFORMS.join(", ")}.`,
    );
  }
  return { ok: true, target: value as DeliveryTargetPlatform };
}

function validateArtifacts(
  value: unknown,
):
  | { readonly ok: true; readonly artifacts: DeliveryHandoffArtifacts }
  | DeliveryHandoffValidationRefuse {
  if (!isPlainObject(value) || Object.keys(value).length === 0) {
    return refuse(
      "invalid-field",
      "$.artifacts",
      "artifacts must be a non-empty record keyed by portable paths.",
    );
  }

  const entries: [string, DeliveryHandoffArtifact][] = [];
  for (const [artifactPath, artifact] of Object.entries(value)) {
    const path = `$.artifacts[${JSON.stringify(artifactPath)}]`;
    if (!isPortableRelativePath(artifactPath)) {
      return refuse(
        "invalid-field",
        path,
        "artifact path keys must be portable relative POSIX paths without control characters, empty, dot, or parent segments.",
      );
    }
    if (!isPlainObject(artifact)) {
      return refuse("invalid-field", path, "artifact must be an object.");
    }
    const missing = requireFields(
      artifact,
      ["role", "contentType", "digest"],
      path,
    );
    if (missing !== null) return missing;
    const unexpected = refuseUnexpectedFields(
      artifact,
      ["role", "contentType", "digest"],
      path,
    );
    if (unexpected !== null) return unexpected;

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

    entries.push([
      artifactPath,
      {
        role: role as DeliveryArtifactRole,
        contentType,
        digest,
      },
    ]);
  }
  return { ok: true, artifacts: Object.fromEntries(entries) };
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
  const parsedStartedAt = Object.hasOwn(value, "startedAt")
    ? parseRfc3339Instant(startedAt)
    : undefined;
  if (parsedStartedAt === null) {
    return refuse(
      "invalid-field",
      "$.provenance.build.startedAt",
      "provenance.build.startedAt must be an RFC 3339 date-time when present.",
    );
  }
  const completedAt = value["completedAt"];
  const parsedCompletedAt = Object.hasOwn(value, "completedAt")
    ? parseRfc3339Instant(completedAt)
    : undefined;
  if (parsedCompletedAt === null) {
    return refuse(
      "invalid-field",
      "$.provenance.build.completedAt",
      "provenance.build.completedAt must be an RFC 3339 date-time when present.",
    );
  }
  if (
    parsedStartedAt !== undefined &&
    parsedCompletedAt !== undefined &&
    compareRfc3339Instants(parsedCompletedAt, parsedStartedAt) < 0
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
    ...(parsedStartedAt === undefined
      ? {}
      : { startedAt: parsedStartedAt.value }),
    ...(parsedCompletedAt === undefined
      ? {}
      : { completedAt: parsedCompletedAt.value }),
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

  const createdAt = parseRfc3339Instant(value["createdAt"]);
  if (createdAt === null) {
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
    createdAt: createdAt.value,
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
      "target",
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
      "target",
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
  const target = validateTarget(value["target"]);
  if (!target.ok) return target;
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
  const expectedArtifactSetDigest = computeDeliveryArtifactSetDigest(
    artifacts.artifacts,
  );
  if (artifactSetDigest !== expectedArtifactSetDigest) {
    return refuse(
      "artifact-set-digest-mismatch",
      "$.artifactSetDigest",
      `artifactSetDigest does not bind the validated artifacts record; expected ${expectedArtifactSetDigest}.`,
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
      target: target.target,
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
