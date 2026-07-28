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
| **carried** (21) | `--bg-base`, `--bg-panel`, `--bg-raised`, `--bg-control`, `--bg-field`, `--bg-row`, `--line-soft`, `--line`, `--fg`, `--fg-2`, `--accent`, `--accent-hi`, `--ok`, `--danger`, `--info`, `--axis-x`, `--axis-y`, `--axis-z`, `--kids`, `--store-web`, and the `Archivo`/`JetBrains Mono` families | the sheet's hex, verbatim |
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
one of three kinds, and `test/visual-model.test.ts` asserts that an inert control
always has a refusal and a live one never does.

| Kind | Meaning | Examples |
|---|---|---|
| `view` | changes visual state; genuinely works | mode rail, dock tabs, profile switch, assistant open/close and its Ask/Build/Agent modes, the overlay openers and each of the four overlay dismiss buttons, the sculpt cancel, drawer toggles |
| `review` | edits the fixture Change Review queue; **writes no document** | accept/reject a row, accept all, reject all |
| `inert` | renders, keeps its focus stop, refuses by name | Sculpt object, assistant Send, menu bar, the three viewport-source tabs, the palette rows naming CLI-only verbs, and — on the refuse-only profile — the whole mode rail and the assistant's toggle and close |

There is no fourth kind. Nothing in the chrome reaches `@sceneaxi/authoring-core`,
so it cannot write a document by accident, and `test/app.test.ts` proves a
`chrome` invocation leaves a document byte-identical.

### Refusal registry

`DESKTOP_VISUAL_REFUSALS` is closed, and every entry is reachable from some state
— asserted in both directions.

| Code | When |
|---|---|
| `OPEN_PATH_KIDS_REFUSED` | the refuse-only profile, and every mode on the rail behind it; the code comes from the shared open-path policy, not from here |
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
- **The toggle reports what the tier actually shows.** Below `regular` the
  assistant column can be `open` and still not on screen, so both the toggle's
  `aria-pressed` and its accent styling read `data-drawer-assistant`, which the
  model seeds from the tier (`assistant.togglePressed`) and the emitted script
  keeps in step with a `matchMedia` listener. One press opens the drawer at every
  tier; there is no first press that only turns off a claim nothing honoured.
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
- **Real controls**: every interactive element is a `<button type="button">`, so
  keyboard order is DOM order. There are no click handlers on `div` or `span`.
- **Inert controls stay reachable.** An inert control is marked `aria-disabled`
  rather than `disabled`, so it keeps its focus stop, and `aria-describedby`
  points at the paragraph carrying its refusal — a screen reader gets the reason,
  not just "dimmed". **Every** interactive element in the document is rendered
  through the one `button(control, …)` helper — the mode rail, the dock tabs, the
  viewport-source tabs, the profile chips, the drawer openers, the status-bar
  overlay shortcuts, the assistant modes, the sculpt cancel, and each of the four
  overlay dismiss buttons — so a control cannot reach the document without its
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

## Deviations from the archive, and why

Each row is also carried as data in `DEVIATIONS`.

