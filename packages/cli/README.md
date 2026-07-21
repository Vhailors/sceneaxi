# @sceneaxi/cli

Agent-native umbrella CLI for SceneAxi: a shared dispatcher that enforces a
deterministic exit-code map, a versioned protocol envelope, and strict `--json`
equivalence at every command nesting level.

Verb bodies beyond protocol introspection are **skeletons** (later tickets plug
real work in). Held-key currency enforcement is **sceneaxi#7** — this package
only reserves the `HELD_KEY` exit class so numbering stays stable.

**Boundaries:** imports only `@sceneaxi/schemas` (and may use
`@sceneaxi/authoring-core` later). Direct engine imports are denied by
`docs/dependency-matrix.json`.

## Invocation

```bash
# Programmatic (tests and embedders)
import { runCli, main } from "@sceneaxi/cli";
const { exitCode, envelope, stdout } = runCli(["protocol", "inspect", "--json"]);
```

Command-first shape: `sceneaxi <group> <verb> [flags]`.

| Group | Verbs (skeleton unless noted) |
|---|---|
| `project` | `new`, `dev`, `test`, `capture`, `report` (E1 surface) |
| `asset` | `list` |
| `profile` | `list` |
| `catalog` | `list` |
| `evidence` | `list` |
| `protocol` | `version`, `inspect` (real introspection) |

Global flags: `--json`, `--help` / `-h`, `--version` / `-v` / `-V`.

Unknown flags and unknown/incomplete paths **refuse** (fail-closed). There is
no best-effort mutation path.

## Exit-code map (normative)

| Code | Name | When |
|---:|---|---|
| 0 | `OK` | Command completed successfully |
| 1 | `ERROR` | Operational / internal failure (`NOT_IMPLEMENTED`, `INTERNAL`) |
| 2 | `USAGE` | Unknown command path at **any** depth, unknown flag, ambiguous/incomplete input |
| 3 | `HELD_KEY` | Open captain hold (reserved for sceneaxi#7) |

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

Failures use `ok: false` and `error: { code, message, path, heldKey? }` instead
of `result`. `help[]` is required on every result.

- Default stdout: axi-style typed/counted text (`help[n]:`, nested keys).
- `--json`: the same envelope as JSON (strict equivalence).

JSON Schema: `packages/schemas/contracts/cli-protocol-envelope.schema.json`
(contract id `cli-protocol-envelope/v1`). Envelope shape changes are
**semver events** for the `cli-protocol` release group.

## Testing

Golden / protocol tests live under `packages/cli/test/`:

- `exit-codes.golden.test.ts` — map + non-zero unknown paths at every depth
- `envelope.snapshot.test.ts` — versioned snapshots + `help[]` on every result
- `json-equivalence.test.ts` — strict `--json` same-data guarantee
- `refusal.test.ts` — unknown flags / ambiguous input fail-closed

```bash
pnpm test -- packages/cli
pnpm gate
```
