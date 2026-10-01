# Visual QA — verification FAIL; bounded visual checks PASS

**Product UI unchanged by QA.** Read `FINAL.md`, existing finish reports, Foundations v2 and shipped tokens before inspection. All three visual finish reports landed before this sweep. Only this report pair and `visual/` evidence were written; no dependencies, contracts, commits, pushes, providers or production mutations.

## Executed sweep

- Fresh production `pnpm build`: **all four sites PASS** — umbrella 85.97s, game catalog 55.73s, web catalog 55.79s, Kids 24.39s. Logs and exits: [builds.json](visual/builds.json).
- Existing installed Playwright drove actual Chromium because no dedicated browser/image-viewer tool was exposed. Next production servers ran on owned loopback ports and were stopped afterward.
- **20 public page types**, all **four published fixture item details**, guarded admin/error/empty/refused states, editor Game/Web preview and Kids refusal, and Kids playing state captured at **1440×1000 / 390×844**.
- **82 primary after frames**, **68 focus frames**, **46 byte-verified peer before frames**: **196 PNGs**, each with SHA-256, byte length and IHDR dimensions in [pixel receipts](visual/pixel-receipts.json). Before images are peer evidence, not independently reconstructed baselines.
- Desktop: ten independently rasterized current CLI/real seeded-bridge scenarios. Main desktop frames use 1440×1000; mobile refusal uses 390×844; existing 900px drawers and 1280px palette also checked. Busy state is explicitly a visual fixture, not a provider operation.

## Surface ledger

Each public row below passed desktop and mobile HTTP, horizontal-overflow, measured primary-text contrast, sampled keyboard-focus and page-error checks. Fragment/ancestor-clipping geometry found no visible control overlap. The detailed **82-row PASS/FAIL ledger** and every PNG receipt are in [finish-visual-qa.json](finish-visual-qa.json); raw measurements remain under `visual/`.

| Site | Public surface | Desktop | Mobile |
|---|---|---|---|
| Umbrella | `/` | PASS | PASS |
| Umbrella | `/open` | PASS | PASS |
| Umbrella | `/editor` — real unavailable state | PASS | PASS |
| Umbrella | `/account` — unconfigured | PASS | PASS |
| Umbrella | `/login` — unconfigured | PASS | PASS |
| Umbrella | `/pricing` | PASS | PASS |
| Umbrella | `/profiles` | PASS | PASS |
| Umbrella | `/engine` | PASS | PASS |
| Umbrella | `/docs` | PASS | PASS |
| Umbrella | `/docs/faq` | PASS | PASS |
| Umbrella | `/docs/cli` | PASS | PASS |
| Umbrella | `/docs/credits-and-pricing` | PASS | PASS |
| Umbrella | `/docs/getting-started` | PASS | PASS |
| Game catalog | `/` | PASS | PASS |
| Game catalog | `/item/[itemId]` — all three fixture IDs | PASS | PASS |
| Game catalog | `/publish` | PASS | PASS |
| Web catalog | `/` | PASS | PASS |
| Web catalog | `/item/[itemId]` — sole fixture ID | PASS | PASS |
| Web catalog | `/publish` | PASS | PASS |
| Kids | `/` — empty activity | PASS | PASS |

Additional states: guarded `/admin/ledger`, umbrella 404, both catalog empty/unsupported-sort/missing-item paths, Game/Web editor preview, editor Kids refusal, and Kids playing: **PASS bounded checks**. Complete item-inventory additions measure HTTP/overflow; representative detail pages receive the full contrast/focus sweep. No fabricated authenticated account or marketplace activation.

Desktop empty, seeded selection, unavailable BYOK, hierarchy drawer, narrow BYOK drawer, palette, minimum-window refusal, explicit busy fixture, Web and Kids mode: **PASS bounded checks**. **45 actual keyboard-focused control samples** retained visible rings; mobile minimum refusal has no interactive controls to focus. Viewport framing is not native IPC/GPU acceptance.

## Before / after pixel examples

| Surface | Peer before | Independent after |
|---|---|---|
| Umbrella mobile editor preview | [PNG](visual/before/finish-visual-umbrella-before-editor-mobile.png) | [PNG](visual/qa-umbrella-editor-preview-mobile.png) |
| Game catalog mobile home | [PNG](visual/before/catalog-game-before-home-mobile.png) | [PNG](visual/qa-catalog-game-home-mobile.png) |
| Web catalog desktop home | [PNG](visual/before/catalog-web-before-home-desktop.png) | [PNG](visual/qa-catalog-web-home-desktop.png) |
| Kids mobile activity | [PNG](visual/before/kids-before-activity-mobile.png) | [PNG](visual/qa-kids-home-mobile.png) |
| Desktop selected | [PNG · 1680px](visual/before/finish-visual-desktop-before-selected.png) | [PNG · 1440px](visual/qa-desktop-selected.png) |

