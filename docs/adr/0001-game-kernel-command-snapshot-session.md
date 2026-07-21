# ADR 0001: Game Kernel external interface is a command/snapshot session (Design A)

- **Status:** Accepted — settled by the Wayfinder design-it-twice process; this ADR records the decision, it does not re-decide it.
- **Date recorded:** 2026-07-21
- **Source:** Wayfinder design-it-twice pass (origin `threejs-bgf-ecosystem-wayfinder-v1`), condensed in factories-helpers [#41](https://github.com/Vhailors/factories-helpers/issues/41) §Deep modules.
- **Lineage:** `transferred-from: factories-helpers#46` — engine/CLI half of the split, recorded per [sceneaxi#4](https://github.com/Vhailors/sceneaxi/issues/4); factory-side ADRs stay on factories-helpers [#46](https://github.com/Vhailors/factories-helpers/issues/46).

## Context

The simulation kernel (`packages/engine-kernel`, layer L1) is a deep module
whose external interface is the test surface for determinism, replay stability,
and save migration. The proof program (factories-helpers #41) and the planned
Profile Conformance suite are specified to test at this seam, so its shape had
to be settled before any kernel work. The Wayfinder ran a design-it-twice pass
over candidate external interfaces: a command/snapshot session (Design A), an
exposed ECS, and a scene/component lifecycle. Design A won.

## Decision

The Game Kernel's external interface is a **command/snapshot session**:

```
open / dispatch / advance / observe / save / replay
```

Normative invariants:

- Commands are **validated and timestamped** on dispatch.
- **Only `advance` mutates authoritative state.**
- Snapshots returned by `observe` are **read-only**.
- `save` / `replay` artifacts carry the **schema version plus kernel/BOM
  versions**; migrations are explicit, replayable, and fixture-tested.
- The state **digest is canonical** — it is the currency of determinism and
  replay testing.

The kernel hides: clock, RNG, command validation internals, state layout,
systems/ECS, digest computation, and migrations.

Session snippet from the program spec (factories-helpers #41), inlined because
it encodes the decision precisely. It is **prototype-derived** — decision-precise
illustration, not a shipped API:

```ts
const session = kernel.open(productManifest, host)
session.dispatch({ type: "move", actor: "player", axis: [1, 0] })
session.advance(frameClock)
const view = session.observe()
const replay = session.recording()
```

## Consequences

- Determinism, replay stability, and save migration are testable entirely at
  the external seam (the proof program's seed-digest gates run against this
  contract; no test may assert kernel internals).
- State layout, scheduling, physics, and any internal ECS remain replaceable
  without a breaking external change.
- Schema ownership for the Kernel Session contract is assigned to
  `packages/schemas` per the shared contract registry; this ADR does not
  implement it. The kernel implementation
  ([sceneaxi#8](https://github.com/Vhailors/sceneaxi/issues/8)) and the Profile
  Conformance suite
  ([sceneaxi#10](https://github.com/Vhailors/sceneaxi/issues/10)) target it.
- Declarative product documents may sit **over** Design A; they do not replace
  it as the kernel's external interface.
- ECS is allowed **internally only after measured need** — adopting it is an
  internal refactor, never a seam change.

## Rejected alternatives

- **Exposed ECS as the external interface** — makes internal state layout the
  public test surface; every internal optimization becomes a breaking change;
  couples every consumer to one composition choice. ECS stays an internal
  option, adoptable only after measured need.
- **Scene/component lifecycle as the external interface** — leaks
  presentation-shaped structure into simulation truth and invites
  presentation-side mutation of authoritative state, which the presentation
  seam (ADR [0002](0002-presentation-runtime-deep-seam.md)) forbids.

## Settled here vs held elsewhere

**Settled:** the seam shape and the invariants above.

**Held, untouched by this ADR:** `kernel-name` — the internal runtime
composition's name ("Three Kernel" is the working name of an open captain hold,
not a decision). Stage 1 renderer composition remains double-gated under
factories-helpers #41; this ADR authorizes no proof execution and presumes no
Stage 1 outcome.
