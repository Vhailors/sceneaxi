# Lane report: lane-umbrella

Date: 2026-10-04/05. First run, then three re-runs against `docs/redesign/reviews/lanes.md` (`## lane-umbrella: FAIL`). Re-run 3 (review round 3) is the next section, then re-run 2 and re-run 1. Sources: `DIRECTION.md` v5 (§7.1, §7.2), `RULINGS.md` R-1 to R-5, and the foundation tokens in `lanes/foundation.md`.

## Re-run 3: review round 3 items

Only the items under `## lane-umbrella` in review round 3 were worked, plus the orchestrator's round-4 note. File touched: `src/app/globals.css` (lane-owned) and this report.

| # | Item | Done |
|---|---|---|
| 1 (blocking) | Hover nudges moved under `reduce` | Each literal offset is now written from `--motion-distance-sm` (4px; site-kit sets it to 0px under `reduce` on `:root`), keeping the same size: `.wordmark:hover .mark::before` → `translate(calc(var(--motion-distance-sm) / 4), calc(var(--motion-distance-sm) / -4))` (1px, -1px); `.ledger-rows summary:hover::before` → `translateX(calc(var(--motion-distance-sm) / 2)) rotate(45deg)` (2px); `.ed-rail-mode:hover … .ed-rail-glyph` → `translateY(calc(var(--motion-distance-sm) / -4))` (-1px). Measured on `next start` at 1440 with a real pointer hover (`_work/round4.mjs`, `_work/round4-hover-reduce.json`): no-pref wordmark `matrix(1,0,0,1,1,-1)`, ledger chevron x 2, glyph y -1; under `reduce`, all three hover to a 0,0 offset (wordmark `matrix(1,0,0,1,0,0)`, chevron the rest rotation only, glyph `matrix(1,0,0,1,0,0)`). The wordmark nudge now has its own row in the animation table. |
| sweep | Every `:hover`/`:active`/`:focus*` transform in `globals.css` | 10 rules found. All 10 use `--motion-distance-sm` (0 under reduce), `--motion-scale-press` (1 under reduce) or `none`: wordmark mark :286, `.store-link:hover .dot` :401, `.button:active` :736, arrow `:hover::after` :817, `.guide-link:active` :1386, `.profile-card:hover` :1688, ledger chevron :2257, `.tier:hover` :2744, blocked tier `none` :2813, rail glyph :5234. No literal-px `translate` is left in any state rule; the 3 left in the file are the `sa-progress` keyframes (reduce shows a static bar) and the static `.ed-overlay-notes` centring. |
| 2 (advisory) | `.ed-overlay-notes` covers the dock tabs at 1280/1440 | No change: the position is unchanged from the backup and the editor metrics are pinned. Left for the director. |
| 3 (advisory) | aria counts | No action, as the review says. Requests 1–3, 5 and 7 stand. |
| evidence | Duplicate shots | Byte-identical check over `E/after/umbrella/**/*.png`: `editor-refused-1440.png` and `-1440-reduced.png` were identical. Both re-shot from this build; the reduced shot is now taken with the pointer on the page's primary action (state layer painted, nothing moves), so the two differ (md5 `9611afc9…` vs `86de07b8…`). The only other identical pairs are `_work/rerun/{home,editor}-{390,768}.png`, archived copies of the same states, not used as evidence for any other state. |
| R-6 | Pending deviations | `RULINGS.md` R-6 lists only Kids (DV-K1/K3/K4) and desktop (DV-D7/D8/D9) entries. It has no umbrella entry, so the umbrella visual facts stay recorded under "Deviations applied" below, unchanged. |

Re-run 3 checks (all run by me, `TMPDIR` on disk):

| Command | cwd | Exit | Note |
|---|---|---|---|
| `node …/detect-antipatterns.mjs sites/umbrella/src/app/globals.css` and `sites/umbrella/src/app` | R | 0 | 0 findings (`_work/r4-detector.log` is empty) |
| `pnpm exec tsc --noEmit -p .` | sites/umbrella | 0 | after a build |
| `pnpm exec vitest run` | sites/umbrella | **1** | 6 files pass, 130 tests; 10 fail in 2 files that are not lane code: `own-session-raw-origin.test.ts` (9, Request 1), `account-lifecycle.test.ts` (1, harness, Request 3). `_work/r4-site-vitest.log` |
| `pnpm exec vitest run tests/sites` | R | 0 | 18 files, 798 tests |
| `pnpm check:sites` | R | 0 | "4 deployable sites verified" |
| `pnpm exec playwright test` (headless shell 1223) | sites/umbrella | **1** | 6 pass, all `first-release` specs; 1 fail `identity.visual.spec.ts:7`, unchanged (Request 2). No snapshot files exist; nothing re-recorded. |
| `pnpm build` (run last, after Playwright) | sites/umbrella | 0 | `.next` is a production build |

Server: `next start -p 3101` without the editor preview flag, stopped. PNGs not looked at by eye (no image display here).

## Re-run 2: review round 2 items

Only the items under `## lane-umbrella` in review round 2 were worked. Files touched in this pass: `src/app/_components/sculpt-viewport.tsx`, `src/app/editor/_components/editor-shell.tsx`, `src/app/globals.css` (all lane-owned), and this report.

