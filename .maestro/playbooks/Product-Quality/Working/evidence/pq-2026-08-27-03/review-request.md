# Review request — SceneAxi Product Quality cycle pq-2026-08-27-03

You are the independent read-only cross-brain reviewer for this cycle. Return
exactly one verdict: `KEEP`, `REWORK`, or `REVERT`, plus the single biggest
remaining gap. Do not modify, commit, push, deploy, publish, or spend anything.

## Brief

`.maestro/playbooks/Product-Quality/Working/current-cycle.md` (cycle
`pq-2026-08-27-03`, iteration 00004): verification-only closure of P0 gap
`AUDIT-CONTRACT-REGRESSION-DISCOVERY`. The candidate is the retained
working-tree diff from iteration 00001:

- `package.json`: root `test` script now runs the process-level suite after
  Vitest via `&&` (`vitest run && node --test scripts/check-contracts.test.mjs`),
  failure-preserving; `gate` inherits it through `pnpm test`.
- `scripts/check-contracts.test.mjs`: +105/-4. The checker's sandbox copy list
  gains every contract/doc/data/golden input the real checker reads (credit-packs,
  entitlement-matrix, catalog-listings, open-path-policy schema+fixtures+data,
  docs/auth-credits.md, profile golden paths…), so mutation cases exercise the
  intended assertions instead of failing on ENOENT; two empty-seed cases were
  updated to mutate today's reviewed-count wording.
- The original review's REWORK reasons (scorecard arithmetic 8/10 vs 9/10;
  missing H04 disposition) were already corrected and are recorded in the
  scorecard's `Cycle closure — pq-2026-08-26-02` section.

Gap-register entry (current): owner `scripts/check-contracts.test.mjs:105-490`;
omission `vitest.config.ts:75-82`, `package.json:20-23`; impact "Authoring-job,
hosted-key, plugin-registry, and inert-example process regressions are not in
`pnpm test` or `pnpm gate`." Verify the diff closes exactly that gap.

## Candidate identity

- Base HEAD `dff0833a4041bf7e7d0de897c8ee4c5130a2fc6c`; branch
  `maestro/product-quality-loop-2`.
- Pre-work audit confirmed these two files' hunks relate only to this gap.
- Other worktree diffs (00002 authoring containment — KEPT; 00003 catalog
  shape — KEPT) are separate bundles out of scope here.

## Claimed proof (all at current tree state)

| Proof | Result | Evidence |
|---|---|---|
| Direct process suite | Exit 0; 40/40 tests | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-03/process-suite-direct.log` |
| Root `pnpm test` | Exit 0; 265 files / 3,955 Vitest tests **then** the process suite (pass 40) — inclusion proven through the root path | `proof-pnpm-test.log` |
| Root `pnpm gate` | Exit 0 dedicated run at this exact tree state | `proof-pnpm-gate.log` |

Historical corroboration from iteration 00001 (same HEAD, same two-file diff):
`evidence/pq-2026-08-26-02/proof-contract-process.log`,
`proof-pnpm-test.log`, `proof-pnpm-gate.log`.

## Review focus

1. Does the two-file diff close the register entry exactly (process regressions
   reachable through `pnpm test`/`pnpm gate`), with no checker semantics change?
2. Is the sandbox copy list complete against current `scripts/check-contracts.mjs`
   inputs (including anything added since)?
3. Gate-wiring safety: does the `&&` chain preserve failure propagation?
4. Prior REWORK objections: confirm the corrected scorecard arithmetic (9/10)
   and explicit H04 disposition now exist in
   `docs/quality/SceneAxi-Product-Quality-Scorecard.md`.
5. Unrelated-work preservation; denominator untouched.

Evidence folder: `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-03/`.
