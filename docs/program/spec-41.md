# Engine-core proof program — pointer to factories-helpers#41

**Source of truth:**
[factories-helpers#41](https://github.com/Vhailors/factories-helpers/issues/41) —
"Spec: Browser Game Factory — Three Kernel falsifiable proof program (Wayfinder
to-spec)". This file is a **pointer, not a mirror**: the proof program's normative
text lives on factories-helpers and is deliberately not copied here. The working
names in #41's title ("Browser Game Factory", "Three Kernel") are the recommended
answers of open captain holds, used there for readability — not decisions.

## What #41 owns

The Stage 0–8 falsification program for the engine core, including the Stage 1
proof contract. In one line each (summary only — #41 is normative):

- **Stage 0** — engine-neutral acceptance contract, rubric, allocation, quotas,
  and pinned config locked before any arm runs.
- **Stage 1** — the paired-replicate Three-vs-PlayCanvas renderer-composition
  proof, under its own precommitted, double-gated rules.
- **Stage 2** — a second mechanically different genre (reuse threshold or the
  factory extraction is killed).
- **Stage 3** — Godot↔web Asset Package round-trip with an explicit loss ledger.
- **Stage 4** — PWA / mobile-browser lifecycle.
- **Stage 5** — optional wrapper/hosted capability, behind tier-4 decisions.
- **Stage 6** — editor-need proof on the designed E1/E2 contracts.
- **Stage 7** — external commercial validation (spend separately authorized).
- **Stage 8** — repository/readiness gate; the readiness/claims gate for the
  program. Factory-ready ≠ engine-ready ≠ commercially validated ≠ kids-safe ≠
  marketplace-ready; evidence never rounds up.

Every stage is separately authorized with budget caps and kill criteria; the
default cash budget is $0.

## Transfer classification

- **Provenance retained + transfer anchor.** #41's body stays on
  factories-helpers, unchanged and authoritative; this document is the anchor
  recording that relationship inside the SceneAxi repo. Nothing in this repo
  rewrites, erases, or supersedes any factories-helpers body.
- **[sceneaxi#1](https://github.com/Vhailors/sceneaxi/issues/1) is the
  product-scope successor:** canonical for SceneAxi product scope, while #41
  remains canonical for the engine-core proof program (Stages 0–8, Stage 1
  contract).
- **Transfer reconciliation:** recorded in the "Transfer reconciliation" section
  of [sceneaxi#3](https://github.com/Vhailors/sceneaxi/issues/3), continuing the
  issue-transfer plan's #41 anchor work (`transferred-from: factories-helpers#41`).
  Per #1's Further Notes, the single reconciliation comment on #41 itself is
  pending and owned by firstmate under transfer authority.
- factories-helpers **#42–#52 remain live** per the issue-transfer plan. The
  proof-prep docs (#50–#52) re-home to [`docs/proof/`](../proof/README.md)
  (tracked as sceneaxi [#13](https://github.com/Vhailors/sceneaxi/issues/13),
  [#14](https://github.com/Vhailors/sceneaxi/issues/14),
  [#15](https://github.com/Vhailors/sceneaxi/issues/15)) with execution still
  double-gated.

## Double gate (normative reminder)

Stage 1 execution requires **both** recorded tier-3 captain decisions **and** a
separate explicit run authorization. The monorepo is packaging, not proof;
nothing in this repo — this pointer included — pre-decides the renderer
composition or authorizes any proof run.
