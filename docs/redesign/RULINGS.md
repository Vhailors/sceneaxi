# Redesign run rulings

Rulings by the run contract owner (the orchestrator of `sceneaxi-impeccable-redesign`, run `orun-3-fd810cf5`). Each one changes the shared run contract, not a captain-accepted visual fact.

## R-1 · 2026-10-04 · Indeterminate loading loops (hard rule 6 exception)

Source: orchestrator message `lm_6` to node `direction_revise`, written here for the record.

- Accepted: `--motion-duration-loop` 1200ms and `--motion-delay-loading` 300ms.
- Scope: only indeterminate progress or pending indicators (DIRECTION.md rows 5 and 18, DV-F8 / DV-D6).
- Both must be named tokens. Only opacity or transform may animate.
- Under `prefers-reduced-motion: reduce`, the indicator is static.
- Every other animation stays inside the 120–320ms transition contract.
- Confirmed by the orchestrator in its own words in this file (the answer to reviewer link `lm_10`).

## R-2 · 2026-10-04 · Existing desktop loops move onto R-1 tokens

- `assistant-bars` (now 0.9s ease-in-out) and the sculpt `sweep` (now 1.1s linear) are indeterminate indicators, so R-1 covers them.
- Retime both to `var(--motion-duration-loop) var(--motion-ease-out-quart) infinite`.
- Keep the pinned substring `animation:assistant-bars` and the per-bar `animation-delay` stagger.
- The blanket reduced-motion rule makes both static.

## R-3 · 2026-10-04 · Kids `play-float` is product content motion (record as DV-K2)

- Granted for Kids `play-float` only: the 1.8s / 1.55s alternate float. It is the play experience itself, not interface feedback.
- Conditions:
  - it runs only under `.is-playing`;
  - it animates transform only;
  - its easing is a sine-like ease-in-out with no bounce or overshoot;
  - it is static under `prefers-reduced-motion: reduce`;
  - it never flashes.
- No other CSS loop in a lane-owned file counts as content. WebGL canvas output is runtime output and is outside the contract.

## R-4 · 2026-10-04 · Change Review glyphs

- The existing site-kit Change Review ✕/✓ and similar Unicode glyphs stay as text glyphs. Each one gets an `aria-label` or visually hidden text.
- The foundation may restyle them but must not change their text, because tests and refusal copy pin it.
- Swapping them for drawn SVG is out of scope for this run.

## R-5 · 2026-10-04 · Pre-existing lint failures outside redesign ownership

