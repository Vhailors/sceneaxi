# lane-desktop report

Date: 2026-10-04. Node: lane-desktop (bg-215). Scope: DIRECTION.md §7.6 and §7.7, in the Cinematic Pro language.
E = `/home/devuser/Documents/Reports/sceneaxi-redesign`. Nothing was committed, stashed or reverted.

## Round 4 (reviews/lanes.md `## lane-desktop`, items 1–6; ruling R-6)

| Item | What was done |
|---|---|
| 1 (blocking) | Outcome dialog captured through the chrome's own path. `logs/capture3.cjs` clicks File > Open Project (`data-command="project-open"`) on `chrome.html`; with no host bridge its handler calls `showOutcome('Project lifecycle refused', …)` → `setOverlay('outcome')`. `shots/audit-r4.json` notes record, at all four runs: `data-overlay="outcome"`, title "Project lifecycle refused", code `DESKTOP_RUNTIME_UNAVAILABLE`, message "The project root was not changed.", focus inside the dialog. Shots: `outcome-1280x800`, `outcome-1920x1080`, each with `-reduced`. The old `states/outcome.html` render (which `normalize` reset to no overlay) and its shots were deleted. `logs/outcome-probe.cjs` lists which visible commands open the dialog. The round-2 claims about outcome (former lines 11 and 68) are corrected below. |
| 2 (blocking) | `logs/render3.mjs` renders `S({ assistantMode: "ask" })` and `S({ assistantMode: "agent" })`. Shots `assistant-ask-*` and `assistant-agent-*` at 1280×800 (drawer opened) and 1920×1080, each with `-reduced`. Notes confirm `aria-pressed="true"` on ask and agent respectively. Contrast minimum 7.01:1, 0 failures, no overflow. |
| 3 (blocking) | `chrome.ts` `.sculpt-progress`: `bottom:64px` → `bottom:var(--space-4)` (CSS only). Hit test in `audit-r4.json` (`sculpt-hit-*`), all four runs: at 1280×800 the note is 474–810 × 375–413 and the card 465–819 × 423–529, inside the viewport (bottom 545); at 1920×1080 the note is 622–958 × 509–546 and the card 613–967 × 703–809. `overlap:false`, and `elementFromPoint` at the note's centre and 4 edge points lands on the note at both sizes. |
| 4 | Compose: the `#mode-compose` rail button is inert and `hidden` in the default chrome, and `normalize` maps compose to build. Label: **compose refused (inert rail button), renders Build**. Its shots were byte-identical to `default-*`, so they were deleted; `default-*` is what compose renders. Plugins is the same refusal (`#mode-plugins` inert, `hidden`) and renders Build; its shot keeps the separate state "Build with details open". |
| 5 | Live viewport: **n/a in this lane's evidence.** §7.7 mounts the viewport only for an opened project. The packaged Electron app (re-captured this round, `linux/first-run-*`) starts with "Live viewport refused: the persisted input-action map was refused." and no canvas (`linux/electron.json`: `canvas:false`). Opening a project needs the host's project dialog, which this headless run cannot drive. So there is no shot of a mounted viewport; the refused live line is the evidence. |
| 6 | DV-D7, DV-D8 and DV-D9 are accepted by ruling R-6 and recorded (see Deviations). The DV-F8 loading bar is a lane Deviation (DV-L1 below). The row-16 wipe list now includes `[data-ship-bundle-digest]`, `[data-ship-source-digest]` and `[data-project-browser-digest]`. The assistant-mode control now has a gliding indicator (row 17): the accent fill sits on `.assistant-mode[aria-pressed="true"]::before` and the motion script glides it in from the previous mode (`translateX` + `clip-path`, panel 280ms expo). `ld-settle` was removed from the mode. `audit-r4.json` records `Animation:280ms:cubic-bezier(0.16, 1, 0.3, 1):assistant-mode is-gliding::before`, and no animations under reduce. `.site-eyebrow` stays the DV-D9 chip above the heading. |

Duplicates. No two shots of different states are byte-identical any more. I checked with md5 across `shots/` (`-reduced` folded onto its state). Three files are gone: `assistant-closed-1280x800*` (at the compact tier the assistant is a closed drawer by default, so it was identical to `default-1280x800`), `compose-*` (item 4), and the four `dock-glide` final frames (the same state as `dock-evidence`; the `dock-glide-mid-*` frames remain). A `-reduced` copy is often byte-identical to its full-motion shot. That is the same state at its end frame, which is expected, because motion changes only the path. `sculpt-*-reduced` differ because the sweep loop is static under reduce.

