/**
 * Frame-scheduled render loop for the Three presentation core.
 *
 * The scheduler is injected so a browser can pass `requestAnimationFrame` while
 * gates drive frames deterministically. The loop owns no renderer state: it only
 * calls back with elapsed time, so the presentation seam stays the single place
 * a frame is drawn.
 */
import { ThreePresentationError } from "./three-presentation-error.js";

export type FrameScheduler = {
  request(callback: (timeMs: number) => void): number;
  cancel(handle: number): void;
};

export type ThreeRenderLoopOptions = {
  /** Called once per scheduled frame with the elapsed time since the previous frame. */
  readonly onFrame: (deltaMs: number, timeMs: number) => void;
  /** Defaults to `requestAnimationFrame` when the host provides it. */
  readonly scheduler?: FrameScheduler;
};

export interface ThreeRenderLoop {
  running(): boolean;
  /** Frames delivered since creation. */
  frames(): number;
  start(): void;
  stop(): void;
}

type AnimationFrameHost = {
  requestAnimationFrame?: (callback: (timeMs: number) => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
};

/** Resolves the host `requestAnimationFrame` pair, or null when absent. */
export function hostAnimationFrameScheduler(): FrameScheduler | null {
  const host = globalThis as AnimationFrameHost;
  const request = host.requestAnimationFrame;
  const cancel = host.cancelAnimationFrame;
  if (typeof request !== "function" || typeof cancel !== "function") return null;
  return {
    request: (callback) => request.call(globalThis, callback),
    cancel: (handle) => {
      cancel.call(globalThis, handle);
    },
  };
}

/** Creates a stoppable frame loop; refuses when no scheduler is available. */
export function createThreeRenderLoop(
  options: ThreeRenderLoopOptions,
): ThreeRenderLoop {
  if (typeof options.onFrame !== "function") {
    throw new ThreePresentationError(
      "invalid-renderable",
      "createThreeRenderLoop requires an onFrame callback.",
    );
  }
  const resolved = options.scheduler ?? hostAnimationFrameScheduler();
  if (resolved === null) {
    throw new ThreePresentationError(
      "no-frame-scheduler",
      "No frame scheduler: pass options.scheduler on hosts without requestAnimationFrame.",
    );
  }
  const scheduler: FrameScheduler = resolved;

  let active = false;
  let handle: number | null = null;
  let lastTimeMs: number | null = null;
  let frames = 0;
  let generation = 0;

  function schedule(runGeneration: number) {
    try {
      const nextHandle = scheduler.request((timeMs) => {
        if (!active || generation !== runGeneration) return;
        handle = null;
        const deltaMs = lastTimeMs === null ? 0 : timeMs - lastTimeMs;
        lastTimeMs = timeMs;
        frames += 1;
        try {
          options.onFrame(deltaMs, timeMs);
        } catch (error) {
          if (generation === runGeneration) {
            active = false;
            lastTimeMs = null;
          }
          throw error;
        }
        if (active && generation === runGeneration) schedule(runGeneration);
      });
      if (active && generation === runGeneration) {
        handle = nextHandle;
      } else {
        scheduler.cancel(nextHandle);
      }
    } catch (error) {
      if (generation === runGeneration) {
        active = false;
        handle = null;
        lastTimeMs = null;
      }
      throw error;
    }
  }

  return {
    running() {
      return active;
    },

    frames() {
      return frames;
    },

    start() {
      if (active) return;
      active = true;
      lastTimeMs = null;
      generation += 1;
      schedule(generation);
    },

    stop() {
      active = false;
      generation += 1;
      if (handle !== null) scheduler.cancel(handle);
      handle = null;
      lastTimeMs = null;
    },
  };
}
