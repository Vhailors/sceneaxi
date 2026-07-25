/** Deterministic kernel-owned sculpt hierarchy, socket animation, and toy physics. */
import { createHash } from "node:crypto";
import {
  SCULPT_SCHEMA_VERSION,
  validateSculptArtifact,
  type FrameClock,
  type SculptArtifact,
  type SculptComponent,
  type SculptHierarchyNode,
  type SculptSocket,
  type SculptTransform,
  type Vector3,
} from "@sceneaxi/schemas";
import { KernelSessionError } from "./session.js";

export const SCULPT_KERNEL_SAVE_KIND = "sceneaxi.sculpt-kernel-save" as const;

export type SculptKernelOptions = {
  readonly seed: number;
  readonly gravity?: number;
  readonly restitution?: number;
};

export type SculptKernelNodeSnapshot = {
  readonly id: string;
  readonly parentId: string | null;
  readonly componentId: string;
  readonly transform: SculptTransform;
  readonly velocity: Vector3;
};

export type SculptAnimationSocketSnapshot = {
  readonly id: string;
  readonly nodeId: string;
  readonly value: number;
};

export type SculptKernelSnapshot = {
  readonly tick: number;
  readonly seed: number;
  readonly elapsedMs: number;
  readonly collisionCount: number;
  readonly nodes: readonly SculptKernelNodeSnapshot[];
  readonly sockets: readonly SculptAnimationSocketSnapshot[];
  readonly digest: string;
};

export type SculptKernelSaveArtifact = {
  readonly schemaVersion: typeof SCULPT_SCHEMA_VERSION;
  readonly kind: typeof SCULPT_KERNEL_SAVE_KIND;
  readonly artifact: SculptArtifact;
  readonly options: Required<SculptKernelOptions>;
  readonly advances: readonly FrameClock[];
  readonly terminalDigest: string;
};

export interface SculptKernelSession {
  advance(clock: FrameClock): void;
  observe(): SculptKernelSnapshot;
  save(): SculptKernelSaveArtifact;
}

type MutableNode = {
  id: string;
  parentId: string | null;
  componentId: string;
  transform: {
    translation: [number, number, number];
    rotationEulerDegrees: [number, number, number];
    scale: [number, number, number];
  };
  velocity: [number, number, number];
};

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Everything one sculpt simulation needs, independent of where it came from. */
export type SculptSimulationInput = {
  readonly nodes: readonly SculptHierarchyNode[];
  readonly components: readonly SculptComponent[];
  readonly sockets: readonly SculptSocket[];
};

export function normalizeSculptKernelOptions(
  options: SculptKernelOptions,
): Required<SculptKernelOptions> {
  return normalizeOptions(options);
}

function normalizeOptions(options: SculptKernelOptions): Required<SculptKernelOptions> {
  const gravity = options.gravity ?? -9.8;
  const restitution = options.restitution ?? 0.5;
  if (!Number.isInteger(options.seed)) throw new KernelSessionError("sculpt options.seed must be an integer");
  if (!finite(gravity) || gravity > 0) throw new KernelSessionError("sculpt options.gravity must be a finite non-positive number");
  if (!finite(restitution) || restitution < 0 || restitution > 1) throw new KernelSessionError("sculpt options.restitution must be between 0 and 1");
  return Object.freeze({ seed: options.seed, gravity, restitution });
}

