/**
 * Propose/apply proposal contract (v1).
 *
 * Produced by propose(); consumed by apply(). Carries base content hashes and
 * unified diffs. Multi-document proposals apply all-or-nothing (E1).
 */

import {
  DOCUMENT_SCHEMA_VERSION,
  isJsonValue,
  type JsonValue,
  type SceneDocument,
} from "./document.js";

/** Contract major version for proposals. */
export const PROPOSAL_SCHEMA_VERSION = 1 as const;

export const PROPOSAL_KIND = "sceneaxi.proposal" as const;

/** Content-hash prefix used on document bytes (sha256 hex). */
export const CONTENT_HASH_PREFIX = "sha256:" as const;

export type ProposalEdit = {
  readonly documentPath: string;
  readonly baseContentHash: string;
  readonly jsonPointer: string;
  readonly oldValue: JsonValue;
  readonly newValue: JsonValue;
};

export type ProposalDiff = {
  readonly documentPath: string;
  readonly unifiedDiff: string;
};

export type Proposal = {
  readonly schemaVersion: typeof PROPOSAL_SCHEMA_VERSION;
  readonly kind: typeof PROPOSAL_KIND;
  readonly edits: readonly ProposalEdit[];
  readonly diffs: readonly ProposalDiff[];
};

export type ProposalValidationOk = {
  readonly ok: true;
  readonly proposal: Proposal;
};

export type ProposalValidationRefuse = {
  readonly ok: false;
  readonly code:
    | "schema-major-mismatch"
    | "invalid-proposal"
    | "not-object"
    | "parse-error";
  readonly message: string;
  readonly foundSchemaVersion?: number;
};

export type ProposalValidationResult =
  | ProposalValidationOk
  | ProposalValidationRefuse;

const HASH_RE = /^sha256:[0-9a-f]{64}$/;
// Empty string (whole doc) or slash-prefixed RFC 6901 segments.
const POINTER_RE = /^(\/([^/~]|~[01])*)*$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateEdit(
  value: unknown,
  index: number,
): { ok: true; edit: ProposalEdit } | { ok: false; message: string } {
  if (!isPlainObject(value)) {
    return { ok: false, message: `edits[${index}] must be an object.` };
  }
  const documentPath = value["documentPath"];
  if (typeof documentPath !== "string" || documentPath.length === 0) {
    return {
      ok: false,
      message: `edits[${index}].documentPath must be a non-empty string.`,
    };
  }
  const baseContentHash = value["baseContentHash"];
  if (typeof baseContentHash !== "string" || !HASH_RE.test(baseContentHash)) {
    return {
      ok: false,
      message: `edits[${index}].baseContentHash must match ^sha256:[0-9a-f]{64}$.`,
    };
  }
  const jsonPointer = value["jsonPointer"];
  if (typeof jsonPointer !== "string" || !POINTER_RE.test(jsonPointer)) {
    return {
      ok: false,
      message: `edits[${index}].jsonPointer must be a valid RFC 6901 pointer.`,
    };
  }
  if (!Object.hasOwn(value, "oldValue") || !Object.hasOwn(value, "newValue")) {
    return {
      ok: false,
      message: `edits[${index}] requires oldValue and newValue.`,
    };
  }
  if (!isJsonValue(value["oldValue"]) || !isJsonValue(value["newValue"])) {
    return {
      ok: false,
      message: `edits[${index}].oldValue and newValue must be JSON values.`,
    };
  }
  const known = new Set([
    "documentPath",
    "baseContentHash",
    "jsonPointer",
    "oldValue",
    "newValue",
  ]);
  for (const key of Object.keys(value)) {
    if (!known.has(key)) {
      return {
        ok: false,
        message: `edits[${index}] has unexpected property "${key}".`,
      };
    }
  }
  return {
    ok: true,
    edit: {
      documentPath,
      baseContentHash,
      jsonPointer,
      oldValue: value["oldValue"],
      newValue: value["newValue"],
    },
  };
}

function validateDiff(
  value: unknown,
  index: number,
): { ok: true; diff: ProposalDiff } | { ok: false; message: string } {
  if (!isPlainObject(value)) {
    return { ok: false, message: `diffs[${index}] must be an object.` };
  }
  const documentPath = value["documentPath"];
  if (typeof documentPath !== "string" || documentPath.length === 0) {
    return {
      ok: false,
      message: `diffs[${index}].documentPath must be a non-empty string.`,
    };
  }
  const unifiedDiff = value["unifiedDiff"];
  if (typeof unifiedDiff !== "string") {
    return {
      ok: false,
      message: `diffs[${index}].unifiedDiff must be a string.`,
    };
  }
  const known = new Set(["documentPath", "unifiedDiff"]);
  for (const key of Object.keys(value)) {
    if (!known.has(key)) {
      return {
        ok: false,
        message: `diffs[${index}] has unexpected property "${key}".`,
      };
    }
  }
  return { ok: true, diff: { documentPath, unifiedDiff } };
}

