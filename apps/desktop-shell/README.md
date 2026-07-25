# @sceneaxi/desktop-shell

A **startable** desktop authoring surface over the *same* `@sceneaxi/authoring-core`
propose/apply protocol layer as `@sceneaxi/web-shell` and `@sceneaxi/cli`. No
forked behavior, no CLI binary spawn (matrix-denied), no engine imports.

## How to run

The workspace keeps source-backed package exports, so the shell runs the
`tsc --build` output. Build once, then invoke it:

```bash
pnpm install
pnpm build

pnpm sceneaxi-desktop --help
```

From the repository root, keep using the verified root script:

```bash
pnpm sceneaxi-desktop --help
```

If the build output is missing, the shell says so and exits `1` rather than
failing obscurely.

## Commands

| Command | Effect |
|---|---|
| `status --document <path>` | Report the document's id, content hash, and top-level `data` keys |
| `propose --document <path> --pointer <ptr> --value <json>` | Render the diff for review — **writes nothing** |
| `apply --document <path> --pointer <ptr> --value <json>` | Propose and accept in one non-interactive step |
| `undo` | Revert the last completed apply |

`--cwd <dir>` sets the working directory; `--json` emits the machine envelope
with exactly the same data as the text rendering.

Exit codes use the CLI protocol's compatible subset so scripts branch
identically for shared outcomes: `0` success, `1` operational refusal (typed
diagnostics), `2` usage. The desktop shell has no held-key-gated verb, so it
does not emit the CLI's `3` (`HELD_KEY`).

```bash
pnpm sceneaxi-desktop status --document scene.json
pnpm sceneaxi-desktop propose --document scene.json --pointer /data/entities/0 --value 7
pnpm sceneaxi-desktop apply --document scene.json --pointer /data/entities/0 --value 7
pnpm sceneaxi-desktop undo
```

## Session API

The command layer is a thin shell over a session any embedder can drive:

```ts
import { createDesktopSession } from "@sceneaxi/desktop-shell";

const session = createDesktopSession({ cwd: projectRoot });
const review = session.proposeEdit({
  documentPath: "scene.json",
  jsonPointer: "/data/entities/0/x",
  newValue: 42,
});
// review.renderedDiff is what the human sees before accepting
const accepted = session.accept();
if (accepted.journalRecoveryPending) session.refreshRecovery();
```

Phases (`idle`, `reviewing`, `applied`, `pending`, `rejected`) mirror the
web-shell inspector exactly, so the two surfaces stay interchangeable faces of
one protocol rather than two editors.

A round-trip can report pending or indeterminate journal recovery with a
`transactionId`. While recovery is pending the session refuses new propose,
accept, and reject actions; call `refreshRecovery()` until the transaction
reaches a terminal state. The non-interactive one-shot helper
`shellProposeAndApply()` remains available for agent parity.

## What this is not

Deliberately absent, not missing: native packaging (electron/tauri), an
installer, an offline store, hosting, authentication, and a design system. The
shell stays protocol-thin — `docs/dependency-matrix.json` allows it only
`@sceneaxi/schemas` and `@sceneaxi/authoring-core`.

## Parity

Parity with the CLI and web-shell is a conformance test, not a habit:
`tests/parity/shell-cli-parity.test.ts` drives the same fixture operations
through all three surfaces and asserts byte-identical documents and content
hashes — including through the runnable `sceneaxi-desktop apply` path (this is
what issue #58 pinned for the library wrapper, now extended to the startable
surface). `test/bin-smoke.test.ts` spawns the real binary so a broken
entrypoint fails here rather than shipping as a "startable" claim.
