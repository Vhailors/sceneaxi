import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  composeScene,
  reconstructSculpt,
  writeDocumentFile,
} from "../../packages/authoring-core/src/index.ts";
import {
  openSceneKernelSession,
  replaySceneKernelSession,
} from "../../packages/engine-kernel/src/index.ts";
import {
  createExperimentalThreeSculptPresentationBackend,
  createSculptMountApi,
} from "../../packages/engine-presentation/src/index.ts";
import {
  composedSceneFromDocumentData,
  validateDocument,
  type SceneCompositionIntake,
  type SculptArtifact,
} from "../../packages/schemas/src/index.ts";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SCENE_INTAKE_PATH =
  "tests/e2e/fixtures/scene-composition/workshop-bay.scene.json";
const GOLDEN_PATH = "tests/e2e/fixtures/scene-composition/golden-digests.json";
const MOUNT_EVIDENCE_PATH =
  "tests/e2e/fixtures/scene-composition/mount-support-evidence.json";

/** Both source objects are the landed sculpt-quality demos, at their landed seeds. */
const SOURCES = [
  {
    id: "service-crate",
    path: "tests/e2e/fixtures/sculpt-quality/hard-surface-service-crate.intake.json",
    seed: 8001,
  },
  {
    id: "field-drone",
    path: "tests/e2e/fixtures/sculpt-quality/richer-field-drone.intake.json",
    seed: 8002,
  },
] as const;

const SCENE_SEED = 9101;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(REPO_ROOT, path), "utf8")) as unknown;
}

