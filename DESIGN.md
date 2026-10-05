---
name: SceneAxi
description: An interactive engine and library, with versioned profiles. Every change is reviewed before it is written.
colors:
  bg-base: "#07080A"
  bg-panel: "#0D0F12"
  bg-raised: "#12151A"
  bg-control: "#191D23"
  bg-field: "#08090B"
  bg-row: "#101318"
  line-soft: "#14181E"
  line: "#1C2129"
  line-strong: "#2C323B"
  fg: "#EDEFF2"
  fg-2: "#8A929C"
  fg-4: "#3F464F"
  accent: "#FF6B2C"
  accent-hi: "#FF8A54"
  ok: "#5EEAD4"
  danger: "#FF4D5E"
  danger-on-light: "#B3261E"
  info: "#5B9CFF"
  stale: "#7A6448"
  axis-x: "#E0564F"
  axis-y: "#7BC44C"
  axis-z: "#4C8BE0"
  kids: "#A78BFA"
  store-game: "#E8544E"
  store-web: "#3FB8C9"
  desktop-backdrop: "#05080E"
  desktop-canvas: "#0A0F1A"
  desktop-well: "#070B13"
  desktop-panel: "#0F1624"
  desktop-raised: "#131B2C"
  desktop-header: "#182236"
  desktop-line: "#243044"
  desktop-line-control: "#2A3850"
  desktop-line-hover: "#3D5274"
  desktop-accent: "#46D8EC"
  desktop-accent-hover: "#74E3F2"
  desktop-on-accent: "#05121A"
  desktop-ok: "#5FE3C0"
  desktop-text: "#EAF0F9"
  desktop-text-secondary: "#ACB8CC"
  desktop-text-faint: "#95A2B8"
typography:
  display-xl:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 1.6rem + 3.6vw, 4.125rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 104"
  display-l:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 1.4rem + 1.9vw, 2.625rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  heading:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  subhead:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  ui:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.08em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum' 1"
  desktop-body:
    fontFamily: "-apple-system, 'SF Pro Display', 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  xs: "2px"
  sm: "3px"
  md: "5px"
  lg: "9px"
  xl: "16px"
  full: "999px"
  desktop-control: "10px"
  desktop-card: "13px"
  desktop-panel: "16px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-6: "24px"
  space-8: "32px"
  space-11: "44px"
  space-18: "72px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg-base}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "46px"
    typography: "{typography.subhead}"
  button-primary-hover:
    backgroundColor: "{colors.accent-hi}"
    textColor: "{colors.bg-base}"
  button-quiet:
    backgroundColor: "{colors.bg-base}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "46px"
  button-quiet-hover:
    backgroundColor: "{colors.bg-control}"
    textColor: "{colors.fg}"
  chip-status:
    backgroundColor: "{colors.bg-row}"
    textColor: "{colors.fg-2}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
    typography: "{typography.label}"
  input-field:
    backgroundColor: "{colors.bg-field}"
    textColor: "{colors.fg}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "38px"
  card-panel:
    backgroundColor: "{colors.bg-panel}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    padding: "24px"
  desktop-button-primary:
    backgroundColor: "{colors.desktop-accent}"
    textColor: "{colors.desktop-on-accent}"
    rounded: "{rounded.desktop-control}"
    height: "30px"
  desktop-panel:
    backgroundColor: "{colors.desktop-panel}"
    textColor: "{colors.desktop-text}"
    rounded: "{rounded.desktop-panel}"
---

# Design System: SceneAxi

> Scan-mode record of the incumbent system as of 2026-10-04, written from
> `packages/site-kit/src/design-tokens.ts` (Foundations v2), `apps/desktop-shell/src/visual-tokens.ts`
> and the chrome stylesheet (Cinematic Pro), `sites/*/src/app/globals.css`,
> `docs/design-foundations.md` and `docs/engine-desktop-surface.md`. Values marked **(pending)** are
> approved changes in `docs/redesign/DIRECTION.md` that become normative when the foundation lane
> lands them in code; until then the code is authority. The qualitative language below was not
> confirmed in an interview (none was possible); it is the director's reading of the shipped
> system and its source comments.

## Overview

**Creative North Star: "The Review Bench"**

