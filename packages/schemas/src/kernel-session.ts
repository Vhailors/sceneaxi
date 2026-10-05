/**
 * Kernel Session contract types — shared vocabulary for the Game Kernel
 * command/snapshot seam (ADR 0001 Design A). Durable save/replay shape is
 * versioned as contracts/kernel-session.schema.json.
 */
import type { ModelProviderCallEvidence } from "./model-provider.js";
import type { RarityNamespace, RarityRollRequest } from "./rarity.js";

/** Major version of the Kernel Session contract (schema const). */
export const KERNEL_SESSION_SCHEMA_VERSION = 1 as const;

export type GameplayEffect =
  | Readonly<{ kind: "add-state" | "set-state"; key: string; value: number }>
  | Readonly<{ kind: "move"; actor: string; axis: readonly [number, number] }>;

export type GameplayDefinition = Readonly<{
  profile: "game" | "web";
  initialState: Readonly<Record<string, number>>;
  actions: readonly Readonly<{ id: string; effects: readonly GameplayEffect[] }>[];
  timers: readonly Readonly<{ id: string; afterMs: number; repeatMs?: number; effects: readonly GameplayEffect[] }>[];
}>;

export type GameplayActionCommand = Readonly<{ type: "action"; actionId: string }>;

export type GameplaySnapshot = Readonly<{ state: Readonly<Record<string, number>>; elapsedMs: number; nextTimers: readonly Readonly<{ id: string; atMs: number | null }>[] }>;

/** Product document used to open a kernel session. */
export interface ProductManifest {
  readonly productId: string;
  readonly seed: number;
  readonly entities?: ReadonlyArray<ProductEntitySeed>;
  /** Project-owned deterministic rarity policy and accepted roll records. */
  readonly rarity?: RarityNamespace;
  readonly gameplay?: GameplayDefinition;
}

export interface ProductEntitySeed {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

/** Integer axis delta applied on the next advance. */
export type Axis2 = readonly [number, number];

/** Integer world position. */
export type Position2 = readonly [number, number];

/**
 * Validated command vocabulary for the tracer-bullet simulation domain
 * (entity transforms under move/spawn). Presentation/backend types are forbidden.
 */
export type RarityRollCommand = {
  readonly type: "rarity-roll";
  readonly eventId: string;
  readonly request: RarityRollRequest;
  readonly providerEvidence?: ModelProviderCallEvidence;
};

export type KernelCommand =
  | {
      readonly type: "move";
      readonly actor: string;
      readonly axis: Axis2;
    }
  | {
      readonly type: "spawn";
      readonly actor: string;
      readonly position: Position2;
    }
  | GameplayActionCommand
  | RarityRollCommand;

/** Frame clock passed to advance — only advance mutates authoritative state. */
export interface FrameClock {
  readonly tick: number;
  readonly deltaMs: number;
}

export interface SnapshotEntity {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

/**
 * Read-only observation of authoritative state. `digest` is the canonical
 * currency of determinism and replay testing.
 */
export interface KernelSnapshot {
  readonly tick: number;
  readonly seed: number;
  readonly entities: ReadonlyArray<SnapshotEntity>;
  /** Present only when the opened product manifest owns a rarity namespace. */
  readonly rarity?: RarityNamespace;
  /** Opaque canonical digest used for determinism and replay checks. */
  readonly gameplay?: GameplaySnapshot;
  readonly digest: string;
}

export type KernelSessionEvent =
  | {
      readonly kind: "dispatch";
      readonly command: KernelCommand;
      readonly timestampMs: number;
    }
  | {
      readonly kind: "advance";
      readonly clock: FrameClock;
    };

/**
 * Save/replay artifact. Stamped with schema + kernel/BOM versions; schemaVersion != 1 or engine/BOM major != 0 refuses. Unsupported engine/BOM
 * majors report KERNEL_VERSION_UNSUPPORTED; no cross-major migration exists.
 * Seeds/ticks/timestamps are safe integers; coordinates are within +/-1000000.
 * Delta is 0..60000ms; queues/entities 4096 and retained events 100000.
 */
export interface KernelSessionSaveArtifact {
  readonly schemaVersion: number;
  readonly kernelVersion: string;
  readonly bomVersion: string;
  readonly productManifest: ProductManifest;
  readonly events: ReadonlyArray<KernelSessionEvent>;
  readonly terminalDigest: string;
}
