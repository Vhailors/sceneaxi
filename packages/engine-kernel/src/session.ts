/**
 * Minimal deterministic command/snapshot session (ADR 0001 Design A).
 * Only `advance` mutates authoritative state. No presentation/backend types.
 * No Node builtins either — the digest is portable so this session opens in a
 * browser (see `./portable-digest.ts` and docs/kernel-browser-open.md).
 */
import { KernelSessionError } from "./errors.js";
import {
  prefixedDigest,
  resolveKernelDigest,
  type KernelDigest,
} from "./portable-digest.js";
import {
  KERNEL_SESSION_SCHEMA_VERSION,
  type FrameClock,
  type KernelCommand,
  type KernelSessionEvent,
  type KernelSessionSaveArtifact,
  type KernelSnapshot,
  type ProductManifest,
  type SnapshotEntity,
} from "@sceneaxi/schemas";

/** engine-kernel package version stamped into save artifacts. */
export const KERNEL_VERSION = "0.0.0";

/** Core-train BOM version stamped into save artifacts. */
export const BOM_VERSION = "0.0.0";

const VERSION_RE = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Host services injected at open/replay: a clock for command timestamps and an
 * optional synchronous digest. Omitting `digest` uses the portable pure-JS
 * sha256, so no host has to supply a Node builtin.
 */
export interface KernelHost {
  readonly nowMs: () => number;
  readonly digest?: KernelDigest;
}

export interface KernelSession {
  dispatch(command: KernelCommand): void;
  advance(clock: FrameClock): void;
  observe(): KernelSnapshot;
  save(): KernelSessionSaveArtifact;
}

export { KernelSessionError } from "./errors.js";

interface MutableEntity {
  id: string;
  x: number;
  y: number;
}

interface PendingDispatch {
  command: KernelCommand;
  timestampMs: number;
}

export function open(
  productManifest: ProductManifest,
  host: KernelHost,
): KernelSession {
  validateManifest(productManifest);
  validateHost(host);
  return new SessionImpl(cloneManifest(productManifest), host, []);
}

export function replay(
  artifact: KernelSessionSaveArtifact,
  host: KernelHost,
): KernelSession {
  validateHost(host);
  if (!artifact || typeof artifact !== "object") {
    throw new KernelSessionError("invalid save artifact");
  }
  if (artifact.schemaVersion !== KERNEL_SESSION_SCHEMA_VERSION) {
    throw new KernelSessionError(
      `schema major mismatch: artifact schemaVersion ${String(artifact.schemaVersion)} !== ${String(KERNEL_SESSION_SCHEMA_VERSION)}`,
    );
  }
  if (
    typeof artifact.kernelVersion !== "string" ||
    !VERSION_RE.test(artifact.kernelVersion) ||
    typeof artifact.bomVersion !== "string" ||
    !VERSION_RE.test(artifact.bomVersion)
  ) {
    throw new KernelSessionError("save artifact has invalid kernelVersion or bomVersion");
  }
  if (!Array.isArray(artifact.events)) {
    throw new KernelSessionError("save artifact missing events");
  }
  validateManifest(artifact.productManifest);
  if (
    typeof artifact.terminalDigest !== "string" ||
    !DIGEST_RE.test(artifact.terminalDigest)
  ) {
    throw new KernelSessionError("save artifact has invalid terminalDigest");
  }

  const session = new SessionImpl(cloneManifest(artifact.productManifest), host, []);
  let hasPendingDispatch = false;

  for (const event of artifact.events) {
    if (!event || typeof event !== "object") {
      throw new KernelSessionError("invalid save artifact event");
    }
    if (event.kind === "dispatch") {
      session.dispatchRecorded(event.command, event.timestampMs);
      hasPendingDispatch = true;
    } else if (event.kind === "advance") {
      session.advance(event.clock);
      hasPendingDispatch = false;
    } else {
      throw new KernelSessionError("invalid save artifact event kind");
    }
  }
  if (hasPendingDispatch) {
    throw new KernelSessionError(
      "save artifact ends with unadvanced dispatch commands",
    );
  }

  const terminal = session.observe().digest;
  if (artifact.terminalDigest !== terminal) {
    throw new KernelSessionError(
      `replay digest mismatch: expected ${artifact.terminalDigest}, got ${terminal}`,
    );
  }

  return session;
}

function validateHost(host: KernelHost): void {
  if (!host || typeof host.nowMs !== "function") {
    throw new KernelSessionError("host.nowMs is required");
  }
}

