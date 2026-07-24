/**
 * @sceneaxi/importers — external content adapters that feed the public
 * authoring-core propose/apply service. No importer reaches engine internals.
 */
import {
  apply,
  parseDocumentText,
  propose,
  type ApplyDiagnostic,
  type ApplyResult,
  type Proposal,
  type SceneDocument,
} from "@sceneaxi/authoring-core";
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/importers",
  releaseGroup: "importers",
});

export type SceneDocumentImportInput = Readonly<{
  /** Text-canonical SceneAxi document received from an external source. */
  sourceText: string;
  /** Existing Core document whose `/data` content receives the import. */
  targetDocumentPath: string;
  readonly cwd?: string;
}>;

export type SceneDocumentImportPlanOk = Readonly<{
  ok: true;
  sourceDocument: SceneDocument;
  proposal: Proposal;
  unifiedDiff: string;
}>;

export type SceneDocumentImportPlanRefuse = Readonly<{
  ok: false;
  stage: "validate" | "propose";
  diagnostics: readonly ApplyDiagnostic[];
}>;

export type SceneDocumentImportPlanResult =
  | SceneDocumentImportPlanOk
  | SceneDocumentImportPlanRefuse;

export type SceneDocumentImportApplyResult =
  | Readonly<{
      ok: true;
      sourceDocument: SceneDocument;
      proposal: Proposal;
      unifiedDiff: string;
      apply: Extract<ApplyResult, { ok: true }>;
    }>
  | SceneDocumentImportPlanRefuse
  | Readonly<{
      ok: false;
      stage: "apply";
      sourceDocument: SceneDocument;
      proposal: Proposal;
      unifiedDiff: string;
      apply: Exclude<ApplyResult, { ok: true }>;
    }>;

type JsonMemberScan = Readonly<{
  index: number;
  duplicateKey: string | null;
}>;

function skipJsonWhitespace(source: string, index: number) {
  let cursor = index;
  while (
    source[cursor] === " " ||
    source[cursor] === "\t" ||
    source[cursor] === "\n" ||
    source[cursor] === "\r"
  ) {
    cursor += 1;
  }
  return cursor;
}

function scanJsonString(source: string, index: number) {
  if (source[index] !== "\"") return undefined;
  let cursor = index + 1;
  while (cursor < source.length) {
    const character = source[cursor];
    if (character === "\"") {
      const end = cursor + 1;
      const value: unknown = JSON.parse(source.slice(index, end));
      return typeof value === "string" ? { index: end, value } : undefined;
    }
    if (character === "\\") {
      cursor += source[cursor + 1] === "u" ? 6 : 2;
    } else {
      cursor += 1;
    }
  }
  return undefined;
}

function scanJsonArray(source: string, index: number): JsonMemberScan | undefined {
  let cursor = skipJsonWhitespace(source, index + 1);
  let duplicateKey: string | null = null;
  if (source[cursor] === "]") return { index: cursor + 1, duplicateKey };
  while (cursor < source.length) {
    const value = scanJsonValue(source, cursor);
    if (value === undefined) return undefined;
    duplicateKey ??= value.duplicateKey;
    cursor = skipJsonWhitespace(source, value.index);
    if (source[cursor] === "]") {
      return { index: cursor + 1, duplicateKey };
    }
    if (source[cursor] !== ",") return undefined;
    cursor = skipJsonWhitespace(source, cursor + 1);
  }
  return undefined;
}

function scanJsonObject(source: string, index: number): JsonMemberScan | undefined {
  let cursor = skipJsonWhitespace(source, index + 1);
  let duplicateKey: string | null = null;
  const keys = new Set<string>();
  if (source[cursor] === "}") return { index: cursor + 1, duplicateKey };
  while (cursor < source.length) {
    const key = scanJsonString(source, cursor);
    if (key === undefined) return undefined;
    if (keys.has(key.value)) duplicateKey ??= key.value;
    keys.add(key.value);
    cursor = skipJsonWhitespace(source, key.index);
    if (source[cursor] !== ":") return undefined;
    const value = scanJsonValue(source, skipJsonWhitespace(source, cursor + 1));
    if (value === undefined) return undefined;
    duplicateKey ??= value.duplicateKey;
    cursor = skipJsonWhitespace(source, value.index);
    if (source[cursor] === "}") {
      return { index: cursor + 1, duplicateKey };
    }
    if (source[cursor] !== ",") return undefined;
    cursor = skipJsonWhitespace(source, cursor + 1);
  }
  return undefined;
}