/** Validate an unknown value as a proposal. */
export function validateProposal(value: unknown): ProposalValidationResult {
  if (!isPlainObject(value)) {
    return {
      ok: false,
      code: "not-object",
      message: "Proposal must be a JSON object.",
    };
  }

  if (!Object.hasOwn(value, "schemaVersion")) {
    return {
      ok: false,
      code: "invalid-proposal",
      message: "Proposal missing required property \"schemaVersion\".",
    };
  }

  const schemaVersion = value["schemaVersion"];
  if (typeof schemaVersion !== "number" || !Number.isInteger(schemaVersion)) {
    return {
      ok: false,
      code: "invalid-proposal",
      message: "Proposal schemaVersion must be an integer.",
    };
  }

  if (schemaVersion !== PROPOSAL_SCHEMA_VERSION) {
    return {
      ok: false,
      code: "schema-major-mismatch",
      message: `Proposal schema major mismatch: found ${schemaVersion}, expected ${PROPOSAL_SCHEMA_VERSION}. Silent migration is refused.`,
      foundSchemaVersion: schemaVersion,
    };
  }

  if (value["kind"] !== PROPOSAL_KIND) {
    return {
      ok: false,
      code: "invalid-proposal",
      message: `Proposal kind must be "${PROPOSAL_KIND}".`,
    };
  }

  const editsRaw = value["edits"];
  if (!Array.isArray(editsRaw) || editsRaw.length === 0) {
    return {
      ok: false,
      code: "invalid-proposal",
      message: "Proposal edits must be a non-empty array.",
    };
  }

  const edits: ProposalEdit[] = [];
  for (let i = 0; i < editsRaw.length; i++) {
    const checked = validateEdit(editsRaw[i], i);
    if (!checked.ok) {
      return { ok: false, code: "invalid-proposal", message: checked.message };
    }
    edits.push(checked.edit);
  }

  const diffsRaw = value["diffs"];
  if (!Array.isArray(diffsRaw) || diffsRaw.length === 0) {
    return {
      ok: false,
      code: "invalid-proposal",
      message: "Proposal diffs must be a non-empty array.",
    };
  }

  const diffs: ProposalDiff[] = [];
  for (let i = 0; i < diffsRaw.length; i++) {
    const checked = validateDiff(diffsRaw[i], i);
    if (!checked.ok) {
      return { ok: false, code: "invalid-proposal", message: checked.message };
    }
    diffs.push(checked.diff);
  }

  const known = new Set(["schemaVersion", "kind", "edits", "diffs"]);
  for (const key of Object.keys(value)) {
    if (!known.has(key)) {
      return {
        ok: false,
        code: "invalid-proposal",
        message: `Proposal has unexpected property "${key}".`,
      };
    }
  }

  return {
    ok: true,
    proposal: {
      schemaVersion: PROPOSAL_SCHEMA_VERSION,
      kind: PROPOSAL_KIND,
      edits,
      diffs,
    },
  };
}

/** Parse JSON text then validate as a proposal. */
export function parseProposalText(text: string): ProposalValidationResult {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      code: "parse-error",
      message: `Proposal JSON parse failed: ${message}`,
    };
  }
  return validateProposal(value);
}

/** Canonical text form for proposals. */
export function serializeProposal(proposal: Proposal): string {
  return `${JSON.stringify(proposal, null, 2)}\n`;
}

/** Build a proposal from validated parts. */
export function createProposal(input: {
  readonly edits: readonly ProposalEdit[];
  readonly diffs: readonly ProposalDiff[];
}): Proposal {
  return {
    schemaVersion: PROPOSAL_SCHEMA_VERSION,
    kind: PROPOSAL_KIND,
    edits: input.edits,
    diffs: input.diffs,
  };
}

/** Typed apply diagnostic codes (E1 reject surface). */
export type ApplyDiagnosticCode =
  | "content-hash-conflict"
  | "schema-major-mismatch"
  | "invalid-document"
  | "invalid-proposal"
  | "invalid-pointer"
  | "document-not-found"
  | "validation-failed"
  | "parse-error"
  | "journal-invalid"
  | "journal-not-found"
  | "journal-conflict"
  | "apply-failed"
  | "apply-in-progress";

export type ApplyDiagnostic = {
  readonly code: ApplyDiagnosticCode;
  readonly message: string;
  readonly documentPath?: string;
  /**
   * Present when a safe retry needs fresh document state, including content
   * hash and journal conflicts (E1 clauses 4-5).
   */
  readonly reReadHint?: string;
};

export type ApplyOk = {
  readonly ok: true;
  readonly appliedPaths: readonly string[];
};

export type ApplyReject = {
  readonly ok: false;
  readonly diagnostics: readonly ApplyDiagnostic[];
};

export type ApplyResult = ApplyOk | ApplyReject;

/** Re-export document major for consumers comparing versions. */
export { DOCUMENT_SCHEMA_VERSION };

/** Type alias helper for proposal consumers that need the document type. */
export type { SceneDocument };
