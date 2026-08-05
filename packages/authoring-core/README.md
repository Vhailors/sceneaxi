# @sceneaxi/authoring-core

The **agent-native runtime/authoring core** — the single core every profile
consumes (locked topology decision). This package, not the CLI, owns:

- the text-canonical **document model** and the **propose/apply application
  service** (one validator for edits and proposals, E1 discipline);
- the bounded hybrid **Minimum E2 orchestration** over kernel and presentation
  seams; broader session orchestration remains later work;
- **evidence hooks** (Evidence Packet emission points) — later tickets;
- the provider-neutral **Model Provider Port** (sceneaxi#45).

## Assistant sculpt flow (sceneaxi#192)

`runAssistantSculptAction()` turns one prompt into the existing validated
`SculptArtifact`. Its `local` route is a deterministic, provider-free compiler;
its `byo` route crosses an explicitly injected Model Provider Port and accepts
only an unambiguous `sceneaxi.sculpt-intake` JSON document before reconstruction.
Both routes report observable progress and return recoverable named refusals for
invalid prompts, provider failures/refusals, invalid output, or reconstruction
failure. The Kids profile is denied before local work or provider dispatch.

Hosted AI deliberately has no direct authoring-core dispatch. A hosted caller
must first obtain completion text through billing's metered assistant seam, then
pass it to `sculptArtifactFromAssistantCompletion()` with the already-checked
profile. That function only validates and reconstructs existing text and labels
the result `validated-completion`; the billing snapshot remains the only evidence
that hosted work was metered. It independently denies Kids before parsing.
Successful results expose the artifact plus read-only material,
physics (where the quality runtime has colliders), and procedural-settings
inspection. Editing those values refuses because the current contracts expose
no such edit operation.

## Model Provider Port (sceneaxi#45)

`createModelProviderPort()` accepts an injected adapter and a policy filter for
each calling profile. The port refuses missing adapters, missing profile
filters, denied policies, and undeclared capabilities before dispatch. Its
non-overridable Kids guard names `THIRD_PARTY_LLM_DENIED_BY_DEFAULT` for a
third-party route and keeps every other Kids route closed until a later explicit
Kids decision enables one.

Stable prerequisite refusals are `MODEL_PROVIDER_ADAPTER_MISSING`,
`MODEL_PROVIDER_PROFILE_POLICY_MISSING`, and
`MODEL_PROVIDER_CAPABILITY_UNSUPPORTED`; malformed capability declarations use
`MODEL_PROVIDER_CAPABILITY_DESCRIPTOR_INVALID`.

The public v1 types cover `complete`, `tool-call`, and an async-iterable `stream`,
plus capability and exact model descriptors. Successful calls return and may
emit a stable `sceneaxi.model-provider-call-evidence` object containing the
adapter-attested executed model, provider, quantization, and version. See
`packages/schemas/contracts/model-provider-port.schema.json` and the canonical
[SPEC Model Provider Port](../../docs/program/SPEC.md#model-provider-port)
policy. This package contains no live provider adapter, credentials, fallback
routing, network call, or production LLM-readiness claim; the fake adapter is a
test fixture only.

## Hybrid sculpt reconstruction and Minimum E2

`reconstructSculpt()` validates the versioned contracts in
[`@sceneaxi/schemas`](../schemas/README.md#hybrid-sculpt-contracts) and produces
canonical Sculpt Artifact bytes and a digest without a live provider.
`structured-spec` is the deterministic fixture path and `image+brief` is the
demo-grade reconstruction path. Valid `image` and `multi-view` envelopes remain
unsupported by reconstruction v1 and refuse closed. Sculpt-quality v1 adds the
public `emitSculptProcedural()` geometry/material/hierarchy factory; generated
artifacts bind its module ID, public export, source digest, seed, and emitted
plan digest.

The stable refusal codes are `invalid-intake`, `unsupported-intake-mode`,
`quality-gate-refused`, `artifact-invalid`, `invalid-options`,
`offline-agent-unavailable`, `offline-agent-invalid`, and
`offline-agent-nondeterministic`. Quality-gate refusals name the failed
`component-budget`, `hierarchy-depth`, or `physical-extent` gate.
`enableOfflineAgent` defaults to false; when true it requires an injected
offline adapter and identical canonical output across two runs. Production
model calls, provider spend, and `img2threejs` are absent. Full sculpt-quality
contract, demo, and evidence pointers are in
[`docs/sculpt-quality.md`](../../docs/sculpt-quality.md).

The public package-root `emitSculptProcedural` export is the resolvable module
identity recorded in quality artifacts. With legacy input, the no-options
`reconstructSculpt(intake)` overload preserves the PR #75 artifact branch.
Quality input, any supplied options object (including `{}`), or
`reconstructSculptQuality()` selects the quality branch and normalizes legacy
input when needed. Artifact validation independently recomputes the canonical
fixed-seed emit.

`createMinimumE2Editor()` owns the bounded orchestration API authorized by
[ADR 0003's vertical-only amendment](../../docs/adr/0003-editor-sequencing-e1-first-e2-specified.md#2026-07-24-vertical-only-amendment).
Its save/load path persists through the same text-canonical propose/apply
service below. The web-shell re-exports this API; it does not implement a second
editor.

## Scene composition (sceneaxi#86)

```ts
import { composeScene } from "@sceneaxi/authoring-core";

const composed = composeScene(sceneIntake, [crateArtifact, droneArtifact]);
```

`composeScene()` turns one Scene Composition Intake plus the Sculpt Artifacts it
places into one `ComposedScene`, its canonical bytes and digest, and one
text-canonical `SceneDocument` carrying the scene under the reserved
`composedScene` data key. Contract shapes, placement math, and the refuse matrix
belong to [`@sceneaxi/schemas`](../schemas/README.md#scene-composition-contracts-sceneaxi85);
this package owns the pipeline.

Composition is offline and seedless — no provider, no network, no credential —
so identical input always produces identical `sceneBytes` and `sceneDigest`.

Nothing is dropped in either direction: a placement naming an artifact that was
not supplied refuses `unknown-artifact-reference`, and an artifact supplied but
never placed refuses `unplaced-artifact`. One artifact placed at several
instances is legal instancing and is supplied once. Every supplied artifact is
validated through the existing Sculpt Artifact contract before composition.

The composed scene is re-validated by `validateComposedScene()` before it is
returned, so a scene that could not be re-opened is never handed back.
`serializeComposedScene()` is the byte-canonical form used by golden fixtures.

## Propose / apply (sceneaxi#9)

```ts
import {
  propose,
  apply,
  editDirect,
  recoverIncompleteApplies,
  resolveApplyTransaction,
  undoLastApply,
  writeDocumentFile,
  createDocument,
} from "@sceneaxi/authoring-core";

// propose(documentPath, jsonPointer, newValue) → proposal + unified diff
const p = propose({
  documentPath: "scene.json",
  jsonPointer: "/data/entities/0/x",
  newValue: 42,
  cwd: projectRoot,
});

// apply(proposal) → applied | indeterminate(transactionId) | reject
if (p.ok) {
  const r = apply({ proposal: p.proposal, cwd: projectRoot });
  const transactionId =
    r.applicationState === "indeterminate"
      ? r.transactionId
      : r.ok && r.journalRecoveryPending
        ? r.transactionId
        : null;
  if (transactionId !== null) {
    const resolved = resolveApplyTransaction({
      transactionId,
      cwd: projectRoot,
    });
  }
}

// Service entrypoints recover first; hosts may also recover explicitly at startup.
const recovered = recoverIncompleteApplies({ cwd: projectRoot });

// Undo restores exact prior bytes from the latest completed journal entry.
const undone = undoLastApply({ cwd: projectRoot });

// Direct edit uses the same validator + serializer as the proposal path
// (byte-identical after the same change).
```

Contract clauses (E1 / `docs/authoring-contracts.md`):

1. One shared `validateDocument` for direct edits and proposals
2. Atomic tmp-then-rename writes
3. All-or-nothing multi-document proposals
4. Content-hash conflict rejection with re-read hint
5. Apply journal persisted before commit, recover-forward after interruption,
   and undo from journaled prior bytes
6. Schema major-mismatch refusal (no silent migration)

Apply journals are versioned JSON under `.sceneaxi/journal/` beneath the supplied
`cwd`. Use that same project root for apply, recovery, resolution, and undo.
Recovery and undo fail closed if a journal is corrupt or if current document bytes
match neither the expected before- nor after-image; they never overwrite an
unrelated edit. A result with `journalRecoveryPending: true` includes a
`transactionId`; call `resolveApplyTransaction()` and block further authoring until
it reports a terminal state.

Schemas: `packages/schemas/contracts/document.schema.json` and
`proposal.schema.json`. CLI surface: `sceneaxi project propose|apply`.

The CLI (`@sceneaxi/cli`) is a thin protocol adapter over this package — it may
not import engine packages directly (enforced by the dependency matrix).

Boundaries enforced by `scripts/check-boundaries.mjs` against
`docs/dependency-matrix.json`.
