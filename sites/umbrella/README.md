# @sceneaxi/site-umbrella

The deployable SceneAxi umbrella site: product and docs, the **public live open
path**, the profile capability matrix, the public engine SDK download, the account
surface, credit packs, and the entitled Minimum E2 sculpt/scene web editor.

## Shape

A thin view + wiring layer over `@sceneaxi/site-kit`. Everything that is not
presentation lives there and is tested in `pnpm gate` — this site holds routes plus the
pure wiring modules under `src/lib/`.

- `src/index.ts` and `src/lib/**` are pure TypeScript, gate-typechecked and
  gate-tested. No React, no Next.
- `src/app/**` is the only place a framework appears. It is syntax-gated by
  `pnpm check:syntax` and type-checked by `next build`.

## The visual layer

The site implements the captain-accepted `Umbrella Site` design screen (sceneaxi#157)
under **Foundations v2**. Ownership is split so a marketing edit cannot become a product
claim:

- **The token layer is not here.** `@sceneaxi/site-kit` owns the palette, the type scale,
  the surface ladder, and the status vocabulary (`docs/design-foundations.md`), and
  `src/lib/foundations.ts` emits that package's sheet plus three things derived from it:
  the surface accent, the status custom properties, and this site's layout metrics. The
  root layout inlines the result and **throws** if it refuses — a page whose token layer
  refused is not one this site serves with its palette quietly missing.
- `src/app/globals.css` is composition only. It declares no colour at all; a hex there
  would be a second source for a value site-kit already owns, and the gate asserts there
  is none. Across the whole site the gate scans every source for a colour literal and
  allows exactly two declared lists: the three **invented** colours in
  `UMBRELLA_RECORDED_GAPS`, each with the archive gap it fills, and the Foundations
  values `src/lib/viewport-letterbox.ts` **restates** because the browser bundle cannot
  value-import site-kit — those are pinned back to `FOUNDATION_COLORS`, so a repalletted
  token fails rather than drifting.
- `src/lib/site-content.ts` is the page **content**, in pure TypeScript so the hermetic
  gate type-checks it. It derives every figure it can from the contract that owns it and
  restates only the sculpt pass order and the CLI exit-code table, both of which
  `tests/sites/umbrella-visual.test.ts` pins to `@sceneaxi/schemas` and `@sceneaxi/cli`.
- `src/lib/profile-matrix.ts` backs `/profiles`. It mirrors the profile conformance
  registry and the open-path demo policy — the sites tier may not import
  `@sceneaxi/schemas` — and computes every cell rather than storing one, so an unproven
  capability cannot be presented as claimed.
  `tests/sites/umbrella-profile-matrix.test.ts` holds the mirror in lockstep with both
  contracts and drives the derivation with adversarial rows.
- `tests/sites/umbrella-visual.test.ts` asserts what the surface may **not** claim — no
  installer, size, or digest this repository does not build; no seat or subscription
  price; no registry install; no widened shipping claim; no Kids link; no ledger write
  from the account surface; and no re-attempt affordance on a refusal — plus the token
  layer, the accessibility structure, and the responsive structure.
- `VISUAL-EVIDENCE.md` records the browser observations: viewports, measured overflow,
  Lighthouse accessibility scores, measured contrast, and the live frame report.

Two client components carry the visual layer's behaviour, and both are deliberate:
`src/app/_components/site-nav.tsx` exists only to resolve `aria-current`, and
`src/app/_components/hero-viewport.tsx` draws the hero's real artifact through the shared
renderer boundary. The gate asserts the client-component list.

### Named states

Every refusal, warning, and confirmation renders through the thin React adapter
`src/app/_components/state-panel.tsx`, over the browser-safe shared model exported from
`@sceneaxi/site-kit/state-panel`: a Foundations status chip, the state's name, and —
always, never behind a disclosure — the contract's own key in mono. It offers no re-attempt affordance, because nothing here
decides whether a refused operation may be tried again. A panel that is a page's first
section under its `h1` passes `level={2}` so the document never jumps a heading level.

The header carries three things that all have to stay readable, so it is responsive too:
one row above `620px` with the key's column bounded, two rows below it with the key at
full width under the name. Neither shape may shorten the key — the whole point of the
panel is that the key is the half a reader files an issue with — so the header changes
shape rather than the key changing length. `tests/sites/umbrella-visual.test.ts` asserts
that structure, after a track collapse that no overflow sweep or accessibility audit could
see; `VISUAL-EVIDENCE.md` records the measurement and names that blind spot.

## The viewports (`/`, `/open`, and `/editor`)

The umbrella owns every viewport ([ADR 0022](../../docs/adr/0022-umbrella-owns-the-public-viewport.md)
and its 2026-07-26 amendment), so it is the one site allowed to depend on
`@sceneaxi/engine-presentation`. Nothing else changes about the tier: no other engine
package is reachable from any site, and the two catalogs keep `site-kit` only.

The marketing hero on `/` is the third caller. It draws a **real Sculpt Artifact** — the
same composed `MountableScene` the public open path serves — rather than bespoke
procedural geometry, so the picture behind the headline rests on the same artifact and
digest chain the gate proves. It mounts a snapshot and nothing more: no kernel session is
advanced, no control is offered, and the interactive path stays one click away at `/open`.
What the hero can show is what a real artifact can express, and the composition is
designed around that rather than around widening the contract.

"No control is offered" is enforced rather than described. `useSculptViewport` takes a
`presentation`, and the two are a product distinction, not a tuning knob:

- `interactive` — what `/open` and `/editor` mount. Orbit and zoom are attached to the
  canvas and the loop runs for the life of the mount, which is what their own copy
  promises.
- `snapshot` — what the hero mounts. No input is attached, the canvas keeps the touch
  gestures the page needs so a swipe that starts on the art still scrolls, and the loop
  draws only until the frame **settles** and then stops. Settled is the core's own report
  — pixels reached a buffer, reconciliation has nothing left to apply, every wanted
  instance is in the frame — so a stopped hero is a finished one rather than one frozen
  part-way through opening, and its provenance line is still the running core's, not the
  page's. Because a stopped surface has no next frame to recover on, everything that can
  invalidate the settled frame asks for another one by name: a resize, a
  device-pixel-ratio change, a restored WebGL context, and a change to what the caller
  wants mounted. A *lost* context drops the frame report first, so a provenance line
  never outlives the pixels it describes. Being still art rather than a target, that
  canvas is also the one that takes `role="img"`, which is what makes its label
  dependable.

- `src/app/_components/sculpt-viewport.tsx` is the **only** file on the site that
  constructs a renderer, and it touches it only through the ADR 0002 seam: Sculpt
  Mount API, numeric orbit controls, and the package's own frame loop. No Three type
  is named. Both routes are thin callers of it, and a gate test asserts that owner
  list has exactly one entry.
- The **server** resolves what may be drawn, as contract data rather than geometry
  invented here: `src/lib/live-open.ts` for the public path, and the editor session's
  own composition projection for `/editor`. Both arrive as one `MountableScene` —
  validated Sculpt Artifacts plus `composeScene()` world transforms.
- `/open` is **public**: no sign-in, no credits, no editing operation.
- `/editor` is **entitled**, and access is decided before a session is constructed —
  a signed-out, unavailable, or unentitled request reaches no session, no composition,
  and no canvas, only the plane's own named refusal. Its viewport *draws* the composed
  scene: selection, transform edits, and play/pause/step stay server-side Minimum E2
  operations, so nothing here widens ADR 0020 entitlement or ADR 0003's general-E2
  bound.
- Each page reports the running core's own frame record (`backend`, `label`, draw
  surface, `pixelsDrawn`, draw calls, mounted instances), so a frame counter can never
  imply pixels that were never drawn. The editor additionally shows its *server*
  session's frame, which runs on the same core's headless surface and reports no
  pixels. `pnpm gate` proves both paths on that headless surface
  (`tests/e2e/umbrella-live-open-golden.test.ts`,
  `tests/e2e/umbrella-editor-viewport-golden.test.ts`); the pixel claims are recorded
  browser observations in `docs/three-presentation-core.md`.

