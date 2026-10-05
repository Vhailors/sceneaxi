# Review: DIRECTION v6.2 (v5 port onto origin/main dffefbab)

Reviewer: independent direction reviewer (third pass, after the v6.1 FAIL), 2026-10-05. I ran every check below myself with cwd R. I edited nothing in R or OLD except this file. My one scratch file in `/home/devuser/.cache` has been removed. I started no server and opened no browser tab, because this review needs no new capture. I checked the BEFORE shots by listing, PNG header widths and md5. I did not view each image.

## Checks run

- **v5 text kept.**
  - `diff` of v5 §1–§6 (lines 94–372) against v6 §1–§6 (164–442): identical.
  - The v5 §8 table (547–584) against v6 (594–631) differs in one line only: the trailing `---` became the DV-D5 rendered-count note.
  - The DV id sets match: every v5 row is present, and v6 only adds DV-P1..P12 (§8.1) and DV-W2/W3/K5/L1 (§8.2).
  - RULINGS R-1..R-8 are byte-identical to the v5 copy, and R-9 is appended.
- **Previous blocking fixes.**
  - Fix 1: DV-P7 is now "port (no change)". The Port overlay bullet (:160) and the §7.6 loop bullet (:564) match it.
  - I read `reconcilePrivateChromeStyles` (`chrome/core/styles.ts:342-447`). The busy rules at :400-403 and :409-417 are replaced with still versions, and :434-438 deletes the five keyframes. `visual-refinement.test.ts:66-68` pins the result.
  - In R's rendered `_render/{default,assistant-thinking,sculpt-running,kids,palette}-1920.html` I counted:
    - 0 each of `animation:assistant-breathe|spin|glow|dot|card`, `@keyframes assistant-card`, `rise .28s` and the busy `.viewport::after`;
    - `rise .16s` ×3 and `rise .3s` ×1;
    - `animation:assistant-bars` ×1 and `animation:sweep` ×1.
  - Fix 2: the desktop Port notes (:830-833) name the pass and its selectors, and map v5 hunks to the `refined` string. They also cover the lockstep `previous` rule. §7.6 Accept (:579) requires the lane to report its counts.
  - Fix 3: the 53 desktop PNGs, md5 scan. Only these sets are still identical:
    - `compose-1920` = `default-1920`;
    - `assistant-closed-1280` = `compose-1280` = `default-1280`;
    - `session-running-*` = `dock-changes-*`.
  - Each of those has a reason in `E/before/NOTES.md` (v6.2 section). The re-captured `dock-timeline-*`, `assistant-{ask,agent,thinking,hosted}-*` and `assistant-open-drawer-1280x800` are all distinct images, and `audit-v6_2.json` holds their state facts.
- **Ownership.** `git ls-files sites/*/src/app apps/web-shell/src apps/desktop-shell/src desktop/linux/src/renderer packages/site-kit/src` returns 210 files. I applied the §9 rules first-match with my own awk script. Every file got exactly one owner:
  - foundation: 7 edit + 1 exports-only;
  - umbrella: 33 edit, 17 read-only;
  - catalogs: 36 edit, 6 read-only;
  - kids: 6;
  - webshell: 1 edit, 7 read-only, 2 frozen;
  - desktop: 31 + 5 edit, 17 + 14 read-only;
  - frozen: 27 site-kit modules.

  `chrome/**` has 28 tracked files, as rule 13 now says. Every file that §9 names exists. Adding the out-of-root files gives the §9 lane totals (39/31 desktop, 36/17 umbrella, 37/6 catalogs).
