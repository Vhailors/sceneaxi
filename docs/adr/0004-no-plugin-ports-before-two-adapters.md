# ADR 0004: Seam discipline — no plugin ports before two real adapters (charted Model Provider Port excepted)

- **Status:** Accepted — settled by the Wayfinder design-it-twice process; this ADR records the decision, it does not re-decide it.
- **Date recorded:** 2026-07-21
- **Source:** Wayfinder design-it-twice pass (origin `threejs-bgf-ecosystem-wayfinder-v1`), condensed in factories-helpers [#41](https://github.com/Vhailors/factories-helpers/issues/41) §Deep modules.
- **Lineage:** `transferred-from: factories-helpers#46` — engine/CLI half of the split, recorded per [sceneaxi#4](https://github.com/Vhailors/sceneaxi/issues/4); factory-side ADRs stay on factories-helpers [#46](https://github.com/Vhailors/factories-helpers/issues/46).

## Context

SceneAxi is built as deep modules with narrow external seams (ADRs
[0001](0001-game-kernel-command-snapshot-session.md),
[0002](0002-presentation-runtime-deep-seam.md)). The recurring temptation in
engine ecosystems is to design plugin ports up front — renderer plugins,
physics plugins, storage providers — before any second implementation exists.
The Wayfinder settled a discipline rule instead.

## Decision

**No plugin ports before two real adapters.**

The one exception is the **Model Provider Port** charted by the product spec
([sceneaxi#1](https://github.com/Vhailors/sceneaxi/issues/1)) in
`authoring-core`: a deliberate, pre-declared thin port whose provider adapters
remain delayed behind the open `llm-provider-policy` hold. The spec fixes the
exception's scope; this ADR does not widen it. The two-real-adapters rule stays
unqualified for every new port.

- Internal seams may use concrete libraries directly (the proof program names
  Three, Rapier, Miniplex, IndexedDB, and Playwright as examples) **without
  exposing them across external seams**.
- A port/plugin abstraction is **earned by the second real adapter**, never
  speculative. Until a second adapter exists, the concrete library stays an
  internal detail behind the module's external interface.

## Consequences

- Modules stay deep: external interfaces stay small while implementations use
  whatever concrete library fits, hidden.
- Abstractions are **extracted from two working implementations** instead of
  predicted; the cut-line is evidence, not guesswork.
- First implementations are deliberately written against concrete libraries;
  the cost of later port extraction is accepted, priced as cheaper than
  maintaining a wrong speculative abstraction.
- Delayed packages (`engine-asset-compiler`, `engine-platform-host`,
  `engine-evidence`, `provider-<name>`) land into pre-declared
  dependency-matrix slots — but **a matrix slot is not a port**: the slot
  reserves the boundary, and any abstraction inside it still hardens only on
  the second real adapter.
- For the explicit exception above, the **Model Provider Port** remains the
  deliberately thin contract charted by the product spec. Its delayed provider
  adapters do not widen that contract or create precedent for another port.

## Rejected alternatives

- **Speculative plugin architecture / universal ports designed before a second
  adapter exists** — abstraction by prediction produces shallow modules,
  wrong cut-lines, and a maintenance surface with no consumer; the
  renderer-agnostic facade rejected in ADR
  [0002](0002-presentation-runtime-deep-seam.md) is the canonical instance.
- **Exposing concrete library types across external seams** as the shortcut
  alternative to a port — turns a library choice into a contagion and makes
  every future swap a breaking change.

## Settled here vs held elsewhere

**Settled:** the discipline rule — internal concrete-library use is free
behind seams; every new port is earned by the second real adapter.

**Held, untouched by this ADR:** `llm-provider-policy` and `deepseek-adoption`
— whether and which LLM provider adapters ever land; renderer composition —
Stage 1 of the proof program, double-gated under factories-helpers #41. This
ADR neither authorizes nor forbids any specific adapter; it only governs when
abstraction over adapters may exist.
