# Concept B — Working Slice (SLICE.md)

Status: FINAL (finisher B, 2026-10-06). Measured; not built further. The worktree is not merged or committed.
Worktree: `../sceneaxi-slice-2` (branch `slice-2`). Evidence: `concepts/b/slice/*.png` and `concepts/b/slice/raw/*.json`.
Scratch harness: `/tmp/slice2/{measure.mjs,cr-sweep.mjs,ocr.mjs}`. All of it imports `~/Documents/Reports/sceneaxi-redesign-v6/baseline/_work/lib.mjs`.

## Built (worktree, uncommitted)
| File | Change |
|---|---|
| `sites/umbrella/src/app/slice-b.css` (new, 18,423 B) | Replaces `globals.css` (126,804 B) for the slice. Holds Persuade dialect tokens and the `.ref` drafting lettering at 13px. |
| `sites/umbrella/src/app/_components/hero-review.tsx` (new) | Hero Change Review: propose, before/after rows, consequence, recovery, then Accept or Reject. Reject leaves the stamp "Rejected · Nothing written". |
| `sites/umbrella/src/app/fonts/` (new) | Self-hosted Osifont (drafting lettering) and Public Sans. |
| `sites/umbrella/src/app/{layout,page}.tsx` | Imports `slice-b.css` and next/font/local. The hero is rewritten around the review panel. |
| `apps/web-shell/src/inspector-app.ts` (316 lines changed) | Structured `#review-rows` before/after list (`:978`, `:1067`), marks with label+icon, comfortable/compact density, stale and outcome-unknown recovery. `#diff` is kept (`:993`, `:1124`). |
| `apps/web-shell/test/{inspector-accessibility,visual-postpr}.test.ts` | Small assertion updates for the new rows. No new test files. |
| `sites/umbrella/pnpm-lock.yaml` (+327) | **Violates the hard rule** against nested lockfiles. See Open issues. |

The web-shell dist was rebuilt at 19:23 and the server restarted at 19:23:45. Source last changed at 19:21. The first evidence pass ran at 19:17–19:20 against the older build, so **every PNG and `results.json` was regenerated at 19:49** against the current dist.

## G1 must-fix status
| Item | Status | Evidence |
|---|---|---|
| Change Review used to show only `#diff.textContent`; G1 asked for structured before/after without breaking ids/tests | **Done.** `#review-rows` holds BEFORE·REV A and AFTER·REV B rows. `#diff`, `#propose`, `#accept`, `#reject`, `#review` and data attributes are kept. Vitest passes 25/25 across `inspector-accessibility`, `visual-postpr` and `bin-smoke`. | `webshell-*-pending.png`, `raw/results.json` → `webshell.keyboard` |
| Visual sign-off at 1440 / 390 / 200% | **OPEN.** Shots exist for all three, but this finisher's read tool cannot render images ("Cannot read binary file"), so nobody has looked at them yet. I only checked them with OCR (below). | `umbrella-{1440,390,zoom200}-fold.png`, `webshell-light-zoom200-*.png` |
| Static zone refs, no JS layout measurement in Operate | **Done.** grep for `getBoundingClientRect|offset*|ResizeObserver|IntersectionObserver|client*|scrollHeight|.style.(top|left|width|height|transform)` across `inspector-app.ts`, `hero-review.tsx` and `page.tsx` returns 0 hits. "Sheet 1 of 5 · Zone A1" is static `aria-hidden` text (`page.tsx:43`). | grep rc=1 |
| 13px drafting lettering readable at 200% | **Partial (proxy only).** On a tesseract OCR proxy, the 25 Osifont 13px labels score 0.775 character accuracy at 200% (21/25 exact). The same strings in Public Sans score 0.847 (20/25 exact). The misses are chips with mixed content ("Web Experience · Not yet claimed", "Kids · Refuse-only"). Contrast at 13px is ≥5.79:1. No human read has been done. | `raw/osifont-ocr.json` |
| 28px compact controls meet WCAG 2.5.8, including spacing | **Pass.** The smallest compact target is 72×28 CSS px, which is ≥24 on both axes, so the spacing exception is not needed. 0 failures. Adjacent targets touch (gap 0), which 2.5.8 allows at ≥24px. Comfortable is 87×32 (36 for actions). Umbrella minimum height is 28, also 0 fails. | `raw/cr-state-sweep.json` → `targets` |
| Kids stays in shared family core | **Not demonstrated.** Kids is not part of this slice. | — |

