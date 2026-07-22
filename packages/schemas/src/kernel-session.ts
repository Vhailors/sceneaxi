/**
 * Kernel Session contract types — shared vocabulary for the Game Kernel
 * command/snapshot seam (ADR 0001 Design A). Durable save/replay shape is
 * versioned as contracts/kernel-session.schema.json.
 */

/** Major version of the Kernel Session contract (schema const). */
export const KERNEL_SESSION_SCHEMA_VERSION = 1 as const;

/** Product document used to open a kernel session. */
export interface ProductManifest {
  readonly productId: string;
  readonly seed: number;
  readonly entities?: ReadonlyArray<ProductEntitySeed>;
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
    };

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
  /** Opaque canonical digest used for determinism and replay checks. */
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
 * Save/replay artifact. Stamped with schema + kernel/BOM versions; major
 * schemaVersion mismatch on load refuses.
 */
export interface KernelSessionSaveArtifact {
  readonly schemaVersion: number;
  readonly kernelVersion: string;
  readonly bomVersion: string;
  readonly productManifest: ProductManifest;
  readonly events: ReadonlyArray<KernelSessionEvent>;
  readonly terminalDigest: string;
}
