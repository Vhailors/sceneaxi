/**
 * The umbrella's public live open path (ADR 0021).
 *
 * The site owns the viewport; `@sceneaxi/site-kit` owns what is opened. This module is
 * the join: it resolves the served scene and the honest presentation copy the page
 * renders, and it stays pure TypeScript — no React, no Next, no canvas — so the
 * hermetic gate type-checks and tests it like any other `src/lib/` module.
 *
 * Nothing here is entitled. The live open path is public: it carries no identity,
 * consumes no credits, and exposes no editing operation.
 */
import {
  LIVE_OPEN_INSTANCE_COUNT,
  LIVE_OPEN_PATH,
  LIVE_OPEN_PRESENTATION,
  liveOpenScene,
  type LiveOpenInstance,
  type LiveOpenScene,
  type SiteResult,
} from "@sceneaxi/site-kit";

export { LIVE_OPEN_INSTANCE_COUNT, LIVE_OPEN_PATH, LIVE_OPEN_PRESENTATION };
export type { LiveOpenInstance, LiveOpenScene };

/**
 * Headline copy for the live open path, kept beside the brand rather than in JSX.
 *
 * The instance count is read from site-kit rather than written into the sentence, so
 * changing the placement list can never ship copy that miscounts the served scene.
 */
export const LIVE_OPEN_COPY = Object.freeze({
  eyebrow: "Live open path · public",
  title: "Open a real SceneAxi artifact",
  lede: `This page reconstructs a committed Sculpt Artifact, places ${LIVE_OPEN_INSTANCE_COUNT} instances of it through the scene-composition pipeline, and draws the result in your browser with the Three presentation core. Drag to orbit, scroll to zoom.`,
  honesty:
    "The live frame report comes from the running presentation core. The composition pipeline supplies the scene digest, instance count, hierarchy, depths, and world transforms below; site-kit supplies the Role labels as placement annotations. None of this evidence is page-authored. A frame states which draw surface produced it, so a frame counter can never imply pixels that were never drawn.",
});

/**
 * The scene this deploy serves.
 *
 * A thin pass-through today, and deliberately so: the umbrella decides *where* the
 * viewport is, never *what* a scene contains.
 */
export function resolveLiveOpenScene(): SiteResult<LiveOpenScene> {
  return liveOpenScene();
}

/** A one-line placement summary per instance, for the page's scene table. */
export function describePlacement(instance: LiveOpenInstance): string {
  const [x, y, z] = instance.worldTransform.translation;
  return `world [${x}, ${y}, ${z}] · depth ${instance.depth}`;
}
