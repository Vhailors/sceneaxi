# Authority boundaries (every authority separate)

A successful review and a passing repository gate are prerequisites for external
actions, but **grant no authority by themselves**. Each action below requires its own
matching authority.

## Distinct authorities — none implies another

| # | Authority | Covers | Explicitly does NOT cover |
|---|---|---|---|
| 1 | Review PASS (non-Claude) | Eligibility to request the authorities below | Any action |
| 2 | Push | Pushing branches or tags to `Vhailors/sceneaxi` | Issue creation, publication |
| 3 | Issue transfer/creation | Owned entirely by the issue-transfer plan (FirstMate program archive) under its own explicit transfer authority | — |
| 4 | Proof execution | Stage 1+ runs — dual-gated (tier-3 captain decisions AND explicit run authorization) | — |
| 5 | Spend / accounts | Any paid service or account creation | — |
| 6 | Publication | Package publishing, public visibility, docs sites | — |

## Local pre-flight

1. `pnpm gate` must pass before any external action is requested.
2. Replace `UNLICENSED` only after the license captain decision (open tier-5 hold).
3. Do **not** infer engine readiness, commercial validation, or Kids safety from a
   passing gate, and do not infer issue, proof, spend, account, push, or publication
   authority from local verification.
