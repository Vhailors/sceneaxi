/**
 * Minimal deterministic command/snapshot session (ADR 0001 Design A).
 * Only `advance` mutates authoritative state. No presentation/backend types.
 * No Node builtins either — portable digest semantics let this session open in
 * a browser (see `./portable-digest.ts` and docs/kernel-browser-open.md).
 */
import { KernelSessionError } from "./errors.js";
import {
  prefixedDigest,
  resolveKernelDigest,
  type KernelDigest,
  type KernelDigestHost,
} from "./portable-digest.js";
import {
  KERNEL_SESSION_SCHEMA_VERSION,
  RARITY_NAMESPACE_KIND,
  RARITY_REFUSE_CODES,
  RARITY_SCHEMA_VERSION,
  canonicalRarityJson,
  digestRarityPolicy,
  digestRarityRequest,
  digestRarityValue,
  isRarityForbiddenInputKey,
  isRarityIdentifier,
  snapshotPlainRecord,
  validateRarityNamespace,
  validateRarityRollRequest,
  validateRarityProviderEvidence,
  type FrameClock,
  type KernelCommand as SchemaKernelCommand,
  type KernelSessionEvent as SchemaKernelSessionEvent,
  type KernelSessionSaveArtifact as SchemaKernelSessionSaveArtifact,
  type KernelSnapshot as SchemaKernelSnapshot,
  type JsonValue,
  type ProductManifest as SchemaProductManifest,
  type RarityNamespace,
  type RarityPolicy,
  type RarityRefuseCode,
  type RarityRollCommand,
  type RarityRollRecord,
  type SnapshotEntity,
} from "@sceneaxi/schemas";
import { resolveRarityRoll } from "./rarity.js";
import { validateGameplay, initialGameplay, advanceGameplay, type GameplayDefinition, type GameplaySnapshot, type GameplayActionCommand } from "./gameplay.js";

export type ProductManifest = SchemaProductManifest & { readonly gameplay?: GameplayDefinition };

export type KernelCommand = SchemaKernelCommand | GameplayActionCommand;

export type KernelSnapshot = SchemaKernelSnapshot & { readonly gameplay?: GameplaySnapshot };

export type KernelSessionEvent = Exclude<SchemaKernelSessionEvent, { kind: "dispatch" }> | Readonly<{ kind: "dispatch"; command: KernelCommand; timestampMs: number }>;

export type KernelSessionSaveArtifact = Omit<SchemaKernelSessionSaveArtifact, "events" | "productManifest"> & Readonly<{ events: readonly KernelSessionEvent[]; productManifest: ProductManifest }>;


/** engine-kernel package version stamped into save artifacts. */
export const KERNEL_VERSION = "0.0.0";

/** Core-train BOM version stamped into save artifacts. */
export const BOM_VERSION = "0.0.0";

const VERSION_RE = /^[0-9]+\.[0-9]+\.[0-9]+$/;

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

const MAX_ENTITIES = 4096;

const MAX_PENDING = 4096;

const MAX_EVENTS = 100_000;

const boundedCoordinate = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && Math.abs(value) <= 1_000_000;

