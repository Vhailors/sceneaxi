/**
 * Game profile multi-object golden path (sceneaxi#117).
 *
 * The single-object MVP path is `cli-golden-path.test.ts`. This one proves the
 * Game profile can drive the composition vertical landed in #113 end to end:
 *
 *   create -> propose/apply -> compose artifacts -> project + reopen a document
 *   -> mount N instances -> open/advance/save/replay -> stable evidence
 *
 * Everything is offline: artifacts are reconstructed from checked-in intakes at
 * their landed seeds, and the scene opens at a fixed seed. No provider, no
 * network, no credential, no spend.
 */
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { reconstructSculpt } from "../../packages/authoring-core/src/index.ts";
import {
  composedSceneFromDocumentData,
  validateDocument,
  type JsonObject,
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
const GOLDEN_PATH =
  "tests/e2e/fixtures/profile-game/golden-digests.json";
const AUTHORING_DOCUMENT_PATH = "workshop-bay.authoring.sceneaxi.json";
const DOCUMENT_PATH = "workshop-bay.game.sceneaxi.json";
const EVIDENCE_PATH = "workshop-bay.game.evidence.json";
const INTAKE_EDIT_POINTER =
  "/data/sceneIntake/placements/2/transform/translation";

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
  it("authors, composes, mounts, replays, and emits stable evidence through the profile", () => {
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
      const targetIntake = readJson(
        SCENE_INTAKE_PATH,
      ) as SceneCompositionIntake;
      const draftIntake = {
        ...targetIntake,
        placements: targetIntake.placements.map((placement, index) =>
          index === 2
            ? {
                ...placement,
                transform: {
                  ...placement.transform,
                  translation: [0, 0, 0] as const,
                },
              }
            : placement,
        ),
      };
      const authoringDocument =
        sceneGoldenPath.core.authoring.createDocument({
          id: "workshop-bay-game-authoring",
          title: "Game profile multi-object authoring input",
          data: { sceneIntake: draftIntake } as JsonObject,
        });
      const authoringWrite =
        sceneGoldenPath.core.authoring.writeDocumentFile(
          AUTHORING_DOCUMENT_PATH,
          authoringDocument,
          { cwd },
        );
      expect(authoringWrite.ok).toBe(true);

      const targetTranslation =
        targetIntake.placements[2]?.transform.translation;
      if (targetTranslation === undefined) {
        throw new Error("golden intake is missing its third placement");
      }
      const proposed = sceneGoldenPath.core.authoring.propose({
        documentPath: AUTHORING_DOCUMENT_PATH,
        jsonPointer: INTAKE_EDIT_POINTER,
        newValue: targetTranslation,
        cwd,
      });
      expect(proposed.ok).toBe(true);
      if (!proposed.ok) {
        throw new Error(proposed.diagnostics[0]?.message ?? "proposal refused");
      }
      const applied = sceneGoldenPath.core.authoring.apply({
        proposal: proposed.proposal,
        cwd,
      });
      expect(applied.ok).toBe(true);
      if (!applied.ok) {
        throw new Error(applied.diagnostics[0]?.message ?? "apply refused");
      }

      const authored = validateDocument(
        JSON.parse(
          readFileSync(join(cwd, AUTHORING_DOCUMENT_PATH), "utf8"),
        ) as unknown,
      );
      expect(authored.ok).toBe(true);
      if (!authored.ok) return;

      const composed = sceneGoldenPath.core.authoring.composeScene(
        authored.document.data["sceneIntake"],
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

      const evidence = {
        schemaVersion: 1,
        kind: "sceneaxi.profile-game-scene-golden-evidence",
        status: "passed",
        profile: {
          name: sceneGoldenPath.seam.name,
          shippingClaim: sceneGoldenPath.status.shippingClaim,
        },
        authoring: {
          documentPath: AUTHORING_DOCUMENT_PATH,
          proposalPointer: INTAKE_EDIT_POINTER,
          appliedPaths: applied.appliedPaths,
        },
        scene: {
          intakePath: SCENE_INTAKE_PATH,
          sceneSeed: SCENE_SEED,
          sceneId: composed.scene.sceneId,
          instanceCount: composed.scene.instances.length,
          sceneDigest: composed.sceneDigest,
          reopenedSceneDigest: reopenedScene.value.evidence.sceneDigest,
        },
        presentation: {
          drawCalls: frame.drawCalls,
          instanceIds: composed.scene.instances.map(
            (instance) => instance.instanceId,
          ),
        },
        kernel: {
          initialDigest: initial.digest,
          terminalDigest: terminal.digest,
          replayDigest: replayed.digest,
        },
      };
      writeFileSync(
        join(cwd, EVIDENCE_PATH),
        `${JSON.stringify(evidence, null, 2)}\n`,
        "utf8",
      );
      expect(
        JSON.parse(readFileSync(join(cwd, EVIDENCE_PATH), "utf8")) as unknown,
      ).toEqual(readJson(GOLDEN_PATH));
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
    const golden = readJson(GOLDEN_PATH) as {
      scene: { sceneDigest: string };
    };
    expect(first.sceneDigest).toBe(golden.scene.sceneDigest);
    expect(second.sceneDigest).toBe(golden.scene.sceneDigest);
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
