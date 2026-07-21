/**
 * Text-canonical SceneAxi document contract (v1).
 *
 * Documents are versioned JSON text files. Major schemaVersion mismatches refuse.
 * Behavioral semantics: docs/authoring-contracts.md; service in authoring-core.
 */

/** Contract major version for text-canonical documents. */
export const DOCUMENT_SCHEMA_VERSION = 1 as const;

export const DOCUMENT_KIND = "sceneaxi.document" as const;

export type SceneDocument = {
  readonly schemaVersion: typeof DOCUMENT_SCHEMA_VERSION;
  readonly kind: typeof DOCUMENT_KIND;
  readonly id: string;
  readonly title?: string;
  readonly data: Readonly<Record<string, unknown>>;
};

export type DocumentValidationOk = {
  readonly ok: true;
  readonly document: SceneDocument;
};

export type DocumentValidationRefuse = {
  readonly ok: false;
  readonly code:
    | "schema-major-mismatch"
    | "invalid-document"
    | "not-object"
    | "parse-error";
  readonly message: string;
  readonly foundSchemaVersion?: number;
};

export type DocumentValidationResult =
  | DocumentValidationOk
  | DocumentValidationRefuse;

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Validate an unknown value as a SceneAxi document.
 * Single shared validator entry used by direct edits and propose/apply.
 */
export function validateDocument(value: unknown): DocumentValidationResult {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      code: "not-object",
      message: "Document must be a JSON object.",
    };
  }

  const raw = value as Record<string, unknown>;

  if (!Object.hasOwn(raw, "schemaVersion")) {
    return {
      ok: false,
      code: "invalid-document",
      message: "Document missing required property \"schemaVersion\".",
    };
  }

  const schemaVersion = raw["schemaVersion"];
  if (typeof schemaVersion !== "number" || !Number.isInteger(schemaVersion)) {
    return {
      ok: false,
      code: "invalid-document",
      message: "Document schemaVersion must be an integer.",
    };
  }

  if (schemaVersion !== DOCUMENT_SCHEMA_VERSION) {
    return {
      ok: false,
      code: "schema-major-mismatch",
      message: `Document schema major mismatch: found ${schemaVersion}, expected ${DOCUMENT_SCHEMA_VERSION}. Silent migration is refused.`,
      foundSchemaVersion: schemaVersion,
    };
  }

  if (raw["kind"] !== DOCUMENT_KIND) {
    return {
      ok: false,
      code: "invalid-document",
      message: `Document kind must be "${DOCUMENT_KIND}".`,
    };
  }

  const id = raw["id"];
  if (typeof id !== "string" || !ID_RE.test(id)) {
    return {
      ok: false,
      code: "invalid-document",
      message: "Document id must match ^[a-z0-9][a-z0-9-]*$.",
    };
  }

  const data = raw["data"];
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return {
      ok: false,
      code: "invalid-document",
      message: "Document data must be a JSON object.",
    };
  }

  const known = new Set(["schemaVersion", "kind", "id", "title", "data"]);
  for (const key of Object.keys(raw)) {
    if (!known.has(key)) {
      return {
        ok: false,
        code: "invalid-document",
        message: `Document has unexpected property "${key}".`,
      };
    }
  }

  if (Object.hasOwn(raw, "title") && typeof raw["title"] !== "string") {
    return {
      ok: false,
      code: "invalid-document",
      message: "Document title must be a string when present.",
    };
  }

  const document: SceneDocument =
    typeof raw["title"] === "string"
      ? {
          schemaVersion: DOCUMENT_SCHEMA_VERSION,
          kind: DOCUMENT_KIND,
          id,
          title: raw["title"],
          data: data as Readonly<Record<string, unknown>>,
        }
      : {
          schemaVersion: DOCUMENT_SCHEMA_VERSION,
          kind: DOCUMENT_KIND,
          id,
          data: data as Readonly<Record<string, unknown>>,
        };

  return { ok: true, document };
}

/** Parse JSON text then validate as a document. */
export function parseDocumentText(text: string): DocumentValidationResult {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      code: "parse-error",
      message: `Document JSON parse failed: ${message}`,
    };
  }
  return validateDocument(value);
}

/**
 * Canonical text form for documents: 2-space JSON + trailing newline.
 * Byte-stable across propose/apply and direct-edit paths.
 */
export function serializeDocument(document: SceneDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

/** Build a valid v1 document (factory for fixtures and direct edits). */
export function createDocument(input: {
  readonly id: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly title?: string;
}): SceneDocument {
  return input.title === undefined
    ? {
        schemaVersion: DOCUMENT_SCHEMA_VERSION,
        kind: DOCUMENT_KIND,
        id: input.id,
        data: input.data ?? {},
      }
    : {
        schemaVersion: DOCUMENT_SCHEMA_VERSION,
        kind: DOCUMENT_KIND,
        id: input.id,
        title: input.title,
        data: input.data ?? {},
      };
}
