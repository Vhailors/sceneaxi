# @sceneaxi/engine-orchestrator

**Disposition: the real open path above the kernel** (sceneaxi#134,
[ADR 0023](../../docs/adr/0023-open-path-bootstrap-and-session-lifecycle.md)).

This supersedes the earlier option-B stub disposition recorded on sceneaxi#60
("not in the golden path"). That call was right for what existed then: one
golden path opened one kernel session, so a layer above it would have been glue
with nothing to hold. Three landed open paths later — product manifest, sculpt,
and composed scene, each with its own entry point, host expectations, and throw
behaviour — the layer has something to hold, and this package holds exactly that
and nothing more.

## What it owns

- **One request vocabulary.** `bootstrapOpenPath({ kind, … }, host)` selects the
  kernel entry point. Callers stop hand-picking between `open`,
  `openSculptKernelSession`, and `openSceneKernelSession`.
- **One host contract.** `OpenPathHost` is `{ nowMs, digest? }`, resolved once
  and verified before anything opens. `nowMs` must return an integer millisecond
  reading — the kernel requires that of every reading it takes, so in a browser
  pass `Date.now()` or `Math.floor(performance.now())`, never raw fractional
  `performance.now()`. An injected digest must agree with the portable kernel
  digest, so injection can change performance and never bytes; it is also proven
  on the session-id input rather than trusted past the kernel's fixed probes.
- **Fail-closed results, not throws.** Every failure is a named reason from
  `ORCHESTRATOR_REFUSALS`, with the kernel's own message as `detail` when the
  kernel is the refuser. Nothing throws across the package seam.
- **A deterministic bootstrap record.** `handle.bootstrap` carries the kind,
  subject id, `sha256:` session id, clock reading, resumed flag, and kernel/BOM
  versions — fully determined by the request and the host, so a golden fixture
  can assert it.
- **A session lifecycle.** `handle.session()` hands out the kernel's own session;
  `handle.close()` is idempotent and every later `session()` refuses with
  `OPEN_PATH_SESSION_CLOSED`.
- **Resume.** `resumeOpenPath()` replays a kernel save artifact through the same
  handle shape, and only produces one when the kernel reproduces the artifact's
  terminal digest.

`session()` returns the kernel session itself rather than re-exporting
`dispatch`/`advance`/`observe`/`save`. Wrapping them would be a second
implementation of kernel behaviour that can drift from the first: the lifecycle
guard belongs here, the simulation contract stays the kernel's (ADR 0001).

The rarity contract follows that same bound: product open/resume requests carry
the typed manifest and the package re-exports rarity vocabulary, but the handle
returns the kernel session unchanged. Only kernel `advance` resolves a pending
rarity roll; the orchestrator adds no entropy, outcome, or mutation path. See
[`docs/rarity-engine.md`](../../docs/rarity-engine.md).

Honest bound on `close()`: it ends the handle's grant. A caller that already took
the session keeps the reference it took — this is a lifecycle boundary, not a
revocation of a kernel object someone else is holding.

## What it is not

No job queue, scheduler, durable job store, worker pool, retry policy,
multi-tenancy, or plugin hook. One handle holds one session and the package
creates no work of its own. `test/golden-path-orchestrated.test.ts` asserts that
bound executably: the sources carry no deferral, no concurrency primitive, and no
Node builtin, which is what stops "orchestrator" from growing into a job system
by drift.

## Proof

- `test/open-path.test.ts` — all three kinds open, advance, save, and resume
  through the public package name; session ids are deterministic; an injected
  digest changes no bytes.
- `test/refuse-matrix.test.ts` — every reason in `ORCHESTRATOR_REFUSALS` is
  reachable, so a declared refusal cannot go unwired.
- `test/golden-path-orchestrated.test.ts` — the reversed disposition, the bound,
  and the call site.
- `tests/e2e/profile-game-scene-golden.test.ts` — the Game profile's landed
  multi-object golden path bootstraps its scene session here, and its checked-in
  evidence carries the bootstrap record.

The package is browser-safe for the same reason the kernel is
(`docs/kernel-browser-open.md`): no Node builtin, no Node-only global, portable
digest semantics.

Boundaries enforced by `scripts/check-boundaries.mjs` against
`docs/dependency-matrix.json`.
