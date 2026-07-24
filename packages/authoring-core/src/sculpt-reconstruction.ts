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
  validateSculptQualityArtifact,
  type JsonValue,
  type LegacyObjectSculptSpec,
  type LegacySculptArtifact,
  type ObjectSculptSpec,
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

const LEGACY_PIPELINE_MODULE_ID = "sceneaxi/sculpt-reconstruction-v1";
const LEGACY_PIPELINE_EXPORT_NAME = "buildSculptArtifact";
const LEGACY_PIPELINE_SOURCE =
  "sceneaxi-owned:sculpt-reconstruction:v1:primitive-hierarchy";

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
      readonly artifact: SculptArtifact;
      readonly artifactBytes: string;
      readonly artifactDigest: string;
    }
  | {
      readonly ok: false;
      readonly code: SculptReconstructionRefusalCode;
      readonly gate?: string;
      readonly message: string;
    };

function snapshotObjectSculptSpec<Spec extends ObjectSculptSpec>(
  spec: Spec,
): Spec {
  return snapshotJsonValue(spec);
}

function snapshotSculptArtifact<Artifact extends SculptArtifact>(
  artifact: Artifact,
): Artifact {
  return snapshotJsonValue(artifact);
}

type OfflineProbeResult =
  | { readonly ok: true; readonly spec: SculptQualityObjectSculptSpec }
  | {
      readonly ok: false;
      readonly refusal: Extract<SculptReconstructionResult, { readonly ok: false }>;
    };

function probeOfflineAgent(
  offlineAgent: SculptOfflineAgent,
  spec: SculptQualityObjectSculptSpec,
): OfflineProbeResult {
  try {
    const candidate = offlineAgent.refine(structuredClone(spec));
    const validation = validateObjectSculptSpec(candidate);
    if (
      !validation.ok ||
      !isSculptQualityObjectSculptSpec(validation.value)
    ) {
      return {
        ok: false,
        refusal: {
          ok: false,
          code: "offline-agent-invalid",
          message: "Injected offline sculpt agent returned an invalid ObjectSculptSpec.",
        },
      };
    }
    return { ok: true, spec: snapshotObjectSculptSpec(validation.value) };
  } catch {
    return {
      ok: false,
      refusal: {
        ok: false,
        code: "offline-agent-invalid",
        message: "Injected offline sculpt agent failed while refining the spec.",
      },
    };
  }
}

/** Byte-canonical form used by fixture evidence and artifact digests. */
export function serializeSculptArtifact(artifact: SculptArtifact) {
  return `${canonicalJson(artifact as unknown as JsonValue)}\n`;
}

function hierarchyDepth(
  nodes: readonly SculptHierarchyNode[],
  limit: number,
) {
  const parents = new Map(nodes.map((node) => [node.id, node.parentId]));
  const depths = new Map<string, number>();
  let maximum = 0;
  for (const node of nodes) {
    const path: string[] = [];
    let cursor: string | null | undefined = node.id;
    while (
      cursor !== null &&
      cursor !== undefined &&
      !depths.has(cursor)
    ) {
      path.push(cursor);
      if (path.length > limit) return limit + 1;
      cursor = parents.get(cursor);
    }
    let depth = cursor === null || cursor === undefined
      ? 0
      : (depths.get(cursor) ?? 0);
    for (let index = path.length - 1; index >= 0; index -= 1) {
      depth += 1;
      const nodeId = path[index];
      if (nodeId !== undefined) depths.set(nodeId, depth);
      if (depth > limit) return limit + 1;
    }
    if (depth > maximum) maximum = depth;
  }
  return maximum;
}

function qualityGateRefusal(id: string, value: number, limit: number) {
  return {
    ok: false as const,
    gate: id,
    message: `Sculpt quality gate "${id}" refused value ${value}; limit is ${limit}.`,
  };
}

function qualityGatePass(id: string, value: number, limit: number) {
  return {
    id,
    status: "passed" as const,
    digest: digestJson({ id, limit, value }),
  };
}

function qualityGateEvidence(spec: ObjectSculptSpec):
  | { readonly ok: true; readonly evidence: readonly SculptQualityGateEvidence[] }
  | { readonly ok: false; readonly gate: string; readonly message: string } {
  const evidence: SculptQualityGateEvidence[] = [];
  const componentCount = spec.components.length;
  if (componentCount > 64) {
    return qualityGateRefusal("component-budget", componentCount, 64);
  }
  evidence.push(qualityGatePass("component-budget", componentCount, 64));

  const depth = hierarchyDepth(spec.hierarchy, 16);
  if (depth > 16) {
    return qualityGateRefusal("hierarchy-depth", depth, 16);
  }
  evidence.push(qualityGatePass("hierarchy-depth", depth, 16));

  let physicalExtent = 0;
  for (const component of spec.components) {
    for (const axis of component.dimensions) {
      if (axis > physicalExtent) physicalExtent = axis;
      if (physicalExtent > 100) {
        return qualityGateRefusal(
          "physical-extent",
          physicalExtent,
          100,
        );
      }
    }
  }
  evidence.push(qualityGatePass("physical-extent", physicalExtent, 100));

  return {
    ok: true,
    evidence,
  };
}

