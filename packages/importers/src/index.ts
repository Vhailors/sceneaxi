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