| # | Item | Done |
|---|---|---|
| 1 (blocking) | `/open` runtime report counters (row 16) swapped with no motion | `sculpt-viewport.tsx` `SculptFrameReport`: the Pixels drawn, Frame, Draw calls and Mounted `dd`s are keyed by their own value (Draw calls uses the key `draws-` + its value, and so on), so a new value remounts the cell. Every text, tag and `code` is unchanged. `globals.css`: `.live-readout .dl dd` gets `font-variant-numeric: tabular-nums`, and inside `@media (prefers-reduced-motion: no-preference)` `animation: sa-number-in var(--motion-duration-state) var(--motion-ease-out-quint) backwards`. Measured live (1440, `next start`): pressing "Mount the root instance only" moved Frame 2→3, Draw calls 16→6, Mounted 3 ids→`service-crate-root`, and `document.getAnimations()` showed `sa-number-in` on exactly those three cells (Pixels drawn stayed `true`, so it did not replay). Under `reduce`: same values, 0 animations. Row added to the table below. |
| 2 | Release chip wrapped under the H1 at 1440/1920 | `globals.css` only. (a) From 48rem the head is `white-space: nowrap` and the H1 `normal`, so the only break left is the space between the two `.hero-line` phrases; the chip stays glued to "Keep the source." and the H1 breaks before the chip can drop. (b) In the split hero (≥1025px) the head gets its own row across both columns: `.hero-inner-split` rows `auto auto 1fr`, `.hero-copy` is a subgrid over rows 1–3 in column 1 (its box keeps column 1, so the pinned 1025px `first-release` breakpoint check still holds), the head is `width: max-content; max-width: 100cqi` (container on `.hero-inner`), lede row 2, actions row 3, stage column 2 rows 2–3. Measured: 390 chip wraps flush left (y 280); 768 inline (x 454–634); 1024 inline after line 2 (x 528–708); 1100 inline (x 562–742); 1280/1440/1920 H1 on one line with the chip inline (1440: H1 x 112–1061, chip x 1077–1256, row ends 1256 < 1328). Overflow 0 at every width. 1440 first viewport: H1 129–201, lede 223–279, actions 303–468, canvas 223–698. Recorded as a Deviation below. |
| 3 | `.guide-link p` clamped to 2 lines | Clamp removed (`overflow`, `display: -webkit-box`, `-webkit-line-clamp`, `-webkit-box-orient` deleted). `/docs` summaries: scrollHeight = clientHeight on all four at 390 (48/96/144/48) and 1440 (24/48/72/24); line clamp `none`. |
| 4 | Mode-rail needle and view/dock tab underlines drew in place | `editor-shell.tsx`: new view-only hook `useIndicatorGlide` (layout effect). When the selection in a strip changes, it animates the new item's indicator pseudo-element from the previous item's position: `translateY`/`translateX` by the measured offset plus a `clip-path: inset()` trim for a width/height difference, to `none`/`inset(0)`. Duration and easing are read from `--motion-duration-panel` and `--motion-ease-out-expo` on the strip (no literals). Skipped under `prefers-reduced-motion: reduce`, on first paint, and when the previous item is gone; the CSS centre draw stays the fallback. Wired to the rail (`::before`, y, key `mode`), view tabs and dock tabs (`::after`, x). Refs added to the three strips; no class, role, aria or id changed. Measured: rail switch → `::before translateY(-44px)` 280ms `cubic-bezier(0.16, 1, 0.3, 1)`; dock tab → `::after translateX(-223px)` with clip-path; under `reduce` 0 script animations. View tabs: the selected source is decided server-side and does not change client-side today, so that strip only ever shows the fallback draw. |
| 5 | `/admin/ledger` row 16 had no motion and no n/a | n/a written under "States without a motion row". |
| 6 | Aria 2→1 / 5→4 note | Already explained under the hook count; nothing changed. |
| 7 | `.ed-tree li.is-selected::before` 2px accent bar | Rule deleted; the 16% accent tint on the row stays. Measured: `::before` content `none`, background tinted. |
| 8 | Requests, fresh build | Requests 1–3, 5, 7 stand. `pnpm build` in `sites/umbrella` was the last command of this pass, after the Playwright run. |

Re-run 2 checks (all run by me, today, `TMPDIR` on disk):

| Command | cwd | Exit | Note |
|---|---|---|---|
| `pnpm exec tsc --noEmit -p .` | sites/umbrella | 0 | after a build (before one, `.next/types` is missing and it prints TS2882 for `globals.css`) |
| `pnpm exec vitest run tests/sites` | R | 0 | 18 files, 798 tests |
| `pnpm exec vitest run` | sites/umbrella | **1** | 7 files pass; only `test/own-session-raw-origin.test.ts` fails (9), unchanged, not lane code (Request 1) |
| `pnpm exec playwright test` (headless shell 1223) | sites/umbrella | **1** | 6 pass incl. every `first-release` spec (1025/1024 breakpoint included); 1 fail `identity.visual.spec.ts` `private, no-store` header, unchanged (Request 2). No snapshot files exist, so nothing to re-record. |
| `eslint --max-warnings 0` on `editor-shell.tsx`, `sculpt-viewport.tsx` | R | 0 | |
| `detect-antipatterns.mjs sites/umbrella/src/app` and each touched file | R | 0 | |
| `pnpm check:sites` | R | 0 | "4 deployable sites verified" |
| `pnpm build` (run last) | sites/umbrella | 0 | `.next` is a production build |

Hook count this pass: `editor-shell.tsx` 65 (HEAD) → 71, `sculpt-viewport.tsx` 3 → 3; this pass added refs and keys only.

Re-run 2 evidence (`next start -p 3101`, `SCENEAXI_SITE_EDITOR_PREVIEW=1`, server stopped):

- All 18 states re-captured at 390/768/1440 + 1440 reduced: `E/after/umbrella/<route>-*.png`. `metrics.json` was rewritten (previous copy: `_work/metrics-run2.json`): overflow 0 everywhere, min text 11px, worst body contrast 5.16:1 (`/open`), 0 eyebrows.
- Editor desktop sizes re-captured by `_work/checks.mjs`: `editor-shell-{1280,1920}{,-mode-switch-mid,-mode-switched,-palette}.png`, `editor-shell-1280-reduced.png`.
- New: `state-open-readout-change-mid-1440.png`, `state-open-readout-changed-1440.png`, `editor-shell-1280-dock-glide-mid.png`, `editor-shell-1280-dock-glided.png` (`_work/round3.mjs`).
- Logs: `_work/r3-*.log`. PNGs not looked at by eye (no image display here).

Not fixed (outside the review items, noted for the director): at 1280×800 and 1440×900 in the preview build, the fixed `.ed-overlay-notes` rail (preview note + "Catalog intake is not open on this deployment") sits over the dock tab strip, so a pointer click on a dock tab lands on the notes. Keyboard and script activation work. This rail is existing behaviour (`globals.css` comment above `.ed-overlay-notes`).

## Re-run 1: review round 1 items


Only the items under `## lane-umbrella` were worked.

