# docs/proof — proof-program preparation documents

> ## ⚠️ Double gate — read first
>
> Stage 1 of the engine-core proof program
> ([factories-helpers#41](https://github.com/Vhailors/factories-helpers/issues/41))
> may be **executed** only when **both** gates are satisfied:
>
> 1. the **tier-3 captain decisions** are recorded, **and**
> 2. a **separate, explicit run authorization** is granted.
>
> **Nothing under `docs/proof/` is a run authorization.** Every document in this
> directory is a preparation artifact: templates, worksheets, and run-sheets that
> make a future authorized run precise and falsifiable. Their presence, review
> status, or merge state grants no authority of any kind.

## What lands here

The proof-prep documents re-homed from factories-helpers under the
issue-transfer plan, each tracked by a SceneAxi issue:

| Incoming doc | From | Tracked by |
|---|---|---|
| Stage 0 engine-neutral acceptance-contract template (held fields flagged, nothing locked) | factories-helpers#50 | [sceneaxi#13](https://github.com/Vhailors/sceneaxi/issues/13) |
| Stage 1 counting and adjudication worksheet (recommendation only) | factories-helpers#51 | [sceneaxi#14](https://github.com/Vhailors/sceneaxi/issues/14) |
| Stage 1 paired-replicate run-sheet + pinned-config manifest (not a run authorization) | factories-helpers#52 | [sceneaxi#15](https://github.com/Vhailors/sceneaxi/issues/15) |

## Source of truth

The proof program itself — Stages 0–8, the Stage 1 contract, budgets, and kill
criteria — stays on factories-helpers#41. See
[`docs/program/spec-41.md`](../program/spec-41.md) for the pointer and transfer
classification, and [`docs/program/SPEC.md`](../program/SPEC.md) (canonical:
[sceneaxi#1](https://github.com/Vhailors/sceneaxi/issues/1)) for product scope.
