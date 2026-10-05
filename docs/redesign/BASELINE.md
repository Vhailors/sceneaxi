# SceneAxi redesign — baseline critique and audit (2026-10-04)

⚠️ DEGRADED: single-context (no sub-agent tool in this session, and the director could not view
raster screenshots). Assessment A (design review) was done from source and from rendered-DOM
measurements before the detector output was read; Assessment B is the bundled detector plus a
Playwright DOM probe of every route. Treat the scores as a calibrated reading, not a jury verdict.
Critique snapshots were not persisted to `.impeccable/critique/`; this file is the record.

## Evidence

- Screenshots: `/home/devuser/Documents/Reports/sceneaxi-redesign/before/<surface>/<route>-<width>.png`
  (sites 390/768/1440 full-page; desktop 1280/1920; web-shell idle/reviewing/rejected/refused/focus,
  dark plus light at 1440; packaged Electron window under xvfb).
- Per-shot metrics (HTTP status, horizontal overflow, document height, sub-44px targets,
  transition/animation counts, console errors): `before/<surface>/metrics.json`.
- DOM probe (headings, eyebrows, contrast failures, side stripes, radius, ghost cards, backdrop
  filters, repeated sibling grids, state-rule counts): run from `/tmp/sxr/inspect.mjs`, summarised
  below.
- Detector: `node /home/devuser/.agents/skills/impeccable/scripts/detector/detect-antipatterns.mjs --json <dir>`.

## Detector baseline (exit 2 = findings)

| Target | Findings |
|---|---|
| `sites/umbrella/src/app` | 2 × side-tab: `globals.css:1354` (`.state` 2px left rail), `globals.css:1952` (`.rule-card` 2px accent rail) |
| `sites/catalog-web/src/app` | 2 × side-tab (`globals.css:1304` 3px, `:1801` 3px accent), 1 × codex-grid-background (`:911`) |
| `sites/catalog-game/src/app` | same three, byte-identical below the identity block |
| `sites/kids/src/app` | 1 × overused-font (`globals.css:16`, `Inter` named first and never loaded) |
| `apps/web-shell/src` | 1 × side-tab (`inspector-app.ts:819`, `pre[aria-busy="true"] { border-inline-start-width: 3px; }`), **pinned by `apps/web-shell/test/visual-postpr.test.ts:32`** |
| `apps/desktop-shell/src` | 1 × side-tab (`chrome.ts:1305`, `.scene-entity-identity` 2px left), **pinned by `apps/desktop-shell/test/visual-refinement.test.ts:45`** |
| `desktop/linux/src/renderer`, `chrome-document.ts`, `byo-configuration-view.ts`, `packages/site-kit/src` | 0 |

The detector does not read CSS inside TS template strings beyond what it found; the desktop chrome
also carries test-pinned 2px left rails on `.assistant-result`, `.overlay-refused .overlay-body` and
`.desktop-byo-config-message` (visual-refinement.test.ts:100–116).

## Cross-surface verdict (design specificity)

The incumbent world is specific and earned: the colour laws, the Change Review sub-rules, named
refusals with registry codes, digests in mono, and the honest "no shipping claim" copy could not be
lifted onto an unrelated product. What is generic is the *scaffolding* around that core: eyebrow
labels above most headings, identical card grids for anything with three or four items, sticky
glass masthead, decorative side rails on state panels, and a near-total absence of motion, so state
changes happen without any acknowledgement. The redesign keeps the world and replaces the
scaffolding.

## Umbrella (`sites/umbrella`) — Persuade (/, /engine, /pricing, /profiles, /open), Read (/docs*), Operate (/login, /account, /editor, /admin/ledger, 404, error)

Nielsen (0–4): status 3 · real-world match 2 · control 3 · consistency 2 · error prevention 3 ·
recognition 3 · flexibility 2 · aesthetic/minimal 2 · error recovery 3 · help 3 → **26/40**.

Audit (0–4): accessibility 3 · performance 3 · responsive 3 · theming 4 · integrity 2 → **15/20 (Good)**.

Measured: no horizontal overflow at any width; 0 contrast failures (site-kit measured roles hold);
text floor is **9px** (footer column headings `.footer-col h2`, mono 9px uppercase); 18–26 of
21–34 interactive elements per route are under 44px (nav links, footer links, inline links);
3 `:focus-visible`, 26 `:hover`, 4 `:active`, 9 disabled rules; 1 keyframe (`sa-pulse`); 2–4
elements with any transition; reduced motion is a blanket `0.001ms` kill.