function digest(value: string) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function namedStep<T>(name: string, action: () => T): T {
  try {
    return action();
  } catch (error) {
    throw new Error(
      `Scene composition golden step "${name}" failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function reconstructSources() {
  return SOURCES.map((source) =>
    namedStep(`reconstruct:${source.id}`, () => {
      const reconstruction = reconstructSculpt(readJson(source.path), {
        seed: source.seed,
      });
      if (!reconstruction.ok) throw new Error(reconstruction.message);
      return {
        id: source.id,
        seed: source.seed,
        artifact: reconstruction.artifact as SculptArtifact,
        artifactDigest: reconstruction.artifactDigest,
      };
    }),
  );
}

function sceneIntake(): SceneCompositionIntake {
  return readJson(SCENE_INTAKE_PATH) as SceneCompositionIntake;
}

function refuseCode(
  intake: unknown,
  artifacts: readonly SculptArtifact[],
  label: string,
) {
  const result = composeScene(intake, artifacts);
  if (result.ok) throw new Error(`Scene refusal case "${label}" unexpectedly composed.`);
  return result.code;
}

describe("scene composition v1 golden demo", () => {
  it("composes, mounts, and opens a multi-object scene with stable digests", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sceneaxi-scene-composition-"));
    try {
      const sources = reconstructSources();
      const artifacts = sources.map((source) => source.artifact);

      const composed = namedStep("compose", () => {
        const result = composeScene(sceneIntake(), artifacts, {
          documentId: "workshop-bay-scene",
          title: "Workshop bay multi-object demo",
        });
        if (!result.ok) throw new Error(`${result.code} at ${result.path}: ${result.message}`);
        return result;
      });

      // Three instances from two distinct source objects, one artifact instanced twice.
      expect(composed.scene.instances).toHaveLength(3);
      expect(new Set(composed.scene.instances.map((instance) => instance.artifactId)).size).toBe(2);
      expect(
        composed.scene.instances.filter(
          (instance) => instance.artifactId === "service-crate-artifact",
        ),
      ).toHaveLength(2);
      // A two-level parent chain: root -> stacked crate -> drone.
      expect(composed.scene.instances.map((instance) => instance.depth)).toEqual([0, 1, 2]);

      const documentPath = "workshop-bay.sceneaxi.json";
      const written = namedStep("write-document", () => {
        const result = writeDocumentFile(documentPath, composed.document, {
          cwd: projectRoot,
        });
        if (!result.ok) throw new Error("scene document write refused");
        return result;
      });
      expect(written.ok).toBe(true);

      const reopened = namedStep("reopen-document", () => {
        const document = validateDocument(
          JSON.parse(readFileSync(join(projectRoot, documentPath), "utf8")) as unknown,
        );
        if (!document.ok) throw new Error(document.message);
        const scene = composedSceneFromDocumentData(document.document.data);
        if (!scene.ok) throw new Error(scene.diagnostics[0]?.message ?? "scene refused");
        return scene.value;
      });
      expect(reopened.evidence.sceneDigest).toBe(composed.sceneDigest);

      // The existing Mount API already carries N instances with per-instance
      // transforms, so no presentation adapter is added for this vertical.
      const mount = namedStep("mount", () => {
        const mounts = createSculptMountApi(
          createExperimentalThreeSculptPresentationBackend(),
        );
        for (const instance of composed.scene.instances) {
          mounts.mount({
            instanceId: instance.instanceId,
            artifact: instance.artifact,
            transform: instance.worldTransform,
          });
        }
        const frame = mounts.render();
        const mountedIds = mounts.list().map((instance) => instance.instanceId);
        mounts.dispose();
        return { frame, mountedIds };
      });
      const expectedDrawCalls = composed.scene.instances.reduce(
        (total, instance) => total + instance.artifact.spec.components.length,
        0,
      );
      expect(mount.frame.drawCalls).toBe(expectedDrawCalls);
      expect(mount.mountedIds).toHaveLength(3);

      const kernel = namedStep("kernel", () => {
        const session = openSceneKernelSession(composed.scene, { seed: SCENE_SEED });
        const initial = session.observe();
        for (let tick = 1; tick <= 8; tick += 1) {
          session.advance({ tick, deltaMs: 100 });
        }
        const terminal = session.observe();
        const save = session.save();
        const replay = replaySceneKernelSession(save).observe();
        return { initial, terminal, save, replay };
      });
      expect(kernel.terminal.digest).not.toBe(kernel.initial.digest);
      expect(kernel.replay.digest).toBe(kernel.terminal.digest);
      for (const instance of kernel.terminal.instances) {
        const before = kernel.initial.instances.find(
          (candidate) => candidate.instanceId === instance.instanceId,
        );
        expect(instance.snapshot.digest).not.toBe(before?.snapshot.digest);
      }

      // The named refuse matrix, exercised end to end. A weakened refusal
      // changes these codes and breaks the golden file.
      const intake = sceneIntake();
      const placements = intake.placements;
      const withoutSceneId: Record<string, unknown> = { ...intake };
      Reflect.deleteProperty(withoutSceneId, "sceneId");
      const refusals = namedStep("refuse-matrix", () => ({
        notObject: refuseCode([], artifacts, "notObject"),
        schemaMajorMismatch: refuseCode(
          { ...intake, schemaVersion: 2 },
          artifacts,
          "schemaMajorMismatch",
        ),
        invalidKind: refuseCode(
          { ...intake, kind: "sceneaxi.other" },
          artifacts,
          "invalidKind",
        ),
        missingField: refuseCode(withoutSceneId, artifacts, "missingField"),
        unexpectedField: refuseCode(
          { ...intake, extra: true },
          artifacts,
          "unexpectedField",
        ),
        invalidField: refuseCode(
          { ...intake, sceneId: "Workshop-Bay" },
          artifacts,
          "invalidField",
        ),
        instanceCountBelowMinimum: refuseCode(
          { ...intake, placements: placements.slice(0, 1) },
          artifacts,
          "instanceCountBelowMinimum",
        ),
        duplicateInstanceId: refuseCode(
          {
            ...intake,
            placements: placements.map((placement) => ({
              ...placement,
              instanceId: "bay-service-crate",
              parentInstanceId: null,
            })),
          },
          artifacts,
          "duplicateInstanceId",
        ),
        missingParentInstance: refuseCode(
          {
            ...intake,
            placements: placements.map((placement, index) =>
              index === 1 ? { ...placement, parentInstanceId: "bay-ghost" } : placement,
            ),
          },
          artifacts,
          "missingParentInstance",
        ),
        invalidSceneRoot: refuseCode(
          { ...intake, rootInstanceId: "bay-field-drone" },
          artifacts,
          "invalidSceneRoot",
        ),
        sceneHierarchyCycle: refuseCode(
          {
            ...intake,
            placements: placements.map((placement, index) =>
              index === 1
                ? { ...placement, parentInstanceId: "bay-stacked-crate" }
                : placement,
            ),
          },
          artifacts,
          "sceneHierarchyCycle",
        ),
        rotatedParentUnsupported: refuseCode(
          {
            ...intake,
            placements: placements.map((placement, index) =>
              index === 1
                ? {
                    ...placement,
                    transform: {
                      ...placement.transform,
                      rotationEulerDegrees: [0, 15, 0] as const,
                    },
                  }
                : placement,
            ),
          },
          artifacts,
          "rotatedParentUnsupported",
        ),
        sceneBudgetExceeded: refuseCode(
          {
            ...intake,
            placements: [
              placements[0],
              ...Array.from({ length: 32 }, (_unused, index) => ({
                instanceId: `bay-extra-${String(index)}`,
                artifactId: "service-crate-artifact",
                parentInstanceId: "bay-service-crate",
                transform: placements[0]?.transform,
              })),
            ],
          },
          artifacts,
          "sceneBudgetExceeded",
        ),
        unknownArtifactReference: refuseCode(
          intake,
          [artifacts[0] as SculptArtifact],
          "unknownArtifactReference",
        ),
        unplacedArtifact: refuseCode(
          {
            ...intake,
            placements: placements.filter(
              (placement) => placement.artifactId !== "field-drone-artifact",
            ),
          },
          artifacts,
          "unplacedArtifact",
        ),
        invalidArtifact: refuseCode(
          intake,
          [
            artifacts[0] as SculptArtifact,
            { ...(artifacts[1] as SculptArtifact), artifactId: "Bad Id" },
          ],
          "invalidArtifact",
        ),
      }));

      const actual = {
        schemaVersion: 1,
        kind: "sceneaxi.scene-composition-golden-evidence",
        status: "passed",
        sceneIntakePath: SCENE_INTAKE_PATH,
        sceneSeed: SCENE_SEED,
        sources: sources.map((source) => ({
          id: source.id,
          seed: source.seed,
          artifactId: source.artifact.artifactId,
          artifactDigest: source.artifactDigest,
        })),
        scene: {
          sceneId: composed.scene.sceneId,
          rootInstanceId: composed.scene.rootInstanceId,
          instances: composed.scene.instances.map((instance) => ({
            instanceId: instance.instanceId,
            artifactId: instance.artifactId,
            parentInstanceId: instance.parentInstanceId,
            depth: instance.depth,
            worldTransform: instance.worldTransform,
          })),
          placementDigest: composed.scene.evidence.placementDigest,
          sceneDigest: composed.sceneDigest,
          sceneBytesDigest: digest(composed.sceneBytes),
        },
        document: {
          id: composed.document.id,
          documentDigest: digest(
            readFileSync(join(projectRoot, documentPath), "utf8"),
          ),
          reopenedSceneDigest: reopened.evidence.sceneDigest,
        },
        mount: {
          drawCalls: mount.frame.drawCalls,
          instanceIds: mount.mountedIds,
          frameDigest: digest(JSON.stringify(mount.frame)),
        },
        kernel: {
          initialDigest: kernel.initial.digest,
          terminalDigest: kernel.terminal.digest,
          replayDigest: kernel.replay.digest,
          collisionCount: kernel.terminal.collisionCount,
          instanceSeeds: kernel.terminal.instances.map((instance) => ({
            instanceId: instance.instanceId,
            seed: instance.snapshot.seed,
          })),
          saveDigest: digest(JSON.stringify(kernel.save)),
        },
        refusals,
        claims: {
          stage1Run: false,
          minimumE2Expanded: false,
          rendererDecided: false,
          productionSpend: false,
          offlineAgentUsed: false,
        },
      };

      expect(actual).toEqual(readJson(GOLDEN_PATH));
      expect({
        schemaVersion: 1,
        kind: "sceneaxi.scene-composition-mount-support-evidence",
        issue: 87,
        decision: "not-needed",
        proofTest: "tests/e2e/scene-composition-golden.test.ts",
        sceneId: composed.scene.sceneId,
        instanceIds: composed.scene.instances.map((instance) => instance.instanceId),
        existingPath: [
          "reconstructSculpt",
          "composeScene",
          "createSculptMountApi",
          "openSceneKernelSession",
        ],
        mountedInstanceCount: mount.mountedIds.length,
        mountDrawCalls: mount.frame.drawCalls,
        presentationAdapterAdded: false,
        minimumE2ChecklistExpanded: false,
        engineAdapterAdded: false,
        physicsSuiteExpanded: false,
        stage1Run: false,
      }).toEqual(readJson(MOUNT_EVIDENCE_PATH));
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
