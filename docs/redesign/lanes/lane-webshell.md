# lane-webshell report

Date 2026-10-04. Brief: DIRECTION.md §7.5 (web shell inspector). Register: product (Operate).
Impeccable: ran `context.mjs --target apps/web-shell/src/inspector-app.ts` (cwd R) and read `operate.md`, `craft-floor.md`, `animate.md`, `polish.md`, `typeset.md`, `layout.md` and `harden.md`. There was no skill-load tool in this session, so I read the files directly.

## Files

- `apps/web-shell/src/inspector-app.ts`: only `inspectorPageHtml` changed (style, markup wrappers, visual-only script hooks). Routes, `INSPECTOR_ACTIONS`, JSON contracts, copy, ids, aria and the `hidden` logic are unchanged.
- I did not touch `account-panel.ts`, `assistant-panel.ts`, `open-path-view.ts`, `inspector.ts`, `assistant-default.ts` or `panel-support.ts`. They render no markup (DIRECTION §7.5 "Out of scope"; review fact (c)), so they have nothing to restyle.
- I did not touch `dev-server.ts` or `protocol-client.ts`. The CSP hashes are recomputed from the page, and the page still has exactly one `<style>` and one `<script>`.

## What changed (visual)

- Prose and labels use `system-ui` at 15px (DV-W1). Machine values stay `ui-monospace` 14px with tabular figures: inputs, the diff, `code` and the phase.
- H1 is 1.625rem/700. The project root is a mono chip beside the H1.
- At ≥960px the page uses a two-column workbench: form, help and status on the left, and the diff `<pre>` as the hero well on the right (max 72rem, min-height 14rem, 16px padding, soft well fill). Below 960px it is one column. Phones get 44px controls and 16px input text, so iOS does not zoom.
- Propose is the primary button: inverted system colours (`CanvasText` fill, `Canvas` label), with a `CanvasText` focus ring because `currentColor` would be invisible there. Accept, Reject, Recover and Reconcile are outlined. Disabled is painted: dashed border and a 60% ink label, never opacity. While the form is busy the cursor is `progress`.
- The phase is a pill driven by a new `data-phase`. `reviewing` is inverted, `applied` gets a solid edge, `unknown` takes the danger paint.
- `#note` lost its 2px left rail (a side stripe). It is now a line with a tone underline: 35% ink, or full danger colour when refused.
- Fields have a 45% ink hairline at rest (≥3:1) and switch to `FieldText` on hover or focus. The invalid paints are kept and still win.
- Every colour is a system colour or a `color-mix()` of system colours. The only literals are the existing danger values.
- Local token copies (spacing and every `--motion-*`) plus a reduced-motion override block.

## Animation table

| Interaction | Motion (tokens) | Reduced motion |
|---|---|---|
| Button hover (row 1) | `::before` currentColor layer, opacity 0→.08, micro/quart, `(hover:hover)` only | same fade, no movement |
| Button press (row 2) | `scale(var(--motion-scale-press))`, press/quart; layer .12; pinned inset ring kept | scale token = 1; layer and inset ring still show |
| Focus-visible (row 3) | pinned 2px `currentColor` ring, instant | instant |
| Disabled (row 4) | instant paint, transitions off | same |
| Busy / pending indicator (row 5/18, R-1) | `pre[aria-busy]::after` 2px bar, `scaleX` 0→1 then fade, `--motion-duration-loop` quart infinite, after `--motion-delay-loading` | static bar at `scaleX(.4)` |
| Status line `#note` change and refusal (row 10) | `data-tick` flip restarts fade + rise `--motion-distance-sm`, state/quint; the tone underline draws with `clip-path inset(0 100% 0 0)→inset(0)` | fade only; underline shown without the draw |
| Phase pill change (row 10) | same settle, only when the phase actually changes | fade only |
| Diff update (row 10) | a cover layer fades out over the new text, state/quint | instant |
| Edit commit / Accept → applied (row 14, focal) | the cover layer wipes left→right with `clip-path inset(0)→inset(0 0 0 100%)`, route/expo | instant |
| Recover / Reconcile shown (row 6/10, §6.2 rule 4) | keyframe on `:not([hidden])`, fade + rise, state/quint; leaves instantly | fade only |
| Assistant stream-in, typing indicator, account credit change, inspector tree expand/select, panel collapse | n/a: the page has no assistant, account, tree or collapsible markup (only `/api/assistant` JSON). Adding that UI would be new behaviour (§10) | n/a |

Everything animates transform, opacity or clip-path only. There is no bounce and no linear or ease-in-out curve.

## Evidence (E = /home/devuser/Documents/Reports/sceneaxi-redesign)

- 72 PNGs in `E/after/webshell/`: `inspector-<state>[-light]-<390|768|1440>.png` for 8 states (idle, focus, reviewing, rejected, refused, applied, busy, uncertain), dark and light, plus `inspector-<state>-<width>-reduced.png` (dark, reduced motion) for every state and width. Captured with headless Playwright (`scratch/capture.mjs`); no browser-tab tool was available. I did not look at the PNGs by eye (no image viewer here). Layout and contrast were checked programmatically instead (below).
- Rendered pages: `E/after/webshell/inspector-<state>.html` (1440, dark).
- `scratch/verify.mjs` checked 2 schemes × 3 widths × 2 motion modes with a refusal shown:
  - no horizontal scroll and no element past the viewport;
  - two columns only at 1440;
  - focus ring 2px solid;
  - lowest text contrast 5.74:1 (a disabled button label, light) and 5.78:1 (the refused note, dark).
