# SceneAxi v6: design brief (plan step 3, impeccable `shape`)

| Field | Value |
|---|---|
| Date | 2026-10-06, branch `redesign-v6` |
| Inputs | `PRODUCT.md` (product truth, binding), `DESIGN.md` (v5 record, **evidence only**), `docs/redesign-v6/BASELINE.md` (before numbers), `docs/redesign/DIRECTION.md` (v5 direction, **anti-reference**; its §0 test pins stay binding), `.empryo/plans/plan.md`, impeccable `shape.md`, `new-work.md`, `craft-floor.md` |
| Situation | **Replace the visual world** (new-work §1, "Redesign"). Product truth, content, function, contracts and copy are kept. The v5 look shows what the subject is. It has no say over what v6 becomes. |
| Interview | No discovery round was held. The council consensus and the user's choice to replace the world were the answers. Inferences are marked **[assumed]**. The conductor confirms them with the user at G1. |
| Concept roll | `impeccable concept-seed --scope direction --mode persuade`, key **`9c6b504b`**, assigned index 4 (§9) |

---

## 1. Job, audience, mechanism

**Unique mechanism (one sentence).** Every change to a SceneAxi scene, whether a human or an agent makes it, from any face (CLI, web shell, desktop, web editor), is a *proposal*. You inspect it as an exact before/after with digests. Then you apply it or it is refused by name. Nothing is written unseen.

**What v6 must prove.** The product is the act of reviewing a change. The first viewport of the umbrella, the asset page of a store, the inspector and the desktop changes dock all show the same choreography: **propose → inspect the difference → commit**. Each one has a legible before/after, the consequence, and how to recover.

**The rut (kept off every concept list).**
- What this category always ships is v5 itself: near-black dev-tool panels, one neon or signal accent, a mono label over every heading, and a hero canvas in a rounded frame.
- The predictable opposite is a warm cream editorial page with a serif display and terracotta accent. That is equally a default.
- The literal reading of "Change Review" is a git diff with red and green lines. It gets at most one candidate (§9) and is not dealt.

### Personas (from `PRODUCT.md` §Users)

