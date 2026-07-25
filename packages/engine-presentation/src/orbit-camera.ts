/**
 * Orbit/zoom camera for the Three presentation core.
 *
 * The control surface is plain numbers and structural event targets: the
 * `PerspectiveCamera` it drives stays implementation-private, so a consumer can
 * wire mouse/touch input without importing Three (ADR 0002 backend-hiding).
 *
 * The Three `OrbitControls` addon is deliberately not used here: it requires DOM
 * lib types this package does not take, and it hands the camera object itself to
 * the caller, which would leak a backend type across the seam.
 */
import { PerspectiveCamera, Vector3 } from "three";
import { ThreePresentationError } from "./three-presentation-error.js";

export type Vector3Tuple = readonly [number, number, number];

export type OrbitCameraState = {
  /** World-space camera position derived from target, angles, and distance. */
  readonly position: Vector3Tuple;
  readonly target: Vector3Tuple;
  readonly azimuthRadians: number;
  readonly polarRadians: number;
  readonly distance: number;
  readonly fovDegrees: number;
  readonly aspect: number;
};

export type OrbitCameraOptions = {
  readonly target?: Vector3Tuple;
  readonly azimuthRadians?: number;
  readonly polarRadians?: number;
  readonly distance?: number;
  readonly minDistance?: number;
  readonly maxDistance?: number;
  readonly fovDegrees?: number;
  readonly nearPlane?: number;
  readonly farPlane?: number;
  /** Radians of orbit per pixel of pointer drag. */
  readonly orbitRadiansPerPixel?: number;
  /** Zoom factor applied per notch of wheel input. */
  readonly zoomPerNotch?: number;
};

/** Pointer sample in target-local pixels; a browser `PointerEvent` satisfies it. */
export type OrbitPointerSample = {
  readonly clientX: number;
  readonly clientY: number;
};

/** Wheel sample in pixels; a browser `WheelEvent` satisfies it. */
export type OrbitWheelSample = {
  readonly deltaY: number;
};

export type OrbitInputListener = (event: unknown) => void;

/** Structural event target; a browser canvas element satisfies it. */
export type OrbitInputTarget = {
  addEventListener(
    type: string,
    listener: OrbitInputListener,
    options?: { readonly passive?: boolean },
  ): void;
  removeEventListener(type: string, listener: OrbitInputListener): void;
};

/** Backend-free orbit/zoom control surface for open-path consumers. */
export interface OrbitCameraControls {
  state(): OrbitCameraState;
  /** Orbits by angle deltas; polar angle is clamped away from both poles. */
  orbit(deltaAzimuthRadians: number, deltaPolarRadians: number): OrbitCameraState;
  /** Multiplies distance by `factor`, clamped to the configured distance range. */
  zoom(factor: number): OrbitCameraState;
  /** Orbits from a pointer drag in pixels using the configured sensitivity. */
  dragOrbit(deltaXPixels: number, deltaYPixels: number): OrbitCameraState;
  /** Zooms from wheel input in pixels using the configured sensitivity. */
  wheelZoom(deltaYPixels: number): OrbitCameraState;
  setTarget(target: Vector3Tuple): OrbitCameraState;
  setDistance(distance: number): OrbitCameraState;
  reset(): OrbitCameraState;
  /** Frames a world-space sphere so it fills the current vertical field of view. */
  frameSphere(center: Vector3Tuple, radius: number): OrbitCameraState;
  /**
   * Binds pointer-drag orbit and wheel zoom to an event target and returns the
   * detach function. Never required: a consumer may drive the methods directly.
   */
  attach(target: OrbitInputTarget): () => void;
}

const POLAR_EPSILON = 1e-4;
const DEFAULTS = {
  target: [0, 0, 0] as Vector3Tuple,
  azimuthRadians: Math.PI / 4,
  polarRadians: Math.PI / 3,
  distance: 6,
  minDistance: 0.25,
  maxDistance: 500,
  fovDegrees: 50,
  nearPlane: 0.1,
  farPlane: 2_000,
  orbitRadiansPerPixel: 0.005,
  zoomPerNotch: 1.1,
} as const;

function requireFinite(value: number, field: string) {
  if (!Number.isFinite(value)) {
    throw new ThreePresentationError(
      "invalid-camera",
      `${field} must be a finite number.`,
    );
  }
}

