# ADR 0017: Three.js is the product presentation core (Stage 1 unaffected)

- **Status:** Accepted — records a standing captain product decision; this ADR
  does not re-decide it and does not adjudicate the Stage 1 proof.
- **Date recorded:** 2026-07-25
- **Source:** SceneAxi engine product program frozen shared understanding
  (locked decision #11, captain grill closed 2026-07-25) and its routed decision
  file `three-product-core-vs-stage1-hold.md`; consumer copy of the canonical
  product spec is [`docs/program/SPEC.md`](../program/SPEC.md)
  ([sceneaxi#1](https://github.com/Vhailors/sceneaxi/issues/1) wins on
  disagreement).
- **Lineage:** Amends [ADR 0008](0008-experimental-three-preview-non-decision.md)
  for product surfaces; constrained by, and does not change,
  [ADR 0002](0002-presentation-runtime-deep-seam.md).

## Context

ADR 0008 permitted an explicitly experimental Three adapter, labelled as a
non-decision, because renderer composition was an open question. That posture
described the code accurately while the adapter only built a scene graph.

Two things then changed. The captain took a standing product decision that
Three.js **is** the presentation/runtime core for SceneAxi product surfaces, and
the program requires a live open path where a committed Sculpt Artifact reaches
an interactive browser canvas. Product surfaces therefore need a real renderer —
`WebGLRenderer`, a camera, canvas mount, and a frame loop — and honest UI copy.

Continuing to label the product core "experimental — non-decision" would have
misdescribed both the decision and the code.

## Decision

Three.js is **the** product presentation core of SceneAxi, implemented behind the
unchanged ADR 0002 deep seam.

Normative properties:

- **The seam does not change.** `mount / present(snapshot, events, alpha) /
  capture / dispose` plus the Sculpt Mount boundary remain the external contract,
  and **no Three type crosses it** — camera control is plain numbers, and draw
  surfaces receive renderable values as opaque handles.
- **One renderer path.** There is exactly one Three core. It runs on two draw
  surfaces: the real `webgl-canvas` surface (`WebGLRenderer` bound to a canvas,
  draws pixels, PNG `capture`) and the deterministic `headless` surface for
  non-visual gates (flushes matrices, reports the meshes a renderer would draw,
  never claims pixels, never captures). Two real adapters satisfy
  [ADR 0004](0004-no-plugin-ports-before-two-adapters.md) for that internal port.
- **The null presentation path stays.** It remains the no-backend gate path.
- **UI-facing identification is honest.** Product surfaces use **Three
  presentation core**; a headless run identifies itself as **Three presentation
  core — headless surface, no pixels drawn**. The former mandatory string
  "Experimental Three preview — non-decision; Stage 1 has not run." is retired
  and must not be reintroduced for product surfaces.
- **No multi-backend abstraction is built.** The deep seam is kept for
  cleanliness and swap safety, not to host a second renderer.

## Consequences

- Product copy, docs, and the `SculptPresentationFrame` backend id (`three`) now
  match the code, and a frame states its surface and whether pixels were drawn.
- Gates stay deterministic in node, which has no WebGL: the headless surface
  keeps existing golden draw-call evidence, and the canvas path is verified in a
  real browser.
- A future renderer change is still a behind-seam change, because backend hiding
  and the non-mutation invariant are untouched.
- Presentation still never advances simulation; `present` consumes read-only
  kernel snapshots (ADR [0001](0001-game-kernel-command-snapshot-session.md)).

## Rejected alternatives

- **Keep the experimental non-decision label on product surfaces** — dishonest
  once the captain chose Three and the core draws real pixels.
- **Wait for the Stage 1 bake-off before choosing a product core** — the
  program's frozen understanding explicitly removes Stage 1 as a blocker for this
  product decision; the proof remains separately gated.
- **Expose Three objects (camera, scene, renderer) across the seam** — would make
  the renderer contagious and break ADR 0002 backend hiding; consumers get a
  numeric camera-control API instead.
- **Build a renderer-agnostic facade now** — speculative generality rejected by
  ADR 0002 and ADR 0004; the second "adapter" here is a draw surface, not a
  second renderer.
- **Drop the headless path so every frame is a real frame** — would make node
  gates non-deterministic or impossible and delete existing golden evidence.

## Settled here vs held elsewhere

**Settled:** Three.js as the product presentation core, retirement of the
experimental non-decision label for product surfaces, one-renderer-two-surfaces
shape, and the unchanged ADR 0002 seam.

**Held, untouched by this ADR:** Stage 1 proof run authorization, its execution,
its adjudication, and any claim about which arm would win it — this ADR is a
**product** decision and must never be cited as a Stage 1 result or against any
other arm. The `kernel-name` captain hold ("Three Kernel" as a working name)
stays open. Kids safety decisions, live registry publication, and general E2
remain out of scope.
