/**
 * Shared internals of the Three presentation core: scene, lights, camera,
 * viewport, draw surface, frame counter, and capture.
 *
 * Both public Three facades — the ADR 0002 Presentation Runtime and the Sculpt
 * Mount backend — are thin wrappers over this one core, so the product has a
 * single renderer path.
 */
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  Scene,
  type Object3D,
} from "three";
import { createOrbitCamera, type OrbitCameraOptions, type OrbitCameraControls } from "./orbit-camera.js";
import { ThreePresentationError } from "./three-presentation-error.js";
import {
  createHeadlessThreeSurface,
  createWebGLCanvasSurface,
  type ThreeCanvasTarget,
  type ThreePresentationSurface,
  type ThreePresentationSurfaceKind,
} from "./three-surface.js";

/** UI-facing identification of the product presentation core. */
export const THREE_PRESENTATION_CORE_LABEL = "Three presentation core";

/** UI-facing identification of the no-pixel gate surface of the same core. */
export const THREE_HEADLESS_SURFACE_LABEL =
  "Three presentation core — headless surface, no pixels drawn";

export type ThreeViewport = {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio?: number;
};

export type ThreePresentationCoreOptions = {
  /**
   * Browser canvas to draw into. Given a canvas, the core builds a real
   * `WebGLRenderer` and draws pixels.
   */
  readonly canvas?: ThreeCanvasTarget;
  /**
   * Explicit draw surface. Overrides `canvas`; used by gates and by hosts that
   * own renderer construction themselves.
   */
  readonly surface?: ThreePresentationSurface;
  readonly viewport?: ThreeViewport;
  readonly camera?: OrbitCameraOptions;
  /** CSS color for the scene background, or null for a transparent clear. */
  readonly background?: string | null;
  readonly antialias?: boolean;
  readonly preserveDrawingBuffer?: boolean;
};

export type ThreeDrawnFrame = {
  readonly frame: number;
  readonly drawCalls: number;
  readonly pixelsDrawn: boolean;
  readonly surface: ThreePresentationSurfaceKind;
};

export type ThreePresentationCore = {
  readonly surfaceKind: ThreePresentationSurfaceKind;
  readonly label: string;
  readonly camera: OrbitCameraControls;
  /** Implementation-private scene root a facade may populate. */
  readonly content: Group;
  frames(): number;
  draw(): ThreeDrawnFrame;
  resize(width: number, height: number, pixelRatio?: number): void;
  capture(): Uint8Array | null;
  dispose(): void;
};

const DEFAULT_VIEWPORT = { width: 1280, height: 720 } as const;

function resolveViewport(options: ThreePresentationCoreOptions): {
  width: number;
  height: number;
  pixelRatio: number;
} {
  const declared = options.viewport;
  const canvas = options.canvas;
  const width = declared?.width ?? canvas?.width ?? DEFAULT_VIEWPORT.width;
  const height = declared?.height ?? canvas?.height ?? DEFAULT_VIEWPORT.height;
  const pixelRatio = declared?.pixelRatio ?? 1;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new ThreePresentationError(
      "invalid-viewport",
      "Viewport width and height must be positive integers.",
    );
  }
  if (!Number.isFinite(pixelRatio) || pixelRatio <= 0) {
    throw new ThreePresentationError(
      "invalid-viewport",
      "Viewport pixelRatio must be a finite positive number.",
    );
  }
  return { width, height, pixelRatio };
}

function resolveSurface(
  options: ThreePresentationCoreOptions,
): ThreePresentationSurface {
  if (options.surface !== undefined) return options.surface;
  if (options.canvas === undefined) return createHeadlessThreeSurface();
  return createWebGLCanvasSurface({
    canvas: options.canvas,
    alpha: options.background === null,
    ...(options.antialias === undefined ? {} : { antialias: options.antialias }),
    ...(options.preserveDrawingBuffer === undefined
      ? {}
      : { preserveDrawingBuffer: options.preserveDrawingBuffer }),
  });
}

/** Builds the one shared Three core: scene graph, lighting, camera, and surface. */
export function createThreePresentationCore(
  options: ThreePresentationCoreOptions = {},
): ThreePresentationCore {
  const viewport = resolveViewport(options);
  const orbit = createOrbitCamera(options.camera ?? {});
  const scene = new Scene();
  const background = options.background === undefined ? "#101318" : options.background;
  scene.background = background === null ? null : new Color(background);

  const content = new Group();
  content.name = "sceneaxi-content";
  scene.add(content);

  const ambient = new AmbientLight(0xffffff, 0.45);
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 6, 5);
  const fill = new DirectionalLight(0x99bbff, 0.6);
  fill.position.set(-5, 2, -4);
  scene.add(ambient, key, fill);

  const surface = resolveSurface(options);
  let frame = 0;
  let disposed = false;

  function requireLive() {
    if (disposed) {
      throw new ThreePresentationError(
        "not-mounted",
        "Three presentation core is disposed.",
      );
    }
  }

  orbit.setViewport(viewport.width, viewport.height);
  try {
    surface.resize(viewport.width, viewport.height, viewport.pixelRatio);
  } catch (error) {
    if (options.surface === undefined) surface.dispose();
    throw error;
  }

  return {
    surfaceKind: surface.kind,
    label:
      surface.kind === "webgl-canvas"
        ? THREE_PRESENTATION_CORE_LABEL
        : THREE_HEADLESS_SURFACE_LABEL,
    camera: orbit.controls,
    content,

    frames() {
      return frame;
    },

    draw() {
      requireLive();
      const result = surface.draw(scene, orbit.camera);
      frame += 1;
      return Object.freeze({
        frame,
        drawCalls: result.drawCalls,
        pixelsDrawn: result.pixelsDrawn,
        surface: surface.kind,
      });
    },

    resize(width, height, pixelRatio) {
      requireLive();
      const resolved = resolveViewport({
        viewport: {
          width,
          height,
          ...(pixelRatio === undefined ? {} : { pixelRatio }),
        },
      });
      orbit.setViewport(resolved.width, resolved.height);
      surface.resize(resolved.width, resolved.height, resolved.pixelRatio);
    },

    capture() {
      requireLive();
      return surface.capture();
    },

    dispose() {
      if (disposed) return;
      disposeSubtree(content);
      content.clear();
      scene.clear();
      surface.dispose();
      disposed = true;
    },
  };
}

/** Releases GPU resources owned by a subtree without touching kernel state. */
export function disposeSubtree(root: Object3D) {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) material.dispose();
  });
}
