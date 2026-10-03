/**
 * @sceneaxi/importers — external content adapters that feed the public
 * authoring-core propose/apply service. No importer reaches engine internals.
 */
import { Buffer } from "node:buffer";
import {
  apply,
  validateDocument,
  propose,
  type ApplyDiagnostic,
  type ApplyResult,
  type Proposal,
  type SceneDocument,
} from "@sceneaxi/authoring-core";
import {
  parseUnambiguousJson,
  type PackageSeam,
  type JsonValue,
} from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/importers",
  releaseGroup: "importers",
});

export {
  CONTAINED_GLTF_PROFILE_ID,
  CONTAINED_GLTF_REFUSALS,
  LEGACY_PROJECT_ASSET_MANIFEST_SCHEMA_VERSION,
  PROJECT_ASSET_COPY_POLICY,
  PROJECT_ASSET_DIRECTORY,
  PROJECT_ASSET_MANIFEST_KEY,
  PROJECT_ASSET_MANIFEST_KIND,
  PROJECT_ASSET_MANIFEST_SCHEMA_VERSION,
  PROJECT_ASSET_PROFILES,
  PROJECT_ASSET_SUPPORTED_PROFILES,
  PROJECT_ASSET_MAX_BYTES,
  PROJECT_ASSET_MAX_COUNT,
  projectAssetPreparationBaseHash,
  verifyPreparedProjectAssetImport,
  materializeProjectAssetCopies,
  projectAssetManifestEntry,
  projectAssetManifestFromDocumentData,
  proposeProjectAssetImport,
  proposeContainedGltfAssetImport,
  stageContainedGltfAssetImport,
  stageProjectAssetImport,
  type AssetCopyFilesystem,
  type ContainedGltfNode,
  type ContainedGltfProjection,
  type ContainedGltfProposalResult,
  type ContainedGltfRefusal,
  type ContainedGltfStageResult,
  type ImportedAssetRenderMesh,
  type MaterializeAssetCopiesResult,
  type ProjectAssetManifest,
  type ProjectAssetManifestEntry,
  type ProjectAssetFamily,
  type ProjectAssetPreview,
  type ProjectAssetProfile,
  type ProjectAssetProjection,
  type ProjectAssetProposalResult,
  type ProjectAssetStageResult,
} from "./contained-gltf.js";

export {
  startProjectAssetPreparation,
  ASSET_PREPARATION_REFUSALS,
  ASSET_PREPARATION_DEADLINE_MS,
  type ProjectAssetPreparationInput,
  type ProjectAssetPreparationOutcome,
  type ProjectAssetPreparationJob,
} from "./asset-preparation-worker.js";

