# ADR 0004: Seam discipline — no internal-library ports before two real adapters

- **Status:** Accepted — **Amended 2026-07-22** by captain decision `plugin-capability-model`; the charted Plugin Host / capability registry joins the Model Provider Port as a narrow v1 exception. See ADR [0005](0005-plugin-host-capability-manifest.md).
- **Date recorded:** 2026-07-21
- **Source:** Wayfinder design-it-twice pass (origin `threejs-bgf-ecosystem-wayfinder-v1`), condensed in factories-helpers [#41](https://github.com/Vhailors/factories-helpers/issues/41) §Deep modules.
- **Amendment source:** captain option A, `data/threejs-bgf-ecosystem-wayfinder-v1/decisions/plugin-capability-model.md` (locked 2026-07-22).
- **Lineage:** `transferred-from: factories-helpers#46` — engine/CLI half of the split, recorded per [sceneaxi#4](https://github.com/Vhailors/sceneaxi/issues/4); factory-side ADRs stay on factories-helpers [#46](https://github.com/Vhailors/factories-helpers/issues/46).

## Context

SceneAxi is designed as deep modules with narrow external seams (ADRs
[0001](0001-game-kernel-command-snapshot-session.md),
[0002](0002-presentation-runtime-deep-seam.md)). The recurring temptation in
engine ecosystems is to design plugin ports up front — renderer plugins,
physics plugins, storage providers — before any second implementation exists.
The Wayfinder settled a discipline rule instead.

## Decision

**No internal-library ports before two real adapters.**

There are exactly two charted exceptions:

1. The **Model Provider Port** charted by the product spec
   ([sceneaxi#1](https://github.com/Vhailors/sceneaxi/issues/1)) in
   `authoring-core`: a deliberate, pre-declared thin port whose provider
   adapters remain delayed behind the open `llm-provider-policy` hold.
2. The first-class v1 **Plugin Host / capability registry** defined by ADR
   [0005](0005-plugin-host-capability-manifest.md): a manifest-driven host for
   registered public capability IDs, not a route for plugins to declare new
   engine ports.

These decisions fix the exceptions' scopes; neither is precedent for another
port. Renderer, physics, storage, and every other internal-library port still
require two real adapters.

- Internal seams may use concrete libraries directly (the proof program names
  Three, Rapier, Miniplex, IndexedDB, and Playwright as examples) **without
  exposing them across external seams**.
- An internal-library port abstraction is **earned by the second real
  adapter**, never speculative. Until a second adapter exists, the concrete
  library stays an internal detail behind the module's external interface.
- A Plugin Host capability names a public semantic contract already present in
  the versioned capability registry. A plugin cannot create a capability ID,
  hook, or engine-internal port merely by putting it in a manifest; unknown IDs
  refuse.

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
- The **Model Provider Port** remains the deliberately thin contract charted by
  the product spec. Its delayed provider adapters do not widen that contract.
- The **Plugin Host / capability registry** remains the deliberately narrow,
  manifest-driven contract in ADR 0005. It supports independent packages that
  implement registered capabilities; it does not turn internal libraries into
  plugin surfaces.

## Rejected alternatives

- **Speculative universal ports designed before a second adapter exists** —
  abstraction by prediction produces shallow modules, wrong cut-lines, and a
  maintenance surface with no consumer; the renderer-agnostic facade rejected
  in ADR [0002](0002-presentation-runtime-deep-seam.md) is the canonical
  instance.
- **Arbitrary hooks or a monolithic plugin framework** — hook names are
  unversioned hidden ports, and a framework that absorbs plugin implementations
  defeats package isolation. ADR 0005 permits only registered capability IDs
  and light host-to-package integration.
- **Exposing concrete library types across external seams** as the shortcut
  alternative to a port — turns a library choice into a contagion and makes
  every future swap a breaking change.

## Settled here vs held elsewhere

**Settled:** the discipline rule — internal concrete-library use is free
behind seams; every new internal-library port is earned by the second real
adapter. The two narrow exceptions are the Model Provider Port and the v1
Plugin Host / capability registry, each bounded by its own charted contract.

**Held, untouched by this ADR:** `llm-provider-policy` and `deepseek-adoption`
— whether and which LLM provider adapters ever land; renderer composition —
Stage 1 of the proof program, double-gated under factories-helpers #41. This
ADR neither authorizes nor forbids any specific adapter; it only governs when
abstraction over adapters may exist.
