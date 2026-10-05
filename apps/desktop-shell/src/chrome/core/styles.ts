import { DESKTOP_MINIMUM_WINDOW, type DesktopVisualView } from "../../visual-model.js";
import {
  ACCENT,
  CHROME_RADIUS,
  ELEVATION,
  INERT,
  LINE,
  METRICS,
  MOTION_CUSTOM_PROPERTIES,
  MOTION_REDUCED_CUSTOM_PROPERTIES,
  SCRIM,
  SIGNAL,
  SPACING,
  SPACING_SCALE,
  SURFACE,
  TEXT,
  TYPE,
} from "../../visual-tokens.js";
import { atTierOrAbove, belowTier } from "./markup.js";
import { titleBarStyles, modeRailIndicatorStyles, modeRailStyles, statusBarStyles } from "../frame/styles.js";
import { settingsStyles } from "../settings/styles.js";
import { projectStyles, treeStyles, projectDetailStyles } from "../tree/styles.js";
import { assetStyles, dockStyles } from "../dock/styles.js";
import { inspectorStyles, webInspectorStyles } from "../inspector/styles.js";
import { viewportLayoutStyles, viewportStyles, viewportOverlayStyles } from "../viewport/styles.js";
import { assistantStyles } from "../assistant/styles.js";
import { paletteStyles } from "../palette/styles.js";

/** Row 9 stagger: item k waits min((k - 1) * step, max); item 6 and later share the cap. */
function staggerRules(selector: string): string {
  return [2, 3, 4, 5]
    .map((k) => `  ${selector}:nth-child(${k}){animation-delay:calc(${k - 1} * var(--motion-stagger-step))}`)
    .concat(`  ${selector}:nth-child(n+6){animation-delay:var(--motion-stagger-max)}`)
    .join("\n");
}

