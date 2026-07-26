/**
 * The browser mount payload both umbrella viewports are built from.
 *
 * What matters is that the payload is a *projection* of an accepted composition and
 * carries no arithmetic of its own: world transforms, hierarchy, and artifacts are the
 * pipeline's, and the artifact for N instances is carried once.
 */
import { describe, expect, it } from "vitest";
import { composeScene } from "@sceneaxi/authoring-core";
import {
  SCENE_COMPOSITION_INTAKE_KIND,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  identitySculptTransform,
  type SceneCompositionIntake,
  type SculptArtifact,
} from "@sceneaxi/schemas";
import { mountableScene, webEditorStarterArtifact } from "@sceneaxi/site-kit";

const starter = (): SculptArtifact => {
  const artifact = webEditorStarterArtifact();
  if (!artifact.ok) throw new Error(`starter artifact refused: ${artifact.reason}`);
  return artifact.value;
};

const placed = (x: number) => ({
  ...identitySculptTransform(),
  translation: [x, 0, 0] as const,
});

function composedFixture() {
  const artifact = starter();
  const intake: SceneCompositionIntake = {
    schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
    kind: SCENE_COMPOSITION_INTAKE_KIND,
    sceneId: "mountable-scene-fixture",
    rootInstanceId: "fixture-root",
    placements: [
      {
        instanceId: "fixture-root",
        artifactId: artifact.artifactId,
        parentInstanceId: null,
        transform: placed(0),
      },
      {
        instanceId: "fixture-child",
        artifactId: artifact.artifactId,
        parentInstanceId: "fixture-root",
        transform: placed(3),
      },
    ],
  };
  const composed = composeScene(intake, [artifact]);
  if (!composed.ok) throw new Error(`fixture did not compose: ${composed.code}`);
  return composed;
}

describe("mountableScene — the payload a browser mounts", () => {
  it("carries the pipeline's own scene identity and digest", () => {
    const composed = composedFixture();
    const scene = mountableScene(composed);
    expect(scene.sceneId).toBe(composed.scene.sceneId);
    expect(scene.rootInstanceId).toBe(composed.scene.rootInstanceId);
    expect(scene.sceneDigest).toBe(composed.sceneDigest);
    expect(Object.isFrozen(scene)).toBe(true);
    expect(Object.isFrozen(scene.instances)).toBe(true);
  });

  it("reads every world transform from the composition rather than computing one", () => {
    const composed = composedFixture();
    const scene = mountableScene(composed);
    expect(scene.instances.length).toBe(composed.scene.instances.length);
    for (const [index, instance] of scene.instances.entries()) {
      const source = composed.scene.instances[index];
      expect(instance.instanceId).toBe(source?.instanceId);
      expect(instance.parentInstanceId).toBe(source?.parentInstanceId ?? null);
      expect(instance.depth).toBe(source?.depth);
      expect(instance.worldTransform).toEqual(source?.worldTransform);
    }
    // The child was placed relative to its parent, so its world transform is the
    // pipeline's projection and not the placement value handed in.
    const child = scene.instances.find((instance) => instance.instanceId === "fixture-child");
    expect(child?.depth).toBe(1);
  });

  it("carries one artifact for many instances of it", () => {
    const scene = mountableScene(composedFixture());
    expect(Object.keys(scene.artifacts)).toEqual([starter().artifactId]);
    for (const instance of scene.instances) {
      expect(scene.artifacts[instance.artifactId]).toBeDefined();
    }
  });

  it("labels an instance with its own id unless a placement annotation is supplied", () => {
    const composed = composedFixture();
    expect(mountableScene(composed).instances.map((instance) => instance.label)).toEqual([
      "fixture-root",
      "fixture-child",
    ]);
    const labelled = mountableScene(
      composed,
      new Map([["fixture-child", "Placed beside the root"]]),
    );
    expect(labelled.instances.map((instance) => instance.label)).toEqual([
      "fixture-root",
      "Placed beside the root",
    ]);
  });

  it("never rewrites an artifact to place it", () => {
    const composed = composedFixture();
    const scene = mountableScene(composed);
    const artifact = scene.artifacts[starter().artifactId];
    // Evidence binds an artifact's exact spec bytes, so a placed artifact is the
    // reconstructed one, byte for byte.
    expect(artifact).toEqual(starter());
  });
});
