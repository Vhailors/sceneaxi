# ADR 0022: The umbrella site owns the public viewport and consumes the presentation seam directly

- **Status:** Accepted — **Amended 2026-07-26** by Step-ladder Step 5
  (`T1-min-e2-viewport`, [sceneaxi#133](https://github.com/Vhailors/sceneaxi/issues/133)):
  the same one edge now also carries the **entitled** Minimum E2 editor viewport.
  See *Amendment* below.
- **Date recorded:** 2026-07-25
- **Source:** Step-ladder Step 4 (`T1-live-open-path`) captain order — a public
  user must be able to open a real SceneAxi artifact in a live Three.js canvas on
  the umbrella site.
- **Lineage:** Extends [ADR 0018](0018-sites-tier-three-vercel-one-neon.md) (the
  `sites/` tier) by one charted edge; constrained by, and does not change,
  [ADR 0002](0002-presentation-runtime-deep-seam.md) and
  [ADR 0017](0017-three-product-presentation-core.md); consumes
  [ADR 0014](0014-scene-composition-contract.md)/[0015](0015-scene-minimal-multi-object-open-path.md)
  placement unchanged; does not touch
  [ADR 0003](0003-editor-sequencing-e1-first-e2-specified.md) or
  [ADR 0020](0020-minimum-e2-web-editor-entitlement.md).

## Context

ADR 0018 gave the `sites/` tier one rule about engine code: a site consumes
`@sceneaxi/site-kit` and nothing else, because everything a site did was
non-visual and belonged in a package the hermetic gate could test.

The live open path is the first site behaviour that is not like that. Drawing a
committed Sculpt Artifact into a real `WebGLRenderer` needs the Three
presentation core in the **browser**, and that core is
`@sceneaxi/engine-presentation`. Three routes were available:

1. Re-export the presentation seam through `site-kit`. That drags `three` into
   the package every site links, into the hermetic `tsc --build` graph, and into
   two catalog bundles that draw nothing.
2. Copy a renderer into the site. A second renderer path, against ADR 0017's
   "exactly one Three core".
3. Let the one site that owns a viewport depend on the presentation seam.

## Decision

**`@sceneaxi/site-umbrella` may depend on `@sceneaxi/engine-presentation`. No
other site may, and no site may reach any other engine package.**

Normative properties:

- **One edge, named in the matrix.** `docs/dependency-matrix.json` lists exactly
  `@sceneaxi/engine-presentation` on the umbrella's allow list. Kernel,
  orchestrator, authoring-core, profiles, a service locator, and Kids stay denied
  to every site, and `check:boundaries` refuses the moment that changes.
- **The seam is consumed, not widened.** The site calls
  `createThreeSculptPresentationBackend` / `createSculptMountApi` /
  `createThreeRenderLoop` and the numeric orbit controls. No Three type is named
  in site code, exactly as ADR 0002 requires of any consumer.
- **The scene crosses as contract data.** What the browser receives is a
  validated Sculpt Artifact plus composed world transforms — the output of
  `composeScene()`. The site invents no geometry, and placement stays a
  projection: no artifact is rewritten to place it.
- **`site-kit` stays framework-free and node-safe.** Which fixture is opened,
  how it is placed, the evidence digest, and the vocabulary the page may use live
  in `site-kit`, so `pnpm gate` decides all of it without a browser. Only the
  umbrella's `src/app/` tree touches a canvas.
- **The path is public.** It carries no identity, consumes no credits, and is not
  the Minimum E2 editor. ADR 0020's entitlement bound and ADR 0003's
  general-E2-specified-not-built bound are both untouched: viewing is not
  authoring, and this path exposes no editing operation.
- **Copy matches the decision.** The page identifies the core as **Three
  presentation core** (ADR 0017). The retired "Experimental Three preview —
  non-decision" framing, and any claim of a renderer contest or Stage 1 result,
  are refused by a gate test rather than by review habit.

## Consequences

- `sites/umbrella/package.json` carries a second `link:` dependency and
  `next.config.ts` a second transpiled package. The Vercel install command
  already provisions the repository root, so nothing about deployment changes.
- `three` enters the umbrella's client bundle only. The two catalog sites, the
  hermetic root lockfile, and the gate runtime are unaffected.
- The gate proves the path without a browser: `tests/e2e/umbrella-live-open-golden.test.ts`
  drives the served scene through the Mount API onto the headless surface, and
  asserts the canvas path really constructs a `WebGLRenderer` — which must fail in
  node. Pixels are verified in a real browser and recorded in
  `docs/three-presentation-core.md`.
- `tests/boundary/injected-site-violations.test.ts` gains the negative cases: a
  catalog site importing the presentation seam still fails, and every other engine
  package is still denied to the umbrella.

## Amendment — the entitled editor draws through the same edge (2026-07-26)

Step 5 gave the Minimum E2 editor at `/editor` a real WebGL viewport. Nothing in
the decision above changes: it is the same site, the same one matrix edge, the
same ADR 0002 seam, and the same single Three core. What the amendment records is
that "the umbrella owns the viewport" now covers **two** surfaces, one public and
one entitled, and what stays true across both:

- **One renderer-owning module.** `sites/umbrella/src/app/_components/sculpt-viewport.tsx`
  is the only file on the whole `sites/` tier that constructs a backend; `/open`
  and `/editor` are thin callers of it. A gate test asserts that list has exactly
  one entry, so a third surface cannot quietly grow a second renderer.
- **One browser payload.** Both surfaces hand the browser a `MountableScene` from
  `@sceneaxi/site-kit` — validated Sculpt Artifacts plus `composeScene()` world
  transforms. The editor's scene is its own session's composition projection, so
  the canvas cannot draw a scene the editor did not compose.
- **Drawing is not authoring.** The viewport consumes a composed snapshot. It
  holds no kernel session, advances nothing, and adds no operation to the frozen
  `WEB_EDITOR_SESSION_OPERATIONS` checklist. Selection, transform edits, and
  play/pause/step remain server-side Minimum E2 operations. ADR 0003's
  general-E2-specified-not-built bound is untouched.
- **Entitlement is unchanged and still decided first.** ADR 0020 decides access
  before a session is constructed, so a signed-out, unavailable, or
  insufficient-entitlement request reaches no session, no composition, and no
  canvas — it renders the plane's own named refusal. The public path stays public
  and the entitled path stays entitled; neither borrows the other's copy.
- **The server frame is honest.** A server has no drawing buffer, so the editor's
  server-side session runs on the same core's headless surface and reports
  `pixelsDrawn: false`. A frame counter never implies pixels.

## Rejected alternatives

- **Re-export presentation through `site-kit`** — pushes `three` and a renderer
  into every site and into the hermetic build graph, to serve one viewport.
- **A second renderer in the site** — a second Three core, against ADR 0017.
- **A server-rendered image instead of a canvas** — `capture()` returns PNG bytes,
  but a still image is not an open path: no orbit, no zoom, no live frames, and it
  would need a GPU on a serverless builder.
- **Widening the allow list to the whole core train** — buys nothing this path
  needs and quietly makes the kernel reachable from a public web surface.
- **Putting the path behind editor entitlement** — the requirement is that a
  *public* user can open a real artifact; gating it would answer a different
  question and would drag identity into a page that needs none.

## Settled here vs held elsewhere

**Settled:** that the umbrella owns the public viewport, that its one engine edge
is the presentation seam, that the opened scene is contract data produced by the
composition pipeline, and that the page's presentation copy is gate-enforced —
and, per the amendment, that the entitled Minimum E2 viewport rides that same
edge through one renderer-owning module without widening entitlement or E2.

**Held elsewhere:** Stage 1 execution and adjudication; any renderer conclusion;
general E2 (ADR 0003); Kids; marketplace activation; custom domains; and the
identity/credits plane owned by `sceneaxi-auth-credits-v1`.
