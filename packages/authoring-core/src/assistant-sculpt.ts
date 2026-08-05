/**
 * Assistant prompt → validated Sculpt Artifact.
 *
 * The module owns the authoring half of the product flow and deliberately knows
 * nothing about credits, credentials, or a provider implementation. Local work
 * is a deterministic compiler. BYOK work crosses the existing Model Provider
 * Port and accepts only an exact Sculpt Intake JSON document. A hosted caller
 * must obtain its completion through the billing-owned assistant panel first,
 * then pass the text to `sculptArtifactFromAssistantCompletion`; there is no
 * authoring-core entry point that can bypass the hosted credit gate.
 */
import { createHash } from "node:crypto";
import {
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  OBJECT_SCULPT_SPEC_KIND,
  SCULPT_INTAKE_KIND,
  SCULPT_SCHEMA_VERSION,
  isSculptQualityObjectSculptSpec,
  normalizeObjectSculptSpec,
  parseUnambiguousJson,
  validateSculptIntake,
  type ModelDescriptor,
  type ModelProviderCallEvidence,
  type ModelProviderProfile,
  type ObjectSculptSpec,
  type SculptArtifact,
  type SculptComponent,
  type SculptIntake,
  type SculptMaterial,
  type SculptQualityRuntimeHierarchy,
} from "@sceneaxi/schemas";
import type { ModelProviderPort } from "./model-provider-port.js";
import {
  reconstructSculpt,
  reconstructSculptQuality,
  type SculptReconstructionResult,
  type SculptQualityReconstructionResult,
} from "./sculpt-reconstruction.js";

export const ASSISTANT_SCULPT_REFUSALS = Object.freeze({
  kidsDenied: "ASSISTANT_SCULPT_KIDS_DENIED",
  promptInvalid: "ASSISTANT_SCULPT_PROMPT_INVALID",
  providerFailed: "ASSISTANT_SCULPT_PROVIDER_FAILED",
  providerRefused: "ASSISTANT_SCULPT_PROVIDER_REFUSED",
  outputInvalid: "ASSISTANT_SCULPT_OUTPUT_INVALID",
  reconstructionRefused: "ASSISTANT_SCULPT_RECONSTRUCTION_REFUSED",
  inspectionEditUnsupported: "ASSISTANT_SCULPT_INSPECTION_EDIT_UNSUPPORTED",
} as const);

export type AssistantSculptRefusal =
  (typeof ASSISTANT_SCULPT_REFUSALS)[keyof typeof ASSISTANT_SCULPT_REFUSALS];

export const ASSISTANT_SCULPT_PROGRESS_PHASES = Object.freeze([
  "accepted",
  "generating-local",
  "waiting-provider",
  "streaming-provider",
  "validating-artifact",
  "ready",
] as const);

export type AssistantSculptProgressPhase =
  (typeof ASSISTANT_SCULPT_PROGRESS_PHASES)[number];

export type AssistantSculptProgress = Readonly<{
  phase: AssistantSculptProgressPhase;
  percent: number;
  message: string;
  /** A real provider delta. Absent on non-streaming and local phases. */
  delta?: string;
}>;

export type AssistantSculptInspectionEdit = Readonly<{
  supported: false;
  refusal: typeof ASSISTANT_SCULPT_REFUSALS.inspectionEditUnsupported;
  message: string;
}>;

export type AssistantSculptInspection = Readonly<{
  materials: Readonly<{
    supported: true;
    values: ReadonlyArray<SculptMaterial>;
    edit: AssistantSculptInspectionEdit;
  }>;
  physics:
    | Readonly<{
        supported: true;
        colliders: SculptQualityRuntimeHierarchy["colliders"];
        edit: AssistantSculptInspectionEdit;
      }>
    | Readonly<{
        supported: false;
        reason: typeof ASSISTANT_SCULPT_REFUSALS.inspectionEditUnsupported;
        message: string;
      }>;
  settings: Readonly<{
    supported: true;
    proceduralModule: SculptArtifact["proceduralModule"];
    edit: AssistantSculptInspectionEdit;
  }>;
}>;