/** Contiguous slices retain the original cascade and every emitted byte. */
export function styles(view: DesktopVisualView): string {
  return reconcilePrivateChromeStyles(`
:root{
  --canvas:${SURFACE.canvas};--well:${SURFACE.well};--assistant:${SURFACE.assistant};
  --panel:${SURFACE.panel};--overlay:${SURFACE.overlay};--raised:${SURFACE.raised};
  --header:${SURFACE.header};--hover:${SURFACE.hover};--backdrop:${SURFACE.backdrop};
  --line:${LINE.strong};--line-card:${LINE.card};--line-row:${LINE.row};
  --line-control:${LINE.control};--line-raised:${LINE.raised};--line-hover:${LINE.hover};
  --accent:${ACCENT.base};--accent-hover:${ACCENT.hover};--on-accent:${ACCENT.on};
  --ok:${SIGNAL.ok};--refuse:${SIGNAL.refuse};--info:${SIGNAL.info};--scene:${SIGNAL.scene};
  --text:${TEXT.primary};--text-2:${TEXT.secondary};--text-3:${TEXT.label};
  --dim:${TEXT.dim};--faint:${TEXT.faint};
  --inert:${INERT.text};--inert-on-accent:${INERT.onAccent};--inert-glyph:${INERT.glyph};
  --rail:${METRICS.railWidth}px;--left:${METRICS.leftDockWidth}px;
  --inspector:${METRICS.inspectorWidth}px;--assistant-w:${METRICS.assistantWidth}px;
  --title-h:${METRICS.titleBarHeight}px;--tabs-h:${METRICS.viewTabsHeight}px;
  --status-h:${METRICS.statusBarHeight}px;
  --sans:${TYPE.sans};--mono:${TYPE.mono};
  --r-panel:${CHROME_RADIUS.panel}px;--r-card:${CHROME_RADIUS.card}px;--r-control:${CHROME_RADIUS.control}px;
  ${Object.entries(SPACING_SCALE).map(([name, px]) => `${name}:${px}px`).join(";")};
  --float:${ELEVATION.float};
  ${MOTION_CUSTOM_PROPERTIES.map(([name, value]) => `${name}:${value}`).join(";")};
}
::selection{background:${ACCENT.surface};color:var(--text)}
*{box-sizing:border-box}
/* Every hidden region here is an explicit model or runtime decision. */
[hidden]{display:none !important}
html,body{margin:0;padding:0;height:100%;overflow:hidden}
body{background:var(--backdrop);color:var(--text);font-family:var(--sans);font-size:13px;-webkit-font-smoothing:antialiased}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:var(--r-control)}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
:is(.ghost-button,.primary-button,.assistant-toggle,.profile-chip,.menu-item,.view-tab,.dock-tab){white-space:nowrap}
/* An inert control is dimmed by paint, never by element opacity: opacity
   composites the label toward whatever is behind it, and both the token gate and
   a browser's getComputedStyle read the declared colour, so that dimming was
   measured by nothing. --inert is the dimmest tier that still clears 4.5:1, so
   the refusal stays readable. The [aria-pressed]/[aria-selected] pair is here
   because an active tab or mode sets its own colour at a higher specificity. */
button.is-inert{cursor:not-allowed;color:var(--inert)}
button.is-inert[aria-pressed="true"],button.is-inert[aria-selected="true"]{color:var(--inert)}
button.is-inert .rail-glyph{border-color:var(--inert-glyph)}
:is(.ghost-button,.state-shortcut,.assistant-route,.assistant-manipulator,.assistant-toggle).is-inert{border-style:dashed}
button:disabled{cursor:not-allowed;color:var(--inert)}
/* Loading: the label stays; after --motion-delay-loading a 2px bar draws once
   along the bottom edge and holds while the work runs (DV-L1, DV-F8 in-band form). */
:is(button[aria-busy="true"],.shell[data-assistant-busy="true"] .assistant-composer .primary-button){position:relative;overflow:hidden;pointer-events:none}
:is(button[aria-busy="true"],.shell[data-assistant-busy="true"] .assistant-composer .primary-button)::before{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:currentColor;pointer-events:none;animation:ld-draw-from-start var(--motion-duration-route) var(--motion-ease-out-expo) var(--motion-delay-loading) backwards}
:is(.scene-property-input,.project-recent-select,.project-files select,.scene-parenting select,.assistant-prompt,.scene-catalog-editor textarea,.dock-tabpanel textarea,.dock-tabpanel input):not(.is-inert):not([aria-disabled="true"]):not(:disabled):hover{border-color:var(--line-hover)}
:is(.scene-property-input,.project-recent-select,.project-files select,.scene-parenting select,.assistant-prompt,.scene-catalog-editor textarea,.dock-tabpanel textarea,.dock-tabpanel input):focus-visible{border-color:var(--accent)}
.scene-property-input:user-invalid{border-color:var(--refuse)}
:is(.left-dock,.inspector,.dock-body,.assistant-body,.assistant-composer,.palette-list,.overlay-card,.change-diff)::-webkit-scrollbar{width:10px;height:10px}
:is(.left-dock,.inspector,.dock-body,.assistant-body,.assistant-composer,.palette-list,.overlay-card,.change-diff)::-webkit-scrollbar-thumb{background:var(--line-control);border:3px solid transparent;border-radius:6px;background-clip:padding-box}
:is(.left-dock,.inspector,.dock-body,.assistant-body,.assistant-composer,.palette-list,.overlay-card,.change-diff)::-webkit-scrollbar-thumb:hover{background-color:var(--line-hover)}
:is(.left-dock,.inspector,.dock-body,.assistant-body,.assistant-composer,.palette-list,.overlay-card,.change-diff)::-webkit-scrollbar-track{background:transparent}
code,kbd{font-family:var(--mono);font-size:max(11px,.86em)}

.shell{display:grid;grid-template-rows:var(--title-h) 1fr var(--status-h);height:100dvh;min-height:100dvh;background:var(--canvas);position:relative;overflow:hidden}
/* A denied assistant keeps its column: the archive shows the Kids lock screen
   there, and hiding it would turn a named refusal into an absent panel. Only a
   closed assistant removes the column. */
.shell-body{display:grid;grid-template-columns:var(--rail) var(--left) minmax(0,1fr) var(--inspector) var(--assistant-w);min-height:0}
.shell[data-assistant="closed"] .shell-body{grid-template-columns:var(--rail) var(--left) minmax(0,1fr) var(--inspector)}
.shell[data-assistant="closed"] .assistant{display:none}

${titleBarStyles()}
.ghost-button{display:flex;align-items:center;gap:var(--space-2);height:24px;padding:0 var(--space-3);border-radius:var(--r-control);background:var(--header);border:1px solid var(--line-control);font-size:12px;color:var(--dim)}
.ghost-button:hover{border-color:var(--line-hover);color:var(--text)}
/* A single-class :hover outranks button.is-inert, so every control class whose
   hover repaints its label has to say what the inert one does under the pointer
   — otherwise an inert control becomes indistinguishable from a live one there,
   which is the same dimmed-by-nothing state the paint rule above replaced. */
.ghost-button.is-inert:hover{border-color:var(--line-control);color:var(--inert)}
.ghost-button kbd{background:var(--well);border:1px solid var(--line-control);border-radius:3px;padding:0 4px;color:var(--faint)}
.primary-button{background:var(--accent);color:var(--on-accent);font-weight:600;font-size:12px;border-radius:var(--r-control);height:24px;padding:0 var(--space-3)}
.primary-button:hover{background:var(--accent-hover)}
/* The accent fill stays and only the mark on it is demoted: --inert on orange is
   1.29:1, and the fill is what says which control this is. --inert-on-accent is
   5.72:1 there against the live 7.05:1. */
.primary-button.is-inert,.primary-button.is-inert:hover{color:var(--inert-on-accent)}
/* Disabled is painted: the inert primary takes the dashed edge inert ghosts carry, inside its fill. The focus ring still wins. */
.primary-button.is-inert:not(:focus-visible){outline:1px dashed var(--inert-on-accent);outline-offset:-3px;cursor:not-allowed}
.primary-button.is-inert:hover{background:var(--accent)}
.block-button{width:100%;height:32px;font-size:12px;margin-top:var(--space-2)}
.assistant-toggle{display:flex;align-items:center;gap:var(--space-2);height:24px;padding:0 var(--space-3);border-radius:var(--r-control);font-size:12px;font-weight:500;background:var(--header);border:1px solid var(--line-control);color:var(--dim)}
/* Where the assistant is docked the toggle reads the column's own state; below
   that tier the drawer rule takes over. Which one applies is a stylesheet
   decision on the two complementary media conditions rather than an attribute
   chosen at render time, because the document can be opened at a viewport the
   render never saw and the toggle must never light up over a column that
   viewport does not show. */
@media ${atTierOrAbove("regular")}{
  .shell[data-assistant="open"] .assistant-toggle{background:${ACCENT.surface};border-color:${ACCENT.line};color:var(--accent)}
  .shell[data-assistant="open"] [data-assistant-dot]{background:var(--accent)}
  /* A pressed toggle still answers the pointer: pressing it closes the column. */
  .shell[data-assistant="open"] .assistant-toggle:not(.is-inert):hover{border-color:var(--accent);color:var(--text)}
}
.shell[data-assistant="denied"] [data-assistant-dot]{background:var(--scene)}

${modeRailStyles()}

.left-dock,.inspector{background:var(--panel);display:flex;flex-direction:column;min-height:0;overflow-y:auto}
.left-dock{border-right:1px solid var(--line)}
.inspector{border-left:1px solid var(--line)}
${settingsStyles()}
.panel-head{margin:0;height:29px;flex:none;display:flex;align-items:center;padding:0 10px;background:var(--header);border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-family:var(--mono);font-size:9px;font-weight:400;letter-spacing:.15em;color:var(--text-3)}
.panel-empty{margin:0;padding:12px 11px;font-size:11px;line-height:1.55;color:var(--dim)}
.panel-note{display:flex;gap:var(--space-2);align-items:flex-start;margin:0 var(--space-2) var(--space-3);padding:var(--space-2) var(--space-3);border:1px solid;border-radius:6px;font-size:12px;line-height:1.55}
.panel-note .dot{margin-top:var(--space-2)}
${projectStyles()}
${assetStyles()}
${treeStyles()}
${inspectorStyles()}

${viewportLayoutStyles()}
.shell[data-profile="web"] .profile-surface[data-profile-surface="web"]{min-height:88px;grid-template-columns:140px minmax(0,1.4fr)}
.shell[data-profile="web"] .mode-rail,
.shell[data-profile="web"] .scene-entities,
.shell[data-profile="web"] .scene-property-editor,
.shell[data-profile="web"] .inspector-panel,
.shell[data-profile="web"] .project-browser-detail,
.shell[data-profile="web"] .view-tabs,
.shell[data-profile="web"] .axis-widget,
.shell[data-profile="web"] .assistant-manipulators,
.shell[data-profile="web"] .sculpt-progress,
.shell[data-profile="web"] .game-runtime-note,
.shell[data-profile="game"] .site-page-tail,
.shell[data-profile="game"] .assistant-empty-web,
.shell[data-profile="game"] .assistant-foot-web,
.shell[data-profile="web"] .assistant-empty-game,
.shell[data-profile="web"] .assistant-foot-game,
.shell[data-profile="kids"] .assistant-empty-web,
.shell[data-profile="kids"] .assistant-foot-web{display:none}
.shell[data-profile="web"] [data-files-title]{font-size:0}
.shell[data-profile="web"] [data-files-title]::after{content:"Pages";font-size:11px;letter-spacing:.08em}
.shell[data-profile="web"] .profile-runtime-actions .primary-button{font-size:0}
.shell[data-profile="web"] .profile-runtime-actions .primary-button::after{content:"Preview";font-size:12px;font-weight:600}
${viewportStyles()}
.shell[data-profile="web"] .shell-body{grid-template-columns:var(--left) minmax(0,1fr) var(--inspector) var(--assistant-w)}
.shell[data-profile="web"] .profile-surfaces{background:transparent;border:0}
.shell[data-profile="web"] .viewport{flex:none;height:min(46vh,420px);min-height:220px;border:1px solid var(--line);border-top:0;border-radius:0 0 10px 10px}
.shell[data-profile="web"] .viewport-note-inert,.shell[data-profile="game"] .viewport-note-web{display:none}
.shell[data-profile="web"] .viewport-note-web{display:block;position:relative;z-index:2;max-width:36ch}
${webInspectorStyles()}
${viewportOverlayStyles()}

${dockStyles()}

${assistantStyles()}

/* Kids: one refusal region replaces the whole editor body, so the grid drops to
   rail + body + assistant. */
.shell[data-profile="kids"] .shell-body{grid-template-columns:var(--rail) minmax(0,1fr) var(--assistant-w)}
.shell[data-profile="kids"] .left-dock,
.shell[data-profile="kids"] .viewport-column,
.shell[data-profile="kids"] .inspector{display:none}
.profile-refusal{display:none;place-items:center;padding:var(--space-8);background:var(--canvas);min-width:0}
.shell[data-profile="kids"] .profile-refusal{display:grid}
.shell[data-profile="kids"]{--accent:${SIGNAL.scene};--on-accent:${SIGNAL.sceneSurface}}
.profile-refusal-card{max-width:46ch;text-align:center;background:${SIGNAL.sceneSurface};border:1px solid ${SIGNAL.sceneLine};border-radius:var(--r-panel);padding:var(--space-8) var(--space-8) var(--space-6)}
.profile-refusal-card h2{margin:var(--space-4) 0 var(--space-3);font-size:22px;line-height:1.2;color:${SIGNAL.sceneText};text-wrap:balance}
.profile-refusal-card p{margin:0 0 var(--space-3);font-size:13px;line-height:1.65;color:${SIGNAL.sceneText}}
.kids-studio-mark{display:grid;place-items:center;width:44px;height:44px;margin:0 auto;border-radius:var(--r-card);background:${SIGNAL.scene};color:${SIGNAL.sceneSurface};font-size:20px}
.profile-refusal-code{display:none}
.shell[data-details-open="true"] .profile-refusal-code{display:block}
.profile-refusal-code code{color:var(--scene)}
.profile-refusal-foot{color:var(--dim) !important}
.mark-scene{background:${SIGNAL.sceneSurface};border:1px solid ${SIGNAL.sceneLine};color:${SIGNAL.scene};margin:0 auto}
${projectDetailStyles()}

${statusBarStyles()}

.overlay{position:absolute;inset:0;background:${SCRIM.overlay};display:grid;place-items:center;z-index:50;padding:24px}
.overlay-card{width:min(620px,100%);max-height:80%;overflow:auto;background:var(--overlay);border:1px solid var(--line-raised);border-radius:var(--r-card);box-shadow:var(--float)}
.overlay-card.overlay-refused{border-color:${SIGNAL.refuseLine}}
.overlay-head{display:flex;align-items:center;gap:var(--space-3);padding:var(--space-4) var(--space-6);border-bottom:1px solid var(--line)}
.overlay-head h2{margin:0;flex:1;font-size:15px;font-weight:600;text-wrap:balance}
.overlay-mark{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:700;flex:none}
.mark-refuse{background:${SIGNAL.refuseSurface};border:1px solid ${SIGNAL.refuseLine};color:var(--refuse)}
.mark-complete{background:${SIGNAL.infoSurface};border:1px solid ${SIGNAL.infoLine};color:var(--info)}
.overlay-body{margin:0;padding:15px 18px;font-size:12px;line-height:1.6;color:var(--text-2)}
.overlay-actions{display:flex;gap:var(--space-2);justify-content:flex-end;padding:var(--space-3) var(--space-6);background:var(--well);border-top:1px solid var(--line)}
.overlay-actions .primary-button,.overlay-actions .ghost-button{height:32px;padding:0 var(--space-4);font-size:12px}
${paletteStyles()}
.overlay-foot{margin:0;padding:var(--space-3) var(--space-6);background:var(--well);border-top:1px solid var(--line);font-size:12px;line-height:1.5;color:var(--dim)}

.refusal-help-toggle[aria-expanded="true"]{border-color:var(--line-hover);color:var(--text)}
.refusal-legend-panel{position:absolute;right:8px;bottom:calc(100% + 8px);z-index:45;width:min(520px,calc(100vw - 16px));max-height:min(360px,calc(100dvh - var(--title-h) - var(--status-h) - 24px));overflow:auto;padding:10px 12px;background:var(--overlay);border:1px solid var(--line-raised);border-radius:8px;box-shadow:var(--float)}
.refusal-legend-panel h2{margin:0 0 var(--space-2);font-size:13px;font-weight:600;color:var(--text)}
.refusal-row{margin:0 0 var(--space-2);font-size:12px;line-height:1.5;color:var(--dim);overflow-wrap:anywhere}
.refusal-row code{color:var(--accent);margin-right:8px}

.window-refusal{display:none;max-width:52ch;margin:0 auto;padding:48px 24px;text-align:center}
.window-refusal h1{font-size:17px;margin:0 0 12px}
.window-refusal p{font-size:13px;line-height:1.65;color:var(--dim);margin:0 0 var(--space-2)}
.window-refusal code{color:var(--accent)}

/* Motion (DIRECTION.md section 6): one-shot keyframes keyed on existing state
   attributes; opacity only inside keyframes; translate/clip-path/filter only;
   never scale. Anything shown by [hidden] enters here and leaves at once. */
@keyframes ld-rise-sm{from{opacity:0;translate:0 var(--motion-distance-sm)}to{opacity:1;translate:0 0}}
@keyframes ld-rise-md{from{opacity:0;translate:0 var(--motion-distance-md)}to{opacity:1;translate:0 0}}
@keyframes ld-drop{from{opacity:0;translate:0 calc(-1 * var(--motion-distance-sm))}to{opacity:1;translate:0 0}}
@keyframes ld-fade{from{opacity:0}to{opacity:1}}
@keyframes ld-dialog{from{opacity:0;translate:0 var(--motion-distance-md);clip-path:inset(0 0 var(--motion-distance-md) 0 round var(--r-card))}to{opacity:1;translate:0 0;clip-path:inset(-24px round var(--r-card))}}
@keyframes ld-in-left{from{opacity:0;translate:calc(-1 * var(--motion-distance-lg)) 0}to{opacity:1;translate:0 0}}
@keyframes ld-in-right{from{opacity:0;translate:var(--motion-distance-lg) 0}to{opacity:1;translate:0 0}}
@keyframes ld-draw-x{from{clip-path:inset(0 50% 0 50%)}to{clip-path:inset(0)}}
@keyframes ld-draw-from-start{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0)}}
@keyframes ld-aperture{from{clip-path:inset(48% 0 48% 0)}to{clip-path:inset(0)}}
@keyframes ld-ring{from{opacity:1;clip-path:circle(25% at 50% 50%)}to{opacity:0;clip-path:circle(75% at 50% 50%)}}
@keyframes ld-settle{from{filter:brightness(1.4)}to{filter:brightness(1)}}
@keyframes sweep{0%{transform:translateX(-108px)}100%{transform:translateX(338px)}}
@keyframes assistant-breathe{0%,100%{opacity:1}50%{opacity:.62}}
@keyframes assistant-spin{to{transform:rotate(225deg)}}
@keyframes assistant-bars{0%,100%{opacity:.4}50%{opacity:1}}
@keyframes assistant-dot{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:1;transform:translateY(-2px)}}
@keyframes assistant-card{0%,100%{box-shadow:0 0 0 0 ${ACCENT.surface}}50%{box-shadow:0 0 0 4px ${ACCENT.surface}}}
@keyframes assistant-glow{0%,100%{opacity:.18}50%{opacity:.4}}

${modeRailIndicatorStyles(view.modes)}

@media (prefers-reduced-motion:no-preference){
  .menu-panel:not([hidden]){animation:ld-drop var(--motion-duration-state) var(--motion-ease-out-expo) backwards}
  .refusal-legend-panel:not([hidden]){animation:ld-rise-sm var(--motion-duration-state) var(--motion-ease-out-expo) backwards}
  .overlay:not([hidden]){animation:ld-fade var(--motion-duration-panel) var(--motion-ease-out-expo) backwards}
  .overlay:not([hidden]) .overlay-card{animation:ld-dialog var(--motion-duration-panel) var(--motion-ease-out-expo) backwards}
  .overlay:not([hidden]) .palette-group{animation:ld-rise-sm var(--motion-duration-panel) var(--motion-ease-out-expo) backwards}
${staggerRules(".overlay:not([hidden]) .palette-group")}
  :is(.dock-tabpanel,.dock-panel,.inspector-panel):not([hidden]){animation:ld-rise-sm var(--motion-duration-panel) var(--motion-ease-out-expo) backwards}
  :is(.scene-entities,.project-bound,.project-browser-detail,.change-proposal,.scene-property-editor,.assistant-manipulators,.assistant-thinking,.assistant-retry,.editor-command-form):not([hidden]){animation:ld-rise-sm var(--motion-duration-state) var(--motion-ease-out-quint) backwards}
  .shell[data-details-open="true"] :is(.scene-entity-identity dl,.scene-advanced,.assistant-routes){animation:ld-rise-sm var(--motion-duration-state) var(--motion-ease-out-quint) backwards}
  :is(.scene-entity-identity.is-selected,.scene-entity[aria-pressed="true"],.profile-chip[aria-pressed="true"],.assistant-route[aria-pressed="true"]){animation:ld-settle var(--motion-duration-state) var(--motion-ease-out-quint)}
  :is(.view-tab,.dock-tab)[aria-selected="true"]::after{animation:ld-draw-x var(--motion-duration-panel) var(--motion-ease-out-expo) backwards}
  .assistant{animation:ld-in-right var(--motion-duration-panel) var(--motion-ease-out-expo) backwards}
  .shell::after{animation:ld-fade var(--motion-duration-panel) var(--motion-ease-out-expo) backwards}
  .profile-surface,.profile-refusal-card,.assistant-denied{animation:ld-rise-md var(--motion-duration-panel) var(--motion-ease-out-expo) backwards}
  .viewport p[data-live-viewport]{animation:ld-rise-sm var(--motion-duration-state) var(--motion-ease-out-quint) backwards}
  .viewport canvas{animation:ld-fade var(--motion-duration-route) var(--motion-ease-out-expo) backwards}
  .shell[data-mode="run"] .viewport::after{animation:ld-aperture var(--motion-duration-route) var(--motion-ease-out-expo) backwards}
  .shell[data-mode="run"] .profile-runtime-actions .primary-button{position:relative}
  .shell[data-mode="run"] .profile-runtime-actions .primary-button::before{content:"";position:absolute;inset:-4px;border:2px solid var(--accent);border-radius:calc(var(--r-control) + 4px);pointer-events:none;animation:ld-ring var(--motion-duration-panel) var(--motion-ease-out-expo) both}
  .window-refusal{animation:ld-rise-md var(--motion-duration-panel) var(--motion-ease-out-expo) backwards}
}

/* Compact: the assistant leaves the grid and becomes an overlay drawer. Its
   existing toggle opens and closes it, so nothing becomes unreachable. */
@media ${belowTier("regular")}{
  .shell-body,.shell[data-assistant="closed"] .shell-body,.shell[data-profile="kids"] .shell-body{grid-template-columns:var(--rail) var(--left) minmax(0,1fr) var(--inspector)}
  .shell[data-profile="kids"] .shell-body{grid-template-columns:var(--rail) minmax(0,1fr)}
  .assistant{position:absolute;top:var(--title-h);bottom:var(--status-h);right:0;width:min(var(--assistant-w),100%);z-index:40;box-shadow:var(--float)}
  /* An undocked assistant starts closed: a drawer nobody opened must not sit
     on top of the panel it undocked from. Its toggle still opens it. The
     emitted bytes always carry a closed drawer, so this holds at every viewport
     the document is opened at, script or no script. */
  .shell:not([data-drawer-assistant="open"]) .assistant{display:none}
  /* And the toggle follows the drawer here, not the column state: an open
     column that is not on screen must not leave the toggle lit. */
  .shell[data-drawer-assistant="open"] .assistant-toggle{background:${ACCENT.surface};border-color:${ACCENT.line};color:var(--accent)}
  .shell[data-drawer-assistant="open"] [data-assistant-dot]{background:var(--accent)}
  /* Except a denied one, which never becomes a drawer at all. Its body is the
     Kids lock screen — a named refusal — and the only control that could open a
     drawer is the toggle that same refusal makes inert, so undocking it would
     leave THIRD_PARTY_LLM_DENIED_BY_DEFAULT on no reachable surface. It keeps a
     real column at every tier instead. */
  .shell[data-assistant="denied"] .shell-body{grid-template-columns:var(--rail) var(--left) minmax(0,1fr) var(--inspector) var(--assistant-w)}
  .shell[data-profile="kids"][data-assistant="denied"] .shell-body{grid-template-columns:var(--rail) minmax(0,1fr) var(--assistant-w)}
  .shell[data-assistant="denied"] .assistant{position:static;display:flex;width:auto;box-shadow:none}
  /* An open drawer lays the content it covers behind a scrim (row 7). The scrim takes
     no pointer: the drawer is not modal, and its own toggle still closes it. */
  .shell[data-drawer-assistant="open"]:not([data-assistant="denied"])::after{content:"";position:absolute;top:var(--title-h);bottom:var(--status-h);left:0;right:0;z-index:34;background:${SCRIM.overlay};pointer-events:none}
}
/* Narrow: the left dock and the inspector become drawers too, and the two
   title-bar toggles that open them appear. They start closed, because a drawer
   nobody opened should not be covering the viewport. */
@media ${belowTier("compact")}{
  .shell-body,.shell[data-assistant="closed"] .shell-body,.shell[data-profile="kids"] .shell-body{grid-template-columns:var(--rail) minmax(0,1fr)}
  .title-actions .drawer-toggle{display:inline-flex}
  .title-centre,.menu-bar{display:none}
  .left-dock,.inspector{position:absolute;top:var(--title-h);bottom:var(--status-h);z-index:35;box-shadow:var(--float)}
  .shell[data-drawer-left="open"] .left-dock{animation:ld-in-left var(--motion-duration-panel) var(--motion-ease-out-expo) backwards}
  .shell[data-drawer-inspector="open"] .inspector{animation:ld-in-right var(--motion-duration-panel) var(--motion-ease-out-expo) backwards}
  .left-dock{left:var(--rail);width:min(var(--left),calc(100% - var(--rail)))}
  .inspector{right:0;width:min(var(--inspector),100%)}
  .shell:not([data-drawer-left="open"]) .left-dock{display:none}
  .shell:not([data-drawer-inspector="open"]) .inspector{display:none}
  .change-proposal{grid-template-columns:minmax(0,1fr) auto}
  .change-meta{grid-column:1/-1}
  .profile-surface{grid-template-columns:120px minmax(0,1fr);min-height:76px}
  .profile-surface .capability-list,.game-runtime-note{display:none}
  .runtime-report{display:none}
  .shell[data-assistant="denied"] .shell-body,.shell[data-profile="kids"][data-assistant="denied"] .shell-body{grid-template-columns:var(--rail) minmax(0,1fr) var(--assistant-w)}
  .shell[data-profile="web"] .shell-body,.shell[data-profile="web"][data-assistant="closed"] .shell-body{grid-template-columns:minmax(0,1fr)}
  .shell[data-profile="web"] .left-dock{left:0}
  .shell[data-drawer-left="open"]::after{content:"";position:absolute;top:var(--title-h);bottom:var(--status-h);left:0;right:0;z-index:34;background:${SCRIM.overlay};pointer-events:none}
  .shell[data-drawer-inspector="open"]::after{content:"";position:absolute;top:var(--title-h);bottom:var(--status-h);left:0;right:0;z-index:34;background:${SCRIM.overlay};pointer-events:none}
}
/* Below the declared minimum the chrome refuses instead of laying out. The
   breakpoints are interpolated from DESKTOP_MINIMUM_WINDOW, so the CSS and the
   model refuse at exactly the same size and cannot be raised apart. */
@media (max-width:${DESKTOP_MINIMUM_WINDOW.width - 1}px),(max-height:${DESKTOP_MINIMUM_WINDOW.height - 1}px){
  .shell{display:none}
  /* Keep the named refusal visible even if a later refinement repeats its base rule. */
  .window-refusal.window-refusal{display:block}
}

@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.001ms !important;animation-iteration-count:1 !important;transition-duration:.001ms !important}
  :root{${MOTION_REDUCED_CUSTOM_PROPERTIES.map(([name, value]) => `${name}:${value}`).join(";")}}
  .sculpt-sweep,.assistant-live{display:none}
  :is(button[aria-busy="true"],.shell[data-assistant-busy="true"] .assistant-composer .primary-button)::before{animation:none;right:60%}
}

/* Private source usability additions, after canonical regional cascade. */
  --space-1:${SPACING.unit}px;--space-2:${SPACING.small}px;--space-3:${SPACING.medium}px;
  --space-4:${SPACING.large}px;--space-6:${SPACING.section}px;
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:var(--r-control);box-shadow:0 0 0 4px var(--well)}
.view-tab:focus-visible,.dock-tab:focus-visible,.rail-mode:focus-visible{outline-offset:-3px;box-shadow:none}
/* Rings remain inside clipped listboxes and popovers; filled controls retain the well halo. */
:is(.menu-command,.project-files select,.project-recent-select,.assistant-route,.assistant-manipulator):focus-visible{outline-offset:-3px;box-shadow:none}
:is(button,input,select,textarea,a[href],[tabindex]):focus-visible{scroll-margin:var(--space-3)}
@media (forced-colors:active){:focus-visible{outline:2px solid Highlight;outline-offset:-2px;box-shadow:none}button[aria-pressed="true"],button[aria-selected="true"]{border:1px solid Highlight}}
:is(.menu-item,.profile-chip,.icon-button,.assistant-toggle,.assistant-mode):not(.is-inert):not([aria-pressed="true"]):hover{background:var(--hover);color:var(--text)}
button:not(.is-inert):not(:disabled):not([aria-disabled="true"]):active{box-shadow:inset 0 0 0 2px var(--line-hover)}
button:not(.is-inert):not(:disabled):not([aria-disabled="true"]):active:focus-visible{box-shadow:0 0 0 4px var(--well),inset 0 0 0 2px var(--line-hover)}
:is(.left-dock,.inspector,.dock-body,.assistant-body,.assistant-composer,.palette-list,.overlay-card){scrollbar-gutter:stable;scroll-padding:var(--space-3)}
/* Intrinsic section heights contribute to the inspector's scroll extent. */
.inspector > section{flex-shrink:0;min-width:0}
/* Catalogue textareas must not share an inline baseline with Stage: native
   multiline controls otherwise paint below the label's line box at the scroll edge. */
.scene-catalog-editor{display:grid;gap:var(--space-2);min-width:0;padding:var(--space-3)}
.scene-catalog-editor label{display:grid;gap:var(--space-1);min-width:0}
.scene-catalog-editor textarea{display:block;width:100%;min-width:0;resize:vertical}
.scene-catalog-editor button{justify-self:start}
.scene-catalog-editor pre{min-width:0;white-space:pre-wrap;overflow-wrap:anywhere}
.panel-head{margin:0;height:32px;flex:none;display:flex;align-items:center;padding:0 var(--space-3);background:var(--header);border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-family:var(--mono);font-size:11px;font-weight:500;letter-spacing:.08em;color:var(--text-3)}
.panel-empty{margin:var(--space-2);padding:var(--space-3);border:1px dashed var(--line-control);border-radius:var(--r-control);background:var(--well);font-size:12px;line-height:1.65;color:var(--dim);overflow-wrap:anywhere}
.panel-empty[aria-live]{border-style:solid;border-color:var(--line-control);background:var(--panel)}
.project-launcher{display:grid;gap:var(--space-2);padding:var(--space-3);border-bottom:1px solid var(--line)}
.project-launcher p,.project-root{margin:0;color:var(--dim);font-size:12px;line-height:1.6;overflow-wrap:anywhere}
.project-recent-label{font-size:11px;color:var(--faint)}
.project-browser-detail dl{display:grid;gap:var(--space-2);margin:var(--space-3) 0}
.project-browser-detail dt{font-size:11px;color:var(--faint)}
.project-browser-detail dd{margin:0;min-width:0;overflow-wrap:anywhere;font-family:var(--mono);font-size:11px;line-height:1.6;color:var(--dim);font-variant-numeric:tabular-nums}
.asset-browser-card span{margin-top:var(--space-1);font-family:var(--mono);font-size:10px;line-height:1.6;color:var(--dim);font-variant-numeric:tabular-nums;user-select:text}
.scene-entities{padding:0 var(--space-2) var(--space-3)}
/* The canonical multi-select remains a keyboard control, not an invisible focus stop. */
.scene-entities select:focus-visible{position:static;width:100%;height:auto;min-height:96px;padding:var(--space-2);margin:0;overflow:auto;clip:auto;white-space:normal;border:1px solid var(--line-card)}
.scene-entity-identities{display:grid;gap:2px;min-width:0;margin:var(--space-2) 0 0;padding:0;list-style:none}
.scene-entity-identity{min-width:0;margin-left:calc(var(--scene-depth,0) * var(--space-3));padding:var(--space-2) var(--space-3);border:1px solid var(--line-card);border-left:2px solid var(--line-card);background:var(--well);cursor:pointer}
.scene-entity-identity:focus-visible{outline-offset:-3px;box-shadow:none}
.scene-entity-identity>span{display:block;margin-bottom:var(--space-1);font-size:12px;line-height:1.5;font-weight:600;color:var(--text);overflow-wrap:anywhere}
.scene-entity-identity dl{display:none;gap:var(--space-1);margin:var(--space-2) 0 0}
.scene-entity-identity dl div{display:grid;grid-template-columns:56px minmax(0,1fr);gap:var(--space-2);min-width:0;padding:var(--space-1) 0;border-top:1px solid var(--line-row)}
.scene-entity-identity dt{font-size:11px;line-height:1.6;color:var(--faint)}
.scene-entity-identity code{display:block;min-width:0;font-size:10px;line-height:1.6;color:var(--dim);white-space:normal;overflow-wrap:anywhere;font-variant-numeric:tabular-nums;user-select:text}
.scene-property-input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.scene-property-input.is-inert{color:var(--inert)}
.scene-property-review{max-height:150px;margin:0;padding:var(--space-2);overflow:auto;border:1px solid var(--line);border-radius:6px;background:var(--well);color:var(--dim);font-family:var(--mono);font-size:11px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
.pass-row{display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-3);background:var(--raised);border:1px solid var(--line);border-radius:4px;min-width:0}
.pass-row>div{min-width:0;overflow-wrap:anywhere}
.pass-row:nth-child(even){background:var(--well)}
.viewport-backdrop{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 0 1px var(--line-row)}
.change-empty{margin:auto;padding:var(--space-6) var(--space-4);max-width:52ch;text-align:center;font-size:13px;line-height:1.65;color:var(--dim)}
.change-empty::before{content:"";display:block;width:24px;height:24px;margin:0 auto var(--space-3);border:1px solid var(--line-hover);border-radius:6px;background:var(--raised)}
.assistant-head{height:40px;flex:none;display:flex;align-items:center;gap:var(--space-2);padding:0 var(--space-3);background:var(--raised);border-bottom:1px solid var(--line)}
/* One live-bars signal confirms work; the canvas and labels stay visually still. */
.shell[data-assistant-busy="true"] .assistant-mark{box-shadow:0 0 0 4px ${ACCENT.surface}}
.icon-button{width:28px;height:28px;flex:none;border-radius:5px;display:grid;place-items:center;color:var(--dim);line-height:1}
:is(.dot,.rail-glyph,.assistant-mark,.overlay-mark,.badge){flex-shrink:0}
.assistant-body{flex:1;min-height:0;overflow-y:auto;padding:var(--space-4) var(--space-3)}
.assistant-empty{margin:0;padding:var(--space-3);border:1px dashed var(--line-card);border-radius:var(--r-control);background:var(--well);font-size:13px;line-height:1.65;color:var(--dim);max-width:40ch}
.assistant-thinking .dot{width:6px;height:6px;border-radius:50%;background:var(--accent)}
.assistant-progress{min-width:0;min-height:44px;margin:var(--space-3) 0;overflow-wrap:anywhere;font-size:12px;line-height:1.5;color:var(--text-2);padding:var(--space-3);border:1px solid var(--line-control);border-radius:6px;background:var(--header)}
.shell[data-assistant-busy="true"] .assistant-progress{border-color:var(--accent);color:var(--text)}
.assistant-result{min-width:0;padding:var(--space-3);border-left:2px solid var(--line-hover);background:var(--well);font-size:12px;line-height:1.65;color:var(--text-3);white-space:pre-wrap;overflow-wrap:anywhere;user-select:text;animation:ld-rise-sm var(--motion-duration-micro) var(--motion-ease-out-quart) backwards}
.assistant-composer{flex:none;max-height:65%;min-height:0;overflow-y:auto;scroll-padding:var(--space-2);border-top:1px solid var(--line);background:var(--panel);padding:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2)}
.assistant-prompt{width:100%;min-height:72px;flex-shrink:0;resize:vertical;border:1px solid var(--line-control);border-radius:8px;background:var(--well);color:var(--text);font:13px/1.6 var(--sans);padding:var(--space-3);caret-color:var(--accent)}
.assistant-prompt::placeholder{color:var(--faint)}
.assistant-route{min-width:0;padding:var(--space-2) var(--space-1);border:1px solid var(--line-control);border-radius:5px;color:var(--dim);font-size:11px;line-height:1.3}
.assistant-route-refusal{display:block;margin-top:var(--space-1);font-size:11px;line-height:1.5;overflow-wrap:anywhere;color:var(--scene)}
.overlay-body{margin:0;min-width:0;padding:var(--space-4);font-size:12px;line-height:1.6;color:var(--text-2);overflow-wrap:anywhere}
.overlay-refused .overlay-body{border-left:2px solid var(--refuse);margin:var(--space-4);padding:0 var(--space-3)}
.palette-item{display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) var(--space-6);width:100%;min-height:36px;text-align:left}
.palette-name{min-width:0;overflow-wrap:anywhere}
.palette-item kbd{flex:none;white-space:nowrap}
.palette-item:hover,.palette-item:focus-visible{background:var(--hover)}
.palette-item:focus-visible{outline-offset:-3px;box-shadow:none}
.window-refusal{padding:var(--space-11) var(--space-6);overflow-wrap:anywhere;max-height:100dvh;overflow:auto}
/* Runtime visibility mirrors the media refusal before moving focus. */
.window-refusal[data-window="refused"]{display:block}

`);
}

