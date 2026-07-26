# Open-path demo policy

One answer, shared by every surface, to two questions that used to be answered
locally: **how far may this profile's open path be demonstrated**, and **what
does that demonstration claim?**

The policy is a contract, not prose. It lives in
[`packages/schemas/src/open-path-policy.ts`](../packages/schemas/src/open-path-policy.ts)
(`OPEN_PATH_POLICY`, `evaluateOpenPathDemo`, `openPathPolicyView`), mirrored as
`packages/schemas/contracts/open-path-policy.fixtures.json` under
`contracts/open-path-policy.schema.json`. `pnpm check:contracts` keeps this
document, the fixture, and the schema in exact lockstep, and a seam test asserts
the TypeScript table and the fixture are identical — so all four move together
or the gate fails.

## Why it lives in `@sceneaxi/schemas`

Because it is the only place all five consumers can reach.
`docs/dependency-matrix.json` allows `@sceneaxi/cli` and
`@sceneaxi/desktop-shell` only `@sceneaxi/schemas` + `@sceneaxi/authoring-core`;
`@sceneaxi/web-shell` adds `auth` and `billing`; the profiles may name the whole
core train. The single package in every one of those allow-lists is `schemas`.

Putting the shared policy anywhere else would have bought parity by widening the
matrix. It was not widened: **this ticket adds no edge to
`docs/dependency-matrix.json`.** Nothing here gives the CLI or a shell a kernel,
presentation, orchestrator, plugin-host, or profile dependency, and no surface
gained the ability to *run* an open path — only to report and evaluate the
policy that governs one.

## The policy

<!-- open-path-policy:list -->
| profile | demo level | session kind | operations | evidence | shipping claim |
|---|---|---|---|---|---|
| `@sceneaxi/profile-game` | `demo-driveable` | `scene-kernel-session` | `open`, `dispatch`, `advance`, `observe`, `save`, `replay` | `tests/e2e/profile-game-scene-golden.test.ts` | `false` |
| `@sceneaxi/profile-web` | `demo-driveable` | `kernel-session` | `open`, `dispatch`, `advance`, `observe`, `save`, `replay` | `tests/e2e/profile-web-golden-path.test.ts` | `false` |
| `@sceneaxi/profile-kids` | `refuse-only` | `none` | — | `tests/e2e/profile-kids-refuse-golden.test.ts` | `false` |
<!-- /open-path-policy:list -->

### Levels

The vocabulary is the one [`runnable-surfaces.md`](runnable-surfaces.md) already
uses, so a level here means the same thing it means there:

| Level | Meaning |
|---|---|
| `demo-driveable` | R1 — reachable through a public seam and golden-tested end to end |
| `refuse-only` | R0 — the product *is* a refusal boundary; there is no open path to drive |

There is no `shipping` level and there will not be one. This contract grades
demonstrations; readiness is a captain decision made elsewhere.

### Operations

Exactly the
[ADR 0001](adr/0001-game-kernel-command-snapshot-session.md) Kernel seam: `open`,
`dispatch`, `advance`, `observe`, `save`, `replay`. The set is closed, so a
surface cannot quietly grow a publish, checkout, deploy, or metering step by
calling it "part of the open path" — an unnamed operation refuses.

## What a demo is not allowed to claim

Three properties are structural rather than documented:

1. **`shippingClaim` is typed `false`.** It is `false` in the row type, `false`
   in every allowed decision, and `const false` in the JSON Schema. A request
   carrying `claimsShipping: true` refuses with
   `OPEN_PATH_SHIPPING_CLAIM_FORBIDDEN` — the flag exists precisely so the
   refusal is a test rather than a review convention. **No row on this page is a
   production game-readiness claim**, and `demo-driveable` on
   `@sceneaxi/profile-game` means a golden test opens a scene offline, nothing
   more.
2. **A level without evidence refuses.** Every non-refusing row names the
   committed test that proves it, and `evaluateOpenPathDemo` refuses with
   `OPEN_PATH_EVIDENCE_MISSING` rather than granting an unevidenced level. This
   is the same discipline `profileConformanceRegistry` applies to claim status —
   and note the two are independent: the Web profile is `not-yet-claimed` for
   Profile Conformance while being `demo-driveable` here, because those grade
   different things.
3. **Kids refuses first.** `@sceneaxi/profile-kids` is `refuse-only` with an
   empty operation set, and `evaluateOpenPathDemo` checks it *before* the
   operation is considered, so no operation added later can be one Kids happens
   to allow. The refusal reaches every surface as a non-zero exit or a named
   refusal — never an empty row a renderer could read as "nothing to show". This
   policy adds no Kids UI, no Kids commerce, and no Kids dependency;
   `kidsBoundary.allowedDependents` stays empty.

## Surface parity