## Round 2 re-run (kept for history; outcome claims corrected)

| Item | What was done |
|---|---|
| 1 (blocking) | Motion script in `chrome.ts` now returns early when `host.animate` is missing, and both `observe` setups sit in a `try`. `desktop-linux-bridge-golden` passes 70/70. `pnpm exec vitest run tests/e2e` leaves only the 16 baseline `desktop-editor-command-forms-golden` failures. |
| 2 (blocking) | Shots added at 1280×800 and 1920×1080, each with a `-reduced` copy: animate, ship, plugins, assistant-thinking, dock-evidence, dock-console, drawer-assistant. **Correction (round 4):** the round-2 outcome shots did not show the dialog (`normalize` reset the overlay) and were replaced; compose and assistant-closed-1280 were byte-identical to default and were deleted; viewport-refused was a copy of `linux/first-run-*` and was deleted in favour of that file. |
| 3 | View and dock tabs: the selected bar now glides from the tab that was selected before. It uses `translateX` + `clip-path` on `::after` through Web Animations (panel 280ms, expo). The CSS draw stays as the fallback. |
| 4 | Rows 14 and 18 now have an n/a line in the table. |
| 5 | DV-D8 changed: when details are closed, capability sentences are visually hidden (1px clip pattern), not `display:none`. They stay in the accessibility tree. DV-D7 is unchanged. Both still need acceptance (Request D2). |
| 6 | `.site-eyebrow` is now a neutral chip: sentence case, 1px `--line` frame, `--text-2`, no tracking, not accent. The class and the copy are unchanged. |
| 7 | The row 5 note now says loading uses the DV-F8 in-band form. |

## Files changed

| File | What changed |
|---|---|
| `apps/desktop-shell/src/chrome.ts` | Stylesheet (`styles()`) and one motion-only script block at the end of `script()`. No markup, id, data-*, aria, role, command or copy changes. The re-run touched only `.site-eyebrow`, `.capability-list` and that script block. |
| `desktop/linux/src/renderer/byo-configuration.ts` | Installed BYOK styles, plus `aria-busy` on Save or Remove while that request is in flight. |
| `apps/desktop-shell/src/visual-tokens.ts` | Round 4 only, under the one-time grant in ruling R-6: three `DEVIATIONS` entries appended (`dv-d7-play-ring-origin`, `dv-d8-capability-sentences`, `dv-d9-site-eyebrow-chip`). No token value changed. |
| `docs/redesign/DIRECTION.md` §8, `docs/engine-desktop-surface.md` (Redesign 2026-10 table) | Round 4, R-6 grant: DV-D7, DV-D8, DV-D9 rows added. |
| `apps/desktop-shell/src/chrome.ts` (round 4) | CSS: `.sculpt-progress` `bottom`; `.assistant-mode` fill on `::before` plus `.is-gliding`; `ld-settle` dropped from `.assistant-mode`. Motion script: three digest hooks added to the wipe list; the assistant-mode glide (observer also filtered to `aria-pressed`). No markup, id, data-*, aria, role, command or copy change. |

Owned but unchanged: `visual-model.ts`, `app.ts`, `viewport.ts`, `viewport-playback.ts`, `assistant-*.ts`, `playback-report.ts`, `chrome-document.ts`, `byo-configuration-view.ts`. They set no styles beyond the overlay-line geometry, which the chrome CSS now styles. CSP is unchanged: `chrome-document.ts` re-hashes the inline script.

## What changed per region (chrome.ts)