export type AssistantSculptSuccess = Readonly<{
  ok: true;
  route: "local" | "byo" | "hosted-metered";
  artifact: SculptArtifact;
  artifactBytes: string;
  artifactDigest: string;
  inspection: AssistantSculptInspection;
  providerEvidence?: ModelProviderCallEvidence;
}>;

export type AssistantSculptFailure = Readonly<{
  ok: false;
  reason: AssistantSculptRefusal;
  message: string;
  recoverable: boolean;
  detail?: string;
}>;

export type AssistantSculptResult = AssistantSculptSuccess | AssistantSculptFailure;

type AssistantSculptCommon = Readonly<{
  prompt: string;
  profile: ModelProviderProfile;
  onProgress?: (snapshot: AssistantSculptProgress) => void;
}>;

export type RunAssistantSculptOptions =
  | (AssistantSculptCommon & Readonly<{ route: "local" }>)
  | (AssistantSculptCommon &
      Readonly<{
        route: "byo";
        operation: "complete" | "stream";
        model: ModelDescriptor;
        port: ModelProviderPort;
      }>);

const KIDS_PROFILE = "@sceneaxi/profile-kids";

const ASSISTANT_SCULPT_FORMAT_INSTRUCTION =
  "Return only one JSON document matching the existing sceneaxi.sculpt-intake v1 contract. Do not wrap it in Markdown.";

const INSPECTION_EDIT: AssistantSculptInspectionEdit = Object.freeze({
  supported: false as const,
  refusal: ASSISTANT_SCULPT_REFUSALS.inspectionEditUnsupported,
  message:
    "This first-release inspector is read-only; the current artifact and Mount contracts expose these values but no material, physics, or procedural-settings edit operation.",
});

function failure(
  reason: AssistantSculptRefusal,
  message: string,
  recoverable: boolean,
  detail?: string,
): AssistantSculptFailure {
  return Object.freeze({
    ok: false as const,
    reason,
    message,
    recoverable,
    ...(detail === undefined ? {} : { detail }),
  });
}

function progress(
  listener: RunAssistantSculptOptions["onProgress"],
  snapshot: AssistantSculptProgress,
): void {
  try {
    listener?.(Object.freeze(snapshot));
  } catch {
    // Progress observation is not authoring authority. A broken renderer must
    // not turn an otherwise deterministic artifact into a different result.
  }
}

function promptRequest(prompt: string): string {
  return `${ASSISTANT_SCULPT_FORMAT_INSTRUCTION}\n\nOperator request:\n${prompt}`;
}

function promptDigest(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex");
}

function localIntake(prompt: string): SculptIntake {
  const lower = prompt.toLocaleLowerCase("en-US");
  const primitive: SculptComponent["primitive"] = lower.includes("sphere")
    ? "sphere"
    : lower.includes("cylinder")
      ? "cylinder"
      : "box";
  const tall = lower.includes("tall");
  const dimensions = primitive === "sphere"
    ? ([2, 2, 2] as const)
    : tall
      ? ([1.5, 3, 1.5] as const)
      : ([2, 2, 2] as const);
  const namedColor = lower.includes("blue")
    ? "#3366cc"
    : lower.includes("red")
      ? "#cc4433"
      : lower.includes("green")
        ? "#3b9966"
        : `#${promptDigest(prompt).slice(0, 6)}`;
  const id = `assistant-${promptDigest(prompt).slice(0, 12)}`;
  const rootNodeId = `${id}-root`;
  const legacy: ObjectSculptSpec = {
    schemaVersion: SCULPT_SCHEMA_VERSION,
    kind: OBJECT_SCULPT_SPEC_KIND,
    id: `${id}-spec`,
    rootNodeId,
    components: [
      {
        id: "body",
        primitive,
        dimensions,
        materialId: "surface",
      },
    ],
    materials: [
      {
        id: "surface",
        baseColor: namedColor,
        metallic: 0.15,
        roughness: 0.65,
      },
    ],
    sockets: [],
    hierarchy: [
      {
        id: rootNodeId,
        parentId: null,
        componentId: "body",
        transform: {
          translation: [0, 0, 0] as const,
          rotationEulerDegrees: [0, 0, 0] as const,
          scale: [1, 1, 1] as const,
        },
      },
    ],
  };
  return Object.freeze({
    schemaVersion: SCULPT_SCHEMA_VERSION,
    kind: SCULPT_INTAKE_KIND,
    intakeId: id,
    mode: "structured-spec" as const,
    structuredSpec: normalizeObjectSculptSpec(legacy),
  });
}

