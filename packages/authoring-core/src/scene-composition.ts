/**
 * SceneAxi-owned deterministic scene composition pipeline.
 *
 * Takes one Scene Composition Intake plus the Sculpt Artifacts it places, and
 * produces one ComposedScene and one text-canonical SceneDocument. Composition
 * is offline and fixed: there is no provider call, no network, and no seed —
 * identical input always yields identical bytes.
 */
import {
  COMPOSED_SCENE_DOCUMENT_DATA_KEY,
  COMPOSED_SCENE_KIND,
  SCENE_MAXIMUM_INSTANCES,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  createDocument,
  digestComposedScene,
  digestSceneArtifact,
  digestScenePlacements,
  isSculptIdentifier,
  resolveScenePlacements,
  validateComposedScene,
  validateDocument,
  validateSceneCompositionIntake,
  validateSculptArtifact,
  type ComposedScene,
  type ComposedSceneInstance,
  type JsonValue,
  type SceneCompositionDiagnosticCode,
  type SceneDocument,
  type SculptArtifact,
} from "@sceneaxi/schemas";
import { canonicalJson, digestJson, snapshotJsonValue } from "./json-invariants.js";

export type SceneCompositionRefusalCode = SceneCompositionDiagnosticCode;

export type SceneCompositionOptions = {
  /** Document id for the projected SceneDocument; defaults to `<sceneId>-scene`. */
  readonly documentId?: string;
  readonly title?: string;
};

export type SceneCompositionResult =
  | {
      readonly ok: true;
      readonly scene: ComposedScene;
      readonly sceneBytes: string;
      readonly sceneDigest: string;
      readonly document: SceneDocument;
    }
  | {
      readonly ok: false;
      readonly code: SceneCompositionRefusalCode;
      readonly path: string;
      readonly message: string;
    };

type SceneCompositionOptionsCapture =
  | {
      readonly ok: true;
      readonly value: SceneCompositionOptions;
    }
  | {
      readonly ok: false;
      readonly path: string;
      readonly message: string;
    };

type StableInputCapture =
  | {
      readonly ok: true;
      readonly value: unknown;
    }
  | {
      readonly ok: false;
      readonly path: string;
      readonly message: string;
      readonly budgetExceeded?: true;
    };

type StableInputCaptureBudget = {
  remainingEntries: number;
};

const SCENE_CAPTURE_MAXIMUM_DEPTH = 64;
const SCENE_CAPTURE_MAXIMUM_ENTRIES = 100_000;

function refuse(
  code: SceneCompositionRefusalCode,
  path: string,
  message: string,
): SceneCompositionResult {
  return { ok: false, code, path, message };
}

