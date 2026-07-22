# Held-key enforcement protocol (SceneAxi CLI)

**Status:** normative for any CLI that claims fail-closed captain-hold refusal.  
Markdown decision registries (factories-helpers #42) document keys for humans; they are **not** the runtime protocol.

## Artifacts

1. **Held-key registry snapshot** (`held-key-registry.schema.json`)  
   - `schemaVersion`, monotonic `registryEpoch`, `generatedAt`, `source` (FirstMate backlog export), `sourceDigest` (sha256 of the key set), `keys[]` with `open|resolved`.
2. **CLI command map** (`cli-command-map.schema.json`)  
   - Per-verb `heldKeys`, `builtForRegistryEpoch`, optional `composedOf` (union of gating keys).  
   - Undeclared verb = refuse. Explicit empty `heldKeys` = ungated.

## Generation path

1. Export from **authoritative** FirstMate structured captain holds (tasks-axi), not Markdown.
2. Require every export timestamp (`exportedAt`, `registeredAt`, and any
   `resolvedAt`) to satisfy the registry schema's RFC 3339 `date-time` format,
   including an explicit timezone. Timezone-less or invalid values refuse; the
   generator never emits a snapshot from them.
3. Bump `registryEpoch` on any add/resolve of a hold key.
4. Publish snapshot + regenerate command map for the same epoch.
5. Ship both with the CLI (or fetch from a trusted channel).

## Currency check (required for every held-key-gated invocation)

Before evaluating local snapshot/map rules, a gated verb must establish the **current authoritative epoch** by querying a trusted epoch sentinel / export endpoint for `currentRegistryEpoch`.

| Condition | Behavior |
|---|---|
| Authoritative epoch available and equals local map/snapshot epoch | proceed to local snapshot/map checks |
| Authoritative epoch available and differs from local | **refuse** (stale client) |
| Authoritative epoch **unavailable** (offline, network error, timeout) | **refuse** for every held-key-gated verb |

**There is no offline exception for gated verbs.** Matching local snapshot epoch N with local map epoch N is **never** sufficient. A signed offline marker path is **not** permitted for gated verbs: a fresh signed N marker can still lag an authoritative N+1 after a new hold is registered, which would re-open the stale-snapshot fail-open.

Ungated verbs (`heldKeys: []` explicit) skip the currency check and must not
probe the epoch authority. They must not encode product policy.

### Fresh-N/N vs authoritative-N+1 regression (must fail closed)

1. Client has snapshot N + map N, generated 1 hour ago.  
2. Authoritative holds register a new key → epoch becomes N+1.  
3. Client has not refreshed.  
4. Gated command **must refuse** (currency mismatch).  

### Offline regression (must fail closed)

1. Client has snapshot N + map N and cannot reach the authoritative endpoint.  
2. Gated command **must refuse** (currency unavailable).  
3. Explicit env flags must not reopen an offline allow path for gated verbs.

## Refusal table

| Condition | Behavior |
|---|---|
| Currency check unavailable | refuse (gated verbs) |
| Authoritative epoch ≠ local map/snapshot epoch | refuse |
| Snapshot missing | refuse |
| Snapshot schema-invalid | refuse |
| Snapshot older than freshness budget (default 24h) **in addition to currency OK** | refuse |
| Map epoch ≠ snapshot epoch | refuse |
| Verb undeclared in command map | refuse |
| Verb gated by open key | refuse, name the key |
| Verb gated by unknown key | refuse |
| All gating keys resolved and currency OK | allow |

## Non-guarantee language forbidden

Any claim that “a new hold can never be silently ignored” is only valid under this protocol. Designs that allow offline gated verbs with a lagged signed marker must **not** claim fail-closed held-key enforcement.

## Implementation status

The CLI runtime implementation lives in `packages/cli/src/held-keys/` and is
wired into the dispatcher for every verb. The shipped command map explicitly
declares every verb; only `demo gated` uses synthetic held keys. The default
runtime has no snapshot or epoch sentinel, so that demo refuses with
`currency-unavailable` until real authority wiring is separately authorized.
The refusal table and both mandatory regressions above are fixture-tested under
`packages/cli/test/held-keys.*.test.ts`.
