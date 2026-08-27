# Review request — SceneAxi Product Quality cycle pq-2026-08-27-01

You are the independent read-only cross-brain reviewer for this cycle. Return
exactly one verdict: `KEEP`, `REWORK`, or `REVERT`, plus the single biggest
remaining gap. Do not modify, commit, push, deploy, publish, or spend anything.

## Brief

`.maestro/playbooks/Product-Quality/Working/current-cycle.md` (cycle
`pq-2026-08-27-01`, iteration 00002): close P0 gap `AUDIT-AUTHORING-ROOT-ESCAPE`
by making the shared propose/apply path resolver in
`packages/authoring-core/src/propose-apply.ts` fail closed on absolute,
traversal, and outside-resolving symlink document paths, reusing diagnostic
code `validation-failed` with the exact existing message "Document path must be
inside its authoritative project root." (no schema widening), propagating the
refusal through all six former `resolvePath` call sites (propose :283-area,
proposeMany, editDirect, apply proposal-file load, apply edit grouping, apply
diff matching), and proving it failing-first in
`packages/authoring-core/test/transaction-history.test.ts`.

## Candidate identity

- Base HEAD: `dff0833a4041bf7e7d0de897c8ee4c5130a2fc6c` (branch
  `maestro/product-quality-loop-2`; main/origin/main at same SHA).
- Candidate diff (updated after first `REWORK`): `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-01/candidate-diff.patch`
  (SHA-256 `d5da68f0bd84ca05148404c03d104144192102f639abc026ec934f5ac4ba6b44`),
  uncommitted working-tree diff touching exactly
  `packages/authoring-core/src/propose-apply.ts` (+61/-8 region) and
  `packages/authoring-core/test/transaction-history.test.ts` (+71).
- A separate retained rework diff from iteration 00001 (`package.json`,
  `scripts/check-contracts.test.mjs`) exists in the worktree by design and is
  out of scope for this review.

## Claimed proof

| Proof | Result | Evidence |
|---|---|---|
| Failing-first focused run | 2 containment cases failed pre-fix (`focused-red.log`): outside proposal file was accepted (`ok:true`); escape-vector case failed at assertion. No syntax failures masked. | `evidence/pq-2026-08-27-01/focused-red.log` |
| Focused suite post-fix | 9/9 pass: the original cases plus two reviewer-required forged-proposal cases covering `apply()` edit-path and diff-path containment — all six sites now regression-proven | `focused-green.log` |
| Root `pnpm test` | Exit 0; 265 files / 3,951 tests (baseline 3,946 + 5 new), then process suite 40/40 | `proof-pnpm-test.log` |
| `pnpm test:golden` | Exit 0; 51 files / 448 tests — no golden omission silently repaired | `proof-pnpm-test-golden.log` |
| `pnpm build` | Exit 0 (strict tsc; forged proposals built by immutable spread, no readonly mutation) | `proof-pnpm-build.log` |
| `pnpm gate` | Exit 0 dedicated run (`proof-pnpm-gate.log`). Earlier intermediate states honestly failed lint (`no-unused-vars`) and a lost snapshot line; both fixed before these passing runs; exits captured explicitly, never brace-masked. | `proof-pnpm-gate.log` |

### First verdict and rework disposition

The first review session returned **`REWORK`**: the implementation covered all
six containment sites but the focused tests exercised only three of them,
leaving `apply()`-edit and `apply()`-diff escaped paths without regression
proof. This revised candidate adds exactly those two test cases (forged
proposals via immutable spreads), keeping the source change identical. The raw
first-verdict log is retained as `codex-verdict-raw.log`.

## Scorecard context

Engine/runtime row E08 ("Refusal ordering and privileged boundaries fail
closed") is the targeted receptor; this bundle adds named-refusal coverage for
authoring root escapes where none existed (E08 evidence strength increases;
denominator unchanged at 10 rows). Websites and Graphics remain unscored `U`.
Locked denominator may not change.

## Review focus

1. Containment semantics vs `writeDocumentFile`'s precedent block
   (`propose-apply.ts` ~:1109-1128): is the canonical-root comparison correct,
   including symlinked cwd?
2. Bypass risk across all six sites (especially `apply({proposal:
   <outsidePath>})`) and any legitimate caller broken by the new refusal.
3. Refusal ordering: containment must precede file reads and journal creation;
   existing refusal/digest/journal behavior unchanged for contained paths.
4. Test quality: do the three new cases actually defend the contract (zero
   journal/dir mutation assertions, exact code/message match)?
5. Denominator gaming, unrelated-work preservation, policy drift.

Evidence folder: `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-01/`.
