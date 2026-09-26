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

## Rendering integration note

The presentation backend's `sampleEffects(catalog, timeMs)` consumes the full
catalog and uses `sampleSceneEffects` unchanged. It draws the returned positions
as white points and returns the same digest-stamped evaluation. It does not
invent different distributions for the sampler's emitter kinds or advance a
kernel clock.

`MountableScene.effects` carries the full authored catalog, seed included, so
product viewports reproduce these samples. No default seed is inferred by the
renderer. The sampler's 0..60000 ms range still applies: `sampleEffects` refuses a
negative or non-finite time and wraps longer playback into that window, which is
output-identical because the pattern depends only on `floor(t) mod 1000`
(`packages/engine-presentation/src/three-core.ts`).

## Rejected alternatives

- Gameplay-coupled effects in v1.
- Exposing an external particle JSON format as the contract.
