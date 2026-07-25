/**
 * Draw surfaces for the Three presentation core.
 *
 * A surface is the pixel destination. Two real adapters exist — the WebGL
 * canvas surface that draws pixels in a browser, and the headless surface used
 * by deterministic non-visual gates — so this internal port satisfies the two
 * real adapters rule of ADR 0004.
 *
 * Renderable values cross this port as opaque handles: no Three type appears in
 * any exported signature, so ADR 0002 backend-hiding still holds.
 */
import { Camera, Mesh, Object3D, WebGLRenderer } from "three";
import { ThreePresentationError } from "./three-presentation-error.js";

/**
 * Opaque renderable handed to a surface. Consumers cannot inspect it; a surface
 * may validate and unwrap it privately without exporting the backend type.
 */
export type ThreeRenderableHandle = unknown;

export type ThreePresentationSurfaceKind = "webgl-canvas" | "headless";

export type ThreeSurfaceDrawResult = {
  /** Draw calls the surface actually issued for this frame. */
  readonly drawCalls: number;
  /** True only when the surface put pixels on a real drawing buffer. */
  readonly pixelsDrawn: boolean;
};

/** Pixel destination for the Three presentation core. */
export interface ThreePresentationSurface {
  readonly kind: ThreePresentationSurfaceKind;
  resize(width: number, height: number, pixelRatio: number): void;
  draw(
    scene: ThreeRenderableHandle,
    camera: ThreeRenderableHandle,
  ): ThreeSurfaceDrawResult;
  /** PNG bytes of the last drawn frame, or null when the surface cannot capture. */
  capture(): Uint8Array | null;
  dispose(): void;
}

/**
 * Minimal structural canvas contract.
 *
 * Declared structurally instead of as `HTMLCanvasElement` so this package needs
 * no DOM lib and its emitted types stay consumable by node-only packages. A real
 * browser canvas satisfies it.
 */
export type ThreeCanvasTarget = {
  readonly width: number;
  readonly height: number;
  toDataURL?(type?: string): string;
};

export type WebGLCanvasSurfaceOptions = {
  readonly canvas: ThreeCanvasTarget;
  readonly antialias?: boolean;
  /**
   * Keeps the drawing buffer readable after a frame so `capture()` returns the
   * frame that was just drawn. Costs memory bandwidth; opt out for pure
   * throughput paths that never capture.
   */
  readonly preserveDrawingBuffer?: boolean;
  readonly alpha?: boolean;
};

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Decodes standard base64 without `atob` or node `Buffer`, so capture works in
 * both browsers and node-hosted tests and the package keeps no `node:` import.
 */
export function decodeBase64(encoded: string): Uint8Array {
  const values: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of encoded) {
    if (character === "=" || character === "\n" || character === "\r") continue;
    const index = BASE64_ALPHABET.indexOf(character);
    if (index < 0) {
      throw new ThreePresentationError(
        "capture-unavailable",
        "Captured data URL is not valid base64.",
      );
    }
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      values.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(values);
}

function requirePositiveInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ThreePresentationError(
      "invalid-viewport",
      `${field} must be a positive integer.`,
    );
  }
}

function requireFiniteRatio(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ThreePresentationError(
      "invalid-viewport",
      "pixelRatio must be a finite positive number.",
    );
  }
}

function asRenderTargets(
  scene: ThreeRenderableHandle,
  camera: ThreeRenderableHandle,
) {
  if (!(scene instanceof Object3D) || !(camera instanceof Camera)) {
    throw new ThreePresentationError(
      "invalid-renderable",
      "Surface received a renderable it cannot draw.",
    );
  }
  return { scene, camera };
}

/**
 * Real browser draw surface: an actual `WebGLRenderer` bound to a canvas.
 *
 * `draw` issues GPU draw calls and reports the renderer's own draw-call count,
 * so a frame count can never be mistaken for a scene-graph walk.
 */
export function createWebGLCanvasSurface(
  options: WebGLCanvasSurfaceOptions,
): ThreePresentationSurface {
  const canvas = options.canvas;
  if (canvas === null || typeof canvas !== "object") {
    throw new ThreePresentationError(
      "invalid-canvas",
      "A canvas is required for the WebGL surface.",
    );
  }
  const preserveDrawingBuffer = options.preserveDrawingBuffer ?? true;
  const renderer = new WebGLRenderer({
    canvas,
    antialias: options.antialias ?? true,
    preserveDrawingBuffer,
    alpha: options.alpha ?? false,
  });
  let drawn = false;

  return {
    kind: "webgl-canvas",

    resize(width, height, pixelRatio) {
      requirePositiveInteger(width, "width");
      requirePositiveInteger(height, "height");
      requireFiniteRatio(pixelRatio);
      drawn = false;
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
    },

    draw(sceneHandle, cameraHandle) {
      const targets = asRenderTargets(sceneHandle, cameraHandle);
      renderer.info.reset();
      renderer.render(targets.scene, targets.camera);
      drawn = true;
      return Object.freeze({
        drawCalls: renderer.info.render.calls,
        pixelsDrawn: true,
      });
    },

    capture() {
      if (typeof canvas.toDataURL !== "function") {
        throw new ThreePresentationError(
          "capture-unsupported",
          "Canvas does not support toDataURL capture.",
        );
      }
      if (!drawn) return null;
      const dataUrl = canvas.toDataURL("image/png");
      const separator = dataUrl.indexOf(",");
      if (!dataUrl.startsWith("data:image/png;base64,") || separator < 0) {
        throw new ThreePresentationError(
          "capture-unavailable",
          "Canvas returned a non-PNG data URL.",
        );
      }
      return decodeBase64(dataUrl.slice(separator + 1));
    },

    dispose() {
      renderer.dispose();
      drawn = false;
    },
  };
}

/**
 * Deterministic no-pixel surface for node gates.
 *
 * It flushes world matrices exactly like a draw would and reports the meshes a
 * renderer would have drawn, but it never claims pixels and never captures.
 */
export function createHeadlessThreeSurface(): ThreePresentationSurface {
  return {
    kind: "headless",

    resize(width, height, pixelRatio) {
      requirePositiveInteger(width, "width");
      requirePositiveInteger(height, "height");
      requireFiniteRatio(pixelRatio);
    },

    draw(sceneHandle, cameraHandle) {
      const targets = asRenderTargets(sceneHandle, cameraHandle);
      targets.scene.updateMatrixWorld(true);
      let drawCalls = 0;
      targets.scene.traverse((object) => {
        if (object instanceof Mesh && object.visible) drawCalls += 1;
      });
      return Object.freeze({ drawCalls, pixelsDrawn: false });
    },

    capture() {
      return null;
    },

    dispose() {},
  };
}
