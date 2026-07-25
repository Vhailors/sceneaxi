# @sceneaxi/site-umbrella

The deployable SceneAxi umbrella site: product and docs, the **public live open
path**, the public engine SDK download, the account surface, credit packs, and the
entitled Minimum E2 sculpt/scene web editor.

## Shape

A thin view + wiring layer over `@sceneaxi/site-kit`. Everything that is not
presentation lives there and is tested in `pnpm gate` — this site holds routes and
one wiring module.

- `src/index.ts` and `src/lib/**` are pure TypeScript, gate-typechecked and
  gate-tested. No React, no Next.
- `src/app/**` is the only place a framework appears. It is syntax-gated by
  `pnpm check:syntax` and type-checked by `next build`.

## The live open path (`/open`)

The umbrella owns the public viewport ([ADR 0022](../../docs/adr/0022-umbrella-owns-the-public-viewport.md)),
so it is the one site allowed to depend on `@sceneaxi/engine-presentation`. Nothing
else changes about the tier: no other engine package is reachable from any site, and
the two catalogs keep `site-kit` only.

- The **server** resolves the scene — a committed Sculpt Artifact reconstructed
  deterministically and placed by `composeScene()` — through
  `src/lib/live-open.ts` over `@sceneaxi/site-kit`. It is contract data, not geometry
  invented here.
- The **client** (`src/app/open/_components/live-viewport.tsx`) is the only file on the
  site that touches a renderer, and it touches it only through the ADR 0002 seam:
  Sculpt Mount API, numeric orbit controls, and the package's own frame loop. No Three
  type is named.
- The path is **public**: no sign-in, no credits, no editing operation. The bounded
  Minimum E2 editor at `/editor` is a separate, entitled surface and is not widened by
  this one.
- The page reports the running core's own frame record (`backend`, `label`, draw
  surface, `pixelsDrawn`, draw calls, mounted instances), so a frame counter can never
  imply pixels that were never drawn. `pnpm gate` proves the path on the headless
  surface (`tests/e2e/umbrella-live-open-golden.test.ts`); the pixel claim is a
  recorded browser observation in `docs/three-presentation-core.md`.

## Separate install root

This site is the sole member of its own pnpm workspace, not a member of the
repository-root workspace. It keeps its own lockfile so the hermetic root install,
root lockfile, `tsc --build` graph, and gate runtime stay untouched by site framework
dependencies. `@sceneaxi/site-kit` and `@sceneaxi/engine-presentation` are consumed
with `link:` specifiers and transpiled by Next, because SceneAxi package exports are
source-backed. Their own dependencies — including `three` — resolve from the
repository-root install, so a clean builder must provision both roots
(`docs/websites-deploy.md`).

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
