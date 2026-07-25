/**
 * `scene compose` — protocol adapter over authoring-core's deterministic scene
 * composition pipeline (docs/scene-composition.md, ADRs 0014-0015).
 *
 * Composition is offline and fixed: no provider call, no network, no seed.
 * Identical inputs always yield identical bytes, so this verb is safe to put on
 * the free CLI. Placement is a projection — the verb never rewrites a Sculpt
 * Artifact, whose evidence binds its exact spec bytes.
 */

import {
  atomicWriteAll,
  composeScene,
  serializeComposedScene,
  serializeDocument,
  type SceneCompositionRefusalCode,
} from "@sceneaxi/authoring-core";
import { failure, success, type CliOutcome, type ResultPayload } from "./envelope.js";
import { parseVerbArgs, repeatedFlag } from "./verb-args.js";
import {
  missingFlag,
  parseJsonOrRefuse,
  readTextOrRefuse,
  refusePathAliases,
  refuseUnknownArgs,
  resolveUnderCwd,
} from "./verb-support.js";

const COMPOSE_FLAGS = new Set([
  "--intake",
  "--artifact",
  "--out-scene",
  "--out-document",
  "--document-id",
  "--title",
  "--cwd",
]);

const COMPOSE_USAGE =
  "Usage: sceneaxi scene compose --intake <intake.json> --artifact <artifact.json> [--artifact ...] [--out-scene <path>] [--out-document <path>] [--document-id <id>] [--title <text>] [--cwd <dir>]";

/**
 * Composition refusals that describe malformed or contradictory *input*, and so
 * map to USAGE. Everything else in the named refuse matrix is a structural
 * refusal of an otherwise well-formed request and maps to ERROR.
 */
const INPUT_SHAPE_REFUSALS: ReadonlySet<SceneCompositionRefusalCode> = new Set([
  "not-object",
  "schema-major-mismatch",
  "invalid-kind",
  "missing-field",
  "unexpected-field",
  "invalid-field",
  "invalid-artifact",
]);

/** `scene compose --intake <p> --artifact <p> [--artifact <p>] ...` */
export function runSceneCompose(
  path: readonly string[],
  tokens: readonly string[],
): CliOutcome {
  const args = parseVerbArgs(tokens);
  const unknown = refuseUnknownArgs(args, COMPOSE_FLAGS, path);
  if (unknown) return unknown;

  const intakePath = args.flags.get("--intake");
  if (intakePath === undefined || intakePath.length === 0) {
    return missingFlag("Missing required flag --intake", COMPOSE_USAGE, path);
  }

  const artifactPaths = repeatedFlag(args, "--artifact");
  if (artifactPaths.length === 0) {
    return missingFlag(
      "Missing required flag --artifact (repeat it once per Sculpt Artifact)",
      COMPOSE_USAGE,
      path,
    );
  }

  const cwd = args.flags.get("--cwd");

  const intake = readJsonInput(intakePath, cwd, path);
  if (!intake.ok) return intake.outcome;

  const artifacts: unknown[] = [];
  for (const artifactPath of artifactPaths) {
    const artifact = readJsonInput(artifactPath, cwd, path);
    if (!artifact.ok) return artifact.outcome;
    artifacts.push(artifact.value);
  }

  const documentId = args.flags.get("--document-id");
  const title = args.flags.get("--title");
  const result = composeScene(intake.value, artifacts, {
    ...(documentId !== undefined ? { documentId } : {}),
    ...(title !== undefined ? { title } : {}),
  });

  if (!result.ok) {
    return failure(
      INPUT_SHAPE_REFUSALS.has(result.code) ? "VALIDATION" : "INTERNAL",
      `Scene composition refused (${result.code}) at ${result.path}: ${result.message}`,
      {
        path,
        help: [
          "Composition fails closed on the named refuse matrix (docs/scene-composition.md)",
          "Placement is axis-aligned in v1 and never rewrites a Sculpt Artifact",
          COMPOSE_USAGE,
        ],
      },
    );
  }

  const writes: Array<{
    readonly path: string;
    readonly contents: string;
    readonly displayPath: string;
  }> = [];
  const outScene = args.flags.get("--out-scene");
  if (outScene !== undefined && outScene.length > 0) {
    writes.push({
      path: resolveUnderCwd(outScene, cwd),
      contents: serializeComposedScene(result.scene),
      displayPath: outScene,
    });
  }

  const outDocument = args.flags.get("--out-document");
  if (outDocument !== undefined && outDocument.length > 0) {
    writes.push({
      path: resolveUnderCwd(outDocument, cwd),
      contents: serializeDocument(result.document),
      displayPath: outDocument,
    });
  }

  if (writes.length > 0) {
    const aliasRefusal = refusePathAliases(
      [
        {
          absolutePath: resolveUnderCwd(intakePath, cwd),
          displayPath: intakePath,
        },
        ...artifactPaths.map((artifactPath) => ({
          absolutePath: resolveUnderCwd(artifactPath, cwd),
          displayPath: artifactPath,
        })),
      ],
      writes.map((write) => ({
        absolutePath: write.path,
        displayPath: write.displayPath,
      })),
      path,
    );
    if (aliasRefusal) return aliasRefusal;

    try {
      atomicWriteAll(
        writes.map((write) => ({
          path: write.path,
          contents: write.contents,
        })),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return failure(
        "INTERNAL",
        `Could not write ${writes.map((write) => write.displayPath).join(", ")}: ${message}`,
        { path },
      );
    }
  }
  const writtenPaths = writes.map((write) => write.displayPath);

  return success(
    Object.freeze({
      status: "composed",
      sceneId: result.scene.sceneId,
      sceneDigest: result.sceneDigest,
      documentId: result.document.id,
      instanceCount: result.scene.instances.length,
      instanceIds: Object.freeze(
        result.scene.instances.map((instance) => instance.instanceId),
      ),
      artifactCount: artifactPaths.length,
      writtenPaths: Object.freeze(writtenPaths),
    }),
    [
      writtenPaths.length === 0
        ? "Pass --out-scene / --out-document to persist the composed scene"
        : `Wrote ${writtenPaths.join(", ")}`,
      "Composition is deterministic: identical inputs always yield this digest",
    ],
  );
}

function readJsonInput(
  inputPath: string,
  cwd: string | undefined,
  path: readonly string[],
):
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly outcome: CliOutcome } {
  const read = readTextOrRefuse(
    resolveUnderCwd(inputPath, cwd),
    inputPath,
    path,
  );
  if (!read.ok) return { ok: false, outcome: read.outcome };
  const parsed = parseJsonOrRefuse(read.text, inputPath, path);
  if (!parsed.ok) return { ok: false, outcome: parsed.outcome };
  return { ok: true, value: parsed.value };
}

export function sceneComposeHelp(): ResultPayload {
  return Object.freeze({
    command: "scene compose",
    description:
      "Compose multiple Sculpt Artifacts into one openable scene (deterministic, offline)",
    flags: Object.freeze({
      "--intake": "Path to the Scene Composition Intake (required)",
      "--artifact":
        "Path to a Sculpt Artifact; repeat once per artifact (required)",
      "--out-scene": "Write the ComposedScene to this path",
      "--out-document": "Write the projected SceneDocument to this path",
      "--document-id": "Document id for the projection (default: <sceneId>-scene)",
      "--title": "Optional title for the projected document",
      "--cwd": "Working directory for relative paths",
    }),
  });
}
