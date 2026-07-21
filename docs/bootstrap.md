# Bootstrap application procedure (every authority separate)

**FROZEN:** this tree is applyable only after (a) the post-FAIL remediations pass is
complete and (b) a **fresh independent non-Claude review PASS** over the amended chart
and this exact tree. A PASS is a prerequisite for everything below and **grants no
authority by itself**.

## Distinct authorities — none implies another

| # | Authority | Covers | Explicitly does NOT cover |
|---|---|---|---|
| 1 | Review PASS (non-Claude) | Eligibility to request the authorities below | Any action |
| 2 | Apply | Copying this tree into a clean local clone of `projects/sceneaxi` | Install, commit, push |
| 3 | Install | `pnpm install`, lockfile creation | Commit, push |
| 4 | Initial commit | One local commit of the applied tree | Push |
| 5 | Push | Pushing to `Vhailors/sceneaxi` | Issue creation, publication |
| 6 | Issue transfer/creation | **Not part of bootstrap.** Owned entirely by the issue-transfer plan (FirstMate program archive) under its own explicit transfer authority | — |
| 7 | Proof execution | Stage 1+ runs — dual-gated (tier-3 captain decisions AND explicit run authorization) | — |
| 8 | Spend / accounts | Any paid service or account creation | — |
| 9 | Publication | Package publishing, public visibility, docs sites | — |

## Procedure (each step only under its own authority)

1. **Pre-flight (no authority needed):** in this tree, `pnpm check:syntax` and
   `pnpm check:boundaries` must PASS, and `pnpm gate` must **FAIL** (build/test/lint
   are intentionally fail-closed until wired — a passing gate here means the gate has
   been tampered with).
2. **[apply]** Copy this directory tree into a clean clone of `projects/sceneaxi`
   (or a `git checkout --orphan` initial tree) without rewriting any other repo's
   history.
3. **[license decision]** Replace `UNLICENSED` only after the license captain decision
   (open tier-5 hold).
4. **[install]** `pnpm install` to create the real lockfile.
5. **[initial commit]** Commit the applied tree locally.
6. **[push]** Push only under its own separate grant.
7. Do **not** mark engine-ready, commercially validated, or Kids-safe from bootstrap
   alone, and do not create or transfer any GitHub issue from this procedure — issue
   work follows the issue-transfer plan under its own authority.