function validateManifest(manifest: ProductManifest): void {
  if (
    !manifest ||
    typeof manifest.productId !== "string" ||
    !ID_RE.test(manifest.productId)
  ) {
    throw new KernelSessionError("productManifest.productId is required");
  }
  if (!Number.isInteger(manifest.seed)) {
    throw new KernelSessionError("productManifest.seed must be an integer");
  }
  if (manifest.entities !== undefined) {
    if (!Array.isArray(manifest.entities)) {
      throw new KernelSessionError("productManifest.entities must be an array");
    }
    const seen = new Set<string>();
    for (const e of manifest.entities) {
      if (!e || typeof e.id !== "string" || !ID_RE.test(e.id)) {
        throw new KernelSessionError("entity id is required");
      }
      if (seen.has(e.id)) {
        throw new KernelSessionError(`duplicate entity id "${e.id}"`);
      }
      seen.add(e.id);
      if (!Number.isInteger(e.x) || !Number.isInteger(e.y)) {
        throw new KernelSessionError(`entity "${e.id}" positions must be integers`);
      }
    }
  }
}

function cloneManifest(manifest: ProductManifest): ProductManifest {
  const entities = manifest.entities?.map((e) =>
    Object.freeze({ id: e.id, x: e.x, y: e.y }),
  );
  if (entities) {
    return Object.freeze({
      productId: manifest.productId,
      seed: manifest.seed,
      entities: Object.freeze(entities),
    });
  }
  return Object.freeze({
    productId: manifest.productId,
    seed: manifest.seed,
  });
}

function isIntegerPair(value: unknown): value is readonly [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isInteger(value[0]) &&
    Number.isInteger(value[1])
  );
}

function validateCommand(command: KernelCommand): KernelCommand {
  if (!command || typeof command !== "object" || typeof command.type !== "string") {
    throw new KernelSessionError("invalid command");
  }
  if (command.type === "move") {
    if (typeof command.actor !== "string" || !ID_RE.test(command.actor)) {
      throw new KernelSessionError("move.actor must be a valid entity id");
    }
    if (!isIntegerPair(command.axis)) {
      throw new KernelSessionError("move.axis must be an integer pair");
    }
    return Object.freeze({
      type: "move",
      actor: command.actor,
      axis: Object.freeze([command.axis[0], command.axis[1]] as const),
    });
  }
  if (command.type === "spawn") {
    if (typeof command.actor !== "string" || !ID_RE.test(command.actor)) {
      throw new KernelSessionError("spawn.actor must be a valid entity id");
    }
    if (!isIntegerPair(command.position)) {
      throw new KernelSessionError("spawn.position must be an integer pair");
    }
    return Object.freeze({
      type: "spawn",
      actor: command.actor,
      position: Object.freeze([command.position[0], command.position[1]] as const),
    });
  }
  throw new KernelSessionError(
    `unknown or invalid command type "${String((command as { type?: string }).type)}"`,
  );
}

function validateClock(clock: FrameClock, currentTick: number): FrameClock {
  if (!clock || typeof clock !== "object") {
    throw new KernelSessionError("frame clock is required");
  }
  if (!Number.isInteger(clock.tick) || clock.tick <= currentTick) {
    throw new KernelSessionError(
      `advance.tick must be an integer greater than current tick ${String(currentTick)}`,
    );
  }
  if (!Number.isInteger(clock.deltaMs) || clock.deltaMs < 0) {
    throw new KernelSessionError("advance.deltaMs must be a non-negative integer");
  }
  return Object.freeze({ tick: clock.tick, deltaMs: clock.deltaMs });
}

function seedEntities(manifest: ProductManifest): Map<string, MutableEntity> {
  const map = new Map<string, MutableEntity>();
  if (manifest.entities && manifest.entities.length > 0) {
    for (const e of manifest.entities) {
      map.set(e.id, { id: e.id, x: e.x, y: e.y });
    }
  } else {
    map.set("player", { id: "player", x: 0, y: 0 });
  }
  return map;
}

