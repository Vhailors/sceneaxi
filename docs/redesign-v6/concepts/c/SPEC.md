# Concept C · Press Proof

The seed is BRIEF §9 Seed C, "Press Proof": a prepress sheet under D50 viewing-booth light. Each SceneAxi surface is a page on one press sheet. A change is a plate that has not been pulled yet. Inspecting it means toggling the separations (before plate, after plate, overprint). Committing it snaps the ghost plate into register and lays the ink down.

Open the prototype at `index.html`. The slug line at the foot of every sheet links all five screens. The pages are self-contained: `proof.css`, a 2 KB `proof.js`, and self-hosted OFL fonts in `fonts/`. They make no remote requests.

| # | Screen | File | Dialect |
|---|---|---|---|
| 1 | Umbrella hero, propose → inspect → commit | `index.html` | Persuade |
| 2 | Store asset detail, inspect → acquire (refused by name) | `store-item.html` (`?store=vitrine` swaps the token block) | Persuade + store block |
| 3 | Dense inspector Change Review: before/after, consequence, recovery | `inspector.html` | Operate, compact; follows system light/dark |
| 4 | Named-state panels, comfortable and compact | `states.html` | Persuade and Operate side by side |
| 5 | Kids studio | `kids.html` | Kids |

All copy comes from the repo:
- Umbrella: `sites/umbrella/src/app/page.tsx` and `lib/launch-marketing.ts`, plus `RELEASE_MARKER`.
- Store: `sites/catalog-game/src/app/item/[itemId]/page.tsx`, `packages/site-kit/src/commerce-notice.ts`, `SITE_REFUSALS`, `COMMERCE_ACTIVATION_GATE`, and the `market-stall-kit` and `lantern-prop` fixtures in `packages/schemas/contracts/catalog-listings.fixtures.json`. `CREATOR_SHARE_BASIS_POINTS` is 5000.
- Inspector: `apps/web-shell/src/inspector-app.ts` and `CHANGE_REVIEW_*` refusals.
- Kids: `sites/kids/src/lib/kids-activity.ts` and `kids-studio.tsx`.

The scene document `scenes/harbour.scene.json` and its two entities are synthetic. They are labelled as a demonstration. Their digests are real SHA-256 values of the JSON shown.

## How C differs from A and B

| Axis | A Interlocking | B Revision Block | **C Press Proof** |
|---|---|---|---|
| Light | mid-dark field | drenched blue | **bright coated white under a neutral N8 booth surround** |
| Colour | committed single | drenched | **full process palette: C, M, Y and K each own one job** |
| Type | condensed plate | single-stroke lettering | **heavy, wide variable grotesk at specimen scale (Anybody, wdth up to 132%)** |
| Space | frame + diagram | zoned sheet | **imposition: trimmed sheet with crop marks, colour bar and slug line** |
| Motion | lever detent | pen plot | **register snap: the ghost plate moves 4px into register, then the ink lays down** |

The print marks carry information. This answers the brief's honest risk that C could read as generic editorial.
- **Colour bar:** the legend of the colour laws, with every patch named.
- **Slug line:** the job ticket (document, pointer, before and after digests).
- **Misregistered magenta ghost:** the unwritten value.
- **Yellow:** marks exactly the bytes that differ.
- **Store record mark:** four separations drawn from the listing's own digest bytes. It is not a fake render.

## Type

| Family | Role | Files |
|---|---|---|
| **Anybody** (OFL, variable wght 100–900, wdth 50–150) | Display, specimen, numerals in diffs | `fonts/anybody-var.woff2`, 55.6 KB |
| **Schibsted Grotesk** (OFL; 400, 500, 700) | Text, UI, labels | 3 × 24 KB |
| **Martian Mono** (OFL; 400, 500) | Pointers, digests, codes, slug | 2 × 10 KB |

Licences are in `fonts/*-OFL.txt`. All fonts are self-hosted, so desktop and Kids make no remote requests.

**Persuade scale** (rem; the umbrella pin allows at most 9 sizes, and this uses 8):

| Token | px | Use |
|---|---|---|
| `--t-specimen` | clamp 44–108 | H1 specimen, Anybody 860 / wdth 116–132 / lh .88 / tracking -.035em |
| `--t-44` | 44 | H2, diff values |
| `--t-30` | 30 | Section heads, prices |
| `--t-22` | 22 | Lede, H3, panel titles |
| `--t-18` | 18 | Proof titles, large buttons |
| `--t-16` | 16 | Body, lh 1.55 |
| `--t-14` | 14 | Meta, captions, nav |
| `--t-12` | 12 | Data, slug, pane heads. This is the floor; there is no 11px. |

**Operate** has a 14px base and 12px data, with the 22px display head as the only step up. The type is deliberately flat because its hierarchy comes from rules and weight. The detector's `flat-type-hierarchy` advisory on the inspector is accepted for that reason.

**Kids** has an 18px base, 22px legends, and a 36–60px heading. No kids text is below 16px.

## Palette: roles, on-colour pairs, measured contrast

Ratios are WCAG 2.x, computed from sRGB. The browser pass (below) re-measured every rendered text node and interactive state against its composited background.