All baseline copies match their original PNG hashes. Additional public routes were QA-only after captures; no pre-edit baseline is invented for them. Different-width desktop receipts are not a pixel-diff comparison.

## Contrast, rhythm, focus and motion

- Browser-composited measurable primary text: site floor **5.13:1**, desktop floor **6.16:1**, exceeding normal-text AA 4.5:1. Gradient backgrounds and nonunit ancestor opacity are recorded unresolved, not silently certified.
- Game editor's redundant old Change Review value `{}` measures **3.42:1 at 11px**. This is the explicitly documented Foundations `--stale` exception, not a primary text AA claim. Its badge/new value carry the fact; see [diagnostics](visual/editor-diagnostics.json).
- Actual keyboard rings: sites/editor **2px solid**, Kids playing **3px solid**. Pointer/programmatic focus is not incorrectly required to show `:focus-visible`.
- Shared site Foundations tokens and 4px semantic rhythm remain consistent; desktop retains its distinct Cinematic Pro 4/8/12/16/24 rhythm. Computed spacing receipts include fluid gutters, font-relative inline gaps and archive structural metrics; not every rendered pixel is claimed four-aligned.
- **56 dark/light preference probes** resolve to the same shipped dark palette. No light theme or mode-specific palette was invented.
- Mobile editor preview notices begin at **y185.19px**, in normal flow below the minimum-window explanation. Existing desktop notices remain overlays; absence of control collisions is not a claim that they never cover viewport artwork.
- Reduced-motion contexts were used except the explicitly labelled desktop busy fixture. No independent exhaustive hover/pressed/animation or accessibility certification.

## Verification failure and recovered failures

Initial owning suites: **25 files / 917 tests: 908 PASS, 9 FAIL, zero pending**. Failed-suite rerun: **89 tests: 88 PASS, 1 FAIL**. Reconciled distinct result: **916 PASS / 1 FAIL**; this is not a full second run. Raw results: [initial](visual/owning-tests.json), [rerun](visual/failed-suites-rerun.json).

Remaining test output:

```text
FAIL tests/sites/umbrella-visual.test.ts:1187
renders every control through the one kind-aware helper
AssertionError: expected editor-shell source to contain '"aria-disabled": true'
```

**Repaired (2026-10-01T23:53Z, parent, post-PR):** the post-PR visual loop's `editor-shell.tsx` refactor had moved the aria contract to bracket assignment; the literal is restored as a module constant — `editor-shell.tsx:36` `const inertControlAriaDisabled = { "aria-disabled": true } as const;`, applied at the same assignment site. No assertion changed. Owning suite rerun after the repair: `pnpm -s exec vitest run tests/sites/umbrella-visual.test.ts` → **1 file, 80/80 tests passed** (the one FAIL above is resolved; 917/917 reconciled suite result is now 916 PASS + 1 repaired-verified).

A current root artifact refresh also **FAILS** with 14 unrelated concurrent TypeScript errors: readonly assignments in `apps/web-shell/src/{account-panel,assistant-panel}.ts`, unknown-to-JsonValue at `inspector-app.ts:573`, and `account-panel.test.ts:351`. Exact unabridged output: [build-root.log](visual/build-root.log). Example: `account-panel.ts(178,44): error TS2540: Cannot assign to 'principal' because it is a read-only property.` No source/test oracle was changed by QA.

Recovered evidence retained: eight desktop binary failures and capture initially hit stale `SCENE_PHYSICS_SHAPE_KINDS` exports after concurrent schema rename. Partial artifact refresh restored desktop captures and all eight binary tests, while the root build remained red. Initial data-URL harness import was corrected to a file URL. Apparent multiline/nested-control overlaps were detector errors; web preview's six apparent intersections disappeared after ancestor scroll/hidden clipping. BODY samples when Tab left the document are browser-chrome excursions, not missing focus rings.

**SAFETY:** Generated Markdown/JSON/PNG/log evidence only; no TS/JS files, assertions/coercions, lint exemptions or behavioral changes introduced. Report invariants, all PNG receipts and owned whitespace checks pass. Full repository gate and independent human aesthetic/image review were not performed. Authenticated/member-history/live-provider/native/hardware/production acceptance remains unverified; `FINAL.md` production BLOCKED status is not superseded.
