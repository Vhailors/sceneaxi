# Lane report: lane-umbrella (port run, DIRECTION v6)

Date: 2026-10-05. First run on R (`redesign-impeccable`, on top of `dffefbab`). `docs/redesign/reviews/lanes.md` did not exist, so this was a full run. A re-run on the same day closed the `## lane-umbrella` items in `reviews/lanes.md`; see "Re-run" below. Sources: DIRECTION v6 (§0.1, §5, §6, §7.1, §7.2, §7.2.1, §8.1, §9, Port notes), RULINGS R-1..R-9, the v5 lane report, the v5 result in OLD (read only) and the PRE tree in `E/port/pre`.

Skill: I ran `context.mjs --target sites/umbrella/src/app` (cwd R). It exited 1 with `NO_PRODUCT_MD`, as DIRECTION §0 predicts for site roots, so I used `R/PRODUCT.md`, `R/DESIGN.md` and DIRECTION directly. I read `animate.md` and `craft-floor.md`. No browser-tab tool was available, so all browser work used headless Chromium 1223 through R's `playwright-core`.

## Method

- **TSX.** For each file I ran a three-way merge: main, then PRE as the base, then OLD (`git merge-file`, done in a scratch copy).
  - Clean ports (main = PRE) came out equal to the v5 result: `account`, `admin/ledger`, `sculpt-viewport`, both `loading.tsx`, `editor/page`, `web-experience-editor`, `error`, `not-found`, `live-viewport`.
  - `editor-shell` and `profiles` merged with no conflicts, as did the `docs/page` re-target.
  - I resolved 9 conflicts by hand in `page.tsx`, `engine`, `pricing`, `open`, `login` and `help-doc-page`. Main's markup and wrappers stayed in every case: `RELEASE_PATHS`, `scroll-frame`, the `region` scrollers, `auth-layout`/`auth-card`, `tier-foot` and the docs rail. The v5 classes and the eyebrow removals went on top.
