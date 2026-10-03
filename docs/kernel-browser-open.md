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

## Legacy compatibility and the Node-only conformance suite

The original `computeDigest(tick, seed, entities)` helper is available from
`@sceneaxi/engine-kernel`. It uses portable sha256 and preserves the original
JSON key order, caller entity order, `id`/`x`/`y` projection, and `sha256:` prefix.
It is not the modern rarity-aware session digest: rarity-bearing sessions still
own their existing digest path. Fixed legacy vectors and no-rarity public
session/save/replay assertions live in `test/legacy-digest.test.ts`.

The browser/default schemas root retains `ConformanceCheckResult` and
`ConformanceSuiteResult` as **type-only** exports, with no Node runtime edge.
The **Node condition** restores the original synchronous **root runtime**
`runProfileConformanceSuite` through `src/node-index.ts`, executing the complete
existing kernel, document filesystem, evidence and authority checks. The explicit
canonical Node subpath remains available:

```ts
import type { ConformanceSuiteResult } from "@sceneaxi/schemas";
import { runProfileConformanceSuite } from "@sceneaxi/schemas/node/profile-conformance-suite";
```

The browser/default condition deliberately does not export this filesystem
harness: the historical API required Node and cannot synchronously exercise
file-backed authoring in a browser. This is conditional Node runtime recovery,
not browser filesystem conformance, not type-only recovery, and not an async
wrapper. Browser hosts continue using the portable contracts root. Bundlers must
select the browser/default condition, not force Node resolution.

`browser-open-play.test.ts` still pins the sole Node-bearing schemas source
module to `profile-conformance-suite.ts`; that is a source inventory constraint,
not a claim that the browser runtime graph reaches it. The root type-export
and canonical Node-subpath policy are asserted in
`packages/schemas/test/legacy-import-compat.test.ts` (LF-02/LF-05).

Full input maps with the exact original eleven-action v1 shape are normalized
by the schemas input registry, preserving controller bindings and adding modern
defaults. Other truncations, wrong order, invalid bindings, and collisions with
newly introduced defaults refuse. Desktop settings reads migrate these maps to
minimal scoped overrides in memory, leaving original bytes untouched until an
exact reviewed atomic rebind/reset commit. Modern default maps still use gamepad
bindings with explicit deadzones; legacy controller bindings are not narrowed
or silently converted.