| # | Item | Done |
|---|---|---|
| 1 (blocking) | `.ed-minimum` 2px accent left stripe in the `max-width: 899px / max-height: 599px` block | Deleted `border-left: 2px solid var(--accent)` from `globals.css`. The base 1px `--line` frame applies. Measured live on `/editor` (preview): at 390 and 768 the box computes 1px `rgb(28, 33, 41)` on all four sides. No tone chip added; the refusal copy already carries the state. |
| 2 | Row 14 for `/editor` had no n/a | Added under "States without a motion row". |
| 3 | Aria count 2→1 in `account/page.tsx`, 5→4 in `pricing/page.tsx` | Explained under the hook count. |
| 4 | Release chip should sit inline after the H1 | `page.tsx`: the H1 text is two `<span className="hero-line">` phrases (`textContent` unchanged: "Build scenes. Keep the source."). `globals.css`: `.hero-title` is a block, the H1 is inline with a `--space-4` end margin, the chip sits on the H1's last line (`vertical-align: 0.4em`, `--space-2` top margin), `.hero-line` is nowrap from 25rem. Measured: inline at 760–880 and 768 (x 454–634); at 390 it wraps under the H1; at 1440 and 1920 it also wraps flush left under the H1, because the 539px copy column leaves 20px after "Keep the source." at 66px. Shrinking the H1 or the stage was not done (both are DIRECTION facts). The H1 breaks only between the two phrases from 380px up; sweep 360–1920 in `E/after/umbrella/_work/hero-chip-sweep.txt`, 0 overflow. A first attempt (balance across the row) broke the H1 into 3 lines at 1440 and was dropped. |
| 5 | Visual-spec runs leave a `pnpm dev` `.next` | I ran `first-release.visual.spec.ts`, then `pnpm build` (exit 0) twice after it; the `.next` in `sites/umbrella` is a production build. Deploy nodes should still build fresh. |
| 6 | Request 4 closed | Marked closed in Requests. |

Also in `globals.css`: `.webxp-head` `align-items: start` → `flex-start` (the dev server printed an autoprefixer warning for it; same rendering in Chromium).

Re-run checks (all run by me, today):

| Command | cwd | Exit | Note |
|---|---|---|---|
| `./node_modules/.bin/tsc --noEmit -p .` | sites/umbrella | 0 | |
| `./node_modules/.bin/vitest run` | sites/umbrella | **1** | 7 files pass, 131 tests. Only `test/own-session-raw-origin.test.ts` fails (9), unchanged from the first run and from the review; not lane code. `account-lifecycle.test.ts` passed this time. |
| `pnpm build` | sites/umbrella | 0 | includes `check-vercel-package` |
| `pnpm check:sites` | R | 0 | "4 deployable sites verified" |
| `pnpm exec vitest run tests/sites` | R | 0 | 18 files, 798 tests |
| `playwright test test/first-release.visual.spec.ts` (`SCENEAXI_CHROME_PATH` = headless shell 1223) | sites/umbrella | 0 | 6/6 |
| `eslint --max-warnings 0 sites/umbrella/src/app/page.tsx` | R | 0 | |
| `detect-antipatterns.mjs sites/umbrella/src/app` | R | 0 | 0 findings |

Re-run evidence: `E/after/umbrella/{home,editor}-{390,768,1440}.png` and `-1440-reduced.png` re-captured (`next start -p 3101`, `SCENEAXI_SITE_EDITOR_PREVIEW=1`); their rows in `metrics.json` replaced (overflow 0, min text 11px, worst contrast 5.38:1). Probes: `_work/edmin.mjs`, `_work/hero-chip.mjs`, `_work/hero-chip-sweep.mjs`, `_work/hero-measure.txt`. Server on 3101 stopped. PNGs not looked at by eye (no image display here).

E = `/home/devuser/Documents/Reports/sceneaxi-redesign`.

## Process

- **Skill:** there is no skill-load tool in this harness, so I read `SKILL.md` directly. I ran `context.mjs --target sites/umbrella/src/app` (exit 0). It reported no PRODUCT.md at the site root, as DIRECTION.md says it would, so I read DIRECTION.md, RULINGS.md and the review directly. References read:
  - `animate.md`, `craft-floor.md`, `operate.md` (the register file, since the skill ships no `brand.md` or `product.md`);
  - `polish.md`, `typeset.md`, `layout.md`;
  - `harden.md` and `adapt.md` (first sections only).
- **Not used, references not read:** `critique`, `audit`, `colorize`, `delight` and `shape`.
- **Browser:** there was no browser-tab tool, so I used headless Chromium 1223 through Playwright against `next start -p 3101`, on top of a fresh `pnpm build`. The server is stopped. Playwright's own spec server on 4173 was also stopped by Playwright itself.
- **Environment:** `/tmp` (a tmpfs) is 100% full. Other processes (chromium, java, looptest) hold deleted files open there. Because of that the file-edit tool failed, so I wrote the CSS with shell heredocs. I also ran every command with `TMPDIR=/home/devuser/.cache/sxr-tmp`.
- **TypeScript wrapper:** a bare `tsc` in this shell runs a wrapper and prints TS2882. The project's own `node_modules/.bin/tsc` (5.9.3) is the real check.

## Files changed (all lane-owned)