SceneAxi is a dark workbench under one good light. The bench itself (neutrals, hairlines, quiet
type) recedes; the only bright things are the work waiting on you, what has been verified, and
what was refused. The umbrella stylesheet names the incumbent world "a dark instrument-panel
surface, one orange signal colour, Archivo for prose and JetBrains Mono for anything the machine
produced", and states the rule that drives it: a refusal looks like a refusal, evidence looks like
evidence, and nothing is styled to imply a claim the contracts do not make.

Two dialects share that bench. **Foundations v2** dresses every `sites/` surface: near-black
neutrals, signal orange, Archivo + JetBrains Mono, tight radii. **Cinematic Pro** dresses the Engine
Desktop: graphite-blue surfaces, a cyan life signal, a system neo-grotesque, softer radii, a
viewport-first layout. Kids is the one surface allowed to change scale, radius and hue, on its own
origin.

Motion is the redesign's main addition (pending): an instrument settling, never a show. Values ease
into place with exponential deceleration, panels arrive from the edge they live on, and a diff
resolves visibly when it is accepted. The one looping exception that is not a progress signal is
the Kids play float, which is the play itself (DV-K2, ruling R-3): it runs only while the world
plays, moves by transform alone, never bounces and stands still under reduced motion.

**Key Characteristics:**
- Near-black, tonally layered surfaces; depth from tone and hairlines, not shadow.
- One accent per surface, spent only on pending work and the primary action.
- Machine output (digests, pointers, exit codes, prices in credits) always in mono with tabular figures.
- Named states are first-class components, not fallbacks.
- Small radii on sites (2–9px), softer on desktop (10–16px), 16px only on Kids.

## Colors

A restrained palette of nine neutrals and one surface accent, with semantic colours that mean
exactly one thing each.

