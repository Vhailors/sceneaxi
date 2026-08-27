# Review request — SceneAxi Product Quality cycle pq-2026-08-27-04 (second round)

You are the independent read-only cross-brain reviewer for this cycle. Return
exactly one verdict: `KEEP`, `REWORK`, or `REVERT`, plus the single biggest
remaining gap. Do not modify, commit, push, deploy, publish, or spend anything.
A first session returned REWORK ("the claimed pre-amendment traceability
failure is absent from the evidence folder"); that objection is now answered
with retained reproduction evidence below.

## Brief

`.maestro/playbooks/Product-Quality/Working/current-cycle.md` (cycle
`pq-2026-08-27-04`, iteration 00005): close P1 gap
`AUDIT-GOLDEN-COMMAND-OMISSIONS`. The candidate appends exactly four golden
e2e files (`contained-git-golden`, `desktop-assistant-scene-loop-golden`,
`full-editor-transactions-golden`, `hosted-ai-metering-golden`) to the
`pnpm test:golden` declaration in `package.json` (51 → 55 test files),
updates the owner sentence in `docs/runnable-surfaces.md`, and adds the same
four to `docs/audits/initiation/requirements.json`
(`liveInventory.goldenTests`, `counts.goldenTests: 55`) because
`scripts/check-traceability.mjs` surface-accounting enforces declaration↔
inventory lockstep. No checker semantics change; no other script or stage
edits; no new tests.

## Candidate identity

- Base HEAD `dff0833a4041bf7e7d0de897c8ee4c5130a2fc6c`; retained KEPT diffs
  from iterations 00001–00003 remain in the worktree, out of scope here.
- Amended candidate diff:
  `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-04/candidate-diff.patch`
  (SHA-256 `ddd0eb10067a65fd9d923636d149f190b82783ab1eec26ee08a04fe635ac2ad5`)
  covering exactly the three files above.

### First verdict and rework disposition

First session (`01a04276-f1c6-7c10-879a-7760de04aa83`) returned **REWORK**:
the failure-then-fix sequence was claimed but the failing gate log had been
overwritten by the passing rerun, so no retained evidence existed. The
sequence is now reproduced deterministically and retained (table below); raw
first-verdict log is kept as `codex-verdict-raw.log`.

## Failure-then-fix evidence (retained)

| Step | Result | Evidence |
|---|---|---|
| Baseline wiring check | All four files pass standalone before being wired in: 4 files / 19 tests, exit 0 | `baseline-standalone.log` |
| Amendment lifted | With requirements.json reverted to HEAD (amendment preserved as `inventory-amendment.patch`), traceability fails closed: "golden tests inventory is stale (missing: [all four])", exit 1 | `traceability-failed-proof.log` |
| Amendment restored | Byte-identical restore proven by `cmp`; traceability passes ("109 requirements and live surfaces accounted"), exit 0 | `traceability-restored-proof.log` |
| Expanded suite at amendment | `pnpm test:golden` exit 0; **55 files / 469 tests** (was 51/448) | `proof-expanded-golden.log` |
| Full gate at candidate | Exit 0 dedicated run (traceability OK line quoted inside) | `proof-pnpm-gate.log` |

## Review focus

1. Declaration/inventory/owner-doc three-way agreement (55 = 55 = claim).
2. Correct file set: exactly the register-named four; nothing else added or
   dropped.
3. Contract-lockstep integrity: does the retained failure-then-fix sequence
   now soundly evidence fail-closed behavior rather than a bypass?
4. E05 semantics: does this genuinely close "claimed golden surfaces are all
   present in the owning command" without weakening anything?
5. Unrelated-work preservation; denominator untouched.

Evidence folder: `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-04/`.