- **Tokens.** `:root` reads `RADIUS` (`--r-panel` 18→16, DV-D1), `SPACING_SCALE` (adds `--space-8/11/18`, DV-D3), `ELEVATION.float` as `--float` (DV-D4) and every `MOTION_CUSTOM_PROPERTIES` entry (no scale tokens). The reduced-motion block keeps the pinned blanket rule first, then adds `MOTION_REDUCED_CUSTOM_PROPERTIES`. `::selection` is themed.
- **Type (DV-D2).** Every text size below 11px is now 11px or more: menus and kbd, chip tag, rail labels (8→11), project and browser fields, hierarchy dt, inspector labels and diagnostics, ship evidence, pass list, capabilities, runtime report, badge, dock caption, change meta and diff, assistant model, routes and foot, status bar, shortcuts, palette heads and kbd, overlay foot, refusal legend. Uppercase mono costume labels on dt and group heads became sentence-case UI text. The two pinned 10px selectors are untouched.
- **Elevation and bans.** The menu, palette and outcome card, refusal legend and drawers use the tight float shadow instead of 45–90px blurs (DV-D4). The brand glow and the Kids card's coloured glow and radial wash are removed. The side stripe on `.panel-empty[aria-live]` became a solid hairline. The unused `.profile-kicker` was removed. Hierarchy rows are now square tree rows; the pinned 2px rail stays (DV-X1).
- **States.** Colour transitions are removed, so paint is instant (DV-D5). Hover was added where it was missing: view and dock tabs, assistant routes, scene entities, all fields and selects. Fields show an accent line on focus-visible and a refuse line on `:user-invalid`. Inert controls get a dashed edge. `button:disabled` paints as inert. Loading (row 5: `aria-busy`, or Send while the assistant is busy) shows a 2px bar that draws once after `--motion-delay-loading`. This is the DV-F8 in-band form, which DV-F8 allows. It is not the R-1 loop. Scrollbars and the prompt resizer are themed.
- **Layout fixes from the audit.** Buttons and tabs no longer wrap and clip inside fixed heights. Capability titles wrap. Their sentences now appear with the details layer instead of being cut off by an ellipsis. While details are closed they are visually hidden but stay in the accessibility tree. Spacing snapped to the 4/8/12/16/24/32 scale (one pinned exception: `padding:10px 12px` on the refusal legend, `chrome.test.ts:543`).

## Animation table

Every keyframe animates only opacity, `translate`/`transform`, `clip-path` or `filter`. No `scale()` is used. Entrances run on `:not([hidden])` or a state attribute, and exits are instant. Easing comes from `--motion-ease-out-*`.

| Interaction | Selector / mechanism | Motion | Reduced motion |
|---|---|---|---|
| Menu open | `.menu-panel:not([hidden])` | `ld-drop` 4px down + fade, state 200ms expo | blanket rule: instant |
| Command palette / outcome dialog | `.overlay:not([hidden])`, `.overlay-card` | scrim fade + card 8px rise + clip-path inset, panel 280ms expo; palette groups stagger 40ms, capped at 200ms | instant, no stagger |
| Refusal legend | `.refusal-legend-panel:not([hidden])` | 4px rise, state expo | instant |
| Mode rail (toolbar tool select) | `.mode-rail::after`, `--rail-i` set through `:has()` per pressed mode | one indicator glides by `translate`, panel expo (transition) | jumps |
| View and dock tabs | `[aria-selected="true"]::after`; script on the `aria-selected` change | one bar glides from the previously selected tab (`translateX` + `clip-path` on `::after`, Web Animations, panel 280ms expo). With no previous tab (first paint, rebuilt tab list) it draws from the centre (CSS `ld-draw-x`) | appears in place |
| Hierarchy tree | `.scene-entities:not([hidden])`; `dl` on details open; `.is-selected` | list rises in, state quint; row settles by `filter:brightness` 1.4→1. Row hover is an instant paint. Drag-over: n/a, the chrome has no drag behaviour | instant |
| Inspector field focus / commit / refusal | focus: instant accent line (row 3); commit and refusal: `[data-scene-property-diagnostic]` text change → wipe | clip-path wipe + 4px, state 200ms quint (Web Animations) | text swaps |
| Panel dock / resize | `.dock-tabpanel`, `.dock-panel`, `.inspector-panel` on `:not([hidden])`; compact drawers `ld-in-left/right` 16px; assistant column `ld-in-right` | panel expo | instant |
| Play mode enter / exit | `.shell[data-mode="run"] .viewport::after` aperture `inset(48% 0)`→`inset(0)`, route 320ms expo; Play ring `::before` `circle(25%)`→`circle(75%)` + fade | exit is instant | frame shown, no ring |
| Viewport overlay / gizmo | `[data-live-viewport]` chips rise 4px, state quint; text change → wipe; canvas fades in on mount; manipulators rise; hover is an instant paint | transform/opacity only over the viewport | instant |
| Assistant stream-in | `.assistant-result` 4px rise, micro 160ms quart; thinking line and Retry rise; `[data-assistant-status]` wipe; `assistant-bars` moved to R-2 tokens | | bars hidden (existing rule) |
| BYO dialog open / validate | `.desktop-byo-config:not([hidden])` rise, panel expo; state and message text change → wipe; Save/Remove `aria-busy` → loading bar | | instant |
| Assistant strength (ask/build/agent) | `.assistant-mode[aria-pressed="true"]::before` holds the fill; script on the `aria-pressed` change | the fill glides from the previous mode (`translateX` + `clip-path` on `::before`, Web Animations, panel 280ms expo); the button's own fill is held clear (`.is-gliding`) for the glide only | appears in place |
| Status bar / toast | `.status-text`, `.status-pin`, `[data-project-status]`, `.runtime-report`, `[data-change-badge]`, `.sculpt-detail`, ship and project-browser digests text change → wipe. There is no toast component (n/a) | | text swaps |
| Row 14, decided row in place | n/a. The changes-dock proposal is shown and hidden with `hidden` (`chrome.ts:761`), so the chrome never has a row that is decided in place. Proposal entrance is `ld-rise-sm` (Panel dock row) | | |
| Row 18, skeleton for palette and drawers | n/a. The palette and the drawers render synchronously from markup already in the document, so there is no async wait to cover | | |
| Sculpt running | `.sculpt-progress` (bottom `--space-4`, clear of the inert note) `ld-rise-md` panel expo; `sweep` on R-2 tokens with px travel on the fixed 320px track | | sweep hidden |
| Window-below-minimum | `.window-refusal` rise when shown | | instant |