function scanJsonValue(source: string, index: number): JsonMemberScan | undefined {
  const cursor = skipJsonWhitespace(source, index);
  const character = source[cursor];
  if (character === "{") return scanJsonObject(source, cursor);
  if (character === "[") return scanJsonArray(source, cursor);
  if (character === "\"") {
    const value = scanJsonString(source, cursor);
    return value === undefined
      ? undefined
      : { index: value.index, duplicateKey: null };
  }
  for (const literal of ["true", "false", "null"]) {
    if (source.startsWith(literal, cursor)) {
      return { index: cursor + literal.length, duplicateKey: null };
    }
  }
  const number = source
    .slice(cursor)
    .match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
  return number?.[0] === undefined
    ? undefined
    : { index: cursor + number[0].length, duplicateKey: null };
}

function inspectJsonMembers(source: string) {
  try {
    const result = scanJsonValue(source, 0);
    if (
      result === undefined ||
      skipJsonWhitespace(source, result.index) !== source.length
    ) {
      return { ok: false as const };
    }
    return { ok: true as const, duplicateKey: result.duplicateKey };
  } catch {
    return { ok: false as const };
  }
}

/**
 * Validate one full text-canonical external document, then propose replacing
 * the target Core document's content. Target identity stays local; imported
 * data remains reviewable as a normal authoring proposal and unified diff.
 */
export function proposeSceneDocumentImport(
  input: SceneDocumentImportInput,
): SceneDocumentImportPlanResult {
  if (typeof input.sourceText !== "string") {
    return {
      ok: false,
      stage: "validate",
      diagnostics: [
        {
          code: "parse-error",
          message: "External SceneAxi document input must be text.",
        },
      ],
    };
  }

  const memberInspection = inspectJsonMembers(input.sourceText);
  if (!memberInspection.ok || memberInspection.duplicateKey !== null) {
    return {
      ok: false,
      stage: "validate",
      diagnostics: [
        {
          code: "parse-error",
          message: memberInspection.ok
            ? `External SceneAxi document contains duplicate JSON member '${memberInspection.duplicateKey}'.`
            : "External SceneAxi document is not valid unambiguous JSON text.",
        },
      ],
    };
  }

  const parsed = parseDocumentText(input.sourceText);
  if (!parsed.ok) {
    return {
      ok: false,
      stage: "validate",
      diagnostics: [
        {
          code:
            parsed.code === "schema-major-mismatch"
              ? "schema-major-mismatch"
              : parsed.code === "parse-error"
                ? "parse-error"
                : "invalid-document",
          message: parsed.message,
        },
      ],
    };
  }

  const proposed = propose({
    documentPath: input.targetDocumentPath,
    jsonPointer: "/data",
    newValue: parsed.document.data,
    ...(input.cwd === undefined ? {} : { cwd: input.cwd }),
  });
  if (!proposed.ok) {
    return {
      ok: false,
      stage: "propose",
      diagnostics: proposed.diagnostics,
    };
  }

  return Object.freeze({
    ok: true,
    sourceDocument: parsed.document,
    proposal: proposed.proposal,
    unifiedDiff: proposed.unifiedDiff,
  });
}

/** Validate → propose → apply through authoring-core's public service. */
export function applySceneDocumentImport(
  input: SceneDocumentImportInput,
): SceneDocumentImportApplyResult {
  const planned = proposeSceneDocumentImport(input);
  if (!planned.ok) return planned;

  const applied = apply({
    proposal: planned.proposal,
    ...(input.cwd === undefined ? {} : { cwd: input.cwd }),
  });
  if (!applied.ok) {
    return Object.freeze({
      ok: false,
      stage: "apply" as const,
      sourceDocument: planned.sourceDocument,
      proposal: planned.proposal,
      unifiedDiff: planned.unifiedDiff,
      apply: applied,
    });
  }

  return Object.freeze({
    ok: true,
    sourceDocument: planned.sourceDocument,
    proposal: planned.proposal,
    unifiedDiff: planned.unifiedDiff,
    apply: applied,
  });
}