function hasColliderRuntime(
  runtime: SculptArtifact["runtimeHierarchy"],
): runtime is SculptQualityRuntimeHierarchy {
  return "colliders" in runtime && Array.isArray(runtime.colliders);
}

function inspectionOf(artifact: SculptArtifact): AssistantSculptInspection {
  const runtime = artifact.runtimeHierarchy;
  const physics = hasColliderRuntime(runtime)
    ? Object.freeze({
        supported: true as const,
        colliders: runtime.colliders,
        edit: INSPECTION_EDIT,
      })
    : Object.freeze({
        supported: false as const,
        reason: ASSISTANT_SCULPT_REFUSALS.inspectionEditUnsupported,
        message:
          "This legacy artifact has no collider projection; physics inspection refuses instead of inventing one.",
      });
  return Object.freeze({
    materials: Object.freeze({
      supported: true as const,
      values: artifact.spec.materials,
      edit: INSPECTION_EDIT,
    }),
    physics,
    settings: Object.freeze({
      supported: true as const,
      proceduralModule: artifact.proceduralModule,
      edit: INSPECTION_EDIT,
    }),
  });
}

type Reconstruction = SculptReconstructionResult | SculptQualityReconstructionResult;

function reconstruct(intake: SculptIntake): Reconstruction {
  if (
    intake.mode === "structured-spec" &&
    isSculptQualityObjectSculptSpec(intake.structuredSpec)
  ) {
    const digest = promptDigest(intake.intakeId);
    return reconstructSculptQuality(intake, {
      seed: Number.parseInt(digest.slice(0, 12), 16),
    });
  }
  return reconstructSculpt(intake);
}

function artifactFromIntake(
  intake: SculptIntake,
  route: AssistantSculptSuccess["route"],
  providerEvidence?: ModelProviderCallEvidence,
): AssistantSculptResult {
  const built = reconstruct(intake);
  if (!built.ok) {
    return failure(
      ASSISTANT_SCULPT_REFUSALS.reconstructionRefused,
      "The validated assistant intake was refused by the Sculpt reconstruction pipeline.",
      true,
      built.message,
    );
  }
  return Object.freeze({
    ok: true as const,
    route,
    artifact: built.artifact,
    artifactBytes: built.artifactBytes,
    artifactDigest: built.artifactDigest,
    inspection: inspectionOf(built.artifact),
    ...(providerEvidence === undefined ? {} : { providerEvidence }),
  });
}

/**
 * Validate and reconstruct text already obtained through the hosted assistant
 * panel. This function performs no provider call and no metering; callers cannot
 * use it to reach hosted AI without first obtaining completion text elsewhere.
 */
export function sculptArtifactFromAssistantCompletion(
  text: string,
  options: Readonly<{
    route: "byo" | "hosted-metered";
    providerEvidence?: ModelProviderCallEvidence;
  }>,
): AssistantSculptResult {
  const parsed = parseUnambiguousJson(text);
  if (!parsed.ok) {
    return failure(
      ASSISTANT_SCULPT_REFUSALS.outputInvalid,
      "The assistant output was not an unambiguous Sculpt Intake JSON document.",
      true,
      parsed.message,
    );
  }
  const validated = validateSculptIntake(parsed.value);
  if (!validated.ok) {
    return failure(
      ASSISTANT_SCULPT_REFUSALS.outputInvalid,
      "The assistant output did not satisfy the existing typed Sculpt Intake contract.",
      true,
      validated.diagnostics[0]?.message,
    );
  }
  return artifactFromIntake(validated.value, options.route, options.providerEvidence);
}