/** Host services injected at open/replay. */
export interface KernelHost extends KernelDigestHost {
  readonly nowMs: () => number;
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

type MutableRarityState = {
  readonly policy: RarityPolicy;
  rolls: RarityRollRecord[];
};

export function open(
  productManifest: ProductManifest,
  host: KernelHost,
): KernelSession {
  validateHost(host);

  return new SessionImpl(
    validateManifest(productManifest),
    host,
    [],
    resolveKernelDigest(host.digest),
  );
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

  if (artifact.kernelVersion.split(".")[0] !== KERNEL_VERSION.split(".")[0] || artifact.bomVersion.split(".")[0] !== BOM_VERSION.split(".")[0]) {
    throw new KernelSessionError("unsupported kernelVersion or bomVersion major", "KERNEL_VERSION_UNSUPPORTED");
  }

  if (!Array.isArray(artifact.events) || artifact.events.length > MAX_EVENTS) {
    throw new KernelSessionError("save artifact missing events");
  }

  const expectedManifest = validateManifest(artifact.productManifest);

  if (
    typeof artifact.terminalDigest !== "string" ||
    !DIGEST_RE.test(artifact.terminalDigest)
  ) {
    throw new KernelSessionError("save artifact has invalid terminalDigest");
  }

  const generatedRarityEvents = rarityEventIdsOf(artifact.events);

  const replayManifest = withoutGeneratedRarityRolls(
    expectedManifest,
    generatedRarityEvents,
  );

  const session = new SessionImpl(
    replayManifest,
    host,
    [],
    resolveKernelDigest(host.digest),
  );

  const expectedRolls = rollsByEventId(expectedManifest.rarity);
  let hasPendingDispatch = false;

  for (const event of artifact.events) {
    if (!event || typeof event !== "object") {
      throw new KernelSessionError("invalid save artifact event");
    }

    if (event.kind === "dispatch") {
      const command = validateCommand(event.command);

      if (!session.recordValidatedDispatch(command, event.timestampMs)) {
        throw rarityError(
          RARITY_REFUSE_CODES.duplicateEvent,
          `rarity.rolls.${command.type === "rarity-roll" ? command.eventId : ""}`,
          "A save artifact cannot record the same rarity event id twice.",
        );
      }

      verifySavedRarityCommand(command, expectedManifest.rarity, expectedRolls);
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

  const snapshot = session.observe();

  if (!sameRarityNamespace(snapshot.rarity, expectedManifest.rarity)) {
    throw rarityError(
      RARITY_REFUSE_CODES.provenanceMismatch,
      "rarity",
      "Replay did not recompute the saved rarity namespace exactly.",
    );
  }

  if (artifact.terminalDigest !== snapshot.digest) {
    throw new KernelSessionError(
      `replay digest mismatch: expected ${artifact.terminalDigest}, got ${snapshot.digest}`,
    );
  }

  return session;
}

function validateHost(host: KernelHost): void {
  if (!host || typeof host.nowMs !== "function") {
    throw new KernelSessionError("host.nowMs is required");
  }
}

function rarityError(
  code: RarityRefuseCode,
  path: string,
  message: string,
): KernelSessionError {
  return new KernelSessionError(`${code} at ${path}: ${message}`, code);
}

function validateManifest(manifest: ProductManifest): ProductManifest {
  if (
    !manifest ||
    typeof manifest.productId !== "string" ||
    !ID_RE.test(manifest.productId)
  ) {
    throw new KernelSessionError("productManifest.productId is required");
  }

  if (manifest.productId.length > 128) {
    if (manifest.rarity !== undefined) throw rarityError(RARITY_REFUSE_CODES.invalidIdentifier, "productManifest.productId", "Product identifier exceeds the supported bound.");
    throw new KernelSessionError("productManifest.productId exceeds identifier capacity");
  }

  if (!Number.isSafeInteger(manifest.seed)) {
    throw new KernelSessionError("productManifest.seed must be an integer");
  }

  const gameplay = manifest.gameplay === undefined ? undefined : validateGameplay(manifest.gameplay);
  let rarity: RarityNamespace | undefined;

  if (manifest.rarity !== undefined) {
    if (!Number.isSafeInteger(manifest.seed)) {
      throw rarityError(
        RARITY_REFUSE_CODES.seedInvalid,
        "productManifest.seed",
        "A product manifest with rarity must own a safe integer seed.",
      );
    }

    if (!isRarityIdentifier(manifest.productId)) {
      throw rarityError(
        RARITY_REFUSE_CODES.invalidIdentifier,
        "productManifest.productId",
        "A product manifest with rarity must own a productId usable as the rarity resolution scope.",
      );
    }

    const validated = validateRarityNamespace(manifest.rarity);

    if (!validated.ok) {
      throw rarityError(validated.code, validated.path, validated.message);
    }

    rarity = validated.value;
    const policyDigest = digestRarityPolicy(rarity.policy);

    for (const roll of rarity.rolls) {
      if (roll.provenance.policyDigest !== policyDigest) {
        throw rarityError(
          RARITY_REFUSE_CODES.policyChanged,
          `rarity.rolls.${roll.eventId}.provenance.policyDigest`,
          "The rarity policy changed after this roll was accepted; a project's policy is immutable once it has rolled, and a new policy needs new event ids.",
        );
      }

      const resolved = resolveRarityRoll(
        {
          projectSeed: manifest.seed,
          scope: manifest.productId,
          eventId: roll.eventId,
          ...(roll.providerEvidence === undefined
            ? {}
            : {
                providerEvidenceDigest: digestRarityValue(
                  roll.providerEvidence as unknown as JsonValue,
                ),
              }),
        },
        rarity.policy,
        roll.request,
      );

      if (!resolved.ok) {
        throw rarityError(resolved.code, resolved.path, resolved.message);
      }

      if (
        canonicalRarityJson(
          resolved.value.outcome as unknown as JsonValue,
        ) !==
        canonicalRarityJson(roll.outcome as unknown as JsonValue)
      ) {
        throw rarityError(
          RARITY_REFUSE_CODES.outcomeMismatch,
          `rarity.rolls.${roll.eventId}.outcome`,
          "Stored rarity outcome does not match deterministic recomputation.",
        );
      }

      if (
        canonicalRarityJson(
          resolved.value.provenance as unknown as JsonValue,
        ) !==
        canonicalRarityJson(roll.provenance as unknown as JsonValue)
      ) {
        throw rarityError(
          RARITY_REFUSE_CODES.provenanceMismatch,
          `rarity.rolls.${roll.eventId}.provenance`,
          "Stored rarity provenance does not match deterministic recomputation.",
        );
      }
    }
  }

  let entities: ReadonlyArray<{ readonly id: string; readonly x: number; readonly y: number }> | undefined;

  if (manifest.entities !== undefined) {
    if (!Array.isArray(manifest.entities) || manifest.entities.length > MAX_ENTITIES) {
      throw new KernelSessionError("productManifest.entities must be an array");
    }

    const seen = new Set<string>();

    for (const e of manifest.entities) {
      if (!e || typeof e.id !== "string" || e.id.length > 128 || !ID_RE.test(e.id)) {
        throw new KernelSessionError("entity id is required");
      }

      if (seen.has(e.id)) {
        throw new KernelSessionError(`duplicate entity id "${e.id}"`);
      }

      seen.add(e.id);

      if (!boundedCoordinate(e.x) || !boundedCoordinate(e.y)) {
        throw new KernelSessionError(`entity "${e.id}" positions must be integers`);
      }
    }

    entities = Object.freeze(
      manifest.entities.map((entity) =>
        Object.freeze({ id: entity.id, x: entity.x, y: entity.y }),
      ),
    );
  }

  if (entities !== undefined && rarity !== undefined) {
    return Object.freeze({
      ...(gameplay === undefined ? {} : { gameplay }),
      productId: manifest.productId,
      seed: manifest.seed,
      entities,
      rarity,
    });
  }

  if (entities !== undefined) {
    return Object.freeze({
      ...(gameplay === undefined ? {} : { gameplay }),
      productId: manifest.productId,
      seed: manifest.seed,
      entities,
    });
  }

  if (rarity !== undefined) {
    return Object.freeze({
      ...(gameplay === undefined ? {} : { gameplay }),
      productId: manifest.productId,
      seed: manifest.seed,
      rarity,
    });
  }

  return Object.freeze({
    ...(gameplay === undefined ? {} : { gameplay }),
    productId: manifest.productId,
    seed: manifest.seed,
  });
}

function rarityEventIdsOf(events: readonly KernelSessionEvent[]): Set<string> {
  const ids = new Set<string>();

  for (const event of events) {
    if (
      event !== null &&
      typeof event === "object" &&
      event.kind === "dispatch" &&
      event.command !== null &&
      typeof event.command === "object" &&
      event.command.type === "rarity-roll" &&
      typeof event.command.eventId === "string"
    ) {
      ids.add(event.command.eventId);
    }
  }

  return ids;
}

function withoutGeneratedRarityRolls(
  manifest: ProductManifest,
  generatedEventIds: ReadonlySet<string>,
): ProductManifest {
  if (manifest.rarity === undefined || generatedEventIds.size === 0) return manifest;

  const rarity = Object.freeze({
    ...manifest.rarity,
    rolls: Object.freeze(
      manifest.rarity.rolls.filter((roll) => !generatedEventIds.has(roll.eventId)),
    ),
  });

  return Object.freeze({ ...manifest, rarity });
}

function rollsByEventId(
  expected: RarityNamespace | undefined,
): ReadonlyMap<string, RarityRollRecord> {
  const byEventId = new Map<string, RarityRollRecord>();

  if (expected === undefined) return byEventId;

  for (const roll of expected.rolls) byEventId.set(roll.eventId, roll);

  return byEventId;
}

/**
 * Bind an already-validated saved dispatch to the accepted project-owned roll.
 * The session has run its own policy-aware validation by this point, so the
 * request here is normalized and only its canonical identity is still in
 * question.
 */
function verifySavedRarityCommand(
  command: KernelCommand,
  expected: RarityNamespace | undefined,
  expectedRolls: ReadonlyMap<string, RarityRollRecord>,
): void {
  if (command.type !== "rarity-roll") return;

  if (expected === undefined) {
    throw rarityError(
      RARITY_REFUSE_CODES.policyAbsent,
      "productManifest.rarity",
      "A saved rarity dispatch has no project-owned rarity namespace.",
    );
  }

  const roll = expectedRolls.get(command.eventId);

  if (roll === undefined) {
    throw rarityError(
      RARITY_REFUSE_CODES.outcomeMismatch,
      `rarity.rolls.${command.eventId}`,
      "A saved rarity dispatch has no accepted project-owned outcome.",
    );
  }

  if (digestRarityRequest(command.request) !== roll.provenance.requestDigest) {
    throw rarityError(
      RARITY_REFUSE_CODES.eventInputConflict,
      `rarity.rolls.${command.eventId}.request`,
      "An existing rarity event id was replayed with changed request bytes.",
    );
  }

  if (
    (command.providerEvidence === undefined) !== (roll.providerEvidence === undefined) ||
    (command.providerEvidence !== undefined &&
      roll.providerEvidence !== undefined &&
      canonicalRarityJson(command.providerEvidence as unknown as JsonValue) !==
        canonicalRarityJson(roll.providerEvidence as unknown as JsonValue))
  ) {
    throw rarityError(
      RARITY_REFUSE_CODES.provenanceMismatch,
      `rarity.rolls.${command.eventId}.providerEvidence`,
      "A saved rarity dispatch must carry the exact provider evidence bound to its roll.",
    );
  }
}

function sameRarityNamespace(
  left: RarityNamespace | undefined,
  right: RarityNamespace | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;

  return (
    canonicalRarityJson(left as unknown as JsonValue) ===
    canonicalRarityJson(right as unknown as JsonValue)
  );
}

function isIntegerPair(value: unknown): value is readonly [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    boundedCoordinate(value[0]) &&
    boundedCoordinate(value[1])
  );
}

function validateCommand(command: KernelCommand): KernelCommand {
  const record = snapshotPlainRecord(command);

  if (record === undefined || typeof record["type"] !== "string") {
    throw new KernelSessionError("invalid command");
  }

  if (record["type"] === "action") {
    const actionId = record["actionId"];

    if (typeof actionId !== "string" || !/^[a-z][a-z0-9.-]{0,63}$/.test(actionId) || Object.keys(record).some(k => k !== "type" && k !== "actionId")) throw new KernelSessionError("invalid gameplay action");

    return Object.freeze({ type: "action", actionId });
  }

  if (record["type"] === "move") {
    if (Object.keys(record).some(key => !["type","actor","axis"].includes(key))) throw new KernelSessionError("invalid move command fields");
    const actor = record["actor"];
    const axis = record["axis"];

    if (typeof actor !== "string" || actor.length > 128 || !ID_RE.test(actor)) {
      throw new KernelSessionError("move.actor must be a valid entity id");
    }

    if (!isIntegerPair(axis)) {
      throw new KernelSessionError("move.axis must be an integer pair");
    }

    return Object.freeze({
      type: "move",
      actor,
      axis: Object.freeze([axis[0], axis[1]] as const),
    });
  }

  if (record["type"] === "spawn") {
    if (Object.keys(record).some(key => !["type","actor","position"].includes(key))) throw new KernelSessionError("invalid spawn command fields");
    const actor = record["actor"];
    const position = record["position"];

    if (typeof actor !== "string" || actor.length > 128 || !ID_RE.test(actor)) {
      throw new KernelSessionError("spawn.actor must be a valid entity id");
    }

    if (!isIntegerPair(position)) {
      throw new KernelSessionError("spawn.position must be an integer pair");
    }

    return Object.freeze({
      type: "spawn",
      actor,
      position: Object.freeze([position[0], position[1]] as const),
    });
  }

  if (record["type"] === "rarity-roll") {
    const unexpected = Object.keys(record).find(
      (key) =>
        key !== "type" &&
        key !== "eventId" &&
        key !== "request" &&
        key !== "providerEvidence",
    );

    if (unexpected !== undefined) {
      throw rarityError(
        isRarityForbiddenInputKey(unexpected)
          ? RARITY_REFUSE_CODES.providerEntropyForbidden
          : RARITY_REFUSE_CODES.unexpectedProperty,
        `rarity.command.${unexpected}`,
        `Rarity roll command cannot supply "${unexpected}".`,
      );
    }

    const eventId = record["eventId"];

    if (!isRarityIdentifier(eventId)) {
      throw rarityError(
        RARITY_REFUSE_CODES.invalidIdentifier,
        "rarity.command.eventId",
        "Rarity roll eventId must be a stable lowercase identifier.",
      );
    }

    const request = validateRarityRollRequest(record["request"]);

    if (!request.ok) throw rarityError(request.code, request.path, request.message);
    const hasProviderEvidence = Object.hasOwn(record, "providerEvidence");

    const providerEvidence = hasProviderEvidence
      ? validateRarityProviderEvidence(
          record["providerEvidence"],
          "rarity.command.providerEvidence",
        )
      : undefined;

    if (providerEvidence !== undefined && !providerEvidence.ok) {
      throw rarityError(providerEvidence.code, providerEvidence.path, providerEvidence.message);
    }

    return Object.freeze({
      type: "rarity-roll",
      eventId,
      request: request.value,
      ...(providerEvidence === undefined ? {} : { providerEvidence: providerEvidence.value }),
    });
  }

  throw new KernelSessionError(
    `unknown or invalid command type "${String(record["type"])}"`,
  );
}

function validateClock(clock: FrameClock, currentTick: number): FrameClock {
  if (!clock || typeof clock !== "object") {
    throw new KernelSessionError("frame clock is required");
  }

  if (!Number.isSafeInteger(clock.tick) || clock.tick <= currentTick) {
    throw new KernelSessionError(
      `advance.tick must be an integer greater than current tick ${String(currentTick)}`,
    );
  }

  if (!Number.isSafeInteger(clock.deltaMs) || clock.deltaMs < 0 || clock.deltaMs > 60_000) {
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

/**
 * Canonical digest, in two byte-stable branches.
 *
 * Without a rarity namespace it stays `JSON.stringify({tick, seed, entities
 * sorted by id})`, so every checked-in golden digest predating rarity keeps its
 * exact bytes. With one, the payload gains `rarity` and is serialized with the
 * repository's sorted-key canonical JSON (`entities`, `rarity`, `seed`, `tick`),
 * which is what binds the accepted rolls into the terminal digest.
 */
function computeDigest(
  tick: number,
  seed: number,
  entities: ReadonlyArray<SnapshotEntity>,
  rarity: RarityNamespace | undefined,
  digest: KernelDigest,
): string {
  const snapshotEntities = entities.map((e) => ({ id: e.id, x: e.x, y: e.y }));

  const payload =
    rarity === undefined
      ? JSON.stringify({ tick, seed, entities: snapshotEntities })
      : canonicalRarityJson({
          tick,
          seed,
          entities: snapshotEntities,
          rarity,
        } as unknown as JsonValue);

  return prefixedDigest(payload, digest);
}

class SessionImpl implements KernelSession {
  private readonly manifest: ProductManifest;
  private readonly host: KernelHost;
  private readonly digest: KernelDigest;
  private entities: Map<string, MutableEntity>;
  private readonly rarity: MutableRarityState | undefined;
  private readonly pending: PendingDispatch[] = [];
  private readonly pendingSpawnIds = new Set<string>();
  private readonly events: KernelSessionEvent[] = [];
  private tick = 0;
  private gameplay: GameplaySnapshot | undefined;

  constructor(
    manifest: ProductManifest,
    host: KernelHost,
    initialEvents: KernelSessionEvent[],
    digest: KernelDigest,
  ) {
    this.manifest = manifest;
    this.gameplay = manifest.gameplay === undefined ? undefined : initialGameplay(manifest.gameplay);
    this.host = host;
    this.digest = digest;
    this.entities = seedEntities(manifest);
    this.rarity =
      manifest.rarity === undefined
        ? undefined
        : {
            policy: manifest.rarity.policy,
            rolls: [...manifest.rarity.rolls],
          };
    this.events.push(...initialEvents);
  }

  dispatch(command: KernelCommand): void {
    const timestampMs = this.host.nowMs();

    if (!Number.isSafeInteger(timestampMs)) {
      throw new KernelSessionError("host.nowMs must return an integer");
    }

    this.recordValidatedDispatch(validateCommand(command), timestampMs);
  }

  /**
   * Record a command `validateCommand` has already normalized. Returns false
   * when it was an accepted idempotent repeat and nothing was recorded.
   */
  recordValidatedDispatch(validated: KernelCommand, timestampMs: number): boolean {
    if (!Number.isSafeInteger(timestampMs)) {
      throw new KernelSessionError("dispatch timestampMs must be an integer");
    }

    if (this.validateCommandState(validated)) return false;

    if (this.pending.length >= MAX_PENDING || this.events.length >= MAX_EVENTS - 1) throw new KernelSessionError("session command capacity exceeded");
    this.pending.push({ command: validated, timestampMs });

    if (validated.type === "spawn") this.pendingSpawnIds.add(validated.actor);
    this.events.push(
      Object.freeze({
        kind: "dispatch",
        command: validated,
        timestampMs,
      }),
    );

    return true;
  }

  advance(clock: FrameClock): void {
    const validatedClock = validateClock(clock, this.tick);

    if (this.events.length >= MAX_EVENTS) throw new KernelSessionError("session event capacity exceeded");

    const nextEntities = new Map(
      [...this.entities].map(([id, entity]) => [id, { ...entity }]),
    );

    const nextRarityRolls = this.rarity?.rolls.slice();

    for (const item of this.pending) {
      this.applyCommand(nextEntities, nextRarityRolls, item.command);
    }

    const nextGameplay = this.manifest.gameplay === undefined || this.gameplay === undefined ? undefined : advanceGameplay(this.manifest.gameplay, this.gameplay, this.pending.flatMap(p => p.command.type === "action" ? [p.command.actionId] : []), validatedClock.deltaMs, (actor, axis) => this.applyCommand(nextEntities, nextRarityRolls, { type: "move", actor, axis }));
    this.entities = nextEntities;
    this.gameplay = nextGameplay;

    if (this.rarity !== undefined && nextRarityRolls !== undefined) {
      this.rarity.rolls = nextRarityRolls;
    }

    this.pending.length = 0;
    this.pendingSpawnIds.clear();
    this.tick = validatedClock.tick;
    this.events.push(
      Object.freeze({
        kind: "advance",
        clock: validatedClock,
      }),
    );
  }

  private validateCommandState(command: KernelCommand): boolean {
    if (command.type === "action") {
      if (!this.manifest.gameplay?.actions.some(a => a.id === command.actionId)) throw new KernelSessionError("unknown or unavailable gameplay action");

      return false;
    }

    if (command.type === "rarity-roll") {
      if (this.rarity === undefined) {
        throw rarityError(
          RARITY_REFUSE_CODES.policyAbsent,
          "productManifest.rarity",
          "A rarity roll requires a project-owned rarity policy.",
        );
      }

      const request = validateRarityRollRequest(command.request, this.rarity.policy);

      if (!request.ok) throw rarityError(request.code, request.path, request.message);
      const priorRoll = this.rarity.rolls.find((roll) => roll.eventId === command.eventId);

      const priorPending = this.pending.find(
          (item): item is PendingDispatch & { readonly command: RarityRollCommand } =>
            item.command.type === "rarity-roll" &&
            item.command.eventId === command.eventId,
        )?.command;

      const priorRequest = priorRoll?.request ?? priorPending?.request;
      const priorEvidence = priorRoll?.providerEvidence ?? priorPending?.providerEvidence;

      if (priorRequest !== undefined) {
        const evidenceMatches =
          (priorEvidence === undefined) === (command.providerEvidence === undefined) &&
          (priorEvidence === undefined ||
            command.providerEvidence === undefined ||
            canonicalRarityJson(priorEvidence as unknown as JsonValue) ===
              canonicalRarityJson(command.providerEvidence as unknown as JsonValue));

        if (!evidenceMatches) {
          throw rarityError(
            RARITY_REFUSE_CODES.provenanceMismatch,
            `rarity.rolls.${command.eventId}.providerEvidence`,
            "An existing rarity event must replay with its exact provider evidence.",
          );
        }

        if (digestRarityRequest(priorRequest) === digestRarityRequest(request.value)) return true;
        throw rarityError(
          RARITY_REFUSE_CODES.eventInputConflict,
          `rarity.rolls.${command.eventId}.request`,
          "An existing rarity event id cannot be reused with changed request bytes; reroll with a new event id.",
        );
      }

      return false;
    }

    const actorExists = this.entities.has(command.actor) || this.pendingSpawnIds.has(command.actor);

    if (command.type === "move" && !actorExists) {
      throw new KernelSessionError(
        `move target actor "${command.actor}" does not exist`,
      );
    }

    if (command.type === "spawn" && actorExists) {
      throw new KernelSessionError(
        `spawn actor "${command.actor}" already exists`,
      );
    }

    if (command.type === "spawn" && this.entities.size + this.pendingSpawnIds.size >= MAX_ENTITIES) throw new KernelSessionError("session entity capacity exceeded");

    return false;
  }

  private applyCommand(
    entities: Map<string, MutableEntity>,
    rarityRolls: RarityRollRecord[] | undefined,
    command: KernelCommand,
  ): void {
    if (command.type === "move") {
      const entity = entities.get(command.actor);

      if (!entity) {
        throw new KernelSessionError(
          `move target actor "${command.actor}" does not exist`,
        );
      }

      const x = entity.x + command.axis[0];
      const y = entity.y + command.axis[1];

      if (!boundedCoordinate(x) || !boundedCoordinate(y)) throw new KernelSessionError("move result exceeds coordinate range");
      entity.x = x;
      entity.y = y;

      return;
    }

    if (command.type === "spawn") {
      if (entities.has(command.actor)) {
        throw new KernelSessionError(
          `spawn actor "${command.actor}" already exists`,
        );
      }

      if (entities.size >= MAX_ENTITIES) throw new KernelSessionError("session entity capacity exceeded");
      entities.set(command.actor, {
        id: command.actor,
        x: command.position[0],
        y: command.position[1],
      });

      return;
    }

    if (command.type === "rarity-roll") {
      if (this.rarity === undefined || rarityRolls === undefined) {
        throw rarityError(
          RARITY_REFUSE_CODES.policyAbsent,
          "productManifest.rarity",
          "A rarity roll requires a project-owned rarity policy.",
        );
      }

      const resolved = resolveRarityRoll(
        {
          projectSeed: this.manifest.seed,
          scope: this.manifest.productId,
          eventId: command.eventId,
          ...(command.providerEvidence === undefined
            ? {}
            : {
                providerEvidenceDigest: digestRarityValue(
                  command.providerEvidence as unknown as JsonValue,
                ),
              }),
        },
        this.rarity.policy,
        command.request,
      );

      if (!resolved.ok) {
        throw rarityError(resolved.code, resolved.path, resolved.message);
      }

      rarityRolls.push(Object.freeze({
        ...resolved.value.record,
        ...(command.providerEvidence === undefined
          ? {}
          : { providerEvidence: command.providerEvidence }),
      }));
    }
  }

  private rarityNamespace(): RarityNamespace | undefined {
    if (this.rarity === undefined) return undefined;

    return Object.freeze({
      schemaVersion: RARITY_SCHEMA_VERSION,
      kind: RARITY_NAMESPACE_KIND,
      policy: this.rarity.policy,
      rolls: Object.freeze([...this.rarity.rolls]),
    });
  }

  private currentManifest(rarity: RarityNamespace | undefined): ProductManifest {
    const base = {
      ...(this.manifest.gameplay === undefined ? {} : { gameplay: this.manifest.gameplay }),
      productId: this.manifest.productId,
      seed: this.manifest.seed,
    };

    if (this.manifest.entities !== undefined && rarity !== undefined) {
      return Object.freeze({ ...base, entities: this.manifest.entities, rarity });
    }

    if (this.manifest.entities !== undefined) {
      return Object.freeze({ ...base, entities: this.manifest.entities });
    }

    if (rarity !== undefined) return Object.freeze({ ...base, rarity });

    return Object.freeze(base);
  }

  observe(): KernelSnapshot {
    const entities = Object.freeze(sortedEntities(this.entities));
    const rarity = this.rarityNamespace();

    const baseDigest = computeDigest(
      this.tick,
      this.manifest.seed,
      entities,
      rarity,
      this.digest,
    );

    const digest = this.gameplay === undefined ? baseDigest : prefixedDigest(JSON.stringify({ baseDigest, gameplay: this.gameplay }), this.digest);
    const gameplay = this.gameplay;

    return rarity === undefined
      ? Object.freeze({
          ...(gameplay === undefined ? {} : { gameplay }),
          tick: this.tick,
          seed: this.manifest.seed,
          entities,
          digest,
        })
      : Object.freeze({
          ...(gameplay === undefined ? {} : { gameplay }),
          tick: this.tick,
          seed: this.manifest.seed,
          entities,
          rarity,
          digest,
        });
  }

  save(): KernelSessionSaveArtifact {
    if (this.pending.length > 0) {
      throw new KernelSessionError(
        "cannot save with pending un-advanced commands; call advance first",
      );
    }

    const snapshot = this.observe();

    return Object.freeze({
      schemaVersion: KERNEL_SESSION_SCHEMA_VERSION,
      kernelVersion: KERNEL_VERSION,
      bomVersion: BOM_VERSION,
      productManifest: this.currentManifest(snapshot.rarity),
      events: Object.freeze([...this.events]),
      terminalDigest: snapshot.digest,
    });
  }
}
