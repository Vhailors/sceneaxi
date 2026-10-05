# Review: redesign lanes (umbrella, catalogs, kids, webshell, desktop), round 4

Reviewer: independent. I built none of this. I re-ran every check below myself (cwd R, `TMPDIR` on disk,
because `/tmp` is full). Date: 2026-10-05.

- Sources: `DIRECTION.md` v5, `RULINGS.md` R-1 to R-6, `reviews/direction.md`, and the five `lanes/lane-*.md`
  reports (umbrella re-run 3, kids round 2, desktop round 4).
- This file replaces round 3.
- E = `/home/devuser/Documents/Reports/sceneaxi-redesign`. My scripts, logs, probe JSON and shots are in
  `E/review-lanes/r4/`.

Limits:

- No browser-tab tool and no skill-load tool are available here. I used headless Chromium 1223 (Playwright)
  against these servers:
  - `next start` on 3101 to 3104 (umbrella with `SCENEAXI_SITE_EDITOR_PREVIEW=1`);
  - the web-shell bin on 5181;
  - a static server on 3106 for chrome renders I made from the built `@sceneaxi/desktop-shell`.
- Every server is stopped and all seven ports are free (3101–3104, 3106, 5181, 4173).
- I ran `context.mjs --target` on `sites/umbrella/src/app`, `sites/kids/src/app` and
  `apps/desktop-shell/src`. Each exited 0 with NO_PRODUCT_MD, as DIRECTION §0 expects.
- I cannot display images, so no PNG was judged by eye. Overflow, overlap, contrast and the bans were
  judged from the live DOM, computed styles, the CSS and the BASELINE issue list. The pixel-level slop test
  and the "visibly better than BEFORE" check still need the director's final pass over `E/final/**`.
- I did not re-audit all five states (hover, focus, active, disabled, loading) on every control. Only the
  rules changed since round 3 and the states listed below were re-probed. The other states rely on rounds
  1–3 and the lane tables.
- One stray artifact of mine: a malformed shell heredoc of mine created an empty file in R's root at
  00:29. I deleted it, and the final ownership diff is back to 77 paths.

## Checks run (shared)

