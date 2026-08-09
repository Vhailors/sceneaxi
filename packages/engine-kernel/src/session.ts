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
  isRarityForbiddenInputKey,
  isRarityIdentifier,
  snapshotPlainRecord,
  validateRarityNamespace,
  validateRarityRollRequest,
  validateRarityProviderEvidence,
  type FrameClock,
  type KernelCommand,
  type KernelSessionEvent,
  type KernelSessionSaveArtifact,
  type KernelSnapshot,
  type JsonValue,
  type ProductManifest,
  type RarityNamespace,
  type RarityPolicy,
  type ModelProviderCallEvidence,
  type RarityRefuseCode,
  type RarityRollCommand,
  type RarityRollRecord,
  type SnapshotEntity,
} from "@sceneaxi/schemas";
import { resolveRarityRoll } from "./rarity.js";

/** engine-kernel package version stamped into save artifacts. */
export const KERNEL_VERSION = "0.0.0";

/** Core-train BOM version stamped into save artifacts. */
export const BOM_VERSION = "0.0.0";

const VERSION_RE = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

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
  readonly providerEvidence?: ModelProviderCallEvidence;
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
  if (!Array.isArray(artifact.events)) {
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
  if (!Number.isInteger(manifest.seed)) {
    throw new KernelSessionError("productManifest.seed must be an integer");
  }
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
    entities = Object.freeze(
      manifest.entities.map((entity) =>
        Object.freeze({ id: entity.id, x: entity.x, y: entity.y }),
      ),
    );
  }
  if (entities !== undefined && rarity !== undefined) {
    return Object.freeze({
      productId: manifest.productId,
      seed: manifest.seed,
      entities,
      rarity,
    });
  }
  if (entities !== undefined) {
    return Object.freeze({
      productId: manifest.productId,
      seed: manifest.seed,
      entities,
    });
  }
  if (rarity !== undefined) {
    return Object.freeze({
      productId: manifest.productId,
      seed: manifest.seed,
      rarity,
    });
  }
  return Object.freeze({
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
  return manifest.entities === undefined
    ? Object.freeze({ productId: manifest.productId, seed: manifest.seed, rarity })
    : Object.freeze({
        productId: manifest.productId,
        seed: manifest.seed,
        entities: manifest.entities,
        rarity,
      });
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
    Number.isInteger(value[0]) &&
    Number.isInteger(value[1])
  );
}

function validateCommand(command: KernelCommand): KernelCommand {
  const record = snapshotPlainRecord(command);
  if (record === undefined || typeof record["type"] !== "string") {
    throw new KernelSessionError("invalid command");
  }
  if (record["type"] === "move") {
    const actor = record["actor"];
    const axis = record["axis"];
    if (typeof actor !== "string" || !ID_RE.test(actor)) {
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
    const actor = record["actor"];
    const position = record["position"];
    if (typeof actor !== "string" || !ID_RE.test(actor)) {
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
  private readonly events: KernelSessionEvent[] = [];
  private tick = 0;

  constructor(
    manifest: ProductManifest,
    host: KernelHost,
    initialEvents: KernelSessionEvent[],
    digest: KernelDigest,
  ) {
    this.manifest = manifest;
    this.host = host;
    this.digest = digest;
    this.entities = seedEntities(manifest);
    this.rarity =
      manifest.rarity === undefined
        ? undefined
        : {
            policy: manifest.rarity.policy,
            rolls: [...manifest.rarity.rolls],
            ...(manifest.rarity.providerEvidence === undefined
              ? {}
              : { providerEvidence: manifest.rarity.providerEvidence }),
          };
    this.events.push(...initialEvents);
  }

  dispatch(command: KernelCommand): void {
    const timestampMs = this.host.nowMs();
    if (!Number.isInteger(timestampMs)) {
      throw new KernelSessionError("host.nowMs must return an integer");
    }
    this.recordValidatedDispatch(validateCommand(command), timestampMs);
  }

  /**
   * Record a command `validateCommand` has already normalized. Returns false
   * when it was an accepted idempotent repeat and nothing was recorded.
   */
  recordValidatedDispatch(validated: KernelCommand, timestampMs: number): boolean {
    if (!Number.isInteger(timestampMs)) {
      throw new KernelSessionError("dispatch timestampMs must be an integer");
    }
    if (this.validateCommandState(validated)) return false;
    this.pending.push({ command: validated, timestampMs });
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
    const nextEntities = new Map(
      [...this.entities].map(([id, entity]) => [id, { ...entity }]),
    );
    const nextRarityRolls = this.rarity?.rolls.slice();
    for (const item of this.pending) {
      this.applyCommand(nextEntities, nextRarityRolls, item.command);
    }
    this.entities = nextEntities;
    if (this.rarity !== undefined && nextRarityRolls !== undefined) {
      this.rarity.rolls = nextRarityRolls;
    }
    this.pending.length = 0;
    this.tick = validatedClock.tick;
    this.events.push(
      Object.freeze({
        kind: "advance",
        clock: validatedClock,
      }),
    );
  }

  private validateCommandState(command: KernelCommand): boolean {
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
      const expectedEvidence = this.rarity.providerEvidence;
      if (
        (expectedEvidence === undefined) !== (command.providerEvidence === undefined) ||
        (expectedEvidence !== undefined &&
          command.providerEvidence !== undefined &&
          canonicalRarityJson(expectedEvidence as unknown as JsonValue) !==
            canonicalRarityJson(command.providerEvidence as unknown as JsonValue))
      ) {
        throw rarityError(
          RARITY_REFUSE_CODES.provenanceMismatch,
          `rarity.rolls.${command.eventId}.providerEvidence`,
          "A rarity roll command must carry the exact provider evidence bound to its namespace, or carry none when the namespace is evidence-less.",
        );
      }
      const prior =
        this.rarity.rolls.find((roll) => roll.eventId === command.eventId)?.request ??
        this.pending.find(
          (item): item is PendingDispatch & { readonly command: RarityRollCommand } =>
            item.command.type === "rarity-roll" &&
            item.command.eventId === command.eventId,
        )?.command.request;
      if (prior === undefined) return false;
      if (digestRarityRequest(prior) === digestRarityRequest(request.value)) return true;
      throw rarityError(
        RARITY_REFUSE_CODES.eventInputConflict,
        `rarity.rolls.${command.eventId}.request`,
        "An existing rarity event id cannot be reused with changed request bytes; reroll with a new event id.",
      );
    }
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
        },
        this.rarity.policy,
        command.request,
      );
      if (!resolved.ok) {
        throw rarityError(resolved.code, resolved.path, resolved.message);
      }
      rarityRolls.push(resolved.value.record);
    }
  }

  private rarityNamespace(): RarityNamespace | undefined {
    if (this.rarity === undefined) return undefined;
    return Object.freeze({
      schemaVersion: RARITY_SCHEMA_VERSION,
      kind: RARITY_NAMESPACE_KIND,
      policy: this.rarity.policy,
      rolls: Object.freeze([...this.rarity.rolls]),
      ...(this.rarity.providerEvidence === undefined
        ? {}
        : { providerEvidence: this.rarity.providerEvidence }),
    });
  }

  private currentManifest(rarity: RarityNamespace | undefined): ProductManifest {
    const base = {
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
    const digest = computeDigest(
      this.tick,
      this.manifest.seed,
      entities,
      rarity,
      this.digest,
    );
    return rarity === undefined
      ? Object.freeze({
          tick: this.tick,
          seed: this.manifest.seed,
          entities,
          digest,
        })
      : Object.freeze({
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