function round(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function seededUnit(seed: number, id: string) {
  const bytes = createHash("sha256").update(`${seed}:${id}`).digest();
  return bytes.readUInt32BE(0) / 0xffff_ffff;
}

function cloneTransform(transform: SculptTransform): MutableNode["transform"] {
  return {
    translation: [...transform.translation],
    rotationEulerDegrees: [...transform.rotationEulerDegrees],
    scale: [...transform.scale],
  };
}

function freezeVector(vector: Vector3): Vector3 {
  return Object.freeze([...vector] as [number, number, number]);
}

function freezeTransform(transform: MutableNode["transform"]): SculptTransform {
  return Object.freeze({
    translation: freezeVector(transform.translation),
    rotationEulerDegrees: freezeVector(transform.rotationEulerDegrees),
    scale: freezeVector(transform.scale),
  });
}

function snapshotNode(node: MutableNode): SculptKernelNodeSnapshot {
  return Object.freeze({
    id: node.id,
    parentId: node.parentId,
    componentId: node.componentId,
    transform: freezeTransform(node.transform),
    velocity: freezeVector(node.velocity),
  });
}

function digestSnapshot(value: Omit<SculptKernelSnapshot, "digest">) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

export function validateSculptClock(clock: FrameClock, tick: number) {
  if (clock === null || typeof clock !== "object") throw new KernelSessionError("sculpt advance frame clock is required");
  if (!Number.isInteger(clock.tick) || clock.tick <= tick) throw new KernelSessionError(`sculpt advance.tick must be an integer greater than current tick ${tick}`);
  if (!Number.isInteger(clock.deltaMs) || clock.deltaMs < 0) throw new KernelSessionError("sculpt advance.deltaMs must be a non-negative integer");
  return Object.freeze({ tick: clock.tick, deltaMs: clock.deltaMs });
}

/**
 * Deterministic node simulation for exactly one sculpt. Scene sessions run one
 * of these per placed instance rather than reimplementing the toy path.
 */
export class SculptNodeSimulation {
  private readonly input: SculptSimulationInput;
  private readonly options: Required<SculptKernelOptions>;
  private readonly nodes: MutableNode[];
  private tick = 0;
  private elapsedMs = 0;
  private collisionCount = 0;

  constructor(input: SculptSimulationInput, options: Required<SculptKernelOptions>) {
    this.input = input;
    this.options = options;
    this.nodes = input.nodes.map((node) => {
      const drift = node.parentId === null ? (seededUnit(options.seed, node.id) - 0.5) * 0.4 : 0;
      return {
        id: node.id,
        parentId: node.parentId,
        componentId: node.componentId,
        transform: cloneTransform(node.transform),
        velocity: [round(drift), 0, round(-drift)],
      };
    });
  }

  get currentTick() {
    return this.tick;
  }

  advance(clock: FrameClock) {
    this.applyClock(validateSculptClock(clock, this.tick));
  }

  /** Apply an already-validated clock; scene sessions validate once for all instances. */
  applyClock(nextClock: FrameClock) {
    const seconds = nextClock.deltaMs / 1_000;
    const components = new Map(this.input.components.map((component) => [component.id, component]));
    for (const node of this.nodes) {
      if (node.parentId !== null) continue;
      const component = components.get(node.componentId);
      if (component === undefined) throw new KernelSessionError(`sculpt component "${node.componentId}" disappeared`);
      node.velocity[1] = round(node.velocity[1] + this.options.gravity * seconds);
      for (const axis of [0, 1, 2] as const) {
        node.transform.translation[axis] = round(node.transform.translation[axis] + node.velocity[axis] * seconds);
      }
      const halfHeight = (component.dimensions[1] * node.transform.scale[1]) / 2;
      if (node.transform.translation[1] < halfHeight) {
        node.transform.translation[1] = round(halfHeight);
        if (node.velocity[1] < 0) {
          node.velocity[1] = round(-node.velocity[1] * this.options.restitution);
          this.collisionCount += 1;
        }
      }
    }
    this.tick = nextClock.tick;
    this.elapsedMs += nextClock.deltaMs;
  }

  observe(): SculptKernelSnapshot {
    const nodes = Object.freeze(this.nodes.map(snapshotNode).sort((left, right) => left.id.localeCompare(right.id)));
    const seconds = this.elapsedMs / 1_000;
    const sockets = Object.freeze(
      this.input.sockets
        .map((socket) => {
          const phase = seededUnit(this.options.seed, socket.id) * Math.PI * 2;
          const value = socket.kind === "animation"
            ? round(socket.amplitude * Math.sin(Math.PI * 2 * socket.frequencyHz * seconds + phase))
            : 0;
          return Object.freeze({ id: socket.id, nodeId: socket.nodeId, value });
        })
        .sort((left, right) => left.id.localeCompare(right.id)),
    );
    const payload = Object.freeze({
      tick: this.tick,
      seed: this.options.seed,
      elapsedMs: this.elapsedMs,
      collisionCount: this.collisionCount,
      nodes,
      sockets,
    });
    return Object.freeze({ ...payload, digest: digestSnapshot(payload) });
  }
}

class SculptSessionImpl implements SculptKernelSession {
  private readonly artifact: SculptArtifact;
  private readonly options: Required<SculptKernelOptions>;
  private readonly simulation: SculptNodeSimulation;
  private readonly advances: FrameClock[] = [];

  constructor(artifact: SculptArtifact, options: Required<SculptKernelOptions>) {
    this.artifact = artifact;
    this.options = options;
    this.simulation = new SculptNodeSimulation(
      {
        nodes: artifact.runtimeHierarchy.nodes,
        components: artifact.spec.components,
        sockets: artifact.spec.sockets,
      },
      options,
    );
  }

  advance(clock: FrameClock) {
    const nextClock = validateSculptClock(clock, this.simulation.currentTick);
    this.simulation.applyClock(nextClock);
    this.advances.push(nextClock);
  }

  observe(): SculptKernelSnapshot {
    return this.simulation.observe();
  }

  save(): SculptKernelSaveArtifact {
    return Object.freeze({
      schemaVersion: SCULPT_SCHEMA_VERSION,
      kind: SCULPT_KERNEL_SAVE_KIND,
      artifact: this.artifact,
      options: this.options,
      advances: Object.freeze(this.advances.map((clock) => Object.freeze({ ...clock }))),
      terminalDigest: this.observe().digest,
    });
  }
}

/** Project a validated Sculpt Artifact hierarchy into kernel-owned state. */
export function openSculptKernelSession(
  artifactValue: unknown,
  options: SculptKernelOptions,
): SculptKernelSession {
  const artifact = validateSculptArtifact(artifactValue);
  if (!artifact.ok) throw new KernelSessionError(artifact.diagnostics[0]?.message ?? "invalid Sculpt Artifact");
  return new SculptSessionImpl(artifact.value, normalizeOptions(options));
}

/** Re-run every recorded advance and refuse if the terminal digest drifts. */
export function replaySculptKernelSession(save: SculptKernelSaveArtifact): SculptKernelSession {
  if (save === null || typeof save !== "object") throw new KernelSessionError("invalid sculpt save artifact");
  if (save.schemaVersion !== SCULPT_SCHEMA_VERSION) throw new KernelSessionError(`sculpt save schema major mismatch: ${save.schemaVersion}`);
  if (save.kind !== SCULPT_KERNEL_SAVE_KIND) throw new KernelSessionError("invalid sculpt save artifact kind");
  if (!Array.isArray(save.advances) || typeof save.terminalDigest !== "string" || !DIGEST_RE.test(save.terminalDigest)) {
    throw new KernelSessionError("invalid sculpt save advances or terminal digest");
  }
  const session = openSculptKernelSession(save.artifact, save.options);
  for (const clock of save.advances) session.advance(clock);
  const terminal = session.observe().digest;
  if (terminal !== save.terminalDigest) throw new KernelSessionError(`sculpt replay digest mismatch: expected ${save.terminalDigest}, got ${terminal}`);
  return session;
}
