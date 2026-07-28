/**
 * Foundations values the browser bundle has to restate, and the one that needs it.
 *
 * The WebGL clear colour is a value passed to the presentation core, not a custom
 * property the sheet can resolve, and the module that passes it is a `"use client"`
 * module — which may not value-import `@sceneaxi/site-kit`, because that barrel reaches
 * Node builtins. So the published hex is written once here and
 * `tests/sites/umbrella-visual.test.ts` pins it to `FOUNDATION_COLORS` from the
 * repository root, where naming the package is allowed. That is the same shape
 * `state-panel.tsx` uses for the status labels.
 *
 * Nothing in this file is a recorded gap: `UMBRELLA_RECORDED_GAPS` holds values the
 * design archive does not state, and every value here is one it does. Foundations names
 * `--bg-base` for exactly this role ("app background, viewport letterbox") and
 * `.viewport` already paints it in CSS behind the same canvas, so the letterbox and the
 * frame around it are one colour rather than two that happen to look close.
 */
export const UMBRELLA_RESTATED_FOUNDATION_COLORS = Object.freeze({
  "--bg-base": "#07080A",
} as const);

/** The fill the presentation core clears the canvas to. */
export const VIEWPORT_LETTERBOX = UMBRELLA_RESTATED_FOUNDATION_COLORS["--bg-base"];