function requirePositive(value: number, field: string) {
  requireFinite(value, field);
  if (value <= 0) {
    throw new ThreePresentationError(
      "invalid-camera",
      `${field} must be greater than zero.`,
    );
  }
}

function requireVector(value: Vector3Tuple, field: string) {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new ThreePresentationError(
      "invalid-camera",
      `${field} must be a three-number tuple.`,
    );
  }
  for (const component of value) requireFinite(component, field);
}

function isPointerSample(event: unknown): event is OrbitPointerSample {
  return (
    typeof event === "object" &&
    event !== null &&
    typeof (event as { clientX?: unknown }).clientX === "number" &&
    typeof (event as { clientY?: unknown }).clientY === "number"
  );
}

function isWheelSample(event: unknown): event is OrbitWheelSample {
  return (
    typeof event === "object" &&
    event !== null &&
    typeof (event as { deltaY?: unknown }).deltaY === "number"
  );
}

export type OrbitCamera = {
  /** Implementation-private Three camera; never exported past the package seam. */
  readonly camera: PerspectiveCamera;
  readonly controls: OrbitCameraControls;
  setViewport(width: number, height: number): void;
};

/** Creates the perspective camera plus its backend-free control surface. */
export function createOrbitCamera(options: OrbitCameraOptions = {}): OrbitCamera {
  const minDistance = options.minDistance ?? DEFAULTS.minDistance;
  const maxDistance = options.maxDistance ?? DEFAULTS.maxDistance;
  requirePositive(minDistance, "minDistance");
  requirePositive(maxDistance, "maxDistance");
  if (minDistance >= maxDistance) {
    throw new ThreePresentationError(
      "invalid-camera",
      "minDistance must be smaller than maxDistance.",
    );
  }
  const fovDegrees = options.fovDegrees ?? DEFAULTS.fovDegrees;
  const nearPlane = options.nearPlane ?? DEFAULTS.nearPlane;
  const farPlane = options.farPlane ?? DEFAULTS.farPlane;
  requirePositive(fovDegrees, "fovDegrees");
  if (fovDegrees >= 180) {
    throw new ThreePresentationError(
      "invalid-camera",
      "fovDegrees must be smaller than 180.",
    );
  }
  requirePositive(nearPlane, "nearPlane");
  requirePositive(farPlane, "farPlane");
  if (nearPlane >= farPlane) {
    throw new ThreePresentationError(
      "invalid-camera",
      "nearPlane must be smaller than farPlane.",
    );
  }
  const orbitRadiansPerPixel =
    options.orbitRadiansPerPixel ?? DEFAULTS.orbitRadiansPerPixel;
  const zoomPerNotch = options.zoomPerNotch ?? DEFAULTS.zoomPerNotch;
  requirePositive(orbitRadiansPerPixel, "orbitRadiansPerPixel");
  requirePositive(zoomPerNotch, "zoomPerNotch");
  if (zoomPerNotch <= 1) {
    throw new ThreePresentationError(
      "invalid-camera",
      "zoomPerNotch must be greater than one.",
    );
  }

  const initial = {
    target: options.target ?? DEFAULTS.target,
    azimuthRadians: options.azimuthRadians ?? DEFAULTS.azimuthRadians,
    polarRadians: options.polarRadians ?? DEFAULTS.polarRadians,
    distance: options.distance ?? DEFAULTS.distance,
  };
  requireVector(initial.target, "target");
  requireFinite(initial.azimuthRadians, "azimuthRadians");
  requireFinite(initial.polarRadians, "polarRadians");
  requirePositive(initial.distance, "distance");

  const camera = new PerspectiveCamera(fovDegrees, 1, nearPlane, farPlane);
  const target = new Vector3(...initial.target);
  let azimuth = initial.azimuthRadians;
  let polar = initial.polarRadians;
  let distance = initial.distance;

  function clampPolar(value: number) {
    return Math.min(Math.PI - POLAR_EPSILON, Math.max(POLAR_EPSILON, value));
  }

  function clampDistance(value: number) {
    return Math.min(maxDistance, Math.max(minDistance, value));
  }

  function apply(): OrbitCameraState {
    polar = clampPolar(polar);
    distance = clampDistance(distance);
    const sinPolar = Math.sin(polar);
    camera.position.set(
      target.x + distance * sinPolar * Math.sin(azimuth),
      target.y + distance * Math.cos(polar),
      target.z + distance * sinPolar * Math.cos(azimuth),
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    return Object.freeze({
      position: Object.freeze([
        camera.position.x,
        camera.position.y,
        camera.position.z,
      ] as Vector3Tuple),
      target: Object.freeze([target.x, target.y, target.z] as Vector3Tuple),
      azimuthRadians: azimuth,
      polarRadians: polar,
      distance,
      fovDegrees: camera.fov,
      aspect: camera.aspect,
    });
  }

  const controls: OrbitCameraControls = {
    state: apply,

    orbit(deltaAzimuthRadians, deltaPolarRadians) {
      requireFinite(deltaAzimuthRadians, "deltaAzimuthRadians");
      requireFinite(deltaPolarRadians, "deltaPolarRadians");
      azimuth += deltaAzimuthRadians;
      polar += deltaPolarRadians;
      return apply();
    },

    zoom(factor) {
      requirePositive(factor, "factor");
      distance *= factor;
      return apply();
    },

    dragOrbit(deltaXPixels, deltaYPixels) {
      requireFinite(deltaXPixels, "deltaXPixels");
      requireFinite(deltaYPixels, "deltaYPixels");
      return controls.orbit(
        -deltaXPixels * orbitRadiansPerPixel,
        -deltaYPixels * orbitRadiansPerPixel,
      );
    },

    wheelZoom(deltaYPixels) {
      requireFinite(deltaYPixels, "deltaYPixels");
      const notches = deltaYPixels / 100;
      return controls.zoom(Math.pow(zoomPerNotch, notches));
    },

    setTarget(next) {
      requireVector(next, "target");
      target.set(...next);
      return apply();
    },

    setDistance(next) {
      requirePositive(next, "distance");
      distance = next;
      return apply();
    },

    reset() {
      target.set(...initial.target);
      azimuth = initial.azimuthRadians;
      polar = initial.polarRadians;
      distance = initial.distance;
      return apply();
    },

    frameSphere(center, radius) {
      requireVector(center, "center");
      requirePositive(radius, "radius");
      target.set(...center);
      const halfFov = (camera.fov * Math.PI) / 360;
      distance = radius / Math.sin(halfFov);
      return apply();
    },

    attach(inputTarget) {
      if (
        inputTarget === null ||
        typeof inputTarget !== "object" ||
        typeof inputTarget.addEventListener !== "function" ||
        typeof inputTarget.removeEventListener !== "function"
      ) {
        throw new ThreePresentationError(
          "invalid-camera",
          "attach requires an event target with add/removeEventListener.",
        );
      }
      let dragging: { x: number; y: number } | null = null;

      const onPointerDown: OrbitInputListener = (event) => {
        if (!isPointerSample(event)) return;
        dragging = { x: event.clientX, y: event.clientY };
      };
      const onPointerMove: OrbitInputListener = (event) => {
        if (dragging === null || !isPointerSample(event)) return;
        const deltaX = event.clientX - dragging.x;
        const deltaY = event.clientY - dragging.y;
        dragging = { x: event.clientX, y: event.clientY };
        controls.dragOrbit(deltaX, deltaY);
      };
      const onPointerUp: OrbitInputListener = () => {
        dragging = null;
      };
      const onWheel: OrbitInputListener = (event) => {
        if (!isWheelSample(event)) return;
        controls.wheelZoom(event.deltaY);
      };

      inputTarget.addEventListener("pointerdown", onPointerDown);
      inputTarget.addEventListener("pointermove", onPointerMove);
      inputTarget.addEventListener("pointerup", onPointerUp);
      inputTarget.addEventListener("pointercancel", onPointerUp);
      inputTarget.addEventListener("pointerleave", onPointerUp);
      inputTarget.addEventListener("wheel", onWheel, { passive: true });

      return () => {
        inputTarget.removeEventListener("pointerdown", onPointerDown);
        inputTarget.removeEventListener("pointermove", onPointerMove);
        inputTarget.removeEventListener("pointerup", onPointerUp);
        inputTarget.removeEventListener("pointercancel", onPointerUp);
        inputTarget.removeEventListener("pointerleave", onPointerUp);
        inputTarget.removeEventListener("wheel", onWheel);
        dragging = null;
      };
    },
  };

  apply();

  return {
    camera,
    controls,
    setViewport(width, height) {
      if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
      ) {
        throw new ThreePresentationError(
          "invalid-viewport",
          "Viewport width and height must be positive numbers.",
        );
      }
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      apply();
    },
  };
}
