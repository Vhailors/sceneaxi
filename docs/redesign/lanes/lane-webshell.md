# lane-webshell report (port run on origin/main dffefbab)

Date 2026-10-05. Brief: DIRECTION.md v6 §7.5 (web shell inspector), register product (Operate). No `reviews/lanes.md` existed, so this is a first run.
Impeccable: ran `context.mjs --target apps/web-shell/src/inspector-app.ts` (cwd R, exit 0, output `E/after/webshell/context.txt`). Read `operate.md` and `animate.md`. The skill ships no `product.md`/`brand.md`; PRODUCT.md came through context.mjs.

## Files

- `apps/web-shell/src/inspector-app.ts` (edit, v6 §9 row 12): only `inspectorPageHtml` changed (+103/-16): the style block, the layout wrappers (`main.shell`, `header.masthead`, `div.workbench`, `div.controls`, `p.status`), `data-phase` on `#phase`, and visual-only script hooks (`settle()`/`showPhase()` flip `data-tick`/`data-state`; nothing reads them back). Main's file was byte-identical to the v5 pre-redesign tree (`git diff dffefbab` empty before the edit), so I applied the v5 lane delta as a patch (dry-run clean). I did not copy the file over. Routes, `INSPECTOR_ACTIONS`, JSON contracts, copy, ids, aria, `hidden` logic and the one `<style>`/one `<script>` CSP shape are unchanged.
- Not touched: `account-panel.ts`, `assistant-panel.ts`, `assistant-default.ts`, `open-path-view.ts`, `inspector.ts`, `panel-support.ts`, `index.ts`. They are read-only under v6 §9 row 11 and render no markup (0 `<div`/`<section`/`innerHTML` in each). `dev-server.ts` and `protocol-client.ts` are frozen and also not touched.

## Animation table (tokens are local copies of §6.1; reduced-motion block zeroes distances and the press scale)

| Interaction | Motion | Reduced motion |
|---|---|---|
| Button hover (row 1) | `::before` currentColor layer, opacity 0→.08, micro/quart, `(hover:hover)` only | same fade, no movement |
| Button press (row 2) | `scale(var(--motion-scale-press))` press/quart, layer .12 | scale 1; layer shows |
| Focus-visible (row 3) | pinned 2px `currentColor` ring, instant; `CanvasText` on the inverted Propose | instant |
| Disabled (row 4) | painted (dashed, 60% ink), transitions off; `cursor: progress` while busy | same |
| Busy diff / pending (rows 5/18, R-1, DV-W3) | `pre[aria-busy]::after` 2px bar `scaleX` 0→1 then fade, loop/quart, after `--motion-delay-loading` | static bar `scaleX(.4)` |
| `#note` change, refusal (row 10) | `data-tick` restarts fade + 4px rise, state/quint; tone underline draws by `clip-path` | fade only, underline without draw |
| Phase pill change (row 10) | same settle, only when the phase actually changes | fade only |
| Diff update / edit commit (row 10) | cover layer fades off the new text, state/quint | instant |
| Accept → applied (row 14, focal) | cover wipes left→right `clip-path inset(0)→inset(0 0 0 100%)`, route/expo | instant |
| Recover / Reconcile shown (§6.2 rule 4) | keyframe on `:not([hidden])`, fade + rise, state/quint; leaves instantly | fade only |
| Assistant stream-in/typing, account credit change, inspector tree expand/select, panel collapse | n/a: the served page has no assistant, account, tree or collapsible markup (those modules return JSON only). Adding that UI is new behaviour | n/a |

Transform, opacity and clip-path only; no bounce, linear or ease-in-out.

## Evidence (E = /home/devuser/Documents/Reports/sceneaxi-redesign-main)

- 72 PNGs in `E/after/webshell/`: `inspector-<state>[-light]-<390|768|1440>.png` and `inspector-<state>-<w>-reduced.png` for 8 states (idle, focus, reviewing, rejected, refused, applied, busy, uncertain). Recovery pending is not producible (§7.5). Taken with headless Playwright (`scratch/capture.mjs`) against R's bin on port 5281 over a fresh scratch project. There was no browser-tab tool, and I did not inspect the PNGs by eye.
- Rendered pages: `E/after/webshell/inspector-<state>.html` (1440, dark). Audit: `scratch/audit.json`.
- Audit across 72 captures: lowest text contrast **5.74:1** (`button#accept` disabled, light 390). No horizontal scroll and no element past the viewport. Hover layer .08 at 1440. Animations seen: `cover-wipe` on applied, `cover-fade` on update, `draw`/`settle` on note and phase, `busy-fill` while busy, `control-in` on reconcile. Under reduced motion `cover-*`, `draw-*` and `busy-fill` do not run. Console: only the expected 409 (refusal response) and the aborted `/api/reject` request the harness forces. 0 CSP errors.
- Template attribute counts, main → after: `data-` 0→18, `id="` 16→16, `aria-` 19→22, `role="` 1→1.

## Checks (cwd R, TMPDIR /home/devuser/.cache/sx2270052, removed afterwards)

- `pnpm build`: exit 0 (`E/after/webshell/build.log`)
- `pnpm exec vitest run apps/web-shell tests/e2e/assistant-panel-golden.test.ts apps/web-shell/test/bin-smoke.test.ts`: exit 0, 13 files, 219 tests (`vitest.log`; includes `dev-server.test.ts` CSP hashes)
- `pnpm exec eslint --max-warnings 0 apps/web-shell/src/inspector-app.ts`: exit 0
- Detector on `inspector-app.ts`: 1 finding, the pinned `pre[aria-busy="true"]` 3px rail (DV-X1, accepted). Detector on the 8 HTML files: 9 findings. 8 are that same rail. 1 is `aphoristic-cadence` in the rejected state, which comes from the pinned copy "No document was written" (`inspector-accessibility.test.ts`). Both are carried from v5 and neither is new.
- `sites/kids/pnpm-lock.yaml` sha256 equals main's. Not run: `pnpm gate`, full `pnpm lint`.
- Server stopped; port 5281 free.

## Requests

1. R2 (existing): allow a non-rail busy mark in place of the pinned `pre[aria-busy="true"]` 3px rail (closes DV-X1).
2. Copy/test owner: reword the rejected-state copy so the note and `#review-help` stop repeating "X. No Y." (clears `aphoristic-cadence`).
3. The contract asks for assistant, account and tree microanimations, but those surfaces have no markup in the web shell. If they are wanted, they need a behaviour change (new UI) and an owner beyond this lane.
