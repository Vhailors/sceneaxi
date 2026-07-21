# @sceneaxi/cli

Agent-native umbrella CLI for SceneAxi: a shared dispatcher that enforces a
deterministic exit-code map, a versioned protocol envelope, and strict `--json`
equivalence at every command nesting level.

Verb bodies beyond protocol introspection are **skeletons** (later tickets plug
real work in). Held-key currency enforcement (sceneaxi#7) is implemented in
`src/held-keys/` and wired into the dispatcher for every verb; see
[Held-key enforcement](#held-key-enforcement-sceneaxi7) below.

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
| `demo` | `gated` (held-key protocol demo; gated by synthetic keys, fails closed) |
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
`error: { code, message, path, heldKey?, heldKeyReason? }` instead of `result`.
`help[]` is required on every result.

- Default stdout: axi-style typed/counted text (`help[n]:`, nested keys).
- `--json`: the same envelope as JSON (strict equivalence).

JSON Schema: `packages/schemas/contracts/cli-protocol-envelope.schema.json`
(contract id `cli-protocol-envelope/v1`). Envelope shape changes are
**semver events** for the `cli-protocol` release group.

## Held-key enforcement (sceneaxi#7)

`src/held-keys/` implements the runtime protocol of
`docs/held-key-enforcement.md` (normative) against the seeded contracts
`held-key-registry.schema.json` and `cli-command-map.schema.json`:

- **`registry.ts`** — typed contract mirrors + fail-closed validation.
  `sourceDigest` is *verified* (sha256 of the canonicalized key set), not just
  format-checked.
- **`generate.ts`** — `generateRegistrySnapshot()`: FirstMate
  structured-backlog export → schema-valid snapshot. Refuses raw text,
  Markdown-looking sources, malformed hold identities, and non-monotonic
  epochs. The factories-helpers #42 Markdown registry stays the human-facing
  registry source of truth; it is **never** a runtime input.
- **`shipped.ts`** — the command map shipped with this build. Every verb in
  the tree is declared (coverage-tested); `heldKeys: []` is an explicit
  ungated declaration. Only `demo gated` is gated, by **synthetic** keys.
- **`gate.ts`** — `evaluateHeldKeyGate()`: for every gated verb the live
  authoritative epoch is established **before** local checks (trusted epoch
  sentinel; test doubles in fixtures). No offline exception, no
  signed-offline-marker path, no env flag can reopen an allow path.

Refusals exit `3` with `error.code: "HELD_KEY"`, a machine-readable
`error.heldKeyReason` naming the refusal-table row, and — for open/unknown
keys — `error.heldKey` naming the key. The full refusal table, the
fresh-N/N-vs-authoritative-N+1 regression, and the offline regression are
fixture-tested (`test/held-keys.*.test.ts`, `test/fixtures/held-keys/`).

The default runtime ships **no snapshot and no sentinel**, so `demo gated`
refuses out of the box (`currency-unavailable`) — fail-closed until real
wiring is authorized. Any claim of fail-closed held-key enforcement is valid
only under this protocol.

## Testing

Golden / protocol tests live under `packages/cli/test/`:

- `exit-codes.golden.test.ts` — map + non-zero unknown paths at every depth
- `envelope.snapshot.test.ts` — versioned snapshots + `help[]` on every result
- `json-equivalence.test.ts` — strict `--json` same-data guarantee
- `refusal.test.ts` — unknown flags / ambiguous input fail-closed
- `held-keys.generator.test.ts` — snapshot generator + digest verification
- `held-keys.command-map.test.ts` — shipped-map coverage + map validation
- `held-keys.refusal-table.test.ts` — every refusal-table row, fixture-driven
- `held-keys.regressions.test.ts` — N/N vs N+1, offline, env-flag hardening

```bash
pnpm test -- packages/cli
pnpm gate
```
