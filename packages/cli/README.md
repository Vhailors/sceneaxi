# @sceneaxi/cli

Agent-native umbrella CLI for SceneAxi: a shared dispatcher that enforces a
deterministic exit-code map, a versioned protocol envelope, and strict `--json`
equivalence at every command nesting level.

Every verb has a real body. Held-key currency enforcement (sceneaxi#7) is
implemented in `src/held-keys/` and wired into the dispatcher for every verb;
see [Held-key enforcement](#held-key-enforcement-sceneaxi7) below.

**Boundaries:** imports only `@sceneaxi/schemas` and `@sceneaxi/authoring-core`.
Direct engine imports are denied by `docs/dependency-matrix.json`. That is why
there are no kernel-session, presentation, or plugin verbs here — those paths
are proven end to end in `tests/e2e/`, which may import any package.

**Cost:** free and BYO-AI. No verb reads a credential, opens a socket, or spends
anything. Hosted AI (which does cost credits) is a shell concern, not a CLI one.

## How to run

The workspace keeps source-backed package exports, so the binary runs the
`tsc --build` output. Build once, then invoke it:

```bash
pnpm install
pnpm build

pnpm sceneaxi --help
```

From the repository root, keep using the verified root script:

```bash
pnpm sceneaxi --help
```

Re-run `pnpm build` after changing any package source. If the build output is
missing, the binary says so and exits `1` rather than failing obscurely.

```bash
# Programmatic (tests and embedders) — same dispatcher, no subprocess
import { runCli, main } from "@sceneaxi/cli";
const { exitCode, envelope, stdout } = runCli(["protocol", "inspect", "--json"]);
```

## Commands

Command-first shape: `pnpm sceneaxi <group> <verb> [flags]`.

| Group | Verbs |
|---|---|
| `project` | `new`, `dev`, `test`, `capture`, `report`, `propose`, `apply` |
| `scene` | `compose` (deterministic multi-object composition) |
| `asset` | `list` |
| `profile` | `list` |
| `catalog` | `list` |
| `evidence` | `list` |
| `demo` | `gated` (held-key protocol demo; gated by synthetic keys, fails closed) |
| `protocol` | `version`, `inspect` |

A full authoring round-trip:

```bash
pnpm sceneaxi project new --document scene.json --data '{"entities":[]}'
pnpm sceneaxi project propose --document scene.json --pointer /data/entities --value '[1,2]' --out edit.json
pnpm sceneaxi project apply --proposal edit.json
pnpm sceneaxi project test --document scene.json
pnpm sceneaxi project capture --document scene.json --out run.evidence.json
pnpm sceneaxi project report --evidence run.evidence.json
pnpm sceneaxi evidence list --dir .
```

Composing several Sculpt Artifacts into one openable scene (`--artifact` repeats):

```bash
pnpm sceneaxi scene compose \
  --intake workshop-bay.scene.json \
  --artifact crate.artifact.json \
  --artifact drone.artifact.json \
  --out-scene workshop-bay.composed.json \
  --out-document workshop-bay.document.json
```

Composition is offline and fixed — no provider, no network, no seed — so
identical inputs always yield identical bytes and the same `sceneDigest`.
Placement is a projection: a source Sculpt Artifact is never rewritten.

### Deliberate refusals

These are behaviour, not gaps:

- `project new` refuses to overwrite an existing document without `--force`.
- `project dev --watch` refuses. This CLI ships no hot-reload loop, and
  pretending otherwise would be a false runnable claim; `project dev` is
  one-shot.
- `catalog list` reports commerce activation and `metadataComplete`; the latter
  means only that mandatory metadata exists, never that screening, curation, or
  human approval has made the item listing-ready.
- `scene compose` fails closed on the named refuse matrix
  (`docs/scene-composition.md`) rather than composing a partial scene.

`project apply` journals before canonical commit. A successful apply whose
journal still needs finalization returns `journalRecoveryPending: true` plus a
`transactionId`; subsequent authoring entrypoints recover before proceeding.

Global flags: `--json`, `--help` / `-h`, `--version` / `-v` / `-V`.

Unknown flags and unknown/incomplete paths **refuse** (fail-closed). There is
no best-effort mutation path.

## Exit-code map (normative)

| Code | Name | When |
|---:|---|---|
| 0 | `OK` | Command completed successfully |
| 1 | `ERROR` | Operational / internal failure (`NOT_IMPLEMENTED`, `INTERNAL`, `CONFLICT`, `NOT_FOUND`) |
| 2 | `USAGE` | Unknown command path at **any** depth, unknown flag, ambiguous/incomplete input, `VALIDATION` |
| 3 | `HELD_KEY` | Held-key refusal: open captain hold or any failed currency/snapshot check (sceneaxi#7) |

**Anti-pattern:** gh-axi historically exited `0` on some unknown
sub-subcommands. SceneAxi must never: unknown paths at every nesting level exit
`2` (`USAGE` / `UNKNOWN_COMMAND`). Golden tests lock this.

Typed failure classes in the envelope (`error.code`) map 1:1 onto the table
above via `FAILURE_EXIT_CODE` / `exitCodeForFailure()`.

## Protocol envelope

Every result (success or failure) is a versioned envelope:

```json
{
  "schemaVersion": 1,
  "cliVersion": "0.0.0",
  "ok": true,
  "result": { "...": "..." },
  "help": ["next-action hint", "..."]
}
```

Failures use `ok: false` and
`error: { code, message, path, heldKey?, heldKeyReason?, diagnostics? }`
instead of `result`. `help[]` is required on every result.

- Default stdout: axi-style typed/counted text (`help[n]:`, nested keys).
- `--json`: the same envelope as JSON (strict equivalence).

JSON Schema: `packages/schemas/contracts/cli-protocol-envelope.schema.json`
(contract id `cli-protocol-envelope/v1`). Envelope shape changes are
**semver events** for the `cli-protocol` release group.

## Held-key enforcement (sceneaxi#7)

The normative runtime protocol, implementation status, refusal table, and
mandatory regressions are owned by
[`docs/held-key-enforcement.md`](../../docs/held-key-enforcement.md). The local
implementation is `src/held-keys/`; its fixture coverage is listed below.

## Testing

CLI protocol tests live under `packages/cli/test/`:

- `exit-codes.golden.test.ts` — map + non-zero unknown paths at every depth
- `envelope.snapshot.test.ts` — versioned snapshots + `help[]` on every result
- `json-equivalence.test.ts` — strict `--json` same-data guarantee
- `refusal.test.ts` — unknown flags / ambiguous input fail-closed
- `project-propose-apply.test.ts` — E1 propose/apply protocol adapters
- `project-lifecycle.test.ts` — `new`/`dev`/`test`/`capture`/`report`, determinism
- `scene-compose.test.ts` — multi-object composition + named refusals
- `registry-verbs.test.ts` — profile/catalog/asset/evidence listings, commerce inert
- `bin-smoke.test.ts` — the `sceneaxi` binary actually starts (spawned, not in-process)
- `held-keys.generator.test.ts` — snapshot generator + digest verification
- `held-keys.command-map.test.ts` — shipped-map coverage + map validation
- `held-keys.refusal-table.test.ts` — every refusal-table row, fixture-driven
- `held-keys.regressions.test.ts` — N/N vs N+1, offline, env-flag hardening

```bash
pnpm test -- packages/cli
pnpm gate
```