| Role | Token | Hex | On-colour pair | Ratio |
|---|---|---|---|---|
| Booth surround | `--booth` | `#D3D2CD` | (decorative frame only) | n/a |
| Proof stock | `--paper` | `#FBFAF7` | `--ink #141519` | 17.48 |
| Well | `--paper-2` | `#F1EFE9` | `--ink-2 #44464E` | 8.18 |
| Hover wash | `--paper-3` | `#E6E3DB` | `--c-deep #004E7C` | 6.88 |
| Key (actions) | `--ink` | `#141519` | `--on-ink #FBFAF7` | 17.48 |
| Secondary text | `--ink-2` | `#44464E` | on paper | 9.01 |
| Tertiary text | `--ink-3` | `#5E6068` | on paper | 6.01 |
| Control border | `--line-ui` | `#7E8088` | on paper / paper-2 (UI, 3:1) | 3.77 / 3.43 |
| **C**yan: wayfinding, links, focus ring | `--c` | `#0068A3` | on paper | 5.73 |
| **M**agenta: pending (text-safe) | `--m` | `#B0006A` | on `--m-wash #FBE3EF` / `#FFF` on `--m` | 5.68 / 6.88 |
| Magenta patch (ghost plate, never text) | `--m-patch` | `#E6007E` | decorative | n/a |
| **Y**ellow: the difference | `--y-hi` | `#FFE14D` | `#141519` on it | 14.01 |
| Mint: verified / new value | `--ok` | `#0A6B4F` | on `--ok-wash #D3F0E3` / paper | 5.37 / 6.23 |
| Red: refused | `--no` | `#C0221B` | on `--no-wash #FBE1DE` / white | 4.86 / 6.02 |
| Bronze: stale / old value | `--old` | `#8A5A1E` | on `--old-wash #F3E7D3` / paper | 4.82 / 5.65 |
| Disabled | fg `#55575E`, border `--line-ui` | | on paper-2 | 6.27 text / 3.43 border |

**Press room at night** is Operate only, under `prefers-color-scheme: dark`. Ink is `#ECEAE4` on `#1A1B1F` (14.30). Ink-2 is `#BDBBB4` (8.96). Cyan is `#6CC0F2` (8.57). Magenta is `#FF7DBE` on `#3A1A2B` (6.55). Mint is `#5ED6A8` on `#14352A` (7.42). Red is `#FF8A80` on `#3D1C1A` (6.67). Bronze is `#DDA762` on `#33281A` (6.70). Yellow highlights always carry fixed `#141519` ink (14.01) in both schemes. That rule is the fix for the round-1 failure, where the highlight measured 1.08.

**Store token block.** This is the only difference between Forge and Vitrine. It lives in `proof.css`, at the end of the dialect sections:

```css
[data-store="forge"]   { --spot: #23338F; --on-spot: #FBFAF7; --spot-wash: #E3E6F4; --store-stretch: 150%; }
[data-store="vitrine"] { --spot: #5B2A86; --on-spot: #FBFAF7; --spot-wash: #ECE3F3; --store-stretch: 100%; }
```

Spot contrast: Forge 10.36 and Vitrine 9.49 on paper; ink on wash is 14.6. The store name and tagline strings come from each site's `site-config.ts`, not from tokens.

**Kids hue:**

| Token | Value | Notes |
|---|---|---|
| Ground | `#FFF6DA` | |
| Ink | `#1E1A14` | 16.03 on ground |
| Sun | `#FFC629` | Fills only |
| Pink | `#EE4C97` | Fills only |
| Hover | `#FFF1C2` | Ink on it is 15.34 |

Kids never shows a digest, pointer, price or code.

**Colour laws (PRODUCT.md).**
- Accent (magenta) means pending, mint means verified, and red means refused.
- An old value is stale bronze and struck through. A new value is mint, with its changed bytes in yellow.
- Every state is a chip with a **label and an icon**: pending is offset double squares, verified a ringed check, refused a boxed X, stale a dashed box with a strike. Panels repeat the state as the border ink, and pending and stale borders are also dashed. Colour is never the only carrier, and forced-colours mode keeps the labels and shapes.

## Materials and elevation

- **Sheet.** One trimmed sheet sits on the booth surround with a 1px trim edge (`--edge #C4C1B8`, decorative) and hairline crop marks outside the trim. Below 900px the sheet bleeds to the viewport and the marks are dropped.
- **Plates.** The plate is the `--paper-2` well that holds the scene, viewport or record mark. A 1px `--line-ui` frame marks it in Operate, 2px ink in Persuade.
- **Rules, not shadows.** Hierarchy comes from rule weight: 2px key rules head sections and tables, 1px `--edge` rules divide rows. The only shadow is `--lift`, used for the open mobile menu, a sheet lifted off the stack. There are no card grids, no glass and no gradients outside the Kids swatches.
- **Radii.** Controls use 2px (a trimmed edge). Kids uses 16–20px, the screen-print pull.
- **Stamps.** "OK to print" (mint) and "Hold" (red) are double-ruled stamps tilted -3°. They are the only rotated objects, and they appear only after a decision.

