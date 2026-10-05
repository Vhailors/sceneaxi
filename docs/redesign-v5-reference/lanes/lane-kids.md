# lane-kids report

Date 2026-10-04. Brief: DIRECTION.md v5 §7.4, motion rows 20, 1, 2, 3, 10, 18, rulings R-1 to R-6.
Round 1 was the first pass. Round 2 (2026-10-05) fixes only the `## lane-kids` items in
`docs/redesign/reviews/lanes.md`; see "Round 2" below.

## Round 2: review items

| Item | Status | What I did |
|---|---|---|
| 1 (blocking) undo / start-over shots missing | closed | Captured my own shots with `E/after/kids/capture-states.cjs` against a fresh `pnpm build` served on 3104: `undo-{390,768,1440}.png`, `startover-{390,768,1440}.png`, `undo-1440-reduced.png`, `startover-1440-reduced.png`. I also added `world-change-{390,768,1440}.png` so "choose world" has its own shot. Listed under Evidence. |
| 2 (advisory) DV-K3 / DV-K4 acceptance | closed by ruling R-6 | Added DV-K1 (fallback branch taken), DV-K3 and DV-K4 to DIRECTION.md §8, citing R-6. This is the one-time grant R-6 gives; I added nothing else to that file. |
| 3 (advisory) `key={note.serial}` re-announces a repeated refusal | kept on purpose | A child who presses the same refused choice again should hear that the press landed. The live region gets one polite announcement per press, and only on a press, so it never repeats by itself. No code change. |
| 4 (advisory) tiles measure 102–123px vs the brief's 84–98px | recorded | `globals.css:494` sets `min-height: 98px`. Tiles grow past that only from the label and the grid column width. Larger targets suit children, so I kept them. This is recorded as DV-K5 below. R-6 does not grant me §8 for it, so it is Request R-K3. |

No app code changed in round 2. The only repo file I edited is DIRECTION.md §8, under the R-6 grant, plus this report.

## Files changed (all owned: `sites/kids/src/app/**`)

| File | Change |
|---|---|
| `globals.css` | Full restyle. Local copies of the spacing and `--motion-*` tokens (values match `FOUNDATION_MOTION`), plus the reduced-motion token overrides. Inter removed from the font stack (DV-K1 fallback). Stage on the left and choices on the right from 1024px, so the stage stretches to the height of the builder. 16px radius on buttons. Violet `::before` state layers. Painted disabled state (dashed line, `--fg-2`, never opacity). Choice tiles 98px+. Summary 48px. Body/UI text 18px. Step meter. Loading bar. Selection uses colour and a corner dot. The pinned ten colour tokens and the three world gradients are unchanged. |
| `_components/kids-studio.tsx` | Visual-only state: the message line is now `{text, refused, serial}`, so a repeated line re-enters and refusals get the red tone. A `StageDeparture` keeps the world or pieces that just left for one render so they fade out. Adds the piece meter (aria-hidden), keyed sky symbol and badge, and `choice-label` / `play-glyph` classes. Reducer calls, ids, aria, roles and copy are unchanged. |
| `page.tsx` | `wordmark-mark` and `lede` classes. Copy is unchanged. |
| `loading.tsx` | Adds a `loading-intro` class and an aria-hidden `loading-bar` sibling. The `h1` stays attribute-free and the file has no import. |
| `global-error.tsx` | Self-contained inline `<style>` as the first child of an attribute-free `<body>`. It holds literal Kids hex copies (DV-F12) and has no quotes, `<`, `>`, `&`, URLs, custom properties or banned words. The `h1` is styled through `main h1` and stays attribute-free. Classes are only on `main` and `p`. It is static. |

`layout.tsx` is untouched. `src/lib/**`, `security-headers.json` and `next.config.ts` are untouched.

## Animation table

