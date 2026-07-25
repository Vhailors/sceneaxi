# Kernel browser open path

How a browser opens and plays a SceneAxi kernel session, and what a presentation
runtime may rely on. The design decision behind it is
[ADR 0016](adr/0016-portable-kernel-digest.md); the session authority model is
unchanged from [ADR 0001](adr/0001-game-kernel-command-snapshot-session.md).

## What changed

`@sceneaxi/engine-kernel` no longer imports any Node builtin. Snapshot digests
come from a portable synchronous sha256
([`src/portable-digest.ts`](../packages/engine-kernel/src/portable-digest.ts))
instead of `node:crypto`, so every session — entity, sculpt, and multi-object
scene — loads and runs in a browser.

Digest bytes did not change. The portable implementation is byte-identical to
`node:crypto` sha256 over the same UTF-8 input, so every landed digest, save
artifact, and checked-in golden is untouched.

The portable implementation is the default. A host may optionally inject a
synchronous implementation, but the kernel verifies it against the portable
digest before opening the session and refuses disagreement.

## Opening in the browser (option A: portable digest)

Nothing extra is required — the portable digest is the default:

```ts
import { openSceneKernelSession } from "@sceneaxi/engine-kernel";

const session = openSceneKernelSession(composedScene, { seed: 9101 });
session.advance({ tick: 1, deltaMs: 16 });
const snapshot = session.observe(); // frozen, digest-bound, plain data
```

Surface added by this ship:

| Export | Meaning |
|---|---|
| `portableKernelDigest` | The kernel's portable synchronous sha256 implementation |
| `KernelDigest` | A synchronous `(utf8Input: string) => string` digest function |
| `KernelDigestHost` | Optional host container for a `digest` implementation |
| `resolveKernelDigest` | Returns the portable default or verifies an injected digest |

### Optional verified injection

Injection is a performance choice only. `KernelHost.digest` supplies it to
entity `open()` / `replay()` calls; sculpt and scene open/replay functions take
an optional trailing `KernelDigestHost` argument:

```ts
const digestHost = { digest: acceleratedSynchronousSha256 };

const sceneSession = openSceneKernelSession(
  composedScene,
  { seed: 9101 },
  digestHost,
);
```

`resolveKernelDigest` verifies empty, ASCII, astral UTF-8, embedded-NUL, and
multi-block probes. Opening refuses if the function throws, returns anything
other than 64 lowercase hexadecimal characters, or disagrees with
`portableKernelDigest`. The verified function is then retained for all session
digest calls; it cannot opt into different snapshot or save-artifact bytes.

## Server kernel to browser presentation (option B: snapshot transport)

The same guarantees hold when the kernel runs on a server and only its output
reaches the browser. Snapshots and save artifacts are plain JSON — numbers,
strings, arrays, and objects, no class instances, no `Buffer`, no functions — so:

- `observe()` output can be sent as-is and re-encodes to identical JSON;
- `save()` output can be sent as-is, and `replay*()` on the wire copy reproduces
  the same terminal digest;
- a session opened in the browser and a session opened on the server produce the
  same digests for the same inputs.

One encoding nuance: a kernel velocity component may be `-0`, which JSON encodes
as `0`. That is an `Object.is`-level difference only — the digest is taken over
this same JSON encoding, so it cannot move.

## What presentation may rely on

- Session state reaches presentation only through frozen `observe()` snapshots or
  a transported save artifact; presentation never mutates kernel state
  (ADR 0001, ADR 0002).
- Existing `open` / `replay` calls remain valid; digest injection is an optional
  `KernelHost.digest` property or trailing `KernelDigestHost` argument.
- Multi-object scene snapshots keep their deterministic instance order, per-instance
  world transforms, and scene digest ([`docs/scene-composition.md`](scene-composition.md)).

## Tests that hold this

- [`packages/engine-kernel/test/browser-open-play.test.ts`](../packages/engine-kernel/test/browser-open-play.test.ts)
  — no Node builtin import and no Node-only global anywhere under
  `packages/engine-kernel/src`; entity, sculpt, and multi-object scene sessions
  open, play, save, and replay with `Buffer`/`require` removed; a `node:crypto`
  import anywhere in the kernel graph fails the file at load; wire round-trip
  and independent-session determinism.
- [`packages/engine-kernel/test/portable-digest.test.ts`](../packages/engine-kernel/test/portable-digest.test.ts)
  — `node:crypto` parity across every block and padding boundary, published SHA-256
  vectors, seed derivation parity, and non-string input refusal.
- The existing golden suites (`pnpm test:golden`) still pass on their checked-in
  digests, which is the real proof that digest bytes did not move.

## Known residual (not owned by this ship)

`@sceneaxi/schemas` still statically imports `node:fs` / `node:os` / `node:path`
in one module: `src/profile-conformance-suite.ts`, a Node-only test harness that
writes temp files. It is never on a session path — no kernel session module
imports anything from it — but because the package barrel re-exports it, a
browser bundler will externalize those specifiers (a warning, not a runtime
failure, as long as the suite is never called).

`browser-open-play.test.ts` pins that residual: the set of contract-package
modules importing a Node builtin must stay exactly
`["profile-conformance-suite.ts"]`, so it cannot silently grow. Moving the suite
behind the existing `@sceneaxi/schemas/testing/*` subpath would remove it
entirely; that is a schemas-owned follow-up, outside this ship's ownership of
`packages/engine-kernel`.
