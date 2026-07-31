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
| Desktop projection | `apps/desktop-shell/src/visual-model.ts` | derives its mode table, dock-tab derivation, assistant modes, and tier thresholds from the shared vocabulary; everything else unchanged |
| Web projection | `packages/site-kit/src/editor-shell.ts` (`buildEditorShellView`) | binds the vocabulary to one real session render: every panel value, every control's kind, every refusal |
| Web renderer | `sites/umbrella/src/app/editor/_components/editor-shell.tsx` + the `.edshell` section of `globals.css` | draws the view and decides nothing; client state is chrome navigation only |

The vocabulary lives in `@sceneaxi/schemas` because the dependency matrix lets
both consumers name exactly `schemas` + `authoring-core` — the same reasoning
that placed the open-path policy there. Parity is a data identity in
`tests/parity/editor-shell-parity.test.ts`: modes, rail labels, dock tabs,
assistant modes, tier thresholds, archive anchor, and structural metrics are
asserted equal across schemas, the desktop model, the web view, and the web
stylesheet's derived breakpoints. There is **no second state machine**: the one
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

| Surface | Backing |
|---|---|
| Scene tree, layers, inspector transform/kernel facts | the session's own `snapshot()` — real instance ids, transforms, kernel tick/collisions/digest |
| Viewport | the existing ADR 0022 boundary: `EditorViewport` over `useSculptViewport`, drawing the session's composed `MountableScene` on a real `WebGLRenderer`; the compact strip below it is the browser frame's own report |
| Changes dock | the **real** proposal this render saved through propose/apply, reviewed by `reviewProposal` against the captured pre-save document (`EditorRender.baseDocument`); rows read `applied` because apply is E1 all-or-nothing — accept/reject per row renders inert and says so |
| Console dock | the operations this render actually performed, in order, with real ids and digests |
| Evidence dock | the starter artifact digest, sculpt spec digest, composed scene digest, kernel session digest — all recomputed, none typed in |
| Sculpt mode | the starter reconstruction's real facts: `REQUIRED_SCULPT_PASSES`, seed 8001, method/intake/spec digests; "Sculpt object" is inert (`EDITOR_OPERATION_NOT_ON_THIS_SURFACE`) |
| Scene mode | the real `composeSceneProjection()` — world transforms, parent/depth, scene digest; placement copy restates ADR 0014's rule |
| Run mode | real play/pause through the session (`play`/`step` server-side), real tick, the honest server-frame panel (`headless`, `pixelsDrawn: false`) beside the browser report that does draw |
| Ship mode | contract-only targets and an inert export — a handoff is data, not authority, and building one is not a Minimum E2 operation |
| Plugins mode | the real seeded capability registry rows; nothing is loaded on this surface and the panel says so |
| Assistant | honest seat: `no provider configured` (no live adapter in core); Send is inert (`EDITOR_ASSISTANT_NO_PROVIDER`); on Kids the seat is the deny (`THIRD_PARTY_LLM_DENIED_BY_DEFAULT`) |
| Profile chips | `openPathPolicyView()` projected, never restated; the Kids chip swaps the editor body for the policy's own refusal (`OPEN_PATH_KIDS_REFUSED`), demotes the rail, and keeps the chips live — a refuse-only state is a state you can leave |
| Command palette | rows bind to this surface's real controls or refuse by name; CLI-only verbs render inert with `EDITOR_VERB_CLI_ONLY` and print their verb |

The closed refusal registry is `EDITOR_SHELL_WEB_REFUSALS` in
`packages/site-kit/src/editor-shell.ts`; every code is reachable and every
control's kind is asserted in `packages/site-kit/test/editor-shell.test.ts`.
Every interactive element renders through one kind-aware helper
(`ShellButton`), inert controls keep their focus stop with `aria-disabled` and
an `aria-describedby` resolving into the printed legend.

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
  refuses by name (`EDITOR_WINDOW_BELOW_MINIMUM`) with no script involved.
- **The site masthead and footer are collapsed on this route**
  (`editor/layout.tsx`, `display: none` — removed from the accessibility tree,
  not painted over), because the shell owns the whole viewport like the
  application it depicts; the title-bar wordmark links home.
- **Traffic lights and collaborator avatars are not drawn** — a web page has no
  window controls, and there are no collaborators to show.

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
  status bar `Running — deterministic`.
- **The Kids chip is the policy's own lock**: clicking Kids replaced the editor
  body with `OPEN_PATH_KIDS_REFUSED` and the policy summary, set the assistant
  seat to `denied` with `THIRD_PARTY_LLM_DENIED_BY_DEFAULT`, demoted the rail
  to inert, kept all three chips live, and pinned the status bar to
  `kids profile · refuse-only · separate origin`; clicking Game restored the
  editor.
- **Control accounting held in the live page**: every interactive element
  carried `data-kind`; 36 buttons with 13 inert on the measured build state,
  and **0** dangling `aria-describedby` references.
- **Tiers behave as the shared table says**: at 1280×800 the assistant became
  an overlay; at 1024×700 the side panels reflowed under the viewport with the
  menus dropped; at 800×560 the chrome was replaced by the
  `EDITOR_WINDOW_BELOW_MINIMUM` refusal naming 900×600.
- **The palette opens on ⌘K and the Search control**, groups its rows, prints
  CLI verbs beside CLI-only rows, closes on Escape with focus returned.

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
  kind and no legend wiring.
- A new live control must name operations from `WEB_EDITOR_SESSION_OPERATIONS`;
  widening that set is an ADR 0003 event, not an editor change.
