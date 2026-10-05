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
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  Color,
  DirectionalLight,
  Fog,
  GridHelper,
  Group,
  Mesh,
  MeshStandardMaterial,
  SkinnedMesh,
  Scene,
  type Object3D,
} from "three";
import {
  SCENE_EFFECT_EMITTER_KINDS,
  SCENE_ENVIRONMENT_EFFECTS,
  SCENE_ENVIRONMENT_TONE_MAPS,
  sampleSceneEffects,
  isSculptIdentifier,
  type SceneEffectsCatalog,
  type SceneEffectsEvaluation,
  type SceneEnvironmentCatalog,
} from "@sceneaxi/schemas";
import { createOrbitCamera, type OrbitCameraOptions, type OrbitCameraControls } from "./orbit-camera.js";
import { ThreePresentationError } from "./three-presentation-error.js";
import {
  createHeadlessThreeSurface,
  createWebGLCanvasSurface,
  type ThreeCanvasTarget,
  type ThreePresentationSurface,
  type ThreePresentationSurfaceKind,
  type ThreeSurfaceSettings,
  type WebGLCanvasSurfaceOptions,
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
  /**
   * Presentation-authored environment. Numbers and strings only — no Three
   * type crosses this option (ADR 0002).
   */
  readonly environment?: ThreeSceneEnvironment;
  readonly antialias?: boolean;
  readonly preserveDrawingBuffer?: boolean;
};

export type ThreeSceneEnvironment = {
  readonly background?: string | null;
  readonly ambientIntensity?: number;
  readonly ambientColor?: string;
  readonly keyIntensity?: number;
  readonly keyColor?: string;
  readonly keyDirection?: readonly [number, number, number];
  readonly fillIntensity?: number;
  readonly fog?: Readonly<{ enabled: boolean; color: string; near: number; far: number }>;
  readonly effects?: SceneEnvironmentCatalog["effects"];
  readonly toneMapping?: SceneEnvironmentCatalog["toneMapping"];
  readonly exposure?: number;
};

export type ThreeDrawnFrame = {
  readonly frame: number;
  readonly drawCalls: number;
  readonly pixelsDrawn: boolean;
  readonly surface: ThreePresentationSurfaceKind;
  readonly effects: readonly string[];
  readonly environmentBackground: string | null;
};

/** The effects sampler's accepted time window (`sampleSceneEffects` refuses beyond it). */
const EFFECTS_SAMPLE_WINDOW_MS = 60_000;

export type ThreePresentationCore = {
  readonly surfaceKind: ThreePresentationSurfaceKind;
  readonly label: string;
  readonly camera: OrbitCameraControls;
  frames(): number;
  draw(): ThreeDrawnFrame;
  setEnvironment(environment: ThreeSceneEnvironment): void;
  sampleEffects(catalog: SceneEffectsCatalog, timeMs: number): SceneEffectsEvaluation;
  resize(width: number, height: number, pixelRatio?: number): void;
  capture(): Uint8Array | null;
  dispose(): void;
};

export type InternalThreePresentationCore = {
  readonly surfaceKind: ThreePresentationSurfaceKind;
  readonly label: string;
  readonly camera: OrbitCameraControls;
  /** Implementation-private scene root a facade may populate. */
  readonly content: Group;
  frames(): number;
  draw(): ThreeDrawnFrame;
  setEnvironment(environment: ThreeSceneEnvironment): void;
  sampleEffects(catalog: SceneEffectsCatalog, timeMs: number): SceneEffectsEvaluation;
  resize(width: number, height: number, pixelRatio?: number): void;
  capture(): Uint8Array | null;
  dispose(): void;
};

const DEFAULT_VIEWPORT = { width: 1280, height: 720 } as const;