/** Private refinement deltas applied to the modern modular cascade, never historical whole-file replacement. */
function reconcilePrivateChromeStyles(css: string): string {
  const refinements: readonly (readonly [string, string])[] = [
  [`:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:var(--r-control)}`, `:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:var(--r-control);box-shadow:0 0 0 4px var(--well)}
.view-tab:focus-visible,.dock-tab:focus-visible,.rail-mode:focus-visible{outline-offset:-3px;box-shadow:none}
/* Rings remain inside clipped listboxes and popovers; filled controls retain the well halo. */
:is(.menu-command,.project-files select,.project-recent-select,.assistant-route,.assistant-manipulator):focus-visible{outline-offset:-3px;box-shadow:none}
:is(button,input,select,textarea,a[href],[tabindex]):focus-visible{scroll-margin:var(--space-3)}
@media (forced-colors:active){:focus-visible{outline:2px solid Highlight;outline-offset:-2px;box-shadow:none}button[aria-pressed="true"],button[aria-selected="true"]{border:1px solid Highlight}}
:is(.menu-item,.profile-chip,.icon-button,.assistant-toggle,.assistant-mode):not(.is-inert):not([aria-pressed="true"]):hover{background:var(--hover);color:var(--text)}
button:not(.is-inert):not(:disabled):not([aria-disabled="true"]):active{box-shadow:inset 0 0 0 2px var(--line-hover)}
button:not(.is-inert):not(:disabled):not([aria-disabled="true"]):active:focus-visible{box-shadow:0 0 0 4px var(--well),inset 0 0 0 2px var(--line-hover)}
:is(.left-dock,.inspector,.dock-body,.assistant-body,.assistant-composer,.palette-list,.overlay-card){scrollbar-gutter:stable;scroll-padding:var(--space-3)}`],
  [`.panel-head{margin:0;height:29px;flex:none;display:flex;align-items:center;padding:0 10px;background:var(--header);border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-family:var(--mono);font-size:9px;font-weight:400;letter-spacing:.15em;color:var(--text-3)}
.panel-empty{margin:0;padding:12px 11px;font-size:11px;line-height:1.55;color:var(--dim)}`, `/* Intrinsic section heights contribute to the inspector's scroll extent. */
.inspector > section{flex-shrink:0;min-width:0}
/* Catalogue textareas must not share an inline baseline with Stage: native
   multiline controls otherwise paint below the label's line box at the scroll edge. */
.scene-catalog-editor{display:grid;gap:var(--space-2);min-width:0;padding:var(--space-3)}
.scene-catalog-editor label{display:grid;gap:var(--space-1);min-width:0}
.scene-catalog-editor textarea{display:block;width:100%;min-width:0;resize:vertical}
.scene-catalog-editor button{justify-self:start}
.scene-catalog-editor pre{min-width:0;white-space:pre-wrap;overflow-wrap:anywhere}
.panel-head{margin:0;height:32px;flex:none;display:flex;align-items:center;padding:0 var(--space-3);background:var(--header);border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-family:var(--mono);font-size:11px;font-weight:500;letter-spacing:.08em;color:var(--text-3)}
.panel-empty{margin:var(--space-2);padding:var(--space-3);border:1px dashed var(--line-control);border-radius:var(--r-control);background:var(--well);font-size:12px;line-height:1.65;color:var(--dim);overflow-wrap:anywhere}
.panel-empty[aria-live]{border-style:solid;border-color:var(--line-control);background:var(--panel)}`],
  [`.project-launcher{display:grid;gap:7px;padding:9px;border-bottom:1px solid var(--line)}
.project-launcher p,.project-root{margin:0;color:var(--dim);font-size:9px;line-height:1.45;overflow-wrap:anywhere}`, `.project-launcher{display:grid;gap:var(--space-2);padding:var(--space-3);border-bottom:1px solid var(--line)}
.project-launcher p,.project-root{margin:0;color:var(--dim);font-size:12px;line-height:1.6;overflow-wrap:anywhere}`],
  [`.project-recent-label{font-family:var(--mono);font-size:8px;color:var(--faint);text-transform:uppercase;letter-spacing:.08em}`, `.project-recent-label{font-size:11px;color:var(--faint)}`],
  [`.project-browser-detail dl{display:grid;gap:5px;margin:8px 0}`, `.project-browser-detail dl{display:grid;gap:var(--space-2);margin:var(--space-3) 0}`],
  [`.project-browser-detail dt{font-family:var(--mono);font-size:8px;color:var(--faint);text-transform:uppercase}
.project-browser-detail dd{margin:0;min-width:0;overflow-wrap:anywhere;font-family:var(--mono);font-size:8px;line-height:1.45;color:var(--dim)}`, `.project-browser-detail dt{font-size:11px;color:var(--faint)}
.project-browser-detail dd{margin:0;min-width:0;overflow-wrap:anywhere;font-family:var(--mono);font-size:11px;line-height:1.6;color:var(--dim);font-variant-numeric:tabular-nums}`],
  [`.asset-browser-card span{margin-top:4px;font-family:var(--mono);font-size:8px;line-height:1.45;color:var(--dim)}`, `.asset-browser-card span{margin-top:var(--space-1);font-family:var(--mono);font-size:10px;line-height:1.6;color:var(--dim);font-variant-numeric:tabular-nums;user-select:text}`],
  [`.scene-entities{padding:0 7px 9px}`, `.scene-entities{padding:0 var(--space-2) var(--space-3)}`],
  [`.scene-entity-identities{display:grid;gap:5px;min-width:0;margin:6px 0 0;padding:0;list-style:none}
.scene-entity-identity{min-width:0;margin-left:calc(var(--scene-depth,0) * var(--space-3));padding:var(--space-2) var(--space-3);border:1px solid var(--line-card);border-left:2px solid var(--line-card);background:var(--well);cursor:pointer}`, `/* The canonical multi-select remains a keyboard control, not an invisible focus stop. */
.scene-entities select:focus-visible{position:static;width:100%;height:auto;min-height:96px;padding:var(--space-2);margin:0;overflow:auto;clip:auto;white-space:normal;border:1px solid var(--line-card)}
.scene-entity-identities{display:grid;gap:2px;min-width:0;margin:var(--space-2) 0 0;padding:0;list-style:none}
.scene-entity-identity{min-width:0;margin-left:calc(var(--scene-depth,0) * var(--space-3));padding:var(--space-2) var(--space-3);border:1px solid var(--line-card);border-left:2px solid var(--line-card);background:var(--well);cursor:pointer}
.scene-entity-identity:focus-visible{outline-offset:-3px;box-shadow:none}`],
  [`.scene-entity-identity>span{display:block;margin-bottom:2px;font-size:11px;font-weight:600;color:var(--text)}
.scene-entity-identity dl{display:none;gap:3px;margin:4px 0 0}`, `.scene-entity-identity>span{display:block;margin-bottom:var(--space-1);font-size:12px;line-height:1.5;font-weight:600;color:var(--text);overflow-wrap:anywhere}
.scene-entity-identity dl{display:none;gap:var(--space-1);margin:var(--space-2) 0 0}`],
  [`.scene-entity-identity dl div{display:grid;grid-template-columns:42px minmax(0,1fr);gap:5px;min-width:0}
.scene-entity-identity dt{font-family:var(--mono);font-size:7px;line-height:1.45;letter-spacing:.05em;text-transform:uppercase;color:var(--faint)}`, `.scene-entity-identity dl div{display:grid;grid-template-columns:56px minmax(0,1fr);gap:var(--space-2);min-width:0;padding:var(--space-1) 0;border-top:1px solid var(--line-row)}
.scene-entity-identity dt{font-size:11px;line-height:1.6;color:var(--faint)}`],
  [`.scene-entity-identity code{display:block;min-width:0;font-size:8px;line-height:1.45;color:var(--dim);white-space:normal;overflow-wrap:anywhere}`, `.scene-entity-identity code{display:block;min-width:0;font-size:10px;line-height:1.6;color:var(--dim);white-space:normal;overflow-wrap:anywhere;font-variant-numeric:tabular-nums;user-select:text}`],
  [`.scene-property-input:focus{outline:1px solid var(--accent);outline-offset:1px}.scene-property-input.is-inert{color:var(--inert)}`, `.scene-property-input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.scene-property-input.is-inert{color:var(--inert)}`],
  [`.scene-property-review{max-height:150px;margin:0;padding:8px;overflow:auto;border:1px solid var(--line);border-radius:4px;background:var(--well);color:var(--dim);font-family:var(--mono);font-size:8px;line-height:1.45;white-space:pre-wrap}`, `.scene-property-review{max-height:150px;margin:0;padding:var(--space-2);overflow:auto;border:1px solid var(--line);border-radius:6px;background:var(--well);color:var(--dim);font-family:var(--mono);font-size:11px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}`],
  [`.pass-row{display:flex;align-items:center;gap:10px;padding:6px 9px;background:var(--raised);border:1px solid var(--line);border-radius:4px}`, `.pass-row{display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-3);background:var(--raised);border:1px solid var(--line);border-radius:4px;min-width:0}
.pass-row>div{min-width:0;overflow-wrap:anywhere}
.pass-row:nth-child(even){background:var(--well)}`],
  [`.viewport-backdrop{position:absolute;inset:0;pointer-events:none}`, `.viewport-backdrop{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 0 1px var(--line-row)}`],
  [`.change-empty{margin:0;padding:34px 14px;text-align:center;font-size:12px;color:var(--dim)}`, `.change-empty{margin:auto;padding:var(--space-6) var(--space-4);max-width:52ch;text-align:center;font-size:13px;line-height:1.65;color:var(--dim)}
.change-empty::before{content:"";display:block;width:24px;height:24px;margin:0 auto var(--space-3);border:1px solid var(--line-hover);border-radius:6px;background:var(--raised)}`],
  [`.assistant-head{height:36px;flex:none;display:flex;align-items:center;gap:9px;padding:0 12px;background:var(--raised);border-bottom:1px solid var(--line)}`, `.assistant-head{height:40px;flex:none;display:flex;align-items:center;gap:var(--space-2);padding:0 var(--space-3);background:var(--raised);border-bottom:1px solid var(--line)}`],
  [`.shell[data-assistant-busy="true"] .assistant-mark{box-shadow:0 0 0 4px ${ACCENT.surface};animation:assistant-breathe 1.1s ease-in-out infinite}
.shell[data-assistant-busy="true"] .assistant-mark::before{animation:assistant-spin 1.6s linear infinite}
.shell[data-assistant-busy="true"] .viewport::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(80% 70% at 50% 40%, ${ACCENT.surface} 0%, transparent 70%);animation:assistant-glow 1.4s ease-in-out infinite}`, `/* One live-bars signal confirms work; the canvas and labels stay visually still. */
.shell[data-assistant-busy="true"] .assistant-mark{box-shadow:0 0 0 4px ${ACCENT.surface}}`],
  [`.icon-button{width:26px;height:26px;border-radius:4px;display:grid;place-items:center;color:var(--dim)}`, `.icon-button{width:28px;height:28px;flex:none;border-radius:5px;display:grid;place-items:center;color:var(--dim);line-height:1}
:is(.dot,.rail-glyph,.assistant-mark,.overlay-mark,.badge){flex-shrink:0}`],
  [`.assistant-body{flex:1;min-height:0;overflow-y:auto;padding:13px 12px}
.assistant-empty{margin:0;font-size:11px;line-height:1.55;color:var(--dim)}`, `.assistant-body{flex:1;min-height:0;overflow-y:auto;padding:var(--space-4) var(--space-3)}
.assistant-empty{margin:0;padding:var(--space-3);border:1px dashed var(--line-card);border-radius:var(--r-control);background:var(--well);font-size:13px;line-height:1.65;color:var(--dim);max-width:40ch}`],
  [`.assistant-thinking .dot{width:6px;height:6px;border-radius:50%;background:var(--accent);animation:assistant-dot 1s ease-in-out infinite}
.assistant-thinking .dot:nth-child(2){animation-delay:.15s}
.assistant-thinking .dot:nth-child(3){animation-delay:.3s}
.assistant-progress{font-size:11px;line-height:1.5;color:var(--text-2);padding:9px;border:1px solid var(--line-control);border-radius:4px;background:var(--header);transition:border-color .2s ease,color .2s ease}
.shell[data-assistant-busy="true"] .assistant-progress{border-color:var(--accent);color:var(--text);animation:assistant-card 1.2s ease-in-out infinite}
.assistant-result{font-size:10px;line-height:1.55;color:var(--text-3);white-space:pre-wrap;animation:ld-rise-sm var(--motion-duration-micro) var(--motion-ease-out-quart) backwards}`, `.assistant-thinking .dot{width:6px;height:6px;border-radius:50%;background:var(--accent)}
.assistant-progress{min-width:0;min-height:44px;margin:var(--space-3) 0;overflow-wrap:anywhere;font-size:12px;line-height:1.5;color:var(--text-2);padding:var(--space-3);border:1px solid var(--line-control);border-radius:6px;background:var(--header)}
.shell[data-assistant-busy="true"] .assistant-progress{border-color:var(--accent);color:var(--text)}
.assistant-result{min-width:0;padding:var(--space-3);border-left:2px solid var(--line-hover);background:var(--well);font-size:12px;line-height:1.65;color:var(--text-3);white-space:pre-wrap;overflow-wrap:anywhere;user-select:text;animation:ld-rise-sm var(--motion-duration-micro) var(--motion-ease-out-quart) backwards}`],
  [`.assistant-composer{flex:none;border-top:1px solid var(--line);background:var(--panel);padding:9px 11px 11px;display:flex;flex-direction:column;gap:8px}
.assistant-prompt{width:100%;min-height:58px;resize:vertical;border:1px solid var(--line-control);border-radius:4px;background:var(--well);color:var(--text);font:11px/1.5 var(--sans);padding:8px}`, `.assistant-composer{flex:none;max-height:65%;min-height:0;overflow-y:auto;scroll-padding:var(--space-2);border-top:1px solid var(--line);background:var(--panel);padding:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2)}
.assistant-prompt{width:100%;min-height:72px;flex-shrink:0;resize:vertical;border:1px solid var(--line-control);border-radius:8px;background:var(--well);color:var(--text);font:13px/1.6 var(--sans);padding:var(--space-3);caret-color:var(--accent)}
.assistant-prompt::placeholder{color:var(--faint)}`],
  [`.assistant-route{min-width:0;padding:5px 3px;border:1px solid var(--line-control);border-radius:3px;color:var(--dim);font-size:9px;line-height:1.2}
.assistant-route-refusal{display:block;margin-top:3px;font-size:7px;line-height:1.2;overflow-wrap:anywhere;color:var(--scene)}`, `.assistant-route{min-width:0;padding:var(--space-2) var(--space-1);border:1px solid var(--line-control);border-radius:5px;color:var(--dim);font-size:11px;line-height:1.3}
.assistant-route-refusal{display:block;margin-top:var(--space-1);font-size:11px;line-height:1.5;overflow-wrap:anywhere;color:var(--scene)}`],
  [`.overlay-body{margin:0;padding:15px 18px;font-size:12px;line-height:1.6;color:var(--text-2)}`, `.overlay-body{margin:0;min-width:0;padding:var(--space-4);font-size:12px;line-height:1.6;color:var(--text-2);overflow-wrap:anywhere}
.overlay-refused .overlay-body{border-left:2px solid var(--refuse);margin:var(--space-4);padding:0 var(--space-3)}`],
  [`.palette-item{display:flex;align-items:center;gap:12px;padding:8px 16px;width:100%;text-align:left}
.palette-item:hover{background:var(--hover)}`, `.palette-item{display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) var(--space-6);width:100%;min-height:36px;text-align:left}
.palette-name{min-width:0;overflow-wrap:anywhere}
.palette-item kbd{flex:none;white-space:nowrap}
.palette-item:hover,.palette-item:focus-visible{background:var(--hover)}
.palette-item:focus-visible{outline-offset:-3px;box-shadow:none}`],
  [`.window-refusal{display:none;max-width:52ch;margin:0 auto;padding:48px 24px;text-align:center}`, `.window-refusal{display:none;max-width:52ch;margin:0 auto;padding:var(--space-11) var(--space-6);text-align:center;overflow-wrap:anywhere}`],
  [`@keyframes assistant-breathe{0%,100%{opacity:1}50%{opacity:.62}}
@keyframes assistant-spin{to{transform:rotate(225deg)}}`, ``],
  [`@keyframes assistant-dot{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:1;transform:translateY(-2px)}}
@keyframes assistant-card{0%,100%{box-shadow:0 0 0 0 ${ACCENT.surface}}50%{box-shadow:0 0 0 4px ${ACCENT.surface}}}
@keyframes assistant-glow{0%,100%{opacity:.18}50%{opacity:.4}}`, ``],
  [`): Record<string, Record<string, readonly [string, string | null]>> {`, `) {`],
  ];

  for (const [previous, refined] of refinements) {
    // Exact rules only: independently evolved modern selectors and handlers remain untouched.
    css = css.replace(previous, () => refined);
  }

  return css;
}
