# ADR 0007: SceneAxi owns sculpt contracts and reconstruction

- **Status:** Accepted for the post-MVP hybrid vertical.
- **Date recorded:** 2026-07-24
- **Source:** [sceneaxi#68](https://github.com/Vhailors/sceneaxi/issues/68) and [#69](https://github.com/Vhailors/sceneaxi/issues/69).
- **Lineage:** Child decisions of hybrid parent #67.

## Context

Image reconstruction methods can inform authoring, but a product runtime
dependency on one external repository would surrender contract ownership and
make deterministic gates depend on a live model path.

## Decision

SceneAxi owns the versioned Sculpt Intake, ObjectSculptSpec, Sculpt Artifact,
and reconstruction pipeline. Public contracts contain only SceneAxi
components, materials, sockets, hierarchy, transforms, module references, and
evidence fields.

The CI path is a deterministic `structured-spec` fixture. The demo happy path
is `image+brief`. Other valid intake modes refuse reconstruction when no v1
path is authorized. Quality failures are named and fail closed. Methods may be
inspired externally, but `hoainho/img2threejs` is not a product dependency.

## Consequences

- Artifact bytes and digests can be fixture-locked under `pnpm gate`.
- A provider adapter may be injected later without changing artifact ownership.
- Production model spend requires separate authority.

## Rejected alternatives

- **External reconstruction runtime as core** — breaks ownership and offline determinism.
- **Unversioned mesh blobs** — omit hierarchy, sockets, evidence, and migration refusal.
- **Vision score as a CI hard gate** — introduces non-deterministic gate behavior.

## Settled here vs held elsewhere

**Settled:** contract ownership, supported v1 reconstruction paths, and fixture-first evidence.

**Held elsewhere:** production provider choice, spend, and quality policy beyond the named v1 gates.
