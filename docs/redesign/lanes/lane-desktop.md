# lane-desktop report (port run, v6)

Date: 2026-10-05. Node: lane-desktop. Scope: DIRECTION v6 §7.6 and §7.7 (Cinematic Pro, product register). Base: R = branch `redesign-impeccable` on `origin/main` `dffefbab`.
E = `/home/devuser/Documents/Reports/sceneaxi-redesign-main`. I ran no commit, stash, reset, checkout or restore. OLD was only read: the v5 delta is `E/after/desktop/work/v5-chrome.diff` (PRE→OLD).

Skill: I loaded impeccable and ran `context.mjs --target apps/desktop-shell` (cwd R). I read `craft-floor.md`, `animate.md` and `operate.md`. The skill ships no `product.md`; `PRODUCT.md`/`DESIGN.md` came through the context output.

## Re-run against `reviews/lanes.md` § lane-desktop

- **Item 1 (blocking): closed.** New AFTER shots at 1280×800 and 1920×1080 (plus `-reduced`): `assistant-thinking`, `assistant-hosted` (details open, `assistantRoute:"hosted"`), `dock-console`, and `assistant-closed` at 1920×1080 only. At 1280 the compact drawer is closed in both the default and the closed state, so a 1280 shot would copy `default`. Linux palette: `linux/palette-{1280x800,1920x1080}.png`, opened with Control+K like the BEFORE script, with `overlay=palette` recorded in `linux/electron.json`. Scripts: `work/render.mjs` (added `assistant-hosted`), `work/capture.cjs` (static list extended, per-shot DOM facts in `shots/audit.json` → `notes`), `work/electron-capture.cjs` (palette step; isolated HOME under TMPDIR).
- **Item 2 (advisory): request only.** `visual-tokens.ts` belongs to foundation. The wording is under Requests, D2.
- **Item 3 (advisory): request only.** The copy belongs to the copy owner. It stays as D1.
- **Found and fixed in the shot pass:**
  - The selected dock tab and view tab had **no accent indicator**. The port removed main's `box-shadow:inset 0 2px 0 var(--accent)` but never added v5's `::after` bar, so the `ld-draw-x` entrance and the glide script were animating a pseudo-element that had no content. I restored v5's rule in `chrome/dock/styles.ts`. Measured: the `::after` is now absolute, 2px, and as wide as its tab (`work/layout-check.json` → `ind`). A check of every v5-added selector against R's rendered CSS (`work/port-gap.py`) finds no other missing rule. Two v5 rules are absent on purpose: the striped `::-webkit-resizer` (an impeccable stripes ban) and `.viewport [data-live-viewport]` (narrowed to `p[...]`, see Deviations).
  - At 1280×800 the File menu ran past the window bottom, so 7 commands were cut by `.shell{overflow:hidden}` and could not be reached. BEFORE cut 5, so this was pre-existing, and the taller v6 rows made it worse. `.menu-panel` now has `max-height:calc(100vh - 40px);overflow-y:auto;overscroll-behavior:contain` (`chrome/frame/styles.ts`). Now 0 items are cut.


## Files changed

