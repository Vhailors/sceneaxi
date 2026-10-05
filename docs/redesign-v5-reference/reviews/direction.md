# Review: docs/redesign/DIRECTION.md (Direction v4)

Reviewer: independent (I did not write the direction). Date: 2026-10-04. Replaces the v3 review.

Verdict: **FAIL**, on criterion (g) only. Criteria (a) to (f) hold. The §6.3 interaction rows are
clean, but the motion system also contains §6.2 rule 5 and DV-D6, which tell the desktop lane to
keep two loops at their current timing: `assistant-bars 0.9s ease-in-out infinite` and
`sweep 1.1s linear infinite` (`apps/desktop-shell/src/chrome.ts:1493,1448`). Both are indeterminate
pending indicators, which is exactly the scope of ruling R-1. R-1 allows such loops only through
the two named tokens, and it says "every other animation stays inside the 120–320ms transition
contract". So the direction contradicts its own ruling and keeps ease-in-out and linear curves that
hard rule 6 does not allow. No test forces this: `visual-refinement.test.ts:68` pins only the
substring `animation:assistant-bars`. Fixes 1 to 3 below close (g). Fix 4 is a contract (rule 5)
defect that a lane would trip on.

## What I ran (cwd R)

- Read: all of `DIRECTION.md` (727 lines), `RULINGS.md`, the v3 review and `E/before/NOTES.md`. `PRODUCT.md` (146 lines) and `DESIGN.md` (347 lines) both exist. No skill-load tool was available here, so I read impeccable `operate.md` (the product slop test), `craft-floor.md`, `animate.md` and `shape.md` directly. The skill has no `brand.md` or `product.md`; `operate.md` is the register file.
- `node …/impeccable/scripts/context.mjs --target docs/redesign/DIRECTION.md`: it ran and printed PRODUCT.md.
- Detector `--json` on `DIRECTION.md DESIGN.md PRODUCT.md`: `[]`, exit 0. Control run on `sites/catalog-web/src/app/globals.css`: 3 findings (`:911` grid, `:1304` and `:1801` side-tabs). This matches what §7.3 says to delete, so the detector is live.
- `git ls-files` (the four roots) gave 111 tracked files. `--others --exclude-standard` gave 10 untracked (the fallback `.tsx` files plus two umbrella `api/` files). I mapped all 121 against the §9 rules with a script: **121 have exactly one owner, 0 have none, 0 have two.**
- Route inventory from `page/not-found/error/loading/global-error.tsx`: umbrella has 14 pages + 404 + error = 16, all briefed; each store has `/`, item, publish, 404, error, loading and global-error; Kids has `/`, loading and global-error. Web shell: I grepped `account-panel.ts`, `assistant-panel.ts` and `open-path-view.ts`; they hold only TS generics and no markup, so the "no markup" note in §7.5 is true. The Linux renderer has 8 files, covered by §7.7.
- `E/before`: 169 PNGs. Umbrella has 18 states × 3, each store 7 × 3, Kids 3 × 3, web shell 10 × 3, desktop 14 × 2, desktop-linux 3 × 2. I read the IHDR width of every PNG and compared it with the width in the file name: 0 mismatches. The smallest file is 12 KB, so none is blank. I did not look at the pixels.
- I read the tests behind the v4 pins: `rendered-route-states.test.mjs` (whole file), `catalog-storefronts.test.ts:97-123,124-131,186-200,339-380,436-442`, `design-tokens.test.ts:194-205,231-241`, `chrome.test.ts:383-393,792-796,923-927`, `visual-tokens.test.ts:157-162` and the `visual-refinement.test.ts` pins (:41, 68, 92, 109, 117, 118). The cited CSP lines are correct: `sites/catalog-web/src/middleware.ts:11` and `sites/kids/security-headers.json:5,19`. So is `sites/umbrella/playwright.config.ts:21` (`testDir: "./test"`).
- I asked the orchestrator (`orch:orun-3-fd810cf5`, message `lm_10`) to confirm R-1. It did not reply within 60 s. R-1 is therefore verified only as text in `RULINGS.md`.
- Not run: browser, `pnpm build` and the test suites. This review covers a document, and no product code changed.

## Criteria

