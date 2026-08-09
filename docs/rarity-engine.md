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

One request carries at most `RARITY_MAX_CANDIDATES` (64) candidates. The bound is
part of the shipped contract, not a caller convention: a longer candidate array
refuses with `RARITY_INPUT_BOUND_EXCEEDED` at the same validation seam every
provider, authoring, kernel, and replay path already reads, so caller-supplied
input cannot grow the work one resolution performs.

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

The existing product manifest owns the integer `seed`, which the kernel supplies
as the resolver context's `projectSeed`; its `productId` is the scope; the
`rarity-roll` kernel command owns an explicit stable `eventId`. The request
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

`dispatch({ type: "rarity-roll", eventId, request, providerEvidence? })` validates
and records a pending command without changing the snapshot. Evidence is required
exactly when the opened namespace carries it, and must be byte-identical. The
existing `advance()` path resolves the command and appends the accepted roll
record. Presentation, providers, and the orchestrator do not resolve or mutate
rarity; the orchestrator returns the kernel session unchanged.

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

## Provider-to-desktop acceptance

Issue [sceneaxi#241](https://github.com/Vhailors/sceneaxi/issues/241) extends the
existing Model Provider Port and desktop assistant path; it does not introduce a
second authoring operation. The privileged fixture provider returns only a typed,
bounded policy and candidate request plus the port's exact
model/provider/quantization/version evidence. Authoring-core validates that input,
asks a kernel product session to dispatch and advance the roll, and stages the
result as the ordinary E1 `/data` proposal in `DesktopSession`.

The proposal holds the accepted policy, request, outcome, provenance, and safe
provider-call evidence under the Scene Document's `data.rarity` namespace. Change
Review renders the real canonical diff and the same safe evidence summary shown by
Assistant and the dedicated Evidence dock. Accept uses the existing atomic apply;
Reject writes nothing. A changed content hash stays the existing actionable
`content-hash-conflict` recovery path.

After reopen, the desktop `open-path` action gives that namespace to
`bootstrapOpenPath({ kind: "product" })`, dispatches the identical event, advances
through the kernel's authoritative mutation path, saves, resumes, and verifies the
terminal replay digest. That product session carries the manifest's rarity
namespace and no entities, so it is **additional** to the composed scene session
the viewport draws, never a replacement for it: the exercise reports the scene's
`initialDigest`/`tickDigests` as always and puts the rarity session's own
bootstrap, ticks, and replay digest in a separate `raritySession` record. Run and
the viewport print them as two sessions, because one sentence claiming both would
attribute the scene's advance to digests it never produced. Run and the viewport
receive only the resulting tier, candidate, safe draw/digest fields, and provider
descriptor. Raw prompts, provider responses, credentials, and provider-authored
failure detail do not cross the privileged boundary.

Exact replay of the accepted request/event pair is idempotent, and the surfaces
say so: a replay stages nothing, so the result carries `replayed: true` and **no**
authoring snapshot, the Assistant and product status report unchanged project
bytes, Change Review stays empty, and only the Evidence dock updates. A changed
request under that event refuses `RARITY_EVENT_INPUT_CONFLICT`; an intentional
reroll must use a new event id. Kids and Hosted refuse before the fixture provider
runs.

`providerEvidence` is bound to each roll. Extending an existing namespace from a
call whose model evidence differs would leave earlier rolls reporting a descriptor
that is not theirs, so `stageRarityProviderProposal` refuses
`RARITY_AUTHORING_PROVIDER_EVIDENCE_CONFLICT` instead. A namespace that already
holds an evidence-less roll refuses
`RARITY_AUTHORING_PROVIDER_EVIDENCE_ABSENT` rather than adopting this call's — the
rolls a kernel-only #240 path produced legitimately have none, and borrowing a
descriptor for them would invent provenance as surely as keeping a stale one.
Both refusals are decided once, where the stored namespace is read, so the replay
and extend paths cannot diverge. Between them, the descriptor
`safeRarityEvidenceFromNamespace()` reports for a roll is always the descriptor of
the call that produced that roll's input. The kernel additionally compares that
roll-bound descriptor with its digest in the roll provenance and with the matching
`rarity-roll` dispatch event. Open/save/replay therefore refuse a missing,
retroactively added, or conflicting binding instead of attributing a later request
to an earlier provider call.

All four required surfaces render that evidence through one function,
`formatSafeRarityEvidence()` on the import-free
`@sceneaxi/authoring-core/rarity-evidence` entry. It closes over no module
binding, so the Engine Desktop chrome embeds the exact function in its emitted
script the way the web staging decision already does, and the packaged renderer
imports the same one — matching provenance is then an identity rather than two
texts kept in step by review. Run/viewport is included: the Run panel's
`[data-run-rarity-evidence]` region and the viewport's own evidence overlay both
print that function's output, not a tier/candidate summary of it. The formatter's
optional second input owns the product-session attribution too, because the
digests on the report line beside them belong to the composed scene session while
the namespace is verified in its own product session.

## Evidence and exclusions

`packages/schemas/contracts/rarity.fixtures.json` pins the policy, seed, scope,
ten event vectors, both candidate interval endpoints, all five tier intervals,
and every outcome/provenance digest.
`tests/e2e/rarity-engine-golden.test.ts` (in `pnpm test:golden`) drives both
boundary vectors through the orchestrator's public open/advance/save/resume
seams against those pinned digests. Schema, resolver, browser-open, kernel
save/replay, and orchestrator tests execute the same public contracts without a
network or live provider.

`tests/e2e/fixtures/rarity-provider/wayfinder-desktop.json` pins the integration
vector used by `tests/e2e/rarity-provider-desktop-golden.test.ts`: fixture model,
policy, candidate request, project seed, event, selected result, draws, and every
policy/request/outcome/provenance/namespace digest. The test compares runtime
output to those bytes before it exercises review, accept/reject, reopen, replay,
presentation, and the refusal matrix.

`rarity.schema.json` is enforced rather than described: every accepted value the
repository produces is validated as a document of the shipped schema, and an
unevaluated schema keyword fails the suite instead of being skipped. A field
added to the runtime contract without the same field in the schema is therefore
caught by the `additionalProperties: false` branch it would violate.

## Integration acceptance evidence — 2026-08-09

The implementation landed as `3874b409fabbb058e415723eba2d26daa6e6e460` and was
then corrected in review, so that commit is **not** the head this contract
describes. The corrections are `a026e64` (named replay refusal, shared
forbidden-key list), `71d0058` (provider-detail redaction, one document reader),
`4dc8f30` (provider evidence carried through kernel replay), `8d424a1` (replay
reported as a replay, the rarity product session reported beside the scene session
rather than in place of it, Evidence retained on an unrelated reject, one shared
evidence formatter, per-namespace evidence conflict refusal), `27c1ccf` (that
formatter moved to a browser-safe entry so the renderer bundles again, plus the
gate check that catches the class), `fd7aae9` (Run and viewport render the full
shared provenance, evidence cleared on a project-root change, the operator's
request carried to the provider), `9b45aca` (the shipped binaries' resolver taught
to map workspace subpaths, provenance retired on Undo and preserved through Remove
Recent, the overlay's line breaks preserved), `96ddee0` (Undo and the recovery
restart stopped clearing the dock on the action and now re-read the reopened
document, clearing only when `data.rarity` is gone), `85b8f75` (the stored-namespace
evidence invariant moved to one authoring boundary, so rolls with no descriptor
refuse instead of adopting a later call's), and `fac19c4` (assistant poll timeout
reporting now claims Retry is safe only after abandonment succeeds), followed by
`974b2af` (single-proposal atomicity, kernel replay and per-roll evidence checks,
evidence reconciliation through recovery, shared formatter and mode ownership,
and executable refusal coverage). None of `85b8f75`, `fac19c4`, or `974b2af` is
covered by the historical smoke observation below.

The current executable desktop vector is
`tests/e2e/fixtures/rarity-provider/wayfinder-desktop.json`:

- scope `desktop-linux-rarity`, seed `20260809`, event
  `wayfinder-drop-001`;
- fixture descriptor `sceneaxi-fixture` /
  `wayfinder-rarity-fixture` / `deterministic-json` / `2026-08-09`;
- selected result `uncommon` / `wayfinder-copper`;
- policy digest
  `sha256:dc9fb14cf67da2aaaabf813969d5e2863b3d4ccdcbbe8cbbd366a1400aab7099`;
- request digest
  `sha256:e70812f13e9a23e08476afce6fd6e8690a3d74e41f1807c977d0d7b7482067d8`;
- outcome digest
  `sha256:ec77ae2c1f62725339fbf87a0e39d61cfd680941fb975a045770cb31f0d0d5de`;
- provider-evidence digest
  `sha256:309285987a87148e1fb20a03ae9984e4bdecec9c7936b3e0f142d42f3592e7af`;
- provenance digest
  `sha256:a710a29af3c8fa4a7a5bf68c74c9dcd47d463ba10c2f13426f81657e99f9809a`;
- namespace digest
  `sha256:caa07bc955f0001a766741d4714333fa0c955fdf43095919c7dc4b2cff57c868`.

Observed commands:

```text
pnpm exec vitest run tests/e2e/rarity-provider-desktop-golden.test.ts packages/schemas/test/rarity.test.ts packages/engine-kernel/test/rarity.test.ts packages/engine-orchestrator/test/open-path.test.ts tests/e2e/rarity-engine-golden.test.ts tests/e2e/desktop-linux-bridge-golden.test.ts tests/e2e/desktop-provider-host-golden.test.ts apps/desktop-shell/test/chrome.test.ts
pnpm test:golden
pnpm --dir desktop/linux typecheck
pnpm --dir desktop/linux build
xvfb-run -a pnpm --dir desktop/linux smoke
pnpm gate
```

Those counts belong to `3874b409fabbb058e415723eba2d26daa6e6e460` and to nothing
after it: the gate passed 209 files and 3,542 tests there, and the golden suite 28
files and 242 tests. Every review round since added tests, so the suite at the
head is larger and these two numbers are a historical reading rather than a claim
about it. The Linux built-runtime smoke, also observed at that commit, drew
through the real `webgl-canvas` surface under Xvfb/SwiftShader (`pixelsDrawn
true`, 15 draw calls) and completed its existing authoring and orchestrated kernel
checks.

That smoke has **not** been re-run since, and review rounds after it did change
the tier's one renderer-owning module, `desktop/linux/src/renderer/viewport.ts`:
the assistant-start decision moved to `renderer/assistant-start.ts`, the job poll
to `renderer/assistant-poll.ts`, the result inspection to
`renderer/assistant-inspection.ts`, and the rarity result gained its replayed
branch. `fd7aae9` then rewrote the open-path report's rarity clause: what was a
tier/candidate summary became `rarityEvidenceReport()`, printed on its own
`rarityEvidenceLine` overlay above the frame report, and `AssistantPollOutcome`
was narrowed so the poll consumer no longer re-checks an optional result.
`9b45aca` gave that overlay `white-space: pre-wrap` so the shared formatter's line
breaks survive, and made it clear itself when a run carries no rarity, and
`96ddee0` moved the pixels-meta decision and the playable-exercise validation out
to `renderer/playback-report.ts`, where the gate executes them. One of those
rounds also
imported the shared evidence formatter from the Node-bearing root barrel, which
made `renderer.js` unbundlable until it was moved to the import-free
`@sceneaxi/authoring-core/rarity-evidence` entry — a break `pnpm gate` could not
see, because the root `build` stage is `tsc --build` rather than the esbuild
bundle. `pnpm check:desktop` now runs the browser-platform esbuild graph and
checks its metafile for Node imports and a second presentation owner; the pixel
observation above, however, remains a reading of the earlier build and is not a
claim about the renderer at this head. `fac19c4` later changed
`renderer/assistant-poll.ts`, and `974b2af` changed the kernel, bridge, formatter,
renderer, and recovery paths. `9a61731` then tightened stored evidence and
Assistant settlement, `ba0c4f5` handled the abandonment race, `dd9cb10` matched
the shipped evidence contract to runtime validation, added semantic renderer
bundle checks, bounded Agent input in the renderer, associated settlement with
the displayed result, and retired evidence when a document was missing;
`6a75109` corrected Node 20 smoke invocation. These are post-smoke source
corrections. `105d120` then bounded and filtered provider descriptors, separated
missing documents from read failures, enforced the Agent prompt limit at the
shared bridge, preserved staged evidence during Play, and handled late proposal
settlement. `6cbf43a` binds evidence to individual rolls, protects
an unresolved ready Agent job, rejects final-line terminators in descriptors,
retains evidence through unreadable recovery, and invalidates matching Assistant,
Run, viewport, and Evidence output together. `ce6b714` then reconciled Assistant
lifecycle across restart and Undo, and compared each presentation surface with
accepted project provenance. `7071775` preserved legacy evidence-less playback,
refused new evidence-less extensions, retired Assistant results without calling
Undo a rejection, expanded descriptor filtering, and added the corresponding
contract and lifecycle regressions. `367ef34` added credential-shape filtering,
named kernel replay refusals, restart and late-settlement reconciliation,
no-write preservation for existing composed projects, and mounted desktop
regressions. `d694f6d` added provider candidate filtering and refreshed late
settlement state from current authoring status. The smoke was not rerun after
these changes.

The pinned vector digests above, by contrast, are re-proved on every run:
`tests/e2e/rarity-provider-desktop-golden.test.ts` compares runtime output to
those exact bytes, so a change that moved any of them would fail rather than
silently outdate this section.

This record covers the checked-in no-network fixture and the built runtime on
this host. It is not a packaged-artifact observation, live provider readiness,
credential handling proof beyond the tested refusal/redaction boundaries,
distribution or deployment evidence, Kids activation, publication, or Stage 1
proof.

This contract adds no rarity economy, inventory, marketplace, renderer, live
provider adapter or network path, Hosted enablement, or Kids path. It does not
rewrite Sculpt Artifacts.
