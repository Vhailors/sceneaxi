# SceneAxi v6: locked direction "Interlocking", enriched (A-rich, signal box)

| Field | Value |
|---|---|
| Status | **A-rich LOCKED** by the conductor under explicit operator delegation ("do your own best recommendation"). See `RULINGS.md` §A-rich decision. **This is not a human visual sign-off: nobody viewed the images.** Underneath it, A's G2 lock (2–1) stands. A-rich is A plus the enrichment written into this file. |
| Sources | `concepts/a-rich/SPEC-DELTA.md` (**the locked look**; it overrides A where they differ), `concepts/a-rich/shots/metrics.json` (measured), `concepts/a/SPEC.md` (world, tokens), `concepts/a/SLICE.md` (measured slice), `concepts/a/CRITIQUE.md`, `BRIEF.md` (binding constraints, acceptance A1–A17), `BASELINE.md` (before numbers), G2 verdict and council, `GATE-BASELINE.md` (gate rule) |
| Precedence | 1. The conductor's A-rich carries: ends ARMED, home `placement:'home'` only, 13px floor, merge not append. 2. `SPEC-DELTA.md`. 3. A's `SPEC.md`. Where the prototype disagrees with a carry, the carry wins. |
| Slice worktree | `../sceneaxi-slice-1` (branch `slice-1`, base `2cef2033`, uncommitted). It is the source of the **structured Change Review rows** (`apps/web-shell/src/inspector-app.ts`). Do not delete it until the pilot has ported from it. |
| Owners | A5 owns tokens and the shared layer. The pilot (A6 + A9) owns the two signature screens. A7, A8 and A10 follow at G4. The must-fix list in §13 names an owner for each item. |
| Contrast figures | "measured" means browser-computed in the slice (`concepts/a/slice/measure-*.json`), the concept (`concepts/a/shots/contrast.json`) or A-rich (`concepts/a-rich/shots/metrics.json`). "pair" means WCAG 2.x luminance math on the token pair, computed for this file. Pair math is a design check. It does not replace the release check (A1, which is browser-computed per state). |

---

## 1. World statement

A **railway signal-box lever frame**. The page is a matte slate-green track-diagram panel. Containers are cast-iron frames. Labels are cream enamel plates. Only the levers are saturated, and their four regulation paints are the four product laws: pending, verified, refused and stale.

- A change is a **route being set**. The JSON Pointer is the route: each segment is a station, and the leaf is the terminal.
- Committing the change **throws the lever**.
- A refusal is an **interlock**: the lever will not travel, and its plate names the reason code.

The identity is **structural**, which is why it carries to every surface: WHERE / BEFORE / AFTER rows, a status plate with label and icon, cast frames with 2px corners, and a condensed plate face over humanist prose. It does not depend on a hue or a texture. "Lever", "route" and "interlock" are visual vocabulary only. They never appear in UI copy, which stays product copy (`CRITIQUE.md` heuristic 2).

The world is not near-black and has no neon accent (the v5 / Cinematic Pro rut). It is not cream editorial either (the opposite rut). The field is a mid-dark, matte, coloured panel.

A-rich adds two things, both from the same signalling vocabulary:

- **Lunar white.** This is the calling-on aspect, meaning "proceed at caution, examine the line". It becomes the second accent, and its only role is **inspect** (§5.8).
- **Depth by material.** The panel gains recessed beds, raised plates, cast frames and an enamel plaque (§8), so the page below the hero is no longer one flat green field.

## 2. Shared core (every surface, every dialect)

1. **State = label + icon + paint, never paint alone** (BRIEF A13). The meanings are fixed product law:

   | State | Plate label (examples) | Icon | Paint |
   |---|---|---|---|
   | Pending | "Pending review · unwritten" | clock | caution yellow |
   | Verified | "Verified · written" | check | clear mint |
   | Refused / rejected | "Rejected · nothing written", or the registry reason | octagon-bar | stop red |
   | Stale / superseded | "Superseded · not actionable" | rewind-slash | unpainted iron |
   | Outcome unknown | "Apply outcome pending" | rewind-slash | iron, with a recovery action |
   | TEST fixture | "TEST" | flask | outline only |

   The old value in a diff is **never red** (it is struck through in stale iron). Mint never sits on a button.

   **Lunar marks what is under inspection. Yellow marks what waits for a person's commit** (§5.8). Lunar is never a state on its own and never replaces a plate.