| File | What changed |
|---|---|
| `apps/desktop-shell/src/chrome.ts` | `styles()` → `styles(view)` (the rail indicator reads `view.modes`). |
| `apps/desktop-shell/src/chrome/core/styles.ts` | The v5 hunks for `:root`, base, overlays, the legend, the Kids refusal, drawers, keyframes, the motion block and reduced motion. `:root` reads `CHROME_RADIUS`, `SPACING_SCALE`, `ELEVATION.float` and `MOTION_CUSTOM_PROPERTIES` (DV-P5). For selectors the refinement pass owns, the v5 values went into the **refined** strings and the matching appended block, never only into a region file. The `previous` strings changed in lockstep with their region rule in two places: the `.assistant-result` `rise .28s` and the `.scene-entity-identity` side-tab. Every pair still matches. |
| `chrome/frame/styles.ts` | Title bar, menus, profile chips, project pill (status ellipsis, refused dot), mode rail, status bar. New `modeRailIndicatorStyles(modes)`. Re-run: `.menu-panel` is capped to the window height and scrolls. |
| `chrome/dock/styles.ts` | Re-run: restored the v5 selected-tab accent bar `:is(.view-tab,.dock-tab)[aria-selected="true"]::after` (2px, top, `--accent`). Both tabs are already `position:relative`. |
| `chrome/{tree,dock,inspector,viewport,assistant,palette,settings}/styles.ts` | Region hunks: DV-D2 text floor, `--space-*` snap, hover states, tab underline on `::after`, the capability details layer (DV-D8), the `.site-eyebrow` chip (DV-D9), the live-viewport chip, sculpt progress, assistant strength fill. The main-only command forms (`settings`) moved from 8–10px to 11–12px and gained Field hover/focus/invalid states, a Button hover and a dashed disabled state. |
| `chrome/core/script.ts` | A motion-only block appended (`motionScript()`). Details are below the animation table. |
| `apps/desktop-shell/src/ui-kit.ts` | §5 states: press inset, dashed disabled edge, accent field focus. Token-only spacing; no opacity or rgba. |
| `desktop/linux/src/renderer/byo-configuration.ts` | Installed styles: 11–13px type, accent focus line, dashed disabled edge, no colour transition, and an entrance keyframe on `:not([hidden])`. `aria-busy` is set on Save/Remove while a request is in flight. It is never painted after teardown (`signal.aborted` guard). |

Unchanged: `visual-model.ts`, `app.ts`, `icons.ts`, `features/overlay-report.ts` (the chrome CSS styles its lines through `.viewport p[data-live-viewport]`), `viewport*.ts`, `assistant-*.ts`, `playback-report.ts`, `chrome-document.ts` (it re-hashes the inline script, so the CSP is unchanged) and `byo-configuration-view.ts`. No markup, id, `data-*`, aria role or label, command id, route or copy changed.

**Scope note.** The contract's OWN list names `visual-model.ts`, `app.ts`, `assistant-*.ts` and `chrome-document.ts`. DIRECTION v6 §9 (which wins) gives me `chrome/**`, `ui-kit.ts`, `icons.ts`, `features/overlay-report.ts` (styles only), and makes `visual-model.ts`, `app.ts` and `assistant-*` read-only. I edited only files §9 marks edit.

## Animation table

Every keyframe animates only opacity, `translate`/`transform`, `clip-path` or `filter`. There is no `scale()`, and no opacity outside `@keyframes`. Entrances key on `:not([hidden])` or on existing state attributes, and exits are instant. Reduced motion: the pinned blanket rule (`animation-duration:.001ms`) comes first, then the `MOTION_REDUCED_CUSTOM_PROPERTIES` overrides. The script skips every glide and wipe under reduce. Measured: 0 running animations in all reduced-motion runs (`shots/audit.json` → `anims`).