- **Pins checked against the test files (20+).** I picked these independently of the last review. All are present as stated, except the misreading in fix 1.
  - `umbrella-visual.test.ts`: :504-565 (skip link, `main p a,`, `scroll-margin-top`), :604-650 (`localMetrics`), :672-700 (no `rgba|hsla|color-mix` in TS), the D-4 block :386-453 (DV-P2 :424-436, DV-P3 :438-452, reduce blocks stripped at :391), and :1011-1030.
  - `umbrella-launch-marketing.test.ts:154-168`.
  - `first-release.visual.spec.ts`: :139-167, :312-346, :348-396 (≤9 sizes, ≥11px, 1.4 ratio) and :398-420 (only opacity and `linear-gradient` asserted; the grid is named only in the comment).
  - `design-tokens.test.ts`: :102, :205-215, :247-255.
  - `catalog-storefronts.test.ts`: :38-40, :347-351, :571-572, :641-677.
  - `rendered-route-states.test.mjs`: :15-26, :36, :43-45, :54-63.
  - `kids-surface.test.ts`: :271-312.
  - `production-activity.spec.ts`: :23, :75-79.
  - `chrome.test.ts`: :129, :343-347, :366-367, :452, :464-465, :505, :550.
  - `chrome-frame.test.ts`: :35-36.
  - `keyboard-geometry.test.ts`: :28-33.
  - `icons.test.ts`: :66.
  - `visual-tokens.test.ts`: :176-192 and :327-336.
  - `visual-refinement.test.ts`: :32-118.
  - `inspector-accessibility.test.ts`: :270-283.
  - `maintenance-compat.test.ts`: :204-214 and :221-244.
- **Main code facts.**
  - `model/frame.ts:84` and `model/core.ts:522` (compose and plugins normalise to build).
  - `dockTabsFor` → `packages/schemas/src/editor-shell.ts:136-178` (timeline only in animate, :157).
  - `chrome/assistant/styles.ts:34` (`rise .28s`) and :39-40 (routes `display:none` unless details are open).
  - The six `animation:rise` declarations sit at the lines §7.6 names.
  - `globals.css:1157-1164` (28px grid).
- **Coverage (d).** I listed every page, loading, error, not-found, global-error and layout file under the three sites' `src/app`. Each one has a §7.2, §7.3 or §7.4 brief. The web-shell modules in rule 11 render no markup: grep for tags, `innerHTML` and `createElement` finds 0 in each.
- **Port data (e).** I parsed `E/port/threeway.txt`. Every file with a non-zero v5 lane delta appears in the Port notes. The store `_components` appear through the brace list at :809.
- **E/before (f).** 326 PNGs: umbrella 74, catalog-web 27, catalog-game 27, kids 33, web-shell 47, desktop 53, linux 4, live 61. Every PNG's header width matches its filename. Each recorded miss has a reason in NOTES: web-shell uncertain-light-1440, the desktop outcome dialog, the signed-in identity states, and "No credit packs".
- **Gate baseline.** `E/backup/gate-baseline.log` (578,043 bytes) has stage lines matching §10.4:
  - exit 0: syntax, contracts, build;
  - exit 1: boundaries, traceability, sites, desktop, publish-ready, test, lint.

  Lint fails with `✖ 33 problems`, and the run ends `gate-script exit=1`.
- **Detector and locks.** `detect-antipatterns.mjs --json` on `DIRECTION.md`, `DESIGN.md`, `PRODUCT.md` and `RULINGS.md` returns `[]`. `git diff --quiet` passes on both lockfiles.
- **Skill.** I ran `context.mjs --target sites/umbrella`; as §0 notes, it resolves no PRODUCT/DESIGN. I read `critique.md`, `animate.md` and R's `PRODUCT.md`. The skill ships no `product.md` or `brand.md`.

## Criteria

- (a) **PASS.** §1–§6, the v5 §8 table and every DV row are intact. Each remaining port row is forced by a main test or code, or by R-9's doc-only clause:
  - DV-P1 and P5: token pins;
  - DV-P2 and P3: the umbrella D-4 pin, carried to the stores by v5 §5 "One vocabulary across surfaces";
  - DV-P4 and P12: doc-only D-4 and D-6 under R-9;
  - DV-P7: main's refinement pass plus `visual-refinement.test.ts:66-67`;
  - DV-P8 and P9: Playwright pins;
  - DV-P10: the ban holds;
  - DV-P11: follows P2 and P3.

  DV-P6 is withdrawn.