| Moment | Property | Timing | Reduced motion |
|---|---|---|---|
| Piece lands (row 20, replaces piece-arrive) | opacity, `scale(--motion-scale-enter) translateY(--motion-distance-md)` | panel 280ms expo | blanket kill: instant |
| Undo / start over: piece leaves | opacity, scale, translate (ghost `.leaving-piece`, not `.placed-piece`) | panel-exit 200ms quart | not rendered visibly (rests at opacity 0) |
| World change: crossfade | opacity of the old-world layer | panel 280ms expo | instant swap |
| Sky symbol settles on world change | opacity, translateY sm | panel 280ms expo | instant |
| Play pressed | stage `filter: brightness(1.12)` to 1, one shot | route 320ms expo | none |
| play-float (DV-K2, R-3) | transform only, only under `.is-playing`, 1.8s/1.55s ease-in-out alternate, unchanged. `piece-land` stays first in the animation list, so Play/Stop never replays it | content loop | static (computed 1e-06s, 1 iteration) |
| Mode badge / stage hint enter | opacity, translateY sm | state 200ms quint | instant |
| Message / refusal transition (row 10) | text opacity + translateY sm. The 2px tone underline draws by `clip-path` (violet ok, `--danger` refused) | state 200ms quint | text swaps; underline is present with no draw |
| Choice selected | symbol translate+scale settle; corner dot `clip-path` circle draw | panel expo / state quint | instant |
| Step progress dot fill/unfill | `clip-path` circle transition | state 200ms quint | instant |
| 6 of 6 complete | one-shot `filter: brightness` per dot, 40ms stagger, capped at `--motion-stagger-max` | route 320ms expo | none |
| Button / tile / summary hover (row 1) | state-layer opacity; tile symbol lifts 4px; `@media (hover:hover)` only | micro 160ms quart | opacity only |
| Press (row 2) | `scale(--motion-scale-press)`, layer to 30% / 20% | press 120ms, release micro | scale 1, layer still shows |
| Focus-visible (row 3) | 3px `--focus` outline (instant) plus the layer fading in | press 120ms | instant |
| Disabled (row 4) | paint swap, no motion | instant | same |
| Loading: n/a | Kids actions are synchronous, so nothing waits | | |
| Grown-ups open | chevron rotates; paragraph opacity + translate | state quint / panel expo | instant |
| First-paint entrance | intro and studio children: opacity + translateY md, 40ms stagger, 3 steps max | route 320ms expo | static |
| Loading bar (row 18, R-1) | 40% bar `translateX`, loop 1200ms quart, starts after a 300ms delay | loop | static 40% bar |

Every keyframe and transition sits inside `@media (prefers-reduced-motion: no-preference)` or under the blanket reduce rule, which the production spec pins at `0.001ms`. I added `animation-delay` / `transition-delay: 0ms` to that rule so staggered items never wait while hidden.

## Deviations

- **DV-K1 (fallback branch taken, ruling R-6, recorded in DIRECTION.md §8).** The stack is now `ui-rounded, "SF Pro Rounded", system-ui, sans-serif` with no Inter. Archivo through `next/font/google` would download at build time, which the lane contract forbids. No local Archivo file exists in the repo.
- **DV-K3 (accepted by ruling R-6, recorded in DIRECTION.md §8).** Kids gets a gentle first-paint entrance (route 320ms expo, 8px, 3 staggered steps). It is static under reduced motion.
- **DV-K4 (accepted by ruling R-6, recorded in DIRECTION.md §8).** Undo/reset ghosts and the world crossfade keep the departed item for one render in component state. This is visual only: the reducer never sees it. When they come to rest, the ghosts have computed opacity 0, with and without reduced motion (measured in round 2).
- **DV-K5 (recorded here, not yet in §8; Request R-K3).** Choice tiles keep `min-height: 98px` but measure 102–123px, because the label and column width make them grow. The brief says 84–98px. Bigger targets help children, and the change has no other effect.
- **Font-size floor.** The world-choice labels are 17px at ≤560px, so "Sunny meadow" wraps between words in 87px tiles. The only other text under 18px is the aria-hidden ▶/■ glyph (16px).

## Evidence (E/after/kids/)

- Captured with headless Playwright (`capture.cjs` in round 1; `capture-states.cjs` and `capture-midmotion.cjs` in round 2). Neither session had a browser tab tool.
- **Round 2, undo / start over (§7.4 state):** `undo-390.png`, `undo-768.png`, `undo-1440.png`, `startover-390.png`, `startover-768.png`, `startover-1440.png`, plus reduced motion `undo-1440-reduced.png` and `startover-1440-reduced.png`. Undo comes after Friend, Tree, Star and Rocket, then "Undo last". It leaves 3 pieces and shows "Last piece removed.". Start over leaves 0 pieces and shows "Fresh world ready.".
- **Round 2, choose world:** `world-change-{390,768,1440}.png` (Moon camp chosen, "New world chosen.").
- **Round 2 metrics** (`metrics.json` → `round2`): overflowX false, 0 targets under 48px, 0 clipped text elements, 0 console/page errors in all 11 shots.
- **Duplicate check** (sha256 over every PNG in `E/after/kids/`): the only byte-identical pair is `startover-1440.png` = `startover-1440-reduced.png`. They show the same state at rest, so reduced motion ends on the same frame. To show that motion does run, `startover-80ms-1440.png` freezes every running animation 80ms after the press, using `document.getAnimations()` paused at currentTime 80. That froze 14 animations, including 4 `piece-leave` 200ms and `tone-draw` 200ms, and the image differs from the rest frame. Under reduced motion the same probe found 0 running animations. No other pair matches, so no shot stands in for a different state.
- States at 390, 768 and 1440: `home`, `building`, `full-refused`, `playing`, `grownups`, `focus`, `loading`, `global-error` (24 PNGs). Plus `reduced-motion-playing-390.png` and `reduced-motion-playing-1440.png`.
- `metrics.json`: overflowX false everywhere, 0 targets under 48px, 0 app console/page errors. Removing the body for the fallback shots made React log `removeChild` errors; these are kept apart as `injectedHarnessErrors`.
- I could not open the PNGs in this session. Layout was checked through DOM geometry instead: at 1440 the stage and builder share the top edge and the bottom edge is within the message row, and no label is clipped.
- `contrast.txt`: every new text pairing measures at least 5.00:1. The lowest is the dark label on the pressed Play/selected layer. The pinned pairings stay under the kids-surface suite.
- `attr-counts-before.txt` / `attr-counts-after.txt`: aria 11→14 (studio) and 2→3 (loading). role, id and data counts are unchanged.