function resolveViewport(options: ThreePresentationCoreOptions): ResolvedViewport {
  const declared = options.viewport;
  const canvas = options.canvas;
  const width = declared?.width ?? canvas?.width ?? DEFAULT_VIEWPORT.width;
  const height = declared?.height ?? canvas?.height ?? DEFAULT_VIEWPORT.height;
  const pixelRatio = declared?.pixelRatio ?? 1;

  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 || width > 8192 || height > 8192) {
    throw new ThreePresentationError(
      "invalid-viewport",
      "Viewport width and height must be positive integers.",
    );
  }

  const bufferWidth = Math.floor(width * pixelRatio);
    const bufferHeight = Math.floor(height * pixelRatio);

    if (!Number.isFinite(pixelRatio) || pixelRatio <= 0 || pixelRatio > 4 || bufferWidth < 1 || bufferHeight < 1 || bufferWidth > 8192 || bufferHeight > 8192 || bufferWidth * bufferHeight > 16_777_216) {
    throw new ThreePresentationError(
      "invalid-viewport",
      "Framebuffer requires ratio 0..4, dimensions 1..8192, and at most 16777216 pixels.",
    );
  }

  return { width, height, pixelRatio };
}

type MutableSurfaceOptions = { -readonly [K in keyof WebGLCanvasSurfaceOptions]: WebGLCanvasSurfaceOptions[K] };

type MutableViewport = { -readonly [K in keyof ThreeViewport]: ThreeViewport[K] };

type ResolvedViewport = { width: number; height: number; pixelRatio: number };

function resolveSurface(
  options: ThreePresentationCoreOptions,
): ThreePresentationSurface {
  if (options.surface !== undefined) return options.surface;

  if (options.canvas === undefined) return createHeadlessThreeSurface();

  const surfaceOptions: MutableSurfaceOptions = { canvas: options.canvas, alpha: options.background === null };

  if (options.antialias !== undefined) surfaceOptions.antialias = options.antialias;

  if (options.preserveDrawingBuffer !== undefined) surfaceOptions.preserveDrawingBuffer = options.preserveDrawingBuffer;

  return createWebGLCanvasSurface(surfaceOptions);
}

/** Builds the one shared Three core: scene graph, lighting, camera, and surface. */
export function createThreePresentationCore(options: ThreePresentationCoreOptions = {}): ThreePresentationCore {
  const { content: privateContent, ...facade } = createInternalThreePresentationCore(options);
  void privateContent;

  return Object.freeze(facade);
}

