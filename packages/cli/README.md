# @sceneaxi/cli

Agent-native umbrella CLI for SceneAxi: a shared dispatcher that enforces a
deterministic exit-code map, a versioned protocol envelope, and strict `--json`
equivalence at every command nesting level.

Protocol introspection and E1 `project propose` / `project apply` are live;
other verb bodies remain skeletons. Held-key currency enforcement is
**sceneaxi#7** — this package reserves the `HELD_KEY` exit class so numbering
stays stable.

**Boundaries:** imports only `@sceneaxi/schemas` and `@sceneaxi/authoring-core`.
Direct engine imports are denied by `docs/dependency-matrix.json`.

## Invocation

```bash
# Programmatic (tests and embedders)
import { runCli, main } from "@sceneaxi/cli";
const { exitCode, envelope, stdout } = runCli(["protocol", "inspect", "--json"]);
```

Command-first shape: `sceneaxi <group> <verb> [flags]`.

| Group | Verbs (skeleton unless noted) |
|---|---|
| `project` | `new`, `dev`, `test`, `capture`, `report` (skeleton); **`propose`**, **`apply`** (E1 live) |
| `asset` | `list` |
| `profile` | `list` |
| `catalog` | `list` |
| `evidence` | `list` |
| `protocol` | `version`, `inspect` (real introspection) |

```bash
sceneaxi project propose --document scene.json --pointer /data/x --value 1 --out edit.json
sceneaxi project apply --proposal edit.json
```

Global flags: `--json`, `--help` / `-h`, `--version` / `-v` / `-V`.

Unknown flags and unknown/incomplete paths **refuse** (fail-closed). There is
no best-effort mutation path.

## Exit-code map (normative)

| Code | Name | When |
|---:|---|---|
| 0 | `OK` | Command completed successfully |
| 1 | `ERROR` | Operational / internal failure (`NOT_IMPLEMENTED`, `INTERNAL`, `CONFLICT`, `NOT_FOUND`) |
| 2 | `USAGE` | Unknown command path at **any** depth, unknown flag, ambiguous/incomplete input, `VALIDATION` |
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
