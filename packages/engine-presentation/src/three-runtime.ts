/**
 * ADR 0002 Presentation Runtime on the Three presentation core.
 *
 * `mount` builds the renderer, camera, and scene; `present` interpolates the
 * read-only kernel snapshot and draws a frame; `capture` returns PNG bytes of
 * that frame; `dispose` releases the surface. Snapshots are never mutated and no
 * kernel session is reachable from here, so presentation cannot advance
 * authoritative state.
 */
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
} from "three";
import type { KernelSessionEvent, KernelSnapshot } from "@sceneaxi/engine-kernel";
import type { OrbitCameraControls } from "./orbit-camera.js";
import type {
  PresentationCaptureResult,
  PresentationRuntime,
} from "./runtime.js";
import {
  createInternalThreePresentationCore,
  disposeSubtree,
  type InternalThreePresentationCore,
  type ThreePresentationCoreOptions,
} from "./three-core.js";
import { ThreePresentationError } from "./three-presentation-error.js";
import type { ThreePresentationSurfaceKind } from "./three-surface.js";

export type ThreePresentedFrame = {
  readonly frame: number;
  readonly tick: number;
  readonly alpha: number;
  readonly entityCount: number;
  readonly drawCalls: number;
  readonly pixelsDrawn: boolean;
  readonly surface: ThreePresentationSurfaceKind;
};

export type ThreePresentationRuntimeOptions = ThreePresentationCoreOptions & {
  /** World size of the marker drawn per snapshot entity. */
  readonly entitySize?: number;
  /** Base color of entity markers. */
  readonly entityColor?: string;
};

/** Presentation Runtime plus the browser controls the ADR 0002 seam does not carry. */
export interface ThreePresentationRuntime extends PresentationRuntime {
  readonly label: string;
  /** Draw surface of the mounted runtime, or null while detached. */
  surface(): ThreePresentationSurfaceKind | null;
  /** Orbit/zoom control surface; refuses while detached. */
  camera(): OrbitCameraControls;
  /** Frame record of the last `present`, or null before the first frame. */
  lastFrame(): ThreePresentedFrame | null;
  resize(width: number, height: number, pixelRatio?: number): void;
}

const ENTITY_PREFIX = "entity:";

function lerp(from: number, to: number, alpha: number) {
  return from + (to - from) * alpha;
}

function requireAlpha(alpha: number) {
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
    throw new ThreePresentationError(
      "invalid-renderable",
      "present alpha must be a finite number between 0 and 1.",
    );
  }
}

function requireSnapshot(snapshot: KernelSnapshot) {
  if (
    snapshot === null ||
    !isSnapshotRecord(snapshot) ||
    !Array.isArray(snapshot.entities) ||
    !Number.isSafeInteger(snapshot.tick) || snapshot.tick < 0 || snapshot.entities.length > 4096 ||
      !Number.isSafeInteger(snapshot.seed) || !isSnapshotText(snapshot.digest) || snapshot.digest.length === 0 || snapshot.digest.length > 128
  ) {
    throw new ThreePresentationError(
      "invalid-renderable",
      "present requires a kernel snapshot with entities and an integer tick.",
    );
  }

  const ids = new Set<string>();

  for (const entity of snapshot.entities) {
    if (!entity || !isSnapshotText(entity.id) || !/^[a-z0-9][a-z0-9-]{0,127}$/.test(entity.id) || ids.has(entity.id) ||
        !Number.isFinite(entity.x) || !Number.isFinite(entity.y) || Math.abs(entity.x) > 1_000_000 || Math.abs(entity.y) > 1_000_000) {
      throw new ThreePresentationError("invalid-renderable", "Snapshot requires unique bounded ids and finite bounded coordinates.");
    }

    ids.add(entity.id);
  }
}

/**
 * Creates the Three Presentation Runtime.
 *
 * Pass `canvas` for the real browser path; pass nothing for the headless gate
 * surface. Entity markers are the deliberately minimal kernel visualisation: the
 * kernel snapshot carries `id`/`x`/`y` only, and presentation invents no state
 * the kernel does not own.
 */
