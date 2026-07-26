# ADR 0023: The orchestrator owns open-path bootstrap and session lifecycle, and nothing else

- **Status:** Accepted for the open path. Supersedes the sceneaxi#60 option-B stub
  disposition of `@sceneaxi/engine-orchestrator` ("not in the golden path").
- **Date recorded:** 2026-07-26
- **Source:** [sceneaxi#134](https://github.com/Vhailors/sceneaxi/issues/134) (Ladder Step 6).
- **Lineage:** Sits on [ADR 0001](0001-game-kernel-command-snapshot-session.md) (kernel
  authority), [ADR 0015](0015-scene-minimal-multi-object-open-path.md) (the scene open
  path), and [ADR 0016](0016-portable-kernel-digest.md) (portable digest semantics).
  Bounded by [ADR 0004](0004-no-plugin-ports-before-two-adapters.md).

## Context

sceneaxi#60 asked what `engine-orchestrator` should be and chose option B: keep the
public seam, add no code, and record "not needed" executably. That was the right call
for the evidence available. One golden path opened one kernel session directly, so any
layer above it would have been glue with nothing to hold — and "orchestrator" is a word
that attracts job queues, schedulers, and worker pools that no demo had asked for.

The evidence has changed. The kernel now has **three** landed open paths, each with its
own entry point and its own expectations:

| Path | Entry point | Host | Failure |
|---|---|---|---|
| product manifest | `open(manifest, host)` | `nowMs` **and** digest | throws `KernelSessionError` |
| sculpt | `openSculptKernelSession(artifact, options, host?)` | digest only | throws `KernelSessionError` |
| composed scene | `openSceneKernelSession(scene, options, host?)` | digest only | throws `KernelSessionError` |

Every caller that wanted to *open something* had to know which of the three it held,
assemble the right host, and wrap the call in a try/catch. The kernel session also has
no teardown, so nothing expressed "this session is no longer mine to advance". That is
real, repeated, cross-path work above the kernel — the first evidence for a layer that
sceneaxi#60 correctly declined to invent in advance.

ADR 0013's precedent applies in both directions: add support where a demand proves it is
needed, and record "not needed" executably everywhere else. This ADR is the first
direction; the stub disposition was the second.

## Decision

`@sceneaxi/engine-orchestrator` becomes the open path above the kernel, and owns exactly
five things:

1. **One request vocabulary.** `bootstrapOpenPath(request, host)` takes a kind-tagged
   request (`product` | `sculpt` | `scene`) and selects the kernel entry point. The kind
   set is a frozen list; widening it is an explicit edit, never an inference.
2. **One host contract.** `OpenPathHost` is `{ nowMs, digest? }` for all three kinds,
   resolved and proven once before anything opens. An injected digest is verified against
   the portable kernel digest (ADR 0016), so injection can change performance and never
   bytes.
3. **Fail-closed results instead of throws.** Every failure — the orchestrator's own and
   the kernel's — becomes a named reason from a frozen refusal registry, carrying the
   kernel's message as `detail` when the kernel is the refuser. Nothing throws across the
   package seam.
4. **A deterministic bootstrap record.** Kind, subject id, `sha256:` session id, clock
   reading, resumed flag, kernel and BOM versions — fully determined by the request and
   the host, and therefore assertable in a golden fixture.
5. **A session lifecycle.** `handle.session()` hands out the kernel's own session and
   `handle.close()` is an idempotent end of the handle's grant; every later `session()`
   refuses.

`resumeOpenPath()` covers the same three paths from a kernel save artifact and produces a
handle only when the kernel reproduces the artifact's terminal digest.

**Kernel authority is unchanged.** The handle returns the kernel session itself rather
than re-exporting `dispatch`/`advance`/`observe`/`save`. Wrapping those would be a second
implementation of kernel behaviour, and drift here means digest drift (the same reasoning
that made ADR 0015 share one simulation instead of copying it). Only `advance` mutates,
snapshots stay read-only, and replay still refuses on digest drift.

**The bound is part of the decision.** This ADR authorizes bootstrap and per-handle
session lifecycle and nothing else. No job queue, scheduler, durable job store, worker
pool, retry policy, multi-tenancy, priority, or plugin hook is added or implied. The
package holds one session per handle and creates no work of its own. That bound is
asserted executably in `packages/engine-orchestrator/test/golden-path-orchestrated.test.ts`:
the sources carry no deferral, no concurrency primitive, and no Node builtin. A later
scheduling request must justify itself on its own evidence; this ADR is not an
authorization for one.

The first call site is the Game profile's landed multi-object golden path
(`sceneGoldenPath`), which now bootstraps its scene session through the orchestrator and
pins no kernel scene entry point beside it, so the path cannot silently revert. No
profile scope policy, CLI verb, Minimum E2 checklist item (ADR 0003), entitlement (ADR
0020), engine adapter, renderer decision, plugin capability, or Stage 1 surface is added
by this ship.

## Consequences

- One way to open a kernel session, with one host contract, across all three paths.
- Open failures are inspectable named reasons instead of caught exceptions, so callers
  branch on a reason rather than parsing a message.
- Every opened session carries a deterministic record of what was opened, which a golden
  fixture asserts.
- Sessions have an explicit end. The bound is honest: `close()` ends the handle's grant
  and does not revoke a reference a caller already took.
- `engine-orchestrator` gains one runtime dependency (`@sceneaxi/engine-kernel`) that the
  dependency matrix already allowed, and stays browser-safe like the kernel under it.
- The sceneaxi#60 executable "not needed" record is retired rather than quietly left to
  contradict the code.

## Rejected alternatives

- **Keep the stub.** The disposition was evidence-based, and the evidence changed: three
  open paths, three host shapes, and no session end. Leaving it would keep the same
  selection-and-try/catch code duplicated in every future caller.
- **A job/queue layer.** Nothing demands deferral, concurrency, retries, or tenancy. This
  is exactly the invented product scope sceneaxi#60 refused, and it stays refused.
- **Re-export the kernel session's methods through the handle.** A second implementation
  of kernel behaviour that can drift; drift here is digest drift.
- **Put the open path in `authoring-core` or in each profile.** It would be duplicated per
  profile, and authoring-core owns documents and composition, not session lifecycle.
- **Make `close()` revoke an already-handed-out session.** It would require proxying the
  kernel session, which is the wrapping this ADR rejects, for a guarantee no caller needs.

## Settled here vs held elsewhere

**Settled:** open-path bootstrap, the one host contract, named fail-closed refusals, the
deterministic bootstrap record, per-handle session lifecycle, and the explicit no-job-system
bound.

**Held elsewhere:** any scheduling, background execution, or multi-tenant product; renderer
selection; profile scope policy and CLI open-path policy; editor programs; Stage 1 and its
run authorization; every open captain decision key.