export function createInternalThreePresentationCore(
  options: ThreePresentationCoreOptions = {},
): InternalThreePresentationCore {
  const viewport = resolveViewport(options);
  const orbit = createOrbitCamera(options.camera ?? {});
  const scene = new Scene();
  const background = options.background === undefined ? "#101318" : options.background;
  scene.background = background === null ? null : new Color(background);

  const content = new Group();
  content.name = "sceneaxi-content";
  scene.add(content);

  const ambient = new AmbientLight(0xffffff, 1.1);
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 6, 5);
  const fill = new DirectionalLight(0x99bbff, 1.1);
  fill.position.set(-5, 2, -4);
  scene.add(ambient, key, fill);
  const grid = new GridHelper(24, 24, 0x52647c, 0x303949);
  scene.add(grid);

  const particles = new Group();
  particles.name = "sceneaxi-effects";
  scene.add(particles);
  const emitters = new Map<string, Points<BufferGeometry, PointsMaterial>>();
  let settings: ThreeSurfaceSettings = Object.freeze({ effects: Object.freeze([]), toneMapping: "aces", exposure: 1.35 });

  let environmentBackground: string | null =
    background === undefined ? "#101318" : background;

  function applyEnvironment(environment: ThreeSceneEnvironment): void {
    if (!environment || !isEnvironmentRecord(environment)) throw new ThreePresentationError("invalid-renderable", "Environment is required.");

    for (const value of [environment.ambientIntensity, environment.keyIntensity, environment.fillIntensity]) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 16)) throw new ThreePresentationError("invalid-renderable", "Light intensity must be in 0..16.");
    }

    for (const color of [environment.background, environment.ambientColor, environment.keyColor, environment.fog?.color]) {
      if (color !== undefined && color !== null && (!isColorText(color) || !/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color))) throw new ThreePresentationError("invalid-renderable", "Environment requires a hex color.");
    }

    if (environment.keyDirection !== undefined && (!Array.isArray(environment.keyDirection) || environment.keyDirection.length !== 3 || environment.keyDirection.some((value) => !Number.isFinite(value) || Math.abs(value) > 1_000_000))) throw new ThreePresentationError("invalid-renderable", "Invalid light direction.");

    if (environment.fog !== undefined && (!isFogVisibility(environment.fog.enabled) || !Number.isFinite(environment.fog.near) || !Number.isFinite(environment.fog.far) || environment.fog.near < 0 || environment.fog.far <= environment.fog.near || environment.fog.far > 1_000_000)) throw new ThreePresentationError("invalid-renderable", "Invalid fog range.");

    if (environment.effects !== undefined && (!Array.isArray(environment.effects) || environment.effects.length > 2)) throw new ThreePresentationError("invalid-renderable", "Invalid effects list.");

    if (environment.effects?.some((effect) => !SCENE_ENVIRONMENT_EFFECTS.includes(effect))) {
      throw new ThreePresentationError("invalid-renderable", "Unknown post-process effect.");
    }

    if (environment.toneMapping !== undefined && !SCENE_ENVIRONMENT_TONE_MAPS.includes(environment.toneMapping)) {
      throw new ThreePresentationError("invalid-renderable", "Unknown tone mapping.");
    }

    if (environment.exposure !== undefined && (!Number.isFinite(environment.exposure) || environment.exposure < 0 || environment.exposure > 16)) {
      throw new ThreePresentationError("invalid-renderable", "Exposure must be in 0..16.");
    }

    if (environment.background !== undefined) {
      environmentBackground = environment.background;
      scene.background = environment.background === null ? null : new Color(environment.background);
    }

    if (environment.ambientIntensity !== undefined) ambient.intensity = environment.ambientIntensity;

    if (environment.ambientColor !== undefined) ambient.color = new Color(environment.ambientColor);

    if (environment.keyIntensity !== undefined) key.intensity = environment.keyIntensity;

    if (environment.keyColor !== undefined) key.color = new Color(environment.keyColor);

    if (environment.keyDirection !== undefined) {
      key.position.set(
        environment.keyDirection[0],
        environment.keyDirection[1],
        environment.keyDirection[2],
      );
    }

    if (environment.fillIntensity !== undefined) fill.intensity = environment.fillIntensity;

    if (environment.fog !== undefined) {
      scene.fog = environment.fog.enabled
        ? new Fog(environment.fog.color, environment.fog.near, environment.fog.far)
        : null;
    }

    settings = Object.freeze({
      effects: environment.effects === undefined ? settings.effects : Object.freeze([...new Set(environment.effects)]),
      toneMapping: environment.toneMapping ?? settings.toneMapping,
      exposure: environment.exposure ?? settings.exposure,
    });
  }

  if (options.environment !== undefined) applyEnvironment(options.environment);

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
      const result = surface.draw(scene, orbit.camera, settings);
      frame += 1;

      return Object.freeze({
        frame,
        drawCalls: result.drawCalls,
        pixelsDrawn: result.pixelsDrawn,
        surface: surface.kind,
        effects: settings.effects,
        environmentBackground,
      });
    },

    setEnvironment(environment) {
      requireLive();
      applyEnvironment(environment);
    },

    sampleEffects(catalog, timeMs) {
      requireLive();
      const ids = new Set<string>();

      if (!Number.isInteger(catalog.seed) || catalog.seed < 0) {
        throw new ThreePresentationError("invalid-renderable", "Effects seed must be a non-negative integer.");
      }

      for (const emitter of catalog.emitters) {
        if (ids.has(emitter.emitterId) || !isSculptIdentifier(emitter.emitterId) || !SCENE_EFFECT_EMITTER_KINDS.includes(emitter.kind) ||
          !Number.isFinite(emitter.rate) || emitter.rate <= 0 || emitter.rate > 200 ||
          !Number.isFinite(emitter.lifetimeMs) || emitter.lifetimeMs < 16 || emitter.lifetimeMs > 8000 ||
          !Number.isFinite(emitter.speed) || !Number.isFinite(emitter.spread)) {
          throw new ThreePresentationError("invalid-renderable", "Invalid decorative emitter.");
        }

        ids.add(emitter.emitterId);
      }

      // Callers pass an unbounded frame clock (performance.now()), while the sampler only
      // accepts its 0..60000 ms window. Its pattern depends on time through floor(t) mod
      // 1000, so wrapping at 60000 is output-identical and a long-lived viewport keeps
      // drawing instead of throwing out of the render loop after one minute.
      if (!Number.isFinite(timeMs) || timeMs < 0) {
        throw new ThreePresentationError("invalid-renderable", "Effects sample time must be a finite, non-negative millisecond count.");
      }

      const sampled = sampleSceneEffects({ catalog, timeMs: timeMs % EFFECTS_SAMPLE_WINDOW_MS });

      if (!sampled.ok) throw new ThreePresentationError("invalid-renderable", sampled.message);

      for (const sample of sampled.evaluation.samples) {
        if (sample.positions.some((position) => position.some((value) => !Number.isFinite(Math.fround(value))))) {
          throw new ThreePresentationError("invalid-renderable", "Decorative emitter positions exceed the renderer range.");
        }
      }

      for (const [id, object] of emitters) {
        if (ids.has(id)) continue;
        particles.remove(object);
        disposeSubtree(object);
        emitters.delete(id);
      }

      for (const sample of sampled.evaluation.samples) {
        let object = emitters.get(sample.emitterId);

        if (object === undefined) {
          const geometry = new BufferGeometry();
          geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(sample.count * 3), 3));
          object = new Points(geometry, new PointsMaterial({ color: "#ffffff", size: 0.08 }));
          object.name = `sceneaxi-effect:${sample.emitterId}`;
          object.frustumCulled = false;
          emitters.set(sample.emitterId, object);
          particles.add(object);
        }

        if (object.geometry.getAttribute("position").count !== sample.count) {
          object.geometry.dispose();

    if (object instanceof SkinnedMesh) object.skeleton.dispose();
          object.geometry = new BufferGeometry();
          object.geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(sample.count * 3), 3));
        }

        const position = object.geometry.getAttribute("position");
        sample.positions.forEach((value, index) => position.setXYZ(index, ...value));
        position.needsUpdate = true;
        object.geometry.setDrawRange(0, sample.count);
      }

      return sampled.evaluation;
    },

    resize(width, height, pixelRatio) {
      requireLive();

      const viewport: MutableViewport = { width, height };

      if (pixelRatio !== undefined) viewport.pixelRatio = pixelRatio;
      const resolved = resolveViewport({ viewport });

      surface.resize(resolved.width, resolved.height, resolved.pixelRatio);
      orbit.setViewport(resolved.width, resolved.height);
    },

    capture() {
      requireLive();

      return surface.capture();
    },

    dispose() {
      if (disposed) return;
      disposeSubtree(content);
      disposeSubtree(particles);
      emitters.clear();
      particles.clear();
      grid.dispose();
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
    if (!(object instanceof Mesh) && !(object instanceof Points)) return;
    object.geometry.dispose();

    if (object instanceof SkinnedMesh) object.skeleton.dispose();

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    for (const material of materials) {
      if (material instanceof MeshStandardMaterial) {
        for (const texture of [material.map, material.normalMap, material.roughnessMap]) if (texture && texture.userData["sceneaxiCatalogTexture"] !== true) texture.dispose();
      }

      material.dispose();
    }
  });
}

function isEnvironmentRecord(value: ThreeSceneEnvironment): value is ThreeSceneEnvironment {
  return typeof value === "object";
}

function isColorText(value: string): value is string {
  return typeof value === "string";
}

function isFogVisibility(value: boolean): value is boolean {
  return typeof value === "boolean";
}
