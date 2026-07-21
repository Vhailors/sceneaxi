# Bootstrap authority record (every authority separate)

The initial bootstrap was applied in commit `f0a5b90` after its prerequisite
review. This document preserves that application record and the still-operative
rule that one authority never implies another. Completing bootstrap granted no
standing authority for later pushes, issue operations, proof execution, spend,
account creation, or publication.

## Distinct authorities — none implies another

| # | Authority | Covers | Explicitly does NOT cover |
|---|---|---|---|
| 1 | Initial review PASS (historical) | Eligibility to request the initial bootstrap authorities | Any action |
| 2 | Initial apply (historical) | Copying the reviewed tree into the SceneAxi checkout | Install, commit, push |
| 3 | Initial install (historical) | `pnpm install` and lockfile creation | Commit, push |
| 4 | Initial commit (historical) | The local bootstrap commit | Push |
| 5 | Initial push (historical) | Publishing the bootstrap commit to `Vhailors/sceneaxi` | Issue creation, publication |
| 6 | Issue transfer/creation | Each issue operation under its own explicit transfer authority | Any other issue operation or later authority |
| 7 | Proof execution | Stage 1+ runs — dual-gated (tier-3 captain decisions AND explicit run authorization) | — |
| 8 | Spend / accounts | Any paid service or account creation | — |
| 9 | Publication | Package publishing, public visibility, docs sites | — |

## Historical initial application procedure

The initial bootstrap used the following sequence. It is retained as provenance,
not as a claim that the repository is still awaiting application.

1. **Pre-flight (no authority needed):** `pnpm check:syntax` and
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
