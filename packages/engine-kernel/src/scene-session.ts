/** Deterministic multi-object open path for a ComposedScene. */
import { KernelSessionError } from "./errors.js";
import {
  digestUint32,
  prefixedDigest,
  resolveKernelDigest,
  type KernelDigest,
  type KernelDigestHost,
} from "./portable-digest.js";
import {
  SCENE_COMPOSITION_SCHEMA_VERSION,
  SCENE_COMPOSITION_SCHEMA_VERSION_V2,
  validateComposedSceneV2,
  multiplySceneMatricesV2,
  sceneMatrixFromSculptTransformV2,
  SCENE_MAXIMUM_COMPONENT_MAGNITUDE,
  type ComposedSceneV2,
  type ComposedSceneInstanceV2,
  type SceneMatrixV2,
  type SceneBoundsV2,
  type Vector3,
  projectSceneInstanceHierarchy,
  validateComposedScene,
  snapshotPlainRecord,
  snapshotPlainArray,
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

function deriveSceneInstanceSeedWithDigest(
  seed: number,
  instanceId: string,
  digest: KernelDigest,
) {
  return digestUint32(
    `sceneaxi.scene-instance:${String(seed)}:${instanceId}`,
    digest,
  );
}

type SceneInstanceRuntime = {
  readonly instanceId: string;
  readonly artifactId: string;
  readonly worldTransform: SculptTransform;
  readonly simulation: SculptNodeSimulation;
};

function digestSnapshot(
  value: Omit<SceneKernelSnapshot, "digest">,
  digest: KernelDigest,
) {
  return prefixedDigest(JSON.stringify(value), digest);
}

class SceneSessionImpl implements SceneKernelSession {
  private readonly scene: ComposedScene;
  private readonly options: Required<SceneKernelOptions>;
  private readonly digest: KernelDigest;
  private readonly instances: readonly SceneInstanceRuntime[];
  private readonly advances: FrameClock[] = [];
  private tick = 0;
  private elapsedMs = 0;

  constructor(
    scene: ComposedScene,
    options: Required<SceneKernelOptions>,
    digest: KernelDigest,
  ) {
    this.scene = scene;
    this.options = options;
    this.digest = digest;

    if (scene.instances.length > 4096) throw new KernelSessionError("scene instance capacity exceeded");
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
            seed: deriveSceneInstanceSeedWithDigest(
              options.seed,
              instance.instanceId,
              digest,
            ),
          },
          digest,
        ),
      };
    });
  }

  advance(clock: FrameClock) {
    const nextClock = validateSculptClock(clock, this.tick);

    if (this.advances.length >= 100_000 || !Number.isSafeInteger(this.elapsedMs + nextClock.deltaMs)) throw new KernelSessionError("scene history or elapsed time capacity exceeded");
    const commits = this.instances.map((instance) => instance.simulation.prepareClock(nextClock));

    for (const commit of commits) commit();
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

    return Object.freeze({
      ...payload,
      digest: digestSnapshot(payload, this.digest),
    });
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
  host?: KernelDigestHost,
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
    resolveKernelDigest(host?.digest),
  );
}

/** Re-run every recorded advance and refuse if the terminal scene digest drifts. */
export function replaySceneKernelSession(
  value: unknown,
  host?: KernelDigestHost,
): SceneKernelSession {
  const save = snapshotPlainRecord(value);
  if (!save) throw new KernelSessionError("invalid scene save artifact");
  if (save["schemaVersion"] !== SCENE_COMPOSITION_SCHEMA_VERSION) {
    throw new KernelSessionError("scene save schema major mismatch");
  }
  if (save["kind"] !== SCENE_KERNEL_SAVE_KIND) throw new KernelSessionError("invalid scene save artifact kind");
  let length: unknown;
  try { const value = save["advances"]; length = value !== null && typeof value === "object" ? Object.getOwnPropertyDescriptor(value, "length")?.value : undefined; }
  catch { throw new KernelSessionError("invalid scene save advances or terminal digest"); }
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0 || length > 100_000 ||
    typeof save["terminalDigest"] !== "string" || !DIGEST_RE.test(save["terminalDigest"])) {
    throw new KernelSessionError("invalid scene save advances or terminal digest");
  }
  const advances = snapshotPlainArray(save["advances"]);
  const options = snapshotPlainRecord(save["options"]);
  if (!advances || !options || typeof options["seed"] !== "number" ||
    (options["gravity"] !== undefined && typeof options["gravity"] !== "number") ||
    (options["restitution"] !== undefined && typeof options["restitution"] !== "number")) {
    throw new KernelSessionError("invalid scene save options or advances");
  }
  const clocks: FrameClock[] = advances.map((value) => {
    const clock = snapshotPlainRecord(value);
    if (!clock || typeof clock["tick"] !== "number" || typeof clock["deltaMs"] !== "number") {
      throw new KernelSessionError("invalid scene save advance clock");
    }
    return { tick: clock["tick"], deltaMs: clock["deltaMs"] };
  });
  const session = openSceneKernelSession(save["scene"], {
    seed: options["seed"],
    ...(options["gravity"] === undefined ? {} : { gravity: options["gravity"] }),
    ...(options["restitution"] === undefined ? {} : { restitution: options["restitution"] }),
  }, host);
  for (const clock of clocks) session.advance(clock);
  const terminal = session.observe().digest;
  if (terminal !== save["terminalDigest"]) throw new KernelSessionError(`scene replay digest mismatch: expected ${save["terminalDigest"]}, got ${terminal}`);
  return session;
}

