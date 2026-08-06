# @sceneaxi/site-umbrella

The deployable SceneAxi umbrella site: product and docs, the **public live open
path**, the profile capability matrix, the public engine SDK download, hosted
sign-in, the verified Linux workflow artifact `/engine` links from its exact repository
run (built from `desktop/linux`, never served here —
[`docs/desktop-linux.md`](../../docs/desktop-linux.md)),
the account surface, credit packs, and the entitled editor with Engine Desktop and
simplified Web Experience projections.

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
  value-import the Node-bearing site-kit root barrel, and the tokens have no narrow
  browser-safe entry the way `@sceneaxi/site-kit/state-panel` does — those are pinned back
  to `FOUNDATION_COLORS`, so a repalletted token fails rather than drifting.
- `src/lib/site-content.ts` is the page **content**, in pure TypeScript so the hermetic
  gate type-checks it. It derives every figure it can from the contract that owns it, and
  every collection it still exports is read by a route: `tests/sites/umbrella-visual.test.ts`
  asserts that join, so copy whose surface is retired is removed rather than left here
  reading as shipped product text. The sculpt-pass, propose/apply diff, terminal, CLI
  exit-code, and family-map content went that way with sceneaxi#203's overview rewrite.
- `src/lib/profile-matrix.ts` backs `/profiles`. It reads the canonical profile
  conformance registry and open-path demo policy through the narrow browser-safe
  `@sceneaxi/site-kit/profile-contracts` entry and computes every cell rather than
  storing one, so an unproven capability cannot be presented as claimed.
  It keeps only the column headers as page-local copy: `PROFILE_DISPLAY_NAMES` pins one
  label per profile id and refuses an id it does not carry, so a new policy row must be
  given a decided label in the same commit rather than one munged from its package name.
  `tests/sites/umbrella-profile-matrix.test.ts` asserts reference identity with both
  schema contracts, pins every label, covers the unknown-profile refusal, and drives the
  derivation with adversarial rows.
- `tests/sites/umbrella-visual.test.ts` asserts what the surface may **not** claim — no
  installer, size, or digest this repository does not build; no seat or subscription
  price; no registry install; no widened shipping claim; no Kids link; no ledger write
  from the account surface; and no re-attempt affordance on a refusal — plus the token
  layer, the accessibility structure, and the responsive structure.
- `VISUAL-EVIDENCE.md` records the browser observations: viewports, measured overflow,
  Lighthouse accessibility scores, measured contrast, and the live frame report.

### First-release overview

The default route is the first-release information architecture from sceneaxi#203:

- `src/lib/download-platform.ts` resolves desktop user-agent copy without ever creating
  an artifact URL. Linux reaches the existing `/engine` evidence route; macOS and
  Windows remain `coming-soon` rows with no href. Linux's state is `recorded-build`,
  labelled "Recorded build", because that is what `desktopLinuxAppOffer()` serves: a
  build from source or the named CI workflow artifact, against recorded checksums. No
  row may say "Available" of a desktop binary this site does not serve, and each state
  carries its own rendered words so no component can shorten one. Which platforms are
  packaged stays that offer's fact: `tests/sites/desktop-offer-lockstep.test.ts` binds
  the table to its `unavailablePlatforms` list, so packaging shipping fails the gate
  instead of leaving a stale "Coming soon" row here.
- `src/lib/launch-marketing.ts` owns the frozen trust, comparison, and profile-launch
  projections. The Unity, Godot, and Three.js rows link to each project's own product
  description, carry no score, and state where SceneAxi is narrower.
- `src/app/page.tsx` renders those projections around the existing real-artifact hero.
  It does not import or duplicate `/engine` artifact, checksum, billing, identity, or
  desktop implementation logic.
- `tests/sites/umbrella-launch-marketing.test.ts` tests the pure content and detection
  seams. `test/first-release.visual.spec.ts` drives the rendered route at default,
  short-height, and both sides of its breakpoints; it also tests real Tab focus and
  contrast after browser compositing rather than comparing declared token strings. It
  pins the user agent it navigates with, so platform detection is measured against that
  agent rather than against the workstation running the suite.

Run the browser checks from this install root:

    pnpm exec playwright install chromium   # once, unless a system browser is used
    pnpm test:visual

The suite needs a Chromium binary. `SCENEAXI_CHROME_PATH` names one explicitly;
otherwise `/usr/bin/chromium` is used when present, and Playwright's own download
otherwise. The browser sandbox stays on unless `CI` or `SCENEAXI_CHROME_NO_SANDBOX=1`
says the environment cannot provide it.

