/**
 * Copy for the entitled Minimum E2 editor's live viewport.
 *
 * Kept beside the brand rather than in JSX, and kept pure TypeScript, so the hermetic
 * gate type-checks and tests it like any other `src/lib/` module — the same treatment
 * `live-open.ts` gives the public path's copy.
 *
 * The core is named from `@sceneaxi/site-kit`'s shipped vocabulary rather than spelled
 * out here, so this surface cannot drift away from the label ADR 0017 requires.
 */
import { LIVE_OPEN_PRESENTATION } from "@sceneaxi/site-kit";

export const EDITOR_VIEWPORT_COPY = Object.freeze({
  lede: `Your composed scene, drawn in your browser by the ${LIVE_OPEN_PRESENTATION.coreLabel}. Drag to orbit, scroll to zoom.`,
  honesty:
    "The canvas draws the composition projection below and nothing else: the same instances, the same world transforms, and the same artifact the session composed on the server. Selection, transform edits, and play/pause/step are Minimum E2 session operations that run on the server; the viewport never advances a kernel session and invents no state of its own. The “Server session frame” panel below is the same core on its no-pixel surface, which is why it draws no pixels.",
  notComposable:
    "The composition pipeline refused these placements, so there is no composed scene to draw and no canvas is opened. The pipeline's own refusal is shown with the projection below.",
});