export type SceneDocumentImportInput = Readonly<{
  /** Text-canonical SceneAxi document received from an external source. */
  sourceText: string;
  /** Existing Core document whose `/data` content receives the import. */
  targetDocumentPath: string;
  readonly cwd?: string;
  /** Cooperative boundary cancellation; synchronous parsing cannot be interrupted. */
  readonly signal?: AbortSignal;
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

type DocumentProposalRequest = { -readonly [Key in keyof Parameters<typeof propose>[0]]: Parameters<typeof propose>[0][Key] };

type DocumentApplyRequest = { -readonly [Key in keyof Parameters<typeof apply>[0]]: Parameters<typeof apply>[0][Key] };

// Preflight before recursive shared services; no new document dialect.
const SCENE_DOCUMENT_MAXIMUM_BYTES = 8 * 1024 * 1024;

const SCENE_DOCUMENT_MAXIMUM_DEPTH = 64;

const SCENE_DOCUMENT_MAXIMUM_VALUES = 250_000;

function withinDocumentBudget(value: unknown): value is JsonValue {
  const pending = [{ value, depth: 0 }];
  let count = 0;

  while (pending.length > 0) {
    const current = pending.pop();

    if (current === undefined) break;

    if (++count > SCENE_DOCUMENT_MAXIMUM_VALUES || current.depth > SCENE_DOCUMENT_MAXIMUM_DEPTH) return false;

    if (isObjectRepresentation(current.value) && current.value !== null) {
      const children: unknown[] = Object.values(current.value);

      if (count + pending.length + children.length > SCENE_DOCUMENT_MAXIMUM_VALUES) return false;

      for (const child of children) pending.push({ value: child, depth: current.depth + 1 });
    } else if (!isJsonPrimitive(current.value)) {
      return false;
    }
  }

  return true;
}

function deepFreeze<T extends object>(value: T): T {
  const pending: object[] = [value];
  const seen = new Set<object>();

  while (pending.length > 0) {
    const current = pending.pop();

    if (current === undefined || seen.has(current)) continue;
    seen.add(current);

    for (const nested of Object.values(current)) {
      if (isObjectRepresentation(nested) && nested !== null) pending.push(nested);
    }

    Object.freeze(current);
  }

  return value;
}

function cancelledDocumentImport(): SceneDocumentImportPlanRefuse {
  return {
    ok: false,
    stage: "validate",
    diagnostics: [{
      code: "validation-failed",
      message: "Scene Document import cancelled before mutation.",
    }],
  };
}

/**
 * Validate one full text-canonical external document, then propose replacing
 * the target Core document's content. Target identity stays local; imported
 * data remains reviewable as a normal authoring proposal and unified diff.
 */
export function proposeSceneDocumentImport(
  input: SceneDocumentImportInput,
): SceneDocumentImportPlanResult {
  const signal = input.signal;

  if (signal?.aborted) return cancelledDocumentImport();
  const sourceText = input.sourceText;

  if (!isText(sourceText)) {
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

  if (Buffer.byteLength(sourceText, "utf8") > SCENE_DOCUMENT_MAXIMUM_BYTES) {
    return { ok: false, stage: "validate", diagnostics: [{ code: "invalid-document", message: "External SceneAxi document exceeds the 8 MiB input limit." }] };
  }

  const jsonParse = parseUnambiguousJson(sourceText);

  if (!jsonParse.ok) {
    return {
      ok: false,
      stage: "validate",
      diagnostics: [
        {
          code: "parse-error",
          message: jsonParse.code === "duplicate-json-member"
            ? `External SceneAxi document contains duplicate JSON member at '${jsonParse.path}'.`
            : "External SceneAxi document is not valid unambiguous JSON text.",
        },
      ],
    };
  }

  if (!withinDocumentBudget(jsonParse.value)) {
    return { ok: false, stage: "validate", diagnostics: [{ code: "invalid-document", message: "External SceneAxi document exceeds depth 64 or 250000 JSON values." }] };
  }

  // Validate the already admitted snapshot; do not parse/allocate the document twice.
  if (signal?.aborted) return cancelledDocumentImport();
  const parsed = validateDocument(jsonParse.value);

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

  const sourceDocument = deepFreeze(parsed.document);

  const proposalInput: DocumentProposalRequest = {
    documentPath: input.targetDocumentPath,
    jsonPointer: "/data",
    newValue: sourceDocument.data,
  };

  if (input.cwd !== undefined) proposalInput.cwd = input.cwd;

  if (signal?.aborted) return cancelledDocumentImport();
  const proposed = propose(proposalInput);

  if (signal?.aborted) return cancelledDocumentImport();

  if (!proposed.ok) {
    return {
      ok: false,
      stage: "propose",
      diagnostics: proposed.diagnostics,
    };
  }

  const proposal = deepFreeze(proposed.proposal);

  return Object.freeze({
    ok: true,
    sourceDocument,
    proposal,
    unifiedDiff: proposed.unifiedDiff,
  });
}

/** Validate → propose → apply through authoring-core's public service. */
export function applySceneDocumentImport(
  input: SceneDocumentImportInput,
): SceneDocumentImportApplyResult {
  const planned = proposeSceneDocumentImport(input);

  if (!planned.ok) return planned;

  const applyInput: DocumentApplyRequest = { proposal: planned.proposal };

  if (input.cwd !== undefined) applyInput.cwd = input.cwd;

  // Last safe cancellation boundary: never interrupt an atomic apply/rollback.
  if (input.signal?.aborted) return cancelledDocumentImport();
  const applied = apply(applyInput);

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

function isText(value: unknown): value is string {
  return typeof value === "string";
}

function isObjectRepresentation(value: unknown): value is object | null {
  return isBoundaryObjectValue(value);
}

function isJsonPrimitive(value: unknown): value is string | number | boolean | null {
  return value === null || isBoundaryTextValue(value) || isBoundaryBooleanValue(value) || (isBoundaryNumericValue(value) && Number.isFinite(value));
}

type BoundaryObjectValue = object | null;

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}

function isBoundaryTextValue<Input>(value: Input): value is Input & string {
  return typeof value === "string";
}

function isBoundaryBooleanValue<Input>(value: Input): value is Input & boolean {
  return typeof value === "boolean";
}

function isBoundaryNumericValue<Input>(value: Input): value is Input & number {
  return typeof value === "number";
}