- **globals.css.** Main's editor section equals PRE apart from 2 lines, so the v5 editor section applied cleanly.
  - The site layer is the v5 sheet plus a new "Main-only surfaces" block in the v5 vocabulary. That block covers ProofFigure, `hero-stage*`, `scroll-frame`, path route/label, `auth-*`, `open-stage`, `docs-shell-doc`, docs rail `aria-current`, `doc-links`, `tier-head`/`tier-foot`, `button-lg`, the external-link glyph, the `/login` nav separator and the short-height rules.
  - A script then rewrote every transition to D-4 (DV-P2) and removed every state transform that is not `translateX(3px)` or `scale(1.015)` (DV-P3).
  - The file went from 5913 lines (main) to 6112 (6106 after the first run, plus the re-run's `.ed-project-save` wrap).

## Files

| File | Change |
|---|---|
| `src/app/globals.css` | Rebuilt as described above. No hex. No eyebrow, glass, side rail, grid background or ghost shadow. |
| `src/lib/foundations.ts` | R-9 grant: composes `foundationsMotionCss()` into `umbrellaFoundationsCss()`; `bandPad` 104px → 72px. |
| `page.tsx` | H1 as two `.hero-line` spans in `.title-row.hero-title`. The release marker is now a `span.badge.chip.chip-needs-review.release-chip` after the H1. The "Recorded Linux build" eyebrow is gone. `data-link-list="arrows"` added to the path links. |
| `engine/page.tsx` | 3 eyebrows became chips after their headings or were dropped. The packages are a mono `pkg-list`. Notes became `prose-notes` (the `note-card-info` is now `prose-note-info`). `.command-label`. |
| `profiles/page.tsx` | Eyebrow dropped. `profile-compare` (Game, Web). Kids is an Isolated `StatePanel` with no href. |
| `pricing/page.tsx` | `tier-flag` is a sentence-case chip ("Best rate per credit"; the text is not test-pinned). `tier-status`, `tier-purchase` and `tier-purchase-blocked` classes inside main's `tier-foot`. Note cards became one prose block. |
| `open/page.tsx` | Eyebrow became a Dormant chip. The panels became `prose-notes`. `dl-machine`. `instance-table` inside main's region scroller. |
| `login/page.tsx` | `page page-narrow page-state` around main's `auth-layout`. The form is `auth-card form-card`. Eyebrows dropped. Actions, field names, hidden inputs and copy are unchanged. |
| `docs/page.tsx`, `docs/_components/help-doc-page.tsx` | Guide lists. Rule card with an Info chip. The article gets `docs-article` and `data-doc`. Related links are a guide list (title + glyph + mono route). |
| `account`, `admin/ledger`, `editor/page`, `web-experience-editor`, `error`, `not-found`, `docs/loading`, `editor/loading`, `live-viewport`, `sculpt-viewport`, `editor-shell` | v5 result (clean ports). `useIndicatorGlide` is in `editor-shell.tsx`, the only allowed client file. |
| `VISUAL-EVIDENCE.md` | "Redesign 2026-10" section. |

Unchanged: `layout.tsx`, `site-nav.tsx`, `hero-viewport.tsx`, `download-cta.tsx`, `capability-table.tsx`, `state-panel.tsx`, `proof-figure.tsx`, `editor-viewport.tsx`, `editor/layout.tsx`, `opengraph-image.tsx`. I did not touch `api/**`, `_session.ts`, `project-persistence.ts`, `middleware.ts`, `provider/**` or `src/lib/**` (except the R-9 grant).

**Hook count** (`data-*=`, `id=`, `aria-*`, `role=`, HEAD → now). No file went down:
- page 24→25, engine 11→12, docs 14→16, help-doc 7→8, admin 8→11, editor/page 3→8, editor-shell 76→81, webxp 26→27, open 2→4, profiles 3→4, live-viewport 1→2, error 0→1, not-found 0→1, each loading 3→4;
- unchanged: account 4, pricing 5, login 6, sculpt-viewport 4.

## Port deviations taken here (beyond DIRECTION §8.1)

1. **Arrows are text glyphs.** v5 drew the card-link arrow as a rotated CSS chevron. The pinned hover transform must be exactly `translateX(3px)` (`umbrella-visual.test.ts:438-452`), and a rotated chevron cannot satisfy that. So every card-link arrow is now `→`: either main's markup `.glyph` (path links, doc links, proof link) or `content: "→" / ""` (D-7).
2. **Hero head stays in the copy column.** At ≥1025px the v5 H1 + chip row across both columns gave a 633px stage and a rail top of 803 at 1440×900. DV-P9 therefore applies its fallback: the columns are 0.85/1.15, the hero padding is 44, the H1 is a balanced block, and the chip wraps under its last line.
3. **Phone nav.** At ≤620px, v5's 4-column nav grid made the masthead 158px at 390, against a pin of ≤104. The nav is now one scrolling row of 44px targets with an edge fade that lifts on focus, which gives 96px.
4. **12px step removed from `/`.** `.hero-stage-note`, `.proof-history` and `.footer-version` are now 13px, so `/` renders exactly 9 sizes.
5. **Hover moves.** Lane-level hover lifts and nudges are paint only (DV-P3): profile cards, tiers, wordmark, store dot, ledger chevron (it now brightens instead) and the editor rail glyph.

## Animation table

Every transition reads `var(--motion-fast|base) var(--ease-standard)` (DV-P2). Every keyframe reads `--motion-duration-*` / `--motion-ease-out-*`. Entrances run only inside `no-preference`. Under `reduce`, site-kit zeroes the distances, a reduce block drops the nudges and indicator transitions, and the R-1 bars go static.

| Element | Trigger | Motion (tokens) | Reduced motion |
|---|---|---|---|
| Masthead hairline `.masthead::after` | scroll 0–24px | `sa-hairline` opacity, `animation-timeline: scroll()` | line at opacity 1 |
| Nav current indicator | page arrival | `sa-draw-center` clip-path, panel + expo | shown at once |
| Nav hover indicator | hover | clip-path `inset(0 50%)`→`inset(0)`, base + standard | jumps (transition none) |
| Mobile menu | — | n/a: there is no menu. The nav is always visible (one scrolling row at ≤620), and `site-nav.tsx` may not hold state (pinned client list) | — |
| CTA / button state layer | hover / press | `::before` opacity 0→.08→.12, fast + standard; press has no scale (DV-P3) | same (opacity only) |
| Button focus halo | focus-visible | halo opacity, fast; the outline itself is instant | same |
| Button / `.loading-bar` busy | `aria-busy` / loading fallbacks | `sa-progress`, loop + quart, `delay-loading` (R-1) | static 40% bar |
| Card-link arrows (`→`) | hover | `translateX(3px)`, base + standard | `none` |
| Proof capture media | hover | `scale(1.015)` inside `.proof-frame`, base | `none` |
| Persuade head (`/`, `/engine`, `/profiles`, `/pricing`) | first paint | `sx-rise-lg`, route + expo, 40ms stagger, max 3 items | static |
| Hero and `/open` canvas | first paint | `sa-aperture` clip-path inside the visible frame, route + expo | canvas at once |
| Hero overlay, provenance note, download context | appear | `sx-rise-sm`, state + quint | static |
| Pricing tiers | first paint | `sx-rise-sm`, panel + expo, `nth-child` stagger | static |
| Pricing pack selection | hover / focus-within | frame paint (`--line-strong`; accent on focus-within) | same |
| Purchase block `aria-disabled` | always | painted disabled (dashed, `--fg-2`, not-allowed), no layer | same |
| Login / admin field `.field::after` | focus / `:user-invalid` | focus line draws from centre, base + standard; turns red when invalid | jumps |
| Login submit loading | — | `aria-busy` style written; not shown, because a client marker would breach the pinned client list (§8.2) | — |
| State panel underline `.state-head::after` (and toast/status lines) | panel appears | `sx-draw`, state + quint; `main p[role=status]` `sx-rise-sm` | line present |
| 404 / error chip | first paint | `sx-rise-sm`, state + quint | static |
| Account balance `.ledger-balance` | arrival | `sa-number-in`, state + quint | at once |
| `/open` counters | value change (keyed cells) | `sa-number-in`, state + quint | swap |
| Admin ledger rows | hover / open | row paint plus chevron brighten; chevron rotates on open (base); record `sx-rise-sm`; close is instant | no rise |
| Docs rail current item | page arrival / `:target` | `sa-draw-y` clip-path, panel + expo; hover indicator clip-path, base | jumps |
| Code-copy feedback | — | n/a: no copy control exists, and §10 names copy buttons as non-lane behaviour | — |
| Editor mode rail, view and dock tabs | tool or tab selection | `useIndicatorGlide` (translate + clip-path, panel + expo); first paint `sa-draw-y` / `sa-draw-center` | skipped on reduce |
| Editor panels, palette, drawer | open | `sx-rise-sm`, `sa-dialog-in`, `sa-drawer-in` (panel + expo); close is instant | static |

Probe (`_work/motion-probe.json`, 1440, `no-preference`). Each route type runs its own set of animations:
- `/`: `sx-rise-lg` on the head, `sa-aperture`, overlays.
- `/pricing`: rise plus `sx-rise-sm` on the tiers.
- `/open`: aperture plus `sa-number-in`.
- docs: `sa-draw-y` only.
- `/login`, `/account`, `/admin/ledger`: `sx-draw` only.
- 404: the chip rise.

Under `reduce`, all 12 probed routes run 0 animations. A pointer hover gives the path-link glyph `matrix(1,0,0,1,3,0)`, the nav hover indicator `inset(0px)`, and the button layer opacity .08 over `0.12s cubic-bezier(0.2,0,0,1)`.

## Evidence

E = `/home/devuser/Documents/Reports/sceneaxi-redesign-main`.

- **Shots:** 93 PNGs in `E/after/umbrella/`, no two byte-identical (`md5sum`):
  - `<state>-{390,768,1440}.png` plus `<state>-1440-reduced.png` for 22 states: home, engine, profiles, pricing, open, docs, docs-getting-started, docs-cli, docs-credits-and-pricing, docs-faq, login, account, **editor** (refused, no preview flag), **editor-preview** (preview shell), admin-ledger, 404, error-boundary, docs-loading, editor-loading, pricing-checkout-cancelled, pricing-reason, account-checkout-success;
  - editor shell with the preview flag: `editor-shell-{1280x800,1920x1080,900x600,1179x700}.png` and `editor-shell-1280x800-palette.png` (Ctrl+K).
  - Names match BEFORE: `editor-*` is the refused state and `editor-preview-*` the preview shell, as in `E/before/umbrella`.
  - `login-reason-*` was removed. Locally the identity plane is unwired, so `/login?reason=…` renders the same refusal as `/login` and its shots were byte-identical to `login-*` (as in BEFORE). The reason panel only renders on a wired plane.
- **Servers:** production build, `next start -p 3201`, run one after the other: first with `SCENEAXI_SITE_EDITOR_PREVIEW=1` (as production), then with the variable unset for the refused `/editor`. I used 3201 rather than the 3101 the node prompt names, because hard rule 9 assigns 3201 and OLD may hold 31xx. Both are stopped.
- **Metrics:** `metrics.json` (route shots), `metrics-editor-shell.json`, `metrics-editor-refused.json`. Overflow 0 on every shot; smallest text 11px; worst text contrast 5.16:1 (`/open` 390); 0 `.eyebrow`; 0 `backdrop-filter`; 0 console errors.
- **Layout probe:** `layout-probe-preview.json`, `layout-probe-refused.json`. For each shot it lists clipped text, boxes past the viewport and overlapping text runs (clipped to their scroll containers).
- **Scripts:** `_work/capture-after.mjs`, `_work/capture-editor-after.mjs`, `_work/layout-probe.mjs`, `_work/motion-probe.mjs`.
- **Signed-in states:** `/login` signed in, `/account` member/admin/history/editor access, and "No credit packs" were not rendered (no identity plane locally, DIRECTION §7.2.1). I checked them by markup and CSS only: they use the same `.state`, `.dl`, `.field`, `.button` and `.ledger-rows` rules shown above.
- **Not viewed by eye:** the read tool refuses PNGs ("Cannot read binary file … This is an image file"), so I could not look at any shot, BEFORE or AFTER. In place of a visual check, each shot below was checked by the metrics and the layout probe. A person still has to look at them.

## Re-run: `reviews/lanes.md` § lane-umbrella

1. (blocking) **Missing AFTER states: closed.** The refused `/editor` is now `editor-{390,768,1440}.png` + `editor-1440-reduced.png`, from a server without the preview flag (H1 "The editor is not open for this request", 0 eyebrows, overflow 0, worst contrast 5.71:1). With the flag set, the shell is at 1280×800, 1920×1080, 900×600 and 1179×700, plus the palette at 1280×800 (`palette: true`), all with overflow 0, worst contrast 5.38:1 and 0 errors. The preview-shell shots were renamed `editor-preview-*` to match BEFORE and re-captured after fix 3.
2. (advisory) **Port deviations in §8.1:** these belong to the director; they are listed under Requests 3.
3. (advisory) **`.ed-project-save` ellipsis: fixed** (`globals.css` `.ed-project-save`). The status now wraps to two 11px lines (`line-clamp: 2`, line-height 1.2, 26px inside the 36px bar) instead of ellipsizing. The probe found it clipped at 1280×800 and 1440×900 before the fix and at no size after. Below 1180 it stays hidden by main's narrow-tier rule. No test pins the class (`umbrella-visual.test.ts:1503` pins only `{view.changes.savedLabel}`).
4. (advisory) **`identity.visual.spec.ts`:** not re-run here. It tests API code this lane does not own; it is a gate-reviewer item (Requests 2).

Probe findings I left as they are:
- **`home` (all widths):** the two `.hero-line` runs overlap by 2–5px. That is the line boxes of the display H1 at its tight leading (for example 101–173 against 168–240 at 1440), not glyphs touching.
- **`editor-shell-1280x800` (8 overlaps):** at the compact tier (<1440) the open assistant is an opaque drawer (`z-index: 5`) over the inspector, which is main's tier rule (`globals.css` "shared window tiers"). The probe ignores stacking, so it counts the covered inspector text. At 1179×700 and 900×600 the scrim/reflow rules apply and the probe finds 0.
- **First probe pass:** it reported the closed `Local project` `<details>` panel and the `clip-path: inset(50%)` labels (`.ed-shell-title`, `.ed-cr-decide-name`) as overlaps and clipping. Those are not visible, so the probe now excludes them.

## Shot check (one line per AFTER PNG)

Each line gives the shot, its BEFORE and what was checked. Contrast is the worst text ratio divided by its WCAG need (≥1 passes). The probe columns come from `layout-probe-*.json`. For injected fallback states (error boundary, loading), the probe does not apply because the markup is injected into a live route.

| AFTER | BEFORE | Checked |
|---|---|---|
| `404-1440-reduced.png` | `before/umbrella/404-1440.png` | reduced motion; bytes differ from `404-1440.png` |
| `404-1440.png` | `before/umbrella/404-1440.png` | HTTP 404, overflow 0, min font 11px, worst contrast 1.31x need, eyebrows 0, backdrop 0, console errors 2; probe: clipped/offscreen 0, text overlaps 0 |
| `404-390.png` | `before/umbrella/404-390.png` | HTTP 404, overflow 0, min font 11px, worst contrast 1.31x need, eyebrows 0, backdrop 0, console errors 1; probe: clipped/offscreen 0, text overlaps 0 |
| `404-768.png` | `before/umbrella/404-768.png` | HTTP 404, overflow 0, min font 11px, worst contrast 1.31x need, eyebrows 0, backdrop 0, console errors 1; probe: clipped/offscreen 0, text overlaps 0 |
| `account-1440-reduced.png` | `before/umbrella/account-1440.png` | reduced motion; bytes differ from `account-1440.png` |
| `account-1440.png` | `before/umbrella/account-1440.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `account-390.png` | `before/umbrella/account-390.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `account-768.png` | `before/umbrella/account-768.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `account-checkout-success-1440-reduced.png` | `before/umbrella/account-checkout-success-1440.png` | reduced motion; bytes differ from `account-checkout-success-1440.png` |
| `account-checkout-success-1440.png` | `before/umbrella/account-checkout-success-1440.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `account-checkout-success-390.png` | `before/umbrella/account-checkout-success-390.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `account-checkout-success-768.png` | `before/umbrella/account-checkout-success-768.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `admin-ledger-1440-reduced.png` | `before/umbrella/admin-ledger-1440.png` | reduced motion; bytes differ from `admin-ledger-1440.png` |
| `admin-ledger-1440.png` | `before/umbrella/admin-ledger-1440.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `admin-ledger-390.png` | `before/umbrella/admin-ledger-390.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `admin-ledger-768.png` | `before/umbrella/admin-ledger-768.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `docs-1440-reduced.png` | `before/umbrella/docs-1440.png` | reduced motion; bytes differ from `docs-1440.png` |
| `docs-1440.png` | `before/umbrella/docs-1440.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.36x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `docs-390.png` | `before/umbrella/docs-390.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.36x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `docs-768.png` | `before/umbrella/docs-768.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.36x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `docs-cli-1440-reduced.png` | `before/umbrella/docs-cli-1440.png` | reduced motion; bytes differ from `docs-cli-1440.png` |
| `docs-cli-1440.png` | `before/umbrella/docs-cli-1440.png` | HTTP 200, overflow 0, min font 12px, worst contrast 1.39x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `docs-cli-390.png` | `before/umbrella/docs-cli-390.png` | HTTP 200, overflow 0, min font 12px, worst contrast 1.39x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `docs-cli-768.png` | `before/umbrella/docs-cli-768.png` | HTTP 200, overflow 0, min font 12px, worst contrast 1.39x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `docs-credits-and-pricing-1440-reduced.png` | `before/umbrella/docs-credits-and-pricing-1440.png` | reduced motion; bytes differ from `docs-credits-and-pricing-1440.png` |
| `docs-credits-and-pricing-1440.png` | `before/umbrella/docs-credits-and-pricing-1440.png` | HTTP 200, overflow 0, min font 12px, worst contrast 1.39x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `docs-credits-and-pricing-390.png` | `before/umbrella/docs-credits-and-pricing-390.png` | HTTP 200, overflow 0, min font 12px, worst contrast 1.39x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `docs-credits-and-pricing-768.png` | `before/umbrella/docs-credits-and-pricing-768.png` | HTTP 200, overflow 0, min font 12px, worst contrast 1.39x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `docs-faq-1440-reduced.png` | `before/umbrella/docs-faq-1440.png` | reduced motion; bytes differ from `docs-faq-1440.png` |
| `docs-faq-1440.png` | `before/umbrella/docs-faq-1440.png` | HTTP 200, overflow 0, min font 12px, worst contrast 1.39x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `docs-faq-390.png` | `before/umbrella/docs-faq-390.png` | HTTP 200, overflow 0, min font 12px, worst contrast 1.39x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `docs-faq-768.png` | `before/umbrella/docs-faq-768.png` | HTTP 200, overflow 0, min font 12px, worst contrast 1.39x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `docs-getting-started-1440-reduced.png` | `before/umbrella/docs-getting-started-1440.png` | reduced motion; bytes differ from `docs-getting-started-1440.png` |
| `docs-getting-started-1440.png` | `before/umbrella/docs-getting-started-1440.png` | HTTP 200, overflow 0, min font 12px, worst contrast 1.39x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `docs-getting-started-390.png` | `before/umbrella/docs-getting-started-390.png` | HTTP 200, overflow 0, min font 12px, worst contrast 1.39x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `docs-getting-started-768.png` | `before/umbrella/docs-getting-started-768.png` | HTTP 200, overflow 0, min font 12px, worst contrast 1.39x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `docs-loading-1440-reduced.png` | `before/umbrella/docs-loading-1440.png` | reduced motion; bytes differ from `docs-loading-1440.png` |
| `docs-loading-1440.png` | `before/umbrella/docs-loading-1440.png` | HTTP 200, overflow 0, min font 13px, worst contrast 1.39x need, eyebrows 0, backdrop 0, console errors 0; injected fallback state, probe n/a |
| `docs-loading-390.png` | `before/umbrella/docs-loading-390.png` | HTTP 200, overflow 0, min font 13px, worst contrast 1.39x need, eyebrows 0, backdrop 0, console errors 0; injected fallback state, probe n/a |
| `docs-loading-768.png` | `before/umbrella/docs-loading-768.png` | HTTP 200, overflow 0, min font 13px, worst contrast 1.39x need, eyebrows 0, backdrop 0, console errors 0; injected fallback state, probe n/a |
| `editor-1440-reduced.png` | `before/umbrella/editor-1440.png` | reduced motion; bytes differ from `editor-1440.png`; first control focused (Tab) to show the instant focus ring |
| `editor-1440.png` | `before/umbrella/editor-1440.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `editor-390.png` | `before/umbrella/editor-390.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `editor-768.png` | `before/umbrella/editor-768.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `editor-loading-1440-reduced.png` | `before/umbrella/editor-loading-1440.png` | reduced motion; bytes differ from `editor-loading-1440.png` |
| `editor-loading-1440.png` | `before/umbrella/editor-loading-1440.png` | HTTP 200, overflow 0, min font 13px, worst contrast 1.39x need, eyebrows 0, backdrop 0, console errors 0; injected fallback state, probe n/a |
| `editor-loading-390.png` | `before/umbrella/editor-loading-390.png` | HTTP 200, overflow 0, min font 13px, worst contrast 1.39x need, eyebrows 0, backdrop 0, console errors 0; injected fallback state, probe n/a |
| `editor-loading-768.png` | `before/umbrella/editor-loading-768.png` | HTTP 200, overflow 0, min font 13px, worst contrast 1.39x need, eyebrows 0, backdrop 0, console errors 0; injected fallback state, probe n/a |
| `editor-preview-1440-reduced.png` | `before/umbrella/editor-preview-1440.png` | reduced motion; bytes differ from `editor-preview-1440.png` |
| `editor-preview-1440.png` | `before/umbrella/editor-preview-1440.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.19x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `editor-preview-390.png` | `before/umbrella/editor-preview-390.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `editor-preview-768.png` | `before/umbrella/editor-preview-768.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `editor-shell-1179x700.png` | `before/umbrella/editor-shell-1179x700.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.19x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `editor-shell-1280x800-palette.png` | `before/umbrella/editor-shell-1280x800-palette.png` | HTTP -, overflow 0, min font 11px, worst contrast 1.19x need, eyebrows 0, backdrop 0, console errors 0, palette open true; probe n/a (palette dialog over the shell) |
| `editor-shell-1280x800.png` | `before/umbrella/editor-shell-1280x800.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.19x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 8 |
| `editor-shell-1920x1080.png` | `before/umbrella/editor-shell-1920x1080.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.19x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `editor-shell-900x600.png` | `before/umbrella/editor-shell-900x600.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.19x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `engine-1440-reduced.png` | `before/umbrella/engine-1440.png` | reduced motion; bytes differ from `engine-1440.png` |
| `engine-1440.png` | `before/umbrella/engine-1440.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.31x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `engine-390.png` | `before/umbrella/engine-390.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.31x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `engine-768.png` | `before/umbrella/engine-768.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.31x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `error-boundary-1440-reduced.png` | `before/umbrella/error-boundary-1440.png` | reduced motion; bytes differ from `error-boundary-1440.png` |
| `error-boundary-1440.png` | `before/umbrella/error-boundary-1440.png` | HTTP 404, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 2; injected fallback state, probe n/a |
| `error-boundary-390.png` | `before/umbrella/error-boundary-390.png` | HTTP 404, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 1; injected fallback state, probe n/a |
| `error-boundary-768.png` | `before/umbrella/error-boundary-768.png` | HTTP 404, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 1; injected fallback state, probe n/a |
| `home-1440-reduced.png` | `before/umbrella/home-1440.png` | reduced motion; bytes differ from `home-1440.png` |
| `home-1440.png` | `before/umbrella/home-1440.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.31x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 1 |
| `home-390.png` | `before/umbrella/home-390.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.31x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 1 |
| `home-768.png` | `before/umbrella/home-768.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.31x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 1 |
| `login-1440-reduced.png` | `before/umbrella/login-1440.png` | reduced motion; bytes differ from `login-1440.png` |
| `login-1440.png` | `before/umbrella/login-1440.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `login-390.png` | `before/umbrella/login-390.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `login-768.png` | `before/umbrella/login-768.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `open-1440-reduced.png` | `before/umbrella/open-1440.png` | reduced motion; bytes differ from `open-1440.png` |
| `open-1440.png` | `before/umbrella/open-1440.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.15x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `open-390.png` | `before/umbrella/open-390.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.15x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `open-768.png` | `before/umbrella/open-768.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.15x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `pricing-1440-reduced.png` | `before/umbrella/pricing-1440.png` | reduced motion; bytes differ from `pricing-1440.png` |
| `pricing-1440.png` | `before/umbrella/pricing-1440.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.31x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `pricing-390.png` | `before/umbrella/pricing-390.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.31x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `pricing-768.png` | `before/umbrella/pricing-768.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.31x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `pricing-checkout-cancelled-1440-reduced.png` | `before/umbrella/pricing-checkout-cancelled-1440.png` | reduced motion; bytes differ from `pricing-checkout-cancelled-1440.png` |
| `pricing-checkout-cancelled-1440.png` | `before/umbrella/pricing-checkout-cancelled-1440.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.31x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `pricing-checkout-cancelled-390.png` | `before/umbrella/pricing-checkout-cancelled-390.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.31x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `pricing-checkout-cancelled-768.png` | `before/umbrella/pricing-checkout-cancelled-768.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.31x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `pricing-reason-1440-reduced.png` | `before/umbrella/pricing-reason-1440.png` | reduced motion; bytes differ from `pricing-reason-1440.png` |
| `pricing-reason-1440.png` | `before/umbrella/pricing-reason-1440.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `pricing-reason-390.png` | `before/umbrella/pricing-reason-390.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `pricing-reason-768.png` | `before/umbrella/pricing-reason-768.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.27x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `profiles-1440-reduced.png` | `before/umbrella/profiles-1440.png` | reduced motion; bytes differ from `profiles-1440.png` |
| `profiles-1440.png` | `before/umbrella/profiles-1440.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.31x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `profiles-390.png` | `before/umbrella/profiles-390.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.31x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |
| `profiles-768.png` | `before/umbrella/profiles-768.png` | HTTP 200, overflow 0, min font 11px, worst contrast 1.31x need, eyebrows 0, backdrop 0, console errors 0; probe: clipped/offscreen 0, text overlaps 0 |

## Checks (cwd as noted; TMPDIR `/home/devuser/.cache/sxum2162920`, removed afterwards)

| Command | cwd | Exit | Note |
|---|---|---|---|
| `pnpm exec tsc --noEmit -p .` | sites/umbrella | 0 | |
| `pnpm exec vitest run` | sites/umbrella | 0 | 8 files, 140 tests |
| `pnpm build` | sites/umbrella | 0 | includes the Vercel package check; this was the last build, after the Playwright runs |
| `pnpm run --silent check:sites` | R | 1 | equal to the baseline (`gate-baseline.log:22`: "pnpm-workspace.yaml globs sites/"). No new problem. |
| `pnpm exec vitest run tests/sites` | R | 1 | 826/829. The 3 failures are the baseline ones: `identity-plane-wiring` health, `provider-adapters` loader, `site-seams` workspace |
| `pnpm exec vitest run` on the 7 umbrella-related files in `tests/sites` | R | 0 | 165 tests, D-4 pins included |
| `pnpm exec vitest run tests/e2e/umbrella-editor-viewport-golden.test.ts tests/e2e/umbrella-live-open-golden.test.ts` | R | 0 | 25 tests |
| `pnpm exec playwright test` | sites/umbrella | 1 | `first-release.visual.spec.ts` 11/11 pass. `identity.visual.spec.ts:32` fails: it expects `cache-control: no-store` and `/api/auth/sign-in/email` sends `private, no-store`. That is API code, which I did not touch (`git diff` on `src/app/api` is empty); v5 recorded the same failure. I did not re-run it on unchanged main. 4173 was free before the run. The runner hung after finishing, so I stopped its process and its dev server, both in R. |
| `pnpm exec eslint --max-warnings 0` on the 20 touched TS/TSX files | R | 0 | |
| detector `--json sites/umbrella/src/app sites/umbrella/src/lib/foundations.ts` | R | 0 | `[]` |
| `git diff --quiet` on `pnpm-lock.yaml`, `sites/kids/pnpm-lock.yaml`, `sites/umbrella/pnpm-lock.yaml` | R | 0 | see Requests 1 |

Re-run checks (TMPDIR `/home/devuser/.cache/sxu<pid>`, removed afterwards; after the `.ed-project-save` edit):

| Command | cwd | Exit | Note |
|---|---|---|---|
| `pnpm build` | sites/umbrella | 0 | Vercel package check OK; the shots come from this build |
| `pnpm exec tsc --noEmit -p .` | sites/umbrella | 0 | |
| `pnpm exec vitest run` | sites/umbrella | 0 | 140/140 |
| `pnpm check:sites` | R | 1 | same single baseline problem ("pnpm-workspace.yaml globs sites/", `gate-baseline.log:23`) |
| detector on `sites/umbrella/src/app/globals.css` | R | 0 | no findings |
| `git diff --quiet` on the three lockfiles | R | 0 | `sites/umbrella/pnpm-lock.yaml` was rewritten by pnpm again and restored with `git show HEAD:… >` (Requests 1) |
| `md5sum` duplicate check on `E/after/umbrella/*.png` | E | — | 0 duplicate hashes in 93 files |

## Requests

1. **Orchestrator / all site lanes:** every `pnpm` command with cwd `sites/umbrella` (pnpm 12.6 devEngines) prepends a `packageManagerDependencies` document to `sites/umbrella/pnpm-lock.yaml`. I restored the file byte-identical with `git show HEAD:… >` after my runs; nothing was committed. Deploy and gate nodes should check it the same way.
2. **Test-owners / identity owner:** `identity.visual.spec.ts:32` against the `private, no-store` header (carried from v5).
3. **Director (DIRECTION §8.1, R-9):** add these five lane port deviations as DV-P rows if accepted (details under "Port deviations taken here"):
   1. Card-link arrows are the text glyph `→`, not a rotated CSS chevron. This is forced by the `translateX(3px)` pin, `umbrella-visual.test.ts:438-452`.
   2. The hero head stays in the copy column (DV-P9 fallback: columns 0.85/1.15, hero padding 44). This is forced by the stage and rail-top pins at 1440×900.
   3. At ≤620px the nav is one scrolling row of 44px targets, not the §8.2 4-column grid. The masthead is 96px against the ≤104 pin; the grid gave 158.
   4. The 12px step is dropped from `/` (`.hero-stage-note`, `.proof-history` and `.footer-version` are 13px), so it renders 9 sizes.
   5. Lane hovers are paint only (DV-P3): profile cards, tiers, wordmark, store dot, ledger chevron and editor rail glyph.
4. **Product owner (optional, out of lane):** a copy control on `.command` wells; a client submit state for `/login`, which would need the pinned client list widened.

## Final-review fixes (reviews/final.md, 2026-10-05)

Scope set by the orchestrator: fixes 1, 3, 4 and 6 on this lane (2 and 5 are store-only). CSS only, `sites/umbrella/src/app/globals.css`.

- **Fix 1 (blocking):** added `.wordmark:hover { color: var(--fg) }`, and after `.button-quiet`: `a.button:hover { color: var(--bg-base) }`, `a.button-quiet:hover { color: var(--fg) }`, `a.button[aria-disabled="true"]:hover { color: var(--fg-2) }`. These hold the label ink against site-kit's base `a:hover`. Live, `next start` on 3201 at 1440×900: 48 anchor/quiet buttons and wordmarks hovered on 16 routes, 0 below 4.5:1 (primary 6.07:1, quiet 14.0–15.0:1, wordmark 17.39:1). Data: `E/after/_finalfix/probe.txt`.
- **Fix 3:** `.command::before` is now `"$" / ""` and `.crumbs li + li::before` is `"/" / ""`. Computed values were confirmed live on `/engine` and `/docs/getting-started`.
- **Fix 4:** removed the empty `.button:active:not(…):not(:disabled) {}` rule.
- **Fix 6:** no umbrella change. The stores now use the umbrella's clip-path nav underline (see lane-catalogs). The umbrella nav hover was measured live: underline `inset(0px)`, `--line-strong`.
- Re-captured into `E/after/umbrella/`: `home`, `engine`, `profiles`, `open`, `404` and `docs-getting-started` at 390/768/1440; `fix1-hover-download-primary-{390,768,1440}`, `fix1-hover-masthead-download-1440`, `fix1-hover-wordmark-1440` and `fix6-nav-hover-1440`.
- Checks: the detector reports 0 on the sheet. `vitest run tests/sites sites/*/test packages/site-kit` gives 1324 pass and 3 fail, the same 3 baseline failures as `gate.md`.