## Motion vocabulary

| Name | What moves | Duration / easing | Meaning |
|---|---|---|---|
| `register-snap` | Ghost plate translates (4px, -3px) → (0, 0), then hides | 180ms `cubic-bezier(.2,.9,.1,1)` | Commit: the proposal becomes the record |
| `ink-lay` | The after-plate fill goes from outline to solid key | 120ms linear | Written |
| `stamp-land` | Stamp scales 1.12 → 1 | 140ms snap | A verdict lands once; never loops |
| `strike` | Proof-mark line draws through the rejected plate | 220ms ease-out | Refused or rejected |
| `ui` | Background and border colour on hover and press | 120ms linear | Feedback only |
| Kids `press` | Button drops 3px onto its shadow | 160ms ease-out | Calm tactile press; there is no bounce, spin or confetti |

Rules:
- Nothing animates layout.
- Nothing loops.
- Nothing runs on page load except fonts.
- Focus moves with the decision: Accept → "Propose again", Reject → "Propose again".

**Reduced motion.** A global `prefers-reduced-motion: reduce` rule sets every animation and transition to none. States still change instantly, and stamps appear without scale. In the browser pass the stamp's computed `animationName` was `none`.

## The three dialects

| | **Persuade** | **Operate** | **Kids** |
|---|---|---|---|
| Surfaces | Umbrella, store home and item | Web shell inspector, account/admin, desktop chrome and dock | Kids studio |
| Light | Bright proof stock (light only) | System light/dark; dark is "press room at night" | Bright, warm ground |
| Display | Anybody 860, wdth 116–150%, specimen scale | Anybody 800, 22px, the only big step | Anybody 820, 36–60px |
| Density | Generous (48–112px section rhythm) | `compact` 32px targets, or `comfortable` 40px | 56px floor; choices are 72px, primary actions 64px |
| Change Review | Hero demo: separations radio, three acts, one pointer, consequence and recovery inline | Rows table with the leaf never truncated, both hashes in full, consequence and recovery in a right rail, partial accept refused by name | Undo-first: the newest piece sits in a dashed box; the message names it and how to take it back |
| States | Chip + comfortable panel | Chip + compact panel | One icon + sentence in the kids voice ("Your world is full. Undo one thing to add another.") |

Shared core across all three:
- The silhouette (trimmed sheet, 2px rules, square controls).
- The type relationship (wide display over a neutral grotesk, mono for data).
- The state chips and icons.
- The propose → inspect → commit choreography.

## Accessibility notes built into the core

- No global `a:hover`. Every interactive class (`.btn`, `.navlink`, `.act`, `.tile`, `.kchoice`, `.kbtn`, prose links) sets its own ink in every state. This avoids the v5 1.2:1 defect.
- `:focus-visible` is a 3px cyan ring with a 2px offset. Kids uses a 4px ink ring with a 9px sun halo. `scroll-padding-top` keeps focused targets clear of the masthead.
- The Acquire button uses `aria-disabled` plus `aria-describedby` pointing at the named refusal panel, so it stays focusable and explains itself.
- The inspector table sits in a labelled, focusable scroll region. Below 720px each row reflows to a labelled card.
- Without JS, controls marked `.js-only` are hidden and the static Inspect state shows the full diff, consequence and recovery. That static view is the mandatory fallback, so no live 3D is proposed.

## Verification evidence (browser, Chromium 1223 via playwright-core)

The script was `/tmp/cgen/shot.mjs`, with the raw output written to `shots/report.json`. There was one batched round, one fix round, and one confirm round.

**Contrast.** Computed contrast was measured on every rendered text node at 1440 and 390. Each interactive element was also measured under forced `:hover`, `:focus`/`:focus-visible` and `:active` (CDP `CSS.forcePseudoState`), including control borders at 3:1 and the aria-disabled Acquire button.
- Round 1 found: verified chip 4.40, Acquire disabled border 2.31, and seven night-mode highlights at 1.08 and 2.35.
- Confirm round: **0 text failures and 0 state failures on every page, light and night.**

| Check | Result |
|---|---|
| axe-core 4.x | Round 1 had one `region` violation (moderate; the colour bar was outside a landmark), fixed by making it an `<aside>`. Confirm round: 0 violations, so 0 serious and 0 critical. |
| Horizontal overflow at 390 | 0 on all five pages (the inspector was 72px before the fix) |
| Overflow at 200% zoom (index, 720 CSS px at DPR 2) | 0 |
| Keyboard | Tab order is skip link → masthead → CTAs → acts → separations on index; skip link → tree → table region → Accept/Reject/Read → slug on inspector. Every stop showed a solid 3px outline in the viewport. |
| Forced colours | `shots/index-1440-forced.png`, `shots/states-1440-forced.png` |
| Prototype weight | CSS 41.9 KB unminified, covering all five screens and three dialects. Fonts 152.6 KB total, 55.6 KB of it on the critical path, preloaded. |

**Not measured here:** Lighthouse LCP, CLS and INP, and CSS as a percentage of BASELINE. Those belong to the built slices at G2.