| File | Change |
|---|---|
| `src/app/globals.css` | **Site layer rewritten** (lines 1–~2200).<br>• Restructured on the tokens: 4px spacing scale and the §3 type roles.<br>• Removed `.eyebrow`, `.badge`, `.note-card`, side rails, the glass masthead and the ghost shadows.<br>• Added state layers, the focus halo, painted disabled states, the R-1 loading bar, `.title-row` chips, guide lists, prose blocks, ledger rows and the live stage.<br>• Added all route entrances (motion table below).<br>**Editor section** kept verbatim, except:<br>• the two `0 18px 40px` ghost shadows now use `var(--surface-float-shadow)`;<br>• the drawer shadow is now `-10px 0 14px -6px`;<br>• the `ed-minimum` 2px left rail is now a 1px tone border;<br>• 35 editor font sizes under 11px raised to 11px (the rail labels use Archivo at 75% width so they fit 44px);<br>• new rule `.edshell code { font-size: inherit }`.<br>**Tail:** dead site overrides deleted. An editor motion layer added. |
| `layout.tsx` | Unchanged; it was already correct. |
| `page.tsx` | The release marker moved from a `.badge` above the H1 to a Needs-review chip after the H1 (`.title-row`). Path links are marked for CSS arrows. |
| `engine/page.tsx` | All 6 eyebrows removed: the release and platform labels became chips after their headings, and the section labels were dropped.<br>The "Copy and verify" label now uses `.command-label` (UI role).<br>The package card grid became a mono list; the 4 note cards became a two-column prose list.<br>Pipeline steps sit on a 1px connector. |
| `profiles/page.tsx` | Eyebrow dropped. Game and Web are now a two-column comparison with a 2px top tone edge. Kids is an Isolated `StatePanel` with no href. |
| `pricing/page.tsx` | Eyebrow dropped.<br>Tiers stagger in (`tier-list`), the flag is a chip, and the purchase block is classed.<br>The note cards became one prose block, each title leading its paragraph. |
| `open/page.tsx`, `open/_components/live-viewport.tsx` | Eyebrow became a chip. The four panels became a two-column prose list. The viewport is wrapped in `.live-stage`, and the readout sits beside it from 1181px. |
| `docs/page.tsx` | The help-topic card grid became a guide list (title, summary, mono route, arrow). The rule card is a hairline box with an Info chip. The "Download"/"Next" cards became a guide list. |
| `docs/_components/help-doc-page.tsx` | Section classes added. Related links became a guide list. The current crumb has `aria-current`. |
| `docs/loading.tsx`, `editor/loading.tsx` | A loading bar sits beside the attribute-free `h1`, and the line is now a lede. |
| `login/page.tsx` | Three eyebrows dropped. The page is now a centred 28rem column. The form is a card with stacked fields and a block submit. |
| `account/page.tsx` | Eyebrow dropped. The balance `dl` is classed. The history section is classed. The note cards became one prose block. |
| `admin/ledger/page.tsx` | Page heads added. The forms are cards. Entries, intents and reconciliations are `.ledger-rows` with labels. |
| `editor/page.tsx` | Five refused-state eyebrows became chips after the H1. Each refused page is a narrow state page. |
| `editor/_components/web-experience-editor.tsx` | Two eyebrows became chips after their headings. |
| `error.tsx`, `not-found.tsx` | Each eyebrow became a Refused or Dormant chip after the H1. The digest sits in a mono field well. |
| `VISUAL-EVIDENCE.md` | A redesign section was added. |

**Hook count** (data-\*, `id=`, aria-\*, `role=` per touched TSX, before → after): no file went down. Diffs: page 17→19, engine 6→7, docs 10→12, admin 8→11, editor/page 3→8, account 4→4, pricing 5→5, profiles 1→2, open 0→2, error 0→1, not-found 0→1, live-viewport 1→2, help-doc 1→3, loadings 3→4, webxp 26→27. Lists are in `E/after/umbrella/_work/attr-{before,after}.txt`. Per category, `account/page.tsx` aria went 2→1 and `pricing/page.tsx` aria went 5→4: the lost attribute in each is the `aria-hidden` on the decorative dot of a removed note card. No role, label, id or data hook was removed, and each file's combined count is unchanged (4→4, 5→5). The re-run's `page.tsx` change adds no hook and removes none (19).

## Animation table

Every row uses the `--motion-*` tokens. "In no-pref" means the entrance only runs inside `prefers-reduced-motion: no-preference`; site-kit also sets distances to 0 and scale to 1 under `reduce`.

| Element | Trigger | Motion, tokens | Reduced-motion fallback |
|---|---|---|---|
| Nav current indicator `.nav a[aria-current]::after` | page arrival | draws from centre: `sa-draw-center` clip-path, `panel` + `ease-out-expo` | indicator shown at once |
| Nav hover indicator | hover | clip-path `inset(0 50%)`→`inset(0)`: `micro` in, `panel-exit` out, quart | clip-path still transitions (no movement) |
| Masthead hairline `::after` | scroll 0–24px | opacity via `animation-timeline: scroll()` | line at opacity 1 |
| Button state layer `.button::before` | hover / press | opacity 0→.08→.12: `micro` / `press`, quart | same (opacity only) |
| Button press | `:active` | `scale(var(--motion-scale-press))`, `press` | scale token = 1 |
| Button focus halo `::after` | focus-visible | opacity in, `press`; the outline itself is instant | same |
| Loading bar (button `aria-busy`, `.loading-bar`) | busy | `sa-progress` translateX, `loop` + quart, delay `delay-loading` (R-1) | static 40% bar |
| Arrows (button, path links, guide links, proof links) | hover | `translateX(distance-sm)`, `micro` quart | distance 0 |
| Wordmark mark `.wordmark:hover .mark::before` | hover | 1px up-right nudge, `translate(distance-sm / 4, distance-sm / -4)`, `micro` quart | distance 0: does not move |
| Path / guide link press | `:active` | state layer + press scale | scale 1 |
| Persuade head (`/`, `/engine`, `/pricing`, `/profiles`) | first paint | `sx-rise-lg`, `route` expo, 40ms stagger, max 3 items | static (in no-pref) |
| Hero viewport and `/open` canvas | first paint | `sa-aperture` clip-path `inset(48% 0 48% 0)`→`inset(0)` over the visible frame (the poster), `route` expo | canvas shown at once |
| Viewport overlay / hero provenance line / download context | appear | `sx-rise-sm`, `state` quint | static |
| State panel tone underline `.state-head::after` | panel appears | `sx-draw` clip-path, `state` quint | line present |
| State chip on 404 / error | first paint | `sx-rise-sm`, `state` quint | static |
| Status lines `main p[role=status]` | appear | `sx-rise-sm`, `state` quint | static |
| Pricing tiers | first paint | `sx-rise-sm`, `panel` expo, `nth-child` stagger capped at `stagger-max` | static |
| Pricing pack selection | hover / focus-within | hover lift `translateY(-distance-sm)`, `micro`; focus-within paints an accent frame | no lift; frame still paints |
| Purchase block (`aria-disabled`) | always | painted disabled (dashed, `--fg-2`, not-allowed); its tier does not lift | same |
| Profile cards | hover | lift `-distance-sm`, `micro` | none |
| Login / admin fields `.field::after` | focus / invalid | focus line draws from centre, `micro` in, `panel-exit` out; `:user-invalid` turns red and fills | colour and line still change |
| Account balance `.ledger-balance` | arrival | `sa-number-in` (translateY + fade), `state` quint | shown at once |
| Ledger rows (`details`) | hover / open | hover paint; chevron nudges `translateX(distance-sm / 2)` then rotates, `micro`; record rises in, `sx-rise-sm`, `panel` expo; closing is instant (§6.2 rule 4) | no nudge (distance 0); chevron turns, no rise |
| Docs rail / TOC indicator | hover; URL `#anchor` (`:has(:target)`) | 2px indicator clip-path draws from its middle, `micro` / `panel` expo | clip-path change without movement |
| `/open` runtime report counters `.live-readout .dl dd` (row 16) | a value changes (cells keyed by value remount) | `sa-number-in` (translateY `distance-sm` + fade), `state` quint; `tabular-nums` | value swaps in place (animation only in no-pref) |
| Editor mode rail (tool selection, row 17) | mode switch | one needle glides from the previous mode: `translateY` + `clip-path` on `::before`, Web Animations reading `--motion-duration-panel` / `--motion-ease-out-expo` (`useIndicatorGlide`); first paint: `sa-draw-y` centre draw; glyph hover nudge `translateY(distance-sm / -4)`, `micro` (0 under reduce) | appears in place (script skips on `reduce`; CSS draw only in no-pref) |
| Editor view / dock tabs (row 17) | selection | one 2px underline glides from the previous tab: `translateX` + `clip-path` on `::after`, same hook and tokens; first paint or no previous tab: `sa-draw-center` | appears in place |
| Editor panels (dock body, inspector, webxp side) | shown | `sx-rise-sm`, `panel` expo; closing is instant | static |
| Assistant drawer | opened | `sa-drawer-in` translateX(`distance-lg`), `panel` expo | static |
| Command palette | opened | scrim `sx-fade`; card `sa-dialog-in` (translateY + clip-path); rows stagger ≤6 | static |
| Local checkpoint panel, overlay notes | opened / appear | `sx-rise-sm` | static |

