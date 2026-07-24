/** SceneAxi-owned deterministic sculpt reconstruction pipeline. */
import { createHash } from "node:crypto";
import {
  OBJECT_SCULPT_SPEC_KIND,
  SCULPT_ARTIFACT_KIND,
  SCULPT_SCHEMA_VERSION,
  isSculptQualityObjectSculptSpec,
  normalizeObjectSculptSpec,
  projectAnimationReadyHierarchy,
  validateObjectSculptSpec,
  validateSculptArtifact,
  validateSculptIntake,
  type JsonValue,
  type SculptArtifact,
  type SculptHierarchyNode,
  type SculptIntake,
  type SculptQualityArtifact,
  type SculptQualityGateEvidence,
  type SculptQualityObjectSculptSpec,
} from "@sceneaxi/schemas";
import {
  SCULPT_PROCEDURAL_EXPORT_NAME,
  SCULPT_PROCEDURAL_MODULE_ID,
  SCULPT_PROCEDURAL_SOURCE_DIGEST,
  emitSculptProcedural,
} from "./sculpt-procedural-emit.js";
import {
  canonicalJson,
  digestBytes,
  digestJson,
  snapshotJsonValue,
} from "./json-invariants.js";

export type SculptReconstructionRefusalCode =
  | "invalid-intake"
  | "unsupported-intake-mode"
  | "quality-gate-refused"
  | "artifact-invalid"
  | "invalid-options"
  | "offline-agent-unavailable"
  | "offline-agent-invalid"
  | "offline-agent-nondeterministic";

export type SculptOfflineAgent = {
  readonly refine: (
    spec: SculptQualityObjectSculptSpec,
  ) => SculptQualityObjectSculptSpec;
};

export type SculptReconstructionOptions = {
  readonly seed?: number;
  readonly enableOfflineAgent?: boolean;
  readonly offlineAgent?: SculptOfflineAgent;
};

export type SculptReconstructionResult =
  | {
      readonly ok: true;
      readonly artifact: SculptQualityArtifact;
      readonly artifactBytes: string;
      readonly artifactDigest: string;
    }
  | {
      readonly ok: false;
      readonly code: SculptReconstructionRefusalCode;
      readonly gate?: string;
      readonly message: string;
    };

function snapshotObjectSculptSpec(
  spec: SculptQualityObjectSculptSpec,
): SculptQualityObjectSculptSpec {
  return snapshotJsonValue(
    spec,
  );
}

function snapshotSculptArtifact(
  artifact: SculptQualityArtifact,
): SculptQualityArtifact {
  return snapshotJsonValue(
    artifact,
  );
}

/** Byte-canonical form used by fixture evidence and artifact digests. */
export function serializeSculptArtifact(artifact: SculptArtifact) {
  return `${canonicalJson(artifact as unknown as JsonValue)}\n`;
}

function hierarchyDepth(nodes: readonly SculptHierarchyNode[]) {
  const parents = new Map(nodes.map((node) => [node.id, node.parentId]));
  let maximum = 0;
  for (const node of nodes) {
    let depth = 0;
    let cursor: string | null | undefined = node.id;
    while (cursor !== null && cursor !== undefined) {
      depth += 1;
      cursor = parents.get(cursor);
    }
    maximum = Math.max(maximum, depth);
  }
  return maximum;
}

function qualityGateEvidence(spec: SculptQualityObjectSculptSpec):
  | { readonly ok: true; readonly evidence: readonly SculptQualityGateEvidence[] }
  | { readonly ok: false; readonly gate: string; readonly message: string } {
  const checks = [
    {
      id: "component-budget",
      passed: spec.components.length <= 64,
      value: spec.components.length,
      limit: 64,
    },
    {
      id: "hierarchy-depth",
      passed: hierarchyDepth(spec.hierarchy) <= 16,
      value: hierarchyDepth(spec.hierarchy),
      limit: 16,
    },
    {
      id: "physical-extent",
      passed: spec.components.every((component) => component.dimensions.every((axis) => axis <= 100)),
      value: Math.max(...spec.components.flatMap((component) => component.dimensions)),
      limit: 100,
    },
  ] as const;
  const failed = checks.find((check) => !check.passed);
  if (failed !== undefined) {
    return {
      ok: false,
      gate: failed.id,
      message: `Sculpt quality gate "${failed.id}" refused value ${failed.value}; limit is ${failed.limit}.`,
    };
  }
  return {
    ok: true,
    evidence: checks.map((check) => ({
      id: check.id,
      status: "passed" as const,
      digest: digestJson({ id: check.id, limit: check.limit, value: check.value }),
    })),
  };
}

