# The web editor's Engine Desktop shell

The umbrella's entitled `/editor` route drawn as the accepted Engine Desktop
chrome (sceneaxi#184), over the same real bounded Minimum E2 session the
previous page rendered. This document owns three things nothing else does:
**where the shared editor product model lives and what each layer decides**,
**where this surface deliberately departs from the archive**, and **the
recorded browser evidence** behind every visual and liveness claim.

It authorizes nothing. Where it disagrees with an ADR, a schema, a refusal
registry, or an executable gate, that owner wins. The desktop chrome's own
record stays [`engine-desktop-surface.md`](engine-desktop-surface.md); this
file covers the web surface only.

## One product model, two surfaces

| Layer | Owner | Decides |
|---|---|---|
| Shared vocabulary | `packages/schemas/src/editor-shell.ts` (`EDITOR_SHELL_MODES`, dock tabs, viewport sources, assistant modes/states, control kinds, window tiers, structural metrics, retired copy) | what the editor's chrome *is* — for every surface |
| Desktop projection | `apps/desktop-shell/src/visual-model.ts` | derives its mode table, dock-tab derivation, assistant modes and states, viewport sources (ids **and** labels), and tier thresholds from the shared vocabulary; everything else unchanged |
| Web projection | `packages/site-kit/src/editor-shell.ts` (`buildEditorShellView`) | binds the vocabulary to one real session render: every panel value, every control's kind, every refusal |
| Web renderer | `sites/umbrella/src/app/editor/_components/editor-shell.tsx` + the `.edshell` section of `globals.css` | draws the view and decides nothing; client state is chrome navigation only |
| Web Experience projection | `packages/schemas/src/web-experience-authoring.ts` + `packages/site-kit/src/web-experience-editor.ts` + `sites/umbrella/src/app/editor/_components/web-experience-editor.tsx` | the deliberately smaller page/HTML/site-canvas interface, sandbox policy, known asset injection, safe draw-only Three embed, and named desktop-only refusals; owner doc [`web-experience-editor.md`](web-experience-editor.md) |

The vocabulary lives in `@sceneaxi/schemas` because the dependency matrix lets
both consumers name exactly `schemas` + `authoring-core` — the same reasoning
that placed the open-path policy there. Parity is a data identity in
`tests/parity/editor-shell-parity.test.ts`: modes, rail labels, dock tabs,
assistant modes, assistant states, viewport source ids and labels, tier
thresholds, archive anchor, and structural metrics are asserted equal across
schemas, the desktop model, the web view, and the web stylesheet's derived
breakpoints. There is **no second state machine**: the one
live editor state machine remains `createMinimumE2Editor` in
`@sceneaxi/authoring-core`, reached through `createWebEditorSession`, and the
chrome's client state (active mode, dock tab, overlay, assistant visibility,
profile projection) is navigation over one server-rendered truth.

## What is live, and what refuses

Engine state never changes in the browser. Every `live` control is a link or a
GET form that re-renders `/editor` with new URL state, so the canvas can never
show a scene the server session did not produce, and the frozen
`WEB_EDITOR_SESSION_OPERATIONS` set is not widened (ADR 0003, ADR 0020 — the
entitlement decision still happens before any session exists).

The Web Experience projection introduced by #197 has a separate, closed set of
document-projection operations. They are marked `web-authoring`, not `live`, are
asserted disjoint from `WEB_EDITOR_SESSION_OPERATIONS`, and rebuild a
text-canonical Web document without calling the Minimum E2 session. Its optional
Three surface is draw-only. This distinction keeps the Engine Desktop rule above
intact while giving the smaller Web profile its explicitly bounded authoring
surface; [`web-experience-editor.md`](web-experience-editor.md) owns that contract.

Because of that, the **active mode rides in the URL too** (`mode`, read by
`readEditorState` and written by `editorHref`). It is view state and nothing
else: it names no session operation, no render reads it, and all seven modes
show the same session — an unknown value opens the default mode rather than
refusing, while a parameter outside the editor and deep-link contracts still
refuses `DEEP_LINK_UNKNOWN_PARAMETER`. It has to be carried because a mode kept
only in the browser is lost on the very click it was meant to answer: Run's own
Play control is a navigation, and without the parameter it returns in Build,
away from the tick it just produced. Switching mode stays client-side; the shell
opens in `view.activeModeId` and rebuilds each href — and the edit form's hidden
field — in the mode the reader is in.