## Separate install root

This site is the sole member of its own pnpm workspace, not a member of the
repository-root workspace. It keeps its own lockfile so the hermetic root install,
root lockfile, `tsc --build` graph, and gate runtime stay untouched by site framework
dependencies. `@sceneaxi/site-kit`, `@sceneaxi/engine-presentation`, `@sceneaxi/auth`,
and `@sceneaxi/billing` are consumed with `link:` specifiers and transpiled by Next,
because SceneAxi package exports are source-backed. None of them ships a provider SDK.
Their own dependencies — including `three` — resolve from the repository-root install, so
a clean builder must provision both roots (`docs/websites-deploy.md`).

    pnpm install      # from this directory
    pnpm dev
    pnpm build        # also generates public/engine-sdk/

## Identity plane

`src/lib/identity-plane.ts` is the single plug point, and it is wired: it builds the
`@sceneaxi/site-kit` identity, credits, and billing adapters over `@sceneaxi/auth` and
`@sceneaxi/billing`, and maps their named refusals onto the site refusal registry. It
implements no identity, no ledger, and no signature check of its own.

The credit-pack list and admin resolution are live on any deployment — the pack catalog
is read from a bundled module rather than a file, so it survives serverless output
tracing. Session verification, balances, and the hosted checkout redirect still need
provider handles — Better Auth, Neon, and the Stripe API, which ADR 0021 keeps outside
this repository — and arrive through `umbrellaPlaneHandles()` in that same file. Until
they do, those surfaces refuse with named reasons rather than showing an invented
session, balance, or checkout, and `/pricing` lists the packs with the Buy control
replaced by a disabled "Not for sale yet" marker.
`docs/websites-deploy.md` has the remaining activation steps and the env var list.

`SCENEAXI_SITE_EDITOR_PREVIEW=1` grants a banner-marked editor preview so the
Minimum E2 surface is demonstrable before then. Absent by default; server-side only.
