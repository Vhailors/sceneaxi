/**
 * The public live open path, tested without a browser.
 *
 * The browser only adds a canvas and a frame loop. Everything that decides *what* is
 * opened — the committed fixture, its placements, the composed world transforms, the
 * evidence digest, and the vocabulary the page may use — is decided here and is
 * therefore covered by `pnpm gate`.
 */
import { describe, expect, it } from "vitest";
import {
  LIVE_OPEN_PATH,
  LIVE_OPEN_PRESENTATION,
  LIVE_OPEN_SCENE_ID,
  composeLiveOpenScene,
  liveOpenScene,
  webEditorStarterArtifact,
  type LiveOpenScene,
} from "@sceneaxi/site-kit";

const opened = (): LiveOpenScene => {
  const result = liveOpenScene();
  if (!result.ok) throw new Error(`live open scene refused: ${result.reason}`);
  return result.value;
};

describe("live open scene", () => {
  it("opens a real reconstructed artifact, not a placeholder", () => {
    const scene = opened();
    const starter = webEditorStarterArtifact();
    expect(starter.ok).toBe(true);
    if (!starter.ok) return;

    expect(Object.keys(scene.artifacts)).toEqual([starter.value.artifactId]);
    const artifact = scene.artifacts[starter.value.artifactId];
    // The exact artifact bytes travel: composition places, it never rewrites.
    expect(artifact).toStrictEqual(starter.value);
    expect(artifact?.spec.components.length).toBeGreaterThan(1);
  });

  it("is multi-object with exactly one root, so it is a scene and not a sculpt", () => {
    const scene = opened();
    expect(scene.sceneId).toBe(LIVE_OPEN_SCENE_ID);
    expect(scene.instances.length).toBeGreaterThanOrEqual(2);
    const roots = scene.instances.filter((instance) => instance.parentInstanceId === null);
    expect(roots.map((instance) => instance.instanceId)).toEqual([scene.rootInstanceId]);
    expect(new Set(scene.instances.map((instance) => instance.instanceId)).size).toBe(
      scene.instances.length,
    );
  });

  it("carries lowercase-slug instance ids the Sculpt Mount API accepts", () => {
    for (const instance of opened().instances) {
      expect(instance.instanceId).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("takes its world transforms from the composition pipeline", () => {
    const scene = opened();
    const byId = new Map(scene.instances.map((instance) => [instance.instanceId, instance]));
    const root = byId.get(scene.rootInstanceId);
    expect(root?.depth).toBe(0);
    expect(root?.worldTransform.translation).toEqual([0, 0, 0]);

    for (const instance of scene.instances) {
      if (instance.instanceId === scene.rootInstanceId) continue;
      expect(instance.depth).toBe(1);
      expect(instance.parentInstanceId).toBe(scene.rootInstanceId);
      // Distinct placements: no two instances land on the same world position.
      const collisions = scene.instances.filter(
        (other) =>
          other.instanceId !== instance.instanceId &&
          other.worldTransform.translation.join(",") ===
            instance.worldTransform.translation.join(","),
      );
      expect(collisions).toEqual([]);
    }
  });

  it("publishes a stable scene digest, so the same deploy opens the same scene", () => {
    const first = opened();
    const second = opened();
    expect(first.sceneDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(second.sceneDigest).toBe(first.sceneDigest);
    expect(second.instances).toStrictEqual(first.instances);
  });

  it("refuses rather than opening a partial scene when the pipeline says no", () => {
    expect(composeLiveOpenScene({ artifactId: "not-an-artifact" })).toMatchObject({
      ok: false,
      reason: "LIVE_OPEN_NOT_COMPOSABLE",
    });
  });

  it("refuses accessor-backed and unstable artifact ids without invoking them", () => {
    let accessorReads = 0;
    const accessorBacked = Object.defineProperty({}, "artifactId", {
      enumerable: true,
      get() {
        accessorReads += 1;
        return "not-an-artifact";
      },
    });
    const unstable = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error("unstable descriptor");
        },
      },
    );

    for (const artifact of [accessorBacked, unstable]) {
      expect(composeLiveOpenScene(artifact)).toMatchObject({
        ok: false,
        reason: "LIVE_OPEN_NOT_COMPOSABLE",
      });
    }
    expect(accessorReads).toBe(0);
  });

  it("serves the path the umbrella routes and the catalogs may link", () => {
    expect(LIVE_OPEN_PATH).toBe("/open");
  });
});

describe("live open presentation vocabulary", () => {
  it("names Three as the product presentation core behind the ADR 0002 seam", () => {
    expect(LIVE_OPEN_PRESENTATION.coreLabel).toBe("Three presentation core");
    expect(LIVE_OPEN_PRESENTATION.decision).toContain("product presentation core");
    expect(LIVE_OPEN_PRESENTATION.decision).toContain("ADR 0017");
    expect(LIVE_OPEN_PRESENTATION.seam).toContain("ADR 0002");
  });

  it("keeps the retired experimental framing out of the shipped vocabulary", () => {
    const copy = Object.entries(LIVE_OPEN_PRESENTATION)
      .filter(([key]) => key !== "retiredLabels")
      .map(([, value]) => String(value))
      .join(" ");
    for (const retired of LIVE_OPEN_PRESENTATION.retiredLabels) {
      expect(copy).not.toContain(retired);
    }
    expect(copy.toLowerCase()).not.toContain("experimental");
    expect(copy.toLowerCase()).not.toContain("multi-renderer");
  });

  it("still refuses to claim a Stage 1 result", () => {
    expect(LIVE_OPEN_PRESENTATION.notClaimed).toContain("Stage 1");
    expect(Object.isFrozen(LIVE_OPEN_PRESENTATION)).toBe(true);
  });
});