States without a motion row, each with its reason:

- **Mobile menu: n/a.** There is no menu. The nav stays visible at every width (a wrapped row at ≤860px, a 4-column grid with 44px targets at ≤620px). Adding a disclosure would be new behaviour (DIRECTION §10), and `umbrella-visual.test.ts` forbids `useState`/`onClick` in `site-nav.tsx`.
- **Row 16 on `/admin/ledger`: n/a.** Balances and amounts are server-rendered and never change in place; a new figure only arrives with a new page render, which the route has no motion for (Operate surface). The account balance arrival row above covers `/account`.
- **Code-copy feedback: n/a.** No copy control exists, and DIRECTION §10 names copy buttons as non-lane behaviour.
- **Row 14 on `/editor` (decided-row ✕/✓): n/a.** On this surface the per-row ✕/✓ are `kind: "inert"` (`packages/site-kit/src/editor-shell.ts:936-947`), so a row can never be decided and there is nothing to animate.
- **Login submit loading: styled but never shown.** The `aria-busy` style is in place. The form is a native POST from a server component, and the client-component list is pinned, so nothing sets `aria-busy` today.

## Checks

| Command | cwd | Exit | Note |
|---|---|---|---|
| `./node_modules/.bin/tsc --noEmit -p .` | sites/umbrella | 0 | TS 5.9.3 |
| `./node_modules/.bin/vitest run` | sites/umbrella | **1** | 6 files pass. 2 files fail, neither touched by this lane:<br>• `test/own-session-raw-origin.test.ts`: 9 failures. Its `vi.mock` lacks `verifyUmbrellaDeploymentFormOrigin`, which `src/lib/identity-plane.ts` now exports.<br>• `test/account-lifecycle.test.ts`: a PostgreSQL/HTTPS harness `ready` check fails before any test runs.<br>Both files are dated 2026-10-01/02, before this run. Log: `E/after/umbrella/_work/site-vitest.log`. |
| `pnpm build` | sites/umbrella | 0 | includes `check-vercel-package` |
| `pnpm check:sites` | R | 0 | "4 deployable sites verified" |
| `pnpm build` | R | 0 | |
| `vitest run` (umbrella-visual, launch-marketing, login-flow, profile-matrix, site-seams, site-response-hardening, web-experience-editor, desktop-download, credit-pack-purchase-ux, editor-shell-parity, editor-catalog-intake-golden) | R | 0 | 11 files, 531 tests |
| `vitest run tests/sites/` | R | 0 | 798 pass. An earlier run caught 5 transient storefront-lockstep failures while lane-catalogs was editing; they passed on re-run. |
| `playwright test` (umbrella visual specs) | sites/umbrella | **1** | 6/7 pass, and every `first-release` spec passes. One failure: `identity.visual.spec.ts:32` expects `cache-control: no-store` and the API sends `private, no-store`. That is API behaviour, not a visual change. |
| `eslint --max-warnings 0` on the 24 umbrella `src/app` TS/TSX files that differ from HEAD | R | 0 | |
| `pnpm lint` | R | 1 | 18 files: the 17 R-5 files plus `apps/desktop-shell/src/chrome.ts`, which belongs to lane-desktop. No umbrella file is listed. |
| `detect-antipatterns.mjs sites/umbrella/src/app` (also run on VISUAL-EVIDENCE.md and this report) | R | 0 | 0 findings. Before this lane there were 2 side-tabs. |

## Evidence