2. **Faces.** Plate: Big Shoulders Display, for headings and plates. Prose: Atkinson Hyperlegible Next, for body, labels, buttons and values in prose. Data: Atkinson Hyperlegible Mono, for pointers, digests and codes. Tabular numerals are on globally. See §6 for the size floors.
3. **Cast frames.** 2px corners on frames and controls. Round junctions only on track stations and Kids pieces. No glass, glow, gradient or blur (§8).
4. **Control boundaries use `--edge` (≥ 3:1).** `--rule` is decoration and is never the only boundary of a control or of a meaningful region.
5. **Links never change ink.** Hover changes only underline thickness (1px → 3px). Every button declares its own ink in every state (`--b-ink`). No global `a:hover { color }` exists anywhere. This removes the v5 1.20:1 defect by construction (BASELINE defect 1). A5 deletes the global rule at `packages/site-kit/src/design-tokens.ts` ~:615, or scopes it to `:where(a:not([class]))` with no colour change.
6. **`[hidden]` is honoured, but scoped.** Each world root gets `.<root> [hidden] { display: none !important; }`: `.il [hidden]` in the umbrella (`signal.css:37`), and the page-local rule in the web-shell inspector (`inspector-app.ts:806`, its own document). No global unscoped override in site-kit. Legacy components keep today's behaviour until their lane migrates them.
7. **The Change Review choreography** (§4) is the same on the hero, the inspector, the desktop changes dock and the umbrella `/editor` dock. Only density changes.
8. **Themed browser surfaces.** `::selection` uses pending on on-pending. The focus ring is 3px solid `--enamel` (dark) or `--ink` (light), offset 3px, and flips to dark ink on the enamel plaque (13.45). `scrollbar-color` uses siding on iron. `text-underline-offset` is 0.24em.
9. **Accept is commit yellow** wherever Change Review appears: `--commit` (= `--pending` #F2C230) with `--on-commit` ink. Other primary actions (Download, sign in, checkout) stay enamel. Only Accept, the write that waits for a person, is yellow.

## 3. The three dialects

| | **Persuade** | **Operate**: comfortable | **Operate**: compact | **Kids** |
|---|---|---|---|---|
| Surfaces | umbrella `/`, `/engine`, `/profiles`, `/pricing` (top), `/open`, docs (reading measure); store home, item page, `/publish` | `/login`, `/account`, `/pricing` panels, 404/error, the **store acquire block**, store error/loading | web-shell inspector, umbrella `/editor` dock, `/admin/ledger`, desktop chrome and docks | `sites/kids` studio, loading, global-error |
| Field | dark panel `#2F4A44` | dark panel. Web shell and desktop follow the system light/dark scheme (pinned) | as comfortable | light sky `#D6ECF4`, own blue `#1E4FBF` |
| Scale | display 56→96px, sections 72–112px, wrap 1320px | body 16px, 44px controls | body 14px, controls ≥ 28px tall (target ≥ 24×24 with spacing ≥ 24px, WCAG 2.5.8), 52px mast | body 18px, targets ≥ 44px, **aim 56** (Play 76px), choice tiles ≥ 120px |
| Interlock (refusal panel) | comfortable: 24/32px padding, lever drawn, 24px title | comfortable | compact: 12/14px padding, no lever, 16px title inline with the plate, 13px evidence | kind sentence + icon, no codes shown to the child |
| Motion | the three-act hero sequence (§4.6), played once; it ends **armed**, with a Replay control | none ambient; plates switch instantly | the Change Review echo (§4.7), once per Propose; none ambient | calm: the train loop only while Play is on (14s per lap). No lunar, no sequence |
| Copy | product claims with their limits shown as plates | contract text verbatim, codes in mono | same | short kind sentences from `kids-activity.ts` |

**Density is chosen by placement, never inherited** from a global `.state` rule. This fixes v5's wrong-density store refusals. An acquire block is comfortable even inside a compact grid. A dock is compact even on a Persuade page.

**Kids** stays in the family core: plates, round stations, track, label + icon states and the same corner family scaled up (2px → 14px). It has its own hue and scale, and it is never linked, named or themed from another surface. From A-rich it takes **planes only**: the board sits on a raised table plate (#EAF5F9, offset shadow), and builder groups sit in inset trays (#BFDDE8). It gets no lunar and no propose → inspect → commit sequence. Kids imports no SceneAxi package, so its tokens and fonts are a **copy** in `sites/kids`. `sites/kids/src/lib/**` is never touched.

**Desktop** never scales (pinned) and does not import site-kit. Its tokens are a recorded copy in `apps/desktop-shell/src/visual-tokens.ts` (A5). `opacity:` appears only inside keyframes (pinned).

## 4. Signature: Change Review choreography

One choreography in three acts (BRIEF §8). The proposal is set as a route, inspected as rows, then committed or refused.

### 4.1 Structure (production web shell, already built in the slice)

In DOM order, which is also the visual order and the tab order:

1. **Status plate** (`.review-state`, plus `#phase` in the form status line): label + icon. **It is the first thing announced.** `#note` (`role=status`, `aria-live=polite`, `aria-atomic`) carries the outcome sentence.
2. **Rows** `<ol id="rows" aria-label="Proposed edits, before and after">`, one `<li>` per edit:
   - **WHERE**: document path, then the pointer drawn as a route. The **leaf is never truncated**; long pointers wrap onto a second line of track. Below 760px the track runs vertically.
   - **BEFORE**: the old value in mono, struck through in stale iron. It is never red. The "BEFORE" label carries the meaning; the strike is decorative.
   - **AFTER**: the new value in a `<mark>`. While reviewing, the mark is **lunar** (the inspect role, §5.8): dark uses a `--lunar` fill with `--on-lunar` text (9.81); light uses #E4DCFF with ink (12.44) and a #5B3FD0 underline (5.21). Once verified it turns mint. On a pending route the edited leaf station is ringed lunar. The pending plate and the yellow Accept carry "waiting for you"; the lunar mark carries "this is the difference".
3. **Decision** (`#decision`):
   - `#consequence` names what will be written and where ("Accept writes all N edits … whole or not at all").
   - `#review-help` names the recovery. It is the **only** copy of that sentence (G2 must-fix 3).
   - `.actions` holds `#accept`, `#reject`, `#recover` and `#reconcile`.
4. **Digests** (`#digests`, a `<dl>`): base and after sha256. They come **after the actions in DOM order**, so the copy buttons never sit between the status and Accept. At ≥ 960px the digests may show beside the rows only if DOM order still matches the reading order.
   - Display form: `sha256:` + the first 12 and last 4 hex characters, with an ellipsis between them.
   - Each digest has a **Copy** button (a `<button>`, wired by `addEventListener`, CSP-safe). The full value is in its accessible name, for example `aria-label="Copy base digest sha256:<64 hex>"`, and in a visually hidden span next to the short form.
   - No digest wraps across more than one line at 390.
5. **`pre#diff`** stays below, introduced as "Exact diff: the bytes Accept writes". It is the raw evidence and is not the primary review.

Keep every id: `edit`, `documentPath`, `jsonPointer`, `newValue`, `propose`, `accept`, `reject`, `recover`, `reconcile`, `review-help`, `phase`, `note`, `diff`, plus `rows`, `consequence`, `digests` and `decision` from the slice. Keep the CSP and `data-action` hooks. `apps/web-shell/test/inspector-accessibility.test.ts` passes unchanged (12/12 in slice-1).

### 4.2 States

| State (`data-phase`) | Plate | Rows | Actions | Focus after the transition |
|---|---|---|---|---|
| idle | "No proposal" | empty; consequence reads "Nothing is proposed…" | Accept/Reject disabled, with visible disabled styling (§5.4) | unchanged |
| reviewing (pending) | "Pending review · unwritten" | WHERE/BEFORE/AFTER; AFTER `mark` in lunar; leaf station ringed lunar | Accept (commit yellow) + Reject enabled | review heading (`tabindex=-1`), so the status is read first |
| applied (verified) | "Verified · written" | AFTER `mark` in mint; after-digest settles | "Show the proposal again" | the next sensible control |
| rejected | "Rejected · nothing written" | BEFORE restored; the file keeps its digest | "Show the proposal again" | the same |
| refused (bad pointer / bad JSON / missing doc) | registry reason in the compact interlock: code in mono, verbatim text ("JSON Pointer path not found: …") | none | the form inputs | `#note` announces it; focus stays on the form |
| stale | "Superseded · not actionable", `CHANGE_REVIEW_PROPOSAL_STALE` | struck rows | `#reconcile` | `#reconcile` |
| partial | refused by name: `CHANGE_REVIEW_PARTIAL_ACCEPT_UNSUPPORTED` | unchanged | Accept all / Reject all only | unchanged |
| outcome unknown | "Apply outcome pending" | unchanged | `#recover` ("Resolve pending apply"; Accept is never retried) | `#recover` |
| busy | plate unchanged, `aria-busy=true` on `#decision` and `#diff` | unchanged | disabled | unchanged |

### 4.3 Timing (motion tokens, §9)

1. **Propose:** the rows appear without travel. The plate switches instantly.
2. **Inspect:** inspecting is reading. The only movement is the one-shot echo (§4.7). It runs once at Propose and is finished by 1.44s. Nothing moves after that while the person reads.
3. **Commit:** the `--catch` hold (90ms linear), then the lever (hero only) throws over `--throw` (260ms, `--ease-throw`, no overshoot). Lamps light station by station along the route over `--lamp` (360ms, `steps(6)`). The after-value settles with a 420ms ease-out clip reveal. Total ≤ 780ms, played once per commit. The A-rich hero commit (§4.6) runs to 680ms, inside this budget.
   - The plate's label and icon, the `#note` text and focus all change at **+0**. Only the decorative reveal of the plate's paint may animate (hero only, ≤ 460ms). State never waits on motion.
4. **Reject / refuse:** the blocked station turns into a red square, and the track beyond it returns to siding grey (`--lamp`). The plate switches instantly.

Only `transform`, `clip-path` and `offset-distance` animate. Content is visible by default. The throw plays only when JS sets `[data-armed]` and motion is allowed, so first paint never waits on animation.

### 4.4 Reduced-motion form

Under `prefers-reduced-motion: reduce`, all durations are 0ms. Levers render at their final angle, the route shows its final paint, and the after-value is shown in place. The plate label and icon are identical to the animated form, because state is never carried by movement. The slice measured 0 running animations (`SLICE.md` table). The Kids train is parked.

On top of that:

- The hero is never armed, and it shows the **three-still strip** (§4.6).
- Replay is hidden.
- The Change Review echo does not run.
- A-rich measured `document.getAnimations().length = 0` for both the hero and Change Review under reduce (`SPEC-DELTA.md` §6).

### 4.5 390 above-the-fold test (G2 must-fix 4, pass/fail)

At a 390×844 viewport, light and dark, starting from the inspector with a valid edit typed:

1. Activate Propose. With no manual scroll, the **status plate and the first complete WHERE/BEFORE/AFTER row** sit inside the 844px viewport. Move focus to the review heading (`focus()` on a `tabindex=-1` heading). `scrollIntoView` from focus is allowed; layout-measurement JS is not.
2. From the review heading, **Accept is reached in ≤ 5 Tab presses**.
3. The screen reader announces the **status text first**: the plate/heading, before any row.

The same test applies to the umbrella hero demo (`change-review-demo.tsx`): the plate and first row are visible in the first 390×844 viewport. The A-rich phase bars, the three-still strip and Replay must not push them out. Put the strip **after** the demo in DOM and visual order.

### 4.6 Hero sequence (A-rich, umbrella `/` only)

This is one authored moment in three acts: propose → inspect → commit. The mechanics:

- The CSS is keyed on `[data-armed]`. JS sets it only when `prefers-reduced-motion: no-preference`.
- Content is visible and final by default. Use `animation-fill-mode: backwards`, **never `forwards`**. The first paint and the no-JS paint therefore show the inspect state.
- Only `transform`, `clip-path`, `box-shadow`, `border-color` and `background-size` animate.
- No layout-measurement JS.

Easing is `--ease-throw` cubic-bezier(.16, 1, .3, 1) throughout, except the lamps, which use `steps(6)`.

| Act (verified capture window) | Start (ms) | What moves | Duration |
|---|---|---|---|
| **Propose** (0–0.9s) | 0 | yellow phase bar on act 1 (`scaleX`) | 280 |
| | 120 | lever 1 thrown to reversed (catch at 26 % ≈ `--catch`) | 350 |
| | 300 | lamps light station by station along the route | 360 · steps(6) |
| | 640 | after-value written into place (clip reveal) | 420 |
| **Inspect** (1.15–1.9s) | 1000 | lunar phase bar on act 2 | 280 |
| | 1060 | lever 2 to catch (held) | 260 |
| | 1150 | lunar scan gate crosses the readout once (`translateX`) | 760 |
| | 1400 | leaf station ring turns pending → lunar | 300 |
| | 1560 | difference ring closes on the after-value | 320 |
| | 1640 | `Differs` tag revealed (label + icon) | 300 |
| **Commit, armed** (2.25–2.8s) | 2200 | act 3 hollow `--hair` edge appears | 280 |
| | 2300 | Accept painted commit yellow, left to right (`background-size`) | 420 |

The windows are the frames captured and checked (`shots/motion-1440-{propose,inspect,commit}-*`). Running animations counted 15 → 8 → 2 → **0** at 150 / 1150 / 2250 / 2800ms. The intro ends at 2,720ms, runs once and never loops. Nothing moves after it settles.

**It ends ARMED, not committed** (conductor carry; product truth).

- Autoplay stops with Accept painted yellow, the plate on "Pending review · unwritten", and nothing written. It never calls `set('accepted')`.
- SceneAxi writes only on a person's Accept. An autoplay that committed would demonstrate the opposite of the product law.

The commit throw plays when the visitor presses **Accept**:

| Start | What moves | Duration |
|---|---|---|
| +0 | lever 3 thrown | 260 |
| +80 | route relit mint | 360 · steps(6) |
| +120 | act-3 bar paints mint | 280 |
| +200 | `Verified · written` plate paint revealed (label, icon and live text already changed at +0) | 260 |
| +260 | after-value settles in mint | 420 |

After Accept, focus moves to "Show the proposal again". **Reject** plays the same throw to the refused aspect.

**Act labels.** Each act has a phase bar with a text label. The commit bar stays hollow `--hair` until a decision, then turns mint or lamp-red. Colour is never the only cue.

**Replay.** "Replay the sequence" is a real `<button>` (`data-replay`, wired by `addEventListener`), reachable by keyboard.

- It returns the demo to the proposal, removes `[data-armed]`, and re-adds it two animation frames later. It reads no layout.
- It is hidden (scoped `[hidden]`) under reduced motion and without JS.
- It sits after the demo's Accept/Reject in tab order.

**Reduced-motion form: three stills.** Nothing is armed, and the hero adds a strip of three stills, each labelled in text:

1. `1 · Propose`: pending plate, `1 → 42`, the after-value dashed yellow.
2. `2 · Inspect`: the `Differs` tag and the lunar ring.
3. `3 · Commit`: `Verified · written`, the after-value in mint, the after-digest.

The interactive demo stays pending until a person presses Accept, which then renders instantly. The demo digests stay synthetic and are labelled as synthetic.

### 4.7 Change Review echo (Operate: inspector, `/editor` dock, desktop changes dock)

A light echo of the sequence. It plays **once per Propose**, never on a timer, and never ambient. Total about 1.44s:

1. Route lamps from 120ms (`--lamp`).
2. A lunar scan crosses the rows table, 480 → 1120ms.
3. The diff marks are revealed in turn at 620, 700 and 780ms, 260ms each.
4. Accept is painted commit yellow at 1080ms, over 360ms.

Rules:

- The plate, `#note` and focus move at **+0**. The §4.5 focus-to-heading never waits for the echo.
- Accept is enabled and operable from +0. During the wipe its ink stays ≥ 4.5:1 on a literal cream underlay (13.45 measured). The light-scheme 1.05:1 Accept defect (`SPEC-DELTA.md` §6, fix 1) must not return.
- There is no echo for busy, refused, stale, partial or outcome-unknown.
- Desktop: `opacity` appears only inside keyframes (pinned). The echo uses only the five properties listed in §4.6.

## 5. Palette and on-colour pairs

All hex values come from `concepts/a/SPEC.md` and the slice (`signal.css:17-26`, `inspector-app.ts:802-803`).

### 5.1 Dark field (default for Persuade and Operate)

| Token | Hex | Pair | Ratio | Source |
|---|---|---|---|---|
| `--panel` | #2F4A44 | `--ink` #F1EEE4 | **8.28** | measured |
| | | `--ink-2` #BCD0C9 | **5.95** (lowest body text in the system) | measured |
| `--panel-band` | #27403A | ink-2 | 6.91 | pair |
| `--iron` | #1E2B28 | ink 12.64, ink-2 9.08 | | pair |
| `--iron-raised` | #263632 | edge 4.66 | | pair |
| `--well` | #182320 | edge 5.94 | | pair |
| `--enamel` (primary button, plate, focus ring) | #F1EEE4 | `--on-enamel` #1A2623 **13.45**; hover `--enamel-hi` #FFFFFF → **15.61** | | measured |
| `--edge` (UI boundary) | #86A39B | on panel **3.54**, on iron 5.40 | ≥ 3:1 | pair |
| `--rule` | #4E6B64 | on panel 1.65 | **decoration only** | pair |
| `--siding` | #7F9A93 | on panel 3.18, on iron 4.85 | UI only | pair |
| `--track` | #E9E6DC | on band 8.94 | | pair |

### 5.2 Lever paints (always with plate label + icon)

| State | Paint | On-paint ink | Ratio | Paint as UI on iron / on panel |
|---|---|---|---|---|
| Pending | #F2C230 | #1A2623 | **9.32** | 8.76 / 5.74 |
| Verified | #7BDDB0 | #12241E | **9.88** | 8.95 / 5.87 |
| Refused | #C4362C | #FFFFFF | **5.37** | — / **1.79, fails 3:1** |
| Stale | #A3A9A4 | #1A2623 | **6.52** | — / 4.02 |
| Refusal text on dark | `--refused-lamp` #FF9A8C | — | iron **7.16**, raised 6.19, well 7.89, band 5.45, panel **4.69** | |

Rules that follow from these pairs:

- **Stop red never sits as a UI shape directly on `--panel`.** A refused station or lever on the panel gets a 2px `--edge` outline or sits on an iron frame.
- **Refused paint is never used as text on dark.** Refusal text on dark uses `--refused-lamp`, and **only on iron, raised or well surfaces** (≥ 6.19). On `--panel` it needs `--refused-lamp-hi` #FFB3A8 (5.62).
- **G2 must-fix 2:** the dark inspector refusal note (`#note.refused`, today `#FF4D5E` at 4.98:1 measured) becomes `--refused-lamp` on an iron note box (7.16 pair), or `--refused-lamp-hi` if it stays on the panel (5.62 pair). Target **≥ 5.5:1**, browser-computed. `#FF4D5E` is retired, including the `:user-invalid` border, which uses `--refused-lamp` at the same pairs.

### 5.3 Operate light scheme (web shell and desktop, `prefers-color-scheme: light`)

| Token | Hex | Pair ratio |
|---|---|---|
| iron | #FBFBF8 | ink 15.76 (SPEC), ink-2 7.71 |
| panel | #E7E9E3 | ink 13.36, ink-2 6.53 (measured lowest light text) |
| raised | #EEEFEA | ink-2 6.92, edge **3.64** |
| ink / ink-2 | #17221F / #3F5550 | |
| edge | #6B807A | panel **3.44**, iron 4.06, well 4.21 |
| rule | #C4CDC8 | iron 1.57, decoration only |
| refused text | #A62A21 | iron 6.81, panel 5.77 |
| pending route / ink | #9A7400 / #6B5000 | route as UI on panel 3.52; pending ink as text on panel 6.19 |
| verified route | #1F8A5A | iron 4.18 (UI) |
| enamel (primary) | #17221F | on-enamel #FFFFFF **16.34** |

On light, the BEFORE strike uses ink-2, not stale amber: amber was barely visible on near-white (`SLICE.md` tell 4).

### 5.4 Disabled

Disabled is never signalled by fade alone. It always has a **dashed `--edge` border**, the `not-allowed` cursor, and text ≥ 4.5:1 (policy, stricter than WCAG's exemption).

- Measured dark: 7.85.
- Measured light: **not yet** (G2 must-fix 5). The baseline light disabled value was 5.74; v6 must be at or above it.
- Kids: #4A625C on #E9F3F6 = 5.83 measured.

### 5.5 Kids (light, own hue)

Pairs:

- sky #D6ECF4 / ink #13302A **11.57**
- ink-2 #2F4D46 7.56
- Play: #FFFFFF on #1E4FBF **7.18**; hover #173F9C 9.43
- blue as UI on sky 5.87
- refusal #8F241C 7.04
- board #6FAF55 with ink 5.35

### 5.6 Store token block (the only allowed Forge / Vitrine difference, A12)

```css
[data-store="forge"]   { --store-plate: #D9A066; --store-mark-radius: 1px; } /* panel 4.20: large text/UI only; iron 6.41 */
[data-store="vitrine"] { --store-plate: #9DBBF2; --store-mark-radius: 50%; } /* panel 4.96; iron 7.56 */
```

`catalog-game` and `catalog-web` CSS differ **only** in this block. The tagline copy comes from data, not CSS.

### 5.7 Non-text contrast (WCAG 1.4.11, G2 must-fix 5)

The pair math above passes:

- edge on every surface it bounds: 3.44–5.94
- the focus ring: ≥ 8.28 dark, 13.36 light
- route paints: ≥ 3.52

`--rule` (1.57–1.65) is allowed **only** where an `--edge` boundary or a fill difference already identifies the control or region.

The pilot must browser-measure every control boundary, track, station and focus ring in default, hover, focus, active and disabled, in both schemes. Pair math does not count as release evidence.

### 5.8 Second accent: lunar (inspect only), and commit yellow

**Hue.** Lunar sits at about 255° OKLCH. That is near-complementary to the panel green (about 170°) and split from caution yellow (about 90°), so the three never compete. Mint (verified) stays a state paint, not an accent.

**Role (exclusive). Lunar marks what is under inspection:**

- the difference ring and the `Differs` tag in the hero
- the edited leaf station on a pending route
- the diff `<mark>` in Change Review
- the inspect phase bar and the inspect scan

**Lunar is never:**

- a call to action, a link colour or a brand colour
- decoration, a gradient or a glow
- a state on its own
- part of a store token block
- used in Kids

**Yellow stays the COMMIT signal:** the pending plate, the pending route, and Accept.

| Token | Hex | Pair | Ratio (WCAG 2.x) | Allowed use |
|---|---|---|---|---|
| `--lunar` | #C4B4FF | on `--panel` #2F4A44 | **5.18** | text and UI on the field |
| | | on `--iron` #1E2B28 | **7.91** | text and UI |
| | | on `--panel-band` #27403A | **6.02** | hero board ring |
| | | on `--well` #182320 | **8.71** | text and UI |
| | | on `--plate` #395A53 | **4.10** | **UI and large text only** (≥ 24px, or ≥ 18.66px bold). No lunar body text on the plate. |
| `--on-lunar` | #16112E | on lunar | **9.81** | diff-tag text, mark text |
| `--lunar-deep` | #5D4FA8 | on enamel #F1EEE4 | **5.74** | lunar as ink on light material. #C4B4FF is never used on enamel. |
| light `--lunar` | #5B3FD0 | on iron-light #FBFBF8 **6.61**; on panel-light #E7E9E3 **5.60** | | Operate light |
| light mark | #E4DCFF | ink #17221F on it **12.44**; underline #5B3FD0 on it **5.21** | | Operate light |
| `--commit` (= pending) | #F2C230 | `--on-commit` #1A2623 **9.32**; hover `--commit-hi` #FFD45A **11.01** | | Accept |
| light `--commit-edge` | #7A5C00 | on #FBFBF8 **6.03** (measured 6.25) | | Accept boundary in light, where yellow alone is not a 3:1 boundary |

All lunar text is browser-measured on the plane it actually sits on. The pair math is a design check only.

**Token request for A5** (lanes do not edit tokens): `--lunar`, `--on-lunar`, `--lunar-deep`, `--commit`, `--on-commit`, `--commit-hi`, light `--commit-edge` and the light-scheme lunar and mark remaps. None of them exist in `packages/site-kit/src` today (grep returns 0 hits). Desktop gets the same values copied into `visual-tokens.ts`.

## 6. Type scale

| Token | Size | Line height | Face | Where |
|---|---|---|---|---|
| `--t-display` | clamp(3.5rem, 1.6rem + 6.2vw, 6rem) = 56→96px | 0.88 | Plate 800–900 | Persuade h1 |
| `--t-h2` | clamp(2rem, 1.4rem + 2vw, 3rem) = 32→48px | 0.95 | Plate | section heads |
| `--t-h3` | 1.5rem (24px) | 1.05 | Plate | comfortable interlock title |
| `--t-lede` | 1.1875rem (19px) | 1.5 | Prose | lede, max 34ch (the umbrella mobile LCP element, `p.il-lede`) |
| `--t-body` | 16px (Operate compact 14px, Kids 18px) | 1.55 / 1.45 / 1.5 | Prose | body |
| `--t-plate` | 0.9375rem (15px), caps, +0.06em | 1.2 | Plate | state plates |
| `--t-small` | 0.8125rem (13px) | 1.3 | Data (mono) only | digests, path segments, compact evidence |

Floors and rules:

- **The minimum computed font size is 13px on every surface and in every density** (conductor carry). No rendered text node computes below 13.00px at 100% zoom.
  - 13px (`--t-small`) is for mono data only.
  - A's 4-refusals screen computed **12.19px**: compact evidence at `0.8125rem` with a nested `code` at `0.9375em`. Nested `code`, `kbd` and `small` inside small contexts use `font-size: inherit` or an absolute rem. They never use a shrinking `em`.
  - Check: the `MEASURE` minimum over every text node is ≥ 13.00 on each page.
  - This exceeds the BRIEF A6 raise (≥ 12px). A5 checks it against the umbrella "≤ 9 font sizes on `/`" pin (`docs/redesign/DIRECTION.md` §0). The scale has 7 tokens, but the computed count on the slice's `/` has not been taken; the pilot measures it.
- **The plate face is used at ≥ 15px only, and only for headings and plates.** It is never used for values, prose, labels, buttons or anything a person must read character by character. This is A's version of the 16px drafting-font rule the council applied to B. A5 adds it as a check inside an existing test file (no new test files).
- **Legibility gate (carried from G2):** the council's OCR stand-in measured Public Sans at 13px at 0.847 character accuracy. Run the same OCR test (`/tmp/slice2/ocr.mjs`, or the harness equivalent) on **Atkinson Hyperlegible Mono at 13px** and **Big Shoulders at 15px caps**, at 100% and 200%. Each must score ≥ 0.847. If one fails, its role falls back as follows: mono → Atkinson Hyperlegible Next at 14px; plate at 15px → prose 700 caps. See RULINGS §G2 ruling 3 on "Public Sans".
- Prose measure is 60–68ch. Docs use 65–75ch.
- `text-wrap: balance` on headings, `pretty` on paragraphs. `font-variant-numeric: tabular-nums` globally.

**Faces and licences (G2 must-fix 8).** The name tables of the slice woff2 files were checked for this document (fontTools):

| File | Family | Version | Licence |
|---|---|---|---|
| `big-shoulders-display.woff2` (34.6 KB, variable) | Big Shoulders Display | 2.002 | SIL OFL 1.1 (name ID 14 `https://scripts.sil.org/OFL`) |
| `atkinson-next.woff2` (33.2 KB, variable) | Atkinson Hyperlegible Next | 2.001 | SIL OFL 1.1 (`https://openfontlicense.org`) |
| `atkinson-mono.woff2` (17.3 KB, variable) | Atkinson Hyperlegible Mono | 2.001 | SIL OFL 1.1 |

OFL allows self-hosting and bundling in Electron. Conditions:

- **Ship `OFL.txt` next to the font files** (absent today).
- Do not sell the fonts on their own.
- If the files are subset, that counts as a modification. Keep the family names unless the font declares no Reserved Font Name. A5 records the check in `DESIGN.md`.

No remote font request on any surface.

Per surface:

- **Web shell:** its CSP is `default-src 'none'` and must stay. It therefore loads **no** web fonts and renders with the declared system fallbacks (`inspector-app.ts:801`). The fallbacks are part of the design and are what the web shell is reviewed in.
- **Desktop:** bundles the woff2 locally only if its CSP already permits `font-src 'self'`. Otherwise it uses the same system stacks.
- **Kids:** copies the files into `sites/kids`.

## 7. Hero strategy and static fallback

- **Umbrella `/` hero = the Change Review itself, server-rendered, with the A-rich sequence (§4.6) as progressive enhancement.** The composition is unchanged from A, so the signature is kept. `change-review-demo.tsx` from the slice: the H1 "Build scenes. / Keep the source.", the EARLY ACCESS plate, the lede, Download (the primary action, test-pinned, visible in the first viewport at 390 and 1440), and the `scene.json · PENDING REVIEW` demo. The demo has a status plate, a WHERE route, BEFORE/AFTER, the consequence, and Accept/Reject that work from the keyboard. About 0 KB of imagery. Demo digests are synthetic and labelled as synthetic on the page.
- **Live 3D: not used for the v6 release.** `hero-viewport.tsx` was never built and is unmeasured LCP/TBT risk (G2 verdict gap). The existing `/open` WebGL canvas is product, not hero, and stays as it is.
  - A later lever-frame diorama is allowed only if it **demonstrates** propose → diff → commit, holds 60fps (frame p95 ≤ 16.7ms on the throttled profile), and keeps mobile LCP < 2.5s. It must ship the static hero above as its mandatory fallback for reduced motion, JS-off and failed WebGL.
- **JS-off / reduced motion:** the hero shows the pending (inspect) state with all rows, the `Differs` tag and the lunar ring. The accepted and rejected states are reachable with the keyboard and render instantly. Under reduced motion the three-still strip is added (§4.6).

### 7.1 Below the hero (A-rich)

The page below the hero is a composed sequence on **four planes** (§8). The rhythm runs dark and dense imagery → mid-tone dense text → light, sparse type.

| Section | Plane | Density | Display size | Measure |
|---|---|---|---|---|
| Capture band | L−1 `--bed`, full-bleed. Captures sit in raised iron frames over inset `--well` mats | the 3 home captures (§7.2) with captions | h2 clamp(40 → 68px) | captions ≤ 60ch |
| Spec rows | L+1 `--plate` on L0, with `--hair` dividers | 4 dense rows, 5/7 split (4/8 head column at narrower widths) | h2 `--t-h2`, dt 24px | dd ≤ 68ch |
| Editorial pull | L+2 enamel plaque, dark ink | one statement: `ENGINE_NOTES[1]` (`site-content.ts:111-112`), verbatim | clamp(48 → 96px) | 40ch |

The pilot measures the computed font-size count on `/` against the "≤ 9 font sizes" pin (§6). The capture and pull display sizes add to it.

### 7.2 Proof gallery rule

1. **Real captures only.** Sources are `PROOF_MEDIA` (`sites/umbrella/src/lib/site-content.ts:384-441`) and the files in `sites/umbrella/public/proof/`.
   - No mock-ups, renders, stock or generated images posing as product.
   - No placeholder boxes.
2. **Provenance and limitation chips.** Every figure carries its `PROOF_MEDIA` caption and **every** limitation chip, verbatim.
   - Chips are text inside a bounded chip: `--edge` on iron 5.40, on bed 6.38.
   - A figure with no chip does not ship.
3. **Never lazy-blank.**
   - Gallery images have no `loading="lazy"`. They use `decoding="async" fetchpriority="low"` with explicit `width`/`height` (no CLS), and sit on a `--well` mat, so a slow fetch never reads as an empty box.
   - A's empty gallery was lazy images in unscrolled screenshots, not missing assets (`SPEC-DELTA.md` §0).
   - Every evidence harness scrolls the page and awaits `img.decode()` before a full-page shot.
   - A shot in which any gallery image rect has luminance variance 0 is a **failed shot**, not a design result.
   - Release probe: after scroll and decode, every gallery `img` has `complete && naturalWidth > 0`.
4. **Home shows `placement: "home"` only:** `desktop-run-viewport`, `desktop-change-review` and `desktop-local-build`, in a three-up grid.
   - Select them in code by filtering `placement === "home"`. Do not hand-list ids.
   - **`desktop-run-window` (`placement: "engine"`) belongs on `/engine`.** The prototype's fourth closing plate is not ported to home.
5. **Stores show no proof media** beside catalog listings (`MEDIA-PROVENANCE.md`; spec §3.6).
- **Stores:** the digest figure ("not a render") leads the item page. No 3D.
- **Kids:** an SVG model-railway board. No WebGL.

## 8. Materials and elevation (A-rich: four levels, six planes)

There is no glass, glow, gradient or blur. Depth comes from **material and lightness steps plus soft offset shadows**, and the hierarchy still reads in greyscale (the luminance order below).

| Level | Material | Token | Hex | Rel. luminance | Shadow | Used for |
|---|---|---|---|---|---|---|
| L−1 | Recessed bed / quadrant well | `--bed`, `--well` | #141C1A / #182320 | 0.011 / 0.015 | `--sink` | capture band, image mats, docks, route strip, wells inside the acquire block, inputs, lever slots, code wells |
| L0 | Diagram panel (and panel band) | `--panel` (`--panel-band`) | #2F4A44 (#27403A) | 0.058 | none | page field (hero board, route strips) |
| L+1 | Raised plate | `--plate` | #395A53 | 0.087 | `--lift-1` | spec rows, legend, decision block, store record rows |
| L+1 | Cast-iron frame (and raised iron) | `--iron` (`--iron-raised`) | #1E2B28 (#263632) | 0.022 | `--lift-1` | capture frames, hero diagram, controls, interlocks, refusal note box, lever row, table head |
| L+2 | Enamel plaque | `--enamel` | #F1EEE4 | 0.84 | `--lift-2` | editorial pull. The store acquire block uses `--lift-2` on iron. |

**Shadows.** Only these shadows exist, plus the lever arm's contact shadow (`0 6px 10px -6px`):

| Token | Value |
|---|---|
| `--sink` | inset 0 2px 0 #0006 |
| `--lift-1` | 0 14px 24px −14px #000b, plus a 1px inset top light |
| `--lift-2` | 0 28px 48px −24px #000c, plus a contact shadow 0 4px 10px −6px |

Every shadow is blurred, negative-spread and black-alpha. There are no hard (0-blur) offset shadows (craft-floor Refuse list), no coloured shadows and no glow. A shadow is never the only boundary of a plane.

**Hairlines.** A boundary of a plane uses `--hair` #9AB8B0, which passes 3:1 on every plane it touches:

- panel 4.51
- plate 3.57
- bed 8.14
- iron 6.89

`--rule` #4E6B64 survives only *inside* a framed component, as decoration. On enamel it measures 5.01.

**Ink on the plate.** Secondary text on the plate is `--ink-2-plate` #D2E2DC (5.67). A's ink-2 measures only 4.71 there, so it is not used on the plate. Lunar on the plate is UI or large only (4.10, §5.8).

**Measured layering (proxies, not visual judgments):**

| Metric, umbrella below the hero | A | A-rich |
|---|---|---|
| Elevation levels | 2 | **4** |
| Distinct planes covering ≥ 2 % of the area at 1440 (panel, bed, iron, well, enamel, plate) | 4 | **6** |
| Luminance variance at 1440 | 0.01495 | 0.06819 (**4.6×**) |
| Luminance variance at 390 | — | **2.9×** A |

Part of the variance comes from the captures, which never loaded in A's shot. The level and plane counts are the cleaner proxy.

**Per screen:**

- **Store item:** the record mark sits in a bed well and the record rows on a plate. The acquire block is lifted (`--lift-2`). Its interlock is sunk into a bed well and carries its own 1px `--edge`. "From the same creator" is a full-bleed bed band.
- **Inspector:** the controls are on iron, the review on the field, and the route strip in the bed. The rows table is raised. The decision block is a plate. The rail is a recessed dock holding lifted interlocks.
- **Refusals:** the legend is a plate with hairline dividers, and comfortable interlocks are lifted. The compact column sits in a recessed dock, so density reads as placement through material as well as size.
- **Kids:** the table plate and trays (§3). A8 browser-measures their pairs; they are not measured yet.

**Token request for A5:** `--bed`, `--plate`, `--hair`, `--ink-2-plate`, `--sink`, `--lift-1`, `--lift-2`.

**Slate-green crisp at 390 (G2 must-fix 6):** the panel is a solid fill with no texture, noise or blur. Text on the panel is never softer than ink-2 (5.95). Review at DPR 2 as well as DPR 1.

**Forced colors:** shadows disappear, so every plane boundary (plates, frames, beds, docks, rows, the decision block, limitation chips) gets `1px solid CanvasText` on `Canvas`. Lunar marks and rings fall back to `Highlight`. The AFTER `mark` uses `Mark` / `MarkText`. Track uses `CanvasText`. State icons stay `currentColor`, so label + icon survive (slice `inspector-app.ts:899`).

## 9. Motion and density tokens

### Motion (A5 tokens)

| Token | Value | Meaning |
|---|---|---|
| `--catch` | 90ms linear | the hold before commitment |
| `--throw` | 260ms | lever travel, stops dead |
| `--ease-throw` | cubic-bezier(.16, 1, .3, 1) | no overshoot, no bounce |
| `--lamp` | 360ms `steps(6)` | lamps light station by station |
| `--settle` | 420ms ease-out | clip-reveal of the after-value |
| `--state` | 0ms | plate and colour switches are instant everywhere |

The A-rich sequence and echo durations that are not in this table (280, 300, 320, 350 and 760ms in the hero; the 640ms echo scan) stay local to their component. They use `--ease-throw` (or `steps(6)` for lamps) and sit inside the reduced-motion block. A5 may promote them to tokens; lanes do not.

The reduced-motion block sets all of them to 0ms. Kids train: 14s linear loop, only while playing, parked under reduce. A5 reconciles these tokens with the D-4 motion pin (`docs/redesign/DIRECTION.md` §0) by updating only the assertion it breaks.

### Space and density

The spacing scale is 4 / 8 / 12 / 16 / 24 / 32 / 48 / 72 / 112.

| Density | Control height | Body | Interlock padding | Gaps | Target rule |
|---|---|---|---|---|---|
| Kids | ≥ 56 (Play 76) | 18px | 24 / 32 | 16–24 | ≥ 44, aim 56 |
| comfortable | 44 | 16px | 24 / 32 | 16 | ≥ 44 for primary, ≥ 24 for all |
| compact | ≥ 28 (adopted from B) | 14px | 12 / 14 | 8 | ≥ 24×24, no spacing exception needed |

Desktop maps `DENSITY` (pinned) comfortable/compact to the same rows.

## 10. Per-surface route map

| Surface / route | Dialect | Density | Lane | Notes |
|---|---|---|---|---|
| umbrella `/` | Persuade | — | **pilot (A6)** | Change Review hero with the A-rich sequence (§4.6); below-the-hero planes (§7.1); gallery shows the 3 `placement:"home"` captures (§7.2); nav fix §13.1 |
| umbrella `/engine`, `/profiles` | Persuade | — | A6 | evidence tables in focusable scrollers (baseline axe serious ×8); Kids is an *Isolated* plate with no link; `/engine` carries the `desktop-run-window` capture |
| umbrella `/pricing` | Persuade → Operate | comfortable | A6 | checkout states pending ≠ verified; capability table in a focusable scroller |
| umbrella `/open` | Persuade | — | A6 | the WebGL canvas leads; chrome only |
| umbrella `/docs/**` | Persuade (read) | — | A6 | 65–75ch, rail wayfinding, code wells |
| umbrella `/login`, `/account`, 404, error | Operate | comfortable | A6 | visual only (identity, credits and billing are live) |
| umbrella `/editor` | Operate | compact | A6 | Change Review dock (Accept all / Reject all) |
| umbrella `/admin/ledger` | Operate | compact | A6 | right-aligned tabular figures |
| store home `/` (Forge / Vitrine) | Persuade | — | A7 (one agent) | TEST plate in the first viewport |
| store `/item/[itemId]` | Persuade page + Operate acquire block | **comfortable** | A7 | refusal interlock where the buy button would be |
| store `/publish`, 404, error, loading, global-error | Persuade / Operate | comfortable | A7 | `global-error` uses inline literals only |
| kids `/` + loading + global-error | Kids | Kids | A8 | no imports, no account words (pinned); planes only, no lunar, no sequence |
| web-shell inspector | Operate | compact | **pilot (A9)** | Change Review flagship: lunar diff marks, commit-yellow Accept, echo (§4.7), A-rich planes; ids + CSP kept; system light/dark |
| desktop chrome + docks + packaged Linux window | Operate (desktop) | comfortable + compact | A10 | `main.ts:1114` `backgroundColor` `#111113` → `#1E2B28` (iron), matching first paint |

## 11. Budgets

| Budget | Target | Today (slice / baseline) |
|---|---|---|
| CSS source, umbrella | ≤ **76,082 B** (60% of 126,804) | slice world sheet 17,376 B, but v5 `globals.css` still ships (106,180 B shipped). **A5 retires v5 `globals.css`.** |
| CSS source, stores | ≤ 40,508 (game) / 40,525 (web) | 67,513 / 67,542 |
| CSS source, Kids | ≤ 13,056 | 21,760 |
| Web-shell inline CSS | no growth over baseline `inspector-app.ts` | 44,345 B source (whole file) |
| Fonts, per site | ≤ 90 KB woff2 total; preload only the face of the LCP element (prose); `font-display: swap` | 85.1 KB (three variable files) |
| Mobile LCP, every Persuade route | < 2,500 ms | A `/` 3,350 ms at load avg 73 (void); baseline 4,585 |
| Mobile TBT (INP proxy) | target < 200 ms; **pilot hard gate ≤ 2,015 ms** (the baseline) | **A `/` 998 ms** (`lighthouse-umbrella-mobile.json`, at load avg 73); B 2,647 |
| CLS | < 0.1 | A 0.000 |
| INP | < 200 ms (field / Event Timing probe) | not measured |
| Hero JS | the hero demo is the only client component on `/` it adds; Replay only toggles `[data-armed]`; no layout-measurement JS anywhere in Change Review | — |
| A-rich layer | **merged into the base rules**, never appended | prototype `a.css` 39,293 → 57,939 B raw, 9,159 → 12,852 B gzip (+3,693), because the layer was appended |

**Merge, not append (conductor carry).** When porting, fold the A-rich layer into the base rules and delete the A rules it overrides: `.gallery`, `.board`, the first `.btn.commit` background, and the duplicate `.readout .after .val` animation. No `A-RICH LAYER` block, no override piles, and no selector restated later just to win the cascade. The CSS budgets above are unchanged. The gallery images must not become the LCP element.

**Lighthouse protocol (G2 must-fix 7):**

1. Check `uptime` first. Run only when the 1-minute load average is < 4.
2. Stop every other `next start` / dev server first.
3. Run the build with `next build && next start`.
4. Take 3 runs and report the median.

## 12. Anti-references

1. **v5 signal-orange bench:** `#FF6B2C` on `#07080A`, Archivo + JetBrains Mono, a mono uppercase label over everything, 9px cards, and a global `a:hover` that recoloured button ink to 1.20:1.
2. **Cinematic Pro cyan:** `#46D8EC` on `#0A0F1A`, glow-adjacent, soft 10–16px radii. The packaged desktop still renders it.
3. **Template tells** (`craft-floor.md` Refuse list):
   - eyebrows or kickers above headings
   - icon + heading + text card grids as page structure
   - hero-metric blocks
   - gradient text, glass or blur
   - coloured side rails over 1px (pinned DV-X1 rails excepted)
   - hard offset shadows
   - mono as a "technical" costume (mono is for data only)
   - a system face as the display voice (except where the web-shell CSP forces fallbacks)
   - emoji as an icon system (the pinned R-4 ✕/✓ glyphs keep their accessible label)
   - unthemed selection, caret, scrollbar or focus ring
4. **Generic signal-box kitsch:** no rivets, wood grain, rust or skeuomorphic levers in Operate. The lever is drawn only in the Persuade hero and the comfortable interlock.
5. **Git red/green diff:** the old value is never red. The difference is shown as WHERE / BEFORE / AFTER rows, not +/- lines.
6. **Lunar as tech-violet:** lunar is a flat inspect paint. It is never a glow, gradient, link, CTA or brand wash (§5.8). Neither v5 `#FF6B2C` nor `#46D8EC` returns anywhere, including the light remaps.

## 13. Must-fix (G2 conditions → owners)

| # | Condition | Owner | Pass test |
|---|---|---|---|
| 1 | At **1280px width and 200% zoom**, the umbrella nav does not clip ("Acco"). Today it is an `overflow-x:auto` strip (`signal.css:58`). Below a width set in `em`, the masthead shows the wordmark + **Download** (primary, always visible) + a **Menu** disclosure button (`aria-expanded`, `aria-controls`, Escape closes, focus returns to the button) that holds the other links, **Account** included. No horizontal scroller in the masthead. | A5 (mast component) + pilot A6 | WCAG 1.4.10. Every nav item visible or keyboard-reachable at 1280@200% and at 320 CSS px; no overflow-x |
| 2 | Dark refusal note ≥ 5.5:1 (today 4.98) | pilot A9 | browser-computed ≥ 5.5 (§5.2) |
| 3 | 390 inspector: one copy of the help sentence; short digest + Copy button + full value in the accessible name; no 3-line wrap | pilot A9 | DOM text-occurrence count = 1; digest line count = 1 at 390 |
| 4 | 390 above the fold: status plate + first row inside 390×844; Accept within 5 Tab stops; status announced first | pilot A9 (+ A6 for the hero demo) | §4.5 |
| 5 | Measure WCAG 1.4.11 3:1 on boundaries and rules, and light-mode disabled contrast | pilot A6/A9 (with `lib.mjs`) | every boundary ≥ 3:1 or decoration-only per §5.7; light disabled ≥ 4.5 |
| 6 | Keep `[hidden]` scoped (`.il [hidden]`, page-local in the inspector); slate-green panel crisp at 390 | A5 + pilot | probe: hidden button computes `display:none`, visible buttons `flex`; no texture or blur |
| 7 | Mobile Lighthouse on a quiet machine (load < 4): LCP ≤ 2.5 s, TBT ≤ 2,015 ms | pilot | §11 protocol, 3-run median |
| 8 | Font licences | A5 | OFL confirmed (§6); `OFL.txt` shipped beside the fonts; no RFN rename issue |
| 9 | Nested lockfiles | direction (this step) | see `RULINGS.md` §Housekeeping: worktree reverts done; main-repo deletion **held for a user ruling** |
| 10 | Visual veto | conductor, under operator delegation | **Closed for the pipeline by the A-rich decision. This is NOT a human visual sign-off: nobody viewed the images** (`RULINGS.md` §A-rich decision). A human may still view the A-rich shots (§Evidence) and reopen it. |
| 11 | Minimum font ≥ 13px (4-refusals computed 12.19px) | A5 (scale) + every lane | `MEASURE` minimum computed font-size ≥ 13.00 on every page, at 100% |
| 12 | Itemise every sub-24px target against WCAG 2.5.8. A-rich `PAGE_FACTS` counts (<24 / <44): umbrella 2/9, inspector 0/8, refusals 1/4, store 1/2, Kids 0/0 | A5 lists them; the owning lane fixes them | a table per target (selector, rendered size, then either fixed to ≥ 24×24 or the named 2.5.8 exception: spacing, equivalent, inline, user-agent or essential). Nothing unexplained. Kids: every target ≥ 44 |
| 13 | Home gallery = `placement:"home"` only; `desktop-run-window` on `/engine`; never lazy-blank; chips on every figure | A6 | DOM: 3 home figures; after scroll + `img.decode()` every `img` has `naturalWidth > 0`; each figure has ≥ 1 chip (§7.2) |
| 14 | Hero autoplay ends ARMED; three-still reduced form; Replay | A6 | at 2,800ms: 0 running animations, plate "Pending review · unwritten", not accepted. Under reduce: 0 animations, 3 labelled stills, Replay hidden. §4.5 still passes at 390 |
| 15 | Lunar limits | A6, A9, A10 | browser-computed lunar text ≥ 4.5:1 on its actual plane; no lunar text under 24px on `--plate`; no lunar on links or CTAs |
| 16 | Merge, not append | A5, A6, A9 | no override block; overridden A rules deleted; CSS ≤ the §11 budgets |

Carried from G1 and the verdict: before/after rows done (slice); `[hidden]` scoped done (slice); 28px compact controls (from B); no layout-measurement JS in Change Review (from B); `pnpm run gate` and the packaged Linux Electron launch have never been run for v6.

## 14. Port from

There are two sources:

- **The look:** `docs/redesign-v6/concepts/a-rich/`. `concepts/a/` stays untouched, for comparison only.
- **The structured Change Review rows and the production DOM:** the worktree `../sceneaxi-slice-1` (`apps/web-shell/src/inspector-app.ts`).

Copy, then refactor. Do not merge any branch.

### 14.1 From `concepts/a-rich/` (the locked look)

| File | Reuse as | Changes required |
|---|---|---|
| `a.css` (57,939 B; the A-rich layer sits below the line `A-RICH LAYER`) | token values → **A5 requests** (§5.8, §8); component rules → lane CSS | **MERGE** the layer into the base rules and delete the overridden A rules (§11). Never port the layer as a block. |
| `1-umbrella.html` | A6: the hero sequence (§4.6), Replay, the three stills, the capture band, spec rows and pull (§7.1) | gallery from `PROOF_MEDIA` filtered to `placement:"home"`; drop the fourth (`desktop-run-window`) plate; no `loading="lazy"` |
| `3-inspector.html` | A9: planes, lunar marks, commit-yellow Accept, echo (§4.7) | take structure, ids and CSP from slice-1 `inspector-app.ts`, **not** from the prototype |
| `2-store-item.html` | A7: record well, lifted acquire block, sunk interlock with its own `--edge` | no proof media |
| `4-refusals.html` | A6/A7/A9 interlocks, legend plate, compact dock | fix the 12.19px nested `code` (§6) |
| `5-kids.html` | A8: table plate and trays | no lunar, no sequence; measure the plate and tray pairs |
| `shots/_work/shoot.mjs` | measurement pattern: scroll + `img.decode()`, WAAPI `currentTime` frames | port the logic into scripts that use `lib.mjs`; no new harness, no new test files |

### 14.2 From slice-1 (`../sceneaxi-slice-1`)

Reuse from `../sceneaxi-slice-1` (concept A). Copy the files, then refactor. Do not merge the branch.

| Worktree file | Bytes | Reuse as | Changes required |
|---|---|---|---|
| `apps/web-shell/src/inspector-app.ts` (diff +267 lines vs `2cef2033`) | — | **A9 base: the structured WHERE/BEFORE/AFTER rows.** `git -C ../sceneaxi-slice-1 diff 2cef2033 -- apps/web-shell/src/inspector-app.ts` | §13 items 2, 3, 4; move `#digests` after `.actions`; retire `#FF4D5E`; AFTER mark → lunar; Accept → commit yellow; add the echo; keep ids; tests pass unchanged |
| `sites/umbrella/src/app/_signal/signal.css` | 17,376 | split: `.il` token block (`:13-34`) → **A5** (`design-tokens.ts` / shared layer); component rules → A6 umbrella CSS | drop the `il-` coexistence prefixes once v5 `globals.css` is retired; replace the nav strip (`:58`) with the §13.1 disclosure |
| `sites/umbrella/src/app/_signal/change-review-demo.tsx` | 5,867 | A6 hero client component | the §4.5 test at 390; synthetic-digest label kept |
| `sites/umbrella/src/app/_signal/icons.tsx` | 1,031 | the state icon sprite (clock, check, octagon-bar, rewind-slash, flask) → A5 shared, copies in Kids and desktop | — |
| `sites/umbrella/src/app/_signal/signal-download.tsx` | 1,317 | A6 Download CTA (OS-detected) | keep the test-pinned primary-action contract |
| `sites/umbrella/src/app/_signal/fonts.ts` + `sites/umbrella/src/app/fonts/*.woff2` | 647 B + 85.1 KB | A5 font loading (`next/font/local`) | add `OFL.txt`; preload only the prose face |
| `sites/umbrella/src/app/page.tsx` | — | A6 `/` content | real product copy only (already from the repo) |
| `sites/umbrella/src/app/layout.tsx` (route-gated chrome) | — | **do not port** | slice-only coexistence hack (`x-sceneaxi-route === "/"`); production swaps the chrome for all routes |
| `sites/umbrella/pnpm-lock.yaml` | — | **do not port** | reverted in this step |

From `../sceneaxi-slice-2` (concept B, rejected), adopt **decisions, not files**: 28px compact controls, no JS layout measurement in Change Review, and the state-sweep method (`/tmp/slice2/cr-sweep.mjs`; `/tmp` is volatile, so port its logic into the shared harness if needed). Its test edits (`inspector-accessibility.test.ts`, `visual-postpr.test.ts`) are **not** ported. A needs none.

The A prototype (`docs/redesign-v6/concepts/a/`) is superseded by `concepts/a-rich/` (§14.1). Use it only for side-by-side comparison.

**Measurement:** reuse `~/Documents/Reports/sceneaxi-redesign-v6/baseline/_work/lib.mjs`. Do not write a new harness.

## Files changed
- A-rich amendment: `docs/redesign-v6/DIRECTION.md` (amended), `docs/redesign-v6/RULINGS.md` (G3, operator feedback, A-rich enrichment and decision appended)
- G2 step: `docs/redesign-v6/DIRECTION.md` (new), `docs/redesign-v6/RULINGS.md` (new), and `../sceneaxi-slice-{1,2}/sites/umbrella/pnpm-lock.yaml` reverted to HEAD (`git checkout --`)

## Evidence paths
- A-rich (locked look): `docs/redesign-v6/concepts/a-rich/SPEC-DELTA.md`, `concepts/a-rich/shots/` (`metrics.json`, the full-page shots, the motion strip `motion-1440-*`, `1-umbrella-1440-reduced-motion*.png`); copies in `~/Documents/Reports/sceneaxi-redesign-v6/compare/a-rich/`
- Foundation and G3: `GATE-BASELINE.md`; `~/Documents/Reports/sceneaxi-redesign-v6/a5b/REPORT.md`, `a5b/_work/gate-{main,v6}/`; `foundation/`
- Slice A: `docs/redesign-v6/concepts/a/slice/` (`measure-site.json`, `measure-ws.json`, `lighthouse-umbrella-{mobile,desktop}.json`, 27 PNGs)
- Slice B: `docs/redesign-v6/concepts/b/slice/` + `raw/`
- Concept A: `docs/redesign-v6/concepts/a/shots/` (`contrast.json`, `audit.json`, `keyboard.json`)
- Pair ratios in §5 were computed for this file (WCAG 2.x luminance) and are labelled "pair". Font licences come from the woff2 name tables (fontTools).

## Open issues
- **No human has viewed A-rich.** The lock is a conductor decision under delegation, made on measured evidence. Whether lunar harmonises, and whether the page reads as AAA+, is unjudged.
- **Token requests for A5** (§5.8, §8): lunar, commit, plane, hairline and shadow tokens. None are in site-kit yet.
- **Sub-24px targets** (§13.12) and the **12.19px** font (§13.11) are not yet itemised or fixed.
- **At 390, the three stills and Replay** must be placed so the §4.5 fold test still passes. The prototype has not been measured for this.
- **Kids plate and tray pairs** are not measured.
- **"Public Sans" in the G2 must-carry conflicts with concept A**, which uses Atkinson Hyperlegible Next. Ruled in `RULINGS.md` §G2 ruling 3 (keep Atkinson, gated by OCR ≥ 0.847). The user can overrule.
- **Main-repo nested lockfiles are tracked, not untracked.** Their deletion is held; see `RULINGS.md`.
- **Light disabled contrast, 1.4.11 browser measurement, forced colors (numeric), INP, `pnpm run gate`, and the packaged Electron launch** have not been run for A.
