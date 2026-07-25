/**
 * Golden path for the umbrella's public live open path (T1).
 *
 * The browser page adds a canvas and `requestAnimationFrame` and nothing else, so
 * everything between the committed fixture and the draw call is provable in node:
 * committed starter intake → deterministic reconstruction → `composeScene` placement
 * → Sculpt Mount API → the one Three presentation core.
 *
 * WebGL cannot run in node, so this test drives the **headless** surface of that same
 * core and asserts it never claims pixels. The pixel claim is verified in a real
 * browser and recorded in `docs/three-presentation-core.md`; what is asserted here is
 * that the canvas path builds a real `WebGLRenderer` — which must fail in node — so a
 * silently stubbed renderer cannot pass this gate.
 */
import { describe, expect, it } from "vitest";
import {
  THREE_HEADLESS_SURFACE_LABEL,
  THREE_PRESENTATION_CORE_LABEL,
  createSculptMountApi,
  createThreeRenderLoop,
  createThreeSculptPresentationBackend,
  type FrameScheduler,
} from "../../packages/engine-presentation/src/index.ts";
import {
  LIVE_OPEN_PRESENTATION,
  liveOpenScene,
  type LiveOpenScene,
} from "@sceneaxi/site-kit";

const opened = (): LiveOpenScene => {
  const result = liveOpenScene();
  if (!result.ok) throw new Error(`live open scene refused: ${result.reason}`);
  return result.value;
};

/** Mount every instance of the served scene exactly as the browser page does. */
function mountServedScene(scene: LiveOpenScene) {
  const backend = createThreeSculptPresentationBackend();
  const mounts = createSculptMountApi(backend);
  for (const instance of scene.instances) {
    const artifact = scene.artifacts[instance.artifactId];
    if (artifact === undefined) throw new Error(`served scene omits ${instance.artifactId}`);
    mounts.mount({
      instanceId: instance.instanceId,
      artifact,
      transform: instance.worldTransform,
    });
  }
  return { backend, mounts };
}

/** Deterministic stand-in for `requestAnimationFrame`, driven frame by frame. */
function manualScheduler(): FrameScheduler & { tick(timeMs: number): void } {
  const pending: ((timeMs: number) => void)[] = [];
  return {
    request(callback) {
      pending.push(callback);
      return pending.length;
    },
    cancel() {
      pending.length = 0;
    },
    tick(timeMs) {
      const next = pending.shift();
      if (next !== undefined) next(timeMs);
    },
  };
}

describe("umbrella live open path — served scene reaches the Three core", () => {
  it("mounts every served instance and draws them through one core", () => {
    const scene = opened();
    const { backend, mounts } = mountServedScene(scene);

    expect(mounts.list().map((instance) => instance.instanceId)).toEqual(
      scene.instances.map((instance) => instance.instanceId),
    );

    const frame = mounts.render();
    expect(frame.backend).toBe("three");
    expect(frame.instanceIds).toEqual(
      [...scene.instances.map((instance) => instance.instanceId)].sort(),
    );
    // One draw per mesh a renderer would issue: every artifact node of every instance.
    const nodesPerInstance = scene.instances.map((instance) => {
      const artifact = scene.artifacts[instance.artifactId];
      return artifact?.runtimeHierarchy.nodes.length ?? 0;
    });
    expect(frame.drawCalls).toBe(nodesPerInstance.reduce((sum, count) => sum + count, 0));
    expect(frame.drawCalls).toBeGreaterThan(0);

    mounts.dispose();
    void backend;
  });

  it("never lets the node gate claim pixels it did not draw", () => {
    const { backend, mounts } = mountServedScene(opened());
    const frame = mounts.render();

    expect(frame.surface).toBe("headless");
    expect(frame.pixelsDrawn).toBe(false);
    expect(frame.label).toBe(THREE_HEADLESS_SURFACE_LABEL);
    expect(frame.label).toBe(LIVE_OPEN_PRESENTATION.headlessLabel);
    expect(backend.capture()).toBeNull();

    mounts.dispose();
  });

  it("frames the mounted content and accepts orbit and zoom as plain numbers", () => {
    const { backend, mounts } = mountServedScene(opened());
    const initial = backend.camera.state();

    // Framing must actually move the camera: a multi-crate scene does not fit the
    // default distance, so the page's "fit the scene" step is not decorative.
    backend.frameMountedContent();
    const framed = backend.camera.state();
    expect(framed.distance).toBeGreaterThan(initial.distance);
    for (const component of framed.position) expect(Number.isFinite(component)).toBe(true);

    const orbited = backend.camera.dragOrbit(120, -40);
    expect(orbited.azimuthRadians).not.toBe(framed.azimuthRadians);
    expect(orbited.polarRadians).not.toBe(framed.polarRadians);

    const zoomed = backend.camera.wheelZoom(300);
    expect(zoomed.distance).toBeGreaterThan(orbited.distance);
    // "Reset view" returns to the camera the page was constructed with.
    expect(backend.camera.reset()).toEqual(initial);

    mounts.dispose();
  });

  it("draws one frame per scheduled tick, so the page loop is real", () => {
    const { mounts } = mountServedScene(opened());
    const scheduler = manualScheduler();
    const frames: number[] = [];
    const loop = createThreeRenderLoop({
      scheduler,
      onFrame: () => frames.push(mounts.render().frame),
    });

    loop.start();
    for (let tick = 1; tick <= 4; tick += 1) scheduler.tick(tick * 16);
    loop.stop();

    expect(frames).toEqual([1, 2, 3, 4]);
    expect(loop.running()).toBe(false);

    mounts.dispose();
  });

  it("keeps mount and unmount live, which is what the page's root-only toggle uses", () => {
    const scene = opened();
    const { mounts } = mountServedScene(scene);
    const children = scene.instances.filter(
      (instance) => instance.instanceId !== scene.rootInstanceId,
    );
    expect(children.length).toBeGreaterThan(0);

    for (const child of children) mounts.unmount(child.instanceId);
    const rootOnly = mounts.render();
    expect(rootOnly.instanceIds).toEqual([scene.rootInstanceId]);

    for (const child of children) {
      const artifact = scene.artifacts[child.artifactId];
      if (artifact === undefined) throw new Error("served scene omits an artifact");
      mounts.mount({
        instanceId: child.instanceId,
        artifact,
        transform: child.worldTransform,
      });
    }
    expect(mounts.render().instanceIds).toEqual(
      [...scene.instances.map((instance) => instance.instanceId)].sort(),
    );

    mounts.dispose();
  });

  it("builds a real WebGLRenderer on the canvas path, so node must refuse it", () => {
    expect(() =>
      createThreeSculptPresentationBackend({
        canvas: {
          width: 960,
          height: 540,
          getContext: () => null,
          addEventListener: () => {},
          removeEventListener: () => {},
        } as never,
      }),
    ).toThrow(/webgl/i);
  });

  it("labels a pixel-drawing surface exactly as the shipped copy promises", () => {
    expect(LIVE_OPEN_PRESENTATION.coreLabel).toBe(THREE_PRESENTATION_CORE_LABEL);
  });
});