The script block (end of `script()`) does three things. At boot it calls `finish()` on finite CSS animations so the first paint is not choreographed. One `MutationObserver` wipes in the live lines listed above. The same observer, filtered to `aria-selected` and `aria-pressed`, drives the tab glide and the assistant-mode glide. It reads and writes no state. It returns before observing when `MutationObserver` or `host.animate` is missing (jsdom and the golden harness), the `observe` call is inside a `try`, and every animation is skipped under `prefers-reduced-motion: reduce`.

## Evidence (E/after/desktop)

Round 4: every state was re-rendered (`logs/render3.mjs`) and re-shot (`logs/capture.cjs`, `logs/capture2.cjs`, new `logs/capture3.cjs`) after the round-4 `pnpm build`. Electron was re-captured too. `shots/` now holds 112 PNGs. The round-4 audit (`shots/audit-r4.json`) covers outcome, assistant-ask, assistant-agent, sculpt and mode-glide: contrast minimum 4.9:1 (outcome) with 0 failures, no overflow, no page errors.

- `chrome.html`: `renderDesktopChrome` default output (`logs/render2.mjs`). `states/*.html`: palette, run, sculpt, compose, animate, ship, plugins (details open), assistant-closed, assistant-thinking, assistant-ask, assistant-agent, dock-evidence, dock-console, kids and web, plus `chrome-byo.html`, which is the chrome with the real BYOK surface mounted by `harness/byo-harness.js` (esbuild bundle of `byo-configuration.ts`, fake port). Served with `python3 -m http.server 3106`; the server was stopped afterwards.
- `shots/`: 112 PNGs from headless Chromium (playwright 1.62.1, chromium-1223). These are at 1280×800 and 1920×1080, with a `-reduced` copy of each:
  - first capture (`logs/capture.cjs`): default, menu-open, palette, play-mode, assistant-open, byo-dialog, byo-saving, byo-saved, sculpt, kids, web and focus, plus mid-entrance frames for menu, palette and play;
  - re-run capture (`logs/capture2.cjs`): animate, ship, plugins, dock-evidence, dock-console, assistant-closed (1920 only; at 1280 it equals default), assistant-thinking (the thinking line is visible in all four runs), and the dock-glide mid frame;
  - round-4 capture (`logs/capture3.cjs`): outcome (real refusal path, item 1), assistant-ask, assistant-agent, sculpt with the hit test, and mode-glide (plus a mid frame);
  - viewport refused: real Electron, `linux/first-run-*`, where the live viewport line reads "Live viewport refused: the persisted input-action map was refused."
