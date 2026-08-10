/**
 * The viewport's two playback decisions, separated from the DOM that carries them.
 *
 * Both are honesty rules rather than rendering details, so the gate executes them
 * instead of reading the viewport's source for a literal: what the pixels meta may
 * claim, and what counts as a playable exercise. Keeping them here also keeps the
 * meta from ever being written by anything but a frame that really reported.
 */
import type { SculptPresentationFrame } from "@sceneaxi/engine-presentation";
import { desktopMountablePayload } from "./viewport-playback.js";

/**
 * What the `sceneaxi-pixels-drawn` meta may be set to for this frame.
 *
 * `null` means "leave it alone": a frame that reported no `pixelsDrawn` is not
 * evidence of anything, and writing `"undefined"` — or keeping a stale `"true"`
 * by writing nothing while claiming otherwise — would both be inventions.
 */
export function pixelsMetaContent(frame: SculptPresentationFrame): string | null {
  return typeof frame.pixelsDrawn === "boolean" ? String(frame.pixelsDrawn) : null;
}

export type PlayableExercise = Readonly<{
  closed: true;
  initialDigest: string;
  tickDigests: readonly string[];
  mountable: unknown;
}>;

/**
 * The play event's payload, or `null` when it cannot be honoured.
 *
 * A viewport that drew from a half-valid exercise would acknowledge a playback it
 * never performed, so every field the acknowledgement line goes on to print is
 * checked here before a single mount happens.
 */
export function playableExercise(detail: unknown): PlayableExercise | null {
  if (detail === null || typeof detail !== "object") return null;
  const exercise = (detail as { readonly exercise?: unknown }).exercise;
  if (exercise === null || exercise === undefined || typeof exercise !== "object") return null;
  const candidate = exercise as {
    readonly closed?: unknown;
    readonly initialDigest?: unknown;
    readonly tickDigests?: unknown;
    readonly mountable?: unknown;
  };
  if (
    candidate.closed !== true ||
    typeof candidate.initialDigest !== "string" ||
    !Array.isArray(candidate.tickDigests) ||
    candidate.tickDigests.length === 0 ||
    !candidate.tickDigests.every((digest) => typeof digest === "string") ||
    !desktopMountablePayload(candidate.mountable)
  ) {
    return null;
  }
  return exercise as PlayableExercise;
}