| Deviation | Archive | Shipped | Why |
|---|---|---|---|
| Dim text tiers collapsed | `#6E7681` (4.36:1), `#565E68` (3.05:1), `#3F464F` (2.10:1), `#333A42` (1.74:1) | two passing tiers, `#8A929C` and `#7D8694` | all four fail the 4.5:1 text floor on the surfaces they are used on. Lightening them monotonically would have produced four indistinguishable greys; two tiers keep a real hierarchy, and the archive's remaining separation is carried by size, weight, and letter-spacing, which is preserved. |
| Struck-through review value | `#7A6448` (3.42:1) | `#A08663` | same floor |
| Web fonts | `fonts.googleapis.com` link for Archivo + JetBrains Mono | font-family stack, no remote request | the emitted document is self-contained and offline. The archive families are named first and render when installed; otherwise the system UI face does. |
| Fixed stage | 1680×1000 scaled with a transform | fluid layout, four window tiers | see above |
| Informational blue | the member carries both `#5B9CFF` and a lighter `#8FB7F5` for the same informational role | `#5B9CFF` | the two archive members disagree, so the shared sheet settles it: Foundations v2 canonicalises `--info` to `#5B9CFF`, D1 makes the sheet binding, and the value clears the text floor here anyway (6.16:1 at worst on `SURFACE`, 6.48:1 on the note's own fill) — so there is no accessibility reason to keep the member's lighter variant, and keeping it would be drift from the shared layer. |
| Kids profile | a working editor with only the assistant locked | the **whole editor body** refuses | **contract conflict, resolved for the repository.** The Kids product is an isolation boundary with no UI (`open-path-policy.md`, `OPEN_PATH_KIDS_REFUSED`). An editor that merely looked disabled under a Kids badge would still be a Kids authoring UI. The rail goes inert too — in the emitted bytes, not only after a click — so no mode can be entered from behind the refusal; the profile switch stays live so the refusal is a state you can leave. |
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
  size, frame rate, or timing in **any** state. `apps/desktop-shell/test/bin-smoke.test.ts`
  spawns the real binary and renders a document from it.

- **The model/renderer split is enforced, not conventional** —
  `apps/desktop-shell/test/control-accounting.test.ts`. Four review rounds each
  found the next instance of one family of fault: a control the model built and
  the renderer never drew, a button the renderer drew that no control accounted
  for, or a state the document reported untruthfully. The split itself was sound;
  nothing checked it. That file checks three things across sixteen states, and
  each is derived rather than listed, so a newly modelled control is covered the
  moment it exists:
  1. Every control reachable by walking `desktopVisualView()` is in the document
     with the kind it declares, and an inert one with its `data-refusal` and a
     legend row its `aria-describedby` resolves to. The one deliberate exception
     is `profiles[].assistant`, the projection of the *other* profiles that the
     renderer serializes into the script's switch table instead of drawing.
  2. No `<button>` in the document lacks the `id` + `data-kind` pair only
     `button(control, …)` emits, every such id is one the model minted, and no
     other interactive element or focus stop exists at all.
  3. Every named refusal resolves to a visible region **at every window tier**,
     computed through the emitted stylesheet's own cascade — media conditions,
     selector matching, specificity, source order, and `!important` — rather than
     by reading a `hidden` property. A companion case asserts the same helper
     reports `display: none` for the docked assistant below the regular tier, so
     the check cannot pass vacuously. This is the property the Kids lock screen
     failed at 1280×800.

- **Real browser, re-recorded 2026-07-28 against this branch's final HEAD.**
  Not inherited: the previous record was taken before the fixes for the Kids
  drawer refusal, the assistant toggle's tier reporting, and the modelled
  controls that were not being drawn, all three of which change what ships.
  **Every visibility claim below is `getComputedStyle(...).display`**, not a
  `hidden` property — the methodology flaw that made an earlier "Accept all hid
  the bulk actions" claim unsound. Chrome via `chrome-devtools-axi`, documents
  rendered by `node apps/desktop-shell/bin/sceneaxi-desktop.mjs chrome`, opened
  from `file://`, at 1680×1000 unless a size is named. The sweep now covers three
  window shapes rather than one: 1680×1000, 1280×800 (the drawer tier), 1920×700
  (**wide but short** — a tier the model reaches on height alone), 1024×700, and
  800×560.

  - **Region geometry at 1680×1000 is the archive's own, to the pixel**:
    title bar `36`, mode rail `56`, left dock `274`, inspector `326`, assistant
    `344`, view tabs `32`, dock `228`, status bar `27`, shell `1680×1000`.
  - **The adopted language is what the browser resolved**: `--accent` `#FF6B2C`,
    `--info` `#5B9CFF`, shell `rgb(7, 8, 10)` (`#07080A`), title bar
    `rgb(13, 15, 18)`, panel header `rgb(18, 21, 26)`, body font resolved to
    `Archivo`.
  - **Exactly one network request** — the document itself
    (`GET file://…/build.html [200]`, and `performance.getEntriesByType(
    'resource')` empty). No font, script, style, or image was fetched.
  - **Every button came from the helper.** In all ten documents measured,
    **0** buttons lacked the `id` + `data-kind` pair, and **0**
    `aria-describedby` references dangled. `build` renders 58 buttons, 53 plain
    focus stops, **0 unlabelled**, 17 inert; `kids` renders 29 inert — the seven
    rail modes, the assistant toggle and close, and the three assistant modes
    join them, each with a resolving reason. The only inert controls outside the
    plain Tab order are `viewport-source-game` and `viewport-source-sculpt-preview`,
    which carry `tabindex="-1"` because the viewport strip uses roving tabindex,
    and the arrow keys reach them.
  - **Every `role="tablist"` owned only `role="tab"` children** in all ten
    documents, so the bulk accept/reject and the spacer are outside it.
  - **The viewport carries one note**, `VIEWPORT_INERT_NOTE`; the archive's
    "not the final choice" line is not in the document.
  - **Rendered contrast sweep**, computing each visible text-bearing element's
    colour against its resolved (alpha-composited) background, skipping
    `aria-hidden` subtrees: **0 failures below 4.5:1** in every state measured —
    `build` (84 elements, worst 5.42:1), `sculpt` running (104, 5.42:1), `run`
    (57, 5.42:1), the `palette` overlay (107, 5.11:1), and `kids` (48, **4.60:1**
    — the `refuse-only` chip at 8.5px, the worst on the surface), and the same at
    1280×800, 1920×700, and 1024×700. This sweep is also what *found* a real
    defect during implementation — an inert icon button on the accent fill
    inherited `--dim` from a later equal-specificity rule and rendered at
    **1.11:1**; it is fixed and the rule that fixes it is commented in place.
  - **The Kids lock screen is reachable at every tier.** Rendered with
    `--profile kids` and read from computed style: at 1680×1000, 1280×800,
    1920×700, and 1024×700 the shell body kept `rail, profile-refusal, assistant`
    in flow, the editor refusal resolved to `display: grid`, the assistant column
    to `flex`, its lock panel to `flex`, and its body and composer to `none`, with
    the model label `denied`. At 800×560 the shell resolved to `display: none` and
    the `DESKTOP_WINDOW_BELOW_MINIMUM` refusal to `display: block`, naming the
    `900×600` minimum. Before the fix this was `display: none` below 1440px with
    no control able to open it.
  - **The refuse-only decision holds through a client-side switch, in a drawer
    tier.** Driven at **1280×800** from the default `game` document, computed
    style at each step: clicking the **Kids** chip gave `data-assistant="denied"`,
    the lock `flex` and the column `flex` (not a drawer), composer `none`, model
    label `denied`, the editor refusal `grid`, all seven rail modes and all three
    assistant modes `aria-disabled` with resolving reasons. **Clicking a mode from
    behind the refusal did not change mode** (`data-mode` stayed `build`), and
    clicking the denied toggle changed nothing. Clicking **Game** restored a
    usable, correctly-closed column — lock `none`, label `no provider configured`,
    rail and assistant modes live again — and then **one** toggle press opened the
    drawer (`flex`, `aria-pressed="true"`) and the next closed it. **0 dangling
    `aria-describedby`** at every step.
  - **The toggle never claims a column the tier does not show.** At 1680×1000
    `aria-pressed="true"` with the accent fill `rgb(25, 18, 7)` and the column at
    `flex`; at 1280×800, 1920×700, and 1024×700 `aria-pressed="false"` with the
    plain `rgb(18, 21, 26)` fill and the column at `none`.
  - **Interactivity matches the model.** Switching to `animate` rebuilt the dock
    tabs to `["timeline","changes","console"]`, each with an `id` and a
    `data-kind`. Deciding one Change Review row moved the badge `3 → 2` and the
    computed-visible row count to 2; **Accept all** took the badge to `0`, left
    **0** visible rows, resolved the bulk actions to `display: none`, and the
    empty state to `block`. In `run`, which has no Changes tab, the bulk actions
    were already `none`.
  - **Roving tabindex is a working pattern.** On the dock strip `ArrowRight`
    moved focus to `dock-assets`, moved `aria-selected` with it, and left
    `dock-panel-assets` as the only panel with a computed display; `End` reached
    `dock-evidence` and `Home` returned to `dock-changes`. On the viewport strip
    `ArrowRight` focused `viewport-source-game`, which reports `data-kind="inert"`
    and `data-refusal="DESKTOP_NO_PRESENTATION_RUNTIME"`, and the selection stayed
    on `viewport-source-scene` — nothing is switched, because nothing can be.
  - **Reduced motion**, in a Chrome launched with `--force-prefers-reduced-motion`:
    `matchMedia('(prefers-reduced-motion: reduce)')` matched, the sculpt sweep
    resolved to `display: none`, and the progress animation collapsed to
    `1e-06s` while the `progressbar` kept `aria-valuenow="64"` and
    `aria-label="Pass 3 of 5"` and the modelled `sculpt-cancel` stayed on screen.
  - **Window tiers match `WINDOW_TIERS` exactly**, measured as which children of
    `.shell-body` are still in flow: 1680×1000 `rail, left dock, viewport,
    inspector, assistant` with 0 drawer toggles visible; 1280×800 and 1920×700
    `rail, left dock, viewport, inspector` with 0 toggles; 1024×700
    `rail, viewport` with 2 toggles visible; 800×560 the refusal.
  - `<meta name="sceneaxi-pixels-drawn" content="false">` unchanged.


- **Not claimed, and not claimable here**: an installer, a packaged desktop
  application, real renderer finality, live commerce, any file size or hash, and
  any pixel drawn by an engine. None of those exist on this surface.

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
