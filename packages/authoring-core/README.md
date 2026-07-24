# @sceneaxi/authoring-core

The **agent-native runtime/authoring core** — the single core every profile
consumes (locked topology decision). This package, not the CLI, owns:

- the text-canonical **document model** and the **propose/apply application
  service** (one validator for edits and proposals, E1 discipline);
- **session orchestration** over the engine seams (open/dispatch/advance/
  observe/save/replay) — later tickets;
- **evidence hooks** (Evidence Packet emission points) — later tickets;
- the provider-neutral **Model Provider Port** (sceneaxi#45).

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
