# Authoring-interface behavioral contracts (E1/E2)

**Source of truth:** SceneAxi owns the authoring-interface contracts from
[sceneaxi#5](https://github.com/Vhailors/sceneaxi/issues/5) on.
Origin: [factories-helpers#49](https://github.com/Vhailors/factories-helpers/issues/49)
(`transferred-from: factories-helpers#49`, per the issue-transfer plan); the
Wayfinder report §5.5 remains the analysis these contracts condense.

**Status:**

- **E1 is normative** for the ecosystem CLI `project` verb group and for the
  authoring-core propose/apply service (`packages/authoring-core`).
  The ecosystem CLI is a superset of E1: E1's verbs transfer as the CLI
  `project` group **unchanged**.
- **General E2 is specified, not built.** The fixed Minimum E2 checklist for the
  hybrid sculpt vertical is the sole exception authorized by ADR 0003's
  2026-07-24 amendment; it still uses E1 propose/apply for persistence. Nothing
  in this repo runs the Stage 6 comparison.

**Not duplicated here:** the F1 factory-lifecycle contract stays owned by
[factories-helpers#45](https://github.com/Vhailors/factories-helpers/issues/45)
(factory methodology remains with factories-helpers). This doc only
cross-links it; SceneAxi consumes the F1 stage contract through the
`packages/schemas` contract registry when it lands.

**Implementation tickets (not this doc):** the document model and
propose/apply service are [sceneaxi#9](https://github.com/Vhailors/sceneaxi/issues/9);
the CLI dispatcher, envelope, and deterministic exit-code map are
[sceneaxi#6](https://github.com/Vhailors/sceneaxi/issues/6). This doc defines
behavior those tickets must satisfy; it authorizes no implementation, install,
spend, or proof run on its own.

---

## E1 — v1 authoring surface, source-first (normative)

### CLI surface: the `project` verb group

Five verbs: `project new`, `project dev`, `project test`, `project capture`,
`project report`.

- **Files and flags in; stable paths and exit codes out.** Every verb is
  drivable non-interactively: inputs are files and flags only, outputs land at
  documented, stable paths. No contract-path behavior may depend on a TTY,
  prompt, or environment guess.
- **Exit codes are typed.** `0` = success; every non-zero exit belongs to a
  documented failure class from the CLI's deterministic exit-code map
  (sceneaxi#6). Within a major CLI version, a verb's output paths and exit-code
  meanings must not change.
- **Held-key gating applies.** Each `project` verb must be declared in the CLI
  command map (`packages/schemas/contracts/cli-command-map.schema.json`) and
  refuses per `docs/held-key-enforcement.md` — an undeclared verb refuses.

**Current implementation status:** `project dev` provides an honest one-shot
document status in runnable-surfaces v1 and explicitly refuses every form of
`--watch` ([sceneaxi#115](https://github.com/Vhailors/sceneaxi/issues/115)).
That bounded R2 behavior does not satisfy or retire performance clause 7 below:
the normative hot-reload loop remains unimplemented.

### Propose/apply flow (inspector gizmo edits)

Inspector gizmo edits never write documents directly; they emit proposals:

- `propose(documentPath, jsonPointer, newValue) → unified diff`
- `apply(proposal) → applied | indeterminate(transactionId) | reject(typed diagnostics)`

Contract clauses:

1. **One validator.** Direct edits and proposals run through a single shared
   validator implementation. There is no second, laxer validation path.
2. **Atomic writes.** Every document write is tmp-then-rename; a crash never
   leaves a half-written document at a canonical path.
3. **All-or-nothing multi-document proposals.** A proposal touching several
   documents applies completely or not at all; partial application is
   forbidden.
4. **Content-hash conflict rejection.** A proposal records the content hash of
   each base document. On `apply`, any hash mismatch rejects the whole
   proposal with a typed diagnostic that includes a **re-read hint** (re-read
   the document, re-propose against current content).
5. **Journaled undo and crash recovery.** Applies are journaled before commit;
   recovery after a crash rolls incomplete applies back (or forward) to a
   consistent state, and undo restores prior document content from the journal.
   If canonical bytes are consistent but journal finalization is still pending,
   the result exposes a transaction ID; callers must refuse further authoring
   until that transaction resolves.
6. **Schema-version headers.** Documents carry schema-version headers; on a
   **major** version mismatch the validator refuses rather than silently
   migrating.
7. **Performance targets** (at first-proof project size): `propose` and
   `apply` complete in **<100 ms** each; the `project dev` hot-reload loop
   reflects an applied edit in **<2 s**.

<!-- authoring-jobs:bind E1 -->
**Fixture binding:** E1 acceptance exercises the
[shared authoring-jobs fixture list](#shared-authoring-jobs-fixture-list)
verbatim — every job must be completable through `project` verbs plus
propose/apply alone.

## E2 — schema-driven command editor (general surface specified, not built)

The hybrid vertical's implemented Minimum E2 subset is only the exception named
in [ADR 0003's amendment](adr/0003-editor-sequencing-e1-first-e2-specified.md#2026-07-24-vertical-only-amendment).
It does not activate the broader contract below.

Gate for the general surface below: **built only after Stage 6 friction
evidence.** Until then this section is a precommitted design, kept so the Stage
6 comparison judges two *designed* interfaces instead of improvising one at
prototype time.

- `apply(command{type, target, payload, baseVersion}) → {patch, newVersion} | ConflictError`
- **Undo/redo by inverse patches:** every applied command yields a patch and
  its inverse; undo/redo replays inverses/patches, never re-executes commands.
- **Typed validation:** commands are schema-validated before application;
  invalid commands are rejected with typed diagnostics, never partially
  applied.
- **Single-writer optimistic queue:** one writer applies commands serially;
  concurrent submitters pass `baseVersion`, and a stale `baseVersion` returns
  `ConflictError` (the caller re-reads and resubmits).
- **Explicit replayable migrations:** schema migrations are explicit, ordered,
  and replayable; no implicit or lossy upgrades.
- **Performance target:** command apply in **<50 ms**.
- **Canonical text still holds:** E2 storage is a rebuildable projection; see
  the canonical-text rule below.

<!-- authoring-jobs:bind E2 -->
**Fixture binding:** E2 acceptance exercises the
[shared authoring-jobs fixture list](#shared-authoring-jobs-fixture-list)
verbatim — the same jobs as E1, no additions, removals, or substitutions.

## Shared authoring-jobs fixture list

The canonical machine-readable list is
`packages/schemas/contracts/authoring-jobs.fixtures.json`
(schema: `packages/schemas/contracts/authoring-jobs.schema.json`); it is one
artifact shared by both contracts so any E1-vs-E2 comparison runs identical
jobs. `pnpm check:contracts` enforces that this table and both fixture
bindings above stay in sync with the JSON.

<!-- authoring-jobs:list -->
| id | job | edit class |
|---|---|---|
| `move-rotate-entity` | Move/rotate an entity | transform |
| `retune-material` | Retune a material | scalar-tune |
| `rebind-input-action` | Rebind an input action | binding |
| `edit-clip-event-marker` | Edit a clip event marker | timeline-marker |
| `resize-relayout-hud` | Resize/relayout a HUD element | layout |
<!-- /authoring-jobs:list -->

Document formats and concrete fixture documents are deliberately not fixed
here — they belong to the document-model ticket (sceneaxi#9).

## Canonical-text rule (no data silo)

Versioned text documents remain canonical under **any** editor. No editor
database, index, or proprietary scene form may become the only source of
truth: every editor-side store must be a rebuildable cache or projection
derived from the text documents, and deleting it must lose nothing but time.
