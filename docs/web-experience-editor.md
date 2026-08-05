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
document — multi-line documents included — rather than opening the Game default.
`confineSiteRelativePath` reads its two rules at the two levels that make each
true: route *structure* on the decoded path, so no escape smuggles an authority
or a second segment past it, and header safety on the encoded value actually
emitted, where a newline inside a query stays three printable characters. A
literal control character is still not a destination, wherever it appears.

That round trip holds up to the sign-in link's own ceiling, not unconditionally:
past `SITE_LOGIN_HREF_MAX_LENGTH` the destination is dropped and the visitor
signs in to a fresh Web session instead. Measured against that 4,000-character
bound, ordinary prose markup carries the whole 2,000-character HTML field bound
(a ~3,300-character link), attribute-dense markup carries to roughly 1,500
source characters, and multi-byte text to a few hundred. See **The submission
bound** below for why the link amplifies and why losing the destination is the
chosen degradation.

The active profile is chrome state, and — like the active mode — it is carried on
every navigation the shell renders. `hrefInViewState` writes it onto editor
hrefs, and each body submits the profile it *is*: the Web projection's form
carries the contract's own `view.form.profile` field, while the Game body's form
names no profile at all — exactly what `hrefInViewState` writes for Game via
`params.delete("profile")`. So leaving the Web profile is not undone by the next
link, and staying in it is not undone by the next submit. The shell holds no
`name="profile"` of its own, and `tests/sites/web-experience-editor.test.ts`
asserts that: a hidden field there would be a second spelling of a contract
site-kit already owns. Kids is never written to a URL; it stays the refuse-only
client projection with no request state.

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

## The submission bound

The session lives in the URL, so the submission path has a size a platform can
answer before any SceneAxi code runs. `WEB_EXPERIENCE_REQUEST_TARGET_MAX_LENGTH`
(4,000 characters of `/editor?…`) is therefore the bound that matters, and
`readWebExperienceEditorState` enforces it on the **reconstructed target** built
by `webExperienceRequestTarget()` rather than on any single field — a field only
contributes to the quantity a platform measures. Over-budget state refuses
`SITE_REQUEST_TARGET_TOO_LONG` by name.

The sign-in link derived from that state is bounded separately and at the same
number, by `SITE_LOGIN_HREF_MAX_LENGTH` in `access-states.ts`. It needs its own
ceiling for two reasons: `/login?next=…` escapes the destination a second time,
so every `%XX` triplet becomes `%25XX` and the link runs larger than the target
it carries — measured at ~1.4× for ASCII markup and ~1.65× when the target is
mostly percent-escapes; and the anonymous and unentitled paths build `next` from
the raw request and refuse **before** editor state is parsed, so the budget above
never sees them. Over the ceiling the continuation is dropped and the plain
`/login` is emitted — a worse sign-in, but not a link an edge answers with an
unnamed 414 or 431. Both bounds together are what make the claim below true of
every URL this surface emits, not just of the editor target.

Because the link amplifies and both ceilings are the same number, a document can
sit inside the request-target budget and still lose its continuation. That is the
band quoted under **Ownership and access** above: prose markup carries the full
field bound, attribute-dense markup roughly 1,500 source characters, multi-byte
text a few hundred. Raising the sign-in ceiling alone would only move the
unnamed platform answer back onto the link, so the degradation is the trade
rather than a gap.

The budget is self-imposed and deliberately well under the ceilings it sits
below — an 8 KiB request line at the narrowest edge, a 16 KiB header block in
Node — so the session cookie, the method, and the version all fit beside it, and
so state between our bound and any platform's is answered here rather than as an
unnamed 414 or 431. The field bounds (80-character title, 2,000-character HTML)
are what keep ordinary authored markup inside it: a 2,000-character document of
dense markup encodes to roughly 3–6 KB, which is why the HTML bound is not the
5,000 the first draft carried. A document that is *both* at the field bound and
almost entirely multi-byte still encodes past every ceiling; that residual case
is the one the platform answers first, and it is recorded here rather than
claimed away.

POST was considered and rejected: the state is the URL by design (deep links,
deterministic reconstruction, and the login continuation below all read it), and
a POST would still have to redirect to the same target, so it moves the bound
rather than removing it.

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
  HTML/canvas/asset/Three paths, malformed input, cleared-field fallback, the
  request-target budget, and refusal projection.
- `packages/site-kit/test/access-states.test.ts` — same-site confinement, the
  encoded multi-line destination that survives it with nothing raw emitted, and
  the sign-in link's own ceiling.
- `tests/sites/web-experience-editor.test.ts` — no-session,
  login continuation (single- and multi-line), denied-entitlement,
  entitled-member, route-order, profile carry, thin-renderer, sandbox, single
  viewport, and no-second-auth assertions.
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
