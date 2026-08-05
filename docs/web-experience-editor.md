# Simplified Web Experience editor

SceneAxi issue #197 adds the first-release Web Experience projection to the
entitled umbrella `/editor` route. It is deliberately smaller than the Engine
Desktop projection: one page/HTML document, one site canvas, injection of the
known starter asset, and an optional draw-only Three scene.

## Ownership and access

The access path is unchanged:

`sceneaxi.session` → `umbrellaRequestAuthority()` → the existing identity and
credits ports → `resolveUmbrellaEditorAccess()` → editor state and rendering.

The entitlement decision returns before either the game session or the Web
Experience view is constructed. An anonymous request, an unavailable identity
or credit plane, and a signed-in member without an entitlement therefore reach
no editor model and no canvas. The Web projection adds no identity dependency,
provider adapter, cookie, role, credit rule, or billing call. The guarded route
carries its encoded query string through the existing hosted-login `next`
contract, so sign-in returns to the same Web profile and reconstructs the same
document instead of opening the Game default.

The dependency matrix continues to deny profile packages to sites. The shared
vocabulary lives in
`packages/schemas/src/web-experience-authoring.ts`; `@sceneaxi/profile-web`
exposes it as `webExperienceAuthoring`, and site-kit consumes that same contract
for the deployable view. The umbrella imports site-kit only, so this ship does
not create a profile edge or a second auth stack.

## Authoring interface

The closed operation list is:

| Operation | Web behavior |
|---|---|
| `page.set-html` | edit the page title and bounded HTML payload |
| `site-canvas.configure` | select the `hero`, `split`, or `stack` canvas layout |
| `asset.inject` | inject the session's already-validated starter Sculpt Artifact by id; arbitrary URLs are not accepted |
| `three.embed` | mount the session's existing `MountableScene` through the umbrella's one presentation seam; draw-only, never a kernel advance |

Each accepted request projects a v1 text-canonical `SceneDocument`. Its canonical
serialized bytes produce the document digest and deterministic session id; the
URL carries the bounded inputs needed to reconstruct those bytes. It is not
durable account storage: the same URL rebuilds the same document, and changing
the form creates the next document. No provider or persistence behavior is
implied.

These four operations are a closed **Web profile document projection**, not
members of `WEB_EDITOR_SESSION_OPERATIONS` and not new Minimum E2 runtime
operations. They never call `createWebEditorSession`, advance a kernel, or widen
ADR 0003. The shared product shell may display the existing composed scene for
the optional draw-only Three viewport, but Web controls change only the canonical
Web document. `packages/site-kit/src/web-experience-editor.ts` owns the complete
form contract (names, bounds, options, and operation bindings); the React module
only renders it.

The desktop-only list (`sculpt.edit`, `scene.compose`, `runtime.advance`,
`animation.timeline`, `plugin.load`, `native.export`) is also closed. Each one
renders as an inert control carrying
`WEB_EXPERIENCE_DESKTOP_ONLY_OPERATION`; an unknown operation refuses
`WEB_EXPERIENCE_OPERATION_UNKNOWN`.

## Untrusted HTML and Three isolation

Authored HTML is supplied only as an iframe `srcDoc`. The iframe receives an
empty `sandbox` token set, so it gets no same-origin, script, form, popup,
top-navigation, or parent-DOM authority. A schema-owned CSP additionally
defaults all sources to `none`, disables scripts, connections, frames, objects,
forms, and base changes, and permits only inline styles plus data images. The
parent document never uses `dangerouslySetInnerHTML`.

The Three scene is not inserted into authored HTML. It is a sibling parent
surface rendered by the existing `EditorViewport` → `useSculptViewport` path,
with the server-composed `MountableScene` as its only payload. No Three type and
no engine implementation crosses into the Web Experience contract.

## Proof

- `packages/profile-web/test/authoring.test.ts` — closed subset, desktop and
  unknown refusals, immutable sandbox policy.
- `packages/site-kit/test/web-experience-editor.test.ts` — deterministic state,
  canonical document/digest, form contract, operation separation,
  HTML/canvas/asset/Three paths, malformed input, and refusal projection.
- `tests/sites/web-experience-editor.test.ts` — no-session,
  login continuation, denied-entitlement, entitled-member, route-order,
  thin-renderer, sandbox, single viewport, and no-second-auth assertions.
- Existing identity wiring, editor viewport golden, site boundary, visual, and
  full gate suites remain mandatory.

## Recorded browser evidence (2026-08-05)

Chrome at 1440×1000 with the server-only preview gate demonstrated the surface
without creating an account or touching billing. `?profile=web` selected the Web
projection; the authored page rendered at `about:srcdoc` with an empty `sandbox`
attribute and the pinned CSP, while the parent contained none of the authored
markup. The optional Three canvas measured 745×269, reported
`webgl-canvas` / `pixels drawn true`, and all six desktop-only controls exposed
their named refusal. Submitting a changed title rebuilt the URL and changed the
deterministic session digest while retaining the sandbox and selected web state.
