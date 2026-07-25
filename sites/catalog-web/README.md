# @sceneaxi/site-catalog-web

The deployable website-asset catalog site: browse and detail over listed catalog
fixtures, dual pricing (credits and/or money), the creator 50% share note, and deep
links into the umbrella's Minimum E2 editor.

## Shape

A thin view + wiring layer over `@sceneaxi/site-kit`, which owns the catalog view
models, price display, share math, and deep-link contract and is tested in
`pnpm gate`.

- `src/index.ts` and `src/lib/**` are pure TypeScript, gate-typechecked and tested.
- `src/app/**` is the only place a framework appears.

## Distinct surface

The locked site/domain topology requires the two storefronts stay distinct in
positioning and content even though they consume the same catalog pipeline. This
surface does not publish the game catalog's or the umbrella's canonical pages.

## Commerce is inert

`COMMERCE_ACTIVATION_GATE` always refuses while tier-6b marketplace activation keys
remain open. Prices and the creator share are displayed; purchase and publish refuse
`CATALOG_COMMERCE_INERT`. There is no checkout, cart, or payment field.

## Separate install root

Not a `pnpm-workspace` member; keeps its own lockfile.

    pnpm install      # from this directory
    pnpm dev
    pnpm build
