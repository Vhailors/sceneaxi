# ADR 0006: Hybrid core plus AI sculpt authoring

- **Status:** Accepted for the post-MVP hybrid vertical.
- **Date recorded:** 2026-07-24
- **Source:** [sceneaxi#67](https://github.com/Vhailors/sceneaxi/issues/67) and its frozen launch brief.
- **Lineage:** Hybrid sculpt/editor v1 parent decision; children #68–#74 implement the one vertical.

## Context

SceneAxi's core identity is an interactive engine/library. The vertical needs a
creator path that combines a Godot-like runtime/editor vocabulary with
AI-assisted object sculpting without turning an importer, model provider, or
renderer into the product core.

## Decision

Adopt a hybrid direction: a SceneAxi engine/library core plus versioned AI
sculpt authoring. The v1 openable path is Sculpt Intake → Sculpt Artifact →
Mount API → Minimum E2 → kernel play/step. Individual games remain outside the
monorepo.

Minimum E2 is the exact bounded checklist in ADR 0003's amendment. The vertical
does not include a full Godot editor, production physics, marketplace commerce,
Kids product, multiplayer, audio, or installers.

## Consequences

- Sculpt authoring composes existing schemas, authoring, kernel, and
  presentation seams rather than replacing them.
- Text-canonical propose/apply remains the persistence authority.
- The golden fixture and one image+brief demo are the done bar, not a readiness
  or commercial claim.

## Rejected alternatives

- **Sculpt tool as the product identity** — makes an orbiting authoring path the core.
- **Full editor clone in v1** — exceeds the frozen Minimum E2 checklist.
- **Provider-first runtime** — couples the product to spend and an external implementation.

## Settled here vs held elsewhere

**Settled:** the hybrid direction and this vertical's openable path.

**Held elsewhere:** Stage 1 execution and renderer adjudication, production
spend, Kids safety, commerce, and all readiness claims.
