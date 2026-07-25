# @sceneaxi/site-umbrella

The deployable SceneAxi umbrella site: product and docs, the public engine SDK
download, the account surface, credit packs, and the entitled Minimum E2
sculpt/scene web editor.

## Shape

A thin view + wiring layer over `@sceneaxi/site-kit`. Everything that is not
presentation lives there and is tested in `pnpm gate` — this site holds routes and
one wiring module.

- `src/index.ts` and `src/lib/**` are pure TypeScript, gate-typechecked and
  gate-tested. No React, no Next.
- `src/app/**` is the only place a framework appears. It is syntax-gated by
  `pnpm check:syntax` and type-checked by `next build`.

## Separate install root

This site is the sole member of its own pnpm workspace, not a member of the
repository-root workspace. It keeps its own lockfile so the hermetic root install,
root lockfile, `tsc --build` graph, and gate runtime stay untouched by site framework
dependencies. `@sceneaxi/site-kit` is consumed with a `link:` specifier and transpiled
by Next, because SceneAxi package exports are source-backed.

    pnpm install      # from this directory
    pnpm dev
    pnpm build        # also generates public/engine-sdk/

## Identity plane

`src/lib/identity-plane.ts` is the single plug point for `@sceneaxi/auth` and
`@sceneaxi/billing`. Until that vertical lands its adapters are unset, so sign-in,
balances, and checkout refuse with named reasons rather than showing an invented
session or balance. `docs/websites-deploy.md` has the activation procedure and the
env var list.

`SCENEAXI_SITE_EDITOR_PREVIEW=1` grants a banner-marked editor preview so the
Minimum E2 surface is demonstrable before then. Absent by default; server-side only.
