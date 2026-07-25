# ADR 0017: A `sites/` tier — three Vercel projects, one Neon database

- **Status:** Accepted for websites-deploy v1.
- **Date recorded:** 2026-07-25
- **Source:** captain freeze and dispatch, `sceneaxi-websites-deploy-v1`; [sceneaxi#102](https://github.com/Vhailors/sceneaxi/issues/102), [#107](https://github.com/Vhailors/sceneaxi/issues/107).
- **Lineage:** Implements the locked topology in [`docs/program/site-domain-topology.md`](../program/site-domain-topology.md) as deployable surfaces. Bounded by the Kids isolation boundary and by [`docs/web-consumer.md`](../web-consumer.md).

## Context

The locked topology says the umbrella and the two asset storefronts are distinct
surfaces, and that Kids is a fully separate origin. It records a product decision
only — it explicitly does not authorize deploying anything. A captain order now
supplies that authority for the umbrella and both storefronts.

Three repo facts constrain how deployable sites can exist here:

1. `packages/*` and `apps/*` are hermetic and zero-runtime-dependency.
   `tsconfig.base.json` pins `lib: ["es2023"]` and `types: ["node"]` — no DOM, no JSX
   — and `pnpm gate` builds and lints the whole tree. Installing a web framework into
   that tier would move the hermetic install, the root lockfile, and the gate runtime
   for every other lane.
2. `scripts/check-syntax.mjs` builds its TypeScript program with `noResolve` and
   `noLib`, and already accepts `.tsx`. It can therefore gate a new source tier
   without React being installed at all.
3. `scripts/check-boundaries.mjs` regulates only `@sceneaxi/*` edges, exhaustively,
   from `docs/dependency-matrix.json`.

## Decision

A new top-level **`sites/` tier** holds the three deployable Next.js App Router
apps: `sites/umbrella`, `sites/catalog-game`, `sites/catalog-web`. They deploy as
**three Vercel projects on one team**, on `*.vercel.app` hostnames only, sharing
**one Neon database** for the identity/billing plane and catalog read models.

Each site is **its own install root with its own lockfile, and deliberately not a
`pnpm-workspace` member**, so the hermetic root install, the root lockfile, the
`tsc --build` graph, and the gate runtime are untouched. A site consumes
`@sceneaxi/site-kit` through a `link:` specifier and Next `transpilePackages`, because
SceneAxi package exports are source-backed.

The tier is still gated, and the gate gets stronger:

- `check:syntax` and `check:boundaries` walk `sites`.
- Each site is matrix-listed in a new **`sites` release group**, allow-listed for
  `@sceneaxi/site-kit` alone.
- A new `check:sites` stage joins `pnpm gate`.
- Injected-violation regressions in `tests/boundary/` prove each of those fails closed.

**All non-presentational logic lives in `packages/site-kit`**, a normal hermetic
zero-dependency seam-exporting package. Sites hold routes and one wiring module, so
site behaviour is testable in `pnpm gate` with no browser and no network.

## Consequences

- Cross-project environment must point at the same Neon database; the storefronts are
  not a second identity plane.
- A framework or provider SDK may be added in `sites/`, never in `packages/` or
  `apps/`. `check:sites` fails if one appears in the hermetic root manifest.
- Site seam tests live under `tests/sites/`, because a separate install root is not
  resolvable by public package name from the hermetic root. The rule that every unit
  exports a frozen typed seam with a covering test is unchanged.
- **First-party sites are not the external web-consumer contract.**
  `docs/web-consumer.md` governs third-party products and still requires published
  registry versions; a `link:` dependency is correct for an in-repo surface, exactly as
  `apps/web-shell` is a private application rather than a reusable consumer package.
- Kids remains a future separate origin. Nothing in this tier links to it, and no
  cross-surface link carries identity, session, or telemetry.
- Custom domains stay out of this wave.

## Rejected alternatives

- **A single path-routed Vercel project** — collapses three distinct brands and
  origins into one surface, against the locked topology.
- **Three isolated Neon databases** — splits one product identity and billing plane
  into three for no benefit this wave.
- **Making `sites/*` pnpm-workspace members** — pulls a web framework into the
  hermetic root lockfile and gate, disturbing every other lane.
- **Putting site logic in the site apps** — leaves behaviour untested by the gate,
  since the sites are outside the hermetic build.
- **Leaving `sites/` outside `check:syntax` / `check:boundaries`** — silently narrows
  gate coverage while appearing to keep it.

## Settled here vs held elsewhere

**Settled:** the `sites/` tier and its gate coverage, three Vercel projects on one
team, one shared Neon database, `*.vercel.app` hostnames, and the first-party-versus
external-consumer distinction.

**Held elsewhere:** custom domains and domain purchase; Kids deploy; marketplace
activation (tier-6b); Stripe live mode; the identity plane itself, which belongs to
`sceneaxi-auth-credits-v1`; and any hosting or publication decision beyond the captain
order that authorized this wave.
