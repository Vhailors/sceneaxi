# ADR 0013: Sculpt-quality uses existing Mount, kernel, and Minimum E2 support

- **Status:** Accepted for sculpt-quality v1.
- **Date recorded:** 2026-07-24
- **Source:** [sceneaxi#81](https://github.com/Vhailors/sceneaxi/issues/81).
- **Lineage:** Child decision of sculpt-quality parent #76; bounded by ADRs 0003 and 0009.

## Context

The quality demos needed to mount, animate sockets, and open in the existing
vertical. That requirement could have become an accidental editor or engine
expansion program.

## Decision

No new support adapter is needed. Both committed sculpt-quality demos pass the
existing reconstruction, Mount, toy kernel save/replay, and Minimum E2
save/reload path. The executable not-needed record is
`tests/e2e/fixtures/sculpt-quality/minimal-support-evidence.json`.

No Minimum E2 checklist item, engine adapter, production physics behavior, or
Stage 1 surface is added for sculpt-quality v1.

## Consequences

- Quality depth stays additive at contract, reconstruction, and fixture seams.
- The existing vertical remains the only demo opening path.
- A later support request must justify itself independently; this ADR is not a
  blanket editor-expansion authorization.

## Rejected alternatives

- **Add placeholder engine/editor work to satisfy the ticket mechanically** —
  creates unsupported surface without a demo need.
- **Expand Minimum E2 for richer authoring tools** — explicitly outside the
  frozen ship.
- **Upgrade toy collision to production physics** — outside scope and evidence.

## Settled here vs held elsewhere

**Settled:** support is not needed for these two demos and no checklist expands.

**Held elsewhere:** general editor programs, production physics, Stage 1, and
engine-readiness decisions.
