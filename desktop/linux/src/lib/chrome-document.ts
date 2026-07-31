/**
 * The document the packaged window loads: the Engine Desktop chrome, unforked.
 *
 * `@sceneaxi/desktop-shell` renders the accepted Engine Desktop editor chrome —
 * visual model, controls, refusals, inline behaviour script — and this module adds
 * exactly two things at build time: a runtime marker meta and one `<script>` tag
 * loading the bundled renderer-process viewport. The visual model is consumed,
 * never duplicated: no control, mode, refusal, or token is re-declared here, so the
 * chrome the desktop app ships is byte-derived from the one the shell owns.
 *
 * The chrome's `sceneaxi-pixels-drawn` meta stays `false` in the emitted document,
 * because at build time no pixels exist. The renderer viewport updates it at
 * runtime from the real presentation frame report — evidence, never assertion.
 *
 * Fail-closed: if the chrome loses either injection anchor, this throws rather
 * than emitting a window that silently lost its live viewport.
 */
import {
  createDesktopVisualState,
  desktopVisualView,
  renderDesktopChrome,
} from "@sceneaxi/desktop-shell";
import { PIXELS_META_NAME } from "./bridge-contract.js";

export { PIXELS_META_NAME };

/** Marker meta the desktop document carries so its runtime is inspectable. */
export const DESKTOP_RUNTIME_META = '<meta name="sceneaxi-desktop-runtime" content="electron">';

/** Relative script the packaged window loads beside the document. */
export const RENDERER_SCRIPT_TAG = '<script defer src="./renderer.js"></script>';

const PIXELS_META_ANCHOR = `<meta name="${PIXELS_META_NAME}" content="false">`;
const BODY_CLOSE_ANCHOR = "</body>";

export type DesktopIndexHtmlOptions = {
  readonly title?: string;
};

/**
 * Render the desktop application's index document.
 *
 * Deterministic for a fixed visual state: the default Engine Desktop state at the
 * shell's reference window, exactly what `sceneaxi-desktop chrome` emits.
 */
export function desktopLinuxIndexHtml(options: DesktopIndexHtmlOptions = {}): string {
  const view = desktopVisualView(createDesktopVisualState());
  const chrome = renderDesktopChrome(view, {
    title: options.title ?? "SceneAxi Engine Desktop",
  });

  if (!chrome.includes(PIXELS_META_ANCHOR)) {
    throw new Error(
      `desktop chrome document lost its '${PIXELS_META_NAME}' meta — refusing to emit a window without the honesty marker`,
    );
  }
  if (!chrome.includes(BODY_CLOSE_ANCHOR)) {
    throw new Error(
      "desktop chrome document lost its </body> anchor — refusing to emit a window without the live viewport script",
    );
  }

  return chrome
    .replace(PIXELS_META_ANCHOR, `${PIXELS_META_ANCHOR}\n${DESKTOP_RUNTIME_META}`)
    .replace(BODY_CLOSE_ANCHOR, `${RENDERER_SCRIPT_TAG}\n${BODY_CLOSE_ANCHOR}`);
}
