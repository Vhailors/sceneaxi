# Concept A · Interlocking: spec

Seed A from `docs/redesign-v6/BRIEF.md` §9. **World:** a railway signal box lever frame. The page is a matte slate-green track-diagram panel. Containers are cast-iron frames, and labels are cream enamel plates. Only the levers are saturated, and they are painted in four regulation colours that carry the four product laws. A change is a **route being set**. Committing it **throws the lever**. A refusal is an **interlock**: the lever will not travel, and its plate names the reason.

Prototype: `index.html` plus `1-umbrella.html` through `5-kids.html`, one stylesheet `a.css` (39,293 B raw, 9,205 B gzip), and self-hosted fonts in `fonts/`. Nothing loads from a CDN.

## How A differs from B and C

| Axis | A · Interlocking | Not this (B / C territory) |
|---|---|---|
| Light | Matte, dark mid-tone panel (#2F4A44), no gloss | Not white drawing paper, not a D50 press sheet |
| Ground metaphor | Track diagram + lever frame (topology) | Not a revision table or a registration/proof mark |
| Saturation | Only the levers (state) and the per-store plate | No accent used as brand decoration |
| Shape | 2px corners, cast frames, round junctions | — |
| Motion | Mechanical, detented, no bounce | — |
| Display type | Condensed, cast-plate grotesque (Big Shoulders Display) | Not a technical-drawing or editorial serif |

## Type

Three families, each with one job. All are OFL and self-hosted (`fonts/*.woff2`, variable axes).

| Role | Family | Use |
|---|---|---|
| Plate | Big Shoulders Display 700–900 | Headlines, lever numbers, state plates (uppercase only at ≤ 15px plate size, never on body) |
| Prose | Atkinson Hyperlegible Next 400/500/700 | Body, UI labels, buttons |
| Data | Atkinson Hyperlegible Mono 400/600 | Pointers, digests, values, codes. Tabular numerals are on globally. |

The scale is a 1.25 ratio at small sizes and opens wide at display sizes. The hierarchy comes from the contrast between condensed plates and humanist prose, not from weight alone.

| Token | Size | Line | Where |
|---|---|---|---|
| `--t-display` | clamp(56 → 96px) | 0.88 | Persuade h1 |
| `--t-h2` | clamp(32 → 48px) | 0.95 | Section heads |
| `--t-h3` | 24px | 1.05 | Interlock title (comfortable) |
| `--t-lede` | 19px | 1.5 | Lede, max 34ch |
| `--t-body` | 16px (Operate 14px, Kids 18px) | 1.55 / 1.45 / 1.5 | Body |
| `--t-small` | 13px | 1.3 | Digests, path segments |
| `--t-plate` | 15px caps, +0.06em | 1.2 | State plates |

Prose measure is 60–68ch. The minimum font size is 13px, and only mono data uses it.

## Palette and on-colour pairs

Measured with WCAG 2.x relative luminance. These are token pairs. The **browser-computed** results for every rendered text node are in the Evidence section below.

### Field (dark, default for Persuade + Operate)
| Token | Hex | Pair | Ratio |
|---|---|---|---|
| `--panel` | #2F4A44 | `--ink` #F1EEE4 on panel | **8.28** |
| | | `--ink-2` #BCD0C9 on panel | **5.95** |
| `--panel-band` | #27403A | ink-2 on band | 6.91 |
| `--iron` | #1E2B28 | ink on iron | 12.64 · ink-2 on iron 9.08 |
| `--edge` (UI boundary) | #86A39B | on panel **3.54** · on iron 5.40 (≥ 3:1 UI) |
| `--rule` | #4E6B64 | decorative hairline only, never the sole boundary of a control |
| `--enamel` (primary button / plate) | #F1EEE4 | `--on-enamel` #1A2623 on it **13.45**; hover #FFFFFF → **15.61** |
| `--track` | #E9E6DC | on band 8.94 |

### Lever paint = the four laws (always plate label + icon + paint)
| State | Paint | On-paint ink | Ratio | Paint on iron | Icon |
|---|---|---|---|---|---|
| Pending | #F2C230 caution yellow | #1A2623 | **9.32** | 8.76 | clock |
| Verified | #7BDDB0 clear mint | #12241E | **9.88** | 8.95 | check |
| Refused | #C4362C stop red | #FFFFFF | **5.37** | lamp text #FF9A8C 7.16 | octagon-bar |
| Stale | #A3A9A4 unpainted iron | #1A2623 | **6.52** | — | rewind-slash |
| TEST | outline only | ink on field | 8.28 | edge 3.54 | flask |

Stop red is never used as text on the dark field (1.79:1). Refusal codes use the lamp tint `--refused-lamp` #FF9A8C instead.

### Store token block (the only allowed Forge/Vitrine difference)
```css
[data-store="forge"]   { --store-plate: #D9A066; --store-mark-radius: 1px; }  /* 4.20:1 on panel: large/UI only */
[data-store="vitrine"] { --store-plate: #9DBBF2; --store-mark-radius: 50%; }  /* 4.96:1 on panel */
```

### Operate light scheme (`prefers-color-scheme: light`, web shell and desktop follow the system)
iron #FBFBF8, panel #E7E9E3, ink #17221F (**15.76**), ink-2 #3F5550 (7.71 / 6.53 on panel), edge #6B807A (4.06), refused text #A62A21 (6.81). Route paints in light mode: pending #9A7400 (3.91), verified #1F8A5A (3.93), refused #A62A21 (6.40).

### Kids (own hue and scale, light)
sky #D6ECF4 with ink #13302A (**11.57**), ink-2 #2F4D46 (7.56). Play button: white on #1E4FBF **7.18**, hover #173F9C **9.43**. Disabled: #4A625C on #E9F3F6 **5.83** with a dashed border, so disabled is never signalled by fade alone. Refusal text: #8F241C (7.04). Board: #6FAF55 (ink 5.35).

## Materials and elevation

There are no glass, glow or gradient surfaces. Elevation comes from **material**, not blur:

| Level | Material | Token | Used for |
|---|---|---|---|
| 0 | Diagram panel | `--panel` | Page field |
| 1 | Panel band | `--panel-band` | Alternating sections, route strips |
| 2 | Cast-iron frame | `--iron` + 1px `--rule` | Diagram, acquire block, desk columns, interlocks |
| 3 | Raised iron | `--iron-raised` | Lever row, decision block, table head |
| — | Quadrant well | `--well` | Lever slots, inputs, image matte |

The only shadow is the lever arm's own contact shadow (`0 6px 10px -6px`). A control's boundary is always `--edge` (≥ 3:1), and `--rule` is decoration.

## Signature: the route and the lever

- **Route** (`.route`): an RFC 6901 pointer drawn as track. Each segment is a station, and the leaf is the terminal. The leaf is set in the bright 16px mono and is **never truncated**. Long routes wrap onto a second line of track rather than ellipsize (see the 12-segment pointer on `3-inspector`). Below 760px the track runs vertically.
- **Setting a route** paints the track in the state's lever colour and lights lamps along it. **Refused** turns the blocked station into a red square and returns the track beyond it to siding grey.
- **Lever** (`.lever`): an elevation view. Positions are `normal` (-16°), `catch` (-11°, catch handle squeezed: inspecting) and `reversed` (+16°). The paint is the state.
- **Interlock** (`.interlock`): state plate, title, reason, code, evidence `dl`, one forward path. There are two densities:
  - **comfortable**: 24/32px padding, lever drawn, 24px title. Used for Persuade pages and the store acquire block.
  - **compact**: 12/14px padding, no lever, 16px title inline with the plate, 13px evidence. Used for the editor dock, inspector rail and desktop dock. This is the fix for v5's wrong-density store panels: density is chosen by placement, not inherited from a global `.state` rule.

## Motion vocabulary

There is one authored moment, the **detented throw**. Everything else is state change without travel.

| Token | Value | Meaning |
|---|---|---|
| `--catch` | 90ms linear | Catch handle released (the hold before commitment) |
| `--throw` | 260ms `cubic-bezier(.16,1,.3,1)` | Lever travels and stops dead. No overshoot, no bounce. |
| `--lamp` | 360ms `steps(6)` | Lamps light station by station along the set route |
| settle | 420ms ease-out clip reveal | The after-value is written into place |

Rules:
- Content is visible by default. The throw only plays when JS arms `[data-armed]` and motion is allowed, so the first paint never waits on animation (LCP-safe).
- Only `transform`, `clip-path` and `offset-distance` animate. Layout properties never animate.
- **Reduced motion** (`prefers-reduced-motion: reduce`): all animation and transitions are set to 0ms, levers render at their final angle, and the kids train is parked. Every state remains legible because state is carried by the plate label and icon, never by movement.
- Kids motion is calm: the one loop is the train, at 14s per lap, and only while Play is on.

## The three dialects

| | Persuade | Operate | Kids |
|---|---|---|---|
| Surfaces | Umbrella, store home and item page | Account/admin, web shell, desktop chrome, store acquire block | Kids studio |
| Scale | Monumental: 96px plates, 72–112px bands, 1320px wrap | Compact desk: 14px body, 52px mast, 300 / fluid / 340 columns; comfortable ↔ compact via the interlock density | Own scale: 18px body, targets ≥ 56px (Play 76px), choice tiles 120px+ |
| Frame | The lever frame drawn large: one frozen event per hero | The frame as instrument: tables, digests, route strip | The model-railway layout: a toy version of the same frame (track loop, plates, round stations) |
| Colour | Dark panel, enamel, lever paint | Dark default plus a system light scheme | Light sky, its own blue, the same 2px→14px corner family scaled up |
| Motion | Detented throw once, in the hero | None ambient. Plates switch instantly. | Calm: train loop only while playing |
| Copy | Product claims with their limits shown as plates | Contract text verbatim, codes in mono | Short kind sentences from `kids-activity.ts`. Refusals say what to do next. |

The shared core holds across all three: the condensed plate face and humanist prose relationship, cast-frame silhouettes, label + icon + paint for every state, and the same review choreography (propose → inspect with before/after, consequence and recovery → commit).

## Change Review choreography (all dialects)

1. **Propose:** the lever is painted pending and reversed. The route is set in yellow and the plate reads "Pending review".
2. **Inspect:** the catch is held. Before and after are shown side by side, with both full digests and the full pointer with the leaf bright. The consequence is written beside the buttons ("Accept writes all 3 edits … whole or not at all"), and so is the recovery ("Reject discards … writes nothing. If an apply outcome is ever unknown, Resolve pending apply reads authoritative state first; Accept is never retried.").
3. **Commit:** Accept throws the lever, and the route turns mint with the "Verified · written" plate. Reject is a refusal by choice: the plate reads "Rejected · discarded", the before-value is restored and the file keeps its digest. Focus moves to the next sensible control ("Show the proposal again").
4. **Stale / partial / not found:** compact interlocks carrying `CHANGE_REVIEW_PROPOSAL_STALE`, `CHANGE_REVIEW_PARTIAL_ACCEPT_UNSUPPORTED` and `JSON Pointer path not found`, verbatim from `packages/site-kit/src/refusals.ts` and `packages/authoring-core`.

The web shell keeps every id from `apps/web-shell/src/inspector-app.ts` (`edit`, `documentPath`, `jsonPointer`, `newValue`, `propose`, `accept`, `reject`, `recover`, `reconcile`, `review-help`, `phase`, `note`, `diff`). In the prototype, Accept and Reject sit in the decision block rather than the form. In the real shell they can stay in the form with the same ids, and the decision copy can move next to them.

## Live 3D

Not used. The hero is a static diagram that *is* the signature moment, at about 0 KB of image. Per the brief, 3D would have to demonstrate propose → diff → commit at 60fps and pass LCP. A lever-frame diorama of the route could be explored later, with this diagram as its mandatory static fallback.

## Tokens requested from the foundation owner (A5), if A is picked

`--panel --panel-band --iron --iron-raised --well --enamel --enamel-hi --on-enamel --ink --ink-2 --rule --edge --track --siding --pending/--on-pending --verified/--on-verified --refused/--on-refused/--refused-lamp --stale/--on-stale --store-plate --store-mark-radius --catch --throw --ease-throw --lamp`, the three font faces, the Operate light-scheme block and the Kids block. These need to go into `packages/site-kit/src/design-tokens.ts`. **Requirement carried from the v5 failure:** link hover changes underline thickness only, never `color`, and `.btn` declares its own ink in every state (`--b-ink`), so no global `a:hover` can override button labels.

## Evidence (measured in Chromium 1223 via Playwright, not token math)

- `shots/contrast.json`: every rendered text node, plus every interactive element in rest / hover / focus / disabled, on all 6 pages (Operate measured in both schemes). Minimum normal text **5.37:1** (white on stop red). Minimum hover **8.28**, minimum focus **8.28**, minimum disabled **5.83**. Zero failures. The only sub-4.5 value is 4.20 on the 32px index numerals (large text, ≥ 3:1).
- `shots/audit.json`: axe-core 4.10 on all pages at 1440 and on Kids at 390: **0 violations** of any impact after the fix round. Horizontal overflow is 0 at 1440 and 390 on all pages.
- `shots/keyboard.json`: umbrella tab order, Accept/Reject by keyboard with focus handed off, the kids flow (undo, world change, add, play), Kids minimum target **56px**, and 200% zoom overflow.
- Screens: `shots/<page>-1440.png`, `shots/<page>-390.png`, Operate light `3-inspector-{1440,390}-light.png`, demo states `1-umbrella-1440-{accepted,rejected}.png`, `5-kids-390-moon.png`, forced colours `*-forced-colors.png`.
