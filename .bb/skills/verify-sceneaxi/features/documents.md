# Document edits

Users propose a JSON Pointer edit, review it, then accept or reject it. Acceptance writes canonical document bytes.

## Sub-features

- `documents.review` preserves bytes until acceptance.
- `documents.accept` persists the reviewed value.
- `documents.parity` preserves the same bytes and content hash across CLI and shell clients.

## How to get to it (user POV)

Use CLI `project propose` and `project apply`, desktop `propose` and `apply`, or the inspector's document path, pointer, JSON value, Propose and Accept controls. The HTTP path is `/api/propose`, followed by `/api/accept` with the returned `reviewToken`.

## Driving it with verify

Preconditions: root build and doctor pass. Run from the repository root.

```bash
.bb/skills/verify-sceneaxi/verify test
.bb/skills/verify-sceneaxi/verify test tests/parity/shell-cli-parity.test.ts
```

The web binary suite starts an isolated server with `scene.json`. It proposes `/data/entities/0/x = 21`, observes `reviewing` and unchanged bytes, then accepts and reads `"x": 21` from disk. The parity suite asserts identical bytes and hashes across clients. Require all selected tests to pass. Use the skill's launch/inspect/screenshot sequence to inspect the actual page too.

## Gotchas

An empty manual inspector project has no document to edit. Do not fabricate a canonical document or hash; reuse the existing seeded test. Review tokens bind a decision to the shown proposal. CLI held-key refusals are not permission to mint an all-resolved registry. Fixture snapshots used by tests are not runtime authority.