## Numbers
| Metric | Umbrella home | Change Review (web-shell) | Gate |
|---|---|---|---|
| axe serious/critical | 0 at 390, 1440, 200% | 0 in every state (idle, pending, rejected, refused, verified, compact, stale, outcome-unknown) × light/dark | 0 ✅ |
| Min text contrast | 5.79:1 (13px "Startable" chip) | light 5.79, dark 5.60, stale mark 5.67 | ≥4.5 ✅ |
| Control contrast rest / hover / active / focus | 10.56 / 8.30 / 9.06 / 10.56 | light 12.04 / 8.75 / 8.75 / 12.04, dark 10.56 / 8.30 / 9.06 / 10.56 (5 buttons × comfy/compact × idle/pending) | ≥4.5 ✅ |
| Focus ring | visible on 30/30 tab stops, 0 obscured | ring ≥10.56:1, 0 obscured, 0 missing `:focus-visible` | ✅ |
| Disabled state | none rendered | none rendered in the measured states | **not measured** |
| Keyboard core flow | 26 Tabs to Accept. Accept leads to "Checked · Change written". Reject leads to "Rejected · Nothing written". 0 CSP violations. | Propose moves focus to Accept, with the consequence visible before Accept. Accept leads to "Verified · written" and focus returns to Propose. | ✅ |
| Overflow-x | 0 at 390, 1440, 720 (200%) | 0 | ✅ |
| Reduced motion | 0 running animations (default run: `stamp-land`) | 0 during propose and accept | ✅ |
| Hero frame pacing | 60 fps, p95 16.8 ms, WebGL contexts 0 (no 3D) | — | ✅ |
| Forced colors | axe flags `color-contrast` on 40 nodes | axe flags 4 nodes (`#density-comfortable`, `#propose`, `#phase`, `#accept`) | likely an axe false positive under emulation, **unverified** |
| Lighthouse desktop | perf 95, LCP 1,121 ms, CLS 0, TBT 16 ms, 456 KB (baseline 98 / 953 / 0 / 63 / 822 KB) | not run | ✅ |
| Lighthouse mobile | perf 69, LCP 2,260 ms, CLS 0, **TBT 2,647 ms**, 508 KB (baseline 55 / 4,585 / 0 / 2,015 / 639 KB) | not run | LCP ✅, INP risk ⚠ |
| CSS source | 18,423 B, 14.5% of the 126,804 B baseline (budget 76,082) | inline in `inspector-app.ts` | ✅ |
| CSS shipped | 16,363 B raw / 4,193 B gzip | — | — |

Raw data: `raw/results.json`, `raw/cr-state-sweep.json`, `raw/osifont-ocr.json`, `raw/lh-umb-{desktop,mobile}.json`, `raw/*-sweep*.json`.