`pnpm typecheck` covers this suite: `tsconfig.json` is the shipped app and
`tsconfig.test.json` is `playwright.config.ts` plus `test/**`, so a spec that stops
compiling fails the same command rather than only failing when a browser is available.

Three overview client components carry the visual layer's behaviour, and all are deliberate:
`src/app/_components/site-nav.tsx` exists only to resolve `aria-current`, and
`src/app/_components/hero-viewport.tsx` draws the hero's real artifact through the shared
renderer boundary. `src/app/_components/download-cta.tsx` changes detected-platform copy
only; it cannot change the stable `/engine` destination or an availability state. The gate
asserts the complete client-component list.

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
  and no canvas, only the plane's own named refusal, rendered as its named access
  state (`describeSiteAccessState` in `@sceneaxi/site-kit`) with the one action that
  can change it. Its viewport *draws* the composed
  scene: selection, transform edits, and play/pause/step stay server-side Minimum E2
  operations, so nothing here widens ADR 0020 entitlement or ADR 0003's general-E2
  bound. The viewport is one region of the **Engine Desktop shell** the route draws
  for the Game profile (sceneaxi#184) — server-built by `buildEditorShellView()` in
  `@sceneaxi/site-kit`, drawn by the one client component
  `src/app/editor/_components/editor-shell.tsx`, and given the whole window by
  `src/app/editor/layout.tsx`, which collapses the site masthead, footer, and skip
  link for this route alone. What that shell decides, what refuses, where it departs
  from the design archive, and its recorded browser evidence are owned by
  [`docs/web-editor-shell.md`](../../docs/web-editor-shell.md). A `?profile=web`
  request draws the deliberately smaller Web Experience projection around that same
  viewport instead (sceneaxi#197) — authored page/HTML in a sandboxed frame, one site
  canvas, known-asset injection, and the draw-only Three embed, with desktop-only
  actions inert and named — owned by
  [`docs/web-experience-editor.md`](../../docs/web-experience-editor.md).
- Each page reports the running core's own frame record (`backend`, `label`, draw
  surface, `pixelsDrawn`, draw calls, mounted instances), so a frame counter can never
  imply pixels that were never drawn. The editor additionally shows its *server*
  session's frame, which runs on the same core's headless surface and reports no
  pixels. `pnpm gate` proves both paths on that headless surface
  (`tests/e2e/umbrella-live-open-golden.test.ts`,
  `tests/e2e/umbrella-editor-viewport-golden.test.ts`); the pixel claims are recorded
  browser observations in `docs/three-presentation-core.md`.

## Hosted sign-in (`/login`, sceneaxi#185)

Real Better Auth login into the entitled editor, over the existing identity plane:

- On a wired deployment, `/login` renders the form; `POST /api/login` drives `performLogin`
  (`src/lib/login-flow.ts`), which signs in through the plane's login port —
  `createAuthLoginAdapter` over the deployment's `IdentityPort` handle — and answers
  with a 303 plus the one HttpOnly `sceneaxi.session` cookie, whose lifetime is the
  session's own. `POST /api/logout` deletes the stored session through the same port
  and clears the cookie unconditionally — unconditionally about *this* browser's own
  request, since a submission that fails the origin proof below is refused before the
  port is reached and nothing is revoked or cleared from it.
- Both endpoints refuse a submission that cannot prove it came from these pages
  (`SITE_REQUEST_CROSS_ORIGIN`, decided by site-kit's `verifySiteFormOrigin` through
  `verifyLoginRequestOrigin`). `SameSite=Lax` does not cover this: a sign-in POST carries
  no cookie yet, so nothing is withheld from it and the browser stores the `Set-Cookie`
  it answers with — a cross-site page could otherwise sign a visitor into an account it
  chose, or force theirs out. The proof is a **required argument** of `performLogin` /
  `performLogout` rather than a check inside a route, so a new route cannot forget it;
  the expected origin is the configured `NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN`, and only
  an unconfigured deployment falls back to the request's own origin.
- The cookie's `Secure` attribute is a deployment fact, not a request artifact:
  `resolveSessionCookieSecurity` reads `NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN` — the same
  configured origin checkout redirects come from — so a TLS-terminating proxy, behind
  which the app's own request is plain http, cannot cause the credential to be issued
  without it. Only an unconfigured deployment falls back to `x-forwarded-proto` and then
  to the request, which is what keeps `http://localhost` development working.
- Nothing identity-shaped is trusted from the browser: email and password go to the
  injected provider, the destination `next` is confined to a same-site relative path,
  a client role claim refuses before dispatch, and every refusal — wrong password,
  expired or foreign session, disabled user, Kids, unwired or failed provider — comes
  back as its own named access state rather than one undifferentiated wall. Those
  refusals are read through `siteReasonForLoginAuthReason`, the issuance mapping, so a
  provider fault at sign-in is named as one instead of accusing a credential no browser
  presented; `docs/auth-credits.md` owns which reasons are renamed and which are not.
- A refused surface hands its own path to the sign-in action it renders, so a visitor
  bounced off `/editor` signs in and lands back on `/editor` instead of the default
  `/account`. The editor hands its whole request target, query included, so the
  state a visitor was refused on — profile and all — is the state they come back to.
  Emitting and reading that destination share one confinement rule —
  site-kit's `confineSiteRelativePath`, which `siteLoginHref` and
  `resolveLoginDestination` both go through — so a link this site emits can never carry
  a `next` the login flow would then discard, and a hostile one degrades to the plain
  form rather than refusing the sign-in. A destination long enough to push the link
  past `SITE_LOGIN_HREF_MAX_LENGTH` degrades the same way, since `next` escapes it a
  second time; [`docs/web-experience-editor.md`](../../docs/web-experience-editor.md)
  owns why that ceiling sits on the link rather than on each surface.
- The temporary `SCENEAXI_SITE_EDITOR_PREVIEW` flag remains a labeled stopgap, not the
  product path; the flow is proven end-to-end against the real identity port in
  `tests/sites/identity-plane-wiring.test.ts` ("hosted login") and
  `tests/sites/umbrella-login-flow.test.ts`, with the provider injected and no network.

## Separate install root

This site is the sole member of its own pnpm workspace, not a member of the
repository-root workspace. It keeps its own lockfile so the hermetic root install,
root lockfile, `tsc --build` graph, and gate runtime stay untouched by site framework
dependencies. `@sceneaxi/site-kit`, `@sceneaxi/engine-presentation`, `@sceneaxi/auth`,
and `@sceneaxi/billing` are consumed with `link:` specifiers and transpiled by Next,
because SceneAxi package exports are source-backed. The deployment-only Neon and Stripe
clients live in this site's install root, never in the hermetic package graph. Their
other dependencies — including `three` — resolve from the repository-root install, so a
clean builder must provision both roots (`docs/websites-deploy.md`).

    pnpm install      # from this directory
    pnpm dev
    pnpm build        # also generates public/engine-sdk/

## Identity plane

`src/lib/identity-plane.ts` is the single plug point, and it is wired: it builds the
`@sceneaxi/site-kit` identity, credits, and billing adapters over `@sceneaxi/auth` and
`@sceneaxi/billing`, and maps their named refusals onto the site refusal registry. It
implements no identity, no ledger, and no signature check of its own.

The credit-pack list is live on any deployment — the pack catalog is read from a bundled
module rather than a file, so it survives serverless output tracing.
`provider-adapters.ts` maps deployment-owned Better Auth, Neon, and Stripe TEST clients
onto the existing `@sceneaxi/auth` and `@sceneaxi/billing` seams. The no-argument
`umbrellaRequestAuthority()` facade holds the deployment's one resolved registry and
exposes only request evidence methods. Request planes accept only a carried session
credential, and the webhook route accepts only raw bytes plus the signature header;
neither can replace the deployment authority. The boundary checker denies direct access
to the owner modules, provider adapters, and root barrel from request code and arbitrary
library modules. Absent configuration still refuses with named reasons rather than
showing an invented session, account, balance, or checkout. Account provisioning is an
idempotent user-plus-credit-account insert at authentication, which
reconciles the provider-owned address and verification state each time, never a
payment-event side effect. The Better Auth client reads the session back from
`GET /api/auth/get-session`, sending both the issued session cookie and the issued bearer
token so either provider configuration resolves; a provider that honours neither throws a
named fault instead of reporting a valid password as refused
(`docs/websites-deploy.md` owns that prerequisite). Hosted sign-in reaches
`identityPort.signIn` through this same plug point
([sceneaxi#185](https://github.com/Vhailors/sceneaxi/issues/185), see **Hosted sign-in**
above); a deployment whose provider handles are absent issues no session and refuses by
name instead. `docs/websites-deploy.md` owns the env names and wiring mechanics;
`docs/production-activation.md` owns the ordered activation and rollback procedure.

`SCENEAXI_SITE_EDITOR_PREVIEW=1` grants a banner-marked editor preview so the
Minimum E2 surface is demonstrable until those handles are configured. Absent by
default; server-side only.