function specFromImageAndBrief(
  intake: Extract<SculptIntake, { mode: "image+brief" }>,
): SculptQualityObjectSculptSpec {
  const color = `#${intake.image.digest.slice("sha256:".length, "sha256:".length + 6)}`;
  const accent = `#${createHash("sha256").update(intake.brief).digest("hex").slice(0, 6)}`;
  const rootId = `${intake.intakeId}-body`;
  const detailId = `${intake.intakeId}-detail`;
  const identity = {
    translation: [0, 0, 0],
    rotationEulerDegrees: [0, 0, 0],
    scale: [1, 1, 1],
  } as const;
  return {
    schemaVersion: SCULPT_SCHEMA_VERSION,
    kind: OBJECT_SCULPT_SPEC_KIND,
    id: `${intake.intakeId}-spec`,
    rootNodeId: rootId,
    complexityClass: "simple",
    passes: [
      { id: "blockout", deterministic: true, steps: ["derive-primary-volume"] },
      { id: "structure", deterministic: true, steps: ["place-body-and-detail"] },
      { id: "materials", deterministic: true, steps: ["derive-hash-materials"] },
      { id: "sockets", deterministic: true, steps: ["bind-detail-animation"] },
    ],
    materials: [
      { id: "primary", baseColor: color, metallic: 0.1, roughness: 0.7 },
      { id: "accent", baseColor: accent, metallic: 0.3, roughness: 0.45 },
    ],
    components: [
      { id: "body", primitive: "box", dimensions: [2, 2, 2], materialId: "primary" },
      { id: "detail", primitive: "cylinder", dimensions: [0.45, 1.2, 0.45], materialId: "accent" },
    ],
    hierarchy: [
      { id: rootId, parentId: null, componentId: "body", transform: identity },
      {
        id: detailId,
        parentId: rootId,
        componentId: "detail",
        transform: { ...identity, translation: [0, 1.6, 0] },
      },
    ],
    sockets: [
      {
        id: "detail-bob",
        nodeId: detailId,
        kind: "animation",
        axis: "y",
        amplitude: 0.2,
        frequencyHz: 1,
      },
      {
        id: "detail-attachment",
        nodeId: detailId,
        kind: "attachment",
        axis: "y",
        amplitude: 0,
        frequencyHz: 0,
      },
    ],
  };
}

/**
 * Reconstruct an openable Sculpt Artifact without a live provider dependency.
 * Image+brief is deliberately demo-grade; production spend requires a separate gate.
 */