function captureStableInput(
  value: unknown,
  path: string,
  ancestors = new Set<object>(),
  budget: StableInputCaptureBudget = {
    remainingEntries: SCENE_CAPTURE_MAXIMUM_ENTRIES,
  },
  depth = 0,
): StableInputCapture {
  if (depth > SCENE_CAPTURE_MAXIMUM_DEPTH) {
    return {
      ok: false,
      path,
      message: "Scene composition input exceeds the capture depth budget.",
      budgetExceeded: true,
    };
  }
  if (value === null || typeof value !== "object") {
    return { ok: true, value };
  }
  if (ancestors.has(value)) {
    return {
      ok: false,
      path,
      message: "Scene composition input must not contain cycles.",
    };
  }

  let array: boolean;
  let prototype: object | null;
  try {
    array = Array.isArray(value);
    prototype = Object.getPrototypeOf(value) as object | null;
  } catch {
    return {
      ok: false,
      path,
      message: "Scene composition input must expose stable data fields.",
    };
  }

  if (
    (array && prototype !== Array.prototype) ||
    (!array && prototype !== Object.prototype && prototype !== null)
  ) {
    return {
      ok: false,
      path,
      message: "Scene composition input must use plain JSON containers.",
    };
  }

  let arrayLength: number | undefined;
  if (array) {
    let lengthDescriptor: PropertyDescriptor | undefined;
    try {
      lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    } catch {
      return {
        ok: false,
        path,
        message: "Scene composition input must expose stable data fields.",
      };
    }
    const length =
      lengthDescriptor !== undefined && "value" in lengthDescriptor
        ? (lengthDescriptor.value as unknown)
        : undefined;
    if (
      typeof length !== "number" ||
      !Number.isSafeInteger(length) ||
      length < 0
    ) {
      return {
        ok: false,
        path,
        message: "Scene composition arrays must expose a stable length.",
      };
    }
    const maximumLength =
      path === "$.placements" || path === "$.artifacts"
        ? SCENE_MAXIMUM_INSTANCES
        : SCENE_CAPTURE_MAXIMUM_ENTRIES;
    if (length > maximumLength) {
      return {
        ok: false,
        path,
        message: `Scene composition array length exceeds the capture maximum of ${String(maximumLength)}.`,
        budgetExceeded: true,
      };
    }
    arrayLength = length;
  }

  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    return {
      ok: false,
      path,
      message: "Scene composition input must expose stable data fields.",
    };
  }
  if (keys.length > budget.remainingEntries) {
    return {
      ok: false,
      path,
      message: `Scene composition input exceeds the capture entry budget of ${String(SCENE_CAPTURE_MAXIMUM_ENTRIES)}.`,
      budgetExceeded: true,
    };
  }
  budget.remainingEntries -= keys.length;

  ancestors.add(value);
  try {
    if (array) {
      if (
        keys.some(
          (key) =>
            key !== "length" &&
            (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key)),
        )
      ) {
        return {
          ok: false,
          path,
          message: "Scene composition arrays must contain only indexed data fields.",
        };
      }

      const entries: unknown[] = [];
      for (let index = 0; index < (arrayLength ?? 0); index += 1) {
        let descriptor: PropertyDescriptor | undefined;
        try {
          descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        } catch {
          return {
            ok: false,
            path: `${path}[${String(index)}]`,
            message: "Scene composition input must expose stable data fields.",
          };
        }
        if (
          descriptor === undefined ||
          !descriptor.enumerable ||
          !("value" in descriptor)
        ) {
          return {
            ok: false,
            path: `${path}[${String(index)}]`,
            message: "Scene composition arrays must contain stable indexed data fields.",
          };
        }
        const captured = captureStableInput(
          descriptor.value as unknown,
          `${path}[${String(index)}]`,
          ancestors,
          budget,
          depth + 1,
        );
        if (!captured.ok) return captured;
        entries.push(captured.value);
      }
      return { ok: true, value: Object.freeze(entries) };
    }

    const entries: Array<readonly [string, unknown]> = [];
    for (const key of keys) {
      if (typeof key !== "string") {
        return {
          ok: false,
          path,
          message: "Scene composition objects must contain only string data fields.",
        };
      }
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, key);
      } catch {
        return {
          ok: false,
          path: `${path}.${key}`,
          message: "Scene composition input must expose stable data fields.",
        };
      }
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor)
      ) {
        return {
          ok: false,
          path: `${path}.${key}`,
          message: "Scene composition objects must contain stable data fields.",
        };
      }
      const captured = captureStableInput(
        descriptor.value as unknown,
        `${path}.${key}`,
        ancestors,
        budget,
        depth + 1,
      );
      if (!captured.ok) return captured;
      entries.push([key, captured.value]);
    }
    return {
      ok: true,
      value: Object.freeze(Object.fromEntries(entries)),
    };
  } finally {
    ancestors.delete(value);
  }
}

function captureSceneCompositionOptions(
  value: unknown,
): SceneCompositionOptionsCapture {
  let array: boolean;
  try {
    array = Array.isArray(value);
  } catch {
    return {
      ok: false,
      path: "$.options",
      message: "Scene composition options must expose stable data fields.",
    };
  }
  if (value === null || typeof value !== "object" || array) {
    return {
      ok: false,
      path: "$.options",
      message: "Scene composition options must be an object.",
    };
  }

  let documentIdDescriptor: PropertyDescriptor | undefined;
  let titleDescriptor: PropertyDescriptor | undefined;
  try {
    documentIdDescriptor = Object.getOwnPropertyDescriptor(value, "documentId");
    titleDescriptor = Object.getOwnPropertyDescriptor(value, "title");
  } catch {
    return {
      ok: false,
      path: "$.options",
      message: "Scene composition options must expose stable data fields.",
    };
  }

  if (
    documentIdDescriptor !== undefined &&
    !("value" in documentIdDescriptor)
  ) {
    return {
      ok: false,
      path: "$.options.documentId",
      message: "Scene document id must be a stable data field.",
    };
  }
  if (titleDescriptor !== undefined && !("value" in titleDescriptor)) {
    return {
      ok: false,
      path: "$.options.title",
      message: "Scene document title must be a stable data field.",
    };
  }

  const documentId = documentIdDescriptor?.value as unknown;
  const title = titleDescriptor?.value as unknown;
  if (documentId !== undefined && !isSculptIdentifier(documentId)) {
    return {
      ok: false,
      path: "$.options.documentId",
      message: "Scene document id must be a lowercase slug.",
    };
  }
  if (title !== undefined && typeof title !== "string") {
    return {
      ok: false,
      path: "$.options.title",
      message: "Scene document title must be a string.",
    };
  }

  return {
    ok: true,
    value: Object.freeze({
      ...(documentId === undefined ? {} : { documentId }),
      ...(title === undefined ? {} : { title }),
    }),
  };
}

