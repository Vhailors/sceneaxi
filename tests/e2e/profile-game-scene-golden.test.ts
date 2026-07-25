/**
 * Game profile multi-object golden path (sceneaxi#117).
 *
 * The single-object MVP path is `cli-golden-path.test.ts`. This one proves the
 * Game profile can drive the composition vertical landed in #113 end to end:
 *
 *   compose artifacts -> project a document -> write + reopen it
 *   -> mount N instances -> open/advance/save/replay a scene kernel session
 *
 * Everything is offline: artifacts are reconstructed from checked-in intakes at
 * their landed seeds, and the scene opens at a fixed seed. No provider, no
 * network, no credential, no spend.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { reconstructSculpt } from "../../packages/authoring-core/src/index.ts";
import {
  composedSceneFromDocumentData,
  validateDocument,
  type SceneCompositionIntake,
  type SculptArtifact,
} from "../../packages/schemas/src/index.ts";
import { sceneGoldenPath } from "@sceneaxi/profile-game";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SCENE_INTAKE_PATH =
  "tests/e2e/fixtures/scene-composition/workshop-bay.scene.json";
const SOURCES = [
  {
    path: "tests/e2e/fixtures/sculpt-quality/hard-surface-service-crate.intake.json",
    seed: 8001,
  },
  {
    path: "tests/e2e/fixtures/sculpt-quality/richer-field-drone.intake.json",
    seed: 8002,
  },
] as const;
const SCENE_SEED = 9101;
const DOCUMENT_PATH = "workshop-bay.game.sceneaxi.json";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(REPO_ROOT, path), "utf8")) as unknown;
}

function sourceArtifacts(): readonly SculptArtifact[] {
  return SOURCES.map((source) => {
    const reconstruction = reconstructSculpt(readJson(source.path), {
      seed: source.seed,
    });
    if (!reconstruction.ok) {
      throw new Error(`fixture reconstruction refused: ${reconstruction.message}`);
    }
    return reconstruction.artifact as SculptArtifact;
  });
}

describe("Game profile multi-object scene golden path", () => {
  it("composes, persists, mounts, opens, and replays a scene through the profile", () => {
    const cwd = mkdtempSync(join(tmpdir(), "sceneaxi-game-scene-golden-"));
    try {
      // The profile makes no shipping claim, before or after running this path.
      expect(sceneGoldenPath.seam.name).toBe("@sceneaxi/profile-game");
      expect(sceneGoldenPath.status).toEqual({
        developmentConsumer: true,
        shippingClaim: false,
        productSurface: "not-shipped",
      });

      const artifacts = sourceArtifacts();
      const composed = sceneGoldenPath.core.authoring.composeScene(
        readJson(SCENE_INTAKE_PATH) as SceneCompositionIntake,
        artifacts,
        {
          documentId: "workshop-bay-game-scene",
          title: "Game profile multi-object golden path",
        },
      );
      if (!composed.ok) {
        throw new Error(
          `composition refused (${composed.code}) at ${composed.path}: ${composed.message}`,
        );
      }

      // Three instances from two distinct artifacts, one instanced twice, in a
      // two-level parent chain. This is what "multi-object" has to mean.
      expect(composed.scene.instances).toHaveLength(3);
      expect(
        new Set(composed.scene.instances.map((i) => i.artifactId)).size,
      ).toBe(2);
      expect(composed.scene.instances.map((i) => i.depth)).toEqual([0, 1, 2]);

      const written = sceneGoldenPath.core.authoring.writeDocumentFile(
        DOCUMENT_PATH,
        composed.document,
        { cwd },
      );
      expect(written.ok).toBe(true);

      // Reopening the persisted document must yield the same scene digest —
      // the projection round-trips, it is not a lossy render.
      const reopened = validateDocument(
        JSON.parse(readFileSync(join(cwd, DOCUMENT_PATH), "utf8")) as unknown,
      );
      expect(reopened.ok).toBe(true);
      if (!reopened.ok) return;
      const reopenedScene = composedSceneFromDocumentData(
        reopened.document.data,
      );
      expect(reopenedScene.ok).toBe(true);
      if (!reopenedScene.ok) return;
      expect(reopenedScene.value.evidence.sceneDigest).toBe(
        composed.sceneDigest,
      );

      // Mount every instance through the profile's presentation seam.
      const mounts = sceneGoldenPath.core.presentation.createSculptMountApi(
        sceneGoldenPath.core.presentation.createExperimentalThreeSculptPresentationBackend(),
      );
      for (const instance of composed.scene.instances) {
        mounts.mount({
          instanceId: instance.instanceId,
          artifact: instance.artifact,
          transform: instance.worldTransform,
        });
      }
      const frame = mounts.render();
      expect(mounts.list()).toHaveLength(3);
      expect(frame.drawCalls).toBe(
        composed.scene.instances.reduce(
          (total, instance) => total + instance.artifact.spec.components.length,
          0,
        ),
      );
      mounts.dispose();

      // Kernel session over the composed scene: advancing changes state, and
      // replaying the save reproduces the terminal snapshot exactly.
      const session = sceneGoldenPath.core.kernel.openSceneKernelSession(
        composed.scene,
        { seed: SCENE_SEED },
      );
      const initial = session.observe();
      for (let tick = 1; tick <= 8; tick += 1) {
        session.advance({ tick, deltaMs: 100 });
      }
      const terminal = session.observe();
      expect(terminal.digest).not.toBe(initial.digest);

      const replayed = sceneGoldenPath.core.kernel
        .replaySceneKernelSession(session.save())
        .observe();
      expect(replayed.digest).toBe(terminal.digest);
      expect(replayed.instances).toHaveLength(3);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("is deterministic: composing twice yields the same scene digest", () => {
    const artifacts = sourceArtifacts();
    const intake = readJson(SCENE_INTAKE_PATH) as SceneCompositionIntake;
    const first = sceneGoldenPath.core.authoring.composeScene(intake, artifacts);
    const second = sceneGoldenPath.core.authoring.composeScene(
      intake,
      artifacts,
    );
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.sceneDigest).toBe(first.sceneDigest);
    expect(second.sceneBytes).toBe(first.sceneBytes);
  });

  it("refuses a scene whose intake references an artifact it was not given", () => {
    const [only] = sourceArtifacts();
    const refused = sceneGoldenPath.core.authoring.composeScene(
      readJson(SCENE_INTAKE_PATH) as SceneCompositionIntake,
      only === undefined ? [] : [only],
    );
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.code).toBe("unknown-artifact-reference");
  });
});
