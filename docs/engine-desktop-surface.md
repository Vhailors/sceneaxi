# Engine Desktop visual surface

The accepted Engine Desktop editor chrome, as `apps/desktop-shell` implements it
(sceneaxi#158). This document owns three things nothing else does: **what the
canonical archive is**, **where this implementation deliberately departs from
it**, and **the recorded browser evidence** behind every visual claim.

It authorizes nothing. Where it disagrees with an ADR, a schema, a refusal
registry, or an executable gate, that owner wins.

## Canonical source

| | |
|---|---|
| Archive | `SceneAxi Design System.zip` |
| SHA-256 | `ad5d6e39215a4aee9c81b827308fc944784719168d3fba2db5d9e5ef8fc15159` |
| Member implemented | `Engine Desktop.dc.html` |
| Archive sync date | 2026-07-25T12:40:00Z |

The archive is **not committed to this repository**. It is a design input, not a
build input: nothing in `pnpm gate` reads it, and no generated file is derived
from it at build time. What the code carries instead is the archive's *decided
values*, held as data in `apps/desktop-shell/src/visual-tokens.ts` with the
digest above beside them, so a reviewer can re-derive any colour or metric from
the named member of the named archive.

### `Engine Desktop v1.dc.html` is superseded

The same archive contains an earlier pass. It is **reference-only** and must not
be reintroduced. It differed in kind, not in degree:

| | v1 (superseded) | Current (implemented) |
|---|---|---|
| Accent | amber `#F5A524` / `#FFC24D` | signal orange `#FF6B2C` / `#FF8A54` |
| Typeface | Space Grotesk + IBM Plex Sans | Archivo + JetBrains Mono |
| Canvas | 2064×1400 storyboard | 1680×1000 editor stage |
| Model | a project-launcher storyboard: project list, profile cards, offline-capability panel. No mode rail, no assistant, no command palette, no profile switch. | one stateful editor: seven-mode rail, mode-dependent dock, profile switch, assistant, command palette, overlays |

`SUPERSEDED_V1.retiredValues` holds the v1 values as a closed list, and
`test/visual-tokens.test.ts` asserts that none of them appears in the token set
or in a rendered document. A review slip is a failing test, not a judgement call
— the same shape `LIVE_OPEN_PRESENTATION.retiredLabels` uses in `site-kit`.

## Foundations v2, and why its tokens are duplicated here

Foundations v2 — near-black `--bg-base #07080A`, signal orange `--accent
#FF6B2C`, Archivo + JetBrains Mono — is the product visual language for **every**
shipped surface, including this one (captain decision D1, recorded 2026-07-28).
The shared token layer for it lives in `packages/site-kit` (decision D2).

**This package cannot reach that layer, and the duplication below is forced by
that, not chosen.** `docs/dependency-matrix.json` allows
`@sceneaxi/desktop-shell` exactly:

```
"@sceneaxi/desktop-shell": { "allow": ["@sceneaxi/schemas", "@sceneaxi/authoring-core"] }
```

and the matrix's own `rule` states that *allow lists are exhaustive — any
internal dependency or source import not listed here is a violation*. So
`@sceneaxi/site-kit` is not a permitted dependency of this app, and importing it
would fail `pnpm check:boundaries`. No edge was added and the matrix was not
edited; the shared values are transcribed locally instead, into
`FOUNDATIONS_V2_COLORS` in `apps/desktop-shell/src/visual-tokens.ts`.

### What is duplicated

All 24 colour tokens the Foundations v2 sheet prints, plus its two families.
`packages/site-kit/src/design-tokens.ts` (`FOUNDATION_COLORS`) remains the
**upstream** source of these values — this copy is downstream of it, not a second
opinion about them.

| Disposition | Tokens | Meaning |
|---|---|---|
| **carried** (20, plus both families) | `--bg-base`, `--bg-panel`, `--bg-raised`, `--bg-control`, `--bg-field`, `--bg-row`, `--line-soft`, `--line`, `--fg`, `--fg-2`, `--accent`, `--accent-hi`, `--ok`, `--danger`, `--info`, `--axis-x`, `--axis-y`, `--axis-z`, `--kids`, `--store-web`, and the `Archivo`/`JetBrains Mono` families | the sheet's hex, verbatim |
| **raised** (2) | `--fg-4` `#3F464F` → `#7D8694`; `--stale` `#7A6448` → `#A08663` | below the 4.5:1 text floor on this surface's near-black chrome; each names its `DEVIATIONS` row |
| **absent** (2) | `--line-strong`, `--store-game` | named with a reason, not silently unused (see below) |

`--line-strong` `#2C323B` is the one place the two archive members genuinely
disagree: the Foundations sheet prints three line weights, but the implemented
member `Engine Desktop.dc.html` draws its own six-step line scale and does not
use `#2C323B` anywhere in the file. For a value the accepted surface itself
specifies, that member wins. `--store-game` is a storefront accent this app never
paints — the Game profile chip is drawn with the accent instead. `--store-web`
*is* painted here, on the Website profile chip, so it is carried as
`PROFILE_DOT.web` rather than declared absent: a token this surface ships cannot
be accounted for as unused.

### What stops the two copies drifting

Not an import — a shared anchor plus an executable check on each side. Both
transcriptions name archive SHA-256 `ad5d6e39…c15159`, and each asserts its own
transcription in `pnpm gate`. On this side that is
`apps/desktop-shell/test/visual-tokens.test.ts`, which asserts the sheet is
accounted for **in full** (every token has exactly one disposition, so a token
added upstream cannot be silently ignored), that every *carried* token equals the
sheet hex exactly, that a *raised* token is only raised where the sheet value
measurably fails the floor, that an *absent* token gives a reason, does not
reappear under a different local name, **and does not appear in the emitted
document**, that every hex the document ships comes from a token the table
accounts for, that the document ships **no `rgb()`/`rgba()` at all** — decimal is
the notation the hex scan cannot follow, and matching only exact copies of a token
still let `rgba(4,5,7,.68)` ship next to `SURFACE.backdrop` #050607, so a
translucent value is written as a `color-mix()` over a declared token's custom
property (`SCRIM`) and moves when that token does — and that the accent,
near-black, and both families survive into the actually-emitted document. Editing
a hex on either side without the other is a failing test.

If the matrix ever permits `@sceneaxi/site-kit` here, the thing to delete is
`FOUNDATIONS_V2_COLORS` and its transcription tests — `FOUNDATIONS_V2_SOURCE
.duplicationReason` is `"dependency-matrix-forbids-site-kit"` so that trigger is
asserted rather than remembered.

## Ownership

| Concern | Owner |
|---|---|
| Colours, typography, metrics, contrast deviations, archive provenance | `apps/desktop-shell/src/visual-tokens.ts` |
| Shared chrome vocabulary — the seven modes, rail labels, dock-tab derivation, assistant modes, window-tier thresholds, structural metrics | `packages/schemas/src/editor-shell.ts` (sceneaxi#184); this model **derives** its tables from it, and the umbrella web editor projects the same rows — parity is a data identity in `tests/parity/editor-shell-parity.test.ts`, and the web surface's own record is [`web-editor-shell.md`](web-editor-shell.md) |
| Mode/profile/dock/assistant/overlay/sculpt state, refusals, window tiers, control kinds | `apps/desktop-shell/src/visual-model.ts` |
| The emitted document (markup, stylesheet, behaviour script) | `apps/desktop-shell/src/chrome.ts` |
| The `chrome` command and its flags | `apps/desktop-shell/src/app.ts` |
| Runnable level and how to start it | [`runnable-surfaces.md`](runnable-surfaces.md) |

The model decides and the renderer draws. `chrome.ts` contains no policy: every
table its emitted script reads — which dock tabs a mode has, which dock height,
what the assistant becomes on each profile and with which refusals, which
refusal the rail takes — is serialized from the model at render time, so the
document and the model cannot disagree about a state. **A state a client toggle
can reach is a state the bytes already contain.** The Kids editor refusal, and
now the Kids assistant lock, are emitted in *every* document and selected by a
`[data-profile="kids"]` / `[data-assistant="denied"]` rule rather than by a
server-side branch, because a refuse-only decision a browser-side profile switch
could walk around is not a decision. The switch applies the model's own
projection for the profile it lands on — state, model label, and the toggle,
close, and Send refusals — so switching *back* restores a correct column instead
of stranding one. That holds for the emitted
bytes too, not just for what the script does afterwards: the visible dock
tabpanel is `state.dockTab`, so `--mode run` opens on Console rather than on a
hardcoded Change Review queue the mode does not even have a tab for. The bulk
accept/reject in the tab strip follows the same rule — it belongs to the Changes
tab, so `run` and `ship` do not offer it, and the emitted script re-applies that
condition when the mode switches rather than only tracking the pending count.
Because a region hidden by the model is hidden with the `hidden` attribute, the
stylesheet declares `[hidden]{display:none !important}`: `.change-row` and
`.dock-bulk` set their own `display`, and an author class outranks the UA sheet's
`[hidden]` rule.

## How to render it

```
pnpm build
node apps/desktop-shell/bin/sceneaxi-desktop.mjs chrome > shell.html   # then open shell.html
node apps/desktop-shell/bin/sceneaxi-desktop.mjs chrome --mode sculpt --sculpt running
node apps/desktop-shell/bin/sceneaxi-desktop.mjs chrome --profile kids
node apps/desktop-shell/bin/sceneaxi-desktop.mjs chrome --overlay palette
node apps/desktop-shell/bin/sceneaxi-desktop.mjs chrome --width 1024 --height 700
node apps/desktop-shell/bin/sceneaxi-desktop.mjs chrome --json                # envelope, same bytes under `html`
```

Text mode emits the document itself so it redirects straight to a file; `--json`
keeps the versioned envelope. An unknown flag value refuses with exit `2` and
renders nothing, rather than silently falling back to a state nobody asked for.

The document is **self-contained**: no remote font, script, style, or image, and
no `fetch`. One request loads it and nothing else is fetched (measured below).

## What actually works, and what refuses

The archive is a mockup: it draws controls for behaviour this shell has no
contract for. Rather than dim them and hope, every control in the model declares
one of four kinds, and `test/visual-model.test.ts` asserts that an inert control
always has a refusal and a non-inert one never does.

| Kind | Meaning | Examples |
|---|---|---|
| `view` | changes visual state; genuinely works | mode rail, dock tabs, profile switch, assistant open/close and its Ask/Build/Agent modes, the overlay openers and each of the four overlay dismiss buttons, the sculpt cancel, drawer toggles |
| `review` | edits the fixture Change Review queue; **writes no document** | accept/reject a row, accept all, reject all |
| `live` | delegates a product action to an enclosing runtime seam | assistant prompt, Send, Retry, and artifact manipulators only when the packaged Linux runtime binds them |
| `inert` | renders, keeps its focus stop, refuses by name | Sculpt object, standalone-shell assistant prompt/Send/Retry, menu bar, the three viewport-source tabs, the palette rows naming CLI-only verbs, and — on the refuse-only profile — every control except the eleven named below |

The chrome still reaches no authoring package itself. Its standalone CLI render
therefore keeps every product action inert and `test/app.test.ts` proves a
`chrome` invocation leaves a document byte-identical. The packaged Linux tier
requests `assistantRuntime: "local"`, binds the assistant's `live` controls to
its existing bridge and Mount API, and owns that runtime contract in
`docs/desktop-linux.md`. If that runtime cannot mount, the renderer emits the
model-owned runtime event; the chrome applies the precomputed `none` projection
to every control rather than maintaining a renderer-owned control list.

### The refuse-only profile demotes in one place

A `view` control on the refuse-only profile is decided **once**, not per call
site. `desktopVisualView()` mints every control through one local function, and
on Kids that function makes each one `inert` with `OPEN_PATH_KIDS_REFUSED` —
unless the control is *already* inert, which keeps its own more specific reason
(the assistant's denial, the menus' "not a verb here"), because one control must
not carry two refusals. A control added anywhere in the projection is therefore
behind the refusal by default: **forgetting fails closed.**

That replaced a per-call-site `kids ?` branch, which is a pattern that only has
to be forgotten once. It was: the mode rail and the assistant remembered it and
the two drawer toggles did not, so at 1024×700 — and at 1920×620, which is the
same tier on height alone — "Panels" and "Inspector" rendered as live `view`
buttons that set `aria-expanded="true"` on regions
`.shell[data-profile="kids"]` keeps shut at every size.

Exactly eleven controls are exempt, and they are the ones **not behind** the
refusal: the three profile chips (the switch is how an operator leaves the Kids
state, so making it inert would turn a state you can exit into a dead end), the
palette opener, the three status-bar overlay shortcuts, and the four overlay
dismiss buttons. Those genuinely work on every profile, and marking a control
that works as refusing is the same dishonesty pointing the other way.

The browser-side switch applies the same decision the same way: it sweeps
**every** `[data-kind]` element and applies the model's own `[kind, refusal]` for
that control id, serialized per profile and assistant-runtime state from
`view.controls`. The same table owns runtime loss. There is no selector list — a
list of the controls to update is a list that has to be edited whenever a control
is added, and the one that existed had never gained `.drawer-toggle`.

Demoting a control is not the whole of the switch, though: a drawer **already
open** when the profile changes has state of its own. Closing the toggle is not
enough if `data-drawer-left` still says `open` and the toggle still says
`aria-expanded="true"` over a region the refusal has taken off screen, so the
switch closes any drawer whose toggle it just made inert — read from the applied
`aria-disabled`, after the sweep, so it follows the model rather than naming a
profile a second time. It is the reset the assistant toggle already did for its
own drawer.

Nor is the editor body the whole of the switch. The status bar **names** the
profile the document is on (`view.profilePin`), which makes it the one place a
stale value is not a cosmetic lag but the surface asserting a profile it is not
on. The switch updates it from the same kind of serialized per-profile table it
reads for the assistant seat and the controls — the model's own `profilePin` for
each profile, projected exactly as a render of that profile would compute it, so
the renderer decides nothing here either. Until this landed the pin was rendered
correctly and then never updated, so clicking the Kids chip left a footer reading
`game profile · core 0.0.0` under the full `OPEN_PATH_KIDS_REFUSED` lock screen.

### Refusal registry

`DESKTOP_VISUAL_REFUSALS` is closed, and every entry is reachable from some state
— asserted in both directions.

| Code | When |
|---|---|
| `OPEN_PATH_KIDS_REFUSED` | the refuse-only profile, and every control behind it that is not already refusing for a more specific reason — the mode rail, the dock tabs, the two drawer toggles, the Change Review decisions, the sculpt cancel, the driveable palette rows; the code comes from the shared open-path policy, not from here |
| `DESKTOP_KIDS_ASSISTANT_DENIED` | assistant on Kids — its toggle, its close, its Send, and its three composer modes |
| `DESKTOP_NO_PRESENTATION_RUNTIME` | the viewport: no renderer is mounted, so no pixels — and the three viewport-source tabs, because switching what a viewport shows needs the runtime that is missing |
| `DESKTOP_NO_KERNEL_SESSION` | `run` mode: no session, so no tick, frame, or body |
| `DESKTOP_NO_DOCUMENT_BOUND` | any control that would author something |
| `DESKTOP_VERB_NOT_ON_THIS_SURFACE` | a palette row naming a CLI verb this shell has no command for, and every application-menu button — this surface has no command behind any of the archive's menus |
| `DESKTOP_WINDOW_BELOW_MINIMUM` | the window is smaller than 900×600 |

### Parity with the CLI

The profile switch does not describe a profile; it **projects
`openPathPolicyView()`** from `@sceneaxi/schemas` — the same value
`sceneaxi profile open-path`, `sceneaxi-desktop open-path`, and web-shell's
`createOpenPathView()` report. So Kids refuses here because the shared policy
says so, with the shared code, and the identity is asserted in
`apps/desktop-shell/test/app.test.ts` ("chrome / open-path parity") rather than
maintained as four prose descriptions.

Likewise, a command palette row is driveable only when it names a key of
`DESKTOP_COMMANDS`. `sceneaxi project dev` is a CLI verb with no desktop command,
so its row renders inert and says so.

## Responsive and windowing strategy

The archive is a fixed 1680×1000 stage scaled with `transform: scale()`. That is
a mockup device, not a windowing strategy, and it is not reproduced — the emitted
document has no `transform: scale(` and no `width:1680px`. Instead
`WINDOW_TIERS` names four tiers, and columns undock outside-in.

| Tier | From | Docked columns | Undocked |
|---|---|---|---|
| `regular` | 1440×720 | rail, left dock, viewport, inspector, assistant | — |
| `compact` | 1180×660 | rail, left dock, viewport, inspector | assistant → drawer |
| `narrow` | 900×600 | rail, viewport | left dock, inspector, assistant → drawers |
| `minimum` | below 900×600 | none — the chrome **refuses** | — |

Two rules keep this honest:

- **Every undocked column has an opener.** The assistant keeps its existing
  toggle; the left dock and the inspector gain two title-bar toggles that appear
  at `narrow`. A drawer nobody can open is not a responsive strategy, so an
  undocked drawer also starts closed rather than covering the panel it undocked
  from.
- **A refused column is never a drawer.** The one exception to the rule above:
  when the assistant is `denied` it keeps a real column at every tier. Its body
  is the Kids lock screen carrying `THIRD_PARTY_LLM_DENIED_BY_DEFAULT`, and the
  only control that could open a drawer is the toggle that same refusal makes
  inert — so undocking it would leave a named refusal on no reachable surface at
  1280×800 while the surface still claimed to state it. Hiding a refusal behind a
  breakpoint is hiding a refusal.
- **The toggle reports what the tier actually shows, and the bytes ship a closed
  drawer.** Below `regular` the assistant column can be `open` and still not on
  screen. Every emitted document therefore carries
  `data-drawer-assistant="closed"` — never a value seeded from the *render*
  size — because a document rendered at 1680×1000 can be opened at 1280×800, and
  an attribute chosen at render time would put the drawer over the inspector at
  first paint and keep it there with no script. Which rule lights the toggle is a
  stylesheet decision on the two **complementary** media conditions
  (`atTierOrAbove("regular")` and `belowTier("regular")`, both derived from
  `WINDOW_TIERS`): where the assistant is docked the toggle reads
  `data-assistant`, and below that tier it reads `data-drawer-assistant`. So the
  lit state follows the viewport rather than the render size, `aria-pressed` is
  brought to the viewport by `syncAssistantTier()` at load and on every
  `matchMedia` change, and one press opens the drawer at every tier — there is no
  first press that only turns off a claim nothing honoured.
- **Every breakpoint in the stylesheet is derived, and covers both axes.** The
  two undocking breakpoints are interpolated from `WINDOW_TIERS`
  (`@media (max-width:1439px),(max-height:719px)` and
  `(max-width:1179px),(max-height:659px)`), and the refusal breakpoint from
  `DESKTOP_MINIMUM_WINDOW`, as are the refusal block's printed `900×600` and its
  sentence. Both axes matter because `resolveWindowTier()` reads both: a 1920×700
  window is `compact` to the model, and a width-only breakpoint would have left
  the stylesheet describing a layout the model does not produce. Raising a tier
  therefore moves the stylesheet, the printed size, and `resolveWindowTier()`
  together instead of leaving two of the three stale. Below the minimum the
  editor is replaced by a named refusal, not by an unusable layout.

## Accessibility

- **Landmarks, not anonymous divs**: `header` / `nav` / `aside` / `footer` /
  `section`, every one labelled.
- **Real controls**: every action is a `<button type="button">`; the one
  non-button control is the modelled assistant `<textarea>`. Keyboard order is
  DOM order, and there are no click handlers on `div` or `span`.
- **Inert controls stay reachable.** An inert control is marked `aria-disabled`
  rather than `disabled`, so it keeps its focus stop, and `aria-describedby`
  points at the paragraph carrying its refusal — a screen reader gets the reason,
  not just "dimmed". Every button is rendered through the one
  `button(control, …)` helper — the mode rail, the dock tabs, the
  viewport-source tabs, the profile chips, the drawer openers, the status-bar
  overlay shortcuts, the assistant modes, the sculpt cancel, and each of the four
  overlay dismiss buttons, and the assistant artifact manipulators. The prompt
  uses the parallel `promptInput(control)` helper so it carries the same
  `data-kind`, refusal reference, and profile-switch demotion; when inert it is
  `readonly` rather than removed from the focus order. Thus a control cannot
  reach the document without its
  kind, and a control the model builds cannot fail to reach the document. That is
  not a convention here: `test/control-accounting.test.ts` enumerates the
  controls by walking the view and fails in both directions. The refusal legend prints the **whole closed
  registry**, one sentence per code taken from `DESKTOP_REFUSAL_MESSAGES`, for
  two reasons: a code must not have two wordings in one document, and a control
  that becomes inert *in the browser* — the profile switch does that to the rail
  and to the assistant — needs its reason to already be there to point at.
- **Roving tabindex** on both tablists, with `aria-selected` on the active tab
  and `aria-pressed` on the active mode and profile — **and the arrow keys that
  make it a pattern rather than a lost focus stop.** Roving tabindex takes every
  non-active tab out of the Tab order, so `ArrowLeft` / `ArrowRight` / `Home` /
  `End` are the only way to reach them: on the dock strip they select the tab they
  move to, and on the viewport strip they move focus without moving the
  selection, because all three viewport sources are inert — a viewport source
  cannot be switched on a surface that mounts no renderer, and they say so with
  `DESKTOP_NO_PRESENTATION_RUNTIME` rather than looking switchable.
- **A tablist owns nothing but its tabs.** ARIA restricts a `tablist`'s children
  to `tab`, so `role="tablist"` sits on an inner wrapper holding only the tabs;
  the spacer, the tool glyphs, and the Change Review bulk accept/reject stay
  siblings in the same flex row. The bulk pair is the only way to decide the
  whole queue at once, so it is the worst control in the strip to have dropped
  from the exposed structure — and `moveTab()` enumerating `[role="tab"]` now
  depends on the same boundary.
- **`aria-modal` is backed by a real trap.** An overlay declares
  `role="dialog" aria-modal="true"`, which tells assistive tech the rest of the
  document is inert, so keyboard focus must agree: opening one moves focus into
  the dialog, `Tab` and `Shift+Tab` wrap inside it, and closing it — by button or
  by `Escape` — returns focus to the control that opened it. The `keydown`
  handler is on the document rather than the shell so a lost focus cannot swallow
  `Escape`.
- **Element ids are unique and well-formed**, because a control id is derived
  from a declared identity (`PALETTE_GROUPS[].id`, `DESKTOP_MENU_IDS`) and never
  from display text — two palette rows name the same CLI verb in the same mode,
  and a verb contains spaces. An `aria-describedby` reference is only meaningful
  if it resolves to exactly one element.
- **The viewport's image role sits on an empty backdrop.** `role="img"` is
  Children Presentational, so anything under it is pruned from the accessibility
  tree. It is carried by a dedicated empty `.viewport-backdrop`, leaving the two
  viewport notes and the sculpt `role="status"` / `role="progressbar"` region as
  real siblings — otherwise the pass progress would be announced to nobody.
- **Reduced motion**: `@media (prefers-reduced-motion:reduce)` collapses every
  animation and removes the sculpt sweep entirely.
- **Contrast**: every text token clears 4.5:1 against every chrome surface, and
  the focus ring clears 3:1. This is where the archive is departed from — see
  below.
- **An inert control is dimmed by paint, not by `opacity`.** That is a contrast
  rule, not a style one. Element opacity composites a whole control toward
  whatever is behind it *after* every check on this surface has looked: the token
  test compares `TEXT` against `SURFACE`, and a browser sweep reads
  `getComputedStyle().color`, and neither sees compositing. The dimming that
  shipped under those checks — `opacity:.72` on any inert button, `opacity:.5` on
  a Kids rail label — resolved to 3.67:1 on an inert view tab, 4.07:1 on an inert
  primary button, and **2.16:1** on a Kids rail label, i.e. a refusal that could
  not be read. It is now the painted `INERT` tokens, which the same token test
  measures directly, plus a structural assertion that the emitted document
  declares no `opacity` at all outside `@keyframes`, so the next dimmed control
  cannot walk into the same blind spot. `INERT.text` *is* `TEXT.faint` on
  purpose: the floor is the constraint, and `faint` is already the dimmest tier
  that clears it everywhere. The paint has to hold **in every state, not only at
  rest**: a single-class `:hover` outranks `button.is-inert` (0,2,0 against
  0,1,1), so every control class whose hover repaints its label ships the inert
  answer beside it — `.ghost-button`, `.primary-button`, and `.decision`. Miss
  one and that control is indistinguishable from a live one under the pointer,
  which is the same dimmed-by-nothing state the tokens replaced.

## Deviations from the archive, and why

Each row is also carried as data in `DEVIATIONS`.

| Deviation | Archive | Shipped | Why |
|---|---|---|---|
| Dim text tiers collapsed | `#6E7681` (4.36:1), `#565E68` (3.05:1), `#3F464F` (2.10:1), `#333A42` (1.74:1) | two passing tiers, `#8A929C` and `#7D8694` | all four fail the 4.5:1 text floor on the surfaces they are used on. Lightening them monotonically would have produced four indistinguishable greys; two tiers keep a real hierarchy, and the archive's remaining separation is carried by size, weight, and letter-spacing, which is preserved. |
| Struck-through review value | `#7A6448` (3.42:1) | `#A08663` | same floor |
| Inert dimming | element `opacity` on a control that cannot be used | the painted `INERT` tokens, and no `opacity` outside `@keyframes` | opacity composites a label toward its background after every check here has read the declared colour, so the dimming was measured by nothing and shipped at 3.67:1, 4.07:1, and 2.16:1. Raising the fraction would have left the blind spot; a painted token is measured by the test that already exists. An inert control is deliberately not `disabled`, so its refusal has to stay readable. |
| Web fonts | `fonts.googleapis.com` link for Archivo + JetBrains Mono | font-family stack, no remote request | the emitted document is self-contained and offline. The archive families are named first and render when installed; otherwise the system UI face does. |
| Fixed stage | 1680×1000 scaled with a transform | fluid layout, four window tiers | see above |
| Informational blue | the member carries both `#5B9CFF` and a lighter `#8FB7F5` for the same informational role | `#5B9CFF` | the two archive members disagree, so the shared sheet settles it: Foundations v2 canonicalises `--info` to `#5B9CFF`, D1 makes the sheet binding, and the value clears the text floor here anyway (6.16:1 at worst on `SURFACE`, 6.48:1 on the note's own fill) — so there is no accessibility reason to keep the member's lighter variant, and keeping it would be drift from the shared layer. |
| Kids profile | a working editor with only the assistant locked | the **whole editor body** refuses | **contract conflict, resolved for the repository.** The Kids product is an isolation boundary with no UI (`open-path-policy.md`, `OPEN_PATH_KIDS_REFUSED`). An editor that merely looked disabled under a Kids badge would still be a Kids authoring UI. Every control behind the refusal goes inert — in the emitted bytes, not only after a click, and decided in one place rather than remembered per call site — so no mode can be entered and no removed panel can be opened from behind it; eleven chrome controls stay live so the refusal is a state you can leave. |
| Panel inventory | fixture object trees, digests, byte sizes, fps, triangle counts, run timings, evidence rows | real structure with honest empty and inert states | a shell that mounts no renderer and opens no kernel session has no fps, no triangle count, and no `14.2 MB` artifact. Rendering the archive's fixtures would be inventing file sizes and hashes. Change Review is the one fixture queue kept — its interactions are in scope — and it says on the surface that deciding there writes no document. |

### The renderer note is deliberately dropped

The archive's viewport carries **`Preview renderer is experimental — not the
final choice`**. That sentence is **not** shipped. The archive is authority for
purely visual facts; this is product copy asserting a product fact, and the
captain has settled Three as the product presentation core, so the sentence is
stale regardless of whether ADR 0017's pixel-surface scope formally reaches a
surface that mounts no renderer at all. It was removed rather than reworded,
because `VIEWPORT_INERT_NOTE` already says the only thing this viewport can
honestly say — that no renderer is mounted here and no pixels are drawn — and
the document carries `<meta name="sceneaxi-pixels-drawn" content="false">`
beside it.

The two labels ADR 0017 retired by name, `Experimental Three preview` and
`non-decision`, **remain asserted absent** in `test/chrome.test.ts` and
`test/visual-model.test.ts`, in every state, so neither they nor the dropped
sentence can return by review slip.

## What is verified where

- **Node gates** (`pnpm gate`) cover the whole model — mode/dock-tab derivation,
  profile projection and the Kids refusal, assistant states including the
  non-reopenable deny, Change Review arithmetic, sculpt pass advance and
  clamping, overlays, window tiers, control kinds, refusal reachability, view
  freezing, and determinism — plus the emitted document: escaping (including a
  hostile selection name that cannot close the script tag), landmarks, labels,
  `aria` wiring, roving tabindex, the reduced-motion rule, the focus ring, the
  breakpoints, and the absence of any remote reference, fabricated digest, byte
  size, frame rate, or timing in **any** state. Each per-profile table the
  emitted script reads is checked against the model's own projection for that
  profile — the assistant seat, every control by id, and the status-bar pin,
  which is asserted to be genuinely per profile so a table frozen on one value
  fails rather than passing an identity vacuously. `apps/desktop-shell/test/bin-smoke.test.ts`
  spawns the real binary and renders a document from it.

- **The model/renderer split is enforced, not conventional** —
  `apps/desktop-shell/test/control-accounting.test.ts`. Review round after review
  round found the next instance of one family of fault: a control the model built
  and the renderer never drew, a button the renderer drew that no control
  accounted for, a state the document reported untruthfully, or a control
  declaring itself live over a region its own profile removes. The split itself
  was sound; nothing checked it. That file checks four things across eighteen
  states, and each is derived rather than listed, so a newly modelled control is
  covered the moment it exists:
  1. Every control reachable by walking `desktopVisualView()` is in the document
     with the kind it declares, and an inert one with its `data-refusal` and a
     legend row its `aria-describedby` resolves to; and `view.controls` — the
     index the mint records and the renderer serializes for the browser-side
     switch — is *exactly* that walked set, so an index missing a control (which
     the switch would then silently skip) fails here. The one deliberate
     exception is `profiles[].assistant`, the projection of the *other* profiles
     that the renderer serializes instead of drawing.
  2. No `<button>` in the document lacks the `id` + `data-kind` pair only
     `button(control, …)` emits, every such id is one the model minted, and no
     other interactive element or focus stop exists at all.
  3. Every named refusal resolves to a visible region **at every window tier**,
     computed through the emitted stylesheet's own cascade — media conditions on
     both axes and in both directions, selector matching, specificity, source
     order, and `!important` — rather than by reading a `hidden` property. A
     companion case asserts the same helper reports `display: none` for the
     docked assistant below the regular tier, so the check cannot pass vacuously.
     This is the property the Kids lock screen failed at 1280×800.
  4. **A declared kind tells the truth.** No control declares itself `view` or
     `review` while the region it names through `aria-controls` resolves to
     `display: none` — judged with the control's *own* effect applied, since a
     drawer opener naming a region the sheet keeps shut until it opens it is the
     control working, not a region the profile removed. An `aria-controls` target
     with no region mapping fails rather than being skipped. And the assistant
     toggle is checked across the **cross product** of render size and open size:
     every document ships a closed drawer, the column is shown exactly where the
     tier docks it, and the lit fill agrees with the column at the viewport the
     document is opened at, not the one it was rendered at. Properties 3 and 4
     each fail on the defect they were added for — verified by reverting it.

  Those four properties are the whole claim, and it is narrower than "the split
  is enforced" sounds. It does **not** cover markup a renderer conditions on a
  control's kind *at render time*: property 4 probes `aria-controls` targets, so
  an attribute a row is given only while its control is live — and which the
  browser-side switch cannot add back when it promotes that control — is outside
  every probe in the file. That is how the palette's dismiss action was gated on
  `kind === "view"` and still passed; it is now emitted unconditionally, and the
  click handler's `aria-disabled` check is what keeps an inert row from acting.

- **Real browser, re-recorded 2026-07-28 against this branch's final HEAD.**
  Not inherited: the previous record was taken before the inert state stopped
  being an `opacity` and before the palette's dismiss action stopped being gated
  on render-time kind, it was re-run after the inert hover paint and the drawer
  reset below, and this run is a full re-measurement against the head that
  carries the status-bar profile pin through the switch. Every figure below was
  re-measured; the element counts in the contrast sweep are **higher** than the
  previous record's for the same documents because this sweep measures every
  visible text-bearing element rather than the narrower set the earlier harness
  walked — the ratios, which are the claim, are unchanged. **Every visibility
  claim below is
  `getComputedStyle(...).display`**, not a `hidden` property, and **every
  contrast figure is composited** — each element's own group `opacity` and every
  ancestor's are folded into both sides of the ratio. Chrome via
  `chrome-devtools-axi` in an isolated session, documents rendered by
  `node apps/desktop-shell/bin/sceneaxi-desktop.mjs chrome`, opened from
  `file://`, at 1680×1000 unless a size is named. The sweep covers six window
  shapes rather than one: 1680×1000, 1280×800 (the drawer tier), 1920×700 and
  1920×620 (**wide but short** — tiers the model reaches on height alone),
  1024×700 (the Kids drawer tier), and 800×560, and it exercises the Kids switch
  at the drawer tiers, not only at 1680×1000.

  **A second correction, on the same axis.** The earlier record read every
  control **at rest**, and a resting read cannot see a `:hover` rule. A
  single-class `:hover` outranks `button.is-inert`, so an inert `.ghost-button`
  repainted to the live `--text` `#EDEFF2` and the live `--line-hover` border
  under the pointer — visually identical to a live control, on the two Kids
  drawer toggles that are the only inert ghost buttons a viewport ever shows.
  Nothing recorded here was wrong about the resting state; the state was simply
  never measured. It now is, with the pointer actually over the control.

  **A correction to the previous record, stated rather than quietly improved.**
  It reported "0 failures below 4.5:1" across every state. *That claim did not
  hold for inert controls.* The cause was the measurement, not a rounding
  disagreement: the sweep read `getComputedStyle(el).color`, which returns the
  **declared** colour, so the `opacity:.72` on every inert button and the
  `opacity:.5` on a Kids rail label were never folded in — and the recorded
  "`build` worst 5.42:1" was the *un*-composited `--faint` figure, on a document
  that rendered 17 inert controls. Composited, the shipped values were **3.67:1**
  on an inert view tab, **4.07:1** on an inert primary button, and **2.16:1** on
  a Kids rail label, which is a refusal nobody could read. The token gate was
  blind in the same way and for the same reason: it compares `TEXT` against
  `SURFACE`, and compositing happens after both look. The fix is not a larger
  fraction — the dimmed state is now a painted token (`INERT`), the token gate
  measures it directly, and it asserts the document declares no `opacity` at all
  outside `@keyframes`. The figures below are the re-measurement, with
  compositing folded in.

  - **Region geometry at 1680×1000 is the archive's own, to the pixel**:
    title bar `36`, mode rail `56`, left dock `274`, inspector `326`, assistant
    `344`, view tabs `32`, dock `228`, status bar `27`, shell `1680×1000`.
  - **The adopted language is what the browser resolved**: `--accent` `#FF6B2C`,
    `--info` `#5B9CFF`, `--inert` `#7D8694`, `--inert-on-accent` `#331A07`, shell
    `rgb(7, 8, 10)` (`#07080A`), title bar `rgb(13, 15, 18)`, panel header
    `rgb(18, 21, 26)`, body font resolved to `Archivo`. A Kids rail label
    resolved to `rgb(125, 134, 148)` — the painted `--inert`, at full opacity —
    and its `aria-hidden` glyph to `rgb(51, 58, 68)`, which is the one part of an
    inert control that is still allowed to be a line colour.
  - **Exactly one network request** — the document itself
    (`GET file://…/build.html [200]`, and `performance.getEntriesByType(
    'resource')` empty). No font, script, style, or image was fetched.
  - **Every button came from the helper.** Across the thirteen document/size
    combinations audited, **0** buttons lacked the `id` + `data-kind` pair and
    **0** `aria-describedby` references dangled, in every state and after every
    interaction below. `build` renders 58 buttons, 53 focus stops, **0
    unlabelled**, 17 inert. `kids` renders the same 58 with **47** inert: the
    live eleven are exactly the controls not behind the refusal —
    `profile-game`, `profile-web`, `profile-kids`, `overlay-open-palette`, the
    three `status-overlay-*`, and the four `overlay-close-*`. The only inert
    controls outside the plain Tab order are `viewport-source-game` and
    `viewport-source-sculpt-preview` on `build` (roving tabindex, and the arrow
    keys reach them), joined on `kids` by the non-active dock tabs.
  - **Every `role="tablist"` owned only `role="tab"` children** in every document
    measured, so the bulk accept/reject and the spacer are outside it.
  - **The viewport carries one note**, `VIEWPORT_INERT_NOTE`; the archive's
    "not the final choice" line is nowhere in the document (`indexOf` `-1`).
  - **Rendered contrast sweep, composited.** Each visible text-bearing element's
    colour against its resolved background, with `aria-hidden` subtrees skipped
    and **element `opacity` folded into both sides** — the step whose absence is
    corrected above. **0 failures below 4.5:1** in all thirteen measurements:
    `build` (99 elements, worst 5.22:1), `sculpt` running (119, 5.22:1), `run`
    (72, 5.22:1), `animate` (76, 5.22:1), the `palette` overlay (122, 5.11:1),
    `kids` (63, **4.60:1** — the `refuse-only` chip at 8.5px, still the worst on
    the surface), `build` at 1280×800 and 1920×700 (89, 5.22:1 each) and at
    1024×700 (71, 5.22:1), and `kids` at 1280×800 (63, 4.60:1) and at 1024×700
    and 1920×620 (56, 4.60:1 each). At 800×560 the shell is the refusal, so it
    contributes no shell text: the 20 elements measured there are the refusal's
    own, worst 6.33:1.
  - **The inert state is measured, not assumed.** In every one of those
    measurements the sweep found **0** elements with a group `opacity` other than
    `1`, and enumerating the live stylesheet's rules found **0** `opacity`
    declarations outside `@keyframes`. The worst *inert* label composited to
    **5.22:1** on `build` (`File`, on the menu bar) and **4.97:1** on `kids` (the
    `Assistant` toggle at 1680×1000, the `Panels` drawer toggle at the drawer
    tiers) — the values the previous record could not see were 3.67, 4.07, and
    2.16.
  - **An inert control stays inert under the pointer.** Measured with a real
    mouse move, not at rest. At 1024×700 on `kids` all **11** visible inert
    controls — both drawer toggles, the assistant toggle, its ✕, and the seven
    rail modes — resolve to `rgb(125, 134, 148)` (`--inert`), and hovering each
    of them left every one of the eleven at that colour, the two ghost buttons
    keeping the resting `rgb(32, 38, 46)` (`--line-control`) border. The control
    for the reading is the live case at the same size: hovering the `game`
    document's `Panels` resolved it to `rgb(237, 239, 242)` (`--text`) with a
    `rgb(51, 58, 68)` (`--line-hover`) border, **15.88:1** — which is exactly
    what the inert one showed before the fix, at the same size and on the same
    control. Enumerating the live stylesheet found **6** rules with a `:hover`
    that sets a colour; three of them (`.ghost-button`, `.primary-button`,
    `.decision`) can match an inert control, and each now ships its `.is-inert`
    answer beside it, while `.state-shortcut` and the palette rows never go
    inert (`outsideRefusal`) and `.rail-mode:hover` sets only a background.
  - **A palette row keeps its dismiss action through a profile switch.** Opened
    on `--overlay palette`, `palette-sculpt-from-reference` renders
    `data-action="overlay"` in every profile. Clicking the Kids chip made it
    `data-kind="inert" aria-disabled="true"` and clicking it then left the
    overlay open (`data-overlay` still `palette`, the dialog still
    `display: grid`) — the `aria-disabled` guard, not a missing attribute.
    Clicking Game promoted it back to `view`, and clicking it closed the palette
    (`data-overlay` `none`, `display: none`). Before the fix the attribute was
    emitted only when the control was live at render time, so a Kids-rendered
    document had a row that announced itself live after the switch and did
    nothing.
  - **The Kids lock screen is reachable at every tier.** Read from computed
    style at 1680×1000, 1280×800, 1024×700, and 1920×620: the shell body kept
    `mode-rail, profile-refusal, assistant` in flow, the editor refusal resolved
    to `display: grid`, the assistant column to `flex` (never a drawer), its lock
    panel to `flex`, its body and composer to `none`, and the model label to
    `denied`. At 800×560 the shell resolved to `display: none` and the
    `DESKTOP_WINDOW_BELOW_MINIMUM` refusal to `display: block`, naming `900×600`.
  - **A Kids drawer toggle refuses instead of announcing an expansion it cannot
    make.** At 1024×700 and 1920×620 — the tiers where
    `.title-actions .drawer-toggle` resolves to `display: flex` — `drawer-left`
    and `drawer-inspector` render `data-kind="inert"`, `aria-disabled="true"`,
    `data-refusal="OPEN_PATH_KIDS_REFUSED"`, with an `aria-describedby` that
    resolves. Clicking `Panels` from behind the refusal left `data-drawer-left`
    at `closed` and `aria-expanded` at `false`, and `.left-dock` at
    `display: none`. Before the fix both were live `view` buttons that set
    `aria-expanded="true"` on a region the Kids rules keep shut at every size.
  - **A drawer opened before the switch is closed by it.** The other order,
    which the demotion alone did not cover. At 1024×700 on `game`, clicking
    `Panels` gave `data-drawer-left="open"`, `aria-expanded="true"`, and
    `.left-dock` `display: flex`; clicking **Kids** then left `data-drawer-left`
    `closed`, `aria-expanded` `false`, the toggle `data-kind="inert"` with
    `OPEN_PATH_KIDS_REFUSED`, and `.left-dock` `none`. Same at 1920×620 with
    **both** drawers opened first — both reset. Clicking **Game** restored two
    live `view` toggles at `aria-expanded="false"`, and `Panels` opened
    `.left-dock` to `flex` again. Before the fix the attribute survived the
    switch, so an inert toggle announced an expansion over a panel the refusal
    had already taken off screen.
  - **The refuse-only decision holds through a client-side switch, in both
    drawer tiers.** Driven at **1280×800** and at **1024×700** from the default
    `game` document, computed style at each step: clicking the **Kids** chip gave
    `data-assistant="denied"`, the lock `flex` and the column `flex` (not a
    drawer), composer `none`, label `denied`, the editor refusal `grid`, and
    **7 rail modes plus 2 drawer toggles** `aria-disabled` with resolving
    reasons. Clicking a mode and clicking `Panels` from behind the refusal
    changed nothing (`data-mode` stayed `build`, `data-drawer-left` stayed
    `closed`), and clicking the denied toggle changed nothing. Clicking **Game**
    restored a usable column — lock `none`, label `no provider configured`, rail
    and drawer toggles live again — after which `Panels` opened `.left-dock` to
    `flex`, **one** toggle press opened the assistant drawer
    (`flex`, `aria-pressed="true"`, fill `rgb(25, 18, 7)`) and the next closed
    it. **0 dangling `aria-describedby`** at every step, in both tiers.
  - **The status bar names the profile the switch actually landed on.** Driven
    from the `game` document at **1680×1000, 1280×800, 1024×700 and 1920×620**,
    reading the footer's own text node at each step: rendered
    `game profile · core 0.0.0`; clicking **Kids** gave
    `kids profile · refuse-only · separate origin` in the same tick as the editor
    refusal resolved to `grid`, the assistant to `denied`, and the inert count to
    **47**; clicking **Website** gave `web profile · core 0.0.0`; clicking
    **Game** returned to `game profile · core 0.0.0`. **0 dangling
    `aria-describedby`** at every step. Before the fix the pin was rendered
    correctly and then never updated, so the footer read
    `game profile · core 0.0.0` under the full `OPEN_PATH_KIDS_REFUSED` lock
    screen — the one claim on this shell that is a profile assertion rather than
    a panel.
  - **The toggle never claims a column the viewport does not show — including in
    a document rendered for another one.** The 1680×1000 `build.html` bytes ship
    `data-drawer-assistant="closed"`; opened at 1680×1000 the column resolved to
    `flex` with `aria-pressed="true"` and the accent fill `rgb(25, 18, 7)`, and
    the *same bytes* opened at 1280×800, 1920×700, and 1024×700 resolved to
    `none` with `aria-pressed="false"` and the plain `rgb(18, 21, 26)` fill. That
    is the case the previous attribute got wrong: seeded from the render size it
    said `open`, and the drawer sat over the inspector until a script ran.
  - **Interactivity matches the model.** Switching to `animate` rebuilt the dock
    tabs to `["timeline","changes","console"]`, each with an `id`, a `data-kind`,
    and `dock-panel-timeline` the visible panel. Deciding one Change Review row
    moved the badge `3 → 2` and the computed-visible row count to 2; **Accept
    all** took the badge to `0`, left **0** visible rows, resolved the bulk
    actions to `display: none` and the empty state to `block`. In `run`, which
    has no Changes tab, the bulk actions were `none` and `dock-panel-console` was
    the visible panel.
  - **Roving tabindex is a working pattern.** On the dock strip `ArrowRight`
    moved focus to `dock-assets`, moved `aria-selected` with it, and left
    `dock-panel-assets` as the only visible panel; `End` reached `dock-evidence`
    and `Home` returned to `dock-changes`. On the viewport strip `ArrowRight`
    focused `viewport-source-game`, which reports `data-kind="inert"` and
    `data-refusal="DESKTOP_NO_PRESENTATION_RUNTIME"`, and the selection stayed on
    `viewport-source-scene` — nothing is switched, because nothing can be.
  - **Reduced motion**, in a Chrome launched with `--force-prefers-reduced-motion`:
    `matchMedia('(prefers-reduced-motion: reduce)')` matched, the sculpt sweep
    resolved to `display: none`, and the progress animation collapsed to
    `1e-06s` while the `progressbar` kept `aria-valuenow="64"` and
    `aria-label="Pass 3 of 5"` and the modelled `sculpt-cancel` stayed on screen
    at `display: flex` with `data-kind="view"`.
  - **Window tiers match `WINDOW_TIERS` exactly**, measured as which children of
    `.shell-body` are still in flow: 1680×1000 `mode-rail, left-dock,
    viewport-column, inspector, assistant` with 0 drawer toggles visible;
    1280×800 and 1920×700 `mode-rail, left-dock, viewport-column, inspector` with
    0 toggles; 1024×700 `mode-rail, viewport-column` with 2 toggles visible;
    800×560 the refusal.
  - `<meta name="sceneaxi-pixels-drawn" content="false">` unchanged.


- **Not claimed, and not claimable here**: an installer, a packaged desktop
  application, real renderer finality, live commerce, any file size or hash, and
  any pixel drawn by an engine. None of those exist on this surface. The packaged
  Linux application consumes this chrome unforked from its own tier, where those
  claims are made against real artifacts and a real frame report
  ([`desktop-linux.md`](desktop-linux.md), ADR 0024) — it changes nothing here.

## Extending it

- A new mode means an entry in `DESKTOP_MODE_IDS` **and** `DESKTOP_MODES`, a
  `dockTabsFor()` branch, and a `MODE_PANELS` row; the tests assert every mode
  has all four.
- A new refusal means an entry in `DESKTOP_VISUAL_REFUSALS`, a sentence in
  `DESKTOP_REFUSAL_MESSAGES`, and a state in the reachability test that reaches
  it — the test asserts the registry and the reachable set are equal.
- A new colour means a contrast check: `test/visual-tokens.test.ts` recomputes
  every text token against every surface, so a token added without clearing the
  floor fails there rather than in review.
- A new **control** needs nothing extra to be safe on the refuse-only profile:
  mint it through the projection's own `control()` and it is demoted with
  everything else. Reaching for the exempt `outsideRefusal()` is the deliberate
  act, and it needs a reason the control is not behind the refusal. Rendering it
  through `button(control, …)` is likewise not optional —
  `test/control-accounting.test.ts` fails in both directions, and if the control
  names a region through `aria-controls`, that region needs a row in the test's
  `REGION_CHAINS` or the test fails rather than skipping it.
- A new window tier means a row in `WINDOW_TIERS` alone: the stylesheet
  interpolates its breakpoint from that table, on both axes, and
  `test/control-accounting.test.ts` then checks refusal reachability at the new
  tier without anyone adding a case.
- A new control means adding it to the view **and** rendering it through
  `button(control, …)`. There is no third option: leaving it unrendered fails
  `test/control-accounting.test.ts` from the model side, and drawing a raw
  `<button>` for it fails from the document side.
- A change to Foundations v2 upstream means updating `FOUNDATIONS_V2_COLORS`
  **and** giving any new token a disposition in `FOUNDATIONS_V2_ALIGNMENT`; the
  test asserts the sheet is accounted for in full, so a token added upstream and
  ignored here fails rather than passing quietly. Do **not** resolve that by
  importing `packages/site-kit` — the dependency matrix forbids it here, and the
  duplication is deliberate and recorded above.
