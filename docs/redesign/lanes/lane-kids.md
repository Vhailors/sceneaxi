# lane-kids report (port onto main dffefbab)

Date 2026-10-05. Brief: DIRECTION v6 §7.4 (= v5 §7.4, DV-K1 to DV-K4), §0.4 pins, §6.3 rows 1–3, 10, 18, 20, rulings R-1, R-3, R-6, R-9. There is no `docs/redesign/reviews/lanes.md` yet, so this is round 1.

## Method

DIRECTION v6 §7.4 calls Kids a **clean port**. I checked that: all six `sites/kids/src/app/**` files on main are byte-identical (`cmp`) to the v5 pre-redesign tree (`E/port/pre`). So I made the v5 lane delta (PRE → OLD) into a patch, `E/after/kids/v5-lane.patch`, and applied it with `patch -p1` in R. The dry run applied with no fuzz. The result is byte-identical to the accepted v5 lane result. I made no new design decisions. Main had no later fixes to these files, so none needed to be kept.

## Files changed (all owned, `sites/kids/src/app/**`)

| File | +/- | Change |
|---|---|---|
| `globals.css` | +639/-118 | Full v5 restyle: local copies of the spacing and `--motion-*` tokens, plus the reduced-motion overrides. Stack is `ui-rounded, "SF Pro Rounded", system-ui` (DV-K1 fallback). Stage on the left and builder on the right from 1024px. Choice tiles 98px or taller. Violet `::before` state layers. Disabled state is painted (not faded). Step meter, loading bar and tone underline. The pinned colour tokens and world gradients are unchanged. |
| `_components/kids-studio.tsx` | +98/-13 | Presentation-only state: `ActivityNote` (`refused`, `serial`) and `StageDeparture` (undo/reset ghosts and the world crossfade, DV-K4). Adds a piece meter (aria-hidden) and keyed sky/badge elements. Reducer calls, ids, roles, aria and copy are unchanged. |
| `page.tsx` | +2/-2 | Adds the `wordmark-mark` and `lede` classes. Copy unchanged. |
| `loading.tsx` | +3/-2 | Adds the `loading-intro` class and an aria-hidden `loading-bar`. No import. |
| `global-error.tsx` | +18/-2 | Inline `<style>` with literal Kids hex copies (DV-F12). Attribute-free `<body>`/`<h1>`, no import. |

I did not touch `layout.tsx`, `src/lib/**`, `security-headers.json`, `next.config.ts`, `package.json` or `pnpm-lock.yaml`.

## Animation table

| Moment | Property | Timing | Reduced motion |
|---|---|---|---|
| Piece lands (row 20) | opacity, `scale(--motion-scale-enter) translateY(--motion-distance-md)` | panel 280ms expo | instant (blanket 0.001ms) |
| Undo / start over ghost (`.leaving-piece`) | opacity, scale, translate | panel-exit 200ms quart | rests at opacity 0, no motion |
| World change | old-world layer crossfade (opacity); sky symbol settles | panel 280ms expo | instant swap |
| Play pressed | stage `filter: brightness(1.12)`→1, one shot | route 320ms expo | none |
| `play-float` (DV-K2, R-3) | transform only, only under `.is-playing`, 1.8s/1.55s ease-in-out alternate (<1 Hz, no flash) | content loop | static |
| Mode badge / stage hint | opacity, translateY sm | state 200ms quint | instant |
| Message and refusal (row 10) | text opacity + translateY sm; 2px tone underline drawn by `clip-path` (violet ok, `--danger` refused) | state 200ms quint | text swaps, underline present |
| Choice selected | symbol settles; corner dot `clip-path` draw | panel expo / state quint | instant |
| Step progress dots | `clip-path` circle fill | state 200ms quint | instant |
| 6 of 6 complete | one-shot `filter: brightness` per dot, 40ms stagger, capped | route 320ms expo | none |
| Hover (row 1) | state-layer opacity; tile symbol lifts 4px; `(hover:hover)` only | micro 160ms quart | opacity only |
| Press (row 2) | `scale(--motion-scale-press)`; layer goes to 30% / 20% | press 120ms, release micro | scale 1, layer still shows |
| Focus-visible (row 3) | 3px `--focus` outline (instant) plus a layer fade | press 120ms | instant |
| Disabled (row 4) | paint swap | instant | same |
| Loading control | n/a: Kids actions are synchronous | | |
| Grown-ups disclosure | chevron rotates; paragraph opacity + translate | state quint / panel expo | instant |
| First-paint entrance (DV-K3) | intro and studio children: opacity + translateY md, 40ms stagger, 3 steps | route 320ms expo | static |
| Loading bar (row 18, R-1) | `translateX` loop of 1200ms quart, after a 300ms delay | loop | static 40% bar |

