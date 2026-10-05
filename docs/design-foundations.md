# SceneAxi Foundations v2 — shared visual tokens and site-kit primitives

Owner of this document: the shared visual layer in `packages/site-kit`
(`src/design-tokens.ts`, `src/site-element.ts`, `src/change-review.ts`,
`src/state-panel.ts`, `src/commerce-notice.ts`).
Behavioural contracts are owned elsewhere and win every disagreement — see
[Precedence](#precedence).

## Source authority

| Field | Value |
|---|---|
| Archive | `SceneAxi Design System.zip` |
| SHA-256 | `ad5d6e39215a4aee9c81b827308fc944784719168d3fba2db5d9e5ef8fc15159` |
| Token sheet | `SceneAxi Foundations.dc.html` (self-described "design foundations · v2 · matches every shipped surface") |
| Canonical issue | [sceneaxi#155](https://github.com/Vhailors/sceneaxi/issues/155), parent [#1](https://github.com/Vhailors/sceneaxi/issues/1) |

The archive is captain-accepted **visual** authority. Its checksum and per-file
manifest live outside this repository with the design source; `FOUNDATIONS_SOURCE`
carries the same checksum in code so a reviewer can re-derive any value.

## Precedence

Existing ADRs, schemas, refusal registries, and executable contracts win over
contradictory mockup copy or behaviour. The archive wins on purely visual facts —
a hex, a size, a radius, a rule about what a colour means.

**Desktop-first fork (2026-08-14).** Foundations v2 remains the visual authority
for `sites/`. The Engine Desktop now follows Cinematic Pro
(`docs/engine-desktop-surface.md`) as its own desktop-first language. Sites do
not adopt that language in this change. Captain D1's desktop-scope hex-equality
is superseded; the token alignment table records semantic roles instead.

Where the two disagree, this layer implements the contract and records the
difference rather than inventing product behaviour. Three such points are open and
recorded below.

## Why `packages/site-kit`

ADR 0018 makes every site its own install root with a `link:` dependency graph, and
the dependency matrix denies the catalogs the identity and engine packages. The one
package all three sites already depend on is `@sceneaxi/site-kit`, so putting the
token layer there costs no matrix edge. Foundations §06 keeps the surface accent a
per-site override ("accent shifts only"), which is exactly what
`foundationsCss({ surface })` emits.

The package stays framework-free. These modules emit **CSS text and typed data**;
they render nothing and import no framework. Only `sites/*/src/app/**` may import
React, so a shared primitive is a *description* of a component
(`SiteElement`), not a component.

## What ships

| Module | Owns |
|---|---|
| `design-tokens.ts` | the transcribed token tables, the contrast contract, and the CSS emitters |
| `site-element.ts` | the framework-neutral element tree and its escaping HTML serializer |
| `change-review.ts` | Change Review: the view model over a real `Proposal`, the decision resolution, the element tree, and the component CSS |
| `state-panel.ts` | the named-state model, Foundations status mapping, compact/diagnostic neutral trees, and refusal/evidence vocabulary |
| `commerce-notice.ts` | the storefront commerce-gate model, copy, viewer projection, and neutral tree |

Issue [sceneaxi#162](https://github.com/Vhailors/sceneaxi/issues/162) completed D2's
component half after the three visual lanes landed. React and Next remain site-local:
`state-panel.tsx`, `commerce-notice.tsx`, and `_session.ts` are thin framework adapters,
while their models, copy, refusal facts, element trees, credential names, and precedence
live here. Client adapters use the browser-safe `@sceneaxi/site-kit/state-panel` subpath;
they do not value-import the Node-bearing package root.

A site pairs the two stylesheets — `foundationsCss()` for the palette, scale and
shared parts, `changeReviewCss()` for the primitive — and loads Archivo and
JetBrains Mono itself (a package must not inject a network font).

### Tokens

Transcribed whole from §01–§04 and §06: 24 colour tokens in four groups, the ten-step
type scale over two families, the 4px spacing scale, six radii, five surfaces, six
status chips, four button sizes, and the surface → accent map. The token *names* are
the sheet's own (`--bg-base`, `--accent`, `--ok`), unprefixed on purpose — renaming
them would put this layer and the design source into permanent translation.

The three colour laws are carried as data because they are load-bearing rules, not
decoration: accent means pending, mint means verified, red means refused.

### Accessibility

Contrast is **measured in the gate, not asserted in a table**. Every foreground token
declares a `FoundationContrastRole`, and `packages/site-kit/test/design-tokens.test.ts`
measures it against all six neutral surfaces:

| Role | Floor | Tokens |
|---|---|---|
| `body` | 4.5:1 | `--fg`, `--fg-2`, `--accent`, `--accent-hi`, `--ok`, `--danger`, `--info`, `--axis-*`, `--kids`, `--store-*` |
| `large` | 3.0:1 | `--stale` |
| `non-text` | none claimed | `--fg-4` |

Two honest consequences, recorded rather than smoothed over:

- **`--fg-4` measures 1.77–2.10:1** on the neutrals. It is the sheet's disabled /
  timestamp / unit level and cannot carry text that matters. A test asserts it stays
  *below* the large-text floor, so nobody can quietly promote it.
- **`--stale` measures 3.02–3.57:1.** It is large-text-only by measurement. In Change
  Review it renders at 11px, below that threshold — which is acceptable only because
  the value it carries is redundant by construction: the row's badge and its mint new
  value carry the change, and the old value is being replaced. A surface that makes
  stale bronze the *only* carrier of a fact is using it wrong.

`contrastRatio()` and `meetsContrast()` are exported so a surface lane shifting the
accent can measure its own override against the shared neutrals.

### Change Review

Foundations §05 names this the signature component, and nothing in the `sites/` tier
rendered it. It now exists over the real propose/apply contract: every row is one
`ProposalEdit` from `@sceneaxi/schemas`, and every proposal in the tests comes from
`propose()`/`proposeMany()` rather than a literal shaped to match the mockup.

The sheet's four sub-rules land as behaviour:

| Rule | Implementation |
|---|---|
| 01 the leaf never truncates | `splitPointer()` yields a dim `path` and a bright `leaf`; only `path` may ellipsize |
| 02 old in stale bronze, new in mint — never red/green | `--stale` / `--ok`; `--danger` appears only on the reject affordance |
| 03 hash before and after, always visible | `beforeDigest` is the proposal's own `baseContentHash`; `afterDigest` is **projected** by replaying the edits in memory and hashing the result, so it is computed, not promised |
| 04 a stale proposal is refused, never merged | `CHANGE_REVIEW_PROPOSAL_STALE`, the same base-hash check `apply()` enforces |

Decisions resolve to exactly one of three outcomes, or a named refusal:

| Decision state | Result |
|---|---|
| any row undecided | `pending` — the accent stays on screen because work does |
| every row accepted | `apply` with the untouched proposal |
| every row rejected | `discard` |
| mixed | `CHANGE_REVIEW_PARTIAL_ACCEPT_UNSUPPORTED` |

## Recorded archive ↔ contract differences

These are the points where the mockup shows something the shipped contracts do not
support. Each is implemented the contract's way.

### D-1 · The `+` (added) badge is not an E1 proposal

The mockup's diff has two `+` rows with `—` as the old value. E1 `propose()` refuses
a JSON Pointer that does not already resolve (`invalid-pointer`), so an "add" is not
a proposal E1 can produce. The badge vocabulary here is `modify` and `unchanged` —
exactly what the contract can express. Restoring `+` requires an authoring-contract
change first (`docs/authoring-contracts.md`), not a rendering change.

### D-2 · Per-row accept, against all-or-nothing apply

The mockup offers per-row ✕/✓ *and* accept-all. A proposal applies all-or-nothing, so
honouring "accept these two, drop that one" would mean authoring a new, narrower
proposal — which belongs to `@sceneaxi/authoring-core`, not to a presentation
primitive. The per-row controls therefore function and drive the resolution, and a
mixed decision refuses by name. The operator re-proposes what they want.

### D-3 · Two visual facts the sheet does not state

- **`--fg-3`.** The sheet's "four text levels" note prints only three. The missing
  level is not invented; only `--fg`, `--fg-2`, `--fg-4` exist here.
- **Storefront hover accents.** The sheet prints `--accent-hi` for signal orange only.
  `resolveSurfaceAccent()` repeats the accent as its own hover for the other surfaces
  rather than inventing a lighter tint. A surface lane that needs one must record it
  as a design fact first.

Also stated rather than sourced: the Change Review **mobile reflow below 720px**. The
Foundations sheet is a fixed 1560px canvas and shows no mobile Change Review, so the
single-column stack is a decision taken to keep the panel free of horizontal overflow
at the 390px reference width the umbrella mockup does honour.

## Kids

`--kids` (`#A78BFA`) is transcribed, because the sheet also assigns it to scene
composition, and the Kids row stays in the descriptive `FOUNDATION_SURFACE_ACCENTS`
map so no visual fact is lost. `resolveSurfaceAccent("kids")` and
`foundationsCss({ surface: "kids" })` still **refuse** `KIDS_SURFACE_DENIED`:
the separate `sites/kids` origin may not import `site-kit` or any other SceneAxi
package, so the shared emitter cannot become its theme dependency.

Issue #200 records the first Kids-specific composition in
[`kids-first-release.md`](kids-first-release.md): the archive's violet, 16px surface
radius, larger controls, no assistant, and a grown-ups disclosure; dark Foundations
neutrals; plus the three world background pairs implemented in
`sites/kids/src/app/globals.css`. Those world colors are a #200 product decision,
not a new shared token. They stay site-local and claim no palette authority outside
the isolated Kids origin.

Because that origin may not import this package, its stylesheet holds a **copy** of
the neutrals — the same situation as `apps/desktop-shell/src/visual-tokens.ts`, and
handled the same way: `tests/sites/kids-surface.test.ts` compares every copied token
against `FOUNDATION_COLORS` and measures a 4.5:1 floor on each shipped text pairing,
the empty-stage hint's 78% alpha over every stop of every curated world gradient
included. Both inputs are read out of the shipped stylesheet rather than listed in
the test — the colour-token set is asserted to be exactly the pinned one, so an
unpinned eleventh token fails, and a repainted world is measured as painted. One
divergence is recorded rather than corrected: the Kids surface ships a single border
weight and spends it on the strong one, so its `--line` carries this sheet's
`--line-strong` hex.

## Browser evidence

Recorded from a real Chrome render of the package's own emitters — `foundationsCss()`,
`changeReviewCss()` and `changeReviewElement()` over a proposal from `proposeMany()`.
The reference render of the archive sheet was captured in the same session for
comparison. `pnpm gate` needs no browser; these are observations, not gate inferences.

| Viewport | Observation |
|---|---|
| 1440 × 1000 | `scrollWidth - innerWidth = 0`; body background `rgb(7, 8, 10)`; body font resolves to Archivo; `--accent` `#FF6B2C`, `--ok` `#5EEAD4`, `--stale` `#7A6448` |
| 1440 × 1000 | Change Review grid tracks `22px 864px 118px 16px 150px 84px` — the sheet's own track list with `1fr` resolved; panel radius `9px` (`radius-lg`) |
| 1440 × 1000 | old value computes to `rgb(122, 100, 72)` with `text-decoration-line: line-through`; new value `rgb(94, 234, 212)`. No red/green pair anywhere in the diff |
| 390 × 844 | `scrollWidth - innerWidth = 0`; row reflows to `"badge property actions" / "before before before" / "after after after"`; the arrow is hidden; the leaf is not clipped (`scrollWidth <= clientWidth`) |
| 1560 × 1050 | archive sheet rendered for comparison: same neutrals, same swatch order, same accent — the emitted `:root` matches the sheet's printed hexes token for token |

## Redesign 2026-10

The approved redesign direction (`docs/redesign/DIRECTION.md`, v5, rulings in
`docs/redesign/RULINGS.md`) keeps the Foundations world: same palette, families,
spacing scale and radii. It changes the values below and adds a motion system.
Each change is a recorded deviation, never a silent edit, and the code names the
deviation beside the value.

### Changed values (sites)

| Id | Old | New | Why |
|---|---|---|---|
| DV-F1 | `micro` 8.5px mono | `micro` 11px; 11px is the floor for all site text (`FOUNDATION_TEXT_FLOOR_PX`) | 8.5px is unreadable at any contrast |
| DV-F2 | `lead` 16px, `body` 14px | lead 18px, body 16px (umbrella editor chrome keeps 14px as a literal) | Persuade/Read surfaces at desk distance |
| DV-F3 | float shadow `0 24px 60px -16px rgba(0,0,0,.9)` | `0 10px 14px -6px` at the same ink; 1px `#2C323B` edge kept | 1px border + ≥16px blur is the banned ghost elevation |
| DV-F7 | no motion tokens | `FOUNDATION_MOTION`, emitted as `--motion-*` | the sheet states no motion, so it is a decision |
| DV-F8 | transitions only, 120–320ms | `--motion-duration-loop` 1200ms and `--motion-delay-loading` 300ms, for indeterminate progress/pending indicators only | ruling R-1; transform/opacity only, static under reduced motion |
| DV-F9 | `ui` 12px, `ui-sm` 11px, `mono` 10–12px | ui 13px, ui-sm 12px, mono 12–13px | 11–12px labels sit at the legibility floor |
| DV-F10 | `display-xl` 66px, `display-l` 42px, fixed | tokens keep 66/42; sites write `clamp(2.5rem, 1.6rem + 3.6vw, 4.125rem)` and `clamp(1.875rem, 1.4rem + 1.9vw, 2.625rem)` as literals and never read the display tokens for a size | a fixed 66px H1 overflows at 390px |
| DV-F11 | `micro` tracking 0.15em | 0.08em, emitted as `--type-micro-tracking`; line heights per DIRECTION.md §3, CSS-only | 0.15em at 11px spreads a label past its column |

DV-F4 (a lighter storefront `--accent-hi`) was withdrawn: storefront `--accent-hi`
still repeats the accent, and storefront hover is the `currentColor` state layer.
DV-F5, DV-F6 and DV-F12 are site-stylesheet changes recorded in DIRECTION.md §8;
no token here changes for them. Colours, spacing and radii are unchanged, and every
`FOUNDATION_CONTRAST_ROLES` pair still passes `meetsContrast`.

### Motion system

Thesis: an instrument settling. Fast start, long exponential deceleration, no
overshoot. `foundationsVariablesCss()` emits every row into `:root`:

| Custom property | Value | Use |
|---|---|---|
| `--motion-duration-press` | 120ms | press-in, focus halo |
| `--motion-duration-micro` | 160ms | hover state layers, press release, arrows, underline |
| `--motion-duration-state` | 200ms | chip/tone change, status line, number change |
| `--motion-duration-panel` | 280ms | panel, drawer, dialog, disclosure open; list item enter |
| `--motion-duration-panel-exit` | 200ms | every close/exit |
| `--motion-duration-route` | 320ms | route entrance, hero aperture, focal resolution |
| `--motion-duration-loop` | 1200ms | one cycle of an indeterminate indicator only (DV-F8) |
| `--motion-delay-loading` | 300ms | wait before a loading indicator paints (DV-F8) |
| `--motion-ease-out-quart` | `cubic-bezier(0.25, 1, 0.5, 1)` | micro feedback, exits, loops |
| `--motion-ease-out-quint` | `cubic-bezier(0.22, 1, 0.36, 1)` | state and number changes |
| `--motion-ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | panels, routes, focal moments |
| `--motion-stagger-step` | 40ms | per-item delay in a list |
| `--motion-stagger-max` | 200ms | delay cap |
| `--motion-distance-sm` / `-md` / `-lg` | 4px / 8px / 16px | nudges and list items / route content and dialogs / drawers and hero copy |
| `--motion-scale-press` | 0.97 | pressed controls (sites, web shell) |
| `--motion-scale-enter` | 0.98 | Kids pieces only |

`foundationsBaseCss()` adds two shared parts:

- `@media (prefers-reduced-motion: reduce)` sets the three distances to `0px`, both
  scales to `1` and the stagger step to `0ms`. Rules written against the tokens
  therefore lose movement automatically while opacity, colour and state still
  change. Sites whose tests pin a blanket `.001ms` kill keep their own block.
- One-shot keyframes a site may reference: `sx-fade`, `sx-rise-sm`, `sx-rise-md`,
  `sx-rise-lg` (opacity + translate by the distance token), `sx-draw` (a
  `clip-path` left-to-right draw) and `sx-progress` (the indeterminate bar's
  translate). None sets a resting style, so content is never hidden before they
  run.

Rules: animate only transform, opacity, clip-path and filter; colour, background
and border changes are instant; ease-out quart/quint/expo only, no bounce or
elastic; exits faster than entrances; nothing toggled by `hidden` gets an exit.
The desktop copy of this table is `MOTION` in `apps/desktop-shell/src/visual-tokens.ts`
(without the two scale tokens).

### Component changes

- **Status chips** (`.sx-status`): mono 11px at 0.08em (the machine-value Label
  role), padding and gap on the 4px scale.
- **Change Review** (`changeReviewCss()`): spacing on the 4px scale, no text below
  11px (property, values and digests 12px mono with tabular figures), 30px buttons
  (under 720px: 44px icon targets and a 44px minimum bulk-button height). Every button has rest, hover (`currentColor`
  state layer, 8%, only under `@media (hover: hover)` so a tap never leaves it
  stuck), focus-visible (2px `--accent-hi` ring, 2px offset), active (press scale,
  12% layer), disabled (dashed line, `--fg-2` label, never opacity; it wins over
  the decided-row colours) and loading (`aria-busy="true"`: label kept, 2px
  indeterminate bar after
  `--motion-delay-loading`). The ✕/✓ marks stay text glyphs with their existing
  `aria-label` (ruling R-4). The unchanged badge moves from `--fg-4` to `--fg-2`
  because it is text.
- **Resolution motion** (the signature moment). Two CSS-only hooks a site may set
  after it records a decision: `data-sx-decision="accepted" | "rejected"` on a
  `.sx-cr-row` and `data-sx-outcome="apply" | "discard"` on `.sx-change-review`.
  Pending rows show the old value with a faint strike; accepting draws a solid
  strike left to right (`clip-path`, state duration, expo) and wipes the new value
  in; rejecting strikes the proposed value in `--fg-2`. On `apply` the header dot
  turns mint and the after digest wipes in. Under reduced motion all of it appears
  at once. The package still sets no state and binds no event.
- **State panel, commerce notice, access states.** No change. These modules emit
  models and neutral element trees; each site's own stylesheet styles `.state`,
  so the redesigned state panel (tone hairline frame, tone chip, tone underline
  draw) lands in the site lanes using the tokens and keyframes above.

## Extending this

- A new token means editing the table **and** its assertion in
  `packages/site-kit/test/design-tokens.test.ts`; a new foreground token also needs a
  `FOUNDATION_CONTRAST_ROLES` entry, which the gate then measures.
- A new refusal means a `SITE_REFUSALS` key plus a covering case in
  `packages/site-kit/test/refuse-matrix.test.ts`, which asserts every reason is
  reachable. `describeSiteAccessState` (`access-states.ts`) then renders it on a guarded
  surface — its projection is total, so a reason with no mapping still gets a named state
  carrying the registry's own message; decide whether it deserves its own state and
  action rather than leaving that to the default.
- A visual fact the archive does not state is a **decision**, not a transcription.
  Record it here before shipping it.