Priority issues
- **[P1] Hierarchy drift.** Route H1 52px and section H2 40px on interior pages, 66/40 on home,
  20–22px H2 in docs, 9px H2 in the footer: five heading sizes, none of them Foundations steps
  except 66. Fix with the role scale in DIRECTION §3. *typeset*
- **[P1] Eyebrow scaffolding.** `.eyebrow` above headings on 11 files (6 on `/engine`, 5 in the
  editor). Banned outright; state words move into status chips or the heading. *distill*
- **[P1] Identical card grids.** `.note-card ×4` (/pricing, /account), `.panel ×4` (/open, /docs),
  `.faq-item ×6`. Equal boxes for unequal content; nothing leads. *layout*
- **[P2] Ghost elevation.** `.button` (1px border + inset highlight + drop shadow), `.viewport`
  (1px strong line + `0 30px 70px` shadow), `.tier` (12px radius, off-scale). Violates the
  Float-Only Rule and the ghost-card ban. *polish*
- **[P2] Off-scale spacing and type.** gaps 9/11/34px, padding 5/11/18/20px, font 12.5px.
  *layout*
- **[P2] No motion system.** Hover/press acknowledge nothing; the state panel, credit balance and
  live viewport change state silently. *animate*
- **[P3] Glass masthead.** `backdrop-filter: blur(18px)` over an 82% wash on a sticky header.
  Decorative; replaced by an opaque bench. *quieter*

Personas: **Jordan (first-timer)** meets "Sculpt Artifact", "Minimum E2", "profile conformance"
on the first two screens with no inline definition; **Alex (power user)** has no docs search and
the docs rail duplicates the four-card grid on `/docs`; **Sam (accessibility)** gets a correct
focus ring and skip link, but 9px labels and sub-44px footer targets on phones.

## Storefronts (`sites/catalog-web` "SceneAxi Vitrine", `sites/catalog-game` "SceneAxi Forge") — Persuade (/, publish), Operate (item, 404)

Nielsen: status 3 · match 3 · control 3 · consistency 3 · prevention 3 · recognition 3 ·
flexibility 2 · aesthetic 2 · recovery 3 · help 3 → **28/40**.
Audit: a11y 3 · perf 3 · responsive 3 · theming 3 (local `--hero-wash`, `--media-wash` gradients
and three literal accent derivations) · integrity 2 → **14/20**.

Measured: no overflow; 0 contrast failures; filter facet headings are **H2 at 11px/700** (a label
dressed as a heading); item pages carry 8px aria-hidden marks (allowed, Q-03); 7–8 of 9–19
targets under 44px; one keyframe (`sa-rise`, 200ms ease-out) on the listing tiles; hover moves
tiles with a 120ms transform.

Priority issues
- **[P1] Side rails** at `globals.css:1304` and `:1801` (3px left borders). *polish*
- **[P1] Grid-line background** at `globals.css:911` (two-axis gradient grid behind media with no
  measuring tool under it). *quieter*
- **[P2] Facet headings as 11px H2.** Six H2s that read as labels; the outline lies to screen
  readers about weight. Make them `legend`/label-styled H3 or keep H2 at label size but group under
  one visible "Filter" heading. *typeset*
- **[P2] Identical tiles** (`UL.cards ×3` on Forge) with no lead item. *layout*
- **[P2] Thin feedback.** Apply filters, editor link unavailable, TEST purchase unavailable all
  change nothing visibly when pressed. *animate*

Persona: **Riley (buyer)** meets the "TEST catalog · purchases refuse here" state panel only
after the inventory (`sites/catalog-web/src/app/page.tsx:201`); the first viewport sells before it
discloses. Item pages put the inert-commerce refusal where the cart button would be, which is the
pattern to repeat.

## Kids (`sites/kids`) — Experience/Operate

Nielsen: status 3 · match 4 · control 3 · consistency 3 · prevention 4 · recognition 4 ·
flexibility n/a · aesthetic 3 · recovery 3 · help 3 → **30/36**.
Audit: a11y 4 (54–98px targets, 3px focus ring, 4.5:1 measured) · perf 3 · responsive 3 (1440
leaves the stage small in a wide field) · theming 3 · integrity 3 → **16/20**.

