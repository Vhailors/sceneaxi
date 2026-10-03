# Desktop visual loop

**Implemented; owning tests pass. Linux typecheck remains blocked by unrelated concurrent JSON-typing errors.** Production readiness is not claimed. Real root: `/home/devuser/Documents/Projects/sceneaxi`; no commit/push, dependencies, command semantics, palette, control inventory or minimum-window changes.

## Changes

- `apps/desktop-shell/src/visual-tokens.ts`: internal 4/8/12/16/24px content rhythm; archive structural metrics remain fixed.
- `apps/desktop-shell/src/chrome.ts`: clearer section/empty/assistant hierarchy, 10px wrapping identities instead of 8px microtext, neutral unselected borders and cyan selection, inset-safe focus rings, framed viewport, scroll-contained tall assistant composer. Removed redundant busy canvas/header/card/dot animation; retained one decorative three-bar signal and reduced-motion handling. Two pre-existing anti-slop typing findings repaired through generic/inferred types only.
- `desktop/linux/src/renderer/byo-configuration.ts`: larger labels/fields, equal grouped action columns, restrained card border, hover/focus feedback, readable disabled paint instead of opacity.
- `apps/desktop-shell/test/visual-refinement.test.ts`: six new visual invariants; existing inventory/golden assertions unchanged.

Cinematic Pro remains desktop authority, not Foundations orange. Shared tokens/contrast authority and all existing `finish-*.md` lane reports were read; FINAL's production BLOCKED disposition is not superseded.

## Before / after screenshots

Actual Chromium rasterization; browser tool was not exposed, so existing installed Playwright was used through shell. No new browser dependency installed. Desktop chrome emits HTML without a native/presentation runtime; these screenshots demonstrate chrome/viewport framing, **not GPU/native acceptance**.

| State / viewport | Before | After |
|---|---|---|
| Empty · 1680×1000 | [PNG](screenshots/finish-visual-desktop-before-empty.png) | [PNG](screenshots/finish-visual-desktop-after-empty.png) |
| Real seeded selection · 1680×1000 | [PNG](screenshots/finish-visual-desktop-before-selected.png) | [PNG](screenshots/finish-visual-desktop-after-selected.png) |
| BYOK unavailable · 1680×1000 | [PNG](screenshots/finish-visual-desktop-before-byok.png) | [PNG](screenshots/finish-visual-desktop-after-byok.png) |
| Regrouped hierarchy drawer · 900×640 | [PNG](screenshots/finish-visual-desktop-before-narrow.png) | [PNG](screenshots/finish-visual-desktop-after-narrow.png) |
| BYOK assistant drawer · 900×640 | [PNG](screenshots/finish-visual-desktop-before-byok-narrow.png) | [PNG](screenshots/finish-visual-desktop-after-byok-narrow.png) |
| Focused palette · 1280×900 | [PNG](screenshots/finish-visual-desktop-before-palette.png) | [PNG](screenshots/finish-visual-desktop-after-palette.png) |
| Minimum-window refusal · 375×812 | [PNG](screenshots/finish-visual-desktop-before-mobile-refusal.png) | [PNG](screenshots/finish-visual-desktop-after-mobile-refusal.png) |
| Loading visual fixture · 1680×1000 | [PNG](screenshots/finish-visual-desktop-before-busy.png) | [PNG](screenshots/finish-visual-desktop-after-busy.png) |
| Web · 1680×1000 | [PNG](screenshots/finish-visual-desktop-before-web.png) | [PNG](screenshots/finish-visual-desktop-after-web.png) |
| Kids refusal · 900×640 | [PNG](screenshots/finish-visual-desktop-before-kids.png) | [PNG](screenshots/finish-visual-desktop-after-kids.png) |

Final before set re-renders the pre-visual staged chrome stylesheet (identical to initial source read), with the same accepted model/tokens. Selection uses `seedDesktopProject` + real `createDesktopBridge` through the existing test bootstrap seam; temporary project directories are removed. BYOK uses its actual renderer with no privileged configuration port, producing its real unavailable state. Loading is explicitly labelled a visual fixture, without a provider request. Other captures use reduced motion.

**51 browser predicates pass:** zero page errors, no document horizontal overflow, unchanged control counts (178; 182 with existing runtime BYOK), actual seeded hierarchy, typography, focus and disabled-state checks. Steady busy animations decrease **10 → 3** (one three-bar group); narrow BYOK composer is contained at 375px with 162px of assistant body remaining. Existing drawers/minimum refusal regroup or refuse rather than squeezing the desktop onto mobile.

## Contrast

WCAG sRGB luminance, including actual inherited-well compositing for the old disabled state:

- Disabled BYOK Save: **3.60:1 before → 7.01:1 after** on its panel.
- Dim/inert text floor across desktop neutral surfaces: **6.16:1**; secondary text **7.94:1** on the brightest header.
- Cyan focus ring on brightest header: **9.31:1**.

Palette unchanged; 19 existing owning token tests retain archive/contrast assertions. Decorative structural lines are not claimed as text or the sole focus/selection carrier.

## Verification

- Owning suites plus four relevant goldens: **19 files / 398 tests pass, zero failures** (desktop-shell 219; Linux 28; goldens 151). Six assertions are new visual tests. Raw receipt: `finish-visual-desktop-tests.json`.
- Shell TypeScript build, touched-file ESLint, touched-file Oxlint/anti-slop (four files, zero errors/warnings), renderer browser-graph check (94 inputs), owned diff whitespace check: pass. No new type assertions or lint exemptions.
- **Linux typecheck exits 2**, latest output: `desktop/linux/src/lib/desktop-scene.ts(297,57): TS2345 unknown → JsonValue`; `packages/engine-orchestrator/src/open-path.ts(449,35)/(465,34): TS2345 unknown → JsonValue | SculptArtifact/ComposedScene`. These concurrently edited nonvisual files were reported to owners, not changed outside scope. Earlier transient bridge/gameplay/viewport errors are retained in JSON history.
- First new-test run: 397 pass / one failure because a CSS helper selected a grouped palette rule instead of the subsequent focus-only rule; corrected test selector, then 398 pass without weakened production assertions. Missing default Playwright executable and capture-harness setup failures were recovered and recorded.

No complete repository gate, native package rebuild, live-provider call or manual image-viewer review is claimed. Dedicated project test tool found no command; actual owning pnpm suites were run. JSON includes the complete capture harness, commands, metrics, source/image hashes and explicit limitations.
