# Review: final design review (critique + audit + polish), port run on main `dffefbab`

⚠️ DEGRADED: single-context. This session has no sub-agent tool, no browser-tab tool and no image viewer. Every
browser check ran in headless Chromium 1223 (R's `playwright-core`) from my own scripts.

Reviewer: independent. I built none of this and ran every check below myself. Date: 2026-10-05, 12:09–12:55.
E = `/home/devuser/Documents/Reports/sceneaxi-redesign-main`. Shots are in `E/final/<surface>/`, BEFORE|FINAL sheets
in `E/final/<surface>/compare/`, data in `E/final/<surface>/final*.json`, scripts and logs in `E/final/_work/`.
The only file I wrote in R is this one.

Verdict: **FAIL**. Two blocking defects:
- every `<a class="button">` on the umbrella loses its label on hover (fix 1);
- the store item refusal panels are back at the compact density that R-8 removed (fix 2).

Both are CSS-only. Everything else I measured is clean.

## What I ran

- **Freshness.** No modified or new file in R is newer than `E/gate-after.log` (12:05), apart from the orchestrator's
  `docs/cycle-2026-10/` and `reviews/gate.md`. Every site `.next` build is newer than its sources.
  `pnpm run --silent build` (cwd R) exited 0.
- **Servers.** I ran `next start` on 3201–3204 from the production builds. The umbrella ran plain, then with
  `SCENEAXI_SITE_EDITOR_PREVIEW=1` for `/editor`, as in production. I also ran:
  - the web-shell bin on 5281, over a fresh copy of a scratch project for each run;
  - a static server on 3206 for 16 chrome states plus 2 BYO harness pages, rendered from the built desktop-shell package;
  - the packaged Electron window under `xvfb-run`.

  TMPDIR was a short `/home/devuser/.cache/sx<pid>`, removed afterwards. Ports 3201–3206 and 5281 are free.
- **374 PNGs.**

  | Surface | Shots | Reduced-motion shots |
  |---|---|---|
  | Umbrella | 80: 22 states × 390/768/1440, plus the `/editor` shell at 1280×800, 1920×1080, 900×600 and 1179×700, plus the palette | 5 |
  | Each store | 30: 9 states × 3 widths | 3 |
  | Kids | 41: 11 states | 8 |
  | Web shell | 72: 8 states × dark/light | 24 |
  | Desktop chrome | 115: 1280×800, 1920×1080, 1100×800 and 700×500 | 51 |
  | Electron | 6 | 0 |

  There are 246 BEFORE|FINAL sheets.
- **Live probe on every shot:**
  - document overflow, boxes past the viewport, clipped text and overlapping line boxes / controls;
  - placeholder text, minimum font and composited contrast;
  - eyebrows, `backdrop-filter`, gradient text, radius >16, ghost shadows, side stripes and repeating gradients.
- **Interaction probe: 267 distinct controls** (mouse hover, pointer-held `:active`, keyboard focus-visible, disabled
  paint, and the transitions involved), plus a hover-contrast sweep of every link and button on 14 umbrella and
  5+5 store routes. **Tab walks** on 45 route/size pairs. **Reduced motion**: running animations at 90ms and 1s
  after load, and hover/press under reduce.
- **Static:**
  - the detector on 8 source targets and on the rendered chrome and inspector HTML;
  - a motion-declaration scan (curves, literal times, transitioned properties);
  - a spacing scan of padding, margin and gap against `4·8·12·16·24·32·44·72`;
  - a `data-*`/id/aria/role multiset of the rendered chrome against `E/before/desktop/_render`.
- **Suites:**
  - `pnpm exec vitest run tests/sites packages/site-kit apps/web-shell apps/desktop-shell`: 1818 passed, 3 failed. The 3 failures (`identity-plane-wiring`, `provider-adapters`, `site-seams`) are the baseline ones in `gate.md`.
  - Store `node --test`: catalog-web 32/32 and catalog-game 32/32.
  - Lockfiles: `git diff --quiet` passes on all six.

## PASS criteria

| Criterion | Result |
|---|---|
| `reviews/gate.md` PASS | Yes. The tree is unchanged since `gate-after.log`. |
| One spacing scale, consistent tokens, the same component looks and moves the same | **No: fix 2.** Spacing is on the scale everywhere. Off-scale values are only the 2–3px editor nudges, the 344px drawer geometry and the pinned chrome `padding:10px 12px`. The desktop source has more literals, but they sit in strings that are never rendered. No rule reads `--space-5`. Buttons (46px, radius 5, Archivo 600 15px), chips (24px, mono 11px, 0.88px tracking, radius 3), fields (38/44px), headings (66/42/24/17), disabled paint (dashed, `--fg-2`, `not-allowed`, opacity 1) and busy bars (1.2s quart, 300ms delay) compute the same on all three sites. Fixes 5 and 6 are advisory drifts. |
| Every route visibly better than BEFORE | Yes, by the measures I could run (fix 1 aside). All 246 pairs differ (lowest mean difference 2.06). Eyebrows went 48→0 on the umbrella and 18→0 on each store. Glass mastheads went 54→0 and 24→0 per store. The rendered desktop chrome went from 5 detector findings to 1. Minimum text is 11px (desktop 11, Kids 17, web shell 13). **I judged no PNG by eye**; the visual_signoff should start with `E/final/umbrella/compare/` and fix 1. |
| Zero overflow, overlap, clipping or placeholder at any width | Yes. Document overflow is 0 on every shot. I checked every overlap hit by hand: each is a scroll region (`.command code`, store `.rail` and `.detail-side`, the `/editor` notes band), a wrapped inline link, or a designed layer (desktop menus, palette and compact drawers; the umbrella `/editor` drawer at 1180–1439, which is main's tier rule). The one clip is the designed desktop title-pill ellipsis (fix 9). There are 0 placeholder hits. |
| Every control has hover, focus-visible, active and disabled states, with motion per the table | **No: fix 1.** The states exist everywhere, but the umbrella's anchor-button hover makes the label illegible (1.2:1). Everything else is explained: current or selected items carry no hover, and inert controls are painted, not faded. Transitions are 120ms opacity, or 200ms transform/clip-path on `--ease-standard` (DV-P2), on the sites; 160/200ms quart/quint on Kids and the web shell; and `translate` 280ms expo on the desktop. Every one-shot keyframe runs 160–320ms. The only loops are R-1 bars (1200ms, 300ms delay, quart) and Kids `play-float` (R-3). |
| Reduced motion honoured everywhere | Yes. Under reduce, 0 animations run on any probed state: umbrella `/`, `/docs`, `/login`, `/pricing` and `/editor`; each store's home, item and publish; all Kids states; every web-shell state; and every desktop state. Busy bars are static at 40%, and hover still shows the state layer without movement. The Electron window was not run under reduce (it renders the same chrome, which was). |
| Keyboard order sane | Yes. 45 walks: no positive tabindex, no stop without a ring or `:focus-visible`, no invisible stop. Order is masthead → main → footer, or rail → content on `/docs`. |
| No AI-slop tells (both altitudes) | Yes. No hero-metric, card-grid scaffold, kicker, glass, gradient text, side stripe, radius >16 on cards or ghost shadow on any probed route. |
| Detector 0 | Yes for the source targets: sites 0, desktop-shell 0, Linux renderer 0, site-kit 0. These are held by contract (fix 8): web shell 1 (DV-X1), and rendered chrome 1 (`aphoristic-cadence` from unchanged main copy). |

## Fixes

1. **(blocking) Umbrella: hovering any anchor button repaints its label in `--accent-hi`, so primary labels vanish.**
   - Cause: site-kit's base sheet ships `a:hover { color: var(--accent-hi); }` (`packages/site-kit/src/design-tokens.ts:615`, specificity 0,1,1). That outranks `.button { color: var(--bg-base) }` (`sites/umbrella/src/app/globals.css:712`, 0,1,0). Main held the label with `.button:hover { …; color: var(--bg-base) }`, `.button-quiet:hover { color: var(--fg) }` and `.wordmark:hover { color: var(--fg) }` (main `globals.css:1860-1864`, `:1874-1877`, `:228-230`). The redesign's state-layer rewrite dropped all three.
   - Measured hover contrast: label rgb(255,138,84) on rgb(255,109,47) = **1.2:1**. Affected:
     - the masthead **Download** (`a.button.button-lg`) on every umbrella route;
     - `/` `.download-primary`;
     - `/engine` "Download the archive", `/profiles` "Open a real artifact", `/open` "Download the engine SDK" and 404 "Back to the overview".

     Quiet buttons and the wordmark turn orange on hover (7.4–8.6:1). That breaks §2 rules 2–3 (accent text only for the current item, state layers instead of new colours).
   - The stores are not affected: their sheets restate the label colour.
   - Fix: add after `.button-quiet` (`sites/umbrella/src/app/globals.css:766-770`):
     ```css
     /* site-kit's base `a:hover` recolours links; a button keeps its own ink (state layer only). */
     a.button:hover { color: var(--bg-base); }
     a.button-quiet:hover { color: var(--fg); }
     a.button[aria-disabled="true"]:hover { color: var(--fg-2); }
     ```
     Add `.wordmark:hover { color: var(--fg); }` after `:285-296`.
   - Verified by injecting these rules live: primary hover 6.07:1, quiet 14–15:1.
   - No transform in a `:hover` rule, no hex, every var is emitted (`umbrella-visual.test.ts:388-453`, `:604-650`).
2. **(blocking) Store item refusal panels use the compact density that R-8 removed.**
   - `.buy .state { padding: var(--space-4); gap: var(--space-3) }` is at `sites/catalog-web/src/app/globals.css:2081-2084` and at the same lines in `sites/catalog-game`. It is main's compact `.buy .state` (main `:2063-2067`) carried into the port. There is no DV-P row and no test pin (R-9).
   - Measured, both stores: the commerce and editor-link refusal panels are 736px wide at 768 and 485px wide at 1440, with padding 16 and gap 12. The same `.state` on `/login`, `/account`, `/engine`, `/pricing` and the store `/publish` has padding 24 and gap 16.
   - R-8 fixed exactly these panels ("the item editor-link and commerce refusals"). It keeps only the home notice compact.
   - Fix: delete the rule in both sheets in lockstep. The byte-identical rule then still holds, and the base `.state` gives 16/16 below 621px and 24/16 above. Verified by injection at 390/768/1024/1440: overflow 0, no clipping.
3. **(advisory) Two decorative glyphs lost their empty alt text, so screen readers now announce them.**
   - `sites/umbrella/src/app/globals.css:1946`: `.command::before` is `content: "$"`. Main had `"$" / ""`.
   - `:2677`: `.crumbs li + li::before` is `content: "/"`. Main had `"›" / ""`.
   - Fix: append ` / ""` to both.
4. **(advisory)** `sites/umbrella/src/app/globals.css:759-760` is an empty rule (`.button:active:not(…):not(:disabled) {}`) left over from DV-P3. Remove it.
5. **(advisory) The masthead differs between sites.**
   - Umbrella: 60px with 44px nav targets at ≥861px.
   - Stores: 64px (`sites/catalog-*/src/app/globals.css:2739`, `min-height: 4rem`, from main's 63px) with 38px nav targets (`:2786`).
   - The v5 final measured 60px on all three. If no pin needs 64, use 3.75rem.
6. **(advisory) Nav hover differs between sites.**
   - Umbrella: the underline draws with clip-path (`sites/umbrella/src/app/globals.css:366-385`, as in v5).
   - Stores: the 8% state layer (`sites/catalog-*/src/app/globals.css:630-640`), which matches §6.3 row 1.
7. **(advisory) v5 advisories still open (R-8 deferred them):**
   - tablet gutters: at 768 the umbrella H1 starts at 31px and the store H1 at 16px;
   - the stores' `/?sort=random` has no H1;
   - `apps/web-shell/src/inspector-app.ts:802` declares `--space-*` and reads none of them;
   - the umbrella `/` H1 sets in three lines at 1440 (`globals.css:1097`, lanes advisory 3);
   - the `/editor` 900×600 notes band is a short scroller.
8. **(advisory) Detector findings held by contract (hard rule 4):**
   - `apps/web-shell/src/inspector-app.ts:837`, the DV-X1 busy rail (source and rendered page);
   - `aphoristic-cadence` on the rendered chrome, from unchanged main copy at `apps/desktop-shell/src/chrome/core/panels.ts:43-46`, which goes to the copy owner (Request D1).

   For comparison, the BEFORE chrome render had 5 findings.
9. **(advisory)** At 1280×800 the desktop title pill ellipsizes "Project lifecycle refused · DESKTOP_RUNTIME_UNAVAILABLE" (359px of text in 309px; `apps/desktop-shell/src/chrome/frame/styles.ts:28,30`). The status bar and the dialog show the full text.
10. **(advisory)** `apps/desktop-shell/src/chrome/assistant/styles.ts:9,32` and `chrome/core/styles.ts:490,502` still hold the legacy `assistant-breathe/spin/glow/dot/card` loops and a `border-color .2s ease` transition. These strings are never emitted (0 occurrences in all 18 rendered pages), so DV-P7 holds. Delete them when the owner next touches the file.
11. **(advisory)** The `/editor` inert `.ed-primary` has no dashed line (`sites/umbrella/src/app/globals.css:5178-5182`). §5 paints disabled controls with a dashed line plus `--fg-2`. The desktop marks the same state with a dashed inner outline.

## Critique and audit (both altitudes)

| Heuristic (system) | Score | Note |
|---|---|---|
| 1 Visibility of status | 4 | Named panels, tone underline draws, busy bars after 300ms |
| 2 Match real world | 3 | Some refusal codes are raw (`DESKTOP_RUNTIME_UNAVAILABLE`), but always next to a sentence |
| 3 User control | 3 | Kids undo/start over, Change Review reject; no undo after a web-shell apply (by design) |
| 4 Consistency | 2 | Fixes 1, 2, 5, 6 |
| 5 Error prevention | 3 | Partial accept refused by name; disabled controls are painted and explained |
| 6 Recognition | 3 | Labelled controls; the palette lists every command |
| 7 Flexibility | 3 | Ctrl+K palette on `/editor` and desktop; keyboard order clean |
| 8 Aesthetic / minimal | 3 | No slop tells; three-line home H1 (fix 7) |
| 9 Error recovery | 3 | Every refusal names its reason and a way forward |
| 10 Help | 3 | Docs rail and TOC; FAQ |
| **Total** | **30/40** | Good |

Audit (0–4; performance not measured):

| Surface | A11y | Responsive | Theming | Integrity |
|---|---|---|---|---|
| Umbrella | 2 (fix 1) | 4 | 3 (fixes 1, 3) | 3 |
| Stores | 4 | 4 | 3 (fix 2) | 3 (fix 2) |
| Kids | 4 | 4 | 4 | 4 |
| Web shell | 4 | 4 | 3 (fix 7) | 4 |
| Desktop + Electron | 4 | 4 | 4 | 4 |

- **Specificity:** the system reads as authored for this product.
  - Named refusals with reason codes, the Change Review resolution and the aperture on real canvases carry its honesty.
  - The desktop keeps its instrument identity.
- **Persona red flags:**
  - Sam (keyboard or screen reader): fix 3 reads "dollar" and "slash".
  - Alex and Jordan (pointer): fix 1 hides the Download label at the moment of the click.
- **Biggest opportunity:** fixes 1 and 2. Both are CSS-only, in files the umbrella and catalogs lanes own.

## Not verified

- I judged no PNG by eye (no image viewer). "Visibly better" rests on the measures above.
- I did not re-run `pnpm gate` or `pnpm lint`: `gate.md` is PASS and the tree is unchanged since `gate-after.log`.
- I did not measure performance.
- Signed-in identity, credits and billing states cannot render locally (§7.2.1). They share the `.button` and `.state` rules, so fixes 1 and 2 apply to them as well.

VERDICT: FAIL
