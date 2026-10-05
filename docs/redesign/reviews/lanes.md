# Review: the five redesign lanes (port run, DIRECTION v6), round 2

Date: 2026-10-05, 11:32 to about 12:15. I am the independent reviewer. I ran every check below myself in R (`redesign-impeccable` on `dffefbab`), with TMPDIR `/home/devuser/.cache/sxr3435475` (31 bytes). I removed that directory afterwards. Scratch scripts and logs are in `/home/devuser/.cache/rv*`, outside R and E. Browser work used headless Chromium 1223 through R's `playwright-core`, in my own contexts; I had no browser-tab tool. **I could not view any PNG by eye**, because my read tool refuses images. I judged shots by re-rendering them and diffing pixels, and I judged layout from live DOM probes.

Round 1 had three blocking fixes. All three are closed:
- umbrella: missing AFTER states;
- catalogs: colour transitions;
- desktop: missing AFTER states.

## Checks run (all lanes)

| Check | Result |
|---|---|
| `pnpm build` (cwd R) | exit 0 |
| `tsc --noEmit -p .` and `next build` in umbrella, catalog-web, catalog-game, kids (site-local binaries, no pnpm) | exit 0 ×8 |
| `pnpm exec vitest run tests/sites packages/site-kit` | exit 1: 1324 passed, 3 failed (`identity-plane-wiring` health, `provider-adapters` loader, `site-seams` workspace). All 3 are in `E/backup/gate-baseline.log` |
| `pnpm exec vitest run apps/desktop-shell apps/web-shell` | exit 0: 54 files, 494 tests |
| goldens: `tests/e2e/desktop-chrome-*`, `desktop-editor-command-forms-golden`, `desktop-control-inventory-golden`, `umbrella-*` | exit 1: 13 failures (frame 7, inspector 3, palette 3 command interactions), all in the baseline. 56 passed |
| `pnpm exec vitest run desktop/linux` | exit 1: 22 failures, all in the baseline (`byo-terminal-lifecycle` 6 with the same "missing actual BYOK controls", `viewport-terminal-lifecycle` 14 with the same assertions, `local-rpc` 2 from the socket path length) |
| umbrella `vitest run` (site) | exit 0: 140/140 |
| store `node --test`: both `catalog-ux-regression`, both `item-session-wiring`, game `rendered-route-states.test.mjs` | exit 0 ×5 (17, 15, 13, 15, 4 pass) |
| Kids `production-activity.spec.ts` against `next start` on 3204 | 1 pass, 0 fail |
| Umbrella Playwright specs (R's spec files; my config without `webServer`; production `next start` on 4173 with the 4173 origin) | `first-release.visual.spec.ts` 11/11 pass. `identity.visual.spec.ts:32` fails, see umbrella advisory 2 |
| `check:sites`, `check:desktop` | exit 1 each, with the single baseline problem text (`gate-baseline.log` stages `check:sites`, `check:desktop`) |
| `desktop/linux`: `node scripts/build-linux.mjs`, `node scripts/check-renderer.mjs` | exit 0, exit 0 |
| `eslint --max-warnings 0` on all 70 modified or new TS/TSX files | exit 0 |
| Detector `--json` on each lane's touched files | umbrella 0, catalogs 0, kids 0, desktop 0. Web shell 1: the pinned `pre[aria-busy="true"]` rail at `inspector-app.ts:837` (DV-X1, accepted). The same detector on the HEAD copies of those files gives umbrella 3, each store 3, kids 1, web shell 1, desktop 4 |
| Ownership (`git status` against `E/backup/status.txt`) | Every modified path maps to its lane, to the foundation (untouched since 09:17), or to the R-9 grant (`foundations.ts`: the motion sheet and `bandPad` 72px only). The one new untracked path outside the lanes is `docs/cycle-2026-10/STATUS.md`, the orchestrator's status file. API, `_session.ts`, `middleware.ts`, `provider/**`, `src/lib/**` and `tests/**` are unchanged. `kids-activity.ts` sha `027a0272…` equals HEAD |
| Lockfiles (root, 4 sites, `desktop/linux`) | `git diff --quiet` after every step: unchanged |
| Hook multiset per touched TS/TSX file (`data-*`, `id`, `aria-*`, `role`, with values), HEAD → now | No count went down. The only tokens removed are 7 `aria-hidden="true"` on deleted decorative spans (`dot`, `kicker-dot`, `included-check`, `card-accent-rail`) |
| Desktop rendered markup (my render of R's build) against the director's independent BEFORE renders `E/before/desktop/_render` | ids, aria, role, data and data-command are equal in all 10 shared states. 0 of the five assistant loops, 0 `rise .28s`, 0 `scale(`. `assistant-bars` and `sweep` are on the R-1 tokens |
| Clean ports | Kids `src/app/**` and `inspector-app.ts`: HEAD equals `E/port/pre`, and the result equals OLD, so no newer main behaviour was overwritten |

Static motion scan (all five surfaces):
- Every keyframe animates only opacity, transform/translate, clip-path or filter.
- Every `animation` reads `--motion-*`. No bare `ease`/`linear` curve appears except Kids `play-float` (R-3).
- Every transition is limited to transform, opacity and clip-path (desktop: `translate`).
- On the umbrella and the stores, every state transform is `translateX(3px)`, `scale(1.015)` or `none` (DV-P3).
- 0 `background-clip:text`, 0 `backdrop-filter`, 0 repeating gradients, 0 outer shadows with blur ≥16px.
- Radius >16px appears only on dots and pills (`50%`, `999px`, `99px`), never on cards.

Live probe (my script). It measured composited text contrast over the real computed colours, document overflow, boxes past the viewport, clipped or ellipsized text, the min font, eyebrows, `backdrop-filter`, every non-zero computed `transition-property` (at rest and while hovering every visible control), and running animations under `reduce`.

| Surface (states probed) | Widths | Min contrast | Overflow / clip | Transition properties seen | Running under reduce |
|---|---|---|---|---|---|
| Umbrella: `/`, `/pricing`, `?checkout=cancelled`, `/docs`, `/docs/cli`, `/docs/faq`, `/login`, `/account`, `/editor` (preview and refused), `/open`, `/engine`, `/profiles`, `/admin/ledger`, 404 | 390, 768, 1440; editor also 900×600, 1179×700, 1280×800, 1920×1080 | 4.98 (`.ed-tree-kind` on the selected row) | 0 / 0. `.ed-project-save` now wraps to 26px with no clip | transform, opacity, clip-path | 0 |
| Stores, both: home, item, publish, 404, no results, refused | 390, 768, 1440 | 5.09 (Forge accent chip) | 0 / 0. The narrow Forge plate legend no longer clips | opacity, clip-path, transform, also while hovered | 0 |
| Kids: home, placed, playing | 390, 768, 1440 | 6.10 | 0 / 0 | transform, opacity, clip-path | 0. `play-float` runs only under `.is-playing` |
| Web shell: idle, reviewing, refused, applied; dark and light | 390, 1440 | 5.74 (disabled Accept, light) | 0 / 0 | transform, opacity | 0 |
| Desktop: default, palette, run, sculpt running, animate, assistant thinking/hosted/closed, console, kids, web; menu, palette, mode and tab interactions; 1100×800; 700×500 | 1280×800, 1920×1080 | 5.54 | 0 / 0. The File menu fits the window and scrolls (7 items reachable by scroll at 1280) | translate | 0 |

Shot provenance. I re-rendered shots from R's current build with the lane's own browser binary and diffed them against the lane PNGs:
- umbrella refused `/editor` at 390 and 1440: 0.00% and 0.03% different;
- desktop `dock-console` at 1280 and 1920, `assistant-closed` at 1920, `kids` at 1280: 0.00%;
- Vitrine item, Forge home and Forge publish at 1440: 0.00%.

The lane desktop `states/*.html` files are byte-identical to my render. No AFTER PNG is blank, and no widths differ from their viewports. The only byte-identical pairs are reduced-motion twins of static end states.

## lane-umbrella: PASS

Round 1 fix 1 is closed. All 22 BEFORE states have AFTER shots at 390, 768 and 1440 plus a reduced shot, including the refused `/editor` (H1 "The editor is not open for this request", chips "Engine Desktop editor" and "Refused", 0 eyebrows). The editor shell is shot at 1280×800, 1920×1080, 900×600 and 1179×700, and the palette at 1280×800. Across 1179–1920 every `#changes-*` control hit-tests to itself and Ctrl+K opens the palette. `login-reason` is legitimately absent: it renders the same as `/login` on an unwired plane (§7.2.1).

1. (advisory) `docs/redesign/lanes/lane-umbrella.md:251-256`: the five lane port deviations are still missing from DIRECTION §8.1, which R-9 requires. That file belongs to the director (lane Request 3).
2. (advisory) `sites/umbrella/test/identity.visual.spec.ts:32` expects `cache-control: no-store`, but main's unchanged `sites/umbrella/src/middleware.ts:21` sets `private, no-store`. This is a mismatch on main, not a redesign failure: `git diff` on the middleware, `provider/**`, `api/**` and `next.config.ts` is empty. It goes to the test owners.
3. (advisory) `sites/umbrella/src/app/globals.css:1097-1099` (`.hero-inner-split .hero-line { white-space: normal }`): at 1440×900 the hero H1 sets in three lines, "Build scenes." / "Keep the" / "source.", leaving one word alone on the last line. I measured the glyph ink gap between lines at 18px (1440) and 3.8px (390); no glyphs collide. A balanced two-line set would read better, but only if the `first-release` overview pins (stage ≥671×503, rail top ≤720, ≤9 sizes) still pass.

## lane-catalogs: PASS

Round 1 fix 1 is closed. Neither sheet has any colour, background or border transition left; the only transitions are on transform, opacity and clip-path. Hovering every visible control on Vitrine home, Forge home, Forge item and Vitrine publish shows only opacity, clip-path and transform. Round 1 advisory 2 is closed: the Forge `state-field-invalid` shot now differs from `home-refused` by the 700px invalid line on `#catalog-sort`. The new `plate-legend-label` fix keeps the text in the accessibility tree, and the probe finds no clipped text on any Forge route.

Both stores still match: every `_components/*` file and `loading.tsx` is byte-identical, and the sheets differ only in the identity block (42 diff lines). Detector: 0 (HEAD: 3 per store). No fixes.

## lane-kids: PASS

- The six `sites/kids/src/app/**` files are a clean port: HEAD equals the v5 PRE tree, and R equals OLD.
- `src/lib/**` is unchanged.
- All 11 BEFORE states have AFTER shots at 390, 768 and 1440, plus reduced and mid-motion frames.
- Measured: min contrast 6.10, min font 16px, no overflow, transitions on transform, opacity and clip-path only.
- `play-float` runs only while playing and stops under reduce.
- Production spec 1/1; tsc and `next build` 0; detector 0 (HEAD 1).

No fixes.

## lane-webshell: PASS

- `inspector-app.ts` is a clean port (HEAD equals PRE, and R equals OLD).
- 8 states × dark/light × 3 widths are present, plus reduced shots.
- Live measurements:
  - min contrast 5.78 dark, 5.74 light;
  - no overflow;
  - transitions on opacity and transform only;
  - the row 10 and row 14 animations run at 160–320ms;
  - 0 animations under reduce.
- Console: only the expected 409 refusal.
- `apps/web-shell` vitest green, including the CSP hashes.

1. (advisory) The detector's only finding is the pinned DV-X1 rail at `apps/web-shell/src/inspector-app.ts:837`. Lane Requests 1–2 (that rail, and the `aphoristic-cadence` copy) go to the test and copy owners.

## lane-desktop: PASS

Round 1 fix 1 is closed. The new shots exist at 1280×800 and 1920×1080, plus reduced shots:
- `assistant-thinking`: the thinking line is drawn;
- `assistant-hosted`: details open, and `#assistant-route-hosted` is `aria-pressed="true"` with the accent edge;
- `dock-console`;
- `assistant-closed` at 1920. At 1280 it equals default, because the compact drawer is closed in both states, as `E/before/NOTES.md` records.

The Linux palette is shot at both sizes. `dock-tab` shows Assets and `animate` shows Timeline, so every mode's dock tab is covered.

The re-run edits are correct:
- The selected-tab `::after` bar (`chrome/dock/styles.ts`) now draws, with `ld-draw-x` (280ms expo) plus the WAAPI glide on `MOTION_SYSTEM` tokens.
- `.menu-panel` is capped at `calc(100vh - 40px)` and scrolls, so nothing is cut off at 1280×800.

Measured:
- palette entrance: `ld-fade`, then `ld-dialog` (opacity, translate, clip-path), then the `ld-rise-sm` stagger, all 280ms expo;
- menu: `ld-drop` 200ms;
- mode change: a `translate` transition at 280ms;
- the `sweep` loop: 1200ms, transform only;
- under reduce: nothing runs.

The web profile's two `font-size:0` labels (`chrome/core/styles.ts:171,173`) were already on main (HEAD `:127,129`).

1. (advisory) `apps/desktop-shell/src/visual-tokens.ts:425-427`: the `dv-d6-loading-loop` row still says the retiming is pending, but it has landed. This file belongs to the foundation (lane Request D2).
2. (advisory) `E/before/desktop/compact-1100x800.png` (compact tier, drawers closed) has no AFTER twin. `E/after/desktop/work/capture.cjs:123-125` shoots 1100×800 only with a drawer open. The brief's "compact-tier drawers" are covered, so this is optional.
3. (advisory) Lane Request D1: the `aphoristic-cadence` copy at `chrome/core/panels.ts:43,46` goes to the copy owner. That file is unmodified.

## Not verified

- I did not look at any screenshot by eye, and no lane did either. My verdicts on "slop test at both altitudes" and "visibly better than BEFORE" rest on mechanical evidence:
  - detector findings went down on every surface (umbrella 3→0, stores 3→0 each, kids 1→0, desktop 4→0; the web shell stays at 1, the pinned DV-X1 rail);
  - 0 eyebrows and 0 glass on the sites;
  - the contrast, type and overflow probes;
  - no AFTER is identical to its BEFORE.

  The orchestrator's screenshot pass (`docs/cycle-2026-10/STATUS.md`) should look at `E/after/**`, starting with the umbrella `home-1440` H1 (advisory 3) and the desktop `compare/` sheets.
- Signed-in identity, credits and billing states cannot be rendered locally (§7.2.1). I reviewed them only through the shared CSS rules.
- I did not run `pnpm gate` or full `pnpm lint`. I ran eslint on every touched file instead (R-5).
- I did not run the umbrella spec's own `webServer` (`pnpm dev`), because it rewrites `sites/umbrella/pnpm-lock.yaml`. I ran the same spec files against a production server on 4173.

I started and stopped servers on 3201–3204, 3206, 4173 and 5281; all are free. I edited no file except `docs/redesign/reviews/lanes.md`.

VERDICT: PASS
