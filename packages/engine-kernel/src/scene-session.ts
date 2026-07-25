/** Deterministic multi-object open path for a ComposedScene. */
import { KernelSessionError } from "./errors.js";
import {
  digestUint32,
  prefixedDigest,
} from "./portable-digest.js";
import {
  SCENE_COMPOSITION_SCHEMA_VERSION,
  projectSceneInstanceHierarchy,
  validateComposedScene,
  type ComposedScene,
  type FrameClock,
  type SculptTransform,
} from "@sceneaxi/schemas";
import {
  SculptNodeSimulation,
  normalizeSculptKernelOptions,
  validateSculptClock,
  type SculptKernelOptions,
  type SculptKernelSnapshot,
} from "./sculpt-session.js";

export const SCENE_KERNEL_SAVE_KIND = "sceneaxi.scene-kernel-save" as const;

export type SceneKernelOptions = SculptKernelOptions;

export type SceneInstanceSnapshot = {
  readonly instanceId: string;
  readonly artifactId: string;
  readonly worldTransform: SculptTransform;
  readonly snapshot: SculptKernelSnapshot;
};

export type SceneKernelSnapshot = {
  readonly sceneId: string;
  readonly tick: number;
  readonly seed: number;
  readonly elapsedMs: number;
  readonly collisionCount: number;
  readonly instances: readonly SceneInstanceSnapshot[];
  readonly digest: string;
};

export type SceneKernelSaveArtifact = {
  readonly schemaVersion: typeof SCENE_COMPOSITION_SCHEMA_VERSION;
  readonly kind: typeof SCENE_KERNEL_SAVE_KIND;
  readonly scene: ComposedScene;
  readonly options: Required<SceneKernelOptions>;
  readonly advances: readonly FrameClock[];
  readonly terminalDigest: string;
};

export interface SceneKernelSession {
  advance(clock: FrameClock): void;
  observe(): SceneKernelSnapshot;
  save(): SceneKernelSaveArtifact;
}

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

/**
 * Two instances of the same artifact are different objects, so each gets its
 * own deterministic seed derived from the scene seed and its instance id.
 */
export function deriveSceneInstanceSeed(
  seed: number,
  instanceId: string,
) {
  return digestUint32(`sceneaxi.scene-instance:${String(seed)}:${instanceId}`);
}

type SceneInstanceRuntime = {
  readonly instanceId: string;
  readonly artifactId: string;
  readonly worldTransform: SculptTransform;
  readonly simulation: SculptNodeSimulation;
};

function digestSnapshot(
  value: Omit<SceneKernelSnapshot, "digest">,
) {
  return prefixedDigest(JSON.stringify(value));
}

class SceneSessionImpl implements SceneKernelSession {
  private readonly scene: ComposedScene;
  private readonly options: Required<SceneKernelOptions>;
  private readonly instances: readonly SceneInstanceRuntime[];
  private readonly advances: FrameClock[] = [];
  private tick = 0;
  private elapsedMs = 0;

  constructor(
    scene: ComposedScene,
    options: Required<SceneKernelOptions>,
  ) {
    this.scene = scene;
    this.options = options;
    this.instances = scene.instances.map((instance) => {
      const placed = projectSceneInstanceHierarchy(instance);
      return {
        instanceId: instance.instanceId,
        artifactId: instance.artifactId,
        worldTransform: instance.worldTransform,
        simulation: new SculptNodeSimulation(
          {
            nodes: placed.nodes,
            components: instance.artifact.spec.components,
            sockets: instance.artifact.spec.sockets,
          },
          {
            ...options,
            seed: deriveSceneInstanceSeed(options.seed, instance.instanceId),
          },
        ),
      };
    });
  }

  advance(clock: FrameClock) {
    const nextClock = validateSculptClock(clock, this.tick);
    for (const instance of this.instances) instance.simulation.applyClock(nextClock);
    this.tick = nextClock.tick;
    this.elapsedMs += nextClock.deltaMs;
    this.advances.push(nextClock);
  }

  observe(): SceneKernelSnapshot {
    const instances = Object.freeze(
      this.instances.map((instance) =>
        Object.freeze({
          instanceId: instance.instanceId,
          artifactId: instance.artifactId,
          worldTransform: instance.worldTransform,
          snapshot: instance.simulation.observe(),
        }),
      ),
    );
    const payload = Object.freeze({
      sceneId: this.scene.sceneId,
      tick: this.tick,
      seed: this.options.seed,
      elapsedMs: this.elapsedMs,
      collisionCount: instances.reduce(
        (total, instance) => total + instance.snapshot.collisionCount,
        0,
      ),
      instances,
    });
    return Object.freeze({ ...payload, digest: digestSnapshot(payload) });
  }

  save(): SceneKernelSaveArtifact {
    return Object.freeze({
      schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
      kind: SCENE_KERNEL_SAVE_KIND,
      scene: this.scene,
      options: this.options,
      advances: Object.freeze(this.advances.map((clock) => Object.freeze({ ...clock }))),
      terminalDigest: this.observe().digest,
    });
  }
}

/**
 * Open a validated ComposedScene as one multi-object kernel session.
 *
 * Each instance runs the existing single-object simulation over its scene-space
 * projection; artifacts themselves are never rewritten.
 */
export function openSceneKernelSession(
  sceneValue: unknown,
  options: SceneKernelOptions,
): SceneKernelSession {
  const scene = validateComposedScene(sceneValue);
  if (!scene.ok) {
    throw new KernelSessionError(
      scene.diagnostics[0]?.message ?? "invalid ComposedScene",
    );
  }
  return new SceneSessionImpl(
    scene.value,
    normalizeSculptKernelOptions(options),
  );
}

/** Re-run every recorded advance and refuse if the terminal scene digest drifts. */
export function replaySceneKernelSession(
  save: SceneKernelSaveArtifact,
): SceneKernelSession {
  if (save === null || typeof save !== "object") {
    throw new KernelSessionError("invalid scene save artifact");
  }
  if (save.schemaVersion !== SCENE_COMPOSITION_SCHEMA_VERSION) {
    throw new KernelSessionError(
      `scene save schema major mismatch: ${String(save.schemaVersion)}`,
    );
  }
  if (save.kind !== SCENE_KERNEL_SAVE_KIND) {
    throw new KernelSessionError("invalid scene save artifact kind");
  }
  if (
    !Array.isArray(save.advances) ||
    typeof save.terminalDigest !== "string" ||
    !DIGEST_RE.test(save.terminalDigest)
  ) {
    throw new KernelSessionError("invalid scene save advances or terminal digest");
  }
  const session = openSceneKernelSession(save.scene, save.options);
  for (const clock of save.advances) session.advance(clock);
  const terminal = session.observe().digest;
  if (terminal !== save.terminalDigest) {
    throw new KernelSessionError(
      `scene replay digest mismatch: expected ${save.terminalDigest}, got ${terminal}`,
    );
  }
  return session;
}
