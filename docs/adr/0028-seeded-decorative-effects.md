# ADR 0028: Decorative effects are presentation-only and seeded

- **Status:** Accepted.
- **Date recorded:** 2026-08-14

## Context

Particles should look alive without becoming kernel authority. three.quarks
was evaluated for v1; its RNG is not injectable, so a closed `sampleAt`
evaluation is the contract.

## Decision

Emitters live in `documentData.sceneEffects`. Each emitter seed is derived
from the catalog seed and emitter id. `sampleSceneEffects({ timeMs })` is
digest-stamped. Particle state never enters kernel snapshots.

## Consequences

- Headless gates assert sample identity, not pixels.
- three.quarks remains a later option only if its RNG becomes injectable.

## Rejected alternatives

- Gameplay-coupled effects in v1.
- Exposing an external particle JSON format as the contract.
