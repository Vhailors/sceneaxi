# Concept B · Revision Block: spec

Seed B from `docs/redesign-v6/BRIEF.md` §9. **World:** an engineering drawing change notice. Every surface is a drawing sheet. It has a ruled border with zones A–F / 1–8, a title block that holds the evidence, and a revision table. A change arrives the way it does on a drawing: a revision cloud and a lettered triangle. It ends as a CHECKED or REJECTED stamp, or it is ruled through as SUPERSEDED.

Prototype: `index.html` (drawing list) plus `1-persuade-hero.html` through `5-kids-studio.html`. Shared files are `b.css` (18,083 B raw, 5,060 B gzip) and `b.js` (4.9 KB: zone tags, cloud scallops, review state). Kids is isolated: `5-kids-studio.html` + `kids.js` load nothing shared except the two font files. Fonts are self-hosted in `fonts/`. Nothing loads from a CDN.

## How B differs from A and C

| Axis | B · Revision Block | A · Interlocking | C · Press Proof |
|---|---|---|---|
| Ground | Matte Prussian cyanotype (#17365F) for Persuade; cool whiteprint (#F1F3F4) for store and Operate | Slate-green lever-frame panel | D50 press sheet |
| Wayfinding | Zone coordinates computed from the real layout (`Zone B3`) on every section | Track diagram topology | Registration and slug lines |
| State vocabulary | Drafting marks: cloud + △letter, CHECKED stamp, REJECTED stamp + reason, ruled-through SUPERSEDED | Levers and signals | Plates pulled / unpulled |
| Type voice | Single-stroke ISO 3098 lettering (Osifont) for labels, figures, pointers and display. Public Sans for prose | — | — |
| Motion | Plotter feed: linear, constant-speed line drawing, then stamps land once | Detented mechanical | — |

## Type

Two faces, both self-hosted:
- **Osifont** (LGPL-3 with font exception). ISO 3098 single-stroke CAD lettering. It carries display, labels, zone tags, revision letters, values, digests and JSON pointers. This is the "no mono costume" rule: figures are tabular lettering, not a code font. Subset to Latin-1 plus punctuation: 10,036 B woff2. Metrics overrides (`ascent-override: 82%`, `descent-override: 26%`) tame its 2697/2048 ascent.
- **Public Sans** (OFL-1.1, variable 100–900). Prose, buttons, form labels. 26,832 B woff2.

Scale (rem; ratio ≈ 1.25 up to 34, then display):

| Token | Size | Use |
|---|---|---|
| `--t-13` | 13px | Lettered labels (uppercase, +0.08em), zone tags, compact body |
| `--t-15` | 15px | Secondary prose, Operate body, controls |
| `--t-17` | 17px | Persuade body |
| `--t-20` | 20px | Lede, Operate section heads (lettering) |
| `--t-26` | 26px | Section heads, refusal title (comfortable) |
| `--t-34` | 34px | Before/after values, store h1 at 390 |
| `--t-48` | 48px | Store h1, price figure |
| hero | `clamp(2.75rem, 0.6rem + 5.6vw, 5.75rem)` | Title strip. One line ≥1200px, one sentence per line below |

Rules: lettering is never bold (single stroke has no weight axis). Emphasis in lettering is size or a 2px underline. Prose max 60–72ch. The measured minimum font size is 12px (compact evidence `dt` in Operate). Kids minimum is 16px.

## Palette and on-colour pairs

Contrast below is WCAG 2.x from token math. Browser-measured minima from computed styles are in the next table.

**Cyanotype ground (Persuade; Operate when the system is dark)**

| Role | Token | Hex | On `--sheet` #17365F | On `--sheet-raised` #1F4677 |
|---|---|---|---|---|
| Ink | `--ink` | #F2EFE6 | 10.56 | 8.30 |
| Soft ink | `--ink-soft` | #BCC9DC | 7.24 | 5.69 |
| Control edge | `--rule` | #A9BAD3 | 6.16 (UI ≥3) | 4.84 |
| Pending (cloud, △) | `--mark-pending` | #F5C842 sodium | 7.65 | 6.01 |
| Verified (CHECKED) | `--mark-verified` | #8FE3BF mint | 8.04 | 6.32 |
| Refused (REJECTED) | `--mark-refused` | #FFB4A6 | 7.13 | 5.60 |
| Stale (SUPERSEDED) | `--mark-stale` | #D8B98A bronze | 6.49 | 5.10 |
| Primary button | `--btn-ink` on `--btn-bg` | #17365F on #F2EFE6 | 10.56 rest · 12.14 hover (#FFF) · active #D9DFE8 | |

**Whiteprint ground (store, refusals, Operate light)**

| Role | Token | Hex | On `--sheet` #F1F3F4 | On sunk #E3E8EC / raised #FAFBFB |
|---|---|---|---|---|
| Ink | `--ink` | #142F55 | 12.04 | — |
| Soft ink | `--ink-soft` | #45597A | 6.37 | 5.74 sunk |
| Control edge | `--rule` | #6E7F9C | 3.64 (UI) | — |
| Pending text | `--mark-pending` | #7A5600 | 5.97 | 5.78 on cloud wash #FBEFC4 |
| Cloud stroke | `--cloud` | #9C7700 | 3.73 (graphic ≥3) | — |
| Verified | `--mark-verified` | #1E6B4A | 5.79 | — |
| Refused | `--mark-refused` | #B3261E | 5.87 | 6.31 raised |
| Stale | `--mark-stale` | #7A5A2E | 5.67 | 6.08 raised |
| Primary button | `--btn-ink` on `--btn-bg` | #F1F3F4 on #142F55 | 12.04 rest · 8.6 hover #1F4478 · active #0E2342 | |

**Store token block.** This is the only difference between catalog-game and catalog-web.

| Store | `--store-ink` | `--store-ink-hover` | `--store-on` | Contrast |
|---|---|---|---|---|
| Forge (catalog-game) | #8F4A14 copper | #75390B | #F1F3F4 | 5.98 both ways |
| Web (catalog-web) | #0D6464 teal | #094C4C | #F1F3F4 | 6.24 |

**Kids (own file, own tokens).** Paper #F7F9FC on bench #EEF2F8. Ink #1F3F73 (9.87). Soft ink #3F5682 (6.95). Chunky shapes #3A64A8 (5.58). Kids' own hue is drafting-eraser pink #B8326A, with white on it at 5.67 (hover #9C2858 at 7.35).

**Link rule.** `a:hover` changes only `text-decoration-thickness`, never `color`. A link that is also a button keeps the button's ink in every state. That removes the cause of the v5 1.20:1 hover-label failure (`packages/site-kit/src/design-tokens.ts` ~:615) by construction.

### Browser-measured (computed styles, every visible text node + every control in rest/hover/focus/active/disabled)

Source: `shots/metrics.json` (Playwright Chromium 1223 + axe-core 4).

| Screen | Min text contrast | Min control-state contrast | axe serious/critical | Overflow-x |
|---|---|---|---|---|
| index | 6.49 | — (inline links only) | 0 | none |
| B-1 Persuade hero (pending / verified / refused / reduced) | 7.24 / 7.24 / 7.13 / 7.24 | 7.24 | 0 | none |
| B-2 store item | 5.98 | 5.98 | 0 | none |
| B-3 inspector light / dark / comfortable | 5.67 / 6.49 / 5.67 | 6.37 / 7.24 / 6.37 | 0 | none |
| B-4 refusals | 5.60 | 12.04 | 0 | none |
| B-5 kids default / full-refused / playing | 5.67 / 5.38 / 5.67 | 5.67 | 0 | none |

The same holds at 390 and at 720 CSS px, which stands in for 1440 at 200% zoom. axe reports 0 violations of any impact on every page after the fix round.

## Materials and elevation

There are no shadows in Persuade or Operate. A drawing has no z-axis. Elevation is line weight and ground:
- **Line weights (ISO 128 pairs, 2:1).** `--w-thick` 2px for the sheet border, title block and revision-table head rule. `--w-thin` 1px for dividers. `--hair` (32% or 22% ink) for the reference grid and table rows.
- **Grounds.** `--sheet` is the page. `--sheet-raised` is a panel set on the sheet (refusal panel, store plate). `--sheet-sunk` is a well (raw diff). Each step is a measured colour, not opacity.
- **Paper.** Persuade carries a 3.5–5% fractal-noise grain as a data-URI SVG. It reads as matte paper and is what keeps the blue away from the v5 glassy cyan. Operate (`data-ground="auto"`) drops the grain.
- **Radius.** 2px on controls only. Panels are square, like sheet geometry.
- **Kids is the exception.** The sketch pad has a 3px ink border, 18px radius, ring binding and one soft drop shadow (the pad sits on a desk).

## The four laws as drafting marks (label + icon + colour; never colour alone)

| State | Mark | Icon (shape carries meaning without colour) | Word |
|---|---|---|---|
| Pending | Scalloped revision cloud around the changed value, plus a revision triangle carrying the letter | △ with letter (B, C…) | "Pending review" |
| Verified | Double-ruled CHECKED stamp, rotated −4°, lands once | ○ with tick | "Verified" / "Checked · Rev B written" |
| Refused | REJECTED stamp, with the registry code and the product's message written beneath | Octagon with × | "Refused" / "Rejected · Nothing written" |
| Stale | Before and after ruled through (2px bronze strike) | Two rails cut by a slash | "Superseded" + `CHANGE_REVIEW_PROPOSAL_STALE` |

Forced colours: the cloud becomes a 2px dashed `CanvasText` outline, stamps and refusal borders become `CanvasText`, and the words and icon shapes stay. See `shots/*-1440-forced.png`.

## Motion vocabulary

| Name | Token | Behaviour | Used for |
|---|---|---|---|
| Plotter feed | `--feed` 900ms, **linear** | `stroke-dashoffset` 1→0 on `pathLength=1`. A constant-speed pen with no easing | Revision cloud traced around a proposal. Hero linework (1400ms, once on load) |
| Stamp | `--stamp` 220ms, `cubic-bezier(.16,1,.3,1)` | 8px drop + fade in. Lands once, no bounce, no repeat | CHECKED / REJECTED |
| Settle | `--settle` 240ms | — | Reserved for panel reveal |
| Control | 120ms linear | Background colour only | Button hover/active |
| Kids sketch-in | 420ms ease-out | 10px rise + fade | Piece placed |
| Kids play bob | 2400ms ease-in-out alternate | 6px | Pieces idle while Playing |

**Reduced motion.** Every animation and transition is cut to 0.01ms. The plot paths render at their end state (`stroke-dashoffset: 0`). Stamps appear without travel, and the labels are unchanged. Measured: `document.getAnimations()` shows 0 running animations under `prefers-reduced-motion: reduce` on B-1, B-3 and B-5 (playing).

**Live 3D.** None. B's propose → inspect → commit is a 2D plan drawing: a phantom line marks the committed position and a cloud marks the proposed one, both at drawing scale. It is static, has no WebGL, and is its own fallback. A live viewport would need to show the same phantom/cloud overlay to earn its cost (see open issues).

## The three dialects

| | Persuade | Operate | Kids |
|---|---|---|---|
| Surfaces | Umbrella marketing, store home and item | Account/admin, web-shell inspector, Engine Desktop | Kids origin only |
| Ground | Full cyanotype sheet with grain (umbrella). Whiteprint for stores, so the store token reads on a light field | `data-ground="auto"`: whiteprint in light, cyanotype in dark, no grain | Sketch pad on a cool bench, dot grid inside the pad only |
| Sheet | 22px rulers A–F / 1–8, 2px border, title block in the footer | 16px rulers, compact zones, title block | No sheet, no rulers |
| Type | Lettered display (title strip one line at 1440), 17px prose | 15px body. Lettering at 13–20px for heads, values, pointers | Public Sans 18px/500, lettered h1 only |
| Controls | 48px height, 56px for the acquire CTA | Comfortable 36px / compact 28px (`data-density`, switchable) | ≥56px. Choices 76–112px. Play 64px |
| Density | Comfortable | Comfortable or compact. The same refusal component changes padding and type, not structure | One step at a time |
| Motion | Plotter feed + stamps | Cloud trace on propose. No hero linework | Calm: sketch-in once, slow bob only while playing |
| State marks | Full stamps | Inline marks; stamps omitted | Plain words + friendly icon (✓ circle / ─ circle). Never "refused" in copy, only the reducer's own kind strings |

**Shared core across all three.** Silhouette (ruled frame, square panels, 2px control corners). The type relationship (lettering for labels and figures, sans for prose). The review choreography: propose → cloud traced → Accept/Reject → stamp, plus a live-region note using the inspector's exact strings. Before/after are always side by side and labelled with revision letters. Consequence and recovery are written above the commit buttons.

## Change Review anatomy (B-1, B-3)

1. Context line: document + JSON pointer, in lettering.
2. **Detail callout** (B-3): △B | Before · Rev A (value, sha256 05d2…6dd1) | After · Rev B (clouded value, sha256 374c…0aab).
3. **Consequence**: "Accept writes `scene.json` at `/data/entities/0/x`, one value, all or nothing."
4. **Recovery**: "Reject discards the proposal without writing. If the apply outcome is unknown, Resolve pending apply; do not retry Accept."
5. Commit: Accept (primary) / Reject (line). Disabled outside `reviewing`: dashed edge, soft ink, `cursor: not-allowed`, never opacity.
6. **Revision ledger**: every row state with the registry code and the message beneath (pending C, verified D, stale E, refused F `path-not-found`, refused G `CHANGE_REVIEW_PARTIAL_ACCEPT_UNSUPPORTED`, empty).

Web-shell DOM ids and contracts are kept verbatim in B-3: `#edit`, `#documentPath`, `#jsonPointer`, `#newValue`, `#propose`, `#accept`, `#reject`, `#recover`, `#reconcile`, `#review-help`, `#phase[data-phase]`, `#note[role=status]`, `#diff`.

## Tokens requested from the foundation owner (if B is picked)

`--sheet / --sheet-raised / --sheet-sunk`, `--ink / --ink-soft / --rule / --hair`, `--mark-{pending,verified,refused,stale}`, `--cloud / --cloud-wash`, `--btn-{bg,ink,bg-hover,bg-active}`, `--focus`, `--w-thick / --w-thin`, `--feed / --stamp / --settle`, `--f-letter / --f-text`, the type scale above, and the 3-token store block (`--store-ink`, `--store-ink-hover`, `--store-on`). Two grounds × light/dark resolve through `data-ground="cyan|white|auto"`. Kids gets a separate token file it owns.
