# ADR 0003: Editor sequencing — E1 first, general E2 specified-not-built

- **Status:** Accepted; amended 2026-07-24 for one bounded hybrid vertical and
  2026-08-11 for the captain-authorized packaged desktop editor.
- **Date recorded:** 2026-07-21
- **Source:** Wayfinder design-it-twice pass (origin `threejs-bgf-ecosystem-wayfinder-v1`), condensed in factories-helpers [#41](https://github.com/Vhailors/factories-helpers/issues/41) §Editor and factory-pipeline interfaces.
- **Lineage:** `transferred-from: factories-helpers#46` — engine/CLI half of the split, recorded per [sceneaxi#4](https://github.com/Vhailors/sceneaxi/issues/4); factory-side ADRs stay on factories-helpers [#46](https://github.com/Vhailors/factories-helpers/issues/46).

## Context

Two editor generations were designed via design-it-twice: **E1**, a
source-first CLI plus browser inspector, and **E2**, a schema-driven command
editor. The sequencing question — build which, when — was settled by the
Wayfinder: friction evidence, not enthusiasm, decides whether general E2 is ever
built, and the proof program's Stage 6 (editor-need proof) exists to produce
that evidence by comparing two *designed* interfaces on a shared
authoring-jobs fixture list.

## Decision

- **v1 authoring is E1**: the source-first CLI plus a browser inspector whose
  edits flow through the propose→diff→apply protocol over **text-canonical
  documents**, with one validator implementation for direct edits and
  proposals.
- **General E2 is specified, not built.** Its behavioral contract (command
  apply with base-version conflict detection, undo/redo by inverse patches,
  explicit replayable migrations) is designed now so that Stage 6 tests a
  designed interface, not an improvised one — but general E2 is built **only
  after Stage 6 friction evidence**.
- **Text documents stay canonical under any editor.** No editor may become a
  proprietary data silo.

### 2026-07-24 vertical-only amendment

[Sceneaxi#67](https://github.com/Vhailors/sceneaxi/issues/67)–[#74](https://github.com/Vhailors/sceneaxi/issues/74)
authorize one exception: the hybrid sculpt vertical ships **Minimum E2**, and
only this fixed checklist — viewport, scene tree, selection, numeric transform,
inspector, play/pause/step, add/remove sculpt instance, and save/load through
the existing propose/apply protocol.

This amendment does not authorize general E2, a full Godot-like editor, or any
additional editor subsystem. It does not run or replace Stage 6. The original
E1-first rule remains controlling outside this vertical, and text-canonical
documents remain authoritative inside it.

### 2026-08-11 packaged-desktop amendment

The captain directive recorded by
[sceneaxi#249](https://github.com/Vhailors/sceneaxi/issues/249) authorizes full
desktop editor v1 for the shared Electron application. This is a later product
decision and supersedes this ADR's `specified-not-built` bound for that packaged
desktop program only. The implementation remains dependency-ordered over the
existing E1 propose, review, and atomic apply authority; text-canonical project
files stay authoritative, and UI, CLI, and assistant clients converge on one
typed command registry rather than creating a GUI-owned authoring core.

This amendment records authorization, not proof. Stage 6 has not run and the
full desktop program is not evidence for or against its factory-methodology
question. The entitled Web editor remains bounded by ADR 0020, the Kids profile
remains refuse-only, and no networking, XR, marketplace, collaboration,
deployment, publication, account, spend, or Stage 1 authority follows from this
decision. The current inventory and implementation graph are owned by
[`docs/full-editor-v1-capability-matrix.md`](../full-editor-v1-capability-matrix.md).

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
- Stage 6 still compares the designed interfaces on the shared authoring-jobs
  fixture list. Neither the bounded Minimum E2 exception nor the later packaged
  desktop product decision runs or replaces that comparison; the proof program
  must report the full editor as prior product work rather than treating its
  existence as evidence of need.
- Every future editor inherits text-canonical documents; migrations are
  explicit and replayable, never implicit format capture.
- Outside the captain-authorized packaged desktop program, Stage 6 remains the
  gate for any general-E2 claim or expansion. The Web and Kids bounds do not move.

## Rejected alternatives

- **General E2 first, or E1 and general E2 in parallel** — builds a speculative
  editor beyond the named exception before friction evidence exists; Stage 6
  exists precisely to test that need.
- **A GUI editor as the canonical authoring layer** — rejected because
  documents are text-canonical and shells are protocol clients; a
  canonical-GUI posture would fork human and agent behavior and create a data
  silo.
- **Improvising the E2 interface at Stage 6 time** — the contract is designed
  now so the editor-need proof measures a real design, not a strawman.

## Settled here vs held elsewhere

**Settled:** E1 remains the persistence authority; the vertical-only Minimum E2
checklist remains bounded; full desktop editor v1 is authorized for the shared
Electron application; text canonicality holds under every editor.

**Settled elsewhere:** full desktop editor scope and sequencing are owned by
sceneaxi#249 and its dependency graph; `authoring-surface-priority` and `cli-audience` are
recorded in the canonical product spec
([sceneaxi#1](https://github.com/Vhailors/sceneaxi/issues/1)); this ADR sequences
editor *generations* and does not duplicate those decisions. Stage 6 execution
timing belongs to the proof program (factories-helpers #41), not to this record.