## Checks (all run, exit codes)

| Command | cwd | Round 1 | Round 2 (2026-10-05) |
|---|---|---|---|
| `pnpm exec tsc --noEmit -p .` (run as `pnpm exec sh -c 'tsc --noEmit -p .'`) | sites/kids | 0 | 0 |
| `pnpm build` | sites/kids | 0 | 0 |
| `pnpm check:sites` | R | 0 | 0 |
| `pnpm exec vitest run tests/sites/kids-surface.test.ts tests/e2e/profile-kids-refuse-golden.test.ts` | R | 0 | covered by the next row |
| `grep -rl kids tests \| xargs pnpm exec vitest run` | R | 1 | **0** (51/51 files, 1493 tests) |
| `node --test test/rendered-route-states.test.mjs` | sites/catalog-game | 0 | not re-run (no app code changed) |
| `node test/production-activity.spec.ts http://127.0.0.1:3104 <headless-shell>` (built server on 3104) | sites/kids | 0 | 0 |
| `pnpm exec eslint --max-warnings 0` on the four touched tsx files | R | 0 | not re-run (no app code changed) |
| `pnpm lint` | R | 1 | not re-run |
| detector `--json sites/kids/src/app` | R | 0, `[]` | 0, `[]` |
| `git diff -- sites/kids/src/lib` (staged and unstaged) vs `E/backup/*.patch` | R | identical | identical |
| sha256 `sites/kids/src/lib/kids-activity.ts` = `packages/profile-kids/src/kids-activity.ts` | R | equal | equal (942c93b0…) |

Notes on the checks:

- **Bare `pnpm exec tsc`.** Run bare, the session's shell wrapper ran a different global compiler and printed TS2882 for `layout.tsx` (a file I did not touch). Run through `sh -c`, the project's TypeScript 5.9.3 exits 0.
- **`grep -rl kids tests | xargs pnpm exec vitest run`.** Round 2: all 51 files pass, exit 0. Round 1: 50/51 files passed. The one failure is `tests/sites/catalog-storefronts.test.ts`: 5 lockstep cases fail because `sites/catalog-web/src/app/_components/form-busy.tsx` (lane-catalogs, in progress) has no catalog-game twin. No Kids file is involved, and that file's Kids assertions pass.
- **`pnpm lint`.** 255 errors in 17 files, all in the R-5 pre-existing set. No other file is listed.
- **ESLint and CSS.** ESLint has no config for CSS, so it reports `globals.css` as "ignored". CSS proof is the detector plus the Kids suites.
- **Parity.** The `kids-activity.ts` sha256 is equal to the profile copy (942c93b0…).
- **Server.** The 3104 server was stopped after each round (round 2: `curl` to 3104 returns no connection, and nothing listens on the port).
- **`git diff --quiet -- sites/kids/src/lib`** exits 1, both rounds. The cause is the earlier swarm's uncommitted hunks, which predate this run. That diff is byte-identical to the `sites/kids/src/lib` part of `E/backup/unstaged.patch` and `staged.patch`, so this lane added nothing there.

## Environment issue

`/tmp` (a 16G tmpfs) is 100% full of leftover fixtures (`sceneaxi-gate-fixture-*`, `sceneaxi-vitest-*`, `.pnpm-store`). Chromium launches, the edit tools and vitest fixtures fail with ENOSPC there. I deleted nothing and ran with `TMPDIR=/home/devuser/.cache/sceneaxi-kids-tmp`.

## Requests

- **R-K1 (run owner):** free `/tmp`, or point the gate's TMPDIR at disk. Otherwise lanes and the gate will see spurious ENOSPC failures.
- **R-K2 (director):** closed by ruling R-6. I recorded the rows myself under its one-time grant.
- **R-K3 (director/orchestrator):** add DV-K5 (choice tiles 102–123px, `min-height: 98px`; brief said 84–98px) to DIRECTION.md §8, or tell me to cap the tiles at 98px.
