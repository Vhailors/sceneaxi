# Catalogs / Kids visual finish

**Bounded visual loop PASS; not production certification.** Real root `/home/devuser/Documents/Projects/sceneaxi`. Existing uncommitted work preserved; no commits, pushes, dependencies, contracts or activity/reducer changes.

## Changes

- `sites/catalog-{game,web}/src/app/globals.css:693`: identical shared skeleton, theme-connected GET controls, proper label/field grouping and 48px targets (before: 19–21px). Mobile puts search on its own row and pairs price/sort rather than squeezing the desktop row.
- Both sheets: framed listing cards, stronger item title hierarchy, grouped publish sections, padded empty/refusal states, 4px-based edited spacing, stronger keyboard outlines. Fixture markers no longer pulse as if live; 120ms press feedback respects reduced motion. Existing TEST/inert commerce and publish copy remain unchanged.
- `sites/kids/src/app/globals.css:159`: framed empty-stage guidance, calmer display scale, readable disabled controls, compact mobile stage and regrouped world choices. Press/addition feedback is local CSS. Foundation neutrals/violet remain isolated local copies; no site-kit import. Reducer twins remain byte-identical.
- `sites/catalog-game/test/visual-evidence/capture.mjs`: reproducible loopback-only production Chromium capture/assertion helper, using the already-installed Playwright package.

## Before / after screenshots

Fresh production builds precede both capture phases. Desktop **1440×1000**, mobile **390×844**, full-page PNGs. Each linked directory contains `before-{surface}-{viewport}.png` and `after-{surface}-{viewport}.png`.

| Surface | Desktop before → after | Mobile before → after |
|---|---|---|
| Forge home | [before](../../../sites/catalog-game/test/visual-evidence/before-home-desktop.png) → [after](../../../sites/catalog-game/test/visual-evidence/after-home-desktop.png) | [before](../../../sites/catalog-game/test/visual-evidence/before-home-mobile.png) → [after](../../../sites/catalog-game/test/visual-evidence/after-home-mobile.png) |
| Forge item | [before](../../../sites/catalog-game/test/visual-evidence/before-detail-desktop.png) → [after](../../../sites/catalog-game/test/visual-evidence/after-detail-desktop.png) | [before](../../../sites/catalog-game/test/visual-evidence/before-detail-mobile.png) → [after](../../../sites/catalog-game/test/visual-evidence/after-detail-mobile.png) |
| Forge publish | [before](../../../sites/catalog-game/test/visual-evidence/before-publish-desktop.png) → [after](../../../sites/catalog-game/test/visual-evidence/after-publish-desktop.png) | [before](../../../sites/catalog-game/test/visual-evidence/before-publish-mobile.png) → [after](../../../sites/catalog-game/test/visual-evidence/after-publish-mobile.png) |
| Vitrine home | [before](../../../sites/catalog-web/test/visual-evidence/before-home-desktop.png) → [after](../../../sites/catalog-web/test/visual-evidence/after-home-desktop.png) | [before](../../../sites/catalog-web/test/visual-evidence/before-home-mobile.png) → [after](../../../sites/catalog-web/test/visual-evidence/after-home-mobile.png) |
| Vitrine item | [before](../../../sites/catalog-web/test/visual-evidence/before-detail-desktop.png) → [after](../../../sites/catalog-web/test/visual-evidence/after-detail-desktop.png) | [before](../../../sites/catalog-web/test/visual-evidence/before-detail-mobile.png) → [after](../../../sites/catalog-web/test/visual-evidence/after-detail-mobile.png) |
| Vitrine publish | [before](../../../sites/catalog-web/test/visual-evidence/before-publish-desktop.png) → [after](../../../sites/catalog-web/test/visual-evidence/after-publish-desktop.png) | [before](../../../sites/catalog-web/test/visual-evidence/before-publish-mobile.png) → [after](../../../sites/catalog-web/test/visual-evidence/after-publish-mobile.png) |
| Kids activity | [before](../../../sites/kids/test/visual-evidence/before-activity-desktop.png) → [after](../../../sites/kids/test/visual-evidence/after-activity-desktop.png) | [before](../../../sites/kids/test/visual-evidence/before-activity-mobile.png) → [after](../../../sites/kids/test/visual-evidence/after-activity-mobile.png) |

Additional before/after empty and refused catalog screenshots and Kids playing screenshots are retained in these directories. **48 screenshots total**; exact paths, SHA-256, byte lengths and rendered metrics are in [before.json](../../../sites/catalog-game/test/visual-evidence/before.json) / [after.json](../../../sites/catalog-game/test/visual-evidence/after.json). All captured viewport cases have zero horizontal overflow/page errors. A dedicated browser-tool interface was unavailable; installed Playwright drove actual production Chromium instead. No manual image-review or exhaustive accessibility certification is claimed.

## Contrast

WCAG relative-luminance ratios: primary/panel **16.66:1**, secondary/panel **6.10:1**, field text **17.29:1**, field border **6.33:1**, game primary action **5.54:1**, web primary action **8.50:1**, Kids primary action **7.36:1**, Kids disabled text **5.38:1**. All meet AA normal-text 4.5:1; field boundaries exceed non-text 3:1. Existing shipped-pairing/token contrast suites pass. No new colors or theme variants invented.

## Verification

- Before and final after production builds: all **three sites pass**; final standalone typechecks: **three pass**.
- Owning Vitest command: `pnpm exec vitest run tests/sites/{catalog-storefronts,kids-surface,site-seams,site-kit-component-collapse}.test.ts packages/profile-kids/test/activity.test.ts packages/site-kit/test/{design-tokens,final-sites-acceptance}.test.ts --reporter=dot`: **7 files / 463 tests pass**, zero failures.
- Capture helper: **79 before / 87 after browser assertions pass**, 24 PNGs each phase. Existing `node scripts/finish-catalog-browser-proof.mjs`: **16 assertions pass**.
- Existing Kids production activity suite: **1 test pass**, actual keyboard Enter/Space, reduced motion, six-piece/undo/reset/reload controls; 14 same-origin document/style/script requests, zero connections/errors/cookies/storage/databases/caches/workers. Log: `sites/kids/test/visual-evidence/production-activity.log`.
- Capture helper ESLint and oxlint anti-slop: **zero errors/warnings**. CSS has no type assertions; no disables added. Reducer `cmp` and scoped `git diff --check` pass. Build/typecheck/test receipts live under owned `test/visual-evidence/` paths.

Recovered failures retained here: initial owning run **461 pass / 2 fail**, `catalog-storefronts.test.ts:562` expected `animation: sa-dot` because its now-unused keyframes remained; removed the unused definition in both sheets, unchanged assertions then **463 pass**. Initial standalone catalogs failed on concurrent engine `gameplay.ts:168` pressed/value and `session.ts:189–203,390` typing; shared owner repair was observed and final standalone checks passed without foreign edits. Initial helper lint reported unqualified Node/browser globals and eight readable-spacing errors; explicit imports/globalThis plus oxlint spacing fixes now pass. `prettier` was unavailable (`Command "prettier" not found`, exit 254); no dependency was installed. Full repository gate was not rerun by this lane. No loading state was fabricated on synchronous surfaces; provider/native/production clearance remains outside this visual loop.