## Evidence (`E/after/kids/`, E = /home/devuser/Documents/Reports/sceneaxi-redesign-main)

- I captured everything with headless Playwright (chrome-headless-shell 1223) against `next start` on 127.0.0.1:3204 (rule 9 port; OLD may use 3104). This session had no browser-tab tool. The capture scripts are the v5 scripts with paths re-pointed to R: `capture.cjs`, `capture-states.cjs` and `capture-midmotion.cjs`. The server was stopped afterwards; nothing listens on 3204.
- At 390, 768 and 1440: `home`, `building`, `full-refused`, `playing`, `grownups`, `focus`, `loading`, `global-error`, `world-change`, `undo` and `startover`.
- Reduced motion: `reduced-motion-playing-{390,1440}.png`, `undo-1440-reduced.png` and `startover-1440-reduced.png`. In total there are 39 PNGs, including the two mid-motion frames from `capture-midmotion.cjs`.
- `metrics.json`:
  - overflowX is false in all 35 metric rows, with 0 targets under 48px and 0 clipped text.
  - There are 0 app console or page errors in both capture runs.
  - The min text is 16px: that is the aria-hidden ▶/■ glyph. World labels are 17px at ≤560px, as in v5.
  - Under reduced motion, a placed piece computes `1e-06s`, 1 iteration, transform none.
- `capture-midmotion` froze 14 running animations 80ms after Start over (`piece-leave`, `settle-in`, `tone-draw`, clip-path). The same probe under reduced motion found 0.
- `contrast.txt` (recomputed from R's tokens by `contrast.mjs`): the lowest text pairing is 5.00:1 (dark label on the pressed Play layer). All others measure 5.87–17.39.
- `attr-counts.txt` (app tsx, PRE → R): `aria-` 14→18, `role=` 3→3, `id=` 0→0, `data-` 0→0. No count went down.
- `detector.json`: `[]`.

## Checks (all run; exit codes)

| Command | cwd | Exit |
|---|---|---|
| `pnpm exec sh -c "tsc --noEmit -p ."` | sites/kids | 0 |
| `pnpm build` | sites/kids | 0 (see the lockfile note below) |
| `pnpm check:sites` | R | 1, the **baseline** failure only: "pnpm-workspace.yaml globs sites/" (same text in `E/backup/gate-baseline.log:22-23`) |
| `grep -rl kids tests \| xargs pnpm exec vitest run` (56 files, short TMPDIR) | R | 123 (xargs). 176 failed / 1337 passed. `new-failures.txt` is empty: all 174 distinct failing test names are in the baseline log. `kids-surface` 10/10, `profile-kids-refuse-golden` 13/13, `catalog-storefronts` 84/84 and `maintenance-compat` 12/12 pass. `kids-evidence-scan` has 1 failure, which is in the baseline. |
| `node --experimental-strip-types test/production-activity.spec.ts http://127.0.0.1:3204 <headless-shell>` | sites/kids | 0 (1/1 pass) |
| `node --test test/rendered-route-states.test.mjs` | sites/catalog-game | 0 |
| `pnpm exec eslint --max-warnings 0` on the 5 app tsx files | R | 0 |
| `detect-antipatterns.mjs --json sites/kids/src/app` | R | 0, `[]` |
| `git diff --quiet -- sites/kids/src/lib sites/kids/pnpm-lock.yaml sites/kids/package.json sites/kids/security-headers.json sites/kids/next.config.ts` | R | 0 |
| sha256 of the site vs profile `kids-activity.ts` | R | equal (027a0272…) |

**Lockfile note.** pnpm 12.6 handles `packageManager: pnpm@12.6.0`, and running `pnpm build` in sites/kids rewrote `sites/kids/pnpm-lock.yaml`: it added a `packageManagerDependencies` document (+195 lines). This is a pnpm side effect; no file I edited caused it. I put the file back with `git show HEAD:sites/kids/pnpm-lock.yaml > sites/kids/pnpm-lock.yaml`, and `git diff --quiet` now exits 0. I did not run `pnpm` inside sites/kids after that; the server was started with `node_modules/.bin/next`. **Request R-K4 (run owner):** warn every Kids build or deploy step about this rewrite, and add the same check at the end of the step.

## Deviations

None new. DV-K1 to DV-K4 carry over unchanged. v5 DV-K5 (tiles measure 102–123px with `min-height: 98px`) is still open as v5 Request R-K3.

VERDICT: lane-kids port complete; ready for review.
