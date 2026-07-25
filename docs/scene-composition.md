# Scene composition v1

Scene composition v1 is the multi-object layer over the openable hybrid vertical
(PR #75) and its quality depth (PR #83). It does not replace the Sculpt Intake,
reconstruction, Mount, kernel, or Minimum E2 entry points — it composes their
output.

The path is:

`N validated Sculpt Artifacts + one Scene Composition Intake → one ComposedScene → one text-canonical SceneDocument → existing Mount API + one multi-object kernel session`

## Shipped contract depth

- A **Scene Composition Intake** names a scene, its root instance, and at least
  two placements, each binding an `instanceId` to an `artifactId`, a parent
  instance, and a transform. Reusing one `artifactId` is legal instancing.
- A **ComposedScene** carries the resolved instances — ordered by ascending depth
  then ascending `instanceId` — with depth, local and world transforms, the
  embedded artifact, and recomputable evidence digests.
- **Placement is axis-aligned in v1**: scales multiply, rotations add and wrap
  into `[0, 360)`, and a child offset is scaled by its parent but never rotated.
  A non-leaf instance with a non-zero rotation refuses rather than mis-nesting
  its children; leaf instances rotate freely.
- **Placement is a projection, never an artifact rewrite.** A Sculpt Artifact's
  evidence binds its exact spec bytes, so `projectSceneInstanceHierarchy()`
  composes the world transform into the root node only and leaves the artifact —
  and its digests — verifiable. Existing root-local transforms remain part of
  the artifact and are composed after the instance world transform.
- Composition **fails closed** through a named refuse matrix. Nothing is dropped
  in either direction: an unsupplied artifact reference refuses
  `unknown-artifact-reference`, and a supplied-but-unplaced artifact refuses
  `unplaced-artifact`.
- The scene is projected into the **existing** text-canonical `SceneDocument`
  under the reserved `composedScene` data key, so propose/apply remains the
  persistence authority.
- Composition is offline and seedless: identical input always produces identical
  bytes and digests. There is no provider call, credential, network path, or
  spend, and no new agent flag.

The authoritative shape is
[`scene-composition.schema.json`](../packages/schemas/contracts/scene-composition.schema.json).
Runtime validators, placement math, and the projection helper live at
[`@sceneaxi/schemas`](../packages/schemas/README.md#scene-composition-contracts-sceneaxi85);
the composition pipeline lives at
[`@sceneaxi/authoring-core`](../packages/authoring-core/README.md#scene-composition-sceneaxi86);
the multi-object open path lives at
[`@sceneaxi/engine-kernel`](../packages/engine-kernel/README.md#scene-kernel-sessions).
The decisions are recorded in
[ADR 0014](adr/0014-scene-composition-contract.md) and
[ADR 0015](adr/0015-scene-minimal-multi-object-open-path.md).

## Demo and evidence

The committed scene is
[workshop-bay.scene.json](../tests/e2e/fixtures/scene-composition/workshop-bay.scene.json):
three instances built from the two landed sculpt-quality demos, with the service
crate instanced twice and a two-level parent chain.

[`scene-composition-golden.test.ts`](../tests/e2e/scene-composition-golden.test.ts)
reconstructs both source artifacts at their landed seeds, composes the scene,
writes and reopens the SceneDocument, mounts every instance through the existing
Mount API, then opens, advances, saves, and replays the scene kernel session. Its
stable composition, document, mount, kernel, and named-refusal digests are
checked in at
[`golden-digests.json`](../tests/e2e/fixtures/scene-composition/golden-digests.json).

No presentation adapter was needed. The tested not-needed decision for
sceneaxi#87 is
[`mount-support-evidence.json`](../tests/e2e/fixtures/scene-composition/mount-support-evidence.json).

## Boundaries

This ship adds no Minimum E2 checklist item, Stage 1 run, renderer decision,
production physics behavior, engine-internal port, plugin capability, CLI verb,
marketplace or Kids surface, provider spend, or published package. Rotation-aware
child placement is deliberately deferred to a later contract revision rather than
approximated.

It is deterministic contract and demo evidence, not an engine-ready or
commercially validated claim.
