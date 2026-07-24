import type {
  KernelSessionEvent,
  KernelSnapshot,
} from "@sceneaxi/engine-kernel";

export interface PresentationCaptureResult {
  readonly contentType: string;
  readonly bytes: Uint8Array;
}

/**
 * Backend-hidden Presentation Runtime seam from ADR 0002.
 *
 * A runtime consumes read-only kernel observations. It never receives the
 * kernel session itself, so presentation cannot dispatch commands or advance
 * authoritative simulation state.
 */
export interface PresentationRuntime {
  mount(): void;
  present(
    snapshot: KernelSnapshot,
    events: ReadonlyArray<KernelSessionEvent>,
    alpha: number,
  ): void;
  capture(): PresentationCaptureResult | null;
  dispose(): void;
}

export class PresentationRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PresentationRuntimeError";
  }
}

/**
 * Creates a lifecycle-real presenter with no renderer backend.
 *
 * Frames are intentionally ignored and capture is intentionally absent. This
 * lets kernel and end-to-end paths compose the public presentation seam while
 * Stage 1 remains responsible for choosing the real backend composition.
 */
export function createNullPresentationRuntime(): PresentationRuntime {
  let mounted = false;

  function requireMounted() {
    if (!mounted) {
      throw new PresentationRuntimeError("presentation runtime is not mounted");
    }
  }

  return {
    mount() {
      if (mounted) {
        throw new PresentationRuntimeError(
          "presentation runtime is already mounted",
        );
      }
      mounted = true;
    },

    present(snapshot, events, alpha) {
      requireMounted();
      void snapshot;
      void events;
      void alpha;
    },

    capture() {
      requireMounted();
      return null;
    },

    dispose() {
      requireMounted();
      mounted = false;
    },
  };
}
