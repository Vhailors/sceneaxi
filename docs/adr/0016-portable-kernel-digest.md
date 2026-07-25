# ADR 0016: Kernel session digests come from a portable synchronous sha256

- **Status:** Accepted for the kernel browser open path.
- **Date recorded:** 2026-07-25
- **Source:** T2-kernel-open-play (program `sceneaxi-engine-product-program-20260725`), GAP-MATRIX §1.
- **Lineage:** Bounded by ADRs 0001 (command/snapshot session), 0002 (presentation seam), 0009, and 0015.

## Context

Every kernel session path — entity, sculpt, and multi-object scene — computed
its snapshot digest with `createHash` from `node:crypto`. That single import made
the whole Game Kernel seam un-loadable in a browser, so a presentation runtime
could never open a session next to the thing it draws. The kernel had no other
Node dependency: state is plain numbers, snapshots are plain data, and only
`advance` mutates.

`observe()` is synchronous and digest-bound by ADR 0001. Web Crypto's
`SubtleCrypto.digest` is asynchronous, so it cannot supply that digest without
making `observe()` async — an ADR 0001 change, not a portability fix.

## Decision

Kernel digests come from a **portable synchronous sha256** implemented in
[`packages/engine-kernel/src/portable-digest.ts`](../../packages/engine-kernel/src/portable-digest.ts),
with no dependency and no Node builtin. It is byte-identical to `node:crypto`
sha256 over the same UTF-8 input, so every landed snapshot digest, save
artifact, and checked-in golden is unchanged by this ship.

Hosts may optionally inject a synchronous digest implementation. Injection is
verified, not trusted: before a session opens, `resolveKernelDigest` compares the
candidate with the portable implementation over fixed probes covering empty,
ASCII, astral UTF-8, embedded NUL, and multi-block input. A candidate that
throws, returns anything other than 64 lowercase hexadecimal characters, or
disagrees on any probe refuses with `KernelSessionError`. Once verified, the
session retains and uses that implementation for every digest call. Injection
is therefore a performance choice, never a change of digest semantics.

Entity sessions accept the optional digest through `KernelHost.digest`; sculpt
and scene open/replay functions accept an optional trailing `KernelDigestHost`.
Existing calls remain valid. The digest is not versioned and no schema or
contract version changes: the algorithm, the canonical `sha256:<hex>` form, and
the bytes hashed are all exactly what they were.

Snapshots and save artifacts stay plain serializable data, so the alternative
server-kernel → browser-presentation transport also works and is tested
(`docs/kernel-browser-open.md`).

## Consequences

- The kernel opens, plays, saves, and replays in a browser with no Node builtin
  and no Node global.
- Presentation can open a session locally or receive snapshots over the wire; both
  produce the same digests.
- Every session uses the portable implementation by default and always preserves
  its digest semantics, including when a verified host implementation is used.
- The kernel owns a cryptographic primitive implementation, which is small,
  frozen, and oracle-tested against `node:crypto` at every block and padding
  boundary.

## Rejected alternatives

- **Web Crypto (`SubtleCrypto.digest`)** — asynchronous; would force `observe()`
  to become async and reopen ADR 0001.
- **Trusting an optional host-injected digest without verification** — would let
  a performance adapter change snapshot and save-artifact semantics. Fixed
  probes establish the required implementation before the session retains it.
- **A runtime `typeof process` branch selecting `node:crypto` or a fallback** — a
  scattered conditional that still leaves the Node specifier in the browser
  bundle graph.
- **A hashing dependency** — `@sceneaxi/schemas` and the kernel keep zero runtime
  dependencies by rule.
- **Dropping digests from snapshots** — digests are the replay and evidence
  contract (ADR 0001).

## Settled here vs held elsewhere

**Settled:** the portable default, verified optional injection, synchronous
digest semantics, and unchanged digest bytes.

**Held elsewhere:** renderer selection and Stage 1 (still double-gated), any
presentation composition decision, and whether other packages become
browser-targeted.