### Primary
- **Signal Orange** (#FF6B2C): the umbrella's product accent and the Foundations "engine" accent (the packaged Engine Desktop uses Desktop Cyan instead). Primary action, selection, pending work, unreviewed changes. Hover is **Signal Orange Lifted** (#FF8A54).
- **Store accents**: **Forge Red** (#E8544E) for the game-asset storefront, **Vitrine Teal** (#3FB8C9) for the web-asset storefront and web editor. Same skeleton, accent shifts only.
- **Desktop Cyan** (#46D8EC, hover #74E3F2): the Engine Desktop's life signal; text on it is #05121A.

### Secondary
- **Verified Mint** (#5EEAD4; desktop #5FE3C0): a validated artifact, an applied change, a passing check, the new value in a diff. Never a button, never decoration.
- **Refusal Red** (#FF4D5E): a refusal or a destructive action, nothing else.
- **Refusal Red on light** (#B3261E): the same law on a light system canvas; used only by the web-shell inspector in a light OS theme (test-pinned; #FF4D5E fails 4.5:1 on white).
- **Info Blue** (#5B9CFF): experimental, informational.

### Tertiary
- **Kids Violet** (#A78BFA): the Kids surface and scene composition.
- **Stale Bronze** (#7A6448): the struck-through old value in a diff. Large-text role only (3.02–3.57:1); never the only carrier of a fact.
- **Axis trio** (#E0564F / #7BC44C / #4C8BE0): X/Y/Z gizmos and field chips; fixed meanings.

### Neutral
- **Bench Black** (#07080A): app background, viewport letterbox.
- **Panel** (#0D0F12), **Raised** (#12151A), **Control** (#191D23), **Field** (#08090B), **Row** (#101318): the surface ladder.
- **Hairlines**: soft (#14181E) for row dividers, line (#1C2129) for panel and control borders, strong (#2C323B) for floating edges and hover borders.
- **Ink**: primary #EDEFF2, secondary #8A929C (body-safe), disabled/units #3F464F (non-text only).
- **Desktop graphite**: backdrop #05080E, canvas #0A0F1A, panel #0F1624, raised #131B2C, header #182236; lines #243044 → #3D5274; ink #EAF0F9 / #ACB8CC / #95A2B8.

### Named Rules
**The Pending Rule.** Accent means pending. If nothing is waiting on you, there is almost no orange on screen, which is how you find work.
**The Bronze Rule.** A diff never uses red for its old value. Being replaced is not an error.
**The Measured Ink Rule.** Every text colour is contrast-measured in the gate against every surface it can sit on; `--fg-4` may never carry text. Dimming is painted, never composited with `opacity`.

## Typography

**Display Font:** Archivo (variable width axis), self-hosted via `next/font` on sites
**Body Font:** Archivo
**Label/Mono Font:** JetBrains Mono
**Desktop:** system neo-grotesque (`-apple-system`, SF Pro Display, Segoe UI Variable) and `ui-monospace`; no remote font request.

**Character:** a slightly widened grotesque with confident 700 headlines for the product voice,
and a mono that appears only when a machine produced the value.

### Hierarchy
- **Display XL** (700, 40→66px fluid, lh 1.02, wdth 104): the umbrella home hero and storefront home heroes only. Fluid is pending (DV-F10; the sheet token is a fixed 66px, so sites write the `clamp()` as a literal and never read the token for a font size).
- **Display L** (700, 30→42px fluid, lh 1.08): interior route titles; section titles on Persuade landing pages. Fluid is pending (DV-F10; the sheet token is a fixed 42px, used the same way).
- **Heading** (700, 24px, lh 1.2): section titles on interior and Read pages; dialog titles.
- **Subhead** (600, 17px): card titles, state-panel titles.
- **Lead** (400, 18px on sites (pending), lh 1.55): the one paragraph under a route title, max 60ch.
- **Body** (400, 16px on sites, 13–14px in editor chrome, lh 1.6): prose at 65–72ch.
- **UI** (500, 13px on sites (pending, DV-F9; sheet 12px; UI small 12px, sheet 11px); 12px in desktop chrome): nav, buttons, tabs; field labels, TOC titles, facet labels, footer headings and definition-list terms, in Archivo, sentence case (pending).
- **Label** (mono 500, 11px, tracking 0.08em, uppercase allowed): machine values and table column heads only: evidence-table column heads, status-chip values, reason and exit codes (pending; was also used for field labels and section labels). **11px is the floor for any text (pending; was 8.5–10px).**
- **Mono** (400, 12–13px on sites (pending, DV-F9; sheet 10–12px), tabular): digests, pointers, ids, prices in credits, exit codes.

### Named Rules
**The Machine Voice Rule.** Mono is for what a machine produced or will parse. Never prose, never a costume.
**The Floor Rule.** No text below 11px anywhere (pending). Sizes under it are aria-hidden marks only, plus two test-pinned desktop exceptions that stay 10px until their test changes: `.scene-entity-identity code` and `.asset-browser-card span` (`apps/desktop-shell/test/visual-refinement.test.ts`).

## Layout

Fluid shells over one 4px spacing scale: 4, 8, 12, 16, 24, 32, 44, 72 (gate-pinned; no in-between
step may be invented). Editor chrome lives in 4–16; marketing bands use 44–72. The umbrella shell reflows at 1180, 1024, 860 and
620px with a single-column phone rule for every multi-column grid; wide evidence tables scroll
inside their own labelled region, never the page. Storefronts declare single-column first and widen
at breakpoints. The Engine Desktop is a fluid grid (title bar 36, rail 56, left dock 274, inspector
326, assistant 344, status 27 at the 1680 reference) with four window tiers that turn the assistant,
then the docks, into drawers, and refuse below the declared minimum window.

## Elevation & Depth

Tonal layering first. Docked panels separate by a 1px hairline plus a 1px inset top highlight at
3% white; only floating layers (dialogs, menus, drawers, the command palette) cast shadow.

### Shadow Vocabulary
- **Float** (`0 24px 60px -16px` in 90% black today; pending: `0 10px 14px -6px` at the same ink with the 1px strong edge): dialogs, menus, palette.
- **Raised inset** (`inset 0 1px 0 rgba(255,255,255,.03)`): headers, toolbars.
- **Control inset** (`inset 0 1px 0 rgba(255,255,255,.05)`): buttons and chips at rest.

### Named Rules
**The Float-Only Rule.** Shadows belong to things that float. A docked card, a button or a viewport frame never casts a drop shadow.

## Shapes

Small, honest corners. Sites: 2px bars and marks, 3px inputs and chips, 5px buttons and segmented
groups, 9px cards, dialogs and panels, 999px only for counts, pills and avatars. 16px belongs to Kids
alone. Desktop: 10px controls, 13px cards, 16px panels (pending; was 18px). No card exceeds 16px.

## Components

### Buttons
- **Shape:** gently squared (5px sites; 10px desktop).
- **Primary:** accent fill, bench-black label, weight 600; 46px on sites (the `xl` size), 22/30/38px `sm`/`md`/`lg` sizes for denser rows; 30px in desktop chrome.
- **Quiet:** transparent over the bench with a 1px strong hairline (#2C323B), primary ink, weight 500.
- **Hover / Focus / Active / Disabled / Loading (pending motion):** hover lifts a state layer on sites and is an instant paint swap on desktop; focus is a 2px accent-lifted outline at 2px offset on sites, the `--accent` outline with a 4px well on desktop, and a 2px `currentColor` ring in the web shell (both pinned by tests); press scales to 0.97 on sites and in the web shell, while desktop confirms a press by an inset shadow and never moves the glyph or uses a scale transform (test-pinned); disabled is painted (dashed or dimmed line, readable label), never opacity; loading keeps the label, sets `aria-busy`, and shows a 2px bar only after 300ms, cycling once per 1200ms (the one loop exception to the 120–320ms motion band, accepted by the run contract owner on 2026-10-04 as ruling R-1 in `docs/redesign/RULINGS.md`, for indeterminate progress indicators only; static under reduced motion; the desktop assistant bars and sculpt sweep share this timing and the ease-out-quart curve under ruling R-2). On storefronts `--accent-hi` equals the accent (test-pinned), so primary hover there is the `currentColor` state layer, not a lighter fill.

### Chips
- **Style:** the six published statuses (Validated, Needs review, Refused, Experimental, Isolated, Dormant), each a tinted fill, matching 1px line and a 5px dot; mono label.
- **State:** a chip names a state the surface's contract entitles it to show; it is never decoration.

### Cards / Containers
- **Corner Style:** 9px.
- **Background:** Panel (#0D0F12) on Bench Black.
- **Shadow Strategy:** none (Float-Only Rule).
- **Border:** 1px soft hairline; strong hairline on hover where the card is a link.
- **Internal Padding:** 24px (16px on phones).

### Inputs / Fields
- **Style:** inset Field fill (#08090B), 1px line, 3px radius, 38px tall.
- **Focus:** accent-lifted outline; `:user-invalid` and `aria-invalid` paint the refusal red border.
- **Error / Disabled:** errors name the problem and the recovery in text, not colour alone.

### Navigation
- Sticky masthead: wordmark (square accent mark + name), primary nav, store links, Download. Current page marked with `aria-current` and an accent underline. Phones keep every item reachable without JavaScript state. Pending: an opaque bench with its bottom hairline drawn by `::after`, whose opacity may be scroll-linked; a border colour is never animated.
- Desktop: seven-mode rail, menu bar, view tabs, dock tabs; current mode carries the cyan indicator. Menus, dock panels, drawers, the palette and dialogs show and hide by the `hidden` attribute: they enter with a one-shot keyframe (opacity only inside `@keyframes`) and leave instantly.

### Change Review (signature)
The view over one real `Proposal`: dim path with a bright leaf that never truncates, old value in
Stale Bronze struck through, new value in Verified Mint, before/after digests always visible, per-row
accept/reject that resolves to apply, discard, pending, or a named refusal. The accept/reject marks
stay as text glyphs with an accessible label (ruling R-4); they may be restyled, never redrawn or
retexted.

### Named State Panel
A first-class panel for refused, isolated, pending and verified states: tone chip, title, the
registry's own reason code in mono, evidence list, and a link as the way forward. No retry
affordance the contracts do not define.

## Do's and Don'ts

### Do:
- **Do** read every colour from the token layer; sites declare no colour literal of their own.
- **Do** show digests, pointers and refusal codes in mono with tabular figures.
- **Do** keep wide evidence inside its own scroll region with a role and label.
- **Do** dim inert controls by paint (`INERT` tokens), never by `opacity`.
- **Do** keep every text pairing at or above 4.5:1 (3:1 for large text) and measure it.
- **Do** reserve the hairline term→value row for real evidence (core readout, item facts, balance facts, ledger); notes read as prose with inline mono figures, examples as a worked example, requirements as an ordered list.
- **Do** place a state chip after the heading it qualifies (beside it, or leading the action row).

### Don't:
- **Don't** use red for the old value in a diff; it is Stale Bronze.
- **Don't** spend accent on decoration; accent means pending.
- **Don't** put mint on a button.
- **Don't** cast a shadow from a docked surface.
- **Don't** set text below 11px or in `--fg-4`.
- **Don't** put a chip on its own line above a heading; that is an eyebrow again.
- **Don't** link, name or theme the Kids origin from any other surface.