function remapComposedScenePath(
  path: string,
  instances: readonly ComposedSceneInstance[],
  placementIndexByInstanceId: ReadonlyMap<string, number>,
  artifactIndexByArtifactId: ReadonlyMap<string, number>,
) {
  if (path === "$.instances") return "$.placements";
  const match = /^\$\.instances\[(\d+)\](.*)$/.exec(path);
  if (match === null) return path;
  const instance = instances[Number(match[1])];
  if (instance === undefined) return path;
  const suffix = match[2] ?? "";
  if (suffix === ".artifact" || suffix.startsWith(".artifact.")) {
    const artifactIndex = artifactIndexByArtifactId.get(instance.artifactId);
    if (artifactIndex === undefined) return path;
    return `$.artifacts[${String(artifactIndex)}]${suffix.slice(".artifact".length)}`;
  }
  const placementIndex = placementIndexByInstanceId.get(instance.instanceId);
  if (placementIndex === undefined) return path;
  if (
    suffix === ".localTransform" ||
    suffix.startsWith(".localTransform.")
  ) {
    return `$.placements[${String(placementIndex)}].transform${suffix.slice(".localTransform".length)}`;
  }
  if (
    suffix === ".worldTransform" ||
    suffix.startsWith(".worldTransform.")
  ) {
    return `$.placements[${String(placementIndex)}].transform`;
  }
  if (
    suffix === ".instanceId" ||
    suffix === ".artifactId" ||
    suffix === ".parentInstanceId"
  ) {
    return `$.placements[${String(placementIndex)}]${suffix}`;
  }
  return `$.placements[${String(placementIndex)}]`;
}

/** Byte-canonical form used by scene evidence and golden fixtures. */
export function serializeComposedScene(scene: ComposedScene) {
  return `${canonicalJson(scene as unknown as JsonValue)}\n`;
}

/** Project a ComposedScene into the existing text-canonical document contract. */
export function sceneDocumentFromComposedScene(
  scene: ComposedScene,
  options: SceneCompositionOptions = {},
): SceneDocument {
  const capturedOptions = captureSceneCompositionOptions(options);
  if (!capturedOptions.ok) throw new TypeError(capturedOptions.message);
  const normalizedOptions = capturedOptions.value;
  const base = {
    id: normalizedOptions.documentId ?? `${scene.sceneId}-scene`,
    data: {
      [COMPOSED_SCENE_DOCUMENT_DATA_KEY]: scene as unknown as JsonValue,
    },
  } as const;
  const document = normalizedOptions.title === undefined
    ? createDocument(base)
    : createDocument({ ...base, title: normalizedOptions.title });
  const validated = validateDocument(document);
  if (!validated.ok) {
    throw new TypeError(validated.message);
  }
  return validated.document;
}

/**
 * Compose validated Sculpt Artifacts into one openable scene.
 *
 * Every failure is named and fail-closed: an artifact that is referenced but
 * missing, and an artifact that is supplied but never placed, both refuse, so
 * nothing is silently dropped in either direction.
 */
