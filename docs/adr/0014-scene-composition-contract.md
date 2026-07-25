# ADR 0014: Scene composition is a deterministic, fail-closed contract

- **Status:** Accepted for scene composition v1.
- **Date recorded:** 2026-07-25
- **Source:** [sceneaxi#85](https://github.com/Vhailors/sceneaxi/issues/85) and [#86](https://github.com/Vhailors/sceneaxi/issues/86).
- **Lineage:** Children of scene composition parent [#84](https://github.com/Vhailors/sceneaxi/issues/84); extend ADRs 0006, 0007, and 0011.

## Context

Sculpt-quality v1 could open exactly one object. The Sculpt Artifact contract is
object-scoped, and nothing expressed how several artifacts sit relative to one
another, so there was no way to describe — let alone open — a scene. Inventing
per-consumer placement conventions would have pushed scene semantics into
demos and shells instead of into an owned contract.

## Decision

SceneAxi owns a versioned **Scene Composition Intake** and the resolved
**ComposedScene**. An intake names a scene, its root instance, and at least two
placements, each binding an `instanceId` to an `artifactId`, a parent instance,
and a transform. Reusing one `artifactId` across placements is legal instancing.
A ComposedScene carries the resolved instances — ordered by ascending depth then
ascending `instanceId` — with their depth, local and world transforms, embedded
artifact, and recomputable evidence digests.

Placement composition in v1 is **axis-aligned**: scales multiply, rotations add
and wrap into `[0, 360)`, and a child offset is scaled by its parent but never
rotated. Because that would mis-nest children, a non-leaf instance carrying a
non-zero rotation refuses with `rotated-parent-unsupported`. Leaf instances
rotate freely. All values round to the kernel's existing 1e-6 grid.

Placement is a **projection, never an artifact rewrite**. A Sculpt Artifact's
evidence binds its exact spec bytes under ADR 0011, so a rewritten artifact would
correctly refuse its own validator. `projectSceneInstanceHierarchy()` composes the
world transform into an instance's root node only and leaves the artifact intact.
Existing root-local transforms remain part of the artifact and are composed
after the instance world transform, preserving both placement and the artifact's
own hierarchy semantics without importing presentation types into the contract
package. If the combined root transform is outside the contract's representable
bounds, composition refuses `invalid-artifact` rather than clipping it.

Composition fails closed through a named refuse matrix with stable
`{ code, path, message }` diagnostics. Nothing is dropped in either direction: a
placement naming an artifact that was not supplied refuses
`unknown-artifact-reference`, and an artifact supplied but never placed refuses
`unplaced-artifact`. `validateComposedScene()` independently recomputes instance
order, depths, world transforms, the placement digest, every embedded artifact
digest, and the scene digest.

The ComposedScene is projected into the **existing** text-canonical
`SceneDocument` under the reserved `composedScene` data key. The document
contract is unchanged, so propose/apply remains the persistence authority.

## Consequences

- A scene's bytes and digests are fixture-lockable under `pnpm gate`.
- A tampered scene refuses instead of opening, and evidence can be re-derived by
  any consumer without trusting the producer.
- A valid Sculpt Artifact whose projected root remains representable is
  composable without rewriting its hierarchy or invalidating its evidence.
- Rotation-aware child placement requires an explicit contract revision; callers
  cannot silently reinterpret this v1 rule.
- Scene semantics live in one owned contract rather than in demos or shells.

## Rejected alternatives

- **Approximating rotated parents** — silently mis-nests children; refusing is
  the only honest v1 behavior.
- **Writing world transforms back into artifacts** — breaks the artifact's own
  evidence binding and destroys reproducibility.
- **A new scene document kind** — forks the text-canonical document contract and
  splits the persistence authority.
- **Dropping unreferenced or unresolvable artifacts** — a silent drop is exactly
  the failure this contract exists to prevent.
- **Offline agent assistance for composition** — composition is fully
  deterministic and has no refinement step an agent would improve, so no flag,
  adapter, or provider path is added. ADR 0012's default-off sculpt flag is
  untouched.

## Settled here vs held elsewhere

**Settled:** contract ownership, the v1 axis-aligned placement rule, projection
rather than artifact rewriting, the named refuse matrix, and document projection.

**Held elsewhere:** rotation-aware composition, scene authoring tools, renderer
selection, Stage 1 adjudication, production spend, and any readiness claim.