Priority issues
- **[P2] Unsourced face.** `Inter` named first, never loaded; renders whatever the OS has. *typeset*
- **[P3] Play-mode loop easing.** `play-float` runs `infinite alternate` with ease-in-out, but only
  under `.is-playing` (it is content motion during Play, not an idle loop); placement feedback is a
  single 160ms `piece-arrive`. Nothing else acknowledges a choice. *animate*
- **[P2] Emoji as the icon system.** Choice glyphs are emoji, so they render differently per OS.
  They come from the curated activity data (`src/lib/kids-activity.ts`, frozen by parity test), so
  this is recorded, not assigned. *delight*
- **[P3] Wide-screen stage.** At 1440 the activity sits in a narrow column with dead space. *adapt*

## Web shell inspector (`apps/web-shell`) — Operate

Nielsen: status 3 · match 3 · control 3 · consistency 2 · prevention 4 · recognition 3 ·
flexibility 2 · aesthetic 2 · recovery 3 · help 3 → **28/40**.
Audit: a11y 4 (system colours, forced-colors, aria-live note, focus ring) · perf 4 · responsive 3
(39px buttons) · theming 3 (system colours by contract) · integrity 3 → **17/20**.

Priority issues
- **[P2] Everything is mono.** Labels, help and footer prose all in `ui-monospace`; the machine
  voice no longer distinguishes the machine's output (diff, digest, pointer). *typeset*
- **[P2] Flat hierarchy.** H1 17.6px; phase is a bold word in a sentence; the diff well is the
  most important element and the least distinguished. *layout*
- **[P2] No acknowledgement motion.** Propose → reviewing swaps the diff text instantly; Accept
  and Reject give no press feedback beyond an inset ring. *animate*
- Only `inspector-app.ts` renders markup. `account-panel.ts`, `assistant-panel.ts` and
  `open-path-view.ts` are view models with no HTML (README: "renders no markup"); there is no
  visual surface to capture or redesign for them.

## Engine Desktop chrome (`apps/desktop-shell`, packaged by `desktop/linux`) — Operate

Nielsen: status 3 · match 3 · control 3 · consistency 3 · prevention 4 · recognition 3 ·
flexibility 4 (palette, accelerators) · aesthetic 3 · recovery 3 · help 3 → **32/40**.
Audit: a11y 3 (contrast measured and raised; **8px minimum text**) · perf 3 · responsive 4
(four window tiers, honest refusal below minimum) · theming 4 · integrity 3 → **17/20**.

Measured: 13px body; 15 `:focus-visible`, 14 `:hover`, 2 `:active` rules; ~154 elements with a
transition (`background-color, border-color, color .14s ease`); keyframes `rise`, `sweep`,
`assistant-bars`; no `opacity` outside keyframes (gate-enforced).

Priority issues
- **[P1] 18px panel radius** (`--r-panel`) on `.profile-refusal-card` and panels: over the 16px card ceiling. *polish*
- **[P1] Ghost floats.** `.overlay-card` and undocked drawers pair a 1px line with a 60px blur
  shadow. *polish*
- **[P2] Text below 11px.** 8–10px micro labels. *typeset*
- **[P2] Colour transitions.** Hover animates `background-color`/`border-color`/`color` with
  plain `ease`; the motion contract allows transform/opacity/clip-path/filter only, with
  ease-out curves. *animate*
- **[P2] Mode change, dock tab change, palette open, drawer open** have no spatial continuity
  beyond the `rise` keyframe. *animate*

## Packaged Linux window (`desktop/linux` renderer)

Captured the real Electron window under xvfb at 1280×800 and 1920×1080 in its first-run state (no
project chosen). The viewport shows the inert note and the named refusal "Live viewport refused:
the persisted input-action map was refused." The BYOK configuration surface is **not installed**
in that state (mount refuses before `installDesktopByoConfigurationSurface` runs), so its BEFORE
shot does not exist; opening a project through the project browser was out of scope for a
read-only baseline. **[Request, behaviour owner]** the first-run refusal names the input-action map
when the actual cause is that no project is open (`projectRequired`); that is copy/behaviour, not
visual, and is recorded here only.
