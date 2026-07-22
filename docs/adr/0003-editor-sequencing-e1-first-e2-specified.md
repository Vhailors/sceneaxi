# ADR 0003: Editor sequencing — E1 first, E2 specified-not-built

- **Status:** Accepted — settled by the Wayfinder design-it-twice process; this ADR records the decision, it does not re-decide it.
- **Date recorded:** 2026-07-21
- **Source:** Wayfinder design-it-twice pass (origin `threejs-bgf-ecosystem-wayfinder-v1`), condensed in factories-helpers [#41](https://github.com/Vhailors/factories-helpers/issues/41) §Editor and factory-pipeline interfaces.
- **Lineage:** `transferred-from: factories-helpers#46` — engine/CLI half of the split, recorded per [sceneaxi#4](https://github.com/Vhailors/sceneaxi/issues/4); factory-side ADRs stay on factories-helpers [#46](https://github.com/Vhailors/factories-helpers/issues/46).

## Context

Two editor generations were designed via design-it-twice: **E1**, a
source-first CLI plus browser inspector, and **E2**, a schema-driven command
editor. The sequencing question — build which, when — was settled by the
Wayfinder: friction evidence, not enthusiasm, decides whether E2 is ever built,
and the proof program's Stage 6 (editor-need proof) exists to produce that
evidence by comparing two *designed* interfaces on a shared authoring-jobs
fixture list.

## Decision

- **v1 authoring is E1**: the source-first CLI plus a browser inspector whose
  edits flow through the propose→diff→apply protocol over **text-canonical
  documents**, with one validator implementation for direct edits and
  proposals.
- **E2 is specified, not built.** Its behavioral contract (command apply with
  base-version conflict detection, undo/redo by inverse patches, explicit
  replayable migrations) is designed now so that Stage 6 tests a designed
  interface, not an improvised one — but E2 is built **only after Stage 6
  friction evidence**.
- **Text documents stay canonical under any editor.** No editor may become a
  proprietary data silo.

Implementation of the E1/E2 behavioral contracts is tracked in this repo by
[sceneaxi#5](https://github.com/Vhailors/sceneaxi/issues/5) (continuing
factories-helpers [#49](https://github.com/Vhailors/factories-helpers/issues/49));
E1's verbs transfer as the CLI `project` command group
([sceneaxi#6](https://github.com/Vhailors/sceneaxi/issues/6),
[#9](https://github.com/Vhailors/sceneaxi/issues/9)).

## Consequences

- Every v1 authoring surface converges on one propose/apply path producing
  identical documents and evidence; this ADR does not set the investment order
  across CLI, web shell, desktop shell, and importers.
- Stage 6 compares two designed interfaces on the shared authoring-jobs
  fixture list. Building E2 earlier would invalidate the editor-need proof by
  making the comparison a sunk-cost defense.
- Every future editor inherits text-canonical documents; migrations are
  explicit and replayable, never implicit format capture.
- If Stage 6 evidence never justifies E2, it is never built — the designed
  contract is the cost ceiling of the bet.

## Rejected alternatives

- **E2 first, or E1 and E2 in parallel** — builds a speculative editor before
  friction evidence exists; Stage 6 exists precisely to test that need.
- **A GUI editor as the canonical authoring layer** — rejected because
  documents are text-canonical and shells are protocol clients; a
  canonical-GUI posture would fork human and agent behavior and create a data
  silo.
- **Improvising the E2 interface at Stage 6 time** — the contract is designed
  now so the editor-need proof measures a real design, not a strawman.

## Settled here vs held elsewhere

**Settled:** the E1-before-E2 sequencing; E2 specified-not-built pending
Stage 6 evidence; text canonicality under any editor.

**Settled elsewhere:** `authoring-surface-priority` and `cli-audience` are
recorded in the canonical product spec
([sceneaxi#1](https://github.com/Vhailors/sceneaxi/issues/1)); this ADR sequences
editor *generations* and does not duplicate those decisions. Stage 6 execution
timing belongs to the proof program (factories-helpers #41), not to this record.
