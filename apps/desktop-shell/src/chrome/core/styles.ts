import { DESKTOP_MINIMUM_WINDOW } from "../../visual-model.js";
import { ACCENT, INERT, LINE, METRICS, SCRIM, SIGNAL, SURFACE, TEXT, TYPE } from "../../visual-tokens.js";
import { atTierOrAbove, belowTier } from "./markup.js";
import { titleBarStyles, modeRailStyles, statusBarStyles } from "../frame/styles.js";
import { settingsStyles } from "../settings/styles.js";
import { projectStyles, treeStyles, projectDetailStyles } from "../tree/styles.js";
import { assetStyles, dockStyles } from "../dock/styles.js";
import { inspectorStyles, webInspectorStyles } from "../inspector/styles.js";
import { viewportLayoutStyles, viewportStyles, viewportOverlayStyles } from "../viewport/styles.js";
import { assistantStyles } from "../assistant/styles.js";
import { paletteStyles } from "../palette/styles.js";

/** Contiguous slices retain the original cascade and every emitted byte. */
export function styles(): string {
  return `
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
  --r-panel:18px;--r-card:13px;--r-control:10px;
}
*{box-sizing:border-box}
/* Every hidden region here is an explicit model or runtime decision. */
[hidden]{display:none !important}
html,body{margin:0;padding:0;height:100%;overflow:hidden}
body{background:var(--backdrop);color:var(--text);font-family:var(--sans);font-size:13px;-webkit-font-smoothing:antialiased}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:var(--r-control)}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
/* An inert control is dimmed by paint, never by element opacity: opacity
   composites the label toward whatever is behind it, and both the token gate and
   a browser's getComputedStyle read the declared colour, so that dimming was
   measured by nothing. --inert is the dimmest tier that still clears 4.5:1, so
   the refusal stays readable. The [aria-pressed]/[aria-selected] pair is here
   because an active tab or mode sets its own colour at a higher specificity. */
button.is-inert{cursor:not-allowed;color:var(--inert)}
button.is-inert[aria-pressed="true"],button.is-inert[aria-selected="true"]{color:var(--inert)}
button.is-inert .rail-glyph{border-color:var(--inert-glyph)}
code,kbd{font-family:var(--mono);font-size:.86em}

.shell{display:grid;grid-template-rows:var(--title-h) 1fr var(--status-h);height:100dvh;min-height:100dvh;background:var(--canvas);position:relative;overflow:hidden}
/* A denied assistant keeps its column: the archive shows the Kids lock screen
   there, and hiding it would turn a named refusal into an absent panel. Only a
   closed assistant removes the column. */
.shell-body{display:grid;grid-template-columns:var(--rail) var(--left) minmax(0,1fr) var(--inspector) var(--assistant-w);min-height:0}
.shell[data-assistant="closed"] .shell-body{grid-template-columns:var(--rail) var(--left) minmax(0,1fr) var(--inspector)}
.shell[data-assistant="closed"] .assistant{display:none}

${titleBarStyles()}
.ghost-button{display:flex;align-items:center;gap:7px;height:22px;padding:0 10px;border-radius:4px;background:var(--header);border:1px solid var(--line-control);font-size:11px;color:var(--dim)}
.ghost-button:hover{border-color:var(--line-hover);color:var(--text)}
/* A single-class :hover outranks button.is-inert, so every control class whose
   hover repaints its label has to say what the inert one does under the pointer
   — otherwise an inert control becomes indistinguishable from a live one there,
   which is the same dimmed-by-nothing state the paint rule above replaced. */
.ghost-button.is-inert:hover{border-color:var(--line-control);color:var(--inert)}
.ghost-button kbd{background:var(--well);border:1px solid var(--line-control);border-radius:2px;padding:1px 4px;color:var(--faint)}
.primary-button{background:var(--accent);color:var(--on-accent);font-weight:600;font-size:11px;border-radius:var(--r-control);height:22px;padding:0 11px}
.primary-button:hover{background:var(--accent-hover)}
/* The accent fill stays and only the mark on it is demoted: --inert on orange is
   1.29:1, and the fill is what says which control this is. --inert-on-accent is
   5.72:1 there against the live 7.05:1. */
.primary-button.is-inert,.primary-button.is-inert:hover{color:var(--inert-on-accent)}
.primary-button.is-inert:hover{background:var(--accent)}
.block-button{width:100%;height:32px;font-size:12px;margin-top:10px}
.assistant-toggle{display:flex;align-items:center;gap:7px;height:22px;padding:0 10px;border-radius:4px;font-size:11px;font-weight:500;background:var(--header);border:1px solid var(--line-control);color:var(--dim)}
/* Where the assistant is docked the toggle reads the column's own state; below
   that tier the drawer rule takes over. Which one applies is a stylesheet
   decision on the two complementary media conditions rather than an attribute
   chosen at render time, because the document can be opened at a viewport the
   render never saw and the toggle must never light up over a column that
   viewport does not show. */
@media ${atTierOrAbove("regular")}{
  .shell[data-assistant="open"] .assistant-toggle{background:${ACCENT.surface};border-color:${ACCENT.line};color:var(--accent)}
  .shell[data-assistant="open"] [data-assistant-dot]{background:var(--accent)}
}
.shell[data-assistant="denied"] [data-assistant-dot]{background:var(--scene)}

${modeRailStyles()}

.left-dock,.inspector{background:var(--panel);display:flex;flex-direction:column;min-height:0;overflow-y:auto}
.left-dock{border-right:1px solid var(--line)}
.inspector{border-left:1px solid var(--line)}
${settingsStyles()}
.panel-head{margin:0;height:29px;flex:none;display:flex;align-items:center;padding:0 10px;background:var(--header);border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-family:var(--mono);font-size:9px;font-weight:400;letter-spacing:.15em;color:var(--text-3)}
.panel-empty{margin:0;padding:12px 11px;font-size:11px;line-height:1.55;color:var(--dim)}
.panel-note{display:flex;gap:9px;align-items:flex-start;margin:0 10px 11px;padding:10px 11px;border:1px solid;border-radius:4px;font-size:11px;line-height:1.55}
.panel-note .dot{margin-top:5px}
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
.shell[data-profile="web"] .profile-runtime-actions .primary-button::after{content:"Preview";font-size:11px;font-weight:600}
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
.profile-refusal{display:none;place-items:center;padding:32px;background:radial-gradient(120% 90% at 50% 0%, ${SIGNAL.sceneSurface} 0%, var(--canvas) 70%);min-width:0}
.shell[data-profile="kids"] .profile-refusal{display:grid}
.shell[data-profile="kids"]{--accent:${SIGNAL.scene};--on-accent:${SIGNAL.sceneSurface}}
.profile-refusal-card{max-width:46ch;text-align:center;background:${SIGNAL.sceneSurface};border:1px solid ${SIGNAL.sceneLine};border-radius:18px;padding:28px 28px 24px;box-shadow:0 18px 40px -24px ${SIGNAL.scene}}
.profile-refusal-card h2{margin:12px 0;font-size:22px;color:${SIGNAL.sceneText}}
.profile-refusal-card p{margin:0 0 10px;font-size:13px;line-height:1.65;color:${SIGNAL.sceneText}}
.kids-studio-mark{display:grid;place-items:center;width:42px;height:42px;margin:0 auto;border-radius:14px;background:${SIGNAL.scene};color:${SIGNAL.sceneSurface};font-size:20px}
.profile-refusal-code{display:none}
.shell[data-details-open="true"] .profile-refusal-code{display:block}
.profile-refusal-code code{color:var(--scene)}
.profile-refusal-foot{color:var(--dim) !important}
.mark-scene{background:${SIGNAL.sceneSurface};border:1px solid ${SIGNAL.sceneLine};color:${SIGNAL.scene};margin:0 auto}
${projectDetailStyles()}

${statusBarStyles()}

.overlay{position:absolute;inset:0;background:${SCRIM.overlay};display:grid;place-items:center;z-index:50;padding:24px}
.overlay-card{width:min(620px,100%);max-height:80%;overflow:auto;background:var(--overlay);border:1px solid var(--line-raised);border-radius:9px;box-shadow:0 40px 90px -20px ${SCRIM.shadow};animation:rise .16s ease-out}
.overlay-card.overlay-refused{border-color:${SIGNAL.refuseLine}}
.overlay-head{display:flex;align-items:center;gap:12px;padding:15px 18px;border-bottom:1px solid var(--line)}
.overlay-head h2{margin:0;font-size:15px;font-weight:600}
.overlay-mark{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:700;flex:none}
.mark-refuse{background:${SIGNAL.refuseSurface};border:1px solid ${SIGNAL.refuseLine};color:var(--refuse)}
.mark-complete{background:${SIGNAL.infoSurface};border:1px solid ${SIGNAL.infoLine};color:var(--info)}
.overlay-body{margin:0;padding:15px 18px;font-size:12px;line-height:1.6;color:var(--text-2)}
.overlay-actions{display:flex;gap:9px;justify-content:flex-end;padding:13px 18px;background:var(--well);border-top:1px solid var(--line)}
.overlay-actions .primary-button,.overlay-actions .ghost-button{height:31px;padding:0 14px;font-size:12px}
${paletteStyles()}
.overlay-foot{margin:0;padding:10px 16px;background:var(--well);border-top:1px solid var(--line);font-size:10.5px;color:var(--dim)}

.refusal-help-toggle[aria-expanded="true"]{border-color:var(--line-hover);color:var(--text)}
.refusal-legend-panel{position:absolute;right:8px;bottom:calc(100% + 8px);z-index:45;width:min(520px,calc(100vw - 16px));max-height:min(360px,calc(100dvh - var(--title-h) - var(--status-h) - 24px));overflow:auto;padding:10px 12px;background:var(--well);border:1px solid var(--line-raised);border-radius:6px;box-shadow:0 18px 48px -18px ${SCRIM.shadow}}
.refusal-legend-panel h2{margin:0 0 8px;font-family:var(--mono);font-size:9px;font-weight:400;letter-spacing:.15em;color:var(--text-3)}
.refusal-row{margin:0 0 6px;font-size:11px;line-height:1.5;color:var(--dim)}
.refusal-row code{color:var(--accent);margin-right:8px}

.window-refusal{display:none;max-width:52ch;margin:0 auto;padding:48px 24px;text-align:center}
.window-refusal h1{font-size:17px;margin:0 0 12px}
.window-refusal p{font-size:13px;line-height:1.65;color:var(--dim);margin:0 0 10px}
.window-refusal code{color:var(--accent)}

@keyframes rise{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
@keyframes sweep{0%{transform:translateX(-120%)}100%{transform:translateX(420%)}}
@keyframes assistant-breathe{0%,100%{opacity:1}50%{opacity:.62}}
@keyframes assistant-spin{to{transform:rotate(225deg)}}
@keyframes assistant-bars{0%,100%{opacity:.4}50%{opacity:1}}
@keyframes assistant-dot{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:1;transform:translateY(-2px)}}
@keyframes assistant-card{0%,100%{box-shadow:0 0 0 0 ${ACCENT.surface}}50%{box-shadow:0 0 0 4px ${ACCENT.surface}}}
@keyframes assistant-glow{0%,100%{opacity:.18}50%{opacity:.4}}

/* Compact: the assistant leaves the grid and becomes an overlay drawer. Its
   existing toggle opens and closes it, so nothing becomes unreachable. */
@media ${belowTier("regular")}{
  .shell-body,.shell[data-assistant="closed"] .shell-body,.shell[data-profile="kids"] .shell-body{grid-template-columns:var(--rail) var(--left) minmax(0,1fr) var(--inspector)}
  .shell[data-profile="kids"] .shell-body{grid-template-columns:var(--rail) minmax(0,1fr)}
  .assistant{position:absolute;top:var(--title-h);bottom:var(--status-h);right:0;width:min(var(--assistant-w),100%);z-index:40;box-shadow:0 0 60px -10px ${SCRIM.shadow}}
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
}
/* Narrow: the left dock and the inspector become drawers too, and the two
   title-bar toggles that open them appear. They start closed, because a drawer
   nobody opened should not be covering the viewport. */
@media ${belowTier("compact")}{
  .shell-body,.shell[data-assistant="closed"] .shell-body,.shell[data-profile="kids"] .shell-body{grid-template-columns:var(--rail) minmax(0,1fr)}
  .title-actions .drawer-toggle{display:inline-flex}
  .title-centre,.menu-bar{display:none}
  .left-dock,.inspector{position:absolute;top:var(--title-h);bottom:var(--status-h);z-index:35;box-shadow:0 0 60px -10px ${SCRIM.shadow}}
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
}
/* Below the declared minimum the chrome refuses instead of laying out. The
   breakpoints are interpolated from DESKTOP_MINIMUM_WINDOW, so the CSS and the
   model refuse at exactly the same size and cannot be raised apart. */
@media (max-width:${DESKTOP_MINIMUM_WINDOW.width - 1}px),(max-height:${DESKTOP_MINIMUM_WINDOW.height - 1}px){
  .shell{display:none}
  .window-refusal{display:block}
}

@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.001ms !important;animation-iteration-count:1 !important;transition-duration:.001ms !important}
  .sculpt-sweep,.assistant-live{display:none}
}
`;
}