function sortedEntities(entities: Map<string, MutableEntity>): SnapshotEntity[] {
  return [...entities.values()]
    .map((e) => Object.freeze({ id: e.id, x: e.x, y: e.y }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Canonical digest: sha256 over JSON of {tick, seed, entities sorted by id}. */
function computeDigest(
  digest: KernelDigest,
  tick: number,
  seed: number,
  entities: ReadonlyArray<SnapshotEntity>,
): string {
  const payload = JSON.stringify({
    tick,
    seed,
    entities: entities.map((e) => ({ id: e.id, x: e.x, y: e.y })),
  });
  return prefixedDigest(digest, payload);
}

class SessionImpl implements KernelSession {
  private readonly manifest: ProductManifest;
  private readonly host: KernelHost;
  private readonly digest: KernelDigest;
  private entities: Map<string, MutableEntity>;
  private readonly pending: PendingDispatch[] = [];
  private readonly events: KernelSessionEvent[] = [];
  private tick = 0;

  constructor(
    manifest: ProductManifest,
    host: KernelHost,
    initialEvents: KernelSessionEvent[],
  ) {
    this.manifest = manifest;
    this.host = host;
    this.digest = resolveKernelDigest(host.digest);
    this.entities = seedEntities(manifest);
    this.events.push(...initialEvents);
  }

  dispatch(command: KernelCommand): void {
    const timestampMs = this.host.nowMs();
    if (!Number.isInteger(timestampMs)) {
      throw new KernelSessionError("host.nowMs must return an integer");
    }
    this.dispatchRecorded(command, timestampMs);
  }

  dispatchRecorded(command: KernelCommand, timestampMs: number): void {
    if (!Number.isInteger(timestampMs)) {
      throw new KernelSessionError("dispatch timestampMs must be an integer");
    }
    const validated = validateCommand(command);
    this.validateCommandState(validated);
    this.pending.push({ command: validated, timestampMs });
    this.events.push(
      Object.freeze({
        kind: "dispatch",
        command: validated,
        timestampMs,
      }),
    );
  }

  advance(clock: FrameClock): void {
    const validatedClock = validateClock(clock, this.tick);
    const nextEntities = new Map(
      [...this.entities].map(([id, entity]) => [id, { ...entity }]),
    );
    for (const item of this.pending) {
      this.applyCommand(nextEntities, item.command);
    }
    this.entities = nextEntities;
    this.pending.length = 0;
    this.tick = validatedClock.tick;
    this.events.push(
      Object.freeze({
        kind: "advance",
        clock: validatedClock,
      }),
    );
  }

  private validateCommandState(command: KernelCommand): void {
    const actorIds = new Set(this.entities.keys());
    for (const item of this.pending) {
      if (item.command.type === "spawn") actorIds.add(item.command.actor);
    }
    if (command.type === "move" && !actorIds.has(command.actor)) {
      throw new KernelSessionError(
        `move target actor "${command.actor}" does not exist`,
      );
    }
    if (command.type === "spawn" && actorIds.has(command.actor)) {
      throw new KernelSessionError(
        `spawn actor "${command.actor}" already exists`,
      );
    }
  }

  private applyCommand(
    entities: Map<string, MutableEntity>,
    command: KernelCommand,
  ): void {
    if (command.type === "move") {
      const entity = entities.get(command.actor);
      if (!entity) {
        throw new KernelSessionError(
          `move target actor "${command.actor}" does not exist`,
        );
      }
      entity.x += command.axis[0];
      entity.y += command.axis[1];
      return;
    }
    if (command.type === "spawn") {
      if (entities.has(command.actor)) {
        throw new KernelSessionError(
          `spawn actor "${command.actor}" already exists`,
        );
      }
      entities.set(command.actor, {
        id: command.actor,
        x: command.position[0],
        y: command.position[1],
      });
      return;
    }
  }

  observe(): KernelSnapshot {
    const entities = Object.freeze(sortedEntities(this.entities));
    const digest = computeDigest(
      this.digest,
      this.tick,
      this.manifest.seed,
      entities,
    );
    return Object.freeze({
      tick: this.tick,
      seed: this.manifest.seed,
      entities,
      digest,
    });
  }

  save(): KernelSessionSaveArtifact {
    if (this.pending.length > 0) {
      throw new KernelSessionError(
        "cannot save with pending un-advanced commands; call advance first",
      );
    }
    const terminalDigest = this.observe().digest;
    return Object.freeze({
      schemaVersion: KERNEL_SESSION_SCHEMA_VERSION,
      kernelVersion: KERNEL_VERSION,
      bomVersion: BOM_VERSION,
      productManifest: this.manifest,
      events: Object.freeze([...this.events]),
      terminalDigest,
    });
  }
}