/** Additive schema-2 path: all simulation transforms remain artifact-local. */
export type SceneInstanceSnapshotV2 = {
  readonly instanceId: string;
  readonly artifactId: string;
  readonly worldMatrix: SceneMatrixV2;
  readonly bounds: SceneBoundsV2;
  readonly snapshot: Omit<SculptKernelSnapshot, "nodes"> & {
    readonly nodes: readonly (SculptKernelSnapshot["nodes"][number] & { readonly worldMatrix: SceneMatrixV2 })[];
  };
};
export type SceneKernelSnapshotV2 = Omit<SceneKernelSnapshot, "instances"> & {
  readonly schemaVersion: 2;
  readonly instances: readonly SceneInstanceSnapshotV2[];
};
export type SceneKernelSaveArtifactV2 = Omit<SceneKernelSaveArtifact, "schemaVersion" | "scene"> & {
  readonly schemaVersion: 2;
  readonly scene: ComposedSceneV2;
};
export interface SceneKernelSessionV2 {
  advance(clock: FrameClock): void;
  observe(): SceneKernelSnapshotV2;
  save(): SceneKernelSaveArtifactV2;
}

/** Runtime matrices/bounds use local simulated nodes, never rewritten evidence. */
function projectRuntimeV2(instance: ComposedSceneInstanceV2, snapshot: SculptKernelSnapshot): SceneInstanceSnapshotV2 {
  const byId = new Map(snapshot.nodes.map(node => [node.id, node]));
  const matrices = new Map<string, SceneMatrixV2>();
  const visiting = new Set<string>();
  function resolve(id: string): SceneMatrixV2 {
    const cached = matrices.get(id);
    if (cached) return cached;
    const node = byId.get(id);
    if (!node || visiting.has(id)) throw new KernelSessionError("scene-v2 cyclic or disconnected runtime hierarchy");
    if (visiting.size >= 256) throw new KernelSessionError("scene-v2 runtime hierarchy depth capacity exceeded");
    visiting.add(id);
    const parent = node.parentId === null ? instance.worldMatrix : resolve(node.parentId);
    const matrix = multiplySceneMatricesV2(parent, sceneMatrixFromSculptTransformV2(node.transform));
    visiting.delete(id);
    matrices.set(id, matrix);
    return matrix;
  }
  const components = new Map(instance.artifact.spec.components.map(component => [component.id, component]));
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const nodes = snapshot.nodes.map(node => {
    const worldMatrix = resolve(node.id);
    const component = components.get(node.componentId);
    if (!component) throw new KernelSessionError("scene-v2 missing runtime component");
    const radius = Math.max(...component.dimensions) / 2;
    const cylinderRadius = Math.max(component.dimensions[0], component.dimensions[2]) / 2;
    const half: Vector3 = component.primitive === "sphere" ? [radius, radius, radius]
      : component.primitive === "cylinder" ? [cylinderRadius, component.dimensions[1] / 2, cylinderRadius]
      : [component.dimensions[0] / 2, component.dimensions[1] / 2, component.dimensions[2] / 2];
    for (const x of [-half[0], half[0]]) for (const y of [-half[1], half[1]]) for (const z of [-half[2], half[2]]) {
      for (const axis of [0, 1, 2] as const) {
        const v = worldMatrix[axis] * x + entryV2(worldMatrix, 4 + axis) * y + entryV2(worldMatrix, 8 + axis) * z + entryV2(worldMatrix, 12 + axis);
        if (!Number.isFinite(v) || Math.abs(v) > SCENE_MAXIMUM_COMPONENT_MAGNITUDE) throw new KernelSessionError("scene-v2 world bounds capacity exceeded");
        min[axis] = Math.min(min[axis], v); max[axis] = Math.max(max[axis], v);
      }
    }
    return Object.freeze({ ...node, worldMatrix });
  });
  return Object.freeze({ instanceId: instance.instanceId, artifactId: instance.artifactId, worldMatrix: instance.worldMatrix,
    bounds: Object.freeze({ min: Object.freeze(min), max: Object.freeze(max) }),
    snapshot: Object.freeze({ ...snapshot, nodes: Object.freeze(nodes) }) });
}
function entryV2(matrix: SceneMatrixV2, index: number): number {
  const value = matrix[index];
  if (value === undefined) throw new KernelSessionError("scene-v2 missing matrix entry");
  return value;
}

