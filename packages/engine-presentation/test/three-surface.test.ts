import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { beforeEach, describe, expect, it } from "vitest";

import type { WebGLRendererParameters } from "three";
import { createWebGLCanvasSurfaceWithRenderer } from "../src/three-surface.js";
import type { ThreeCanvasTarget, ThreePresentationRuntimeOptions } from "@sceneaxi/engine-presentation";

type RendererState = { disposals: number; draws: number; options: WebGLRendererParameters[]; renderers: TestWebGLRenderer[] };

const rendererState: RendererState = { disposals: 0, draws: 0, options: [], renderers: [] };

class TestWebGLRenderer {
  getContext() { return { isContextLost: () => false }; }
  outputColorSpace = "";
  toneMapping = 0;
  toneMappingExposure = 1;
  readonly info = {
    render: { calls: 0 },
    autoReset: true,
    reset: () => { this.info.render.calls = 0; },
  };

  constructor(options: WebGLRendererParameters) {
    rendererState.options.push(options);
    rendererState.renderers.push(this);
  }

  readonly renderLists = { dispose() {} };
  forceContextLoss() {}
  setPixelRatio() {}
  setSize() {}
  render() { rendererState.draws += 1; this.info.render.calls = 1; }
  dispose() { rendererState.disposals += 1; }
}

import { open, type ProductManifest } from "@sceneaxi/engine-kernel";
import { createThreePresentationRuntime as createRuntime, releaseThreeCanvas } from "@sceneaxi/engine-presentation";

type CanvasRuntimeOptions = ThreePresentationRuntimeOptions & { canvas: ThreeCanvasTarget };

function createThreePresentationRuntime(options: CanvasRuntimeOptions) {
  const surface = createWebGLCanvasSurfaceWithRenderer({ canvas: options.canvas, alpha: options.background === null }, (parameters) => new TestWebGLRenderer(parameters));

  return createRuntime({ ...options, surface });
}

const manifest: ProductManifest = {
  productId: "three-surface-test",
  seed: 1,
  entities: [{ id: "marker", x: 0, y: 0 }],
};

function eventCanvas() {
  const listeners = new Map<string, Set<() => void>>();

  return {
    canvas: {
      width: 320,
      height: 240,
      toDataURL: () => "data:image/png;base64,iVBORw==",
      addEventListener(type: string, listener: () => void) {
        const registered = listeners.get(type) ?? new Set();
        registered.add(listener);
        listeners.set(type, registered);
      },
      removeEventListener(type: string, listener: () => void) {
        listeners.get(type)?.delete(listener);
      },
    },
    emit(type: string) {
      for (const listener of listeners.get(type) ?? []) listener();
    },
    listenerCount(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

describe("Three canvas surface capture lifecycle", () => {
  beforeEach(() => {
    rendererState.disposals = 0;
    rendererState.draws = 0;
    rendererState.options.length = 0;
    rendererState.renderers.length = 0;
  });

  it("forwards transparent clearing to the WebGL renderer alpha option", () => {
    const { canvas } = eventCanvas();

    const transparent = createThreePresentationRuntime({
      canvas,
      background: null,
    });

    const coloredCanvas = eventCanvas().canvas;

    const colored = createThreePresentationRuntime({
      canvas: coloredCanvas,
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
    releaseThreeCanvas(canvas);
    releaseThreeCanvas(coloredCanvas);
    expect(rendererState.disposals).toBe(2);
  });

  it("invalidates the captured frame after a resize", () => {
    const { canvas } = eventCanvas();
    const runtime = createThreePresentationRuntime({ canvas });

    const snapshot = open(manifest, {
      nowMs: () => 1_753_420_800_000,
    }).observe();

    runtime.mount();
    runtime.present(snapshot, [], 1);

    expect(rendererState.draws).toBe(1);
    expect(rendererState.renderers[0]).toMatchObject({
      outputColorSpace: SRGBColorSpace,
      toneMapping: ACESFilmicToneMapping,
      toneMappingExposure: 1.35,
    });
    expect(runtime.capture()?.bytes).toBeInstanceOf(Uint8Array);

    runtime.resize(640, 480);
    expect(runtime.capture()).toBeNull();
    runtime.dispose();
    releaseThreeCanvas(canvas);
    expect(rendererState.disposals).toBe(1);
  });

  it("stops claiming pixels while its WebGL context is lost", () => {
    const target = eventCanvas();
    const runtime = createThreePresentationRuntime({ canvas: target.canvas });

    const snapshot = open(manifest, {
      nowMs: () => 1_753_420_800_000,
    }).observe();

    runtime.mount();
    runtime.present(snapshot, [], 1);

    expect(runtime.lastFrame()).toMatchObject({
      drawCalls: 1,
      pixelsDrawn: true,
    });
    expect(runtime.capture()?.bytes).toBeInstanceOf(Uint8Array);

    target.emit("webglcontextlost");
    runtime.present(snapshot, [], 1);

    expect(runtime.lastFrame()).toMatchObject({
      drawCalls: 0,
      pixelsDrawn: false,
    });
    expect(runtime.capture()).toBeNull();
    expect(rendererState.draws).toBe(1);

    target.emit("webglcontextrestored");
    runtime.present(snapshot, [], 1);

    expect(runtime.lastFrame()).toMatchObject({
      drawCalls: 1,
      pixelsDrawn: true,
    });
    expect(rendererState.draws).toBe(2);

    runtime.dispose();
    expect(target.listenerCount("webglcontextlost")).toBe(0);
    expect(target.listenerCount("webglcontextrestored")).toBe(0);
    expect(rendererState.disposals).toBe(0);
    releaseThreeCanvas(target.canvas);
    expect(rendererState.disposals).toBe(1);
  });
});