| Persona | Scene (who, where, what light) | Arrives at | Needs in seconds |
|---|---|---|---|
| **Evaluating creator** (game/web dev comparing with Unity, Godot, Three.js) | At a desk in the evening, one tab among many, deciding whether to download | umbrella `/`, `/engine`, `/profiles`, `/pricing` | what SceneAxi is, how it differs (reviewable source, deterministic evidence, versioned profiles), Download |
| **Reviewing creator** (accepts their own or an agent's edits) | A long, focused session in a dim room. Eyes on the viewport, changes at the edge | web shell inspector, desktop changes dock, umbrella `/editor` | exactly what will change, the before/after digests, Accept/Reject, and the reason when refused |
| **Authoring agent** (primary persona in the spec) | Headless. It reads the same protocol through the CLI | No visual surface. It is the reason the human surfaces must never imply a capability the protocol lacks | — |
| **Asset buyer / seller** | During a build session, judging an asset's fit and provenance | Forge (`catalog-game`), Vitrine (`catalog-web`) | what the asset is, its digest/provenance, its price in credits, and why purchase refuses (dormant, TEST fixtures) |
| **Signed-in customer** | Doing account work in daylight or evening | `/login`, `/account`, `/pricing` checkout | the balance, the purchase history, and every named state (refused, cancelled, return-not-proof) |
| **Operator** | Reading the ledger | `/admin/ledger` | append-only figures, right-aligned, tabular |
| **Child with a grown-up nearby** | Tablet or laptop at a table | `sites/kids` | pick a world → add pieces → Play, with no reading burden. The grown-up can check the privacy boundary ("For grown-ups") |

---

## 2. Surface → mode map

**Dialect** is the family dialect the council fixed: Persuade (editorial), Operate (compact precision, comfortable/compact density), Kids (separate interaction scale). **Visitor mode** is impeccable's register (Persuade / Operate / Read / Experience). It governs what expression may do on that surface.

### Umbrella (`sites/umbrella/src/app`)

| Route / state | Visitor mode | Dialect | Density | Note |
|---|---|---|---|---|
| `/` overview | Persuade | Persuade | — | The signature hero shows propose → diff → commit. Download is the primary action (test-pinned). The proof gallery has 3 real captures |
| `/engine` | Persuade | Persuade | — | SDK archive + SHA-256, pipeline, platform availability, wide ProofFigure. Evidence tables must be keyboard-focusable (baseline axe serious ×8) |
| `/profiles` | Persuade | Persuade | — | Game/Web side by side. Kids is an *Isolated* named state with **no link** |
| `/pricing` | Persuade, then Operate below the packs | Persuade + Operate panels | comfortable | live checkout, disabled purchase, `?checkout=cancelled`, `?reason=`, empty packs. Capability table needs a focusable scroller |
| `/open` | Experience | Persuade | — | The live WebGL canvas of a committed Sculpt Artifact plus the core readout. The canvas leads |
| `/docs`, `/docs/getting-started`, `/docs/cli`, `/docs/credits-and-pricing`, `/docs/faq`, `docs/loading` | Read | Persuade (reading measure) | — | rail wayfinding, 65–75ch, code wells, undecided policy marked as undecided |
| `/login` (form, signed-in, `?reason=`) | Operate | Operate | comfortable | identity is live in production. Visual change only |
| `/account` (signed-out, signed-in, admin, history, editor access, `?checkout=success`) | Operate | Operate | comfortable | `?checkout=success` is *pending*, never *verified* |
| `/editor` (refused states, entitled shell, `editor/loading`) | Operate | Operate | compact | archive metrics are pinned. Change Review dock (Accept all / Reject all). Kids refusal is the whole body |
| `/admin/ledger` | Operate | Operate | compact | evidence table, append-only |
| 404, `error.tsx` | Operate | Operate | comfortable | one way forward, no retry the contracts don't define |

### Storefronts (`sites/catalog-game` = SceneAxi Forge, `sites/catalog-web` = SceneAxi Vitrine; one structure, store token block only)

| Route / state | Visitor mode | Dialect | Density | Note |
|---|---|---|---|---|
| `/` store home (incl. `?q=` empty, `?sort=random` refused) | Persuade | Persuade | — | "Game-ready sculpt artifacts, curated for the Game profile." / "Interactive scenes for web pages, curated for the Web Experience profile." The TEST notice sits inside the first viewport |
| `/item/[itemId]` | Persuade → Operate | Persuade page, Operate acquire block | **comfortable** | discover → inspect → acquire. The digest figure leads. Refusal panels sit where the buy button would be, at comfortable density. The v5 defect was compact density here |
| `/publish` | Persuade | Persuade | — | worked earnings example, ordered requirements, production-closed refusal |
| 404, `error.tsx`, `loading.tsx`, `global-error.tsx` | Operate | Operate | comfortable | `global-error` cannot import anything (inline `<style>` literals) |

### Kids (`sites/kids/src/app`)

| Route / state | Visitor mode | Dialect | Note |
|---|---|---|---|
| `/` studio: intro, world picked, pieces placed, pieces full, refused extra piece, play mode, grown-ups open | Experience | **Kids** | own interaction scale: targets ≥44px, aim 56. Calm motion that stops under reduced motion. Same family core. Never linked, named or themed from any other surface |
| `loading.tsx`, `global-error.tsx` | Operate | Kids | no import, no account words (pinned) |

### Web shell (`apps/web-shell/src`)

| Panel | Visitor mode | Dialect | Density | Note |
|---|---|---|---|---|
| Inspector (`inspector-app.ts`): idle, proposed/reviewing, accepted, rejected, refused (bad pointer, bad JSON, missing doc), busy, uncertain/recover | Operate | Operate | compact | **the Change Review flagship.** It keeps every DOM id (`#edit`, `#documentPath`, `#jsonPointer`, `#newValue`, `#propose`, `#accept`, `#reject`, `#recover`, `#reconcile`, `#review-help`, `#phase`, `#note`, `#diff`) and its CSP hashes. It follows the system light/dark theme (`Canvas`/`CanvasText` pinned) |
| Assistant panel, account panel (`assistant-panel.ts`, `account-panel.ts`) | Operate | Operate | compact | **These files render no markup** (0 elements/classes found). Their visible output appears through the inspector. See open issues |

### Engine Desktop (`apps/desktop-shell/src` chrome + `desktop/linux`)

| Region | Visitor mode | Dialect | Density | Note |
|---|---|---|---|---|
| Title bar + menus, mode rail (build, sculpt, animate, run, ship; compose and plugins inert), scene tree, view tabs, viewport (inert/live/refused), inspector, bottom dock (changes, assets, console, evidence, timeline per mode), assistant (ask/build/agent, BYOK/hosted, denied/Kids lock, thinking), command palette, outcome dialog, profile switch, settings command forms, status bar, compact-tier drawers, window-below-minimum refusal | Operate | Operate (desktop) | comfortable + compact (`DENSITY` pinned) | the desktop never scales (pinned). `opacity:` only inside keyframes. It does not import site-kit, so its tokens are a recorded copy |
| Packaged Linux window (`desktop/linux/src/electron/main.ts` `backgroundColor` `#111113` at :1114; renderer BYOK, overlay report) | Operate | Operate (desktop) | — | window colors only, no behaviour change. Proof is a packaged build launch |

---

## 3. Core tasks (each is a keyboard-only release flow)

1. **Discover → inspect → acquire** (umbrella and stores). Land on `/` or a store home. Understand the offer within one viewport. Open an item or `/engine`. Inspect the digest/checksum and provenance. Act: Download (umbrella) or the acquire block (store). In a store this *refuses by name* on TEST fixtures. **Success:** the primary action is visible on the first viewport at 390 and 1440. The refusal reason reads as calmly and legibly as success would, at comfortable density, beside the price.
2. **Edit → Change Review → apply/refuse** (web shell, desktop changes dock, umbrella `/editor`). Propose a value at a JSON Pointer. The review shows the pointer with an untruncated leaf, the old value (stale, ruled through), the new value, the before/after digests, the consequence (what will be written, where) and the recovery (Reject, or reconcile when stale). Accept writes. Reject discards. A stale or partial decision refuses by name (`CHANGE_REVIEW_PARTIAL_ACCEPT_UNSUPPORTED`). **Success:** a person can state what will change and how to undo it without reading the code. Pending, verified and refused each carry a **text label and an icon**, never color alone.
3. **Kids create → save.** Pick a world, add pieces (up to the limit), Undo last, Reset, Play my world. **Note:** the product does not persist anything. "For grown-ups" says it does "not … save a project". In Kids, "save" means *keeping your world on screen and playing it*. No save affordance may be invented. **Success:** a pre-reader can finish the loop by picture and position. Refusals (pieces full) are kind and plain. Every target is ≥44px.

---

## 4. Constraints (binding; a builder must not invent around them)

- **Behaviour is frozen.** Routes, data hooks, DOM ids, `data-*`/`data-action` hooks, ARIA, control ids, form actions, query keys and pinned copy are unchanged. Identity, credits and billing are live in production, so visual work never touches auth, checkout, webhook or ledger logic.
- **Test pins in `docs/redesign/DIRECTION.md` §0 stay executable.** They include umbrella overview geometry and the ≤9 font sizes on `/`, the D-4 motion values, the contrast selector class list, the client-component list, the store byte-identical tail below `STORE IDENTITY`, the Kids token set and reducer parity, web-shell strings, and desktop no-scale/no-opacity-outside-keyframes. A v6 decision that breaks one updates only the assertion it breaks (no new test files). The lane names the change in its report.
- **Color laws are product rules** (`PRODUCT.md` §Capabilities). Pending, verified, refused and stale each mean exactly one thing. A diff's old value is never red. A concept may re-choose the hues, but it may not re-assign the meanings. Mint never sits on a button.
- **Isolation.** Kids imports no SceneAxi package. `sites/kids/src/lib/**` is never touched. Desktop does not import `@sceneaxi/site-kit`. Only the umbrella may reach engine-presentation and identity.
- **Evidence only.** No customer logos, testimonials, user counts, benchmarks, performance or availability claims, "production-ready" claims, or prices beyond the credit-pack data. Demonstration data in concepts is labelled synthetic. Real copy comes from the repo, for example the hero "Build scenes. Keep the source.", `RELEASE_MARKER`, the store taglines, "Make a tiny world" / "Play my world" / "For grown-ups", the fixtures `harbour-diorama`, `lantern-prop`, `market-stall-kit`, `odd-price-charm`, and the web-shell refusal "JSON Pointer path not found".
- **Brand commitments that v6 overrides need a recorded user ruling.** `PRODUCT.md` §Brand Commitments still binds Foundations v2 and Cinematic Pro as captain-accepted authorities. It fixes surface accents as signal orange (umbrella), red/teal (stores), violet (Kids) and cyan (desktop). Replacing the world overrides those. G1/G2 must record the deviation in `RULINGS.md`, and A5 updates `PRODUCT.md` at foundation. Until then the concepts may treat the accents as open, but store identity stays one token block and Kids keeps a hue of its own.
- **Lanes never edit site-kit or token files.** Token needs go to A5.
- **Web shell** stays CSP-safe: no inline handlers, no external URLs, and inline style is hashed by `dev-server.ts`.
- **Live 3D** appears only if it *demonstrates* propose → diff → commit, holds 60fps, and passes LCP < 2.5s on mobile. A static, art-directed fallback is mandatory and is what reduced motion and JS-off render.

---

## 5. Anti-references (what would make a polished result feel wrong)

1. **v5 signal-orange bench** (`#FF6B2C` on `#07080A`, Archivo + JetBrains Mono). Its problems: near-black tonal ladder, one hot accent, a mono uppercase label over everything, 9px cards, and the "Review Bench" metaphor rendered as generic dark dev-tool. Its failure modes are on record. The global `a:hover { color: var(--accent-hi) }` (`packages/site-kit/src/design-tokens.ts` ~:615) overrode button ink to **1.20:1**. Every site had to out-specify it, which piled up overrides (umbrella `globals.css:298`, `:774-779`). The 11px floor text and 19 sub-24px targets on one page also come from v5.
2. **Cinematic Pro cyan** (`#46D8EC` on graphite-blue `#0A0F1A`). The desktop "life signal": glow-adjacent cyan on blue-black, soft 10–16px radii, with the packaged build still rendering it. It is the "near-black + one neon accent" rut in its purest form.
3. **Template tells (`craft-floor.md` Refuse list).**
   - Page scaffolds: same-size icon+heading+text cards as page structure, or nested cards. The hero-metric template. **Any kicker/eyebrow above a heading (banned outright).** Section numbers that carry no information. A modal where none is needed.
   - Surface habits: gradient text. Decorative glass or blur (v5's masthead blur was one). Colored side rails over 1px (test-pinned DV-X1 rails excepted until lifted). Hard offset shadows. Sparklines, rings and rounded rectangles standing in for content. Mono as a "technical" costume. A system face as display voice. Emoji or Unicode as an icon system (the Change Review ✕/✓ text glyphs are pinned by ruling R-4 and keep an accessible label). Geometric masks faking organic edges. Light or dark picked by category.
   - Unthemed browser surfaces: selection, caret, scrollbars, focus rings, underline offset, tabular numerals.
4. **Training-data faces** (new-work §4) are not used for Persuade display without a reason no other face satisfies. These include Fraunces, Playfair, Cormorant, Lora, Crimson, Newsreader, Syne, Space Grotesk/Mono, IBM Plex, Inter-as-display, DM Sans/Serif, Outfit, Plus Jakarta, and Instrument Sans.

---

## 6. Measurable AAA+ acceptance (release gate; all measured, none asserted)

| # | Criterion | Measure / tool | Baseline (BASELINE.md) → target |
|---|---|---|---|
| A1 | Text contrast ≥4.5:1 (large ≥3:1), UI and focus indicators ≥3:1, in **default, hover, focus-visible, active, disabled** | in-browser computed eval, ink composited over the painted chain incl. pseudo-element state layers, every distinct control on every surface. **Not token math** | weakest enabled control 4.64:1 (store CTA active), Kids selected 5.01. Target: no control under 4.5:1 in any state, and the v5 1.20:1 hover class impossible by construction (no global `a:hover` ink) |
| A2 | axe-core: **0 serious, 0 critical** | axe 4.14 per route at 1280 and 375 | 10 serious (`scrollable-region-focusable`) → 0 |
| A3 | Keyboard-only completes the 3 core flows (§3) | scripted Tab/Enter/Space walk + human check | — → all three pass |
| A4 | Focus never obscured (WCAG 2.2 2.4.11), visible ring on every stop | tab walk + **by-eye confirmation** of any heuristic hit (sticky masthead + `scroll-padding`) | heuristic flagged 137/57/64 stops (untrusted) → 0 confirmed |
| A5 | Target size ≥24×24 (WCAG 2.2 2.5.8) on all sites. **Kids ≥44, aim 56** | DOM measure | umbrella up to 19 under 24px → 0 |
| A6 | Minimum text ≥12px on sites (labels included), 16px body | computed font sizes | 11px → ≥12px **[assumed raise. Umbrella pin is ≥11; A5 confirms]** |
| A7 | Forced-colors usable, 200% zoom reflow with no horizontal page scroll | emulated `forced-colors: active`, 200% zoom at 1280 | pass at baseline → keep passing on every route |
| A8 | `prefers-reduced-motion` removes non-essential motion everywhere, Kids included | emulated reduce + running-animation count | 0 → 0. Hero WebGL poses statically |
| A9 | Lighthouse per site, **mobile**: LCP < 2.5s, CLS < 0.1, INP < 200ms (TBT < 200ms as the lab proxy) | Lighthouse 12.8 mobile + desktop on **every** Persuade route, not only `/` | umbrella `/` LCP **4585ms**, TBT 2015ms. Stores LCP 2878/3058ms → all < 2500ms |
| A10 | Hero / viewport holds 60fps, or the static fallback ships | Performance trace, frame timing p95 ≤ 16.7ms on the throttled profile | unmeasured → measured |
| A11 | CSS bytes ≤ 60% of baseline `globals.css` | byte count of source sheets | umbrella ≤ **76,082 B**, game ≤ **40,508 B**, web ≤ **40,525 B**, Kids ≤ **13,056 B** |
| A12 | Store parity: `catalog-game` vs `catalog-web` differ **only in the store token block** | `diff` of the two `globals.css` + component tree | 30 differing lines → token block only |
| A13 | Named states are never color alone: pending / verified / refused / stale = label + icon (+ color) | DOM audit + grayscale screenshot | — → every instance |
| A14 | Packaged Linux Electron launches in the new chrome | fresh `pnpm --filter @sceneaxi/desktop-linux dist`, launch, screenshot 1280 + 1920 | stale Oct 1 build, cyan → fresh build, v6 |
| A15 | Zero template tells | `impeccable detect --json` = 0 on touched paths (pinned DV-X1 rails listed) + finish reviewer | — → 0 |
| A16 | Every shipped screenshot judged by a person | before/after report signed off | 470 unjudged → 0 unjudged |
| A17 | `pnpm run gate` green, compared stage by stage with the recorded baseline | gate log | — → green |

---

## 7. States and ranges every concept must carry

- **Change Review:** a short pointer (`/data/entities/0/x`), the longest realistic pointer (leaf never truncates), a scalar change (`1 → 42`), an object change, a stale proposal (refused), a partial decision (refused by name), and an empty review ("No proposal"). Both digests are always visible.
- **Refusal panel:** one-line registry reason and a long reason, mono reason code, evidence list, one forward link, no invented retry. Comfortable density inside Persuade pages, compact inside the editor.
- **Store item:** price present or absent (`credits !== null`), TEST chip, digest figure "not a render", related list of 0–n items.
- **Kids:** 0 pieces → limit reached → refused extra, three worlds, play on/off.
- **Account:** balance readable / unreadable / administrator, history empty / paged.
- **Widths:** 320, 375/390, 768, 1280, 1440, 1920. Desktop window tiers 1680 → below minimum.

---

## 8. Interaction intent (the signature, independent of world)

**Propose → inspect → commit** is one choreography in three acts, shared by hero, inspector, desktop dock and editor.
1. **Propose:** the change arrives as a *pending* object. It is visibly unwritten. Its label says so ("Pending review") and its icon is distinct from the other states.
2. **Inspect:** before and after sit side by side, or stacked under 620px, at equal legibility. The difference is the brightest thing on screen. The consequence line names the document and pointer that will be written. Recovery is named next to the actions.
3. **Commit:** Accept resolves the pending object to *verified*, with the after-digest settling. Reject or refusal resolves it to *refused/discarded* with the reason. Motion carries the state change once. Under reduced motion the end state appears instantly with the same label.

Density: Persuade uses this at display scale (hero demonstration). Operate uses it at comfortable/compact. Kids reduces it to *place → see → play* with no digests shown to the child.

---

## 9. Three orthogonal concept seeds (for A2–A4)

**Grounded list from the audience's world, ordered by resonance.** It spans 5 material families: paper documents, machines/rooms, print production, screen traditions and media production.
1. Engineering drawing revision block / change notice
2. Printer's press proof under the D50 viewing booth
3. Code review diff (the literal reading; spent here, not dealt)
4. **Railway signal box interlocking lever frame** (roll-assigned)
5. Tamper-evident evidence bag and chain-of-custody seals
6. International Typographic Style identity program
7. Film editor's flatbed and edit decision list

**Roll record (key `9c6b504b`).** Assigned: #4. Challengers were fused with the product's facts and judged on audience identification and product clarity:
- raku firing: declined
- ikebana *ma*: declined
- ANSI BBS nightboard: declined, because it rebuilds the near-black/neon rut
- collider event display: declined, same rut

Raises, each named for its donor, are written into Seed A. IMPECCABLE'S PICK = #1 (Seed B). Seed C is #2, chosen for maximum distance on light, material and color logic.

### Seed A: Interlocking (railway signal box lever frame)

**Material.** Painted cast iron, enamel lever plates and a lit track diagram. The ground is a matte slate-green diagram panel, a mid-dark field that is neither near-black nor neon. Track routes are drawn as thick white lines.

**Color logic: committed.** The only saturated objects are the levers in regulation colors, mapped onto the product laws:
- caution yellow = pending
- clear green-mint = verified
- stop red = refused
- unpainted iron = stale

Each lever carries an engraved text plate and a distinct handle shape, so color is never the only cue.

**Type.** A condensed engraved-plate grotesque for headings and plates, with sentence-case prose in a sturdy workhorse sans.

**Spatial idea.** Every surface is a frame with a diagram above it. A proposal is a route being set. Inspecting lights the before and after routes on the diagram. Committing pulls the lever from normal to reverse. A refusal is a mechanical interlock: the lever will not travel, and its plate names the conflicting lever, which is the registry's reason code. Lever numbers are real IDs, not decoration.

**Motion personality.** Two-stage detented travel (catch released, then lever thrown) with no bounce.

**Dialects.**
- Persuade: the frame at monumental scale.
- Operate: a compact desk.
- Kids: a model-railway layout with fat levers ≥56px.

**Raises.**
- From ikebana: the diagram's empty track space is left deliberately active, never filled.
- From ANSI BBS: complete keyboard operation, with the lever frame as a strict grid.
- From the collider display: the hero is one frozen event drawn as a data graphic, not a mood picture.
- From raku: each state has a still map for reduced motion.

### Seed B: Revision Block (engineering drawing change notice) · IMPECCABLE'S PICK

**Material.** A drenched Prussian-blue cyanotype sheet: the surface *is* the color. Fine white linework, a ruled border with zone coordinates A–F / 1–8 (real wayfinding: every section and pointer has a zone reference), and a title block bottom-right that holds the before/after digests as revision letters.

**Color logic: drenched.** One field of blue, with the laws as drafting marks:
- pending = a sodium-yellow revision cloud scalloped around the changed region, with a revision triangle labelled with its letter
- verified = a mint CHECKED stamp
- refused = a red REJECTED stamp with the reason written beneath
- stale = values ruled through in faded bronze, under a SUPERSEDED note

**Type.** Single-stroke technical lettering in the ISO 3098 tradition for labels, zones and the title block. A neutral workhorse sans carries prose. No mono costume: figures are tabular lettering.

**Spatial idea.** Each page is a drawing sheet. Change Review is a revision table plus a detail callout, magnified around the edited pointer.

**Motion personality.** A plotter pen that draws linework and traces the cloud scallops at a steady feed rate, with stamps landing once.

**Dialects.**
- Persuade: the full sheet.
- Operate: a dense detail view with compact zones.
- Kids: a big-pencil sketch pad with chunky blue shapes.

**Honest risk.** "Blueprint" is a familiar engineering trope, and dark-blue-plus-white flirts with the cyan anti-reference unless the blue stays deep, matte and paper-textured.

### Seed C: Press Proof (prepress sheet under D50 light)

**Material.** Bright coated proof stock under neutral D50 viewing-booth light, which forces a **light** world for Persuade. Crop marks, registration targets and a CMYK color bar frame each surface. A slug line along the sheet edge holds the job ticket (document path, pointer, before/after digests).

**Color logic: full palette.** Process cyan, magenta, yellow and key as four named roles, under contrast-safe dark ink for text:
- pending = the proposed plate printed in magenta, deliberately out of register as a visible ghost of the change
- verified = an OK-TO-PRINT mint stamp with a check icon
- refused = a HOLD / KILL red stamp with the reason
- stale = the replaced plate in faded bronze

**Type.** A heavy, wide news-grotesque at specimen scale for display, with proofreader's marks drawn in the margins as the annotation system.

**Spatial idea.** An imposition sheet. Pages, which are the product's surfaces, sit on one press sheet. Inspect means toggling separations: before plate, after plate, overprint.

**Motion personality.** Registration. On commit the ghost plate *snaps into register* and the ink lays down. On refusal it is struck through with a proof mark.

**Dialects.**
- Persuade: a full broadsheet-scale proof.
- Operate: the separations panel at compact density. The desktop moves to the dark "press room at night" variant of the same marks, because of its dim scene.
- Kids: rubber stamps and screen-print pulls in fat CMY shapes.

**Honest risk.** A white page plus heavy grotesque can slide toward the generic editorial rut unless the print-production marks carry real information.

**Orthogonality check.**

| Axis | A | B | C |
|---|---|---|---|
| Material | iron/enamel | cyanotype film | coated paper/ink |
| Light | mid-dark field | drenched blue | bright white |
| Color strategy | committed | drenched | full palette |
| Type | condensed plate | single-stroke lettering | heavy specimen grotesk |
| Space | frame + diagram | zoned sheet | imposition |
| Motion | detent throw | pen plot | register snap |

No two seeds share a value on any axis.

---

## 10. Open decisions (the builder must not invent these)

1. **Brand-commitment override** (§4): the user rules at G1/G2 whether per-surface accents survive as hues, or only as a store token + a Kids hue.
2. **Light vs dark per surface** is chosen by each concept from the scene sentence (§1). The web shell stays system light/dark (pinned) whichever is chosen.
3. **11px → 12px floor** (A6) needs A5 to confirm against the umbrella's ≤9-sizes pin.
4. **Hero technique:** live WebGL proof of the choreography, or static art. Decided at G2 with measured fps/LCP.
5. **Face licensing:** every concept names self-hostable faces and their licences. No remote font request on desktop or Kids.

## Files changed
- `docs/redesign-v6/BRIEF.md` (new). No code touched.

## Evidence paths
- Baseline numbers cited: `docs/redesign-v6/BASELINE.md` (LCP 4585ms umbrella mobile, axe 10 serious, store CTA 4.64:1 active, CSS limits 76,082 / 40,508 / 40,525 / 13,056 B).
- Concept roll: `impeccable concept-seed --scope direction --mode persuade` (key `9c6b504b`; re-read with `--from 9c6b504b`).
- Context run: `impeccable context --target docs/redesign-v6`.

## Open issues
- `apps/web-shell/src/account-panel.ts` and `assistant-panel.ts` render no markup (grep: 0 elements/classes). The plan's "modify" entries for them are likely no-ops. A9 should confirm where their visible output is styled.
- `desktop/linux/src/electron/main.ts:1114` `backgroundColor: "#111113"` must follow the new desktop canvas (A10).
- The token request from BASELINE stands for A5: delete the global `a:hover` recolour (`packages/site-kit/src/design-tokens.ts` ~:615), or scope it to `:where(a:not([class]))`.
- `PRODUCT.md` §Brand Commitments and the colour-law wording must be updated by A5 after the G2 ruling.
- BASELINE gaps carry forward: the packaged desktop frame is stale, Lighthouse covered only `/`, and catalog-game desktop Lighthouse crashed.
