# @sceneaxi/authoring-core

The **agent-native runtime/authoring core** — the single core every profile
consumes (locked topology decision). This package, not the CLI, owns:

- the text-canonical **document model** and the **propose/apply application
  service** (one validator for edits and proposals, E1 discipline);
- **session orchestration** over the engine seams (open/dispatch/advance/
  observe/save/replay) — later tickets;
- **evidence hooks** (Evidence Packet emission points) — later tickets;
- the **Model Provider Port** — later tickets (provider policy held).

## Propose / apply (sceneaxi#9)

```ts
import {
  propose,
  apply,
  editDirect,
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

// apply(proposal) → ok | reject(typed diagnostics)
const r = apply({ proposal: p.ok ? p.proposal : "", cwd: projectRoot });

// Direct edit uses the same validator + serializer as the proposal path
// (byte-identical after the same change).
```

Contract clauses (E1 / `docs/authoring-contracts.md`):

1. One shared `validateDocument` for direct edits and proposals
2. Atomic tmp-then-rename writes
3. All-or-nothing multi-document proposals
4. Content-hash conflict rejection with re-read hint
5. Schema major-mismatch refusal (no silent migration)

Schemas: `packages/schemas/contracts/document.schema.json` and
`proposal.schema.json`. CLI surface: `sceneaxi project propose|apply`.

The CLI (`@sceneaxi/cli`) is a thin protocol adapter over this package — it may
not import engine packages directly (enforced by the dependency matrix).

Boundaries enforced by `scripts/check-boundaries.mjs` against
`docs/dependency-matrix.json`.