| Interaction | Selector / mechanism | Motion (tokens) | Reduced motion |
|---|---|---|---|
| Menu open | `.menu-panel:not([hidden])` | `ld-drop` 4px + fade, state 200ms expo | instant |
| Command palette / outcome dialog | `.overlay:not([hidden])` scrim; `.overlay-card` | scrim `ld-fade`; card `ld-dialog` (8px + clip-path inset + fade), panel 280ms expo; palette groups stagger 40ms, capped at 200ms | instant, no stagger |
| Toolbar (mode rail) tool select | `.mode-rail::after`, `--rail-i` per pressed mode via `:has()` in `@supports` | one bar glides by a `translate` transition, panel 280ms expo. Measured centred on every mode, details open and closed (`work/rail-check.json`, delta 0) | jumps |
| View / dock tab indicator | `[aria-selected="true"]::after` | glides from the previous tab (`translateX` + `clip-path`, Web Animations, 280ms expo); CSS `ld-draw-x` on first paint | in place |
| Hierarchy expand/collapse, row hover, drag-over | `.scene-entities:not([hidden])`, `dl` on details open; `.is-selected` | rise 4px, state quint; `ld-settle` brightness 1.4→1 on select; row hover is an instant paint. **Drag-over: n/a.** The chrome has no drag behaviour on main. | instant |
| Inspector field focus / commit / refusal | focus: instant accent line (row 3). Commit/refusal: `[data-scene-property-diagnostic]`, command-form `[aria-live]` text change → wipe | clip-path wipe + 4px, state 200ms quint | text swaps |
| Panel dock / resize affordance | `.dock-tabpanel`, `.dock-panel`, `.inspector-panel` on `:not([hidden])`. Drawers: `ld-in-left/right` 16px plus scrim `ld-fade` | panel 280ms expo | instant. Resize: n/a, because no splitter is rendered in the chrome (the `ui-kit` splitter is not emitted) |
| Play mode enter / exit | `.shell[data-mode="run"] .viewport::after` aperture `inset(48% 0)`→`inset(0)`, route 320ms expo. Play ring `::before` `circle(25%)`→`circle(75%)` + fade (DV-D7) | exit is instant | frame shown, no ring |
| Viewport overlay / gizmo hover | `.viewport p[data-live-viewport]` chip rise, state quint; text change → wipe; canvas fade on mount; manipulators rise; hover is an instant paint | transform/opacity only over the viewport, no box-shadow or blur animation | instant |
| Assistant stream-in | `.assistant-result` `ld-rise-sm` micro 160ms quart (all six `rise` declarations mapped). Thinking/Retry rise; `[data-assistant-status]` wipe; `assistant-bars` on R-2 tokens | | bars hidden (existing rule) |
| Assistant strength (ask/build/agent) | `.assistant-mode[aria-pressed="true"]::before` | fill glides from the previous mode, 280ms expo | in place |
| BYO dialog open / validate | `.desktop-byo-config:not([hidden])` `desktop-byo-config-in`, panel expo. State and message text → wipe. Save/Remove `aria-busy` → 2px bar after `--motion-delay-loading` (DV-L1) | | instant; static bar |
| Status bar / toast | `.status-text`, `.status-pin`, `[data-project-status]`, `.runtime-report`, `[data-product-run-report]`, `[data-change-badge]`, `.sculpt-detail`, ship and project-browser digests → wipe. No toast component exists (n/a) | | text swaps |
| Sculpt running | `.sculpt-progress` `ld-rise-md` panel expo; `sweep` on `var(--motion-duration-loop) var(--motion-ease-out-quart) infinite`, px travel | | sweep hidden |
| Window below minimum | `.window-refusal` `ld-rise-md` when shown | | instant |
| Rows 14 and 18 | n/a, as in v5: no row is decided in place, and the palette and drawers render synchronously | | |

Control states: hover is an instant paint (tabs, routes, entities, fields, rail and toggle hover added). Focus-visible keeps the pinned accent outline plus 4px well. Press keeps the pinned `box-shadow:inset`. Disabled is painted: a dashed edge on inert ghosts, routes, shortcuts and manipulators; a dashed inset outline on the inert primary; `button:disabled` uses `--inert`. Loading is `aria-busy`, or Send while the assistant is busy, and draws the DV-L1 bar. ui-kit loading: n/a, because no ui-kit control goes busy and the chrome does not emit ui-kit.

Motion script (end of `core/script.ts`). At boot it calls `finish()` on finite CSS animations, so the first paint has no choreography. One `MutationObserver` drives the live-line wipes and the tab and assistant-mode glides. The script reads and writes no state, hook, id, role or label (it toggles only its own `is-gliding` class). It returns early when `MutationObserver` or `Element.animate` is missing (jsdom/goldens), and `observe` sits in a `try`.