- `E/after/umbrella/<route>-{390,768,1440}.png` and `<route>-1440-reduced.png` for 18 states: home, engine, profiles, pricing, open, docs, docs-getting-started, docs-cli, docs-credits-and-pricing, docs-faq, login, account, editor (preview shell), admin-ledger, 404, error-boundary, docs-loading, editor-loading. Also `editor-refused-*`.
- Desktop-size editor shots: `editor-shell-{1280,1920}.png`, `-mode-switch-mid`, `-mode-switched`, `-palette`, and `editor-shell-1280-reduced.png`.
- State shots: `state-home-button-hover-1440.png`, `state-home-button-focus-1440.png`, `state-docs-rail-target-1440.png`.
- Measurements:
  - `metrics.json` gives the per-state results: overflow 0 everywhere; minimum text 11px; worst contrast 5.16:1 (`/open`) with every other text ≥5.38:1; 0 `.eyebrow`; 0 `backdrop-filter`.
  - The structural measures are in `VISUAL-EVIDENCE.md`.
- Scripts and logs: `E/after/umbrella/_work/`, which also keeps the pre-change `globals.before.css` and `app-before.tgz`.
- **Not looked at by eye:** this harness cannot display PNGs. The final director pass should view them.

## Deviations applied

- DV-F1/F2/F5/F6/F9/F10/F11 and DV-F8 (R-1 loading bar), as DIRECTION states them.
- New visual facts, recorded here:
  - **Editor rail mode labels:** were 7.5px mono; now 11px Archivo at `font-stretch: 75%`. This keeps the 11px floor inside the pinned 44px buttons.
  - **Masthead `.wordmark`:** gets `min-height: 44px`. It keeps the wordmark and nav tops aligned at 861px (`first-release` spec) and makes a 44px target.
  - **Nav at ≤620px:** a 4-column grid of 44px targets. The previous tail CSS already did this; it is kept.
  - **Home hero head at ≥1025px (re-run 2):** the split hero keeps its two columns, but the H1 + release chip now take a row of their own across both columns, with the lede and actions in the copy column beside the canvas below it. Before, the 539px copy column could not hold the 66px H1's last line plus the chip, so the chip wrapped under the H1 against §7.1 ("inline after the H1 ... wraps under it at 390"). H1 size, the stage column ratio (0.92fr / 1.08fr) and the canvas frame are unchanged; the canvas now starts at the lede's top (1440: y 223) instead of beside the H1. From 768px the chip is glued to the H1's last phrase (`nowrap` head, `normal` H1).
  - **Editor tree selection (re-run 2):** the 2px accent bar on the selected `.ed-tree` row is removed; the selection is the 16% accent row tint alone.
  - **Docs guide summaries (re-run 2):** no line clamp; summaries wrap in full.

## Requests

1. **test-owners, `sites/umbrella/test/own-session-raw-origin.test.ts`:** add `verifyUmbrellaDeploymentFormOrigin` to the `vi.mock("../src/lib/identity-plane.js")` factory (9 failures).
2. **test-owners / identity owner, `identity.visual.spec.ts:32`:** either accept `private, no-store` or change the `/api/auth/sign-in/email` header. This lane may not touch `api/**`.
3. **test-owners, `test/account-lifecycle.test.ts`:** its PostgreSQL/HTTPS harness is not ready in this environment. Document the requirement or skip it with a named reason; this lane will not skip it.
4. **Closed** (review item 6): `pnpm lint` now lists only the 17 R-5 files.
5. **Ops:** `/tmp` is full because processes hold deleted files open (chromium pid 2714947, java pid 438936, looptest). The edit tool and default Playwright runs fail until that is freed.
6. **Product owner, optional and out of lane scope:**
   - a copy button on `.command` wells (the CSS states are ready);
   - a client submit state for `/login`, which needs the pinned client list widened.
7. **Deploy node (umbrella):** build fresh before deploying; never ship a `.next` left by a `playwright test` run (its web server is `pnpm dev`).

## Final polish (2026-10-05, `reviews/final.md`)

Applied by the polish node after the final design review. Visual and interaction only; no hook, id, aria, route or pinned copy changed.

| Fix | Change (`sites/umbrella/src/app/globals.css` unless noted) |
|---|---|
| 1 (blocking) | Table floors restored: `.comparison-table, .profile-release-matrix { min-width: 960px; table-layout: fixed }` with the HEAD column widths; `.matrix th[scope="row"] { min-width: 22ch }`; `td.wrap, th.wrap { min-width: 20ch }`; `/open` instance table gets `className="instance-table"` (`open/page.tsx:130`, `min-width: 40rem`). At 390 every table scrolls in its region: `/profiles` 4895px tall (was 8482), row header 176px; `/` 4769px. |
| 2 (blocking) | `.ed-overlay-notes` is no longer floated over the shell. From 900×600 up it is a fixed band at the top of the window, `clamp(72px, 100vh − 640px, 168px)` tall, scrolling inside; `.edshell` and `.ed-palette-scrim` start below it, and the palette's max-height subtracts it. Below the minimum the flow layout is unchanged. Class name kept. |
| 2 (follow-up) | The shorter shell exposed a 15px dock-strip overflow at the 440px docked column (1440 wide): `.ed-dock-tabs` scrolls inside its strip, `.ed-dock-tab` and `.ed-dock-bulk` are `flex: none`, bulk buttons take 8px inline padding, the strip gap is 4px, and in the compact tier the strip stops 22px short of the assistant drawer's overhang (344 − 326). |
| 3 (blocking) | `.ed-project { justify-content: safe center }`; the pill, its doc path and the save label get `min-width: 0; overflow: hidden` (path and label ellipsize). |
| 4 (blocking) | All 86 off-scale spacing values in the editor section snapped to tokens (5→`--space-1`; 6/7/9/10→`--space-2`; 11/14→`--space-3`; 20→`--space-4`) by `E/after/polish/scripts/polish-snap-spacing.cjs`. Token audit: 0 off-scale. Pinned structural metrics untouched. |
| 5 (blocking) | `:active` on `.nav a` (12% `currentColor` layer + `--motion-scale-press`, transform transition on the micro token), `.wordmark` (mark press), `.footer-col a` and prose links (12% layer, 2px `currentColor` underline; prose never moves). |
| 10 (blocking) | Reduce block: `html .nav a::after, html .field::after, html .docs-rail a::before, html .toc a::before { transition: none }` (the `html` prefix is needed: the indicator rules come later). Under reduce, nav hover now runs 0 transitions. |

