# Concept A "Interlocking": working slice (finisher pass)

Worktree `../sceneaxi-slice-1` (branch `slice-1`, base `2cef2033`). Nothing is committed or merged. The builder was killed at 60 min. This file was written by the finisher, who added measurements only and made no code changes.

## Built (worktree diff)

| File | Change |
|---|---|
| `apps/web-shell/src/inspector-app.ts` | +267 lines changed. Change Review now renders `<ol id="rows">` with WHERE (doc + pointer route), BEFORE (struck through) and AFTER (marked) rows. It adds `#consequence` (all-or-nothing, refusal and recovery copy), a `#phase` plate, and `#note` (`role=status`) with an octagon icon on refusal. `pre#diff` is kept below as "Exact diff: the bytes Accept writes". `[hidden]{display:none!important}` is at :806 and is page-local (the inspector is its own document). |
| `sites/umbrella/src/app/page.tsx` | Overview rewritten in the Interlocking world (−372/+~150 lines). |
| `sites/umbrella/src/app/layout.tsx` | Chrome is gated by route: `x-sceneaxi-route === "/"` renders the world's own chrome, and every other route keeps v5. |
| `sites/umbrella/src/app/_signal/` (new) | `change-review-demo.tsx`, `fonts.ts`, `icons.tsx`, `signal-download.tsx`, `signal.css` (17,376 B) |
| `sites/umbrella/src/app/fonts/` (new) | Atkinson Hyperlegible Next/Mono and Big Shoulders Display woff2 files (85 KB total) |
| `sites/umbrella/pnpm-lock.yaml` | **Must be reverted** before merge. pnpm self-install noise (`packageManagerDependencies: pnpm 12.6.0`) was added to a nested lockfile. |

The brief names `_components/hero-viewport.tsx`, but it **does not exist** in the worktree. No 3D or hero viewport was built.

## G1 must-fix status

| Must-fix | Status | Evidence |
|---|---|---|
| Change Review shows structured before/after rows, not `#diff.textContent` | **Done.** `#rows` holds WHERE / BEFORE / AFTER. BEFORE value 12.64–15.76:1. AFTER `mark` 9.32:1 (reviewing, amber) and 9.88:1 (applied, green). State is shown as plate text plus icon ("PENDING REVIEW · UNWRITTEN", "REVIEWING"), not colour alone. | `slice/measure-ws.json`, `slice/inspector-*-review.png` |
| IDs and tests intact | **Pass.** `vitest run apps/web-shell/test/inspector-accessibility.test.ts` gives 12/12 (run 19:44 in the worktree). | console output |
| Global `[hidden]` scoped (A) | **Done.** Umbrella uses `.il [hidden]` (`signal.css:37`). The inspector rule is document-local. Probe: the hidden "Show the proposal again" button computes to `display:none`, and the visible Accept/Reject buttons compute to `flex`. | `measure-site.json#hiddenScope` |
| Shots at 1440 / 390 / 200% viewed | Partly. See the visual assessment: these were not looked at by a person. | below |

## Numbers

| Check | Umbrella `/` | Change Review (web-shell inspector) | Target |
|---|---|---|---|
| Control contrast: rest / hover / focus / active (min) | 8.28 / 8.28 / 8.28 / 6.87 at both 1440 and 390 (28 controls, 28 with focus ring) | light 14.14 all states; dark 10.92 all states; 390 idle 6.92 (light) / 7.85 (dark) | ≥4.5 |
| Disabled | none on page | dark 7.85:1. **Light disabled was not measured** (non-numeric probe result). | ≥4.5 (policy) |
| Lowest body text | 5.95 (`.il-claim` / `.il-context`) | light 6.53, dark 5.95 (footer, digests) | ≥4.5 |
| Refusal note | — | light 6.54, **dark 4.98** (`#note` `rgb(255,77,94)`, just above the 4.5 floor) | ≥4.5 |
| axe serious+critical | 0 (1440 and 390) | 0 (review, applied, refused × light and dark) | 0 |
| Keyboard | 29 tab stops, all with a visible ring. Skip link is `obscured:true` when off-screen at rest (expected for a skip link). | 10 stops, all with a ring, none obscured | — |
| 200% zoom | no overflow-x, min font 13px, 0 targets <24px, 5 targets <44px | no overflow-x, min 13px, 0 targets <24px, 6 targets <44px | — |
| Reduced motion | 0 running animations, demo not auto-armed | 0 | 0 |
| CSP (web-shell) | — | header intact, 0 violations | 0 |
| Lighthouse mobile (`next start`, this pass) | perf 70, **LCP 3,350 ms**, CLS 0.000, TBT 998 ms, a11y 100. Baseline was 55 / 4,585 / 0 / 2,015. | not run | LCP<2.5s |
| Lighthouse desktop | perf 57, LCP 1,392 ms, CLS 0.001, TBT 4,248 ms, a11y 100. Baseline was 98 / 954. | not run | — |
| CSS shipped | 106,180 B raw / 20,448 B gzip (3 files). Baseline was 90,437 / 15,993. The world CSS source is 17,376 B (13.7% of baseline globals), but **v5 `globals.css` (126,804 B) still ships**, so the gate fails until A5 retires it. | inline, not measured separately | ≤76,082 B source |
| Forced colors | screenshot only (`umbrella-1440-forced.png`, `inspector-forced.png`), no numeric probe | | |
| INP | not measured | not measured | <200ms |