| Surface | Backing |
|---|---|
| Scene tree, layers, inspector transform/kernel facts | the session's own `snapshot()` — real instance ids, transforms, kernel tick/collisions/digest; indentation walks the snapshot's own parent chain, so an artifact's nested runtime hierarchy draws at its real depth, and each selectable row is a minted `live` control on `select` rather than a bare link |
| Viewport | the existing ADR 0022 boundary: `EditorViewport` over `useSculptViewport`, drawing the session's composed `MountableScene` on a real `WebGLRenderer`; the compact strip below it is the browser frame's own report |
| Changes dock | the **real** proposal this render saved through propose/apply, reviewed by `reviewProposal` against the captured pre-save document (`EditorRender.baseDocument`); an unreadable baseline refuses `EDITOR_CHANGES_BASELINE_UNREADABLE` rather than reading as "nothing to review"; rows read `applied` because apply is E1 all-or-nothing — accept/reject per row renders inert and says so. The apply is real and the workspace is not: `renderEditorState` creates it with `mkdtemp` and removes it in its `finally`, so the title bar reads `applied in session`, the dock prints `changes.persistenceNote`, and the status bar pins `changes.persistencePin` — the URL is the only thing that carries an edit |
| Console dock | the operations this render actually performed, in order, with real ids and digests |
| Evidence dock | the starter artifact digest, sculpt spec digest, composed scene digest, kernel session digest — all recomputed, none typed in |
| Sculpt mode | the starter reconstruction's real facts: `REQUIRED_SCULPT_PASSES`, seed 8001, method/intake/spec digests; "Sculpt object" is inert (`EDITOR_OPERATION_NOT_ON_THIS_SURFACE`) |
| Scene mode | the real `composeSceneProjection()` — world transforms, parent/depth, scene digest; placement copy restates ADR 0014's rule |
| Run mode | Play and Stop are rendered controls in the Run dock, not palette-only rows. Play is a real server-side `play` + `step` and a real tick. **Stop is a stop, not a pause**: the session is rebuilt per request, so dropping `play` from the URL ends this session and opens the next at tick 0, which is why the control says `Stop` and declares `dispose` instead of borrowing the `pause` operation no render here calls. Reset drops the URL state entirely. Beside them, the honest server-frame panel (`headless`, `pixelsDrawn: false`) and the browser report that does draw |
| Ship mode | contract-only targets and an inert export — a handoff is data, not authority, and building one is not a Minimum E2 operation |
| Plugins mode | the real seeded capability registry rows; nothing is loaded on this surface and the panel says so |
| Assistant | honest seat: `no provider configured` (no live adapter in core); Send is inert (`EDITOR_ASSISTANT_NO_PROVIDER`); on Kids the seat is the deny (`THIRD_PARTY_LLM_DENIED_BY_DEFAULT`) |
| Profile chips | `openPathPolicyView()` projected, never restated. Website swaps the desktop body for #197's smaller editor, demotes desktop chrome with `WEB_EXPERIENCE_DESKTOP_ONLY_OPERATION`, and withdraws the desktop palette/assistant. Kids swaps the body for the policy's own refusal (`OPEN_PATH_KIDS_REFUSED`), demotes the rail, Search, and assistant with that same code, withdraws the palette, and keeps the chips live — a refuse-only state is a state you can leave, and nothing else |
| Command palette | rows bind to this surface's real controls or refuse by name; CLI-only verbs render inert with `EDITOR_VERB_CLI_ONLY` and print their verb. The filter input filters, over row labels and CLI verbs |
| Viewport copy | `EDITOR_VIEWPORT_COPY.lede` and `.honesty` ride with the canvas in **every** mode, not inside the Run branch: the ADR 0017 core it names and the "draws only, never advances" statement are true of all seven |
| Catalog deep link | when the request carried one, the source, item, and artifact reference are shown with the one thing the link does not do — every editor session opens the shared starter scene, not that listing's own scene |

