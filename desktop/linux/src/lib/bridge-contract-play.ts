import type { DesktopSceneResult } from "./desktop-scene.js";
import type { DesktopRarityEvidence } from "./bridge-contract-assistant.js";

export const DESKTOP_VIEWPORT_PLAY_EVENT = "sceneaxi:desktop-viewport-play";
export const DESKTOP_VIEWPORT_STOP_EVENT = "sceneaxi:desktop-viewport-stop";
export const DESKTOP_VIEWPORT_SCENE_OPEN_EVENT = "sceneaxi:desktop-viewport-scene-open";

/** Ticks the open-path exercise advances: enough to prove digests move. */
export const OPEN_PATH_EXERCISE_TICKS = 4;

/**
 * The accepted rarity namespace's own kernel evidence.
 *
 * It is reported beside the composed scene's, never in place of it: the product
 * session that verifies a rarity event carries the manifest's rarity namespace
 * and no entities, so its digests describe a different session from the one the
 * viewport draws. Folding them into the scene fields would make the Run report
 * claim the drawn scene advanced through digests it never produced.
 */
export type OpenPathRaritySession = {
  readonly bootstrap: unknown;
  readonly initialDigest: string;
  readonly tickDigests: readonly string[];
  readonly replayDigest: string;
};

export type OpenPathExercise = {
  readonly bootstrap: unknown;
  readonly initialDigest: string;
  readonly tickDigests: readonly string[];
  readonly instanceCount: number;
  readonly mountable: Extract<DesktopSceneResult, { readonly ok: true }>["mountable"];
  readonly closed: true;
  readonly rarity?: DesktopRarityEvidence;
  readonly raritySession?: OpenPathRaritySession;
};