/** Run one deterministic local or explicitly injected BYOK assistant action. */
export async function runAssistantSculptAction(
  options: RunAssistantSculptOptions,
): Promise<AssistantSculptResult> {
  if (options.profile === KIDS_PROFILE) {
    return failure(
      ASSISTANT_SCULPT_REFUSALS.kidsDenied,
      "The assistant sculpt path is denied for Kids before local generation or provider dispatch.",
      false,
    );
  }
  if (typeof options.prompt !== "string" || options.prompt.trim().length === 0) {
    return failure(
      ASSISTANT_SCULPT_REFUSALS.promptInvalid,
      "An assistant sculpt action requires a non-empty prompt.",
      true,
    );
  }

  const prompt = options.prompt.trim();
  progress(options.onProgress, {
    phase: "accepted",
    percent: 5,
    message: "Prompt accepted.",
  });

  if (options.route === "local") {
    progress(options.onProgress, {
      phase: "generating-local",
      percent: 35,
      message: "Running the deterministic local sculpt compiler; no provider or credits are involved.",
    });
    const intake = localIntake(prompt);
    progress(options.onProgress, {
      phase: "validating-artifact",
      percent: 75,
      message: "Validating the typed Sculpt Intake and reconstructing its artifact.",
    });
    const result = artifactFromIntake(intake, "local");
    if (result.ok) {
      progress(options.onProgress, {
        phase: "ready",
        percent: 100,
        message: "Sculpt Artifact is ready to mount.",
      });
    }
    return result;
  }

  progress(options.onProgress, {
    phase: "waiting-provider",
    percent: 20,
    message:
      options.operation === "stream"
        ? "Waiting for the explicitly configured BYOK provider stream."
        : "Waiting for the explicitly configured BYOK provider completion.",
  });

  try {
    let text = "";
    let evidence: ModelProviderCallEvidence;
    if (options.operation === "complete") {
      const completed = await options.port.complete({
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "complete",
        profile: options.profile,
        model: options.model,
        prompt: promptRequest(prompt),
      });
      if (!completed.ok) {
        return failure(
          ASSISTANT_SCULPT_REFUSALS.providerRefused,
          "The BYOK Model Provider Port refused the assistant action.",
          true,
          `${completed.reason}: ${completed.message}`,
        );
      }
      text = completed.response.text;
      evidence = completed.evidence;
    } else {
      const streamed = await options.port.stream({
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "stream",
        profile: options.profile,
        model: options.model,
        prompt: promptRequest(prompt),
      });
      if (!streamed.ok) {
        return failure(
          ASSISTANT_SCULPT_REFUSALS.providerRefused,
          "The BYOK Model Provider Port refused the assistant stream.",
          true,
          `${streamed.reason}: ${streamed.message}`,
        );
      }
      evidence = streamed.evidence;
      for await (const chunk of streamed.response) {
        text += chunk.delta;
        progress(options.onProgress, {
          phase: "streaming-provider",
          percent: chunk.done ? 65 : 45,
          message: chunk.done
            ? "The BYOK provider stream completed."
            : "Receiving the BYOK provider stream.",
          delta: chunk.delta,
        });
      }
    }

    progress(options.onProgress, {
      phase: "validating-artifact",
      percent: 75,
      message: "Validating provider output against the typed Sculpt Intake contract.",
    });
    const result = sculptArtifactFromAssistantCompletion(text, {
      route: "byo",
      providerEvidence: evidence,
    });
    if (result.ok) {
      progress(options.onProgress, {
        phase: "ready",
        percent: 100,
        message: "Sculpt Artifact is ready to mount.",
      });
    }
    return result;
  } catch (error) {
    return failure(
      ASSISTANT_SCULPT_REFUSALS.providerFailed,
      "The BYOK provider failed; the prompt can be retried after its adapter recovers.",
      true,
      error instanceof Error ? error.message : String(error),
    );
  }
}