The closed refusal registry is `EDITOR_SHELL_WEB_REFUSALS` in
`packages/site-kit/src/editor-shell.ts`; every code is reachable and every
control's kind is asserted in `packages/site-kit/test/editor-shell.test.ts`.

## Catalog intake connection

The editor now has one TEST-only submission adapter at
`sites/umbrella/src/lib/catalog-submission.ts`. It accepts only an already
entitled non-Kids request and carries the current render's saved document digest
and composed artifact digest into the existing Catalog Item intake contract. It
is not a new authoring operation and is not in `WEB_EDITOR_SESSION_OPERATIONS`.
Preview access cannot submit.

**A page render never submits.** A GET of `/editor` calls
`readUmbrellaCatalogIntakePanel()`, which reads and never writes; the one control
that writes posts to `/api/editor/catalog-intake`, which is POST-only and is the
only caller of `buildUmbrellaCatalogIntakeView()`. The split, the same-origin
proof the action requires, and what the panel may display are owned by
[`catalog-intake.md`](catalog-intake.md).

Storage, curation, and the storefront read model are injected through that TEST
seam. The repository has no production provider or moderation operator, and the
only route to a listing remains the recorded
`intake → screening → curation → listed` path with explicit human approval.

### The notice rail

`.edshell` is `position: fixed; inset: 0` over an opaque `--bg-base`, on a page
that does not scroll. A notice rendered beside it in normal flow is therefore
painted underneath it and reachable at no viewport, and two independently fixed,
centred notes land on identical coordinates and hide each other. Both are why the
route's notices — the preview banner and the catalog intake state — render inside
one `.ed-overlay-notes` rail: fixed above the shell's stacking layer (`z-index`
40 against the shell's 30), opaque, a **column** so each notice takes its own row,
bounded by the viewport and scrolled internally.

This is a deviation the design archive does not draw; it exists because the
archive draws an application chrome and no route-level notice at all. Recorded
browser measurement (`SCENEAXI_SITE_EDITOR_PREVIEW=1`, both notices present): at
1920×1080, 1280×800, 1024×700, and 390×844 the rail is fully inside the viewport,
the two notices' rects do not intersect, and `document.elementFromPoint()` at the
intake panel's own coordinates returns an element inside that panel.

Control accounting has two halves, and both are load-bearing:

- **Every minted control renders through the one kind-aware helper**
  (`ShellButton`) — buttons and links alike, the scene tree's selection links
  included. Inert controls keep their focus stop with `aria-disabled` and an
  `aria-describedby` resolving into the printed legend.
- **Every remaining interactive element declares a `data-kind` of its own.**
  Form controls cannot go through the helper (they are a `<select>` and two
  `<input>`s), so each wears the id and the kind of the `view.edit.*` control it
  submits for; the dock tabs, the palette filter and close, the wordmark, and
  `EditorViewport`'s two canvas buttons are `view`. A live control that appears
  in neither half is the bug this rule exists to catch.

## Deviations from the archive, and why

- **No fabricated figures.** The archive prints `tris 18 412`, `20 fps`,
  `412 MB`, `saved 10:26`, fixture digests, a fixture project name, and a local
  model label. None of it ships — `EDITOR_SHELL_FABRICATED_FIGURES` pins the
  list, asserted absent from the serialized view and the shipped sources. What
  ships instead is measured: the browser frame's own `frame`/`drawCalls`, and
  the session's real digests.
- **The retired renderer sentence stays retired.** The archive's viewport
  carries "Preview renderer is experimental — not the final choice"; ADR 0017
  settled Three as the product presentation core, and
  `EDITOR_SHELL_RETIRED_COPY` keeps the sentence (and both retired labels)
  asserted absent.
- **The Changes queue is real, therefore not decidable per row.** The archive
  draws per-row ✕/✓ decisions. On this surface the proposal shown was already
  applied by the render (E1, all-or-nothing), so per-row decision buttons would
  be theatre; they render inert with the reason, and the row state reads
  `applied`.