Source: orchestrator message `lm_16` to node `foundation` in run `orun-4-8f306309`. The orchestrator itself wrote this entry, at the same moment it sent `lm_16` (20:23, just after the foundation lane's last write). Reviewer messages sent to `orch:<run>` are not delivered to the orchestrator, so this file is the confirmation channel.

- `pnpm lint` exits 1 with 255 errors in 17 files. All of them are production-swarm evidence scripts under `docs/audits/production-swarm/**` and `apps/desktop-shell/test/visual-postpr-evidence/**`, which were already in the working tree before the redesign (`E/backup/status.txt`). No redesign node owns them.
- The redesign does not count those failures against a lane, and no lane may edit them or widen ignores to hide them.
- The lint criterion becomes:
  - `pnpm exec eslint --max-warnings 0 <every file the node touched>` exits 0;
  - full `pnpm lint` reports no file outside that pre-existing set of 17.
- The repo gate check applies the same rule: any failure identical to one that existed before the redesign does not block.

## R-6 · 2026-10-04 · Lane deviations accepted (Requests R-K2 and D2)

Source: orchestrator message to `lane_kids` and `lane_desktop` in run `orun-4-8f306309`, round 4. The orchestrator wrote this entry. There is no director node in this run, so the orchestrator accepts on the director's behalf, under the user's approval of DIRECTION.md v5.

- **DV-K3, accepted:** the Kids first-paint entrance (320ms expo, 8px, 3 staggered steps).
  - Kids is a play surface, so the §6 "Persuade routes only" limit does not apply to it.
  - The entrance is static under reduced motion.
  - It enhances content that is already visible.
- **DV-K4, accepted:** undo/reset ghosts and the world crossfade.
  - The departed item is kept for one render in component state only.
  - The reducer and `kids-activity.ts` stay untouched.
- **DV-K1:** its fallback branch is recorded as taken.
- **DV-D7, accepted:** the Play ring grows from `circle(25%)`.
- **DV-D8, accepted:** capability sentences are visually hidden with the 1px clip pattern while details are closed.
  - They stay in the accessibility tree.
  - The text and its hooks are unchanged.
- **DV-D9, accepted:** the web-preview `.site-eyebrow` becomes a neutral sentence-case chip.
  - Its text is unchanged.
  - Any test pin on it still wins.
- **Recording:**
  - `lane_kids` adds DV-K1, DV-K3 and DV-K4 to DIRECTION.md §8.
  - `lane_desktop` adds DV-D7, DV-D8 and DV-D9 to DIRECTION.md §8 and `docs/engine-desktop-surface.md`, and appends entries to `DEVIATIONS` in `apps/desktop-shell/src/visual-tokens.ts`.
  - This is a one-time ownership grant, limited to adding these entries.

## R-7 · 2026-10-05 · Repo gate accepted as PASS

Source: the orchestrator wrote this entry after run `orun-5-b26f62db`. Its routing judge returned PARTIAL because the review reply was missing from its context, not because of any finding.

- `docs/redesign/reviews/gate.md` gives the verdict PASS: the redesign adds no gate failure.
- Evidence:
  - The 16 `desktop-editor-command-forms-golden` failures match the baseline.
  - The 2 `desktop/linux/test/local-rpc.test.ts` failures (lines 197 and 244) come from the long `TMPDIR` path. It pushed the unix socket path to 110 bytes, over the Linux limit of 107. All 10 tests pass with a short `TMPDIR`.
  - Lint shows only the 17 R-5 files.
- The graph now uses the short `TMPDIR` `/home/devuser/.cache/sxg<pid>`.
- Later stages treat the gate as passed. `polish` still re-runs the gate check after its fixes.

## R-8 · 2026-10-05 · Final design review closed by the orchestrator

Source: the orchestrator wrote this entry after run `orun-6-e1297b92` got stuck on the `final_judge → polish` loop limit (round 4).

- Round 4 of `docs/redesign/reviews/final.md` marked every PASS criterion Yes except one blocking fix: the store `.state` panel density did not match the umbrella panel.
- The orchestrator applied that fix exactly as the reviewer wrote it, in both store sheets in lockstep:
  - `.state` gap is `var(--space-4)`;
  - `.state` padding is `var(--space-6)` from 621px up;
  - the home notice stays compact (`.hero-copy > .state`: padding `--space-4`, gap `--space-3`).
- Verified:
  - the two store sheets are still identical;
  - `pnpm exec vitest run tests/sites`: 798 pass, 0 fail;
  - detector: 0 findings on both sheets;
  - `pnpm build` exits 0 in `sites/catalog-web` and in `sites/catalog-game`, with the Vercel package check OK;
  - `pnpm check:sites` OK.
- Advisories 2–12 carry over to a later polish pass. They do not block the deploy.
- The redesign is accepted as final-review PASS, and the run continues at the deploy step.

## R-9 · 2026-10-05 · The design is frozen at v5; port-only adaptations are Deviations marked "port"

Source: the run contract of `sceneaxi-impeccable-redesign-main` (orchestrator, run `orun-9-383934bc`), which states the user's approval of DIRECTION v5 ("1, do this e2e and redeploy applications"; "we wanted to make UI UX redesign on top of new version"). The director node wrote this entry from that contract. Messages to `orch:<run>` are not delivered, so this file and the contract are the record.

- DIRECTION v5 (§1–§8, every DV row), R-1 to R-8 and the accepted v5 lane results are the approved design. This run invents no new design.
- The target is R = `origin/main` `dffefbab`, the commit production runs. Main's newer behaviour, routes, data hooks and tests survive. The port re-applies the v5 visual result to main's code and never copies an OLD file over a main file.
- When one of main's tests (or another executable contract) forces a different mechanism or value for a v5 decision, the contract wins. The adaptation is recorded in DIRECTION v6 §8.1 as a Deviation with Kind **port** (`DV-P*`). It names the pin and any visible difference, and it keeps the v5 intent wherever the pin allows.
- A port row may also supersede a doc-only decision added on main (for example the D-4 entrance and scroll clauses, and the D-6 media-frame shadow) when that decision conflicts with approved v5 and no test asserts it. The foundation then amends that record.
- Port rows never change behaviour, routes, ids, ARIA, `data-*` hooks, refusal copy or pinned text. They never touch identity, credits, checkout, webhook or ledger logic.
- One-time ownership grant, as R-6 did: `sites/umbrella/src/lib/foundations.ts` goes to lane-umbrella, limited to composing the DV-P1 motion sheet and the v5 band-pad and gutter metrics. `packages/site-kit/src/index.ts` goes to foundation, limited to new exports.
- New rulings in this run take numbers from R-10 up.