Lighthouse caveat: host load average was **73** during the run. Both TBT figures, and the desktop perf score below baseline, are mostly host contention. Re-run on a quiet host before G2. The mobile LCP element is `p.il-lede` (text, not an image), so LCP should be achievable. Still, 3.35 s is a measured fail today.

## Screenshots

- 1440: [umbrella-1440.png](slice/umbrella-1440.png), [umbrella-1440-full.png](slice/umbrella-1440-full.png), [inspector-dark-1440-review.png](slice/inspector-dark-1440-review.png), [inspector-light-1440-review.png](slice/inspector-light-1440-review.png), applied/refused/rejected variants, [umbrella-1440-reduced.png](slice/umbrella-1440-reduced.png), [umbrella-1440-forced.png](slice/umbrella-1440-forced.png)
- 390: [umbrella-390.png](slice/umbrella-390.png), [umbrella-390-full.png](slice/umbrella-390-full.png), [inspector-light-390-review.png](slice/inspector-light-390-review.png), [inspector-dark-390-review.png](slice/inspector-dark-390-review.png)
- 200%: [umbrella-zoom200.png](slice/umbrella-zoom200.png), [inspector-zoom200.png](slice/inspector-zoom200.png)
- Lighthouse: [lighthouse-umbrella-mobile.json](slice/lighthouse-umbrella-mobile.json), [lighthouse-umbrella-desktop.json](slice/lighthouse-umbrella-desktop.json)

## Visual assessment

**Limitation:** the finisher's file reader cannot render PNGs. This assessment comes from OCR (tesseract), pixel sampling (PIL) and computed-style data. It is **not a human visual sign-off**, so the G1 rule "shots must be viewed" is still open. A person or an image-capable agent must look at the 6 files linked above before G2.

- **Slate-green at 390:** the panel fill is `rgb(47,74,68)` and covers 68% of the first viewport, with `rgb(30,43,40)` chrome. The screenshot is at DPR 1, and OCR read every line of hero, lede and download copy at 390 with no errors, which suggests the type renders crisply on the slate. Lowest text on slate is 5.95:1 (`#BCD0C9` on `#2F4A44`). That passes, but it is the softest pairing in the system.
- **Hierarchy (umbrella):** the order is H1 "Build scenes. / Keep the source." (LCP span), then the EARLY ACCESS · 0.0.0 plate, the lede, the CTA, OS-detected download facts, and the `scene.json · PENDING REVIEW` demo plate at the fold on 390. The signature (Change Review) reaches the first mobile viewport, which is good.
- **Hierarchy (inspector):** the order is plate, WHERE route, BEFORE/AFTER, consequence, Accept/Reject, then the raw diff. This is legible and follows propose → inspect → commit.
- **Tells and problems:**
  1. At 200% the umbrella nav reads "…Pricing Login Acco", with the last item cut at the right edge. Document overflow-x is false, so either the strip scrolls or it clips. Account and Download reachability at 200% needs a check.
  2. The inspector repeats "Review the exact diff before Accept. Reject discards the proposal without writing." twice (`#review-help` plus a second copy near the actions).
  3. At 390 the sha256 base digest wraps raggedly across 3 lines.
  4. On light, the BEFORE strike uses `--stale` amber on near-white, which is barely visible (it is decorative; the "BEFORE" label carries the meaning).
  5. The rest of the umbrella routes still render v5, so the slice is a split world.

## Gaps / open issues

1. Human visual sign-off on 1440/390/200% is outstanding (see above).
2. Mobile LCP is 3.35 s (fail) and TBT is high. Re-run on a quiet host; if it still fails, profile chunk `255-*.js` hydration.
3. The CSS budget fails while v5 `globals.css` ships next to `signal.css`. Retiring it belongs to A5, not the slice.
4. `sites/umbrella/pnpm-lock.yaml` was modified (nested lockfile, against the hard rules). Run `git -C ../sceneaxi-slice-1 checkout -- sites/umbrella/pnpm-lock.yaml`. The finisher does not own it and did not touch it.
5. Not built: the 3D or hero viewport, store and Kids dialects, Operate compact density. Packaged Electron launch was not tested, and `pnpm run gate` was not run in the worktree (the worktree has no root `node_modules`; the test above used the main repo's vitest).
6. Not measured: disabled contrast on light, non-text 3:1 UI boundaries, forced-colors (no numeric probe), INP.
7. Dark refusal note is 4.98:1, a thin margin. Consider `rgb(255,107,120)` or a lighter red.
8. Umbrella nav at 200% may clip Account/Download (tell 1 above).