- **Run's dock has Console and Evidence, not Console and Frames** — the shared
  model's mapping, recorded for the desktop chrome already: a "Frames" tab of
  fabricated recordings has nothing honest to show.
- **The fixed 1680×1000 stage is fluid**, on the shared window tiers: below
  1440×720 the assistant undocks to an overlay; below 1180×660 the side panels
  reflow under the viewport (a web-native adaptation of the desktop's drawers)
  and the menu row is dropped; below the shared 900×600 minimum the chrome
  refuses by name (`EDITOR_WINDOW_BELOW_MINIMUM`) with no script involved. A
  supported tier has to keep drawing, so the reflowed viewport row carries a
  **floor** rather than only a `1.6fr` share: the floor is the view tabs, the
  capped copy band, and the shrunk dock plus the canvas minimum
  (`--ed-narrow-*`), and the dock gives ground in `animate` too — the timeline
  rule is the more specific one, so shrinking `.ed-dock` alone would leave it at
  252px and take the canvas back. The
  refusal is the whole surface at that tier: the stylesheet withdraws the
  palette scrim with the other regions, because the palette is script-owned and
  cannot see the tier, and the refusal note itself is never made `inert`.
- **The site masthead and footer are collapsed on this route**
  (`editor/layout.tsx`, `display: none` — removed from the accessibility tree,
  not painted over), because the shell owns the whole viewport like the
  application it depicts; the title-bar wordmark links home. The footer rule is
  scoped `body > footer` so it reaches the root layout's footer only — the
  shell's own status bar is a `<footer>` as well.
- **The route keeps a document outline the archive has no picture of.** The
  archive draws an application chrome, which has a title bar rather than a page
  heading — but `/editor` is still a document, and the shell's `h3` section
  titles would otherwise be its first headings, with no `h1` above them. The
  shell therefore carries one clipped `h1` naming the editor (`.ed-shell-title`
  — clipped, not `display: none`, so it stays in the accessibility tree), and
  the panel heads are `h2` exactly as the desktop chrome already renders them
  (`chrome.ts`, `<h2 class="panel-head">`). Nothing about the drawn surface
  changes: `.ed-panel-head` pins its own weight and line box, so the promoted
  heading paints the same pixels the archive's panel head does.
- **Traffic lights and collaborator avatars are not drawn** — a web page has no
  window controls, and there are no collaborators to show.
- **The route's notices live in a rail the archive does not draw**, because the
  archive draws an application chrome and no route-level notice at all. Why the
  rail exists and its recorded measurement are above, under
  [The notice rail](#the-notice-rail).

## Recorded browser evidence (2026-07-31)

Chrome via `chrome-devtools-axi`, `sites/umbrella` dev server with
`SCENEAXI_SITE_EDITOR_PREVIEW=1`, window 1680×1050 unless a size is named.

- **Region geometry is the archive's, to the pixel**: title bar `1680×36`,
  mode rail `56` wide, left dock `274`, inspector `326`, assistant `344`
  (open), view tabs `32` high, dock `228`, status bar `27` — read from
  `getBoundingClientRect()` on the live page and equal to
  `EDITOR_SHELL_METRICS`.
- **The viewport draws real pixels**: the browser frame strip read
  `backend three · webgl-canvas · pixels drawn true · draw calls 10`, frame
  counter advancing (`210 → 1320` across the session); the run-mode server
  panel read `headless · pixels drawn false` beside it.
- **A transform edit is a real engine round trip**:
  `/editor?objects=3&sel=object-2&tx-object-2=1.5,1.2,0` rendered three mounted
  instances, the moved crate visibly raised in the canvas, inspector position
  `1.5, 1.2, 0`, and the composed doc digest changed (`05d2…6dd1 →
  ef84…d7c2`).
- **Play advances a real kernel**: `/editor?play=1` rendered
  `Play state playing · Tick 1`, frame digest `dcf1…0e5a` in both the runtime
  panel and the live-values inspector, console row `play · step 16ms · tick 1`,
  status bar `Running — deterministic`. That session drove the run state by URL
  (`?play=1`); the Run dock's own Play and Stop controls carry exactly that
  href, and are covered by the gate rather than by this recorded session.
- **The Kids chip is the policy's own lock**: clicking Kids replaced the editor
  body with `OPEN_PATH_KIDS_REFUSED` and the policy summary, set the assistant
  seat to `denied` with `THIRD_PARTY_LLM_DENIED_BY_DEFAULT`, demoted the rail
  to inert, kept all three chips live, and pinned the status bar to
  `kids profile · refuse-only · separate origin`; clicking Game restored the
  editor.
- **Control accounting held in the live page**: 36 buttons with 13 inert on the
  measured build state, and **0** dangling `aria-describedby` references. That
  count predates the review round that put the run controls, the scene tree's
  selection links, and the form controls into the accounting index, so treat the
  number as stale and the property — every interactive element declares a kind,
  no describedby dangles — as the thing to re-measure.
- **Tiers behave as the shared table says**: at 1280×800 the assistant became
  an overlay; at 1024×700 the side panels reflowed under the viewport with the
  menus dropped; at 800×560 the chrome was replaced by the
  `EDITOR_WINDOW_BELOW_MINIMUM` refusal naming 900×600.
- **The reflowed tier still draws** (measured 2026-07-31, after the row floor
  landed; the earlier session recorded the reflow without measuring the canvas,
  which had collapsed to a 9px sliver at 1024×700 and to nothing at 900×600):
  canvas element `842×105` at the 900×600 minimum, `966×123` at 1024×660 and
  1024×700, `942×153` at 1000×780, `1042×226` at 1100×900, `1121×288` at
  1179×1000 — and `968×123` in `animate` at 1024×700, whose dock shrinks with
  the rest. Nothing is clipped at the minimum: the dock ends at 448, the
  reflowed panels run 448→573 scrolled, the status bar 573→600, and the canvas
  chips sit clear of the viewport actions strip.
- **A live control returns in its own mode**: from Run, `#run-play-pause`
  navigated to `…&mode=run&play=1` and the shell came back with `RUN` pressed,
  `Play state playing`, the `Stop` control, and `Running — deterministic` —
  where before the click landed back in Build. From Scene, the inspector's edit
  form submitted `mode=compose` alongside the transform and returned in Scene.
  `?mode=bogus` opened Build; `?nope=1` still refused the link.
- **The palette opens on ⌘K and the Search control**, groups its rows, prints
  CLI verbs beside CLI-only rows, closes on Escape with focus returned. It
  declares `aria-modal`, so while it is open every sibling region — title bar,
  body, status bar — is `inert` and focus stays inside it; the hidden refusal
  legend stays reachable so the palette's own inert rows keep resolving their
  `aria-describedby`. The focus return runs in the effect that follows the
  close, not in the close handler, since a handler fires while those regions are
  still `inert` and focusing into an inert subtree does nothing. Its filter
  input, its withdrawal under the Kids lock, and that containment landed in
  later review rounds and are gate-covered, not part of this session.

## How to run it

```
cd sites/umbrella && pnpm install
SCENEAXI_SITE_EDITOR_PREVIEW=1 pnpm dev     # or: pnpm build && SCENEAXI_SITE_EDITOR_PREVIEW=1 pnpm start
# open http://localhost:3000/editor
```

Without the preview flag the route needs the wired identity plane and an
entitled principal (ADR 0020); an unentitled request renders a named refusal
and reaches no session and no canvas.

## Extending it

- A new mode, dock tab, viewport source, assistant mode, or tier is a change to
  the **shared vocabulary** in `packages/schemas/src/editor-shell.ts`; both
  surfaces and the parity suite move together or the gate fails.
- A new web-shell control is minted in `buildEditorShellView` with a declared
  kind; an inert one needs a registry code, and
  `packages/site-kit/test/editor-shell.test.ts` fails on an unreachable or
  unlisted refusal. Render it through `ShellButton` — a raw `<button>` has no
  kind and no legend wiring. A form control that cannot go through the helper
  carries its control's own `id` and `kind` instead; nothing interactive ships
  without one of the two.
- A new live control must name operations from `WEB_EDITOR_SESSION_OPERATIONS`;
  widening that set is an ADR 0003 event, not an editor change.