- Compact-tier drawers. The drawers come from media queries on the real window width:
  - assistant drawer: below 1440 wide, so it is shot at 1280×800 (`drawer-assistant-*`, plus mid);
  - left-dock and inspector drawers: below 1180 wide, so they are shot at 1100×800 (`drawer-left-*`, `drawer-inspector-*`, plus mid);
  - at 1920×1080 every column is docked and no drawer exists. That is by design (WINDOW_TIERS), so there is no 1920 drawer shot.
- Also `window-below-minimum-700x500.png`.
- `shots/audit.json` (first capture, 36 states) and `shots/audit-rerun.json` (46 states) are DOM audits. Text contrast: 0 failures; the minimum is 5.54:1 in the first capture and 6.65:1 in the re-run. Text overflow or clipping: none, apart from the CSS `font-size:0` label swaps in the web profile and the Play ring pseudo-element, both known. Rail indicator: centred on the pressed button. Each interaction's running-animation list is recorded. The tab glide shows `Animation:280ms:cubic-bezier(0.16, 1, 0.3, 1):dock-tab::after`, and reduced-motion runs show no animations. There were no page errors.
- `linux/`: real Electron (`desktop/linux/dist/main.cjs`) under `xvfb-run`, re-captured in the re-run. It shows the first-run refusal at 1280×800 and 1920×1080.
  - The BYOK surface is not installed in this state (same as BEFORE, see BASELINE.md). So `linux/assistant-routes-electron-*` (renamed from `byo-*` this round; the old `assistant-routes-details-*` copies were deleted) show only the route buttons. The BYOK surface itself is covered by `shots/byo-*`.
  - No project was opened, so there are no Electron shots of a mounted viewport or hierarchy.
- **Limitation:** my tools cannot display images, so no shot was judged by eye. The evidence for them is the DOM audit above. The advisor could not view them either. A visual pass by the final reviewer is still needed.
- `logs/`: build, test, lint, detector and attribute-count logs, plus the scripts used.

## Checks (cwd R; TMPDIR moved off the full /tmp)

Round-4 values. Logs are in `E/after/desktop/logs/*-r4.*`.

| Command | Exit |
|---|---|
| `pnpm build` | 0 |
| `pnpm exec vitest run apps/desktop-shell desktop/linux` | 0 (18 files, 282 tests) |
| five goldens + `desktop-linux-bridge-golden`, one run | 0 (6 files, 210 tests) |
| `pnpm exec vitest run tests/e2e` | not re-run in round 4. Round 2: 1, 16 failed, 572 passed. All 16 are in `desktop-editor-command-forms-golden`, the same baseline failures as `E/backup/gate-baseline.log`. No other file fails |
| `pnpm check:desktop` | 0 |
| `desktop/linux`: `pnpm build`, `pnpm run check:renderer` | 0, 0 |
| `pnpm exec eslint --max-warnings 0 apps/desktop-shell/src/chrome.ts apps/desktop-shell/src/visual-tokens.ts` | 0 |
| `pnpm lint` | not re-run. First run: 1, with 255 errors in the same 17 pre-existing files (R-5) and none outside them |
| Detector on `chrome.ts` | 0 findings. `byo-configuration.ts` was not touched in the re-run (first run: 0) |
| Detector on `chrome.html` | exit 2, 1 finding: aphoristic-cadence from contract copy (see below). Baseline was 4. Not 0, and open as Request D1 |
| Attribute counts, round 4 (`logs/attr-counts-r4.txt`, `logs/attr-count3.mjs`) | ids, aria, data-kind and data-\* equal `logs/attr-counts-rerun.txt` on every shared state (default 225/213/178/476). role reads 76, not 77, only because this counter strips the `<script>` body, which holds one `role="` string; the full document still has 77. No markup changed. |
| Attribute counts on the re-rendered states, round 2 (`logs/attr-counts-rerun.txt`) | ids, aria, role and data-kind match the first-run table (`logs/attr-counts.txt`) on all six shared renders. data-\* was counted with a stricter regex (`\sdata-…=`, script and style stripped), so its numbers sit a constant 68 below the old method on all six. The re-run changed no markup functions |

**Detector on `chrome.html`.** The baseline had 4 findings: side-tab, dark-glow, marquee and aphoristic-cadence. Three are fixed:
- dark-glow: the brand glow is removed.
- marquee: `sweep` now travels in px on its fixed-width track.
- side-tab: hierarchy rows are no longer rounded; the pinned 2px rail stays.

