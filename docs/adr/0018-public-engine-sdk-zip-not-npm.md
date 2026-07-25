# ADR 0018: The public engine download is a deterministic SDK zip, not an npm publish

- **Status:** Accepted for websites-deploy v1.
- **Date recorded:** 2026-07-25
- **Source:** captain freeze and dispatch, `sceneaxi-websites-deploy-v1`; [sceneaxi#102](https://github.com/Vhailors/sceneaxi/issues/102), [#106](https://github.com/Vhailors/sceneaxi/issues/106).
- **Lineage:** Bounded by [`docs/web-consumer.md`](../web-consumer.md), which governs supported external consumption, and by the Kids isolation boundary.

## Context

The engine and library are to be freely downloadable. The packages are private
`0.0.0` bootstrap packages, this repository holds no registry publish authority, and
`docs/web-consumer.md` states plainly that there is no supported external install until
matching versions are published. A free download therefore cannot be an npm publish,
and must not pretend to be a supported install.

A download also has to be *verifiable*. A checksum only means something if an
independent rebuild produces the same bytes.

## Decision

CI and each umbrella build produce a **versioned engine SDK zip plus a SHA-256
checksum and a manifest**, from the public package sources. The umbrella serves them
publicly and free. This is **not** an npm publish and **not** a dump of the monorepo.

The archive is **deterministic by construction**: entries sorted, timestamps and
permissions fixed, a fixed-level `deflateRaw`, and store-rather-than-deflate when
compression does not help. Determinism is asserted by a gate test and again by a CI
step, so the bytes the site serves and the bytes CI builds carry the same digest.

Contents are the public consumer surface — `schemas`, `engine-kernel`,
`engine-presentation`, `engine-orchestrator`, `authoring-core`, `profile-game`,
`profile-web` — plus their manifests, READMEs, shipped JSON Schema contracts,
`docs/web-consumer.md`, `docs/DEPENDENCY-MATRIX.md`, and a generated `SDK-README.md`
that restates the support status. An exact entry-list snapshot pins that surface.

The writer is dependency-free plain ESM (`scripts/lib/zip.mjs`) so a Vercel build can
run it from a site root with no install and no `tsc` step.

Fail-closed: a missing required package or doc, an empty file set, an absolute or
escaping entry name, a duplicate name, or anything past the non-ZIP64 limits refuses
rather than emitting a partial or malformed SDK.

**`packages/profile-kids` is asserted absent** in the builder, in a gate test, and in a
CI step, because the Kids isolation boundary has to hold in shared artifacts and not
only in the dependency graph.

No GitHub Release is created; CI uploads a workflow artifact, so no release authority
is claimed.

## Consequences

- Users can read and build against the engine for free, with a verifiable archive, and
  no registry publication is required or implied.
- `docs/web-consumer.md` remains authoritative on support: the archive carries it, and
  the download page repeats that these are private `0.0.0` packages.
- The archive is reproducible, so a mismatch between a served file and its published
  checksum is a real signal rather than expected drift.
- Adding a package to the public surface is a deliberate edit to the entry-list
  snapshot, not an accident of directory walking.

## Rejected alternatives

- **npm publish this wave** — requires publish authority this repo does not hold, and
  would contradict the web-consumer contract's "consumers must wait" rule.
- **A login-gated engine download** — the engine is free; gating it would move a free
  capability behind the identity plane.
- **Zipping the whole monorepo** — ships tests, tooling, apps, sites, and the Kids
  package, and misrepresents what the SDK is.
- **A non-deterministic archive** — makes the published checksum a per-build accident
  and destroys the reason to publish one.
- **Depending on an archiver package** — would put a runtime dependency into a
  hermetic, zero-dependency repository for a few hundred lines of well-specified format.

## Settled here vs held elsewhere

**Settled:** the download is a deterministic public SDK zip with a checksum and
manifest; its contents; its fail-closed rules; Kids exclusion from the artifact; and
that no npm publish or GitHub Release happens in this wave.

**Held elsewhere:** registry publication and versioning authority; the supported
external install story (`docs/web-consumer.md` plus a future publication decision);
release/tagging policy; and any paid or gated distribution channel.