Parity is a **data identity**, not three descriptions kept aligned by review:
every surface renders `openPathPolicyView()` verbatim, and
`tests/parity/open-path-policy-parity.test.ts` asserts the three payloads are
deep-equal to each other and to the contract.

| Surface | How to reach it | What it can do |
|---|---|---|
| `@sceneaxi/cli` | `sceneaxi profile open-path [--profile <p>] [--operation <op>]` | report the policy; evaluate one demo operation |
| `@sceneaxi/desktop-shell` | `sceneaxi-desktop open-path [--profile <p>] [--operation <op>]` | identical payload, identical refusals |
| `@sceneaxi/web-shell` | `createOpenPathView()` | identical payload as a view model (no UI framework in this repo) |
| `@sceneaxi/profile-game` | `openPathPolicy`, `evaluateOpenPath()` | reads its own row; cannot restate its level |
| `@sceneaxi/profile-web` | `openPathPolicy`, `evaluateOpenPath()` | reads its own row; cannot restate its level |

Both profiles *read* their row rather than declaring one: a missing row throws at
module load instead of falling back, so a profile cannot exist outside the policy
that governs it.

Narrowing a report to one profile is a **projection**, not a smaller policy.
`openPathPolicyViewFor()` is the single function all three surfaces narrow
through — the CLI's and the shell's `--profile`, and the web view's
`policyFor()`. It keeps `policyCount` at the policy's true row count and adds
`filteredTo`, so a stored payload can never be read back as "the policy has one
row", and an off-policy profile refuses with the same `OPEN_PATH_PROFILE_UNKNOWN`
whether it was evaluated or merely reported. No surface authors its own
unknown-profile sentence; the parity suite asserts the refusal code and message
are identical across all three.

Choosing *which* of those three things an invocation asked for is shared as well.
`resolveOpenPathSurfaceRequest()` takes the two optional flag values and returns
one tagged outcome — report, project, evaluate, or refuse — which the CLI verb
and the shell command render into their own envelopes without deciding anything.
A branch table copied into two packages is exactly where surfaces drift, so there
is only one. It is fail-closed on the request itself: `undefined` means the flag
was absent, while any provided value — including `--profile=` or `--operation=`
with nothing after the `=` — must name something, so an empty value refuses
instead of selecting a *wider* branch than the caller asked for. A request to
evaluate an operation can therefore never come back as a successful listing.

### Where parity stops, and why

The shells and the CLI report and evaluate the policy. They do **not** open a
kernel session, and that asymmetry is deliberate rather than unfinished work: the
matrix allows them `schemas` + `authoring-core` only, and running an open path
needs `@sceneaxi/engine-kernel`. The runnable open paths stay where they already
are — in the profiles and in `tests/e2e/`, which may import any package. See
[`runnable-surfaces.md`](runnable-surfaces.md), *"Why the CLI and shells have no
kernel or plugin verbs"*.

The umbrella's public `/open` path (ADR 0022) is a separate, site-tier surface
with its own owner, [`three-presentation-core.md`](three-presentation-core.md);
it draws pixels through the ADR 0002 seam and is not governed by this table.

## Refusal codes

| Code | When |
|---|---|
| `OPEN_PATH_KIDS_REFUSED` | any demo request naming `@sceneaxi/profile-kids` |
| `OPEN_PATH_PROFILE_UNKNOWN` | a profile with no row; expansion must be explicit |
| `OPEN_PATH_OPERATION_NOT_IN_DEMO_POLICY` | an operation outside the closed Kernel-seam set, or outside that row's set |
| `OPEN_PATH_SHIPPING_CLAIM_FORBIDDEN` | `claimsShipping: true`, or a recorded decision with `shippingClaim` not `false` |
| `OPEN_PATH_EVIDENCE_MISSING` | a claimed level whose evidence is absent or does not match the row |
| `OPEN_PATH_RECORD_NOT_OBJECT`, `OPEN_PATH_SCHEMA_VERSION_MISMATCH`, `OPEN_PATH_KIND_MISMATCH`, `OPEN_PATH_REQUIRED_PROPERTY_MISSING`, `OPEN_PATH_UNEXPECTED_PROPERTY`, `OPEN_PATH_PROPERTY_INVALID` | malformed request or recorded decision — including a surface request whose provided flag value is empty (`OPEN_PATH_PROPERTY_INVALID`) or that names an operation with no profile (`OPEN_PATH_REQUIRED_PROPERTY_MISSING`) |

## Changing the policy

Adding a profile, a level, or an operation is an explicit contract edit that
moves `packages/schemas/src/open-path-policy.ts`,
`packages/schemas/contracts/open-path-policy.fixtures.json`, and the table above
in one commit — `pnpm check:contracts` fails otherwise, and
`tests/contracts/injected-open-path-drift.test.ts` proves that check itself
fails on injected drift.

Raising a profile *above* demo level is not a contract edit. It is a captain
decision recorded in the canonical product spec (#1), and it needs evidence that
does not exist in this repo today.
