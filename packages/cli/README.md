# @sceneaxi/cli

Agent-native umbrella CLI for SceneAxi: a shared dispatcher that enforces a
deterministic exit-code map, a versioned protocol envelope, and strict `--json`
equivalence at every command nesting level.

Every verb has a real body. Held-key currency enforcement (sceneaxi#7) is
implemented in `src/held-keys/` and wired into the dispatcher for every verb;
see [Held-key enforcement](#held-key-enforcement-sceneaxi7) below.

**Boundaries:** imports only `@sceneaxi/schemas`, `@sceneaxi/authoring-core`, and
the one `@sceneaxi/importers` authority used by offline asset ingestion.
Direct engine imports are denied by `docs/dependency-matrix.json`. That is why
there are no kernel-session, presentation, or plugin verbs here — those paths
are proven end to end in `tests/e2e/`, which may import any package.

**Cost:** free and BYO-AI. No verb reads a provider credential or spends
anything. The `desktop bridge` verbs may open the documented same-user Unix
socket; local and BYOK tool rows carry `creditRoute: none`. Hosted AI (which
does cost credits) remains behind the existing web-shell billing seam.

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

# The one exception: `desktop bridge status|call` spawn the local socket worker.
# Pass `runCli(argv, { desktopBridge })` to inject that transport instead.
```

## Commands

Command-first shape: `pnpm sceneaxi <group> <verb> [flags]`.

| Group | Verbs |
|---|---|
| `project` | `new`, `dev`, `test`, `capture`, `report`, `propose`, `apply` |
| `scene` | `compose` (deterministic multi-object composition) |
| `asset` | `list`, `import` (contained GLB/glTF copy via E1) |
| `profile` | `list`, `open-path` |
| `catalog` | `list` |
| `evidence` | `list` |
| `desktop bridge` | `status`, `tools`, `call` |
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

A contained offline asset import uses the same proposal/apply review boundary:

```bash
pnpm sceneaxi asset import --source /path/to/model.glb --document scene.json --cwd /path/to/project --out asset-import.json
pnpm sceneaxi project apply --proposal asset-import.json --cwd /path/to/project
```

The accepted profile and absence boundaries are in
[`docs/asset-ingestion.md`](../../docs/asset-ingestion.md).
`project apply` then attempts project-copy materialization for every applied
document and reports each result under `assetCopies`; accepted manifest bytes are
the recovery authority if a copy is absent later.

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

Calling the running Engine Desktop through the versioned local bridge:

```bash
pnpm sceneaxi desktop bridge status --json
pnpm sceneaxi desktop bridge tools --json
pnpm sceneaxi desktop bridge call \
  --tool sceneaxi.project.status \
  --allow project:read \
  --input-json '{"documentPath":"scene.json"}' \
  --json
```

`--allow` must exactly match the permission printed beside the tool; the CLI
refuses before connecting otherwise. Protocol, secure discovery, BYOK storage,
examples, and the free-vs-hosted boundary are owned by
[`docs/desktop-local-bridge.md`](../../docs/desktop-local-bridge.md).

Reporting the shared open-path demo policy, and evaluating one demo against it:

```bash
pnpm sceneaxi profile open-path
pnpm sceneaxi profile open-path --profile @sceneaxi/profile-game --operation replay
```

The payload is the *same value* `sceneaxi-desktop open-path` and the web shell's
`createOpenPathView()` report, so the surfaces stay in parity by construction
([`docs/open-path-policy.md`](../../docs/open-path-policy.md)). The verb reports
policy; it does not open a kernel session, which the dependency matrix would not
allow it to do. Demo levels are demonstrations — never a shipping or
production-readiness claim — and `@sceneaxi/profile-kids` refuses.

### Current refusals

These paths fail closed in runnable-surfaces v1:

- `project new` refuses to overwrite an existing document without `--force`.
- `project dev --watch` refuses because the normative E1 hot-reload loop is not
  implemented; `project dev` is currently one-shot. The target remains owned by
  [`docs/authoring-contracts.md`](../../docs/authoring-contracts.md).
- `catalog list` reports commerce activation and `metadataComplete`; the latter
  means only that mandatory metadata exists, never that screening, curation, or
  human approval has made the item listing-ready.
- `scene compose` fails closed on the named refuse matrix
  (`docs/scene-composition.md`) rather than composing a partial scene.
- `profile open-path` refuses an unknown profile, an operation outside the closed
  Kernel seam, `--operation` without `--profile`, and every Kids demo — the Kids
  refusal is a non-zero exit, not an omitted row.

`project apply` journals before canonical commit. A successful apply whose
journal still needs finalization returns `journalRecoveryPending: true` plus a
`transactionId`; subsequent authoring entrypoints recover before proceeding.

The desktop bridge tool registry also exposes contained project Git status,
canonical diff, explicit-path stage, and commit preparation. CLI receives the
same repository state/evidence value as desktop-control and local-agent clients.
Commit preparation creates no commit; push, fetch, credentials, history rewrite,
branch deletion, and hook bypass are unsupported.

Global flags: `--json`, `--help` / `-h`, `--version` / `-v` / `-V`.

Unknown flags and unknown/incomplete paths **refuse** (fail-closed). There is
no best-effort mutation path.

## Exit-code map (normative)

| Code | Name | When |
|---:|---|---|
| 0 | `OK` | Command completed successfully |
| 1 | `ERROR` | Operational / internal failure (`NOT_IMPLEMENTED`, `INTERNAL`, `CONFLICT`, `NOT_FOUND`, `BRIDGE_UNAVAILABLE`, `BRIDGE_PROTOCOL`, `BRIDGE_REFUSED`) |
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
- `profile-open-path.test.ts` — `profile open-path` reporting, projection, and refusals
- `bin-smoke.test.ts` — the `sceneaxi` binary actually starts (spawned, not in-process)
- `desktop-bridge.test.ts` — local tool schemas, permission preflight, deterministic bridge errors
- `held-keys.generator.test.ts` — snapshot generator + digest verification
- `held-keys.command-map.test.ts` — shipped-map coverage + map validation
- `held-keys.refusal-table.test.ts` — every refusal-table row, fixture-driven
- `held-keys.regressions.test.ts` — N/N vs N+1, offline, env-flag hardening

```bash
pnpm test -- packages/cli
pnpm gate
```
