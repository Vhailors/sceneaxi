# Deterministic rarity engine

Issue [sceneaxi#240](https://github.com/Vhailors/sceneaxi/issues/240) owns the
v1 domain and kernel contract. Shared shapes and validation live in
`packages/schemas/src/rarity.ts`; the public JSON Schema is
`packages/schemas/contracts/rarity.schema.json`; authoritative resolution is
the pure `resolveRarityRoll()` in `packages/engine-kernel/src/rarity.ts`.

## Stable domain

The tier identifiers and cumulative-selection order are fixed:

1. `common`
2. `uncommon`
3. `rare`
4. `epic`
5. `legendary`

Policy and candidate weights are non-negative safe integers. Validation refuses
fractional, negative, non-finite, unsafe, overflowing, empty, and zero-total
inputs. Every positive-weight tier must have a positive candidate pool. A zero
weight is valid but can never own a selected interval.

The canonical project namespace is `ProductManifest.rarity`; it contains one
versioned policy and the accepted request/outcome/provenance records. This is an
extension of the existing product manifest, snapshot, and save artifact, not a
second project model.

## Resolution bytes

The algorithm id is `sceneaxi.rarity.weighted-sha256-v1`. Every hash input is
canonical compact JSON using the repository's sorted-key UTF-8 convention; every
recorded digest is `sha256:<64 lowercase hex>`. The entire 256-bit digest is
reduced modulo the validated safe-integer total, so the draw always lies inside
`[0, total)` without narrowing to a platform-sized integer first.

One resolution performs two domain-separated draws:

- `phase: "tier"` binds the algorithm id, project seed, product scope, event id,
  policy digest, and request digest, then selects the first tier whose cumulative
  interval contains the draw.
- `phase: "candidate"` binds the same facts plus the selected tier and tier-roll
  digest, then selects the first candidate in request order whose cumulative
  interval contains the second draw.

The existing product manifest owns `projectSeed`; the product id is the scope;
the `rarity-roll` kernel command owns an explicit stable `eventId`. The request
shape contains candidates only. Exact validation refuses provider-authored seed,
draw, outcome, provenance, or provider-response fields, so provider data can
propose weights and candidates but cannot supply entropy or an authoritative
result.

Scopes, event ids, and candidate ids all answer to the single exported
`isRarityIdentifier()` predicate, and the forbidden input keys are the single
exported `RARITY_FORBIDDEN_INPUT_KEYS` list. Every boundary reads those rather
than restating them, because a boundary that accepts what the resolver refuses
would queue an unresolvable command. A manifest that owns a rarity namespace is
therefore refused at `open()` when its `productId` cannot be the resolution
scope — never later, inside `advance()`.

## Kernel authority and replay

`dispatch({ type: "rarity-roll", eventId, request })` validates and records a
pending command without changing the snapshot. The existing `advance()` path
resolves it and appends the accepted roll record. Presentation, providers, and
the orchestrator do not resolve or mutate rarity; the orchestrator returns the
kernel session unchanged.

The same event id plus the same canonical request digest is idempotent before or
after resolution. Reusing an event id with changed request bytes refuses with
`RARITY_EVENT_INPUT_CONFLICT`; a reroll needs a new event id.

## The policy is immutable once a project has rolled

Because every roll is verified by recomputation and the policy is one of the
recomputation's inputs, a project's `tierWeights` are **immutable from its first
accepted roll onward**. This is a deliberate consequence of exact historical
replay, not an oversight: editing a weight would silently rewrite the outcome
every stored roll already committed to. `open()` and `replay()` therefore refuse
a namespace whose policy no longer matches its rolls' `policyDigest`, by the
dedicated `RARITY_POLICY_CHANGED` code rather than a tamper-named one, so an
operator reads the real cause.

There is deliberately no historical-policy versioning, grandfathering, or
migration machinery. A project that wants different weights takes a new policy
and new event ids; the old rolls keep replaying exactly under the policy that
produced them.

Snapshots digest the complete rarity namespace. `save()` persists the current
namespace back into `productManifest.rarity` and retains the dispatch/advance
event stream. `replay()` removes event-produced terminal records from its
starting state, re-runs the recorded advances, and requires the recomputed
outcome, provenance, namespace, and terminal digest to match exactly. Schema
major mismatch, altered request, outcome, provenance, or terminal digest refuses.
Idempotence is a live-dispatch rule, not a replay one: a session never records a
repeated dispatch, so a saved event stream that carries one rarity event id twice
is a crafted artifact and refuses with `RARITY_EVENT_DUPLICATE` rather than
replaying to a shorter event log than it was handed.

## Evidence and exclusions

`packages/schemas/contracts/rarity.fixtures.json` pins the policy, seed, scope,
ten event vectors, both candidate interval endpoints, all five tier intervals,
and every outcome/provenance digest. Schema, resolver, browser-open, kernel
save/replay, and orchestrator tests execute those public contracts without a
network or live provider.

`rarity.schema.json` is enforced rather than described: every accepted value the
repository produces is validated as a document of the shipped schema, and an
unevaluated schema keyword fails the suite instead of being skipped. A field
added to the runtime contract without the same field in the schema is therefore
caught by the `additionalProperties: false` branch it would violate.

This contract adds no rarity economy, inventory, marketplace, renderer, provider
adapter, live network path, Hosted enablement, or Kids path. It does not rewrite
Sculpt Artifacts.