## Screenshots
- Umbrella: [1440 fold](slice/umbrella-1440-fold.png) · [1440 full](slice/umbrella-1440.png) · [390 fold](slice/umbrella-390-fold.png) · [390 full](slice/umbrella-390.png) · [200% fold](slice/umbrella-zoom200-fold.png) · [200% full](slice/umbrella-zoom200.png) · [hero verified](slice/umbrella-1440-hero-verified.png) · [hero rejected](slice/umbrella-1440-hero-rejected.png) · [390 hero verified](slice/umbrella-390-hero-verified.png) · [forced colors](slice/umbrella-1440-forced-colors.png) · [reduced motion](slice/umbrella-1440-reduced-motion-verified.png)
- Change Review, light: [pending](slice/webshell-light-1440-pending.png) · [verified](slice/webshell-light-1440-verified.png) · [rejected](slice/webshell-light-1440-rejected.png) · [refused](slice/webshell-light-1440-refused.png) · [stale](slice/webshell-light-1440-stale.png) · [outcome-unknown](slice/webshell-light-1440-outcome-unknown.png) · [compact](slice/webshell-light-1440-compact-pending.png) · [forced colors](slice/webshell-light-1440-forced-colors-pending.png) · [reduced motion](slice/webshell-light-1440-reduced-motion-verified.png)
- Change Review, dark: [pending](slice/webshell-dark-1440-pending.png) · [verified](slice/webshell-dark-1440-verified.png) · [refused](slice/webshell-dark-1440-refused.png) · [compact](slice/webshell-dark-1440-compact-pending.png)
- 390 and 200%: `slice/webshell-{light,dark}-390-*.png`, `slice/webshell-light-zoom200-*.png`

## Visual assessment (honest)
**These screenshots have not been looked at.** The finisher's read tool rejects PNG ("Cannot read binary file"), so I had no way to view them. G1's "nobody has visually signed off" is still open, and a human or a vision-capable agent must open the fold shots above before G2. What I could check without viewing:
- **1440 fold (OCR).** The masthead reads cleanly. "Sheet 1 of 5 · Zone A1" sits above a hero review panel that shows "1 proposed change ⚠ Pending review", DOCUMENT `scene.json` / POINTER `/data/entities/0/x`, and BEFORE·REV A / AFTER·REV B with "On disk now" vs "Proposed, not yet written". It also shows the full Consequence and Recovery copy. The display headline does not OCR ("Build scenes. Keep the source." comes back as glyph noise). That is expected for a large display face, but someone should look to confirm.
- **390 fold (OCR).** Reading order is headline → early access → Linux detection copy → platform list → "Open the proof" → review panel. The review panel sits below the fold at 390, so Change Review is not first-screen on mobile.
- **200% (720 CSS px) fold.** Only the masthead and headline fit. The nav wraps to two lines ("Account" drops to line 2) with 0 overflow-x.
- **Web-shell pending (OCR).** The structured rows read in order: document → pointer → BEFORE/AFTER → base sha256 → "proposed, not yet written" → Consequence → Recovery. The phase badge OCRs as garbage ("Phase: [iB"), so its rendering needs a look.

## Gaps / open issues
1. **Visual sign-off has not been done** (G1 must-fix). It needs eyes on the fold shots at 1440, 390 and 200%, plus web-shell pending and compact.
2. **Nested lockfile.** `sites/umbrella/pnpm-lock.yaml` was modified (+327 lines) to add fonts or deps. This breaks the root-workspace-only rule. Revert it and move any deps to the root before merge.
3. **Mobile TBT is 2,647 ms** (worse than the 2,015 ms baseline), which puts INP under 200 ms at risk. INP was not measured in the field or under interaction.
4. **Forced colors.** axe flags `color-contrast` serious under emulation. I believe it is a false positive, but the forced-colors PNGs have not been viewed.
5. **Disabled-state contrast was not measured.** No disabled control renders in the measured states.
6. **Osifont at 13px reads slightly worse than the Public Sans control** (OCR 0.775 vs 0.847 at 200%). This is a proxy only. Keep 13px Osifont for uppercase refs only, and never for chips that mix content.
7. **Change Review is below the fold at 390** on the umbrella home.
8. Kids dialect is not in the slice. Lighthouse was not run on web-shell. The packaged Electron app and `pnpm run gate` were not run on `slice-2`.
9. The font license for the self-hosted Osifont and Public Sans in `sites/umbrella/src/app/fonts/` has not been checked.