One finding is left, aphoristic-cadence. It comes from product and contract copy in adjacent elements, for example `MODE_PANELS.animate`: "Animation authoring is not available on this surface." then "No timeline edits are staged here." The detector joins the two because it ignores element boundaries. §10 says copy and refusal changes are not a lane decision, so it stays (Request D1).

## Deviations applied

DV-D1, DV-D2, DV-D3, DV-D4, DV-D5, DV-D6 and DV-X1, as approved. Three further visual facts, **accepted by ruling R-6** (`docs/redesign/RULINGS.md`). Round 4 recorded them in DIRECTION.md §8, in `docs/engine-desktop-surface.md` (Redesign 2026-10 table) and as `DEVIATIONS` entries in `visual-tokens.ts`:
- **DV-D7 (accepted, R-6):** the row 15 Play ring grows from `circle(25%)` instead of `circle(50%)`. At 50% the circle already covers a 24px-tall button, so nothing would visibly grow.
- **DV-D8 (accepted, R-6):** capability sentences are drawn only with the details layer (`data-details-open`), instead of truncating with an ellipsis. Without details they are visually hidden (1px clip) and stay in the accessibility tree, so screen readers still hear them, as before.
- **DV-D9 (accepted, R-6):** the web-preview `.site-eyebrow` ("Your site", mock page content) changes from an uppercase, tracked accent label to a neutral sentence-case chip (1px `--line`, `--text-2`). This removes the eyebrow pattern.
- **DV-L1 (lane Deviation, applies DV-F8):** a loading control (`button[aria-busy="true"]` and the busy assistant composer button, `chrome.ts:1206-1207`) keeps its label. After `--motion-delay-loading` a 2px `currentColor` bar draws once along the bottom edge (`ld-draw-from-start`, route 320ms expo) and holds. This is the DV-F8 in-band one-shot form, not a loop. Under reduce, the pinned blanket rule (`chrome.ts:1761`, `animation-duration:.001ms`) shows the bar static after the same delay, with no draw.

## Requests

- **D1 (copy owner):** reword one of each adjacent "X. No Y." pair in `MODE_PANELS` / dock empty states (`chrome.ts:172,175`, the asset and evidence empties), or accept it as a detector false positive. It is the only finding left on `chrome.html`.
- **D2:** closed by ruling R-6. The entries were recorded in round 4.
- **D3 (test owners, repeats R1/R2):** lift the 10px pins and the 2px rail pins so DV-X1 can close.
- **D4 (environment):** `/tmp` (16G tmpfs) is 100% full of old `.*.bun-chrome` profiles. The edit tools fail with ENOSPC, so this lane ran everything with `TMPDIR=/home/devuser/.cache/ld-tmp`.

## Final polish (2026-10-05, `reviews/final.md`)

Applied by the polish node in `apps/desktop-shell/src/chrome.ts`. Visual only; no markup, id or pinned rule changed (`chrome.test.ts:543` and `visual-tokens.test.ts:204` still match).

| Fix | Change |
|---|---|
| 4 (blocking) | The 19 unpinned off-scale declarations now use `--space-*` tokens (6/10→`--space-2`, 14/13/11→`--space-3`, 18/20→`--space-4`, 28→`--space-6`, 5→`--space-1`, 48→`--space-11`). The pinned `padding:10px 12px` stays. |
| 7 (blocking) | `.project-pill` keeps `overflow:hidden` but loses `text-overflow`; `.project-pill [data-project-status]{min-width:0;overflow:hidden;text-overflow:ellipsis}`. At 1280×800 the refusal text now ends in an ellipsis inside the pill (span 309/359px). |
| 8 (blocking) | `.primary-button.is-inert:not(:focus-visible){outline:1px dashed var(--inert-on-accent);outline-offset:-3px;cursor:not-allowed}`; the pinned label rule stays and the focus ring still wins. |
| 11 (advisory) | Regular tier: `.shell[data-assistant="open"] .assistant-toggle:not(.is-inert):hover` paints the accent edge and `--text` label. |
| 12 (advisory) | `.project-pill[data-project-state="refused"] .dot{background:var(--refuse)}`. |

Evidence (chrome rendered from the rebuilt package, `E/after/polish/scripts/render-desktop.mjs`; PNGs not viewed by eye): re-captured `E/after/desktop/shots/{default,web,dock-evidence,assistant-closed,outcome-dismissed-titlebar}-{1280x800,1920x1080}[-reduced].png`; data `E/after/polish/data/verify-desktop.json`.

