# @sceneaxi/profile-kids

## Purpose

Provides one deterministic, in-memory curated activity for the isolated Kids profile.

## Public exports

`src/index.ts` exports the `seam`, activity actions, pieces, worlds, limits, state and action types, state creation and action application functions, and the compiled isolation and refusal policy constants and evaluation functions.

## Refusals

Unknown activity actions receive a generic refusal. Network destinations, external data planes, non-Kids catalogs, commerce, and all model routes refuse. The package has no enabled network allowlist, and `kidsBoundary.allowedDependents` is empty.

## Ownership and tests

The first-release boundary is owned by [`docs/kids-first-release.md`](../../docs/kids-first-release.md). Repository rules are in [`AGENTS.md`](../../AGENTS.md), and package ownership is mapped in [`docs/agents/layout.md`](../../docs/agents/layout.md). Package behavior is tested in `packages/profile-kids/test/`; the dedicated site parity is checked by `tests/sites/kids-surface.test.ts`.

**First release = curated local activity + locked isolation.**

The profile exposes one deterministic, in-memory build-and-play activity. A child
can choose one of three bundled worlds, add up to six pieces from a four-item
palette, undo or reset, and start or stop play. There is no free-text prompt,
upload, arbitrary asset, persistence, or hidden operation. Unknown actions receive
one generic child-facing refusal with no capability or account-state detail.

The isolation policy remains unchanged around that activity: no network, account,
commerce, catalog, upload, or model route is enabled. Third-party model traffic,
external data planes, non-Kids catalogs, commerce, and every network destination
still refuse by name at the policy boundary. `kidsBoundary.allowedDependents`
remains empty, so no package, app, desktop target, or site may import this package.

The dedicated site therefore carries an independent byte-identical copy of
`src/kids-activity.ts` at `sites/kids/src/lib/kids-activity.ts`; it does not import
the profile. `tests/sites/kids-surface.test.ts` enforces source and behavior parity,
and `pnpm check:boundaries` proves the absent dependency edge.

The complete first-release boundary and safe extension procedure are in
[`docs/kids-first-release.md`](../../docs/kids-first-release.md).