- `scratch/anim.mjs` confirmed:
  - which animations run in each state (`cover-wipe` on applied, `draw`/`settle` on refusal, `busy-fill` while busy, `control-in` for reconcile);
  - none of the wipe, draw or loop run under reduced motion;
  - the hover layer works;
  - 0 CSP console errors.
- Attribute counts in the page template, before → after: `data-*` 0→1, `id=` 13→13, `aria-*` 10→10, `role=` 1→1.

## Checks (cwd R, TMPDIR pointed at E scratch because `/tmp` tmpfs is 100% full)

- `pnpm build`: exit 0
- `pnpm exec vitest run apps/web-shell tests/e2e/assistant-panel-golden.test.ts apps/web-shell/test/bin-smoke.test.ts`: exit 0 (13 files, 219 tests)
- `pnpm exec eslint --max-warnings 0 apps/web-shell/src/inspector-app.ts`: exit 0
- Detector on `apps/web-shell/src`: 1 finding, the pinned `pre[aria-busy="true"] { border-inline-start-width: 3px; }` (DV-X1, pinned, accepted).
- Detector on the 8 rendered HTML files: 9 findings.
  - 8 are the same pinned DV-X1 rail.
  - 1 is `aphoristic-cadence` in the rejected state. It comes from the existing copy "Proposal rejected. No document was written. …". The note and the help line both repeat it, and `inspector-accessibility.test.ts:96` pins "No document was written". It is not fixable inside this lane (copy is not a lane decision, §10). See Requests.
- Not run: `pnpm gate`, full `pnpm lint`.
- Server stopped; port 5181 is free.

## Deviations (lane-level, beyond DIRECTION.md)

- DV-W2: H1 is 1.625rem, not the 1.375rem in §3/§7.5. At 1.375rem the detector reported `flat-type-hierarchy` (22/13 < 2.0).
- DV-W3: the busy bar fills with `scaleX` instead of row 5's `translateX(-100%→100%)` sweep. The detector reports any percentage translate loop as `marquee`. Tokens, transform-only, delay and the static reduced-motion bar are unchanged.
- The `button:hover` underline from the earlier uncommitted hunk is replaced by the row-1 state layer. The duplicated `button:not(:disabled):active` line became the press-scale rule. Every pinned string is kept verbatim.

## Requests

1. Copy owner and the owner of `inspector-accessibility.test.ts`: reword the rejected-state copy so the note and `#review-help` stop repeating "X. No Y." (clears `aphoristic-cadence`).
2. R2 (existing): allow a non-rail busy mark in place of `pre[aria-busy="true"] { border-inline-start-width: 3px; }` to close DV-X1.
3. Recovery-pending state: no capture. Producing `journalRecoveryPending` needs an interrupted durable apply; the recover button's entrance is the same rule as reconcile's, which was captured.
4. `/tmp` tmpfs is full (16G/16G, not this lane's files). Tests and Playwright fail there unless `TMPDIR` is redirected.

## Final polish, round 2 (2026-10-05, `reviews/final.md` round 2)

| Fix | Change |
|---|---|
| 3 (blocking) | `inspector-app.ts:851` `.phase` padding `1px 10px` → `1px 12px`. No pinned string touched. Measured 57×24 pill, padding 1px/12px, light and dark, 390/768/1440, overflow 0. |

Evidence: `E/after/webshell/inspector-idle-{390,768,1440}.png`, `inspector-idle-light-{390,768,1440}.png` (re-captured, web-shell bin on 5181, stopped). Token audit of the rendered inspector sheet: 0 off-scale. Detector on `apps/web-shell/src`: only the pinned DV-X1 rail.

Checks, round 2 (cwd R, TMPDIR `/home/devuser/.cache/sxg3145437`, removed afterwards; logs in `E/after/polish/r2/logs/`):
- `pnpm gate`: exit 1 at `pnpm test` with only the 16 allowed `desktop-editor-command-forms-golden` failures (312 of 313 files passed). Steps before `test` passed. The two steps after it, run separately: `node --test scripts/check-contracts.test.mjs` exit 0; `pnpm lint` exit 1 with 255 errors in exactly the 17 R-5 files (same list as `E/lint-review.log`).
- Touched suites: `vitest run tests/sites apps/web-shell/test apps/desktop-shell/test packages/site-kit/test` 1743 passed; `vitest run apps/desktop-shell/test desktop/linux/test` 282 passed; `node --test` storefront `catalog-ux-regression` + `item-session-wiring` 32 + 28 passed; `rendered-route-states.test.mjs` 4 passed; `check:sites`, `check:desktop` OK; `tsc --noEmit` umbrella, catalog-web, catalog-game 0.
- `eslint --max-warnings 0` on every touched ts/tsx file: 0. Detector on every touched file and on `sites/*/src/app`, `apps/web-shell/src`, `apps/desktop-shell/src`: 0 findings apart from the two contract-held ones (fix 14).
- `pnpm build` in umbrella, catalog-web, catalog-game ran last (04:01, 04:02, 04:03); no source is newer, so each `.next` holds the production build of this tree. All servers stopped; ports 3101-3104, 3106, 5181 free.
