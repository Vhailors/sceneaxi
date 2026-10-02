import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { composeScene, createDocument, writeDocumentFile } from "@sceneaxi/authoring-core";
import {
  RARITY_NAMESPACE_KIND,
  RARITY_POLICY_KIND,
  RARITY_SCHEMA_VERSION,
  SCENE_COMPOSITION_INTAKE_KIND,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  type SceneCompositionIntake,
} from "@sceneaxi/schemas";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_RARITY_PRODUCT_ID,
  DESKTOP_RARITY_PROJECT_SEED,
  createDesktopBridge,
  desktopOpenScene,
} from "../../desktop/linux/src/index.ts";
import { playableExercise } from "../../desktop/linux/src/renderer/playback-report.ts";

const FIXED_NOW_MS = 1_753_920_000_000;
const fixedNow = (): number => FIXED_NOW_MS;
const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
});

function activeDocumentData(sceneId = "desktop-linux-open-scene") {
  const starter = desktopOpenScene();
  if (!starter.ok) throw new Error(`desktop scene refused: ${starter.reason}`);
  const intake: SceneCompositionIntake = {
    schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
    kind: SCENE_COMPOSITION_INTAKE_KIND,
    sceneId,
    rootInstanceId: starter.composed.scene.rootInstanceId,
    placements: starter.composed.scene.instances.map((instance) => ({
      instanceId: instance.instanceId,
      artifactId: instance.artifactId,
      parentInstanceId: instance.parentInstanceId,
      transform: instance.localTransform,
    })),
  };
  const artifacts = [
    ...new Map(
      starter.composed.scene.instances.map((instance) => [instance.artifactId, instance.artifact]),
    ).values(),
  ];
  const composed = composeScene(intake, artifacts);
  if (!composed.ok) throw new Error(`active document composition refused: ${composed.code}`);
  return composed.document.data;
}

function authoringDir(
  sceneId = "desktop-linux-open-scene",
  extraData: Readonly<Record<string, unknown>> = {},
): string {
  const dir = mkdtempSync(join(tmpdir(), "sceneaxi-desktop-golden-"));
  tmpDirs.push(dir);
  const doc = createDocument({
    id: "scene",
    data: {
      ...activeDocumentData(sceneId),
      ...extraData,
      entities: [{ id: "hero", x: 1, y: 2, rz: 0 }],
      material: { roughness: 0.4 },
    },
  });
  const written = writeDocumentFile(join(dir, "scene.json"), doc, { cwd: dir });
  if (!written.ok) throw new Error("golden fixture document refused");
  return dir;
}

function bridgeAt(dir: string) {
  return createDesktopBridge({ cwd: dir, nowMs: fixedNow });
}

describe("desktop bridge Play and open-path golden", () => {
  it("opens a real kernel scene session through the orchestrator, deterministically", () => {
    const bridge = bridgeAt(authoringDir("active-kernel-scene"));
    const res = bridge.handle({
      action: "open-path",
      payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const exercise = res.data as {
      bootstrap: Record<string, unknown>;
      initialDigest: string;
      tickDigests: string[];
      instanceCount: number;
      closed: boolean;
      mountable: { sceneId: string };
    };

    expect(exercise.bootstrap["kind"]).toBe("scene");
    expect(exercise.bootstrap["subjectId"]).toBe("active-kernel-scene");
    expect(exercise.bootstrap["openedAtMs"]).toBe(FIXED_NOW_MS);
    expect(exercise.bootstrap["resumed"]).toBe(false);
    expect(exercise.bootstrap["sessionId"]).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(exercise.instanceCount).toBe(3);
    expect(exercise.mountable.sceneId).toBe("active-kernel-scene");
    expect(exercise.closed).toBe(true);

    // Only `advance` moves state, and it really does: digests move tick over tick.
    expect(exercise.tickDigests).toHaveLength(4);
    expect(new Set([exercise.initialDigest, ...exercise.tickDigests]).size).toBe(5);

    // Deterministic under a fixed clock: the same request opens the same session.
    const again = bridge.handle({
      action: "open-path",
      payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    if (!again.ok) throw new Error(again.reason);
    expect((again.data as typeof exercise).bootstrap["sessionId"]).toBe(
      exercise.bootstrap["sessionId"],
    );
    expect((again.data as typeof exercise).tickDigests).toEqual(exercise.tickDigests);
  });

  it("opens the composed scene when rarity has no accepted roll", () => {
    const dir = mkdtempSync(join(tmpdir(), "sceneaxi-desktop-preroll-"));
    tmpDirs.push(dir);
    const document = createDocument({
      id: "scene",
      data: {
        ...activeDocumentData("pre-roll-scene"),
        productId: DESKTOP_RARITY_PRODUCT_ID,
        seed: DESKTOP_RARITY_PROJECT_SEED,
        rarity: {
          schemaVersion: RARITY_SCHEMA_VERSION,
          kind: RARITY_NAMESPACE_KIND,
          policy: {
            schemaVersion: RARITY_SCHEMA_VERSION,
            kind: RARITY_POLICY_KIND,
            tierWeights: { common: 1, uncommon: 1, rare: 1, epic: 1, legendary: 1 },
          },
          rolls: [],
        },
      },
    });
    const written = writeDocumentFile(join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH), document, {
      cwd: dir,
    });
    if (!written.ok) throw new Error("pre-roll desktop document refused");

    const response = bridgeAt(dir).handle({
      action: "open-path",
      payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data).toMatchObject({
      bootstrap: { kind: "scene", subjectId: "pre-roll-scene" },
      closed: true,
    });
    expect(response.data).not.toHaveProperty("rarity");
    expect(response.data).not.toHaveProperty("raritySession");
  });

  it("acknowledges a playback only for an exercise it can honour", () => {
    const starter = desktopOpenScene();
    if (!starter.ok) throw new Error(`desktop scene fixture refused: ${starter.reason}`);
    const exercise = {
      closed: true,
      initialDigest: "sha256:initial",
      tickDigests: ["sha256:tick"],
      mountable: starter.mountable,
    };
    expect(playableExercise({ exercise })).toBe(exercise);

    // Every field the acknowledgement line goes on to print is refused when it
    // cannot be trusted, before a single mount happens.
    expect(playableExercise(null)).toBeNull();
    expect(playableExercise({})).toBeNull();
    expect(playableExercise({ exercise: { ...exercise, closed: false } })).toBeNull();
    expect(playableExercise({ exercise: { ...exercise, initialDigest: 1 } })).toBeNull();
    expect(playableExercise({ exercise: { ...exercise, tickDigests: [] } })).toBeNull();
    expect(playableExercise({ exercise: { ...exercise, tickDigests: [7] } })).toBeNull();
    expect(playableExercise({ exercise: { ...exercise, mountable: { sceneId: "x" } } })).toBeNull();
  });
});
