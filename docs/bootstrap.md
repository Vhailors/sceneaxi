# Bootstrap authority record (every authority separate)

The initial bootstrap was applied in commit `f0a5b90` after its prerequisite
review. This document preserves that application record and the still-operative
rule that one authority never implies another. Completing bootstrap granted no
standing authority for later pushes, issue operations, proof execution, spend,
account creation, or publication.

A successful review and a passing repository gate are prerequisites for external
actions, but **grant no authority by themselves**. Each action below requires its
own matching authority.

## Distinct authorities — none implies another

| # | Authority | Covers | Explicitly does NOT cover |
|---|---|---|---|
| 1 | Initial review PASS (historical) | Eligibility to request the initial bootstrap authorities | Any action |
| 2 | Initial apply (historical) | Copying the reviewed tree into the SceneAxi checkout | Install, commit, push |
| 3 | Initial install (historical) | `pnpm install` and lockfile creation | Commit, push |
| 4 | Initial commit (historical) | The local bootstrap commit | Push |
| 5 | Initial push (historical) | Publishing the bootstrap commit to `Vhailors/sceneaxi` | Issue creation, publication |
| 6 | Ongoing review PASS (non-Claude) | Eligibility to request later external authorities | Any action |
| 7 | Push | Pushing later branches or tags to `Vhailors/sceneaxi` | Issue creation, publication |
| 8 | Issue transfer/creation | Each issue operation under its own explicit transfer authority | Any other issue operation or later authority |
| 9 | Proof execution | Stage 1+ runs — dual-gated (tier-3 captain decisions AND explicit run authorization) | — |
| 10 | Spend / accounts | Any paid service or account creation | — |
| 11 | Publication | Package publishing, public visibility, docs sites | — |

## Local pre-flight (current)

1. `pnpm gate` must pass before any external action is requested.
2. Replace `UNLICENSED` only after the license captain decision (open tier-5 hold).
3. Do **not** infer engine readiness, commercial validation, or Kids safety from a
   passing gate, and do not infer issue, proof, spend, account, push, or publication
   authority from local verification.

## Historical initial application procedure

The initial bootstrap used the following sequence. It is retained as provenance,
not as a claim that the repository is still awaiting application or that the gate
is still intentionally unwired.

1. **Pre-flight (no authority needed):** at bootstrap time, `pnpm check:syntax` and
   `pnpm check:boundaries` had to PASS, and `pnpm gate` had to **FAIL** because
   build/test/lint were intentionally fail-closed until wired.
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