/** Preflight mirrors the existing local toy driver's translations ONLY; the
 * existing SculptNodeSimulation remains the sole authoritative driver. Its
 * prepareClock validates velocities, sockets and local numeric ranges first.
 * Projecting this candidate before any commit prevents late world-bound refusal.
 */
function previewLocalV2(instance: ComposedSceneInstanceV2, snapshot: SculptKernelSnapshot, deltaMs: number, gravity: number): SculptKernelSnapshot {
  const seconds = deltaMs / 1000;
  const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
  const components = new Map(instance.artifact.spec.components.map(component => [component.id, component]));
  return { ...snapshot, nodes: snapshot.nodes.map(node => {
    if (node.parentId !== null) return node;
    const component = components.get(node.componentId);
    if (!component) throw new KernelSessionError("scene-v2 missing runtime component");
    const velocity: Vector3 = [node.velocity[0], round(node.velocity[1] + gravity * seconds), node.velocity[2]];
    const translation: [number, number, number] = [0, 0, 0];
    for (const axis of [0, 1, 2] as const) translation[axis] = round(node.transform.translation[axis] + velocity[axis] * seconds);
    if (translation[1] < component.dimensions[1] * node.transform.scale[1] / 2) translation[1] = round(component.dimensions[1] * node.transform.scale[1] / 2);
    return { ...node, transform: { ...node.transform, translation } };
  }) };
}