export function composeScene(
  intakeValue: unknown,
  artifactValues: readonly unknown[],
  options: SceneCompositionOptions = {},
): SceneCompositionResult {
  const capturedOptions = captureSceneCompositionOptions(options);
  if (!capturedOptions.ok) {
    return refuse(
      "invalid-field",
      capturedOptions.path,
      capturedOptions.message,
    );
  }
  const normalizedOptions = capturedOptions.value;
  let artifactArray: boolean;
  try {
    artifactArray = Array.isArray(artifactValues);
  } catch {
    return refuse(
      "invalid-artifact",
      "$.artifacts",
      "Sculpt Artifacts must expose a stable array.",
    );
  }
  if (!artifactArray) {
    return refuse(
      "invalid-artifact",
      "$.artifacts",
      "Sculpt Artifacts must be supplied as an array.",
    );
  }
  const capturedIntake = captureStableInput(intakeValue, "$");
  if (!capturedIntake.ok) {
    return refuse(
      capturedIntake.budgetExceeded &&
        capturedIntake.path === "$.placements"
        ? "scene-budget-exceeded"
        : "invalid-field",
      capturedIntake.path,
      capturedIntake.message,
    );
  }
  const intake = validateSceneCompositionIntake(capturedIntake.value);
  if (!intake.ok) {
    const diagnostic = intake.diagnostics[0];
    return refuse(
      diagnostic?.code ?? "invalid-field",
      diagnostic?.path ?? "$",
      diagnostic?.message ?? "Scene Composition Intake refused.",
    );
  }
  const capturedArtifacts = captureStableInput(artifactValues, "$.artifacts");
  if (!capturedArtifacts.ok || !Array.isArray(capturedArtifacts.value)) {
    return refuse(
      !capturedArtifacts.ok &&
        capturedArtifacts.budgetExceeded &&
        capturedArtifacts.path === "$.artifacts"
        ? "scene-budget-exceeded"
        : "invalid-artifact",
      capturedArtifacts.ok ? "$.artifacts" : capturedArtifacts.path,
      capturedArtifacts.ok
        ? "Sculpt Artifacts must be supplied as an array."
        : capturedArtifacts.message,
    );
  }
  const normalizedArtifactValues = capturedArtifacts.value;

  const artifacts = new Map<string, SculptArtifact>();
  const artifactIndexByArtifactId = new Map<string, number>();
  for (const [index, artifactValue] of normalizedArtifactValues.entries()) {
    const artifact = validateSculptArtifact(artifactValue);
    if (!artifact.ok) {
      return refuse(
        "invalid-artifact",
        `$.artifacts[${String(index)}]`,
        artifact.diagnostics[0]?.message ?? "Sculpt Artifact refused.",
      );
    }
    if (artifacts.has(artifact.value.artifactId)) {
      return refuse(
        "unknown-artifact-reference",
        `$.artifacts[${String(index)}].artifactId`,
        `Sculpt Artifact "${artifact.value.artifactId}" was supplied more than once; one artifact may be placed many times, but it is supplied once.`,
      );
    }
    artifacts.set(artifact.value.artifactId, artifact.value);
    artifactIndexByArtifactId.set(artifact.value.artifactId, index);
  }

  const resolved = resolveScenePlacements(intake.value);
  if (!resolved.ok) {
    const diagnostic = resolved.diagnostics[0];
    return refuse(
      diagnostic?.code ?? "invalid-field",
      diagnostic?.path ?? "$",
      diagnostic?.message ?? "Scene placements refused.",
    );
  }

  const placedArtifactIds = new Set<string>();
  const intakeIndexByInstanceId = new Map(
    intake.value.placements.map((placement, index) => [
      placement.instanceId,
      index,
    ]),
  );
  const instances: ComposedSceneInstance[] = [];
  for (const placement of resolved.value) {
    const artifact = artifacts.get(placement.artifactId);
    if (artifact === undefined) {
      const intakeIndex = intakeIndexByInstanceId.get(placement.instanceId);
      return refuse(
        "unknown-artifact-reference",
        `$.placements[${String(intakeIndex ?? 0)}].artifactId`,
        `Scene instance "${placement.instanceId}" references Sculpt Artifact "${placement.artifactId}", which was not supplied.`,
      );
    }
    placedArtifactIds.add(placement.artifactId);
    instances.push({ ...placement, artifact });
  }

  for (const artifactId of artifacts.keys()) {
    if (placedArtifactIds.has(artifactId)) continue;
    return refuse(
      "unplaced-artifact",
      "$.artifacts",
      `Sculpt Artifact "${artifactId}" was supplied but never placed; composition refuses rather than dropping it.`,
    );
  }

  const draft = {
    schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
    kind: COMPOSED_SCENE_KIND,
    sceneId: intake.value.sceneId,
    rootInstanceId: intake.value.rootInstanceId,
    instances,
    evidence: {
      intakeDigest: digestJson(intake.value as unknown as JsonValue),
      placementDigest: digestScenePlacements(resolved.value),
      artifactDigests: instances.map((instance) => ({
        instanceId: instance.instanceId,
        artifactDigest: digestSceneArtifact(instance.artifact),
      })),
      sceneDigest: "",
    },
  } as unknown as ComposedScene;

  const scene = snapshotJsonValue({
    ...draft,
    evidence: { ...draft.evidence, sceneDigest: digestComposedScene(draft) },
  }) as ComposedScene;

  const validated = validateComposedScene(scene);
  if (!validated.ok) {
    const diagnostic = validated.diagnostics[0];
    return refuse(
      diagnostic?.code ?? "invalid-field",
      diagnostic === undefined
        ? "$"
        : remapComposedScenePath(
            diagnostic.path,
            instances,
            intakeIndexByInstanceId,
            artifactIndexByArtifactId,
          ),
      diagnostic?.message ?? "Composed scene refused its own validator.",
    );
  }

  return {
    ok: true,
    scene: validated.value,
    sceneBytes: serializeComposedScene(validated.value),
    sceneDigest: validated.value.evidence.sceneDigest,
    document: sceneDocumentFromComposedScene(validated.value, normalizedOptions),
  };
}