Rendered-chrome counts (`E/after/desktop/counts.txt`, 15 states): 0 `animation:assistant-(breathe|spin|glow|dot|card)`, 0 `@keyframes assistant-card`, 0 `rise .28s`, 0 `animation:rise`. `assistant-bars` and `sweep` each appear once on the R-1 tokens.

## Evidence (`E/after/desktop/`)

- `chrome.html`: `renderDesktopChrome` default output. `states/*.html`: 15 states plus `chrome-byo*.html`, which mounts the real BYOK surface through `harness/byo-harness.js` (an esbuild bundle of R's `byo-configuration.ts` with a fake port). Script: `work/render.mjs`. BEFORE render: `before-render/`.
- Served with `python3 -m http.server 3206` (cwd E/after/desktop). **Port 3206, not 3106.** Hard rule 9 assigns desktop 3206, and OLD may hold 31xx. The server is stopped. The browser was headless Chromium 1223 (playwright-core 1.63) with its own contexts. No shared tab tool was available.
- `shots/`: 115 PNGs, re-captured from the re-run build (64 non-reduced plus 51 `-reduced`). Sizes: 1280×800 and 1920×1080. States: default, menu-open (+mid), palette (+mid), outcome (real refusal path: `File > Open Project` → "Project lifecycle refused", `DESKTOP_RUNTIME_UNAVAILABLE`), play-mode (+mid), assistant-open, assistant-ask (+ mode-glide mid), assistant-agent, **assistant-thinking**, **assistant-hosted**, **assistant-closed (1920)**, dock-tab (+ glide mid), dock-evidence, **dock-console**, byo-dialog (+mid), byo-saving (`aria-busy="true"` confirmed), byo-saved, sculpt, animate, ship, details, kids, web, focus. Also drawer-left (+mid) and drawer-inspector at 1100×800, drawer-assistant at 1280×800, and window-below-minimum at 700×500.
- **Duplicates:** an md5 scan over `shots/` finds no shot byte-identical to a different state. The only identical pairs are `<state>-<size>.png` and its `-reduced` twin. Each is the same settled state captured once with reduced motion. That they match is the reduced-motion proof (same end frame, 0 running animations).
- `shots/audit.json`: DOM audit of 94 state/size runs. Text contrast minimum is 4.9:1 (the outcome dialog), with 0 failures under 4.5:1. 0 document overflow and 0 page errors. The only overflow entries are the Play button's ring pseudo-element (`::before` at `inset:-4px`; decorative, opacity 0 at rest). Measured with reduced motion: 0 running animations in every run.
- `linux/`: real Electron (`desktop/linux/dist/main.cjs` after `pnpm build` in `desktop/linux`, launched under `xvfb-run -a` through playwright `_electron`, the same entry `pnpm start` uses), with an isolated HOME. It covers first-run, BYO route and **palette** at 1280×800 and 1920×1080. `electron.json` records the live line "Live viewport refused: the desktop bridge is not exposed.", no canvas, and `overlay=palette`. The BYOK form is not mounted in first-run, so `byo-*.png` shows the routes only. `desktop/linux/pnpm-lock.yaml` is unchanged (sha256 checked).
- Review sheets: `compare/*.png` has BEFORE on top and AFTER below, at 1280px wide, one sheet per shot (70). Script: `work/compare.py`.

### Per-shot check

**I did not look at the images by eye.** My read tool refuses PNGs ("Cannot read binary file"). I asked the run's advisor, which cannot view images either. A human or image-capable reviewer still needs to look at `compare/`, starting with the five new states.

Instead, each shot was checked by machine:

- **Pixel facts** (`work/pixel-check.py` → `work/pixel-check.json`): blank-frame test (stdev), the share of pixels changed against the mapped BEFORE, and the md5.
- **DOM audit** (`shots/audit.json`).
- **Layout check** of the same state at the same size (`work/layout-check.cjs` → `work/layout-check.json`). It looks for:
  - text clipped without an ellipsis;
  - text cut by a clipping ancestor;
  - overlapping painted text boxes;
  - text under 11px;
  - the selected tab's indicator rect.

The same layout check on the BEFORE render is in `work/layout-check-before.json`: 0 clipped and 0 overlaps, but 5 menu items cut at 1280 and 12–68 labels under 11px per state. No shot is a near-uniform frame. Lines are generated by `work/shot-lines.py`:

- `shots/animate-1280x800.png`; vs BEFORE `animate-1280x800`: 5.74% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/animate-1920x1080.png`; vs BEFORE `animate-1920x1080`: 3.64% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/assistant-agent-1280x800.png`; vs BEFORE `assistant-agent-1280x800`: 10.6% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/assistant-agent-1920x1080.png`; vs BEFORE `assistant-agent-1920x1080`: 5.63% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/assistant-ask-1280x800.png`; vs BEFORE `assistant-ask-1280x800`: 10.47% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/assistant-ask-1920x1080.png`; vs BEFORE `assistant-ask-1920x1080`: 5.56% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/assistant-closed-1920x1080.png`; vs BEFORE `assistant-closed-1920x1080`: 5.16% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0; docked column gone (1920 only; at 1280 the drawer is closed in both states).
- `shots/assistant-hosted-1280x800.png`; vs BEFORE `assistant-hosted-1280x800`: 12.35% px changed; contrast min 5.89, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0; details open, route group drawn, #assistant-route-hosted aria-pressed=true.
- `shots/assistant-hosted-1920x1080.png`; vs BEFORE `assistant-hosted-1920x1080`: 6.3% px changed; contrast min 5.89, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0; details open, route group drawn, #assistant-route-hosted aria-pressed=true.
- `shots/assistant-mode-mid-1280x800.png`; mid-transition frame (md5 differs from the settled frame).
- `shots/assistant-mode-mid-1920x1080.png`; mid-transition frame (md5 differs from the settled frame).
- `shots/assistant-open-1280x800.png`; vs BEFORE `default-1280x800`: 10.75% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/assistant-open-1920x1080.png`; vs BEFORE `default-1920x1080`: 5.7% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/assistant-thinking-1280x800.png`; vs BEFORE `assistant-thinking-1280x800`: 10.63% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0; drawer/column open, thinking line drawn.
- `shots/assistant-thinking-1920x1080.png`; vs BEFORE `assistant-thinking-1920x1080`: 5.64% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0; drawer/column open, thinking line drawn.
- `shots/byo-dialog-1280x800.png`; vs BEFORE `plugins-details-1280x800`: 16.64% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/byo-dialog-1920x1080.png`; vs BEFORE `plugins-details-1920x1080`: 6.65% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/byo-dialog-mid-1280x800.png`; mid-transition frame (md5 differs from the settled frame).
- `shots/byo-dialog-mid-1920x1080.png`; mid-transition frame (md5 differs from the settled frame).
- `shots/byo-saved-1280x800.png`; vs BEFORE `plugins-details-1280x800`: 16.64% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/byo-saved-1920x1080.png`; vs BEFORE `plugins-details-1920x1080`: 6.73% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/byo-saving-1280x800.png`; vs BEFORE `plugins-details-1280x800`: 16.64% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/byo-saving-1920x1080.png`; vs BEFORE `plugins-details-1920x1080`: 6.66% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/default-1280x800.png`; vs BEFORE `default-1280x800`: 8.23% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0; selected dock and view tab carry the 2px accent bar.
- `shots/default-1920x1080.png`; vs BEFORE `default-1920x1080`: 5.62% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0; selected dock and view tab carry the 2px accent bar.
- `shots/details-1280x800.png`; vs BEFORE `plugins-details-1280x800`: 8.92% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/details-1920x1080.png`; vs BEFORE `plugins-details-1920x1080`: 6.31% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/dock-console-1280x800.png`; vs BEFORE `dock-console-1280x800`: 7.36% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0; active dock tab reads Console.
- `shots/dock-console-1920x1080.png`; vs BEFORE `dock-console-1920x1080`: 5.2% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0; active dock tab reads Console.
- `shots/dock-evidence-1280x800.png`; vs BEFORE `dock-evidence-1280x800`: 7.44% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/dock-evidence-1920x1080.png`; vs BEFORE `dock-evidence-1920x1080`: 5.24% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/dock-glide-mid-1280x800.png`; mid-transition frame (md5 differs from the settled frame).
- `shots/dock-glide-mid-1920x1080.png`; mid-transition frame (md5 differs from the settled frame).
- `shots/dock-tab-1280x800.png`; vs BEFORE `dock-changes-1280x800`: 7.94% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0; accent top bar drawn on the selected tab (::after was missing from the port; restored).
- `shots/dock-tab-1920x1080.png`; vs BEFORE `dock-changes-1920x1080`: 5.53% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0; accent top bar drawn on the selected tab (::after was missing from the port; restored).
- `shots/drawer-assistant-1280x800.png`; vs BEFORE `assistant-open-drawer-1280x800`: 10.58% px changed; contrast min 6.16, 0 fails, doc overflow 0.
- `shots/drawer-inspector-1100x800.png`; vs BEFORE `drawer-inspector-1100x800`: 8.67% px changed; contrast min 6.16, 0 fails, doc overflow 0.
- `shots/drawer-left-1100x800.png`; vs BEFORE `drawer-left-1100x800`: 8.54% px changed; contrast min 6.16, 0 fails, doc overflow 0.
- `shots/drawer-left-mid-1100x800.png`; mid-transition frame (md5 differs from the settled frame).
- `shots/focus-1280x800.png`; vs BEFORE `focus-1280x800`: 8.3% px changed; layout: clipped 0, cut 0, overlap 0, <11px 0; focus ring on the 2nd tab stop.
- `shots/focus-1920x1080.png`; vs BEFORE `focus-1920x1080`: 5.65% px changed; layout: clipped 0, cut 0, overlap 0, <11px 0; focus ring on the 2nd tab stop.
- `shots/kids-1280x800.png`; vs BEFORE `kids-1280x800`: 4.21% px changed; contrast min 5.54, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/kids-1920x1080.png`; vs BEFORE `kids-1920x1080`: 2.08% px changed; contrast min 5.54, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/menu-open-1280x800.png`; vs BEFORE `menu-open-1280x800`: 9.38% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0; File menu capped to the window height and scrolls (at 1280x800 BEFORE cut 5 items, the previous AFTER 7, now 0).
- `shots/menu-open-1920x1080.png`; vs BEFORE `menu-open-1920x1080`: 6.56% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0; File menu capped to the window height and scrolls (at 1280x800 BEFORE cut 5 items, the previous AFTER 7, now 0).
- `shots/menu-open-mid-1280x800.png`; mid-transition frame (md5 differs from the settled frame).
- `shots/menu-open-mid-1920x1080.png`; mid-transition frame (md5 differs from the settled frame).
- `shots/outcome-1280x800.png`; vs BEFORE `outcome-1280x800`: 5.79% px changed; contrast min 4.9, 0 fails, doc overflow 0; real refusal path, DESKTOP_RUNTIME_UNAVAILABLE.
- `shots/outcome-1920x1080.png`; vs BEFORE `outcome-1920x1080`: 3.67% px changed; contrast min 4.9, 0 fails, doc overflow 0; real refusal path, DESKTOP_RUNTIME_UNAVAILABLE.
- `shots/palette-1280x800.png`; vs BEFORE `palette-1280x800`: 5.98% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/palette-1920x1080.png`; vs BEFORE `palette-1920x1080`: 4.07% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/palette-mid-1280x800.png`; mid-transition frame (md5 differs from the settled frame).
- `shots/palette-mid-1920x1080.png`; mid-transition frame (md5 differs from the settled frame).
- `shots/play-mode-1280x800.png`; vs BEFORE `run-1280x800`: 5.56% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0; aperture frame and Play ring settled.
- `shots/play-mode-1920x1080.png`; vs BEFORE `run-1920x1080`: 3.61% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0; aperture frame and Play ring settled.
- `shots/play-mode-mid-1280x800.png`; mid-transition frame (md5 differs from the settled frame).
- `shots/play-mode-mid-1920x1080.png`; mid-transition frame (md5 differs from the settled frame).
- `shots/sculpt-1280x800.png`; vs BEFORE `sculpt-running-1280x800`: 10.28% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/sculpt-1920x1080.png`; vs BEFORE `sculpt-running-1920x1080`: 5.87% px changed; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/ship-1280x800.png`; no BEFORE state; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/ship-1920x1080.png`; no BEFORE state; contrast min 6.16, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 0.
- `shots/web-1280x800.png`; no BEFORE state; contrast min 7.01, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 1, <11px 2; 1280: overlap hit is .change-empty under the dock-body scroll edge (clipped by the scroller, not painted over the status bar); viewport note sits lower in the scrollable stage because the capability chips now wrap readable labels instead of 34px truncated boxes; 2 0px labels are main's web-profile rule (core/styles.ts:171,173).
- `shots/web-1920x1080.png`; no BEFORE state; contrast min 7.01, 0 fails, doc overflow 0; layout: clipped 0, cut 0, overlap 0, <11px 2; 1280: overlap hit is .change-empty under the dock-body scroll edge (clipped by the scroller, not painted over the status bar); viewport note sits lower in the scrollable stage because the capability chips now wrap readable labels instead of 34px truncated boxes; 2 0px labels are main's web-profile rule (core/styles.ts:171,173).
- `shots/window-below-minimum-700x500.png`; no BEFORE state; contrast min 10.01, 0 fails, doc overflow 0.
- `linux/byo-1280x800.png`; BYO route pressed; BYOK form not mounted in first-run (no BEFORE).
- `linux/byo-1920x1080.png`; BYO route pressed; BYOK form not mounted in first-run (no BEFORE).
- `linux/first-run-1280x800.png`; vs BEFORE `desktop-linux/first-run-1280x800`: 9.54% px changed; live line: report: Live viewport refused: the desktop bridge is not exposed..
- `linux/first-run-1920x1080.png`; vs BEFORE `desktop-linux/first-run-1920x1080`: 6.53% px changed; live line: report: Live viewport refused: the desktop bridge is not exposed..
- `linux/palette-1280x800.png`; vs BEFORE `desktop-linux/palette-1280x800`: 6.81% px changed; overlay=palette, palette drawn=True (Control+K, as BEFORE).
- `linux/palette-1920x1080.png`; vs BEFORE `desktop-linux/palette-1920x1080`: 4.72% px changed; overlay=palette, palette drawn=True (Control+K, as BEFORE).

## Checks

All commands ran with cwd R. Re-run TMPDIR: the short `/home/devuser/.cache/sx<pid>` recorded in `work/tmpdir-3.txt`, removed afterwards. Logs are in `E/after/desktop/work/`; the re-run logs carry the `-3`/`-4` suffix. The failure lists are compared with the pre-edit logs (`*-before.*`, `e2e-desktop-1.fails`), and those match `E/backup/gate-baseline.log`.

| Command | Exit | Result |
|---|---|---|
| `pnpm build` | 0 | `build-4.log` (after both re-run edits) |
| `pnpm exec vitest run apps/desktop-shell` | 0 | 42 files passed (`unit-desktop-shell-3.log`) |
| `pnpm exec vitest run apps/desktop-shell desktop/linux` | 1 | 22 failed / 403 passed (`unit-3.log`). All 22 are in the main baseline: `byo-terminal-lifecycle` 6, `viewport-terminal-lifecycle` 14, `local-rpc` 2 (socket path over 107 bytes). 0 new against `unit-before.fails`. |
| the five goldens (`desktop-control-inventory`, `-command-interactions`, `-workspace-layout`, `-hierarchy`, `-transform`) | 1 | 100 failed / 30 passed (`goldens-3.log`). All 100 are in `desktop-command-interactions-golden` and in the baseline. The other 4 files pass. 0 new against `goldens-before.fails`. |
| `vitest run tests/e2e/desktop-chrome- tests/e2e/desktop-editor-command-forms-golden tests/e2e/desktop-linux-bridge-golden` | 1 | 13 failures (frame/inspector/palette command-interactions), all in the baseline. 0 new (`e2e-desktop-3.fails`). |
| `pnpm run --silent check:desktop` | 1 | The same single baseline problem: "pnpm-workspace.yaml globs desktop/". Identical to the gate baseline stage (`check-desktop-3.log`). |
| `desktop/linux`: `pnpm build`, `pnpm run --silent check:renderer` | 0, 0 | `linux-build-4.log`, `linux-check-renderer-4.log` |
| `pnpm exec eslint --max-warnings 0` on the 2 re-run files | 0 | `eslint-3.log`. The first run's 13-file eslint pass also exited 0. |
| Detector on the 2 re-run source files | 0 findings | `detector-src-3.log` |
| Detector on `chrome.html` and every `states/*.html` | exit 2, 1 finding | `detector-html-3.log`: the same `aphoristic-cadence` copy finding as before (`core/panels.ts:43,46`). Request D1. |
| Markup counts (ids / aria / role / data-\* / data-command) | equal | `before-render/counts.txt` and `counts.txt` match for all 15 shared states (default 261/261/76/677/83). The new `assistant-hosted` row is 261/261/76/677/83. |
| Lockfiles | unchanged | `desktop/linux/pnpm-lock.yaml` sha256 OK (`linux-lock-3.before`). No install was run. |

**Not met as written: "checks exit 0".** The combined vitest run, the five goldens and `check:desktop` exit 1 on unchanged main, and they still do. Every failure is the same as the baseline, and none is new (hard rule 7). `apps/desktop-shell` alone exits 0.

## Deviations applied

- Applied: DV-D1, DV-D2, DV-D3, DV-D4, DV-D5, DV-D6 (R-1/R-2: `assistant-bars` and `sweep` retimed), DV-D7, DV-D8, DV-D9, DV-L1, DV-P5 (port names) and DV-P7 (none of the five loops re-added). DV-X1 rails are kept (pinned).
- Lane-level, visual only:
  - the live-viewport chip uses a solid `--well` fill, not v5's 88% `color-mix` (no translucent glass over the canvas);
  - the selector is `.viewport p[data-live-viewport]`, because on main the canvas also carries `data-live-viewport="canvas"` and must not get chip padding or a border.

## Requests

- **D1 (copy owner):** reword one sentence in each adjacent "X. No Y." pair in `MODE_PANELS` (`chrome/core/panels.ts:43,46`), or accept it as a detector false positive. It is the only finding left on `chrome.html`.
- **D2 (foundation, `apps/desktop-shell/src/visual-tokens.ts`, `DEVIATIONS` row `dv-d6-loading-loop`):** the row still says "lane-desktop will retime … (until then the chrome still ships 0.9s ease-in-out and 1.1s linear)". The retiming has landed: `assistant-bars` and `sweep` both run on `var(--motion-duration-loop) var(--motion-ease-out-quart) infinite`, once each in the rendered chrome (`E/after/desktop/counts.txt`). Proposed wording: "lane-desktop retimed `assistant-bars` and `sweep` onto the R-1/R-2 loop tokens (`--motion-duration-loop`, ease-out-quart); `sweep` travels in px." Drop the "until then …" clause. (Review item 2, advisory.)
- **D3 (test owners, repeats R1/R2):** lift the two 10px pins and the 2px rail pins so DV-X1 can close.
- **D4 (environment):** `local-rpc.test.ts` needs a TMPDIR shorter than `/home/devuser/.cache/sx<7-digit pid>`. Its socket path reaches about 110 bytes there, and these 2 baseline failures persist with the contract's TMPDIR form.
