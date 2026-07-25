import { beforeEach, describe, expect, it, vi } from "vitest";

const rendererState = vi.hoisted(() => ({
  draws: 0,
  options: [] as unknown[],
}));

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  class TestWebGLRenderer {
    readonly info = {
      render: { calls: 0 },
      reset: () => {
        this.info.render.calls = 0;
      },
    };

    constructor(options: unknown) {
      rendererState.options.push(options);
    }

    setPixelRatio() {}

    setSize() {}

    render() {
      rendererState.draws += 1;
      this.info.render.calls = 1;
    }

    dispose() {}
  }

  return {
    ...actual,
    WebGLRenderer:
      TestWebGLRenderer as unknown as typeof actual.WebGLRenderer,
  };
});

import { open, type ProductManifest } from "@sceneaxi/engine-kernel";
import { createThreePresentationRuntime } from "@sceneaxi/engine-presentation";

const manifest: ProductManifest = {
  productId: "three-surface-test",
  seed: 1,
  entities: [{ id: "marker", x: 0, y: 0 }],
};

describe("Three canvas surface capture lifecycle", () => {
  beforeEach(() => {
    rendererState.draws = 0;
    rendererState.options.length = 0;
  });

  it("forwards transparent clearing to the WebGL renderer alpha option", () => {
    const canvas = {
      width: 320,
      height: 240,
      toDataURL: () => "data:image/png;base64,iVBORw==",
    };
    const transparent = createThreePresentationRuntime({
      canvas,
      background: null,
    });
    const colored = createThreePresentationRuntime({
      canvas,
      background: "#101318",
    });

    transparent.mount();
    colored.mount();

    expect(rendererState.options).toMatchObject([
      { alpha: true },
      { alpha: false },
    ]);

    transparent.dispose();
    colored.dispose();
  });

  it("invalidates the captured frame after a resize", () => {
    const runtime = createThreePresentationRuntime({
      canvas: {
        width: 320,
        height: 240,
        toDataURL: () => "data:image/png;base64,iVBORw==",
      },
    });
    const snapshot = open(manifest, {
      nowMs: () => 1_753_420_800_000,
    }).observe();
    runtime.mount();
    runtime.present(snapshot, [], 1);

    expect(rendererState.draws).toBe(1);
    expect(runtime.capture()?.bytes).toBeInstanceOf(Uint8Array);

    runtime.resize(640, 480);
    expect(runtime.capture()).toBeNull();
    runtime.dispose();
  });
});