- (b) **PASS.**
- (c) **PASS.** The pins come from main's tests. One "What it forces" cell misreads its test (fix 1).
- (d) **PASS.** Two gaps are listed as fixes 3 and 4.
- (e) **PASS.** The DigestFigure mapping is thin (fix 3).
- (f) **PASS.**
- (g) **PASS.** No ban is prescribed. The motion text is v5 verbatim plus the Port overlay. R-1/R-2 still cover only `assistant-bars` and `sweep`, and the site curve exception is tied to the umbrella pin through R-9.

## Fixes

1. **(advisory)** §0.3 and the §7.3 error-boundary row misread one pin.
   - `public-reference` is not a class. It is the digest value the harness passes in (`rendered-route-states.test.mjs:43`, `digest: 'public-reference'`; asserted at :45). Main's `error.tsx:16-18` renders `Reference <code>{error.digest}</code>`.
   - Rewrite the cell to say that the digest renders verbatim (no truncation or reformatting), with `href="/"`, and never the message.
   - Drop "keeps the `public-reference` class" and "the `public-reference` element".
2. **(advisory)** §0.3 maintenance-compat row: name the exact-class pins at `maintenance-compat.test.ts:227-244`:
   - `toBe("plate plate-detail")` and `toBe("plate plate-lead")` on the DigestFigure root;
   - `chip chip-ok`;
   - `tile lead`.

   A lane must add no class to those elements. "Restyle through classes" alone invites it.
3. **(advisory)** Port notes, storefronts: main renamed the DigestFigure from `sigil` to `plate` (`digest-figure.tsx:44-66`), so v5's `sigil-grid` → `sigil-scan` delta has no target.
   - State that main's `.plate-grid` span (`globals.css:903` in both stores) is the grid background the detector flags and §7.3 deletes.
   - State where the v5 one-pass read line goes if it is kept (inside `.plate-media`), without touching the pinned root class.
4. **(advisory)** DV-X1 and the §7.6 Accept bullet "detector shows only the DV-X1 rails". The detector also finds the `.scene-entity-identity` accent rail in two places, besides the refined copies at :296 and :382:
   - its pre-refinement source, `chrome/tree/styles.ts:36`;
   - the matching `previous` string, `chrome/core/styles.ts:379`.

   Say whether these count under DV-X1, or must change in lockstep (region rule plus `previous` string).
5. **(advisory)** DV-D2 on the desktop: several sub-11px sizes live only in `refined` strings:
   - `.assistant-route` 9px (:423);
   - 10px on `.project-recent-label` (:371), `.project-browser-detail dt/dd` (:374-375), `.scene-entity-identity dt` (:389), `.scene-property-review` (:392) and `.assistant-route-refusal` (:424).

   Name them in §7.6 next to the settings-form sizes, so the 11px raise is applied to the refined strings. The two pinned 10px selectors stay at 10px.
6. **(advisory)** DV-P3: the web shell keeps the press scale while the sites drop it, although v5 §5 lists "press scale (sites, web shell)" as one Button state, and DV-P2/P3 justify the store change by "one vocabulary". Add one sentence on why the web shell and Kids stay on v5: no pin forces a change there, and R-9 keeps v5 wherever nothing forces one. This stops a lane from "fixing" it in either direction.
7. **(advisory)** §10.3 lists `pnpm check:desktop` (and the lanes will run `check:sites`) as proof. Both exit 1 on the main baseline because `pnpm-workspace.yaml` globs `sites/` and `desktop/` (`gate-baseline.log:21-30`).
   - Say that a lane matches the baseline output for these two checks, not exit 0.
   - Note that R-8's "`pnpm check:sites` OK" was the v5 tree.
8. **(advisory)** The §0.6 `visual-refinement` row should also cite :66: the rendered chrome never contains `.shell[data-assistant-busy="true"] .viewport::after`. That is the test pin behind DV-P7's wash removal.

VERDICT: PASS