class SceneSessionImplV2 implements SceneKernelSessionV2 {
  private readonly advances: FrameClock[] = [];
  private readonly instances: readonly { readonly source: ComposedSceneInstanceV2; readonly simulation: SculptNodeSimulation }[];
  private tick = 0;
  private elapsedMs = 0;
  constructor(private readonly scene: ComposedSceneV2, private readonly options: Required<SceneKernelOptions>, private readonly digest: KernelDigest) {
    this.instances = scene.instances.map(source => ({ source, simulation: new SculptNodeSimulation({
      nodes: source.artifact.runtimeHierarchy.nodes, components: source.artifact.spec.components, sockets: source.artifact.spec.sockets,
    }, { ...options, seed: deriveSceneInstanceSeedWithDigest(options.seed, source.instanceId, digest) }, digest) }));
    this.observe(); // Validate the entire initial runtime before admission.
  }
  advance(clock: FrameClock) {
    const capturedClock = snapshotPlainRecord(clock);
    if (!capturedClock || Object.keys(capturedClock).some(key => !["tick", "deltaMs"].includes(key)) || typeof capturedClock["tick"] !== "number" || typeof capturedClock["deltaMs"] !== "number") throw new KernelSessionError("scene-v2 invalid clock descriptors");
    const next = validateSculptClock({ tick: capturedClock["tick"], deltaMs: capturedClock["deltaMs"] }, this.tick);
    if (this.advances.length >= 100_000 || !Number.isSafeInteger(this.elapsedMs + next.deltaMs)) throw new KernelSessionError("scene-v2 history or elapsed time capacity exceeded");
    try {
      const commits = this.instances.map(({ source, simulation }) => {
        const commit = simulation.prepareClock(next);
        projectRuntimeV2(source, previewLocalV2(source, simulation.observe(), next.deltaMs, this.options.gravity));
        return commit;
      });
      for (const commit of commits) commit();
    } catch (error) {
      throw new KernelSessionError(`scene-v2 advance refused: ${error instanceof Error ? error.message : "invalid runtime projection"}`);
    }
    this.tick = next.tick; this.elapsedMs += next.deltaMs; this.advances.push(next);
  }
  observe(): SceneKernelSnapshotV2 {
    const instances = Object.freeze(this.instances.map(({ source, simulation }) => projectRuntimeV2(source, simulation.observe())));
    const payload = Object.freeze({ schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION_V2, sceneId: this.scene.sceneId,
      tick: this.tick, seed: this.options.seed, elapsedMs: this.elapsedMs,
      collisionCount: instances.reduce((sum, instance) => sum + instance.snapshot.collisionCount, 0), instances });
    return Object.freeze({ ...payload, digest: prefixedDigest(JSON.stringify(payload), this.digest) });
  }
  save(): SceneKernelSaveArtifactV2 {
    return Object.freeze({ schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION_V2, kind: SCENE_KERNEL_SAVE_KIND,
      scene: this.scene, options: this.options, advances: Object.freeze(this.advances.map(clock => Object.freeze({ ...clock }))), terminalDigest: this.observe().digest });
  }
}
export function openSceneKernelSessionV2(sceneValue: unknown, options: SceneKernelOptions, host?: KernelDigestHost): SceneKernelSessionV2 {
  const scene = validateComposedSceneV2(sceneValue);
  if (!scene.ok) throw new KernelSessionError(`scene-v2 admission refused: ${scene.diagnostics[0]?.code ?? "invalid-scene"}: ${scene.diagnostics[0]?.message ?? "invalid scene"}`);
  const capturedOptions = snapshotPlainRecord(options);
  if (!capturedOptions || Object.keys(capturedOptions).some(key => !["seed", "gravity", "restitution"].includes(key)) || typeof capturedOptions["seed"] !== "number" ||
      (capturedOptions["gravity"] !== undefined && typeof capturedOptions["gravity"] !== "number") ||
      (capturedOptions["restitution"] !== undefined && typeof capturedOptions["restitution"] !== "number")) throw new KernelSessionError("scene-v2 invalid option descriptors");
  const admittedOptions: SceneKernelOptions = { seed: capturedOptions["seed"],
    ...(capturedOptions["gravity"] === undefined ? {} : { gravity: capturedOptions["gravity"] }),
    ...(capturedOptions["restitution"] === undefined ? {} : { restitution: capturedOptions["restitution"] }) };
  try { return new SceneSessionImplV2(scene.value, normalizeSculptKernelOptions(admittedOptions), resolveKernelDigest(host?.digest)); }
  catch (error) { throw new KernelSessionError(`scene-v2 admission refused: ${error instanceof Error ? error.message : "invalid scene"}`); }
}
export function replaySceneKernelSessionV2(value: unknown, host?: KernelDigestHost): SceneKernelSessionV2 {
  const save = snapshotPlainRecord(value);
  if (!save || save["schemaVersion"] !== 2) throw new KernelSessionError("scene-v2 save schema major mismatch");
  if (Object.keys(save).some(key => !["schemaVersion", "kind", "scene", "options", "advances", "terminalDigest"].includes(key))) throw new KernelSessionError("scene-v2 unexpected save field");
  if (save["kind"] !== SCENE_KERNEL_SAVE_KIND || typeof save["terminalDigest"] !== "string" || !DIGEST_RE.test(save["terminalDigest"])) throw new KernelSessionError("scene-v2 invalid save kind or terminal digest");
  let length: unknown;
  try { const clocks = save["advances"]; length = clocks !== null && typeof clocks === "object" ? Object.getOwnPropertyDescriptor(clocks, "length")?.value : undefined; }
  catch { throw new KernelSessionError("scene-v2 invalid save history"); }
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0 || length > 100_000) throw new KernelSessionError("scene-v2 invalid save history");
  const advances = snapshotPlainArray(save["advances"]);
  const options = snapshotPlainRecord(save["options"]);
  if (!advances || !options || Object.keys(options).some(key => !["seed", "gravity", "restitution"].includes(key)) || typeof options["seed"] !== "number" || typeof options["gravity"] !== "number" || typeof options["restitution"] !== "number") throw new KernelSessionError("scene-v2 invalid save options or clocks");
  const session = openSceneKernelSessionV2(save["scene"], { seed: options["seed"], gravity: options["gravity"], restitution: options["restitution"] }, host);
  for (const value of advances) {
    const clock = snapshotPlainRecord(value);
    if (!clock || Object.keys(clock).some(key => !["tick", "deltaMs"].includes(key)) || typeof clock["tick"] !== "number" || typeof clock["deltaMs"] !== "number") throw new KernelSessionError("scene-v2 invalid save clock");
    session.advance({ tick: clock["tick"], deltaMs: clock["deltaMs"] });
  }
  if (session.observe().digest !== save["terminalDigest"]) throw new KernelSessionError("scene-v2 replay digest mismatch");
  return session;
}