export function reconstructSculpt(
  intakeValue: unknown,
  options: SculptReconstructionOptions = {},
): SculptReconstructionResult {
  const validatedIntake = validateSculptIntake(intakeValue);
  if (!validatedIntake.ok) {
    return {
      ok: false,
      code: "invalid-intake",
      message: validatedIntake.diagnostics[0]?.message ?? "Sculpt Intake refused.",
    };
  }
  const intake = validatedIntake.value;
  if (intake.mode !== "structured-spec" && intake.mode !== "image+brief") {
    return {
      ok: false,
      code: "unsupported-intake-mode",
      message: `Reconstruction v1 supports structured-spec and image+brief; mode "${intake.mode}" has no authorized reconstruction path.`,
    };
  }

  const seed = options.seed ?? 0;
  if (!Number.isSafeInteger(seed) || seed < 0) {
    return {
      ok: false,
      code: "invalid-options",
      message: "Sculpt reconstruction seed must be a non-negative safe integer.",
    };
  }
  let spec = normalizeObjectSculptSpec(
    intake.mode === "structured-spec"
      ? intake.structuredSpec
      : specFromImageAndBrief(intake),
  );
  if (options.enableOfflineAgent === true) {
    if (options.offlineAgent === undefined) {
      return {
        ok: false,
        code: "offline-agent-unavailable",
        message: "Offline sculpt agent flag is enabled but no injected offline adapter is available.",
      };
    }
    let first: SculptQualityObjectSculptSpec;
    try {
      const firstCandidate = options.offlineAgent.refine(structuredClone(spec));
      const firstValidation = validateObjectSculptSpec(firstCandidate);
      if (
        !firstValidation.ok ||
        !isSculptQualityObjectSculptSpec(firstValidation.value)
      ) {
        return {
          ok: false,
          code: "offline-agent-invalid",
          message: "Injected offline sculpt agent returned an invalid ObjectSculptSpec.",
        };
      }
      first = snapshotObjectSculptSpec(firstValidation.value);
    } catch {
      return {
        ok: false,
        code: "offline-agent-invalid",
        message: "Injected offline sculpt agent failed while refining the spec.",
      };
    }
    let second: SculptQualityObjectSculptSpec;
    try {
      const secondCandidate = options.offlineAgent.refine(structuredClone(spec));
      const secondValidation = validateObjectSculptSpec(secondCandidate);
      if (
        !secondValidation.ok ||
        !isSculptQualityObjectSculptSpec(secondValidation.value)
      ) {
        return {
          ok: false,
          code: "offline-agent-invalid",
          message: "Injected offline sculpt agent returned an invalid ObjectSculptSpec.",
        };
      }
      second = snapshotObjectSculptSpec(secondValidation.value);
    } catch {
      return {
        ok: false,
        code: "offline-agent-invalid",
        message: "Injected offline sculpt agent failed while refining the spec.",
      };
    }
    if (
      canonicalJson(first as unknown as JsonValue) !==
      canonicalJson(second as unknown as JsonValue)
    ) {
      return {
        ok: false,
        code: "offline-agent-nondeterministic",
        message: "Injected offline sculpt agent returned different results for identical input.",
      };
    }
    spec = first;
  }
  spec = snapshotObjectSculptSpec(spec);
  const gates = qualityGateEvidence(spec);
  if (!gates.ok) {
    return {
      ok: false,
      code: "quality-gate-refused",
      gate: gates.gate,
      message: gates.message,
    };
  }

  const proceduralEmit = emitSculptProcedural(spec, { seed });
  const artifact: SculptQualityArtifact = {
    schemaVersion: SCULPT_SCHEMA_VERSION,
    kind: SCULPT_ARTIFACT_KIND,
    artifactId: `${intake.intakeId}-artifact`,
    spec,
    proceduralModule: {
      moduleId: SCULPT_PROCEDURAL_MODULE_ID,
      exportName: SCULPT_PROCEDURAL_EXPORT_NAME,
      sourceDigest: SCULPT_PROCEDURAL_SOURCE_DIGEST,
      seed,
      emitDigest: proceduralEmit.digest,
    },
    runtimeHierarchy: projectAnimationReadyHierarchy(spec),
    evidence: {
      method: intake.mode === "structured-spec" ? "structured-fixture" : "image-brief-reconstruction",
      intakeDigest: digestJson(intake as unknown as JsonValue),
      specDigest: digestJson(spec as unknown as JsonValue),
      proceduralModuleDigest: SCULPT_PROCEDURAL_SOURCE_DIGEST,
      qualityGates: [
        ...gates.evidence,
        { id: "procedural-emit", status: "passed", digest: proceduralEmit.digest },
      ],
    },
  };
  const validatedArtifact = validateSculptArtifact(artifact);
  if (!validatedArtifact.ok) {
    return {
      ok: false,
      code: "artifact-invalid",
      message: validatedArtifact.diagnostics[0]?.message ?? "Generated Sculpt Artifact refused.",
    };
  }
  const artifactSnapshot = snapshotSculptArtifact(
    validatedArtifact.value as SculptQualityArtifact,
  );
  const artifactBytes = serializeSculptArtifact(artifactSnapshot);
  return {
    ok: true,
    artifact: artifactSnapshot,
    artifactBytes,
    artifactDigest: digestBytes(artifactBytes),
  };
}