| Check | Result |
|---|---|
| Backup reconstruction | Verified on its own: for all 60 lane-touched `MOD` paths, `HEAD` + `staged.patch` + `unstaged.patch` (and `untracked.tgz` for the 8 untracked fallbacks) equals the rebuilt backup byte for byte |
| Ownership (every tracked and untracked non-ignored path vs the backup) | 77 paths differ, the same set as round 3, re-checked after every build and test. All are foundation or director paths, `docs/redesign/**`, lane-owned files, or the R-6 one-time grant (DIRECTION §8 rows, `docs/engine-desktop-surface.md` DV-D7..9 rows, three `DEVIATIONS` entries in `visual-tokens.ts`). No test file and no `src/lib/**` file changed. `kids-activity.ts` sha256 equals the backup and the profile copy (942c93b0…). Changed since round 3: only `sites/umbrella/src/app/globals.css` (00:07), `apps/desktop-shell/src/chrome.ts` (00:09) and `visual-tokens.ts` (00:10) |
| `pnpm build` | 0 |
| `pnpm exec vitest run tests/sites apps/web-shell apps/desktop-shell desktop/linux packages/site-kit` | 0: 72 files, 1781 tests |
| `pnpm exec vitest run tests/e2e` | 1: 16 failed, 572 passed. All 16 are in `desktop-editor-command-forms-golden`, and their names equal the baseline list exactly (`e2e-fail-names.txt` vs `E/backup/gate-baseline.log`) |
| Site `pnpm build` (umbrella, catalog-web, catalog-game, kids); `tsc --noEmit` (catalog-web, catalog-game, kids); umbrella `pnpm run typecheck` | 0 each. I rebuilt umbrella after its Playwright run (0), so `.next` is a production build |
| `pnpm check:sites` / `pnpm check:desktop` / `desktop/linux` `pnpm build` + `check:renderer` | 0 / 0 / 0 + 0 |
| `node --test`: `catalog-ux-regression` and `item-session-wiring` in both stores, catalog-game `rendered-route-states`; Kids `production-activity.spec.ts` on 3104 | 0 each |
| Umbrella site `vitest run` / `playwright test` | 1 / 1, only the known failures: `own-session-raw-origin.test.ts` (9) and `identity.visual.spec.ts:32` (`private, no-store`). The test files, `src/lib/identity-plane.ts` and every `api/**` file are byte-identical to the backup (R-5 rule). 131 tests and 6 specs pass, every `first-release` spec included |
| `pnpm exec eslint --max-warnings 0` on the 55 touched `.ts/.tsx` files | 0 |
| `pnpm lint` | 1: 255 errors in exactly the 17 R-5 files, the same list as round 3 |
| Detector on touched paths, now / backup | umbrella `src/app` 0/2; `VISUAL-EVIDENCE.md` 0/0; catalog-web 0/3; catalog-game 0/3; kids 0/1; `chrome.ts` 0/1; `visual-tokens.ts` 0/0; `desktop/linux/src/renderer` 0/0; `apps/web-shell/src` 1/1 (`side-tab` at `inspector-app.ts:837`, the pinned `pre[aria-busy]` rail, DV-X1). Rendered `chrome.html`: 1 `aphoristic-cadence`, from contract copy (Request D1) |
| Motion audit (postcss over the four site sheets and the rendered chrome sheet) | Every `@keyframes` touches only transform, opacity, clip-path or filter. No transition runs on any other property. The only literal timing left: Kids `play-float` (R-3) and the pinned `assistant-bars` stagger delays. Loops: umbrella and stores `*-progress`/sheen and Kids `loading-run` run on `--motion-duration-loop` + quart + `--motion-delay-loading` (R-1); chrome `sweep` and `assistant-bars` run on the R-2 tokens. Chrome: no `opacity` outside keyframes, no `scale(` |
| Hover/press transforms in a state rule (four site sheets) | 25 rules. Every offset or scale comes from `--motion-distance-*` or `--motion-scale-press` (site-kit sets 0px / 1 under reduce, with no local override), or is a static `rotate()` |
| Live probe (overflow, text past the viewport, clipping, min text, contrast on computed colours with alpha composited, side stripes, radius >16, 1px + ≥16px blur, backdrop, gradient text, eyebrow-like labels, running animations) | Umbrella: 15 routes. Each store: 5 routes. Kids: 9 states. All at 390/768/1440 and 1440 reduced. Web shell: 8 states × 2 schemes × 3 widths, plus 1440 reduced and forced colours. Desktop: 16 renders plus the outcome dialog at 1280×800 and 1920×1080 (each also reduced), plus 700×500. Results: overflow 0 everywhere (the stores' only "past viewport" hit is the off-screen skip link at −9999px). Min text: umbrella and stores 11px, Kids 17px, web shell 13px, desktop 11px. Lowest body contrast: umbrella 4.97 (`/editor`, 11px tree kind), Vitrine 5.71, Forge 5.09, Kids 6.1, web shell 5.74, desktop 4.9 (outcome status line, 12px). 0 contrast failures, 0 backdrop, 0 gradient text, 0 large radii, 0 ghost elevation. Stripes appear only on current-item indicators (row 17) and DV-X1 pins. Eyebrow-like hits appear only on `/engine` `.pipeline-num` (§7.2 keeps the step numbers). 0 running animations under reduce, except the R-3 float, which does not run |
| Attribute counts (data-\*, id, aria, role) per touched file, backup vs now | As in round 3: `account/page.tsx` aria 2→1 and `pricing/page.tsx` aria 5→4 (the decorative dots' `aria-hidden` on removed note cards; combined counts unchanged). Every other file is equal or higher (for example `chrome.ts` 245/54/183/35 → 258/54/209/35) |
| After-shots (IHDR width vs name, md5 duplicates) | umbrella 92, catalogs 80, kids 38, webshell 72, desktop 114 PNGs. The only byte-identical pairs are a state and its own `-reduced` copy (same end frame). Two umbrella readout PNGs are 320px element crops named `-1440` |

## lane-umbrella: PASS

Round 3 item 1 is closed, and I measured it on real routes at 1440.

| Element | No preference | Reduce |
|---|---|---|
| `.wordmark:hover .mark::before` | transitions `none → translate(1px, -1px)` over 160ms | transitions to `translate(0px)` and ends at `matrix(1,0,0,1,0,0)`: nothing moves |
| `/editor` rail glyph (preview) | `translateY(-1px)` | no transition, ends at 0 |

- `.ledger-rows summary:hover::before` (`globals.css:2258`) and the other 7 hover/press transforms use the
  same tokens. `/admin/ledger` renders no rows without a session, so for these rules I checked the CSS
  only.
- These still hold: the `/open` counters re-key (`sa-number-in` 200ms quint on Frame 2→3, Draw calls
  16→6 and Mounted; 0 animations under reduce); the release chip sits inline after the H1 from 600px
  through 1920; the `/docs` summaries are unclamped at 390, 768 and 1440; the no-WebGL refusal shows on
  `/` and `/open`.

1. **(advisory)** `globals.css:4959-4975`: the fixed `.ed-overlay-notes` rail (preview build only) still
   covers the dock tab strip at 1280×800 and 1440×900. A pointer hit at the tab centres lands on the notes;
   at 1920 every tab is reachable. The rule is byte-identical to the backup's `globals.css:4281`, so the
   lane did not cause it. Left for the director.
2. **(advisory)** Rename `E/after/umbrella/state-open-readout-change{-mid,d}-1440.png`. They are 320px element
   crops, so name them `-crop` instead of the viewport width.
3. **(advisory)** The `account` and `pricing` aria notes stand (`lanes/lane-umbrella.md:137`). Requests 1–3,
   5 and 7 stand. The deploy node must build fresh.

## lane-catalogs: PASS

Nothing in either store changed since round 3. I re-ran every check above on fresh builds: probes clean on
5 routes × 4 sizes per store, detector 0/3 → 0, `node --test` 0, `tsc` 0, builds 0, 0 animations under
reduce.

1. **(advisory)** Record the lane-level facts in DIRECTION §8: the 10% pressed layer on accent fills, the
   results-column H2 in the Heading role, and the 64rem split (`lanes/lane-catalogs.md:57-63`).
2. **(advisory)** `src/lib/site-config.ts:46` (both stores, test-owner path) stores `heroKicker` in
   capitals, so the hero chip after the H1 reads as an uppercase tagline. Requests 2 and 3 stand.

## lane-kids: PASS

Round 3 item 1 is closed:

- These shots now exist at the right widths: `E/after/kids/undo-{390,768,1440}.png`,
  `startover-{390,768,1440}.png` and both `-1440-reduced` copies (plus `world-change-*`). Their sizes
  match my own captures (390×1534 at 390).
- They are listed under Evidence.

My live states measure clean at 390, 768 and 1440 and at 1440 reduced: home, world change, building,
refusal, playing, stopped, undo, start over and grown-ups.

- Overflow 0, text ≥17px, contrast ≥6.1.
- At 1440 the stage is at x 130–848 and the builder at x 880–1310.
- Under reduce, 0 animations run.
- `production-activity.spec.ts` passes.

No app code changed this round. DV-K1, DV-K3 and DV-K4 are in §8 under R-6.

1. **(advisory)** R-K3: add DV-K5 (choice tiles measure 102–123px from `globals.css:494`
   `min-height: 98px`; the brief says 84–98px) to §8, or cap the tiles. It is recorded in the lane
   report, not silently.
2. **(advisory)** `key={note.serial}` re-announcing a repeated refusal is kept on purpose (one polite
   announcement per press). I accept the reason.

## lane-webshell: PASS

Nothing changed since round 3. Re-measured: 56 state × scheme × width rows.

- Two columns only at 1440 (form 24–440, diff 484–1416).
- Overflow 0, text ≥13px, contrast ≥5.74.
- Focus ring 2px solid in both themes and under forced colours at 390 and 1440.
- Detector shows only the pinned rail. The web-shell suites pass inside the 1781-test run.

1. **(advisory)** DV-W2 (H1 1.625rem) and DV-W3 (`scaleX` busy fill) are still not in DIRECTION §8.
2. **(advisory)** Recovery pending and forced colours have no lane shot. Neither is in the §7.5 Accept
   list. Request 1 stands.

## lane-desktop: PASS

Round 3 items 1–3 are closed. I measured them on my own renders from the built package.

**Item 1, outcome dialog.**

- Clicking the visible File > Open Project (`data-command="project-open"`) with no host bridge opens
  the outcome dialog: `data-overlay="outcome"`, "Project lifecycle refused", `DESKTOP_RUNTIME_UNAVAILABLE`,
  focus inside.
- The card is 13px radius with the `0 10px 14px -6px` shadow. It enters by `ld-fade` + `ld-dialog` (280ms
  expo: opacity, translate, clip-path), with 0 animations under reduce.
- `E/after/desktop/shots/outcome-*` now differ from `default-*`.

**Item 2, assistant modes.** `assistant-ask-*` and `assistant-agent-*` exist at both sizes, with
`aria-pressed` on ask and on agent respectively. They measure clean.

**Item 3, sculpt overlap.**

| Size | Note | Card | Point hits |
|---|---|---|---|
| 1280×800 | 474–810 × 375–413 | 465–819 × 423–529, inside the viewport (bottom 545) | 5 of 5 on the note, 3 of 3 on the card |
| 1920×1080 | — | — | 5 of 5 on the note, 3 of 3 on the card |

At both sizes, with and without reduce, the note and the card do not overlap.

**Since round 3 the rendered sheet changed only in three places:**

- `.sculpt-progress` `bottom`;
- the `.assistant-mode` fill moved to `::before`, plus `.is-gliding`;
- `ld-settle` was dropped from the mode.

The mode glide runs as Web Animations on `::before` (280ms expo: transform, clip-path), with none under
reduce. The dock-tab glide still runs at 1920 (`::after` 280ms expo). All 16 renders plus 700×500 measure
clean. The row-16 wipe list now has all three digest hooks (`chrome.ts:5009`).

1. **(advisory)** Request D1: `chrome.ts:177` and its pair, contract copy. This is the only detector
   finding left on the rendered `chrome.html`.
2. **(advisory)** Record DV-L1 (the DV-F8 in-band one-shot loading bar) in DIRECTION §8. Today it is
   only in the lane report. Compose (inert, renders Build) and the live viewport (needs an opened
   project) have their n/a written. Request D3 stands.

VERDICT: PASS
