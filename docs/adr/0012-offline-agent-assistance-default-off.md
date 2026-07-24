# ADR 0012: Sculpt agent assistance is injected, offline, and default-off

- **Status:** Accepted for sculpt-quality v1.
- **Date recorded:** 2026-07-24
- **Source:** [sceneaxi#79](https://github.com/Vhailors/sceneaxi/issues/79).
- **Lineage:** Child decision of sculpt-quality parent #76; preserves ADR 0007 ownership.

## Context

An agent may improve a locally authored spec, but green CI cannot depend on
network availability, ambient credentials, provider behavior, or production
spend. Optional assistance also cannot weaken deterministic reconstruction.

## Decision

`reconstructSculpt()` exposes `enableOfflineAgent`, defaulting to `false`.
Assistance is available only through an explicitly injected synchronous offline
adapter. With the flag off, the adapter is not called. With the flag on, a
missing adapter refuses, invalid output refuses, and identical input is refined
twice; unequal canonical results refuse as nondeterministic.

The normal fixture and golden paths leave the flag off. Authoring core contains
no provider dependency, credential path, network fallback, or implicit spend.

## Consequences

- Repository gates remain fully offline and fixed-seed deterministic.
- A local agent can be evaluated without becoming a core runtime dependency.
- Agent output still passes the same ObjectSculptSpec and artifact validators.

## Rejected alternatives

- **Agent enabled by default** — makes green depend on optional machinery.
- **Ambient provider fallback** — violates authority, cost, and reproducibility
  boundaries.
- **Trust one agent result** — cannot detect immediate nondeterminism.

## Settled here vs held elsewhere

**Settled:** default-off flag, injection boundary, and fail-closed determinism
check.

**Held elsewhere:** agent/provider selection, production spend, and any hosted
reconstruction service.