function specFromImageAndBrief(
  intake: Extract<SculptIntake, { mode: "image+brief" }>,
): LegacyObjectSculptSpec {
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
    ],
  };
}

function reconstructLegacyArtifact(
  intake: SculptIntake,
  spec: LegacyObjectSculptSpec,
): SculptReconstructionResult {
  const gates = qualityGateEvidence(spec);
  if (!gates.ok) {
    return {
      ok: false,
      code: "quality-gate-refused",
      gate: gates.gate,
      message: gates.message,
    };
  }
  const specSnapshot = snapshotObjectSculptSpec(spec);
  const moduleDigest = digestBytes(LEGACY_PIPELINE_SOURCE);
  const artifact: LegacySculptArtifact = {
    schemaVersion: SCULPT_SCHEMA_VERSION,
    kind: SCULPT_ARTIFACT_KIND,
    artifactId: `${intake.intakeId}-artifact`,
    spec: specSnapshot,
    proceduralModule: {
      moduleId: LEGACY_PIPELINE_MODULE_ID,
      exportName: LEGACY_PIPELINE_EXPORT_NAME,
      sourceDigest: moduleDigest,
    },
    runtimeHierarchy: {
      rootNodeId: specSnapshot.rootNodeId,
      nodes: specSnapshot.hierarchy,
    },
    evidence: {
      method: intake.mode === "structured-spec"
        ? "structured-fixture"
        : "image-brief-reconstruction",
      intakeDigest: digestJson(intake as unknown as JsonValue),
      specDigest: digestJson(specSnapshot as unknown as JsonValue),
      proceduralModuleDigest: moduleDigest,
      qualityGates: gates.evidence,
    },
  };
  const validatedArtifact = validateSculptArtifact(artifact);
  if (!validatedArtifact.ok) {
    return {
      ok: false,
      code: "artifact-invalid",
      message:
        validatedArtifact.diagnostics[0]?.message ??
        "Generated Sculpt Artifact refused.",
    };
  }
  const artifactSnapshot = snapshotSculptArtifact(
    validatedArtifact.value as LegacySculptArtifact,
  );
  const artifactBytes = serializeSculptArtifact(artifactSnapshot);
  return {
    ok: true,
    artifact: artifactSnapshot,
    artifactBytes,
    artifactDigest: digestBytes(artifactBytes),
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
  const inputSpec = intake.mode === "structured-spec"
    ? intake.structuredSpec
    : specFromImageAndBrief(intake);
  const qualityRequested =
    isSculptQualityObjectSculptSpec(inputSpec) ||
    options.seed !== undefined ||
    options.enableOfflineAgent === true;
  if (!qualityRequested) {
    return reconstructLegacyArtifact(
      intake,
      inputSpec as LegacyObjectSculptSpec,
    );
  }
  let spec = normalizeObjectSculptSpec(inputSpec);
  if (options.enableOfflineAgent === true) {
    if (options.offlineAgent === undefined) {
      return {
        ok: false,
        code: "offline-agent-unavailable",
        message: "Offline sculpt agent flag is enabled but no injected offline adapter is available.",
      };
    }
    const first = probeOfflineAgent(options.offlineAgent, spec);
    if (!first.ok) return first.refusal;
    const second = probeOfflineAgent(options.offlineAgent, spec);
    if (!second.ok) return second.refusal;
    if (
      canonicalJson(first.spec as unknown as JsonValue) !==
      canonicalJson(second.spec as unknown as JsonValue)
    ) {
      return {
        ok: false,
        code: "offline-agent-nondeterministic",
        message: "Injected offline sculpt agent returned different results for identical input.",
      };
    }
    spec = first.spec;
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
  const validatedArtifact = validateSculptQualityArtifact(artifact);
  if (!validatedArtifact.ok) {
    return {
      ok: false,
      code: "artifact-invalid",
      message: validatedArtifact.diagnostics[0]?.message ?? "Generated Sculpt Artifact refused.",
    };
  }
  const artifactSnapshot = snapshotSculptArtifact(validatedArtifact.value);
  const artifactBytes = serializeSculptArtifact(artifactSnapshot);
  return {
    ok: true,
    artifact: artifactSnapshot,
    artifactBytes,
    artifactDigest: digestBytes(artifactBytes),
  };
}
