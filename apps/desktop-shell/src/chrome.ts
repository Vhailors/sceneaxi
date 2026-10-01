/**
 * The Engine Desktop chrome is one self-contained document. The visual model
 * decides; these region builders draw, without network assets or a DOM runtime.
 * Controls retain their named refusals, and inventory comes only from the host.
 */
import {
  DESKTOP_ASSISTANT_RUNTIME_EVENT,
  DESKTOP_MINIMUM_WINDOW,
  DESKTOP_REFUSAL_MESSAGES,
  DESKTOP_VISUAL_REFUSALS,
  type DesktopVisualView,
} from "./visual-model.js";
import { VISUAL_SOURCE } from "./visual-tokens.js";
import { escapeHtml, profileRefusal } from "./chrome/core/markup.js";
import { styles } from "./chrome/core/styles.js";
import { script } from "./chrome/core/script.js";
import { titleBar, modeRail, statusBar } from "./chrome/frame/markup.js";
import { leftDock } from "./chrome/tree/markup.js";
import { viewport } from "./chrome/viewport/markup.js";
import { dock } from "./chrome/dock/markup.js";
import { inspector } from "./chrome/inspector/markup.js";
import { assistant } from "./chrome/assistant/markup.js";
import { overlays } from "./chrome/palette/markup.js";

export { escapeHtml } from "./chrome/core/markup.js";

export type DesktopChromeOptions = Readonly<{
  /** Document title. Defaults to the surface name. */
  title?: string;
}>;

/**
 * Render the chrome for one visual state as a complete HTML document.
 *
 * Below the minimum window tier the document contains the refusal and no
 * editor: the `.shell` is hidden by a media query at the same breakpoints the
 * model uses, so the refusal is one decision rendered twice rather than a CSS
 * rule and a TypeScript branch that could drift.
 */
export function renderDesktopChrome(
  view: DesktopVisualView,
  options: DesktopChromeOptions = {},
): string {
  const title = options.title ?? "SceneAxi — Engine Desktop";

  // The block is emitted in every document but `view.refusal` is non-null only
  // in the below-minimum render, so the fallback is what a browser actually
  // shows once the viewport crosses the breakpoint. It reads the same registry
  // and the same minimum the model refuses with, never a copy of them.
  const refusal = view.refusal ?? {
    code: DESKTOP_VISUAL_REFUSALS.windowBelowMinimum,
    message: DESKTOP_REFUSAL_MESSAGES[DESKTOP_VISUAL_REFUSALS.windowBelowMinimum],
    minimum: DESKTOP_MINIMUM_WINDOW,
  };

  return `<!doctype html>
<html lang="en" data-surface="engine-desktop">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="generator" content="@sceneaxi/desktop-shell chrome">
<meta name="sceneaxi-visual-source" content="${escapeHtml(`${VISUAL_SOURCE.member} · sha256 ${VISUAL_SOURCE.sha256}`)}">
<meta name="sceneaxi-pixels-drawn" content="false">
<title>${escapeHtml(title)}</title>
<style>${styles()}</style>
</head>
<body>
<div class="window-refusal" role="alert">
  <h1>Window below the minimum size</h1>
  <p>${escapeHtml(refusal.message)}</p>
  <p>Minimum: <code>${escapeHtml(`${refusal.minimum.width}×${refusal.minimum.height}`)}</code> · refusal <code>${escapeHtml(refusal.code)}</code></p>
</div>
<div class="shell" data-mode="${escapeHtml(view.state.mode)}" data-profile="${escapeHtml(view.state.profile)}" data-assistant="${escapeHtml(view.assistant.state)}" data-assistant-mode="${escapeHtml(view.state.assistantMode)}" data-assistant-route="${escapeHtml(view.state.assistantRoute)}" data-assistant-runtime="${escapeHtml(view.state.assistantRuntime)}" data-assistant-runtime-event="${escapeHtml(DESKTOP_ASSISTANT_RUNTIME_EVENT)}" data-assistant-busy="false" data-overlay="${escapeHtml(view.state.overlay ?? "none")}" data-tier="${escapeHtml(view.tier)}" data-details-open="${view.state.detailsOpen ? "true" : "false"}" data-drawer-left="closed" data-drawer-inspector="closed" data-drawer-assistant="closed">
${titleBar(view)}
<div class="shell-body">
${modeRail(view)}
${leftDock(view)}
<div class="viewport-column">
${viewport(view)}
${dock(view)}
</div>
${inspector(view)}
${profileRefusal(view)}
${assistant(view)}
</div>
${statusBar(view)}
${overlays(view)}
</div>
<script>${script(view)}</script>
</body>
</html>
`;
}