| # | Result | Evidence |
|---|---|---|
| a | PASS | Both files exist. |
| b | PASS | All required sections are present: §1 scene and theme per surface, §2 colour, §3 type, §4 spacing, §5 components (every control row names its five states), §6 motion (18 named tokens; each of the 20 rows has a reduced-motion fallback), §7 briefs, §8 deviations, §9 ownership. |
| c | PASS | Umbrella has 16 routes plus 2 loading states. Each store has 4 routes plus 3 fallbacks; Kids has 1 route plus 2 fallbacks; web shell is 1 inspector plus 3 panels that render no markup (verified); desktop chrome §7.6 and Linux renderer §7.7. |
| d | PASS | 121/121 files have exactly one owner (script above). |
| e | PASS | Every route and state has 3 widths (desktop 2 sizes). Linux renderer states that were not captured carry a recorded reason (BASELINE.md, §7.7). |
| f | PASS | Nothing prescribed hits an absolute ban. DV-X1 pinned rails are contract-over-ban and recorded. The float shadow is 14px blur (<16). Radii ≤16. Storefront washes are surface gradients, not gradient text. Slop test, altitude 1 (category): the dark theme is argued from the scene (evening desk, dim room), and the signature moments (diff strike-resolve, canvas aperture, piece landing) cannot be guessed from "dev-tool site". Altitude 2 (second-order reflex): the "technical mono-uppercase everywhere" lane is explicitly refused (§3 Label row: mono only on machine values), and so are ruled grids for non-evidence content (§5 composition rule). Operate surfaces keep earned familiarity (operate.md). |
| g | **FAIL** | Rows 1–20 use 120–320ms with quart/quint/expo easing and only transform/opacity/clip-path/filter. Rows 5 and 18 use the 1200ms loop under R-1. **But** §6.2 rule 5 and DV-D6 keep `assistant-bars` (0.9s ease-in-out) and the sculpt `sweep` (1.1s linear) "at their current timing", which breaks R-1 ("both must be named tokens"; "every other animation stays inside") and the hard-rule-6 easing. Kids `play-float` (1.8s/1.55s ease-in-out alternate, `sites/kids/src/app/globals.css:204,208`) is kept under §6.2 rule 7 as "content motion", an exemption that neither the run contract nor R-1 grants and that no Deviation records. |

## Fixes (numbered, concrete)

1. **(blocking, g)** §6.2 rule 5 and DV-D6: replace "keep their current timing" with "move onto the R-1 tokens". Write `.assistant-live i{…animation:assistant-bars var(--motion-duration-loop) var(--motion-ease-out-quart) infinite}`; this keeps the pinned substring `animation:assistant-bars` (`visual-refinement.test.ts:68`) and the per-bar `animation-delay` stagger. Write `.sculpt-sweep{…animation:sweep var(--motion-duration-loop) var(--motion-ease-out-quart) infinite}`. Both already animate only opacity-in-keyframes or transform. The blanket reduced-motion rule (`chrome.test.ts:794`) already makes them static. Add one sentence to §7.6 Changes saying so.
2. **(blocking, g)** Kids `play-float` (row 20, §6.2 rule 7, §7.4). Choose one and write it down:
   - (a) Ask the run contract owner for ruling R-2 in `RULINGS.md`: "product content motion: Kids play-float, which runs only under `.is-playing`, is static under reduced motion, and animates transform only". Record it as DV-K2.
   - (b) Retime it onto the tokens.

   Do not leave it exempt by assertion. The same applies to rule 7's general carve-out: WebGL canvases are runtime output and fine, but CSS loops in lane-owned files are not "content".
3. **(g, completeness)** §7.6 should name the existing desktop entrances `animation:rise .3s ease-out` and `rise .16s ease-out` (`chrome.ts:1444,1501,1562`; keyframe `translateY(7px)` at `:1596`). Migrate them to `--motion-duration-panel` / `--motion-duration-micro`, `--motion-ease-out-expo` / `--motion-ease-out-quart` and `--motion-distance-sm`/`-md`. 7px is off-token, and plain `ease-out` is not quart/quint/expo. §7.4 should say that Kids `piece-arrive 160ms ease-out` (`globals.css:423`) is replaced by the row 20 placement motion.
4. **(rule 5, blocking for lane-catalogs and lane-kids)** `rendered-route-states.test.mjs:63` asserts `/<h1>/`, so every `global-error.tsx` heading must be attribute-free. The §0 fallback row lists the attribute-free `<body>` but not the `<h1>` for global-error. §7.3 "Root failure" says "Classes go on `main` and its children", which permits `<h1 className>` and fails the test. Change it to: "the `<h1>` stays attribute-free; style it by a descendant selector (`main h1`); classes only on `main`, `p` and `a`". Say the same in §7.4.
5. **(advisory)** The `global-error.tsx` inline `<style>` pastes palette hex values. No test scans `src/app/*.tsx` for them (`catalog-storefronts.test.ts:369-372` scans only `globals.css` and the shared modules), but this goes against the "palette in exactly one place" intent stated at `:361-368`. Record it as a Deviation (for example DV-F12: "fallback documents duplicate literal palette values because no import is possible").
6. **(advisory, provenance)** The orchestrator did not confirm R-1 to this reviewer (`lm_10`, 60 s timeout). Have the orchestrator confirm in `RULINGS.md` in its own words, or reply on the link, before lanes rely on rows 5 and 18.
7. **(advisory)** The Change Review per-row ✕/✓ and other Unicode glyphs act as icons, which `craft-floor.md` lists as a refuse-default. They are site-kit's existing markup, so note in §5 whether they stay as accepted text glyphs (aria-labelled) or are swapped for drawn SVG by the foundation.

After fixes 1–4 the direction passes (g) on its own text. No other criterion needs a change.