Checks (cwd R, TMPDIR `/home/devuser/.cache/sxg2448052`, removed afterwards; logs in `E/after/polish/logs/`):
- `pnpm gate`: exit 1 at `pnpm test` with only the allowed baseline failures: the 16 `desktop-editor-command-forms-golden` tests and 2 `asset-preparation-bounds` deadline tests (timing; that file passes 12/12 alone). Steps before `test` passed. The two steps after it were run separately: `node --test scripts/check-contracts.test.mjs` exit 0; `pnpm lint` exit 1 with 255 errors in exactly the 17 R-5 files.
- `vitest run tests/sites packages/site-kit/test tests/e2e/editor-catalog-intake-golden.test.ts`: 1324 passed. `vitest run apps/desktop-shell`: 244 passed. `tsc -b apps/desktop-shell`: 0. `next build` umbrella, catalog-web, catalog-game: 0.
- `eslint --max-warnings 0` on the touched tsx/ts files: 0. Detector on every touched file: 0 findings.

## Final polish, round 2 (2026-10-05, `reviews/final.md` round 2)

| Fix | Change (`apps/desktop-shell/src/chrome.ts`) |
|---|---|
| 8 (advisory) | Compact drawers get the row 7 scrim. Assistant drawer (below `regular`, not when denied): `.shell[data-drawer-assistant="open"]:not([data-assistant="denied"])::after`; left dock and inspector drawers (below `compact`): `.shell[data-drawer-left="open"]::after, .shell[data-drawer-inspector="open"]::after`. Each spans title bar to status bar, `background: SCRIM.overlay` (the existing dialog scrim token), `z-index: 34` under the drawers (35/40), `pointer-events: none` (the toggle still closes the drawer). It fades in with `ld-fade` over the panel token, expo, in the no-preference block; it leaves at once on close; under reduce the blanket rule makes it instant. Written as two plain selectors because `control-accounting.test.ts` parses selector lists on `,`. |
| 9 (advisory) | `.ghost-button` and `.assistant-toggle` `border-radius: 5px` → `var(--r-control)` (10px, as `.primary-button`). |

Measured on chrome rendered from the rebuilt dist (static server on 3106, stopped): with the drawer opened at 1280×800 and 1000×700, and the left and inspector drawers at 1000×700, the scrim is present (`ld-fade` 280ms running at 120ms), and gone at once after close; under reduce no scrim animation; at 1920×1080 no scrim. All three button classes compute 10px radius. Shots: `E/after/desktop/drawer-{assistant-toggle-1280x800,assistant-toggle-1000x700,assistant-toggle-1000x700-reduced,drawer-left-1000x700,drawer-inspector-1000x700,none-1920x1080}.png`. Not re-captured: the packaged Electron window. Detector on the rendered chrome: only the contract-held `aphoristic-cadence` (fix 14).

Checks, round 2 (cwd R, TMPDIR `/home/devuser/.cache/sxg3145437`, removed afterwards; logs in `E/after/polish/r2/logs/`):
- `pnpm gate`: exit 1 at `pnpm test` with only the 16 allowed `desktop-editor-command-forms-golden` failures (312 of 313 files passed). Steps before `test` passed. The two steps after it, run separately: `node --test scripts/check-contracts.test.mjs` exit 0; `pnpm lint` exit 1 with 255 errors in exactly the 17 R-5 files (same list as `E/lint-review.log`).
- Touched suites: `vitest run tests/sites apps/web-shell/test apps/desktop-shell/test packages/site-kit/test` 1743 passed; `vitest run apps/desktop-shell/test desktop/linux/test` 282 passed; `node --test` storefront `catalog-ux-regression` + `item-session-wiring` 32 + 28 passed; `rendered-route-states.test.mjs` 4 passed; `check:sites`, `check:desktop` OK; `tsc --noEmit` umbrella, catalog-web, catalog-game 0.
- `eslint --max-warnings 0` on every touched ts/tsx file: 0. Detector on every touched file and on `sites/*/src/app`, `apps/web-shell/src`, `apps/desktop-shell/src`: 0 findings apart from the two contract-held ones (fix 14).
- `pnpm build` in umbrella, catalog-web, catalog-game ran last (04:01, 04:02, 04:03); no source is newer, so each `.next` holds the production build of this tree. All servers stopped; ports 3101-3104, 3106, 5181 free.