export function createThreePresentationRuntime(
  options: ThreePresentationRuntimeOptions = {},
): ThreePresentationRuntime {
  const entitySize = options.entitySize ?? 1;
  const entityColor = options.entityColor ?? "#7fd1ff";

  if (!Number.isFinite(entitySize) || entitySize <= 0 || entitySize > 1_000_000) {
    throw new ThreePresentationError(
      "invalid-renderable",
      "entitySize must be a finite positive number.",
    );
  }

  let core: InternalThreePresentationCore | null = null;
  let entities: Group | null = null;
  const markers = new Map<string, Object3D>();
  let previous = new Map<string, { x: number; y: number }>();
  let current = new Map<string, { x: number; y: number }>();
  let currentTick: number | null = null;
  let lastFrame: ThreePresentedFrame | null = null;

  function requireMounted() {
    if (core === null || entities === null) {
      throw new ThreePresentationError(
        "not-mounted",
        "Three presentation runtime is not mounted.",
      );
    }

    return { core, entities };
  }

  function markerFor(parent: Group, id: string): Object3D {
    const name = `${ENTITY_PREFIX}${id}`;
    const existing = markers.get(id);

    if (existing !== undefined) return existing;

    const marker = new Mesh(
      new BoxGeometry(entitySize, entitySize, entitySize),
      new MeshStandardMaterial({ color: entityColor, roughness: 0.5, metalness: 0.1 }),
    );

    marker.name = name;
    parent.add(marker);
    markers.set(id, marker);

    return marker;
  }

  return {
    get label() {
      return core?.label ?? "Three presentation core — detached";
    },

    mount() {
      if (core !== null) {
        throw new ThreePresentationError(
          "already-mounted",
          "Three presentation runtime is already mounted.",
        );
      }

      core = createInternalThreePresentationCore(options);
      entities = new Group();
      entities.name = "kernel-entities";
      core.content.add(entities);
      previous = new Map();
      current = new Map();
      currentTick = null;
      lastFrame = null;
    },

    present(snapshot: KernelSnapshot, events: ReadonlyArray<KernelSessionEvent>, alpha: number) {
      const live = requireMounted();
      requireSnapshot(snapshot);
      requireAlpha(alpha);
      void events;

      const incoming = new Map(
        snapshot.entities.map((entity) => [entity.id, { x: entity.x, y: entity.y }]),
      );

      if (currentTick === null) {
        previous = incoming;
      } else if (snapshot.tick !== currentTick) {
        previous = current;
      }

      current = incoming;
      currentTick = snapshot.tick;

      const seen = new Set<string>();

      for (const entity of snapshot.entities) {
        seen.add(entity.id);
        const marker = markerFor(live.entities, entity.id);
        const target = current.get(entity.id) ?? { x: entity.x, y: entity.y };
        const from = previous.get(entity.id) ?? target;
        marker.position.set(
          lerp(from.x, target.x, alpha),
          entitySize / 2,
          lerp(from.y, target.y, alpha),
        );
      }

      // Snapshot the child list because remove mutates it during traversal.
      const previousChildren = [...live.entities.children];

      for (const child of previousChildren) {
        const id = child.name.startsWith(ENTITY_PREFIX)
          ? child.name.slice(ENTITY_PREFIX.length)
          : null;

        if (id === null || seen.has(id)) continue;
        live.entities.remove(child);

          if (id !== null) markers.delete(id);
        disposeSubtree(child);
      }

      const drawn = live.core.draw();
      lastFrame = Object.freeze({
        frame: drawn.frame,
        tick: snapshot.tick,
        alpha,
        entityCount: snapshot.entities.length,
        drawCalls: drawn.drawCalls,
        pixelsDrawn: drawn.pixelsDrawn,
        surface: drawn.surface,
      });
    },

    capture(): PresentationCaptureResult | null {
      const live = requireMounted();
      const bytes = live.core.capture();

      if (bytes === null) return null;

      return Object.freeze({ contentType: "image/png", bytes });
    },

    dispose() {
      const live = requireMounted();
      live.core.dispose();
      core = null;
      entities = null;
      markers.clear();
      previous = new Map();
      current = new Map();
      currentTick = null;
    },

    surface() {
      return core?.surfaceKind ?? null;
    },

    camera() {
      return requireMounted().core.camera;
    },

    lastFrame() {
      return lastFrame;
    },

    resize(width, height, pixelRatio) {
      requireMounted().core.resize(width, height, pixelRatio);
    },
  };
}

function isSnapshotRecord(value: KernelSnapshot): value is KernelSnapshot {
  return typeof value === "object";
}

function isSnapshotText(value: string): value is string {
  return typeof value === "string";
}