Evidence (`next start`, `SCENEAXI_SITE_EDITOR_PREVIEW=1`, headless Chromium; PNGs not viewed by eye):
- Re-captured: `E/after/umbrella/{home,profiles,open,pricing,docs}-{390,768,1440}.png` + `-1440-reduced.png`; `editor-{390,768,1440}.png`; `editor-shell-{1280,1440x900,1680x1050,1920,900x600,1179x700,1440x720}.png`, `-1280-reduced`, `-1920-reduced`, `editor-shell-1280-palette.png`.
- Data: `E/after/polish/data/verify-{umbrella,editor}.json`. Pointer hits on every dock tab, profile chip, Reject/Accept all, rail mode, menu and the viewport lede return the control itself at 1280×800, 1440×900, 1440×720, 1680×1050 and 1920×1080. The pill never reaches the profile switch. Palette at 1280×800 spans y 256–714, below the 160px band.
- Still covered (not in final.md, existing): in the narrow tier (900×600, 1179×700) the open assistant overlay drawer covers Reject/Accept all and the edge of the lede until it is closed.

Checks (cwd R, TMPDIR `/home/devuser/.cache/sxg2448052`, removed afterwards; logs in `E/after/polish/logs/`):
- `pnpm gate`: exit 1 at `pnpm test` with only the allowed baseline failures: the 16 `desktop-editor-command-forms-golden` tests and 2 `asset-preparation-bounds` deadline tests (timing; that file passes 12/12 alone). Steps before `test` passed. The two steps after it were run separately: `node --test scripts/check-contracts.test.mjs` exit 0; `pnpm lint` exit 1 with 255 errors in exactly the 17 R-5 files.
- `vitest run tests/sites packages/site-kit/test tests/e2e/editor-catalog-intake-golden.test.ts`: 1324 passed. `vitest run apps/desktop-shell`: 244 passed. `tsc -b apps/desktop-shell`: 0. `next build` umbrella, catalog-web, catalog-game: 0.
- `eslint --max-warnings 0` on the touched tsx/ts files: 0. Detector on every touched file: 0 findings.

## Final polish, round 2 (2026-10-05, `reviews/final.md` round 2)

Applied by the polish node. Visual and interaction only; no hook, id, aria, route or pinned copy changed.

| Fix | Change (`sites/umbrella/src/app/globals.css` unless noted) |
|---|---|
| 1 (blocking) | Section rhythm on §4: `src/lib/foundations.ts` `bandPad` 104px → 72px; the ≤1180 `--band-pad: 88px` override is removed (it now equals the base); ≤860 `--band-pad` 72px → 44px; the ≤620 `--band-pad: 44px` line is removed (inherits 44 from ≤860). Measured `.band-inner` 72/72 at 1440, 1180, 1024; 44/44 at 768, 390. |
| 2 (blocking) | ≤620 `--gutter` 20px → 16px. Measured text left edge 16px at 390 on six routes (stores match: 16px). |
| 4 (blocking) | `.chip` `letter-spacing` 0.04em → 0.08em; new `th .chip { text-transform: none }`, so `/` and `/profiles` read the same "Not yet claimed". `pricing/page.tsx:98` chip text `BEST RATE PER CREDIT` → `Best rate per credit` (case only; not test-pinned; `VISUAL-EVIDENCE.md:387` still quotes the old case). Measured: every chip on 6 routes `text-transform: none`, 0.88px tracking, inside and outside `th`. |
| 5 (blocking) | `/editor`. Compact tier (below 1440×720): with the drawer open the whole `.ed-viewport-col` takes `margin-right: calc(344px - 326px)` (replaces round 1's dock-strip-only padding, which is removed); a Kids lock, which has no inspector under the drawer, takes `margin-right: 344px`. Narrow tier (below 1180×660): `.ed-viewport-col` takes `margin-right: 344px`, and the inspector cell the drawer cuts gets the row 7 scrim: `.ed-body:has(> .ed-inspector)::after` on grid cell 3/2, `color-mix(in srgb, var(--bg-base) 62%, transparent)` (the palette scrim's mix), `z-index: 4` under the drawer's 5, `pointer-events: none` (the drawer is not modal). The scrim fades in with `sx-fade` over the panel token, expo; under reduce it appears at once (blanket rule). `.ed-assistant { width: 344px }` unchanged. |
| 6 (advisory) | Compact tier: `.ed-project-doc { display: none }`, no lone ellipsis at 1280×800. |
| 7 (advisory, partly) | The notes band scroll-snaps each notice to its top; a state in the band takes chrome density (padding 12/16, gap 8, heading 13px, text 12px/1.5) and puts its evidence list beside its text when it has one. Band content 282px → 226px; at 1440×900 the band shows 167px of it. At 900×600 the band is still a 71px scroller: the shell's 528px floor leaves only that much, so this is reduced, not removed. |
| sweep | States: `.docs-rail a` and `.toc a` get `:active` (12% `currentColor` layer, `--motion-scale-press`, transform on the micro token, `--radius-md`); `main dt a` and `main th a` (launch proof, comparison table) join the prose `:active` rule; the revealed `.skip-link` gets an 8% hover layer and a 12% press layer with the press scale. Spacing: token audit 0 off-scale values except the two `margin-right: 344px` drawer reservations, which are the drawer's archive width (§4: dock widths are geometry, not spacing). |

Measured on `next start` (production build 04:01), `/editor` with `SCENEAXI_SITE_EDITOR_PREVIEW=1`, headless Chromium (no PNG viewed by eye). `#changes-*` hit-tested at 3 points each; a row button scrolled out of its dock panel is scrolled to the panel's centre first.

| Window | Drawer x | Centre column x | `#changes-reject-all` / `-accept-all` | `#changes-row-*-0` | Text cut by the drawer |
|---|---|---|---|---|---|
| 900×600 | 556–900 | 56–556 | HIT / HIT | HIT / HIT | inspector only, behind the scrim |
| 1024×700 | 680–1024 | 56–680 | HIT / HIT | HIT / HIT | inspector only, behind the scrim |
| 1179×700 | 835–1179 | 56–835 | HIT / HIT | HIT / HIT | inspector only, behind the scrim |
| 1280×800 | 936–1280 | 330–936 | HIT / HIT | HIT / HIT | none |
| 1440×900 | docked | 330–770 | HIT / HIT | HIT / HIT | n/a |

Also clean at 1440×720, 1680×1050, 1920×1080 and 1280×800 reduced. Every other visible control hits itself at every tier, except `select#edit-selection` at 1280×800: it sits in the inspector, which the compact drawer covers whole by design. Document overflow 0 at every tier.

Evidence: `E/after/umbrella/{home,profiles,pricing,open,docs,engine}-{390,768,1440}.png` + `-1440-reduced.png`; `E/after/umbrella/editor-shell-{900x600,1024x700,1179x700,1280x800,1280x800-reduced,1440x720,1440x900,1680x1050,1920x1080}.png`. Data and scripts: `E/after/polish/r2/{sites,states,editor-final}.{json,txt}`, `E/after/polish/r2/scripts/`.

Checks, round 2 (cwd R, TMPDIR `/home/devuser/.cache/sxg3145437`, removed afterwards; logs in `E/after/polish/r2/logs/`):
- `pnpm gate`: exit 1 at `pnpm test` with only the 16 allowed `desktop-editor-command-forms-golden` failures (312 of 313 files passed). Steps before `test` passed. The two steps after it, run separately: `node --test scripts/check-contracts.test.mjs` exit 0; `pnpm lint` exit 1 with 255 errors in exactly the 17 R-5 files (same list as `E/lint-review.log`).
- Touched suites: `vitest run tests/sites apps/web-shell/test apps/desktop-shell/test packages/site-kit/test` 1743 passed; `vitest run apps/desktop-shell/test desktop/linux/test` 282 passed; `node --test` storefront `catalog-ux-regression` + `item-session-wiring` 32 + 28 passed; `rendered-route-states.test.mjs` 4 passed; `check:sites`, `check:desktop` OK; `tsc --noEmit` umbrella, catalog-web, catalog-game 0.
- `eslint --max-warnings 0` on every touched ts/tsx file: 0. Detector on every touched file and on `sites/*/src/app`, `apps/web-shell/src`, `apps/desktop-shell/src`: 0 findings apart from the two contract-held ones (fix 14).
- `pnpm build` in umbrella, catalog-web, catalog-game ran last (04:01, 04:02, 04:03); no source is newer, so each `.next` holds the production build of this tree. All servers stopped; ports 3101-3104, 3106, 5181 free.

## Polish round 3 (final review round 3, 2026-10-05)

Scope: only the two blocking fixes in `reviews/final.md`. No other visual change.

| Fix | Change (`sites/umbrella/src/app/globals.css`) |
|---|---|
| 1 (blocking) | New rule after `.tier-status, .tier-purchase`: `.tier-status .chip { white-space: normal; max-width: 100%; }`. This is the reviewer's scoped option. `.chip` keeps `white-space: nowrap`. I tried the global option first (`max-width: 100%; overflow-wrap: anywhere` on `.chip`). It broke table chips: `/pricing` "free"/"paid" split into letters (h68, w32) at 320 and 390, and the `/profiles` chips wrapped to two lines at 320, 390 and 768. I reverted it. |
| 2 (blocking) | `.ed-project-pill` `flex: 0 1 auto` → `flex: 0 0 auto`. The name keeps its width; `.ed-project-save`, its sibling, ellipsizes instead. |

Measured on `next start` (production build of this tree) in headless Chromium. `/editor` ran with `SCENEAXI_SITE_EDITOR_PREVIEW=1`. I did not view any PNG by eye.

- `/pricing`: I injected each status into every `.tier-status .chip` (3 chips): "LIVE MODE REFUSED · activation not authorized", "TEST MODE · provider not configured", "TEST MODE · identity provider not configured" (`credit-pack-offers.ts:64`, `:72`, `:80`) and "TEST MODE · no real charge". At 320, 360, 375, 390, 414 and 1440, document overflow is 0 for every string and 0 as rendered. No chip runs past its card.
- Chip wrap check on 14 umbrella routes at 320/390/768/1440: the only wrapped chips are the 3 tier chips at 320, which is the intended wrap. Document overflow is 0 everywhere.
- `/editor` title pill: `scrollWidth/clientWidth` is 145/145 at 1180×700, 1280×800 and 1366×768, and 295/295 at 1440×900 and 1440×720. The name is fully visible and the pill stays inside its row. The save label is 74px at 1180×700, 174px at 1280×800 and 260px at 1366×768, and ellipsized at each. At 1440 it is 184px, also ellipsized. Below 1180 it is hidden, as before. At 900×600, 1024×700 and 1179×700 the pill is 145/145.
- `#changes-*` hit-test at 900×600, 1024×700, 1179×700, 1180×700, 1280×800, 1366×768, 1440×720 and 1440×900: 2 visible controls per tier, 0 covered. Document overflow is 0 at every tier.

Evidence: `E/after/umbrella/pricing-{320,390}-long-status.png`, `{pricing,account,admin-ledger,docs-credits-and-pricing}-{390,768,1440}.png`, `editor-title-pill-<tier>.png` and `editor-shell-<tier>.png` for the 8 tiers. Data, scripts and logs: `E/after/umbrella/_polish-r3/{pricing,editor,chips}.json`, `probe.mjs`, `chips.mjs`, `*.log`.

Checks (cwd R, TMPDIR `/home/devuser/.cache/sxg4093332`, removed afterwards):
- `vitest run tests/sites`: 798/798 passed.
- `sites/umbrella` `vitest run --config vitest.config.ts`: 131/140 passed. All 9 failures are in `test/own-session-raw-origin.test.ts`, with `No "verifyUmbrellaDeploymentFormOrigin" export is defined on the "../src/lib/identity-plane.js" mock`. That is a mock/source mismatch in the dirty tree. This suite reads no CSS and is not in the root vitest include that `pnpm gate` runs. `account-lifecycle` failed once (503 vs 200) and passed on the re-run.
- `pnpm typecheck` (umbrella): 0. Detector on `globals.css`: exit 0.
- `pnpm build` in `sites/umbrella` ran last: exit 0, Vercel package check OK. `.next` holds the production build of this tree. Port 3101 is free.
- `pnpm gate` not re-run.
